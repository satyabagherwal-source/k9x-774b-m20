> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/authzed-spicedb-learnings.md`  
> **Source**: github ([https://github.com/authzed/spicedb](https://github.com/authzed/spicedb))  
> **Source Version**: `602ce24e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T05:07:40.324Z  
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
> **Harvest Timestamp**: 2026-11-13T05:07:40.319Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `authzed/spicedb`
- **Description**: Open Source, Google Zanzibar-inspired database for scalably storing and querying fine-grained authorization data
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 7215 stars

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

### Core Architecture Module: `internal/checkbaseline/engine.go`
```
package checkbaseline

import (
	"context"
	"fmt"
	"runtime"
	"slices"
	"time"

	"github.com/authzed/spicedb/internal/caveats"
	"github.com/authzed/spicedb/internal/dispatch"
	dispatchgraph "github.com/authzed/spicedb/internal/dispatch/graph"
	"github.com/authzed/spicedb/internal/graph/computed"
	"github.com/authzed/spicedb/pkg/cache"
	caveattypes "github.com/authzed/spicedb/pkg/caveats/types"
	"github.com/authzed/spicedb/pkg/datalayer"
	"github.com/authzed/spicedb/pkg/datastore"
	v1 "github.com/authzed/spicedb/pkg/proto/dispatch/v1"
	"github.com/authzed/spicedb/pkg/query"
	"github.com/authzed/spicedb/pkg/schema/v2"
	"github.com/authzed/spicedb/pkg/tuple"
)

type Engine interface {
	Name() string
	Preparation() Sample
	Check(context.Context, Case) (Decision, error)
	Close() error
}

var (
	_ Engine = (*classicEngine)(nil)
	_ Engine = (*plannerEngine)(nil)
)

type classicEngine struct {
	prepared   Sample
	dl         datalayer.DataLayer
	revision   datastore.RevisionWithSchemaHash
	dispatcher dispatch.Dispatcher
	policy     Policy
}

func (e *classicEngine) Preparation() Sample { return e.prepared }
func (*classicEngine) Name() string          { return "classic" }
func (e *classicEngine) Close() error        { return e.dispatcher.Close() }
func (e *classicEngine) Check(ctx context.Context, c Case) (Decision, error) {
	q := c.Query
	result, _, err := computed.ComputeCheck(datalayer.ContextWithDataLayer(ctx, e.dl), e.dispatcher, caveattypes.Default.TypeSet, computed.CheckParameters{
		ResourceType: tuple.RelationReference{ObjectType: q.ResourceType, Relation: q.Permission}, Subject: tuple.ObjectAndRelation{ObjectType: q.SubjectType, ObjectID: q.SubjectID, Relation: q.SubjectRelation}, CaveatContext: c.Context, AtRevision: e.revision.Revision, MaximumDepth: c.ClassicDepth, SchemaHash: datalayer.SchemaHash(e.revision.SchemaHash), DebugOption: computed.NoDebugging,
	}, q.ResourceID, e.policy.ClassicChunkSize)
	if err != nil {
		return Decision{Outcome: Error, ErrorClass: err.Error()}, err
	}
	d := Decision{Outcome: Deny}
	switch result.Membership {
	case v1.ResourceCheckResult_MEMBER:
		d.Outcome = Allow
	case v1.ResourceCheckResult_CAVEATED_MEMBER:
		d.Outcome = Conditional
		d.MissingContext = slices.Sorted(slices.Values(result.MissingExprFields))
	}
	return d, nil
}

type plannerEngine struct {
	prepared Sample
	dl       datalayer.DataLayer
	revision datastore.RevisionWithSchemaHash
	plans    map[string]query.Iterator
}

func (e *plannerEngine) Preparation() Sample { return e.prepared }
func (*plannerEngine) Name() string          { return "qp" }
func (*plannerEngine) Close() error          { return nil }
func (e *plannerEngine) Check(ctx context.Context, c Case) (Decision, error) {
	q := c.Query
	reader := e.dl.SnapshotReader(e.revision.Revision, datalayer.SchemaHash(e.revision.SchemaHash))
	runner := caveats.NewCaveatRunner(caveattypes.Default.TypeSet)
	qctx := query.NewLocalContext(ctx, query.WithRevisionedReader(reader), query.WithCaveatRunner(runner), query.WithCaveatContext(c.Context), query.WithMaxRecursionDepth(c.QPDepth), query.WithCheckExecution(query.CheckExecutionOptions{TargetedRecursion: true, BaseFirstExclusion: true, StrictSubjectMatching: true, ExhaustiveIntersectionArrows: true, StopAfterDirectMatch: true, CoalesceDirectWildcards: true, UnfilteredSingleTypeReads: true, BroadSingleUsersetReads: true}))
	it := e.plans[q.ResourceType+"#"+q.Permission]
	path, err := qctx.Check(it, query.NewObject(q.ResourceType, q.ResourceID), query.ObjectAndRelation{ObjectType: q.SubjectType, ObjectID: q.SubjectID, Relation: q.SubjectRelation})
	if err != nil {
		return Decision{Outcome: Error, ErrorClass: err.Error()}, err
	}
	if path == nil {
		return Decision{Outcome: Deny}, nil
	}
	if path.Caveat == nil {
		return Decision{Outcome: Allow}, nil
	}
	sr, err := reader.ReadSchema(ctx)
	if err != nil {
		return Decision{}, err
	}
	res, err := runner.RunCaveatExpression(ctx, path.Caveat, c.Context, sr, caveats.RunCaveatExpressionNoDebugging)
	if err != nil {
		return Decision{}, err
	}
	if res.IsPartial() {
		missing, err := res.MissingVarNames()
		slices.Sort(missing)
		return Decision{Outcome: Conditional, MissingContext: missing}, err
	}
	if res.Value() {
		return Decision{Outcome: Allow}, nil
	}
	return Decision{Outcome: Deny}, nil
}

func PrepareEngines(ctx context.Context, dl datalayer.DataLayer, rev datastore.RevisionWithSchemaHash, s *schema.Schema, cases []Case, p Policy) ([]Engine, error) {
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	start := time.Now()
	params := dispatchgraph.DispatcherParameters{
		ConcurrencyLimits:      dispatchgraph.SharedConcurrencyLimits(p.ClassicConcurrency),
		DispatchChunkSize:      p.ClassicChunkSize,
		TypeSet:                caveattypes.Default.TypeSet,
		RelationshipChunkCache: cache.NoopCache[cache.StringKey, any](),
	}
	d, err := dispatchgraph.NewLocalOnlyDispatcher(params)
	if err != nil {
		return nil, err
	}
	classicNS := time.Since(start).Nanoseconds()
	runtime.ReadMemStats(&after)
	classicPrep := Sample{NSPerOp: float64(classicNS), BytesPerOp: float64(after.TotalAlloc - before.TotalAlloc), AllocsPerOp: float64(after.Mallocs - before.Mallocs), Iterations: 1}
	runtime.ReadMemStats(&before)
	start = time.Now()
	qp := &plannerEngine{dl: dl, revision: rev, plans: map[string]query.Iterator{}}
	for _, c := range cases {
		key := c.Query.ResourceType + "#" + c.Query.Permission
		if _, ok := qp.plans[key]; ok {
			continue
		}
		outline, err := query.BuildOutlineFromSchema(s, c.Query.ResourceType, c.Query.Permission, query.WithSchemaExecutionOrder(), query.WithDeferredCaveats())
		if err != nil {
			_ = d.Close()
			return nil, fmt.Errorf("%s: %w", key, err)
		}
		it, err := outline.Compile()
		if err != nil {
			_ = d.Close()
			return nil, err
		}
		qp.plans[key] = it
	}
	qpNS := time.Since(start).Nanoseconds()
	runtime.ReadMemStats(&after)
	qp.prepared = Sample{NSPerOp: float64(qpNS), BytesPerOp: float64(after.TotalAlloc - before.TotalAlloc), AllocsPerOp: float64(after.Mallocs - before.Mallocs), Iterations: 1}
	return []Engine{&classicEngine{dl: dl, revision: rev, dispatcher: d, policy: p, prepared: classicPrep}, qp}, nil
}

```

