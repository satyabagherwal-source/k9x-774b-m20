> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/authzed-spicedb-learnings.md`  
> **Source**: github ([https://github.com/authzed/spicedb](https://github.com/authzed/spicedb))  
> **Source Version**: `7e7420c3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T12:14:39.855Z  
> **Learning ID**: `learn-github-authzed-spicedb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): authzed/spicedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/authzed-spicedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/authzed/spicedb](https://github.com/authzed/spicedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T12:14:39.480Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `authzed/spicedb`
- **Description**: Open Source, Google Zanzibar-inspired database for scalably storing and querying fine-grained authorization data
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 7175 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3432** (2026-10-26): **fix(cache): expire dispatch cache entries a fixed TTL after they are written**
  *Symptoms*: ## Description  Fixes #3431.  Partially addresses #3299: cache entries now expire based on write time rather than last access. Reducing the TTL itself is left for a follow-up.  When we switched from Ristretto to Otter, the caches' TTL became a sliding one: every read extended an entry's lifetime by another TTL. A cached dispatch result that kept getting read therefore never expired. On MySQL, the revision only advances on writes, so the cache key never changes either. An expired relationship could keep granting a permission until the next write, even with `fully_consistent`.  This restores the Ristretto behavior: entries expire a fixed TTL after they are written. Caches whose entries can't go stale while their key is unchanged can opt back into the sliding TTL. The namespace cache does, since schema at a revision never changes, and so does the full relation cache's access counter, which relies on it.  ## Testing  - New unit tests cover both expiration modes and check which mode each server cache is built with. - I reproduced the issue's steps against MySQL with a check every 2s. On v1.56.2 the expired relationship kept returning `true` for as long as the checks continued. With this change it returns `false` about two quantization windows after expiry, the same as v1.53.0 (Ristretto). 

- **Issue #3431** (2026-10-26): **MySQL: expired relationship keeps granting permission until the next write, even with fully_consistent**
  *Symptoms*: ### What SpiceDB version are you using?  v1.56.2 (zed v1.2.1, MySQL 8.0.32)  ### What SpiceDB flags do you use?  `--datastore-engine mysql`, everything else default.  ### Steps to Reproduce  ```sh docker network create sdb docker run -d --name mysql --network sdb -e MYSQL_ROOT_PASSWORD=pw -e MYSQL_DATABASE=spicedb mysql:8.0.32 until docker exec mysql mysqladmin ping -ppw --silent; do sleep 1; done; sleep 5 URI='root:pw@tcp(mysql:3306)/spicedb?parseTime=true' docker run --rm --network sdb authzed/spicedb:v1.56.2 migrate head --datastore-engine mysql --datastore-conn-uri "$URI" docker run -d --name spicedb --network sdb authzed/spicedb:v1.56.2 serve --grpc-preshared-key key --datastore-engine mysql --datastore-conn-uri "$URI" sleep 5 zed() { docker run --rm -i --network sdb authzed/zed:v1.2.1 --insecure --token key --endpoint spicedb:50051 "$@"; }  zed schema write <<'EOF' use expiration definition user {} definition doc {   relation viewer: user with expiration   permission view = viewer } EOF zed relationship touch doc:1 viewer user:alice --expiration-time "$(date -u -d '+5 sec' +%FT%TZ)" zed permission check doc:1 view user:alice --consistency-full  # true sleep 10 zed permission check doc:1 view user:alice --consistency-full  # true, although expired zed relationship read doc:1 --consistency-full                 # empty zed relationship touch doc:2 viewer user:bob --expiration-time 2099-01-01T00:00:00Z zed permission check doc:1 view user:alice --consistency-full  # false `

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

### Incident Patch 1: `b2897b2e` (2026-10-26)
**Commit Message**: fix(cache): expire dispatch cache entries a fixed TTL after they are written

Since the move to Otter, caches used a sliding TTL: every read pushed an
entry's expiration out by another TTL, so an entry read more often than the
TTL never expired. Ristretto, the previous default, expired entries a fixed
TTL after they were set.

Dispatch results can go stale without their cache key changing, for example
when a relationship they depend on expires. On MySQL, where the revision only
advances on writes, an expired relationship could therefore keep granting a
permission indefinitely, even with fully_consistent, until the next write.

Caches now expire entries a fixed TTL after they are written. Caches whose
values cannot go stale while their key is unchanged can opt back into the
sliding TTL with RefreshTTLOnAccess; the namespace cache and the full
relation cache's access counter do.

Fixes #3431

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ## [Unreleased]
 ### Fixed
