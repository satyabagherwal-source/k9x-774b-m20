# Forensic Learning Record (Deep Inspection): ynqa/jnv

> **Canonical Artifact**: `07_PROJECT_LEARNING/ynqa-jnv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ynqa/jnv](https://github.com/ynqa/jnv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:17:37.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ynqa/jnv`
- **Description**: Interactive JSON filter using jq
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 6120 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
    shared_renderer: promkit_widgets::core::render::SharedRendere
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

### Incident Patch 5: `21fb1382` (2026-03-26)
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

---

### Incident Patch 6: `d2bf0981` (2026-03-26)
**Commit Message**: chore: Box::leak => Vec

**File**: `src/json.rs` (modified, +7/-8)
```diff
@@ -20,20 +20,21 @@ use crate::{
 // #[derive(Clone)]
 pub struct Json {
     state: jsonstream::State,
-    json: &'static [serde_json::Value],
+    json: Vec<serde_json::Value>,
     keybinds: JsonViewerKeybinds,
 }
 
 impl Json {
     pub fn new(
         formatter: JsonStreamConfig,
-        input_stream: &'static [serde_json::Value],
+        input_stream: Vec<serde_json::Value>,
         keybinds: JsonViewerKeybinds,
     ) -> anyhow::Result<Self> {
+        let stream = JsonStream::new(input_stream.iter());
         Ok(Self {
             json: input_stream,
             state: jsonstream::State {
-                stream: JsonStream::new(input_stream.iter()),
+                stream,
                 config: formatter,
             },
             keybinds,
@@ -100,7 +101,7 @@ impl Visualizer for Json {
         area: (u16, u16),
         input: String,
     ) -> (Option<StyledGraphemes>, Option<StyledGraphemes>) {
-        match run_jaq(&input, self.json) {
+        match run_jaq(&input, &self.json) {
             Ok(ret) => {
                 let mut guide = None;
                 if ret.iter().all(|val| *val == Value::Null) {
@@ -138,7 +139,7 @@ impl Visualizer for Json {
 
 fn run_jaq(
     query: &str,
-    json_stream: &'static [serde_json::Value],
+    json_stream: &[serde_json::Value],
 ) -> anyhow::Result<Vec<serde_json::Value>> {
     let arena = Arena::default();
     let loader = Loader::new(jaq_std::defs().chain(jaq_json::defs()));
@@ -204,9 +205,7 @@ impl ViewProvider for JsonStreamProvider {
         item: &'static str,
         keybinds: JsonViewerKeybinds,
     ) -> anyhow::Result<Json> {
-        let stream = self.deserialize_json(item)?;
-        let static_stream = Box::leak(stream.into_boxed_slice());
-        Json::new(std::mem::take(&mut self.formatter), static_stream, keybinds)
+        Json::new(std::mem::take(&mut self.formatter), self.deserialize_json(item)?, keybinds)
     }
 }
 
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