### Core Architecture Module: `internal/checkbaseline/report/render.py`
```
#!/usr/bin/env python3
"""Render local checkbaseline JSON as a portable, offline HTML report."""

import argparse
import json
import math
from pathlib import Path


def summarize(values):
    values = sorted(values)
    if not values:
        return None
    if any(not math.isfinite(v) for v in values):
        raise ValueError("non-finite measurement")

    def q(f):
        i = (len(values) - 1) * f
        lo = int(i)
        hi = min(lo + 1, len(values) - 1)
        return values[lo] + (values[hi] - values[lo]) * (i - lo)

    return dict(n=len(values), low=values[0], q1=q(0.25), median=q(0.5), q3=q(0.75), high=values[-1])


def paired_ratio(classic, qp):
    if len(classic) != len(qp):
        raise ValueError("unpaired samples")
    return summarize([b / a for a, b in zip(classic, qp, strict=True) if a > 0])


def safe_json(data):
    return (
        json.dumps(data, separators=(",", ":"), allow_nan=False)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )


def work_totals(work):
    events = work.get("Events") or []
    loads = [e for e in events if e["Operation"] in ("query", "reverse")]
    return dict(
        loads=len(loads),
        rows=sum(e["Rows"] for e in loads),
        payload=sum(e["Bytes"] for e in loads),
        schema=sum(
            e["Operation"] not in ("query", "reverse", "caveat-leaf", "caveat-expression", "schema-load")
            for e in events
        ),
        caveats=sum(e["Operation"] == "caveat-leaf" for e in events),
        batch=max([e["Batch"] for e in loads], default=0),
    )


def compact(artifact):
    if artifact["Version"] != 1:
        raise ValueError("unsupported artifact version")
    rows = []
    for result in artifact["Results"]:
        engines = []
        for e in result["Engines"]:
            samples = e.get("Samples") or []
            work = [work_totals(w) for w in e["Work"]]
            metrics = {
                key: summarize([w[key] for w in work])
                for key in ("loads", "rows", "payload", "schema", "caveats", "batch")
            }
            metrics["schemaLoads"] = (
                summarize([sum(e["Operation"] == "schema-load" for e in w.get("Events") or []) for w in e["Work"]])
                if artifact["Provenance"].get("schema_load_instrumentation")
                else None
            )
            metrics.update(
                time=summarize([s["NSPerOp"] / 1000 for s in samples]),
                allocations=summarize([s["AllocsPerOp"] for s in samples]),
                memory=summarize([s["BytesPerOp"] for s in samples]),
            )
            prep = e.get("Preparation") or {}
            metrics.update(
                prepareTime=summarize([prep.get("NSPerOp", 0) / 1000]),
                prepareMemory=summarize([prep.get("BytesPerOp", 0)]),
            )
            events = (e["Work"][0].get("Events") or []) if e["Work"] else []
            engines.append(
                dict(
                    name=e["Name"],
                    metrics=metrics,
                    decision=e["Decision"],
                    error=e.get("Error"),
                    preparation=e.get("Preparation"),
                    samples=samples,
                    observations=e.get("Observations"),
                    trace=[{k: v for k, v in event.items() if k != "Relationships"} for event in events[:60]],
                    traceCount=len(events),
                    work=work,
                )
            )
        ratio = None
        if result["Valid"] and result["Status"] == "relationship work matched":
            ratio = paired_ratio(
                [s["NSPerOp"] for s in engines[0]["samples"]], [s["NSPerOp"] for s in engines[1]["samples"]]
            )
        rows.append(
            dict(
                dataset=result["Dataset"],
                case=result["Case"],
                profile=result["Profile"],
                valid=result["Valid"],
                status=result["Status"],
                differences=result.get("Differences") or [],
                engines=engines,
                ratio=ratio,
            )
        )
    return dict(
        created=artifact["Created"],
        provenance=artifact["Provenance"],
        policy=artifact["Policy"],
        repetitions=artifact["Repetitions"],
        samples=artifact["Samples"],
        omissions=artifact.get("Omissions") or [],
        rows=rows,
    )


def render(artifact):
    return (
        Path(__file__).with_name("template.html").read_text().replace("__REPORT_DATA__", safe_json(compact(artifact)))
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    with args.input.open() as f:
        artifact = json.load(f)
    args.output.write_text(render(artifact))
    print(f"Wrote {args.output}: {len(artifact['Results'])} comparisons")


if __name__ == "__main__":
    main()

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3486** (2026-11-13): **chore(postgres): drop PostgreSQL 14 from the test matrix**
  *Symptoms*: ## Description  PostgreSQL 14 reached end of life on November 12, 2026. Since then the Postgres 14 jobs fail before any test runs, as CI can no longer pull the image:  ``` create container: Error response from daemon: No such image: mirror.gcr.io/library/postgres:14 ```  ## Changes  - Remove `14` from the Postgres and pgbouncer integration test matrix and from the Postgres consistency test matrix. - Raise `MinimumSupportedPostgresVersion` to `15`. - Add a changelog entry.  ## Notes  If any of the `(postgres, 14)` or `(pgbouncer, 14)` checks are required by branch protection, they will need to be removed there as well, since they will no longer report.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3486?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #3480** (2026-11-10): **chore: roll changelog**
  *Symptoms*: ## Description Rolls the changelog for v1.57.1. This includes a CVE fix. We chose to cut it from a previous commit rather than head; this accounts for the roll still having unreleased entries.  ## Changes * Roll changelog entries * Include changelog entry for CVE ## Testing Review.

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

### Incident Patch 1: `8a14abe3` (2026-11-12)
**Commit Message**: chore: fix flaky tests (#3317)

**File**: `internal/datastore/crdb/pool/balancer.go` (modified, +4/-2)
```diff
@@ -161,6 +161,9 @@ func (p *nodeConnectionBalancer[P, C]) mustPruneConnections(ctx context.Context)
 		}
 	}
 
