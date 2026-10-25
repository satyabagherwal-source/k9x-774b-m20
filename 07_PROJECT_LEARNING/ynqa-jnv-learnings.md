> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ynqa-jnv-learnings.md`  
> **Source**: github ([https://github.com/ynqa/jnv](https://github.com/ynqa/jnv))  
> **Source Version**: `9871ba34`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T02:44:01.843Z  
> **Learning ID**: `learn-github-ynqa-jnv`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): ynqa/jnv

---

## 1. Executive Forensic Architecture & System Mechanics

`ynqa/jnv` is an interactive command-line JSON navigator and filter evaluation engine written in Rust. It solves the performance, usability, and feedback latency penalties incurred when iteratively authoring complex `jq` queries against large JSON payloads, multi-document streams, or Kubernetes resource definitions in terminal environments.

```
                            +-------------------------------------------------------------+
                            |                      Terminal I/O                           |
                            | (crossterm EventStream: KeyPress, MouseScroll, AreaResize)  |
                            +-------------------------------------------------------------+
                                                           |
                                                           v
+-------------------------------------------------------------------------------------------------------------------+
| src/event_dispatcher.rs (Central Event Dispatch Loop)                                                             |
| - Normalizes mouse wheel coordinate drift: Event::Mouse { kind: ScrollUp|ScrollDown, column: 0, row: 0 }          |
| - Matches global keybinds: exit, copy_query, copy_result, switch_mode                                             |
| - Inspects `SharedContext::active_index()` -> Routes input events to target channel                               |
+-------------------------------------------------------------------------------------------------------------------+
        |                         |                              |                                |
        v                         v                              v                                v
+------------------+    +--------------------+        +---------------------+         +----------------------+
| debounce_resize  |    |  editor_action_tx  |        | completion_action_tx|         | json_viewer_action_tx|
| (mpsc chan 1)    |    |  (QueryEditor)     |        | (CompletionNav)     |         | (JsonViewer Engine)  |
+------------------+    +--------------------+        +---------------------+         +----------------------+
        |                         |                              |                                |
        |                         v                              v                                |
        |               Query Input Streaming        Chunked BTreeSet Path Prefixes               |
        |                         \                              /                                |
        v                          \                            /                                 v
+------------------+                +--------------------------+                      +-----------------------+
| utils/debounce.rs|                | src/completion.rs        |                      | src/json_viewer.rs    |
| Interval Tick +  |===============>| Lock-free chunking load  |                      | Task abort on typing  |
| Replacement Reg  |                | .drain(..min(chunk, len))|                      | jaq-core run & compile|
+------------------+                +--------------------------+                      +-----------------------+
                                                                                          |
                                                                                          v
                                                                              +-----------------------+
                                                                              | promkit_widgets       |
                                                                              | SharedRenderer<Index> |
                                                                              | (Buffered Graphemes)  |
                                                                              +-----------------------+
