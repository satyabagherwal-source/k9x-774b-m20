# Forensic Learning Record (Deep Inspection): authzed/spicedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/authzed-spicedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/authzed/spicedb](https://github.com/authzed/spicedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:08:26.257Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `authzed/spicedb`
- **Description**: Open Source, Google Zanzibar-inspired database for scalably storing and querying fine-grained authorization data
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 7120 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/util.go`
```
package e2e

import (
	"io"
	"testing"
)

// TLogger wraps a testing.TB and makes it conform to io.Writer
type TLogger struct {
	testing.TB
}

// Write satisfied io.Writer
func (t *TLogger) Write(p []byte) (int, error) {
	t.Helper()
	t.Log(string(p))
	return len(p), nil
}

// NewTLog returns a TLogger
func NewTLog(t testing.TB) io.Writer {
	t.Helper()
	return &TLogger{TB: t}
}

```

### Core Architecture Module: `internal/datastore/crdb/schema/indexutil.go`
```
package schema

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/authzed/spicedb/internal/datastore/common"
	"github.com/authzed/spicedb/pkg/datastore"
	"github.com/authzed/spicedb/pkg/genutil/mapz"
	"github.com/authzed/spicedb/pkg/spiceerrors"
)

var parsedColumnsPerIndex = map[string][]string{}

func init() {
	mustInit()
}

func mustInit() {
	for _, idx := range crdbAllIndexes {
		parsed, err := parseIndexColumns(idx.ColumnsSQL)
		if err != nil {
			panic(err)
		}
		parsedColumnsPerIndex[idx.Name] = parsed
	}
}

var indexColumnRegex = regexp.MustCompile(`\(([^)]+)\)`)

func parseIndexColumns(columnsSQL string) ([]string, error) {
	// Match columns within parentheses, handling both PRIMARY KEY and table_name formats
	matches := indexColumnRegex.FindStringSubmatch(columnsSQL)
	if len(matches) < 2 {
		return nil, fmt.Errorf("no columns found in parentheses in SQL: %s", columnsSQL)
	}

	// Split by comma and trim whitespace
	columnsStr := matches[1]
	columns := regexp.MustCompile(`\s*,\s*`).Split(columnsStr, -1)

	// Trim any remaining whitespace
	foundColumns := mapz.NewSet[string]()
	for i, col := range columns {
		trimmed := strings.TrimSpace(col)
		if trimmed == "" {
			return nil, fmt.Errorf("empty column name found in SQL: %s", columnsSQL)
		}

		if !foundColumns.Add(trimmed) {
			return nil, fmt.Errorf("duplicate column found in index definition: %s", trimmed)
		}

		columns[i] = trimmed
	}

	return columns, nil
}

func forcedIndexForFilter(filter datastore.RelationshipsFilter, indexes []common.IndexDefinition) (*common.IndexDefinition, error) {
	// Algorithm: Find the index that has the most leading columns matching the filter.
	// If at any point a column within the index is not in the filter, we stop checking for
	// that index. We return the index with the most leading columns matched. Resource IDs
	// are treated as an *immediate* stop, as prefix scanning does not work well with
	// a following field in the index.
	var bestIndex *common.IndexDefinition
	var bestCount int

	for _, idx := range indexes {
		count, err := checkIfMatchingIndex(filter, idx)
		if err != nil {
			return nil, err
		}

		if count > 0 {
			if count > bestCount {
				bestCount = count
				bestIndex = &idx
			} else if count == bestCount {
				// If we find two matching indexes, let CRDB decide.
				return nil, nil
			}
		}
	}

	return bestIndex, nil
}

const doesNotMatch = -1

func checkIfMatchingIndex(filter datastore.RelationshipsFilter, idx common.IndexDefinition) (int, error) {
	columnNames, ok := parsedColumnsPerIndex[idx.Name]
	if !ok {
		return -1, spiceerrors.MustBugf("index %s not found in parsed columns", idx.Name)
	}

	lastMatchingColIndex := doesNotMatch

	allowAdditionalColumns := true
	for columnIndex, colName := range columnNames {
		filterStatus, err := checkFilterColumnMatchesFilter(colName, filter)
		if err != nil {
			return doesNotMatch, err
		}

		switch filterStatus {
		case columnFilterNoMatch:
			if columnIndex == 0 {
				// If the first column doesn't match, this index is not a match.
				return doesNotMatch, nil
			}

			continue

		case columnFilterStop:
			allowAdditionalColumns = false
			if columnIndex > lastMatchingColIndex+1 {
				// We had a gap in matching columns, so we stop here.
				return doesNotMatch, nil
			}

			lastMatchingColIndex = columnIndex

		case columnFilterMatch:
			// If we have already stopped matching columns, we can't match any more.
			// This handles prefix matching of resource IDs.
			if !allowAdditionalColumns {
				return doesNotMatch, nil
			}

			if columnIndex > lastMatchingColIndex+1 {
				// We had a gap in matching columns, so we stop here.
				return doesNotMatch, nil
			}

			lastMatchingColIndex = columnIndex

		case columnFilterForceNoMatch:
			return doesNotMatch, nil

		default:
			return doesNotMatch, spiceerrors.MustBugf("unknown column filter status: %d", filterStatus)
		}
	}

	return lastMatchingColIndex + 1, nil
}

type columnFilterResult int

const (
	columnFilterNoMatch columnFilterResult = iota
	columnFilterMatch
	columnFilterStop
	columnFilterForceNoMatch
)

func checkFilterColumnMatchesFilter(colName string, filter datastore.RelationshipsFilter) (columnFilterResult, error) {
	switch colName {
	case "namespace":
		if filter.OptionalResourceType == "" {
			return columnFilterNoMatch, nil
		}
		return columnFilterMatch, nil
	case "object_id":
		if filter.OptionalResourceIDPrefix != "" {
			return columnFilterStop, nil
		}
		if len(filter.OptionalResourceIds) == 0 {
			return columnFilterNoMatch, nil
		}
		return columnFilterMatch, nil

	case "relation":
		if filter.OptionalResourceRelation == "" {
			return columnFilterNoMatch, nil
		}
		return columnFilterMatch, nil

	case "userset_namespace":
		if len(filter.OptionalSubjectsSelectors) == 0 {
			return columnFilterNoMatch, nil
		}

		foundCount := 0
		for _, sel := range filter.OptionalSubjectsSelectors {
			if sel.OptionalSubjectType != "" {
				foundCount++
			}
		}
		switch {
		case foundCount == 0:
			return columnFilterNoMatch, nil
		case foundCount < len(filter.OptionalSubjectsSelectors):
			return columnFilterForceNoMatch, nil
		default:
			return columnFilterMatch, nil
		}

	case "userset_object_id":
		if len(filter.OptionalSubjectsSelectors) == 0 {
			return columnFilterNoMatch, nil
		}

		foundCount := 0
		for _, sel := range filter.OptionalSubjectsSelectors {
			if len(sel.OptionalSubjectIds) > 0 {
				foundCount++
			}
		}
		switch {
		case foundCount == 0:
			return columnFilterNoMatch, nil
		case foundCount < len(filter.OptionalSubjectsSelectors):
			return columnFilterForceNoMatch, nil
		default:
			return columnFilterMatch, nil
		}

	case "userset_relation":
		if len(filter.OptionalSubjectsSelectors) == 0 {
			return columnFilterNoMatch, nil
		}

		foundCount := 0
		for _, sel := range filter.OptionalSubjectsSelectors {
			if sel.RelationFilter.NonEllipsisRelation != "" || sel.RelationFilter.IncludeEllipsisRelation {
				foundCount++
			}
		}
		switch {
		case foundCount == 0:
			return columnFilterNoMatch, nil
		case foundCount < len(filter.OptionalSubjectsSelectors):
			return columnFilterForceNoMatch, nil
		default:
			return columnFilterMatch, nil
		}

	default:
		return columnFilterForceNoMatch, spiceerrors.MustBugf("unknown column name: %s", colName)
	}
}

```

### Core Architecture Module: `internal/datastore/postgres/schema/indexutil.go`
```
package schema

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/authzed/spicedb/internal/datastore/common"
	pgxcommon "github.com/authzed/spicedb/internal/datastore/postgres/common"
)

const createIndexTemplate = `
CREATE INDEX CONCURRENTLY 
	%s
	ON
	%s`

const dropIndexTemplate = `
	DROP INDEX CONCURRENTLY IF EXISTS 
	%s;
`

const timeoutMessage = "This typically indicates that your database global statement_timeout needs to be increased and/or spicedb migrate command needs --migration-timeout increased (1h by default)"

type execer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

// CreateIndexConcurrently creates an index concurrently, dropping the existing index if it exists to ensure
// that indexes are not left in a partially constructed state.
// See: https://www.shayon.dev/post/2024/225/stop-relying-on-if-not-exists-for-concurrent-index-creation-in-postgresql/
func CreateIndexConcurrently(ctx context.Context, conn execer, index common.IndexDefinition) error {
	dropIndexSQL := fmt.Sprintf(dropIndexTemplate, index.Name)
	if _, err := conn.Exec(ctx, dropIndexSQL); err != nil {
		if pgxcommon.IsQueryCanceledError(err) {
			return fmt.Errorf(
				"timed out while trying to drop index %s before recreating it: %w. %s",
				index.Name,
				err,
				timeoutMessage,
			)
		}

		return fmt.Errorf("failed to drop index %s before creating it: %w", index.Name, err)
	}

	createIndexSQL := fmt.Sprintf(createIndexTemplate, index.Name, index.ColumnsSQL)
	if _, err := conn.Exec(ctx, createIndexSQL); err != nil {
		if pgxcommon.IsQueryCanceledError(err) {
			return fmt.Errorf(
				"timed out while trying to create index %s: %w. %s",
				index.Name,
				err,
				timeoutMessage,
			)
		}

		return fmt.Errorf("failed to create index %s: %w", index.Name, err)
	}
	return nil
}

```

### Core Architecture Module: `internal/fdw/tables/util.go`
```
package tables

import (
	"errors"
	"fmt"

	wire "github.com/jeroenrinzema/psql-wire"
	pg_query "github.com/pganalyze/pg_query_go/v6"

	"github.com/authzed/spicedb/internal/fdw/common"
)

func stringValue(valueOrRef valueOrRef, parameters []wire.Parameter) (string, error) {
	if valueOrRef.isSubQueryPlaceholder {
		return "", errors.New("subquery placeholders are not supported in permissions table")
	}

	if valueOrRef.parameterIndex > 0 {
		if int(valueOrRef.parameterIndex) >= len(parameters) {
			return "", errors.New("parameter index out of range")
		}
		return string(parameters[int(valueOrRef.parameterIndex)].Value()), nil
	}

	if valueOrRef.value == "" {
		return "", errors.New("value is empty")
	}

	return valueOrRef.value, nil
}

func optionalStringValue(valueOrRef valueOrRef, parameters []wire.Parameter) (string, error) {
	if valueOrRef.isSubQueryPlaceholder {
		return "", errors.New("subquery placeholders are not supported in permissions table")
	}

	if valueOrRef.parameterIndex > 0 {
		if int(valueOrRef.parameterIndex) >= len(parameters) {
			return "", errors.New("parameter index out of range")
		}
		return string(parameters[int(valueOrRef.parameterIndex)].Value()), nil
	}

	return valueOrRef.value, nil
}

type returningQuery interface {
	GetReturningList() []*pg_query.Node
}

func returningColumnsFromQuery(tableDef tableDefinition, query returningQuery) ([]wire.Column, error) {
	returningColumns := make([]wire.Column, 0, len(query.GetReturningList()))
	for _, returning := range query.GetReturningList() {
		if returning.GetResTarget() == nil {
			return nil, common.NewQueryError(errors.New("returning column is missing a name"))
		}

		columnVal := returning.GetResTarget().GetVal()
		if columnVal == nil {
			return nil, common.NewQueryError(errors.New("returning column is missing a value"))
		}

		if columnVal.GetColumnRef() == nil {
			return nil, common.NewQueryError(errors.New("returning column is not a column reference"))
		}

		columnNameFields := columnVal.GetColumnRef().GetFields()
		if len(columnNameFields) != 1 {
			return nil, common.NewQueryError(errors.New("returning column has multiple fields"))
		}

		columnNameString := columnNameFields[0].GetString_()
		if columnNameString == nil {
			return nil, common.NewQueryError(errors.New("returning column is not a string"))
		}

		columnName := columnNameString.Sval
		column, ok := tableDef.getSchemaColumn(columnName)
		if !ok {
			return nil, common.NewQueryError(fmt.Errorf("returning column %q does not exist", columnName))
		}

		returningColumns = append(returningColumns, column)
	}
	return returningColumns, nil
}

```

### Core Architecture Module: `internal/fdw/util.go`
```
package fdw

import "iter"

func mustFirst[T any](slice iter.Seq[T]) T {
	for v := range slice {
		return v
	}
	panic("mustFirst: slice is empty")
}

```

### Core Architecture Module: `internal/lsp/util.go`
```
package lsp

import (
	"encoding/json"
	"errors"
	"io"
	"os"

	"github.com/sourcegraph/jsonrpc2"
)

const (
	codeUninitialized int64 = 32002
)

func unmarshalParams[T any](r *jsonrpc2.Request) (T, error) {
	var params T
	if r.Params == nil {
		return params, invalidParams(errors.New("params not provided"))
	}
	if err := json.Unmarshal(*r.Params, &params); err != nil {
		return params, invalidParams(err)
	}
	return params, nil
}

func invalidParams(err error) *jsonrpc2.Error {
	return &jsonrpc2.Error{
		Code:    jsonrpc2.CodeInvalidParams,
		Message: err.Error(),
	}
}

func invalidRequest(err error) *jsonrpc2.Error {
	return &jsonrpc2.Error{
		Code:    jsonrpc2.CodeInvalidRequest,
		Message: err.Error(),
	}
}

type stdrwc struct{}

var _ io.ReadWriteCloser = (*stdrwc)(nil)

func (stdrwc) Read(p []byte) (int, error)  { return os.Stdin.Read(p) }
func (stdrwc) Write(p []byte) (int, error) { return os.Stdout.Write(p) }
func (stdrwc) Close() error {
	if err := os.Stdin.Close(); err != nil {
		return err
	}
	return os.Stdout.Close()
}

```

### Core Architecture Module: `internal/namespace/util.go`
```
package namespace

import (
	"context"

	"github.com/authzed/spicedb/pkg/datalayer"
	"github.com/authzed/spicedb/pkg/datastore"
	"github.com/authzed/spicedb/pkg/genutil/mapz"
	core "github.com/authzed/spicedb/pkg/proto/core/v1"
)

// ReadNamespaceAndRelation checks that the specified namespace and relation exist in the
// datastore.
//
// Returns NamespaceNotFoundError if the namespace cannot be found.
// Returns RelationNotFoundError if the relation was not found in the namespace.
// Returns the direct downstream error for all other unknown error.
func ReadNamespaceAndRelation(
	ctx context.Context,
	namespace string,
	relation string,
	sr datalayer.SchemaReader,
) (*core.NamespaceDefinition, *core.Relation, error) {
	revDef, found, err := sr.LookupTypeDefByName(ctx, namespace)
	if err != nil {
		return nil, nil, err
	}
	if !found {
		return nil, nil, datastore.NewNamespaceNotFoundErr(namespace)
	}
	config := revDef.Definition

	for _, rel := range config.Relation {
		if rel.Name == relation {
			return config, rel, nil
		}
	}

	return nil, nil, NewRelationNotFoundErr(namespace, relation)
}

// TypeAndRelationToCheck is a single check of a namespace+relation pair.
type TypeAndRelationToCheck struct {
	// NamespaceName is the namespace name to ensure exists.
	NamespaceName string

	// RelationName is the relation name to ensure exists under the namespace.
	RelationName string

	// AllowEllipsis, if true, allows for the ellipsis as the RelationName.
	AllowEllipsis bool
}

// CheckNamespaceAndRelations ensures that the given namespace+relation checks all succeed. If any fail, returns an error.
//
// Returns NamespaceNotFoundError if the namespace cannot be found.
// Returns RelationNotFoundError if the relation was not found in the namespace.
// Returns the direct downstream error for all other unknown error.
func CheckNamespaceAndRelations(ctx context.Context, checks []TypeAndRelationToCheck, sr datalayer.SchemaReader) error {
	nsNames := mapz.NewSet[string]()
	for _, toCheck := range checks {
		nsNames.Insert(toCheck.NamespaceName)
	}

	if nsNames.IsEmpty() {
		return nil
	}

	foundDefs, err := sr.LookupTypeDefinitionsByNames(ctx, nsNames.AsSlice())
	if err != nil {
		return err
	}

	mappedNamespaces := make(map[string]*core.NamespaceDefinition, len(foundDefs))
	for name, nsDef := range foundDefs {
		mappedNamespaces[name] = nsDef
	}

	for _, toCheck := range checks {
		nsDef, ok := mappedNamespaces[toCheck.NamespaceName]
		if !ok {
			return NewNamespaceNotFoundErr(toCheck.NamespaceName)
		}

		if toCheck.AllowEllipsis && toCheck.RelationName == datastore.Ellipsis {
			continue
		}

		foundRelation := false
		for _, rel := range nsDef.Relation {
			if rel.Name == toCheck.RelationName {
				foundRelation = true
				break
			}
		}

		if !foundRelation {
			return NewRelationNotFoundErr(toCheck.NamespaceName, toCheck.RelationName)
		}
	}

	return nil
}

// CheckNamespaceAndRelation checks that the specified namespace and relation exist in the
// datastore.
//
// Returns datastore.NamespaceNotFoundError if the namespace cannot be found.
// Returns RelationNotFoundError if the relation was not found in the namespace.
// Returns the direct downstream error for all other unknown error.
func CheckNamespaceAndRelation(
	ctx context.Context,
	namespace string,
	relation string,
	allowEllipsis bool,
	sr datalayer.SchemaReader,
) error {
	revDef, found, err := sr.LookupTypeDefByName(ctx, namespace)
	if err != nil {
		return err
	}
	if !found {
		return datastore.NewNamespaceNotFoundErr(namespace)
	}
	config := revDef.Definition

	if allowEllipsis && relation == datastore.Ellipsis {
		return nil
	}

	for _, rel := range config.Relation {
		if rel.Name == relation {
			return nil
		}
	}

	return NewRelationNotFoundErr(namespace, relation)
}

// ListReferencedNamespaces returns the names of all namespaces referenced in the
// given namespace definitions. This includes the namespaces themselves, as well as
// any found in type information on relations.
func ListReferencedNamespaces(nsdefs []*core.NamespaceDefinition) []string {
	referencedNamespaceNamesSet := mapz.NewSet[string]()
	for _, nsdef := range nsdefs {
		referencedNamespaceNamesSet.Insert(nsdef.Name)

		for _, relation := range nsdef.Relation {
			if relation.GetTypeInformation() != nil {
				for _, allowedRel := range relation.GetTypeInformation().AllowedDirectRelations {
					referencedNamespaceNamesSet.Insert(allowedRel.GetNamespace())
				}
			}
		}
	}
	return referencedNamespaceNamesSet.AsSlice()
}

```

### Core Architecture Module: `internal/services/v1/genutil.go`
```
package v1