+- Caching: dispatch, cluster dispatch, relationship chunk and full relation cache entries again expire one TTL after they are written, as they did before v1.54.0. Since the move to Otter, every read pushed an entry's expiration out by another TTL, so a result that was read more often than the TTL never expired. On MySQL, where the revision only advances on writes, an expired relationship could then keep granting a permission indefinitely, even with `fully_consistent`, until the next write. The namespace cache, whose entries cannot go stale, still extends its TTL on reads. (https://github.com/authzed/spicedb/issues/3431)
 - Schema validation: schemas that transitively include wildcard subjects are now consistently rejected, even when unrelated definitions reuse the same relation names. (https://github.com/authzed/spicedb/pull/3421)
 - CockroachDB: the GC window is now derived from the zone configuration that applies to SpiceDB's relationship table instead of the cluster-wide `RANGE default`. SpiceDB reads `SHOW ZONE CONFIGURATION FROM TABLE relation_tuple` (or `relation_tuple_with_integrity`), for which CockroachDB resolves table, database and `RANGE default` precedence, and caps `--datastore-gc-window` at that TTL. Previously a database configured with `ALTER DATABASE ... CONFIGURE ZONE USING gc.ttlseconds = 86400` on a cluster with the default 4h `RANGE default` rejected revisions older than 4h as stale, and a database configured below a longer `RANGE default` kept a window wider than the data's real TTL, so reads past it failed with CockroachDB's GC threshold error instead of being rejected as stale. If the table's zone configuration cannot be read, the `RANGE default` value is used as before. A single-digit `gc.ttlseconds` is now also parsed correctly.
 
```

**File**: `internal/datastore/proxy/fullrelationcache/counter.go` (modified, +2/-0)
```diff
@@ -40,6 +40,8 @@ func NewAccessCounter(maxCost int64, window time.Duration) (AccessCounter, error
 	c, err := cache.NewStandardCache[counterKey, *atomic.Uint64](&cache.Config{
 		MaxCost:    maxCost,
 		DefaultTTL: window,
+		// Touch reads the counter, so each Touch restarts the window.
+		RefreshTTLOnAccess: true,
 	})
 	if err != nil {
 		return nil, err
```

**File**: `pkg/cache/cache.go` (modified, +10/-2)
```diff
@@ -40,15 +40,23 @@ type Config struct {
 	MaxCost int64
 
 	// DefaultTTL configures a default deadline on the lifetime of any keys set
-	// to the cache.
+	// to the cache. The deadline is measured from when the key was last set;
+	// reads do not extend it unless RefreshTTLOnAccess is true.
 	DefaultTTL time.Duration
+
+	// RefreshTTLOnAccess, if true, extends a key's deadline by DefaultTTL on
+	// every read as well as on every set, so a key that is read more often than
+	// DefaultTTL never expires. Only enable it for caches whose values cannot
+	// become stale while their key is unchanged.
+	RefreshTTLOnAccess bool
 }
 
 func (c *Config) MarshalZerologObject(e *zerolog.Event) {
 	maxCost := spiceerrors.MustSafecast[uint64](c.MaxCost)
 	e.
 		Str("maxCost", humanize.IBytes(maxCost)).
-		Dur("defaultTTL", c.DefaultTTL)
+		Dur("defaultTTL", c.DefaultTTL).
+		Bool("refreshTTLOnAccess", c.RefreshTTLOnAccess)
 }
 
 // Cache defines an interface for a generic cache. Method semantics follow
```

**File**: `pkg/cache/cache_otter.go` (modified, +5/-1)
```diff
@@ -83,7 +83,11 @@ func newOtterCache[K KeyString, V any](name string, config *Config) (*otterCache
 		StatsRecorder: counter,
 	}
 	if config.DefaultTTL > 0 {
-		opts.ExpiryCalculator = otter.ExpiryAccessing[string, valueAndCost[V]](config.DefaultTTL)
+		if config.RefreshTTLOnAccess {
+			opts.ExpiryCalculator = otter.ExpiryAccessing[string, valueAndCost[V]](config.DefaultTTL)
+		} else {
+			opts.ExpiryCalculator = otter.ExpiryWriting[string, valueAndCost[V]](config.DefaultTTL)
+		}
 	}
 
 	cache, err := otter.New(opts)
```

**File**: `pkg/cache/cache_test.go` (modified, +89/-0)
```diff
@@ -205,3 +205,92 @@ func TestCacheWithMetrics(t *testing.T) {
 		})
 	})
 }