+	// Snapshot the healthy node count exactly once.
+	// Other goroutines mark nodes unhealthy concurrently, so re-reading it
+	// below could observe zero and divide by zero.
 	// It's highly unlikely that we'll ever have an overflow in
 	// this context, so we cast directly.
 	nodeCount, err := safecast.Convert[uint32](p.healthTracker.HealthyNodeCount())
@@ -218,8 +221,7 @@ func (p *nodeConnectionBalancer[P, C]) mustPruneConnections(ctx context.Context)
 		// If we underestimate, the balancer will fight the pool, and if we overestimate,
 		// it's possible for the difference in connections between nodes to differ by up to
 		// the number of nodes.
-		if p.healthTracker.HealthyNodeCount() == 0 ||
-			i < int(p.pool.MaxConns())%p.healthTracker.HealthyNodeCount() {
+		if genutil.MustEnsureUInt32(i) < p.pool.MaxConns()%nodeCount {
 			perNodeMax++
 		}
 
```

**File**: `internal/datastore/crdb/pool/balancer_test.go` (modified, +40/-0)
```diff
@@ -3,6 +3,7 @@ package pool
 import (
 	"context"
 	"math/rand"
+	"sync"
 	"testing"
 	"time"
 
@@ -171,3 +172,42 @@ func TestNodeConnectionBalancerPrune(t *testing.T) {
 		})
 	}
 }
