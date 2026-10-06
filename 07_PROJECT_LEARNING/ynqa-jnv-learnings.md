# Forensic Learning Record (Deep Inspection): ynqa/jnv

> **Canonical Artifact**: `07_PROJECT_LEARNING/ynqa-jnv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ynqa/jnv](https://github.com/ynqa/jnv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:31:23.637Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ynqa/jnv`
- **Description**: Interactive JSON filter using jq
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 6121 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils.rs`
```
mod debounce;
pub use debounce::setup_debouncer;

```

### Core Architecture Module: `src/utils/debounce.rs`
```
use std::time::Duration;

use tokio::{sync::mpsc, task::JoinHandle};

/// Initializes the debouncer input/output channels and task handle as a set.
///
/// Returns:
/// - `debounce_tx`: Input channel for values that should be debounced.
///   - Send a value here whenever the source value changes.
///   - If multiple values arrive within a short period, only the latest one is kept as a candidate.
/// - `last_rx`: Output channel for debounced values.
///   - On each `duration` tick, one value is emitted if a latest candidate exists.
///   - Consumers can process only the "settled" latest value by reading from this channel.
/// - `debouncer`: Join handle of the background task running the debounce loop.
pub fn setup_debouncer<T: Send + 'static>(
    duration: Duration,
) -> (mpsc::Sender<T>, mpsc::Receiver<T>, JoinHandle<()>) {
    let (last_tx, last_rx) = mpsc::channel(1);
    let (debounce_tx, debounce_rx) = mpsc::channel(1);
    let debouncer = spawn_debouncer(debounce_rx, last_tx, duration);
    (debounce_tx, last_rx, debouncer)
}

fn spawn_debouncer<T: Send + 'static>(
    mut debounce_rx: mpsc::Receiver<T>,
    last_tx: mpsc::Sender<T>,
    duration: Duration,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut last_query = None;
        let mut delay = tokio::time::interval(duration);
        loop {
            tokio::select! {
                maybe_query = debounce_rx.recv() => {
                    if let Some(query) = maybe_query {
                        last_query = Some(query);
                    } else {
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
    })
}

```

### Core Architecture Module: `src/completion.rs`
```
use std::{collections::BTreeSet, sync::Arc};

use promkit_widgets::{
    core::{crossterm::event::Event, grapheme::StyledGraphemes, Widget},
    listbox::{self, Listbox},
};
use tokio::{
    sync::{mpsc, Mutex, RwLock},
    task::{self, JoinHandle},
};

use crate::{
    config::CompletionKeybinds,
    context::{Index, SharedContext},
    guide::{GuideAction, GuideMessage},
    json,
    query_editor::QueryEditorAction,
};

/// Progress information for loading suggestions
#[derive(Clone, Default)]
pub struct SuggestionLoadProgress {
    pub is_complete: bool,
    pub loaded_path_count: usize,
}

/// Store for suggestions with thread-safe access
struct SuggestionStore {
    /// Set of all paths extracted from JSON input
    paths: BTreeSet<String>,
    progress: SuggestionLoadProgress,
}

#[derive(Clone)]
pub struct SharedSuggestionStore(Arc<Mutex<SuggestionStore>>);

impl SharedSuggestionStore {
    /// Collect suggestions that start with the given prefix
    pub async fn collect_matches(&self, prefix: &str) -> (Vec<String>, SuggestionLoadProgress) {
        let store = self.0.lock().await;
        let items = store
            .paths
            .iter()
            .filter(|p| p.starts_with(prefix))
            .cloned()
            .collect::<Vec<_>>();
        (items, store.progress.clone())
    }
}

/// Spawn a background loader and return shared suggestion store with task handle.
pub fn spawn_initialize(
    input: &'static str,
    max_streams: Option<usize>,
    chunk_size: usize,
) -> (SharedSuggestionStore, JoinHandle<()>) {
    let shared = SharedSuggestionStore(Arc::new(Mutex::new(SuggestionStore {
        paths: BTreeSet::new(),
        progress: SuggestionLoadProgress::default(),
    })));

    let shared_for_loading = shared.clone();
    let loader_task = task::spawn(async move {
        // Load paths in a streaming manner and update the shared store incrementally
        let iter = match json::get_all_paths(input, max_streams).await {
            Ok(iter) => iter,
            Err(_) => {
                let mut store = shared_for_loading.0.lock().await;
                store.progress.is_complete = true;
                return;
            }
        };

        // Process paths in chunks to avoid holding the lock for too long
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
            }
        }

        // Insert any remaining paths after the loop
        let remaining = batch.len();
        let mut store = shared_for_loading.0.lock().await;
        for item in batch {
            store.paths.insert(item);
        }

        // Mark loading as complete and update progress
        store.progress.loaded_path_count += remaining;
        store.progress.is_complete = true;
    });

    (shared, loader_task)
}

/// Navigator for managing the state of suggestions
/// and interactions in the completion view.
pub struct CompletionNavigator {
    shared_suggestions: SharedSuggestionStore,
    state: listbox::State,
    /// Number of suggestions to load in each chunk
    /// when the user scrolls near the end of the list.
    search_result_chunk_size: usize,
    /// Buffered suggestions that are not yet visible in the listbox.
    remaining_items: Vec<String>,
}

impl CompletionNavigator {
    pub fn new(
        shared_suggestions: SharedSuggestionStore,
        state: listbox::State,
        search_result_chunk_size: usize,
    ) -> Self {
        Self {
            shared_suggestions,
            state,
            search_result_chunk_size,
            remaining_items: Default::default(),
        }
    }

    /// Get the currently selected item in listbox.
    fn get_current_item(&self) -> String {
        self.state.listbox.get().to_string()
    }

    /// Create graphemes for rendering the completion navigator.
    pub fn create_graphemes(&self, width: u16, height: u16) -> StyledGraphemes {
        self.state.create_graphemes(width, height)
    }

    /// Returns true when the cursor is close enough to the visible tail
    /// and preloading the next chunk is beneficial.
    fn is_near_visible_tail(&self) -> bool {
        self.state
            .listbox
            .len()
            .saturating_sub(self.state.listbox.position())
            < self.state.config.lines.unwrap_or(1)
    }

    fn move_down(&mut self) {
        // First, move the cursor down by one item.
        self.state.listbox.forward();

        // Then, check if we need to load more items
        // when the cursor is close to the end.
        if self.is_near_visible_tail() {
            self.append_next_chunk_if_needed();
        }
    }

    fn append_next_chunk_if_needed(&mut self) {
        if self.remaining_items.is_empty() {
            return;
        }
        let items = self.remaining_items.drain(
            ..self
                .search_result_chunk_size
                .min(self.remaining_items.len()),
        );
        for item in items {
            self.state.listbox.push_string(item);
        }
    }

    /// Handle a user input event to update the completion navigator's state accordingly.
    /// Returns `Some(String)` if the event triggers a selection change that should update the query editor,
    fn handle_user_event(
        &mut self,
        event: &Event,
        completion_keybinds: &CompletionKeybinds,
    ) -> Option<String> {
        if self.state.listbox.is_empty() {
            return None;
        }

        // Move up.
        if completion_keybinds.up.contains(event) {
            self.state.listbox.backward();
            return Some(self.get_current_item());
        }

        // Move down (and load more if near the end).
        if completion_keybinds.down.contains(event) {
            self.move_down();
            return Some(self.get_current_item());
        }

        None
    }

    async fn enter(&mut self, prefix: &str) -> (Option<String>, SuggestionLoadProgress) {
        let (items, progress) = self.shared_suggestions.collect_matches(prefix).await;
        let head_item = self.initialize_session_items(items);
        (head_item, progress)
    }

    /// Initialize a completion session with a new search result set.
    /// This method always resets previous session state first.
    fn initialize_session_items(&mut self, mut items: Vec<String>) -> Option<String> {
        self.clear_session_state();

        if items.is_empty() {
            return None;
        }

        let used = items
            .drain(..self.search_result_chunk_size.min(items.len()))
            .collect::<Vec<_>>();
        self.remaining_items = items;
        self.state.listbox = Listbox::from(used);
        Some(self.state.listbox.get().to_string())
    }

    /// Reset completion session state.
    /// This clears both visible list items and buffered remaining items.
    fn clear_session_state(&mut self) {
        self.state.listbox = Listbox::from(Vec::<String>::new());
        self.remaining_items.clear();
    }
}

pub enum CompletionAction {
    /// Triggered when the user enters the completion view with a current query as prefix.
    Enter { prefix: String },
    /// Triggered when the user leaves the completion view.
    Leave,
    /// Triggered on user input events within the completion view, such as navigation keys.
    UserEvent(Event),
}