+
+func TestTTLExpiration(t *testing.T) {
+	const ttl = 1 * time.Minute
+
+	newCache := func(t *testing.T, refreshOnAccess bool) Cache[StringKey, string] {
+		c, err := NewOtterCache[StringKey, string]("test-otter", &Config{
+			MaxCost:            1000,
+			DefaultTTL:         ttl,
+			RefreshTTLOnAccess: refreshOnAccess,
+		})
+		//nolint:testifylint  // we're in a goroutine
+		if !assert.NoError(t, err) {
+			t.FailNow()
+		}
+		t.Cleanup(c.Close)
+		return c
+	}
+
+	t.Run("expires after the TTL", func(t *testing.T) {
+		synctest.Test(t, func(t *testing.T) {
+			c := newCache(t, false)
+			assert.True(t, c.Set(StringKey("key"), "value", 10))
+
+			time.Sleep(ttl - time.Second)
+			_, found := c.Get(StringKey("key"))
+			assert.True(t, found, "expected key to be present before the TTL elapsed")
+
+			time.Sleep(2 * time.Second)
+			_, found = c.Get(StringKey("key"))
+			assert.False(t, found, "expected key to have expired after the TTL")
+		})
+	})
+
+	t.Run("reads do not extend the TTL", func(t *testing.T) {
+		synctest.Test(t, func(t *testing.T) {
+			c := newCache(t, false)
+			assert.True(t, c.Set(StringKey("key"), "value", 10))
+
+			// Read the key every 10 seconds, so a sliding TTL would never lapse.
+			// A key read steadily must still expire one TTL after it was set.
+			for elapsed := 10 * time.Second; elapsed < ttl; elapsed += 10 * time.Second {
+				time.Sleep(10 * time.Second)
+				_, found := c.Get(StringKey("key"))
+				assert.True(t, found, "expected key to be present %s after it was set", elapsed)
+			}
+
+			time.Sleep(10 * time.Second)
+			_, found := c.Get(StringKey("key"))
+			assert.False(t, found, "expected key to have expired despite being read")
+		})
+	})
+
+	t.Run("setting a key restarts its TTL", func(t *testing.T) {
+		synctest.Test(t, func(t *testing.T) {
+			c := newCache(t, false)
+			assert.True(t, c.Set(StringKey("key"), "first", 10))
+
+			time.Sleep(ttl / 2)
+			assert.True(t, c.Set(StringKey("key"), "second", 10))
+
+			time.Sleep(ttl/2 + time.Second)
+			value, found := c.Get(StringKey("key"))
+			assert.True(t, found, "expected key to be present one TTL after its first set")
+			assert.Equal(t, "second", value)
+
+			time.Sleep(ttl / 2)
+			_, found = c.Get(StringKey("key"))
+			assert.False(t, found, "expected key to have expired one TTL after its last set")
+		})
+	})
+
+	t.Run("RefreshTTLOnAccess extends the TTL on reads", func(t *testing.T) {
+		synctest.Test(t, func(t *testing.T) {
+			c := newCache(t, true)
+			assert.True(t, c.Set(StringKey("key"), "value", 10))
+
+			for range 5 {
+				time.Sleep(ttl / 2)
+				_, found := c.Get(StringKey("key"))
+				assert.True(t, found, "expected a read to keep the key alive")
+			}
+
+			// Once the reads stop, the key expires one TTL after the last one.
+			time.Sleep(ttl + time.Second)
+			_, found := c.Get(StringKey("key"))
+			assert.False(t, found, "expected key to have expired once reads stopped")
+		})
+	})
+}
```

**File**: `pkg/cache/memory_limiter_integration_test.go` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ func TestCacheFillingDoesNotTripMemoryLimiter(t *testing.T) {
 			// live heap (dominated by the dispatch caches) is what the memory limiter sees.
 			"GOGC": envOr("SPICEDB_GOGC", "25"),
 			// A long quantization window with staleness gives dispatch cache
-			// entries a sliding TTL of roughly 2 x (5m x 1.1) = 11m, so nothing
+			// entries a TTL of roughly 2 x (5m x 1.1) = 11m, so nothing
 			// expires during the run and the caches reach their budgets.
 			"SPICEDB_DATASTORE_REVISION_QUANTIZATION_INTERVAL":              "5m",
 			"SPICEDB_DATASTORE_REVISION_QUANTIZATION_MAX_STALENESS_PERCENT": "10",
```

**File**: `pkg/cmd/server/cacheconfig.go` (modified, +16/-4)
```diff
@@ -37,6 +37,8 @@ type CacheConfig struct {
 	Metrics     bool          `debugmap:"visible"`
 	Enabled     bool          `debugmap:"visible"`
 	defaultTTL  time.Duration `debugmap:"visible"`
+	// refreshTTLOnAccess makes reads extend an entry's TTL; see cache.Config.
+	refreshTTLOnAccess bool `debugmap:"visible"`
 }
 
 // WithRevisionParameters configures a cache such that all entries are given a TTL
@@ -55,6 +57,14 @@ func (cc *CacheConfig) WithRevisionParameters(
 	return cc
 }
 
+// WithTTLRefreshedOnAccess configures a cache such that reading an entry extends
+// its TTL. Only use it for caches whose values cannot become stale while their
+// key is unchanged, such as schema keyed by revision.
+func (cc *CacheConfig) WithTTLRefreshedOnAccess() *CacheConfig {
+	cc.refreshTTLOnAccess = true
+	return cc
+}
+
 // CompleteCache translates the CLI cache config into a cache. If metrics are
 // enabled for the cache, its metrics are registered with the given registerer.
 func CompleteCache[K cache.KeyString, V any](registerer prometheus.Registerer, cc *CacheConfig) (cache.Cache[K, V], error) {
@@ -69,14 +79,16 @@ func CompleteCache[K cache.KeyString, V any](registerer prometheus.Registerer, c
 
 	if cc.Metrics {
 		return cache.NewStandardCacheWithMetrics[K, V](registerer, cc.Name, &cache.Config{
-			MaxCost:    intMaxCost,
-			DefaultTTL: cc.defaultTTL,
+			MaxCost:            intMaxCost,
+			DefaultTTL:         cc.defaultTTL,
+			RefreshTTLOnAccess: cc.refreshTTLOnAccess,
 		})
 	}
 
 	return cache.NewStandardCache[K, V](&cache.Config{
-		MaxCost:    intMaxCost,
-		DefaultTTL: cc.defaultTTL,
+		MaxCost:            intMaxCost,
+		DefaultTTL:         cc.defaultTTL,
+		RefreshTTLOnAccess: cc.refreshTTLOnAccess,
 	})
 }
 
```