```

### Architectural Subsystems and Domain Primitives
1. **Asynchronous Multi-Task Event Dispatch (`src/event_dispatcher.rs`)**:
   Decouples raw `crossterm` terminal event streams from component state machines using bounded Tokio `mpsc` channels (`editor_action_tx`, `completion_action_tx`, `json_viewer_action_tx`, `guide_action_tx`). Event handling avoids locking the global rendering state directly by routing events strictly according to `active_index` state invariants.

2. **Decoupled Concurrency & Shared Context (`src/context.rs`)**:
   Maintains runtime state (`Idle`, `Loading`, `Processing`) alongside the terminal viewport coordinate envelope `(u16, u16)` inside `SharedContext(Arc<Mutex<Context>>)`. It implements `promkit_widgets::spinner::State` to conditionally disable UI spinner overwrites during idle periods and guarantees exclusive ownership of the current async execution pipeline via `JoinHandle::abort()`.

3. **Incremental Memory-Safe Autocompletion (`src/completion.rs`)**:
   Eliminates terminal lockups over multi-megabyte JSON payloads by loading document paths in chunked background batches (`search_load_chunk_size = 50,000`) into an `Arc<Mutex<SuggestionStore>>` wrapping a `BTreeSet<String>`. Matches are served to a UI `Listbox` incrementally via windowed pagination (`search_result_chunk_size = 100`) using `Vec::drain` to ensure the UI thread never allocates or renders unbounded DOM/terminal graphemes.

4. **Embedded In-Memory `jq` Execution Pipeline (`src/json.rs`, `src/json_viewer.rs`)**:
   Embeds `jaq-core`, `jaq-json`, and `jaq-std` instead of shelling out to a `jq` sub-process. Queries are parsed into an AST Arena, compiled into function combinators, and evaluated against a pre-deserialized `Vec<serde_json::Value>` input stream. Active query runs abort immediately when superseded by new user keystrokes.

---

## 2. Net-New Universal Engineering Rules

### 1. Cooperative Cancellation Before Spawn for Debounced Computations
**RULE**:
Before spawning an asynchronous or background task that computes state to replace an existing pending or in-flight computation, the runtime MUST explicitly take and `.abort()` the prior `JoinHandle` prior to instantiating the new background task.

**WHY**:
Without aborting the prior `JoinHandle`, overlapping computations run concurrently on the async runtime. If an older, slow evaluation finishes *after* a newer, fast evaluation (due to thread scheduling or variable query complexity), the stale evaluation will acquire the write lock or channel and overwrite the fresh UI state with stale results. This race condition leads to visual flickering, incorrect query output displays, and CPU resource exhaustion.

**WHEN TO APPLY**:
Apply in any interactive event loop (Rust Tokio, Go routines, Node.js worker threads) where user keystrokes, window resizes, or scroll updates schedule heavy downstream computations (AST parsing, database queries, layout rendering).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified from src/json_viewer.rs
async fn handle_query_changed(
    shared_viewer_state: SharedJsonViewer,
    shared_renderer: SharedRenderer<Index>,
    shared_ctx: SharedContext,
    guide_action_tx: mpsc::Sender<GuideAction>,
    query: String,
) {
    // INVARIANT: Take ownership and abort previous in-flight task before spawning
    {
        let mut ctx = shared_ctx.lock().await;
        if let Some(task) = ctx.current_task.take() {
            task.abort();
        }
        ctx.state = State::Processing;
    }

    let task = spawn_query_update_task(
        shared_viewer_state.clone(),
        shared_ctx.clone(),
        guide_action_tx,
        shared_renderer,
        query,
    );

    // Register new handle for future cooperative cancellation
    {
        let mut ctx = shared_ctx.lock().await;
        ctx.current_task = Some(task);
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Spawning task without aborting prior active JoinHandle.
// Causes TOCTOU race: Fast Query B can be overwritten by Lagging Query A.
async fn bad_handle_query_changed(
    shared_viewer_state: SharedJsonViewer,
    shared_renderer: SharedRenderer<Index>,
    shared_ctx: SharedContext,
    guide_action_tx: mpsc::Sender<GuideAction>,
    query: String,
) {
    // BUG: Previous task still runs in background!
    let task = spawn_query_update_task(
        shared_viewer_state.clone(),
        shared_ctx.clone(),
        guide_action_tx,
        shared_renderer,
        query,
    );
    let mut ctx = shared_ctx.lock().await;
    ctx.current_task = Some(task); // Overwrites handle, leaking previous task execution!
}
```

**VERIFICATION METHOD**:
Run an automated concurrency simulation where Query 1 (`heavy_work()`, duration 500ms) is immediately followed by Query 2 (`light_work()`, duration 50ms). Assert via execution traces that Query 1 terminates prior to emitting graphemes, and assert the final rendered buffer equals Query 2.

---

### 2. Event-Set Comparison Normalization for Multi-Attribute Events
**RULE**:
When matching inbound complex driver events (such as Mouse or Pointer events) against an invariant configuration lookup set (e.g., `HashSet<Event>`), variable payload fields (such as cursor screen coordinates `column` and `row`) MUST be normalized to deterministic sentinel values before membership testing (`set.contains(&event)`).