+
+// TestNodeConnectionBalancerPruneConcurrentHealthChanges verifies that the
+// balancer does not panic when the set of healthy nodes changes while it is
+// pruning.
+// Marking the only healthy node unhealthy between two reads of the healthy
+// node count used to divide by zero.
+func TestNodeConnectionBalancerPruneConcurrentHealthChanges(t *testing.T) {
+	tracker, err := NewNodeHealthChecker("")
+	require.NoError(t, err)
+	tracker.healthyNodes[1] = struct{}{}
+
+	pool := NewFakePool(9)
+	for range 3 {
+		pool.nodeForConn[NewFakeConn()] = 1
+	}
+
+	p := newNodeConnectionBalancer[*FakePoolConn[*FakeConn], *FakeConn](pool, tracker, 1*time.Minute)
+
+	ctx, cancel := context.WithCancel(t.Context())
+	defer cancel()
+
+	var wg sync.WaitGroup
+	wg.Add(1)
+	go func() {
+		defer wg.Done()
+		for ctx.Err() == nil {
+			tracker.SetNodeHealth(1, true)
+			tracker.Lock()
+			delete(tracker.healthyNodes, 1)
+			tracker.Unlock()
+		}
+	}()
+
+	for range 100_000 {
+		p.mustPruneConnections(ctx)
+	}
+	cancel()
+	wg.Wait()
+}
```

#### Recent Merged Pull Requests:
- **PR #3486** (2026-11-13): chore(postgres): drop PostgreSQL 14 from the test matrix (@josephschorr)
- **PR #3480** (2026-11-10): chore: roll changelog (@tstirrat15)
- **PR #3479** (2026-11-10): fix(postgres): stop read-only SpiceDB from writing heartbeat rows (@vroldanbet)
- **PR #3471** (2026-11-09): chore: use synctest for hedging tests (@tstirrat15)
- **PR #3469** (2026-11-10): chore: get rid of gofumpt (@tstirrat15)
- **PR #3466** (closed): chore(deps): bump the go-mod group across 2 directories with 43 updates (@dependabot[bot])

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

## X. fix flaky tests (#3317)

**RULE**:
When implementing operations in `internal/datastore/crdb/pool/balancer.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in authzed/spicedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8a14abe3`: fix flaky tests (#3317). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/datastore/crdb/pool/balancer.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// Snapshot the healthy node count exactly once.
	// Other goroutines mark nodes unhealthy concurrently, so re-reading it
	// below could observe zero and divide by zero.
		if genutil.MustEnsureUInt32(i) < p.pool.MaxConns()%nodeCount {
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
		if p.healthTracker.HealthyNodeCount() == 0 ||
			i < int(p.pool.MaxConns())%p.healthTracker.HealthyNodeCount() {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8a14abe3` are properly handled with clean fallback behavior.