**File**: `pkg/cmd/server/cacheconfig_test.go` (modified, +53/-0)
```diff
@@ -2,11 +2,15 @@ package server
 
 import (
 	"testing"
+	"testing/synctest"
 	"time"
 
+	"github.com/prometheus/client_golang/prometheus"
+	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 
 	"github.com/authzed/spicedb/internal/datastore/dsfortesting"
+	"github.com/authzed/spicedb/pkg/cache"
 	"github.com/authzed/spicedb/pkg/cmd/util"
 )
 
@@ -176,6 +180,55 @@ func TestRevisionKeyedCachesExpire(t *testing.T) {
 		require.Positive(t, cacheConfig.defaultTTL,
 			"the %s cache is keyed by revision and must be given a TTL", name)
 	}
+
+	// Schema at a revision never changes, so namespace cache reads may extend
+	// the TTL. A dispatch result can go stale without its key changing (for
+	// example, when a relationship it depends on expires), so reads of the
+	// dispatch caches must not keep an entry alive past its TTL.
+	require.True(t, c.NamespaceCacheConfig.refreshTTLOnAccess,
+		"the namespace cache should extend its TTL on access")
+	require.False(t, c.DispatchCacheConfig.refreshTTLOnAccess,
+		"the dispatch cache must not extend its TTL on access")
+	require.False(t, c.ClusterDispatchCacheConfig.refreshTTLOnAccess,
+		"the cluster dispatch cache must not extend its TTL on access")
+}
+
+func TestCompleteCacheTTLOnAccess(t *testing.T) {
+	const ttl = 1 * time.Minute
+
+	for _, tc := range []struct {
+		name            string
+		refreshOnAccess bool
+		expectFound     bool
+	}{
+		{"fixed TTL expires despite reads", false, false},
+		{"TTL refreshed on access survives reads", true, true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			synctest.Test(t, func(t *testing.T) {
+				cc := &CacheConfig{Name: "test", Enabled: true, MaxCost: "1MiB", defaultTTL: ttl}
+				if tc.refreshOnAccess {
+					cc = cc.WithTTLRefreshedOnAccess()
+				}
+
+				c, err := CompleteCache[cache.StringKey, string](prometheus.NewRegistry(), cc)
+				//nolint:testifylint  // we're in a goroutine
+				if !assert.NoError(t, err) {
+					return
+				}
+				defer c.Close()
+
+				assert.True(t, c.Set(cache.StringKey("key"), "value", 10))
+				for range 4 {
+					time.Sleep(ttl / 2)
+					_, _ = c.Get(cache.StringKey("key"))
+				}
+
+				_, found := c.Get(cache.StringKey("key"))
+				assert.Equal(t, tc.expectFound, found)
+			})
+		})
+	}
 }
 
 func TestCacheRetainsEntries(t *testing.T) {
```

---