/// Spawn a background task to manage the completion navigator's state and interactions.
pub fn start_completion_task(
    mut action_rx: mpsc::Receiver<CompletionAction>,
    shared_ctx: SharedContext,
    shared_completion: Arc<RwLock<CompletionNavigator>>,
    shared_renderer: promkit_widgets::core::render::SharedRenderer<Index>,
    query_editor_action_tx: mpsc::Sender<QueryEditorAction>,
    guide_action_tx: mpsc::Sender<GuideAction>,
    completion_keybinds: CompletionKeybinds,
) -> JoinHandle<anyhow::Result<()>> {
    tokio::spawn(async move {
        loop {
            tokio::select! {
                Some(action) = action_rx.recv() => {
                    let area = shared_ctx.area().await;
                    let completion_view = {
                        let mut completion = shared_completion.write().await;
                        match action {
                            CompletionAction::Enter { prefix } => {
                                let (head_item, load_progress) = completion.enter(&prefix).await;
                                match head_item {
                                    Some(head) => {
                                        let message = if load_progress.is_complete {
                                            GuideMessage::LoadedAllSuggestions(load_progress.loaded_path_count)
                                        } else {
                                            GuideMessage::LoadedPartiallySuggestions(load_progress.loaded_path_count)
                                        };
                                        guide_action_tx.send(GuideAction::Show(message)).await?;
                                        query_editor_action_tx
                                            .send(QueryEditorAction::ReplaceText(head))
                                            .await?;
                                    }
                                    None => {
                                        guide_action_tx
                                            .send(GuideAction::Show(GuideMessage::NoSuggestionFound(prefix)))
                                            .await?;
                                        shared_ctx.set_active_index(Index::QueryEditor).await;
                                        completion.clear_session_state();
      
```

### Core Architecture Module: `src/config.rs`
```
use std::collections::HashSet;

use promkit_widgets::{core::crossterm::event::Event, jsonstream, listbox, text_editor};
use serde::{Deserialize, Serialize};
use termcfg::crossterm_config::event_set_serde;
use tokio::time::Duration;

mod duration;
use duration::duration_serde;

#[derive(Serialize, Deserialize)]
pub struct EditorConfig {
    pub on_focus: text_editor::Config,
    pub on_defocus: text_editor::Config,
}

#[derive(Serialize, Deserialize)]
pub struct JsonConfig {
    pub max_streams: Option<usize>,
    pub stream: jsonstream::Config,
}

#[derive(Serialize, Deserialize)]
pub struct CompletionConfig {
    pub listbox: listbox::Config,
    pub search_result_chunk_size: usize,
    pub search_load_chunk_size: usize,
}

// TODO: remove Clone derive
#[derive(Clone, Serialize, Deserialize)]
pub struct Keybinds {
    #[serde(with = "event_set_serde")]
    pub exit: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub copy_query: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub copy_result: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub switch_mode: HashSet<Event>,
    pub on_editor: EditorKeybinds,
    pub on_json_viewer: JsonViewerKeybinds,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct EditorKeybinds {
    #[serde(with = "event_set_serde")]
    pub backward: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub forward: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub move_to_head: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub move_to_tail: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub move_to_previous_nearest: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub move_to_next_nearest: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub erase: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub erase_all: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub erase_to_previous_nearest: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub erase_to_next_nearest: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub completion: HashSet<Event>,
    pub on_completion: CompletionKeybinds,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CompletionKeybinds {
    #[serde(with = "event_set_serde")]
    pub up: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub down: HashSet<Event>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct JsonViewerKeybinds {
    #[serde(with = "event_set_serde")]
    pub up: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub down: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub move_to_head: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub move_to_tail: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub toggle: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub expand: HashSet<Event>,
    #[serde(with = "event_set_serde")]
    pub collapse: HashSet<Event>,
}

#[derive(Serialize, Deserialize)]
pub struct ReactivityControl {
    #[serde(with = "duration_serde")]
    pub query_debounce_duration: Duration,

    #[serde(with = "duration_serde")]
    pub resize_debounce_duration: Duration,

    #[serde(with = "duration_serde")]
    pub spin_duration: Duration,
}

pub static DEFAULT_CONFIG: &str = include_str!("../default.toml");

/// Note that the config struct and the `.toml` configuration file are
/// managed separately because the current toml crate
/// does not readily support the following features:
///
/// - Preserve docstrings as comments in the `.toml` file
///   - https://github.com/toml-rs/toml/issues/376
/// - Output inline tables
///   - https://github.com/toml-rs/toml/issues/592
///
/// Also difficult to patch `Config` using only the items specified in the configuration file
/// (Premise: To address the complexity of configurations,
/// it assumes using a macro to avoid managing Option-wrapped structures on our side).s
///
/// The main challenge is that, for nested structs,
/// it is not able to wrap every leaf field with Option<>.
/// https://github.com/colin-kiegel/rust-derive-builder/issues/254
#[derive(Serialize, Deserialize)]
pub struct Config {
    pub no_hint: bool,
    pub reactivity_control: ReactivityControl,
    pub editor: EditorConfig,
    pub json: JsonConfig,
    pub completion: CompletionConfig,
    pub keybinds: Keybinds,
}

impl Config {
    pub fn load_from(content: &str) -> anyhow::Result<Self> {
        toml::from_str(content).map_err(Into::into)
    }
}

```

### Core Architecture Module: `src/config/duration.rs`
```
use duration_string::DurationString;
use serde::Deserialize;
use tokio::time::Duration;

pub mod duration_serde {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(duration: &Duration, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&DurationString::from(*duration).to_string())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Duration, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(DurationString::deserialize(deserializer)?.into())
    }
}

```

### Core Architecture Module: `src/context.rs`
```
use std::{future::Future, sync::Arc};

use promkit_widgets::spinner;
use tokio::{sync::Mutex, task::JoinHandle};

/// Represent the different sections of the UI, which can be used to manage focus and input handling.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Index {
    QueryEditor = 0,
    Guide = 1,
    Completion = 2,
    JsonViewer = 3,
}

#[derive(PartialEq)]
/// Represent the current state of the JSON viewer,
/// which can be used to control rendering behavior
/// and manage concurrent tasks like query processing and spinner animation.
pub enum State {
    /// The viewer is idle and ready for user interactions or query processing.
    Idle,
    /// The viewer is currently loading the JSON stream, which may involve deserialization
    Loading,
    /// The viewer is actively processing a jq query, which may involve executing the query
    /// and updating the view with the results.
    Processing,
}

pub struct Context {
    /// The current state of the processor, which can be Idle, Loading, or Processing.
    pub state: State,
    /// Current active index for user input handling.
    pub active_index: Index,
    /// The current size of the terminal area.
    ///
    /// PERF NOTE: This currently lives with `state/current_task` in the same mutex
    /// for simplicity. If lock contention becomes visible, this can be split into
    /// a dedicated shared store (e.g. `Arc<RwLock<(u16, u16)>>`) to reduce lock
    /// granularity.
    pub area: (u16, u16),
    /// The current task being executed, if any.
    pub current_task: Option<JoinHandle<()>>,
}

#[derive(Clone)]
pub struct SharedContext(Arc<Mutex<Context>>);

impl SharedContext {
    pub fn new(area: (u16, u16)) -> Self {
        Self(Arc::new(Mutex::new(Context {
            state: State::Idle,
            active_index: Index::QueryEditor,
            area,
            current_task: None,
        })))
    }

    pub async fn area(&self) -> (u16, u16) {
        let ctx = self.0.lock().await;
        ctx.area
    }

    pub async fn set_area(&self, area: (u16, u16)) {
        let mut ctx = self.0.lock().await;
        ctx.area = area;
    }

    pub async fn active_index(&self) -> Index {
        let ctx = self.0.lock().await;
        ctx.active_index
    }

    /// Set the active index, which controls which input field is currently focused.
    /// If the index is `Guide`, it will be ignored to prevent focus on the guide section.
    pub async fn set_active_index(&self, index: Index) {
        if index == Index::Guide {
            return;
        }
        let mut ctx = self.0.lock().await;
        ctx.active_index = index;
    }

    pub(crate) async fn lock(&self) -> tokio::sync::MutexGuard<'_, Context> {
        self.0.lock().await
    }
}

impl spinner::State for SharedContext {
    fn is_idle(&self) -> impl Future<Output = bool> + Send {
        let shared = self.0.clone();
        async move {
            let context = shared.lock().await;
            context.state == State::Idle
        }
    }
}

```

### Core Architecture Module: `src/event_dispatcher.rs`
```
use std::io;

use futures::StreamExt;
use promkit_widgets::{
    core::crossterm::{
        event::{
            DisableMouseCapture, EnableMouseCapture, Event, EventStream, MouseEvent, MouseEventKind,
        },
        execute, terminal,
    },
    spinner::State,
};
use tokio::{sync::mpsc, task::JoinHandle};

use crate::{
    completion::CompletionAction,
    config::Keybinds,
    context::{Index, SharedContext},
    guide::{GuideAction, GuideMessage},
    json_viewer,
    query_editor::QueryEditorAction,
};

/// Actions that can be triggered by terminal events,
/// which are dispatched to the appropriate components.
enum Action {
    Resize(u16, u16),
    Exit,
    CopyQuery,
    CopyResult,
    /// Switch between query-editor/completion and JSON viewer.
    SwitchMode,
}

/// Spawn a background task to listen for terminal events and dispatch corresponding actions
/// to the appropriate components (query editor, completion navigator, JSON viewer, guide).
pub fn spawn_terminal_event_dispatch_task(
    ctx: SharedContext,
    keybinds: Keybinds,
    debounce_resize_tx: mpsc::Sender<(u16, u16)>,
    editor_action_tx: mpsc::Sender<QueryEditorAction>,
    completion_action_tx: mpsc::Sender<CompletionAction>,
    json_viewer_action_tx: mpsc::Sender<json_viewer::ViewerAction>,
    guide_action_tx: mpsc::Sender<GuideAction>,
) -> JoinHandle<anyhow::Result<()>> {
    let mut stream = EventStream::new();
    tokio::spawn(async move {
        'main: loop {
            tokio::select! {
                Some(Ok(event)) = stream.next() => {
                    // Note: `HashSet<Event>::contains` compares full mouse events (including `column`/`row`),
                    // so wheel events are normalized to `(0, 0)` to match configured `ScrollUp`/`ScrollDown` bindings.
                    let event = match event {
                        Event::Mouse(mouse)
                            if matches!(
                                mouse.kind,
                                MouseEventKind::ScrollUp | MouseEventKind::ScrollDown
                            ) =>
                        {
                            Event::Mouse(MouseEvent {
                                kind: mouse.kind,
                                column: 0,
                                row: 0,
                                modifiers: mouse.modifiers,
                            })
                        }
                        other => other,
                    };
                    guide_action_tx.send(GuideAction::Clear).await?;

                    let action = if let Event::Resize(width, height) = event {
                        Some(Action::Resize(width, height))
                    } else if keybinds.exit.contains(&event) {
                        Some(Action::Exit)
                    } else if keybinds.copy_query.contains(&event) {
                        Some(Action::CopyQuery)
                    } else if keybinds.copy_result.contains(&event) {
                        Some(Action::CopyResult)
                    } else if keybinds.switch_mode.contains(&event) {
                        Some(Action::SwitchMode)
                    } else {
                        None
                    };

                    if let Some(action) = action {
                        match action {
                            Action::Resize(width, height) => {
                                debounce_resize_tx.send((width, height)).await?;
                            }
                            Action::Exit => break 'main,
                            Action::CopyQuery => {
                                editor_action_tx.send(QueryEditorAction::CopyQuery).await?;
                            }
                            Action::CopyResult => {
                                if ctx.is_idle().await {
                                    json_viewer_action_tx
                                        .send(json_viewer::ViewerAction::CopyResult)
                                        .await?;
                                } else {
                                    guide_action_tx
                                        .send(GuideAction::Show(
                                            GuideMessage::FailedToCopyWhileRenderingInProgress,
                                        ))
                                        .await?;
                                }
                            }
                            Action::SwitchMode => match ctx.active_index().await {
                                Index::QueryEditor | Index::Completion => {
                                    if ctx.is_idle().await {
                                        ctx.set_active_index(Index::JsonViewer).await;
                                        completion_action_tx.send(CompletionAction::Leave).await?;
                                        editor_action_tx.send(QueryEditorAction::Leave).await?;
                                        execute!(
                                            io::stdout(),
                                            terminal::EnterAlternateScreen,
                                            EnableMouseCapture,
                                        )?;
                                    } else {
                                        guide_action_tx
                                            .send(GuideAction::Show(
                                                GuideMessage::FailedToSwitchModeWhileRenderingInProgress,
                                        ))
                                        .await?;
                                    }
                                }
                                Index::JsonViewer => {
                                    ctx.set_active_index(Index::QueryEditor).await;
                                    editor_action_tx.send(QueryEditorAction::Enter).await?;
                                    execute!(
                                        io::stdout(),
                                        terminal::LeaveAlternateScreen,
                                        DisableMouseCapture,
                                    )?;
                                }
                                Index::Guide => {}
                            },
                        }
                        continue;
                    }

                    match ctx.active_index().await {
                        Index::QueryEditor => {
                            editor_action_tx
                                .send(QueryEditorAction::UserEvent(event))
                                .await?;
                        }
                        Index::Completion => {
                            completion_action_tx
                                .send(CompletionAction::UserEvent(event))
                                .await?;
                        }
                        Index::JsonViewer => {
                            json_viewer_action_tx
                                .send(json_viewer::ViewerAction::UserEvent(event))
                                .await?;
                        }
                        Index::Guide => {}
                    }
                },
                else => {
                    break 'main;
                }
            }
        }
        Ok(())
    })
}

```

### Core Architecture Module: `src/guide.rs`
```
use arboard::Clipboard;
use promkit_widgets::{
    core::{render::SharedRenderer, Widget},
    status::{self, Severity},
};
use tokio::{sync::mpsc, task::JoinHandle};

use crate::context::{Index, SharedContext};

/// Represent a message to be shown in the guide.
/// This is used to decouple the logic of generating messages from the logic of rendering them.
pub enum GuideMessage {
    CopiedToClipboard,
    FailedToCopyToClipboard(String),
    FailedToSetupClipboard(String),
    FailedToCopyWhileRenderingInProgress,
    FailedToSwitchModeWhileRenderingInProgress,
    LoadedAllSuggestions(usize),
    LoadedPartiallySuggestions(usize),
    NoSuggestionFound(String),
    JqReturnedNull(String),
    JqFailed(String),
}

/// Represent an action to be performed on the guide.
pub enum GuideAction {
    Clear,
    Show(GuideMessage),
}

fn message_to_state(message: GuideMessage) -> status::State {
    match message {
        GuideMessage::CopiedToClipboard => {
            status::State::new("Copied to clipboard", Severity::Success)
        }
        GuideMessage::FailedToCopyToClipboard(e) => {
            status::State::new(format!("Failed to copy to clipboard: {e}"), Severity::Error)
        }
        GuideMessage::FailedToSetupClipboard(e) => {
            status::State::new(format!("Failed to setup clipboard: {e}"), Severity::Error)
        }
        GuideMessage::FailedToCopyWhileRenderingInProgress => status::State::new(
            "Failed to copy while rendering is in progress.",
            Severity::Warning,
        ),
        GuideMessage::FailedToSwitchModeWhileRenderingInProgress => status::State::new(
            "Failed to switch mode while rendering is in progress.",
            Severity::Warning,
        ),
        GuideMessage::LoadedAllSuggestions(count) => status::State::new(
            format!("Loaded all ({count}) suggestions"),
            Severity::Success,
        ),
        GuideMessage::LoadedPartiallySuggestions(count) => status::State::new(
            format!("Loaded partially ({count}) suggestions"),
            Severity::Success,
        ),
        GuideMessage::NoSuggestionFound(prefix) => status::State::new(
            format!("No suggestion found for '{prefix}'"),
            Severity::Warning,
        ),
        GuideMessage::JqReturnedNull(input) => status::State::new(
            format!("jq returned 'null', which may indicate a typo or incorrect filter: `{input}`"),
            Severity::Warning,
        ),
        GuideMessage::JqFailed(e) => {
            status::State::new(format!("jq failed: `{e}`"), Severity::Error)
        }
    }
}

/// Copy the given content to the clipboard and return a message indicating the result.
pub fn copy_to_clipboard_message(content: &str) -> GuideMessage {
    match Clipboard::new() {
        Ok(mut clipboard) => match clipboard.set_text(content) {
            Ok(_) => GuideMessage::CopiedToClipboard,
            Err(e) => GuideMessage::FailedToCopyToClipboard(e.to_string()),
        },
        Err(e) => GuideMessage::FailedToSetupClipboard(e.to_string()),
    }
}

/// Spawn a task that listens for guide actions and updates the guide view accordingly.
pub fn start_guide_task(
    mut action_rx: mpsc::Receiver<GuideAction>,
    shared_renderer: SharedRenderer<Index>,
    shared_ctx: SharedContext,
    no_hint: bool,
) -> JoinHandle<anyhow::Result<()>> {
    tokio::spawn(async move {
        loop {
            tokio::select! {
                Some(action) = action_rx.recv() => {
                    let area = shared_ctx.area().await;
                    let view = if no_hint {
                        Default::default()
                    } else {
                        match action {
                            GuideAction::Clear => status::State::default().create_graphemes(area.0, area.1),
                            GuideAction::Show(message) => message_to_state(message).create_graphemes(area.0, area.1),
                        }
                    };
                    shared_renderer.update([(Index::Guide, view)]).render().await?;
                }
                else => break,
            }
        }
        Ok(())
    })
}

```

### Core Architecture Module: `src/json.rs`
```
use jaq_core::{
    load::{Arena, File, Loader},
    Compiler, Ctx, RcIter,
};
use jaq_json::Val;

use promkit_widgets::{
    jsonstream::jsonz,
    serde_json::{self, Deserializer, Value},
};

/// Get all JSON paths from the input JSON string,
/// respecting the max_streams limit if provided.
pub async fn get_all_paths(
    json_str: &str,
    max_streams: Option<usize>,
) -> anyhow::Result<impl Iterator<Item = String>> {
    let stream = deserialize(json_str, max_streams)?;
    let paths = jsonz::get_all_paths(stream.iter()).collect::<Vec<_>>();
    Ok(paths.into_iter())
}

/// Deserialize JSON string into a vector of serde_json::Value.
/// If max_streams is given, only deserialize up to that many JSON values.
pub fn deserialize(
    json_str: &str,
    max_streams: Option<usize>,
) -> anyhow::Result<Vec<serde_json::Value>> {
    let deserializer: serde_json::StreamDeserializer<'_, serde_json::de::StrRead<'_>, Value> =
        Deserializer::from_str(json_str).into_iter::<serde_json::Value>();
    let results = match max_streams {
        Some(l) => deserializer.take(l).collect::<Result<Vec<_>, _>>(),
        None => deserializer.collect::<Result<Vec<_>, _>>(),
    };
    results.map_err(anyhow::Error::from)
}

pub fn run_jaq(
    query: &str,
    json_stream: &[serde_json::Value],
) -> anyhow::Result<Vec<serde_json::Value>> {
    let arena = Arena::default();
    let loader = Loader::new(jaq_std::defs().chain(jaq_json::defs()));
    let modules = loader
        .load(
            &arena,
            File {
                code: query,
                path: (),
            },
        )
        .map_err(|errs| anyhow::anyhow!("jq filter parsing failed: {errs:?}"))?;
    let filter = Compiler::default()
        .with_funs(jaq_std::funs().chain(jaq_json::funs()))
        .compile(modules)
        .map_err(|errs| anyhow::anyhow!("jq filter compilation failed: {errs:?}"))?;

    let mut ret = Vec::<serde_json::Value>::new();

    for input in json_stream {
        let inputs = RcIter::new(core::iter::empty());
        let out = filter.run((Ctx::new([], &inputs), Val::from(input.clone())));
        for item in out {
            match item {
                Ok(val) => ret.push(val.into()),
                Err(err) => return Err(anyhow::anyhow!("jq filter execution failed: {err}")),
            }
        }
    }

    Ok(ret)
}

```

### Core Architecture Module: `src/json_viewer.rs`
```
use std::sync::Arc;

use promkit_widgets::{
    core::{crossterm::event::Event, grapheme::StyledGraphemes, render::SharedRenderer, Widget},
    jsonstream::{self, JsonStream},
    serde_json::{self, Value},
};
use tokio::{
    sync::{mpsc, Mutex},
    task::JoinHandle,
};

use crate::{
    config::{JsonConfig, JsonViewerKeybinds},
    context::{Index, SharedContext, State},
    guide::{self, GuideAction, GuideMessage},
    json,
};

/// Represent the trigger for rendering views.
pub enum RenderTrigger {
    /// User actions such as key presses
    UserAction(Event),
    /// Query changes such as new jq filter input
    QueryChanged { query: String },
    /// Terminal resize events
    AreaResized { query: String },
}

/// JSON viewer that maintains the state of JSON stream
/// and handles user interactions and query processing.
pub struct JsonViewer {
    state: jsonstream::State,
    json: Vec<serde_json::Value>,
    keybinds: JsonViewerKeybinds,
}

pub type SharedJsonViewer = Arc<Mutex<JsonViewer>>;

impl JsonViewer {
    /// Get the formatted content of current JSON stream.
    pub fn formatted_content(&self) -> String {
        self.state.config.format_raw_json(self.state.stream.rows())
    }

    /// Handle user event and update the viewer state accordingly.
    fn handle_user_event(&mut self, event: &Event) {
        match event {
            // Move up.
            event if self.keybinds.up.contains(event) => {
                self.state.stream.up();
            }

            // Move down.
            event if self.keybinds.down.contains(event) => {
                self.state.stream.down();
            }

            // Move to head
            event if self.keybinds.move_to_head.contains(event) => {
                self.state.stream.head();
            }

            // Move to tail
            event if self.keybinds.move_to_tail.contains(event) => {
                self.state.stream.tail();
            }

            // Toggle collapse/expand
            event if self.keybinds.toggle.contains(event) => {
                self.state.stream.toggle();
            }

            event if self.keybinds.expand.contains(event) => {
                self.state.stream.set_nodes_visibility(false);
            }

            event if self.keybinds.collapse.contains(event) => {
                self.state.stream.set_nodes_visibility(true);
            }

            _ => (),
        }
    }

    /// Process jq query and update the viewer state with the results.
    async fn refresh_view_with_query(
        &mut self,
        area: (u16, u16),
        input: String,
    ) -> (Option<GuideMessage>, Option<StyledGraphemes>) {
        match json::run_jaq(&input, &self.json) {
            Ok(ret) => {
                let mut guide = None;
                if ret.iter().all(|val| *val == Value::Null) {
                    guide = Some(GuideMessage::JqReturnedNull(input));

                    self.state.stream = JsonStream::new(self.json.iter());
                } else {
                    self.state.stream = JsonStream::new(ret.iter());
                }

                (guide, Some(self.state.create_graphemes(area.0, area.1)))
            }
            Err(e) => {
                self.state.stream = JsonStream::new(self.json.iter());

                (
                    Some(GuideMessage::JqFailed(e.to_string())),
                    Some(self.state.create_graphemes(area.0, area.1)),
                )
            }
        }
    }
}

/// Initialize the JSON viewer with the given input, configuration, keybinds, and shared context.
pub async fn initialize(
    input: &'static str,
    config: JsonConfig,
    keybinds: JsonViewerKeybinds,
    shared_ctx: SharedContext,
    shared_renderer: SharedRenderer<Index>,
) -> anyhow::Result<SharedJsonViewer> {
    // Set state to Loading to prevent overwriting by spinner frames in terminal.
    {
        let mut ctx = shared_ctx.lock().await;
        if let Some(task) = ctx.current_task.take() {
            task.abort();
        }
        ctx.state = State::Loading;
    }

    let input_stream = json::deserialize(input, config.max_streams)?;
    let stream = JsonStream::new(input_stream.iter());
    let state = jsonstream::State {
        stream,
        config: config.stream,
    };

    // Set state to Idle to prevent overwriting by spinner frames in terminal.
    {
        let mut ctx = shared_ctx.lock().await;
        ctx.state = State::Idle;
    }

    {
        let ctx = shared_ctx.lock().await;
        let area = ctx.area;
        drop(ctx);

        // TODO: error handling
        let _ = shared_renderer
            .update([(Index::JsonViewer, state.create_graphemes(area.0, area.1))])
            .render()
            .await;
    }

    Ok(Arc::new(Mutex::new(JsonViewer {
        json: input_stream,
        state,
        keybinds,
    })))
}

pub async fn render(
    trigger: RenderTrigger,
    shared_ctx: SharedContext,
    shared_viewer_state: SharedJsonViewer,
    shared_renderer: SharedRenderer<Index>,
    guide_action_tx: mpsc::Sender<GuideAction>,
) {
    match trigger {
        RenderTrigger::UserAction(event) => {
            handle_user_event(shared_viewer_state, shared_renderer, shared_ctx, event).await;
        }
        RenderTrigger::QueryChanged { query } => {
            handle_query_changed(
                shared_viewer_state,
                shared_renderer,
                shared_ctx,
                guide_action_tx,
                query,
            )
            .await;
        }
        RenderTrigger::AreaResized { query } => {
            handle_area_resized(
                shared_viewer_state,
                shared_renderer,
                shared_ctx,
                guide_action_tx,
                query,
            )
            .await;
        }
    }
}

async fn handle_user_event(
    shared_viewer_state: SharedJsonViewer,
    shared_renderer: SharedRenderer<Index>,
    shared_ctx: SharedContext,
    event: Event,
) {
    let area = {
        let ctx = shared_ctx.lock().await;
        ctx.area
    };

    let graphemes = {
        let mut viewer = shared_viewer_state.lock().await;
        viewer.handle_user_event(&event);
        viewer.state.create_graphemes(area.0, area.1)
    };

    // TODO: error handling
    let _ = shared_renderer
        .update([(Index::JsonViewer, graphemes)])
        .render()
        .await;
}

async fn handle_query_changed(
    shared_viewer_state: SharedJsonViewer,
    shared_renderer: SharedRenderer<Index>,
    shared_ctx: SharedContext,
    guide_action_tx: mpsc::Sender<GuideAction>,
    query: String,
) {
    // Abort any ongoing processing task to prevent race conditions
    // and ensure the new render reflects the latest terminal size.
    {
        let mut ctx = shared_ctx.lock().await;
        if let Some(task) = ctx.current_task.take() {
            task.abort();
        }
    }

    let task = spawn_query_update_task(
        shared_viewer_state.clone(),
        shared_ctx.clone(),
        guide_action_tx,
        shared_renderer,
        query,
    );

    // Store the new processing task handle in shared context
    // to allow future cancellation if needed.
    {
        let mut ctx = shared_ctx.lock().await;
        ctx.current_task = Some(task);
    }
}

async fn handle_area_resized(
    shared_viewer_state: SharedJsonViewer,
    shared_renderer: SharedRenderer<Index>,
    shared_ctx: SharedContext,
    guide_action_tx: mpsc::Sender<GuideAction>,
    query: String,
) {
    {
        let mut ctx = shared_ctx.lock().await;
        // Abort any ongoing processing task to prevent race conditions
        // and ensure the new render reflects the latest terminal size.
        if let Some(task) = ctx.current_task.take() {
            task.abort();
        }
    }

    let task = spawn_query_update_task(
        shared_viewer_state.clone(),
        shared_ctx.clone(),
        guide_action_tx,
        shared_renderer,
        query,
    );

    // Store the new processing task handle in shared context
    // to allow future cancellation if needed.
    {
        let mut ctx = shared_ctx.lock().await;
        ctx.current_task = Some(task);
    }
}

// Spawn a background task to process the jq query and update the viewer state with the results,
// while managing the viewer state to prevent race conditions and ensure the view reflects the latest terminal size.
fn spawn_query_update_task(
    shared_viewer_state: SharedJsonViewer,
    shared_ctx: SharedContext,
    guide_action_tx: mpsc::Sender<GuideAction>,
    shared_renderer: SharedRenderer<Index>,
    query: String,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        // Set state to Processing to prevent overwriting by spinner frames in terminal.
        {
            let mut ctx = shared_ctx.lock().await;
            ctx.state = State::Processing;
        }

        let (maybe_guide, maybe_resp) = {
            let ctx = shared_ctx.lock().await;
            let area = ctx.area;
            drop(ctx);

            let mut runtime = shared_viewer_state.lock().await;
            runtime.refresh_view_with_query(area, query).await
        };

        // Set state to Idle to allow rendering of spinner frames in terminal.
        {
            let mut ctx = shared_ctx.lock().await;
            ctx.state = State::Idle;
        }

        if let Some(message) = maybe_guide {
            let _ = guide_action_tx.send(GuideAction::Show(message)).await;
        }

        // TODO: error handling
        let _ = shared_renderer
            .update([(
                Index::JsonViewer,
                maybe_resp.unwrap_or(StyledGraphemes::default()),
            )])
            .render()
            .await;
    })
}

/// Represent the actions that can be performed in JSON viewer,
/// including copying results to clipboard, handling user events, and processing query changes.
pub enum ViewerAction {
    /// Copy the current JSON stream results to clipboard.
```

### Core Architecture Module: `src/main.rs`
```
use std::{
    fs::File,
    io::{self, Read, Write},
    path::PathBuf,
    sync::Arc,
};

use anyhow::anyhow;
use clap::Parser;
use promkit_widgets::{
    core::{
        crossterm,
        grapheme::StyledGraphemes,
        render::{Renderer, SharedRenderer},
    },
    listbox::{self, Listbox},
    spinner::{self, Spinner},
    text_editor::{self, TextEditor},
};
use tokio::sync::{mpsc, RwLock};

mod completion;
use completion::{CompletionAction, CompletionNavigator};
mod config;
use config::{Config, DEFAULT_CONFIG};
mod context;
use context::{Index, SharedContext};
mod event_dispatcher;
mod guide;
use guide::GuideAction;
mod json;
mod json_viewer;
mod query_editor;
use query_editor::{QueryEditor, QueryEditorAction};
mod runtime_tasks;
mod stdout_redirect;
use stdout_redirect::StdoutRedirect;
mod utils;

/// JSON navigator and interactive filter leveraging jq
#[derive(Parser)]
#[command(
    name = "jnv",
    version,
    help_template = "
{about}

Usage: {usage}

Examples:
- Read from a file:
        {bin} data.json

- Read from standard input:
        cat data.json | {bin}

Arguments:
{positionals}

Options:
{options}
"
)]
pub struct Args {
    /// Optional path to a JSON file.
    /// If not provided or if "-" is specified,
    /// reads from standard input.
    pub input: Option<PathBuf>,

    #[arg(short = 'c', long = "config", help = "Path to the configuration file.")]
    pub config_file: Option<PathBuf>,

    #[arg(
        long = "default-filter",
        help = "Default jq filter to apply to the input data",
        long_help = "
        Sets the default jq filter to apply to the input data.
        The filter is applied when the interface is first loaded.
        "
    )]
    default_filter: Option<String>,

    #[arg(
        long = "write-to-stdout",
        help = "Write the current JSON result to stdout when exiting"
    )]
    write_to_stdout: bool,
}

/// Parses the input based on the provided arguments.
///
/// This function reads input data from either a specified file or standard input.
/// If the `input` argument is `None`, or if it is a path
/// that equals "-", data is read from standard input.
/// Otherwise, the function attempts to open and
/// read from the file specified in the `input` argument.
fn parse_input(args: &Args) -> anyhow::Result<String> {
    let mut ret = String::new();

    match &args.input {
        None => {
            io::stdin().read_to_string(&mut ret)?;
        }
        Some(path) => {
            if path == &PathBuf::from("-") {
                io::stdin().read_to_string(&mut ret)?;
            } else {
                File::open(path)?.read_to_string(&mut ret)?;
            }
        }
    }

    Ok(ret)
}

/// Ensures the configuration file exists, creating it with default settings if it doesn't
///
/// If the file already exists, returns Ok.
/// If the file doesn't exist, writes the default configuration in TOML format.
/// Returns an error if file creation fails.
fn ensure_file_exists(path: &PathBuf) -> anyhow::Result<()> {
    if path.exists() {
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| anyhow!("Failed to create directory: {e}"))?;
    }

    std::fs::File::create(path)?.write_all(DEFAULT_CONFIG.as_bytes())?;

    Ok(())
}

/// Determines the configuration file path with the following precedence:
/// 1. The provided `config_path` argument, if it exists.
/// 2. The default configuration file path in the user's configuration directory.
///
/// If the configuration file does not exist, it will be created.
/// Returns an error if the file creation fails.
fn determine_config_file(config_path: Option<PathBuf>) -> anyhow::Result<PathBuf> {
    // If a custom path is provided
    if let Some(path) = config_path {
        ensure_file_exists(&path)?;
        return Ok(path);
    }

    // Use the default path
    let default_path = dirs::config_dir()
        .ok_or_else(|| anyhow!("Failed to determine the configuration directory"))?
        // TODO: need versions...?
        .join("jnv")
        .join("config.toml");

    ensure_file_exists(&default_path)?;
    Ok(default_path)
}

/// A guard that ensures terminal state is restored when dropped.
struct TerminalCleanupGuard;

impl Drop for TerminalCleanupGuard {
    fn drop(&mut self) {
        let _ = crossterm::execute!(
            io::stdout(),
            crossterm::cursor::Show,
            crossterm::event::DisableMouseCapture
        );
        let _ = crossterm::terminal::disable_raw_mode();
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    // Load input data
    let input = parse_input(&args)?;
    let input: &'static str = Box::leak(input.into_boxed_str());

    // Load configuration
    let config = determine_config_file(args.config_file)
        .and_then(|config_file| {
            std::fs::read_to_string(&config_file)
                .map_err(|e| anyhow!("Failed to read configuration file: {e}"))
        })
        .and_then(|content| Config::load_from(&content))
        // a missing file is already seeded with the defaults by ensure_file_exists,
        // so anything failing here is a real problem the user should hear about
        .map_err(|e| anyhow!("{e}"))?;

    // Set up terminal
    crossterm::terminal::enable_raw_mode()?;
    let _terminal_cleanup_guard = TerminalCleanupGuard;
    crossterm::execute!(io::stdout(), crossterm::cursor::Hide)?;

    // Spawn the completion loader task, which will asynchronously load suggestions based on the input data.
    let (shared_suggestions, completion_loader_task) = completion::spawn_initialize(
        input,
        config.json.max_streams,
        config.completion.search_load_chunk_size,
    );

    // Initialize the completion navigator with shared suggestions and configuration.
    let completion_navigator = CompletionNavigator::new(
        shared_suggestions,
        listbox::State {
            listbox: Listbox::default(),
            config: config.completion.listbox,
        },
        config.completion.search_result_chunk_size,
    );

    // Initialize the query editor with the default filter, configuration, and keybindings.
    let query_editor = QueryEditor::new(
        text_editor::State {
            texteditor: if let Some(ref filter) = args.default_filter {
                TextEditor::new(filter)
            } else {
                Default::default()
            },
            history: Default::default(),
            config: config.editor.on_focus.clone(),
        },
        config.editor.on_focus,
        config.editor.on_defocus,
        // TODO: remove clones
        config.keybinds.on_editor.clone(),
    );

    // Redirects stdout to prevent interference with TUI interface.
    let mut stdout_redirect = StdoutRedirect::try_new_for_tui(args.write_to_stdout)?;

    // Get terminal size for rendering purposes.
    let terminal_size = crossterm::terminal::size()?;

    // Initialize the shared renderer with graphemes for each UI component.
    let renderer = SharedRenderer::new(
        Renderer::try_new_with_graphemes(
            [
                (
                    Index::QueryEditor,
                    query_editor.create_graphemes(terminal_size.0, terminal_size.1),
                ),
                (Index::Guide, StyledGraphemes::default()),
                (Index::Completion, StyledGraphemes::default()),
                (Index::JsonViewer, StyledGraphemes::default()),
            ]
            .into_iter(),
            true,
        )
        .await?,
    );

    // Initialize the shared context with the terminal size,
    // which can be used by various components for rendering and state management.
    let ctx = SharedContext::new(terminal_size);

    // Load input data into JSON viewer, initializing it with the provided configuration and keybindings.
    let load_for_json_viewer = json_viewer::initialize(
        input,
        config.json,
        config.keybinds.on_json_viewer.clone(),
        ctx.clone(),
        renderer.clone(),
    );

    // Spawn the spinner task, which will display a loading spinner in JSON viewer while processing is ongoing.
    let spinner_task = tokio::spawn({
        let shared_renderer = renderer.clone();
        let ctx = ctx.clone();
        async move {
            let spinner = Spinner::default().duration(config.reactivity_control.spin_duration);
            let _ = spinner::run(&spinner, ctx, Index::JsonViewer, shared_renderer).await;
        }
    });

    // Set up the debouncer for the query editor input, which will manage the timing of query updates
    // to prevent excessive processing while the user is typing.
    let (debounce_query_tx, last_query_rx, query_debouncer) =
        utils::setup_debouncer::<String>(config.reactivity_control.query_debounce_duration);

    // If a default filter is provided via command-line arguments, send it to the query debouncer
    // to initialize the interface with that filter applied.
    if let Some(default_filter) = args.default_filter {
        debounce_query_tx.send(default_filter).await?;
    }

    // Set up the debouncer for terminal resize events, which will manage the timing of resize handling
    // to prevent excessive re-rendering while the terminal is being resized.
    let (debounce_resize_tx, last_resize_rx, resize_debouncer) =
        utils::setup_debouncer::<(u16, u16)>(config.reactivity_control.resize_debounce_duration);

    // Create channels for communication between the main event loop and various components
    // (query editor, completion navigator, JSON viewer, and guide).
    let (editor_action_tx, editor_action_rx) = mpsc::channel::<QueryEditorAction>(1);
    let (completion_action_tx, completion_action_rx) = mpsc::channel::<CompletionAction>(1);
    let (json_viewer_action_tx, json_viewer_action_rx) =
        mpsc::channel::<json_viewer::ViewerAction>(8);
    let (guide_action_tx, g
```

### Core Architecture Module: `src/query_editor.rs`
```
use std::sync::Arc;

use promkit_widgets::{
    core::{
        crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind, KeyEventState, KeyModifiers},
        grapheme::StyledGraphemes,
        Widget,
    },
    text_editor,
};
use tokio::{
    sync::{mpsc, RwLock},
    task::JoinHandle,
};

use crate::{
    completion::CompletionAction,
    config::EditorKeybinds,
    context::{Index, SharedContext},
    guide::{self, GuideAction},
};

/// Editor for inputting jq query. It manages the state of the text editor
/// and handles user input events to update the query text accordingly.
pub struct QueryEditor {
    state: text_editor::State,
    focus_config: text_editor::Config,
    defocus_config: text_editor::Config,
    editor_keybinds: EditorKeybinds,
}

impl QueryEditor {
    pub fn new(
        state: text_editor::State,
        focus_config: text_editor::Config,
        defocus_config: text_editor::Config,
        editor_keybinds: EditorKeybinds,
    ) -> Self {
        Self {
            state,
            focus_config,
            defocus_config,
            editor_keybinds,
        }
    }

    /// Focus the query editor, applying the focus configuration.
    pub fn focus(&mut self) {
        self.state.config = self.focus_config.clone();
    }

    /// Defocus the query editor, applying the defocus configuration.
    pub fn defocus(&mut self) {
        self.state.config = self.defocus_config.clone();
    }

    /// Get the current text of the query editor without the cursor.
    pub fn text(&self) -> String {
        self.state.texteditor.text_without_cursor().to_string()
    }

    /// Create graphemes for rendering the query editor.
    pub fn create_graphemes(&self, width: u16, height: u16) -> StyledGraphemes {
        self.state.create_graphemes(width, height)
    }

    /// Replace the current text of the query editor with the given text.
    pub fn replace_text(&mut self, text: &str) {
        self.state.texteditor.replace(text);
    }

    /// Handle a user input event to update the query editor's state accordingly.
    /// Returns `true` if the event triggers the completion action, otherwise `false`.
    fn handle_user_event(&mut self, event: &Event) -> bool {
        if self.editor_keybinds.completion.contains(event) {
            return true;
        }

        match event {
            key if self.editor_keybinds.backward.contains(key) => {
                self.state.texteditor.backward();
            }
            key if self.editor_keybinds.forward.contains(key) => {
                self.state.texteditor.forward();
            }
            key if self.editor_keybinds.move_to_head.contains(key) => {
                self.state.texteditor.move_to_head();
            }
            key if self.editor_keybinds.move_to_tail.contains(key) => {
                self.state.texteditor.move_to_tail();
            }
            key if self.editor_keybinds.move_to_previous_nearest.contains(key) => {
                self.state
                    .texteditor
                    .move_to_previous_nearest(&self.state.config.word_break_chars);
            }
            key if self.editor_keybinds.move_to_next_nearest.contains(key) => {
                self.state
                    .texteditor
                    .move_to_next_nearest(&self.state.config.word_break_chars);
            }
            key if self.editor_keybinds.erase.contains(key) => {
                self.state.texteditor.erase();
            }
            key if self.editor_keybinds.erase_all.contains(key) => {
                self.state.texteditor.erase_all();
            }
            key if self.editor_keybinds.erase_to_previous_nearest.contains(key) => {
                self.state
                    .texteditor
                    .erase_to_previous_nearest(&self.state.config.word_break_chars);
            }
            key if self.editor_keybinds.erase_to_next_nearest.contains(key) => {
                self.state
                    .texteditor
                    .erase_to_next_nearest(&self.state.config.word_break_chars);
            }
            Event::Key(KeyEvent {
                code: KeyCode::Char(ch),
                modifiers: KeyModifiers::NONE,
                kind: KeyEventKind::Press,
                state: KeyEventState::NONE,
            })
            | Event::Key(KeyEvent {
                code: KeyCode::Char(ch),
                modifiers: KeyModifiers::SHIFT,
                kind: KeyEventKind::Press,
                state: KeyEventState::NONE,
            }) => match self.state.config.edit_mode {
                text_editor::Mode::Insert => self.state.texteditor.insert(*ch),
                text_editor::Mode::Overwrite => self.state.texteditor.overwrite(*ch),
            },
            _ => {}
        }
        false
    }
}

/// Represent the actions that can be performed on the query editor,
/// such as focusing, copying the query, or handling user events.
pub enum QueryEditorAction {
    /// Focus the query editor.
    Enter,
    /// Defocus the query editor.
    Leave,
    /// Copy the current query text to clipboard.
    CopyQuery,
    /// Replace the current query text.
    ReplaceText(String),
    /// Handle user input events to update the query editor's state.
    UserEvent(Event),
}

/// Spawn a background task to manage the query editor's state and interactions.
pub fn start_query_editor_task(
    mut action_rx: mpsc::Receiver<QueryEditorAction>,
    shared_ctx: SharedContext,
    shared_editor: Arc<RwLock<QueryEditor>>,
    shared_renderer: promkit_widgets::core::render::SharedRenderer<Index>,
    completion_action_tx: mpsc::Sender<CompletionAction>,
    debounce_query_tx: mpsc::Sender<String>,
    guide_action_tx: mpsc::Sender<GuideAction>,
) -> JoinHandle<anyhow::Result<()>> {
    tokio::spawn(async move {
        let mut last_text = {
            let editor = shared_editor.read().await;
            editor.text()
        };
        loop {
            tokio::select! {
                Some(action) = action_rx.recv() => {
                    let area = shared_ctx.area().await;
                    let (editor_view, current_text) = {
                        let mut editor = shared_editor.write().await;
                        match action {
                            QueryEditorAction::Enter => editor.focus(),
                            QueryEditorAction::Leave => editor.defocus(),
                            QueryEditorAction::CopyQuery => {
                                let message = guide::copy_to_clipboard_message(&editor.text());
                                guide_action_tx.send(GuideAction::Show(message)).await?;
                            }
                            QueryEditorAction::ReplaceText(text) => {
                                editor.replace_text(&text);
                            }
                            QueryEditorAction::UserEvent(event) => {
                                if editor.handle_user_event(&event) {
                                    shared_ctx.set_active_index(Index::Completion).await;
                                    completion_action_tx
                                        .send(CompletionAction::Enter {
                                            prefix: editor.text(),
                                        })
                                        .await?;
                                }
                            }
                        }
                        let current_text = editor.text();
                        (editor.create_graphemes(area.0, area.1), current_text)
                    };

                    // If the text has changed, send it to the debounce channel for processing.
                    if current_text != last_text {
                        debounce_query_tx.send(current_text.clone()).await?;
                        last_text = current_text;
                    }

                    // Update the renderer with the new editor view and render it.
                    shared_renderer
                        .update([(Index::QueryEditor, editor_view)])
                        .render()
                        .await?;
                }
                else => break,
            }
        }
        Ok(())
    })
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #22** (2024-03-23): **Fails to execute jq query when the key starts with `@` symbol**
  *Symptoms*: The problem occurs when `@` symbol is present as a key in a json file, I get autocompletion when I press Tab but then it fails to get the value for the specified key. ![reproduction](https://github.com/ynqa/jnv/assets/36114668/57091900-c8b3-401c-a0b6-f653b96f5fdb) 
  **Post-Mortem & Fix Analysis**:
  > Easy repro:  ```bash $ echo '{ "@ynqa": "need double quotation for query" }' | jnv  ❯❯ .@ynqa Failed to execute jq query '.@ynqa'   . ❯ .@ynqa {   "@ynqa": "need double quotation for query" }  # put double quote myself ❯❯ ."name@ynqa" "need double quotation for query" ``` 
  > @Faroukhamadi Thank you for the report. It seems that if there is an `@` present, it needs to be escaped with double quotes. This is something that hadn't been addressed, and will be fixed 👍 
  > @Faroukhamadi I just released v0.1.3, please check 🎉   

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

### Incident Patch 1: `f5510866` (2026-09-22)
**Commit Message**: docs: fix write-to-stdout file redirection example

**File**: `README.md` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ jnv data.json
 # or write current result to stdout on exit (UNIX only)
 cat data.json | jnv --write-to-stdout | some-command
 # and also output to file
-cat data.json | jnv -- --write-to-stdout > result.json
+cat data.json | jnv --write-to-stdout > result.json
 ```
 
 ## Keymap
```

---

### Incident Patch 2: `f25b1f0e` (2026-08-20)
**Commit Message**: Merge pull request #125 from VXNCXNX/fix/config-error-not-silent

fix: report a broken config file instead of silently using defaults

**File**: `src/main.rs` (modified, +3/-3)
```diff
@@ -185,9 +185,9 @@ async fn main() -> anyhow::Result<()> {
                 .map_err(|e| anyhow!("Failed to read configuration file: {e}"))
         })
         .and_then(|content| Config::load_from(&content))
-        .unwrap_or_else(|_e| {
-            Config::load_from(DEFAULT_CONFIG).expect("Failed to load default configuration")
-        });
+        // a missing file is already seeded with the defaults by ensure_file_exists,
+        // so anything failing here is a real problem the user should hear about
+        .map_err(|e| anyhow!("{e}"))?;
 
     // Set up terminal
     crossterm::terminal::enable_raw_mode()?;
```

---

### Incident Patch 3: `e19e0c3f` (2026-08-15)
**Commit Message**: fix: report a broken config file instead of silently using defaults

A parse failure was swallowed by unwrap_or_else, so a typo made every
customization vanish with no message and a zero exit. ensure_file_exists
already seeds a missing file with the defaults, so a failure here is real.

Closes #117

**File**: `src/main.rs` (modified, +3/-3)
```diff
@@ -185,9 +185,9 @@ async fn main() -> anyhow::Result<()> {
                 .map_err(|e| anyhow!("Failed to read configuration file: {e}"))
         })
         .and_then(|content| Config::load_from(&content))
-        .unwrap_or_else(|_e| {
-            Config::load_from(DEFAULT_CONFIG).expect("Failed to load default configuration")
-        });
+        // a missing file is already seeded with the defaults by ensure_file_exists,
+        // so anything failing here is a real problem the user should hear about
+        .map_err(|e| anyhow!("{e}"))?;
 
     // Set up terminal
     crossterm::terminal::enable_raw_mode()?;
```

---

### Incident Patch 4: `84535aa0` (2026-03-30)
**Commit Message**: fix: do not replace text when suggestions are empty

**File**: `src/completion.rs` (modified, +6/-0)
```diff
@@ -179,6 +179,10 @@ impl CompletionNavigator {
         event: &Event,
         completion_keybinds: &CompletionKeybinds,
     ) -> Option<String> {
+        if self.state.listbox.len() == 0 {
+            return None;
+        }
+
         // Move up.
         if completion_keybinds.up.contains(event) {
             self.state.listbox.backward();
@@ -270,6 +274,8 @@ pub fn start_completion_task(
                                         guide_action_tx
                                             .send(GuideAction::Show(GuideMessage::NoSuggestionFound(prefix)))
                                             .await?;
+                                        shared_ctx.set_active_index(Index::QueryEditor).await;
+                                        completion.clear_session_state();
                                     }
                                 }
                             }
```

---

### Incident Patch 5: `5022efb2` (2026-03-29)
**Commit Message**: docs: guide

**File**: `src/guide.rs` (modified, +3/-0)
```diff
@@ -22,6 +22,7 @@ pub enum GuideMessage {
     JqFailed(String),
 }
 
+/// Represent an action to be performed on the guide.
 pub enum GuideAction {
     Clear,
     Show(GuideMessage),
@@ -68,6 +69,7 @@ fn message_to_state(message: GuideMessage) -> status::State {
     }
 }
 
+/// Copy the given content to the clipboard and return a message indicating the result.
 pub fn copy_to_clipboard_message(content: &str) -> GuideMessage {
     match Clipboard::new() {
         Ok(mut clipboard) => match clipboard.set_text(content) {
@@ -78,6 +80,7 @@ pub fn copy_to_clipboard_message(content: &str) -> GuideMessage {
     }
 }
 
+/// Spawn a task that listens for guide actions and updates the guide view accordingly.
 pub fn start_guide_task(
     mut action_rx: mpsc::Receiver<GuideAction>,
     shared_renderer: SharedRenderer<Index>,
```

---

### Incident Patch 6: `9657639c` (2026-03-29)
**Commit Message**: chore: resize_render_task in main.rs

**File**: `src/main.rs` (modified, +12/-2)
```diff
@@ -371,6 +371,17 @@ async fn main() -> anyhow::Result<()> {
         guide_action_tx.clone(),
     );
 
+    // Spawn the resize render task, which will listen for terminal resize events and trigger re-rendering of the UI components accordingly.
+    let resize_render_task = runtime_tasks::spawn_resize_render_task(
+        last_resize_rx,
+        ctx.clone(),
+        renderer.clone(),
+        shared_query_editor.clone(),
+        shared_completion_navigator.clone(),
+        shared_json_viewer.clone(),
+        guide_action_tx.clone(),
+    );
+
     // TODO: put all logics here.
     let maybe_output = prompt::run(
         ctx,
@@ -383,17 +394,16 @@ async fn main() -> anyhow::Result<()> {
         args.write_to_stdout,
         debounce_query_tx,
         query_debouncer,
-        last_resize_rx,
         resize_debouncer,
         completion_loader_task,
         spinner_task,
-        guide_action_tx.clone(),
         event_dispacher_task,
         query_change_forward_task,
         guide_task,
         query_editor_task,
         completion_navigator_task,
         json_viewer_task,
+        resize_render_task,
     )
     .await;
 
```

**File**: `src/prompt.rs` (modified, +5/-18)
```diff
@@ -10,46 +10,33 @@ use crate::{
     completion::CompletionNavigator,
     config::Keybinds,
     context::{Index, SharedContext},
-    guide::GuideAction,
     json_viewer::SharedJsonViewer,
     query_editor::QueryEditor,
-    runtime_tasks,
 };
 
 #[allow(clippy::too_many_arguments)]
 pub async fn run(
-    ctx: SharedContext,
-    shared_renderer: SharedRenderer<Index>,
-    shared_editor: Arc<RwLock<QueryEditor>>,
-    shared_completion: Arc<RwLock<CompletionNavigator>>,
+    _ctx: SharedContext,
+    _shared_renderer: SharedRenderer<Index>,
+    _shared_editor: Arc<RwLock<QueryEditor>>,
+    _shared_completion: Arc<RwLock<CompletionNavigator>>,
     shared_viewer_state: SharedJsonViewer,
     _no_hint: bool,
     _keybinds: Keybinds,
     write_to_stdout: bool,
     _debounce_query_tx: mpsc::Sender<String>,
     query_debouncer: JoinHandle<()>,
-    last_resize_rx: mpsc::Receiver<(u16, u16)>,
     resize_debouncer: JoinHandle<()>,
     completion_loader_task: JoinHandle<()>,
     spinning: JoinHandle<()>,
-    guide_action_tx: mpsc::Sender<GuideAction>,
     main_task: JoinHandle<anyhow::Result<()>>,
     query_action_forwarder: JoinHandle<()>,
     guide_task: JoinHandle<anyhow::Result<()>>,
     editor_task: JoinHandle<anyhow::Result<()>>,
     completion_task: JoinHandle<anyhow::Result<()>>,
     processor_task: JoinHandle<anyhow::Result<()>>,
+    resize_render_task: JoinHandle<anyhow::Result<()>>,
 ) -> anyhow::Result<Option<String>> {
-    let resize_render_task = runtime_tasks::spawn_resize_render_task(
-        last_resize_rx,
-        ctx.clone(),
-        shared_renderer.clone(),
-        shared_editor.clone(),
-        shared_completion.clone(),
-        shared_viewer_state.clone(),
-        guide_action_tx.clone(),
-    );
-
     main_task.await??;
 
     let output = if write_to_stdout {
```

---

### Incident Patch 7: `c78b2ed2` (2026-03-29)
**Commit Message**: chore: prompt_event_loop => event_dispatcher

**File**: `src/main.rs` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ mod stdout_redirect;
 use stdout_redirect::StdoutRedirect;
 mod completion;
 mod prompt;
-mod prompt_event_loop;
+mod event_dispatcher;
 use completion::CompletionNavigator;
 mod json;
 mod utils;
```

**File**: `src/prompt.rs` (modified, +2/-2)
```diff
@@ -12,9 +12,9 @@ use crate::{
     completion::{self, CompletionAction, CompletionNavigator},
     config::Keybinds,
     context::SharedContext,
+    event_dispatcher,
     guide::{self, GuideAction},
     json_viewer::{self, RenderTrigger, SharedJsonViewer},
-    prompt_event_loop,
     query_editor::{self, QueryEditor, QueryEditorAction},
 };
 
@@ -51,7 +51,7 @@ pub async fn run(
         mpsc::channel::<json_viewer::ViewerAction>(8);
     let (guide_action_tx, guide_action_rx) = mpsc::channel::<GuideAction>(8);
 
-    let main_task = prompt_event_loop::spawn_terminal_event_dispatch_task(
+    let main_task = event_dispatcher::spawn_terminal_event_dispatch_task(
         ctx.clone(),
         keybinds.clone(),
         debounce_resize_tx,
```

---

### Incident Patch 8: `df3a55c4` (2026-03-29)
**Commit Message**: chore: separate main_task into prompt_event_loop

**File**: `src/main.rs` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ mod stdout_redirect;
 use stdout_redirect::StdoutRedirect;
 mod completion;
 mod prompt;
+mod prompt_event_loop;
 use completion::CompletionNavigator;
 mod json;
 mod utils;
```

**File**: `src/prompt.rs` (modified, +13/-150)
```diff
@@ -1,18 +1,7 @@
-use std::{io, sync::Arc};
+use std::sync::Arc;
 
-use futures::StreamExt;
 use promkit_widgets::{
-    core::{
-        crossterm::{
-            event::{
-                DisableMouseCapture, EnableMouseCapture, Event, EventStream, MouseEvent,
-                MouseEventKind,
-            },
-            execute, terminal,
-        },
-        render::SharedRenderer,
-    },
-    spinner::State,
+    core::render::SharedRenderer,
 };
 use tokio::{
     sync::{mpsc, RwLock},
@@ -23,19 +12,12 @@ use crate::{
     completion::{self, CompletionAction, CompletionNavigator},
     config::Keybinds,
     context::SharedContext,
-    guide::{self, GuideAction, GuideMessage},
+    guide::{self, GuideAction},
     json_viewer::{self, RenderTrigger, SharedJsonViewer},
+    prompt_event_loop,
     query_editor::{self, QueryEditor, QueryEditorAction},
 };
 
-enum GlobalAction {
-    Resize(u16, u16),
-    Exit,
-    CopyQuery,
-    CopyResult,
-    SwitchMode,
-}
-
 #[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
 pub enum Index {
     QueryEditor = 0,
@@ -69,134 +51,15 @@ pub async fn run(
         mpsc::channel::<json_viewer::ViewerAction>(8);
     let (guide_action_tx, guide_action_rx) = mpsc::channel::<GuideAction>(8);
 
-    let main_task: JoinHandle<anyhow::Result<()>> = {
-        let mut stream = EventStream::new();
-        let ctx = ctx.clone();
-        let editor_action_tx = editor_action_tx.clone();
-        let completion_action_tx = completion_action_tx.clone();
-        let json_viewer_action_tx = json_viewer_action_tx.clone();
-        let guide_action_tx = guide_action_tx.clone();
-        tokio::spawn(async move {
-            'main: loop {
-                tokio::select! {
-                    Some(Ok(event)) = stream.next() => {
-                        // Note: `HashSet<Event>::contains` compares full mouse events (including `column`/`row`),
-                        // so wheel events are normalized to `(0, 0)` to match configured `ScrollUp`/`ScrollDown` bindings.
-                        let event = match event {
-                            Event::Mouse(mouse)
-                                if matches!(
-                                    mouse.kind,
-                                    MouseEventKind::ScrollUp | MouseEventKind::ScrollDown
-                                ) =>
-                            {
-                                Event::Mouse(MouseEvent {
-                                    kind: mouse.kind,
-                                    column: 0,
-                                    row: 0,
-                                    modifiers: mouse.modifiers,
-                                })
-                            }
-                            other => other,
-                        };
-                        guide_action_tx.send(GuideAction::Clear).await?;
-
-                        let global_action = if let Event::Resize(width, height) = event {
-                            Some(GlobalAction::Resize(width, height))
-                        } else if keybinds.exit.contains(&event) {
-                            Some(GlobalAction::Exit)
-                        } else if keybinds.copy_query.contains(&event) {
-                            Some(GlobalAction::CopyQuery)
-                        } else if keybinds.copy_result.contains(&event) {
-                            Some(GlobalAction::CopyResult)
-                        } else if keybinds.switch_mode.contains(&event) {
-                            Some(GlobalAction::SwitchMode)
-                        } else {
-                            None
-                        };
-
-                        if let Some(action) = global_action {
-                            match action {
-                                GlobalAction::Resize(width, height) => {
-                                    debounce_resize_tx.send((width, height)).await?;
-                                }
-                                GlobalAction::Exit => break 'main,
-                                GlobalAction::CopyQuery => {
-                                    editor_action_tx.send(QueryEditorAction::CopyQuery).await?;
-                                }
-                                GlobalAction::CopyResult => {
-                                    if ctx.is_idle().await {
-                                        json_viewer_action_tx
-                                            .send(json_viewer::ViewerAction::CopyResult)
-                                            .await?;
-                                    } else {
-                                        guide_action_tx
-                                            .send(GuideAction::Show(
-                                                GuideMessage::FailedToCopyWhileRenderingInProgress,
-                                            ))
-                                            .await?;
-                                    }
-                    
```

**File**: `src/prompt_event_loop.rs` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+use std::io;
+
+use futures::StreamExt;
+use promkit_widgets::{
+    core::crossterm::{
+        event::{
+            DisableMouseCapture, EnableMouseCapture, Event, EventStream, MouseEvent, MouseEventKind,
+        },
+        execute, terminal,
+    },
+    spinner::State,
+};
+use tokio::{
+    sync::mpsc,
+    task::JoinHandle,
+};
+
+use crate::{
+    completion::CompletionAction,
+    config::Keybinds,
+    context::SharedContext,
+    guide::{GuideAction, GuideMessage},
+    json_viewer,
+    prompt::Index,
+    query_editor::QueryEditorAction,
+};
+
+/// Actions that can be triggered by terminal events,
+/// which are dispatched to the appropriate components.
+enum Action {
+    Resize(u16, u16),
+    Exit,
+    CopyQuery,
+    CopyResult,
+    /// Switch between query-editor/completion and JSON viewer.
+    SwitchMode,
+}
+
+/// Spawn a background task to listen for terminal events and dispatch corresponding actions
+/// to the appropriate components (query editor, completion navigator, JSON viewer, guide).
+pub fn spawn_terminal_event_dispatch_task(
+    ctx: SharedContext,
+    keybinds: Keybinds,
+    debounce_resize_tx: mpsc::Sender<(u16, u16)>,
+    editor_action_tx: mpsc::Sender<QueryEditorAction>,
+    completion_action_tx: mpsc::Sender<CompletionAction>,
+    json_viewer_action_tx: mpsc::Sender<json_viewer::ViewerAction>,
+    guide_action_tx: mpsc::Sender<GuideAction>,
+) -> JoinHandle<anyhow::Result<()>> {
+    let mut stream = EventStream::new();
+    tokio::spawn(async move {
+        'main: loop {
+            tokio::select! {
+                Some(Ok(event)) = stream.next() => {
+                    // Note: `HashSet<Event>::contains` compares full mouse events (including `column`/`row`),
+                    // so wheel events are normalized to `(0, 0)` to match configured `ScrollUp`/`ScrollDown` bindings.
+                    let event = match event {
+                        Event::Mouse(mouse)
+                            if matches!(
+                                mouse.kind,
+                                MouseEventKind::ScrollUp | MouseEventKind::ScrollDown
+                            ) =>
+                        {
+                            Event::Mouse(MouseEvent {
+                                kind: mouse.kind,
+                                column: 0,
+                                row: 0,
+                                modifiers: mouse.modifiers,
+                            })
+                        }
+                        other => other,
+                    };
+                    guide_action_tx.send(GuideAction::Clear).await?;
+
+                    let action = if let Event::Resize(width, height) = event {
+                        Some(Action::Resize(width, height))
+                    } else if keybinds.exit.contains(&event) {
+                        Some(Action::Exit)
+                    } else if keybinds.copy_query.contains(&event) {
+                        Some(Action::CopyQuery)
+                    } else if keybinds.copy_result.contains(&event) {
+                        Some(Action::CopyResult)
+                    } else if keybinds.switch_mode.contains(&event) {
+                        Some(Action::SwitchMode)
+                    } else {
+                        None
+                    };
+
+                    if let Some(action) = action {
+                        match action {
+                            Action::Resize(width, height) => {
+                                debounce_resize_tx.send((width, height)).await?;
+                            }
+                            Action::Exit => break 'main,
+                            Action::CopyQuery => {
+                                editor_action_tx.send(QueryEditorAction::CopyQuery).await?;
+                            }
+                            Action::CopyResult => {
+                                if ctx.is_idle().await {
+                                    json_viewer_action_tx
+                                        .send(json_viewer::ViewerAction::CopyResult)
+                                        .await?;
+                                } else {
+                                    guide_action_tx
+                                        .send(GuideAction::Show(
+                                            GuideMessage::FailedToCopyWhileRenderingInProgress,
+                                        ))
+                                        .await?;
+                                }
+                            }
+                            Action::SwitchMode => match ctx.active_index().await {
+                                Index::QueryEditor | Index::Completion => {
+                                    if ctx.is_idle().await {
+                                        ctx.set_active_index(Index::JsonViewer).await;
+                                        completion_action_tx.send(CompletionAction::Leave).await?;
+        
```

---

### Incident Patch 9: `7635ef30` (2026-03-29)
**Commit Message**: chore: debounce for resize in main.rs

**File**: `src/main.rs` (modified, +8/-0)
```diff
@@ -256,6 +256,11 @@ async fn main() -> anyhow::Result<()> {
     let (debounce_query_tx, last_query_rx, query_debouncer) =
         utils::setup_debouncer::<String>(config.reactivity_control.query_debounce_duration);
 
+    // Set up the debouncer for terminal resize events, which will manage the timing of resize handling
+    // to prevent excessive re-rendering while the terminal is being resized.
+    let (debounce_resize_tx, last_resize_rx, resize_debouncer) =
+        utils::setup_debouncer::<(u16, u16)>(config.reactivity_control.resize_debounce_duration);
+
     // TODO: put all logics here.
     let maybe_output = prompt::run(
         &input,
@@ -271,6 +276,9 @@ async fn main() -> anyhow::Result<()> {
         debounce_query_tx,
         last_query_rx,
         query_debouncer,
+        debounce_resize_tx,
+        last_resize_rx,
+        resize_debouncer,
     )
     .await;
 
```

**File**: `src/prompt.rs` (modified, +3/-4)
```diff
@@ -25,7 +25,6 @@ use crate::{
     guide::{self, GuideAction, GuideMessage},
     json_viewer::{self, RenderTrigger, SharedContext},
     query_editor::{self, QueryEditor, QueryEditorAction},
-    utils::setup_debouncer,
 };
 
 #[derive(Clone, Copy)]
@@ -66,14 +65,14 @@ pub async fn run(
     debounce_query_tx: mpsc::Sender<String>,
     mut last_query_rx: mpsc::Receiver<String>,
     query_debouncer: JoinHandle<()>,
+    debounce_resize_tx: mpsc::Sender<(u16, u16)>,
+    mut last_resize_rx: mpsc::Receiver<(u16, u16)>,
+    resize_debouncer: JoinHandle<()>,
 ) -> anyhow::Result<Option<String>> {
     if !editor.text().is_empty() {
         debounce_query_tx.send(editor.text()).await?;
     }
 
-    let (debounce_resize_tx, mut last_resize_rx, resize_debouncer) =
-        setup_debouncer::<(u16, u16)>(reactivity_control.resize_debounce_duration);
-
     let spinning = tokio::spawn({
         let shared_renderer = shared_renderer.clone();
         let ctx = ctx.clone();
```

---

### Incident Patch 10: `3344bf19` (2026-03-29)
**Commit Message**: chore: debounce for query in main.rs

**File**: `src/main.rs` (modified, +8/-0)
```diff
@@ -251,6 +251,11 @@ async fn main() -> anyhow::Result<()> {
     // which can be used by various components for rendering and state management.
     let ctx = SharedContext::new(terminal_size);
 
+    // Set up the debouncer for the query editor input, which will manage the timing of query updates
+    // to prevent excessive processing while the user is typing.
+    let (debounce_query_tx, last_query_rx, query_debouncer) =
+        utils::setup_debouncer::<String>(config.reactivity_control.query_debounce_duration);
+
     // TODO: put all logics here.
     let maybe_output = prompt::run(
         &input,
@@ -263,6 +268,9 @@ async fn main() -> anyhow::Result<()> {
         config.no_hint,
         config.keybinds,
         args.write_to_stdout,
+        debounce_query_tx,
+        last_query_rx,
+        query_debouncer,
     )
     .await;
 
```

**File**: `src/prompt.rs` (modified, +4/-3)
```diff
@@ -25,7 +25,7 @@ use crate::{
     guide::{self, GuideAction, GuideMessage},
     json_viewer::{self, RenderTrigger, SharedContext},
     query_editor::{self, QueryEditor, QueryEditorAction},
-    utils::debounce::setup_debouncer,
+    utils::setup_debouncer,
 };
 
 #[derive(Clone, Copy)]
@@ -63,9 +63,10 @@ pub async fn run(
     no_hint: bool,
     keybinds: Keybinds,
     write_to_stdout: bool,
+    debounce_query_tx: mpsc::Sender<String>,
+    mut last_query_rx: mpsc::Receiver<String>,
+    query_debouncer: JoinHandle<()>,
 ) -> anyhow::Result<Option<String>> {
-    let (debounce_query_tx, mut last_query_rx, query_debouncer) =
-        setup_debouncer(reactivity_control.query_debounce_duration);
     if !editor.text().is_empty() {
         debounce_query_tx.send(editor.text()).await?;
     }
```

**File**: `src/utils.rs` (modified, +2/-1)
```diff
@@ -1 +1,2 @@
-pub mod debounce;
+mod debounce;
+pub use debounce::setup_debouncer;
```

---

### Incident Patch 11: `ae2580b3` (2026-03-29)
**Commit Message**: chore: separate debouncer into utils

**File**: `src/main.rs` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ mod completion;
 mod prompt;
 use completion::CompletionNavigator;
 mod json;
+mod utils;
 
 use crate::{config::DEFAULT_CONFIG, json_viewer::SharedContext, prompt::Index};
 
```

**File**: `src/prompt.rs` (modified, +6/-42)
```diff
@@ -1,4 +1,4 @@
-use std::{io, sync::Arc, time::Duration};
+use std::{io, sync::Arc};
 
 use futures::StreamExt;
 use promkit_widgets::{
@@ -25,35 +25,9 @@ use crate::{
     guide::{self, GuideAction, GuideMessage},
     json_viewer::{self, RenderTrigger, SharedContext},
     query_editor::{self, QueryEditor, QueryEditorAction},
+    utils::debounce::setup_debouncer,
 };
 
-fn spawn_debouncer<T: Send + 'static>(
-    mut debounce_rx: mpsc::Receiver<T>,
-    last_tx: mpsc::Sender<T>,
-    duration: Duration,
-) -> tokio::task::JoinHandle<()> {
-    tokio::spawn(async move {
-        let mut last_query = None;
-        let mut delay = tokio::time::interval(duration);
-        loop {
-            tokio::select! {
-                maybe_query = debounce_rx.recv() => {
-                    if let Some(query) = maybe_query {
-                        last_query = Some(query);
-                    } else {
-                        break;
-                    }
-                },
-                _ = delay.tick() => {
-                    if let Some(text) = last_query.take() {
-                        let _ = last_tx.send(text).await;
-                    }
-                },
-            }
-        }
-    })
-}
-
 #[derive(Clone, Copy)]
 enum Focus {
     Editor,
@@ -90,24 +64,14 @@ pub async fn run(
     keybinds: Keybinds,
     write_to_stdout: bool,
 ) -> anyhow::Result<Option<String>> {
-    let (last_query_tx, mut last_query_rx) = mpsc::channel(1);
-    let (debounce_query_tx, debounce_query_rx) = mpsc::channel(1);
-    let query_debouncer = spawn_debouncer(
-        debounce_query_rx,
-        last_query_tx,
-        reactivity_control.query_debounce_duration,
-    );
+    let (debounce_query_tx, mut last_query_rx, query_debouncer) =
+        setup_debouncer(reactivity_control.query_debounce_duration);
     if !editor.text().is_empty() {
         debounce_query_tx.send(editor.text()).await?;
     }
 
-    let (last_resize_tx, mut last_resize_rx) = mpsc::channel::<(u16, u16)>(1);
-    let (debounce_resize_tx, debounce_resize_rx) = mpsc::channel(1);
-    let resize_debouncer = spawn_debouncer(
-        debounce_resize_rx,
-        last_resize_tx,
-        reactivity_control.resize_debounce_duration,
-    );
+    let (debounce_resize_tx, mut last_resize_rx, resize_debouncer) =
+        setup_debouncer::<(u16, u16)>(reactivity_control.resize_debounce_duration);
 
     let spinning = tokio::spawn({
         let shared_renderer = shared_renderer.clone();
```

**File**: `src/utils.rs` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+pub mod debounce;
```

**File**: `src/utils/debounce.rs` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+use std::time::Duration;
+
+use tokio::{sync::mpsc, task::JoinHandle};
+
+/// Initializes the debouncer input/output channels and task handle as a set.
+///
+/// Returns:
+/// - `debounce_tx`: Input channel for values that should be debounced.
+///   - Send a value here whenever the source value changes.
+///   - If multiple values arrive within a short period, only the latest one is kept as a candidate.
+/// - `last_rx`: Output channel for debounced values.
+///   - On each `duration` tick, one value is emitted if a latest candidate exists.
+///   - Consumers can process only the "settled" latest value by reading from this channel.
+/// - `debouncer`: Join handle of the background task running the debounce loop.
+pub fn setup_debouncer<T: Send + 'static>(
+    duration: Duration,
+) -> (mpsc::Sender<T>, mpsc::Receiver<T>, JoinHandle<()>) {
+    let (last_tx, last_rx) = mpsc::channel(1);
+    let (debounce_tx, debounce_rx) = mpsc::channel(1);
+    let debouncer = spawn_debouncer(debounce_rx, last_tx, duration);
+    (debounce_tx, last_rx, debouncer)
+}
+
+fn spawn_debouncer<T: Send + 'static>(
+    mut debounce_rx: mpsc::Receiver<T>,
+    last_tx: mpsc::Sender<T>,
+    duration: Duration,
+) -> JoinHandle<()> {
+    tokio::spawn(async move {
+        let mut last_query = None;
+        let mut delay = tokio::time::interval(duration);
+        loop {
+            tokio::select! {
+                maybe_query = debounce_rx.recv() => {
+                    if let Some(query) = maybe_query {
+                        last_query = Some(query);
+                    } else {
+                        break;
+                    }
+                },
+                _ = delay.tick() => {
+                    if let Some(text) = last_query.take() {
+                        let _ = last_tx.send(text).await;
+                    }
+                },
+            }
+        }
+    })
+}
```

---

### Incident Patch 12: `21f18957` (2026-03-29)
**Commit Message**: chore: move SharedRenderer into main

**File**: `src/main.rs` (modified, +28/-2)
```diff
@@ -8,9 +8,13 @@ use anyhow::anyhow;
 use clap::Parser;
 use config::Config;
 use promkit_widgets::{
+    core::{
+        crossterm,
+        grapheme::StyledGraphemes,
+        render::{Renderer, SharedRenderer},
+    },
     listbox::{self, Listbox},
     text_editor::{self, TextEditor},
-    core::crossterm,
 };
 
 mod query_editor;
@@ -25,7 +29,7 @@ mod prompt;
 use completion::CompletionNavigator;
 mod json;
 
-use crate::config::DEFAULT_CONFIG;
+use crate::{config::DEFAULT_CONFIG, prompt::Index};
 
 /// JSON navigator and interactive filter leveraging jq
 #[derive(Parser)]
@@ -221,9 +225,31 @@ async fn main() -> anyhow::Result<()> {
     // Redirects stdout to prevent interference with TUI interface.
     let mut stdout_redirect = StdoutRedirect::try_new_for_tui(args.write_to_stdout)?;
 
+    // Get terminal size for rendering purposes.
+    let terminal_size = crossterm::terminal::size()?;
+
+    // Initialize the shared renderer with graphemes for each UI component.
+    let shared_renderer = SharedRenderer::new(
+        Renderer::try_new_with_graphemes(
+            [
+                (
+                    Index::QueryEditor,
+                    query_editor.create_graphemes(terminal_size.0, terminal_size.1),
+                ),
+                (Index::Guide, StyledGraphemes::default()),
+                (Index::Completion, StyledGraphemes::default()),
+                (Index::JsonViewer, StyledGraphemes::default()),
+            ]
+            .into_iter(),
+            true,
+        )
+        .await?,
+    );
+
     // TODO: put all logics here.
     let maybe_output = prompt::run(
         &input,
+        shared_renderer,
         config.json,
         config.reactivity_control,
         query_editor,
```

**File**: `src/prompt.rs` (modified, +3/-20)
```diff
@@ -8,11 +8,9 @@ use promkit_widgets::{
                 DisableMouseCapture, EnableMouseCapture, Event, EventStream, MouseEvent,
                 MouseEventKind,
             },
-            execute,
-            terminal,
+            execute, terminal,
         },
-        grapheme::StyledGraphemes,
-        render::{Renderer, SharedRenderer},
+        render::SharedRenderer,
     },
     spinner::{self, Spinner, State},
 };
@@ -82,6 +80,7 @@ pub enum Index {
 #[allow(clippy::too_many_arguments)]
 pub async fn run(
     item: &'static str,
+    shared_renderer: SharedRenderer<Index>,
     json_config: JsonConfig,
     reactivity_control: ReactivityControl,
     editor: QueryEditor,
@@ -90,22 +89,6 @@ pub async fn run(
     keybinds: Keybinds,
     write_to_stdout: bool,
 ) -> anyhow::Result<Option<String>> {
-    let size = terminal::size()?;
-
-    let shared_renderer = SharedRenderer::new(
-        Renderer::try_new_with_graphemes(
-            [
-                (Index::QueryEditor, editor.create_graphemes(size.0, size.1)),
-                (Index::Guide, StyledGraphemes::default()),
-                (Index::Completion, StyledGraphemes::default()),
-                (Index::JsonViewer, StyledGraphemes::default()),
-            ]
-            .into_iter(),
-            true,
-        )
-        .await?,
-    );
-
     let ctx = SharedContext::try_default()?;
 
     let (last_query_tx, mut last_query_rx) = mpsc::channel(1);
```

---

### Incident Patch 13: `76e78a7b` (2026-03-29)
**Commit Message**: docs: try_new_for_tui

**File**: `src/main.rs` (modified, +1/-0)
```diff
@@ -218,6 +218,7 @@ async fn main() -> anyhow::Result<()> {
         config.keybinds.on_editor.clone(),
     );
 
+    // Redirects stdout to prevent interference with TUI interface.
     let mut stdout_redirect = StdoutRedirect::try_new_for_tui(args.write_to_stdout)?;
 
     // TODO: put all logics here.
```

---

### Incident Patch 14: `27322941` (2026-03-28)
**Commit Message**: chore: separate task definition only for json_viewer and define guide

**File**: `src/editor.rs` (modified, +0/-39)
```diff
@@ -4,7 +4,6 @@ use promkit_widgets::{
         grapheme::StyledGraphemes,
         Widget,
     },
-    status::{self, Severity},
     text_editor,
 };
 
@@ -14,7 +13,6 @@ pub struct Editor {
     state: text_editor::State,
     focus_config: text_editor::Config,
     defocus_config: text_editor::Config,
-    guide: status::State,
     editor_keybinds: EditorKeybinds,
 }
 
@@ -29,7 +27,6 @@ impl Editor {
             state,
             focus_config,
             defocus_config,
-            guide: status::State::default(),
             editor_keybinds,
         }
     }
@@ -40,7 +37,6 @@ impl Editor {
 
     pub fn defocus(&mut self) {
         self.state.config = self.defocus_config.clone();
-        self.guide = status::State::default();
     }
 
     pub fn text(&self) -> String {
@@ -51,46 +47,11 @@ impl Editor {
         self.state.create_graphemes(width, height)
     }
 
-    pub fn create_guide_pane(&self, width: u16, height: u16) -> StyledGraphemes {
-        self.guide.create_graphemes(width, height)
-    }
-
-    pub fn clear_guide(&mut self) {
-        self.guide = status::State::default();
-    }
-
-    pub fn set_guide(&mut self, guide: status::State) {
-        self.guide = guide;
-    }
-
     pub fn replace_text(&mut self, text: &str) {
         self.state.texteditor.replace(text);
     }
 
-    pub fn set_completion_found_guide(&mut self, loaded_path_count: usize, is_complete: bool) {
-        if is_complete {
-            self.guide = status::State::new(
-                format!("Loaded all ({loaded_path_count}) suggestions"),
-                Severity::Success,
-            );
-        } else {
-            self.guide = status::State::new(
-                format!("Loaded partially ({loaded_path_count}) suggestions"),
-                Severity::Success,
-            );
-        }
-    }
-
-    pub fn set_completion_empty_guide(&mut self, prefix: &str) {
-        self.guide = status::State::new(
-            format!("No suggestion found for '{prefix}'"),
-            Severity::Warning,
-        );
-    }
-
     pub async fn operate(&mut self, event: &Event) -> anyhow::Result<()> {
-        self.clear_guide();
-
         match event {
             // Move cursor.
             key if self.editor_keybinds.backward.contains(key) => {
```

**File**: `src/guide.rs` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+use arboard::Clipboard;
+use promkit_widgets::{
+    core::{crossterm::terminal, render::SharedRenderer, Widget},
+    status::{self, Severity},
+};
+use tokio::{sync::mpsc, task::JoinHandle};
+
+use crate::prompt::Index;
+
+pub enum GuideMessage {
+    CopiedToClipboard,
+    FailedToCopyToClipboard(String),
+    FailedToSetupClipboard(String),
+    FailedToCopyWhileRenderingInProgress,
+    FailedToSwitchPaneWhileRenderingInProgress,
+    LoadedAllSuggestions(usize),
+    LoadedPartiallySuggestions(usize),
+    NoSuggestionFound(String),
+    JqReturnedNull(String),
+    JqFailed(String),
+}
+
+pub enum GuideAction {
+    Clear,
+    Show(GuideMessage),
+}
+
+pub fn message_to_state(message: GuideMessage) -> status::State {
+    match message {
+        GuideMessage::CopiedToClipboard => {
+            status::State::new("Copied to clipboard", Severity::Success)
+        }
+        GuideMessage::FailedToCopyToClipboard(e) => {
+            status::State::new(format!("Failed to copy to clipboard: {e}"), Severity::Error)
+        }
+        GuideMessage::FailedToSetupClipboard(e) => {
+            status::State::new(format!("Failed to setup clipboard: {e}"), Severity::Error)
+        }
+        GuideMessage::FailedToCopyWhileRenderingInProgress => status::State::new(
+            "Failed to copy while rendering is in progress.",
+            Severity::Warning,
+        ),
+        GuideMessage::FailedToSwitchPaneWhileRenderingInProgress => status::State::new(
+            "Failed to switch pane while rendering is in progress.",
+            Severity::Warning,
+        ),
+        GuideMessage::LoadedAllSuggestions(count) => status::State::new(
+            format!("Loaded all ({count}) suggestions"),
+            Severity::Success,
+        ),
+        GuideMessage::LoadedPartiallySuggestions(count) => status::State::new(
+            format!("Loaded partially ({count}) suggestions"),
+            Severity::Success,
+        ),
+        GuideMessage::NoSuggestionFound(prefix) => status::State::new(
+            format!("No suggestion found for '{prefix}'"),
+            Severity::Warning,
+        ),
+        GuideMessage::JqReturnedNull(input) => status::State::new(
+            format!("jq returned 'null', which may indicate a typo or incorrect filter: `{input}`"),
+            Severity::Warning,
+        ),
+        GuideMessage::JqFailed(e) => {
+            status::State::new(format!("jq failed: `{e}`"), Severity::Error)
+        }
+    }
+}
+
+pub fn copy_to_clipboard_message(content: &str) -> GuideMessage {
+    match Clipboard::new() {
+        Ok(mut clipboard) => match clipboard.set_text(content) {
+            Ok(_) => GuideMessage::CopiedToClipboard,
+            Err(e) => GuideMessage::FailedToCopyToClipboard(e.to_string()),
+        },
+        Err(e) => GuideMessage::FailedToSetupClipboard(e.to_string()),
+    }
+}
+
+pub fn start_guide_task(
+    mut action_rx: mpsc::Receiver<GuideAction>,
+    shared_renderer: SharedRenderer<Index>,
+    no_hint: bool,
+) -> JoinHandle<anyhow::Result<()>> {
+    tokio::spawn(async move {
+        loop {
+            tokio::select! {
+                Some(action) = action_rx.recv() => {
+                    let size = terminal::size()?;
+                    let pane = if no_hint {
+                        Default::default()
+                    } else {
+                        match action {
+                            GuideAction::Clear => status::State::default().create_graphemes(size.0, size.1),
+                            GuideAction::Show(message) => message_to_state(message).create_graphemes(size.0, size.1),
+                        }
+                    };
+                    shared_renderer.update([(Index::Guide, pane)]).render().await?;
+                }
+                else => break,
+            }
+        }
+        Ok(())
+    })
+}
```

**File**: `src/json_viewer.rs` (modified, +83/-27)
```diff
@@ -10,12 +10,15 @@ use promkit_widgets::{
     jsonstream::{self, JsonStream},
     serde_json::{self, Value},
     spinner,
-    status::{self, Severity},
 };
-use tokio::{sync::Mutex, task::JoinHandle};
+use tokio::{
+    sync::{mpsc, Mutex},
+    task::JoinHandle,
+};
 
 use crate::{
     config::{JsonConfig, JsonViewerKeybinds},
+    guide::{self, GuideAction, GuideMessage},
     json,
     prompt::Index,
 };
@@ -91,6 +94,12 @@ pub struct JsonViewer {
 
 pub type SharedJsonViewer = Arc<Mutex<JsonViewer>>;
 
+pub enum ViewerAction {
+    CopyResult,
+    UserEvent(Event),
+    QueryChanged(String),
+}
+
 impl JsonViewer {
     /// Get the formatted content of current JSON stream.
     pub fn formatted_content(&self) -> String {
@@ -142,20 +151,12 @@ impl JsonViewer {
         &mut self,
         area: (u16, u16),
         input: String,
-    ) -> (Option<StyledGraphemes>, Option<StyledGraphemes>) {
+    ) -> (Option<GuideMessage>, Option<StyledGraphemes>) {
         match json::run_jaq(&input, &self.json) {
             Ok(ret) => {
                 let mut guide = None;
                 if ret.iter().all(|val| *val == Value::Null) {
-                    guide = Some(
-                        status::State::new(
-                            format!(
-                                "jq returned 'null', which may indicate a typo or incorrect filter: `{input}`"
-                            ),
-                            Severity::Warning,
-                        )
-                        .create_graphemes(area.0, area.1),
-                    );
+                    guide = Some(GuideMessage::JqReturnedNull(input));
 
                     self.state.stream = JsonStream::new(self.json.iter());
                 } else {
@@ -168,10 +169,7 @@ impl JsonViewer {
                 self.state.stream = JsonStream::new(self.json.iter());
 
                 (
-                    Some(
-                        status::State::new(format!("jq failed: `{e}`"), Severity::Error)
-                            .create_graphemes(area.0, area.1),
-                    ),
+                    Some(GuideMessage::JqFailed(e.to_string())),
                     Some(self.state.create_graphemes(area.0, area.1)),
                 )
             }
@@ -232,20 +230,29 @@ pub async fn render(
     shared_viewer_state: SharedJsonViewer,
     shared_renderer: SharedRenderer<Index>,
     shared_ctx: SharedContext,
+    guide_action_tx: mpsc::Sender<GuideAction>,
     trigger: RenderTrigger,
 ) {
     match trigger {
         RenderTrigger::UserAction(event) => {
             handle_user_action(shared_viewer_state, shared_renderer, shared_ctx, event).await;
         }
         RenderTrigger::QueryChanged { query } => {
-            handle_query_changed(shared_viewer_state, shared_renderer, shared_ctx, query).await;
+            handle_query_changed(
+                shared_viewer_state,
+                shared_renderer,
+                shared_ctx,
+                guide_action_tx,
+                query,
+            )
+            .await;
         }
         RenderTrigger::AreaResized { area, query } => {
             handle_area_resized(
                 shared_viewer_state,
                 shared_renderer,
                 shared_ctx,
+                guide_action_tx,
                 area,
                 query,
             )
@@ -282,6 +289,7 @@ async fn handle_query_changed(
     shared_viewer_state: SharedJsonViewer,
     shared_renderer: SharedRenderer<Index>,
     shared_ctx: SharedContext,
+    guide_action_tx: mpsc::Sender<GuideAction>,
     query: String,
 ) {
     // Abort any ongoing processing task to prevent race conditions
@@ -296,6 +304,7 @@ async fn handle_query_changed(
     let task = spawn_query_update_task(
         shared_viewer_state.clone(),
         shared_ctx.clone(),
+        guide_action_tx,
         shared_renderer,
         query,
     );
@@ -312,6 +321,7 @@ async fn handle_area_resized(
     shared_viewer_state: SharedJsonViewer,
     shared_renderer: SharedRenderer<Index>,
     shared_ctx: SharedContext,
+    guide_action_tx: mpsc::Sender<GuideAction>,
     area: (u16, u16),
     query: String,
 ) {
@@ -331,6 +341,7 @@ async fn handle_area_resized(
     let task = spawn_query_update_task(
         shared_viewer_state.clone(),
         shared_ctx.clone(),
+        guide_action_tx,
         shared_renderer,
         query,
     );
@@ -349,6 +360,7 @@ async fn handle_area_resized(
 fn spawn_query_update_task(
     shared_viewer_state: SharedJsonViewer,
     shared_ctx: SharedContext,
+    guide_action_tx: mpsc::Sender<GuideAction>,
     shared_renderer: SharedRenderer<Index>,
     query: String,
 ) -> JoinHandle<()> {
@@ -374,19 +386,63 @@ fn spawn_query_update_task(
             ctx.state = State::Idle;
         }
 
+        if let Some(message) = maybe_guide {
+            let _ = guide_action_tx.send(GuideAction::Show(message)).await;
+        }
+
         // TODO: error handling
         let _ = shared
```

**File**: `src/main.rs` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ use promkit_widgets::{
 mod editor;
 use editor::Editor;
 mod config;
+mod guide;
 mod json_viewer;
 mod stdout_redirect;
 use stdout_redirect::StdoutRedirect;
```

**File**: `src/prompt.rs` (modified, +54/-124)
```diff
@@ -1,6 +1,5 @@
 use std::{io, sync::Arc, time::Duration};
 
-use arboard::Clipboard;
 use futures::StreamExt;
 use promkit_widgets::{
     core::{
@@ -15,10 +14,8 @@ use promkit_widgets::{
         },
         grapheme::StyledGraphemes,
         render::{Renderer, SharedRenderer},
-        Widget,
     },
     spinner::{self, Spinner, State},
-    status::{self, Severity},
 };
 use tokio::{
     sync::{mpsc, RwLock},
@@ -27,6 +24,7 @@ use tokio::{
 
 use crate::{
     config::{JsonConfig, Keybinds, ReactivityControl},
+    guide::{self, GuideAction, GuideMessage},
     json_viewer::{self, RenderTrigger, SharedContext},
     search::IncrementalSearcher,
     Editor,
@@ -59,21 +57,6 @@ fn spawn_debouncer<T: Send + 'static>(
     })
 }
 
-fn copy_to_clipboard(content: &str) -> status::State {
-    match Clipboard::new() {
-        Ok(mut clipboard) => match clipboard.set_text(content) {
-            Ok(_) => status::State::new("Copied to clipboard", Severity::Success),
-            Err(e) => {
-                status::State::new(format!("Failed to copy to clipboard: {e}"), Severity::Error)
-            }
-        },
-        // arboard fails (in the specific environment like linux?) on Clipboard::new()
-        // suppress the errors (but still show them) not to break the prompt
-        // https://github.com/1Password/arboard/issues/153
-        Err(e) => status::State::new(format!("Failed to setup clipboard: {e}"), Severity::Error),
-    }
-}
-
 fn empty_pane() -> StyledGraphemes {
     StyledGraphemes::default()
 }
@@ -105,12 +88,6 @@ enum SearchAction {
     Leave,
 }
 
-enum JsonViewerAction {
-    CopyResult,
-    UserEvent(Event),
-    QueryChanged(String),
-}
-
 #[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
 pub enum Index {
     Editor = 0,
@@ -183,7 +160,9 @@ pub async fn run(
     let mut focus = Focus::Editor;
     let (editor_action_tx, mut editor_action_rx) = mpsc::channel::<EditorAction>(1);
     let (search_action_tx, mut search_action_rx) = mpsc::channel::<SearchAction>(1);
-    let (json_viewer_action_tx, mut json_viewer_action_rx) = mpsc::channel::<JsonViewerAction>(8);
+    let (json_viewer_action_tx, json_viewer_action_rx) =
+        mpsc::channel::<json_viewer::ViewerAction>(8);
+    let (guide_action_tx, guide_action_rx) = mpsc::channel::<GuideAction>(8);
 
     let text_diff = Arc::new(RwLock::new([editor.text(), editor.text()]));
     let shared_editor = Arc::new(RwLock::new(editor));
@@ -199,10 +178,10 @@ pub async fn run(
 
     let main_task: JoinHandle<anyhow::Result<()>> = {
         let mut stream = EventStream::new();
-        let shared_renderer = shared_renderer.clone();
         let ctx = ctx.clone();
         let editor_keybinds = editor_keybinds.clone();
         let json_viewer_action_tx = json_viewer_action_tx.clone();
+        let guide_action_tx = guide_action_tx.clone();
         tokio::spawn(async move {
             'main: loop {
                 tokio::select! {
@@ -225,6 +204,7 @@ pub async fn run(
                             }
                             other => other,
                         };
+                        guide_action_tx.send(GuideAction::Clear).await?;
 
                         let global_action = if let Event::Resize(width, height) = event {
                             Some(GlobalAction::Resize(width, height))
@@ -252,20 +232,13 @@ pub async fn run(
                                 GlobalAction::CopyResult => {
                                     if ctx.is_idle().await {
                                         json_viewer_action_tx
-                                            .send(JsonViewerAction::CopyResult)
+                                            .send(json_viewer::ViewerAction::CopyResult)
                                             .await?;
-                                    } else if !no_hint {
-                                        let size = terminal::size()?;
-                                        shared_renderer
-                                            .update([(
-                                                Index::Guide,
-                                                status::State::new(
-                                                    "Failed to copy while rendering is in progress.",
-                                                    Severity::Warning,
-                                                )
-                                                .create_graphemes(size.0, size.1),
-                                            )])
-                                            .render()
+                                    } else {
+                                        guide_action_tx
+                                            .send(GuideAction::Show(
+                                                GuideMessage::FailedToCopyWhileRenderingInProgress,
+                                            ))
                                             .await?;
                                   
```

---

### Incident Patch 15: `21fb1382` (2026-03-26)
**Commit Message**: fix: remove provider from args

**File**: `src/main.rs` (modified, +0/-1)
```diff
@@ -206,7 +206,6 @@ async fn main() -> anyhow::Result<()> {
         item,
         config.json,
         config.reactivity_control,
-        provider,
         editor,
         loading_suggestions_task,
         config.no_hint,
```

**File**: `src/prompt.rs` (modified, +2/-3)
```diff
@@ -28,7 +28,7 @@ use tokio::{
 use crate::{
     config::{JsonConfig, Keybinds, ReactivityControl},
     json::Json,
-    Context, ContextMonitor, Editor, Processor, SearchProvider, Visualizer,
+    Context, ContextMonitor, Editor, Processor, Visualizer,
 };
 
 fn spawn_debouncer<T: Send + 'static>(
@@ -91,11 +91,10 @@ pub enum Index {
 }
 
 #[allow(clippy::too_many_arguments)]
-pub async fn run<T: SearchProvider>(
+pub async fn run(
     item: &'static str,
     json_config: JsonConfig,
     reactivity_control: ReactivityControl,
-    _provider: &mut T,
     editor: Editor,
     loading_suggestions_task: JoinHandle<anyhow::Result<()>>,
     no_hint: bool,
```

#### Recent Merged Pull Requests:
- **PR #128** (2026-09-24): docs: fix write-to-stdout file redirection example (@Likio3000)
- **PR #125** (2026-08-20): fix: report a broken config file instead of silently using defaults (@VXNCXNX)
- **PR #112** (2026-04-01): fix: do not replace text when tab with empty candidates (@ynqa)
- **PR #111** (2026-03-30): tidy up (@ynqa)
- **PR #110** (2026-04-01): v0.7.1 (@ynqa)
- **PR #109** (2026-03-25): Bump up promkit-widget version to v0.5.0 (@ynqa)
- **PR #108** (2026-03-17): Write output to stdout (@ynqa)
- **PR #107** (2026-02-26): Use `promkit-widgets` v0.3.0 (@ynqa)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
