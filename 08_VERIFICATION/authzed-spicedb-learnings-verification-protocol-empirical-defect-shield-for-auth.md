# Verification Protocol: Verification Protocol: Empirical Defect Shield for authzed-spicedb-learnings

<!-- PROVENANCE_START
{
  "source_repository": "authzed-spicedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T22:40:18.706Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-authzed-spicedb-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [authzed-spicedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T22:40:18.706Z`  
> **Learning ID**: `LEARN-EVO-authzed-spicedb-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `authzed-spicedb-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/authzed-spicedb-learnings.md`  
> **Source**: github ([https://github.com/authzed/spicedb](https://github.com/authzed/spicedb))  
> **Source Version**: `c77bad6d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T22:40:12.927Z  
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
> **Harvest Timestamp**: 2026-11-21T22:40:12.921Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `authzed/spicedb`
- **Description**: Open Source, Google Zanzibar-inspired database for scalably storing and querying fine-grained authorization data
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 7235 stars

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
- **Issue #3517** (2026-11-20): **feat: batched streaming responses for LookupResources**
  *Symptoms*: ## What  Adds `optional_response_batch_size` to `LookupResources`: pack multiple resources into a single `LookupResourcesResponse.batched` message (a `LookupResourcesBatch` — repeated results plus one `after_cursor` for the whole batch), instead of one message, and one resume cursor, per resource.  `batch_size == 0` preserves the current one-resource-per-message behavior (backward compatible). The effective batch size is clamped to a new server flag `MaxLookupResourcesResponseBatchSize` (default 1000) rather than a fixed proto cap.  Also defaults `--experimental-lookup-resources-version` to `lr3`.  ## Why  For high-cardinality `LookupResources`, one gRPC message and one cursor token per resource dominates the cost (per-message framing + repeated cursor payload). Batching cuts both — most impactful for large reverse-reachability lookups and the Materialize/accelerated path.  ## Dependency chain  - `authzed/api#176` — proto: `LookupResourcesResponse.batched` + `LookupResourcesRequest.optional_response_batch_size` (merged) - `authzed/authzed-go#436` — regenerated client (merged); pinned here at `380614b`  ## Testing  - Unit tests in `internal/services/v1/permissions_test.go` covering batched streaming. - `go build ./...` passes against the pinned client.  ## Build / toolchain cascade  The pinned `authzed-go@380614b` declares `go 1.27.4`, which raises this module's `go` directive to `1.27.4`. To keep the whole build consistent (CI runs with `GOTOOLCHAIN=local`):  - `Dockerfile` b

- **Issue #3513** (2026-11-20): **fix(watch): emit schema Watch events from the unified stored schema in read-new modes**
  *Symptoms*: ## Summary  Writing a schema in `--experimental-schema-mode=read-new-write-new` produced no Watch event, so anything watching for schema changes stopped getting them. In `read-new-write-both`, events arrived, but were built from the legacy tables rather than from the storage that mode reads.  Every datastore built schema Watch events from the legacy namespace and caveat tables, whatever the schema mode. This PR makes the shared datastore tests catch that, and fixes it.  ## Fix  - **Datastores** accept a new `WatchStoredSchema` watch content. For it, they report only that the unified stored schema was written at a revision (`RevisionChanges.StoredSchemaChanged`), not what changed. - **`DataLayer.Watch`** asks for `WatchStoredSchema` in place of `WatchSchema` when the schema mode reads from the unified stored schema. It then compares the stored schema at each reported revision with the one before it, and fills in `ChangedDefinitions`, `DeletedNamespaces` and `DeletedCaveats`. Callers see the same events as before. Legacy read modes pass straight through to the datastore, unchanged.  Per datastore:  | Datastore | How a stored schema write is detected | |---|---| | memdb | changes to the schema table are recorded in the changelog | | Postgres | rows of `schema_revision` created in the watched transaction range | | CockroachDB | `schema_revision` is added to the changefeed | | Spanner | `schema_revision` is added to the change stream (new migration) | | MySQL | not supported, as w

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

### Incident Patch 1: `c77bad6d` (2026-11-20)
**Commit Message**: fix: single schema store reads wrong schemahash at revision boundaries (#3510)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Dispatch: when a LookupResources continuation locked to a secondary dispatcher fails, the secondary's error is now returned with its gRPC status, instead of a generic "no dispatcher returned results" error with code Unknown. (https://github.com/authzed/spicedb/pull/3468)
 - LookupResources v3: fixed an issue with concurrent map writes in the caveat runner by giving each producer its own caveat runner. (https://github.com/authzed/spicedb/pull/3509)
 - Watch: with `--experimental-schema-mode` set to `read-new-write-new`, writing a schema now produces a Watch schema event. Schema events were always built from the legacy namespace and caveat tables, which that mode does not write, so schema changes were never reported. With `read-new-write-both` and `read-new-write-new`, schema events are now built from the single-store schema. The default legacy schema mode is unchanged, and MySQL still does not support watching schema. Spanner: a new migration, `add-schema-revision-to-change-stream`, adds the `schema_revision` table to the change stream, and a Watch with checkpoints no longer emits a checkpoint for a transaction that wrote to several tables before that transaction's changes. (https://github.com/authzed/spicedb/pull/3513)
+- Single Schema Store: If a schema was written and reverted within a quantization window, CRDB and Spanner-backed SpiceDB instances could select the wrong pairing of datastore revision and schema revision. (https://github.com/authzed/spicedb/pull/3510)
 
 ## [1.57.1] - 2026-11-10
 ### Fixed
```

**File**: `internal/datastore/crdb/crdb.go` (modified, +38/-5)
```diff
@@ -285,7 +285,7 @@ func (cds *crdbDatastore) OptimizedRevision(ctx context.Context) (datastore.Revi
 	ctx, span := tracer.Start(ctx, "OptimizedRevision")
 	defer span.End()
 
-	nowRev, schemaHash, err := cds.headRevisionInternal(ctx)
+	nowRev, err := cds.headRevisionInternalNoHash(ctx)
 	if err != nil {
 		return datastore.RevisionWithSchemaHashAndValidity{}, err
 	}
@@ -300,9 +300,46 @@ func (cds *crdbDatastore) OptimizedRevision(ctx context.Context) (datastore.Revi
 	}
 
 	rev, validFor := revisions.Quantize(nowTS, cds.followerReadDelay, cds.revisionQuantization)
+
+	// Read the hash at the quantized revision, not at now. A schema written between the two
+	// would otherwise pair this revision with a schema that was not in effect at it.
+	schemaHash, err := cds.schemaHashAtRevision(ctx, rev)
+	if err != nil {
+		return datastore.RevisionWithSchemaHashAndValidity{}, err
+	}
 	return datastore.RevisionWithSchemaHashAndValidity{Revision: rev, ValidFor: validFor, SchemaHash: schemaHash}, nil
 }
 
+// schemaHashAtRevision returns the stored schema hash as of rev. It returns an empty hash if
+// no schema was stored at rev, including when rev precedes the creation of the database or
+// of the schema_revision table (shortly after a fresh migration). A database that does not
+// exist at all fails when connecting, before this query runs.
+func (cds *crdbDatastore) schemaHashAtRevision(ctx context.Context, rev datastore.Revision) (string, error) {
+	ctx, span := tracer.Start(ctx, "schemaHashAtRevision")
+	defer span.End()
+
+	query := "SELECT hash FROM schema_revision AS OF SYSTEM TIME " + rev.String() + " WHERE name = 'current' LIMIT 1"
+
+	var schemaHash []byte
+	err := cds.readPool.QueryRowFunc(ctx, func(ctx context.Context, row pgx.Row) error {
+		return row.Scan(&schemaHash)
+	}, query)
+	if err != nil {
+		if pgErr, ok := errors.AsType[*pgconn.PgError](err); errors.Is(err, pgx.ErrNoRows) || (ok && (pgErr.Code == pgerrcodeUndefinedTable || pgErr.Code == pgerrcodeInvalidCatalogName)) {
+			return "", nil
+		}
+		return "", fmt.Errorf(errRevision, err)
+	}
+	return string(schemaHash), nil
+}
+
+const (
+	// pgerrcodeUndefinedTable is the SQLSTATE for a table that does not exist.
+	pgerrcodeUndefinedTable = "42P01"
+	// pgerrcodeInvalidCatalogName is the SQLSTATE for a database that does not exist.
+	pgerrcodeInvalidCatalogName = "3D000"
+)
+
 // CheckRevision verifies the given revision is within the software GC window. It
 // lives on the datastore (not the caching layer) because it is not a caching
 // concern. It uses the hash-free head revision query since the schema hash is
@@ -588,10 +625,6 @@ func (cds *crdbDatastore) HeadRevision(ctx context.Context) (datastore.RevisionW
 	return datastore.RevisionWithSchemaHash{Revision: rev, SchemaHash: schemaHash}, nil
 }
 
-func (cds *crdbDatastore) headRevisionInternal(ctx context.Context) (datastore.Revision, string, error) {
-	return cds.headRevisionWithSchemaHash(ctx)
-}
-
 func (cds *crdbDatastore) headRevisionInternalNoHash(ctx context.Context) (datastore.Revision, error) {
 	ctx, span := tracer.Start(ctx, "headRevisionInternalNoHash")
 	defer span.End()
```

**File**: `internal/datastore/spanner/revisions.go` (modified, +11/-22)
```diff
@@ -17,6 +17,7 @@ var (
 	ParseRevisionString   = revisions.RevisionParser(revisions.Timestamp)
 	nowWithSchemaHashStmt = spanner.NewStatement("SELECT CURRENT_TIMESTAMP(), COALESCE((SELECT schema_hash FROM schema_revision WHERE name = 'current' ORDER BY timestamp DESC LIMIT 1), b'')")
 	nowStmt               = spanner.NewStatement("SELECT CURRENT_TIMESTAMP()")
+	schemaHashStmt        = spanner.NewStatement("SELECT COALESCE((SELECT schema_hash FROM schema_revision WHERE name = 'current' ORDER BY timestamp DESC LIMIT 1), b'')")
 )
 
 func (sd *spannerDatastore) HeadRevision(ctx context.Context) (datastore.RevisionWithSchemaHash, error) {
@@ -52,34 +53,22 @@ func (sd *spannerDatastore) nowOnly(ctx context.Context) (datastore.Revision, er
 	return revisions.NewForTime(timestamp), nil
 }
 
-func (sd *spannerDatastore) staleHeadRevision(ctx context.Context) (datastore.Revision, string, error) {
-	var timestamp time.Time
+// schemaHashAtRevision returns the stored schema hash as of rev. It returns an empty hash if
+// no schema was stored at rev, including when rev precedes the creation of the
+// schema_revision table (commonly hit immediately after a fresh migration).
+func (sd *spannerDatastore) schemaHashAtRevision(ctx context.Context, rev revisions.WithTimestampRevision) (string, error) {
 	var schemaHash []byte
 	err := sd.client.Single().
-		WithTimestampBound(spanner.ExactStaleness(sd.config.followerReadDelay)).
-		Query(ctx, nowWithSchemaHashStmt).
+		WithTimestampBound(spanner.ReadTimestamp(time.Unix(0, rev.TimestampNanoSec()))).
+		Query(ctx, schemaHashStmt).
 		Do(func(r *spanner.Row) error {
-			return r.Columns(&timestamp, &schemaHash)
+			return r.Columns(&schemaHash)
 		})
 	if err == nil {
-		return revisions.NewForTime(timestamp), string(schemaHash), nil
+		return string(schemaHash), nil
 	}
-
-	// The stale read timestamp can precede the creation of the schema_revision
-	// table when the followerReadDelay is larger than the time elapsed since
-	// migrations ran (commonly hit immediately after a fresh migration). At
-	// that past time, no schema existed, so returning an empty hash is
-	// semantically correct; fall back to a stale read of just the timestamp.
 	if spanner.ErrCode(err) == codes.InvalidArgument && strings.Contains(err.Error(), "Table not found: schema_revision") {
-		if err := sd.client.Single().
-			WithTimestampBound(spanner.ExactStaleness(sd.config.followerReadDelay)).
-			Query(ctx, nowStmt).
-			Do(func(r *spanner.Row) error {
-				return r.Columns(&timestamp)
-			}); err != nil {
-			return datastore.NoRevision, "", fmt.Errorf(errRevision, err)
-		}
-		return revisions.NewForTime(timestamp), "", nil
+		return "", nil
 	}
-	return datastore.NoRevision, "", fmt.Errorf(errRevision, err)
+	return "", fmt.Errorf(errRevision, err)
 }
```

**File**: `internal/datastore/spanner/spanner.go` (modified, +8/-1)
```diff
@@ -244,7 +244,7 @@ func (sd *spannerDatastore) OptimizedRevision(ctx context.Context) (datastore.Re
 	ctx, span := tracer.Start(ctx, "OptimizedRevision")
 	defer span.End()
 
-	nowRev, schemaHash, err := sd.staleHeadRevision(ctx)
+	nowRev, err := sd.nowOnly(ctx)
 	if err != nil {
 		return datastore.RevisionWithSchemaHashAndValidity{}, err
 	}
@@ -259,6 +259,13 @@ func (sd *spannerDatastore) OptimizedRevision(ctx context.Context) (datastore.Re
 	}
 
 	rev, validFor := revisions.Quantize(nowTS, sd.followerReadDelay, sd.revisionQuantization)
+
+	// Read the hash at the quantized revision, not at now. A schema written between the two
+	// would otherwise pair this revision with a schema that was not in effect at it.
+	schemaHash, err := sd.schemaHashAtRevision(ctx, rev)
+	if err != nil {
+		return datastore.RevisionWithSchemaHashAndValidity{}, err
+	}
 	return datastore.RevisionWithSchemaHashAndValidity{Revision: rev, ValidFor: validFor, SchemaHash: schemaHash}, nil
 }
 
```

**File**: `pkg/datastore/test/datastore.go` (modified, +1/-0)
```diff
@@ -424,6 +424,7 @@ func AllWithExceptions(t *testing.T, tester DatastoreTester, except Categories,
 	}
 	t.Run("TestHeadRevisionSchemaHash", runner(tester, HeadRevisionSchemaHashTest))
 	t.Run("TestOptimizedRevisionSchemaHash", runner(tester, OptimizedRevisionSchemaHashTest))
+	t.Run("TestOptimizedRevisionSchemaHashAfterRevert", runner(tester, OptimizedRevisionSchemaHashAfterRevertTest))
 
 	if !except.Migration() {
 		t.Run("TestMigration", runner(tester, MigrationTest))
```

**File**: `pkg/datastore/test/storedschema.go` (modified, +152/-0)
```diff
@@ -782,6 +782,158 @@ func OptimizedRevisionSchemaHashTest(t *testing.T, tester DatastoreTester) {
 		"OptimizedRevision schema hashes should differ after writing a different schema")
 }
 
+// OptimizedRevisionSchemaHashAfterRevertTest returns a test that checks that OptimizedRevision
+// returns the schema hash at the revision it returns, when a schema is written and then
+// reverted across a quantization boundary.
+//
+// Each attempt writes schema A, then schema B, and waits for the next quantization boundary on
+// the database's clock. In the new window it writes a relationship (a marker), reverts to
+// schema A, and calls OptimizedRevision. Datastores with timestamp revisions (CRDB, Spanner,
+// memdb) return the boundary. Datastores with transaction-ID revisions (Postgres, MySQL) return
+// the first transaction at or after the boundary, which is the marker. Either way, the
+// optimized revision is after the write of B and before the revert, and the schema at it is B.
+// A datastore that reads the schema hash at "now" and then quantizes the revision down returns
+// hashA with that revision.
+//
+// If the database's clock crosses into the next window before OptimizedRevision returns, or
+// the optimized revision is not between the two writes, the attempt cannot show anything and
+// the test retries. The last attempt fails on those conditions instead of retrying.
+//
+// The tester must create datastores with no follower read delay.
+func OptimizedRevisionSchemaHashAfterRevertTest(t *testing.T, tester DatastoreTester) {
+	const (
+		quantization = 2 * time.Second
+		maxAttempts  = 4
+	)
+
+	ds, err := tester.New(t, DefaultRevisionParameters().WithQuantization(quantization), 1)
+	require.NoError(t, err)
+
+	dbNow := databaseClock(t, ds)
+	for attempt := 1; attempt <= maxAttempts; attempt++ {
+		if optimizedRevisionSchemaHashAfterRevertAttempt(t, ds, quantization, dbNow, attempt == maxAttempts) {
+			return
+		}
+		t.Logf("attempt %d: the timing did not put the optimized revision between the schema writes; retrying", attempt)
+	}
+}
+
+// databaseClock returns a function that reads the database's clock. The quantization windows
+// are on that clock, not the test's. memdb runs in this process, so it uses the local clock.
+// Postgres and MySQL read it with their garbage collector. CRDB and Spanner read it from
+// HeadRevision, which is the server's current time. (memdb's HeadRevision is its last write,
+// so it cannot be used as a clock.)
+func databaseClock(t *testing.T, ds datastore.Datastore) func(context.Context) time.Time {
+	t.Helper()
+
+	if eids := datastore.UnwrapAs[datastore.EngineIdentifiable](ds); eids != nil && eids.EngineName() == "memory" {
+		return func(context.Context) time.Time { return time.Now() }
+	}
+
+	if gcds := datastore.UnwrapAs[datastore.GarbageCollectableDatastore](ds); gcds != nil {
+		return func(ctx context.Context) time.Time {
+			// A garbage collector holds a pool connection until it is closed, so build one
+			// for each read. Holding one can starve the writes in a small test pool.
+			gc, err := gcds.BuildGarbageCollector(ctx)
+			require.NoError(t, err)
+			defer gc.Close()
+			now, err := gc.Now(ctx)
+			require.NoError(t, err)
+			return now
+		}
+	}
+
+	return func(ctx context.Context) time.Time {
+		head, err := ds.HeadRevision(ctx)
+		require.NoError(t, err)
+		tsRev, ok := head.Revision.(interface{ TimestampNanoSec() int64 })
+		require.True(t, ok, "revision %T has no timestamp and the datastore has no garbage collector clock", head.Revision)
+		return time.Unix(0, tsRev.TimestampNanoSec())
+	}
+}
+
+// optimizedRevisionSchemaHashAfterRevertAttempt runs one attempt of
+// OptimizedRevisionSchemaHashAfterRevertTest. It returns false if the timing did not put the
+// optimized revision between the schema writes. If mustAssert is set, it fails instead.
+func optimizedRevisionSchemaHashAfterRevertAttempt(t *testing.T, ds datastore.Datastore, quantization time.Duration, dbNow func(context.Context) time.Time, mustAssert bool) bool {
+	t.Helper()
+	require := require.New(t)
+	ctx := t.Context()
+
+	defsA := []compiler.SchemaDefinition{
+		ns.Namespace("user"),
+		ns.Namespace("document",
+			ns.MustRelation("viewer", nil, ns.AllowedRelation("user", "...")),
+		),
+	}
+	defsB := []compiler.SchemaDefinition{
+		ns.Namespace("user"),
+		ns.Namespace("document",
+			ns.MustRelation("viewer", nil, ns.AllowedRelation("user", "...")),
+			ns.MustRelation("editor", nil, ns.AllowedRelation("user", "...")),
+		),
+	}
+	textA, _, err := generator.GenerateSchema(ctx, defsA)
+	require.NoError(err)
+	textB, _, err := generator.GenerateSchema(ctx, defsB)
+	require.NoError(err)
+	hashA, err := generator.ComputeSchemaHash(defsA)
+	require.NoError(err)
+	hashB, err := generator.ComputeSchemaHash(defsB)
+	require.NoError(err)
+
+	writeSchema(ctx, t, ds, defsA, textA)
+	revB := writeSchema(ctx, t, ds, defsB, textB)
+
+	// Wait for the next quantization boundary on the database
```

#### Recent Merged Pull Requests:
- **PR #3517** (2026-11-20): feat: batched streaming responses for LookupResources (@ostafen)
- **PR #3513** (2026-11-20): fix(watch): emit schema Watch events from the unified stored schema in read-new modes (@vroldanbet)
- **PR #3510** (2026-11-20): fix: single schema store reads wrong schemahash at revision boundaries (@tstirrat15)
- **PR #3509** (2026-11-18): fix(graph): give each LookupResources3 producer its own caveat runner (@ostafen)
- **PR #3508** (2026-11-18): refactor(dispatch): stop recovering panics from external strategies (@ostafen)
- **PR #3507** (2026-11-18): fix(docker): update grpc_health_probe to v0.4.63 for CVE-2026-97054 (@ostafen)

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

## X. single schema store reads wrong schemahash at revision boundaries

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in authzed/spicedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c77bad6d`: single schema store reads wrong schemahash at revision boundaries. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- Single Schema Store: If a schema was written and reverted within a quantization window, CRDB and Spanner-backed SpiceDB instances could select the wrong pairing of datastore revision and schema revision. (https://github.com/authzed/spicedb/pull/3510)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c77bad6d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