### Incident Patch 2: `7e7420c3` (2026-10-27)
**Commit Message**: fix(tls): reload certificate authorities when they rotate on disk (#3296)

Signed-off-by: Oleksii Udovychenko <[REDACTED_EMAIL]>
Co-authored-by: Oleksii Udovychenko <[REDACTED_EMAIL]>
Co-authored-by: Tanner Stirrat <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ## [Unreleased]
 ### Fixed
+- Dispatch and telemetry: CA bundles read from disk via `--dispatch-upstream-ca-path` and the telemetry client's CA path are now re-read on every outbound TLS handshake, so a rotated certificate authority is picked up without a process restart. Previously the CA pool was set once at startup and stayed fixed for the life of the process, causing handshakes to fail with "certificate signed by unknown authority" after the old CA was retired. (https://github.com/authzed/spicedb/pull/3296)
 - Caching: dispatch, cluster dispatch, relationship chunk and full relation cache entries again expire one TTL after they are written, as they did before v1.54.0. Since the move to Otter, every read pushed an entry's expiration out by another TTL, so a result that was read more often than the TTL never expired. On MySQL, where the revision only advances on writes, an expired relationship could then keep granting a permission indefinitely, even with `fully_consistent`, until the next write. The namespace cache, whose entries cannot go stale, still extends its TTL on reads. (https://github.com/authzed/spicedb/issues/3431)
 - Schema validation: schemas that transitively include wildcard subjects are now consistently rejected, even when unrelated definitions reuse the same relation names. (https://github.com/authzed/spicedb/pull/3421)
 - CockroachDB: the GC window is now derived from the zone configuration that applies to SpiceDB's relationship table instead of the cluster-wide `RANGE default`. SpiceDB reads `SHOW ZONE CONFIGURATION FROM TABLE relation_tuple` (or `relation_tuple_with_integrity`), for which CockroachDB resolves table, database and `RANGE default` precedence, and caps `--datastore-gc-window` at that TTL. Previously a database configured with `ALTER DATABASE ... CONFIGURE ZONE USING gc.ttlseconds = 86400` on a cluster with the default 4h `RANGE default` rejected revisions older than 4h as stale, and a database configured below a longer `RANGE default` kept a window wider than the data's real TTL, so reads past it failed with CockroachDB's GC threshold error instead of being rejected as stale. If the table's zone configuration cannot be read, the `RANGE default` value is used as before. A single-digit `gc.ttlseconds` is now also parsed correctly.
```

**File**: `internal/dispatch/combined/ca_rotation_integration_test.go` (added, +241/-0)
```diff
@@ -0,0 +1,241 @@
+//go:build image
+
+package combined_test
+
+import (
+	"bytes"
+	"context"
+	"crypto/ecdsa"
+	"crypto/elliptic"
+	"crypto/rand"
+	"crypto/x509"
+	"crypto/x509/pkix"
+	"encoding/pem"
+	"fmt"
+	"math/big"
+	"os"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"github.com/testcontainers/testcontainers-go"
+	"github.com/testcontainers/testcontainers-go/network"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/credentials/insecure"
+
+	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
+	"github.com/authzed/authzed-go/v1"
+	"github.com/authzed/grpcutil"
+
+	"github.com/authzed/spicedb/pkg/testutil/sdbtestcontainer"
+)
+
+const (
+	// sdbNetworkAlias is the name the node dispatches to, so it is also the name
+	// the serving certificate has to be issued for.
+	sdbNetworkAlias = "sdb"
+
+	caPath          = "/certs/ca.crt"
+	servingCertPath = "/certs/tls.crt"
+	servingKeyPath  = "/certs/tls.key"
+
+	rotationSchema = `definition user {}
+
+definition group {
+	relation member: user
+}
+
+definition document {
+	relation viewer: group#member
+	permission view = viewer
+}`
+)
+
+// TestDispatchFollowsCARotation rotates the certificate authority a running
+// node uses to verify its dispatch peers, and asserts dispatch recovers without
+// a restart.
+//
+// The node dispatches to itself over the cluster gRPC port, so one container
+// covers both sides of the handshake: the serving certificate comes from
+// --dispatch-cluster-tls-cert-path and the trust bundle from
+// --dispatch-upstream-ca-path, exactly as an operator mounts them from one
+// secret.
+func TestDispatchFollowsCARotation(t *testing.T) {
+	image := envOr("SPICEDB_IMAGE", "authzed/spicedb:ci")
+
+	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Minute)
+	defer cancel()
+
+	net, err := network.New(ctx)
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = net.Remove(t.Context()) })
+
+	authority := newTestAuthority(t, "old")
+	certPEM, keyPEM := authority.issueServingCert(t, sdbNetworkAlias)
+
+	spicedb, err := sdbtestcontainer.Run(ctx, image,
+		sdbtestcontainer.WithBootstrapSchema(rotationSchema),
+		sdbtestcontainer.WithBootstrapRelationships(
+			"group:everyone#member@user:alice",
+			"document:firstdoc#viewer@group:everyone#member",
+		),
+		network.WithNetwork([]string{sdbNetworkAlias}, net),
+		testcontainers.WithFiles(
+			testcontainers.ContainerFile{Reader: bytes.NewReader(authority.bundlePEM(t)), ContainerFilePath: caPath, FileMode: 0o644},
+			testcontainers.ContainerFile{Reader: bytes.NewReader(certPEM), ContainerFilePath: servingCertPath, FileMode: 0o644},
+			testcontainers.ContainerFile{Reader: bytes.NewReader(keyPEM), ContainerFilePath: servingKeyPath, FileMode: 0o644},
+		),
+		testcontainers.WithEnv(map[string]string{
+			// Dispatch to ourselves over TLS on the cluster port, so every
+			// subproblem crosses a real handshake against the trust bundle.
+			"SPICEDB_DISPATCH_CLUSTER_ENABLED":       "true",
+			"SPICEDB_DISPATCH_CLUSTER_TLS_CERT_PATH": servingCertPath,
+			"SPICEDB_DISPATCH_CLUSTER_TLS_KEY_PATH":  servingKeyPath,
+			"SPICEDB_DISPATCH_UPSTREAM_ADDR":         sdbNetworkAlias + ":50053",
+			"SPICEDB_DISPATCH_UPSTREAM_CA_PATH":      caPath,
+			// Rotation only takes effect on a new connection, and the dispatch
+			// client holds one open. A short max age has the server retire it
+			// promptly, which is what an operator gets from the 30s default.
+			"SPICEDB_DISPATCH_CLUSTER_MAX_CONN_AGE": "5s",
+			// Without this a repeated check is answered from cache and never
+			// dispatches, so the probe below would stop observing the handshake.
+			"SPICEDB_DISPATCH_CACHE_ENABLED":         "false",
+			"SPICEDB_DISPATCH_CLUSTER_CACHE_ENABLED": "false",
+		}),
+	)
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = spicedb.Terminate(t.Context()) })
+
+	client, err := authzed.NewClient(spicedb.GRPCEndpoint(),
+		grpcutil.WithInsecureBearerToken(spicedb.PresharedKey()),
+		grpc.WithTransportCredentials(insecure.NewCredentials()),
+	)
+	require.NoError(t, err)
+
+	// The dispatch client waits for its connection to be ready, so a check made
+	// while the handshake is failing blocks until its own deadline. The timeout
+	// therefore sets how long each probe below takes to report a broken cluster.
+	check := func(timeout time.Duration) error {
+		checkCtx, cancelCheck := context.WithTimeout(ctx, timeout)
+		defer cancelCheck()
+
+		resp, err := client.CheckPermission(checkCtx, &v1.CheckPermissionRequest{
+			Consistency: &v1.Consistency{
+				Requirement: &v1.Consistency_FullyConsistent{FullyConsistent: true},
+			},
+			Resource:   &v1.ObjectReference{ObjectType: "document", ObjectId: "firstdoc"},
+			Permission: "view",
+			Subject:    &v1.SubjectReference{Object: &v1.ObjectReference{ObjectType: "user", ObjectId: "alice"}},
+		})
+		if err != nil {
+			return err
+		}
+		if resp.Permissionship != v1.CheckPermissionResponse_PERMISSIONSHIP_HAS
```

**File**: `internal/dispatch/combined/combined.go` (modified, +7/-2)
```diff
@@ -1,6 +1,7 @@
 package combined
 
 import (
+	"crypto/tls"
 	"fmt"
 	"time"
 
@@ -20,6 +21,7 @@ import (
 	caveattypes "github.com/authzed/spicedb/pkg/caveats/types"
 	v1 "github.com/authzed/spicedb/pkg/proto/dispatch/v1"
 	"github.com/authzed/spicedb/pkg/query"
+	"github.com/authzed/spicedb/pkg/x509util"
 )
 
 // Option is a function-style option for configuring a combined Dispatcher.
@@ -249,11 +251,14 @@ func NewDispatcher(options ...Option) (dispatch.Dispatcher, error) {
 	} else {
 		// If an upstream is specified, create a cluster dispatcher.
 		if opts.upstreamCAPath != "" {
-			customCertOpt, err := grpcutil.WithCustomCerts(grpcutil.VerifyCA, opts.upstreamCAPath)
+			// Read at handshake time so that rotating the CA on disk does not
+			// require restarting every node in the dispatch cluster.
+			caPool, err := x509util.NewCAPool(opts.upstreamCAPath)
 			if err != nil {
 				return nil, err
 			}
-			opts.grpcDialOpts = append(opts.grpcDialOpts, customCertOpt)
+			creds := x509util.NewReloadingTLSCreds(caPool, &tls.Config{MinVersion: tls.VersionTLS12})
+			opts.grpcDialOpts = append(opts.grpcDialOpts, grpc.WithTransportCredentials(creds))
 			opts.grpcDialOpts = append(opts.grpcDialOpts, grpcutil.WithBearerToken(opts.grpcPresharedKey))
 		} else {
 			opts.grpcDialOpts = append(opts.grpcDialOpts, grpcutil.WithInsecureBearerToken(opts.grpcPresharedKey))
```

**File**: `internal/dispatch/combined/combined_test.go` (modified, +1/-1)
```diff
@@ -162,7 +162,7 @@ func TestNewDispatcher_WithUpstream(t *testing.T) {
 }
 
 // TestNewDispatcher_UpstreamCAPathMissing exercises the TLS branch by pointing
-// UpstreamCAPath at a non-existent file; grpcutil.WithCustomCerts will error.
+// UpstreamCAPath at a non-existent file, which fails when the CA is read.
 func TestNewDispatcher_UpstreamCAPathMissing(t *testing.T) {
 	_, err := NewDispatcher(
 		UpstreamAddr("localhost:0"),
```

**File**: `internal/telemetry/ca_rotation_test.go` (added, +200/-0)
```diff
@@ -0,0 +1,200 @@
+package telemetry
+
+import (
+	"crypto/ecdsa"
+	"crypto/elliptic"
+	"crypto/rand"
+	"crypto/tls"
+	"crypto/x509"
+	"crypto/x509/pkix"
+	"encoding/pem"
+	"log"
+	"math/big"
+	"net"
+	"net/http"
+	"os"
+	"path/filepath"
+	"strings"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/prometheus/client_golang/prometheus"
+	"github.com/stretchr/testify/require"
+)
+
+// TestRemoteReporterFollowsCARotation asserts that the reporter keeps reaching
+// its endpoint after the CA override is rotated on disk, which it cannot do
+// while the pool is captured in the transport's TLSClientConfig.
+func TestRemoteReporterFollowsCARotation(t *testing.T) {
+	caPath := filepath.Join(t.TempDir(), "ca.crt")
+
+	authority := newTestCA(t, "old")
+	writeCABundle(t, caPath, authority)
+
+	sink := newTLSSink(t, authority.issueServingCert(t))
+
+	registry := prometheus.NewRegistry()
+	gauge := prometheus.NewGauge(prometheus.GaugeOpts{Name: "test_metric", Help: "A test metric"})
+	gauge.Set(42)
+	registry.MustRegister(gauge)
+
+	// The endpoint is on loopback, so sub-minute intervals are allowed and the
+	// reporter pushes without a startup delay.
+	reporter, err := RemoteReporter(registry, sink.url, caPath, time.Second)
+	require.NoError(t, err)
+
+	done := make(chan error, 1)
+	go func() { done <- reporter(t.Context()) }()
+	t.Cleanup(func() { <-done })
+
+	require.Eventually(t, func() bool { return sink.reports() > 0 }, 15*time.Second, 100*time.Millisecond,
+		"the reporter should reach the endpoint with the authority it started with")
+
+	// Serve a certificate from a new authority without publishing it. The
+	// handshake has to start failing here, otherwise the recovery below would
+	// pass whether or not the trust bundle is ever re-read.
+	rotated := newTestCA(t, "new")
+	sink.setCert(rotated.issueServingCert(t))
+
+	require.Eventually(t, func() bool { return strings.Contains(sink.handshakeErrors(), "TLS handshake error") },
+		15*time.Second, 100*time.Millisecond,
+		"the reporter should reject a certificate from an authority that is not in the bundle")
+
+	writeCABundle(t, caPath, rotated)
+	before := sink.reports()
+
+	require.Eventually(t, func() bool { return sink.reports() > before }, 45*time.Second, 100*time.Millisecond,
+		"the reporter should reach the endpoint again once the rotated authority is published")
+}
+
+// tlsSink is an HTTPS endpoint that counts the reports it receives and whose
+// serving certificate can be swapped while it is running. It is also the
+// server's error log, so the test can observe rejected handshakes.
+type tlsSink struct {
+	url string
+
+	mu         sync.Mutex
+	cert       tls.Certificate // GUARDED_BY(mu)
+	received   int             // GUARDED_BY(mu)
+	serverLogs strings.Builder // GUARDED_BY(mu)
+}
+
+func newTLSSink(t *testing.T, cert tls.Certificate) *tlsSink {
+	t.Helper()
+
+	sink := &tlsSink{cert: cert}
+
+	listener, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+
+	server := &http.Server{
+		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
+			sink.mu.Lock()
+			sink.received++
+			sink.mu.Unlock()
+			w.WriteHeader(http.StatusOK)
+		}),
+		TLSConfig:         &tls.Config{GetCertificate: sink.getCertificate, MinVersion: tls.VersionTLS12},
+		ErrorLog:          log.New(sink, "", 0),
+		ReadHeaderTimeout: 5 * time.Second,
+	}
+	// Without this the reporter reuses a pooled connection and never re-dials,
+	// so a rotated certificate would not be presented to it.
+	server.SetKeepAlivesEnabled(false)
+
+	go func() { _ = server.ServeTLS(listener, "", "") }()
+	t.Cleanup(func() { _ = server.Close() })
+
+	sink.url = "https://" + listener.Addr().String()
+	return sink
+}
+
+func (s *tlsSink) getCertificate(*tls.ClientHelloInfo) (*tls.Certificate, error) {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	return &s.cert, nil
+}
+
+func (s *tlsSink) setCert(cert tls.Certificate) {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	s.cert = cert
+}
+
+func (s *tlsSink) reports() int {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	return s.received
+}
+
+func (s *tlsSink) handshakeErrors() string {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	return s.serverLogs.String()
+}
+
+func (s *tlsSink) Write(p []byte) (int, error) {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	return s.serverLogs.Write(p)
+}
+
+// testCA is a generated certificate authority that can sign serving certificates.
+type testCA struct {
+	cert *x509.Certificate
+	key  *ecdsa.PrivateKey
+}
+
+func newTestCA(t *testing.T, org string) *testCA {
+	t.Helper()
+
+	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
+	require.NoError(t, err)
+
+	template := &x509.Certificate{
+		SerialNumber:          big.NewInt(time.Now().UnixNano()),
+		Subject:               pkix.Name{Organization: []string{org}},
+		NotBefore:             time.Now().Add(-time.Minute),
+		NotAfter:              time.Now().Add(time.Hour),
+		IsCA:                  true,
+		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigit
```

**File**: `internal/telemetry/reporter.go` (modified, +3/-8)
```diff
@@ -143,19 +143,14 @@ func RemoteReporter(
 
 	client := &http.Client{}
 	if caOverridePath != "" {
-		pool, err := x509util.CustomCertPool(caOverridePath)
+		caPool, err := x509util.NewCAPool(caOverridePath)
 		if err != nil {
 			return nil, fmt.Errorf("invalid custom cert pool path `%s`: %w", caOverridePath, err)
 		}
 
-		t := &http.Transport{
-			TLSClientConfig: &tls.Config{
-				RootCAs:    pool,
-				MinVersion: tls.VersionTLS12,
-			},
+		client.Transport = &http.Transport{
+			DialTLSContext: caPool.DialTLSContext(&tls.Config{MinVersion: tls.VersionTLS12}),
 		}
-
-		client.Transport = t
 	}
 
 	return func(ctx context.Context) error {
```

**File**: `pkg/cmd/util/util.go` (modified, +9/-5)
```diff
@@ -161,15 +161,19 @@ func (c *GRPCServerConfig) clientCreds() (credentials.TransportCredentials, erro
 	case c.TLSCertPath == "" && c.TLSKeyPath == "":
 		return insecure.NewCredentials(), nil
 	case c.TLSCertPath != "" && c.TLSKeyPath != "":
-		var err error
 		var pool *x509.CertPool
 		if c.ClientCAPath != "" {
-			pool, err = x509util.CustomCertPool(c.ClientCAPath)
+			caPool, err := x509util.NewCAPool(c.ClientCAPath)
+			if err != nil {
+				return nil, err
+			}
+			pool = caPool.CertPool()
 		} else {
+			var err error
 			pool, err = x509.SystemCertPool()
-		}
-		if err != nil {
-			return nil, err
+			if err != nil {
+				return nil, err
+			}
 		}
 
 		return credentials.NewTLS(&tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}), nil
```

**File**: `pkg/x509util/capool.go` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+package x509util
+
+import (
+	"bytes"
+	"context"
+	"crypto/tls"
+	"crypto/x509"
+	"net"
+	"slices"
+	"sync"
+	"time"
+
+	"google.golang.org/grpc/credentials"
+
+	log "github.com/authzed/spicedb/internal/logging"
+)
+
+const defaultCAReloadInterval = 10 * time.Second
+
+// CAPool holds the certificate authorities read from a path and re-reads them
+// when the contents of that path change. Unlike CertWatcher it runs no
+// background goroutine: the path is re-read on demand, at most once per
+// interval.
+type CAPool struct {
+	path     string
+	interval time.Duration
+
+	mu       sync.Mutex
+	pool     *x509.CertPool // GUARDED_BY(mu)
+	contents [][]byte       // GUARDED_BY(mu)
+	lastRead time.Time      // GUARDED_BY(mu)
+}
+
+// NewCAPool returns a new CAPool for the certificate authorities at caPath,
+// which may be a single PEM file or a directory of them. The path is read
+// eagerly, so a missing or malformed bundle is reported here rather than at the
+// first handshake.
+func NewCAPool(caPath string) (*CAPool, error) {
+	contents, err := readCertFiles(caPath)
+	if err != nil {
+		return nil, err
+	}
+
+	pool, err := certPoolFromPEM(contents)
+	if err != nil {
+		return nil, err
+	}
+
+	return &CAPool{
+		path:     caPath,
+		interval: defaultCAReloadInterval,
+		pool:     pool,
+		contents: contents,
+		lastRead: time.Now(),
+	}, nil
+}
+
+// WithReloadInterval sets the minimum time between reads of the path and
+// returns the CAPool pointer
+func (p *CAPool) WithReloadInterval(interval time.Duration) *CAPool {
+	p.mu.Lock()
+	defer p.mu.Unlock()
+	p.interval = interval
+	return p
+}
+
+// CertPool returns the current authorities, re-reading the path if the reload
+// interval has elapsed. A failed re-read keeps the previously loaded
+// authorities, so a bundle that is briefly absent or truncated partway through
+// a rotation does not empty the trust store.
+func (p *CAPool) CertPool() *x509.CertPool {
+	p.mu.Lock()
+	defer p.mu.Unlock()
+
+	now := time.Now()
+	if now.Sub(p.lastRead) < p.interval {
+		return p.pool
+	}
+	p.lastRead = now
+
+	contents, err := readCertFiles(p.path)
+	if err != nil {
+		log.Warn().Err(err).Str("path", p.path).Msg("failed to re-read certificate authorities")
+		return p.pool
+	}
+
+	if slices.EqualFunc(p.contents, contents, bytes.Equal) {
+		return p.pool
+	}
+
+	pool, err := certPoolFromPEM(contents)
+	if err != nil {
+		log.Warn().Err(err).Str("path", p.path).Msg("failed to parse re-read certificate authorities")
+		return p.pool
+	}
+
+	log.Info().Str("path", p.path).Msg("reloaded certificate authorities")
+	p.pool = pool
+	p.contents = contents
+	return p.pool
+}
+
+// DialTLSContext returns a dial function that verifies the server against the
+// current authorities. It satisfies http.Transport.DialTLSContext, which is
+// called per connection, unlike TLSClientConfig.
+func (p *CAPool) DialTLSContext(base *tls.Config) func(ctx context.Context, network, addr string) (net.Conn, error) {
+	return func(ctx context.Context, network, addr string) (net.Conn, error) {
+		cfg := base.Clone()
+		cfg.RootCAs = p.CertPool()
+		return (&tls.Dialer{Config: cfg}).DialContext(ctx, network, addr)
+	}
+}
+
+// reloadingCreds resolves its trust store from a CAPool on every handshake and
+// delegates the handshake itself to the standard TLS credentials.
+type reloadingCreds struct {
+	ca   *CAPool
+	base *tls.Config
+}
+
+var _ credentials.TransportCredentials = (*reloadingCreds)(nil)
+
+// NewReloadingTLSCreds returns credentials that verify peers against the
+// authorities in ca, picking up a rotation of those authorities without a
+// restart. base supplies the rest of the TLS configuration; its RootCAs and
+// ClientCAs are ignored.
+func NewReloadingTLSCreds(ca *CAPool, base *tls.Config) credentials.TransportCredentials {
+	return &reloadingCreds{ca: ca, base: base.Clone()}
+}
+
+func (c *reloadingCreds) clientConfig() *tls.Config {
+	cfg := c.base.Clone()
+	cfg.RootCAs = c.ca.CertPool()
+	return cfg
+}
+
+func (c *reloadingCreds) serverConfig() *tls.Config {
+	cfg := c.base.Clone()
+	cfg.ClientCAs = c.ca.CertPool()
+	return cfg
+}
+
+func (c *reloadingCreds) ClientHandshake(ctx context.Context, authority string, rawConn net.Conn) (net.Conn, credentials.AuthInfo, error) {
+	return credentials.NewTLS(c.clientConfig()).ClientHandshake(ctx, authority, rawConn)
+}
+
+func (c *reloadingCreds) ServerHandshake(rawConn net.Conn) (net.Conn, credentials.AuthInfo, error) {
+	return credentials.NewTLS(c.serverConfig()).ServerHandshake(rawConn)
+}
+
+func (c *reloadingCreds) Info() credentials.ProtocolInfo {
+	return credentials.NewTLS(c.base).Info()
+}
+
+// Clone returns credentials backed by the same CAPool, so that both share one
+// view of the trust store.
+func (c *reloadingCreds) Clone() credentials.TransportCredentials {
+	return &reloadingCreds{ca: c.ca, base: c.base.Clone()}
+}
+
+func (c *reloadingCreds) OverrideServerName(name string) error {
+	c.base.S
```

#### Recent Merged Pull Requests:
- **PR #3432** (2026-10-26): fix(cache): expire dispatch cache entries a fixed TTL after they are written (@josephschorr)
- **PR #3424** (2026-10-21): chore: bump grpc_health_probe to v0.4.60 and the base images for CVE-2026-111943 (@vroldanbet)
- **PR #3423** (2026-10-21): fix(crdb): derive the gc window from the zone config of SpiceDB's relationships (@vroldanbet)
- **PR #3422** (2026-10-20): chore: roll changelog (@tstirrat15)
- **PR #3421** (2026-10-22): fix(schema): qualify wildcard cache keys by definition (@josephschorr)
- **PR #3415** (2026-10-20): fix: return a clear error when filtering relationships on a permission (@josephschorr)

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

## X. cache): expire dispatch cache entries a fixed TTL after they are written

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in authzed/spicedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b2897b2e`: cache): expire dispatch cache entries a fixed TTL after they are written. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- Caching: dispatch, cluster dispatch, relationship chunk and full relation cache entries again expire one TTL after they are written, as they did before v1.54.0. Since the move to Otter, every read pushed an entry's expiration out by another TTL, so a result that was read more often than the TTL never expired. On MySQL, where the revision only advances on writes, an expired relationship could then keep granting a permission indefinitely, even with `fully_consistent`, until the next write. The namespace cache, whose entries cannot go stale, still extends its TTL on reads. (https://github.com/authzed/spicedb/issues/3431)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b2897b2e` are properly handled with clean fallback behavior.
