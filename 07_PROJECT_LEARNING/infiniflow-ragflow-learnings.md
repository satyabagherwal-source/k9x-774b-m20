# Forensic Learning Record (Deep Inspection): infiniflow/ragflow

> **Canonical Artifact**: `07_PROJECT_LEARNING/infiniflow-ragflow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infiniflow/ragflow](https://github.com/infiniflow/ragflow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:54:04.278Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infiniflow/ragflow`
- **Description**: RAGFlow is a leading open-source Retrieval-Augmented Generation (RAG) engine that fuses cutting-edge RAG with Agent capabilities to create a superior context layer for LLMs
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 91699 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/admin/state.go`
```
//
//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

package admin

import (
	"ragflow/internal/common"
	"sync"
	"time"
)

// API server state

// ServerStore is a thread-safe global server status storage
type ServerStore struct {
	mu      sync.RWMutex
	servers map[string]*common.BaseMessage // key: server_id
}

// GlobalServerStore is the global instance
var GlobalServerStore = &ServerStore{
	servers: make(map[string]*common.BaseMessage),
}

// UpdateServerInfo updates or adds a server status
func (s *ServerStore) UpdateServerInfo(serverName string, status *common.BaseMessage) error {

	s.mu.Lock()
	defer s.mu.Unlock()

	switch status.ServerType {
	case common.ServerTypeAPI:
		s.servers[serverName] = status
	case common.ServerTypeIngestion:
		s.servers[serverName] = status
	case common.ServerTypeFileSyncer:
		s.servers[serverName] = status
	}

	return CheckClientStatus(serverName, status)
}

// GetServerInfo gets a single server status
func (s *ServerStore) GetServerInfo(serverName string) (*common.BaseMessage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	status, ok := s.servers[serverName]
	return status, ok
}

// ListInfos gets all server infos
func (s *ServerStore) ListInfos() []*common.BaseMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*common.BaseMessage, 0, len(s.servers))
	for _, status := range s.servers {
		result = append(result, status)
	}
	return result
}

// ListInfosByType gets server infos by type
func (s *ServerStore) ListInfosByType(serverType common.ServerType) []*common.BaseMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*common.BaseMessage, 0)
	for _, status := range s.servers {
		if status.ServerType == serverType {
			result = append(result, status)
		}
	}
	return result
}

// RemoveStatus removes a server status
func (s *ServerStore) RemoveStatus(serverID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.servers, serverID)
}

// CleanupStaleStatuses cleans up servers that haven't reported for a specified duration
func (s *ServerStore) CleanupStaleStatuses(maxAge time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for id, status := range s.servers {
		if now.Sub(status.Timestamp) > maxAge {
			delete(s.servers, id)
		}
	}
}

```

### Core Architecture Module: `internal/agent/canvas/loop_subgraph.go`
```
//
//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

// loop_subgraph.go — Loop macro expansion for BuildWorkflow.
//
// The RAGFlow DSL expresses a loop as a parent Loop component with a
// chain of downstream body components. In the Go port we collapse this
// to a SINGLE eino node by:
//  1. Collecting the Loop's downstream descendants into a sub-graph
//     (a *compose.Workflow[map[string]any, map[string]any]).
//  2. Prepending a synthetic "LoopInit" lambda that resolves the DSL's
//     `loop_variables` and writes them into the per-run CanvasState
//     under `state.Outputs[loopID][name]`, then passes the outer input
//     through.
//  3. Translating the DSL's `loop_termination_condition` list into a
//     `workflowx.LoopCondition[map[string]any]` closure that reads the
//     same state slots via `state.GetVar` on every iteration.
//
// The actual installation into the outer graph is done by BuildWorkflow
// (canvas.go) via workflowx.AddLoopNode, which registers the resulting
// *WorkflowNode inside the outer *compose.Workflow.
package canvas

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"ragflow/internal/agent/runtime"
	"ragflow/internal/agent/workflowx"

	"github.com/cloudwego/eino/compose"
)

// loopExpansion holds the two artifacts produced by buildLoopExpansion
// and consumed by BuildWorkflow to install the loop node.
type loopExpansion struct {
	Sub        *compose.Workflow[map[string]any, map[string]any]
	ShouldQuit workflowx.LoopCondition[map[string]any]
	MaxIters   int
	Members    map[string]bool // cpn_ids consumed by the sub-graph; caller skips these in the main pass.
	snapshot   func(context.Context) ([]byte, error)
	restore    func(context.Context, []byte) error
}

// buildLoopExpansion constructs the sub-workflow + termination condition
// for the given Loop cpn. It does NOT touch the outer workflow — the
// caller is responsible for installing the result via
// workflowx.AddLoopNode and for skipping the members in the main
// BuildWorkflow pass.
//
// Parameters:
//
//	c      — the parent Canvas (DSL representation).
//	loopID — the cpn_id of the Loop component being expanded.
//
// The returned `Members` is the set of cpn_ids that the expansion
// consumed as body nodes. BuildWorkflow must skip these when iterating
// `c.Components` in the main pass (they will be wired inside the
// sub-graph, not the outer graph).
func buildLoopExpansion(ctx context.Context, c *Canvas, loopID string) (*loopExpansion, error) {
	if c == nil {
		return nil, fmt.Errorf("agent: nil canvas")
	}
	if loopID == "" {
		return nil, fmt.Errorf("agent: buildLoopExpansion: empty loopID")
	}
	if _, ok := c.Components[loopID]; !ok {
		return nil, fmt.Errorf("agent: buildLoopExpansion: unknown cpn %q", loopID)
	}

	loopComp := c.Components[loopID]

	members := collectLoopMembers(c, loopID)

	initValues, err := resolveInitialVariables(loopComp.Obj.Params)
	if err != nil {
		return nil, fmt.Errorf("agent: loop %q: %w", loopID, err)
	}

	shouldQuit, err := translateLoopCondition(loopID, loopComp.Obj.Params)
	if err != nil {
		return nil, fmt.Errorf("agent: loop %q: %w", loopID, err)
	}

	maxIters := readMaxLoopCount(loopComp.Obj.Params)

	sub, err := buildSubWorkflow(ctx, c, members, loopID, initValues)
	if err != nil {
		return nil, fmt.Errorf("agent: loop %q: %w", loopID, err)
	}

	return &loopExpansion{
		Sub:        sub,
		ShouldQuit: shouldQuit,
		MaxIters:   maxIters,
		Members:    members,
		snapshot: func(ctx context.Context) ([]byte, error) {
			return snapshotLoopVariables(ctx, loopID)
		},
		restore: func(ctx context.Context, data []byte) error {
			return restoreLoopVariables(ctx, loopID, data)
		},
	}, nil
}

// collectDescendants returns the set of cpn_ids reachable from root via
// downstream edges, NOT including root itself. The BFS stops at the
// back-edge to root (i.e. a node whose Downstream contains root). This
// prevents infinite recursion on cyclic graphs.
func collectLoopMembers(c *Canvas, loopID string) map[string]bool {
	members := collectGroupedMembers(c, loopID)
	if len(members) > 0 {
		return members
	}
	return collectDescendants(c, loopID)
}

func collectDescendants(c *Canvas, root string) map[string]bool {
	visited := make(map[string]bool)
	var queue []string
	for _, child := range c.Components[root].Downstream {
		if child == root {
			continue
		}
		if !visited[child] {
			visited[child] = true
			queue = append(queue, child)
		}
	}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		for _, child := range c.Components[cur].Downstream {
			if child == root || child == cur {
				continue
			}
			if !visited[child] {
				visited[child] = true
				queue = append(queue, child)
			}
		}
	}
	return visited
}