import (
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

// fakeServiceRegistrar implements the grpc.ServiceRegistrar interface
// so that we can interrogate the registered methods.
type fakeServiceRegistrar struct {
	// desc is a Service Description which we can interrogate
	desc *grpc.ServiceDesc
}

func (d *fakeServiceRegistrar) RegisterService(desc *grpc.ServiceDesc, impl any) {
	d.desc = desc
}

// inputMessagesForService takes a registration function for a service
// and the unimplemented service struct and returns a list of instantiated
// messages for those services. returns nil if it's unable to unpack the service.
// Used to pre-warm protovalidator caches.
func inputMessagesForService[S any](
	registerFn func(grpc.ServiceRegistrar, S),
	impl S,
) []proto.Message {
	registrar := &fakeServiceRegistrar{}
	registerFn(registrar, impl)

	desc, err := protoregistry.GlobalFiles.FindDescriptorByName(
		protoreflect.FullName(registrar.desc.ServiceName),
	)
	if err != nil {
		return nil
	}
	svcDesc := desc.(protoreflect.ServiceDescriptor)

	var msgs []proto.Message //nolint:prealloc  // we don't have any foreknowledge and also this isn't perf sensitive
	// iterate over Methods to capture unary services
	for _, md := range registrar.desc.Methods {
		methodDesc := svcDesc.Methods().ByName(protoreflect.Name(md.MethodName))
		msgType, err := protoregistry.GlobalTypes.FindMessageByName(methodDesc.Input().FullName())
		if err != nil {
			return nil
		}
		msgs = append(msgs, msgType.New().Interface())
	}
	// iterate over Streams to capture streaming services
	for _, sd := range registrar.desc.Streams {
		methodDesc := svcDesc.Methods().ByName(protoreflect.Name(sd.StreamName))
		msgType, err := protoregistry.GlobalTypes.FindMessageByName(methodDesc.Input().FullName())
		if err != nil {
			return nil
		}
		msgs = append(msgs, msgType.New().Interface())
	}
	return msgs
}

```

### Core Architecture Module: `internal/services/v1/reflectionutil.go`
```
package v1

import (
	"context"

	caveattypes "github.com/authzed/spicedb/pkg/caveats/types"
	"github.com/authzed/spicedb/pkg/datalayer"
	"github.com/authzed/spicedb/pkg/datastore"
	"github.com/authzed/spicedb/pkg/diff"
	"github.com/authzed/spicedb/pkg/middleware/consistency"
	core "github.com/authzed/spicedb/pkg/proto/core/v1"
	"github.com/authzed/spicedb/pkg/schemadsl/compiler"
	"github.com/authzed/spicedb/pkg/schemadsl/input"
)

func loadCurrentSchema(ctx context.Context) (*diff.DiffableSchema, datastore.Revision, datalayer.SchemaHash, error) {
	dl := datalayer.MustFromContext(ctx)

	atRevision, schemaHash, _, err := consistency.RevisionFromContext(ctx)
	if err != nil {
		return nil, nil, "", err
	}

	reader := dl.SnapshotReader(atRevision, schemaHash)

	sr, err := reader.ReadSchema(ctx)
	if err != nil {
		return nil, atRevision, "", err
	}

	namespacesAndRevs, err := sr.ListAllTypeDefinitions(ctx)
	if err != nil {
		return nil, atRevision, "", err
	}

	caveatsAndRevs, err := sr.ListAllCaveatDefinitions(ctx)
	if err != nil {
		return nil, atRevision, "", err
	}

	namespaces := make([]*core.NamespaceDefinition, 0, len(namespacesAndRevs))
	for _, namespaceAndRev := range namespacesAndRevs {
		namespaces = append(namespaces, namespaceAndRev.Definition)
	}

	caveats := make([]*core.CaveatDefinition, 0, len(caveatsAndRevs))
	for _, caveatAndRev := range caveatsAndRevs {
		caveats = append(caveats, caveatAndRev.Definition)
	}

	return &diff.DiffableSchema{
		ObjectDefinitions: namespaces,
		CaveatDefinitions: caveats,
	}, atRevision, schemaHash, nil
}

func schemaDiff(ctx context.Context, comparisonSchemaString string, caveatTypeSet *caveattypes.TypeSet) (*diff.SchemaDiff, *diff.DiffableSchema, *diff.DiffableSchema, error) {
	existingSchema, _, _, err := loadCurrentSchema(ctx)
	if err != nil {
		return nil, nil, nil, err
	}

	// Compile the comparison schema.
	compiled, err := compiler.Compile(compiler.InputSchema{
		Source:       input.Source("schema"),
		SchemaString: comparisonSchemaString,
	}, compiler.AllowUnprefixedObjectType(), compiler.CaveatTypeSet(caveatTypeSet))
	if err != nil {
		return nil, nil, nil, err
	}

	comparisonSchema := diff.NewDiffableSchemaFromCompiledSchema(compiled)

	diff, err := diff.DiffSchemas(*existingSchema, comparisonSchema, caveatTypeSet)
	if err != nil {
		return nil, nil, nil, err
	}

	// Return the diff.
	return diff, existingSchema, &comparisonSchema, nil
}

```

### Core Architecture Module: `internal/services/v1/watchutil.go`
```
package v1

import (
	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"

	"github.com/authzed/spicedb/pkg/datastore"
)

func convertWatchKindToContent(kinds []v1.WatchKind) datastore.WatchContent {
	res := datastore.WatchRelationships
	for _, kind := range kinds {
		switch kind {
		case v1.WatchKind_WATCH_KIND_INCLUDE_RELATIONSHIP_UPDATES:
			res |= datastore.WatchRelationships
		case v1.WatchKind_WATCH_KIND_INCLUDE_SCHEMA_UPDATES:
			res |= datastore.WatchSchema
		case v1.WatchKind_WATCH_KIND_INCLUDE_CHECKPOINTS:
			res |= datastore.WatchCheckpoints
		}
	}
	return res
}

```

### Core Architecture Module: `magefiles/util.go`
```
//go:build mage

package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

var coverageFlags = []string{"-coverpkg=./...", "-covermode=atomic", "-coverprofile=coverage.txt"}

// goDirTest runs go test in the root with a timeout
func goTest(ctx context.Context, path string, args ...string) error {
	return goDirTest(ctx, ".", path, args...)
}

// goDirTests runs go test against multiple package paths in a single invocation.
func goDirTests(ctx context.Context, paths []string, args ...string) error {
	testArgs, err := testWithArgs(ctx, args...)
	if err != nil {
		return err
	}
	return RunSh("go", WithV(), WithDir("."), WithArgs(testArgs...))(paths...)
}

// goDirTest runs go test in a directory with a timeout
func goDirTest(ctx context.Context, dir string, path string, args ...string) error {
	testArgs, err := testWithArgs(ctx, args...)
	if err != nil {
		return err
	}
	return RunSh("go", WithV(), WithDir(dir), WithArgs(testArgs...))(path)
}

// goDirTestWithEnv runs go test in a directory with a timeout and environment variables
func goDirTestWithEnv(ctx context.Context, dir string, path string, env map[string]string, args ...string) error {
	testArgs, err := testWithArgs(ctx, args...)
	if err != nil {
		return err
	}
	return RunSh("go", WithV(), WithDir(dir), WithEnv(env), WithArgs(testArgs...))(path)
}

// testWithArgs includes -race and -timeout=30m.
func testWithArgs(ctx context.Context, args ...string) ([]string, error) {
	testArgs := append([]string{
		"test",
		"-failfast",
		"-count=1",
		"-race",
		"-timeout=30m",
		`-ldflags=-checklinkname=0`,
	}, args...)

	return testArgs, nil
}

// check if docker is installed and running
func checkDocker() error {
	if !hasBinary("docker") {
		return fmt.Errorf("docker must be installed to run e2e tests")
	}
	err := sh.Run("docker", "ps")
	if err == nil || sh.ExitStatus(err) == 0 {
		return nil
	}
	return err
}

// check if a binary exists
func hasBinary(binaryName string) bool {
	_, err := exec.LookPath(binaryName)
	return err == nil
}

// runOptions is a set of options to be applied with ExecSh.
type runOptions struct {
	cmd            string
	args           []string
	dir            string
	env            map[string]string
	stderr, stdout io.Writer
}

// RunOpt applies an option to a runOptions set.
type RunOpt func(*runOptions)

// WithV sets stderr and stdout the standard streams
func WithV() RunOpt {
	return func(options *runOptions) {
		options.stdout = os.Stdout
		options.stderr = os.Stderr
	}
}

// WithEnv sets the env passed in env vars.
func WithEnv(env map[string]string) RunOpt {
	return func(options *runOptions) {
		if options.env == nil {
			options.env = make(map[string]string)
		}
		for k, v := range env {
			options.env[k] = v
		}
	}
}

// WithStderr sets the stderr stream.
func WithStderr(w io.Writer) RunOpt {
	return func(options *runOptions) {
		options.stderr = w
	}
}

// WithStdout sets the stdout stream.
func WithStdout(w io.Writer) RunOpt {
	return func(options *runOptions) {
		options.stdout = w
	}
}

// WithDir sets the working directory for the command.
func WithDir(dir string) RunOpt {
	return func(options *runOptions) {
		options.dir = dir
	}
}

// WithArgs appends command arguments.
func WithArgs(args ...string) RunOpt {
	return func(options *runOptions) {
		if options.args == nil {
			options.args = make([]string, 0, len(args))
		}
		options.args = append(options.args, args...)
	}
}

func Tool() RunOpt {
	return func(options *runOptions) {
		WithDir("magefiles")(options)
		WithV()(options)
	}
}

// buildAndRunTool builds a Go binary from a submodule and runs it in the repo
// root. This is used for tool commands whose dependencies live in a separate
// module (e.g., magefiles/ or tools/analyzers/).
func buildAndRunTool(moduleDir, pkg string, args ...string) error {
	tmpBin, err := os.CreateTemp("", "mage-tool-*")
	if err != nil {
		return fmt.Errorf("creating temp file: %w", err)
	}
	tmpBin.Close()
	binPath := tmpBin.Name()
	defer os.Remove(binPath)

	if err := RunSh("go", WithDir(moduleDir), WithV())("build", "-o", binPath, pkg); err != nil {
		return fmt.Errorf("building %s: %w", pkg, err)
	}
	return RunSh(binPath, WithV())(args...)
}

// RunSh returns a function that calls ExecSh, only returning errors.
func RunSh(cmd string, options ...RunOpt) func(args ...string) error {
	run := ExecSh(cmd, options...)
	return func(args ...string) error {
		_, err := run(args...)
		return err
	}
}

// ExecSh returns a function that executes the command, piping its stdout and
// stderr according to the config options. If the command fails, it will return
// an error that, if returned from a target or mg.Deps call, will cause mage to
// exit with the same code as the command failed with.
//
// ExecSh takes a variable list of RunOpt objects to configure how the command
// is executed. See RunOpt docs for more details.
//
// Env vars configured on the command override the current environment variables
// set (which are also passed to the command). The cmd and args may include
// references to environment variables in $FOO format, in which case these will be
// expanded before the command is run.
//
// Ran reports if the command ran (rather than was not found or not executable).
// Code reports the exit code the command returned if it ran. If err == nil, ran
// is always true and code is always 0.
func ExecSh(cmd string, options ...RunOpt) func(args ...string) (bool, error) {
	opts := runOptions{
		cmd: cmd,
	}
	for _, o := range options {
		o(&opts)
	}

	if opts.stdout == nil && mg.Verbose() {
		opts.stdout = os.Stdout
	}

	return func(args ...string) (bool, error) {
		expand := func(s string) string {
			s2, ok := opts.env[s]
			if ok {
				return s2
			}
			return os.Getenv(s)
		}
		cmd = os.Expand(cmd, expand)
		finalArgs := append(opts.args, args...)
		for i := range finalArgs {
			finalArgs[i] = os.Expand(finalArgs[i], expand)
		}
		ran, code, err := run(opts.dir, opts.env, opts.stdout, opts.stderr, cmd, finalArgs...)

		if err == nil {
			return ran, nil
		}
		if ran {
			return ran, mg.Fatalf(code, `running "%s %s" failed with exit code %d`, cmd, strings.Join(args, " "), code)
		}
		return ran, fmt.Errorf(`failed to run "%s %s: %v"`, cmd, strings.Join(args, " "), err)
	}
}

func run(dir string, env map[string]string, stdout, stderr io.Writer, cmd string, args ...string) (ran bool, code int, err error) {
	c := exec.Command(cmd, args...)
	c.Env = os.Environ()
	for k, v := range env {
		c.Env = append(c.Env, k+"="+v)
	}
	c.Dir = dir
	c.Stderr = stderr
	c.Stdout = stdout
	c.Stdin = os.Stdin

	var quoted []string
	for i := range args {
		quoted = append(quoted, fmt.Sprintf("%q", args[i]))
	}
	// To protect against logging from doing exec in global variables
	if mg.Verbose() {
		log.Println("exec:", cmd, strings.Join(quoted, " "))
	}
	err = c.Run()
	return sh.CmdRan(err), sh.ExitStatus(err), err
}

```

### Core Architecture Module: `pkg/cmd/datastore/engines.go`
```
package datastore

// Every datastore engine defined in this repository is linked here so that
// NewDatastore can build any of them by name without callers having to import
// anything: importing this package is enough, exactly as it was before the
// engines began registering themselves.
//
// The builders themselves live in the engine packages and register into
// pkg/cmd/datastore/dsconfig from an init function, so an engine defined
// outside this repository becomes available the same way, by being linked into
// the binary. Only in-repo engines need a line here.
import (
	_ "github.com/authzed/spicedb/internal/datastore/crdb"
	_ "github.com/authzed/spicedb/internal/datastore/memdb"
	_ "github.com/authzed/spicedb/internal/datastore/mysql"
	_ "github.com/authzed/spicedb/internal/datastore/postgres"
	_ "github.com/authzed/spicedb/internal/datastore/spanner"
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3395** (2026-10-05): **perf(datasets): batch wildcard exclusions in subject set subtraction**
  *Symptoms*: `LookupSubjects` repeatedly copies a growing exclusion list when subtracting concrete subjects from a wildcard. `SubtractAll` now builds that list once, preserving caveat expressions and resource provenance through the existing constructors. This makes exclusion construction linear in the existing exclusions and removed subjects. Wildcard subtraction and zero/one-subject cases retain the existing path. `AsSlice` also allocates its known capacity once.  Adds differential tests against sequential subtraction, input-mutation and resource-tracking checks, and benchmarks for subject-set subtraction and dispatched wildcard lookups.  Measured through the public gRPC API with PostgreSQL 16.11, Go 1.26.8, and enabled dispatch caches on an Apple M4:  | Workload | Baseline p95 | Patched p95 | Baseline allocated/lookup | Patched allocated/lookup | | --- | ---: | ---: | ---: | ---: | | 5,000 exclusions, changing revisions | 88.7 ms | 11.4 ms | 111.5 MB | 3.6 MB | | 5,000 exclusions, cached snapshot | 7.1 ms | 7.3 ms | 1.35 MB | 1.35 MB | | 1,000 concrete members minus 500 users | 6.7 ms | 6.8 ms | 1.24 MB | 1.22 MB |  Values are medians across three runs of 60 requests at 10 requests/second, with a fresh server per case. The first case uses fully consistent reads with concurrent writes; its per-run p95 ranges were 75.5–93.0 ms before and 9.7–13.6 ms after. Allocation includes concurrent writes and background work. The controls showed no consistent latency change. These are synthetic graph
  **Post-Mortem & Fix Analysis**:
  > ****CLA Assistant Lite bot**** All contributors have signed the CLA  ✍️ ✅
  > I have read the CLA Document and I hereby sign the CLA

- **Issue #3394** (2026-10-05): **LookupSubjects copies wildcard exclusions quadratically when subtracting concrete subjects**
  *Symptoms*: ### What SpiceDB version are you using?  `main` at `dbc16016e92987c531658eae0770261c77434adf`.  ### What SpiceDB flags do you use?  PostgreSQL datastore, default dispatch engine, enabled 128 MiB dispatch caches, `GOMAXPROCS=4`, `GOMEMLIMIT=2GiB`. The [reproduction script and configuration](https://github.com/dantrapp/spicedb/tree/5c887488c5aae616a22204541b96a28487617e9d/benchmark-results/wildcard-lookup) contain the full command.  ### Steps to reproduce  ```zed definition user {} definition document {     relation public: user:*     relation banned: user     permission view = public - banned } ```  1. Give a document `public@user:*` and 5,000 distinct `banned` users. 2. Call `LookupSubjects` for `view`, requesting `user` subjects. 3. Repeat with fully consistent reads while another document receives writes, so the lookups resolve at changing revisions.  The linked harness seeds the relationships through the public API and runs against a local PostgreSQL 16.11 instance. It also includes cached-snapshot and non-wildcard controls.  ### Expected result  Construct the wildcard's exclusion list with work proportional to the existing exclusions and removed subjects.  ### Actual result  `BaseSubjectSet.SubtractAll` calls `Subtract` for every removed subject. Each subtraction copies the growing wildcard exclusion list, resulting in quadratic copying.  On an Apple M4, the 5,000-exclusion workload allocated 111.5 MB per completed lookup and had a median per-run p95 of 88.7 ms across thr

- **Issue #3386** (2026-10-01): **fix(query): decide the alias self edge by comparison**
  *Symptoms*: ## Description  The query planner decided the reflexive identity subject (`group:a#member` being one of the subjects of `group:a#member`) with a datastore query. That query was expensive, and it gave wrong answers. This PR swaps it for the comparison the classic dispatcher makes, and fixes the Check path that the swap exposed.  **`perf(query): decide the alias self edge by comparison, not a query`**  The existing check (`SubjectExistsAsRelationship`) ran a `LIMIT 1` query per object per alias level: - **Expensive:** it was 163 of the 175 queries in `CheckWideGroups` LookupSubjects, all distinct, and every resulting self edge was then thrown away. - **Wrong:** it asked whether any relationship pointed at the object, which has nothing to do with whether identity holds. Adding an unrelated relationship could flip the answer.  Like classic (`internal/graph/lookupsubjects.go`), the alias now compares the requested subject relation against its own. The requested target lives in `Context.TargetSubjectType`, kept separate from `filterSubjectType`, which arrows and recursion leave empty. It crosses dispatch hops as `PlanContext.target_subject_relation` (field 8). This commit also adds a `CountingReader` for measuring datastore round-trips. `CheckWideGroups` LookupSubjects goes from 175 queries to 12, and no results change.  **`fix(query): keep the self edge when Check resolves through recursion`**  A recursive Check resolves by running the IterSubjects machinery, and eve
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3386?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #3385** (2026-09-29): **test: verify classic and planned permission checks**
  *Symptoms*: ## Summary  - Add a property-based integration test that compares the classic checker with plain and optimized query planner checks on the same generated schema, relationships, and datastore revision. - Use a small object ID pool so generated graphs exercise arrows and set operations, including both permission and no-permission results. - Keep generated subject and resource definitions distinct, restrict arrows to valid targets, and sort map-derived choices for reproducible rapid seeds.  ## Tests  - `GOCACHE=/tmp/spicedb-go-cache go test ./pkg/schema/v2/testing -count=1` - `GOCACHE=/tmp/spicedb-go-cache go test -tags=integration ./internal/services/integrationtesting/queryconsistency -run '^TestQueryPlanCheckProperty$' -count=1 -rapid.checks=1000` 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3385?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #3382** (2026-09-29): **chore(deps): bump the docker group with 2 updates**
  *Symptoms*: > [!WARNING] > Cooldown could not be applied because no publication date was available from the registry. >  Bumps the docker group with 2 updates: golang and chainguard/static.  Updates `golang` from 1.27.0-alpine to 1.27.1-alpine  Updates `chainguard/static` from `bf639cb` to `41e17ed`   Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore <dependency name> major version` will close this group update PR and stop Dependabot creating any more for the specific dependency's major version (unless you unignore this specific dependency's major version or upgrade to it yourself) - `@dependabot ignore <dependency name> minor version` will close this group update PR and stop Dependabot creating any more for the specific dependency's minor version (unless you unignore this specific dependency's minor version or upgrade to it yourself) - `@dependabot ignore <dependency name>` will close thi

- **Issue #3380** (2026-10-02): **fix: propagate streaming dispatch cancellation errors**
  *Symptoms*: <!-- If your PR is not ready to be reviewed or merged, please submit it as a "draft". -->  ## Description  Fix a cancellation error being dropped by remote streaming dispatch, which could cause the LR3 dispatch cache to store and replay incomplete results as a successful response.  The bug occurs when the winning dispatcher publishes results and its context becomes canceled before the next receive call:  1. The results loop observes `handlerContext.Done()` and exits without recording an error. 2. The dispatcher finds no recorded error for the winner and returns nil. 3. The caching dispatcher interprets nil as successful completion and stores the responses collected so far. 4. A fresh identical dispatch replays that incomplete cache entry with a nil error and no backend call.  The reported reproduction used 834 synthetic items, a first batch of 500, and a requested limit of 10,000. Both an internal dispatch deadline with a healthy parent and parent cancellation caused the first request to return only 500 items successfully. A fresh request then returned the same cached 500 items without reaching the backend. When `Recv` itself returned cancellation, the error propagated correctly and the prefix was not cached.  The synthetic first batch matches LR3's response batch size: [`respBatchSize = 500`](https://github.com/kbrwn/spicedb/blob/252478fb8d7a733cf841cc8032f783a846390d5a/internal/graph/lookupresources3.go#L36). The [publishing loop](https://github.com/kbrwn/s
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3380?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
  > The patch fixes the reproduced cancellation-related result-count disparity.  **Before the patch**, live lookups expected to return **10,000 resources** returned successful responses containing:  - **9,010 resources** — **990 missing**. - **9,604 resources** — **396 missing**.  The deterministic regression reproduced the underlying defect: only **500 of 834 expected results** were cached and replayed. With the patch, cancellation propagates correctly, incomplete results are not cached, and subsequent requests return **all 834 results**. All ten regression cases pass; the unpatched deadline cases fail as expected.  **After the patch**, live validation using an enterprise build based on SpiceDB v1.56.2 produced:  - **40/40 lookups returning exactly 5,000 resources.** - **40/40 lookups returning exactly 10,000 resources.** - No missing, unexpected, or duplicate resources across minimum-latency and fully-consistent reads, with retries disabled. - Demo MCP confirmation of **80 successful pub

- **Issue #3375** (2026-09-23): **test(consistency): let callers run the consistency fixtures serially**
  *Symptoms*: The consistency suite runs each validation file in parallel. That suits a datastore that is cheap to stand up, but it isn't the only reasonable choice: a caller whose datastore is expensive to create may prefer to keep only one fixture's resources live at a time.  This adds a variadic option to the exported entry points so callers can choose:  ```go consistencytest.AllConsistency(t, tester, consistencytest.RunFixturesSerially()) consistencytest.ConsistencyForEngine(t, engineID, tester, consistencytest.RunFixturesSerially()) ```  - Default is unchanged: fixtures run in parallel, and every existing call site compiles untouched. - The chunk-size and dispatcher subtests within a fixture stay parallel in both modes, so work inside a fixture still overlaps.  `SuiteOption` / `RunFixturesSerially` mirrors the option style already used by `pkg/datastore/test` (`SuiteOption` / `RunSubtestsSerially`).
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3375?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :x: Patch coverage is `61.11111%` with `7 lines` in your changes missing coverage. Please review. | [Files with missing lines](https://app.codecov.io/gh/authzed/spicedb/pull/3375?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) | Patch % | Lines | |---|---|---| | [pkg/consistency/test/consistency.go](https://app.codecov.io/gh/authzed/spicedb/pull/3375?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed#diff-cGtnL2NvbnNpc3RlbmN5L3Rlc3QvY29uc2lzdGVuY3kuZ28=) | 61.12% | [6 Missing and 1 partial :warning: ](https://app.codecov.io/gh/authzed/spicedb/pull/3375?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=p

- **Issue #3374** (2026-09-22): **fix: stop serving a revision that has no validity**
  *Symptoms*: ## What  Two bugs that only bite together: MemDB hands out a revision with the wrong validity, and the optimized revision cache keeps a revision that says it has none.  ### 1. MemDB reports the discarded revision's validity  `memdb.OptimizedRevision` falls back to head when rounding down to a quantization boundary would land before the first write (#3366). The validity it returns alongside head still describes the quantized revision it just discarded:  ```go quantized, validFor := revisions.Quantize(nowRevision(), 0, mdb.quantizationPeriod) optimized := quantized.(revisions.TimestampRevision)  if optimized.LessThan(firstServable) {     optimized = mdb.headRevisionNoLock()   // revision replaced } return ...{Revision: optimized, ValidFor: validFor, ...}   // validity is the old one ```  Since #3196, optimized revisions are cached for as long as they say they are valid (`proxy.NewOptimizedRevisionProxy` computes `validThrough = now + ValidFor`). So the fallback hands out head with up to a full quantization interval of validity, and every default-consistency read for the rest of that interval is served from that pinned head — missing any write made in the meantime. That is the same staleness the fallback exists to prevent, reintroduced one layer up.  ### 2. The cache keeps a revision that has no validity  Reporting `ValidFor: 0` is not enough on its own. Before testing its entries, the cache subtracts a random slice of the configured maximum staleness from "now", so that request
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3374?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

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

### Incident Patch 1: `71a7329a` (2026-10-02)
**Commit Message**: fix: apply dispatch-upstream-timeout to outbound dispatches (#3304)

* fix: apply dispatch-upstream-timeout to outbound dispatches

`--dispatch-upstream-timeout` was parsed into Config.DispatchUpstreamTimeout
but never reached the combined dispatcher, so remote.NewClusterDispatcher
received DispatchOverallTimeout: 0 and substituted its 60s fallback. Setting
the flag had no effect on outbound dispatch deadlines.

combineddispatch.RemoteDispatchTimeout had no non-test caller. The existing
clusterdispatch.RemoteDispatchTimeout call site assigns a field that
cluster.NewClusterDispatcher never reads, which is likely why the gap went
unnoticed.

Fixes #3303

* docs: add changelog entry for dispatch-upstream-timeout fix

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Datastore: the wait between transaction retries is now capped at 10 seconds. It previously doubled without limit (25ms, 50ms, 100ms, …), which made `--datastore-max-tx-retries` an exponential wall-clock budget rather than a count of attempts: at the default of 10 the waits total about 25 seconds, but at 15 they total 14 minutes and at 20 over seven hours. (https://github.com/authzed/spicedb/pull/3353)
 - Caches: when the amount of available memory could not be determined - for example an AWS ECS task whose memory limit never reaches the cgroup - the fallback used for percent-based budgets was 256KiB rather than the intended 256MiB. A cache configured for 70% of available memory was sized at roughly 183KiB instead of roughly 180MiB. (https://github.com/authzed/spicedb/pull/3329)
 - Shutdown: on SIGINT or SIGTERM, SpiceDB now reports `NOT_SERVING` on its gRPC health service and keeps its listeners open for `--grpc-shutdown-drain-delay` before draining. This gives load balancers and Kubernetes readiness probes time to stop routing to the instance, so new requests do not fail with `Unavailable` (connection refused) in the window between the signal and the endpoint update. (https://github.com/authzed/spicedb/pull/3295, https://github.com/authzed/spicedb/pull/3314)
+- Dispatch: `--dispatch-upstream-timeout` was ignored; dispatches to other nodes always used a hardcoded 60s timeout. Lowering it now works, so an unresponsive node no longer holds up checks for a full minute. No change on the 60s default. (https://github.com/authzed/spicedb/pull/3304)
 
 ## [1.56.2] - 2026-09-11
 ### Changed
```

**File**: `pkg/cmd/server/server.go` (modified, +1/-0)
```diff
@@ -354,6 +354,7 @@ func (c *Config) complete(ctx context.Context) (*completedServerConfig, error) {
 		dispatcher, err = combineddispatch.NewDispatcher(
 			combineddispatch.UpstreamAddr(c.DispatchUpstreamAddr),
 			combineddispatch.UpstreamCAPath(c.DispatchUpstreamCAPath),
+			combineddispatch.RemoteDispatchTimeout(c.DispatchUpstreamTimeout),
 			combineddispatch.SecondaryUpstreamAddrs(c.DispatchSecondaryUpstreamAddrs),
 			combineddispatch.SecondaryUpstreamExprs(c.DispatchSecondaryUpstreamExprs),
 			combineddispatch.SecondaryMaximumPrimaryHedgingDelays(c.DispatchSecondaryMaximumPrimaryHedgingDelays),
```

---

### Incident Patch 2: `bac82627` (2026-10-02)
**Commit Message**: fix: propagate streaming dispatch cancellation errors (#3380)

* fix: propagate streaming dispatch cancellation errors

* docs: document streaming dispatch cancellation fix

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - The `DeleteRelationships` API now supports resumable, cursored batch deletion. When `optional_limit` and `optional_allow_partial_deletions` are set, the response returns an `after_result_cursor`; passing it back as `optional_cursor` on the next call resumes the deletion after the last relationship removed, which on CockroachDB avoids rescanning already-deleted relationships. Datastores that cannot resume a cursored deletion return an error when a cursor is supplied; without a cursor they transparently fall back to the existing non-cursored partial deletion.
 
 ### Fixed
+- Remote dispatch: canceled LookupResources and LookupSubjects streams now return an error instead of reporting success with incomplete results, preventing partial results from being cached and replayed. (https://github.com/authzed/spicedb/pull/3380)
 - MemDB/Datastore: a revision reported with no validity is no longer kept by the optimized revision cache, and we fixed an issue where MemDB's reported validity caused a stale value to be cached. (https://github.com/authzed/spicedb/pull/3374)
 - MemDB: requests made shortly after startup could fail with `object definition not found`, or return no results, even though the schema and relationships had already been written. MemDB now advertises its head revision in that case, so committed data is never hidden behind the datastore's own creation. (https://github.com/authzed/spicedb/pull/3366)
 - MySQL: fixed a crash in the watch API. When reading transaction metadata hit an error part-way through iterating the result rows, that error was dropped and the watch was handed an empty result with no error, which then dereferenced a nil value and took the whole process down with it. The error is now returned to the caller. (https://github.com/authzed/spicedb/pull/3358)
```

**File**: `internal/dispatch/remote/cluster.go` (modified, +4/-0)
```diff
@@ -600,6 +600,7 @@ func dispatchStreamingRequest[Q streamingRequestMessage, R any](
 		select {
 		case <-handlerContext.Done():
 			log.Ctx(handlerContext).Trace().Str("dispatcher", name).Msg("dispatcher context canceled")
+			errorsByDispatcherName.Store(name, handlerContext.Err())
 			if isPrimary {
 				primaryDispatch.WithLabelValues("true", reqKey).Inc()
 			}
@@ -630,6 +631,9 @@ func dispatchStreamingRequest[Q streamingRequestMessage, R any](
 			select {
 			case <-handlerContext.Done():
 				log.Ctx(handlerContext).Trace().Str("dispatcher", name).Msg("dispatcher context canceled, in results loop")
+				// The winning dispatcher may have published only a prefix of its results.
+				// Record cancellation so that prefix is not treated as a complete stream.
+				errorsByDispatcherName.Store(name, handlerContext.Err())
 				return
 
 			default:
```

**File**: `internal/dispatch/remote/cluster_cancellation_test.go` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+package remote
+
+import (
+	"context"
+	"io"
+	"strconv"
+	"testing"
+	"testing/synctest"
+	"time"
+
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/status"
+
+	"github.com/authzed/spicedb/internal/dispatch"
+	"github.com/authzed/spicedb/internal/dispatch/caching"
+	"github.com/authzed/spicedb/internal/dispatch/keys"
+	"github.com/authzed/spicedb/pkg/datalayer"
+	corev1 "github.com/authzed/spicedb/pkg/proto/core/v1"
+	v1 "github.com/authzed/spicedb/pkg/proto/dispatch/v1"
+)
+
+func TestLookupResources3CancellationDoesNotCachePartialResults(t *testing.T) {
+	const (
+		batchSize   = 500
+		resultCount = 834
+	)
+	recvError := status.Error(codes.Canceled, "receive canceled")
+	for _, winningDispatcher := range []string{"primary", "secondary"} {
+		for _, tc := range []struct {
+			name          string
+			expectedError error
+			expectedRecvs int
+		}{
+			{"internal_deadline_between_receives", context.DeadlineExceeded, 1},
+			{"parent_cancel_between_receives", context.Canceled, 1},
+			{"parent_cancel_before_dispatch", context.Canceled, 0},
+			{"recv_error", recvError, 2},
+			{"successful_eof", nil, 3},
+		} {
+			t.Run(winningDispatcher+"/"+tc.name, func(t *testing.T) {
+				synctest.Test(t, func(t *testing.T) {
+					loserStarted := make(chan context.Context, 1)
+					winner := &cancellationLR3Client{
+						waitForLoser: loserStarted,
+						batchSize:    batchSize,
+						resultCount:  resultCount,
+					}
+					if tc.name == "recv_error" {
+						winner.recvError = recvError
+					}
+					loser := &cancellationLR3Client{started: loserStarted}
+					primary, secondary := winner, loser
+					if winningDispatcher == "secondary" {
+						primary, secondary = loser, winner
+					}
+
+					expr, err := ParseDispatchExpression("lookupresources", "['secondary']")
+					require.NoError(t, err)
+					remote, err := NewClusterDispatcher(primary, nil, ClusterDispatcherConfig{
+						DispatchOverallTimeout: time.Second,
+					}, map[string]SecondaryDispatch{
+						"secondary": {Name: "secondary", Client: secondary},
+					}, map[string]*DispatchExpr{"lookupresources": expr}, time.Millisecond)
+					require.NoError(t, err)
+					cache := caching.DispatchTestCache(t)
+					defer cache.Close()
+					cached, err := caching.NewCachingDispatcher(cache, dispatch.MetricsOptions{}, &keys.DirectKeyHandler{})
+					require.NoError(t, err)
+					cached.SetDelegate(remote)
+
+					req := &v1.DispatchLookupResources3Request{
+						ResourceRelation: &corev1.RelationReference{Namespace: "document", Relation: "view"},
+						SubjectRelation:  &corev1.RelationReference{Namespace: "user", Relation: "..."},
+						SubjectIds:       []string{"subject"},
+						TerminalSubject:  &corev1.ObjectAndRelation{Namespace: "user", ObjectId: "subject", Relation: "..."},
+						Metadata: &v1.ResolverMeta{
+							AtRevision: "1", DepthRemaining: 50, SchemaHash: []byte(datalayer.NoSchemaHashForTesting),
+						},
+						OptionalLimit: 10000,
+					}
+					key, err := (&keys.DirectKeyHandler{}).LookupResources3CacheKey(t.Context(), req)
+					require.NoError(t, err)
+					parent, cancel := context.WithCancel(t.Context())
+					defer cancel()
+					if tc.name == "parent_cancel_before_dispatch" {
+						cancel()
+					}
+					var firstIDs []string
+					first := dispatch.NewHandlingDispatchStream(parent, func(response *v1.DispatchLookupResources3Response) error {
+						for _, item := range response.Items {
+							firstIDs = append(firstIDs, item.ResourceId)
+						}
+						// Cancellation occurs inside Publish, so the next receive has not begun.
+						switch tc.name {
+						case "internal_deadline_between_receives":
+							<-winner.handlerContext.Done()
+						case "parent_cancel_between_receives":
+							cancel()
+						}
+						return nil
+					})
+					err = cached.DispatchLookupResources3(req, first)
+					_, found := cache.Get(key)
+					if tc.expectedError != nil {
+						require.ErrorIs(t, err, tc.expectedError)
+						if tc.expectedRecvs == 0 {
+							require.Empty(t, firstIDs)
+						} else {
+							require.Len(t, firstIDs, batchSize)
+						}
+						require.False(t, found, "an incomplete stream must not be cached")
+					} else {
+						require.NoError(t, err)
+						require.Len(t, firstIDs, resultCount)
+						require.True(t, found, "a stream completed by EOF should be cached")
+					}
+					require.Equal(t, tc.expectedRecvs, winner.recvs)
+					expectedCalls := 1
+					if tc.name == "parent_cancel_before_dispatch" {
+						expectedCalls = 0
+						require.Zero(t, loser.calls)
+					} else {
+						require.ErrorIs(t, winner.loserContext.Err(), context.Canceled)
+					}
+					require.Equal(t, expectedCalls, winner.calls)
+					if tc.name == "parent_cancel_between_receives" || tc.name == "parent_cancel_before_dispatch" {
+						require.ErrorIs(t, parent.Err(), context.Canceled)
+					} else {
+						require.NoError(t, parent.Err(), "
```

---

### Incident Patch 3: `7519722e` (2026-10-01)
**Commit Message**: fix(query): decide the alias self edge by comparison (#3386)

**File**: `internal/dispatch/executor.go` (modified, +32/-5)
```diff
@@ -392,7 +392,7 @@ func (e *DispatchExecutor) buildManyRequest(ctx *query.Context, op v1.PlanOperat
 			ObjectId:  subject.ObjectID,
 			Relation:  subject.Relation,
 		},
-		PlanContext: planContextForDispatch(e.planContext, key, ctx.TopLevelOperation),
+		PlanContext: planContextForDispatch(e.planContext, key, ctx.TopLevelOperation, ctx.TargetSubjectType),
 		Plan:        plan,
 	}
 	if len(manyResources) > 0 {
@@ -456,7 +456,7 @@ func (e *DispatchExecutor) buildRequest(ctx *query.Context, op v1.PlanOperation,
 			ObjectId:  subject.ObjectID,
 			Relation:  subject.Relation,
 		},
-		PlanContext: planContextForDispatch(e.planContext, key, ctx.TopLevelOperation),
+		PlanContext: planContextForDispatch(e.planContext, key, ctx.TopLevelOperation, ctx.TargetSubjectType),
 		Plan:        plan,
 	}, nil
 }
@@ -468,13 +468,26 @@ func (e *DispatchExecutor) buildRequest(ctx *query.Context, op v1.PlanOperation,
 //     rebuilds at each receiver hop.
 //   - TopLevelOperation propagates the original API operation across hops so
 //     iterators that consult TopLevelOperation see consistent user intent.
-func planContextForDispatch(pc *v1.PlanContext, key string, topLevelOp query.Operation) *v1.PlanContext {
+//   - TargetSubjectRelation propagates the subject the request is asking
+//     about (a LookupSubjects' filter, or the subject of a Check resolving
+//     through recursion), which receiver-side aliases need to decide the
+//     reflexive identity subject. The per-hop filter on the request cannot
+//     answer that: arrows and recursion pass no filter because they must walk
+//     intermediate-typed results to keep traversing.
+func planContextForDispatch(pc *v1.PlanContext, key string, topLevelOp query.Operation, target query.ObjectType) *v1.PlanContext {
+	targetRef := targetSubjectRelation(target)
 	if pc == nil {
 		return &v1.PlanContext{
-			InProgressKeys:    []string{key},
-			TopLevelOperation: queryOpToPlanOperation(topLevelOp),
+			InProgressKeys:        []string{key},
+			TopLevelOperation:     queryOpToPlanOperation(topLevelOp),
+			TargetSubjectRelation: targetRef,
 		}
 	}
+	// Preserve the target recorded higher in the chain; it describes the
+	// original request and must not be overwritten by a deeper hop.
+	if pc.TargetSubjectRelation != nil {
+		targetRef = pc.TargetSubjectRelation
+	}
 	// Preserve any TopLevelOperation already on pc (set higher in the chain);
 	// only fill in when the chain hasn't recorded a user-facing op yet.
 	// PlanOperation's zero value is CHECK, which is also the natural fallback
@@ -497,6 +510,20 @@ func planContextForDispatch(pc *v1.PlanContext, key string, topLevelOp query.Ope
 		SchemaHash:             pc.SchemaHash,
 		InProgressKeys:         inProgress,
 		TopLevelOperation:      tlo,
+		TargetSubjectRelation:  targetRef,
+	}
+}
+
+// targetSubjectRelation converts the target subject type into its proto form,
+// returning nil when there is no target (see Context.TargetSubjectType for
+// when one is set).
+func targetSubjectRelation(target query.ObjectType) *core.RelationReference {
+	if target.Type == "" {
+		return nil
+	}
+	return &core.RelationReference{
+		Namespace: target.Type,
+		Relation:  target.Subrelation,
 	}
 }
 
```

**File**: `internal/dispatch/executor_test.go` (modified, +97/-0)
```diff
@@ -508,6 +508,103 @@ func TestDispatchExecutor_PlanContextForwarded(t *testing.T) {
 	require.Equal(t, uint64(100), receiver.planCalls[0].PlanContext.OptionalDatastoreLimit)
 }
 
+// relationRefString renders a RelationReference as "namespace#relation", or ""
+// for nil, so tests can compare the target without depending on proto identity.
+func relationRefString(rr *core.RelationReference) string {
+	if rr == nil {
+		return ""
+	}
+	return rr.Namespace + "#" + rr.Relation
+}
+
+func TestPlanContextForDispatch_TargetSubjectRelation(t *testing.T) {
+	groupMember := query.ObjectType{Type: "group", Subrelation: "member"}
+	folderView := &core.RelationReference{Namespace: "folder", Relation: "view"}
+
+	for _, tc := range []struct {
+		name   string
+		pc     *v1.PlanContext
+		target query.ObjectType
+		want   string
+	}{
+		{
+			name: "no plan context and no target",
+			want: "",
+		},
+		{
+			name:   "no plan context records the target",
+			target: groupMember,
+			want:   "group#member",
+		},
+		{
+			name: "existing plan context without a target and no target",
+			pc:   &v1.PlanContext{Revision: "rev1"},
+			want: "",
+		},
+		{
+			name:   "existing plan context without a target records the target",
+			pc:     &v1.PlanContext{Revision: "rev1"},
+			target: groupMember,
+			want:   "group#member",
+		},
+		{
+			// The target describes the original request; a deeper hop running
+			// under a different target must not overwrite it.
+			name:   "target recorded higher in the chain is preserved",
+			pc:     &v1.PlanContext{Revision: "rev1", TargetSubjectRelation: folderView},
+			target: groupMember,
+			want:   "folder#view",
+		},
+		{
+			name: "target recorded higher in the chain survives an empty target",
+			pc:   &v1.PlanContext{Revision: "rev1", TargetSubjectRelation: folderView},
+			want: "folder#view",
+		},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			before := relationRefString(tc.pc.GetTargetSubjectRelation())
+
+			got := planContextForDispatch(tc.pc, "group#member", query.OperationIterSubjects, tc.target)
+			require.Equal(t, tc.want, relationRefString(got.TargetSubjectRelation))
+			require.Equal(t, "group#member", got.InProgressKeys[len(got.InProgressKeys)-1])
+			require.Equal(t, before, relationRefString(tc.pc.GetTargetSubjectRelation()),
+				"the sender's plan context must not be mutated")
+		})
+	}
+}
+
+func TestDispatchExecutor_TargetSubjectRelationForwarded(t *testing.T) {
+	dispatchIterSubjects := func(t *testing.T, target query.ObjectType) *v1.DispatchQueryPlanRequest {
+		receiver := &testDispatcher{
+			planResponses: []*v1.DispatchQueryPlanResponse{{Paths: []*v1.ResultPath{}}},
+		}
+		sender := NewDispatchExecutor(receiver, &v1.PlanContext{Revision: "rev1"}, 100)
+		ctx := newTestContext()
+		ctx.TargetSubjectType = target
+
+		alias := query.NewAliasIterator("group", "member", query.NewFixedIterator())
+		pathSeq, err := sender.IterSubjects(ctx, NewDispatchIterator(alias), query.Object{ObjectType: "group", ObjectID: "eng"}, query.NoObjectFilter())
+		require.NoError(t, err)
+		_, err = query.CollectAll(pathSeq)
+		require.NoError(t, err)
+
+		require.Len(t, receiver.planCalls, 1)
+		return receiver.planCalls[0]
+	}
+
+	t.Run("the request's target crosses the dispatch boundary", func(t *testing.T) {
+		// The per-hop filter is deliberately empty here, as it is inside arrows
+		// and recursion; the receiver can only learn the target from PlanContext.
+		req := dispatchIterSubjects(t, query.ObjectType{Type: "group", Subrelation: "member"})
+		require.Equal(t, "group#member", relationRefString(req.PlanContext.TargetSubjectRelation))
+	})
+
+	t.Run("no target is sent when none was asked for", func(t *testing.T) {
+		req := dispatchIterSubjects(t, query.ObjectType{})
+		require.Nil(t, req.PlanContext.TargetSubjectRelation)
+	})
+}
+
 func TestDispatchExecutor_ContextCancellation(t *testing.T) {
 	ctx, cancel := context.WithCancel(t.Context())
 	cancel() // cancel immediately
```

**File**: `internal/dispatch/graph/graph.go` (modified, +12/-0)
```diff
@@ -571,6 +571,18 @@ func (ld *localDispatcher) DispatchQueryPlan(
 		return err
 	}
 	qctx.MarkAsOperation(it, topLevelOp)
+
+	// MarkAsOperation is pre-sealed above, so the inner ctx.IterX calls will not
+	// record the request's target subject type themselves. Carry it over from
+	// PlanContext explicitly: aliases on this hop need it to decide the
+	// reflexive identity subject, and without it they would silently omit
+	// identity subjects the sender's own aliases include.
+	if target := req.PlanContext.GetTargetSubjectRelation(); target != nil {
+		qctx.TargetSubjectType = query.ObjectType{
+			Type:        target.Namespace,
+			Subrelation: target.Relation,
+		}
+	}
 	switch req.Operation {
 	case v1.PlanOperation_PLAN_OPERATION_CHECK:
 		path, err := it.CheckImpl(qctx, resource, subject)
```

**File**: `internal/dispatch/graph/queryplan_selfedge_test.go` (added, +177/-0)
```diff
@@ -0,0 +1,177 @@
+package graph
+
+import (
+	"fmt"
+	"sort"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/authzed/spicedb/internal/caveats"
+	"github.com/authzed/spicedb/internal/datastore/dsfortesting"
+	"github.com/authzed/spicedb/internal/datastore/memdb"
+	"github.com/authzed/spicedb/internal/dispatch"
+	log "github.com/authzed/spicedb/internal/logging"
+	"github.com/authzed/spicedb/internal/testfixtures"
+	caveattypes "github.com/authzed/spicedb/pkg/caveats/types"
+	"github.com/authzed/spicedb/pkg/datalayer"
+	v1 "github.com/authzed/spicedb/pkg/proto/dispatch/v1"
+	"github.com/authzed/spicedb/pkg/query"
+	"github.com/authzed/spicedb/pkg/query/queryopt"
+	"github.com/authzed/spicedb/pkg/schema/v2"
+	"github.com/authzed/spicedb/pkg/schemadsl/compiler"
+	"github.com/authzed/spicedb/pkg/schemadsl/input"
+	"github.com/authzed/spicedb/pkg/tuple"
+)
+
+const queryPlanSelfEdgeSchema = `
+definition user {}
+
+definition team {
+	relation member: user
+}
+
+definition folder {
+	relation parent: folder
+	relation owner: user
+	relation viewer: user | folder#view
+	permission view = viewer + owner + parent->view
+}
+`
+
+// recordingPlanDispatcher delegates to a real dispatcher and records the
+// DispatchQueryPlan requests the sender makes, so a test can prove a hop was
+// actually dispatched rather than evaluated locally.
+type recordingPlanDispatcher struct {
+	dispatch.Dispatcher
+	planCalls []*v1.DispatchQueryPlanRequest
+}
+
+func (d *recordingPlanDispatcher) DispatchQueryPlan(req *v1.DispatchQueryPlanRequest, stream dispatch.PlanStream) error {
+	d.planCalls = append(d.planCalls, req)
+	return d.Dispatcher.DispatchQueryPlan(req, stream)
+}
+
+// TestQueryPlanSelfEdgeAcrossDispatch runs the reflexive identity cases through
+// a real localDispatcher, the way the v1 permissions service does, so the alias
+// that decides identity runs on the receiving side of a dispatch hop.
+//
+// The receiver builds a fresh query.Context and pre-seals its top-level
+// operation, so it only knows the request's target if it restores it from
+// PlanContext.target_subject_relation. Without that, the first case below comes
+// back empty. team#member is deliberately non-recursive: aliases under a
+// recursion are not dispatch-wrapped, so a recursive relation would decide
+// identity on the sender and never exercise the receiver.
+//
+// Expected values are the classic dispatcher's.
+func TestQueryPlanSelfEdgeAcrossDispatch(t *testing.T) {
+	rawDS, err := dsfortesting.NewMemDBDatastoreForTesting(t, 0, 0, memdb.DisableGC)
+	require.NoError(t, err)
+	ds, revision := testfixtures.DatastoreFromSchemaAndTestRelationships(t, rawDS, queryPlanSelfEdgeSchema,
+		[]tuple.Relationship{
+			tuple.MustParse("team:eng#member@user:alice"),
+			tuple.MustParse("folder:strategy#parent@folder:company"),
+			tuple.MustParse("folder:company#viewer@user:legal"),
+		})
+
+	ctx := log.Logger.WithContext(datalayer.ContextWithHandle(t.Context()))
+	require.NoError(t, datalayer.SetInContext(ctx, datalayer.NewDataLayer(ds)))
+
+	compiled, err := compiler.Compile(compiler.InputSchema{
+		Source:       input.Source("test"),
+		SchemaString: queryPlanSelfEdgeSchema,
+	}, compiler.AllowUnprefixedObjectType())
+	require.NoError(t, err)
+	fullSchema, err := schema.BuildSchemaFromDefinitions(compiled.ObjectDefinitions, compiled.CaveatDefinitions)
+	require.NoError(t, err)
+
+	local, err := NewLocalOnlyDispatcher(MustNewDefaultDispatcherParametersForTesting())
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = local.Close() })
+
+	// newQueryContext mirrors the v1 permissions service's query plan path:
+	// optimize, wrap dispatch-eligible aliases, compile, and run on a
+	// DispatchExecutor.
+	newQueryContext := func(t *testing.T, op query.Operation, resourceType, permission string, subject query.ObjectType) (*query.Context, query.Iterator, *recordingPlanDispatcher) {
+		t.Helper()
+		co, err := query.BuildOutlineFromSchema(fullSchema, resourceType, permission)
+		require.NoError(t, err)
+		params := queryopt.RequestParams{
+			Operation:       op,
+			SubjectType:     subject.Type,
+			SubjectRelation: subject.Subrelation,
+		}
+		optimized, err := queryopt.ApplyOptimizations(co, queryopt.OptimizersForRequest(params), params)
+		require.NoError(t, err)
+		optimized, err = dispatch.ApplyDispatchWrap(optimized, params)
+		require.NoError(t, err)
+		it, err := optimized.Compile()
+		require.NoError(t, err)
+
+		recorder := &recordingPlanDispatcher{Dispatcher: local}
+		qctx := dispatch.NewQueryContext(
+			ctx,
+			recorder,
+			dispatch.NewPlanContext(revision.String(), datalayer.NoSchemaHashForTesting, nil, 50, 0),
+			query.NewQueryDatastoreReader(datalayer.NewDataLayer(ds).SnapshotReader(revision, datalayer.NoSchemaHashForTesting)),
+			caveats.NewCaveatRunner(caveattypes.Default.TypeSet),
+			100,
+		)
+		return qctx, it, recorder
+	}
+
+	lookupSubjects := func(t *testing.T, resourceID string, target query.ObjectType) ([]strin
```

**File**: `pkg/proto/dispatch/v1/dispatch.pb.go` (modified, +61/-36)
```diff
@@ -1755,8 +1755,24 @@ type PlanContext struct {
 	// describes both per-hop and user-facing operations; only CHECK,
 	// LOOKUP_RESOURCES, and LOOKUP_SUBJECTS are valid here.
 	TopLevelOperation PlanOperation `protobuf:"varint,7,opt,name=top_level_operation,json=topLevelOperation,proto3,enum=dispatch.v1.PlanOperation" json:"top_level_operation,omitempty"`
-	unknownFields     protoimpl.UnknownFields
-	sizeCache         protoimpl.SizeCache
+	// target_subject_relation carries the subject type and relation whose
+	// reachability is being asked about, so that receiver-side aliases decide
+	// the reflexive identity subject the same way the sender would: the filter
+	// of the user-facing LookupSubjects, or the subject of a Check that resolves
+	// through recursion (which answers by enumerating subjects). This mirrors
+	// DispatchLookupSubjectsRequest.subject_relation, which the classic
+	// dispatcher threads through every dispatch level for the same reason.
+	//
+	// It is deliberately distinct from DispatchQueryPlanRequest.subject, which
+	// for LOOKUP_SUBJECTS carries the *per-hop* filter: that filter is empty
+	// inside arrows and recursion, which have to walk intermediate-typed results
+	// in order to keep traversing, so it cannot answer what the request wanted.
+	//
+	// Unset when no specific subject was asked about, in which case identity is
+	// not decidable and no self edge is produced.
+	TargetSubjectRelation *v1.RelationReference `protobuf:"bytes,8,opt,name=target_subject_relation,json=targetSubjectRelation,proto3" json:"target_subject_relation,omitempty"`
+	unknownFields         protoimpl.UnknownFields
+	sizeCache             protoimpl.SizeCache
 }
 
 func (x *PlanContext) Reset() {
@@ -1838,6 +1854,13 @@ func (x *PlanContext) GetTopLevelOperation() PlanOperation {
 	return PlanOperation_PLAN_OPERATION_CHECK
 }
 
+func (x *PlanContext) GetTargetSubjectRelation() *v1.RelationReference {
+	if x != nil {
+		return x.TargetSubjectRelation
+	}
+	return nil
+}
+
 type DispatchQueryPlanRequest struct {
 	state     protoimpl.MessageState `protogen:"open.v1"`
 	Operation PlanOperation          `protobuf:"varint,1,opt,name=operation,proto3,enum=dispatch.v1.PlanOperation" json:"operation,omitempty"`
@@ -2313,7 +2336,7 @@ const file_dispatch_v1_dispatch_proto_rawDesc = "" +
 	"\aUNKNOWN\x10\x00\x12\f\n" +
 	"\bRELATION\x10\x01\x12\x0e\n" +
 	"\n" +
-	"PERMISSION\x10\x02\"\xea\x02\n" +
+	"PERMISSION\x10\x02\"\xbe\x03\n" +
 	"\vPlanContext\x12\x1a\n" +
 	"\brevision\x18\x01 \x01(\tR\brevision\x12>\n" +
 	"\x0ecaveat_context\x18\x02 \x01(\v2\x17.google.protobuf.StructR\rcaveatContext\x12.\n" +
@@ -2322,7 +2345,8 @@ const file_dispatch_v1_dispatch_proto_rawDesc = "" +
 	"\vschema_hash\x18\x05 \x01(\fR\n" +
 	"schemaHash\x12(\n" +
 	"\x10in_progress_keys\x18\x06 \x03(\tR\x0einProgressKeys\x12J\n" +
-	"\x13top_level_operation\x18\a \x01(\x0e2\x1a.dispatch.v1.PlanOperationR\x11topLevelOperation\"\xd8\x02\n" +
+	"\x13top_level_operation\x18\a \x01(\x0e2\x1a.dispatch.v1.PlanOperationR\x11topLevelOperation\x12R\n" +
+	"\x17target_subject_relation\x18\b \x01(\v2\x1a.core.v1.RelationReferenceR\x15targetSubjectRelation\"\xd8\x02\n" +
 	"\x18DispatchQueryPlanRequest\x128\n" +
 	"\toperation\x18\x01 \x01(\x0e2\x1a.dispatch.v1.PlanOperationR\toperation\x126\n" +
 	"\bresource\x18\x03 \x01(\v2\x1a.core.v1.ObjectAndRelationR\bresource\x124\n" +
@@ -2479,38 +2503,39 @@ var file_dispatch_v1_dispatch_proto_depIdxs = []int32{
 	40, // 47: dispatch.v1.CheckDebugTrace.duration:type_name -> google.protobuf.Duration
 	39, // 48: dispatch.v1.PlanContext.caveat_context:type_name -> google.protobuf.Struct
 	0,  // 49: dispatch.v1.PlanContext.top_level_operation:type_name -> dispatch.v1.PlanOperation
-	0,  // 50: dispatch.v1.DispatchQueryPlanRequest.operation:type_name -> dispatch.v1.PlanOperation
-	36, // 51: dispatch.v1.DispatchQueryPlanRequest.resource:type_name -> core.v1.ObjectAndRelation
-	36, // 52: dispatch.v1.DispatchQueryPlanRequest.subject:type_name -> core.v1.ObjectAndRelation
-	27, // 53: dispatch.v1.DispatchQueryPlanRequest.plan_context:type_name -> dispatch.v1.PlanContext
-	36, // 54: dispatch.v1.DispatchQueryPlanRequest.many:type_name -> core.v1.ObjectAndRelation
-	24, // 55: dispatch.v1.DispatchQueryPlanResponse.metadata:type_name -> dispatch.v1.ResponseMeta
-	30, // 56: dispatch.v1.DispatchQueryPlanResponse.paths:type_name -> dispatch.v1.ResultPath
-	37, // 57: dispatch.v1.ResultPath.caveat:type_name -> core.v1.CaveatExpression
-	41, // 58: dispatch.v1.ResultPath.expiration:type_name -> google.protobuf.Timestamp
-	42, // 59: dispatch.v1.ResultPath.integrity:type_name -> core.v1.RelationshipIntegrity
-	39, // 60: dispatch.v1.ResultPath.metadata:type_name -> google.protobuf.Struct
-	30, // 61: dispatch.v1.ResultPath.excluded_subjects:type_name -> dispatch.v1.ResultPath
-	9,  // 62: dispatch.v1.DispatchCheckResponse.ResultsByResourceIdEntry.value:type_name -> dispatch.v1.ResourceCheckResult
-	21, // 63: dispatch.v1.D
```

**File**: `pkg/proto/dispatch/v1/dispatch_vtproto.pb.go` (modified, +92/-0)
```diff
@@ -664,6 +664,13 @@ func (m *PlanContext) CloneVT() *PlanContext {
 		copy(tmpContainer, rhs)
 		r.InProgressKeys = tmpContainer
 	}
+	if rhs := m.TargetSubjectRelation; rhs != nil {
+		if vtpb, ok := interface{}(rhs).(interface{ CloneVT() *v1.RelationReference }); ok {
+			r.TargetSubjectRelation = vtpb.CloneVT()
+		} else {
+			r.TargetSubjectRelation = proto.Clone(rhs).(*v1.RelationReference)
+		}
+	}
 	if len(m.unknownFields) > 0 {
 		r.unknownFields = make([]byte, len(m.unknownFields))
 		copy(r.unknownFields, m.unknownFields)
@@ -1722,6 +1729,15 @@ func (this *PlanContext) EqualVT(that *PlanContext) bool {
 	if this.TopLevelOperation != that.TopLevelOperation {
 		return false
 	}
+	if equal, ok := interface{}(this.TargetSubjectRelation).(interface {
+		EqualVT(*v1.RelationReference) bool
+	}); ok {
+		if !equal.EqualVT(that.TargetSubjectRelation) {
+			return false
+		}
+	} else if !proto.Equal(this.TargetSubjectRelation, that.TargetSubjectRelation) {
+		return false
+	}
 	return string(this.unknownFields) == string(that.unknownFields)
 }
 
@@ -3616,6 +3632,28 @@ func (m *PlanContext) MarshalToSizedBufferVT(dAtA []byte) (int, error) {
 		i -= len(m.unknownFields)
 		copy(dAtA[i:], m.unknownFields)
 	}
+	if m.TargetSubjectRelation != nil {
+		if vtmsg, ok := interface{}(m.TargetSubjectRelation).(interface {
+			MarshalToSizedBufferVT([]byte) (int, error)
+		}); ok {
+			size, err := vtmsg.MarshalToSizedBufferVT(dAtA[:i])
+			if err != nil {
+				return 0, err
+			}
+			i -= size
+			i = protohelpers.EncodeVarint(dAtA, i, uint64(size))
+		} else {
+			encoded, err := proto.Marshal(m.TargetSubjectRelation)
+			if err != nil {
+				return 0, err
+			}
+			i -= len(encoded)
+			copy(dAtA[i:], encoded)
+			i = protohelpers.EncodeVarint(dAtA, i, uint64(len(encoded)))
+		}
+		i--
+		dAtA[i] = 0x42
+	}
 	if m.TopLevelOperation != 0 {
 		i = protohelpers.EncodeVarint(dAtA, i, uint64(m.TopLevelOperation))
 		i--
@@ -4754,6 +4792,16 @@ func (m *PlanContext) SizeVT() (n int) {
 	if m.TopLevelOperation != 0 {
 		n += 1 + protohelpers.SizeOfVarint(uint64(m.TopLevelOperation))
 	}
+	if m.TargetSubjectRelation != nil {
+		if size, ok := interface{}(m.TargetSubjectRelation).(interface {
+			SizeVT() int
+		}); ok {
+			l = size.SizeVT()
+		} else {
+			l = proto.Size(m.TargetSubjectRelation)
+		}
+		n += 1 + l + protohelpers.SizeOfVarint(uint64(l))
+	}
 	n += len(m.unknownFields)
 	return n
 }
@@ -9155,6 +9203,50 @@ func (m *PlanContext) UnmarshalVT(dAtA []byte) error {
 					break
 				}
 			}
+		case 8:
+			if wireType != 2 {
+				return fmt.Errorf("proto: wrong wireType = %d for field TargetSubjectRelation", wireType)
+			}
+			var msglen int
+			for shift := uint(0); ; shift += 7 {
+				if shift >= 64 {
+					return protohelpers.ErrIntOverflow
+				}
+				if iNdEx >= l {
+					return io.ErrUnexpectedEOF
+				}
+				b := dAtA[iNdEx]
+				iNdEx++
+				msglen |= int(b&0x7F) << shift
+				if b < 0x80 {
+					break
+				}
+			}
+			if msglen < 0 {
+				return protohelpers.ErrInvalidLength
+			}
+			postIndex := iNdEx + msglen
+			if postIndex < 0 {
+				return protohelpers.ErrInvalidLength
+			}
+			if postIndex > l {
+				return io.ErrUnexpectedEOF
+			}
+			if m.TargetSubjectRelation == nil {
+				m.TargetSubjectRelation = &v1.RelationReference{}
+			}
+			if unmarshal, ok := interface{}(m.TargetSubjectRelation).(interface {
+				UnmarshalVT([]byte) error
+			}); ok {
+				if err := unmarshal.UnmarshalVT(dAtA[iNdEx:postIndex]); err != nil {
+					return err
+				}
+			} else {
+				if err := proto.Unmarshal(dAtA[iNdEx:postIndex], m.TargetSubjectRelation); err != nil {
+					return err
+				}
+			}
+			iNdEx = postIndex
 		default:
 			iNdEx = preIndex
 			skippy, err := protohelpers.Skip(dAtA[iNdEx:])
```

**File**: `pkg/query/alias.go` (modified, +40/-27)
```diff
@@ -218,43 +218,56 @@ func (a *AliasIterator) IterSubjectsImpl(ctx *Context, resource Object, filterSu
 	// Check if we should add a self-edge based on identity semantics.
 	// The dispatcher Check includes an identity check (see filterForFoundMemberResource
 	// in internal/graph/check.go): if the resource (with relation) matches the subject
-	// exactly, it returns MEMBER. This only applies if the resource actually appears
-	// as a subject in the data and the filter allows it.
-	shouldAddSelfEdge := a.shouldIncludeSelfEdge(ctx, resource, filterSubjectType)
+	// exactly, it returns MEMBER. Whether that applies here is decided by comparing
+	// against the request's target, not by looking at the data; see
+	// shouldIncludeSelfEdge.
+	shouldAddSelfEdge := a.shouldIncludeSelfEdge(ctx, resource)
 
 	return a.maybePrependSelfEdge(resource, subSeq, shouldAddSelfEdge), nil
 }
 
-// shouldIncludeSelfEdge checks if a self-edge should be included for the given resource.
-// This matches the dispatcher's identity check behavior: if resource#relation appears as
-// a subject anywhere in the datastore (expired or not), and the filter allows it, we
-// include a self-edge in the results.
-func (a *AliasIterator) shouldIncludeSelfEdge(ctx *Context, resource Object, filterSubjectType ObjectType) bool {
-	if ctx.TopLevelOperation != OperationIterSubjects {
+// shouldIncludeSelfEdge reports whether the reflexive identity subject applies:
+// enumerating the subjects of group:a#member includes group:a#member itself.
+//
+// This is a comparison, not a lookup. It holds exactly when the request asked
+// for subjects of this alias's own (definition, relation) — the same condition
+// the classic dispatcher tests at internal/graph/lookupsubjects.go, comparing
+// req.SubjectRelation against req.ResourceRelation, without touching the
+// datastore.
+//
+// The comparison is against Context.TargetSubjectType rather than the caller's
+// filterSubjectType, because arrows and recursion pass no filter (they must walk
+// intermediate-typed results to keep traversing) and an empty filter would make
+// the test vacuously true for every object they visit.
+//
+// Note the decision is per node, not per traversal: in `active = member -
+// banned` with a target of group#member, it holds for the `member` branch and
+// not for the `banned` branch, and that asymmetry is what makes the exclusion
+// come out right.
+func (a *AliasIterator) shouldIncludeSelfEdge(ctx *Context, resource Object) bool {
+	// A Check reaches here too, by way of a recursive permission: Check on one
+	// resolves through RecursiveIterator.recursiveCheckIterSubjects, which
+	// answers by running this same IterSubjects machinery. That traversal sets
+	// the target to the subject it is checking, so the comparison below is the
+	// right question in both cases. An empty target means nobody asked for a
+	// specific subject, and identity cannot be decided — see the field comment
+	// on Context.TargetSubjectType.
+	switch ctx.TopLevelOperation {
+	case OperationIterSubjects, OperationCheck:
+		// Both ask about a specific subject, so identity is decidable below.
+	default:
+		// An IterResources decides identity locally in IterResourcesImpl, where
+		// the subject is a parameter; an unset operation has no request at all.
 		return false
 	}
-	rel := a.effectiveRelation()
-	typeMatches := filterSubjectType.Type == "" || filterSubjectType.Type == resource.ObjectType
-	relationMatches := filterSubjectType.Subrelation == "" || filterSubjectType.Subrelation == rel
-	if !typeMatches || !relationMatches || ctx.Reader == nil {
+	target := ctx.TargetSubjectType
+	if target.Type == "" {
 		return false
 	}
-
-	// Second check: does the resource actually appear as a subject in the data?
-	// We check for ANY relationships (expired or not) because the dispatcher's
-	// identity check applies regardless of expiration.
-	exists, err := a.resourceExistsAsSubject(ctx, resource)
-	if err != nil {
-		// On error, conservatively return false rather than failing the entire operation
+	if target.Type != a.definitionName || target.Type != resource.ObjectType {
 		return false
 	}
-	return exists
-}
-
-// resourceExistsAsSubject queries the datastore to check if the given resource appears
-// as a subject in any relationship, including expired relationships.
-func (a *AliasIterator) resourceExistsAsSubject(ctx *Context, resource Object) (bool, error) {
-	return ctx.Reader.SubjectExistsAsRelationship(ctx, resource, a.effectiveRelation())
+	return target.Subrelation == a.effectiveRelation()
 }
 
 func (a *AliasIterator) IterResourcesImpl(ctx *Context, subject ObjectAndRelation, filterResourceType ObjectType) (PathSeq, error) {
```

**File**: `pkg/query/alias_self_edge_test.go` (added, +249/-0)
```diff
@@ -0,0 +1,249 @@
+package query
+
+import (
+	"fmt"
+	"sort"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/authzed/spicedb/internal/datastore/dsfortesting"
+	"github.com/authzed/spicedb/internal/datastore/memdb"
+	"github.com/authzed/spicedb/internal/testfixtures"
+	"github.com/authzed/spicedb/pkg/datalayer"
+	"github.com/authzed/spicedb/pkg/tuple"
+)
+
+const selfEdgeSchema = `
+definition user {}
+
+definition group {
+	relation member: user | group#member
+	relation banned: user | group#member
+	permission active = member - banned
+}
+`
+
+// iterSubjectsWithCounts runs a LookupSubjects against the given relationships
+// and returns the subjects found plus the datastore queries it took.
+func iterSubjectsWithCounts(
+	t *testing.T,
+	relationships []string,
+	resourceID, permission string,
+	target ObjectType,
+) ([]string, ReaderCounts) {
+	t.Helper()
+	require := require.New(t)
+
+	rawDS, err := dsfortesting.NewMemDBDatastoreForTesting(t, 0, 0, memdb.DisableGC)
+	require.NoError(err)
+
+	parsed := make([]tuple.Relationship, 0, len(relationships))
+	for _, rel := range relationships {
+		parsed = append(parsed, tuple.MustParse(rel))
+	}
+	ds, revision := testfixtures.DatastoreFromSchemaAndTestRelationships(t, rawDS, selfEdgeSchema, parsed)
+
+	dsSchema, err := ReadSchema(t.Context(), ds, revision)
+	require.NoError(err)
+	canonicalOutline, err := BuildOutlineFromSchema(dsSchema, "group", permission)
+	require.NoError(err)
+	it, err := canonicalOutline.Compile()
+	require.NoError(err)
+
+	reader := NewCountingReader(
+		NewQueryDatastoreReader(datalayer.NewDataLayer(ds).SnapshotReader(revision, datalayer.NoSchemaHashForTesting)),
+	)
+	ctx := NewLocalContext(t.Context(), WithReader(reader))
+
+	pathSeq, err := ctx.IterSubjects(it, NewObject("group", resourceID), target)
+	require.NoError(err)
+	paths, err := CollectAll(pathSeq)
+	require.NoError(err)
+
+	found := make([]string, 0, len(paths))
+	for _, path := range paths {
+		found = append(found, fmt.Sprintf("%s:%s#%s", path.Subject.ObjectType, path.Subject.ObjectID, path.Subject.Relation))
+	}
+	sort.Strings(found)
+	return found, reader.Counts()
+}
+
+// TestAliasSelfEdge covers the reflexive identity subject: enumerating the
+// subjects of `group:a#member` includes `group:a#member` itself.
+//
+// The expected values are the classic dispatcher's, captured by running the
+// same queries through internal/dispatch/graph. Classic decides this with a
+// comparison (lookupsubjects.go, `req.SubjectRelation` against
+// `req.ResourceRelation`) and never queries for it, which is the property the
+// first case pins: asking for the identity costs no extra round-trips.
+func TestAliasSelfEdge(t *testing.T) {
+	deepHierarchy := []string{
+		"group:a#member@group:b#member",
+		"group:b#member@group:c#member",
+		"group:c#member@user:alice",
+	}
+	exclusion := []string{
+		"group:a#member@group:b#member",
+		"group:a#banned@group:b#member",
+		"group:b#member@user:alice",
+	}
+
+	t.Run("identity is included when the target relation matches", func(t *testing.T) {
+		require := require.New(t)
+
+		found, counts := iterSubjectsWithCounts(t, deepHierarchy, "a", "member", NewType("group", "member"))
+
+		require.Equal([]string{"group:a#member", "group:b#member", "group:c#member"}, found,
+			"group:a is reflexively one of its own members")
+
+		// The same traversal with a target that admits no identity must cost the
+		// same: whether the identity applies is a comparison, not a lookup.
+		_, withoutIdentity := iterSubjectsWithCounts(t, deepHierarchy, "a", "member", NewType("user"))
+		require.Equal(withoutIdentity.Total(), counts.Total(),
+			"deciding the identity must not cost a datastore query")
+	})
+
+	t.Run("identity is excluded when the target is a different type", func(t *testing.T) {
+		require := require.New(t)
+
+		found, _ := iterSubjectsWithCounts(t, deepHierarchy, "a", "member", NewType("user"))
+
+		require.Equal([]string{"user:alice#..."}, found,
+			"a group is not a user, so no identity subject applies")
+	})
+
+	t.Run("identity is per relation, so exclusion cancels asymmetrically", func(t *testing.T) {
+		require := require.New(t)
+
+		// `active = member - banned`. The identity applies to `member`, whose
+		// relation is the target, but not to `banned`, whose relation is not —
+		// so group:a survives the exclusion while group:b does not.
+		found, _ := iterSubjectsWithCounts(t, exclusion, "a", "active", NewType("group", "member"))
+
+		require.Equal([]string{"group:a#member"}, found)
+	})
+
+	t.Run("identity does not leak into a differently typed target", func(t *testing.T) {
+		require := require.New(t)
+
+		found, _ := iterSubjectsWithCounts(t, exclusion, "a", "active", NewType("user"))
+
+		require.Empty(found, "alice is both a member and banned, so nothing survives")
+	})
+
+	t.Run("identity is decided only for LookupSubjects and Check", func(t *testing.T) {
+		// The target alone is not enough: an IterResources
```

---

### Incident Patch 4: `e4b276d7` (2026-09-29)
**Commit Message**: fix(ci): set up snapd in the release job instead of assuming it (#3360)

The release job installs snapcraft with

  sudo snap install snapcraft --channel=8.x/stable --classic

which fails on runner images where snapd is not running:

  error: cannot communicate with server: Post "http://localhost/v2/snaps/snapcraft":
         dial unix /run/snapd.socket: connect: no such file or directory

The identical step in nightly.yaml fails this way on pushes to main today, and
#3321 hit it in the Trivy job. Those two jobs never needed snapcraft and the
step was simply removed. This job does need it: goreleaser builds the snap
declared in .goreleaser.yml here, and this is the job that publishes it to the
Snap Store. Left alone it will fail the same way on the next tag.

So the step now provisions snapd rather than assuming it. It probes for
/run/snapd.socket, installs and starts snapd when the socket is missing,
waits for seeding to finish, and only then installs snapcraft. apt and
systemctl are allowed to fail quietly because the socket check that follows
decides, and gives a clearer message than either would.

If snapd still cannot be had, the step exits 1 with an explicit message rather
th

**File**: `.github/workflows/release.yaml` (modified, +30/-2)
```diff
@@ -27,11 +27,39 @@ jobs:
         if: "${{ !startsWith(github.ref_name, 'v') || steps.version.outputs.is_valid != 'true' }}"
         run: 'echo "SpiceDB version must start with `v` and be a semver" && exit 1'
         shell: "bash"
+      # goreleaser builds and publishes the snap declared in .goreleaser.yml,
+      # which needs the snapcraft CLI, which is itself distributed as a snap.
+      # Runner images vary in whether snapd is installed and running, and
+      # without it `snap install` fails with "cannot communicate with server
+      # ... /run/snapd.socket: no such file or directory". So provision snapd
+      # rather than assume it. If it cannot be provisioned this step fails on
+      # purpose: a release that quietly stops publishing the snap is worse than
+      # one that stops loudly.
       - name: "Install snapcraft"
         run: |
+          set -euo pipefail
+          if [ ! -S /run/snapd.socket ]; then
+            echo "snapd is not running on this runner; installing and starting it"
+            # Let these fail quietly: the socket check below is what decides,
+            # and it gives a better message than apt or systemctl would.
+            sudo apt-get update && sudo apt-get install --yes snapd || true
+            sudo systemctl enable --now snapd.socket || true
+          fi
+          if [ ! -S /run/snapd.socket ]; then
+            echo "::error::snapd is unavailable on this runner, so snapcraft cannot be installed and the snap cannot be published."
+            exit 1
+          fi
+          # snapd accepts connections before it has finished seeding, and
+          # `snap install` fails until it has. Bound the wait: snapd on these
+          # images has been seen to hang rather than fail (see #3321), and a
+          # release job that hangs for six hours is worse than one that stops.
+          if ! sudo timeout 300 snap wait system seed.loaded; then
+            echo "::error::snapd did not finish seeding within 5 minutes, so snapcraft cannot be installed and the snap cannot be published."
+            exit 1
+          fi
           sudo snap install snapcraft --channel=8.x/stable --classic
-          mkdir -p $HOME/.cache/snapcraft/download
-          mkdir -p $HOME/.cache/snapcraft/stage-packages
+          mkdir -p "${HOME}/.cache/snapcraft/download"
+          mkdir -p "${HOME}/.cache/snapcraft/stage-packages"
       - uses: "authzed/actions/docker-login@11667c9b2e8b3649ad2af4d788e57d18f8e8eaf1" # main
         with:
           quayio_token: "${{ secrets.QUAYIO_PASSWORD }}"
```

---

### Incident Patch 5: `ee41e694` (2026-07-08)
**Commit Message**: fix(query): sound caveat resolution and depth errors for recursive relations

Recursive relations tracked reachable objects with a global visited set
and kept the caveat of the first path by which each object was reached. An
object first reached via a caveated edge kept that caveat on every
descendant even when later reached unconditionally, reporting conditional
access where access was in fact unconditional (a caveated diamond is
enough to trigger it; no cycle required).

Replace the visited set with a semi-naive fixpoint over a canonical caveat
condition (a DNF with idempotent AND and an absorbing unconditional case),
re-expanding an object only when a new path weakens its condition and
buffering results until the traversal converges so a caveat is never
emitted before it is final. When no recursive edge is caveated this
reduces to the previous BFS. Also surface MaxRecursionDepthError on depth
exhaustion instead of silently returning a truncated result.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Caveats: compiled caveats (and their CEL environments) are now cached per schema version — hung off the stored schema (`ReadOnlyStoredSchema`) and rebuilt only when the schema changes — rather than rebuilt on every check, reducing check cost for schemas with many caveats (https://github.com/authzed/spicedb/pull/3166)
 
 ### Fixed
+- Query Planner: recursive relations (e.g. `member: user | group#member`) no longer report a subject as only conditionally reachable when an uncaveated path makes it unconditional, and a traversal that exceeds the maximum recursion depth now returns an error instead of a silently truncated result (experimental `--experimental-query-plan`) (https://github.com/authzed/spicedb/pull/3220)
 - Fixed a nil pointer dereference panic in `CheckBulkPermissions` that could occur under concurrent load when a tracing-enabled check shared a singleflight dispatch with a non-tracing bulk check. Debug-enabled checks are no longer singleflighted together with non-debug checks. (https://github.com/authzed/spicedb/pull/3174)
 - Fixed a nil pointer dereference panic in the Postgres FDW (https://github.com/authzed/spicedb/pull/3235)
 - CockroachDB: deletes performed by CockroachDB's row-level TTL job for expired relationships are no longer emitted as `DELETE` events by the Watch API. On CockroachDB ≥ 24.1, SpiceDB sets the `ttl_disable_changefeed_replication` storage parameter on the relationship tables at startup (if it lacks `ALTER TABLE` privileges, it logs a warning with the statement to run manually); on older versions a startup warning is logged and TTL deletes continue to be emitted. Note that the parameter affects any changefeed over these tables — external changefeeds that want TTL deletes can opt back in with `ignore_disable_changefeed_replication`. Delete-only transactions also no longer write an internal transaction-metadata marker row, reducing write amplification. (https://github.com/authzed/spicedb/pull/3210)
```

**File**: `internal/caveats/canonical.go` (added, +309/-0)
```diff
@@ -0,0 +1,309 @@
+package caveats
+
+import (
+	"sort"
+	"strings"
+
+	"google.golang.org/protobuf/proto"
+
+	pkgcaveats "github.com/authzed/spicedb/pkg/caveats"
+	core "github.com/authzed/spicedb/pkg/proto/core/v1"
+)
+
+// Condition is a canonical, order-independent representation of a caveat
+// expression as a disjunctive normal form (DNF): an OR of conjuncts, where each
+// conjunct is an AND of atoms. It exists so that recursive traversals can decide
+// whether a newly-discovered path *weakens* the condition under which an object
+// is reachable — the termination guarantee of the semi-naive fixpoint.
+//
+// Two properties make that guarantee hold:
+//   - AND is idempotent and commutative: c1 ∧ c2 ∧ c1 collapses to {c1, c2}, so
+//     the set of distinct conjuncts is finite.
+//   - ⊤ (unconditional) is absorbing under OR: once an object is reachable
+//     unconditionally, no further path can weaken it.
+//
+// The zero value is the "false" condition (no disjuncts); use Top() for the
+// unconditional condition and FromExpression to derive one from a caveat.
+type Condition struct {
+	top       bool
+	disjuncts [][]atom // OR of conjuncts; each conjunct sorted+deduped by atom key, non-empty
+}
+
+// atom is a single indivisible leaf of a condition: a contextualized caveat, or
+// an opaque (e.g. negated) subexpression. key is the canonical identity used for
+// dedup, sorting and comparison; expr is retained so the original expression can
+// be rebuilt, since the key alone cannot recover a caveat's context.
+type atom struct {
+	key  string
+	expr *core.CaveatExpression
+}
+
+// Top returns the unconditional (always-true) condition.
+func Top() Condition {
+	return Condition{top: true}
+}
+
+// FromExpression converts a caveat expression into its canonical DNF. A nil
+// expression is unconditional and yields Top().
+func FromExpression(expr *core.CaveatExpression) Condition {
+	if expr == nil {
+		return Top()
+	}
+	return fromExpr(expr)
+}
+
+func fromExpr(expr *core.CaveatExpression) Condition {
+	if leaf := expr.GetCaveat(); leaf != nil {
+		return singleAtom(atom{key: caveatAtomKey(leaf), expr: expr})
+	}
+
+	op := expr.GetOperation()
+	if op == nil {
+		return singleAtom(atom{key: opaqueAtomKey(expr), expr: expr})
+	}
+
+	switch op.GetOp() {
+	case core.CaveatOperation_AND:
+		result := Top()
+		for _, child := range op.GetChildren() {
+			result = result.And(fromExpr(child))
+		}
+		return result
+
+	case core.CaveatOperation_OR:
+		var result Condition // the zero value is the "false" condition
+		for _, child := range op.GetChildren() {
+			result, _ = result.Or(fromExpr(child))
+		}
+		return result
+
+	default:
+		// NOT (and anything unrecognized) is treated as an opaque atom: we do not
+		// distribute negation, which keeps the atom set finite and the result sound
+		// (conservative — it may report "changed" when logically unchanged).
+		return singleAtom(atom{key: opaqueAtomKey(expr), expr: expr})
+	}
+}
+
+// IsTop reports whether the condition is unconditional.
+func (c Condition) IsTop() bool {
+	return c.top
+}
+
+// Disjuncts returns the number of DNF disjuncts (0 for Top or false).
+func (c Condition) Disjuncts() int {
+	return len(c.disjuncts)
+}
+
+// And returns the canonical conjunction of the two conditions.
+func (c Condition) And(other Condition) Condition {
+	if c.top {
+		return other
+	}
+	if other.top {
+		return c
+	}
+	// false AND x == false
+	if len(c.disjuncts) == 0 || len(other.disjuncts) == 0 {
+		return Condition{}
+	}
+
+	// Distribute: (A1 ∨ A2) ∧ (B1 ∨ B2) == (A1∧B1) ∨ (A1∧B2) ∨ (A2∧B1) ∨ (A2∧B2).
+	product := make([][]atom, 0, len(c.disjuncts)*len(other.disjuncts))
+	for _, a := range c.disjuncts {
+		for _, b := range other.disjuncts {
+			combined := make([]atom, 0, len(a)+len(b))
+			combined = append(combined, a...)
+			combined = append(combined, b...)
+			product = append(product, combined)
+		}
+	}
+	return normalizeCondition(product)
+}
+
+// Or returns the canonical disjunction of the two conditions, and reports whether
+// the result differs from the receiver — i.e. whether other *weakened* c.
+func (c Condition) Or(other Condition) (Condition, bool) {
+	if c.top {
+		return c, false
+	}
+	if other.top {
+		return Top(), true
+	}
+
+	combined := make([][]atom, 0, len(c.disjuncts)+len(other.disjuncts))
+	combined = append(combined, c.disjuncts...)
+	combined = append(combined, other.disjuncts...)
+	result := normalizeCondition(combined)
+	return result, !result.equalTo(c)
+}
+
+// Expression rebuilds a caveat expression equivalent to this condition. Top()
+// (and the degenerate false condition) yield nil.
+func (c Condition) Expression() *core.CaveatExpression {
+	if c.top || len(c.disjuncts) == 0 {
+		return nil
+	}
+
+	var result *core.CaveatExpression
+	for _, conjunct := range c.disjuncts {
+		var conj *core.CaveatExpression
+		for _, a := range conjunct {
+			conj = And(conj, a.expr)
+		}
+		result = Or(result, conj)
+	}
+	return resul
```

**File**: `internal/caveats/canonical_test.go` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+package caveats
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestConditionTop(t *testing.T) {
+	require.True(t, Top().IsTop())
+	require.Equal(t, "true", Top().String())
+
+	// A nil expression is unconditional.
+	require.True(t, FromExpression(nil).IsTop())
+
+	// A single caveat is conditional.
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	require.False(t, c1.IsTop())
+	require.Equal(t, "cav1", c1.String())
+	require.Equal(t, 1, c1.Disjuncts())
+}
+
+func TestConditionAndIsIdempotent(t *testing.T) {
+	// c1 ∧ c2 ∧ c1 must collapse to the two-atom conjunct {c1, c2}.
+	expr := And(And(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")), CaveatExprForTesting("cav1"))
+	c := FromExpression(expr)
+	require.Equal(t, "cav1 & cav2", c.String())
+	require.Equal(t, 1, c.Disjuncts())
+}
+
+func TestConditionAndIsCommutative(t *testing.T) {
+	a := FromExpression(And(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")))
+	b := FromExpression(And(CaveatExprForTesting("cav2"), CaveatExprForTesting("cav1")))
+	require.Equal(t, a.String(), b.String())
+}
+
+func TestConditionAndWithTopIsIdentity(t *testing.T) {
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	require.Equal(t, "cav1", Top().And(c1).String())
+	require.Equal(t, "cav1", c1.And(Top()).String())
+}
+
+func TestConditionAndDistributesOverOr(t *testing.T) {
+	// (cav1 | cav2) & cav3 == (cav1 & cav3) | (cav2 & cav3)
+	expr := And(Or(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")), CaveatExprForTesting("cav3"))
+	require.Equal(t, "cav1 & cav3 | cav2 & cav3", FromExpression(expr).String())
+}
+
+func TestConditionOrUnions(t *testing.T) {
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	c2 := FromExpression(CaveatExprForTesting("cav2"))
+	res, changed := c1.Or(c2)
+	require.True(t, changed)
+	require.Equal(t, "cav1 | cav2", res.String())
+}
+
+func TestConditionOrIdempotentReportsUnchanged(t *testing.T) {
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	res, changed := c1.Or(FromExpression(CaveatExprForTesting("cav1")))
+	require.False(t, changed, "OR-ing an identical condition must not report a change")
+	require.Equal(t, "cav1", res.String())
+}
+
+func TestConditionOrAbsorbsTop(t *testing.T) {
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+
+	// A conditional weakened by Top becomes unconditional (a change).
+	res, changed := c1.Or(Top())
+	require.True(t, res.IsTop())
+	require.True(t, changed)
+
+	// Top OR anything stays Top (no change).
+	res2, changed2 := Top().Or(c1)
+	require.True(t, res2.IsTop())
+	require.False(t, changed2)
+}
+
+func TestConditionOrSubsumesSuperset(t *testing.T) {
+	// cav1 ∨ (cav1 ∧ cav2): the two-atom conjunct is redundant (implies cav1), so
+	// the result is just cav1.
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	c1and2 := FromExpression(And(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")))
+
+	res, changed := c1.Or(c1and2)
+	require.Equal(t, "cav1", res.String())
+	require.False(t, changed, "adding a subsumed conjunct does not weaken the condition")
+
+	// The other direction: starting from the superset and adding cav1 weakens it.
+	res2, changed2 := c1and2.Or(c1)
+	require.Equal(t, "cav1", res2.String())
+	require.True(t, changed2)
+}
+
+func TestConditionContextDistinguishesAtoms(t *testing.T) {
+	// Same caveat name, different context => distinct atoms.
+	a := FromExpression(MustCaveatExprForTestingWithContext("cav1", map[string]any{"x": 1}))
+	b := FromExpression(MustCaveatExprForTestingWithContext("cav1", map[string]any{"x": 2}))
+	res, changed := a.Or(b)
+	require.True(t, changed)
+	require.Equal(t, 2, res.Disjuncts(), "different context must not be deduped")
+}
+
+func TestConditionExpressionRoundTrip(t *testing.T) {
+	require.Nil(t, Top().Expression())
+
+	orig := FromExpression(And(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")))
+	rebuilt := FromExpression(orig.Expression())
+	require.Equal(t, orig.String(), rebuilt.String())
+}
```

**File**: `pkg/query/errors.go` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+package query
+
+import "fmt"
+
+// MaxRecursionDepthError indicates that a recursive traversal did not resolve
+// within the configured maximum recursion depth. It mirrors the legacy
+// dispatcher's MaxDepthExceeded semantics: the answer is unknown, not negative.
+// Callers must surface this as an error rather than treating it as NOT_MEMBER or
+// an empty result set.
+type MaxRecursionDepthError struct {
+	Depth int
+}
+
+func (e MaxRecursionDepthError) Error() string {
+	return fmt.Sprintf("max recursion depth (%d) exceeded during recursive traversal: this usually indicates a recursive or too deep data dependency", e.Depth)
+}
```

**File**: `pkg/query/recursion_correctness_test.go` (added, +200/-0)
```diff
@@ -0,0 +1,200 @@
+package query
+
+import (
+	"fmt"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/authzed/spicedb/internal/caveats"
+	"github.com/authzed/spicedb/internal/datastore/dsfortesting"
+	"github.com/authzed/spicedb/internal/datastore/memdb"
+	"github.com/authzed/spicedb/internal/testfixtures"
+	caveattypes "github.com/authzed/spicedb/pkg/caveats/types"
+	"github.com/authzed/spicedb/pkg/datalayer"
+	"github.com/authzed/spicedb/pkg/tuple"
+)
+
+// compileRecursive writes the schema and relationships to a fresh datastore and
+// returns a query context (with a caveat runner) plus the compiled iterator for
+// the given definition and relation.
+func compileRecursive(t *testing.T, schemaText, def, relation string, rels []tuple.Relationship) (*Context, Iterator) {
+	t.Helper()
+
+	rawDS, err := dsfortesting.NewMemDBDatastoreForTesting(t, 0, 0, memdb.DisableGC)
+	require.NoError(t, err)
+
+	ds, revision := testfixtures.DatastoreFromSchemaAndTestRelationships(t, rawDS, schemaText, rels)
+
+	dsSchema, err := ReadSchema(t.Context(), ds, revision)
+	require.NoError(t, err)
+
+	outline, err := BuildOutlineFromSchema(dsSchema, def, relation)
+	require.NoError(t, err)
+	it, err := outline.Compile()
+	require.NoError(t, err)
+
+	reader := NewQueryDatastoreReader(datalayer.NewDataLayer(ds).SnapshotReader(revision, datalayer.NoSchemaHashForTesting))
+	ctx := NewLocalContext(t.Context(),
+		WithReader(reader),
+		WithCaveatRunner(caveats.NewCaveatRunner(caveattypes.Default.TypeSet)),
+		WithMaxRecursionDepth(defaultMaxRecursionDepth),
+	)
+	return ctx, it
+}
+
+// groupMemberSchema is the canonical directly-cyclic userset relation: a group's
+// members are users plus the members of nested groups.
+const groupMemberSchema = `
+definition user {}
+definition group {
+	relation member: user | group#member
+}
+`
+
+// buildGroupChain constructs `depth` nested groups g0..g(depth-1) where
+// g0#member@user:tom and g(i)#member@g(i-1)#member. Thus user:tom is transitively
+// a member of every group, reached only by walking the full chain.
+func buildGroupChain(t *testing.T, depth int) (*Context, Iterator) {
+	t.Helper()
+
+	rels := make([]tuple.Relationship, 0, depth)
+	rels = append(rels, tuple.MustParse("group:g0#member@user:tom"))
+	for i := 1; i < depth; i++ {
+		rels = append(rels, tuple.MustParse(fmt.Sprintf("group:g%d#member@group:g%d#member", i, i-1)))
+	}
+	return compileRecursive(t, groupMemberSchema, "group", "member", rels)
+}
+
+// TestDeepChainCheckErrorsRatherThanSilentlyDenying verifies that a Check whose
+// answer lies beyond MaxRecursionDepth returns an error, matching the legacy
+// engine's MaxDepthExceeded, rather than silently returning NOT_MEMBER.
+func TestDeepChainCheckErrorsRatherThanSilentlyDenying(t *testing.T) {
+	// The chain is longer than defaultMaxRecursionDepth (50), so the membership of
+	// user:tom in group:g59 cannot be determined within the depth budget.
+	ctx, it := buildGroupChain(t, 60)
+
+	_, err := ctx.Check(it, NewObject("group", "g59"), NewObject("user", "tom").WithEllipses())
+	require.Error(t, err, "a check beyond max recursion depth must error, not silently deny")
+	require.ErrorAs(t, err, &MaxRecursionDepthError{})
+}
+
+// TestShallowChainCheckSucceeds is the control: a chain within the depth budget
+// resolves normally, so the depth error is not spuriously raised.
+func TestShallowChainCheckSucceeds(t *testing.T) {
+	ctx, it := buildGroupChain(t, 10)
+
+	path, err := ctx.Check(it, NewObject("group", "g9"), NewObject("user", "tom").WithEllipses())
+	require.NoError(t, err)
+	require.NotNil(t, path, "user:tom is a member of group:g9 via the chain")
+}
+
+// TestDeepChainLookupResourcesErrorsRatherThanTruncating verifies that a
+// LookupResources whose full result set lies beyond MaxRecursionDepth errors
+// rather than silently returning a truncated set.
+func TestDeepChainLookupResourcesErrorsRatherThanTruncating(t *testing.T) {
+	ctx, it := buildGroupChain(t, 60)
+
+	paths, err := ctx.IterResources(it, NewObject("user", "tom").WithEllipses(), NoObjectFilter())
+	require.NoError(t, err)
+	_, err = CollectAll(paths)
+	require.Error(t, err, "an LR beyond max recursion depth must error, not silently truncate")
+	require.ErrorAs(t, err, &MaxRecursionDepthError{})
+}
+
+// TestShallowChainLookupResourcesSucceeds is the control for the LR path.
+func TestShallowChainLookupResourcesSucceeds(t *testing.T) {
+	ctx, it := buildGroupChain(t, 10)
+
+	paths, err := ctx.IterResources(it, NewObject("user", "tom").WithEllipses(), NoObjectFilter())
+	require.NoError(t, err)
+	results, err := CollectAll(paths)
+	require.NoError(t, err)
+	// user:tom is a member of all 10 groups g0..g9.
+	require.Len(t, results, 10)
+}
+
+// caveatedDiamondSchema allows a group's members to be reached via a caveated or
+// an uncaveated nested-group edge.
+const caveatedDiamondSchema = `
+definition user {}
+caveat cav1(v bool) { v }
+definition group {
+	relation member: user
```

**File**: `pkg/query/recursive.go` (modified, +123/-78)
```diff
@@ -33,9 +33,11 @@ func init() {
 // frontierEntry is a lightweight frontier node for BFS IterSubjects.
 // It carries only the fields needed to combine with the next hop's path —
 // unlike a full *Path it does not hold Resource, Relation, or Metadata.
+// Condition is the canonical caveat condition under which Subject was reached,
+// which is conjoined with each outgoing edge's caveat as the frontier advances.
 type frontierEntry struct {
 	Subject    ObjectAndRelation
-	Caveat     *core.CaveatExpression
+	Condition  caveats.Condition
 	Expiration *time.Time
 	Integrity  []*core.RelationshipIntegrity
 }
@@ -275,25 +277,34 @@ func (r *RecursiveIterator) breadthFirstIterSubjects(ctx *Context, resource Obje
 	}
 
 	return func(yield func(*Path, error) bool) {
-		// Track yielded paths by endpoints for global deduplication with OR/caveat semantics.
+		// yieldedPaths accumulates every endpoint path, OR-merged by endpoint key.
+		// Results are buffered and flushed only once the traversal converges: under a
+		// caveated schema a later ply can weaken the condition on an already-seen
+		// endpoint (an object first reached via a caveated edge and later reached
+		// unconditionally), so emitting eagerly could leak a stale, over-restrictive
+		// caveat (bug B1). Buffering adds no memory — every path was retained here
+		// already for cross-ply deduplication.
 		yieldedPaths := make(map[string]*Path)
 
-		// Track queried objects to prevent cycles (avoid re-querying same objects).
-		queriedObjects := make(map[string]bool)
+		// reached records, for each object that has entered the frontier, the
+		// canonical caveat condition under which it was reached. An object is
+		// re-expanded only when a new path *weakens* that condition — the semi-naive
+		// fixpoint. Because the condition is canonical, conjunction is idempotent
+		// (c1 ∧ c2 ∧ c1 == {c1,c2}) and the unconditional case is absorbing under OR,
+		// so the fixpoint terminates even on cyclic data.
+		reached := make(map[string]caveats.Condition)
 
-		// frontier holds lightweight entries — just the fields needed to combine with the next
-		// hop's path. Using frontierEntry rather than *Path avoids keeping Resource, Relation,
-		// and Metadata alive across plies.
+		reached[resource.Key()] = caveats.Top()
 		frontier := []frontierEntry{
 			{
 				Subject: ObjectAndRelation{
 					ObjectType: resource.ObjectType,
 					ObjectID:   resource.ObjectID,
 					Relation:   tuple.Ellipsis,
 				},
+				Condition: caveats.Top(),
 			},
 		}
-		queriedObjects[resource.Key()] = true
 
 		// plyPaths is allocated once and cleared each ply to avoid per-ply allocations.
 		plyPaths := make(map[string]*Path)
@@ -315,7 +326,8 @@ func (r *RecursiveIterator) breadthFirstIterSubjects(ctx *Context, resource Obje
 			clear(plyPaths)
 
 			// Query IterSubjects FROM each frontier object, accumulating results in plyPaths.
-			// Paths with the same endpoint from different frontier nodes are merged with OR.
+			// Each edge's caveat is conjoined with the condition under which the frontier
+			// object itself was reached; endpoints reached multiple ways this ply are ORed.
 			for _, fe := range frontier {
 				frontierResource := GetObject(fe.Subject)
 
@@ -340,11 +352,12 @@ func (r *RecursiveIterator) breadthFirstIterSubjects(ctx *Context, resource Obje
 					//   fe:      original_resource → frontier_resource  (implicit)
 					//   subPath: frontier_resource → subject
 					//   result:  original_resource → subject
+					pathCondition := fe.Condition.And(caveats.FromExpression(subPath.Caveat))
 					combinedPath := &Path{
 						Resource:   resource,
 						Relation:   r.relationName,
 						Subject:    subPath.Subject,
-						Caveat:     caveats.And(fe.Caveat, subPath.Caveat),
+						Caveat:     pathCondition.Expression(),
 						Expiration: combineExpiration(fe.Expiration, subPath.Expiration),
 						Integrity:  combineIntegrity(fe.Integrity, subPath.Integrity),
 					}
@@ -365,7 +378,8 @@ func (r *RecursiveIterator) breadthFirstIterSubjects(ctx *Context, resource Obje
 				ctx.TraceStep(r, "Ply %d: found %d unique paths", ply, len(plyPaths))
 			}
 
-			// Extract frontier objects collected by all sentinels during this ply.
+			// Extract frontier objects collected by all sentinels during this ply
+			// (arrow recursion surfaces its next hop this way rather than as subjects).
 			var collectedObjects []Object
 			for _, sentinelID := range sentinelIDs {
 				collectedObjects = append(collectedObjects, ctx.ExtractFrontierCollection(sentinelID)...)
@@ -376,75 +390,84 @@ func (r *RecursiveIterator) breadthFirstIterSubjects(ctx *Context, resource Obje
 
 			// Reset and reuse nextFrontier.
 			nextFrontier = nextFrontier[:0]
-			yieldedCount := 0
 
+			// Merge this ply's endpoints into the global buffer and re-enqueue any
+			// recursive object whose reaching condition weakened.
 			for key, path := range plyPaths {
-				isRecursive := path.Subject.ObjectType == r.de
```

**File**: `pkg/query/recursive_coverage_test.go` (modified, +6/-6)
```diff
@@ -106,12 +106,12 @@ func TestBreadthFirstIterResources_MaxDepth(t *testing.T) {
 	seq, err := recursive.IterResourcesImpl(ctx, ObjectAndRelation{ObjectType: "user", ObjectID: "alice", Relation: "..."}, NoObjectFilter())
 	require.NoError(err)
 
-	paths, err := CollectAll(seq)
-	require.NoError(err)
-
-	// Should terminate at max depth, not infinite loop
-	// Each ply generates one new path, so we expect at most 3 paths
-	require.LessOrEqual(len(paths), 3, "Should terminate at max depth")
+	// The iterator never converges, so the traversal exhausts its depth budget.
+	// It must terminate with a MaxRecursionDepthError rather than either looping
+	// forever or silently returning a truncated result set.
+	_, err = CollectAll(seq)
+	require.Error(err, "Should terminate at max depth with an error, not silently truncate")
+	require.ErrorAs(err, &MaxRecursionDepthError{})
 }
 
 // TestBreadthFirstIterResources_ErrorHandling tests error paths in BFS IterResources
```

---

### Incident Patch 6: `7ff2f4cb` (2026-07-08)
**Commit Message**: fix(query): specify query shapes for planner datastore reads

The recursive self-edge existence probe (SubjectExistsAsRelationship) and
the forward MatchingResourcesForSubject lookup did not specify a query
shape. The former panics under the validating datastore; the latter fails
index checking on SQL datastores because the forward query-shape validator
had no case for it. Specify queryshape.Varying on the existence probe and
add the missing forward validator case.

**File**: `internal/datastore/proxy/indexcheck/queryshapevalidators.go` (modified, +32/-0)
```diff
@@ -287,6 +287,38 @@ func validateQueryShape(queryShape queryshape.Shape, filter datastore.Relationsh
 		}
 		return nil
 
+	case queryshape.MatchingResourcesForSubject:
+		// The forward form of this shape, as issued by pkg/query/reader.go's
+		// QueryResources: the resource type and relation are pinned, the resource
+		// ID is never specified, and exactly one subject selector fully specifies
+		// the subject type and ID. The subject relation is possibly-specified, so
+		// it is intentionally not validated (mirroring the reverse validator).
+		if err := validateCaveatFilter(filter, queryShape); err != nil {
+			return err
+		}
+		if err := validateResourceType(filter.OptionalResourceType, queryShape, true); err != nil {
+			return err
+		}
+		if err := validateResourceIDs(filter.OptionalResourceIds, queryShape, false); err != nil {
+			return err
+		}
+		if err := validateResourceRelation(filter.OptionalResourceRelation, queryShape, true); err != nil {
+			return err
+		}
+		if err := validateSubjectsSelectors(filter.OptionalSubjectsSelectors, queryShape, true); err != nil {
+			return err
+		}
+		if len(filter.OptionalSubjectsSelectors) != 1 {
+			return fmt.Errorf("exactly one subjects selector required for %s", queryShape)
+		}
+		if err := validateSubjectType(filter.OptionalSubjectsSelectors[0].OptionalSubjectType, queryShape); err != nil {
+			return err
+		}
+		if err := validateSubjectIDs(filter.OptionalSubjectsSelectors[0].OptionalSubjectIds, queryShape, true); err != nil {
+			return err
+		}
+		return nil
+
 	case queryshape.Varying:
 		// Nothing to validate.
 		return nil
```

**File**: `internal/datastore/proxy/indexcheck/queryshapevalidators_test.go` (modified, +82/-0)
```diff
@@ -738,6 +738,88 @@ func TestValidateQueryShape(t *testing.T) {
 			expectError: true,
 			errorMsg:    "subject relation required",
 		},
+		{
+			// The exact filter pkg/query/reader.go QueryResources builds for a
+			// forward MatchingResourcesForSubject query, with an ellipsis subject.
+			name:  "MatchingResourcesForSubject - valid, ellipsis subject",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceType:     "document",
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "user",
+						OptionalSubjectIds:  []string{"user1"},
+					},
+				},
+			},
+			expectError: false,
+		},
+		{
+			// subject_relation is possibly-specified (🅿️) for this shape, so a
+			// non-ellipsis subject relation must also be accepted.
+			name:  "MatchingResourcesForSubject - valid, non-ellipsis subject relation",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceType:     "document",
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "group",
+						OptionalSubjectIds:  []string{"admins"},
+						RelationFilter:      datastore.SubjectRelationFilter{}.WithNonEllipsisRelation("member"),
+					},
+				},
+			},
+			expectError: false,
+		},
+		{
+			name:  "MatchingResourcesForSubject - missing resource type",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "user",
+						OptionalSubjectIds:  []string{"user1"},
+					},
+				},
+			},
+			expectError: true,
+			errorMsg:    "resource type required",
+		},
+		{
+			name:  "MatchingResourcesForSubject - has resource ids",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceType:     "document",
+				OptionalResourceIds:      []string{"doc1"},
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "user",
+						OptionalSubjectIds:  []string{"user1"},
+					},
+				},
+			},
+			expectError: true,
+			errorMsg:    "no optional resource ids allowed",
+		},
+		{
+			name:  "MatchingResourcesForSubject - missing subject ids",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceType:     "document",
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "user",
+					},
+				},
+			},
+			expectError: true,
+			errorMsg:    "subject ids required",
+		},
 		{
 			name:        "Unknown shape - error",
 			shape:       "unknown-shape",
```

**File**: `pkg/query/reader.go` (modified, +5/-0)
```diff
@@ -268,6 +268,11 @@ func (r *datalayerQueryDatastoreReader) SubjectExistsAsRelationship(
 	relIter, err := r.inner.QueryRelationships(ctx, filter,
 		options.WithLimit(&limitOne),
 		options.WithSkipExpiration(true),
+		// The filter pins the subject but leaves the resource columns open, which
+		// gaps the PK and makes CockroachDB reject a forced index hint. Varying lets
+		// the datastore pick an index from the actual filter columns (the subject
+		// index). This mirrors the reasoning in QuerySubjects above.
+		options.WithQueryShape(queryshape.Varying),
 	)
 	if err != nil {
 		return false, err
```

**File**: `pkg/query/reader_test.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+package query
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/authzed/spicedb/internal/datastore/dsfortesting"
+	"github.com/authzed/spicedb/internal/datastore/memdb"
+	"github.com/authzed/spicedb/internal/testfixtures"
+	"github.com/authzed/spicedb/pkg/datalayer"
+	"github.com/authzed/spicedb/pkg/tuple"
+)
+
+// recursiveUsersetSchema is the canonical "directly cyclic" userset relation.
+// The self-edge probe (SubjectExistsAsRelationship) only fires for schemas of
+// this shape, which is why the missing query shape went unnoticed.
+const recursiveUsersetSchema = `
+definition user {}
+definition group {
+	relation member: user | group#member
+}
+`
+
+// TestSubjectExistsAsRelationship_QueryShape verifies that the existence probe
+// specifies a query shape. Without it, the probe panics with "query shape is
+// unspecified" under the validating datastore that all testfixtures helpers wrap.
+func TestSubjectExistsAsRelationship_QueryShape(t *testing.T) {
+	require := require.New(t)
+
+	rawDS, err := dsfortesting.NewMemDBDatastoreForTesting(t, 0, 0, memdb.DisableGC)
+	require.NoError(err)
+
+	ds, revision := testfixtures.DatastoreFromSchemaAndTestRelationships(
+		t, rawDS, recursiveUsersetSchema,
+		[]tuple.Relationship{
+			tuple.MustParse("group:a#member@user:tom"),
+			tuple.MustParse("group:b#member@group:a#member"),
+		},
+	)
+
+	reader := NewQueryDatastoreReader(
+		datalayer.NewDataLayer(ds).SnapshotReader(revision, datalayer.NoSchemaHashForTesting),
+	)
+
+	// group:a appears as a subject of group:b#member, so the probe must find it.
+	exists, err := reader.SubjectExistsAsRelationship(t.Context(), NewObject("group", "a"), "member")
+	require.NoError(err)
+	require.True(exists)
+
+	// group:c never appears as a subject, so the probe must not find it.
+	exists, err = reader.SubjectExistsAsRelationship(t.Context(), NewObject("group", "c"), "member")
+	require.NoError(err)
+	require.False(exists)
+}
```

---

### Incident Patch 7: `58eda58f` (2026-09-16)
**Commit Message**: fix: skip the transaction-overlap touch during bulk delete

Every CockroachDB write transaction touches one transactions-table row
per overlap key so that otherwise non-overlapping transactions receive
causally-ordered commit timestamps -- the new-enemy protection. Under
the default static strategy that is the single shared row every write
in the cluster touches, so each bulk delete batch contended with all
concurrent production writes and, having spent seconds in the KV layer
before the touch, risked a failed refresh and a full-batch retry.

Nothing reads the transactions table; the touch exists only to force
ordering for writes with causal dependents. A pure-delete batch has
none: its outcome is observable only after the command completes, far
outside the clock-uncertainty window in which commit timestamps could
invert. The command now defaults its datastore to the insecure overlap
strategy, alongside the other serving-path overrides in
prepareBulkDeleteConfig; passing --datastore-tx-overlap-strategy
explicitly restores any other behavior. The datastore layer is
unchanged, so a future v1 API adoption of cursored deletes keeps full
overlap semantics.

**File**: `docs/spicedb.md` (modified, +5/-0)
```diff
@@ -84,6 +84,11 @@ Unlike the serving path, batches wait indefinitely for a CockroachDB write
 connection rather than failing fast after the 30ms admission-control default;
 pass --write-conn-acquisition-timeout explicitly to bound the wait.
 
+Batches also skip the CockroachDB transaction-overlap touch that orders the
+commit timestamps of causally-dependent writes: a pure-delete batch has no
+causal dependents, and the touch would contend with every concurrent write to
+the cluster. Pass --datastore-tx-overlap-strategy explicitly to restore it.
+
 Example:
 
   spicedb datastore delete-relationships \
```

**File**: `pkg/cmd/deleterelationships.go` (modified, +21/-4)
```diff
@@ -211,6 +211,11 @@ Unlike the serving path, batches wait indefinitely for a CockroachDB write
 connection rather than failing fast after the 30ms admission-control default;
 pass --write-conn-acquisition-timeout explicitly to bound the wait.
 
+Batches also skip the CockroachDB transaction-overlap touch that orders the
+commit timestamps of causally-dependent writes: a pure-delete batch has no
+causal dependents, and the touch would contend with every concurrent write to
+the cluster. Pass --datastore-tx-overlap-strategy explicitly to restore it.
+
 Example:
 
   ` + programName + ` datastore delete-relationships \
@@ -264,18 +269,30 @@ func RegisterDeleteRelationshipsFlags(cmd *cobra.Command, flags *deleteRelations
 // connection on CockroachDB before failing with ResourceExhausted.
 const writeAcquisitionTimeoutFlag = "write-conn-acquisition-timeout"
 
+// overlapStrategyFlag selects how CockroachDB writes force transaction
+// overlap for commit-timestamp ordering (the new-enemy protection).
+const overlapStrategyFlag = "datastore-tx-overlap-strategy"
+
 // prepareBulkDeleteConfig adjusts datastore defaults that are tuned for the
-// serving path but wrong for a one-shot bulk deletion: background GC has no
-// server to run under, and the write-connection acquisition timeout is a
+// serving path but wrong for a one-shot bulk deletion. Background GC has no
+// server to run under. The write-connection acquisition timeout is a
 // fail-fast admission control (30ms by default) that a cold pool cannot even
-// dial a CockroachDB connection within. A bulk delete batch should wait for a
-// write connection indefinitely unless the operator explicitly bounded it.
+// dial a CockroachDB connection within; a batch should instead wait
+// indefinitely. And the static transaction-overlap strategy would have every
+// batch touch the shared transactions row that all cluster writes contend
+// on -- ordering protection for causal dependents that a pure-delete batch,
+// observable only after the command completes, does not have. Each override
+// yields to an explicitly passed flag.
 func prepareBulkDeleteConfig(fs *pflag.FlagSet, cfg *dscmd.Config) {
 	cfg.GCInterval = -1 * time.Hour
 
 	if !fs.Changed(writeAcquisitionTimeoutFlag) {
 		cfg.WriteAcquisitionTimeout = 0
 	}
+
+	if !fs.Changed(overlapStrategyFlag) {
+		cfg.OverlapStrategy = "insecure"
+	}
 }
 
 func parseResumeCursor(raw string) (options.Cursor, error) {
```

**File**: `pkg/cmd/deleterelationships_test.go` (modified, +20/-0)
```diff
@@ -294,6 +294,26 @@ func TestPrepareBulkDeleteConfigDisablesBackgroundGC(t *testing.T) {
 	require.Negative(t, cfg.GCInterval)
 }
 
+func TestPrepareBulkDeleteConfigSkipsTransactionOverlap(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg)
+
+	// The serving-path default forces every CockroachDB write to touch a
+	// shared transactions row for commit-timestamp ordering; a bulk delete
+	// batch has no causal dependents and must not contend on that row.
+	require.Equal(t, "static", cfg.OverlapStrategy)
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Equal(t, "insecure", cfg.OverlapStrategy)
+}
+
+func TestPrepareBulkDeleteConfigRespectsExplicitOverlapStrategy(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg, "--datastore-tx-overlap-strategy=prefix")
+
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Equal(t, "prefix", cfg.OverlapStrategy)
+}
+
 func TestConfirmationRequiredWithoutTTY(t *testing.T) {
 	// Without a terminal and without --yes, the command must error rather than
 	// block on a prompt nobody can answer.
```

---

### Incident Patch 8: `b527e077` (2026-09-16)
**Commit Message**: fix: wait indefinitely for write connections during bulk delete

The write-connection acquisition timeout defaults to 30ms, a fail-fast
admission control sized for the serving path, where shedding a write
beats queueing under pressure. The delete-relationships command opens a
cold pool, and dialing a CockroachDB connection does not reliably finish
inside 30ms, so the first batch -- and any batch after idle connections
are reaped mid-run -- fails with ResourceExhausted ("failed to acquire
in time") before a single row is deleted.

A bulk deletion is the only workload on its pool and has nothing to
shed, so the command now waits indefinitely for a write connection
unless --write-conn-acquisition-timeout is passed explicitly. The
existing background-GC override moves into the same helper so every
serving-default adjustment for this command lives in one tested place.

**File**: `docs/spicedb.md` (modified, +4/-0)
```diff
@@ -80,6 +80,10 @@ a complete deletion.
 Each batch logs its cursor, so an interrupted run can be resumed with
 --resume-cursor taken straight from the log.
 
+Unlike the serving path, batches wait indefinitely for a CockroachDB write
+connection rather than failing fast after the 30ms admission-control default;
+pass --write-conn-acquisition-timeout explicitly to bound the wait.
+
 Example:
 
   spicedb datastore delete-relationships \
```

**File**: `pkg/cmd/deleterelationships.go` (modified, +24/-2)
```diff
@@ -12,6 +12,7 @@ import (
 	"time"
 
 	"github.com/spf13/cobra"
+	"github.com/spf13/pflag"
 	"golang.org/x/term"
 
 	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
@@ -206,6 +207,10 @@ a complete deletion.
 Each batch logs its cursor, so an interrupted run can be resumed with
 --resume-cursor taken straight from the log.
 
+Unlike the serving path, batches wait indefinitely for a CockroachDB write
+connection rather than failing fast after the 30ms admission-control default;
+pass --write-conn-acquisition-timeout explicitly to bound the wait.
+
 Example:
 
   ` + programName + ` datastore delete-relationships \
@@ -255,6 +260,24 @@ func RegisterDeleteRelationshipsFlags(cmd *cobra.Command, flags *deleteRelations
 	return nil
 }
 
+// writeAcquisitionTimeoutFlag bounds how long a write waits for a pool
+// connection on CockroachDB before failing with ResourceExhausted.
+const writeAcquisitionTimeoutFlag = "write-conn-acquisition-timeout"
+
+// prepareBulkDeleteConfig adjusts datastore defaults that are tuned for the
+// serving path but wrong for a one-shot bulk deletion: background GC has no
+// server to run under, and the write-connection acquisition timeout is a
+// fail-fast admission control (30ms by default) that a cold pool cannot even
+// dial a CockroachDB connection within. A bulk delete batch should wait for a
+// write connection indefinitely unless the operator explicitly bounded it.
+func prepareBulkDeleteConfig(fs *pflag.FlagSet, cfg *dscmd.Config) {
+	cfg.GCInterval = -1 * time.Hour
+
+	if !fs.Changed(writeAcquisitionTimeoutFlag) {
+		cfg.WriteAcquisitionTimeout = 0
+	}
+}
+
 func parseResumeCursor(raw string) (options.Cursor, error) {
 	if raw == "" {
 		return nil, nil
@@ -349,8 +372,7 @@ func executeDeleteRelationships(cmd *cobra.Command, cfg *dscmd.Config, flags *de
 		return err
 	}
 
-	// Disable background GC; this is a one-shot operation.
-	cfg.GCInterval = -1 * time.Hour
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
 
 	ds, err := dscmd.NewDatastore(ctx, cfg.ToOption())
 	if err != nil {
```

**File**: `pkg/cmd/deleterelationships_test.go` (modified, +40/-0)
```diff
@@ -6,14 +6,17 @@ import (
 	"io"
 	"strings"
 	"testing"
+	"time"
 
 	"github.com/google/go-cmp/cmp"
 	"github.com/rs/zerolog"
+	"github.com/spf13/cobra"
 	"github.com/stretchr/testify/require"
 	"google.golang.org/protobuf/testing/protocmp"
 
 	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
 
+	dscmd "github.com/authzed/spicedb/pkg/cmd/datastore"
 	"github.com/authzed/spicedb/pkg/datastore"
 	"github.com/authzed/spicedb/pkg/datastore/options"
 	"github.com/authzed/spicedb/pkg/tuple"
@@ -254,6 +257,43 @@ func TestParseResumeCursor(t *testing.T) {
 	require.ErrorContains(t, err, "--resume-cursor")
 }
 
+// newBulkDeleteFlagSet builds a flag set carrying the datastore flags exactly
+// as the delete-relationships command registers them, parsed with args.
+func newBulkDeleteFlagSet(t *testing.T, cfg *dscmd.Config, args ...string) *cobra.Command {
+	t.Helper()
+	cmd := &cobra.Command{}
+	require.NoError(t, dscmd.RegisterDatastoreFlagsWithPrefix(cmd.Flags(), "", cfg))
+	require.NoError(t, cmd.Flags().Parse(args))
+	return cmd
+}
+
+func TestPrepareBulkDeleteConfigWaitsIndefinitelyForWriteConns(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg)
+
+	// The serving-path default is a 30ms fail-fast admission timeout; a batch
+	// of a bulk delete must instead wait for a write connection (0 = forever).
+	require.Equal(t, 30*time.Millisecond, cfg.WriteAcquisitionTimeout)
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Zero(t, cfg.WriteAcquisitionTimeout)
+}
+
+func TestPrepareBulkDeleteConfigRespectsExplicitAcquisitionTimeout(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg, "--write-conn-acquisition-timeout=45ms")
+
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Equal(t, 45*time.Millisecond, cfg.WriteAcquisitionTimeout)
+}
+
+func TestPrepareBulkDeleteConfigDisablesBackgroundGC(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg)
+
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Negative(t, cfg.GCInterval)
+}
+
 func TestConfirmationRequiredWithoutTTY(t *testing.T) {
 	// Without a terminal and without --yes, the command must error rather than
 	// block on a prompt nobody can answer.
```

---

### Incident Patch 9: `81fbf153` (2026-09-23)
**Commit Message**: test(consistency): let callers run the fixtures serially (#3375)

The consistency suite runs each validation file in parallel, which suits a
datastore that is cheap to stand up but is not the only reasonable choice. A
caller that would rather keep one fixture's resources live at a time can now
pass RunFixturesSerially.

The default is unchanged, and the chunk-size and dispatcher subtests within a
fixture stay parallel either way.

**File**: `pkg/consistency/test/consistency.go` (modified, +35/-5)
```diff
@@ -37,11 +37,34 @@ import (
 	"github.com/authzed/spicedb/pkg/validationfile"
 )
 
+type suiteOptions struct {
+	serialFixtures bool
+}
+
+// SuiteOption configures how a caller runs the consistency suite.
+type SuiteOption func(*suiteOptions)
+
+// RunFixturesSerially makes the suite run one validation file at a time.
+// It is for a caller whose datastore is expensive to stand up and who would
+// rather keep only one fixture's resources live at a time; the subtests within
+// a fixture still run concurrently either way.
+func RunFixturesSerially() SuiteOption {
+	return func(o *suiteOptions) { o.serialFixtures = true }
+}
+
+func newSuiteOptions(opts []SuiteOption) suiteOptions {
+	var o suiteOptions
+	for _, opt := range opts {
+		opt(&o)
+	}
+	return o
+}
+
 // AllConsistency runs the full system-wide consistency suite against the datastore
 // produced by the given tester. It is the consistency analog of test.All and lets any
 // DatastoreTester be exercised by the consistency suite.
-func AllConsistency(t *testing.T, tester dstest.DatastoreTester) {
-	ConsistencyForEngine(t, "", tester)
+func AllConsistency(t *testing.T, tester dstest.DatastoreTester, opts ...SuiteOption) {
+	ConsistencyForEngine(t, "", tester, opts...)
 }
 
 // ConsistencyForEngine runs the system-wide consistency suite, reading in the various
@@ -58,7 +81,11 @@ func AllConsistency(t *testing.T, tester dstest.DatastoreTester) {
 //
 // This acts as essentially a full integration test for the API, dispatching, caching,
 // computation and datastore layers.
-func ConsistencyForEngine(t *testing.T, engineID string, tester dstest.DatastoreTester) {
+//
+// Fixtures run in parallel unless the caller passes RunFixturesSerially.
+func ConsistencyForEngine(t *testing.T, engineID string, tester dstest.DatastoreTester, opts ...SuiteOption) {
+	suiteOpts := newSuiteOptions(opts)
+
 	consistencyTestFiles, err := testconfigs.List()
 	require.NoError(t, err)
 
@@ -90,8 +117,11 @@ func ConsistencyForEngine(t *testing.T, engineID string, tester dstest.Datastore
 			// the only concurrency was among the chunk-size and dispatcher subtests
 			// below, while the per-fixture prologue - which creates a database,
 			// migrates it and then walks the whole accessibility set - ran with
-			// everything else idle.
-			t.Parallel()
+			// everything else idle. A caller for whom a datastore is expensive
+			// enough that it wants one fixture live at a time opts out.
+			if !suiteOpts.serialFixtures {
+				t.Parallel()
+			}
 
 			baseds := newDatastore(t)
 			ds := indexcheck.WrapWithIndexCheckingDatastoreProxyIfApplicable(baseds)
```

---

### Incident Patch 10: `8d44af92` (2026-09-22)
**Commit Message**: fix: stop serving a revision that has no validity (#3374)

* fix(memdb): report no validity when head replaces the quantized revision

OptimizedRevision rounds the current time down to a quantization boundary, and
falls back to head when rounding would land before the first write — otherwise
reads are served from the empty snapshot taken when the datastore was created.

The validity returned alongside it still described the quantized revision that
was just discarded. Optimized revisions are cached for as long as they are
valid, so a caller could hold head for the remainder of the interval and miss
every write made during it. That is the same staleness the fallback exists to
prevent, reintroduced one layer up.

Head is only accurate at the moment it is read, so report no validity in that
case and let each request derive it afresh. The quantized path is unchanged and
still carries its own validity.

* fix(datastore): do not cache a revision that has no validity

The optimized revision cache subtracts a random slice of the configured maximum
staleness from "now" before testing its entries, so that requests do not all
miss at the same quantization boundary. That check does not distingu

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Datastore: `datastore.SortKeyRevision`, an optional extension to `datastore.Revision` for revision types that are totally ordered. Its `AppendSortKey` returns an order-preserving, prefix-free byte encoding of the revision, suitable as a key — or as one field of a composite key — in an ordered key/value store; `String()` offers neither property, being a variable-width decimal. Implemented for the hybrid logical clock, timestamp and transaction ID revision types. Postgres revisions are backed by transaction snapshots and are only partially ordered, so they deliberately do not implement it, and a type assertion is how a consumer discovers that. Supersedes `ByteSortable()`, which reports the same capability but cannot supply the encoding that satisfies it. (https://github.com/authzed/spicedb/pull/3319)
 
 ### Fixed
+- MemDB/Datastore: a revision reported with no validity is no longer kept by the optimized revision cache, and we fixed an issue where MemDB's reported validity caused a stale value to be cached. (https://github.com/authzed/spicedb/pull/3374)
 - MemDB: requests made shortly after startup could fail with `object definition not found`, or return no results, even though the schema and relationships had already been written. MemDB now advertises its head revision in that case, so committed data is never hidden behind the datastore's own creation. (https://github.com/authzed/spicedb/pull/3366)
 - MySQL: fixed a crash in the watch API. When reading transaction metadata hit an error part-way through iterating the result rows, that error was dropped and the watch was handed an empty result with no error, which then dereferenced a nil value and took the whole process down with it. The error is now returned to the caller. (https://github.com/authzed/spicedb/pull/3358)
 - Postgres: fixed connections being handed to queries already broken, which surfaced as `timeout: read tcp ...: i/o timeout` against a perfectly healthy database, most often under load and shortly after startup. Creating a datastore gave the connection pool the same context it used to bound its own startup checks, and then cancelled it on return - but filling the pool happens on a background goroutine that keeps using that context, so the cancellation landed part-way through opening connections. pgx responds to a cancelled context by setting an immediate deadline on the connection it is working on, and those connections still entered the pool. Pool warm-up now runs on a context of its own, so finishing startup no longer cancels it. The startup checks keep their own 30-second bound. (https://github.com/authzed/spicedb/pull/3333)
```

**File**: `internal/datastore/memdb/revisions.go` (modified, +7/-0)
```diff
@@ -88,6 +88,13 @@ func (mdb *memdbDatastore) OptimizedRevision(_ context.Context) (datastore.Revis
 	}
 	if optimized.LessThan(firstServable) {
 		optimized = mdb.headRevisionNoLock()
+
+		// validFor describes the quantized revision that was just discarded, not head.
+		// Reusing it would let a caller hold head for the rest of the quantization
+		// interval, hiding every write made during it — the same staleness this
+		// fallback exists to prevent. Head is only accurate at the moment it is read,
+		// so report no validity and let each call derive it afresh.
+		validFor = 0
 	}
 
 	// Find the schema hash visible at the optimized revision: walk the
```

**File**: `internal/datastore/memdb/revisions_test.go` (modified, +45/-0)
```diff
@@ -73,6 +73,51 @@ func TestOptimizedRevisionSeesFirstWrite(t *testing.T) {
 	})
 }
 
+// TestOptimizedRevisionFallbackReportsNoValidity covers the validity reported
+// alongside the fallback above. When rounding down would hide the first write,
+// OptimizedRevision answers with head instead — but the validity it computed
+// belongs to the quantized revision it discarded. Handing that validity out
+// lets a caller cache head for the rest of the interval and miss every write
+// made during it, which is the staleness the fallback exists to avoid.
+func TestOptimizedRevisionFallbackReportsNoValidity(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		const quantization = 50 * time.Millisecond
+
+		boundary := nextQuantizationBoundary(quantization)
+		time.Sleep(time.Until(boundary.Add(-5 * time.Millisecond)))
+
+		ds, err := NewMemdbDatastore(0, quantization, time.Hour)
+		require.NoError(t, err)
+		t.Cleanup(func() {
+			_ = ds.Close()
+		})
+
+		time.Sleep(time.Until(boundary.Add(time.Millisecond)))
+
+		_, err = ds.ReadWriteTx(t.Context(), func(ctx context.Context, rwt datastore.ReadWriteTransaction) error {
+			return rwt.WriteRelationships(ctx, []tuple.RelationshipUpdate{
+				tuple.Touch(tuple.MustParse("document:doc#viewer@user:tom")),
+			})
+		})
+		require.NoError(t, err)
+
+		// The fallback is active: rounding down lands before the write.
+		fallback, err := ds.OptimizedRevision(t.Context())
+		require.NoError(t, err)
+		require.Zero(t, fallback.ValidFor,
+			"head was substituted for the quantized revision, so the quantized revision's validity must not be reported")
+
+		// Past the next boundary the quantized revision is itself servable, the
+		// fallback no longer applies, and a real validity is expected again.
+		time.Sleep(time.Until(nextQuantizationBoundary(quantization).Add(time.Millisecond)))
+
+		quantized, err := ds.OptimizedRevision(t.Context())
+		require.NoError(t, err)
+		require.Positive(t, quantized.ValidFor,
+			"the quantized revision is servable here, so it should carry its own validity")
+	})
+}
+
 // nextQuantizationBoundary returns the next instant that OptimizedRevision
 // would round down to for the given quantization period.
 func nextQuantizationBoundary(quantization time.Duration) time.Time {
```

**File**: `internal/datastore/proxy/optimized_revision.go` (modified, +9/-1)
```diff
@@ -167,7 +167,15 @@ func (p *optimizedRevisionProxy) compute(ctx context.Context, localNow time.Time
 
 	p.candidates = p.candidates[numToDrop:]
 	computed := validRevision{revision: fresh.Revision, validThrough: rvt, schemaHash: fresh.SchemaHash}
-	p.candidates = append(p.candidates, computed)
+
+	// A revision that reports no validity is only accurate at the instant it was read,
+	// so it must not become a cache candidate: the staleness jitter subtracts up to
+	// maxStaleness from "now" when testing candidates, which would keep serving this
+	// already-expired entry for that long and hide every write made in the meantime.
+	// Returning it to this caller is fine; remembering it is not.
+	if fresh.ValidFor > 0 {
+		p.candidates = append(p.candidates, computed)
+	}
 	p.mu.Unlock()
 
 	span.AddEvent(otelconv.EventDatastoreRevisionsComputed)
```

**File**: `internal/datastore/proxy/optimized_revision_test.go` (modified, +14/-1)
```diff
@@ -86,14 +86,27 @@ func TestOptimizedRevisionCache(t *testing.T) {
 			[][]datastore.Revision{cand(one), cand(one), cand(two)},
 		},
 		{
+			// staleness lets a barely-expired candidate keep being served for a while
 			"cached by staleness",
 			7 * time.Millisecond,
 			[]revisionResponse{
-				{one, 0},
+				{one, 1 * time.Millisecond},
 				{two, 100 * time.Millisecond},
 			},
 			[][]datastore.Revision{cand(one), cand(one, two), cand(two), cand(two)},
 		},
+		{
+			// a revision with no validity is accurate only when it is read, so staleness
+			// must not keep it around: every call has to go back to the datastore
+			"no validity is never cached, even with staleness",
+			7 * time.Millisecond,
+			[]revisionResponse{
+				{one, 0},
+				{two, 0},
+				{three, 0},
+			},
+			[][]datastore.Revision{cand(one), cand(two), cand(three)},
+		},
 		{
 			"cached by staleness and validity",
 			2 * time.Millisecond,
```

---

### Incident Patch 11: `95bd2371` (2026-09-22)
**Commit Message**: ci: run the tests when the build system changes (#3372)

magefiles drives every job in this workflow, but was not in the paths
filter, so a magefiles-only pull request skipped the very jobs whose
behaviour it changed. .dockerignore has the same problem: it decides
what the image build sees.

**File**: `.github/workflows/build-test.yaml` (modified, +5/-0)
```diff
@@ -34,12 +34,17 @@ jobs:
             codechange:
               - ".github/workflows/build-test.yaml"
               - "Dockerfile"
+              - ".dockerignore"
               - "go.mod"
               - "go.sum"
               - "cmd/**"
               - "pkg/**"
               - "e2e/**"
               - "internal/**"
+              # magefiles drives every job below, so a change here can break
+              # them all. Without it a magefiles-only pull request skips the
+              # very jobs it changes.
+              - "magefiles/**"
       - uses: "dorny/paths-filter@ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d" # v4.0.3
         id: "proto-filter"
         with:
```

---

### Incident Patch 12: `5ef6918e` (2026-09-22)
**Commit Message**: fix(memdb): never hide the first write behind the creation snapshot (#3366)

* fix(memdb): never hide the first write behind the creation snapshot

OptimizedRevision rounds the current time down to the nearest quantization
boundary. MemDB keeps a snapshot of the still-empty database taken when the
datastore was created, and a read at a revision between that creation snapshot
and the first write is served from it, so already-committed data appears
missing.

An existing guard only caught boundaries that landed before the creation
snapshot, which is the common case and why this almost always worked. When the
boundary instead landed between creation and the first write, the empty
snapshot was advertised: with --datastore-engine=memory and
--datastore-bootstrap-files this surfaced as "object definition not found" for
up to one quantization interval (5 seconds by default) after startup, and as
the TestMiddlewareOrdering flake in CI.

MemDB now advertises its head revision whenever the quantized revision falls
before the first write. The new test forces the boundary into that window and
fails deterministically without the fix.

TestMiddlewareOrdering also now reads its bootstrapped setup 

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Datastore: `datastore.SortKeyRevision`, an optional extension to `datastore.Revision` for revision types that are totally ordered. Its `AppendSortKey` returns an order-preserving, prefix-free byte encoding of the revision, suitable as a key — or as one field of a composite key — in an ordered key/value store; `String()` offers neither property, being a variable-width decimal. Implemented for the hybrid logical clock, timestamp and transaction ID revision types. Postgres revisions are backed by transaction snapshots and are only partially ordered, so they deliberately do not implement it, and a type assertion is how a consumer discovers that. Supersedes `ByteSortable()`, which reports the same capability but cannot supply the encoding that satisfies it. (https://github.com/authzed/spicedb/pull/3319)
 
 ### Fixed
+- MemDB: requests made shortly after startup could fail with `object definition not found`, or return no results, even though the schema and relationships had already been written. MemDB now advertises its head revision in that case, so committed data is never hidden behind the datastore's own creation. (https://github.com/authzed/spicedb/pull/3366)
 - MySQL: fixed a crash in the watch API. When reading transaction metadata hit an error part-way through iterating the result rows, that error was dropped and the watch was handed an empty result with no error, which then dereferenced a nil value and took the whole process down with it. The error is now returned to the caller. (https://github.com/authzed/spicedb/pull/3358)
 - Postgres: fixed connections being handed to queries already broken, which surfaced as `timeout: read tcp ...: i/o timeout` against a perfectly healthy database, most often under load and shortly after startup. Creating a datastore gave the connection pool the same context it used to bound its own startup checks, and then cancelled it on return - but filling the pool happens on a background goroutine that keeps using that context, so the cancellation landed part-way through opening connections. pgx responds to a cancelled context by setting an immediate deadline on the connection it is working on, and those connections still entered the pool. Pool warm-up now runs on a context of its own, so finishing startup no longer cancels it. The startup checks keep their own 30-second bound. (https://github.com/authzed/spicedb/pull/3333)
 - Datastore: the wait between transaction retries is now capped at 10 seconds. It previously doubled without limit (25ms, 50ms, 100ms, …), which made `--datastore-max-tx-retries` an exponential wall-clock budget rather than a count of attempts: at the default of 10 the waits total about 25 seconds, but at 15 they total 14 minutes and at 20 over seven hours. (https://github.com/authzed/spicedb/pull/3353)
```

**File**: `internal/datastore/memdb/revisions.go` (modified, +10/-3)
```diff
@@ -77,9 +77,16 @@ func (mdb *memdbDatastore) OptimizedRevision(_ context.Context) (datastore.Revis
 	quantized, validFor := revisions.Quantize(nowRevision(), 0, mdb.quantizationPeriod)
 	optimized := quantized.(revisions.TimestampRevision)
 
-	// Rounding down can land before the oldest snapshot, which no read can be
-	// served at. Advertise head instead, as Postgres does for an empty bucket.
-	if optimized.LessThan(mdb.revisions[0].revision) {
+	// Entry 0 is the snapshot taken when the datastore was created: the database
+	// as it was before anything was written to it. Rounding down to any point
+	// before the first write therefore serves an empty datastore, hiding data
+	// that was already committed when the revision was requested. Advertise head
+	// instead, as Postgres does for an empty bucket.
+	firstServable := mdb.revisions[0].revision
+	if len(mdb.revisions) > 1 {
+		firstServable = mdb.revisions[1].revision
+	}
+	if optimized.LessThan(firstServable) {
 		optimized = mdb.headRevisionNoLock()
 	}
 
```

**File**: `internal/datastore/memdb/revisions_test.go` (modified, +55/-0)
```diff
@@ -1,10 +1,15 @@
 package memdb
 
 import (
+	"context"
 	"testing"
+	"testing/synctest"
 	"time"
 
 	"github.com/stretchr/testify/require"
+
+	"github.com/authzed/spicedb/pkg/datastore"
+	"github.com/authzed/spicedb/pkg/tuple"
 )
 
 func TestHeadRevision(t *testing.T) {
@@ -24,3 +29,53 @@ func TestHeadRevision(t *testing.T) {
 	err = ds.CheckRevision(t.Context(), newerResult.Revision)
 	require.NoError(t, err)
 }
+
+// TestOptimizedRevisionSeesFirstWrite asserts that the first write to a freshly
+// created datastore is visible at the optimized revision, even when a
+// quantization boundary happens to fall between the datastore's creation and
+// that write. Rounding down to such a boundary would otherwise serve the
+// still-empty snapshot taken at creation. The synctest bubble's clock is fake,
+// so the boundary lands between the two exactly rather than by timing luck.
+func TestOptimizedRevisionSeesFirstWrite(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		const quantization = 50 * time.Millisecond
+
+		boundary := nextQuantizationBoundary(quantization)
+		time.Sleep(time.Until(boundary.Add(-5 * time.Millisecond)))
+
+		ds, err := NewMemdbDatastore(0, quantization, time.Hour)
+		require.NoError(t, err)
+		t.Cleanup(func() {
+			_ = ds.Close()
+		})
+		require.True(t, time.Now().Before(boundary))
+
+		time.Sleep(time.Until(boundary.Add(time.Millisecond)))
+
+		_, err = ds.ReadWriteTx(t.Context(), func(ctx context.Context, rwt datastore.ReadWriteTransaction) error {
+			return rwt.WriteRelationships(ctx, []tuple.RelationshipUpdate{
+				tuple.Touch(tuple.MustParse("document:doc#viewer@user:tom")),
+			})
+		})
+		require.NoError(t, err)
+
+		optimized, err := ds.OptimizedRevision(t.Context())
+		require.NoError(t, err)
+
+		iter, err := ds.SnapshotReader(optimized.Revision).QueryRelationships(t.Context(), datastore.RelationshipsFilter{
+			OptionalResourceType: "document",
+		})
+		require.NoError(t, err)
+
+		rels, err := datastore.IteratorToSlice(iter)
+		require.NoError(t, err)
+		require.Len(t, rels, 1, "the optimized revision did not see the first write")
+	})
+}
+
+// nextQuantizationBoundary returns the next instant that OptimizedRevision
+// would round down to for the given quantization period.
+func nextQuantizationBoundary(quantization time.Duration) time.Time {
+	q := quantization.Nanoseconds()
+	return time.Unix(0, (time.Now().UTC().UnixNano()/q+1)*q)
+}
```

**File**: `pkg/cmd/server/middleware_test.go` (modified, +8/-0)
```diff
@@ -393,7 +393,14 @@ func TestMiddlewareOrdering(t *testing.T) {
 		errChan <- rs.Run(ctx)
 	}()
 
+	// The bootstrapped schema and relationships are setup, not the subject of this
+	// test, so read them at full consistency rather than at a quantized revision.
+	fullyConsistent := &v1.Consistency{
+		Requirement: &v1.Consistency_FullyConsistent{FullyConsistent: true},
+	}
+
 	req := &v1.CheckPermissionRequest{
+		Consistency: fullyConsistent,
 		Resource: &v1.ObjectReference{
 			ObjectType: "resource",
 			ObjectId:   "resource1",
@@ -413,6 +420,7 @@ func TestMiddlewareOrdering(t *testing.T) {
 	require.NoError(t, err)
 
 	lrreq := &v1.LookupResourcesRequest{
+		Consistency:        fullyConsistent,
 		ResourceObjectType: "resource",
 		Subject: &v1.SubjectReference{
 			Object: &v1.ObjectReference{
```

---

### Incident Patch 13: `44706fed` (2026-09-22)
**Commit Message**: fix(runtime): correct the memory fallback from 256KiB to 256MiB (#3329)

* fix(runtime): make the memory fallback 256MiB, as its comment always said

fallbackMemoryLimit was 256 * 1024 - 256 KiB - while the comment above it read
"256mb is tiny, but it should comfortably fit in most runtimes". It has been that
way since it was introduced in #3201; the intent in the comment is unambiguous and
the value is short by a factor of 1024.

This is the figure used when available memory cannot be determined at all, which
the surrounding code calls out as a real scenario: an AWS ECS task whose container
memory limit is never written to the cgroup. Percent-based budgets are then taken
against it, so a cache configured for 70% of available memory got roughly 183KiB
instead of roughly 180MiB.

Nothing downstream would report this. There is no error path - the budget is simply
small and the process runs on with almost no cache, which looks like a performance
problem rather than a misconfiguration.

The existing tests did not catch it because all five only assert the fallback is
greater than zero, which 256 KiB satisfies. The new test pins the value, and adds a
unit-independent guard that 1% of the

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - MySQL: fixed a crash in the watch API. When reading transaction metadata hit an error part-way through iterating the result rows, that error was dropped and the watch was handed an empty result with no error, which then dereferenced a nil value and took the whole process down with it. The error is now returned to the caller. (https://github.com/authzed/spicedb/pull/3358)
 - Postgres: fixed connections being handed to queries already broken, which surfaced as `timeout: read tcp ...: i/o timeout` against a perfectly healthy database, most often under load and shortly after startup. Creating a datastore gave the connection pool the same context it used to bound its own startup checks, and then cancelled it on return - but filling the pool happens on a background goroutine that keeps using that context, so the cancellation landed part-way through opening connections. pgx responds to a cancelled context by setting an immediate deadline on the connection it is working on, and those connections still entered the pool. Pool warm-up now runs on a context of its own, so finishing startup no longer cancels it. The startup checks keep their own 30-second bound. (https://github.com/authzed/spicedb/pull/3333)
 - Datastore: the wait between transaction retries is now capped at 10 seconds. It previously doubled without limit (25ms, 50ms, 100ms, …), which made `--datastore-max-tx-retries` an exponential wall-clock budget rather than a count of attempts: at the default of 10 the waits total about 25 seconds, but at 15 they total 14 minutes and at 20 over seven hours. (https://github.com/authzed/spicedb/pull/3353)
+- Caches: when the amount of available memory could not be determined - for example an AWS ECS task whose memory limit never reaches the cgroup - the fallback used for percent-based budgets was 256KiB rather than the intended 256MiB. A cache configured for 70% of available memory was sized at roughly 183KiB instead of roughly 180MiB. (https://github.com/authzed/spicedb/pull/3329)
 - Shutdown: on SIGINT or SIGTERM, SpiceDB now reports `NOT_SERVING` on its gRPC health service and keeps its listeners open for `--grpc-shutdown-drain-delay` before draining. This gives load balancers and Kubernetes readiness probes time to stop routing to the instance, so new requests do not fail with `Unavailable` (connection refused) in the window between the signal and the endpoint update. (https://github.com/authzed/spicedb/pull/3295, https://github.com/authzed/spicedb/pull/3314)
 
 ## [1.56.2] - 2026-09-11
```

**File**: `pkg/runtime/memory.go` (modified, +2/-2)
```diff
@@ -27,8 +27,8 @@ const (
 
 // fallbackMemoryLimit is the amount of memory allocated for caches etc.
 // when the amount of available memory can't be determined through the usual methods.
-// 256mb is tiny, but it should comfortably fit in most runtimes.
-const fallbackMemoryLimit = 256 * 1024
+// 256MiB is tiny, but it should comfortably fit in most runtimes.
+const fallbackMemoryLimit = 256 * 1024 * 1024
 
 var logAvailableMemoryOnce sync.Once
 
```

**File**: `pkg/runtime/memory_test.go` (modified, +18/-0)
```diff
@@ -69,3 +69,21 @@ func TestAvailableMemory_Applies75PercentRatio(t *testing.T) {
 	expected := uint64(limit) * 75 / 100
 	require.Equal(t, expected, mem, "should apply 75%% ratio to available memory")
 }
+
+// TestFallbackMemoryLimitIsSaneMagnitude pins the fallback's value, not merely
+// that it is positive. The fallback is only reached when available memory cannot
+// be determined at all, so nothing downstream will flag a wrong figure - a
+// percent-based budget simply comes out small and the process runs on with
+// almost no cache. That is precisely how this constant sat at 256 * 1024 (256
+// KiB) while its comment said 256mb: a 1024x shortfall, invisible to every test
+// here because they all only assert the fallback is greater than zero.
+func TestFallbackMemoryLimitIsSaneMagnitude(t *testing.T) {
+	require.Equal(t, uint64(256*1024*1024), uint64(fallbackMemoryLimit),
+		"fallback should be 256 MiB, as its comment states")
+
+	// A second, unit-independent guard: whatever the figure is, it has to be big
+	// enough that a small percentage of it is still a usable cache budget. At 256
+	// KiB, a 1% budget is 2621 bytes.
+	require.Greater(t, uint64(fallbackMemoryLimit)/100, uint64(1024*1024),
+		"1%% of the fallback should still exceed a mebibyte, or percent-based budgets are meaningless")
+}
```

---

### Incident Patch 14: `d9be5237` (2026-09-22)
**Commit Message**: fix(testing): stop the FDW e2e test losing its port before it binds (#3338)

* fix(testing): stop the FDW e2e test losing its port before it binds

The FDW end-to-end test picked a port by opening a throwaway listener,
reading the port back and closing it again, then started the server on
that port from a goroutine. On a busy machine anything can take the port
in between - CI runs six integration packages and a docker daemon side by
side, and an ordinary outgoing connection is enough, because Linux will
hand a just-released ephemeral port to connect(). The server's bind then
fails, the error is discarded, and the test spends ten seconds dialling a
port nothing is listening on before reporting "connection refused".

Bind the socket in the test instead and hand the live listener to the
server, so the port is held from the moment it is chosen and is already
accepting connections when the helper returns. PgBackend gets a Serve
method for that; Run keeps its existing signature and now binds and calls
Serve. Both server goroutines also report what they returned rather than
dropping it, so a startup failure says what went wrong.

Claude-Session: https://claude.ai/code/session_017DF2mdm5e2

**File**: `internal/fdw/pgserver.go` (modified, +21/-1)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"net"
 	"sync"
 
 	wire "github.com/jeroenrinzema/psql-wire"
@@ -37,8 +38,26 @@ func NewPgBackend(client *authzed.Client, username, password string) *PgBackend
 // Run starts the Postgres wire protocol server on the specified endpoint.
 // It blocks until the context is cancelled, an error occurs, or Close is called.
 func (p *PgBackend) Run(ctx context.Context, endpoint string) error {
+	listener, err := net.Listen("tcp", endpoint)
+	if err != nil {
+		return err
+	}
+
+	return p.Serve(ctx, listener)
+}
+
+// Serve starts the Postgres wire protocol server on a listener that the caller
+// has already bound. It takes ownership of the listener and closes it before
+// returning.
+//
+// Binding separately from serving lets a caller hold the port from the moment
+// it picks it. Picking a free port, releasing it and binding it again later
+// leaves a window in which any other process on the machine can take the port,
+// and the bind then fails.
+func (p *PgBackend) Serve(ctx context.Context, listener net.Listener) error {
 	server, err := wire.NewServer(p.handler, wire.SessionMiddleware(sessionMiddleware))
 	if err != nil {
+		_ = listener.Close()
 		return err
 	}
 	server.Auth = wire.ClearTextPassword(p.validateAuth)
@@ -49,6 +68,7 @@ func (p *PgBackend) Run(ctx context.Context, endpoint string) error {
 	p.mu.Lock()
 	if p.closed {
 		p.mu.Unlock()
+		_ = listener.Close()
 		return errors.New("PgBackend already closed")
 	}
 	p.server = server
@@ -59,7 +79,7 @@ func (p *PgBackend) Run(ctx context.Context, endpoint string) error {
 		_ = p.Close()
 	}()
 
-	return server.ListenAndServe(endpoint)
+	return server.Serve(listener)
 }
 
 func (p *PgBackend) validateAuth(ctx context.Context, database, username, password string) (context.Context, bool, error) {
```

**File**: `internal/fdw/pgserver_e2e_test.go` (modified, +49/-17)
```diff
@@ -926,36 +926,58 @@ func runEndToEndTest(t *testing.T, tc e2eTestCase) {
 func runPGServer(t *testing.T, client *authzed.Client) int {
 	pgserver := fdw.NewPgBackend(client, postgresTestUser, fdwPassword)
 
-	port, err := GetFreePort()
+	// Bind the socket here rather than letting the server goroutine pick the
+	// port up later. GetFreePort's ask-the-kernel-then-close dance hands back a
+	// port that nothing is holding any more, and on a busy machine (CI runs six
+	// integration packages and a docker daemon in parallel) anything can take it
+	// in the meantime: a published container port, or simply an outgoing
+	// connection that the kernel gives that local port to. The server's bind
+	// then fails and nothing ever listens.
+	//
+	// Bind on all interfaces so the Postgres container can reach us via
+	// testcontainers' forwarded host (host.testcontainers.internal).
+	// "localhost" binds to 127.0.0.1 only, which the container cannot reach
+	// (its packets arrive from the docker bridge IP).
+	// nolint:gosec // G102: binding all interfaces is required here, see above.
+	listener, err := net.Listen("tcp", "0.0.0.0:0")
 	require.NoError(t, err)
+	port := listener.Addr().(*net.TCPAddr).Port
 
-	ctx := t.Context()
+	serveErr := make(chan error, 1)
+
+	// Registered first, so it runs last: by then Close below has stopped the
+	// server and Serve has returned. Report whatever it returned instead of
+	// letting a server failure surface as an unexplained connection error.
+	t.Cleanup(func() {
+		select {
+		case err := <-serveErr:
+			require.NoError(t, err, "PGServer stopped with an error")
+		case <-time.After(10 * time.Second):
+			require.Fail(t, "PGServer did not stop")
+		}
+	})
 	t.Cleanup(func() {
 		require.NoError(t, pgserver.Close())
 	})
 
+	ctx := t.Context()
 	go func() {
-		// Bind to all interfaces so the Postgres container can reach us via
-		// testcontainers' forwarded host (host.testcontainers.internal).
-		// "localhost" binds to 127.0.0.1 only, which the container cannot reach
-		// (its packets arrive from the docker bridge IP).
-		_ = pgserver.Run(ctx, fmt.Sprintf("0.0.0.0:%d", port))
+		serveErr <- pgserver.Serve(ctx, listener)
 	}()
 
-	// Wait until the server is actually accepting connections.
-	require.EventuallyWithT(t, func(collect *assert.CollectT) {
-		conn, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", port), 100*time.Millisecond)
-		if !assert.NoError(collect, err) {
-			return
-		}
-		_ = conn.Close()
-	}, 10*time.Second, 20*time.Millisecond, "PGServer did not start accepting connections")
-
+	// No readiness wait is needed: net.Listen above already put the socket into
+	// the listening state, so the port accepts connections from this point on,
+	// whenever the goroutine happens to be scheduled.
 	return port
 }
 
 // GetFreePort asks the kernel for a free open port that is ready to use.
 // From: https://gist.github.com/sevkin/96bdae9274465b2d09191384f86ef39d
+//
+// The port is released again before it is returned, so whoever binds it later
+// can lose it to another process. Only use this where the thing being started
+// takes an address rather than a listener; prefer binding a net.Listener up
+// front and handing that over.
 func GetFreePort() (port int, err error) {
 	var a *net.TCPAddr
 	if a, err = net.ResolveTCPAddr("tcp", "localhost:0"); err == nil {
@@ -994,9 +1016,10 @@ func runSpiceDB(t *testing.T) *authzed.Client {
 	require.NoError(t, err)
 
 	serverReady := make(chan bool)
+	runErr := make(chan error, 1)
 	go func() {
 		serverReady <- true
-		_ = runnableServer.Run(ctx)
+		runErr <- runnableServer.Run(ctx)
 	}()
 
 	// Wait for server goroutine to start
@@ -1005,6 +1028,15 @@ func runSpiceDB(t *testing.T) *authzed.Client {
 	// Verify server is ready
 	var client *authzed.Client
 	require.EventuallyWithT(t, func(collect *assert.CollectT) {
+		// Report the server's own error if it gave up, rather than the far less
+		// useful "did not become ready" five seconds later.
+		select {
+		case err := <-runErr:
+			collect.Errorf("SpiceDB server stopped before it became ready: %v", err)
+			return
+		default:
+		}
+
 		var err error
 		client, err = authzed.NewClient(
 			address,
```

---

### Incident Patch 15: `e9d57acc` (2026-09-22)
**Commit Message**: fix(testing): repair two tests in the shared datastore suite (#3334)

TestUniqueID has never run. Every other entry in the suite passes the result of
runner(...) to t.Run; this one wraps it in a closure that calls runner and
throws the returned function away, so t.Run is handed a body that does nothing.
The subtest has been reporting success in every engine's suite without
executing a line of UniqueIDTest. It passes once actually run.

StatsTest never leaves its retry loop. The loop is written to retry until the
statistics tables catch up, but the success path falls through to the bottom
and the loop simply continues, so it always runs its full eleven iterations and
calls Statistics twice per iteration. On CockroachDB each of those runs an
ANALYZE. Breaking on success leaves the retry behaviour intact and does the
work once.

Claude-Session: https://claude.ai/code/session_017DF2mdm5e2RGbjPWtmYetd

**File**: `pkg/datastore/test/datastore.go` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ func newSuiteOptions(opts []SuiteOption) suiteOptions {
 func AllWithExceptions(t *testing.T, tester DatastoreTester, except Categories, opts ...SuiteOption) {
 	runner := newSuiteOptions(opts).runner
 
-	t.Run("TestUniqueID", func(t *testing.T) { runner(tester, UniqueIDTest) })
+	t.Run("TestUniqueID", runner(tester, UniqueIDTest))
 	t.Run("TestUseAfterClose", runner(tester, UseAfterCloseTest))
 
 	// Always serial, whatever the engine chose. This test freezes the container
```

**File**: `pkg/datastore/test/stats.go` (modified, +5/-0)
```diff
@@ -47,5 +47,10 @@ func StatsTest(t *testing.T, tester DatastoreTester) {
 		newStats, err := ds.Statistics(ctx)
 		require.NoError(err)
 		require.Equal(newStats.UniqueID, stats.UniqueID, "unique ID must be stable")
+
+		// The assertions above have passed, so there is nothing left to retry.
+		// Without this the loop runs its full count every time, re-querying
+		// statistics on each pass - which on CockroachDB means an ANALYZE.
+		break
 	}
 }
```

#### Recent Merged Pull Requests:
- **PR #3395** (2026-10-05): perf(datasets): batch wildcard exclusions in subject set subtraction (@dantrapp)
- **PR #3386** (2026-10-01): fix(query): decide the alias self edge by comparison (@jzelinskie)
- **PR #3385** (2026-09-29): test: verify classic and planned permission checks (@josephschorr)
- **PR #3382** (2026-09-29): chore(deps): bump the docker group with 2 updates (@dependabot[bot])
- **PR #3380** (2026-10-02): fix: propagate streaming dispatch cancellation errors (@kbrwn)
- **PR #3375** (2026-09-23): test(consistency): let callers run the consistency fixtures serially (@vroldanbet)
- **PR #3374** (2026-09-22): fix: stop serving a revision that has no validity (@vroldanbet)
- **PR #3372** (2026-09-22): ci: run the tests when the build system changes (@vroldanbet)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