**WHY**:
In terminal drivers and GUI frameworks, scroll events package current cursor coordinates `(x, y)` inside the event payload. If keybind configurations allow users to bind `ScrollUp` or `ScrollDown`, storing or checking the raw event against a `HashSet<Event>` fails whenever the mouse moves even one cell off the point of binding registration. Normalization enforces structural equivalence over incidental positional noise.

**WHEN TO APPLY**:
Apply when handling mouse wheel events, touchpad scrolls, gesture coordinates, or any system input where configuration schemas define keybindings independently of spatial coordinates.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified from src/event_dispatcher.rs
let event = match event {
    Event::Mouse(mouse)
        if matches!(
            mouse.kind,
            MouseEventKind::ScrollUp | MouseEventKind::ScrollDown
        ) =>
    {
        Event::Mouse(MouseEvent {
            kind: mouse.kind,
            column: 0, // Deterministic sentinel coordinate
            row: 0,    // Deterministic sentinel coordinate
            modifiers: mouse.modifiers,
        })
    }
    other => other,
};

// Now hashset lookup reliably matches user-configured scroll actions
if keybinds.on_json_viewer.up.contains(&event) {
    // Execute scroll action
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Checking raw crossterm MouseEvent directly against configured keybind set.
// This fails whenever the mouse cursor moves away from the exact cell configured in the preset.
if keybinds.on_json_viewer.up.contains(&event) {
    // Never executes if event.column != configured.column
    self.state.stream.up();
}
```

**VERIFICATION METHOD**:
Unit-test keybind validation by constructing `MouseEvent` instances with coordinates `(12, 45)` and `(99, 100)` for `MouseEventKind::ScrollUp`. Assert that both evaluate to `true` against a `HashSet<Event>` containing a single default-constructed `ScrollUp` event.

---

### 3. Chunk-Buffered Batch Insertion Under Short-Lived Locks
**RULE**:
When streaming ingestion pipelines load massive datasets into shared, reader-facing collections, workers MUST NOT insert items one-by-one under an active lock, NOR hold raw locks across unbounded collection traversals. Workers MUST aggregate elements into a bounded local buffer (`Vec::with_capacity(chunk_size)`) and acquire the write lock strictly to drain and bulk-insert the chunk.

**WHY**:
Holding a mutex across millions of single-item insertions creates severe lock contention, starving the UI or event loop of render frames. Conversely, buffering the entire dataset in memory before acquiring the lock causes massive UI latency spikes and high memory watermarks. Chunk-buffered synchronization achieves minimal lock contention while maintaining streaming responsiveness.

**WHEN TO APPLY**:
Any producer-consumer pipeline where a background thread ingests unbounded streams (e.g., file reads, JSON streams, socket streams) while a main thread serves interactive user search queries or completions.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified from src/completion.rs
let mut batch = Vec::with_capacity(chunk_size);
for path in iter {
    batch.push(path);

    if batch.len() >= chunk_size {
        let loaded = batch.len();
        let mut store = shared_for_loading.0.lock().await;
        for item in batch.drain(..) {
            store.paths.insert(item);
        }
        store.progress.loaded_path_count += loaded;
        // Lock drops immediately after drain
    }
}

// Drain remaining trailing items
if !batch.is_empty() {
    let remaining = batch.len();
    let mut store = shared_for_loading.0.lock().await;
    for item in batch.drain(..) {
        store.paths.insert(item);
    }
    store.progress.loaded_path_count += remaining;
    store.progress.is_complete = true;
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN 1: Locking per element (severe lock thrashing and context switching).
for path in iter {
    let mut store = shared_for_loading.0.lock().await;
    store.paths.insert(path);
}

// ANTI-PATTERN 2: Locking across the entire stream (starves reader UI threads completely).
let mut store = shared_for_loading.0.lock().await;
for path in iter {
    store.paths.insert(path);
}
```

**VERIFICATION METHOD**:
Instrument lock acquisition timing metrics using `tokio::time::Instant`. Verify under test conditions with 1,000,000 JSON keys that the lock acquisition duration does not exceed 5 milliseconds per chunk, and reader threads can acquire read locks within 10 milliseconds of requesting access.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: JQ Evaluation Crash on Keys Containing Special Characters (`@`) (BUG-JNV-01)
- **Context**: `src/json.rs` and `src/completion.rs` during key autocompletion and execution of jq filters against Kubernetes objects or JSON payloads containing symbols like `@`, `-`, or spaces.
- **What Was Expected**: Autocompleting a key starting with `@` (e.g. `{"@ynqa": "value"}`) should generate a valid jq query that executes and returns the matching value.
- **What Actually Happened**: The autocompletion navigator produced `.@ynqa`. In `jq` and `jaq`, `@` is reserved for format strings/functions (e.g., `@base64`, `@json`). The parser rejected the expression with `jq filter parsing failed`, rendering an error banner and terminating traversal.
- **Evidence in Repo**: GitHub Issue #22: *"Fails to execute jq query when the key starts with `@` symbol"*.
- **Root Cause**: The completion path serializer appended dictionary keys verbatim prefixed with a dot (`.{key}`) without checking if the key string complied with unquoted jq identifier constraints (`[a-zA-Z_][a-zA-Z0-9_]*`). Keys beginning with `@`, hyphens, or whitespace require quotation escaping (e.g., `."@ynqa"` or `.["@ynqa"]`).
- **Remediation Code Diff**:
```rust
// In path generation / autocompletion injection:
// - let formatted_path = format!(".{}", key);
// + let formatted_path = if key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') 
// +     && !key.starts_with(|c: char| c.is_ascii_digit()) {
// +     format!(".{}", key)
// + } else {
// +     format!(".{:?}", key) // Escapes quotes, @, hyphens, and whitespace safely
// + };
```
- **Lesson**: Autocompletion subsystems must never treat raw object keys as valid lexical identifiers in query languages. They must apply language-specific identifier quoting invariants before generating completion tokens.

---

### Incident 2: In-Memory JSON Key Extraction Terminal Starvation (BUG-JNV-02)
- **Context**: Path loading on high-volume JSON streams (`src/completion.rs`).
- **What Was Expected**: Terminal UI remains interactive at 60 FPS while background workers parse JSON and collect autocomplete paths.
- **What Actually Happened**: On large inputs (10MB+ JSON or Kubernetes manifests with tens of thousands of attributes), the UI froze completely until all paths were evaluated and loaded into memory.
- **Evidence in Repo**: Commit refactor introducing `search_load_chunk_size = 50000`, `SuggestionLoadProgress`, and `task::spawn` streaming batches in `src/completion.rs`.
- **Root Cause**: The initial loader acquired a lock on the suggestion store across the entire deserialization and path generation routine, starving the renderer and query editor of lock access.
- **Remediation Code Diff**:
```rust
// - let mut store = shared.0.lock().await;
// - for path in json::get_all_paths(input, max_streams).await? {
// -     store.paths.insert(path);
// - }
// - store.progress.is_complete = true;
// + let iter = json::get_all_paths(input, max_streams).await?;
// + let mut batch = Vec::with_capacity(chunk_size);
// + for path in iter {
// +     batch.push(path);
// +     if batch.len() >= chunk_size {
// +         let mut store = shared_for_loading.0.lock().await;
// +         for item in batch.drain(..) { store.paths.insert(item); }
// +     }
// + }
```
- **Lesson**: Batch collection loops that interact with UI state must establish hard chunking boundaries and yield thread execution / drop lock guards at explicit intervals.

---

### Incident 3: Terminal Viewport Desynchronization on Debounced Window Resize (BUG-JNV-03)
- **Context**: `src/event_dispatcher.rs`, `src/utils/debounce.rs`, and `src/json_viewer.rs`.
- **What Was Expected**: Rapid resizing of the terminal emulator should cleanly redraw the JSON tree matching the final dimensions without rendering artifacts or out-of-order frames.
- **What Actually Happened**: Fast terminal resizing created racing render tasks where earlier, smaller dimensions overwrote the final terminal bounds, causing text wrapping clipping and grapheme corruption.
- **Evidence in Repo**: `RenderTrigger::AreaResized` and cancellation checks added to `handle_area_resized`.
- **Root Cause**: Resizing fired multiple async events into the channel. The debouncer emitted events, but prior render computations were still processing against older width/height pairs without abort guarantees.
- **Remediation Code Diff**:
```rust
// Inside src/json_viewer.rs:
async fn handle_area_resized(...) {
    // Explicitly abort pending tasks before initiating resize re-calculation
    {
        let mut ctx = shared_ctx.lock().await;
        if let Some(task) = ctx.current_task.take() {
            task.abort();
        }
    }
    let task = spawn_query_update_task(...);
    let mut ctx = shared_ctx.lock().await;
    ctx.current_task = Some(task);
}
```
- **Lesson**: UI redraw handlers triggered by layout/resize events must possess abort handles to discard rendering passes that target stale viewports.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Saturating Subtraction on Unsigned Viewport Bounds**:
  In Rust, arithmetic overflow panics in debug mode and wraps in release mode. When calculating whether a cursor is near the end of a visible list, subtracting an arbitrary index from a length can cause an underflow panic if the index exceeds the list size.
  ```rust
  // src/completion.rs: Microscopic invariant to prevent unsigned underflow panic
  fn is_near_visible_tail(&self) -> bool {
      self.state
          .listbox
          .len()
          .saturating_sub(self.state.listbox.position()) // INVARIANT: Never use '-' directly
          < self.state.config.lines.unwrap_or(1)
  }
  ```
- **Explicit Deserialization Type Narrowing**:
  When reading JSON streams with multiple top-level objects (JSON Lines or concatenated streams), iterating with `serde_json::Deserializer::from_str(s).into_iter::<Value>()` preserves exact string reader offsets without intermediate allocation.

---

### 2. Infinite Loop & Recursion Guards
- **Debounce Channel Exhaustion & Loop Termination**:
  A classic infinite loop hazard in Tokio event loops occurs when a channel receiver returns `None` (sender closed), but the loop continues spinning on other branches of `tokio::select!`.
  ```rust
  // src/utils/debounce.rs: Safe termination invariant
  loop {
      tokio::select! {
          maybe_query = debounce_rx.recv() => {
              if let Some(query) = maybe_query {
                  last_query = Some(query);
              } else {
                  // INVARIANT: When the sender drops, exit immediately.
                  // Failure to break here turns the select loop into a 100% CPU busy-spin.
                  break;
              }
          },
          _ = delay.tick() => {
              if let Some(text) = last_query.take() {
                  let _ = last_tx.send(text).await;
              }
          },
      }
  }
  ```
- **Bounded Ingestion Iterators**:
  Preventing memory starvation on unbounded input streams is enforced via `max_streams`:
  ```rust
  // src/json.rs: Enforcing finite collection bounds on stream deserializers
  let results = match max_streams {
      Some(l) => deserializer.take(l).collect::<Result<Vec<_>, _>>(),
      None => deserializer.collect::<Result<Vec<_>, _>>(),
  };
  ```

---

### 3. UI & UX Micro-Mechanics
- **Focus Suppression for Non-Interactive Elements**:
  Attempting to shift keyboard focus to static visual elements (such as an informational guide or banner) introduces deadlocks in keyboard navigation.
  ```rust
  // src/context.rs: Focus boundary guard
  pub async fn set_active_index(&self, index: Index) {
      if index == Index::Guide {
          // INVARIANT: Guide is purely display-only; rejecting focus transitions prevents
          // unroutable keyboard input events.
          return;
      }
      let mut ctx = self.0.lock().await;
      ctx.active_index = index;
  }
  ```
- **Terminal State Restoration on Mode Switching**:
  When transitioning focus from an inline prompt to a full-screen interactive JSON viewer, terminal screen buffers and mouse capture must be toggled atomically:
  ```rust
  // src/event_dispatcher.rs
  Index::JsonViewer => {
      ctx.set_active_index(Index::QueryEditor).await;
      editor_action_tx.send(QueryEditorAction::Enter).await?;
      // Restore terminal state to avoid leaving user shell corrupted
      execute!(
          io::stdout(),
          terminal::LeaveAlternateScreen,
          DisableMouseCapture,
      )?;
  }
  ```

---

### 4. Backend Concurrency & Memory Safety
- **Lock Scope Minimization Pattern**:
  Holding an `Arc<Mutex<T>>` guard across an `.await` boundary that performs terminal rendering or cross-thread channel sends can trigger deadlocks. In `jnv`, lock scopes are restricted to synchronous blocks:
  ```rust
  // src/json_viewer.rs: Explicit lock dropping before awaiting downstream channels
  let area = {
      let ctx = shared_ctx.lock().await;
      ctx.area
      // MutexGuard drops here automatically
  };

  let graphemes = {
      let mut viewer = shared_viewer_state.lock().await;
      viewer.handle_user_event(&event);
      viewer.state.create_graphemes(area.0, area.1)
      // MutexGuard drops here automatically
  };

  // Safe to await renderer without holding any state locks
  let _ = shared_renderer
      .update([(Index::JsonViewer, graphemes)])
      .render()
      .await;
  ```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Semantic Differentiation Between Error and `null` Return**:
  In `jq`, querying a non-existent property on an object (e.g., `.foo.bar` when `bar` does not exist) evaluates to `null` rather than raising a compilation or runtime error. `jnv` differentiates empty results from user errors:
  ```rust
  // src/json_viewer.rs
  if ret.iter().all(|val| *val == Value::Null) {
      // Not a jq failure, but indicates potential filter typo to user
      guide = Some(GuideMessage::JqReturnedNull(input));
      // Retain previous stream so view is not blanked out
      self.state.stream = JsonStream::new(self.json.iter());
  } else {
      self.state.stream = JsonStream::new(ret.iter());
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The architecture is structured as an **actor-like event-driven pipeline over bounded async channels**.
```
[EventStream] -> [EventDispatcher] -> [MPSC Channels] -> [Subsystem Tasks] -> [SharedRenderer]
```
State ownership is split between:
- `SharedContext`: Stores metadata (viewport size, active index, running task abort handles).
- Specialized Local States (`JsonViewer`, `CompletionNavigator`, `TextEditor`): Encapsulated inside `Arc<Mutex<T>>` or `Arc<RwLock<T>>` and mutated exclusively via incoming channel actions.

---

### Dimension 2: Core Abstractions
- `Index` enum: Serves as a type-safe focus descriptor (`QueryEditor`, `Guide`, `Completion`, `JsonViewer`).
- `SharedRenderer<Index>`: A thread-safe grapheme canvas that renders only registered component regions.
- `JsonStream`: An indexed cursor abstraction over arbitrary JSON values that supports folding, unfolding, and hierarchical line indentation.

---

### Dimension 3: Error Handling
- Errors are modeled through `anyhow::Result<T>` across tasks, but runtime errors within user filters are routed to the `GuideAction::Show` UI bus instead of terminating the process.
- Clipboard access failures (`arboard`) are caught and translated into transient `Severity::Error` UI notifications without crashing the terminal loop.

---

### Dimension 4: Testing
- Verified by property tests on debouncers and headless tape tests via Charmbracelet's `vhs` (`tapes/demo.tape`).
- End-to-end user navigation flows, completion traversals, and query edits are codified into scripted terminal inputs and asserted visually and structurally.

---

### Dimension 5: Security
- **Memory Safety**: Written entirely in 100% safe Rust without `unsafe` blocks.
- **Embedded Engine Isolation**: Evaluates jq queries using an in-process Rust evaluation engine (`jaq`) rather than piping data to external shell processes (`sh -c jq`), preventing command injection vulnerabilities.

---

### Dimension 6: Performance
- **Zero-Copy Grapheme Construction**: Graphemes are generated on-demand matching the visible screen bounds `(width, height)` rather than rendering entire formatted JSON structures into string memory.
- **Debounced Reactivity**: Keystroke debounce (`600ms`) and resize debounce (`200ms`) prevent CPU saturation during rapid user inputs.

---

### Dimension 7: Deployment
- Single, statically-linked binary distribution.
- Utilizes `[profile.dist]` inheriting from `release` with `codegen-units = 1` and `lto = true` to maximize link-time optimization and strip unused AST parsing tables.
- Multi-stage Docker builds based on `debian:bookworm-slim` compile the Rust binary in a cached builder layer and copy the final output to `/bin/jnv`.

---

### Dimension 8: Agent Patterns
- Tooling pattern: An agent driving `jnv` via CLI can use the `--write-to-stdout` Unix flag. This transforms the interactive UI into a pipeline filter that emits the finalized, user-filtered JSON document directly into `stdout` upon exit.

---

### Dimension 9: Data Flow
Data flow is strictly unidirectional:
```
Raw Bytes (Stdin/File) 
  -> serde_json StreamDeserializer 
  -> Vec<Value> (Memory Root)
       +---> jaq-core Compiler/Runner (on query change) -> Filtered Vec<Value> -> JsonStream -> StyledGraphemes
       +---> jsonz::get_all_paths (background thread) -> BTreeSet<String> -> Listbox -> StyledGraphemes
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Background Task Swapping with Abort Handles
```rust
pub struct Context {
    pub current_task: Option<JoinHandle<()>>,
}

// In event handler:
if let Some(task) = ctx.current_task.take() {
    task.abort();
}
ctx.current_task = Some(tokio::spawn(async move { /* heavy compute */ }));
```

### 2. Rule
*Components handling asynchronous user input MUST abort active processing handles before spawning replacement background jobs.*

### 3. Architecture Principle
*Decouple input event normalization from domain processing: no subsystem should ever parse raw, device-dependent hardware events directly.*

### 4. Failure Mode
*Unquoted JSON keys containing symbols (`@`, `.`, `-`) crash query compilation when directly concatenated into filter paths.*

### 5. Reusable Skill
*Implementing safe, responsive pagination in TUI list widgets using chunked background collection and `drain(..min)` buffer extraction.*

### 6. Decision
*Using an in-process Rust-native `jq` interpreter (`jaq`) instead of child-process `jq` execution eliminates process-forking overhead and cross-platform binary dependencies.*

### 7. Anti-Pattern
*Evaluating hash-set membership on input events that carry volatile spatial properties (e.g., mouse cursor column/row).*

### 8. Verification Method
*Scripting deterministic user sessions via `vhs` tape suites to assert that UI states remain valid during high-frequency input streams.*

---

## 7. Actionable Agent Skill & Implementation Checklist

```markdown
### Asynchronous TUI Pipeline Implementation Checklist

- [ ] **1. Input Normalization Layer**:
  - [ ] Strip or zero-out volatile mouse cursor coordinates `(row, column)` before evaluating against configured event keybinds.
  - [ ] Verify that `ScrollUp` and `ScrollDown` triggers function uniformly across all terminal screen coordinates.

- [ ] **2. Concurrency & Cancellation Guards**:
  - [ ] Store active async `JoinHandle<()>` instances in a centralized or component-level `Option<JoinHandle<()>>`.
  - [ ] Always invoke `.take().map(|t| t.abort())` immediately before scheduling replacement computations.
  - [ ] In debounce loops, ensure the loop breaks immediately when `recv()` returns `None`.

- [ ] **3. Lock Granularity & Contention Control**:
  - [ ] Never hold an `Arc<Mutex<T>>` guard across rendering or network transmission `.await` points.
  - [ ] Never insert elements one-by-one under a global lock; accumulate into a local `Vec` and `drain` in bounded chunks.

- [ ] **4. Autocompletion & Query Sanitization**:
  - [ ] Verify that extracted dictionary keys are escaped/quoted (`."@key"` or `.["key"]`) if they contain characters outside `[a-zA-Z_][a-zA-Z0-9_]*`.
  - [ ] Implement saturating arithmetic (`saturating_sub`) when calculating relative scroll offsets to prevent unsigned integer underflow panics.

- [ ] **5. Terminal Lifecycle Invariants**:
  - [ ] Pair every `EnterAlternateScreen` and `EnableMouseCapture` with a guaranteed teardown (`LeaveAlternateScreen`, `DisableMouseCapture`) on shutdown and mode switch.
  - [ ] Validate that non-interactive visual panes (like error banners or guides) reject input focus changes.
```