// buildSubWorkflow constructs a fresh *compose.Workflow[map[string]any,
// map[string]any] containing one node per member cpn, plus a synthetic
// "LoopInit" entry node that seeds the loop variables into the per-run
// state. Edges within the sub-graph mirror the canvas's Downstream
// relations. The sub-workflow's START wires to LoopInit; the END wires
// to whichever member has no downstream within the sub-graph (the
// "tail" of the body).
//
// Body nodes are built through buildNodeBody so they share the same
// legacy-no-op / factory / placeholder routing as the outer graph,
// and receive the same statePre / statePost handlers so loop body
// outputs land in CanvasState.Outputs alongside outer-node outputs.
func buildSubWorkflow(
	ctx context.Context,
	c *Canvas,
	members map[string]bool,
	loopID string,
	initValues map[string]initVarSpec,
) (*compose.Workflow[map[string]any, map[string]any], error) {
	_ = ctx
	sub := compose.NewWorkflow[map[string]any, map[string]any]()
	nodes := make(map[string]*compose.WorkflowNode, len(members)+1)

	// Synthetic entry: writes loop variables into the per-run state
	// the FIRST TIME the sub-workflow runs, then returns the input
	// map unchanged. Subsequent iterations skip the seeding so the
	// body's mutations accumulate across iterations — otherwise a
	// VariableAssigner that increments `counter` would be clobbered
	// back to its initial value at the top of every iteration and
	// the loop could never terminate on a condition that watches the counter.
	//
	// "First time" is detected by checking whether the loop's state
	// bucket already holds the variable: a missing bucket entry
	// (GetVar returns nil with no error) means the loop has not yet
	// seeded; any non-nil value means the body already wrote it on
	// a prior iteration. This is safe even for "zero-init" loop
	// variables (number→0, string→"") because Go's typed zero
	// values are non-nil when stored back through SetVar.
	//
	// input_mode dispatch (per agent/component/loop.py:60-77):
	//   "constant"  → use the literal value from the DSL
	//   "variable"  → dereference the value as a state ref via
	//                 state.GetVar; store the resolved value
	//                 (or nil if the ref is unresolvable — mirrors
	//                 Python's "treat as literal" fallback)
	//   "" (zero)   → use the type-derived zero value (resolved at
	//                 build time by resolveLoopVarValue)
	initNode := sub.AddLambdaNode(loopInitKey,
		compose.InvokableLambda(func(ctx context.Context, in map[string]any) (map[string]any, error) {
			state, err := GetStateFromContext(ctx)
			if err != nil || state == nil {
				return in, nil
			}
			for k, spec := range initValues {
				existing, _ := state.GetVar(loopID + "@" + k)
				if existing != nil {
					continue
				}
				v := spec.Value
				if spec.InputMode == "variable" {
					ref, _ := spec.Value.(string)
					resolved, err := state.GetVar(ref)
					if err != nil {
						return nil, fmt.Errorf("agent: loop %q init: variable %q ref %q: %w", loopID, k, ref, err)
					}
					v = resolved
				}
				state.SetVar(loopID, k, v)
			}
			return in, nil
		}),
	)
	nodes[loopInitKey] = initNode

	// Body nodes: each member becomes a real factory-built (or
	// placeholder, when no factory is registered) component invoke
	// wrapped by withStateBracket so it shares the same state
	// snapshot / result-persistence contract as outer-graph nodes.
	// We do NOT use eino's StatePreHandler / StatePostHandler here
	// because the sub-workflow has no WithGenLocalState of its own:
	// state flows in through ctx (runtime.WithState) attached by
	// the caller, and is read back via runtime.GetStateFromContext
	// inside withStateBracket. This is what lets a Loop body
	// actually mutate CanvasState (e.g. VariableAssigner
	// incrementing the loop counter) so the LoopCondition closure
	// can observe the change on the next iteration.
	for cpnID := range members {
		name := c.Components[cpnID].Obj.ComponentName
		if name == "" {
			return nil, fmt.Errorf("agent: loop %q member %q has empty component_name", loopID, cpnID)
		}
		deferToMessage := directMessageDownstream(c, cpnID)
		nodeOpts := runtime.ComponentExecutionOptions{
			DeferAgentToMessage:        deferToMessage,
			SuppressAgentMessageEvents: strings.EqualFold(name, "Agent") && !deferToMessage,
		}
		body, err := buildNodeBodyWithOptions(ctx, cpnID, name, c.Components[cpnID].DisplayName, c.Components[cpnID].Obj.Params, nodeOpts)
		if err != nil {
			return nil, err
		}
		nodes[cpnID] = sub.AddLambdaNode(cpnID,
			compose.InvokableLambda[map[string]any, map[string]any](withStateBracket(cpnID
```

### Core Architecture Module: `internal/agent/canvas/state.go`
```
// Package canvas — state engine re-exports.
//
// The actual CanvasState type and its GetVar / SetVar / ReadVars
// methods live in internal/agent/runtime/state.go so the component
// package can depend on them without importing canvas. This file
// keeps the package-internal withState helper used by canvas_test.go
// and the cross-package GetStateFromContext re-export.
package canvas

import (
	"context"

	"ragflow/internal/agent/runtime"
)

// withState attaches *CanvasState to ctx. Production code uses this
// once per run from compile.go; cross-package tests use the exported
// WithState (state_export.go) which delegates to the same runtime
// helper.
func withState(ctx context.Context, s *CanvasState) context.Context {
	return runtime.WithState(ctx, s)
}

// GetStateFromContext re-exports runtime.GetStateFromContext so
// canvas-side callers (and tests that already import canvas) keep
// compiling without an extra import.
func GetStateFromContext(ctx context.Context) (*CanvasState, error) {
	return runtime.GetStateFromContext(ctx)
}

```

### Core Architecture Module: `internal/agent/canvas/state_export.go`
```
//
//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

// Package canvas — public re-export of withState for cross-package tests.
//
// The package-internal withState attaches *CanvasState to a context so
// GetStateFromContext can retrieve it. It is unexported because the
// production call site is exactly one: the orchestrator's compile entry
// (compile.go). External callers should never need to inject state
// themselves.
//
// Cross-package unit tests (e.g. internal/agent/component/*_test.go) do
// need a way to set up a state for component Invoke() calls. This file
// exposes a single thin re-export — WithState — that the test code in
// other packages can call. Production code paths are not affected:
// nothing in the production binary calls WithState; the orchestrator
// keeps using the unexported withState directly.
package canvas

import (
	"context"

	"ragflow/internal/agent/runtime"
)

// WithState attaches *CanvasState to ctx for retrieval by
// GetStateFromContext. Intended ONLY for cross-package test setup
// (production code uses the unexported withState via compile.go).
// Both entry points delegate to runtime.WithState.
func WithState(ctx context.Context, s *CanvasState) context.Context {
	return runtime.WithState(ctx, s)
}

```

### Core Architecture Module: `internal/agent/canvas/state_serializer.go`
```
//
//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

// state_serializer.go implements eino's compose.Serializer interface for
// CanvasState. See plan §2.6 — the eino Serializer signature is
// Marshal(v any) / Unmarshal(data []byte, v any) with NO context.Context.
package canvas

import (
	"encoding/json"
)

// CanvasStateSerializer marshals a *CanvasState (or any value) to/from
// JSON. eino calls this when persisting or restoring a checkpoint;
// the value type is *CanvasState in the canvas engine.
type CanvasStateSerializer struct{}

// Marshal implements compose.Serializer.
func (CanvasStateSerializer) Marshal(v any) ([]byte, error) {
	return json.Marshal(v)
}

// Unmarshal implements compose.Serializer. The caller passes a pointer
// (eino provides a fresh *checkpoint-like value).
func (CanvasStateSerializer) Unmarshal(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

```

### Core Architecture Module: `internal/agent/component/loop.go`
```
//
//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

// Package component — Loop component (T3, plan §2.11.3 row 11).
//
// Loop is the parent node for a conditional loop subgraph. The Go port
// implements a single-node loop driven by workflowx.AddLoopNode: when
// BuildWorkflow sees a Loop cpn, it collects the Loop's downstream
// descendants into a sub-graph (see canvas/loop_subgraph.go), installs
// a workflowx.AddLoopNode in place of the Loop subtree, and skips
// Loop in the main node-registration pass.
//
// As a result, LoopComponent itself does NOT do any per-iteration
// work at runtime. LoopComponent.Invoke is a no-op marker that
// returns an empty map; the actual loop iteration is driven by
// the sub-graph's init lambda (which seeds loop_variables into
// CanvasState) and the sub-workflow's per-iteration body. Loop
// termination is driven by the workflowx.LoopCondition produced by
// translateLoopCondition from the DSL's loop_termination_condition
// list.
//
// The component still exists in the registry so:
//   - tooling / introspection (component.New, RegisteredNames) work;
//   - factory-style wiring can still construct a LoopComponent from
//     a params map (useful for tests and direct API callers);
//
// loopParam and its Update/Check/AsDict methods stay because they
// describe the canonical Loop DSL shape, even though runtime path
// bypasses them (canvas.buildLoopExpansion parses the raw params
// map directly). Keep them as a single source of truth for what a
// Loop params block looks like.
package component

import (
	"context"

	"gorm.io/gorm"
)

const componentNameLoop = "Loop"

// LoopComponent is the canvas-level loop parent. The runtime loop
// driver lives in workflowx.AddLoopNode, not in this type. The
// component exists for registry / factory / introspection only —
// Invoke is a no-op that returns an empty map.
type LoopComponent struct {
	param loopParam
}

// loopParam captures the (resolved) DSL parameters for a Loop node.
// Only `loop_variables` and `loop_termination_condition` are
// meaningful; the parent.get_start() walk that the Python version
// performs (loop.py:46-51) is an engine concern handled by
// canvas.buildLoopExpansion at BuildWorkflow time.
type loopParam struct {
	// LoopVariables is the list of variable initializers. Each entry is
	// a map with keys {variable, input_mode, value, type}. The slice
	// pointer is shared with the DSL loader — callers should treat it
	// as read-only.
	LoopVariables []map[string]any

	// LoopTerminationCondition is the list of termination conditions.
	// Each entry is a map with keys {variable, operator, value,
	// input_mode}. The condition list is translated to a
	// workflowx.LoopCondition closure by canvas.translateLoopCondition.
	LoopTerminationCondition []map[string]any

	// LogicalOperator combines per-condition results: "and" (default)
	// or "or".
	LogicalOperator string

	// MaximumLoopCount caps the iteration count. 0 = infinite.
	MaximumLoopCount int
}

// Update copies conf into p. Used by the editor / API to hand-craft a
// params map; type validation is intentionally minimal in P2.
func (p *loopParam) Update(conf map[string]any) error {
	if conf == nil {
		return nil
	}
	if raw, ok := conf["loop_variables"]; ok {
		p.LoopVariables = toAnyMapSlice(raw)
	}
	if raw, ok := conf["loop_termination_condition"]; ok {
		p.LoopTerminationCondition = toAnyMapSlice(raw)
	}
	if v, ok := stringFrom(conf, "logical_operator"); ok {
		p.LogicalOperator = v
	}
	if v, ok := intFrom(conf, "maximum_loop_count"); ok {
		p.MaximumLoopCount = v
	}
	return nil
}

// Check performs shallow validation. The Python check() at loop.py:39
// always returns True; we mirror that.
func (p *loopParam) Check() error {
	return nil
}

// AsDict returns the params as a plain map for serialization / debug.
func (p *loopParam) AsDict() map[string]any {
	out := map[string]any{}
	if p.LoopVariables != nil {
		out["loop_variables"] = p.LoopVariables
	}
	if p.LoopTerminationCondition != nil {
		out["loop_termination_condition"] = p.LoopTerminationCondition
	}
	if p.LogicalOperator != "" {
		out["logical_operator"] = p.LogicalOperator
	}
	if p.MaximumLoopCount > 0 {
		out["maximum_loop_count"] = p.MaximumLoopCount
	}
	return out
}

// NewLoopComponent builds a LoopComponent from the supplied param struct.
func NewLoopComponent(p loopParam) *LoopComponent {
	return &LoopComponent{param: p}
}

// Name returns the registered component name.
func (c *LoopComponent) Name() string { return componentNameLoop }

// Inputs returns parameter metadata for tooling.
func (c *LoopComponent) Inputs() map[string]string {
	return map[string]string{
		"cpn_id":                     "Stable component identifier — BuildWorkflow uses this to detect Loop and apply the workflowx.AddLoopNode macro expansion.",
		"loop_variables":             "List of variable initializers: [{variable, input_mode, value, type}].",
		"loop_termination_condition": "List of termination conditions: [{variable, operator, value, input_mode}].",
		"maximum_loop_count":         "Maximum iteration count. 0 = infinite. Optional.",
		"logical_operator":           "Combines per-condition results: 'and' (default) or 'or'.",
	}
}

// Outputs returns the Loop's public outputs. In the new architecture,
// the actual loop output is the last iteration's body output, which
// flows through the eino sub-graph node. LoopComponent itself emits
// no outputs; this map documents the contract for downstream
// consumers reading the sub-graph's result via FieldMapping.
func (c *LoopComponent) Outputs() map[string]string {
	return map[string]string{
		"_result": "Final iteration output (set by the sub-graph, not by LoopComponent.Invoke).",
	}
}

// Invoke is a no-op marker. The real per-iteration work runs inside
// the sub-graph (init lambda seeds loop_variables into state; the
// sub-workflow runs the body; the LoopCondition closure evaluates
// termination on every iteration). LoopComponent.Invoke is kept on
// the Component interface for callers that construct a LoopComponent
// directly outside the canvas engine (e.g. unit tests that want to
// verify registration); under the canvas engine, this method is
// never called.
//
// The returned map is empty. State writes from this method would be
// silently dropped by the eino graph, because LoopComponent is not
// registered as an eino node when the macro expansion fires.
func (c *LoopComponent) Invoke(_ context.Context, _ *gorm.DB, _ map[string]any) (map[string]any, error) {
	return map[string]any{}, nil
}

// Stream mirrors Invoke and emits an empty map as a single chunk.
func (c *LoopComponent) Stream(ctx context.Context, db *gorm.DB, inputs map[string]any) (<-chan map[string]any, error) {
	out, err := c.Invoke(ctx, db, inputs)
	if err != nil {
		return nil, err
	}
	ch := make(chan map[string]any, 1)
	ch <- out
	close(ch)
	return ch, nil
}

// toAnyMapSlice accepts either []map[string]any or []any and returns
// the canonical []map[string]any view. Unknown element types are
// skipped silently — the per-item check in the canvas layer will
// surface the malformed entry.
func toAnyMapSlice(raw any) []map[string]any {
	switch v := raw.(type) {
	case []map[string]any:
		return v
	case []any:
		out := make([]map[string]any, 0, len(v))
		for _, e := range v {
			if m, ok := e.(map[string]any); ok {
				out = append(out, m)
			}
		}
		return out
	}
	return nil
}

// init registers LoopComponent with the orchestrator-owned registry.
//
// LoopComponent.Invoke is a no-op; the runtime loop driver lives in
// workflowx.AddLoopNode and is installed by canvas.BuildWorkflow
// when it sees a Loop cpn in the DSL.
func init() {
	Register(componentNameLoop, func(params map[string]any) (Component, error) {
		var p loopParam
		if err := p.Update(params); err != nil {
			return nil, err
		}
		return NewLoopComponent(p), nil
	})
}

```

### Core Architecture Module: `internal/agent/component/render.go`
```
//
//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

// Output-format renderer. The Message component exposes a
// `output_format` field that selects between "html", "markdown",
// and "plain" rendering of the resolved content + downloads list.
// This file is the renderer; it stays dependency-free (no
// html/template or blackfriday) and ships in lockstep with the
// message.go scaffold without dragging in new third-party deps.
//
// Render conventions:
//   - "html"     — wrap in a minimal <div> + escape HTML; downloads
//                  become <a href="..." download="...">filename</a>
//   - "markdown" — pass through verbatim; downloads become
//                  [filename](url) links. Python also passes
//                  Markdown through with light normalization; we
//                  match that for parity.
//   - "plain"    — strip HTML tags (best-effort) and present
//                  downloads as "filename (url)" lines. Default
//                  when the field is unset, matching Python's
//                  "no renderer" fallback.
//
// The renderer is intentionally pure (no I/O) so the message
// component can call it inside Stream() chunks without blocking
// on a downstream service.

package component

import (
	"encoding/json"
	"html"
	"regexp"
	"strings"
)

// OutputFormat is the value type of the `output_format` field on
// the Message component. The string constants match the Python
// DSL field values.
type OutputFormat string

const (
	OutputFormatHTML     OutputFormat = "html"
	OutputFormatMarkdown OutputFormat = "markdown"
	OutputFormatPlain    OutputFormat = "plain"
	// OutputFormatEmpty means "no renderer" — content passes through
	// as-is. Python's default. The string value differs from "" only
	// in the way the user expressed the choice ("none" vs unset).
	OutputFormatEmpty OutputFormat = ""
)

// DownloadInfo is the normalized shape of an extracted download
// entry. Mirrors agent/component/message.py:_is_download_info
// (the {doc_id, filename, mime_type} tuple).
type DownloadInfo struct {
	DocID                        string `json:"doc_id"`
	Filename                     string `json:"filename"`
	MimeType                     string `json:"mime_type"`
	URL                          string `json:"url,omitempty"`
	Content                      string `json:"content,omitempty"`
	Size                         int    `json:"size,omitempty"`
	PreviewURL                   string `json:"preview_url,omitempty"`
	IncludeDownloadInfoInContent bool   `json:"include_download_info_in_content,omitempty"`
}

// RenderRequest is the renderer input. Text is the resolved
// message body; Downloads is the list of extracted attachment
// descriptors. The renderer is pure — the caller decides where
// the rendered string goes.
type RenderRequest struct {
	Format    OutputFormat
	Text      string
	Downloads []DownloadInfo
}

// Render applies the format to the request. Unknown formats
// fall back to plain text so downstream nodes always see a
// non-empty string.
func Render(req RenderRequest) string {
	format := req.Format
	if format == OutputFormatEmpty {
		format = OutputFormatPlain
	}
	body := req.Text
	var dlBlock string
	if len(req.Downloads) > 0 {
		dlBlock = renderDownloads(format, req.Downloads)
	}
	switch format {
	case OutputFormatHTML:
		return wrapHTML(body, dlBlock)
	case OutputFormatMarkdown:
		return joinMarkdown(body, dlBlock)
	default:
		return joinPlain(body, dlBlock)
	}
}

func renderDownloads(format OutputFormat, dls []DownloadInfo) string {
	switch format {
	case OutputFormatHTML:
		var b strings.Builder
		b.WriteString(`<ul class="rf-downloads">`)
		for _, d := range dls {
			b.WriteString(`<li><a href="`)
			b.WriteString(html.EscapeString(d.URL))
			b.WriteString(`" download="`)
			b.WriteString(html.EscapeString(d.Filename))
			b.WriteString(`" type="`)
			b.WriteString(html.EscapeString(d.MimeType))
			b.WriteString(`">`)
			b.WriteString(html.EscapeString(d.Filename))
			b.WriteString("</a></li>")
		}
		b.WriteString("</ul>")
		return b.String()
	case OutputFormatMarkdown:
		var b strings.Builder
		for _, d := range dls {
			b.WriteString("- [")
			b.WriteString(d.Filename)
			b.WriteString("](")
			b.WriteString(d.URL)
			b.WriteString(")\n")
		}
		return strings.TrimRight(b.String(), "\n")
	default:
		var b strings.Builder
		for _, d := range dls {
			b.WriteString(d.Filename)
			b.WriteString(" (")
			b.WriteString(d.URL)
			b.WriteString(")\n")
		}
		return strings.TrimRight(b.String(), "\n")
	}
}

func wrapHTML(body, dlBlock string) string {
	if dlBlock == "" {
		return "<div class=\"rf-message\">" + html.EscapeString(body) + "</div>"
	}
	return "<div class=\"rf-message\">" + html.EscapeString(body) + dlBlock + "</div>"
}

func joinMarkdown(body, dlBlock string) string {
	if dlBlock == "" {
		return body
	}
	return body + "\n\n" + dlBlock
}

func joinPlain(body, dlBlock string) string {
	if dlBlock == "" {
		return body
	}
	return body + "\n" + dlBlock
}

// htmlTagRe is the loose "best-effort" HTML stripper used by the
// plain renderer. It removes paired and unpaired tags without
// attempting to keep attribute content. This matches the
// pragmatic behaviour in Python's `_stringify_message_value`
// fallback path: "if Markdown → use as-is, if plain → strip tags".
var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

// StripHTMLTags removes HTML tags from s. Used by callers that
// want a "plain" preview of an HTML-rendered body (e.g. console
// logging). Public so the message component can reuse it.
func StripHTMLTags(s string) string {
	return strings.TrimSpace(htmlTagRe.ReplaceAllString(s, ""))
}

// IsDownloadInfo mirrors the Python `_is_download_info` static
// method. A value is a download descriptor iff it is a map carrying
// the three canonical keys (doc_id, filename, mime_type). Other
// keys are allowed and ignored.
func IsDownloadInfo(value any) bool {
	m, ok := value.(map[string]any)
	if !ok {
		return false
	}
	for _, k := range []string{"doc_id", "filename", "mime_type"} {
		if _, ok := m[k]; !ok {
			return false
		}
	}
	return true
}

// ExtractDownloads walks a single input value (string, map, list)
// and returns the download descriptors it carries. The Python
// version does the same walk recursively on message-value trees;
// we keep the same recursive shape so the Go port's semantics
// match. Returns an empty slice when nothing is found.
func ExtractDownloads(value any) []DownloadInfo {
	switch v := value.(type) {
	case nil:
		return nil
	case string:
		var parsed any
		if err := json.Unmarshal([]byte(v), &parsed); err != nil {
			return nil
		}
		return ExtractDownloads(parsed)
	case map[string]any:
		if IsDownloadInfo(v) {
			return []DownloadInfo{downloadFromMap(v)}
		}
		var out []DownloadInfo
		for _, item := range v {
			out = append(out, ExtractDownloads(item)...)
		}
		return out
	case map[string]string:
		m := make(map[string]any, len(v))
		for key, value := range v {
			m[key] = value
		}
		return ExtractDownloads(m)
	case []any:
		var out []DownloadInfo
		for _, item := range v {
			out = append(out, ExtractDownloads(item)...)
		}
		return out
	case []DownloadInfo:
		return v
	}
	return nil
}

func appendUniqueDownloads(dst []DownloadInfo, src []DownloadInfo) []DownloadInfo {
	for _, candidate := range src {
		duplicate := false
		for _, existing := range dst {
			if candidate.DocID != "" && candidate.DocID == existing.DocID {
				duplicate = true
				break
			}
			if candidate.DocID == "" && candidate.Filename == existing.Filename && candidate.URL == existing.URL {
				duplicate = true
				break
			}
		}
		if !duplicate {
			dst = append(dst, candidate)
		}
	}
	return dst
}

func downloadInfoString(value any) bool {
	switch v := value.(type) {
	case string:
		var parsed any
		if err := json.Unmarshal([]byte(v), &parsed); err != nil {
			return false
		}
		return isDownloadInfoValue(parsed)
	default:
		return isDownloadInfoValue(v)
	}
}

func isDownloadInfoValue(value any) bool {
	switch v := value.(type) {
	case map[string]any:
		return IsDownloadInfo(v)
	case map[string]string:
		for _, k := range []string{"doc_id", "filename", "mime_type"} {
			if _, ok := v[k]; !ok {
				return false
			}
		}
		return true
	case DownloadInfo:
		return v.DocID != "" && v.Filename != "" && v.MimeType != ""
	}
	return false
}

func downloadFromMap(m map[string]any) DownloadInfo {
	d := DownloadInfo{}
	if s, ok := m["doc_id"].(string); ok {
		d.DocID = s
	}
	if s, ok := m["filename"].(string); ok {
		d.Filename = s
	}
	if s, ok := m["mime_type"].(string); ok {
		d.MimeType = s
	}
	if s, ok := m["url"].(string); ok {
		d.URL = s
	}
	if d.URL == "" {
		if s, ok := m["download"].(string); ok {
			d.URL = s
		}
	}
	if s, ok := m["preview_url"].(string); ok {
		d.PreviewURL = s
		if d.URL == "" {
			d.URL = s
		}
	}
	if s, ok := m["content"].(string); ok {
		d.Content = s
	}
	if f, ok := m["size"].(float64); ok {
		d.Size = int(f)
	} else if i, ok := m["size"].(int); ok {
		d.Size = i
	}
	if b, ok := m["include_download_info_in_content"].(bool); ok {
		d.IncludeDownloadInfoInContent = b
	}
	return d
}

```

### Core Architecture Module: `internal/agent/runtime/state.go`
```
//
//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

// runtime — per-run shared state for canvas components.
//
// CanvasState lives here (not in the canvas package) so that the
// builder-side (canvas) and the implementation-side (component) can
// both depend on it without forming an import cycle. The canvas
// package owns DSL types and topology building; the component package
// owns the registered component implementations; both read/write
// CanvasState through this package.
//
// Concurrency: a single sync.RWMutex guards every map in CanvasState
// (plan §2.5 — "start simple"). Helper methods (GetVar / SetVar /
// ReadVars / Snapshot / etc.) lock internally; callers should not
// acquire OutputsLock unless they have a specific reason to extend a
// critical section.
package runtime

import (
	"encoding/json"
	"fmt"
	"maps"
	"reflect"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cloudwego/eino/compose"
)

// CanvasState is the per-run shared state bag that all components read/write
// through eino's StatePreHandler / StatePostHandler (compose/state.go).
//
// Fields mirror Python agent/canvas.py:43-95 with these mappings:
//   - Outputs     : cpn_id -> param_name -> resolved value (variable source)
//   - Sys         : sys.* namespace (query, user_id, conversation_turns, files)
//   - Env         : env.* namespace (deployment-time constants)
//   - Path        : entry-point sequence (Begin nodes)
//   - History     : conversation history (chat-flow agents)
//   - Memory      : tool-call summaries kept separate from conversation turns
//   - Retrieval   : aggregate retrieval result (chunks, doc_aggs)
//   - Globals     : cross-canvas-instance globals
//   - CancelFlag  : set when cancel signal received; nodes may poll
//   - RunID       : unique per-run identifier (used by RunTracker + CheckPointStore)
type CanvasState struct {
	mu                 sync.RWMutex
	activeHistoryIndex int
	Outputs            map[string]map[string]any
	Sys                map[string]any
	Env                map[string]any
	Path               []string
	History            []map[string]any
	Memory             []map[string]any
	Retrieval          map[string]any
	Globals            map[string]any
	CancelFlag         *atomic.Bool
	RunID              string
	SessionID          string
}

// NewCanvasState returns a zero-valued CanvasState with all maps allocated.
// The atomic CancelFlag is allocated eagerly so nodes can safely poll it
// even before any cancel signal has been wired.
func NewCanvasState(runID, sessionID string) *CanvasState {
	s := &CanvasState{
		activeHistoryIndex: -1,
		Outputs:            make(map[string]map[string]any),
		Sys:                make(map[string]any),
		Env:                make(map[string]any),
		Path:               []string{},
		History:            []map[string]any{},
		Memory:             []map[string]any{},
		Retrieval:          make(map[string]any),
		Globals:            make(map[string]any),
		CancelFlag:         &atomic.Bool{},
		RunID:              runID,
		SessionID:          sessionID,
	}
	s.EnsureSysDate()
	return s
}

// EnsureSysDate fills sys.date with the current local timestamp when it
// is missing or blank. Python canvas initializes the same variable with
// "%Y-%m-%d %H:%M:%S"; keep that wire format for DSL compatibility.
func (s *CanvasState) EnsureSysDate() {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Sys == nil {
		s.Sys = make(map[string]any)
	}
	if v, ok := s.Sys["date"]; ok && strings.TrimSpace(fmt.Sprint(v)) != "" {
		return
	}
	s.Sys["date"] = time.Now().Format("2006-01-02 15:04:05")
}

// init registers CanvasState with eino's internal type registry so
// that eino's StatePre/Post handler chain (which uses its own
// InternalSerializer, NOT stdlib encoding/json) recognises the
// type during the deepCopyState call that fires on every interrupt
// boundary. eino's serialization registry requires the type to
// implement both json.Marshaler AND json.Unmarshaler; CanvasState
// has both (below). Without this init, the interrupt path surfaces
// "failed to marshal state: unknown type: runtime.CanvasState"
// and the resume cycle is blocked at the eino layer.
func init() {
	_ = compose.RegisterSerializableType[CanvasState]("runtime.CanvasState")
}

// canvasStateJSON is the wire shape used by MarshalJSON / UnmarshalJSON.
// Defined so the field tags and omitempty semantics are pinned in one
// place. The CancelFlag is round-tripped as a bool (atomic.Bool can't
// be marshalled directly without a wrapper).
type canvasStateJSON struct {
	ActiveHistoryIndex *int                      `json:"active_history_index,omitempty"`
	Outputs            map[string]map[string]any `json:"outputs"`
	Sys                map[string]any            `json:"sys,omitempty"`
	Env                map[string]any            `json:"env,omitempty"`
	Path               []string                  `json:"path,omitempty"`
	History            []map[string]any          `json:"history,omitempty"`
	Memory             []map[string]any          `json:"memory,omitempty"`
	Retrieval          map[string]any            `json:"retrieval,omitempty"`
	Globals            map[string]any            `json:"globals,omitempty"`
	CancelFlag         bool                      `json:"cancel_flag"`
	RunID              string                    `json:"run_id"`
	SessionID          string                    `json:"session_id"`
}

// MarshalJSON serialises the CanvasState for eino's StatePre/Post
// handler chain (which JSON-encodes the state on every node boundary
// when a StateSerializer is wired) and for Kvrocks-backed CheckPointStore
// payloads.
//
// Eino's interrupt path hit "failed to marshal state: unknown
// type: runtime.CanvasState"
// because the struct had no MarshalJSON and contained a sync.RWMutex
// (unexported) + atomic.Bool (indirected; serialises as 8 bytes
// without explicit handling). This hook defines the stable wire shape
// (canvasStateJSON) and serialises through it.
//
// Concurrency: the lock is held briefly while we snapshot the maps;
// readers may briefly block during marshal, which is fine for the
// checkpoint/serializer hot path. The lock is read-only so concurrent
// SetVar calls also proceed.
func (s *CanvasState) MarshalJSON() ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var activeHistoryIndex *int
	if s.activeHistoryIndex >= 0 {
		index := s.activeHistoryIndex
		activeHistoryIndex = &index
	}
	snap := canvasStateJSON{
		ActiveHistoryIndex: activeHistoryIndex,
		Outputs:            s.Outputs,
		Sys:                s.Sys,
		Env:                s.Env,
		Path:               s.Path,
		History:            s.History,
		Memory:             s.Memory,
		Retrieval:          s.Retrieval,
		Globals:            s.Globals,
		CancelFlag:         s.CancelFlag != nil && s.CancelFlag.Load(),
		RunID:              s.RunID,
		SessionID:          s.SessionID,
	}
	// Use SafeJSONMarshal to handle non-serializable values (funcs,
	// channels) that may have leaked into state maps. Mirrors the
	// Python PR #14210 _serialize_default fallback in Graph.__str__.
	return SafeJSONMarshal(snap)
}

// UnmarshalJSON restores the wire shape produced by MarshalJSON.
// Cancels the read-lock contention: an unmarshal only happens during
// checkpoint restore (rare) and boot, so we accept the lock-acquire
// cost. atomic.Bool is allocated so the loaded value lands on a real
// pointer (nodes may poll it concurrently with unmarshal completion).
func (s *CanvasState) UnmarshalJSON(b []byte) error {
	var snap canvasStateJSON
	if err := json.Unmarshal(b, &snap); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Outputs = snap.Outputs
	s.Sys = snap.Sys
	s.Env = snap.Env
	s.Path = snap.Path
	s.History = snap.History
	s.activeHistoryIndex = -1
	if snap.ActiveHistoryIndex != nil {
		s.activeHistoryIndex = *snap.ActiveHistoryIndex
	}
	s.Memory = snap.Memory
	s.Retrieval = snap.Retrieval
	s.Globals = snap.Globals
	s.ensureInitializedLocked()
	s.CancelFlag.Store(snap.CancelFlag)
	s.RunID = snap.RunID
	s.SessionID = snap.SessionID
	return nil
}

// GetVar resolves a variable reference to its current value.
//
// Supported forms (matches plan §2.5 + agent/canvas.py:168-239):
//
//	"cpn_id@param"        — Outputs[cpn_id][param]
//	"cpn_id@param.path"   — dot-path traversal on Outputs[cpn_id][param]
//	"sys.x"               — Sys["x"]   (also "sys.x.path")
//	"env.x"               — Env["x"]   (also "env.x.path")
//	"item"                — iteration alias (nil if unset)
//	"index"               — iteration alias (nil if unset)
//
// An unknown cpn_id returns (nil, nil) — mirrors Python's "treat as literal"
// fallback (canvas.py:494-495).
func (s *CanvasState) GetVar(ref string) (any, error) {
	if ref == "" {
		return nil, fmt.Errorf("canvas: empty variable reference")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return getVarLocked(s, ref)
}

// SetVar writes Outputs[cpnID][param] = v. Nested keys separated by "." are
// auto-created (mirrors Python's set_variable_param_value at
// canvas.py:261-271). The lock is held for the entire walk to keep
// "walk + assign" atomic under concurrent writers.
func (s *CanvasState) SetVar(cpnID, param string, v any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureInitializedLocked()
	setVarLocked(s.Outputs, cpnID, param, v)
}

// ReadVars resolves a list of {{...}} references against the 
```

### Core Architecture Module: `internal/agent/workflowx/loop.go`
```
//
//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//

// Package workflowx is a zero-intrusion extension to the eino compose
// package. It does NOT modify eino source. Instead it provides a small
// set of helpers that build on eino's public API to add features the
// core package does not expose directly.
//
// Currently the package exposes one helper, AddLoopNode, which models
// "repeatedly execute a nested workflow until a condition is met" as
// a normal workflow node. See the .claude/plans/eino-workflow-loop.md
// plan for the design rationale.
//
// # Foundation for the canvas Loop component
//
// AddLoopNode is also the runtime driver for the RAGFlow agent canvas's
// "Loop" component (internal/agent/component/loop.go). The canvas engine
// (internal/agent/canvas/scheduler.go) recognises a "Loop" cpn in the
// DSL and uses buildLoopExpansion (canvas/loop_subgraph.go) to:
//
//  1. collect the Loop's downstream descendants into a sub-Workflow;
//  2. prepend a synthetic init lambda that seeds the DSL's
//     loop_variables into the per-run *CanvasState;
//  3. translate the DSL's loop_termination_condition list into a
//     LoopCondition[map[string]any] closure that reads the same state
//     slots via state.GetVar on every iteration; and
//  4. call AddLoopNode here to install a single eino node in place
//     of what would otherwise be a Python-era Loop + LoopItem pair.
//
// The condition operators (string / bool / number / dict / list / nil)
// and the AND/OR combiner implemented by translateLoopCondition are
// the same set that agent/component/loopitem.py:48-122 expresses in
// Python. The DSL's `loop_variables` initial value semantics
// (constant / variable / zero-init-by-type) match
// agent/component/loop.py:60-77.
package workflowx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"

	"github.com/google/uuid"

	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
)

// LoopStreamMode controls how the loop node surfaces iteration streams
// to its downstream consumers. The first release supports two modes;
// see the plan §"Stream support" section for the rationale.
type LoopStreamMode string

const (
	// LoopStreamFinalOnly buffers all iterations and exposes ONLY the
	// final iteration's stream to the caller. This is the default and
	// the safest mode because downstream consumers cannot observe
	// intermediate iteration boundaries.
	LoopStreamFinalOnly LoopStreamMode = "final_only"

	// LoopStreamEveryIteration exposes each iteration's stream in
	// sequence. Resume is iteration-granular: iterations already
	// fully published are not replayed, while the interrupted
	// iteration may be replayed from its start.
	LoopStreamEveryIteration LoopStreamMode = "every_iteration"
)

// defaultMaxIterations is a safety guard used only when the caller does not
// configure an explicit limit. The cap is intentionally generous to
// accommodate real workflows (deep research, iterative refinement) but
// is finite so a bug in the quit condition cannot spin forever.
const defaultMaxIterations = 1024

// LoopCondition is the per-iteration exit predicate. It is invoked
// AFTER each completed iteration (i.e. after the sub-workflow has
// returned a value for iteration N), with N starting at 1.
//
// Parameters:
//   - ctx: the loop lambda's context. Cancellation here aborts the
//     loop the same as cancellation anywhere else in the run.
//   - iteration: 1-based index of the iteration that just finished.
//     iteration == 1 on the first call, iteration == 2 after the
//     second sub-workflow run, and so on.
//   - prev: the value that was fed INTO the just-finished iteration
//     as the sub-workflow's input. On iteration 1 this is the outer
//     loop node's input; on iteration N>1 it is the `next` value
//     produced by iteration N-1 (i.e. the previous iteration's
//     output, which becomes this iteration's input).
//   - next: the value the sub-workflow PRODUCED for this iteration.
//     If the predicate returns (true, nil) this is the value that
//     becomes the loop's final output.
//
// Returning (true, nil) ends the loop; the last `next` value becomes
// the loop's final output. Returning (false, nil) advances to the
// next iteration with `next` rewritten as the upcoming `prev`.
// Returning a non-nil error fails the entire loop run.
type LoopCondition[T any] func(ctx context.Context, iteration int, prev, next T) (bool, error)

// Sentinel errors. Tests use errors.Is to assert these.
var (
	// ErrLoopMaxIterationsExceeded is returned when the default safety
	// cap is reached without shouldQuit returning true. Explicit loop
	// limits are normal termination, matching the canvas Python runtime.
	ErrLoopMaxIterationsExceeded = errors.New("workflowx: loop max iterations exceeded")

	// ErrLoopSubGraphInterrupted is wrapped around an interrupt error
	// emitted by the sub-workflow. The original interrupt is still
	// accessible via errors.Unwrap for callers that want to inspect
	// it.
	ErrLoopSubGraphInterrupted = errors.New("workflowx: sub-workflow interrupted")

	// ErrLoopResumeStateInvalid is returned when the loop is being
	// resumed but the saved state is missing, malformed, or refers
	// to a non-positive iteration. This is a hard failure: the loop
	// cannot safely continue from an inconsistent starting point.
	ErrLoopResumeStateInvalid = errors.New("workflowx: resume state invalid")

	// ErrLoopQuitConditionFailed wraps a non-nil error returned by
	// the user-supplied LoopCondition. The loop aborts immediately.
	ErrLoopQuitConditionFailed = errors.New("workflowx: quit condition failed")
)

// LoopOption configures AddLoopNode. LoopOption follows the same
// functional-options pattern as the rest of the eino public API.
type LoopOption func(*loopOptions)

type loopOptions struct {
	maxIterations       int
	maxIterationsSet    bool
	compileOpts         []compose.GraphCompileOption
	runOpts             []compose.Option
	streamMode          LoopStreamMode
	checkpointBuilder   func(nodeKey string, iteration int) string
	enableSubCheckpoint bool
	onStart             func(context.Context, any)
	onFinish            func(context.Context, error)
	snapshotState       func(context.Context) ([]byte, error)
	restoreState        func(context.Context, []byte) error
}

// WithLoopMaxIterations caps the loop at n iterations. The cap is checked
// AFTER each completed iteration. A value of 0 keeps the default safety cap in
// effect. A positive value is normal loop termination, not an error; this
// matches the canvas Python runtime's maximum_loop_count semantics. A value of
// 1 is legal and yields the single-iteration do-while case.
func WithLoopMaxIterations(n int) LoopOption {
	return func(o *loopOptions) {
		if n > 0 {
			o.maxIterations = n
			o.maxIterationsSet = true
		}
	}
}

// WithLoopCompileOptions appends compile options to the inner sub-
// workflow's Compile call. Useful for wiring a CheckPointStore or
// Serializer just for the sub-graph.
func WithLoopCompileOptions(opts ...compose.GraphCompileOption) LoopOption {
	return func(o *loopOptions) {
		o.compileOpts = append(o.compileOpts, opts...)
	}
}

// WithLoopLifecycleHooks installs callbacks around the outer loop node's
// execution. Canvas uses this to emit node lifecycle events for the Loop macro
// without relying on eino state post-processing, which is unsafe for streamed
// multi-iteration output.
func WithLoopLifecycleHooks(onStart func(context.Context, any), onFinish func(context.Context, error)) LoopOption {
	return func(o *loopOptions) {
		o.onStart = onStart
		o.onFinish = onFinish
	}
}

// WithLoopStatePersistence preserves caller-owned state across an interrupted
// loop execution.
func WithLoopStatePersistence(snapshot func(context.Context) ([]byte, error), restore func(context.Context, []byte) error) LoopOption {
	return func(o *loopOptions) {
		o.snapshotState = snapshot
		o.restoreState = restore
	}
}

// WithLoopRunOptions appends run options to every nested sub-workflow
// Invoke / Stream call. Use this to forward run-level options such as
// per-iteration callbacks or extra callbacks.
func WithLoopRunOptions(opts ...compose.Option) LoopOption {
	return func(o *loopOptions) {
		o.runOpts = append(o.runOpts, opts...)
	}
}

// WithLoopStream overrides the default LoopStreamFinalOnly mode.
// See the LoopStreamMode documentation for per-mode semantics.
func WithLoopStream(mode LoopStreamMode) LoopOption {
	return func(o *loopOptions) {
		if mode == LoopStreamFinalOnly || mode == LoopStreamEveryIteration {
			o.streamMode = mode
		}
	}
}

// WithLoopCheckpointIDBuilder supplies a deterministic checkpoint ID
// for each sub-workflow invocation. eino does not expose the active
// outer checkpoint ID through ctx, so the loop extension cannot
// derive child IDs by itself.
//
// If the builder is not supplied, a reserved-namespace default is
// used that combines the loop node key and the iteration number with
// a UUID. The default is fine for ad-hoc invocations but does NOT
// guarantee re-entrant resume: a resumed run would derive a fresh
// UUID and the sub-workflow would not find the partial state from
// the interrupted run. Production callers that need checkpoint/
// resume MUST supply a builder that returns stable IDs across
// invocations (e.g. "<parent-id>:<nodeKey>:<iteration>").
func WithLoo
```

### Core Architecture Module: `internal/binding/cpp/opencc/utils.c`
```
/*
 * Open Chinese Convert
 *
 * Copyright 2010 BYVoid <byvoid.kcp@gmail.com>
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

#include "utils.h"

void perr(const char *str) { fputs(str, stderr); }

int qsort_int_cmp(const void *a, const void *b) { return *((int *)a) - *((int *)b); }

char *mstrcpy(const char *str) {
    size_t len = strlen(str);
    char *strbuf = (char *)malloc(sizeof(char) * (len + 1));
    strncpy(strbuf, str, len);
    strbuf[len] = '\0';
    return strbuf;
}

char *mstrncpy(const char *str, size_t n) {
    char *strbuf = (char *)malloc(sizeof(char) * (n + 1));
    strncpy(strbuf, str, n);
    strbuf[n] = '\0';
    return strbuf;
}

```

### Core Architecture Module: `internal/binding/cpp/opencc/utils.h`
```
/*
 * Open Chinese Convert
 *
 * Copyright 2010 BYVoid <byvoid.kcp@gmail.com>
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

#ifndef __OPENCC_UTILS_H_
#define __OPENCC_UTILS_H_

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "opencc_types.h"

#ifdef __cplusplus
extern "C" {
#endif

#define FALSE (0)
#define TRUE (!(0))
#define INFINITY_INT ((~0U) >> 1)

#ifndef BIG_ENDIAN
#define BIG_ENDIAN (0)
#endif

#ifndef LITTLE_ENDIAN
#define LITTLE_ENDIAN (1)
#endif

#ifdef ENABLE_GETTEXT
#include <libintl.h>
#include <locale.h>
#define _(STRING) dgettext(PACKAGE_NAME, STRING)
#else
#define _(STRING) STRING
#endif

#define debug_should_not_be_here()                                                                                                                   \
    do {                                                                                                                                             \
        fprintf(stderr, "Should not be here %s: %d\n", __FILE__, __LINE__);                                                                          \
        assert(0);                                                                                                                                   \
    } while (0)

void perr(const char *str);

int qsort_int_cmp(const void *a, const void *b);

char *mstrcpy(const char *str);

char *mstrncpy(const char *str, size_t n);

#ifdef __cplusplus
};
#endif

#endif /* __OPENCC_UTILS_H_ */

```

### Core Architecture Module: `internal/binding/cpp/stemmer/utilities.cpp`
```
// Copyright(C) 2023 InfiniFlow, Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include "header.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define unless(C) if (!(C))

#define CREATE_SIZE 1

extern symbol *create_s(void) {
    symbol *p;
    void *mem = malloc(HEAD + (CREATE_SIZE + 1) * sizeof(symbol));
    if (mem == NULL)
        return NULL;
    p = (symbol *)(HEAD + (char *)mem);
    CAPACITY(p) = CREATE_SIZE;
    SET_SIZE(p, CREATE_SIZE);
    return p;
}

extern void lose_s(symbol *p) {
    if (p == NULL)
        return;
    free((char *)p - HEAD);
}

/*
   new_p = skip_utf8(p, c, lb, l, n); skips n characters forwards from p + c
   if n +ve, or n characters backwards from p + c - 1 if n -ve. new_p is the new
   position, or 0 on failure.

   -- used to implement hop and next in the utf8 case.
*/

extern int skip_utf8(const symbol *p, int c, int lb, int l, int n) {
    int b;
    if (n >= 0) {
        for (; n > 0; n--) {
            if (c >= l)
                return -1;
            b = p[c++];
            if (b >= 0xC0) { /* 1100 0000 */
                while (c < l) {
                    b = p[c];
                    if (b >= 0xC0 || b < 0x80)
                        break;
                    /* break unless b is 10------ */
                    c++;
                }
            }
        }
    } else {
        for (; n < 0; n++) {
            if (c <= lb)
                return -1;
            b = p[--c];
            if (b >= 0x80) { /* 1000 0000 */
                while (c > lb) {
                    b = p[c];
                    if (b >= 0xC0)
                        break; /* 1100 0000 */
                    c--;
                }
            }
        }
    }
    return c;
}

/* Code for character groupings: utf8 cases */

static int get_utf8(const symbol *p, int c, int l, int *slot) {
    int b0, b1;
    if (c >= l)
        return 0;
    b0 = p[c++];
    if (b0 < 0xC0 || c == l) { /* 1100 0000 */
        *slot = b0;
        return 1;
    }
    b1 = p[c++];
    if (b0 < 0xE0 || c == l) { /* 1110 0000 */
        *slot = (b0 & 0x1F) << 6 | (b1 & 0x3F);
        return 2;
    }
    *slot = (b0 & 0xF) << 12 | (b1 & 0x3F) << 6 | (p[c] & 0x3F);
    return 3;
}

static int get_b_utf8(const symbol *p, int c, int lb, int *slot) {
    int b0, b1;
    if (c <= lb)
        return 0;
    b0 = p[--c];
    if (b0 < 0x80 || c == lb) { /* 1000 0000 */
        *slot = b0;
        return 1;
    }
    b1 = p[--c];
    if (b1 >= 0xC0 || c == lb) { /* 1100 0000 */
        *slot = (b1 & 0x1F) << 6 | (b0 & 0x3F);
        return 2;
    }
    *slot = (p[c] & 0xF) << 12 | (b1 & 0x3F) << 6 | (b0 & 0x3F);
    return 3;
}

extern int in_grouping_U(struct SN_env *z, const unsigned char *s, int min, int max, int repeat) {
    do {
        int ch;
        int w = get_utf8(z->p, z->c, z->l, &ch);
        unless(w) return -1;
        if (ch > max || (ch -= min) < 0 || (s[ch >> 3] & (0X1 << (ch & 0X7))) == 0)
            return w;
        z->c += w;
    } while (repeat);
    return 0;
}

extern int in_grouping_b_U(struct SN_env *z, const unsigned char *s, int min, int max, int repeat) {
    do {
        int ch;
        int w = get_b_utf8(z->p, z->c, z->lb, &ch);
        unless(w) return -1;
        if (ch > max || (ch -= min) < 0 || (s[ch >> 3] & (0X1 << (ch & 0X7))) == 0)
            return w;
        z->c -= w;
    } while (repeat);
    return 0;
}

extern int out_grouping_U(struct SN_env *z, const unsigned char *s, int min, int max, int repeat) {
    do {
        int ch;
        int w = get_utf8(z->p, z->c, z->l, &ch);
        unless(w) return -1;
        unless(ch > max || (ch -= min) < 0 || (s[ch >> 3] & (0X1 << (ch & 0X7))) == 0) return w;
        z->c += w;
    } while (repeat);
    return 0;
}

extern int out_grouping_b_U(struct SN_env *z, const unsigned char *s, int min, int max, int repeat) {
    do {
        int ch;
        int w = get_b_utf8(z->p, z->c, z->lb, &ch);
        unless(w) return -1;
        unless(ch > max || (ch -= min) < 0 || (s[ch >> 3] & (0X1 << (ch & 0X7))) == 0) return w;
        z->c -= w;
    } while (repeat);
    return 0;
}

/* Code for character groupings: non-utf8 cases */

extern int in_grouping(struct SN_env *z, const unsigned char *s, int min, int max, int repeat) {
    do {
        int ch;
        if (z->c >= z->l)
            return -1;
        ch = z->p[z->c];
        if (ch > max || (ch -= min) < 0 || (s[ch >> 3] & (0X1 << (ch & 0X7))) == 0)
            return 1;
        z->c++;
    } while (repeat);
    return 0;
}

extern int in_grouping_b(struct SN_env *z, const unsigned char *s, int min, int max, int repeat) {
    do {
        int ch;
        if (z->c <= z->lb)
            return -1;
        ch = z->p[z->c - 1];
        if (ch > max || (ch -= min) < 0 || (s[ch >> 3] & (0X1 << (ch & 0X7))) == 0)
            return 1;
        z->c--;
    } while (repeat);
    return 0;
}

extern int out_grouping(struct SN_env *z, const unsigned char *s, int min, int max, int repeat) {
    do {
        int ch;
        if (z->c >= z->l)
            return -1;
        ch = z->p[z->c];
        unless(ch > max || (ch -= min) < 0 || (s[ch >> 3] & (0X1 << (ch & 0X7))) == 0) return 1;
        z->c++;
    } while (repeat);
    return 0;
}

extern int out_grouping_b(struct SN_env *z, const unsigned char *s, int min, int max, int repeat) {
    do {
        int ch;
        if (z->c <= z->lb)
            return -1;
        ch = z->p[z->c - 1];
        unless(ch > max || (ch -= min) < 0 || (s[ch >> 3] & (0X1 << (ch & 0X7))) == 0) return 1;
        z->c--;
    } while (repeat);
    return 0;
}

extern int eq_s(struct SN_env *z, int s_size, const symbol *s) {
    if (z->l - z->c < s_size || memcmp(z->p + z->c, s, s_size * sizeof(symbol)) != 0)
        return 0;
    z->c += s_size;
    return 1;
}

extern int eq_s_b(struct SN_env *z, int s_size, const symbol *s) {
    if (z->c - z->lb < s_size || memcmp(z->p + z->c - s_size, s, s_size * sizeof(symbol)) != 0)
        return 0;
    z->c -= s_size;
    return 1;
}

extern int eq_v(struct SN_env *z, const symbol *p) { return eq_s(z, SIZE(p), p); }

extern int eq_v_b(struct SN_env *z, const symbol *p) { return eq_s_b(z, SIZE(p), p); }

extern int find_among(struct SN_env *z, const struct among *v, int v_size) {

    int i = 0;
    int j = v_size;

    int c = z->c;
    int l = z->l;
    symbol *q = z->p + c;

    const struct among *w;

    int common_i = 0;
    int common_j = 0;

    int first_key_inspected = 0;

    while (1) {
        int k = i + ((j - i) >> 1);
        int diff = 0;
        int common = common_i < common_j ? common_i : common_j; /* smaller */
        w = v + k;
        {
            int i2;
            for (i2 = common; i2 < w->s_size; i2++) {
                if (c + common == l) {
                    diff = -1;
                    break;
                }
                diff = q[common] - w->s[i2];
                if (diff != 0)
                    break;
                common++;
            }
        }
        if (diff < 0) {
            j = k;
            common_j = common;
        } else {
            i = k;
            common_i = common;
        }
        if (j - i <= 1) {
            if (i > 0)
                break; /* v->s has been inspected */
            if (j == i)
                break; /* only one item in v */

            /* - but now we need to go round once more to get
               v->s inspected. This looks messy, but is actually
               the optimal approach.  */

            if (first_key_inspected)
                break;
            first_key_inspected = 1;
        }
    }
    while (1) {
        w = v + i;
        if (common_i >= w->s_size) {
            z->c = c + w->s_size;
            if (w->function == 0)
                return w->result;
            {
                int res = w->function(z);
                z->c = c + w->s_size;
                if (res)
                    return w->result;
            }
        }
        i = w->substring_i;
        if (i < 0)
            return 0;
    }
}

/* find_among_b is for backwards processing. Same comments apply */

extern int find_among_b(struct SN_env *z, const struct among *v, int v_size) {

    int i = 0;
    int j = v_size;

    int c = z->c;
    int lb = z->lb;
    symbol *q = z->p + c - 1;

    const struct among *w;

    int common_i = 0;
    int common_j = 0;

    int first_key_inspected = 0;

    while (1) {
        int k = i + ((j - i) >> 1);
        int diff = 0;
        int common = common_i < common_j ? common_i : common_j;
        w = v + k;
        {
            int i2;
            for (i2 = w->s_size - 1 - common; i2 >= 0; i2--) {
                if (c - common == lb) {
                    diff = -1;
                    break;
                }
                diff = q[-common] - w->s[i2];
                if (diff != 0)
                    break;
                common++;
            }
        }
        if (diff < 0) {
            j = k;
            common_j = common;
        } else {
            i = k;
            common_i = common;
        }
        if (j - i <= 1) {
            if (i > 0)
                break;
            if (j == i)
                break;
            if (first_key_inspected)
                break;
            first_key_inspected = 1;
        }
    }
    while (1) {
        w = v + i;
        if (common_i >= w->s_size) {
            z->c = c - w->s_size;
            if (w->function == 0)
  
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20071** (2026-09-23): **fix(parser): replace slog.Debug with common.Debug+zap in toc_header_footer**
  *Symptoms*: ## Summary  Three `slog.Debug` calls in `toc_header_footer.go` used the stdlib `log/slog` API (alternating key/value string pairs), but `log/slog` was never imported in this file. The file's established logging convention is `go.uber.org/zap` via `ragflow/internal/common`. This caused a compile error:  ``` internal/deepdoc/parser/pdf/layout/toc_header_footer.go:868:4: undefined: slog internal/deepdoc/parser/pdf/layout/toc_header_footer.go:914:3: undefined: slog internal/deepdoc/parser/pdf/layout/toc_header_footer.go:1021:3: undefined: slog ```  ## Changes  - Replace three `slog.Debug(...)` calls with `common.Debug(...)` using typed `zap.Int` / `zap.String` field arguments, consistent with every other `common.Debug` call in the same function.  | Line | Before | After | |------|--------|-------| | 868 | `slog.Debug("header_footer: dropped by site promo", "page", ..., "textLen", ...)` | `common.Debug("...", zap.Int("page", ...), zap.Int("textLen", ...))` | | 914 | `slog.Debug("header_footer: dropped by promo companion", "page", ..., "zone", ..., "textLen", ...)` | `common.Debug("...", zap.Int("page", ...), zap.String("zone", ...), zap.Int("textLen", ...))` | | 1021 | `slog.Debug("header_footer: dropped by page-number sequence", "boxes", ...)` | `common.Debug("...", zap.Int("boxes", ...))` |  ## Test Plan  - `bash build.sh --test ragflow/internal/deepdoc/parser/pdf/layout/...` passes: `ok ragflow/internal/deepdoc/parser/pdf/layout 0.010s` - Full CLI binary build with `-tags cgo,s
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/infiniflow/ragflow/pull/20071"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `abd5c2e5-f587-41c6-932e-07c8100f55a2`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 04090ada0f6aaaf2ee1cd0886064989ace4e1029 and b7818a69345f2

- **Issue #19403** (2026-09-17): **fix(go/pdf): clear fragmented TOC pages in DeepDOC postprocess**
  *Symptoms*: ## Summary  DeepDoc layout splits one TOC line (chapter title + subtitle + leader dots + page number) into unadjacent sections, so the anchored title pass and the entry-line filter in the Go PDF postprocess leave whole bare-title runs behind on headingless TOC pages. Reproduced on a real book PDF (202 sections, 0 outlines): only 27 of ~94 TOC fragments removed, 67 bare chapter titles leaked into chunks.  Adds page-level classification before entry-line filtering across all TOC removal branches (including headingless TOCs with page-1 outlines): a page with >=5 title-like and >=3 page-number-like fragments and zero body-length prose is classified as a fragmented TOC page; clears title candidates, entry lines, page fragments and anchored short text on it. Long chapter titles in the default text layout count as TOC signals, not body prose. Book titles, roman-numeral markers (I, V, X, L, C, D, M), long prose and table/figure sections are kept; mixed pages degrade to untouched. No URL/keyword heuristics: a URL reference line is ordinary text and is never deleted.  Known limitation: TOC pages carrying a long watermark line without URL signature still veto via body. Watermark handling belongs to a future cross-page frequency pass, not to this classifier.  ## Changes  - `internal/parser/parser/pdf_postprocess.go`:   - Add `filterPDFTOCFragmentPages` pass (runs between anchored pass and entry-line filter) with page grouping, deletability checks, and anchor neighbor validation.   - Run 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/infiniflow/ragflow/pull/19403#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/infiniflow/ragflow/pull/19403#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review paused by coderabbit.ai -->  > [!NOTE] > ## Reviews paused >  > It looks like this branch is under active development. To avoid overwhelming you with review comments due to an influx of new commits, CodeRabbit has automatically paused this review. You can configure this behavior by changing the `review

- **Issue #19326** (2026-09-08): **fix(memory): align extracted message document id with message_id**
  *Symptoms*: ### Summary Fix an issue where viewing extracted memory messages (semantic, episodic, procedural) fails with 404 / `ResourceNotFoundError` after extraction completes successfully.  When a raw conversation message is processed by the async memory extractor, extracted memory chunks were previously indexed with a custom composite ID (`<memory_id>_<source_id>_<hash>`). However, `GetMessageContent` and the REST API query the chunk store by `<memory_id>_<message_id>`. This ID mismatch caused chunk lookups to fail with 404 Not Found.  ### Related Issue N/A  ### Changes - **Internal Service (`internal/service/memory_extractor.go`)**:   - Aligned extracted message document `id` directly to `fmt.Sprintf("%s_%d", memoryID, messageID)`, matching the system-wide chunk ID contract and `GetMessageContent`.   - Removed `extractedMessageDocumentID` and the unused `"crypto/sha256"` import. - **Unit Tests (`internal/service/memory_extractor_test.go`)**:   - Replaced `TestBuildExtractedMessageUsesStableDocumentIDAcrossRetries` with `TestBuildExtractedMessageUsesStandardDocumentID` to verify extracted messages use `memoryID_messageID` format.  ### Test Plan - Run Go unit tests:   ```bash   bash build.sh --test ./internal/service/...   ```   Result: All package tests passed cleanly (exit code 0).
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/infiniflow/ragflow/pull/19326)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Team  **Run ID**: `adc896d4-ea84-4ad1-9737-e68eee4157c1`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between f8b0a1de197011704c325ef93d8164ff1c43f02a and f789cbc75cd435ef3f123bf4e4acb129348ff1a0.  </details>  <details> <summary>📒 Files selected for processing (2)</summary>  * `internal/service/memory_extractor.go` * `internal/service/memory_extractor_test.go`  </details>  **Included review ava

- **Issue #18278** (2026-08-18): **fix(ingestion): stop orphaned task messages under backpressure and reconcile stuck tasks**
  *Symptoms*: ### Summary  When batch-parsing a batch of files, only the first few files completed; the rest stayed stuck in "parsing" forever.  **Root cause (verified in logs + DB + live NATS):** the ingestor's consume loop fetched a fixed `4` messages per iteration while its worker channel held only `maxConcurrency*2` (2 with the default `max_concurrent_workers: 1`). Overflowing messages were **Nacked** (`msg.Nak()`, ~1s redelivery). The NATS consumer has `MaxDeliver: 16`, and repeated Nacks exhaust it: the message stops being delivered and is orphaned until the consumer is recreated. Because `processMessage` calls `StartRunning` **before** the Nack, the task stays `RUNNING` with the document in "parsing" forever. Log evidence: 1293 `No available slot` nacks; one task (`037b2382`) nacked 16× in 16s.  Empirical check (throwaway workqueue stream): MaxDeliver exhaustion does **not** hard-delete the message — it stays in the stream and resurrects only when the consumer is deleted/recreated (i.e. on ingestor restart). Without a restart the task is wedged indefinitely.  ### Changes  **Layer 1 — the consume side no longer drops messages under backpressure:** - `consumeLoop` fetches only as many messages as the worker channel can currently absorb (`cap(taskChan)-len(taskChan)`), so it can never overflow. - New `Ingestor.queueTaskCtx`: when the channel is full it **blocks** (with a `startHeartbeat` keeping the broker AckWait fresh) instead of Nacking. Only graceful shutdown aborts the wait and Na
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/infiniflow/ragflow/pull/18278?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `a453b082-4e24-40dc-b786-12d60acd72d4`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 85c5c8b4900c9ba8138c2891fffe47876fd34279 and 1f1fa937e606555179ce53e51ede2d5249f8d9ba.  </details>  <details> <summary>📒 Files selected for proce
  > ## [Codecov](https://app.codecov.io/gh/infiniflow/ragflow/pull/18278?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=infiniflow) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 90.65%. Comparing base ([`c23d5fc`](https://app.codecov.io/gh/infiniflow/ragflow/commit/c23d5fc819944eeb9ddaf535c481e233df39d610?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=infiniflow)) to head ([`1f1fa93`](https://app.codecov.io/gh/infiniflow/ragflow/commit/1f1fa937e606555179ce53e51ede2d5249f8d9ba?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=infiniflow)). :warning: Report is 13 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ 
  > Addressed all CodeRabbit review comments in `85c5c8b49`:  **Actionable** 1. 🔴 `startHeartbeat` nil `IngestionTask` — now derives the task ID from `Handle.GetMessage().TaskID` for memory-task contexts (and added `TestProcessMessage_MemoryTaskChannelFullBlocks` as a regression test). 2. 🟠 Document reset staleness bound — `ListRunningWithoutIngestionTask` now requires `document.update_date < now-5min` (new `orphanedDocumentResetAfter` const); added tests for stale-reset and fresh-kept. 3. 🟠 Durable liveness instead of in-process claims — the worker heartbeat now `Touch`es the task row on every tick and `failHungTask` no longer uses `isClaimed`; the hung-candidate test was rewritten to assert the durable watermark (`TestReconcile_SkipsHeartbeatedTask`). 4. 🟡 Compiler-pool docs — `MaxConcurrentWorkers` doc now describes only ingestion-task concurrency; `CompilerPoolSize` documented as passed independently by `cmd/ragflow_server.go` with zero = vCPU default.  **Nitpicks** - `ListRunningW

- **Issue #18145** (2026-08-26): **PDF parser interleaves tiled text-layer watermark into every chunk (degrades LLM extraction)**
  *Symptoms*: ## Problem  Parsing a resume PDF (downloaded from a Chinese resume-template site) with the Go DeepDOC PDF parser (`internal/deepdoc/parser/pdf`) produces chunk text polluted by a **tiled, repeated watermark string**. The watermark glyphs are interleaved with the real resume content in reading order, so **every** chunk carries the garbage — and the garbage is then sent verbatim to the LLM by the ingestion Extractor, wasting tokens and degrading metadata-extraction quality.  Real user message that reached the LLM during resume metadata extraction (field_name=metadata):  ```text Content: ~~ Qcd623406a1ecf65c1HZ42dm0GFRTxYi2V_ydWOWgnP_UNhRq2Q~~ 2qRhNU_P ng W O Wdy_V2iYxTR 简   历 ZH1c56f姓    名：冯浩楠                         性    别：男 ce1a60年    龄：22 岁 ... F G0 md24 ~ ~ 教育经历 q2021.09 - 2025.07    南阳理工学院     软件工程专业  本科 Q 2 R h N U相关技能： 1. 熟悉软件测试的理论与流程 ... ```  ## Root cause  The noise is **not** OCR garbage — it is a tiled watermark stored as **real text in the PDF's text layer**, read deterministically and interleaved by position. Evidence:  1. The token sequence `Q2qRhNU_Png W O Wdy_V2iYxTR F G0 md24 ZH1c56f ce1a604326dc` repeats **verbatim ~6×** across pages/chunks. A 66-char random string would never be OCR'd identically 6 times — deterministic text-layer extraction. 2. The tokens decode to random bytes (not an encoded message) — they look like template-site document-ID watermarks. 3. Single glyphs on their own lines (`Q`, `2`, `R`, `h`, `N`, `U`, `_`, `P`, `n`, `g`, `W`) are the sig

- **Issue #18087** (2026-08-11): **Fix: stabilize agent log handleSearch and preserve page_size on reset**
  *Symptoms*: ### Summary  Fix: stabilize agent log handleSearch and preserve page_size on reset  Wrap handleSearch in useCallback with explicit deps so the effect that re-runs search on pagination/sort change stays stable. Keep page_size when resetting filters instead of clobbering it back to the initial default, and align TableHeader background with the bg-bg-title token.  
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/infiniflow/ragflow/pull/18087?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The agent log page now memoizes its search handler, tracks it in the search effect, preserves page size during reset, and uses an updated table header background token.  ### Changes  **Agent log page**  |Layer / File(s)|Summary| |---|---| |**Search callback and reset behavior** <br> `web/src/pages/agents/agent-log-page.tsx`|`handleSearch` uses `useCallback` with search-state dependencies. The search effect tracks the callback. Reset preserves the current pagination page size.| |**Table header styling** <br>

- **Issue #17112** (2026-07-20): **Fix: model selection format compat and provider api_key wrapping**
  *Symptoms*: ### Summary  Fix: model selection format compat and provider api_key wrapping 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/infiniflow/ragflow/pull/17112?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  Model selection now supports composed identity values when IDs are unavailable, and default-model requests accept either IDs or provider-specific fields. Provider configuration transforms also nest auxiliary metadata inside `api_key`.  ### Changes  **Model configuration flow**  |Layer / File(s)|Summary| |---|---| |**Model selection and default persistence** <br> `web/src/interfaces/request/llm.ts`, `web/src/components/model-tree-select.tsx`, `web/src/hooks/use-llm-request.tsx`, `web/src/pages/user-setting/s

- **Issue #17081** (2026-07-20): **Fix: model provider save button label and light mode input background**
  *Symptoms*: ### Summary  Fix: model provider save button label and light mode input background 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/infiniflow/ragflow/pull/17081?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The provider settings batch Save button now uses the `save` translation key, with obsolete `saveAll` entries removed from English and Chinese locales. The light theme input background token now uses a faint black tint instead of transparency.  ### Changes  **Provider save label**  |Layer / File(s)|Summary| |---|---| |**Provider save label wiring** <br> `web/src/pages/user-setting/setting-model/layout/provider-header-bar.tsx`, `web/src/locales/en.ts`, `web/src/locales/zh.ts`|The batch Save button uses `save`

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

### Incident Patch 1: `9766c8c5` (2026-09-30)
**Commit Message**: fix: add json output alias on Retrieval node (#20394)

**File**: `internal/agent/canvas/retrieval_json_output_test.go` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+//
+//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
+//
+//  Licensed under the Apache License, Version 2.0 (the "License");
+//  you may not use this file except in compliance with the License.
+//  You may obtain a copy of the License at
+//
+//      http://www.apache.org/licenses/LICENSE-2.0
+//
+//  Unless required by applicable law or agreed to in writing, software
+//  distributed under the License is distributed on an "AS IS" BASIS,
+//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+//  See the License for the specific language governing permissions and
+//  limitations under the License.
+//
+
+// retrieval_json_output_test.go — end-to-end regression for the Retrieval
+// node's `json` output on a zero-hit search.
+//
+// The tool envelope drops its chunk array when the search returns nothing, so
+// the node's `json` output used to be missing outright and a downstream
+// {{<id>@json}} template failed the run with "Can't find variable". This test
+// drives a full Begin → Retrieval → Message canvas so the component's output
+// contract and the template resolution are exercised together — the failure
+// the Agent chat surfaced.
+package canvas
+
+import (
+	"context"
+	"testing"
+
+	// Blank-import to trigger component init(), which installs the real
+	// component factory (same wiring as loop_semantics_test.go). Without it
+	// BuildWorkflow falls back to its placeholder echo body and the canvas
+	// never invokes the real Retrieval / Message components.
+	_ "ragflow/internal/agent/component"
+	"ragflow/internal/agent/runtime"
+
+	"gorm.io/gorm"
+)
+
+type zeroHitRetrievalService struct{}
+
+func (zeroHitRetrievalService) Search(context.Context, *gorm.DB, runtime.RetrievalRequest) ([]runtime.RetrievalChunk, error) {
+	return nil, nil
+}
+
+func TestRetrievalJSONOutputResolvesOnEmptySearch(t *testing.T) {
+	previous := runtime.GetRetrievalService()
+	runtime.SetRetrievalService(zeroHitRetrievalService{})
+	t.Cleanup(func() { runtime.SetRetrievalService(previous) })
+
+	dsl := &Canvas{
+		Components: map[string]CanvasComponent{
+			"begin": {
+				Obj:        CanvasComponentObj{ComponentName: "Begin", Params: map[string]any{}},
+				Downstream: []string{"retrieval_0"},
+			},
+			"retrieval_0": {
+				Obj: CanvasComponentObj{ComponentName: "Retrieval", Params: map[string]any{
+					"retrieval_from": "dataset",
+					"kb_ids":         []any{"kb-1"},
+					"query":          "love",
+				}},
+				Upstream:   []string{"begin"},
+				Downstream: []string{"message_0"},
+			},
+			"message_0": {
+				Obj: CanvasComponentObj{ComponentName: "Message", Params: map[string]any{
+					"text": "chunks: {retrieval_0@json}",
+				}},
+				Upstream:   []string{"retrieval_0"},
+				Downstream: []string{},
+			},
+		},
+		Path: []string{"begin", "retrieval_0", "message_0"},
+	}
+
+	ctx := t.Context()
+	compiled, err := Compile(ctx, dsl)
+	if err != nil {
+		t.Fatalf("Compile: %v", err)
+	}
+	state := NewCanvasState("run-retrieval-json", "task-retrieval-json")
+	if _, runErr := compiled.Workflow.Invoke(withState(ctx, state), map[string]any{"query": "love"}); runErr != nil {
+		t.Fatalf("Invoke: %v", runErr)
+	}
+
+	chunks, err := state.GetVar("retrieval_0@json")
+	if err != nil {
+		t.Fatalf("GetVar(retrieval_0@json): %v", err)
+	}
+	values, ok := chunks.([]any)
+	if !ok || len(values) != 0 {
+		t.Fatalf("retrieval_0@json = %#v, want an empty array", chunks)
+	}
+	content, err := state.GetVar("message_0@content")
+	if err != nil {
+		t.Fatalf("GetVar(message_0@content): %v", err)
+	}
+	if content != "chunks: []" {
+		t.Fatalf("message_0@content = %#v, want %q", content, "chunks: []")
+	}
+}
```

**File**: `internal/agent/component/retrieval_empty_response_test.go` (modified, +110/-1)
```diff
@@ -18,6 +18,7 @@ package component
 
 import (
 	"context"
+	"reflect"
 	"testing"
 
 	agenttool "ragflow/internal/agent/tool"
@@ -31,12 +32,59 @@ func (emptyRetrievalService) Search(context.Context, *gorm.DB, agenttool.Retriev
 	return []agenttool.RetrievalChunk{}, nil
 }
 
-func TestRetrievalComponent_PreservesConfiguredEmptyResponse(t *testing.T) {
+// assertEmptyRetrievalOutputs pins the declared outputs of a Retrieval node
+// that produced no chunks: both names must resolve to an empty array so a
+// downstream {{<id>@json}} / {{<id>@chunks}} template does not fail with
+// "Can't find variable".
+func assertEmptyRetrievalOutputs(t *testing.T, output map[string]any) {
+	t.Helper()
+	for _, key := range []string{"json", "chunks"} {
+		value, ok := output[key].([]any)
+		if !ok {
+			t.Fatalf("%s = %#v, want an empty array", key, output[key])
+		}
+		if len(value) != 0 {
+			t.Fatalf("%s = %#v, want an empty array", key, value)
+		}
+	}
+}
+
+// TestRetrievalComponent_EmptyResultPreservesConfiguredEmptyResponse covers
+// the tool's early-return envelope (no retrieval_from configured): the
+// configured empty_response reaches formalized_content and the chunk outputs
+// stay resolvable.
+func TestRetrievalComponent_EmptyResultPreservesConfiguredEmptyResponse(t *testing.T) {
+	previous := agenttool.GetRetrievalService()
+	agenttool.SetRetrievalService(emptyRetrievalService{})
+	t.Cleanup(func() { agenttool.SetRetrievalService(previous) })
+
+	component, err := newRetrievalComponent(map[string]any{
+		"empty_response": "No relevant content.",
+	})
+	if err != nil {
+		t.Fatalf("newRetrievalComponent: %v", err)
+	}
+	output, err := component.Invoke(t.Context(), nil, map[string]any{"query": "love"})
+	if err != nil {
+		t.Fatalf("Invoke: %v", err)
+	}
+	if output["formalized_content"] != "No relevant content." {
+		t.Fatalf("formalized_content = %#v", output["formalized_content"])
+	}
+	assertEmptyRetrievalOutputs(t, output)
+}
+
+// TestRetrievalComponent_ZeroHitsExposeChunkOutputs covers the search path
+// that returns no hit: the tool envelope drops its `chunks` key (omitempty),
+// which previously left `json` unset and broke every downstream reference.
+func TestRetrievalComponent_ZeroHitsExposeChunkOutputs(t *testing.T) {
 	previous := agenttool.GetRetrievalService()
 	agenttool.SetRetrievalService(emptyRetrievalService{})
 	t.Cleanup(func() { agenttool.SetRetrievalService(previous) })
 
 	component, err := newRetrievalComponent(map[string]any{
+		"retrieval_from": "dataset",
+		"kb_ids":         []any{"kb-1"},
 		"empty_response": "No relevant content.",
 	})
 	if err != nil {
@@ -49,4 +97,65 @@ func TestRetrievalComponent_PreservesConfiguredEmptyResponse(t *testing.T) {
 	if output["formalized_content"] != "No relevant content." {
 		t.Fatalf("formalized_content = %#v", output["formalized_content"])
 	}
+	assertEmptyRetrievalOutputs(t, output)
+}
+
+// TestRetrievalComponent_MissingDatasetExposeChunkOutputs covers the
+// no-dataset-selected early return: the node reports the configuration error
+// while still resolving every declared output.
+func TestRetrievalComponent_MissingDatasetExposeChunkOutputs(t *testing.T) {
+	component, err := newRetrievalComponent(map[string]any{
+		"retrieval_from": "dataset",
+	})
+	if err != nil {
+		t.Fatalf("newRetrievalComponent: %v", err)
+	}
+	output, err := component.Invoke(t.Context(), nil, map[string]any{"query": "love"})
+	if err != nil {
+		t.Fatalf("Invoke: %v", err)
+	}
+	if output["_ERROR"] != "No dataset is selected." {
+		t.Fatalf("_ERROR = %#v", output["_ERROR"])
+	}
+	if output["formalized_content"] != "" {
+		t.Fatalf("formalized_content = %#v, want empty string", output["formalized_content"])
+	}
+	assertEmptyRetrievalOutputs(t, output)
+}
+
+// TestRetrievalComponent_JSONOutputMirrorsChunks pins the alias itself: `json`
+// is the DSL-declared name for the same chunk array the tool reports as
+// `chunks`, so downstream templates see identical data under either name.
+func TestRetrievalComponent_JSONOutputMirrorsChunks(t *testing.T) {
+	previous := agenttool.GetRetrievalService()
+	agenttool.SetSimpleRetrievalService()
+	t.Cleanup(func() { agenttool.SetRetrievalService(previous) })
+
+	component, err := newRetrievalComponent(map[string]any{
+		"retrieval_from": "dataset",
+		"kb_ids":         []any{"kb-1"},
+		"top_n":          1,
+	})
+	if err != nil {
+		t.Fatalf("newRetrievalComponent: %v", err)
+	}
+	output, err := component.Invoke(t.Context(), nil, map[string]any{"query": "ragflow"})
+	if err != nil {
+		t.Fatalf("Invoke: %v", err)
+	}
+	chunks, ok := output["chunks"].([]any)
+	if !ok || len(chunks) != 1 {
+		t.Fatalf("chunks = %#v, want one chunk", output["chunks"])
+	}
+	first, ok := chunks[0].(map[string]any)
+	if !ok || first["id"] != "simple-0" || first["content"] == "" {
+		t.Fatalf("chunk payload = %#v", chunks[0])
+	}
+	jsonOutput, ok := output["json"].([]any)
+	if !ok {
+		t.Fatalf("json = %#v, want an array", output["json"])
+	}
```

**File**: `internal/agent/component/universe_a_wrappers.go` (modified, +35/-8)
```diff
@@ -195,6 +195,7 @@ func (c *retrievalComponent) GetInputForm() map[string]any {
 func (c *retrievalComponent) Outputs() map[string]string {
 	return map[string]string{
 		"formalized_content": "Rendered chunks for downstream LLM prompts.",
+		"json":               "Chunk payloads under the DSL-declared output name (Array<Object>).",
 		"chunks":             "Raw chunk payloads (id, document_id, content, score).",
 	}
 }
@@ -218,7 +219,10 @@ func (c *retrievalComponent) Invoke(ctx context.Context, db *gorm.DB, inputs map
 			emptySelection = len(ids) == 0
 		}
 		if emptySelection {
-			return map[string]any{"_ERROR": "No dataset is selected."}, nil
+			return normalizeRetrievalOutputs(map[string]any{
+				"_ERROR":             "No dataset is selected.",
+				"formalized_content": "",
+			}), nil
 		}
 	}
 	common.Debug("agent retrieval component: invoke",
@@ -233,13 +237,9 @@ func (c *retrievalComponent) Invoke(ctx context.Context, db *gorm.DB, inputs map
 	common.Debug("agent retrieval component: output",
 		zap.String("tool_output", out),
 	)
-	decoded := parseToolEnvelope(out)
-	if chunks, ok := decoded["chunks"]; ok {
-		if _, has := decoded["json"]; !has {
-			decoded["json"] = chunks
-		}
-	}
-	return decoded, nil
+
+	return normalizeRetrievalOutputs(parseToolEnvelope(out)), nil
+
 }
 
 func (c *retrievalComponent) Stream(_ context.Context, _ *gorm.DB, _ map[string]any) (<-chan map[string]any, error) {
@@ -254,6 +254,33 @@ func (c *retrievalComponent) Stream(_ context.Context, _ *gorm.DB, _ map[string]
 	return nil, nil
 }
 
+// normalizeRetrievalOutputs pins the Retrieval node's chunk array under both
+// output names the canvas resolves: `json` (the DSL-declared output, typed
+// Array<Object> by the frontend) and `chunks` (the tool envelope's name).
+//
+// The tool marshals its envelope with `chunks` tagged omitempty, so a
+// zero-hit search drops the key outright, as does every early-return
+// envelope (empty query, search error, GraphRAG opt-in) and
+// parseToolEnvelope's `_raw` fallback. Without this, a downstream
+// {{<id>@json}} reference dies in ResolveTemplate with "Can't find variable"
+// instead of seeing the empty result set. Emptying the array — rather than
+// leaving the key absent or nil — is what every other tool-backed search
+// component emits unconditionally, and it is the shape callers iterate over.
+func normalizeRetrievalOutputs(decoded map[string]any) map[string]any {
+	if decoded == nil {
+		decoded = make(map[string]any, 3)
+	}
+	chunks, ok := decoded["chunks"]
+	if !ok || chunks == nil {
+		chunks = []any{}
+	}
+	decoded["chunks"] = chunks
+	if existing, has := decoded["json"]; !has || existing == nil {
+		decoded["json"] = chunks
+	}
+	return decoded
+}
+
 // applyDefaults folds the node-level params into the per-call
 // input map. Per-call values always win; node-level values fill
 // the gaps. This mirrors Python's RetrievalParam semantics where
```

---

### Incident Patch 2: `8d01f0a0` (2026-09-30)
**Commit Message**: fix(metadata): show empty state when no metadata keys exist (#20428)

**File**: `web/src/components/metadata-filter/metadata-filter-conditions.tsx` (modified, +18/-7)
```diff
@@ -187,6 +187,11 @@ export function MetadataFilterConditions({
   const logic = prefix + 'meta_data_filter.logic';
   const metadata = useFetchKnowledgeMetadata(kbIds);
 
+  const metadataKeys = useMemo(
+    () => Object.keys(metadata.data),
+    [metadata.data],
+  );
+
   const switchOperatorOptions = useBuildSwitchOperatorOptions();
 
   const { fields, remove, append } = useFieldArray({
@@ -219,13 +224,19 @@ export function MetadataFilterConditions({
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent className="max-h-[300px] !overflow-y-auto scrollbar-auto">
-            {Object.keys(metadata.data).map((key, idx) => {
-              return (
-                <DropdownMenuItem key={idx} onClick={add(key)}>
-                  {key}
-                </DropdownMenuItem>
-              );
-            })}
+            {metadataKeys.length === 0 ? (
+              <DropdownMenuItem disabled>
+                {t('knowledgeDetails.emptyMetadata')}
+              </DropdownMenuItem>
+            ) : (
+              metadataKeys.map((key, idx) => {
+                return (
+                  <DropdownMenuItem key={idx} onClick={add(key)}>
+                    {key}
+                  </DropdownMenuItem>
+                );
+              })
+            )}
           </DropdownMenuContent>
         </DropdownMenu>
       </div>
```

---

### Incident Patch 3: `0343c7cc` (2026-09-30)
**Commit Message**: Fix: The separator line causes the font size of the agent message error text to be too large. (#20462)

**File**: `internal/agent/canvas/run_error.go` (modified, +1/-1)
```diff
@@ -63,5 +63,5 @@ func runErrorEvent(err error) ErrorEvent {
 			Kind:    RunErrorKindInternal,
 		}
 	}
-	return ErrorEvent{Message: err.Error()}
+	return ErrorEvent{Message: runtime.MarkdownSafeErrorText(err)}
 }
```

**File**: `internal/agent/canvas/run_error_test.go` (modified, +16/-0)
```diff
@@ -81,3 +81,19 @@ func TestRunErrorEventPreservesUserFacingMessage(t *testing.T) {
 		t.Errorf("kind = %q, want user", payload.Kind)
 	}
 }
+
+func TestRunErrorEventNeutralizesEinoNodePathSeparator(t *testing.T) {
+	// eino's internalError.Error() decorates node failures with a dash-only
+	// line, which Markdown clients parse as a setext heading underline.
+	einoText := "[NodeRunError] agent: component \"Retrieval:SweetDogsAct\" invoke: aliyun rerank API error: 404 Not Found" +
+		"\n------------------------\nnode path: [Retrieval:SweetDogsAct]"
+	payload := runErrorEvent(fmt.Errorf("agent invoke: %w", errors.New(einoText)))
+	if strings.Contains(payload.Message, "------------------------") {
+		t.Fatalf("message still carries the setext heading separator: %q", payload.Message)
+	}
+	want := "agent invoke: [NodeRunError] agent: component \"Retrieval:SweetDogsAct\" invoke: aliyun rerank API error: 404 Not Found" +
+		"\n\nnode path: [Retrieval:SweetDogsAct]"
+	if payload.Message != want {
+		t.Errorf("message = %q, want %q", payload.Message, want)
+	}
+}
```

**File**: `internal/agent/component/agent.go` (modified, +1/-1)
```diff
@@ -990,7 +990,7 @@ func (c *AgentComponent) invokeNow(ctx context.Context, db *gorm.DB, inputs map[
 		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || !isAgentGraphRunError(err) {
 			return nil, fmt.Errorf("component: Agent.Invoke: %w", err)
 		}
-		return map[string]any{"_ERROR": "**ERROR**: " + err.Error()}, nil
+		return map[string]any{"_ERROR": "**ERROR**: " + runtime.MarkdownSafeErrorText(err)}, nil
 	}
 	// Post-stream citation grounding. When Cite is enabled and
 	// the canvas state has recorded retrieval chunks (populated
```

**File**: `internal/agent/runtime/component.go` (modified, +21/-0)
```diff
@@ -32,6 +32,7 @@ package runtime
 import (
 	"context"
 	"fmt"
+	"strings"
 	"sync"
 
 	"gorm.io/gorm"
@@ -99,6 +100,26 @@ func (e *DeferredStreamError) FailureText() string {
 	return e.Text
 }
 
+// einoNodePathSeparator is the decoration eino's internalError.Error()
+// inserts between the wrapped cause and its node-path diagnostic:
+//
+//	[NodeRunError] <cause>
+//	------------------------
+//	node path: [...]
+//
+// A dash-only line directly under a paragraph is valid Markdown setext
+// heading syntax, so chat clients render the whole error block as an <h2>.
+// Swap it for a blank line: the node path stays visible as an ordinary
+// paragraph while the error renders in the normal body font.
+const einoNodePathSeparator = "\n------------------------\n"
+
+// MarkdownSafeErrorText returns err's text with eino's node-path separator
+// neutralized, so error text surfaced into Markdown-rendered chat messages
+// keeps body formatting instead of turning into a heading.
+func MarkdownSafeErrorText(err error) string {
+	return strings.ReplaceAll(err.Error(), einoNodePathSeparator, "\n\n")
+}
+
 // ParamError wraps a parameter validation failure with the field name
 // for clearer error messages to the user.
 type ParamError struct {
```

---

### Incident Patch 4: `a16aa29d` (2026-09-30)
**Commit Message**: Fix: Text with swapped keyword similarity weights (#20472)

**File**: `web/src/components/similarity-slider/index.tsx` (modified, +61/-74)
```diff
@@ -33,7 +33,6 @@ import { NumberInput } from '../ui/input';
 interface SimilaritySliderFormFieldProps {
   similarityName?: string;
   similarityWeightName?: string;
-  similarityWeightType?: 'vector' | 'keyword';
   isTooltipShown?: boolean;
   numberInputClassName?: string;
 }
@@ -54,21 +53,13 @@ export const keywordsSimilarityWeightSchema = {
 export function SimilaritySliderFormField({
   similarityName = 'similarity_threshold',
   similarityWeightName = 'keywords_similarity_weight',
-  similarityWeightType = 'keyword',
   isTooltipShown,
   numberInputClassName,
 }: SimilaritySliderFormFieldProps) {
   const { t } = useTranslate('knowledgeDetails');
   const form = useFormContext();
-  const isVector = similarityWeightType === 'vector';
   const normalizeWeight = (weight: number) =>
     Number(Math.min(1, Math.max(0, weight)).toFixed(2));
-  const getVectorWeight = (weight: number) =>
-    normalizeWeight(isVector ? weight : 1 - weight);
-  const getFullTextWeight = (weight: number) =>
-    normalizeWeight(isVector ? 1 - weight : weight);
-  const getStoredWeight = (vectorWeight: number) =>
-    normalizeWeight(isVector ? vectorWeight : 1 - vectorWeight);
 
   return (
     <>
@@ -86,76 +77,72 @@ export function SimilaritySliderFormField({
         control={form.control}
         name={similarityWeightName}
         defaultValue={0}
-        render={({ field }) => (
-          <FormItem
-          // className={cn({ 'flex items-center gap-1 space-y-0': isHorizontal })}
-          >
-            <FormLabel
-              tooltip={
-                isTooltipShown &&
-                t(
-                  isVector
-                    ? 'vectorSimilarityWeightTip'
-                    : 'keywordSimilarityWeightTip',
-                )
-              }
+        render={({ field }) => {
+          const handleSliderChange = (value: number) =>
+            field.onChange(normalizeWeight(value));
+
+          return (
+            <FormItem
+            // className={cn({ 'flex items-center gap-1 space-y-0': isHorizontal })}
             >
-              {t(
-                isVector ? 'vectorSimilarityWeight' : 'keywordSimilarityWeight',
-              )}
-            </FormLabel>
-            <div className={cn('flex items-end gap-4 justify-between')}>
-              <FormControl>
-                <div className="flex flex-col flex-1 gap-2">
-                  <div className="flex justify-between items-center">
-                    <div className="flex items-center gap-1">
-                      <label className="italic text-xs text-text-secondary">
-                        vector
-                      </label>
-                      <span className="bg-bg-card rounded-md p-1 w-10 text-center text-xs">
-                        {getVectorWeight(field.value).toFixed(2)}
-                      </span>
-                    </div>
-                    <div className="flex  items-center gap-1">
-                      <label className="italic text-xs text-text-secondary">
-                        full-text
-                      </label>
-                      <span className="bg-bg-card rounded-md p-1 w-10 text-center text-xs">
-                        {getFullTextWeight(field.value).toFixed(2)}
-                      </span>
+              <FormLabel
+                tooltip={isTooltipShown && t('keywordSimilarityWeightTip')}
+              >
+                {t('keywordSimilarityWeight')}
+              </FormLabel>
+              <div className={cn('flex items-end gap-4 justify-between')}>
+                <FormControl>
+                  <div className="flex flex-col flex-1 gap-2">
+                    <div className="flex justify-between items-center">
+                      <div className="flex items-center gap-1">
+                        <label className="italic text-xs text-text-secondary">
+                          full-text
+                        </label>
+                        <span className="bg-bg-card rounded-md p-1 w-10 text-center text-xs">
+                          {normalizeWeight(field.value).toFixed(2)}
+                        </span>
+                      </div>
+                      <div className="flex  items-center gap-1">
+                        <label className="italic text-xs text-text-secondary">
+                          vector
+                        </label>
+                        <span className="bg-bg-card rounded-md p-1 w-10 text-center text-xs">
+                          {normalizeWeight(1 - field.value).toFixed(2)}
+                        </span>
+                      </div>
                     </div>
+                    <SingleFormSlider
+                      {...field}
+                      value={normalizeWeight(field.value)}
+                      onChange={handleSliderChange}
+                      max={1}
+                      step={0.01}
+                      min={0}
+                    ></SingleFormSlider>
                   </div>
-         
```

**File**: `web/src/locales/en.ts` (modified, +0/-3)
```diff
@@ -563,9 +563,6 @@ Example: A 1 KB message with 1024-dim embedding uses ~9 KB. The 5 MB default lim
       similarityThreshold: 'Similarity threshold',
       similarityThresholdTip:
         'RAGFlow employs either a combination of weighted keyword similarity and weighted vector cosine similarity, or a combination of weighted keyword similarity and weighted reranking score during retrieval when a reranker model is selected. This parameter sets the threshold for similarities between the user query and chunks. Any chunk with a similarity score below this threshold will be excluded from the results. By default, the threshold is set to 20. This means that only chunks with hybrid similarity score of 20 or higher will be retrieved. If the vector similarity weight is set to 0, this threshold does not apply.',
-      vectorSimilarityWeight: 'Vector similarity weight',
-      vectorSimilarityWeightTip:
-        'This sets the weight of vector similarity in the combined similarity score, either used with vector cosine similarity or with reranking score. The total of the two weights must equal 1.0.',
       keywordSimilarityWeight: 'Keyword similarity weight',
       keywordSimilarityWeightTip:
         'This sets the weight of keyword similarity in the combined similarity score. The total of the vector and keyword weights must equal 1.0.',
```

**File**: `web/src/locales/zh.ts` (modified, +0/-3)
```diff
@@ -504,9 +504,6 @@ export default {
       similarityThreshold: '相似度阈值',
       similarityThresholdTip:
         'RAGFlow 在检索时会使用加权关键词相似度与加权向量余弦相似度的组合；选择重排序模型时，则使用加权关键词相似度与加权重排序分数的组合。此参数用于设置用户查询与文本块之间的相似度阈值。相似度分数低于此阈值的文本块将从结果中排除。默认阈值为 20，也就是说，只有混合相似度分数达到 20 或以上的文本块才会被检索。如果向量相似度权重设置为 0，则此阈值不适用。',
-      vectorSimilarityWeight: '向量相似度权重',
-      vectorSimilarityWeightTip:
-        '此项用于设置混合相似度分数中的向量相似度权重，该权重可用于向量余弦相似度或重排序分数。两个权重的总和必须等于 1.0。',
       keywordSimilarityWeight: '关键词相似度权重',
       keywordSimilarityWeightTip:
         '此项用于设置混合相似度分数中的关键词相似度权重。向量与关键词相似度权重的总和必须等于 1.0。',
```

**File**: `web/src/pages/agent/form/retrieval-form/next.tsx` (modified, +0/-1)
```diff
@@ -187,7 +187,6 @@ function RetrievalForm({ node }: INextOperatorForm) {
           <section className="space-y-5">
             <SimilaritySliderFormField
               similarityWeightName="keywords_similarity_weight"
-              similarityWeightType="keyword"
               isTooltipShown
             ></SimilaritySliderFormField>
             <RerankCandidatesCountFormField></RerankCandidatesCountFormField>
```

**File**: `web/src/pages/agent/form/tool-form/retrieval-form/index.tsx` (modified, +0/-1)
```diff
@@ -65,7 +65,6 @@ const RetrievalForm = () => {
           <FormContainer>
             <SimilaritySliderFormField
               similarityWeightName="keywords_similarity_weight"
-              similarityWeightType="keyword"
               isTooltipShown
             ></SimilaritySliderFormField>
             <RerankCandidatesCountFormField></RerankCandidatesCountFormField>
```

**File**: `web/src/pages/next-chats/chat/app-settings/chat-prompt-engine.tsx` (modified, +0/-1)
```diff
@@ -220,7 +220,6 @@ export function ChatPromptEngine({
             prefix,
             'keywords_similarity_weight',
           )}
-          similarityWeightType="keyword"
         ></SimilaritySliderFormField>
         <RerankCandidatesCountFormField
           name={prefixName(prefix, 'rerank_candidates_count')}
```

**File**: `web/src/pages/next-search/search-setting.tsx` (modified, +0/-1)
```diff
@@ -387,7 +387,6 @@ function SearchSetting({
               isTooltipShown
               similarityName="search_config.similarity_threshold"
               similarityWeightName="search_config.keywords_similarity_weight"
-              similarityWeightType="keyword"
               numberInputClassName="rounded-sm"
             ></SimilaritySliderFormField>
             <RerankCandidatesCountFormField
```

---

### Incident Patch 5: `9bb5ad99` (2026-09-30)
**Commit Message**: Fix: Promote the visual enhancement option to a global setting. (#20397)

**File**: `web/src/locales/en.ts` (modified, +3/-3)
```diff
@@ -2764,9 +2764,9 @@ Best for: Documents with flowing, contextually connected content — such as boo
       oneChunkTitle: 'Note',
       oneChunkDescription:
         'All parsed sections will be merged in order into a single chunk.',
-      flattenMediaToText: 'Disable vision model',
-      flattenMediaToTextTip:
-        'Treat image and table sections as plain text and skip vision enhancement.',
+      enableVisionEnhancement: 'Enable vision enhancement',
+      enableVisionEnhancementTip:
+        'Use a vision model to parse image and table blocks; when off, they are treated as plain text.',
       enableChildrenDelimiters: 'Child chunk are used for retrieval',
       merge: 'Merge',
       split: 'Split',
```

**File**: `web/src/locales/zh.ts` (modified, +3/-2)
```diff
@@ -2344,8 +2344,9 @@ NER：使用 spaCy NER 和基于规则的关键词提取来抽取 Entities 和 R
       oneChunkTitle: 'Note',
       oneChunkDescription:
         '所有解析后的 sections 会按原始顺序合并为 1 个 chunk。',
-      flattenMediaToText: '禁用视觉模型',
-      flattenMediaToTextTip: '将图片和表格区块按普通文本处理，并跳过视觉增强。',
+      enableVisionEnhancement: '启用视觉增强',
+      enableVisionEnhancementTip:
+        '使用视觉模型解析图片和表格区块，关闭时按普通文本处理。',
       enableChildrenDelimiters: '子块用于检索',
       merge: '合并',
       split: '拆分',
```

**File**: `web/src/pages/agent/constant/pipeline.tsx` (modified, +7/-10)
```diff
@@ -64,11 +64,10 @@ export const OutputFormatMap = {
   [FileType.Audio]: AudioOutputFormat,
 };
 
-// The video parser defaults to the tenant's VLM model and the audio parser to
-// the ASR model, keyed by the useFetchDefaultModelDictionary fields. A file
-// type without a configured tenant default keeps its empty model id.
+// The audio parser defaults to the tenant's ASR model, keyed by the
+// useFetchDefaultModelDictionary fields. (The vision model is a single global
+// parser option, not per file type, so video no longer appears here.)
 export const FileTypeDefaultModelFieldMap: Partial<Record<FileType, string>> = {
-  [FileType.Video]: ModelTypeToField.vision,
   [FileType.Audio]: ModelTypeToField.asr,
 };
 
@@ -168,13 +167,16 @@ export const initialParserValues = {
     html: { type: 'string', value: '' },
     json: { type: 'Array<object>', value: [] },
   },
+  // Global vision enhancement, off by default; the model id is prefilled from
+  // the tenant's image2text default when a node is created.
+  vlm: { llm_id: '' },
+  enable_vision_enhancement: false,
   setups: [
     {
       fileFormat: FileType.PDF,
       output_format: PdfOutputFormat.Json,
       parse_method: ParseDocumentType.DeepDOC,
       preprocess: PreprocessValue.main_content,
-      flatten_media_to_text: false,
       remove_header_footer: false,
       pages: [{ from: 1, to: 100000 }],
     },
@@ -183,7 +185,6 @@ export const initialParserValues = {
       output_format: SpreadsheetOutputFormat.Json,
       parse_method: ParseDocumentType.DeepDOC,
       preprocess: PreprocessValue.main_content,
-      flatten_media_to_text: false,
     },
     {
       fileFormat: FileType.Image,
@@ -202,7 +203,6 @@ export const initialParserValues = {
       fileFormat: FileType.TextMarkdown,
       output_format: TextMarkdownOutputFormat.Text,
       preprocess: PreprocessValue.main_content,
-      flatten_media_to_text: false,
     },
     {
       fileFormat: FileType.Code,
@@ -219,14 +219,12 @@ export const initialParserValues = {
       fileFormat: FileType.Doc,
       output_format: DocxOutputFormat.Json,
       preprocess: PreprocessValue.main_content,
-      flatten_media_to_text: false,
       remove_header_footer: false,
     },
     {
       fileFormat: FileType.Docx,
       output_format: DocxOutputFormat.Json,
       preprocess: PreprocessValue.main_content,
-      flatten_media_to_text: false,
       remove_header_footer: false,
     },
     {
@@ -238,7 +236,6 @@ export const initialParserValues = {
     {
       fileFormat: FileType.Video,
       output_format: VideoOutputFormat.Text,
-      vlm: { llm_id: '' },
     },
     {
       fileFormat: FileType.Audio,
```

**File**: `web/src/pages/agent/form/parser-form/audio-form-fields.tsx` (renamed, +0/-18)
```diff
@@ -24,21 +24,3 @@ export function AudioFormFields({ prefix }: OutputFormatFormFieldProps) {
     </>
   );
 }
-
-export function VideoFormFields({ prefix }: OutputFormatFormFieldProps) {
-  const { t } = useTranslation();
-  const ownerTenantId = useOwnerTenantId();
-
-  return (
-    <>
-      {/* Multimodal Model */}
-      <ModelTreeSelectFormField
-        name={buildFieldNameWithPrefix('vlm.llm_id', prefix)}
-        label={t('chat.model')}
-        modelTypes={ModelTypeMap.img2txt_id}
-        allowClear
-        ownerTenantId={ownerTenantId}
-      />
-    </>
-  );
-}
```

**File**: `web/src/pages/agent/form/parser-form/common-form-fields.tsx` (modified, +85/-15)
```diff
@@ -1,5 +1,8 @@
 import { useCrossLanguageOptions } from '@/components/cross-language-form-field';
-import { LayoutRecognizeFormField } from '@/components/layout-recognize-form-field';
+import {
+  LayoutRecognizeFormField,
+  ParseDocumentType,
+} from '@/components/layout-recognize-form-field';
 import {
   SelectWithSearch,
   SelectWithSearchFlagOptionType,
@@ -8,6 +11,8 @@ import { RAGFlowFormItem } from '@/components/ragflow-form';
 import { Switch } from '@/components/ui/switch';
 import { FileType } from '@/constants/file';
 import { upperCase, upperFirst } from 'lodash';
+import { useEffect } from 'react';
+import { useFormContext, useWatch } from 'react-hook-form';
 import { useTranslation } from 'react-i18next';
 import { useOwnerTenantId } from '../../context';
 import {
@@ -74,29 +79,94 @@ export function ParserMethodFormField({
   );
 }
 
-export function FlattenMediaToTextFormField({ prefix }: CommonProps) {
-  const { t } = useTranslation();
+const TableResultTypeOptions: SelectWithSearchFlagOptionType[] = [
+  { label: 'Markdown', value: '0' },
+  { label: 'HTML', value: '1' },
+];
+
+const MarkdownImageResponseTypeOptions: SelectWithSearchFlagOptionType[] = [
+  { label: 'URL', value: '0' },
+  { label: 'Text', value: '1' },
+];
+
+type TcadpSelectFieldProps = CommonProps & {
+  name: string;
+  label: string;
+  options: SelectWithSearchFlagOptionType[];
+};
+
+function TcadpSelectField({
+  prefix,
+  name,
+  label,
+  options,
+}: TcadpSelectFieldProps) {
   return (
     <RAGFlowFormItem
-      name={buildFieldNameWithPrefix(`flatten_media_to_text`, prefix)}
-      label={t('flow.flattenMediaToText')}
-      tooltip={t('flow.flattenMediaToTextTip')}
-      horizontal={true}
-      labelClassName="w-full"
-      valueClassName="w-8"
+      name={buildFieldNameWithPrefix(name, prefix)}
+      label={label}
     >
       {(field) => (
-        <Switch
-          checked={field.value}
-          onCheckedChange={(checked) => {
-            field.onChange?.(checked);
-          }}
-        />
+        <SelectWithSearch
+          value={field.value}
+          onChange={field.onChange}
+          options={options}
+        ></SelectWithSearch>
       )}
     </RAGFlowFormItem>
   );
 }
 
+// TCADP parser options shared by the PDF and spreadsheet forms. Visible only
+// when TCADP is the parse method, and seeds the default values on selection.
+export function TcadpFormFields({ prefix }: CommonProps) {
+  const { t } = useTranslation();
+  const form = useFormContext();
+
+  const parseMethod = useWatch({
+    name: buildFieldNameWithPrefix('parse_method', prefix),
+  });
+  const shown = !!parseMethod && parseMethod === ParseDocumentType.TCADPParser;
+
+  // Set default values for TCADP options when TCADP is selected
+  useEffect(() => {
+    if (!shown) {
+      return;
+    }
+    const names = ['table_result_type', 'markdown_image_response_type'];
+    names.forEach((name) => {
+      const fieldName = buildFieldNameWithPrefix(name, prefix);
+      if (!form.getValues(fieldName)) {
+        form.setValue(fieldName, '1', {
+          shouldValidate: true,
+          shouldDirty: true,
+        });
+      }
+    });
+  }, [shown, form, prefix]);
+
+  if (!shown) {
+    return null;
+  }
+
+  return (
+    <>
+      <TcadpSelectField
+        prefix={prefix}
+        name="table_result_type"
+        label={t('flow.tableResultType') || '表格返回形式'}
+        options={TableResultTypeOptions}
+      />
+      <TcadpSelectField
+        prefix={prefix}
+        name="markdown_image_response_type"
+        label={t('flow.markdownImageResponseType') || '图片返回形式'}
+        options={MarkdownImageResponseTypeOptions}
+      />
+    </>
+  );
+}
+
 export function TwoColumnCheckFormField({ prefix }: CommonProps) {
   const { t } = useTranslation();
   return (
```

**File**: `web/src/pages/agent/form/parser-form/index.tsx` (modified, +11/-4)
```diff
@@ -24,6 +24,7 @@ import { useWatchFormChange } from '../../hooks/use-watch-form-change';
 import { INextOperatorForm } from '../../interface';
 import { buildOutputList } from '../../utils/build-output-list';
 import { Output } from '../components/output';
+import { AudioFormFields } from './audio-form-fields';
 import { OutputFormatFormField } from './common-form-fields';
 import { EmailFormFields } from './email-form-fields';
 import { ImageFormFields } from './image-form-fields';
@@ -35,8 +36,8 @@ import {
   HtmlFormFields,
   TextMarkdownFormFields,
 } from './text-html-form-fields';
-import { buildInitialParserSetup } from './utils';
-import { AudioFormFields, VideoFormFields } from './video-form-fields';
+import { buildInitialParserSetup, normalizeParserFormValues } from './utils';
+import { VisionEnhancementFormFields } from './vision-form-fields';
 import { WordFormFields } from './word-form-fields';
 
 export { FormSchema } from './schema';
@@ -50,7 +51,6 @@ const FileFormatWidgetMap = {
   [FileType.PowerPoint]: PptFormFields,
   [FileType.Doc]: WordFormFields,
   [FileType.Docx]: WordFormFields,
-  [FileType.Video]: VideoFormFields,
   [FileType.Audio]: AudioFormFields,
   [FileType.Email]: EmailFormFields,
   [FileType.Image]: ImageFormFields,
@@ -152,7 +152,13 @@ const ParserForm = ({
   // Show the saved values as-is: an empty llm_id means the user cleared the
   // model, and the backend falls back to the tenant default at parse time.
   // Prefilling it here would make a cleared model reappear and be written back.
-  const defaultValues = useFormValues(initialParserValues, node);
+  const formValues = useFormValues(initialParserValues, node);
+  // Lifts any legacy per-setup vision options onto the shared top-level
+  // fields; already-normalized values pass through unchanged.
+  const defaultValues = useMemo(
+    () => normalizeParserFormValues(formValues),
+    [formValues],
+  );
 
   const form = useForm<z.infer<typeof FormSchema>>({
     defaultValues,
@@ -196,6 +202,7 @@ const ParserForm = ({
   return (
     <Form {...form}>
       <form className="space-y-5 px-5">
+        <VisionEnhancementFormFields />
         {fields.map((field, index) => {
           return (
             <ParserItem
```

**File**: `web/src/pages/agent/form/parser-form/pdf-form-fields.tsx` (modified, +5/-105)
```diff
@@ -1,53 +1,25 @@
 import { ParseDocumentType } from '@/components/layout-recognize-form-field';
-import {
-  ModelTreeSelectFormField,
-  ModelTypeMap,
-} from '@/components/model-tree-select';
-import {
-  SelectWithSearch,
-  SelectWithSearchFlagOptionType,
-} from '@/components/originui/select-with-search';
-import { RAGFlowFormItem } from '@/components/ragflow-form';
 import { isEmpty } from 'lodash';
-import { useEffect, useMemo } from 'react';
-import { useFormContext, useWatch } from 'react-hook-form';
-import { useTranslation } from 'react-i18next';
-import { useOwnerTenantId } from '../../context';
+import { useMemo } from 'react';
+import { useWatch } from 'react-hook-form';
 import {
-  FlattenMediaToTextFormField,
   LanguageFormField,
   ParserMethodFormField,
   RemoveHeaderFooterFormField,
   RmdirFormField,
+  TcadpFormFields,
   TwoColumnCheckFormField,
 } from './common-form-fields';
 import { CommonProps } from './interface';
 import { DynamicPageRange } from './dynamic-page-range';
 import { useSetInitialLanguage } from './use-set-initial-language';
 import { buildFieldNameWithPrefix } from './utils';
 
-const tableResultTypeOptions: SelectWithSearchFlagOptionType[] = [
-  { label: 'Markdown', value: '0' },
-  { label: 'HTML', value: '1' },
-];
-
-const markdownImageResponseTypeOptions: SelectWithSearchFlagOptionType[] = [
-  { label: 'URL', value: '0' },
-  { label: 'Text', value: '1' },
-];
-
 export function PdfFormFields({ prefix }: CommonProps) {
-  const { t } = useTranslation();
-  const form = useFormContext();
-  const ownerTenantId = useOwnerTenantId();
-
   const parseMethodName = buildFieldNameWithPrefix('parse_method', prefix);
   const parseMethod = useWatch({
     name: parseMethodName,
   });
-  const flattenMediaToText = useWatch({
-    name: buildFieldNameWithPrefix('flatten_media_to_text', prefix),
-  });
 
   const languageShown = useMemo(() => {
     return (
@@ -58,90 +30,18 @@ export function PdfFormFields({ prefix }: CommonProps) {
     );
   }, [parseMethod]);
 
-  const tcadpOptionsShown = useMemo(() => {
-    return (
-      !isEmpty(parseMethod) && parseMethod === ParseDocumentType.TCADPParser
-    );
-  }, [parseMethod]);
-
   useSetInitialLanguage({ prefix, languageShown });
 
-  // Set default values for TCADP options when TCADP is selected
-  useEffect(() => {
-    if (tcadpOptionsShown) {
-      const tableResultTypeName = buildFieldNameWithPrefix(
-        'table_result_type',
-        prefix,
-      );
-      const markdownImageResponseTypeName = buildFieldNameWithPrefix(
-        'markdown_image_response_type',
-        prefix,
-      );
-
-      if (isEmpty(form.getValues(tableResultTypeName))) {
-        form.setValue(tableResultTypeName, '1', {
-          shouldValidate: true,
-          shouldDirty: true,
-        });
-      }
-      if (isEmpty(form.getValues(markdownImageResponseTypeName))) {
-        form.setValue(markdownImageResponseTypeName, '1', {
-          shouldValidate: true,
-          shouldDirty: true,
-        });
-      }
-    }
-  }, [tcadpOptionsShown, form, prefix]);
-
   return (
     <>
       <TwoColumnCheckFormField prefix={prefix} />
       <RmdirFormField prefix={prefix} />
       <RemoveHeaderFooterFormField prefix={prefix} />
       <ParserMethodFormField prefix={prefix}></ParserMethodFormField>
       <DynamicPageRange prefix={prefix} />
-      <FlattenMediaToTextFormField prefix={prefix} />
-      {!flattenMediaToText && (
-        <ModelTreeSelectFormField
-          name={buildFieldNameWithPrefix('vlm.llm_id', prefix)}
-          label={t('chat.model')}
-          modelTypes={ModelTypeMap.img2txt_id}
-          allowClear
-          ownerTenantId={ownerTenantId}
-        />
-      )}
+
       {languageShown && <LanguageFormField prefix={prefix}></LanguageFormField>}
-      {tcadpOptionsShown && (
-        <>
-          <RAGFlowFormItem
-            name={buildFieldNameWithPrefix('table_result_type', prefix)}
-            label={t('flow.tableResultType') || '表格返回形式'}
-          >
-            {(field) => (
-              <SelectWithSearch
-                value={field.value}
-                onChange={field.onChange}
-                options={tableResultTypeOptions}
-              ></SelectWithSearch>
-            )}
-          </RAGFlowFormItem>
-          <RAGFlowFormItem
-            name={buildFieldNameWithPrefix(
-              'markdown_image_response_type',
-              prefix,
-            )}
-            label={t('flow.markdownImageResponseType') || '图片返回形式'}
-          >
-            {(field) => (
-              <SelectWithSearch
-                value={field.value}
-                onChange={field.onChange}
-                options={markdownImageResponseTypeOptions}
-              ></SelectWithSearch>
-            )}
-          </RAGFlowFormItem>
-        </>
-      )}
+      <TcadpFormFields prefix={prefix} />
     </>
   );
 }
```

**File**: `web/src/pages/agent/form/parser-form/schema.ts` (modified, +7/-1)
```diff
@@ -10,8 +10,9 @@ export const SetupSchema = z
     parse_method: z.string().optional(),
     lang: z.string().optional(),
     fields: z.array(z.string()).optional(),
+    // Per-setup vlm is only used by Audio (its ASR model); the vision model
+    // lives at the top level, shared by all vision-capable file types.
     vlm: z.object({ llm_id: z.string().optional() }).optional(),
-    flatten_media_to_text: z.boolean().optional(),
     system_prompt: z.string().optional(),
     table_result_type: z.string().optional(),
     markdown_image_response_type: z.string().optional(),
@@ -54,6 +55,11 @@ export const SetupSchema = z
 
 export const FormSchema = z.object({
   setups: z.array(SetupSchema).min(1, i18n.t('flow.atLeastOneFileType')),
+  // Global vision enhancement: one switch + one img2txt model shared by every
+  // vision-capable file type, sitting at the params top level alongside the
+  // per-family setups (see the backend Parser component contract).
+  vlm: z.object({ llm_id: z.string().optional() }).optional(),
+  enable_vision_enhancement: z.boolean().optional(),
 });
 
 export type ParserFormSchemaType = z.infer<typeof FormSchema>;
```

---

### Incident Patch 6: `285b2c29` (2026-09-30)
**Commit Message**: fix(parser): restore picture OCR independently of VLM enhancement (#20424)

**File**: `internal/deepdoc/parser/pdf/parser_ocr.go` (modified, +7/-0)
```diff
@@ -24,6 +24,13 @@ import (
 // only to its own local max width — exactly what the Python reference does.
 const recBatchNum = 16
 
+// OCRImage detects and recognizes text using the same de-skewing, rotation
+// selection, and batched recognition as PDF pages. zoom converts image pixels
+// to output coordinates; standalone images use 1.
+func OCRImage(ctx context.Context, img image.Image, doc pdf.DocAnalyzer, zoom float64) []pdf.TextBox {
+	return (&Parser{}).ocrDetectAndRecognize(ctx, img, doc, 0, "image", zoom)
+}
+
 func (p *Parser) ocrDetectAndRecognize(ctx context.Context, pageImg image.Image, doc pdf.DocAnalyzer, pageNum int, logLabel string, zoom float64) []pdf.TextBox {
 	boxes, err := p.inferOCRDetect(ctx, doc, pageImg)
 	if err != nil || len(boxes) == 0 {
```

**File**: `internal/ingestion/component/dispatch_model.go` (modified, +1/-2)
```diff
@@ -47,8 +47,7 @@ var resolveModelConfig = defaultResolveModelConfig
 
 // configuredMediaModelID extracts a per-call model reference from a parser setup.
 // Image parsing stores the VLM model reference in parse_method when it is not
-// "ocr" (mirroring Python rag/flow/parser/parser.py:_image); "ocr" selects the
-// tenant default vision model, and Go does not run OCR for standalone images.
+// an OCR method. OCR backend selection is independent of the VLM model.
 // Other media families use vlm.llm_id, matching the frontend parser form.
 func configuredMediaModelID(setup schema.ParserSetup, family string) string {
 	if family == "image" {
```

**File**: `internal/ingestion/component/media_dispatch.go` (modified, +91/-48)
```diff
@@ -14,21 +14,25 @@
 // limitations under the License.
 //
 
-// Media dispatch: image, audio, and video branches that require model access
-// (IMAGE2TEXT, SPEECH2TEXT) at the component layer.
+// Media dispatch runs image OCR and optional vision enhancement, audio
+// transcription, and video dispatch at the component layer.
 
 package component
 
 import (
+	"bytes"
 	"context"
 	"fmt"
+	"image"
 	"os"
 	"path/filepath"
+	"sort"
 	"strings"
 
 	"go.uber.org/zap"
 
 	"ragflow/internal/common"
+	deepdocpdf "ragflow/internal/deepdoc/parser/pdf"
 	"ragflow/internal/entity"
 	modelModule "ragflow/internal/entity/models"
 	"ragflow/internal/ingestion/component/schema"
@@ -71,7 +75,7 @@ func maybeDispatchVideo(
 		fmt.Errorf("Parser: video parsing is not yet supported; underlying video analysis capability is pending")
 }
 
-// Image dispatch: IMAGE2TEXT vision describe ---
+// Image dispatch: OCR followed by optional IMAGE2TEXT enhancement.
 
 func maybeDispatchImage(
 	ctx context.Context,
@@ -90,50 +94,108 @@ func maybeDispatchImage(
 	if !ok {
 		return parser.ParseResult{}, false, nil
 	}
-	tenantID := getStringOr(inputs, "tenant_id", "")
-	if !enableVisionEnhancement {
-		return parser.ParseResult{}, true, fmt.Errorf("parser: image has no searchable text because vision enhancement is disabled")
+	method := getStringOr(setup, "parse_method", "")
+	useOCR := method == "" || strings.EqualFold(method, "ocr")
+	release, err := parser.AcquireImageMedia(ctx)
+	if err != nil {
+		return parser.ParseResult{}, true, err
+	}
+	defer release()
+	img, err := decodeDispatchImage(binary, useOCR)
+	if err != nil {
+		return parser.ParseResult{}, true, err
+	}
+	var text string
+	if useOCR {
+		text, err = extractImageText(ctx, img)
 	}
+	release()
 	parsed := dispatchParse(ctx, fileType, filename, binary, setups)
 	if parsed.Err != nil {
 		return parsed, true, parsed.Err
 	}
 	if len(parsed.JSON) == 0 {
-		return parser.ParseResult{}, true, fmt.Errorf("parser: image parser returned no image item")
+		return parsed, true, fmt.Errorf("parser: image parser returned no image item")
 	}
+	parsed.OutputFormat = "json"
 	imageData, _ := parsed.JSON[0]["image"].(string)
-	if imageData == "" {
-		return parser.ParseResult{}, true, fmt.Errorf("parser: image parser returned no image payload")
-	}
-	result, handled, err := maybeDispatchImageVLM(ctx, db, imageData, tenantID, setup, inputs)
-	result.Warnings = append(result.Warnings, parsed.Warnings...)
-	result.File = parsed.File
-	if err == nil && len(result.JSON) > 0 {
-		text, _ := result.JSON[0]["text"].(string)
-		if strings.TrimSpace(text) == "" {
-			if len(result.Warnings) > 0 {
-				return result, true, fmt.Errorf("parser: image has no searchable text: %s", result.Warnings[0])
-			}
-			return result, true, fmt.Errorf("parser: vision enhancement returned no searchable text")
+	parsed.JSON[0]["text"] = text
+	if err != nil {
+		parsed.Warnings = append(parsed.Warnings, fmt.Sprintf("image OCR unavailable: %v", err))
+	} else if useOCR && strings.TrimSpace(text) == "" {
+		parsed.Warnings = append(parsed.Warnings, "image OCR returned no text")
+	}
+	if err := ctx.Err(); err != nil {
+		return parsed, true, err
+	}
+	if enableVisionEnhancement {
+		description, warnings := describeImage(ctx, db, imageData, getStringOr(inputs, "tenant_id", ""), setup, inputs)
+		parsed.Warnings = append(parsed.Warnings, warnings...)
+		if description != "" {
+			appendItemText(parsed.JSON[0], description)
+		}
+	}
+	return parsed, true, nil
+}
+
+func decodeDispatchImage(data []byte, decodeRaster bool) (image.Image, error) {
+	if len(data) == 0 || len(data) > parser.MaxImagePayloadBytes {
+		return nil, fmt.Errorf("parser: image payload exceeds size limits")
+	}
+	config, _, err := image.DecodeConfig(bytes.NewReader(data))
+	if err != nil {
+		return nil, fmt.Errorf("parser: decode image: %w", err)
+	}
+	if config.Width <= 0 || config.Height <= 0 || config.Width > parser.MaxImageEdge || config.Height > parser.MaxImageEdge || int64(config.Width)*int64(config.Height) > parser.MaxImagePixels {
+		return nil, fmt.Errorf("parser: image dimensions %dx%d exceed limits", config.Width, config.Height)
+	}
+	// VLM consumes the original bytes; only local OCR needs a decoded raster.
+	if !decodeRaster {
+		return nil, nil
+	}
+	img, _, err := image.Decode(bytes.NewReader(data))
+	if err != nil {
+		return nil, fmt.Errorf("parser: decode image: %w", err)
+	}
+	return img, nil
+}
+
+func extractImageText(ctx context.Context, img image.Image) (string, error) {
+	analyzer, err := parser.GetDocAnalyzer()
+	if err != nil {
+		return "", err
+	}
+	if analyzer == nil || !analyzer.Health() {
+		return "", fmt.Errorf("local OCR analyzer is unavailable")
+	}
+	boxes := deepdocpdf.OCRImage(ctx, img, analyzer, 1.0)
+	sort.SliceStable(boxes, func(i, j int) bool {
+		if boxes[i].Top == boxes[j].Top {
+			return boxes[i].X0 < boxes[j].X0
+		}
+		return boxes[i].Top < boxes[j].Top
+	})
+	texts := make([]string, 0, len(boxes)
```

**File**: `internal/ingestion/component/media_dispatch_integration_test.go` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+//go:build cgo && integration
+
+package component
+
+import (
+	_ "embed"
+	"os"
+	"strings"
+	"testing"
+
+	nativeanalyzer "ragflow/internal/deepdoc/parser/pdf/inference/native_analyzer"
+	deepdoctype "ragflow/internal/deepdoc/parser/type"
+	"ragflow/internal/utility"
+)
+
+//go:embed testdata/picture_ocr.png
+var pictureOCRFixture []byte
+
+func TestMaybeDispatchImageNativeOCRWithoutVision(t *testing.T) {
+	modelDir := os.Getenv("MODEL_DIR")
+	if modelDir == "" {
+		t.Skip("MODEL_DIR required for native OCR integration")
+	}
+	original := deepdoctype.NativeDocAnalyzerFactory
+	t.Cleanup(func() { deepdoctype.NativeDocAnalyzerFactory = original })
+	if err := nativeanalyzer.Register(modelDir, nativeanalyzer.DefaultDropScore); err != nil {
+		t.Fatal(err)
+	}
+	result, handled, err := maybeDispatchImage(t.Context(), nil, utility.FileTypeVISUAL,
+		"picture_ocr.png", pictureOCRFixture, nil, defaultSetups(), false)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if !handled || len(result.JSON) != 1 {
+		t.Fatalf("result = %+v, handled = %v", result, handled)
+	}
+	text, _ := result.JSON[0]["text"].(string)
+	if strings.Join(strings.Fields(strings.ToUpper(text)), "") != "HELLOWORLD" {
+		t.Fatalf("native OCR text = %q, want HELLO WORLD: warnings = %v", text, result.Warnings)
+	}
+	if result.JSON[0]["image"] == "" || result.JSON[0]["doc_type_kwd"] != "image" {
+		t.Fatalf("missing image attachment: %+v", result.JSON[0])
+	}
+}
```

**File**: `internal/ingestion/component/media_dispatch_test.go` (modified, +214/-19)
```diff
@@ -19,29 +19,106 @@ import (
 	"bytes"
 	"context"
 	"encoding/base64"
+	"encoding/json"
+	"errors"
 	"image"
+	"image/png"
+	"io"
+	"os"
 	"strings"
 	"sync"
 	"testing"
+	"time"
 
 	"gorm.io/gorm"
 
 	"ragflow/internal/common"
 	"ragflow/internal/dao"
+	deepdocpdf "ragflow/internal/deepdoc/parser/pdf"
+	deepdoctype "ragflow/internal/deepdoc/parser/type"
 	"ragflow/internal/entity"
 	modelModule "ragflow/internal/entity/models"
 	"ragflow/internal/ingestion/component/schema"
+	"ragflow/internal/parser/parser"
 	"ragflow/internal/utility"
 )
 
-func TestMaybeDispatchImageWithoutVisionReportsNoContent(t *testing.T) {
-	result, handled, err := maybeDispatchImage(t.Context(), dao.DB, utility.FileTypeVISUAL,
-		"photo.png", []byte("image bytes"), nil, defaultSetups(), false)
-	if !handled {
-		t.Fatal("image was not handled")
+type pictureOCRAnalyzer struct {
+	deepdoctype.DocAnalyzer
+	empty bool
+}
+
+func (*pictureOCRAnalyzer) Health() bool { return true }
+
+func (a *pictureOCRAnalyzer) OCRDetect(ctx context.Context, img image.Image) ([]deepdoctype.OCRBox, error) {
+	if a.empty {
+		return nil, nil
 	}
-	if err == nil || !strings.Contains(err.Error(), "vision enhancement") {
-		t.Fatalf("error = %v, want explicit vision requirement; result = %+v", err, result)
+	return []deepdoctype.OCRBox{{X0: 1, Y0: 1, X1: 9, Y1: 1, X2: 9, Y2: 9, X3: 1, Y3: 9}}, nil
+}
+
+func (*pictureOCRAnalyzer) OCRRecognize(ctx context.Context, img image.Image) ([]deepdoctype.OCRText, error) {
+	return []deepdoctype.OCRText{{Text: "OCR text"}}, nil
+}
+
+func TestMaybeDispatchImageOCRIndependentOfVision(t *testing.T) {
+	templateData, err := os.ReadFile("../pipeline/template/ingestion_pipeline_picture.json")
+	if err != nil {
+		t.Fatal(err)
+	}
+	var template struct {
+		DSL struct {
+			Components map[string]struct {
+				Obj struct{ Params map[string]any }
+			}
+		}
+	}
+	if err := json.Unmarshal(templateData, &template); err != nil {
+		t.Fatal(err)
+	}
+	params := template.DSL.Components["Parser:ViewsCaptureLight"].Obj.Params
+	original := deepdoctype.NativeDocAnalyzerFactory
+	deepdoctype.NativeDocAnalyzerFactory = func() (deepdoctype.DocAnalyzer, bool) { return &pictureOCRAnalyzer{}, true }
+	t.Cleanup(func() { deepdoctype.NativeDocAnalyzerFactory = original })
+	data := picturePNG(t)
+	for _, tc := range []struct {
+		name    string
+		method  string
+		enabled bool
+		tenant  string
+		want    string
+	}{
+		{"disabled", "ocr", false, "", "OCR text"},
+		{"enabled", "ocr", true, "t1", "OCR text\ncaptured"},
+		{"unavailable", "ocr", true, "", "OCR text"},
+		{"default", "", false, "", "OCR text"},
+		{"vlm-only", "custom-vlm", false, "", ""},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			originalResolver := resolveTenantModelByType
+			resolveTenantModelByType = func(context.Context, *gorm.DB, string, entity.ModelType) (modelModule.ModelDriver, string, *modelModule.APIConfig, int, error) {
+				return &imagePromptCaptureDriver{}, "vision", &modelModule.APIConfig{}, 0, nil
+			}
+			t.Cleanup(func() { resolveTenantModelByType = originalResolver })
+			params["image"].(map[string]any)["parse_method"] = tc.method
+			component, err := NewParserComponent(params)
+			if err != nil {
+				t.Fatal(err)
+			}
+			pc := component.(*ParserComponent)
+			pc.enableVisionEnhancement = tc.enabled
+			result, err := pc.Invoke(t.Context(), nil, map[string]any{"name": "photo.png", "file_type": "image", "binary": data, "tenant_id": tc.tenant})
+			if err != nil {
+				t.Fatal(err)
+			}
+			items, _ := result["json"].([]map[string]any)
+			if len(items) != 1 || items[0]["text"] != tc.want {
+				t.Fatalf("items = %+v, want text %q", items, tc.want)
+			}
+			if items[0]["image"] == "" || items[0]["doc_type_kwd"] != "image" {
+				t.Fatalf("missing image attachment: %+v", items)
+			}
+		})
 	}
 }
 
@@ -117,7 +194,7 @@ func TestMaybeDispatchImage_UsesSystemPrompt(t *testing.T) {
 		dao.DB,
 		utility.FileTypeVISUAL,
 		"test.png",
-		[]byte("not-a-real-image"),
+		picturePNG(t),
 		map[string]any{"tenant_id": "t1"},
 		setups,
 		true,
@@ -169,7 +246,7 @@ func TestMaybeDispatchImage_DefaultPromptUsesDatasetLanguage(t *testing.T) {
 		dao.DB,
 		utility.FileTypeVISUAL,
 		"test.png",
-		[]byte("not-a-real-image"),
+		picturePNG(t),
 		map[string]any{"tenant_id": "t1", "lang": "Japanese"},
 		setups,
 		true,
@@ -212,7 +289,7 @@ func TestMaybeDispatchImage_ReturnsJSONWithImage(t *testing.T) {
 		dao.DB,
 		utility.FileTypeVISUAL,
 		"test.png",
-		[]byte("not-a-real-image"),
+		picturePNG(t),
 		map[string]any{"tenant_id": "t1"},
 		setups,
 		true,
@@ -264,7 +341,7 @@ func TestMaybeDispatchImage_HardcodesJSONOutput(t *testing.T) {
 		dao.DB,
 		utility.FileTypeVISUAL,
 		"test.png",
-		[]byte("not-a-real-image"),
+		picturePNG(t),
 		map[string]any{"tenant_id": "t1"},
 		setups,
 		true,
@@ -456,7 +533,7 @@ func TestMaybeDispatchImage_UsesConfiguredVLMModel(t *testing.T) {
 		dao.DB,
 		utility.FileTypeVISUAL,
 		"test.png",
-		[]byte("not-
```

**File**: `internal/ingestion/component/parser.go` (modified, +4/-6)
```diff
@@ -240,13 +240,12 @@ func (c *ParserComponent) Check() error {
 			}
 		}
 	}
-	// image family (parser.py:283-287). The legacy "ocr" setup value selects
-	// the tenant default vision model; image OCR is not run by this path.
+	// Image OCR runs independently of optional vision enhancement.
 	if img, ok := c.setups["image"]; ok {
 		pm, _ := img["parse_method"].(string)
 		// A model selected for optional image enhancement needs a language
 		// only when enhancement is enabled.
-		if c.enableVisionEnhancement && pm != "ocr" {
+		if c.enableVisionEnhancement && !strings.EqualFold(pm, "ocr") && pm != "" {
 			if lang, _ := img["lang"].(string); lang == "" {
 				return errors.New("image VLM language does not support empty value")
 			}
@@ -315,7 +314,7 @@ func defaultSetups() map[string]schema.ParserSetup {
 			"llm_id":        "",
 			"lang":          "Chinese",
 			"system_prompt": "",
-			"suffix":        []string{"jpg", "jpeg", "png", "gif"},
+			"suffix":        []string{"jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp"},
 			"output_format": "json",
 		},
 		"email": {
@@ -481,8 +480,7 @@ func (c *ParserComponent) Invoke(ctx context.Context, db *gorm.DB, inputs map[st
 	}
 	var handledImage bool
 	if !handledVision && !handledMedia {
-		// Image/Picture dispatch: optional IMAGE2TEXT vision description.
-		// Mirrors Python's rag/app/picture.py:chunk() image branch.
+		// Image dispatch: OCR with independently controlled VLM enhancement.
 		dispatched, handledImage, visionErr = maybeDispatchImage(ctx, db, fileTypeExt, filename, binary, inputs, setups, c.enableVisionEnhancement)
 		if visionErr != nil {
 			return nil, visionErr
```

---

### Incident Patch 7: `9f7302a4` (2026-09-30)
**Commit Message**: fix: Add the missing env configuration (#20444)

**File**: `docker/.env` (modified, +33/-0)
```diff
@@ -414,6 +414,9 @@ ENABLE_REGISTER=1
 # installs); prefer baking dependencies into the base images instead.
 # SANDBOX_CONTAINER_NETWORK=none
 
+# SSH deployment defaults
+# RAGFLOW_SSH_KNOWN_HOSTS=${HOME}/.ssh/known_hosts
+# SSH_KNOWN_HOSTS=/etc/ragflow/ssh_known_hosts
 # -----------------------------------------------------------------------------
 # Sandbox End
 # -----------------------------------------------------------------------------
@@ -439,6 +442,9 @@ DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
 # Used for ThreadPoolExecutor
 THREAD_POOL_MAX_WORKERS=128
 
+#Option to disable login form for SSO
+DISABLE_PASSWORD_LOGIN=false
+
 # -----------------------------------------------------------------------------
 # Knowledge compilation
 # -----------------------------------------------------------------------------
@@ -497,3 +503,30 @@ OAUTH_AUTO_REGISTER=true
 # server using ONNX Runtime — there is no separate DeepDoc service. Set ORT /
 # model overrides if needed:
 # DEEPDOC_MODEL_DIR=/path/to/InfiniFlow/deepdoc
+
+# -----------------------------------------------------------------------------
+# DeepDoc OSS Vision Service
+# -----------------------------------------------------------------------------
+# URL for the deepdoc vision API (DLA, OCR, TSR) served by OSS ONNX models.
+# The `deepdoc` service defined in docker-compose.yml provides this endpoint.
+# When unset, the parser falls back to inline ONNX Runtime inference.
+
+# Comment existing COMPOSE_PROFILES and uncomment below if need deepdoc service.
+# COMPOSE_PROFILES=${DOC_ENGINE},${DEVICE},deepdoc
+
+# DEEPDOC_URL=http://deepdoc:9390
+
+# Docker image for the OSS deepdoc service.  CPU-only; uses ONNX Runtime.
+# DEEPDOC_IMAGE=deepdoc_oss:latest
+
+
+# -----------------------------------------------------------------------------
+# Native Go MCP listener settings
+# -----------------------------------------------------------------------------
+
+# RAGFLOW_MCP_ENABLED=true
+# RAGFLOW_MCP_HOST=0.0.0.0
+# RAGFLOW_MCP_PORT=9382
+# RAGFLOW_MCP_LAUNCH_MODE=self-host
+# RAGFLOW_MCP_HOST_API_KEY=
+
```

---

### Incident Patch 8: `bc8ee6a9` (2026-09-30)
**Commit Message**: fix(parser): wire MinerU server_url through Go PDF parser (#19445)

**File**: `build.sh` (modified, +22/-6)
```diff
@@ -369,12 +369,28 @@ check_office_oxide_deps() {
     if ! strings "$lib_path" 2>/dev/null | grep -Fxq "$OFFICE_OXIDE_VERSION"; then
         local found_version
         found_version=$(strings "$lib_path" 2>/dev/null | grep -E "^0\.[0-9]+\.[0-9]+$" | head -1)
-        echo -e "${RED}Error: office_oxide native lib version mismatch${NC}"
-        echo "  Required: v${OFFICE_OXIDE_VERSION}; found: ${found_version:-unknown}"
-        echo "  A stale lib silently loses PPT97 (.ppt) slide content. Refresh:"
-        echo "    rm -rf ~/ragflow-native-libs/office_oxide ragflow_deps/office_oxide-linux-x86_64.tar.gz"
-        echo "    uv run python3 ragflow_deps/download_go_deps.py"
-        exit 1
+        echo -e "${YELLOW}office_oxide native lib version mismatch (required v${OFFICE_OXIDE_VERSION}; found: ${found_version:-unknown}); refreshing from download${NC}"
+        rm -rf "${OFFICE_OXIDE_PREFIX}" "${PROJECT_ROOT}/office_oxide-linux-x86_64.tar.gz"
+        if ! (cd "${PROJECT_ROOT}" && uv run python3 ragflow_deps/download_go_deps.py); then
+            echo -e "${RED}Error: office_oxide native lib version mismatch${NC}"
+            echo "  Required: v${OFFICE_OXIDE_VERSION}; found: ${found_version:-unknown}"
+            echo "  A stale lib silently loses PPT97 (.ppt) slide content. Refresh:"
+            echo "    rm -rf ~/ragflow-native-libs/office_oxide ragflow_deps/office_oxide-linux-x86_64.tar.gz"
+            echo "    uv run python3 ragflow_deps/download_go_deps.py"
+            exit 1
+        fi
+        lib_path="${OFFICE_OXIDE_PREFIX}/lib/${lib_file}"
+        header_path="${OFFICE_OXIDE_PREFIX}/include/office_oxide_c/office_oxide.h"
+        if [ ! -f "$lib_path" ] || [ ! -f "$header_path" ]; then
+            echo -e "${RED}Error: office_oxide native library not found after refresh${NC}"
+            exit 1
+        fi
+        if ! strings "$lib_path" 2>/dev/null | grep -Fxq "$OFFICE_OXIDE_VERSION"; then
+            found_version=$(strings "$lib_path" 2>/dev/null | grep -E "^0\.[0-9]+\.[0-9]+$" | head -1)
+            echo -e "${RED}Error: office_oxide native lib version mismatch after refresh${NC}"
+            echo "  Required: v${OFFICE_OXIDE_VERSION}; found: ${found_version:-unknown}"
+            exit 1
+        fi
     fi
 
     echo "✓ office_oxide v${OFFICE_OXIDE_VERSION} native library found at ${OFFICE_OXIDE_PREFIX}"
```

**File**: `internal/common/environments.go` (modified, +1/-0)
```diff
@@ -194,6 +194,7 @@ const (
 	EnvMineruAPIServer                   = "MINERU_APISERVER"
 	EnvMineruAPIKey                      = "MINERU_API_KEY"
 	EnvMineruBackend                     = "MINERU_BACKEND"
+	EnvMineruServerURL                   = "MINERU_SERVER_URL"
 	EnvMonkeyOCRv2ServerURL              = "MONKEYOCRV2_SERVER_URL"
 	EnvMonkeyOCRv2Timeout                = "MONKEYOCRV2_TIMEOUT"
 	EnvOpenDataLoaderAPIServer           = "OPENDATALOADER_APISERVER"
```

**File**: `internal/entity/models/mineru_config.go` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+//
+//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
+//
+
+package models
+
+import (
+	"fmt"
+	"ragflow/internal/common"
+	"strings"
+)
+
+var ValidMinerUBackends = map[string]struct{}{
+	"pipeline":           {},
+	"vlm-engine":         {},
+	"hybrid-engine":      {},
+	"vlm-http-client":    {},
+	"hybrid-http-client": {},
+}
+
+func MinerUBackendRequiresServerURL(backend string) bool {
+	return backend == "vlm-http-client" || backend == "hybrid-http-client"
+}
+
+func ValidateMinerUConfig(backend, serverURL string) error {
+	if _, ok := ValidMinerUBackends[backend]; !ok {
+		return fmt.Errorf(
+			"parser: MinerU invalid backend %q (valid: pipeline, vlm-engine, hybrid-engine, vlm-http-client, hybrid-http-client)",
+			backend,
+		)
+	}
+	if MinerUBackendRequiresServerURL(backend) && serverURL == "" {
+		return fmt.Errorf("parser: MinerU requires mineru_server_url or MINERU_SERVER_URL for backend %q", backend)
+	}
+	return nil
+}
+
+// MinerUProviderAPIKeyConfig holds fields stored in the tenant MinerU provider api_key JSON.
+type MinerUProviderAPIKeyConfig struct {
+	IsProviderJSON bool
+	APIServer      string
+	Backend        string
+	ServerURL      string
+	AccessToken    string
+}
+
+// MinerUProviderConfigFromAPIKey parses the tenant MinerU api_key payload the same way
+// the provider UI stores it: mineru_apiserver, mineru_backend, mineru_server_url, etc.
+// A non-JSON api_key is treated as a plain bearer token. JSON provider config does not
+// imply a bearer token unless mineru_api_key or access_token is present.
+func MinerUProviderConfigFromAPIKey(apiKey string) MinerUProviderAPIKeyConfig {
+	trimmed := strings.TrimSpace(apiKey)
+	if trimmed == "" {
+		return MinerUProviderAPIKeyConfig{}
+	}
+	raw := providerJSONConfigMap(trimmed)
+	if raw == nil {
+		return MinerUProviderAPIKeyConfig{AccessToken: trimmed}
+	}
+	get := func(key string) string {
+		if value, ok := raw[key]; ok && value != nil {
+			return strings.TrimSpace(fmt.Sprint(value))
+		}
+		return ""
+	}
+	token := get("mineru_api_key")
+	if token == "" {
+		token = get("access_token")
+	}
+	return MinerUProviderAPIKeyConfig{
+		IsProviderJSON: true,
+		APIServer:      get("mineru_apiserver"),
+		Backend:        get("mineru_backend"),
+		ServerURL:      strings.TrimRight(get("mineru_server_url"), "/"),
+		AccessToken:    token,
+	}
+}
+
+// MinerUBearerTokenFromAPIKey returns the Authorization bearer secret for MinerU HTTP calls.
+func MinerUBearerTokenFromAPIKey(apiKey string) string {
+	return MinerUProviderConfigFromAPIKey(apiKey).AccessToken
+}
+
+func ResolveMinerUBackend(setupBackend, apiKey string) string {
+	backend := strings.TrimSpace(setupBackend)
+	if backend == "" {
+		cfg := MinerUProviderConfigFromAPIKey(apiKey)
+		if cfg.Backend != "" {
+			backend = cfg.Backend
+		}
+	}
+	if backend == "" {
+		backend = strings.TrimSpace(common.GetEnv(common.EnvMineruBackend))
+	}
+	if backend == "" {
+		backend = "pipeline"
+	}
+	return backend
+}
+
+func ResolveMinerUServerURL(setupServerURL, apiKey string) string {
+	serverURL := strings.TrimSpace(setupServerURL)
+	if serverURL == "" {
+		cfg := MinerUProviderConfigFromAPIKey(apiKey)
+		if cfg.ServerURL != "" {
+			serverURL = cfg.ServerURL
+		}
+	}
+	if serverURL == "" {
+		serverURL = strings.TrimSpace(common.GetEnv(common.EnvMineruServerURL))
+	}
+	return strings.TrimRight(serverURL, "/")
+}
```

**File**: `internal/entity/models/mineru_config_test.go` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+//
+//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
+//
+
+package models
+
+import "testing"
+
+func TestMinerUProviderConfigFromAPIKey(t *testing.T) {
+	t.Run("plain bearer token", func(t *testing.T) {
+		cfg := MinerUProviderConfigFromAPIKey("secret-token")
+		if cfg.IsProviderJSON || cfg.AccessToken != "secret-token" {
+			t.Fatalf("cfg = %#v, want plain token", cfg)
+		}
+	})
+
+	t.Run("provider JSON without bearer", func(t *testing.T) {
+		raw := `{"mineru_apiserver":"http://mineru:9987","mineru_backend":"vlm-http-client","mineru_server_url":"http://vllm:30000"}`
+		cfg := MinerUProviderConfigFromAPIKey(raw)
+		if !cfg.IsProviderJSON {
+			t.Fatal("expected provider JSON")
+		}
+		if cfg.AccessToken != "" {
+			t.Fatalf("AccessToken = %q, want empty", cfg.AccessToken)
+		}
+		if cfg.APIServer != "http://mineru:9987" || cfg.Backend != "vlm-http-client" || cfg.ServerURL != "http://vllm:30000" {
+			t.Fatalf("cfg = %#v", cfg)
+		}
+	})
+
+	t.Run("provider JSON with explicit token", func(t *testing.T) {
+		raw := `{"mineru_apiserver":"http://mineru:9987","mineru_api_key":"bearer-secret"}`
+		cfg := MinerUProviderConfigFromAPIKey(raw)
+		if cfg.AccessToken != "bearer-secret" {
+			t.Fatalf("AccessToken = %q", cfg.AccessToken)
+		}
+	})
+
+	t.Run("access_token only JSON object", func(t *testing.T) {
+		raw := `{"access_token":"secret"}`
+		cfg := MinerUProviderConfigFromAPIKey(raw)
+		if !cfg.IsProviderJSON {
+			t.Fatal("expected provider JSON")
+		}
+		if cfg.AccessToken != "secret" {
+			t.Fatalf("AccessToken = %q, want secret", cfg.AccessToken)
+		}
+	})
+
+	t.Run("JSON object without token fields", func(t *testing.T) {
+		raw := `{"other_field":"value"}`
+		cfg := MinerUProviderConfigFromAPIKey(raw)
+		if !cfg.IsProviderJSON {
+			t.Fatal("expected provider JSON")
+		}
+		if cfg.AccessToken != "" {
+			t.Fatalf("AccessToken = %q, want empty", cfg.AccessToken)
+		}
+	})
+}
+
+func TestResolveMinerUBackendAndServerURL(t *testing.T) {
+	apiKey := `{"mineru_backend":"hybrid-http-client","mineru_server_url":"http://vllm:30000"}`
+	if got := ResolveMinerUBackend("", apiKey); got != "hybrid-http-client" {
+		t.Fatalf("backend = %q", got)
+	}
+	if got := ResolveMinerUServerURL("", apiKey); got != "http://vllm:30000" {
+		t.Fatalf("server_url = %q", got)
+	}
+	if got := ResolveMinerUBackend("pipeline", apiKey); got != "pipeline" {
+		t.Fatalf("setup should win, backend = %q", got)
+	}
+}
```

**File**: `internal/entity/models/mineru_local.go` (modified, +31/-8)
```diff
@@ -25,6 +25,7 @@ import (
 	"mime/multipart"
 	"net/http"
 	"ragflow/internal/common"
+	"strings"
 )
 
 type MinerULocalModel struct {
@@ -125,10 +126,28 @@ func (m *MinerULocalModel) ParseFile(ctx context.Context, modelName *string, con
 		return nil, fmt.Errorf("failed to write file content: %w", err)
 	}
 
-	if modelName != nil && *modelName != "" {
-		_ = writer.WriteField("backend", *modelName)
-	} else {
-		_ = writer.WriteField("backend", "pipeline")
+	apiKeyRaw := ""
+	if apiConfig != nil && apiConfig.ApiKey != nil {
+		apiKeyRaw = *apiConfig.ApiKey
+	}
+	setupBackend := ""
+	if modelName != nil && strings.TrimSpace(*modelName) != "" {
+		setupBackend = strings.TrimSpace(*modelName)
+	} else if parseFileConfig != nil {
+		setupBackend = strings.TrimSpace(parseFileConfig.Backend)
+	}
+	setupServerURL := ""
+	if parseFileConfig != nil {
+		setupServerURL = parseFileConfig.ServerURL
+	}
+	backend := ResolveMinerUBackend(setupBackend, apiKeyRaw)
+	serverURL := ResolveMinerUServerURL(setupServerURL, apiKeyRaw)
+	if err := ValidateMinerUConfig(backend, serverURL); err != nil {
+		return nil, err
+	}
+	_ = writer.WriteField("backend", backend)
+	if serverURL != "" {
+		_ = writer.WriteField("server_url", serverURL)
 	}
 
 	if err = writer.Close(); err != nil {
@@ -145,8 +164,10 @@ func (m *MinerULocalModel) ParseFile(ctx context.Context, modelName *string, con
 
 	req.Header.Set("Content-Type", writer.FormDataContentType())
 
-	if auth := BearerAuth(apiConfig); auth != "" {
-		req.Header.Set("Authorization", auth)
+	if apiConfig != nil && apiConfig.ApiKey != nil {
+		if token := MinerUBearerTokenFromAPIKey(*apiConfig.ApiKey); token != "" {
+			req.Header.Set("Authorization", "Bearer "+token)
+		}
 	}
 
 	resp, err := m.baseModel.httpClient.Do(req)
@@ -213,8 +234,10 @@ func (m *MinerULocalModel) ShowTask(ctx context.Context, taskID string, apiConfi
 		return nil, fmt.Errorf("failed to create status request: %w", err)
 	}
 
-	if auth := BearerAuth(apiConfig); auth != "" {
-		req.Header.Set("Authorization", auth)
+	if apiConfig != nil && apiConfig.ApiKey != nil {
+		if token := MinerUBearerTokenFromAPIKey(*apiConfig.ApiKey); token != "" {
+			req.Header.Set("Authorization", "Bearer "+token)
+		}
 	}
 
 	resp, err := m.baseModel.httpClient.Do(req)
```

**File**: `internal/entity/models/mineru_local_test.go` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+//
+//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
+//
+
+package models
+
+import (
+	"context"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+)
+
+func TestMinerULocalParseFileResolvesServerURLFromProviderAPIKey(t *testing.T) {
+	var gotServerURL string
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if err := r.ParseMultipartForm(10 << 20); err != nil {
+			http.Error(w, err.Error(), http.StatusBadRequest)
+			return
+		}
+		gotServerURL = r.FormValue("server_url")
+		w.WriteHeader(http.StatusOK)
+		_, _ = w.Write([]byte(`{"data":{"task_id":"task-1"}}`))
+	}))
+	defer server.Close()
+
+	baseURL := server.URL
+	driver := NewMinerLocalUModel(map[string]string{"default": baseURL}, URLSuffix{DocumentParse: "file_parse", Task: "tasks"})
+	apiKey := `{"mineru_backend":"vlm-http-client","mineru_server_url":"http://vllm:30000"}`
+	apiConfig := &APIConfig{
+		BaseURL: &baseURL,
+		ApiKey:  &apiKey,
+	}
+	backend := "vlm-http-client"
+	_, err := driver.ParseFile(context.Background(), &backend, []byte("%PDF-1.4"), nil, apiConfig, &ParseFileConfig{}, nil)
+	if err != nil {
+		t.Fatalf("ParseFile: %v", err)
+	}
+	if gotServerURL != "http://vllm:30000" {
+		t.Fatalf("server_url = %q, want http://vllm:30000", gotServerURL)
+	}
+}
+
+func TestMinerULocalParseFileRequestOverridesProviderJSON(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		_ = r.ParseMultipartForm(10 << 20)
+		if r.FormValue("server_url") != "http://override:9" {
+			http.Error(w, "bad server_url", http.StatusBadRequest)
+			return
+		}
+		w.WriteHeader(http.StatusOK)
+		_, _ = w.Write([]byte(`{"task_id":"task-2"}`))
+	}))
+	defer server.Close()
+
+	baseURL := server.URL
+	driver := NewMinerLocalUModel(map[string]string{"default": baseURL}, URLSuffix{DocumentParse: "file_parse", Task: "tasks"})
+	apiKey := `{"mineru_server_url":"http://vllm:30000"}`
+	apiConfig := &APIConfig{BaseURL: &baseURL, ApiKey: &apiKey}
+	cfg := &ParseFileConfig{ServerURL: "http://override:9"}
+	_, err := driver.ParseFile(context.Background(), nil, []byte("x"), nil, apiConfig, cfg, nil)
+	if err != nil {
+		t.Fatalf("ParseFile: %v", err)
+	}
+}
+
+// Ensure multipart field names stay stable (regression guard).
+func TestMinerULocalParseFileMultipartFieldNames(t *testing.T) {
+	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		reader, err := r.MultipartReader()
+		if err != nil {
+			http.Error(w, err.Error(), http.StatusBadRequest)
+			return
+		}
+		names := map[string]bool{}
+		for {
+			part, err := reader.NextPart()
+			if err == io.EOF {
+				break
+			}
+			if err != nil {
+				http.Error(w, err.Error(), http.StatusBadRequest)
+				return
+			}
+			names[part.FormName()] = true
+			_ = part.Close()
+		}
+		if !names["files"] || !names["backend"] {
+			http.Error(w, "missing fields", http.StatusBadRequest)
+			return
+		}
+		w.WriteHeader(http.StatusOK)
+		_, _ = w.Write([]byte(`{"data":{"task_id":"t"}}`))
+	}))
+	defer server.Close()
+
+	baseURL := server.URL
+	driver := NewMinerLocalUModel(map[string]string{"default": baseURL}, URLSuffix{DocumentParse: "file_parse", Task: "tasks"})
+	backend := "pipeline"
+	_, err := driver.ParseFile(context.Background(), &backend, []byte("data"), nil, &APIConfig{BaseURL: &baseURL}, nil, nil)
+	if err != nil {
+		t.Fatalf("ParseFile: %v", err)
+	}
+}
```

**File**: `internal/entity/models/provider_json_config.go` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+//
+//  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
+//
+
+package models
+
+import (
+	"encoding/json"
+	"fmt"
+	"strings"
+)
+
+func providerJSONConfigMap(apiKey string) map[string]any {
+	trimmed := strings.TrimSpace(apiKey)
+	if trimmed == "" {
+		return nil
+	}
+	var config map[string]any
+	if err := json.Unmarshal([]byte(trimmed), &config); err != nil {
+		return nil
+	}
+	if nested, ok := config["api_key"].(map[string]any); ok {
+		config = nested
+	}
+	return config
+}
+
+// ProviderJSONConfigValue reads string fields from a tenant provider api_key JSON blob.
+// keys are tried in order.
+func ProviderJSONConfigValue(apiKey string, keys ...string) string {
+	config := providerJSONConfigMap(apiKey)
+	if config == nil {
+		return ""
+	}
+	for _, key := range keys {
+		if value, ok := config[key]; ok && value != nil {
+			return strings.TrimSpace(fmt.Sprint(value))
+		}
+	}
+	return ""
+}
+
+func ProviderJSONConfigValueFromAPIConfig(apiConfig *APIConfig, keys ...string) string {
+	if apiConfig == nil || apiConfig.ApiKey == nil {
+		return ""
+	}
+	return ProviderJSONConfigValue(*apiConfig.ApiKey, keys...)
+}
```

**File**: `internal/entity/models/types.go` (modified, +2/-0)
```diff
@@ -262,6 +262,8 @@ type OCRConfig struct {
 
 type ParseFileConfig struct {
 	ParseMethod string `json:"parse_method"`
+	Backend     string `json:"backend"`
+	ServerURL   string `json:"server_url"`
 }
 
 // EmbeddingModel wraps a ModelDriver with embedding-specific configuration
```

---

### Incident Patch 9: `4ba6fdda` (2026-09-30)
**Commit Message**: chore(deps): bump brace-expansion in /web (#20435)

**File**: `web/package-lock.json` (modified, +6/-6)
```diff
@@ -10686,9 +10686,9 @@
       "license": "ISC"
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmmirror.com/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmmirror.com/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -14294,9 +14294,9 @@
       }
     },
     "node_modules/filelist/node_modules/brace-expansion": {
-      "version": "2.0.2",
-      "resolved": "https://registry.npmmirror.com/brace-expansion/-/brace-expansion-2.0.2.tgz",
-      "integrity": "sha512-Jt0vHyM+jmUBqojB7E1NIYadt0vI0Qxjxd2TErW94wDz+E2LAm5vKMXXwg6ZZBTHPuUlDgQHKXvjGBdfcF1ZDQ==",
+      "version": "2.1.7",
+      "resolved": "https://registry.npmmirror.com/brace-expansion/-/brace-expansion-2.1.7.tgz",
+      "integrity": "sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

---

### Incident Patch 10: `16e19da8` (2026-09-30)
**Commit Message**: Doc: fix errors (#20427)

Signed-off-by: Jin Hai <[REDACTED_EMAIL]>

**File**: `docs/administrator/_category_.json` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
   "position": 4,
   "link": {
     "type": "generated-index",
-    "description": "Guides for system administrtors"
+    "description": "Guides for system administrtor"
   },
   "customProps": {
     "sidebarIcon": "LucideComputer"
```

**File**: `docs/administrator/admin/admin_service.md` (modified, +2/-2)
```diff
@@ -61,7 +61,7 @@ If no superuser exists, this option currently creates `admin@ragflow.io` with th
 
 To change the Admin listening port, set `admin.http_port` in the server configuration.
 
-For processes on another host, set `admin.host` and `admin.http_port` in their server configuration to the reachable Admin address and port. When changing the Admin port, also update the CLI connection address and the health-check URLs below.
+For processes on another host, set `admin.host` and `admin.http_port` in their server configuration to the reachable Admin address and port. When changing the Admin port, also update the CLI connection address and the health check URLs below.
 
 ## Start with Docker Compose
 
@@ -92,7 +92,7 @@ curl -f http://127.0.0.1:9381/healthz
 The API server, ingestor, and syncer periodically send heartbeat reports to Admin. Admin keeps their latest reports in its runtime service registry; it does not register itself there. After those processes start, launch the Go CLI and log in as an administrator. If you changed the Admin port or are connecting from another host, add `--host <host:port>` to the CLI command:
 
 ```bash
-./bin/ragflow-cli --admin
+ragflow-cli --admin
 ```
 
 ```text
```

**File**: `docs/administrator/admin/admin_ui/check_system_status.md` (modified, +10/-10)
```diff
@@ -18,16 +18,16 @@ For dependencies, `alive` means that the corresponding health check succeeded. `
 
 The open-source Go deployment reports the following entries:
 
-| Service type | Entry | How the status is determined |
-| --- | --- | --- |
-| `database` | MySQL | The server obtains the SQL connection and runs a database ping. |
-| `doc_engine` | The configured document engine, such as Elasticsearch or Infinity | The server calls the active document engine's ping operation. |
-| `storage_engine` | The configured object storage, such as MinIO | The server calls the active storage implementation's health check. |
-| `cache` | Kvrocks | The server checks the configured Kvrocks connection. |
-| `message_queue` | NATS | The server reads the status of the active message queue implementation. |
-| `api_server` | Each reporting API process | Admin evaluates the process heartbeat. |
-| `ingestor` | Each reporting Ingestor process | Admin evaluates the process heartbeat. |
-| `file_syncer` | Each reporting Syncer process | Admin evaluates the process heartbeat. |
+| Service type     | Entry                                                             | How the status is determined                                            |
+|------------------|-------------------------------------------------------------------|-------------------------------------------------------------------------|
+| `database`       | MySQL                                                             | The server obtains the SQL connection and runs a database ping.         |
+| `doc_engine`     | The configured document engine, such as Elasticsearch or Infinity | The server calls the active document engine's ping operation.           |
+| `storage_engine` | The configured object storage, such as MinIO                      | The server calls the active storage implementation's health check.      |
+| `cache`          | Kvrocks                                                           | The server checks the configured Kvrocks connection.                    |
+| `message_queue`  | NATS                                                              | The server reads the status of the active message queue implementation. |
+| `api_server`     | Each reporting API process                                        | Admin evaluates the process heartbeat.                                  |
+| `ingestor`       | Each reporting Ingestor process                                   | Admin evaluates the process heartbeat.                                  |
+| `file_syncer`    | Each reporting Syncer process                                     | Admin evaluates the process heartbeat.                                  |
 
 Only processes that have reported a heartbeat to Admin appear in the process portion of the list. For dependency rows, `elapsed` records timing information from the corresponding status check; for API, Ingestor, and Syncer rows, it records the time since the latest heartbeat. The host is shown as `-` and the port as `0` when the configured document engine or storage implementation does not provide an endpoint for the status row.
 
```

**File**: `docs/administrator/admin/ragflow_cli.md` (modified, +46/-46)
```diff
@@ -101,15 +101,15 @@ ragflow-cli --admin \
 
 Avoid passing a real password with `--password`: command-line arguments can be visible to other local processes and may be retained in shell history. If you used the initial password, change it after logging in with `ALTER USER PASSWORD 'admin@ragflow.io' '<new_password>';`.
 
-| Option | Description |
-| --- | --- |
-| `--admin`, `-admin` | Start in Admin mode. |
-| `-h`, `--host <host:port>` | Admin Service address. The default is `127.0.0.1:9381`. |
-| `-u`, `--user <email>` | Administrator email address. |
+| Option                        | Description                                                                                           |
+|-------------------------------|-------------------------------------------------------------------------------------------------------|
+| `--admin`, `-admin`           | Start in Admin mode.                                                                                  |
+| `-h`, `--host <host:port>`    | Admin Service address. The default is `127.0.0.1:9381`.                                               |
+| `-u`, `--user <email>`        | Administrator email address.                                                                          |
 | `-p`, `--password <password>` | Administrator password. Prefer the interactive prompt to avoid exposing it in command-line arguments. |
-| `-k`, `--key <path>` | Key file used by the client. |
-| `-o`, `--output <format>` | Output format: `table`, `plain`, or `json`. |
-| `-v`, `--verbose` | Enable verbose output. |
+| `-k`, `--key <path>`          | Key file used by the client.                                                                          |
+| `-o`, `--output <format>`     | Output format: `table`, `plain`, or `json`.                                                           |
+| `-v`, `--verbose`             | Enable verbose output.                                                                                |
 
 ## Commands
 
@@ -135,10 +135,10 @@ Logs in to the Admin Service with an administrator account. If `PASSWORD` is omi
 LOGIN ADMIN '<email>' [PASSWORD '<password>'];
 ```
 
-| Parameter | Required | Description |
-| --- | --- | --- |
-| `<email>` | Yes | Administrator email address. |
-| `[PASSWORD '<password>']` | No | Administrator password. Omit this segment to enter the password interactively. |
+| Parameter                 | Required | Description                                                                    |
+|---------------------------|----------|--------------------------------------------------------------------------------|
+| `<email>`                 | Yes      | Administrator email address.                                                   |
+| `[PASSWORD '<password>']` | No       | Administrator password. Omit this segment to enter the password interactively. |
 
 **Example**
 
@@ -260,9 +260,9 @@ Shows the current status of one service. Use the service name returned by `LIST
 SHOW SERVICE '<service_name>';
 ```
 
-| Parameter | Required | Description |
-| --- | --- | --- |
-| `<service_name>` | Yes | Service name returned by `LIST SERVICES`, such as `mysql`. |
+| Parameter        | Required | Description                                                |
+|------------------|----------|------------------------------------------------------------|
+| `<service_name>` | Yes      | Service name returned by `LIST SERVICES`, such as `mysql`. |
 
 **Example**
 
@@ -298,9 +298,9 @@ Shows details for one user.
 SHOW USER '<email>';
 ```
 
-| Parameter | Required | Description |
-| --- | --- | --- |
-| `<email>` | Yes | User email address. |
+| Parameter | Required | Description         |
+|-----------|----------|---------------------|
+| `<email>` | Yes      | User email address. |
 
 **Example**
 
@@ -318,10 +318,10 @@ Creates a user with the standard `user` role.
 CREATE USER '<email>' '<password>';
 ```
 
-| Parameter | Required | Description |
-| --- | --- | --- |
-| `<email>` | Yes | Email address for the new user. |
-| `<password>` | Yes | Initial password for the new user. |
+| Parameter    | Required | Description                        |
+|--------------|----------|------------------------------------|
+| `<email>`    | Yes      | Email address for the new user.    |
+| `<password>` | Yes      | Initial password for the new user. |
 
 **Example**
 
@@ -340,10 +340,10 @@ Activates or deactivates a user.
 ALTER USER ACTIVE '<email>' <on|off>;
 ```
 
-| Parameter | Required | Description |
-| --- | --- | --- |
-| `<email>` | Yes | User email address. |
-| `<on\|off>` | Yes | `on` activates the user; `off` deactivates the user. |
+| Parameter   | Required | Description                                          |
+|-------------|----------|------------------------------------------------------|
+| `<email>`   | Yes      | User email address.                                  |
+| `<on\|off>` | Yes      | `on` activates the user; `off`
```

**File**: `docs/administrator/configurations/configurations.md` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ If you cannot download the RAGFlow Docker image, try the following mirrors.
 
 - `host`: The API server's IP address inside the Docker container. Defaults to `0.0.0.0`.
 - `http_port`: The API server's serving port inside the Docker container. Defaults to `9380`.
-- `trusted_proxies`: The proxy IPs or CIDRs whose `X-Forwarded-For` / `X-Real-IP` headers the Go API server trusts when resolving the client address (used by the agent webhook `ip_whitelist` and login audit records). Defaults to loopback (`['127.0.0.0/8', '::1/128']`), i.e. the nginx bundled in the Docker image. An explicit list *replaces* the default rather than extending it, so keep the loopback entries when adding a further proxy placed in front of nginx, for example `['127.0.0.0/8', '::1/128', '10.0.0.0/8']`; an empty list trusts no proxy headers at all.
+- `trusted_proxies`: The proxy IPs or CIDRs whose `X-Forwarded-For` / `X-Real-IP` headers the Go API server trusts when resolving the client address (used by the agent webhook `ip_whitelist` and login audit records). Defaults to loopback (`['127.0.0.0/8', '::1/128']`), i.e. the nginx bundled in the Docker image. An explicit list *replaces* the default rather than extending it, so keep the loopback entries when adding a proxy placed in front of nginx, for example `['127.0.0.0/8', '::1/128', '10.0.0.0/8']`; an empty list trusts no proxy headers at all.
 
 ### `mysql`
 
```

**File**: `docs/administrator/configurations/sandbox_quickstart.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ RAGFlow supports multiple sandbox providers. Configure the active provider in Ad
 
 ### Tenki
 
-`tenki` runs each code execution in a fresh Tenki microVM and destroys it afterwards. It is cloud-hosted, so it needs no local sandbox services, gVisor, or Docker base images — only outbound network access and an API key.
+`tenki` runs each code execution in a fresh Tenki microVM and destroys it afterward. It is cloud-hosted, so it needs no local sandbox services, gVisor, or Docker base images — only outbound network access and an API key.
 
 Configure it in **Admin > Sandbox Settings**:
 
```

**File**: `docs/administrator/migration/backup_and_migration.md` (modified, +9/-8)
```diff
@@ -29,14 +29,14 @@ Record the Compose project name and the volumes actually mounted by its running
 
 The default Go stack can use these volumes, depending on the enabled services:
 
-| Service or data | Typical volume |
-| --- | --- |
-| Metadata database | `<project>_mysql_data` |
-| Uploaded objects in bundled MinIO | `<project>_minio_data` |
-| Search index with Elasticsearch | `<project>_esdata01` |
-| Go cache and persistent Redis-protocol data | `<project>_kvrocks_data` |
-| NATS JetStream data | `<project>_nats_data` |
-| ClickHouse analytics data | `<project>_clickhouse_data` |
+| Service or data                             | Typical volume              |
+|---------------------------------------------|-----------------------------|
+| Metadata database                           | `<project>_mysql_data`      |
+| Uploaded objects in bundled MinIO           | `<project>_minio_data`      |
+| Search index with Elasticsearch             | `<project>_esdata01`        |
+| Go cache and persistent Redis-protocol data | `<project>_kvrocks_data`    |
+| NATS JetStream data                         | `<project>_nats_data`       |
+| ClickHouse analytics data                   | `<project>_clickhouse_data` |
 
 Also retain `docker/.env`, the configuration template, and any custom certificates or mounted files. Protect the backup because these files may contain credentials.
 
@@ -69,6 +69,7 @@ Keep the volume name in each archive filename and copy the entire `backup-go` di
 
 ### 3. Restore on the target host
 
+
 Install the matching Go deployment and configuration on the target host. Keep services stopped and put `backup-go` in the repository root.
 
 For each archived Docker volume, restore into a **new, empty volume**. Replace both names in this example and repeat. Keep the source name when reading the archive; use the target Compose project's name when creating its volume:
```

**File**: `docs/administrator/migration/database_change_log.md` (modified, +50/-50)
```diff
@@ -29,11 +29,11 @@ Startup order in `InitDB` ([database.go](https://github.com/infiniflow/ragflow/b
 
 ## Version overview
 
-| Database version | Scope | Gate constant |
-|---|---|---|
-| `v0.26.0` | Rebuild the tenant model tables from `tenant_llm` and normalize stored model ids | `modelMigrationBaseVersion` |
-| `v1.0.0-rc1` | Seed factory-declared models, merge `model_type` into an integer bitmask, populate the `tenant_*_id` columns | `modelMigrationTargetVersion` |
-| `v1.0.0-rc1.dev1` | Split conversation message and reference payloads into child tables | `conversationHistoryTargetVersion` |
+| Database version  | Scope                                                                                                        | Gate constant                      |
+|-------------------|--------------------------------------------------------------------------------------------------------------|------------------------------------|
+| `v0.26.0`         | Rebuild the tenant model tables from `tenant_llm` and normalize stored model ids                             | `modelMigrationBaseVersion`        |
+| `v1.0.0-rc1`      | Seed factory-declared models, merge `model_type` into an integer bitmask, populate the `tenant_*_id` columns | `modelMigrationTargetVersion`      |
+| `v1.0.0-rc1.dev1` | Split conversation message and reference payloads into child tables                                          | `conversationHistoryTargetVersion` |
 
 The two tenant model steps are cumulative: a database at `v0.26.0` still runs the `v1.0.0-rc1` step, and a database at or above `v1.0.0-rc1` runs neither.
 
@@ -43,22 +43,22 @@ The two tenant model steps are cumulative: a database at `v0.26.0` still runs th
 
 ### Schema changes
 
-| Object | Change |
-|---|---|
-| `system_settings` | Created if missing, so the version marker can be written before `AutoMigrate` reaches the table. |
+| Object                  | Change                                                                                                                                                                   |
+|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
+| `system_settings`       | Created if missing, so the version marker can be written before `AutoMigrate` reaches the table.                                                                         |
 | `tenant_model_provider` | Created if missing. Columns: `id` (PK, varchar 32), `provider_name`, `tenant_id`, base timestamps. Unique index `idx_tenant_provider_unique (tenant_id, provider_name)`. |
-| `tenant_model_instance` | Created if missing. Columns: `id` (PK), `instance_name`, `provider_id`, `api_key`, `status`, `extra`, base timestamps. |
-| `tenant_model` | Created if missing. Columns: `id` (PK), `model_name`, `provider_id`, `instance_id`, `model_type`, `status`, `extra`, base timestamps. |
+| `tenant_model_instance` | Created if missing. Columns: `id` (PK), `instance_name`, `provider_id`, `api_key`, `status`, `extra`, base timestamps.                                                   |
+| `tenant_model`          | Created if missing. Columns: `id` (PK), `model_name`, `provider_id`, `instance_id`, `model_type`, `status`, `extra`, base timestamps.                                    |
 
 The three tables are created only when the legacy `tenant_llm` table exists and the target table does not, mirroring the `CREATE TABLE IF NOT EXISTS` the Python stages run. Existing tables are never altered by this step: `tenant_model.model_type` deliberately keeps the text shape the Python migration left behind so the `v1.0.0-rc1` merge can still read the legacy model names.
 
 ### Data migration
 
-| Table | Change |
-|---|---|
-| `tenant_model_provider` | One row per distinct `(tenant_id, llm_factory)` in `tenant_llm`; `provider_name` takes the factory name. |
-| `tenant_model_instance` | One row per `(tenant_id, llm_factory)`, carrying the first `api_key` after deduplication; `instance_name` defaults to `default`. |
-| `tenant_model` | Rows derived from `tenant_llm`: `model_type` is written as an integer bitmask, only groups whose merged status is `active` are kept, and `provider_id` / `instance_id` point at the rows created above. Bits: `chat=1`, `embedding=2`, `asr`/`speech2text=4`, `vision`/`image2text=8`, `rerank=16`, `tts=32`, `ocr=64`. |
+| Table                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                 |
+|-----------------------------------------------|-
```

---

### Incident Patch 11: `63048256` (2026-09-30)
**Commit Message**: fix(parser): preserve DOCX XML character references (#20359)

**File**: `build.sh` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ SYSTEM_DEPS="/opt/ragflow-native-libs"
 
 # office_oxide native library settings — static linking
 OFFICE_OXIDE_PREFIX="${HOME}/ragflow-native-libs/office_oxide"
-OFFICE_OXIDE_VERSION="0.1.9"
+OFFICE_OXIDE_VERSION="0.1.12"
 
 # pdfium native library settings — static linking (kognitos/pdfium-static)
 PDFIUM_STATIC_PREFIX="${HOME}/ragflow-native-libs/pdfium-static"
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ require (
 	github.com/spf13/viper v1.18.2
 	github.com/ucloud/ucloud-sandbox-sdk-go v0.0.0-20260807065450-08464aef9ed5
 	github.com/xuri/excelize/v2 v2.11.0
-	github.com/yfedoseev/office_oxide/go v0.1.9
+	github.com/yfedoseev/office_oxide/go v0.1.12
 	github.com/yfedoseev/pdf_oxide/go v0.3.73
 	github.com/yuin/goldmark v1.7.1
 	github.com/zeebo/xxh3 v1.0.2
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -612,8 +612,8 @@ github.com/xuri/nfp v0.0.2-0.20250530014748-2ddeb826f9a9 h1:+C0TIdyyYmzadGaL/HBL
 github.com/xuri/nfp v0.0.2-0.20250530014748-2ddeb826f9a9/go.mod h1:WwHg+CVyzlv/TX9xqBFXEZAuxOPxn2k1GNHwG41IIUQ=
 github.com/yargevad/filepathx v1.0.0 h1:SYcT+N3tYGi+NvazubCNlvgIPbzAk7i7y2dwg3I5FYc=
 github.com/yargevad/filepathx v1.0.0/go.mod h1:BprfX/gpYNJHJfc35GjRRpVcwWXS89gGulUIU5tK3tA=
-github.com/yfedoseev/office_oxide/go v0.1.9 h1:gvTMCvJDYEZNF4dKd1cdfvU+9SRDSpnbNhCpZJbZOaE=
-github.com/yfedoseev/office_oxide/go v0.1.9/go.mod h1:YLtMlKUkRCp/Q96wsy7D6yoBKDeJnP66UH+c9Bb+E+M=
+github.com/yfedoseev/office_oxide/go v0.1.12 h1:QLsiB8Aj7LB42D9Vwu1rslRuZg/vSXc4IkVXCDKQv6o=
+github.com/yfedoseev/office_oxide/go v0.1.12/go.mod h1:YLtMlKUkRCp/Q96wsy7D6yoBKDeJnP66UH+c9Bb+E+M=
 github.com/yfedoseev/pdf_oxide/go v0.3.73 h1:hRad+X4W0ILW3bCQeCvdUKcoy8yMj2TFS6/XtoMk55I=
 github.com/yfedoseev/pdf_oxide/go v0.3.73/go.mod h1:QbJ/nLbez0al2EnqEdEPIlGflFprWmiuUM4mo9rNNOI=
 github.com/yosida95/uritemplate/v3 v3.0.2 h1:Ed3Oyj9yrmi9087+NczuL5BwkIc4wvTb5zIM+UJPGz4=
```

**File**: `internal/parser/parser/doc_parser_synth_test.go` (modified, +2/-0)
```diff
@@ -91,6 +91,8 @@ func buildSyntheticDoc(t *testing.T, text string) []byte {
 	copy(dir[1*128:], dirEntry("WordDocument", 2, 2, uint64(len(wordDoc))))
 	copy(dir[2*128:], dirEntry("0Table", 2, 3, uint64(len(clx))))
 	copy(dir[3*128:], dirEntry("", 0, 0xFFFFFFFF, 0))
+	binary.LittleEndian.PutUint32(dir[0*128+0x4C:], 1) // root child: WordDocument
+	binary.LittleEndian.PutUint32(dir[1*128+0x44:], 2) // left sibling: 0Table
 
 	// ── Assemble ──────────────────────────────────────────────────────────
 	tableSector := make([]byte, sector)
```

**File**: `internal/parser/parser/docx_parser_cgo_test.go` (modified, +58/-0)
```diff
@@ -5,6 +5,7 @@ package parser
 import (
 	"archive/zip"
 	"bytes"
+	"strings"
 	"testing"
 )
 
@@ -129,3 +130,60 @@ func writeZipFile(t *testing.T, zw *zip.Writer, name, body string) {
 		t.Fatalf("write zip entry %s: %v", name, err)
 	}
 }
+
+// TestDOCXParser_PreservesXMLCharacterReferences pins the office_oxide version.
+// v0.1.9 deleted every XML character reference in DOCX run text instead of
+// decoding it, so <w:t>&lt;SEP&gt;</w:t> parsed as "SEP". That reached the
+// chunker intact, so a delimiter configured as "`<SEP>`" could never match and
+// the marker survived into the chunk body. v0.1.10 was the correctness release
+// that fixed this defect class; v0.1.12 is the pinned version.
+func TestDOCXParser_PreservesXMLCharacterReferences(t *testing.T) {
+	cases := []struct {
+		name         string
+		run          string // run text as it appears inside <w:t>, entities unescaped
+		want         string
+		wantMarkdown string
+	}{
+		{"named", "&lt;SEP&gt;", "<SEP>", `\<SEP\>`},
+		{"decimal", "&#60;SEP&#62;", "<SEP>", `\<SEP\>`},
+		{"hex", "&#x3C;SEP&#x3E;", "<SEP>", `\<SEP\>`},
+		{"ampersand", "A&amp;B", "A&B", "A&B"},
+		{"apostrophe", "it&apos;s", "it's", "it's"},
+		{"emdash", "a&#8212;b", "a—b", "a—b"},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			data := minimalDOCX(t, tc.run)
+
+			jsonParser := NewDOCXParser()
+			jsonParser.ConfigureFromSetup(map[string]any{"output_format": "json"})
+			jsonRes := jsonParser.ParseWithResult(t.Context(), "entities.docx", data)
+			if jsonRes.Err != nil {
+				t.Fatalf("ParseWithResult(json): %v", jsonRes.Err)
+			}
+			if got := joinItemTexts(jsonRes.JSON); !strings.Contains(got, tc.want) {
+				t.Errorf("json text = %q, want it to contain %q", got, tc.want)
+			}
+
+			mdParser := NewDOCXParser()
+			mdParser.ConfigureFromSetup(map[string]any{"output_format": "markdown"})
+			mdRes := mdParser.ParseWithResult(t.Context(), "entities.docx", data)
+			if mdRes.Err != nil {
+				t.Fatalf("ParseWithResult(markdown): %v", mdRes.Err)
+			}
+			if !strings.Contains(mdRes.Markdown, tc.wantMarkdown) {
+				t.Errorf("markdown = %q, want it to contain %q", mdRes.Markdown, tc.wantMarkdown)
+			}
+		})
+	}
+}
+
+func joinItemTexts(items []map[string]any) string {
+	parts := make([]string, 0, len(items))
+	for _, item := range items {
+		if text, ok := item["text"].(string); ok {
+			parts = append(parts, text)
+		}
+	}
+	return strings.Join(parts, "\n")
+}
```

**File**: `ragflow_deps/download_deps.py` (modified, +2/-2)
```diff
@@ -121,7 +121,7 @@ def get_urls(use_china_mirrors=False) -> list[str | list[str]]:
             # network access during CI.
             ["https://github.com/kognitos/pdfium-static/releases/download/chromium%2F7809/pdfium-linux-x64-static.tgz", "pdfium-linux-x64-static.tgz"],
             ["https://github.com/yfedoseev/pdf_oxide/releases/download/v0.3.73/pdf_oxide-go-ffi-linux-amd64.tar.gz", "pdf_oxide-go-ffi-linux-amd64.tar.gz"],
-            ["https://github.com/yfedoseev/office_oxide/releases/download/v0.1.9/native-linux-x86_64.tar.gz", "office_oxide-linux-x86_64.tar.gz"],
+            ["https://github.com/yfedoseev/office_oxide/releases/download/v0.1.12/native-linux-x86_64.tar.gz", "office_oxide-linux-x86_64.tar.gz"],
             # ONNX Runtime static archives for the Go in-process (DeepDoc)
             # backend. Statically linked into the server binary (see build.sh:
             # ONNXRUNTIME_STATIC_PREFIX — no --whole-archive, so unreferenced
@@ -171,7 +171,7 @@ def get_urls(use_china_mirrors=False) -> list[str | list[str]]:
             # network access during CI.
             ["https://github.com/kognitos/pdfium-static/releases/download/chromium%2F7809/pdfium-linux-x64-static.tgz", "pdfium-linux-x64-static.tgz"],
             ["https://github.com/yfedoseev/pdf_oxide/releases/download/v0.3.73/pdf_oxide-go-ffi-linux-amd64.tar.gz", "pdf_oxide-go-ffi-linux-amd64.tar.gz"],
-            ["https://github.com/yfedoseev/office_oxide/releases/download/v0.1.9/native-linux-x86_64.tar.gz", "office_oxide-linux-x86_64.tar.gz"],
+            ["https://github.com/yfedoseev/office_oxide/releases/download/v0.1.12/native-linux-x86_64.tar.gz", "office_oxide-linux-x86_64.tar.gz"],
             # ONNX Runtime static archives for the Go in-process (DeepDoc)
             # backend. Statically linked into the server binary (see build.sh:
             # ONNXRUNTIME_STATIC_PREFIX — no --whole-archive, so unreferenced
```

**File**: `ragflow_deps/download_go_deps.py` (modified, +2/-2)
```diff
@@ -226,7 +226,7 @@ def get_urls(use_china_mirrors=False) -> list[str | list[str]]:
             # functions — pre-downloaded to avoid network access during CI.
             ["https://gh-proxy.com/https://github.com/kognitos/pdfium-static/releases/download/chromium%2F7809/pdfium-linux-x64-static.tgz", "pdfium-linux-x64-static.tgz"],
             ["https://gh-proxy.com/https://github.com/yfedoseev/pdf_oxide/releases/download/v0.3.73/pdf_oxide-go-ffi-linux-amd64.tar.gz", "pdf_oxide-go-ffi-linux-amd64.tar.gz"],
-            ["https://gh-proxy.com/https://github.com/yfedoseev/office_oxide/releases/download/v0.1.9/native-linux-x86_64.tar.gz", "office_oxide-linux-x86_64.tar.gz"],
+            ["https://gh-proxy.com/https://github.com/yfedoseev/office_oxide/releases/download/v0.1.12/native-linux-x86_64.tar.gz", "office_oxide-linux-x86_64.tar.gz"],
             [
                 f"https://gh-proxy.com/https://github.com/infiniflow/ragflow-build/releases/download/onnxruntime-v{ORT_VERSION}/{_ort_asset_name(ORT_VERSION)}",
                 _ort_asset_name(ORT_VERSION),
@@ -255,7 +255,7 @@ def get_urls(use_china_mirrors=False) -> list[str | list[str]]:
             # functions — pre-downloaded to avoid network access during CI.
             ["https://github.com/kognitos/pdfium-static/releases/download/chromium%2F7809/pdfium-linux-x64-static.tgz", "pdfium-linux-x64-static.tgz"],
             ["https://github.com/yfedoseev/pdf_oxide/releases/download/v0.3.73/pdf_oxide-go-ffi-linux-amd64.tar.gz", "pdf_oxide-go-ffi-linux-amd64.tar.gz"],
-            ["https://github.com/yfedoseev/office_oxide/releases/download/v0.1.9/native-linux-x86_64.tar.gz", "office_oxide-linux-x86_64.tar.gz"],
+            ["https://github.com/yfedoseev/office_oxide/releases/download/v0.1.12/native-linux-x86_64.tar.gz", "office_oxide-linux-x86_64.tar.gz"],
             [
                 f"https://github.com/infiniflow/ragflow-build/releases/download/onnxruntime-v{ORT_VERSION}/{_ort_asset_name(ORT_VERSION)}",
                 _ort_asset_name(ORT_VERSION),
```

---

### Incident Patch 12: `65f4b480` (2026-09-30)
**Commit Message**: fix(chunker): attach media context on General markdown and HTML paths (#20141) (#20265)

**File**: `internal/ingestion/component/chunker/general.go` (modified, +48/-1)
```diff
@@ -602,6 +602,7 @@ func (c *GeneralChunkerComponent) chunkMarkdown(ctx context.Context, upstream sc
 	primaryPattern := compileDelimPattern(c.param.Delimiters)
 	childrenPattern := compileChildrenPattern(c.param.ChildrenDelimiters)
 	units = splitMarkdownUnits(units, primaryPattern)
+	attachGeneralMediaContext(units, c.param.TableContextSize, c.param.ImageContextSize)
 	units = mergeMarkdownUnits(units, c.param.ChunkTokenSize, c.param.OverlappedPercent, "\n")
 	units = finalizeGeneralChunks(units, childrenPattern)
 	if len(units) == 0 {
@@ -619,6 +620,9 @@ func splitMarkdownUnits(units []schema.ChunkDoc, pattern *regexp.Regexp) []schem
 		unit = cloneChunkDoc(unit)
 		unit.Text = strings.TrimSpace(normalizeGeneralNewlines(itemTextOrFallback(unit)))
 		unit.DocType = itemDocType(unit)
+		if unit.DocType == "table" || unit.DocType == "image" {
+			unit.CKType = unit.DocType
+		}
 		if unit.DocType != "text" || pattern == nil || !pattern.MatchString(unit.Text) {
 			unit.TKNums = intPtr(tokenizeStr(unit.Text))
 			result = append(result, unit)
@@ -638,11 +642,37 @@ func splitMarkdownUnits(units []schema.ChunkDoc, pattern *regexp.Regexp) []schem
 	return result
 }
 
+// stripTextLinesFromMediaContextAbove removes folded unit text from collected
+// media context so materializeMediaContext does not emit it twice.
+func stripTextLinesFromMediaContextAbove(contextAbove, folded string) string {
+	folded = strings.TrimSpace(folded)
+	if folded == "" || contextAbove == "" {
+		return contextAbove
+	}
+	parts := strings.Split(contextAbove, "\n")
+	filtered := make([]string, 0, len(parts))
+	for _, part := range parts {
+		if strings.TrimSpace(part) == folded {
+			continue
+		}
+		filtered = append(filtered, part)
+	}
+	return strings.Join(filtered, "\n")
+}
+
+// markdownImageUnitHasMediaContext reports whether attachGeneralMediaContext
+// populated context on a markdown image unit. Such units stay out of the text
+// merge so ContextAbove and ContextBelow survive until materialization.
+func markdownImageUnitHasMediaContext(unit schema.ChunkDoc) bool {
+	return unit.ContextAbove != "" || unit.ContextBelow != ""
+}
+
 // mergeMarkdownUnits mirrors the Markdown branch of Python naive.chunk:
 // ordinary units use a projected token cap, while a short heading is always
 // kept with the following unit. Markdown images are block attachments rather
 // than standalone media chunks, so image-bearing units participate in the
-// text merge and retain their image payload.
+// text merge and retain their image payload. Images with configured media
+// context are emitted as standalone chunks instead.
 func mergeMarkdownUnits(units []schema.ChunkDoc, target int, overlapPct float64, joinSep string) []schema.ChunkDoc {
 	overlapPct = max(0, min(100, overlapPct))
 	merged := make([]schema.ChunkDoc, 0, len(units))
@@ -672,6 +702,7 @@ func mergeMarkdownUnits(units []schema.ChunkDoc, target int, overlapPct float64,
 				table.Image = mergedImage
 				table.DocType = "table"
 				table.CKType = "table"
+				table.ContextAbove = stripTextLinesFromMediaContextAbove(table.ContextAbove, heading.Text)
 				merged[current] = table
 				current = -1
 				currentTokens = 0
@@ -683,6 +714,21 @@ func mergeMarkdownUnits(units []schema.ChunkDoc, target int, overlapPct float64,
 			continue
 		}
 
+		if itemDocType(unit) == "image" && markdownImageUnitHasMediaContext(unit) {
+			if current >= 0 {
+				current = -1
+				currentTokens = 0
+			}
+			standalone := cloneChunkDoc(unit)
+			standalone.DocType = "image"
+			if standalone.CKType == "" {
+				standalone.CKType = "image"
+			}
+			standalone.TKNums = intPtr(generalUnitTokens(standalone))
+			merged = append(merged, standalone)
+			continue
+		}
+
 		unit = cloneChunkDoc(unit)
 		unit.DocType = "text"
 		if unit.CKType == "" {
@@ -937,6 +983,7 @@ func (c *GeneralChunkerComponent) chunkGeneral(ctx context.Context, upstream sch
 	primaryPattern := compileDelimPattern(c.param.Delimiters)
 	childrenPattern := compileChildrenPattern(c.param.ChildrenDelimiters)
 	units = splitGeneralUnits(units, primaryPattern)
+	attachGeneralMediaContext(units, c.param.TableContextSize, c.param.ImageContextSize)
 	if !hasCustomDelim(c.param.Delimiters) {
 		// Python naive_merge prefixes each delimiter atom with a newline before
 		// counting it. The prefix is a budgeting detail, not emitted content;
```

**File**: `internal/ingestion/component/chunker/general_merge_test.go` (modified, +67/-0)
```diff
@@ -201,6 +201,73 @@ func TestMergeMarkdownUnitsOverlapKeepsCurrentChunkMetadata(t *testing.T) {
 	}
 }
 
+func TestMergeMarkdownUnitsStripsFoldedHeadingFromTableContextAbove(t *testing.T) {
+	units := []schema.ChunkDoc{
+		{Text: "## Section", DocType: "text", CKType: "heading", TKNums: intPtr(1)},
+		{
+			Text:         "<table></table>",
+			DocType:      "table",
+			CKType:       "table",
+			ContextAbove: "## Section",
+			TKNums:       intPtr(1),
+		},
+	}
+	got := mergeMarkdownUnits(units, 10, 0, "\n")
+	if len(got) != 1 {
+		t.Fatalf("chunks = %#v, want one table chunk", got)
+	}
+	if got[0].ContextAbove != "" {
+		t.Fatalf("ContextAbove = %q, want empty after heading fold", got[0].ContextAbove)
+	}
+	if got[0].Text != "## Section\n<table></table>" {
+		t.Fatalf("text = %q, want heading folded into body", got[0].Text)
+	}
+}
+
+func TestMergeMarkdownUnitsStripsOnlyFoldedHeadingFromTableContextAbove(t *testing.T) {
+	units := []schema.ChunkDoc{
+		{Text: "intro", DocType: "text", CKType: "text", TKNums: intPtr(1)},
+		{Text: "## Section", DocType: "text", CKType: "heading", TKNums: intPtr(1)},
+		{
+			Text:         "<table></table>",
+			DocType:      "table",
+			CKType:       "table",
+			ContextAbove: "intro\n## Section",
+			TKNums:       intPtr(1),
+		},
+	}
+	got := mergeMarkdownUnits(units, 10, 0, "\n")
+	if len(got) != 2 {
+		t.Fatalf("chunks = %#v, want intro text and table", got)
+	}
+	if got[1].ContextAbove != "intro" {
+		t.Fatalf("ContextAbove = %q, want intro only", got[1].ContextAbove)
+	}
+}
+
+func TestMergeMarkdownUnitsKeepsImageWithMediaContextStandalone(t *testing.T) {
+	units := []schema.ChunkDoc{
+		{Text: "before", DocType: "text", CKType: "text", TKNums: intPtr(1)},
+		{
+			Text:         "figure",
+			DocType:      "image",
+			CKType:       "image",
+			ContextAbove: "before",
+			ContextBelow: "after",
+			Image:        "data:image/png;base64,AAAA",
+			TKNums:       intPtr(1),
+		},
+		{Text: "after", DocType: "text", CKType: "text", TKNums: intPtr(1)},
+	}
+	got := mergeMarkdownUnits(units, 10, 0, "\n")
+	if len(got) != 3 {
+		t.Fatalf("chunks = %d, want text, image, text", len(got))
+	}
+	if got[1].CKType != "image" || got[1].ContextAbove != "before" || got[1].ContextBelow != "after" {
+		t.Fatalf("image chunk = %#v, want preserved media context", got[1])
+	}
+}
+
 func TestMergeMarkdownUnitsStartsNewChunkForIncomingHeading(t *testing.T) {
 	units := []schema.ChunkDoc{
 		{Text: "Background details", DocType: "text", CKType: "text", TKNums: intPtr(1)},
```

**File**: `internal/ingestion/component/chunker/general_test.go` (modified, +179/-0)
```diff
@@ -580,6 +580,185 @@ func assertMaterializedMediaContext(t *testing.T, chunk map[string]any, wantText
 	}
 }
 
+func TestGeneralChunkerMarkdownAttachesMediaContext(t *testing.T) {
+	component, err := NewGeneralChunker(map[string]any{
+		"chunk_token_size":   10,
+		"table_context_size": 2,
+	})
+	if err != nil {
+		t.Fatalf("NewGeneralChunker: %v", err)
+	}
+	out, err := component.Invoke(t.Context(), nil, map[string]any{
+		"name":          "document.md",
+		"file_type":     "md",
+		"output_format": "json",
+		"json": []map[string]any{
+			{"text": "before", "doc_type_kwd": "text"},
+			{"text": "<table><tr><td>A</td></tr></table>", "doc_type_kwd": "table"},
+			{"text": "after", "doc_type_kwd": "text"},
+		},
+	})
+	if err != nil {
+		t.Fatalf("Invoke: %v", err)
+	}
+	chunks := outputChunks(t, out)
+	var table map[string]any
+	for _, ck := range chunks {
+		if ck["doc_type_kwd"] == "table" {
+			table = ck
+			break
+		}
+	}
+	if table == nil {
+		t.Fatalf("table chunk missing: %#v", chunks)
+	}
+	assertMaterializedMediaContext(t, table, "before<table><tr><td>A</td></tr></table>after")
+}
+
+func TestGeneralChunkerMarkdownTableDoesNotDuplicateShortHeadingInContext(t *testing.T) {
+	component, err := NewGeneralChunker(map[string]any{
+		"chunk_token_size":   10,
+		"table_context_size": 2,
+	})
+	if err != nil {
+		t.Fatalf("NewGeneralChunker: %v", err)
+	}
+	out, err := component.Invoke(t.Context(), nil, map[string]any{
+		"name":          "document.md",
+		"file_type":     "md",
+		"output_format": "json",
+		"json": []map[string]any{
+			{"text": "## Section", "doc_type_kwd": "text", "ck_type": "heading"},
+			{"text": "<table><tr><td>A</td></tr></table>", "doc_type_kwd": "table"},
+		},
+	})
+	if err != nil {
+		t.Fatalf("Invoke: %v", err)
+	}
+	chunks := outputChunks(t, out)
+	var table map[string]any
+	for _, ck := range chunks {
+		if ck["doc_type_kwd"] == "table" {
+			table = ck
+			break
+		}
+	}
+	if table == nil {
+		t.Fatalf("table chunk missing: %#v", chunks)
+	}
+	want := "## Section\n<table><tr><td>A</td></tr></table>"
+	assertMaterializedMediaContext(t, table, want)
+	if strings.Count(table["text"].(string), "## Section") != 1 {
+		t.Fatalf("heading repeated in table chunk: %q", table["text"])
+	}
+}
+
+func TestGeneralChunkerMarkdownTableKeepsEarlierContextWhenHeadingFolds(t *testing.T) {
+	component, err := NewGeneralChunker(map[string]any{
+		"chunk_token_size":   10,
+		"table_context_size": 3,
+	})
+	if err != nil {
+		t.Fatalf("NewGeneralChunker: %v", err)
+	}
+	out, err := component.Invoke(t.Context(), nil, map[string]any{
+		"name":          "document.md",
+		"file_type":     "md",
+		"output_format": "json",
+		"json": []map[string]any{
+			{"text": "intro", "doc_type_kwd": "text"},
+			{"text": "## Section", "doc_type_kwd": "text", "ck_type": "heading"},
+			{"text": "<table><tr><td>A</td></tr></table>", "doc_type_kwd": "table"},
+		},
+	})
+	if err != nil {
+		t.Fatalf("Invoke: %v", err)
+	}
+	chunks := outputChunks(t, out)
+	var table map[string]any
+	for _, ck := range chunks {
+		if ck["doc_type_kwd"] == "table" {
+			table = ck
+			break
+		}
+	}
+	if table == nil {
+		t.Fatalf("table chunk missing: %#v", chunks)
+	}
+	want := "intro## Section\n<table><tr><td>A</td></tr></table>"
+	assertMaterializedMediaContext(t, table, want)
+}
+
+func TestGeneralChunkerMarkdownImageKeepsMediaContextWhenConfigured(t *testing.T) {
+	component, err := NewGeneralChunker(map[string]any{
+		"chunk_token_size":   10,
+		"image_context_size": 2,
+	})
+	if err != nil {
+		t.Fatalf("NewGeneralChunker: %v", err)
+	}
+	out, err := component.Invoke(t.Context(), nil, map[string]any{
+		"name":          "document.md",
+		"file_type":     "md",
+		"output_format": "json",
+		"json": []map[string]any{
+			{"text": "before", "doc_type_kwd": "text"},
+			{"text": "figure", "doc_type_kwd": "image", "image": "data:image/png;base64,AAAA"},
+			{"text": "after", "doc_type_kwd": "text"},
+		},
+	})
+	if err != nil {
+		t.Fatalf("Invoke: %v", err)
+	}
+	chunks := outputChunks(t, out)
+	var image map[string]any
+	for _, ck := range chunks {
+		if ck["doc_type_kwd"] == "image" {
+			image = ck
+			break
+		}
+	}
+	if image == nil {
+		t.Fatalf("image chunk missing: %#v", chunks)
+	}
+	assertMaterializedMediaContext(t, image, "beforefigureafter")
+}
+
+func TestGeneralChunkerHTMLAttachesMediaContext(t *testing.T) {
+	component, err := NewGeneralChunker(map[string]any{
+		"chunk_token_size":   10,
+		"table_context_size": 2,
+	})
+	if err != nil {
+		t.Fatalf("NewGeneralChunker: %v", err)
+	}
+	out, err := component.Invoke(t.Context(), nil, map[string]any{
+		"name":          "page.html",
+		"file_type":     "html",
+		"output_format": "json",
+		"json": []map[string]any{
+			{"text": "before", "doc_type_kwd": "text"},
+			{"text": "<table><tr><td>A</td></tr></table>", "doc_type_kwd": "table"},
+			{"text": "after", "doc_type_kwd": "text"},
+		},
+	})
+	if err != nil {
+		t.Fatalf("Invoke: %v", err)
+	}
+	chunks :=
```

---

### Incident Patch 13: `87670714` (2026-09-30)
**Commit Message**: Fix: better GetByID (#20421)

**File**: `AGENTS.md` (modified, +4/-0)
```diff
@@ -62,6 +62,10 @@ Use this file as the local operating guide for the current codebase. Prefer the
 - Remove commented-out Go code instead of leaving recovery notes in place.
 - Keep package comments and doc comments aligned with the current runtime path, not with migration history.
 
+## GORM query traps
+- **Never pass a bare string ID as the second argument to `Take`/`First`** (e.g. `Take(&x, id)`). Under GORM v1.25.7 a non-numeric string is treated as a raw SQL condition and concatenated into the `WHERE` clause: `Take(&x, "88b17c7a...")` emits `WHERE 88b17c7a... LIMIT 1`, which MySQL rejects with `Error 1054 (42S22): Unknown column '...' in 'where clause'`. Only strings that parse via `strconv.Atoi` are treated as primary-key values, so this bug is invisible for integer IDs and catastrophic for UUID primary keys. Always bind explicitly: `Take(&x, "id = ?", id)` or `Where("id = ?", id).Take(&x)`.
+- When you change a query form across many files, verify the generated SQL with a `Session(&gorm.Session{DryRun: true})` probe before relying on it. A passing unit test with no rows and a broken `WHERE` clause look identical unless the SQL is inspected.
+
 ## Shared database schema (Go + Python)
 The Go services and the Python API write to the same MySQL/PostgreSQL schema, and both own parts of it. Neither is authoritative over the whole.
 
```

**File**: `internal/dao/api_for_conversation.go` (modified, +4/-4)
```diff
@@ -146,13 +146,13 @@ func (dao *API4ConversationDAO) GetMetadataBySessionID(ctx context.Context, db *
 // agent. It is used when the session itself is the authorization resource.
 func (dao *API4ConversationDAO) GetByID(ctx context.Context, db *gorm.DB, id string) (*entity.API4Conversation, error) {
 	var result entity.API4Conversation
-	tx := db.WithContext(ctx).Session(&gorm.Session{QueryFields: true}).Where("id = ?", id).Find(&result)
+	tx := db.WithContext(ctx).Session(&gorm.Session{QueryFields: true}).Take(&result, "id = ?", id)
 	if tx.Error != nil {
+		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
+			return nil, nil
+		}
 		return nil, tx.Error
 	}
-	if tx.RowsAffected == 0 {
-		return nil, nil
-	}
 	if err := hydrateAPIConversations(ctx, db, []*entity.API4Conversation{&result}); err != nil {
 		return nil, err
 	}
```

**File**: `internal/dao/chat.go` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ func (dao *ChatDAO) ListByOwnerIDs(ctx context.Context, db *gorm.DB, ownerIDs []
 // GetByID gets chat by ID
 func (dao *ChatDAO) GetByID(ctx context.Context, db *gorm.DB, id string) (*entity.Chat, error) {
 	var chat entity.Chat
-	err := db.WithContext(ctx).Where("id = ?", id).First(&chat).Error
+	err := db.WithContext(ctx).Take(&chat, "id = ?", id).Error
 	if err != nil {
 		return nil, err
 	}
```

**File**: `internal/dao/chat_channel.go` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ func (dao *ChatChannelDAO) Create(ctx context.Context, db *gorm.DB, channel *ent
 // Callers must enforce tenant authorization themselves (see service.accessible).
 func (dao *ChatChannelDAO) GetByID(ctx context.Context, db *gorm.DB, id string) (*entity.ChatChannel, error) {
 	var channel entity.ChatChannel
-	if err := db.WithContext(ctx).Where("id = ?", id).First(&channel).Error; err != nil {
+	if err := db.WithContext(ctx).Take(&channel, "id = ?", id).Error; err != nil {
 		return nil, err
 	}
 	return &channel, nil
```

**File**: `internal/dao/chat_session.go` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ func NewChatSessionDAO() *ChatSessionDAO {
 // GetByID gets chat session by ID
 func (dao *ChatSessionDAO) GetByID(ctx context.Context, db *gorm.DB, id string) (*entity.ChatSession, error) {
 	var conv entity.ChatSession
-	err := db.WithContext(ctx).Session(&gorm.Session{QueryFields: true}).Where("id = ?", id).First(&conv).Error
+	err := db.WithContext(ctx).Session(&gorm.Session{QueryFields: true}).Take(&conv, "id = ?", id).Error
 	if err != nil {
 		return nil, err
 	}
```

**File**: `internal/dao/compilation_template.go` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ func (dao *CompilationTemplateDAO) NameExistsInGroup(ctx context.Context, db *go
 // (used for reconciling group children).
 func (dao *CompilationTemplateDAO) GetByID(ctx context.Context, db *gorm.DB, id string) (*entity.CompilationTemplate, error) {
 	var t entity.CompilationTemplate
-	if err := db.WithContext(ctx).Where("id = ?", id).First(&t).Error; err != nil {
+	if err := db.WithContext(ctx).Take(&t, "id = ?", id).Error; err != nil {
 		return nil, err
 	}
 	return &t, nil
```

**File**: `internal/dao/connector.go` (modified, +1/-1)
```diff
@@ -203,7 +203,7 @@ func (dao *ConnectorDAO) LinkDatasetConnectorsTx(ctx context.Context, tx *gorm.D
 // GetByID get connector by ID
 func (dao *ConnectorDAO) GetByID(ctx context.Context, db *gorm.DB, id string) (*entity.Connector, error) {
 	var connector entity.Connector
-	err := db.WithContext(ctx).Where("id = ?", id).First(&connector).Error
+	err := db.WithContext(ctx).Take(&connector, "id = ?", id).Error
 	if err != nil {
 		return nil, err
 	}
```

**File**: `internal/dao/document.go` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ func (dao *DocumentDAO) Create(ctx context.Context, db *gorm.DB, document *entit
 // GetByID get document by ID
 func (dao *DocumentDAO) GetByID(ctx context.Context, db *gorm.DB, id string) (*entity.Document, error) {
 	var document entity.Document
-	err := db.WithContext(ctx).First(&document, "id = ?", id).Error
+	err := db.WithContext(ctx).Take(&document, "id = ?", id).Error
 	if err != nil {
 		return nil, err
 	}
```

---

### Incident Patch 14: `dec77fef` (2026-09-30)
**Commit Message**: fix(file): keep polling until cleared datasets disappear from the list (#20423)

**File**: `web/src/hooks/use-file-request.ts` (modified, +19/-9)
```diff
@@ -329,13 +329,17 @@ export const useRenameFile = () => {
 const LinkedDatasetsPollIntervalMs = 500;
 const LinkedDatasetsPollMaxAttempts = 6;
 
-// Returns true when every affected file row on the current page carries all the
-// newly linked datasets. Rows that are not on the current page, or folder rows
-// (which never carry kbs_info), cannot be verified and are treated as done.
+// Returns true when every affected file row on the current page matches the
+// requested link: the selected datasets are present and, in 'replace' mode, no
+// other dataset is left behind — otherwise clearing the selection (empty kbIds)
+// would look done on the stale row. Rows that are not on the current page, or
+// folder rows (which never carry kbs_info), cannot be verified and are treated
+// as done.
 const areDatasetsLinked = (
   queryClient: QueryClient,
   fileIds: string[],
   kbIds: string[],
+  mode: ConnectFileToKnowledgeMode,
 ) => {
   const cached = queryClient.getQueriesData<IFetchFileListResult>({
     queryKey: [FileApiAction.FetchFileList],
@@ -344,22 +348,27 @@ const areDatasetsLinked = (
     (file) => fileIds.includes(file.id) && file.type !== 'folder',
   );
   if (verifiableFiles.length === 0) return true;
-  return verifiableFiles.every((file) =>
-    kbIds.every((kbId) => file.kbs_info?.some((kb) => kb.kb_id === kbId)),
-  );
+  return verifiableFiles.every((file) => {
+    const linkedIds = (file.kbs_info ?? []).map((kb) => kb.kb_id);
+    return (
+      kbIds.every((kbId) => linkedIds.includes(kbId)) &&
+      (mode === 'add' || linkedIds.length === kbIds.length)
+    );
+  });
 };
 
 // Both backends respond to link-to-datasets before the file↔dataset mappings
 // are written (the conversion runs in the background), so the refetch right
-// after success can still see stale kbs_info. Poll until the newly linked
-// datasets show up in the list data; give up after a bounded window.
+// after success can still see stale kbs_info. Poll until the change shows up in
+// the list data; give up after a bounded window.
 const waitUntilDatasetsLinked = async (
   queryClient: QueryClient,
   fileIds: string[],
   kbIds: string[],
+  mode: ConnectFileToKnowledgeMode,
 ) => {
   for (let attempt = 0; attempt < LinkedDatasetsPollMaxAttempts; attempt++) {
-    if (areDatasetsLinked(queryClient, fileIds, kbIds)) return;
+    if (areDatasetsLinked(queryClient, fileIds, kbIds, mode)) return;
     await new Promise((resolve) =>
       setTimeout(resolve, LinkedDatasetsPollIntervalMs),
     );
@@ -398,6 +407,7 @@ export const useConnectToKnowledge = () => {
           queryClient,
           params.fileIds,
           params.kbIds,
+          params.mode,
         );
       }
       return data.code;
```

---

### Incident Patch 15: `fc578eab` (2026-09-30)
**Commit Message**: fix(cli): drop PENDING as a parameter for message queue commands (#20367)

**File**: `docs/administrator/admin/ragflow_cli.md` (modified, +1/-5)
```diff
@@ -574,13 +574,9 @@ Lists messages currently retained in the task stream. The optional `PENDING` key
 **Syntax**
 
 ```sql
-MQ LIST [PENDING];
+MQ LIST;
 ```
 
-| Parameter | Required | Description |
-| --- | --- | --- |
-| `[PENDING]` | No | Requests the pending-message form of the command. |
-
 **Example**
 
 ```text
```

**File**: `internal/cli/admin_parser.go` (modified, +1/-3)
```diff
@@ -2690,11 +2690,9 @@ func (p *Parser) parseMessageQueueCommand() (*Command, error) {
 
 		cmd = NewCommand("user_list_message_queue_command")
 		if p.curToken.Type == TokenPending {
-			cmd.Params["pending"] = true
 			p.nextToken() // consume PENDING
-		} else {
-			cmd.Params["pending"] = false
 		}
+
 	case TokenPublish:
 		p.nextToken() // consume PUBLISH
 
```

#### Recent Merged Pull Requests:
- **PR #20542** (2026-10-03): feat(agent,ingestion): carry the grep/bm25 contracts and index declared titles (@yuzhichang)
- **PR #20510** (closed): fix(service): mask api_key in ShowProviderInstance response (#20396) (@Harsh23Kashyap)
- **PR #20503** (2026-10-02): Port agentic RAG to Go, expose it as a chat mode, and add per-dialog failover (@yuzhichang)
- **PR #20475** (2026-10-01): Refactor: use type_kwd instead of knowledge_graph_kwd (@wangq8)
- **PR #20473** (2026-09-30): fix(nlp): flush buffer on bare delimiter in _build_cks (docx one-chunk regression) (@xugangqiang)
- **PR #20472** (2026-09-30): Fix: Text with swapped keyword similarity weights (@cike8899)
- **PR #20471** (2026-09-30): chore(deps): bump sharp from 0.35.2 to 0.35.5 in /internal/channels/whatsapp-gateway (@dependabot[bot])
- **PR #20467** (2026-09-30): docs(web): remove stale UmiJS references after Vite migration (@sunshanhui)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
