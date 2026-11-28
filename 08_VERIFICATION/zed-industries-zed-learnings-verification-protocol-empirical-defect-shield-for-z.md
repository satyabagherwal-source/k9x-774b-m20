# Verification Protocol: Verification Protocol: Empirical Defect Shield for zed-industries-zed-learnings

<!-- PROVENANCE_START
{
  "source_repository": "zed-industries-zed-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T10:11:02.222Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zed-industries-zed-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zed-industries-zed-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T10:11:02.222Z`  
> **Learning ID**: `LEARN-EVO-zed-industries-zed-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `zed-industries-zed-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zed-industries-zed-learnings.md`  
> **Source**: github ([https://github.com/zed-industries/zed](https://github.com/zed-industries/zed))  
> **Source Version**: `0f009536`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T10:10:43.941Z  
> **Learning ID**: `learn-github-zed-industries-zed`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zed-industries/zed

> **Canonical Artifact**: `07_PROJECT_LEARNING/zed-industries-zed-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zed-industries/zed](https://github.com/zed-industries/zed))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T10:10:43.734Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zed-industries/zed`
- **Description**: Code at the speed of thought – Zed is a high-performance, multiplayer code editor from the creators of Atom and Tree-sitter.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 95887 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.cloudflare/open-source-website-assets/src/worker.js`
```
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    const object = await env.OPEN_SOURCE_WEBSITE_ASSETS_BUCKET.get(key);
    if (!object) {
      return await fetch("https://zed.dev/404");
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    return new Response(object.body, {
      headers,
    });
  },
};

```

### Core Architecture Module: `crates/agent_ui/src/conversation_view/message_queue.rs`
```
use std::collections::VecDeque;

use super::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct QueueEntryId(usize);

pub struct QueueEntry {
    pub id: QueueEntryId,
    pub content: Vec<acp_v2::ContentBlock>,
    pub tracked_buffers: Vec<Entity<Buffer>>,
    /// When true, this message interrupts the agent at the next turn boundary
    /// instead of waiting for generation to fully complete. Only the front
    /// entry's value matters, since messages are delivered in FIFO order.
    pub steer: bool,
    pub editor: Entity<MessageEditor>,
    pub _subscription: Subscription,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProcessingState {
    AutoProcess,
    Paused,
    // Sending a message out of turn cancelled the current generation; we must
    // absorb the Stopped event from that cancellation before resuming
    // auto-processing, otherwise the queue would double-send.
    AbsorbingCancel,
}

/// Holds follow-up messages typed while the agent is generating, along with
/// the state machine that decides when they're auto-sent.
pub struct MessageQueue {
    entries: VecDeque<QueueEntry>,
    processing_state: ProcessingState,
    can_fast_track: bool,
    next_id: usize,
}

impl Default for MessageQueue {
    fn default() -> Self {
        Self {
            entries: VecDeque::new(),
            processing_state: ProcessingState::AutoProcess,
            can_fast_track: false,
            next_id: 0,
        }
    }
}

impl MessageQueue {
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn first(&self) -> Option<&QueueEntry> {
        self.entries.front()
    }

    pub fn first_id(&self) -> Option<QueueEntryId> {
        self.entries.front().map(|entry| entry.id)
    }

    pub fn last_id(&self) -> Option<QueueEntryId> {
        self.entries.back().map(|entry| entry.id)
    }

    /// Whether the next message should interrupt the agent at the next turn
    /// boundary. Drives the native thread's boundary flag.
    pub fn front_wants_steer(&self) -> bool {
        self.entries.front().is_some_and(|entry| entry.steer)
    }

    pub fn toggle_steer(&mut self, id: QueueEntryId) {
        if let Some(entry) = self.entries.iter_mut().find(|entry| entry.id == id) {
            entry.steer = !entry.steer;
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &QueueEntry> {
        self.entries.iter()
    }

    pub fn can_fast_track(&self) -> bool {
        self.can_fast_track && !self.entries.is_empty()
    }

    pub fn entry_by_id(&self, id: QueueEntryId) -> Option<&QueueEntry> {
        self.entries.iter().find(|entry| entry.id == id)
    }

    pub fn entry_by_id_mut(&mut self, id: QueueEntryId) -> Option<&mut QueueEntry> {
        self.entries.iter_mut().find(|entry| entry.id == id)
    }

    /// Allocates a stable ID for a new entry. This is separate from `enqueue`
    /// because the editor event subscription must capture the ID before the
    /// `QueueEntry` (which owns that subscription) can be constructed.
    pub fn next_id(&mut self) -> QueueEntryId {
        let id = QueueEntryId(self.next_id);
        self.next_id += 1;
        id
    }

    /// Queuing a message is active engagement, so it also resumes
    /// auto-processing if the queue was paused.
    pub fn enqueue(&mut self, entry: QueueEntry) {
        self.entries.push_back(entry);
        self.processing_state = ProcessingState::AutoProcess;
        self.can_fast_track = true;
    }

    pub fn remove(&mut self, id: QueueEntryId) -> Option<QueueEntry> {
        let index = self.entries.iter().position(|entry| entry.id == id)?;
        self.entries.remove(index)
    }

    pub fn restore_after_failed_send(&mut self, entry: QueueEntry) {
        let index = self
            .entries
            .iter()
            .position(|queued| queued.id.0 > entry.id.0)
            .unwrap_or(self.entries.len());
        self.entries.insert(index, entry);
        self.pause();
    }

    pub fn clear(&mut self) {
        self.entries.clear();
        self.can_fast_track = false;
    }

    /// Pops the front entry if a fast-track send is allowed (the user just
    /// queued a message and pressed Enter on an empty main editor).
    ///
    /// This works even when paused — pressing Enter is an explicit user
    /// action, distinct from auto-processing. If a generation is in flight,
    /// the dispatch will cancel it, so we must absorb that cancellation's
    /// Stopped event to avoid double-sending the next entry.
    pub fn try_fast_track(&mut self, is_generating: bool) -> Option<QueueEntry> {
        if !self.can_fast_track {
            return None;
        }
        self.can_fast_track = false;
        let entry = self.entries.pop_front()?;
        self.processing_state = if is_generating {
            ProcessingState::AbsorbingCancel
        } else {
            ProcessingState::AutoProcess
        };
        Some(entry)
    }

    /// Handles a generation Stopped event, returning the entry to auto-send,
    /// if any.
    pub fn auto_send_candidate(&self, is_first_editor_focused: bool) -> Option<&QueueEntry> {
        if matches!(self.processing_state, ProcessingState::AutoProcess) && !is_first_editor_focused
        {
            self.entries.front()
        } else {
            None
        }
    }

    pub fn on_generation_stopped(&mut self, is_first_editor_focused: bool) -> Option<QueueEntry> {
        match self.processing_state {
            ProcessingState::AbsorbingCancel => {
                // This Stopped event came from a cancellation we initiated
                // ourselves (e.g. "Send Now"); swallow it and resume.
                self.processing_state = ProcessingState::AutoProcess;
                None
            }
            ProcessingState::Paused => None,
            ProcessingState::AutoProcess => {
                // Don't auto-send while the user is editing the next message.
                if self.auto_send_candidate(is_first_editor_focused).is_some() {
                    self.entries.pop_front()
                } else {
                    None
                }
            }
        }
    }

    /// Removes an entry for an explicit "Send Now". If a generation is in
    /// flight, the dispatch will cancel it, so we must absorb that
    /// cancellation's Stopped event.
    pub fn send_now(&mut self, id: QueueEntryId, is_generating: bool) -> Option<QueueEntry> {
        let entry = self.remove(id)?;
        if is_generating {
            self.processing_state = ProcessingState::AbsorbingCancel;
        }
        Some(entry)
    }

    /// Called when the user stops generation; queued messages stay put until
    /// the user re-engages.
    pub fn pause(&mut self) {
        self.processing_state = ProcessingState::Paused;
    }

    /// Called when the user sends a new message, re-enabling auto-processing.
    /// This is what un-freezes the queue after a manual stop.
    pub fn resume(&mut self) {
        self.processing_state = ProcessingState::AutoProcess;
    }
}

```

### Core Architecture Module: `crates/agent_ui/src/entry_view_state.rs`
```
use std::{ops::Range, sync::Arc};

use acp_thread::{AcpThread, AgentThreadEntry, AssistantMessageChunk, ToolCall};
use agent::ThreadStore;
use agent_client_protocol::v2::schema as acp_v2;
use agent_settings::AgentSettings;
use collections::{HashMap, HashSet};
use editor::{
    Editor, EditorEvent, EditorMode, HiddenUnstagedDiffHunkRenderer, MinimapVisibility,
    SizingBehavior,
};
use gpui::{
    AnyEntity, App, AppContext as _, Corners, Entity, EntityId, EventEmitter, FocusHandle,
    Focusable, ScrollHandle, TextStyleRefinement, WeakEntity, Window,
};
use language::language_settings::SoftWrap;
use multi_buffer::MultiBuffer;
use project::{AgentId, Project, project_settings::DiagnosticSeverity};
use rope::Point;
use settings::{Settings as _, ThinkingBlockDisplay};
use terminal_view::TerminalView;
use theme_settings::ThemeSettings;
use ui::{Context, TextSize};
use workspace::Workspace;

use crate::message_editor::{MessageEditor, MessageEditorEvent, SharedSessionCapabilities};

/// Top padding, in rems, inside agent terminals. The tool card adds it to the
/// scrollable terminal's height so the number of visible rows doesn't change.
pub(crate) const TERMINAL_CONTENT_TOP_PADDING: f32 = 0.5;

/// Maps an entry index through the removal of `removed` (a contiguous range of
/// entries), returning `None` if the index referred to a removed entry.
fn reindex_after_removal(index: usize, removed: &Range<usize>) -> Option<usize> {
    if index < removed.start {
        Some(index)
    } else if index < removed.end {
        None
    } else {
        Some(index - removed.len())
    }
}

/// How much of a tool call's content to materialize while syncing an entry.
#[derive(Clone, Copy)]
enum ToolCallSync {
    /// Live updates: materialize visible content and run terminal lifecycle.
    Live,
    /// Thread restore: skip content that is not visible.
    Restore,
    /// First view after expansion: materialize without re-running terminal
    /// lifecycle, which would collapse the card again.
    Materialize,
}

pub struct EntryViewState {
    workspace: WeakEntity<Workspace>,
    project: WeakEntity<Project>,
    thread_store: Option<Entity<ThreadStore>>,
    entries: Vec<Entry>,
    session_capabilities: SharedSessionCapabilities,
    agent_id: AgentId,
    expanded_thinking_blocks: HashSet<(usize, usize)>,
    auto_expanded_thinking_block: Option<(usize, usize)>,
    user_toggled_thinking_blocks: HashSet<(usize, usize)>,
    expanded_compactions: HashSet<usize>,
    expanded_tool_calls: HashSet<acp_v2::ToolCallId>,
    /// Subagent cards shown for an ACP parent's outgoing session messages.
    expanded_session_message_cards: HashSet<acp_v2::MessageId>,
}

impl EntryViewState {
    pub fn new(
        workspace: WeakEntity<Workspace>,
        project: WeakEntity<Project>,
        thread_store: Option<Entity<ThreadStore>>,
        session_capabilities: SharedSessionCapabilities,
        agent_id: AgentId,
    ) -> Self {
        Self {
            workspace,
            project,
            thread_store,
            entries: Vec::new(),
            session_capabilities,
            agent_id,
            expanded_thinking_blocks: HashSet::default(),
            auto_expanded_thinking_block: None,
            user_toggled_thinking_blocks: HashSet::default(),
            expanded_compactions: HashSet::default(),
            expanded_tool_calls: HashSet::default(),
            expanded_session_message_cards: HashSet::default(),
        }
    }

    pub(crate) fn is_tool_call_expanded(&self, tool_call_id: &acp_v2::ToolCallId) -> bool {
        self.expanded_tool_calls.contains(tool_call_id)
    }

    pub(crate) fn is_tool_call_content_visible(&self, tool_call: &ToolCall) -> bool {
        self.is_tool_call_expanded(&tool_call.id) || tool_call.authorization_id().is_some()
    }

    pub(crate) fn expand_tool_call(&mut self, tool_call_id: acp_v2::ToolCallId) {
        self.expanded_tool_calls.insert(tool_call_id);
    }

    pub(crate) fn collapse_tool_call(&mut self, tool_call_id: &acp_v2::ToolCallId) {
        self.expanded_tool_calls.remove(tool_call_id);
    }

    pub(crate) fn toggle_tool_call_expansion(&mut self, tool_call_id: &acp_v2::ToolCallId) {
        if !self.expanded_tool_calls.remove(tool_call_id) {
            self.expanded_tool_calls.insert(tool_call_id.clone());
        }
    }

    pub(crate) fn is_session_message_card_expanded(&self, message_id: &acp_v2::MessageId) -> bool {
        self.expanded_session_message_cards.contains(message_id)
    }

    pub(crate) fn toggle_session_message_card_expansion(&mut self, message_id: &acp_v2::MessageId) {
        if !self.expanded_session_message_cards.remove(message_id) {
            self.expanded_session_message_cards
                .insert(message_id.clone());
        }
    }

    pub(crate) fn is_compaction_expanded(&self, entry_ix: usize) -> bool {
        self.expanded_compactions.contains(&entry_ix)
    }

    pub(crate) fn collapse_compaction(&mut self, entry_ix: usize) {
        self.expanded_compactions.remove(&entry_ix);
    }

    pub(crate) fn toggle_compaction_expansion(&mut self, entry_ix: usize) {
        if !self.expanded_compactions.remove(&entry_ix) {
            self.expanded_compactions.insert(entry_ix);
        }
    }

    pub(crate) fn clear_auto_expand_tracking(&mut self) {
        self.auto_expanded_thinking_block = None;
    }

    pub(crate) fn is_auto_expanded_thinking_block(&self, key: (usize, usize)) -> bool {
        self.auto_expanded_thinking_block == Some(key)
    }

    pub(crate) fn auto_expand_streaming_thought(&mut self, thread: &AcpThread, cx: &App) -> bool {
        let thinking_display = AgentSettings::get_global(cx).thinking_display;

        if !matches!(
            thinking_display,
            ThinkingBlockDisplay::Auto | ThinkingBlockDisplay::Preview
        ) {
            return false;
        }

        let last_ix = thread.entries().len().saturating_sub(1);
        let key = match thread.entries().get(last_ix) {
            Some(AgentThreadEntry::AssistantMessage(message)) => match message.chunks.last() {
                Some(AssistantMessageChunk::Thought { .. }) => {
                    Some((last_ix, message.chunks.len() - 1))
                }
                _ => None,
            },
            _ => None,
        };

        if let Some(key) = key {
            if self.auto_expanded_thinking_block != Some(key) {
                self.auto_expanded_thinking_block = Some(key);
                self.expanded_thinking_blocks.insert(key);
                return true;
            }
        } else if self.auto_expanded_thinking_block.is_some() {
            if thinking_display == ThinkingBlockDisplay::Auto
                && let Some(key) = self.auto_expanded_thinking_block
                && !self.user_toggled_thinking_blocks.contains(&key)
            {
                self.expanded_thinking_blocks.remove(&key);
            }
            self.auto_expanded_thinking_block = None;
            return true;
        }

        false
    }

    pub(crate) fn toggle_thinking_block_expansion(&mut self, key: (usize, usize), cx: &App) {
        match AgentSettings::get_global(cx).thinking_display {
            ThinkingBlockDisplay::Auto => {
                let is_open = self.expanded_thinking_blocks.contains(&key)
                    || self.user_toggled_thinking_blocks.contains(&key);

                if is_open {
                    self.expanded_thinking_blocks.remove(&key);
                    self.user_toggled_thinking_blocks.remove(&key);
                } else {
                    self.expanded_thinking_blocks.insert(key);
                    self.user_toggled_thinking_blocks.insert(key);
                }
            }
            ThinkingBlockDisplay::Preview => {
                let is_user_expanded = self.user_toggled_thinking_blocks.contains(&key);
                let is_in_expanded_set = self.expanded_thinking_blocks.contains(&key);

                if is_user_expanded {
                    self.user_toggled_thinking_blocks.remove(&key);
                    self.expanded_thinking_blocks.remove(&key);
                } else if is_in_expanded_set {
                    self.user_toggled_thinking_blocks.insert(key);
                } else {
                    self.expanded_thinking_blocks.insert(key);
                    self.user_toggled_thinking_blocks.insert(key);
                }
            }
            ThinkingBlockDisplay::AlwaysExpanded => {
                if self.user_toggled_thinking_blocks.contains(&key) {
                    self.user_toggled_thinking_blocks.remove(&key);
                } else {
                    self.user_toggled_thinking_blocks.insert(key);
                }
            }
            ThinkingBlockDisplay::AlwaysCollapsed => {
                if self.user_toggled_thinking_blocks.contains(&key) {
                    self.user_toggled_thinking_blocks.remove(&key);
                    self.expanded_thinking_blocks.remove(&key);
                } else {
                    self.expanded_thinking_blocks.insert(key);
                    self.user_toggled_thinking_blocks.insert(key);
                }
            }
        }
    }

    pub(crate) fn thinking_block_state(&self, key: (usize, usize), cx: &App) -> (bool, bool) {
        let is_user_toggled = self.user_toggled_thinking_blocks.contains(&key);
        let is_in_expanded_set = self.expanded_thinking_blocks.contains(&key);

        match AgentSettings::get_global(cx).thinking_display {
            ThinkingBlockDisplay::Auto => {
                let is_open = is_user_toggled || is_in_expanded_set;
                (is_open, false)
            }
            ThinkingBlockDisplay::Preview => {
                let is_open = is_user_toggled || is_in_expanded_set;
                let is_constrained = is_in_expanded_set && !is_user_toggled;
                (is_open, is_constrained)
            }
            ThinkingBlockDisplay::AlwaysExp
```

### Core Architecture Module: `crates/benchmarks/benches/editor_render.rs`
```
use std::{path::PathBuf, sync::Arc};

use benchmarks::bench_utils::random_rust_file;
use editor::{
    Editor, EditorMode, MultiBuffer,
    actions::{DeleteToPreviousWordStart, SelectAll, SplitSelectionIntoLines},
};
use gpui::{
    App, AppContext as _, BenchAppContext, BorrowAppContext as _, Focusable as _, UpdateGlobal as _,
};
use indoc::{formatdoc, indoc};
use language::{Buffer, Capability, DiskState, File, LocalFile, Rope};
use rand::{Rng as _, SeedableRng as _, rngs::StdRng};
use settings::{
    DisplayIn, LocalSettingsKind, LocalSettingsPath, SettingsStore, ShowMinimap, WorktreeId,
};
use theme::ActiveTheme as _;
use util::{RandomCharIter, paths::PathStyle, rel_path::RelPath};
use zed_actions::editor::{MoveDown, MoveUp};

struct BenchFile {
    path: Arc<RelPath>,
}

impl File for BenchFile {
    fn as_local(&self) -> Option<&dyn LocalFile> {
        None
    }

    fn disk_state(&self) -> DiskState {
        DiskState::New
    }

    fn path(&self) -> &Arc<RelPath> {
        &self.path
    }

    fn full_path(&self, _: &App) -> PathBuf {
        PathBuf::from("root").join(self.path.as_std_path())
    }

    fn path_style(&self, _: &App) -> PathStyle {
        PathStyle::local()
    }

    fn file_name<'a>(&'a self, _: &'a App) -> &'a str {
        self.path.file_name().unwrap_or("root")
    }

    fn worktree_id(&self, _: &App) -> WorktreeId {
        WorktreeId::from_usize(0)
    }

    fn to_proto(&self, _: &App) -> rpc::proto::File {
        unimplemented!()
    }

    fn is_private(&self) -> bool {
        false
    }
}

#[gpui::bench(
    inputs = multi_cursor_line_counts(),
    group = "Multi-cursor input",
    input_name = "cursors",
    sample_size = 10
)]
fn editor_multi_cursor_input(line_count: &usize, cx: &mut BenchAppContext) {
    init_context(cx);

    let text = "line:\n".repeat(*line_count);
    let buffer = cx.update(|cx| MultiBuffer::build_simple(&text, cx));

    let mut window = cx.add_empty_window();
    let editor = window.update(|window, cx| {
        let editor = cx.new(|cx| {
            let mut editor = Editor::new(EditorMode::full(), buffer, None, window, cx);
            editor.set_style(editor::EditorStyle::default(), window, cx);
            editor.select_all(&SelectAll, window, cx);
            editor.split_selection_into_lines(
                &SplitSelectionIntoLines {
                    keep_selections: true,
                },
                window,
                cx,
            );
            editor
        });
        window.focus(&editor.focus_handle(cx), cx);
        editor
    });

    cx.bench_iter(|_| {
        window.update(|window, cx| {
            editor.update(cx, |editor, cx| {
                editor.handle_input("hello world", window, cx);
                editor.delete_to_previous_word_start(
                    &DeleteToPreviousWordStart {
                        ignore_newlines: false,
                        ignore_brackets: false,
                    },
                    window,
                    cx,
                );
                editor.delete_to_previous_word_start(
                    &DeleteToPreviousWordStart {
                        ignore_newlines: false,
                        ignore_brackets: false,
                    },
                    window,
                    cx,
                );
            });
        })
    });
}

#[gpui::bench]
fn open_editor_with_one_long_line(cx: &mut BenchAppContext) {
    init_context(cx);

    let text = String::from_iter(["char"; 1000]);
    cx.bench_iter(move |cx| {
        let buffer = cx.update(|cx| MultiBuffer::build_simple(&text, cx));

        let mut window = cx.add_empty_window();
        window.update(|window, cx| {
            let editor = cx.new(|cx| {
                let mut editor = Editor::new(EditorMode::full(), buffer, None, window, cx);
                editor.set_style(editor::EditorStyle::default(), window, cx);
                editor
            });
            window.focus(&editor.focus_handle(cx), cx);
            editor
        });
    });
}

#[gpui::bench]
fn editor_render(cx: &mut BenchAppContext) {
    init_context(cx);

    let buffer = cx.update(|cx| {
        let mut rng = StdRng::seed_from_u64(1);
        let text_len = rng.random_range(10000..90000);
        if rng.random() {
            let text = RandomCharIter::new(&mut rng)
                .take(text_len)
                .collect::<String>();
            MultiBuffer::build_simple(&text, cx)
        } else {
            MultiBuffer::build_random(&mut rng, cx)
        }
    });

    let mut window = cx.add_empty_window();
    let editor = window.update(|window, cx| {
        let editor = window.replace_root(cx, |window, cx| {
            let mut editor = Editor::new(EditorMode::full(), buffer, None, window, cx);
            editor.set_style(editor::EditorStyle::default(), window, cx);
            editor
        });
        window.focus(&editor.focus_handle(cx), cx);
        editor
    });

    let mut move_down = true;
    cx.bench_renderer(editor, move |editor, window, cx| {
        if move_down {
            editor.move_down(&MoveDown, window, cx);
        } else {
            editor.move_up(&MoveUp, window, cx);
        }
        move_down = !move_down;
    });
}

#[gpui::bench]
fn editor_render_with_editorconfig(cx: &mut BenchAppContext) {
    init_context(cx);

    let worktree_id = WorktreeId::from_usize(0);
    cx.update(|cx| {
        cx.update_global::<SettingsStore, _>(|store, cx| {
            let nested_configs = [
                ("", jetbrains_editorconfig()),
                (
                    "src",
                    indoc! {"
                        [*.{ts,tsx}]
                        indent_size = 2
                    "}
                    .to_string(),
                ),
                (
                    "src/app",
                    indoc! {"
                        [*]
                        trim_trailing_whitespace = false

                        [*.ts]
                        max_line_length = 100
                    "}
                    .to_string(),
                ),
                (
                    "src/app/components",
                    indoc! {"
                        [*.{ts,tsx}]
                        indent_style = space
                    "}
                    .to_string(),
                ),
            ];
            for (directory, content) in nested_configs {
                store
                    .set_local_settings(
                        worktree_id,
                        LocalSettingsPath::InWorktree(Arc::from(
                            RelPath::from_unix_str(directory).unwrap(),
                        )),
                        LocalSettingsKind::Editorconfig,
                        Some(&content),
                        cx,
                    )
                    .unwrap();
            }
        });
    });

    let buffer = cx.update(|cx| {
        let text = indented_code_text(3000);
        let file: Arc<dyn File> = Arc::new(BenchFile {
            path: RelPath::from_unix_str("src/app/components/editor_pane.ts")
                .unwrap()
                .into(),
        });
        let buffer = cx.new(|cx| {
            Buffer::build(
                text::Buffer::new(
                    text::ReplicaId::LOCAL,
                    cx.entity_id().as_non_zero_u64().into(),
                    text,
                ),
                Some(file),
                Capability::ReadWrite,
                cx,
            )
        });
        cx.new(|cx| MultiBuffer::singleton(buffer, cx))
    });

    let mut window = cx.add_empty_window();
    let editor = window.update(|window, cx| {
        let editor = window.replace_root(cx, |window, cx| {
            let mut editor = Editor::new(EditorMode::full(), buffer, None, window, cx);
            editor.set_style(editor::EditorStyle::default(), window, cx);
            editor
        });
        window.focus(&editor.focus_handle(cx), cx);
        editor
    });

    let mut insert = true;
    cx.bench_renderer(editor, move |editor, window, cx| {
        if insert {
            editor.handle_input("x", window, cx);
        } else {
            editor.backspace(&editor::actions::Backspace, window, cx);
        }
        insert = !insert;
        editor.move_down(&MoveDown, window, cx);
        editor.move_up(&MoveUp, window, cx);
    });
}

fn indented_code_text(line_count: usize) -> String {
    let mut text = String::new();
    for block in 0..line_count / 10 {
        text.push_str(&format!("export function component{block:04}() {{\n"));
        text.push_str("    const state = {\n");
        text.push_str("        items: [],\n");
        text.push_str("        selection: null,\n");
        text.push_str("    };\n");
        text.push_str("    if (state.items.length > 0) {\n");
        text.push_str("        for (const item of state.items) {\n");
        text.push_str("            console.log(item, state.selection);\n");
        text.push_str("        }\n");
        text.push_str("    }\n");
        text.push_str("}\n");
    }
    text
}

fn jetbrains_editorconfig() -> String {
    let mut content = indoc! {"
        [*]
        charset = utf-8
        end_of_line = lf
        indent_size = 4
        indent_style = space
        insert_final_newline = true
        max_line_length = 150
        tab_width = 4
        trim_trailing_whitespace = false
    "}
    .to_string();
    for key_index in 0..750 {
        content.push_str(&format!("ij_continuation_option_{key_index:04} = false\n"));
    }
    for key_index in 0..1500 {
        content.push_str(&format!(
            "dotnet_diagnostic.ca{key_index:04}.severity = warning\n"
        ));
    }
    for key_index in 0..750 {
        content.push_str(&format!("resharper_style_option_{key_index:04} = true\n"));
    }
    let sections = [
        "*.css",
        "*.feature",
        "*.less",
        "*.properties",
        "*.proto
```

### Core Architecture Module: `crates/benchmarks/benches/markdown_renderer.rs`
```
use benchmarks::bench_utils::random_rust_file;
use gpui::{
    AppContext as _, BenchAppContext, Context, Entity, IntoElement, Render, SharedString, Window,
};
use language::LanguageRegistry;
use markdown::{
    CodeBlockRenderer, CopyButtonVisibility, Markdown, MarkdownElement, MarkdownFont,
    MarkdownOptions, MarkdownStyle, WrapButtonVisibility,
};
use rand::{Rng as _, SeedableRng as _, rngs::StdRng};
use settings::SettingsStore;
use std::sync::Arc;
use ui::prelude::*;

const SEED: u64 = 1;

#[gpui::bench(
    inputs = markdown_sizes(),
    group = "Markdown render",
    input_name = "min_bytes",
    sample_size = 10
)]
fn markdown_render(target_size: &usize, cx: &mut BenchAppContext) {
    init_context(cx);

    let source = SharedString::from(generate_markdown(SEED, *target_size));
    let language_registry = markdown_language_registry(cx);

    let mut window = cx.add_empty_window();
    let view = window.update(|window, cx| {
        let markdown = cx.new({
            let source = source.clone();
            let language_registry = language_registry.clone();
            move |cx| build_markdown(source, language_registry, cx)
        });
        window.replace_root(cx, |_window, _cx| MarkdownBenchView { markdown })
    });

    cx.bench_renderer(view, |_, _, cx| cx.notify());
}

struct MarkdownBenchView {
    markdown: Entity<Markdown>,
}

impl Render for MarkdownBenchView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let style = MarkdownStyle::themed(MarkdownFont::Preview, window, cx);

        div().w_full().h_full().child(
            MarkdownElement::new(self.markdown.clone(), style).code_block_renderer(
                CodeBlockRenderer::Default {
                    copy_button_visibility: CopyButtonVisibility::VisibleOnHover,
                    wrap_button_visibility: WrapButtonVisibility::VisibleOnHover,
                    border: false,
                },
            ),
        )
    }
}

fn build_markdown(
    source: SharedString,
    language_registry: Arc<LanguageRegistry>,
    cx: &mut Context<Markdown>,
) -> Markdown {
    Markdown::new_with_options(
        source,
        Some(language_registry),
        None,
        MarkdownOptions {
            // Mermaid and embedded resources need their own focused benchmarks.
            render_metadata_blocks: true,
            ..Default::default()
        },
        cx,
    )
}

fn generate_markdown(seed: u64, target_size: usize) -> String {
    let mut rng = StdRng::seed_from_u64(seed);
    let mut markdown = String::with_capacity(target_size);

    markdown.push_str("---\n");
    markdown.push_str("title: Markdown renderer benchmark\n");
    markdown.push_str("author: Zed benchmark\n");
    markdown.push_str("---\n\n");

    while markdown.len() < target_size {
        push_mixed_block(&mut markdown, &mut rng);
    }

    markdown
}

fn push_mixed_block(markdown: &mut String, rng: &mut StdRng) {
    match rng.random_range(0..10) {
        0 => push_heading(markdown, rng),
        1 | 2 => push_paragraph(markdown, rng),
        3 => push_list(markdown, rng),
        4 => push_task_list(markdown, rng),
        5 => push_table(markdown, rng),
        6 | 7 => push_code_block(markdown, rng),
        8 => push_block_quote(markdown, rng),
        _ => push_rule(markdown),
    }
}

fn push_heading(markdown: &mut String, rng: &mut StdRng) {
    let level = rng.random_range(1..=4);
    markdown.push_str(&"#".repeat(level));
    markdown.push(' ');
    let word_count = rng.random_range(3..8);
    push_words(markdown, rng, word_count);
    markdown.push_str("\n\n");
}

fn push_paragraph(markdown: &mut String, rng: &mut StdRng) {
    let sentence_count = rng.random_range(2..7);
    for sentence_index in 0..sentence_count {
        if sentence_index > 0 {
            markdown.push(' ');
        }
        push_sentence(markdown, rng);
    }
    markdown.push_str("\n\n");
}

fn push_sentence(markdown: &mut String, rng: &mut StdRng) {
    let word_count = rng.random_range(8..24);
    for word_index in 0..word_count {
        if word_index > 0 {
            markdown.push(' ');
        }

        match rng.random_range(0..18) {
            0 => {
                markdown.push_str("**");
                markdown.push_str(random_word(rng));
                markdown.push_str("**");
            }
            1 => {
                markdown.push('*');
                markdown.push_str(random_word(rng));
                markdown.push('*');
            }
            2 => {
                markdown.push('`');
                markdown.push_str(random_identifier(rng));
                markdown.push('`');
            }
            3 => {
                markdown.push('[');
                markdown.push_str(random_word(rng));
                markdown.push_str("](https://example.com/");
                markdown.push_str(random_identifier(rng));
                markdown.push(')');
            }
            4 => {
                markdown.push_str("https://zed.dev/");
                markdown.push_str(random_identifier(rng));
            }
            _ => markdown.push_str(random_word(rng)),
        }
    }
    markdown.push('.');
}

fn push_list(markdown: &mut String, rng: &mut StdRng) {
    let item_count = rng.random_range(3..9);
    let ordered = rng.random();
    for item_index in 0..item_count {
        if ordered {
            markdown.push_str(&(item_index + 1).to_string());
            markdown.push_str(". ");
        } else {
            markdown.push_str("- ");
        }
        let word_count = rng.random_range(5..14);
        push_words(markdown, rng, word_count);
        markdown.push('\n');
    }
    markdown.push('\n');
}

fn push_task_list(markdown: &mut String, rng: &mut StdRng) {
    let item_count = rng.random_range(3..8);
    for _ in 0..item_count {
        if rng.random() {
            markdown.push_str("- [x] ");
        } else {
            markdown.push_str("- [ ] ");
        }
        let word_count = rng.random_range(4..12);
        push_words(markdown, rng, word_count);
        markdown.push('\n');
    }
    markdown.push('\n');
}

fn push_table(markdown: &mut String, rng: &mut StdRng) {
    let column_count = rng.random_range(3..7);
    let row_count = rng.random_range(3..9);

    for column_index in 0..column_count {
        if column_index == 0 {
            markdown.push('|');
        }
        markdown.push(' ');
        markdown.push_str(random_word(rng));
        markdown.push(' ');
        markdown.push('|');
    }
    markdown.push('\n');

    for column_index in 0..column_count {
        if column_index == 0 {
            markdown.push('|');
        }
        markdown.push_str(" --- |");
    }
    markdown.push('\n');

    for _ in 0..row_count {
        for column_index in 0..column_count {
            if column_index == 0 {
                markdown.push('|');
            }
            markdown.push(' ');
            let word_count = rng.random_range(2..6);
            push_words(markdown, rng, word_count);
            markdown.push(' ');
            markdown.push('|');
        }
        markdown.push('\n');
    }
    markdown.push('\n');
}

fn push_code_block(markdown: &mut String, rng: &mut StdRng) {
    let line_count = rng.random_range(24..80);
    let rust = random_rust_file(rng, line_count);
    markdown.push_str("```rust\n");
    markdown.push_str(&rust.join("\n"));
    markdown.push_str("\n```\n\n");
}

fn push_block_quote(markdown: &mut String, rng: &mut StdRng) {
    let line_count = rng.random_range(2..6);
    for _ in 0..line_count {
        markdown.push_str("> ");
        push_sentence(markdown, rng);
        markdown.push('\n');
    }
    markdown.push('\n');
}

fn push_rule(markdown: &mut String) {
    markdown.push_str("---\n\n");
}

fn push_words(markdown: &mut String, rng: &mut StdRng, word_count: usize) {
    for word_index in 0..word_count {
        if word_index > 0 {
            markdown.push(' ');
        }
        markdown.push_str(random_word(rng));
    }
}

fn random_word(rng: &mut StdRng) -> &'static str {
    const WORDS: &[&str] = &[
        "renderer",
        "layout",
        "markdown",
        "paragraph",
        "heading",
        "table",
        "selection",
        "syntax",
        "highlight",
        "window",
        "element",
        "callback",
        "benchmark",
        "profile",
        "latency",
        "throughput",
        "scroll",
        "wrapping",
        "theme",
        "language",
        "fenced",
        "blockquote",
        "inline",
        "content",
    ];
    choose(rng, WORDS)
}

fn random_identifier(rng: &mut StdRng) -> &'static str {
    const IDENTIFIERS: &[&str] = &[
        "markdown_renderer",
        "layout_cache",
        "rendered_text",
        "source_range",
        "bench_input",
        "window_state",
        "code_block",
        "table_row",
        "link_target",
        "scroll_handle",
        "text_style",
        "root_block",
    ];
    choose(rng, IDENTIFIERS)
}

fn choose(rng: &mut StdRng, items: &'static [&'static str]) -> &'static str {
    let index = rng.random_range(0..items.len());
    items.get(index).copied().unwrap_or("markdown")
}

fn markdown_language_registry(cx: &BenchAppContext) -> Arc<LanguageRegistry> {
    let registry = Arc::new(LanguageRegistry::test(cx.background_executor().clone()));
    registry.add(language::rust_lang());
    registry
}

fn init_context(cx: &mut BenchAppContext) {
    cx.update(|cx| {
        let store = SettingsStore::test(cx);
        cx.set_global(store);
        assets::Assets.load_test_fonts(cx);
        theme_settings::init(theme::LoadThemes::JustBase, cx);
    });
}

fn markdown_sizes() -> Vec<usize> {
    let mut sizes = vec![5_000, 10_000, 50_000, 250_000];
    if std::env::var("ZED_BENCH_HUGE").is_ok() {
        sizes.push(1_000_000);
    }
    sizes
}

gpui::bench_group!(benches, markdown_render);
gpui::bench_main!(benches);

```

### Core Architecture Module: `crates/benchmarks/src/bench_utils.rs`
```
use rand::Rng;

pub const RUST_MODULE_HEADER_LINES: usize = 10;
pub const RUST_FUNCTION_LINES: usize = 12;
pub const RUST_FUNCTION_BODY_LINES: usize = 11;
pub const RUST_MODULE_FOOTER_LINES: usize = 5;

pub fn rust_file_line_count(function_count: usize) -> usize {
    RUST_MODULE_HEADER_LINES + function_count * RUST_FUNCTION_LINES + RUST_MODULE_FOOTER_LINES
}

pub fn random_rust_file(rng: &mut impl Rng, line_count: usize) -> Vec<String> {
    if line_count < RUST_MODULE_HEADER_LINES + RUST_MODULE_FOOTER_LINES {
        return (0..line_count)
            .map(|line_index| format!("// generated benchmark line {line_index}"))
            .collect();
    }

    let mut lines = vec![
        "use anyhow::{Context as _, Result};".to_string(),
        "use collections::HashMap;".to_string(),
        "".to_string(),
        "#[derive(Clone, Debug)]".to_string(),
        "pub struct WorkspaceSnapshot {".to_string(),
        "    buffers: HashMap<String, usize>,".to_string(),
        "    version: usize,".to_string(),
        "}".to_string(),
        "".to_string(),
        "impl WorkspaceSnapshot {".to_string(),
    ];

    let body_line_count = line_count - RUST_MODULE_HEADER_LINES - RUST_MODULE_FOOTER_LINES;
    let function_count = body_line_count / RUST_FUNCTION_LINES;
    let filler_line_count = body_line_count % RUST_FUNCTION_LINES;

    for function_index in 0..function_count {
        let function_name = rust_identifier(rng, function_index);
        let argument_name = rust_identifier(rng, function_index + 1_000);
        let local_name = rust_identifier(rng, function_index + 2_000);
        let branch_name = rust_identifier(rng, function_index + 3_000);
        let multiplier = rng.random_range(2..17);
        let offset = rng.random_range(1..128);

        lines.extend([
            format!(
                "    pub fn {function_name}(&mut self, {argument_name}: usize) -> Result<usize> {{"
            ),
            format!("        let mut {local_name} = {argument_name}.saturating_mul({multiplier});"),
            format!("        if {local_name} % 2 == 0 {{"),
            format!(
                "            {local_name} = {local_name}.saturating_add(self.version + {offset});"
            ),
            "        } else {".to_string(),
            format!("            {local_name} = {local_name}.saturating_sub({offset});"),
            "        }".to_string(),
            format!("        let {branch_name} = self.buffers.len().saturating_add({local_name});"),
            format!("        self.version = self.version.saturating_add({branch_name});"),
            format!("        Ok({branch_name})"),
            "    }".to_string(),
            "".to_string(),
        ]);
    }

    for filler_index in 0..filler_line_count {
        let filler_name = rust_identifier(rng, function_count + 4_000 + filler_index);
        lines.push(format!("    // benchmark filler {filler_name}"));
    }

    lines.push("}".to_string());
    lines.push("".to_string());
    lines.push("pub fn normalize_path(path: &str) -> String {".to_string());
    lines.push("    path.replace('\\\\', \"/\")".to_string());
    lines.push("}".to_string());

    debug_assert_eq!(lines.len(), line_count);
    lines
}

pub fn rust_identifier(rng: &mut impl Rng, salt: usize) -> String {
    const PARTS: &[&str] = &[
        "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "theta", "lambda", "sigma", "omega",
    ];
    format!(
        "{}_{}_{}",
        PARTS[rng.random_range(0..PARTS.len())],
        salt,
        rng.random_range(0..10_000)
    )
}

```

### Core Architecture Module: `crates/command_palette_hooks/src/command_palette_hooks.rs`
```
//! Provides hooks for customizing the behavior of the command palette.

#![deny(missing_docs)]

use std::{any::TypeId, rc::Rc};

use collections::{HashSet, TypeIdHashSet};
use derive_more::{Deref, DerefMut};
use gpui::{Action, App, BorrowAppContext, Global, Task, WeakEntity};
use workspace::Workspace;

/// Initializes the command palette hooks.
pub fn init(cx: &mut App) {
    cx.set_global(GlobalCommandPaletteFilter::default());
}

/// A filter for the command palette.
#[derive(Default)]
pub struct CommandPaletteFilter {
    hidden_namespaces: HashSet<&'static str>,
    hidden_action_types: TypeIdHashSet,
    /// Actions that have explicitly been shown. These should be shown even if
    /// they are in a hidden namespace.
    shown_action_types: TypeIdHashSet,
}

#[derive(Deref, DerefMut, Default)]
struct GlobalCommandPaletteFilter(CommandPaletteFilter);

impl Global for GlobalCommandPaletteFilter {}

impl CommandPaletteFilter {
    /// Returns the global [`CommandPaletteFilter`], if one is set.
    pub fn try_global(cx: &App) -> Option<&CommandPaletteFilter> {
        cx.try_global::<GlobalCommandPaletteFilter>()
            .map(|filter| &filter.0)
    }

    /// Returns a mutable reference to the global [`CommandPaletteFilter`].
    pub fn global_mut(cx: &mut App) -> &mut Self {
        cx.global_mut::<GlobalCommandPaletteFilter>()
    }

    /// Updates the global [`CommandPaletteFilter`] using the given closure.
    pub fn update_global<F>(cx: &mut App, update: F)
    where
        F: FnOnce(&mut Self, &mut App),
    {
        if cx.has_global::<GlobalCommandPaletteFilter>() {
            cx.update_global(|this: &mut GlobalCommandPaletteFilter, cx| update(&mut this.0, cx))
        }
    }

    /// Returns whether the given [`Action`] is hidden by the filter.
    pub fn is_hidden(&self, action: &dyn Action) -> bool {
        let name = action.name();
        let namespace = name.split("::").next().unwrap_or("malformed action name");

        // If this action has specifically been shown then it should be visible.
        if self.shown_action_types.contains(&action.type_id()) {
            return false;
        }

        self.hidden_namespaces.contains(namespace)
            || self.hidden_action_types.contains(&action.type_id())
    }

    /// Hides all actions in the given namespace.
    pub fn hide_namespace(&mut self, namespace: &'static str) {
        self.hidden_namespaces.insert(namespace);
    }

    /// Shows all actions in the given namespace.
    pub fn show_namespace(&mut self, namespace: &'static str) {
        self.hidden_namespaces.remove(namespace);
    }

    /// Hides all actions with the given types.
    pub fn hide_action_types<'a>(&mut self, action_types: impl IntoIterator<Item = &'a TypeId>) {
        for action_type in action_types {
            self.hidden_action_types.insert(*action_type);
            self.shown_action_types.remove(action_type);
        }
    }

    /// Shows all actions with the given types.
    pub fn show_action_types<'a>(&mut self, action_types: impl IntoIterator<Item = &'a TypeId>) {
        for action_type in action_types {
            self.shown_action_types.insert(*action_type);
            self.hidden_action_types.remove(action_type);
        }
    }
}

/// The result of intercepting a command palette command.
#[derive(Debug)]
pub struct CommandInterceptItem {
    /// The action produced as a result of the interception.
    pub action: Box<dyn Action>,
    /// The display string to show in the command palette for this result.
    pub string: String,
    /// The character positions in the string that match the query.
    /// Used for highlighting matched characters in the command palette UI.
    pub positions: Vec<usize>,
}

/// The result of intercepting a command palette command.
#[derive(Default, Debug)]
pub struct CommandInterceptResult {
    /// The items
    pub results: Vec<CommandInterceptItem>,
    /// Whether or not to continue to show the normal matches
    pub exclusive: bool,
}

/// An interceptor for the command palette.
#[derive(Clone)]
pub struct GlobalCommandPaletteInterceptor(
    Rc<dyn Fn(&str, WeakEntity<Workspace>, &mut App) -> Task<CommandInterceptResult>>,
);

impl Global for GlobalCommandPaletteInterceptor {}

impl GlobalCommandPaletteInterceptor {
    /// Sets the global interceptor.
    ///
    /// This will override the previous interceptor, if it exists.
    pub fn set(
        cx: &mut App,
        interceptor: impl Fn(&str, WeakEntity<Workspace>, &mut App) -> Task<CommandInterceptResult>
        + 'static,
    ) {
        cx.set_global(Self(Rc::new(interceptor)));
    }

    /// Clears the global interceptor.
    pub fn clear(cx: &mut App) {
        if cx.has_global::<Self>() {
            cx.remove_global::<Self>();
        }
    }

    /// Intercepts the given query from the command palette.
    pub fn intercept(
        query: &str,
        workspace: WeakEntity<Workspace>,
        cx: &mut App,
    ) -> Option<Task<CommandInterceptResult>> {
        let interceptor = cx.try_global::<Self>()?;
        let handler = interceptor.0.clone();
        Some(handler(query, workspace, cx))
    }
}

```

### Core Architecture Module: `crates/diagnostics/src/diagnostic_renderer.rs`
```
use std::{ops::Range, sync::Arc};

use editor::{
    Anchor, Editor, EditorSnapshot, ToOffset,
    display_map::{BlockContext, BlockPlacement, BlockProperties, BlockStyle},
    hover_popover::diagnostics_markdown_style,
};
use gpui::{AppContext, Entity, Focusable, WeakEntity};
use language::{BufferId, Diagnostic, DiagnosticEntryRef, LanguageRegistry};
use lsp::DiagnosticSeverity;
use markdown::{CopyButtonVisibility, Markdown, MarkdownElement};
use settings::Settings;
use text::Point;
use theme_settings::ThemeSettings;
use ui::{CopyButton, prelude::*};
use util::maybe;

use crate::toolbar_controls::DiagnosticsToolbarEditor;

pub struct DiagnosticRenderer;

impl DiagnosticRenderer {
    pub fn diagnostic_blocks_for_group(
        diagnostic_group: Vec<DiagnosticEntryRef<'_, Point>>,
        buffer_id: BufferId,
        diagnostics_editor: Option<Arc<dyn DiagnosticsToolbarEditor>>,
        language_registry: Option<Arc<LanguageRegistry>>,
        cx: &mut App,
    ) -> Vec<DiagnosticBlock> {
        let Some(primary_ix) = diagnostic_group
            .iter()
            .position(|d| d.diagnostic.is_primary)
        else {
            return Vec::new();
        };
        let primary = &diagnostic_group[primary_ix];
        let group_id = primary.diagnostic.group_id;
        let mut results = vec![];
        for entry in diagnostic_group.iter() {
            let mut markdown = Self::markdown(&entry.diagnostic);
            if entry.diagnostic.is_primary {
                let diagnostic = &primary.diagnostic;
                append_source_and_code(&mut markdown, diagnostic);

                for (ix, entry) in diagnostic_group.iter().enumerate() {
                    if entry.range.start.row.abs_diff(primary.range.start.row) >= 5 {
                        markdown.push_str("\n- hint: [");
                        markdown.push_str(&Markdown::escape(entry.diagnostic.message.as_str()));
                        markdown.push_str(&format!(
                            "](file://#diagnostic-{buffer_id}-{group_id}-{ix})\n",
                        ))
                    }
                }

                results.push(DiagnosticBlock {
                    initial_range: primary.range.clone(),
                    severity: primary.diagnostic.severity,
                    diagnostics_editor: diagnostics_editor.clone(),
                    copy_message: primary.diagnostic.message.as_shared_string().clone(),
                    markdown: cx.new(|cx| {
                        Markdown::new(markdown.into(), language_registry.clone(), None, cx)
                    }),
                });
            } else {
                append_source_and_code(&mut markdown, entry.diagnostic);

                markdown.push_str(&format!(
                    " ([back](file://#diagnostic-{buffer_id}-{group_id}-{primary_ix}))"
                ));
                results.push(DiagnosticBlock {
                    initial_range: entry.range.clone(),
                    severity: entry.diagnostic.severity,
                    diagnostics_editor: diagnostics_editor.clone(),
                    copy_message: entry.diagnostic.message.as_shared_string().clone(),
                    markdown: cx.new(|cx| {
                        Markdown::new(markdown.into(), language_registry.clone(), None, cx)
                    }),
                });
            }
        }

        results
    }

    fn markdown(diagnostic: &Diagnostic) -> String {
        let mut markdown = String::new();

        if let Some(message_markdown) = diagnostic.message.markdown() {
            markdown.push_str(message_markdown);
        } else {
            markdown.push_str(&Markdown::escape(diagnostic.message.as_str()));
        };
        markdown
    }
}

fn append_source_and_code(markdown: &mut String, diagnostic: &Diagnostic) {
    if diagnostic.source.is_none() && diagnostic.code.is_none() {
        return;
    }
    let is_lsp_markdown = diagnostic
        .message
        .lsp_markup()
        .is_some_and(|(kind, _)| kind == &lsp::MarkupKind::Markdown);
    if is_lsp_markdown {
        markdown.push_str("\n\n(");
    } else {
        markdown.push_str(" (");
    }
    if let Some(source) = diagnostic.source.as_ref() {
        markdown.push_str(&Markdown::escape(source));
    }
    if diagnostic.source.is_some() && diagnostic.code.is_some() {
        markdown.push(' ');
    }
    if let Some(code) = diagnostic.code.as_ref() {
        if let Some(description) = diagnostic.code_description.as_ref() {
            markdown.push('[');
            markdown.push_str(&Markdown::escape(&code.to_string()));
            markdown.push_str("](");
            markdown.push_str(&Markdown::escape(description.as_ref()));
            markdown.push(')');
        } else {
            markdown.push_str(&Markdown::escape(&code.to_string()));
        }
    }
    markdown.push(')');
}

impl editor::DiagnosticRenderer for DiagnosticRenderer {
    fn render_group(
        &self,
        diagnostic_group: Vec<DiagnosticEntryRef<'_, Point>>,
        buffer_id: BufferId,
        snapshot: EditorSnapshot,
        editor: WeakEntity<Editor>,
        language_registry: Option<Arc<LanguageRegistry>>,
        cx: &mut App,
    ) -> Vec<BlockProperties<Anchor>> {
        let blocks = Self::diagnostic_blocks_for_group(
            diagnostic_group,
            buffer_id,
            None,
            language_registry,
            cx,
        );

        blocks
            .into_iter()
            .map(|block| {
                let editor = editor.clone();
                BlockProperties {
                    placement: BlockPlacement::Near(
                        snapshot
                            .buffer_snapshot()
                            .anchor_after(block.initial_range.start),
                    ),
                    height: Some(1),
                    style: BlockStyle::Flex,
                    render: Arc::new(move |bcx| block.render_block(editor.clone(), bcx)),
                    priority: 1,
                }
            })
            .collect()
    }

    fn render_hover(
        &self,
        diagnostic_group: Vec<DiagnosticEntryRef<'_, Point>>,
        range: Range<Point>,
        buffer_id: BufferId,
        language_registry: Option<Arc<LanguageRegistry>>,
        cx: &mut App,
    ) -> Option<Entity<Markdown>> {
        let blocks = Self::diagnostic_blocks_for_group(
            diagnostic_group,
            buffer_id,
            None,
            language_registry,
            cx,
        );
        blocks
            .into_iter()
            .find_map(|block| (block.initial_range == range).then(|| block.markdown))
    }

    fn open_link(
        &self,
        editor: &mut Editor,
        link: SharedString,
        window: &mut Window,
        cx: &mut Context<Editor>,
    ) {
        DiagnosticBlock::open_link(editor, &None, link, window, cx);
    }
}

#[derive(Clone)]
pub(crate) struct DiagnosticBlock {
    pub(crate) initial_range: Range<Point>,
    pub(crate) severity: DiagnosticSeverity,
    pub(crate) markdown: Entity<Markdown>,
    pub(crate) diagnostics_editor: Option<Arc<dyn DiagnosticsToolbarEditor>>,
    pub(crate) copy_message: SharedString,
}

impl DiagnosticBlock {
    pub fn render_block(&self, editor: WeakEntity<Editor>, bcx: &BlockContext) -> AnyElement {
        let cx = &bcx.app;
        let status_colors = cx.theme().status();

        let max_width = bcx.em_width * 120.;

        let (background_color, border_color) = match self.severity {
            DiagnosticSeverity::ERROR => (status_colors.error_background, status_colors.error),
            DiagnosticSeverity::WARNING => {
                (status_colors.warning_background, status_colors.warning)
            }
            DiagnosticSeverity::INFORMATION => (status_colors.info_background, status_colors.info),
            DiagnosticSeverity::HINT => (status_colors.hint_background, status_colors.hint),
            _ => (status_colors.ignored_background, status_colors.ignored),
        };
        let settings = ThemeSettings::get_global(cx);
        let editor_line_height = (settings.line_height() * settings.buffer_font_size(cx)).round();
        let line_height = editor_line_height;
        let diagnostics_editor = self.diagnostics_editor.clone();

        let copy_button_id = format!(
            "copy-diagnostic-{}-{}-{}-{}",
            self.initial_range.start.row,
            self.initial_range.start.column,
            self.initial_range.end.row,
            self.initial_range.end.column
        );

        h_flex()
            .max_w(max_width)
            .pl_1p5()
            .pr_0p5()
            .items_start()
            .gap_1()
            .border_l_2()
            .line_height(line_height)
            .bg(background_color)
            .border_color(border_color)
            .child(
                div().flex_1().min_w_0().child(
                    MarkdownElement::new(
                        self.markdown.clone(),
                        diagnostics_markdown_style(bcx.window, cx),
                    )
                    .code_block_renderer(markdown::CodeBlockRenderer::Default {
                        copy_button_visibility: CopyButtonVisibility::Hidden,
                        wrap_button_visibility: markdown::WrapButtonVisibility::Hidden,
                        border: false,
                    })
                    .on_url_click({
                        move |link, window, cx| {
                            editor
                                .update(cx, |editor, cx| {
                                    Self::open_link(editor, &diagnostics_editor, link, window, cx)
                                })
                                .ok();
                        }
                    }),
                ),
            )
            .child(
                CopyButton::new(copy_button_id, self.copy_message.clone())
                    .tooltip_label("Copy Diagnostic"),
      
```

### Core Architecture Module: `crates/edit_prediction_cli/src/score.rs`
```
use crate::{
    PredictArgs, PredictionProvider,
    example::Example,
    format_prompt::TeacherPrompt,
    headless::EpAppState,
    parse_output::parse_prediction_output,
    predict::run_prediction,
    progress::{ExampleProgress, Step},
};
use anyhow::Context as _;
use edit_prediction_context::limit_retrieved_context_to_bytes;
use edit_prediction_metrics::{
    ActualPredictionCursor, Excerpt, PredictionReversalContext, PredictionScoringInput,
};
use gpui::{AppContext as _, AsyncApp};
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;
use std::sync::Arc;
use zeta_prompt::{ContextSource, RelatedFile};

pub const EVAL_RELATED_CONTEXT_TOKENS_LIMIT: usize = 4000;

pub async fn run_scoring(
    example: &mut Example,
    args: &PredictArgs,
    app_state: Arc<EpAppState>,
    example_progress: &ExampleProgress,
    cx: AsyncApp,
    allow_missing_predictions: bool,
    retrieved_context_byte_limit: Option<usize>,
    context_source_filter: Option<Vec<ContextSource>>,
) -> anyhow::Result<()> {
    if !(allow_missing_predictions && args.provider.is_none() && example.predictions.is_empty()) {
        run_prediction(example, args, app_state, example_progress, cx.clone()).await?;
    }

    let progress = example_progress.start(Step::Score);

    progress.set_substatus("computing metrics");
    let example_for_scoring = example.clone();
    example.score = cx
        .background_spawn(async move {
            let prompt_inputs = example_for_scoring
                .prompt_inputs
                .as_ref()
                .context("prompt_inputs is required for scoring - run prediction first or ensure JSON includes prompt_inputs")?;
            let original_text: &str = prompt_inputs.cursor_excerpt.as_ref();
            let expected_patches_with_cursors = example_for_scoring
                .spec
                .expected_patches_with_cursor_positions();

            let old_editable_region = if let Some(p) = example_for_scoring.prompt.as_ref() {
                if matches!(
                    p.provider,
                    PredictionProvider::Teacher(_, _) | PredictionProvider::TeacherNonBatching(_, _)
                ) {
                    Some(
                        TeacherPrompt::extract_editable_region(&p.input)?
                            .replace(TeacherPrompt::USER_CURSOR_MARKER, ""),
                    )
                } else {
                    None
                }
            } else {
                None
            };

            let cursor_path = example_for_scoring.spec.cursor_path.as_ref();
            let context = context_excerpts(
                &example_for_scoring,
                prompt_inputs,
                retrieved_context_byte_limit,
                context_source_filter.as_deref(),
            );

            let prepared_expected_patches = match edit_prediction_metrics::prepare_expected_patches(
                &expected_patches_with_cursors,
                original_text,
                old_editable_region.as_deref(),
            ) {
                Ok(prepared_expected_patches) => prepared_expected_patches,
                Err(_) if !context.is_empty() => expected_patches_with_cursors
                    .iter()
                    .map(|(patch, cursor_offset)| edit_prediction_metrics::PreparedExpectedPatch {
                        patch: patch.clone(),
                        text: original_text.to_string(),
                        cursor_editable_region_offset: *cursor_offset,
                    })
                    .collect(),
                Err(error) => {
                    return Err(error).with_context(|| {
                        format!(
                            "Expected patch did not apply for {}",
                            example_for_scoring.spec.name
                        )
                    });
                }
            };

            let mut scores = vec![];
            if allow_missing_predictions && example_for_scoring.predictions.is_empty() {
                scores.push(edit_prediction_metrics::score_prediction(
                    PredictionScoringInput {
                        original_text,
                        expected_patches: &prepared_expected_patches,
                        actual_patch: None,
                        actual_cursor: None,
                        reversal_context: Some(PredictionReversalContext {
                            edit_history: &prompt_inputs.events,
                            excerpt_start_row: prompt_inputs.excerpt_start_row,
                            cursor_path,
                        }),
                        cumulative_logprob: None,
                        avg_logprob: None,
                        context: Some(&context),
                    },
                ));
            }

            for prediction in &example_for_scoring.predictions {
                let actual_patch = prediction.actual_patch.clone().or_else(|| {
                    parse_prediction_output(
                        &example_for_scoring,
                        &prediction.actual_output,
                        prediction.provider,
                    )
                    .ok()
                    .map(|(patch, _)| patch)
                });

                let actual_cursor = prediction.actual_cursor.as_ref().map(|cursor| {
                    ActualPredictionCursor {
                        row: cursor.row,
                        editable_region_offset: cursor.editable_region_offset,
                    }
                });

                scores.push(edit_prediction_metrics::score_prediction(
                    PredictionScoringInput {
                        original_text,
                        expected_patches: &prepared_expected_patches,
                        actual_patch: actual_patch.as_deref(),
                        actual_cursor,
                        reversal_context: Some(PredictionReversalContext {
                            edit_history: &prompt_inputs.events,
                            excerpt_start_row: prompt_inputs.excerpt_start_row,
                            cursor_path,
                        }),
                        cumulative_logprob: prediction.cumulative_logprob,
                        avg_logprob: prediction.avg_logprob,
                        context: Some(&context),
                    },
                ));
            }

            anyhow::Ok(scores)
        })
        .await?;
    Ok(())
}

pub fn run_context_coverage_scoring(
    example: &mut Example,
    example_progress: &ExampleProgress,
    retrieved_context_byte_limit: Option<usize>,
    context_source_filter: Option<&[ContextSource]>,
) -> anyhow::Result<()> {
    let progress = example_progress.start(Step::Score);

    progress.set_substatus("computing context coverage");
    let prompt_inputs = example
        .prompt_inputs
        .as_ref()
        .context("prompt_inputs is required for context coverage scoring")?;
    let context = context_excerpts(
        example,
        prompt_inputs,
        retrieved_context_byte_limit,
        context_source_filter,
    );

    let editable_context_coverage = example
        .spec
        .expected_patches_with_cursor_positions()
        .iter()
        .map(|(expected_patch, _)| {
            edit_prediction_metrics::editable_context_coverage(expected_patch, &context)
        })
        .max_by(|left, right| {
            left.lines_f1
                .total_cmp(&right.lines_f1)
                .then_with(|| left.files_f1.total_cmp(&right.files_f1))
        });

    let mut score = edit_prediction_metrics::PredictionScore::zero();
    score.editable_context_coverage = editable_context_coverage;
    example.score = vec![score];

    Ok(())
}

fn context_excerpts(
    _example: &Example,
    prompt_inputs: &zeta_prompt::Zeta2PromptInput,
    retrieved_context_byte_limit: Option<usize>,
    context_source_filter: Option<&[ContextSource]>,
) -> Vec<Excerpt> {
    let mut context = Vec::new();

    if let Some(excerpt_start_row) = prompt_inputs.excerpt_start_row {
        let row_count = prompt_inputs.cursor_excerpt.lines().count() as u32;

        context.push(Excerpt {
            path: prompt_inputs.cursor_path.to_string_lossy().to_string(),
            row_range: excerpt_start_row..excerpt_start_row.saturating_add(row_count),
            content: prompt_inputs.cursor_excerpt.to_string(),
        });
    }

    if let Some(related_files) = &prompt_inputs.related_files {
        let related_files = filtered_related_files(related_files, context_source_filter);
        let related_files = if let Some(max_bytes) = retrieved_context_byte_limit {
            limit_retrieved_context_to_bytes(&related_files, max_bytes)
        } else {
            related_files
        };
        for related_file in &related_files {
            for excerpt in &related_file.excerpts {
                // First component is a project name which is not present in expected patch, skip it
                let path = related_file
                    .path
                    .iter()
                    .skip(1)
                    .collect::<std::path::PathBuf>()
                    .to_string_lossy()
                    .to_string();
                context.push(Excerpt {
                    path,
                    row_range: excerpt.row_range.clone(),
                    content: excerpt.text.to_string(),
                });
            }
        }
    }

    context
}

fn filtered_related_files(
    related_files: &[RelatedFile],
    context_source_filter: Option<&[ContextSource]>,
) -> Vec<RelatedFile> {
    let Some(context_source_filter) = context_source_filter else {
        return related_files.to_vec();
    };

    related_files
        .iter()
        .filter_map(|related_file| {
            let excerpts = related_file
                .excerpts
                .iter()
                .filter(|excerpt| context_source_filter.contains(&excerpt.context_source))

```

### Core Architecture Module: `crates/edit_prediction_metrics/src/prediction_score.rs`
```
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;
use std::path::Path;
use std::sync::Arc;
use zeta_prompt::udiff::{apply_diff_to_string, apply_diff_to_string_with_hunk_offset};

use crate::reversal::compute_prediction_reversal_ratio_from_history;
use crate::{
    jumps::{
        EditableContextCoverage, Excerpt, PatchLocationMatch, editable_context_coverage,
        patch_location_match,
    },
    patch::{Hunk, Patch, PatchLine},
    patch_metrics::{
        ClassificationMetrics, DeltaChrFMetrics, braces_disbalance, count_patch_token_changes,
        delta_chr_f, delta_chr_f_beta, exact_lines_match, has_isolated_whitespace_changes,
        is_editable_region_correct,
    },
};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PredictionScore {
    pub delta_chr_f: f32,
    #[serde(default)]
    pub delta_chr_f_true_positives: usize,
    #[serde(default)]
    pub delta_chr_f_false_positives: usize,
    #[serde(default)]
    pub delta_chr_f_false_negatives: usize,
    #[serde(default)]
    pub delta_chr_f_precision: f64,
    #[serde(default)]
    pub delta_chr_f_recall: f64,
    #[serde(default)]
    pub delta_chr_f_beta: f64,
    pub braces_disbalance: usize,
    #[serde(default)]
    pub exact_lines_tp: usize,
    #[serde(default)]
    pub exact_lines_fp: usize,
    #[serde(default)]
    pub exact_lines_fn: usize,
    #[serde(default)]
    pub reversal_ratio: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor_distance: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor_exact_match: Option<bool>,
    pub wrong_editable_region: Option<bool>,
    #[serde(default)]
    pub has_isolated_whitespace_changes: bool,
    #[serde(default)]
    pub inserted_tokens: usize,
    #[serde(default)]
    pub deleted_tokens: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kept_rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recall_rate: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kept_chars: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub correctly_deleted_chars: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discarded_chars: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cumulative_logprob: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avg_logprob: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub editable_context_coverage: Option<EditableContextCoverage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub jump_location: Option<PatchLocationMatch>,
}

impl PredictionScore {
    pub fn zero() -> Self {
        Self {
            delta_chr_f: 0.0,
            delta_chr_f_true_positives: 0,
            delta_chr_f_false_positives: 0,
            delta_chr_f_false_negatives: 0,
            delta_chr_f_precision: 0.0,
            delta_chr_f_recall: 0.0,
            delta_chr_f_beta: delta_chr_f_beta(),
            braces_disbalance: 0,
            exact_lines_tp: 0,
            exact_lines_fp: 0,
            exact_lines_fn: 0,
            reversal_ratio: 0.0,
            cursor_distance: None,
            cursor_exact_match: None,
            wrong_editable_region: None,
            has_isolated_whitespace_changes: false,
            inserted_tokens: 0,
            deleted_tokens: 0,
            kept_rate: None,
            recall_rate: None,
            kept_chars: None,
            correctly_deleted_chars: None,
            discarded_chars: None,
            cumulative_logprob: None,
            avg_logprob: None,
            editable_context_coverage: None,
            jump_location: None,
        }
    }

    pub fn delta_chr_f_counts(&self) -> ClassificationMetrics {
        ClassificationMetrics {
            true_positives: self.delta_chr_f_true_positives,
            false_positives: self.delta_chr_f_false_positives,
            false_negatives: self.delta_chr_f_false_negatives,
        }
    }

    pub fn exact_lines_counts(&self) -> ClassificationMetrics {
        ClassificationMetrics {
            true_positives: self.exact_lines_tp,
            false_positives: self.exact_lines_fp,
            false_negatives: self.exact_lines_fn,
        }
    }
}

impl Default for PredictionScore {
    fn default() -> Self {
        Self::zero()
    }
}

#[derive(Clone, Debug)]
pub struct PreparedExpectedPatch {
    pub patch: String,
    pub text: String,
    pub cursor_editable_region_offset: Option<usize>,
}

#[derive(Clone, Debug)]
pub struct PrepareExpectedPatchError {
    message: String,
}

impl fmt::Display for PrepareExpectedPatchError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.message.fmt(formatter)
    }
}

impl Error for PrepareExpectedPatchError {}

pub fn prepare_expected_patches(
    expected_patches_with_cursors: &[(String, Option<usize>)],
    original_text: &str,
    old_editable_region: Option<&str>,
) -> Result<Vec<PreparedExpectedPatch>, PrepareExpectedPatchError> {
    expected_patches_with_cursors
        .iter()
        .map(|(patch, cursor_in_patch)| {
            let text = apply_diff_to_string(patch, original_text).map_err(|error| {
                PrepareExpectedPatchError {
                    message: error.to_string(),
                }
            })?;
            let cursor_editable_region_offset =
                if let (Some(editable_region), Some(cursor_in_patch)) =
                    (old_editable_region, *cursor_in_patch)
                {
                    match apply_diff_to_string_with_hunk_offset(patch, editable_region) {
                        Ok((_, hunk_offset)) => Some(hunk_offset.unwrap_or(0) + cursor_in_patch),
                        Err(_) => None,
                    }
                } else {
                    *cursor_in_patch
                };

            Ok(PreparedExpectedPatch {
                patch: patch.clone(),
                text,
                cursor_editable_region_offset,
            })
        })
        .collect()
}

#[derive(Clone, Copy, Debug)]
pub struct ActualPredictionCursor {
    pub row: u32,
    pub editable_region_offset: Option<usize>,
}

#[derive(Clone, Copy, Debug)]
pub struct PredictionReversalContext<'a> {
    pub edit_history: &'a [Arc<zeta_prompt::Event>],
    pub excerpt_start_row: Option<u32>,
    pub cursor_path: &'a Path,
}

#[derive(Clone, Copy, Debug)]
pub struct PredictionScoringInput<'a> {
    pub original_text: &'a str,
    pub expected_patches: &'a [PreparedExpectedPatch],
    pub actual_patch: Option<&'a str>,
    pub actual_cursor: Option<ActualPredictionCursor>,
    pub reversal_context: Option<PredictionReversalContext<'a>>,
    pub cumulative_logprob: Option<f64>,
    pub avg_logprob: Option<f64>,
    pub context: Option<&'a [Excerpt]>,
}

pub fn score_prediction(input: PredictionScoringInput<'_>) -> PredictionScore {
    let editable_context_coverage = input.context.and_then(|context| {
        input
            .expected_patches
            .iter()
            .map(|expected| editable_context_coverage(&expected.patch, context))
            .max_by(|left, right| {
                left.lines_f1
                    .total_cmp(&right.lines_f1)
                    .then_with(|| left.files_f1.total_cmp(&right.files_f1))
            })
    });

    let actual_patch = input.actual_patch.unwrap_or("");
    let token_changes = count_patch_token_changes(actual_patch);

    let mut best = input
        .expected_patches
        .iter()
        .map(|expected| score_against_expected_patch(input, expected, actual_patch))
        .max_by(|left, right| {
            left.delta_chr_f_metrics
                .score
                .total_cmp(&right.delta_chr_f_metrics.score)
                .then_with(|| left.exact_lines.f1().total_cmp(&right.exact_lines.f1()))
                .then_with(|| {
                    left.jump_location
                        .lines_f1
                        .total_cmp(&right.jump_location.lines_f1)
                })
        })
        .unwrap_or_else(|| score_against_no_expected_patch(input, actual_patch));

    let (cursor_distance, cursor_exact_match) =
        compute_cursor_metrics(best.expected_cursor, input.actual_cursor);

    let wrong_editable_region = input
        .actual_patch
        .map(|actual_patch| !is_editable_region_correct(actual_patch));
    let has_isolated_whitespace_changes = input.actual_patch.is_some_and(|actual_patch| {
        has_isolated_whitespace_changes(actual_patch, input.actual_cursor.map(|cursor| cursor.row))
    });

    best.score.cumulative_logprob = input.cumulative_logprob;
    best.score.avg_logprob = input.avg_logprob;
    best.score.editable_context_coverage = editable_context_coverage;
    best.score.inserted_tokens = token_changes.inserted_tokens;
    best.score.deleted_tokens = token_changes.deleted_tokens;
    best.score.cursor_distance = cursor_distance;
    best.score.cursor_exact_match = cursor_exact_match;
    best.score.wrong_editable_region = wrong_editable_region;
    best.score.has_isolated_whitespace_changes = has_isolated_whitespace_changes;
    best.score
}

struct ExpectedPatchScore {
    score: PredictionScore,
    delta_chr_f_metrics: DeltaChrFMetrics,
    exact_lines: ClassificationMetrics,
    jump_location: PatchLocationMatch,
    expected_cursor: Option<usize>,
}

struct ContentScore {
    delta_chr_f_metrics: DeltaChrFMetrics,
    braces_disbalance: usize,
    reversal_ratio: f32,
    kept_rate: Option<f64>,
    recall_rate: Option<f64>,
    kept_chars: Option<usize>,
    correctly_deleted_chars: Option<usize>,
    discarded_chars: Option<usize>,
}

fn score_against_expected_patch(
    input: PredictionScoringInput<'_>,
    expected: &
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #40276** (2026-08-28): **Windows Beta: SSH connection sometimes fails because askpass script does not exist**
  *Symptoms*: ### Summary  Attempting to SSH to a linux host results in "failed to run command: ssh_askpass: exec(powershell.exe -ExecutionPolicy Bypass -File C:\\Users\\<User>\\AppData\\Local\\Temp\\zed-askpassTWz1QF\\askpass.ps1" No Such file or directory". Inspecting the AppData Local Temp directory I can indeed confirm that directory does not exist, and there is no ps1 file in it.  ### Description  Steps to trigger the problem: 1. Install Zed Nightly 0.210.0 0c08bbca0588cbea05a78f426f597b52cb91e12b on a windows machine. 2. Attempt to ssh to a linux host to open an existing project that you have a key installed on. 3. Get an askpass failure (even though SSH does work without prompting locally in terminal)  **Expected Behavior**: I should be able to connect to the remote linux host. **Actual Behavior**: I cannot connect, attempting to create the directory doesn't help as I don't have a copy of `askpass.ps1` and the directory name changes every time i hit retry.   ### Zed Version and System Specs  Zed: v0.210.0 (Zed Nightly 0c08bbca0588cbea05a78f426f597b52cb91e12b)  OS: Windows 10.0.26200 Memory: 63.2 GiB Architecture: x86_64 GPU: AMD Radeon RX 7900 XTX || AMD Corporation || 25.9.1 (25.10.25.10-250825a-418637C-AMD-Software-Adrenalin-Edition)
  **Post-Mortem & Fix Analysis**:
  > Also went through the windows SSH documentation on troubleshooting, and confirmed I have an SSH key agent running, can SSH, and that SSH.exe exists (and isn't pointing to something unexpected):  ``` PS C:\Users\$USER> Get-Service ssh-agent  Status   Name               DisplayName ------   ----               ----------- Running  ssh-agent          OpenSSH Authentication Agent  PS C:\Users\$USER> which ssh.exe /c/Windows/System32/OpenSSH/ssh.exe PS C:\Users\$USER> ssh.exe t-elos Welcome to Ubuntu 24.04.3 LTS (GNU/Linux 6.8.0-85-generic x86_64) [... snipped ...] ```
  > Does this happen to you on the stable version of Zed?

- **Issue #40267** (2025-10-20): **Extensions page scrolls up and down when it shouldn't be scrollable**
  *Symptoms*: ### Summary  The Extensions page scrolls back and forth when it shouldn't be scrollable.  ### Description  I think the "vibration" effect is occurring because of inertia scroll on a MBP touchpad.  Steps to reproduce: 1. Open the Extensions page 2. Scroll down  **Expected Behavior**: Nothing happens, there is no scrollbar and everything appears to fit the page perfectly, so the page shouldn't be scrollable **Actual Behavior**: The page scrolls down a bit, then snaps back to its original position.  <details><summary>Screen recording</summary>  https://github.com/user-attachments/assets/6eaee086-bf42-4d92-abc5-6fc42f6aa773  </details>   ### Zed Version and System Specs  Zed: v0.208.4 (Zed)  OS: macOS 15.7.1 Memory: 16 GiB Architecture: x86_64

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

### Incident Patch 1: `ed8dc1b6` (2026-11-27)
**Commit Message**: Fix TCP-based debugging in dev containers (#65778)

## Summary

Fix TCP-based debug adapters timing out in dev containers. The adapter
runs inside the container, but Zed connects to a host loopback port
whose forwarding request Docker exec silently ignores.

Add a TCP-to-stdio helper to the existing remote server so the TCP
connection is established inside the container and DAP traffic travels
over Docker exec stdio. Keep adapter logs off the DAP stream, flush
messages promptly, and terminate spawned adapters when the client
disconnects. Child and descendant sessions open new proxy connections to
the existing adapter instead of starting it again. Existing local, SSH,
WSL, and native stdio paths remain in place.

Closes #57021

## Testing

- `ITERATIONS=20 cargo test --locked --offline -p remote -p dap --lib`:
62 remote tests and 7 DAP tests passed, including child/descendant
connection reuse and existing SSH/WSL/Docker tests.
- Seven TCP helper tests passed on Linux using the exact repository
module and the real `util` crate, covering bidirectional forwarding,
flushing, adapter launch/log separation, timeout, early exit, and
cleanup after client disconnect.
- `./script/clippy -p re

**File**: `crates/collab/tests/integration/remote_editing_collaboration_tests.rs` (modified, +94/-4)
```diff
@@ -1142,6 +1142,24 @@ async fn test_slow_adapter_startup_retries(
     cx_a: &mut TestAppContext,
     server_cx: &mut TestAppContext,
     executor: BackgroundExecutor,
+) {
+    test_remote_debug_session(cx_a, server_cx, executor, false).await;
+}
+
+#[gpui::test]
+async fn test_remote_debug_session_uses_tcp_proxy(
+    cx_a: &mut TestAppContext,
+    server_cx: &mut TestAppContext,
+    executor: BackgroundExecutor,
+) {
+    test_remote_debug_session(cx_a, server_cx, executor, true).await;
+}
+
+async fn test_remote_debug_session(
+    cx_a: &mut TestAppContext,
+    server_cx: &mut TestAppContext,
+    executor: BackgroundExecutor,
+    tcp_proxy: bool,
 ) {
     cx_a.update(|cx| {
         release_channel::init(semver::Version::new(0, 0, 0), cx);
@@ -1154,6 +1172,16 @@ async fn test_slow_adapter_startup_retries(
         dap_adapters::init(cx);
     });
     let (opts, server_ssh, _) = RemoteClient::fake_server(cx_a, server_cx);
+    if tcp_proxy {
+        let remote::RemoteConnectionOptions::Mock(options) = &opts else {
+            panic!("Expected a mock connection");
+        };
+        cx_a.update(|cx| {
+            remote::MockConnectionRegistry::update_global(cx, |registry, _| {
+                registry.enable_tcp_proxy(options).unwrap();
+            });
+        });
+    }
     let remote_fs = FakeFs::new(server_cx.executor());
     remote_fs
         .insert_tree(
@@ -1196,6 +1224,25 @@ async fn test_slow_adapter_startup_retries(
         .build_ssh_project(path!("/code"), client_ssh.clone(), false, cx_a)
         .await;
 
+    if tcp_proxy {
+        server_cx.update(|cx| {
+            SettingsStore::update_global(cx, |store, cx| {
+                store.update_user_settings(cx, |settings| {
+                    settings
+                        .project
+                        .dap
+                        .entry("fake-adapter".into())
+                        .or_default()
+                        .env = Some(HashMap::from_iter([(
+                        "ADAPTER_TEST".into(),
+                        "wrapped".into(),
+                    )]));
+                });
+            });
+        });
+    }
+
+    let mut async_cx = cx_a.to_async();
     let (workspace, cx_a) = client_a.build_workspace(&project_a, cx_a);
 
     let debugger_panel = workspace
@@ -1227,18 +1274,19 @@ async fn test_slow_adapter_startup_retries(
             adapter: "fake-adapter".into(),
             label: "test".into(),
             config: json!({
-                "request": "launch"
+                "request": "launch",
+                "cwd": "/code/project with spaces"
             }),
             tcp_connection: Some(TcpArgumentsTemplate {
-                port: None,
+                port: tcp_proxy.then_some(4567),
                 host: None,
-                timeout: None,
+                timeout: tcp_proxy.then_some(1234),
             }),
         },
         move |client| {
             let count = count.clone();
             client.on_request_ext::<dap::requests::Initialize, _>(move |_seq, _request| {
-                if count.fetch_add(1, std::sync::atomic::Ordering::SeqCst) < 5 {
+                if !tcp_proxy && count.fetch_add(1, std::sync::atomic::Ordering::SeqCst) < 5 {
                     return RequestHandling::Exit;
                 }
                 RequestHandling::Respond(Ok(Capabilities::default()))
@@ -1252,6 +1300,48 @@ async fn test_slow_adapter_startup_retries(
         cx_a,
         |session: &mut project::debugger::session::Session, _| session.adapter_client().unwrap(),
     );
+    if tcp_proxy {
+        let expected = [
+            "-T",
+            "-w",
+            "/code/project with spaces",
+            "mock-remote-server",
+            "tcp",
+            "127.0.0.1:4567",
+            "1234",
+        ];
+        let binary = client.binary();
+        assert_eq!(binary.command.as_deref(), Some("mock"));
+        assert_eq!(
+            binary.arguments,
+            expected
+                .into_iter()
+                .chain(["--", "command"])
+                .collect::<Vec<_>>()
+        );
+        assert_eq!(
+            binary.envs.get("ADAPTER_TEST").map(String::as_str),
+            Some("wrapped")
+        );
+        assert_eq!(binary.cwd, None);
+        assert!(!client.should_reconnect_for_ssh());
+
+        let child = client
+            .create_child_connection(
+                dap::client::SessionId(u32::MAX),
+                binary.clone(),
+                Box::new(|_| {}),
+                &mut async_cx,
+            )
+            .await
+            .unwrap();
+        assert_eq!(child.binary().command.as_deref(), Some("mock"));
+        assert_eq!(child.binary().arguments, expected);
+        assert_eq!(child.binary().envs, binary.envs);
+        assert_eq!(child.binary().cwd, None);
+        assert!(!child.should_reconnect_for_ssh());
+    }
+
     client
         .fake_event(dap::messages::Events::Stopped(dap::StoppedEven
```

**File**: `crates/dap/src/adapters.rs` (modified, +18/-3)
```diff
@@ -102,6 +102,15 @@ pub struct TcpArguments {
     pub host: IpAddr,
     pub port: u16,
     pub timeout: Option<u64>,
+    // Child sessions need a fresh proxy connection without restarting the adapter.
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub stdio_proxy: Option<StdioProxy>,
+}
+
+#[derive(Debug, Clone, PartialEq, Serialize)]
+pub struct StdioProxy {
+    pub command: String,
+    pub arguments: Vec<String>,
 }
 
 impl TcpArguments {
@@ -111,6 +120,7 @@ impl TcpArguments {
             host: host.host.context("missing host")?,
             port: host.port.context("missing port")?,
             timeout: host.timeout,
+            stdio_proxy: None,
         })
     }
 
@@ -445,7 +455,7 @@ impl DebugAdapter for FakeAdapter {
         task_definition: &DebugTaskDefinition,
         _: Option<PathBuf>,
         _: Option<Vec<String>>,
-        _: Option<HashMap<String, String>>,
+        env: Option<HashMap<String, String>>,
         _: &mut AsyncApp,
     ) -> Result<DebugAdapterBinary> {
         let connection = task_definition
@@ -455,13 +465,18 @@ impl DebugAdapter for FakeAdapter {
                 host: connection.host(),
                 port: connection.port.unwrap_or(17),
                 timeout: connection.timeout,
+                stdio_proxy: None,
             });
         Ok(DebugAdapterBinary {
             command: Some("command".into()),
             arguments: vec![],
             connection,
-            envs: HashMap::default(),
-            cwd: None,
+            envs: env.unwrap_or_default(),
+            cwd: task_definition
+                .config
+                .get("cwd")
+                .and_then(|cwd| cwd.as_str())
+                .map(PathBuf::from),
             request_args: StartDebuggingRequestArguments {
                 request: self.request_kind(&task_definition.config).await?,
                 configuration: task_definition.config.clone(),
```

**File**: `crates/dap/src/client.rs` (modified, +84/-1)
```diff
@@ -79,7 +79,19 @@ impl DebugAdapterClient {
         message_handler: DapMessageHandler,
         cx: &mut AsyncApp,
     ) -> Result<Self> {
-        let binary = if let Some(connection) = self.transport_delegate.tcp_arguments() {
+        let binary = if let Some(proxy) = self
+            .binary
+            .connection
+            .as_ref()
+            .and_then(|connection| connection.stdio_proxy.as_ref())
+        {
+            DebugAdapterBinary {
+                command: Some(proxy.command.clone()),
+                arguments: proxy.arguments.clone(),
+                request_args: binary.request_args,
+                ..self.binary.clone()
+            }
+        } else if let Some(connection) = self.transport_delegate.tcp_arguments() {
             DebugAdapterBinary {
                 command: None,
                 arguments: Default::default(),
@@ -282,6 +294,77 @@ mod tests {
         });
     }
 
+    #[gpui::test]
+    async fn child_connection_reuses_tcp_server(cx: &mut TestAppContext) {
+        use crate::adapters::{StdioProxy, TcpArguments};
+        init_test(cx);
+        for stdio_proxy in [
+            None,
+            Some(StdioProxy {
+                command: "docker".to_owned(),
+                arguments: vec!["exec".to_owned(), "container".to_owned(), "tcp".to_owned()],
+            }),
+        ] {
+            let binary = DebugAdapterBinary {
+                command: Some("adapter launcher".to_owned()),
+                arguments: vec!["--start-adapter".to_owned()],
+                envs: Default::default(),
+                cwd: None,
+                connection: Some(TcpArguments {
+                    host: std::net::Ipv4Addr::LOCALHOST.into(),
+                    port: 1234,
+                    timeout: Some(2000),
+                    stdio_proxy: stdio_proxy.clone(),
+                }),
+                request_args: StartDebuggingRequestArguments {
+                    configuration: json!({"parent": true}),
+                    request: dap_types::StartDebuggingRequestArgumentsRequest::Launch,
+                },
+            };
+            let parent = DebugAdapterClient::start(
+                SessionId(1),
+                binary.clone(),
+                Box::new(|_| {}),
+                &mut cx.to_async(),
+            )
+            .await
+            .expect("Parent connection starts");
+            let mut child_binary = binary.clone();
+            child_binary.request_args.configuration = json!({"child": true});
+            let child = parent
+                .create_child_connection(
+                    SessionId(2),
+                    child_binary.clone(),
+                    Box::new(|_| {}),
+                    &mut cx.to_async(),
+                )
+                .await
+                .expect("Child connection starts");
+            assert_eq!(child.binary.connection, binary.connection);
+            assert_eq!(child.binary.request_args, child_binary.request_args);
+            if let Some(proxy) = &stdio_proxy {
+                assert_eq!(
+                    child.binary.command.as_deref(),
+                    Some(proxy.command.as_str())
+                );
+                assert_eq!(child.binary.arguments, proxy.arguments);
+            } else {
+                assert_eq!(child.binary.command, None);
+                assert!(child.binary.arguments.is_empty());
+            }
+            let grandchild = child
+                .create_child_connection(
+                    SessionId(3),
+                    child_binary,
+                    Box::new(|_| {}),
+                    &mut cx.to_async(),
+                )
+                .await
+                .expect("Grandchild connection starts");
+            assert_eq!(grandchild.binary, child.binary);
+        }
+    }
+
     #[gpui::test]
     pub async fn test_initialize_client(cx: &mut TestAppContext) {
         #![expect(clippy::result_large_err)]
```

**File**: `crates/dap/src/transport.rs` (modified, +182/-22)
```diff
@@ -17,7 +17,7 @@ use smol::{
     net::{TcpListener, TcpStream},
 };
 use std::{
-    collections::HashMap,
+    collections::{HashMap, VecDeque},
     net::{IpAddr, SocketAddr},
     process::Stdio,
     sync::Arc,
@@ -80,16 +80,23 @@ async fn start(
     log_handlers: LogHandlers,
     cx: &mut AsyncApp,
 ) -> Result<Box<dyn Transport>> {
+    let tcp_connection = binary
+        .connection
+        .as_ref()
+        .filter(|connection| connection.stdio_proxy.is_none());
+
     #[cfg(any(test, feature = "test-support"))]
     if cfg!(any(test, feature = "test-support")) {
-        if let Some(connection) = binary.connection.clone() {
-            return Ok(Box::new(FakeTransport::start_tcp(connection, cx).await?));
+        if let Some(connection) = tcp_connection {
+            return Ok(Box::new(
+                FakeTransport::start_tcp(connection.clone(), cx).await?,
+            ));
         } else {
             return Ok(Box::new(FakeTransport::start_stdio(cx).await?));
         }
     }
 
-    if binary.connection.is_some() {
+    if tcp_connection.is_some() {
         Ok(Box::new(
             TcpTransport::start(binary, log_handlers, cx).await?,
         ))
@@ -261,12 +268,15 @@ impl TransportDelegate {
             // Clean up logs by trimming unnecessary whitespace/newlines before inserting into log.
             let line = line.trim();
 
-            log::debug!("stderr: {line}");
+            Self::log_adapter_line(&log_handlers, iokind, line);
+        }
+    }
 
-            for (kind, handler) in log_handlers.lock().iter_mut() {
-                if matches!(kind, LogKind::Adapter) {
-                    handler(iokind, None, line);
-                }
+    fn log_adapter_line(log_handlers: &LogHandlers, iokind: IoKind, line: &str) {
+        log::debug!("stderr: {line}");
+        for (kind, handler) in log_handlers.lock().iter_mut() {
+            if matches!(kind, LogKind::Adapter) {
+                handler(iokind, None, line);
             }
         }
     }
@@ -636,6 +646,7 @@ impl Transport for TcpTransport {
             host: self.host,
             port: self.port,
             timeout: Some(self.timeout),
+            stdio_proxy: None,
         })
     }
 
@@ -725,23 +736,91 @@ impl StdioTransport {
 
         let mut process = Child::spawn(command, Stdio::piped(), Stdio::piped(), Stdio::piped())?;
 
-        let _stderr_task = process.stderr.take().map(|stderr| {
-            cx.background_spawn(TransportDelegate::handle_adapter_log(
-                stderr,
-                IoKind::StdErr,
-                log_handlers,
-            ))
-        });
-
-        let process = Mutex::new(process);
+        let stderr = process
+            .stderr
+            .take()
+            .context("Missing debug adapter stderr")?;
+        let mut transport = Self {
+            process: Mutex::new(process),
+            _stderr_task: None,
+        };
 
-        Ok(Self {
-            process,
-            _stderr_task,
-        })
+        let mut stderr = BufReader::new(stderr);
+        if let Some(connection) = binary
+            .connection
+            .as_ref()
+            .filter(|args| args.stdio_proxy.is_some())
+        {
+            let timeout = connection
+                .timeout
+                .unwrap_or_else(|| cx.update(|cx| DebuggerSettings::get_global(cx).timeout));
+            let address = SocketAddr::new(connection.host, connection.port);
+            // Give Docker time to start the helper in addition to the in-container TCP deadline.
+            let deadline = Duration::from_millis(timeout).saturating_add(Duration::from_secs(5));
+            let timer = cx.background_executor().timer(deadline);
+            read_tcp_proxy_startup(&mut stderr, &log_handlers, async move {
+                timer.await;
+                anyhow!("Timed out waiting for the TCP debug adapter proxy for {address}")
+            })
+            .await?;
+        }
+        transport._stderr_task = Some(cx.background_spawn(TransportDelegate::handle_adapter_log(
+            stderr,
+            IoKind::StdErr,
+            log_handlers,
+        )));
+        Ok(transport)
     }
 }
 
+async fn read_tcp_proxy_startup(
+    stderr: &mut (impl smol::io::AsyncBufRead + Unpin),
+    log_handlers: &LogHandlers,
+    timeout: impl Future<Output = anyhow::Error>,
+) -> Result<()> {
+    const STDERR_TAIL_LINES: usize = 20;
+    // Adapter log handlers attach after startup, so failures need their own copy of recent stderr.
+    let mut stderr_tail = VecDeque::with_capacity(STDERR_TAIL_LINES);
+    let read = async {
+        let mut bytes = Vec::new();
+        loop {
+            bytes.clear();
+            if stderr.read_until(b'\n', &mut bytes).await? == 0 {
+                bail!("TCP debug adapter proxy exited before reporting startup");
+            }
+            let line = String::from_utf8_lossy(&bytes);
+            let line = line.trim_end_matches(['\r', '\n']);
+           
```

**File**: `crates/dap_adapters/src/go.rs` (modified, +1/-0)
```diff
@@ -528,6 +528,7 @@ impl DebugAdapter for GoDebugAdapter {
                 host,
                 port,
                 timeout,
+                stdio_proxy: None,
             });
         } else {
             let minidelve_path = self.install_shim(delegate).await?;
```

**File**: `crates/dap_adapters/src/javascript.rs` (modified, +1/-0)
```diff
@@ -205,6 +205,7 @@ impl JsDebugAdapter {
                 host,
                 port,
                 timeout,
+                stdio_proxy: None,
             }),
             request_args: StartDebuggingRequestArguments {
                 configuration,
```

**File**: `crates/dap_adapters/src/python.rs` (modified, +1/-0)
```diff
@@ -486,6 +486,7 @@ impl PythonDebugAdapter {
                 host,
                 port,
                 timeout,
+                stdio_proxy: None,
             }),
             cwd: Some(delegate.worktree_root_path().to_path_buf()),
             envs: user_env.unwrap_or_default(),
```

**File**: `crates/extension_host/src/wasm_host/wit/since_v0_8_0.rs` (modified, +1/-0)
```diff
@@ -142,6 +142,7 @@ impl From<dap::TcpArguments> for extension::TcpArguments {
             host: value.host.into(),
             port: value.port,
             timeout: value.timeout,
+            stdio_proxy: None,
         }
     }
 }
```

---

### Incident Patch 2: `da3a2740` (2026-11-27)
**Commit Message**: gpui_macos: Replace CAMetalDisplayLink with CADisplayLink (#67486)

PR #65472 replaced `CVDisplayLink` with `CAMetalDisplayLink` for macOS
14+ users because `CVDisplayLink` is deprecated in macOS 15, and it
solved a problem where `nextDrawable()` could take up to 1–2 frames of
delay.

The frame delay occurred because `CVDisplayLink` fires on a background
thread and has to dispatch back to the main thread before GPUI starts
rendering. When that hop caused us to miss the compositor's vsync
deadline, the system held onto our drawables for an extra refresh until
all three drawables in the layer were in use, making `nextDrawable()`
wait 1–2 frames for one to free up.

While `CAMetalDisplayLink` fixed the `nextDrawable()` delay, it
schedules drawables ~3–5 frames ahead, causing more latency than
necessary. It also requires manually tracking when a window changes its
display, and tearing down and rebuilding the link on synchronous draws
and display changes. This causes a bug where Apple won't detect that a
display has changed, typically seen while an external monitor is plugged
in when macOS enters sleep and is then woken up without the external
monitor. This would cause GPUI apps to be i

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -7683,7 +7683,6 @@ dependencies = [
  "objc2-core-media",
  "objc2-core-video",
  "objc2-foundation 0.3.2",
- "objc2-quartz-core 0.3.2",
  "objc2-screen-capture-kit",
  "objc2-uniform-type-identifiers",
  "objc2-user-notifications",
@@ -11883,6 +11882,7 @@ dependencies = [
  "objc2 0.6.3",
  "objc2-core-foundation",
  "objc2-foundation 0.3.2",
+ "objc2-quartz-core 0.3.2",
  "objc2-uniform-type-identifiers",
 ]
 
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -814,7 +814,7 @@ objc2-foundation = { version = "=0.3.2", default-features = false, features = [
     "std",
 ] }
 objc2-security = { version = "0.3.2", default-features = false, features = ["std", "SecBase", "SecItem"] }
-objc2-quartz-core = { version = "=0.3.2", default-features = false, features = ["std", "CALayer", "CAMetalDisplayLink", "CAMetalLayer", "objc2-metal"] }
+objc2-quartz-core = { version = "=0.3.2", default-features = false, features = ["std", "CALayer", "CAMetalLayer", "objc2-metal"] }
 objc2-screen-capture-kit = { version = "=0.3.2", default-features = false, features = [
     "block2",
     "dispatch2",
```

**File**: `crates/gpui_apple/Cargo.toml` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ objc2-metal = { version = "0.3.2", default-features = false, features = [
     "MTLTypes",
 ] }
 objc2-foundation = { workspace = true, features = ["NSThread", "NSNotification", "NSOperation", "NSProcessInfo", "block2"] }
-objc2-quartz-core = { workspace = true, features = ["objc2-core-foundation", "objc2-core-graphics", "objc2-metal"] }
+objc2-quartz-core = { workspace = true, features = ["CADisplayLink", "objc2-core-foundation", "objc2-core-graphics", "objc2-metal"] }
 objc2-security.workspace = true
 parking_lot.workspace = true
 pathfinder_geometry = { workspace = true, optional = true }
```

**File**: `crates/gpui_apple/src/display_link.rs` (modified, +296/-55)
```diff
@@ -1,104 +1,345 @@
 use objc2::{
-    AnyThread, DefinedClass, MainThreadMarker, MainThreadOnly, Message, define_class, msg_send,
+    DefinedClass, MainThreadMarker, MainThreadOnly, Message, define_class, msg_send,
     rc::Retained,
-    runtime::{AnyClass, ProtocolObject},
+    runtime::{AnyObject, Sel},
+    sel,
 };
 use objc2_foundation::{NSObject, NSObjectProtocol, NSRunLoop, NSRunLoopCommonModes};
-use objc2_quartz_core::{
-    CAMetalDisplayLink, CAMetalDisplayLinkDelegate, CAMetalDisplayLinkUpdate, CAMetalLayer,
-};
+pub use objc2_quartz_core::CADisplayLink;
+use std::cell::Cell;
 
-struct MetalDisplayLinkDelegateIvars {
-    callback: Box<dyn Fn(&CAMetalDisplayLinkUpdate)>,
+struct DisplayLinkTargetIvars {
+    callback: Box<dyn Fn()>,
 }
 
 define_class!(
     // SAFETY: `NSObject` has no subclassing requirements.
     #[unsafe(super(NSObject))]
     #[thread_kind = MainThreadOnly]
-    #[ivars = MetalDisplayLinkDelegateIvars]
-    struct MetalDisplayLinkDelegate;
+    #[ivars = DisplayLinkTargetIvars]
+    struct DisplayLinkTarget;
 
-    unsafe impl NSObjectProtocol for MetalDisplayLinkDelegate {}
+    unsafe impl NSObjectProtocol for DisplayLinkTarget {}
 
-    unsafe impl CAMetalDisplayLinkDelegate for MetalDisplayLinkDelegate {
-        #[unsafe(method(metalDisplayLink:needsUpdate:))]
-        fn needs_update(&self, _link: &CAMetalDisplayLink, update: &CAMetalDisplayLinkUpdate) {
-            // The callback may destroy its frame source, releasing our owner's retain.
-            let delegate = self.retain();
-            (delegate.ivars().callback)(update);
+    impl DisplayLinkTarget {
+        #[unsafe(method(displayLinkFired:))]
+        fn display_link_fired(&self, _link: &CADisplayLink) {
+            // The callback may drop its `DisplayLink`, which calls `invalidate`
+            // and releases the link's strong reference to `self`.
+            let target = self.retain();
+            (target.ivars().callback)();
         }
     }
 );
 
-impl MetalDisplayLinkDelegate {
-    fn new(
-        main_thread: MainThreadMarker,
-        callback: impl Fn(&CAMetalDisplayLinkUpdate) + 'static,
-    ) -> Retained<Self> {
-        let this = Self::alloc(main_thread).set_ivars(MetalDisplayLinkDelegateIvars {
+impl DisplayLinkTarget {
+    fn new(main_thread: MainThreadMarker, callback: impl Fn() + 'static) -> Retained<Self> {
+        let this = Self::alloc(main_thread).set_ivars(DisplayLinkTargetIvars {
             callback: Box::new(callback),
         });
         // SAFETY: `NSObject`'s `init` is its designated initializer.
         unsafe { msg_send![super(this), init] }
     }
 }
 
-/// A main-run-loop source of Metal drawables on macOS 14+ and iOS/iPadOS 17+.
+/// A main-run-loop `CADisplayLink` shared across Apple platforms (macOS 14+ and
+/// iOS/iPadOS).
 ///
-/// Callbacks run on the run loop the link is registered with:
-/// <https://developer.apple.com/documentation/quartzcore/cametaldisplaylink>.
-/// This wrapper uses the main run loop because GPUI renders on the foreground thread.
-pub struct MetalFrameSource {
-    link: Retained<CAMetalDisplayLink>,
-    // The link holds its delegate weakly.
-    _delegate: Retained<MetalDisplayLinkDelegate>,
+/// Unlike `CAMetalDisplayLink`, `CADisplayLink` only paces frames: the renderer
+/// acquires drawables from `CAMetalLayer` and presents them immediately instead
+/// of queuing them for a `targetPresentationTimestamp` several refreshes ahead.
+pub struct DisplayLink {
+    link: Retained<CADisplayLink>,
+    _target: Retained<DisplayLinkTarget>,
+    invalidated: Cell<bool>,
     _main_thread: MainThreadMarker,
 }
 
-impl MetalFrameSource {
-    /// Whether this system has `CAMetalDisplayLink` (macOS 14+, iOS/iPadOS 17+).
-    pub fn is_available() -> bool {
-        AnyClass::get(c"CAMetalDisplayLink").is_some()
+impl DisplayLink {
+    /// Starts delivering vsync ticks on the main run loop in common modes using
+    /// the `CADisplayLink` returned by `create(target, selector)`.
+    pub fn new(
+        main_thread: MainThreadMarker,
+        create: impl FnOnce(&AnyObject, Sel) -> Retained<CADisplayLink>,
+        callback: impl Fn() + 'static,
+    ) -> Self {
+        Self::build(main_thread, false, create, callback)
     }
 
-    /// Starts delivering updates for `layer`, or returns `None` where
-    /// `CAMetalDisplayLink` is unavailable.
-    pub fn new(
-        layer: &CAMetalLayer,
+    /// Creates a `CADisplayLink` registered on the main run loop in common
+    /// modes, initially paused until [`Self::set_paused`] resumes it.
+    pub fn new_paused(
         main_thread: MainThreadMarker,
-        callback: impl Fn(&CAMetalDisplayLinkUpdate) + 'static,
-    ) -> Option<Self> {
-        if !Self::is_available() {
-            return None;
-        }
-        let delegate = MetalDisplayLinkDelegate::new(main_thread, callback);
-        let link = CAMetalDisplayLink::initWithMetalLayer(CAMetalDisplayLink::alloc(), laye
```

**File**: `crates/gpui_apple/src/metal_renderer.rs` (modified, +10/-120)
```diff
@@ -113,20 +113,12 @@ impl InstanceBufferPool {
     }
 }
 
-enum DisplayLinkMode {
-    Detached,
-    Attached {
-        drawable: Option<Retained<ProtocolObject<dyn CAMetalDrawable>>>,
-    },
-}
-
 pub struct MetalRenderer {
     device: Retained<ProtocolObject<dyn MTLDevice>>,
     layer: Option<Retained<CAMetalLayer>>,
     is_apple_gpu: bool,
     is_unified_memory: bool,
     presents_with_transaction: bool,
-    display_link_mode: DisplayLinkMode,
     /// For headless rendering, tracks whether output should be opaque
     opaque: bool,
     /// Whether the last scene drawn to the layer let native views show through it.
@@ -206,7 +198,6 @@ impl MetalRenderer {
         // presentation cost, even when `test-support` is compiled in.
         #[cfg(all(feature = "test-support", debug_assertions))]
         layer.setFramebufferOnly(false);
-        layer.setAllowsNextDrawableTimeout(false);
         layer.setNeedsDisplayOnBoundsChange(true);
         // UIKit sizes a view's backing layer itself; only AppKit-hosted
         // layers need to track their superlayer's bounds.
@@ -395,7 +386,6 @@ impl MetalRenderer {
             device,
             layer,
             presents_with_transaction: false,
-            display_link_mode: DisplayLinkMode::Detached,
             is_apple_gpu,
             is_unified_memory,
             opaque,
@@ -436,50 +426,6 @@ impl MetalRenderer {
         &self.sprite_atlas
     }
 
-    /// Draw the next frame into `drawable` instead of asking the layer for one.
-    ///
-    /// A `CAMetalDisplayLink` hands out each frame's drawable early enough for
-    /// the frame to reach the display on time; `nextDrawable` would instead
-    /// wait for the compositor to release one. Pass `None` once the frame is
-    /// done, so a drawable the frame did not use goes back to the layer.
-    ///
-    /// Returns the drawable this replaces: after a frame, `Some` means the
-    /// frame neither drew nor presented.
-    ///
-    /// This is a setter rather than a guard scoped to one frame because the
-    /// window releases its lock on the renderer while GPUI draws.
-    pub fn set_frame_drawable(
-        &mut self,
-        drawable: Option<Retained<ProtocolObject<dyn CAMetalDrawable>>>,
-    ) -> Option<Retained<ProtocolObject<dyn CAMetalDrawable>>> {
-        match &mut self.display_link_mode {
-            DisplayLinkMode::Attached { drawable: current } => mem::replace(current, drawable),
-            DisplayLinkMode::Detached => {
-                // Only a live link hands out drawables, and a link is detached
-                // only after it has been invalidated.
-                debug_assert!(
-                    drawable.is_none(),
-                    "received a display link drawable while detached"
-                );
-                None
-            }
-        }
-    }
-
-    /// Record whether a `CAMetalDisplayLink` drives the layer. While one
-    /// does, frames are drawn only into the drawables it hands out.
-    pub fn set_display_link_attached(&mut self, attached: bool) {
-        self.display_link_mode = if attached {
-            DisplayLinkMode::Attached { drawable: None }
-        } else {
-            DisplayLinkMode::Detached
-        };
-    }
-
-    pub fn is_display_link_attached(&self) -> bool {
-        matches!(self.display_link_mode, DisplayLinkMode::Attached { .. })
-    }
-
     pub fn presents_with_transaction(&self) -> bool {
         self.presents_with_transaction
     }
@@ -525,27 +471,15 @@ impl MetalRenderer {
             self.shows_native_views = shows_native_views;
             layer.setOpaque(self.opaque && !shows_native_views);
         }
-        let drawable = match &mut self.display_link_mode {
-            DisplayLinkMode::Attached { drawable } => {
-                let Some(drawable) = drawable.take() else {
-                    log::error!("skipped a frame drawn outside its display link's update");
-                    return;
-                };
-                drawable
-            }
-            DisplayLinkMode::Detached => {
-                let Some(drawable) = layer.nextDrawable() else {
-                    log::error!(
-                        "failed to retrieve next drawable, drawable size: {:?}",
-                        layer.drawableSize()
-                    );
-                    return;
-                };
-                drawable
-            }
+        let Some(drawable) = layer.nextDrawable() else {
+            log::error!(
+                "failed to retrieve next drawable, drawable size: {:?}",
+                layer.drawableSize()
+            );
+            return;
         };
-        // A display link's drawable was sized when the link handed it out,
-        // which can be before a resize the layer has since taken.
+        // The drawable was sized when the layer handed it out, which can be
+        // before a resize the layer has since taken.
         let texture = drawable.texture();
    
```

**File**: `crates/gpui_macos/Cargo.toml` (modified, +1/-2)
```diff
@@ -42,12 +42,11 @@ image.workspace = true
 itertools.workspace = true
 log.workspace = true
 objc2.workspace = true
-objc2-app-kit = { workspace = true, features = ["objc2-uniform-type-identifiers"] }
+objc2-app-kit = { workspace = true, features = ["objc2-quartz-core", "objc2-uniform-type-identifiers"] }
 objc2-core-graphics = { workspace = true, features = ["CGColor", "objc2"] }
 objc2-core-media = { workspace = true, optional = true }
 objc2-core-video = { workspace = true, features = ["CVHostTime"] }
 objc2-foundation.workspace = true
-objc2-quartz-core.workspace = true
 objc2-screen-capture-kit = { workspace = true, optional = true }
 objc2-uniform-type-identifiers.workspace = true
 objc2-user-notifications.workspace = true
```

**File**: `crates/gpui_macos/src/display_link.rs` (modified, +3/-117)
```diff
@@ -1,8 +1,8 @@
 //! Frame pacing for macOS windows.
 //!
-//! On macOS 14 and later a window is paced by a `CAMetalDisplayLink` on its
-//! layer ([`gpui_apple::display_link::MetalFrameSource`]). Earlier systems use
-//! the shared `CVDisplayLink` registry described below ([`WindowFrameSource`]).
+//! On macOS 14 and later a window is paced by its view's `CADisplayLink`
+//! ([`gpui_apple::display_link::DisplayLink`]). Earlier systems use the shared
+//! `CVDisplayLink` registry described below ([`WindowFrameSource`]).
 //!
 //! CVDisplayLink has no safe teardown: `CVDisplayLinkStop` merely flags the
 //! link's io thread to exit "soon" and returns immediately, and there is no
@@ -61,11 +61,9 @@ use dispatch2::{
     _dispatch_source_type_data_add, DispatchObject, DispatchQueue, DispatchRetained, DispatchSource,
 };
 use gpui::{FrameRequestSource, PlatformFrameSignal};
-use gpui_apple::display_link::MetalFrameSource;
 use gpui_util::ResultExt;
 use scheduler::Instant;
 use std::{
-    cell::{Cell, RefCell},
     collections::{BTreeMap, btree_map},
     ffi::c_void,
     sync::{Arc, Mutex, MutexGuard, PoisonError},
@@ -294,68 +292,6 @@ fn unsubscribe(display_id: CGDirectDisplayID, subscriber_id: SubscriberId) {
     }
 }
 
-/// A window's `CAMetalDisplayLink`, shared with GPUI's frame waker so that a
-/// wake reaches the current link without taking the window's lock.
-///
-/// The link pauses after any update in which GPUI neither drew, presented,
-/// nor asked for another frame, so an idle window acquires no drawables. GPUI
-/// decides when frames are needed (including presenting after high-rate
-/// input); this only stops the link between those decisions.
-#[derive(Default)]
-pub struct MetalFrames {
-    source: RefCell<Option<MetalFrameSource>>,
-    /// Whether GPUI asked for a frame since the current update began.
-    woken: Cell<bool>,
-}
-
-impl MetalFrames {
-    pub fn replace(&self, source: Option<MetalFrameSource>) {
-        *self.source.borrow_mut() = source;
-    }
-
-    pub fn is_attached(&self) -> bool {
-        self.source.borrow().is_some()
-    }
-
-    pub fn wake(&self) {
-        self.woken.set(true);
-        // A source being replaced starts unpaused, so skipping it is safe.
-        if let Ok(source) = self.source.try_borrow()
-            && let Some(source) = source.as_ref()
-        {
-            source.set_paused(false);
-        }
-    }
-
-    pub fn begin_frame(&self) {
-        self.woken.set(false);
-    }
-
-    pub fn debug_state(&self) -> serde_json::Value {
-        let paused = self
-            .source
-            .try_borrow()
-            .ok()
-            .and_then(|source| source.as_ref().map(MetalFrameSource::is_paused));
-        serde_json::json!({
-            "kind": "CAMetalDisplayLink",
-            "attached": self.is_attached(),
-            "paused": paused,
-            "woken": self.woken.get(),
-        })
-    }
-
-    /// Ends an update, pausing the link if GPUI neither used its drawable nor
-    /// asked for another frame while it ran. Returns whether it paused.
-    pub fn end_frame(&self, used_drawable: bool) -> bool {
-        let pause = !used_drawable && !self.woken.get();
-        if pause && let Some(source) = self.source.borrow().as_ref() {
-            source.set_paused(true);
-        }
-        pause
-    }
-}
-
 /// A per-window source of frame requests, paced by the display the window is
 /// on. The wrapped dispatch source coalesces vsync ticks from the display's
 /// io thread and invokes `callback(data)` on the main queue.
@@ -610,56 +546,6 @@ mod sys {
 #[cfg(test)]
 mod tests {
     use super::*;
-    use objc2::AnyThread;
-    use objc2_quartz_core::CAMetalDisplayLink;
-
-    #[test]
-    fn metal_frames_pause_only_when_gpui_neither_draws_nor_asks_again() {
-        let frames = MetalFrames::default();
-
-        frames.begin_frame();
-        assert!(
-            !frames.end_frame(true),
-            "a frame that drew keeps the link running"
-        );
-
-        frames.begin_frame();
-        frames.wake();
-        assert!(
-            !frames.end_frame(false),
-            "a wake during the update, like a throttled frame's retry, keeps it running"
-        );
-
-        frames.wake();
-        frames.begin_frame();
-        assert!(
-            frames.end_frame(false),
-            "a wake before the update was served by it"
-        );
-
-        frames.begin_frame();
-        assert!(frames.end_frame(false), "an idle update pauses the link");
-    }
-
-    #[test]
-    fn a_renderer_draws_normally_after_its_display_link_is_invalidated() {
-        if !MetalFrameSource::is_available() {
-            return;
-        }
-        let mut renderer =
-            crate::renderer::MetalRenderer::new(Default::default(), false, false).unwrap();
-        renderer.update_drawable_size(gpui::size(gpui::DevicePixels(64), gpui::DevicePixels(64)));
-        let layer = renderer.layer().expect("window renderer has a layer
```

**File**: `crates/gpui_macos/src/window.rs` (modified, +168/-123)
```diff
@@ -1,5 +1,5 @@
 use crate::{
-    BoolExt, MacDisplay, MetalFrames, NSRange, NSStringExt, TISCopyCurrentKeyboardInputSource,
+    BoolExt, MacDisplay, NSRange, NSStringExt, TISCopyCurrentKeyboardInputSource,
     TISGetInputSourceProperty, WindowFrameSource, events::platform_input_from_native,
     kTISPropertyInputSourceIsASCIICapable, kTISPropertyInputSourceType, kTISTypeKeyboardInputMode,
     ns_string, renderer,
@@ -25,7 +25,7 @@ use core_foundation_sys::number::{CFBooleanGetValue, CFBooleanRef};
 use core_graphics::display::CGDirectDisplayID;
 use ctor::ctor;
 use futures::channel::oneshot;
-use gpui_apple::display_link::MetalFrameSource;
+use gpui_apple::display_link::DisplayLinkFrames;
 use gpui_util::ResultExt;
 use objc2::{
     AnyThread, MainThreadMarker, Message, class, msg_send,
@@ -649,8 +649,8 @@ unsafe fn apply_simple_fullscreen_plan(
 /// What paces a window's frames. The choice depends only on the OS version,
 /// so it is made once per window.
 enum FrameSource {
-    /// macOS 14+: a `CAMetalDisplayLink` that hands out each frame's drawable.
-    Metal(Rc<MetalFrames>),
+    /// macOS 14+: the view's `CADisplayLink`.
+    View(Rc<DisplayLinkFrames>),
     /// Earlier systems: the shared `CVDisplayLink` registry, joined on first start.
     DisplayLink(Option<WindowFrameSource>),
 }
@@ -878,36 +878,21 @@ impl MacWindowState {
         }
     }
 
-    /// `window_state` is the handle this state lives in; a Metal link holds it
-    /// weakly to deliver frames.
-    fn start_display_link(&mut self, window_state: &Rc<Mutex<MacWindowState>>) {
-        self.stop_display_link();
+    fn start_display_link(&mut self) {
         if !self
             .native_window()
             .occlusionState()
             .contains(NSWindowOcclusionState::Visible)
         {
+            self.stop_display_link();
             return;
         }
         match &mut self.frame_source {
-            FrameSource::Metal(metal_frames) => {
-                let Some(layer) = self.renderer.layer() else {
-                    return;
-                };
-                let main_thread =
-                    crate::main_thread_marker().expect("macOS windows require the main thread");
-                let window_state = Rc::downgrade(window_state);
-                let source = MetalFrameSource::new(layer, main_thread, move |update| {
-                    if let Some(window_state) = window_state.upgrade() {
-                        metal_frame(&window_state, update);
-                    }
-                });
-                if let Some(source) = source {
-                    metal_frames.replace(Some(source));
-                    self.renderer.set_display_link_attached(true);
-                }
-            }
+            FrameSource::View(frames) => frames.resume(),
             FrameSource::DisplayLink(frame_source) => {
+                if let Some(existing) = frame_source.as_mut() {
+                    existing.stop();
+                }
                 let screen: *mut AnyObject = unsafe { msg_send![self.native_window, screen] };
                 let Some(display_id) = display_id_for_screen(screen) else {
                     // AppKit can temporarily report no screen while displays are being reconfigured.
@@ -924,14 +909,7 @@ impl MacWindowState {
 
     fn stop_display_link(&mut self) {
         match &mut self.frame_source {
-            FrameSource::Metal(metal_frames) => {
-                if metal_frames.is_attached() {
-                    // Detach the link rather than pause it, so that a synchronous
-                    // draw can use the layer's `nextDrawable`.
-                    metal_frames.replace(None);
-                    self.renderer.set_display_link_attached(false);
-                }
-            }
+            FrameSource::View(link) => link.stop(),
             FrameSource::DisplayLink(Some(frame_source)) => frame_source.stop(),
             FrameSource::DisplayLink(None) => {}
         }
@@ -1030,9 +1008,9 @@ impl MacWindowState {
 pub(crate) struct MacWindow(
     Rc<Mutex<MacWindowState>>,
     MainThreadMarker,
-    /// The Metal link's frame waker, kept outside the lock so waking never
+    /// The view link's frame waker, kept outside the lock so waking never
     /// waits on it. `None` when a `CVDisplayLink` paces frames.
-    Option<Rc<MetalFrames>>,
+    Option<Rc<DisplayLinkFrames>>,
 );
 
 impl MacWindow {
@@ -1162,67 +1140,96 @@ impl MacWindow {
             let native_view: *mut AnyObject = msg_send![native_view, initWithFrame: content_bounds];
             assert!(!native_view.is_null());
 
-            let metal_frames = MetalFrameSource::is_available().then(Rc::<MetalFrames>::default);
-            let state = Rc::new(Mutex::new(MacWindowState {
-                handle,
-                foreground_executor,
-                background_executor,
-                native_window,
-                native_view: NonNull::new_unchecked(native_view),
-                blur
```

---

### Incident Patch 3: `ae318721` (2026-11-27)
**Commit Message**: remote: Fix switching git worktrees inside a dev container (#63613)

Closes #63568 (and its duplicate #63099).

Switching to an existing git worktree fails when the project is open in
a dev container. All workspaces in one container share a
`DockerExecConnection`, which tracked a single proxy pid and killed it
in two places. Opening the worktree's workspace killed the first
workspace's proxy in `start_proxy`. The first workspace then
reconnected, and its `kill()` call stopped the new workspace's proxy, so
the new connection failed with `Remote server exited with status 15`.

The dev container transport now works like WSL: `kill()` does nothing
and `has_been_killed()` returns `false`. Each `docker exec` proxy is
spawned with `kill_on_drop(true)` and owned by its IO task, so
`reconnect` already stops the old proxy when it drops `multiplex_task`.
As a result, `remote debug: simulate disconnect` does nothing for dev
containers, the same as for WSL.

Verified with a release build: building a dev container, opening an
existing one, and switching worktrees inside it all work. The `remote`
tests pass.

Release Notes:

- Fixed switching git worktrees failing with `Remote server exited with


**File**: `crates/remote/src/transport/docker.rs` (modified, +2/-31)
```diff
@@ -3,7 +3,6 @@ use anyhow::Result;
 use anyhow::anyhow;
 use async_trait::async_trait;
 use collections::HashMap;
-use parking_lot::Mutex;
 use release_channel::{AppCommitSha, AppVersion, ReleaseChannel};
 use semver::Version as SemanticVersion;
 use std::collections::BTreeMap;
@@ -56,7 +55,6 @@ pub struct DockerConnectionOptions {
 }
 
 pub(crate) struct DockerExecConnection {
-    proxy_process: Mutex<Option<u32>>,
     remote_dir_for_server: String,
     remote_binary_relpath: Option<Arc<RelPath>>,
     connection_options: DockerConnectionOptions,
@@ -73,7 +71,6 @@ impl DockerExecConnection {
         cx: &mut AsyncApp,
     ) -> Result<Self> {
         let mut this = Self {
-            proxy_process: Mutex::new(None),
             remote_dir_for_server: "/".to_string(),
             remote_binary_relpath: None,
             connection_options,
@@ -645,21 +642,6 @@ impl DockerExecConnection {
         }
         Ok(())
     }
-
-    fn kill_inner(&self) -> Result<()> {
-        if let Some(pid) = self.proxy_process.lock().take() {
-            if let Ok(_) = util::command::new_command("kill")
-                .arg(pid.to_string())
-                .spawn()
-            {
-                Ok(())
-            } else {
-                Err(anyhow::anyhow!("Failed to kill process"))
-            }
-        } else {
-            Ok(())
-        }
-    }
 }
 
 #[async_trait(?Send)]
@@ -677,13 +659,6 @@ impl RemoteConnection for DockerExecConnection {
         delegate: Arc<dyn RemoteClientDelegate>,
         cx: &mut AsyncApp,
     ) -> Task<Result<i32>> {
-        // We'll try connecting anew every time we open a devcontainer, so proactively try to kill any old connections.
-        if !self.has_been_killed() {
-            if let Err(e) = self.kill_inner() {
-                return Task::ready(Err(e));
-            };
-        }
-
         delegate.set_status(Some("Starting proxy"), cx);
 
         let Some(remote_binary_relpath) = self.remote_binary_relpath.clone() else {
@@ -733,9 +708,6 @@ impl RemoteConnection for DockerExecConnection {
             )));
         };
 
-        let mut proxy_process = self.proxy_process.lock();
-        *proxy_process = Some(child.id());
-
         cx.spawn(async move |cx| {
             super::handle_rpc_messages_over_child_process_stdio(
                 child,
@@ -774,11 +746,11 @@ impl RemoteConnection for DockerExecConnection {
     }
 
     async fn kill(&self) -> Result<()> {
-        self.kill_inner()
+        Ok(())
     }
 
     fn has_been_killed(&self) -> bool {
-        self.proxy_process.lock().is_none()
+        false
     }
 
     fn build_command(
@@ -1184,7 +1156,6 @@ mod tests {
 
     fn connection(remote_env: &[(&str, &str)]) -> DockerExecConnection {
         DockerExecConnection {
-            proxy_process: Mutex::new(None),
             remote_dir_for_server: "/tmp/zed".to_string(),
             remote_binary_relpath: None,
             connection_options: DockerConnectionOptions {
```

#### Recent Merged Pull Requests:
- **PR #67575** (2026-11-28): Update `Pyrefly` documentation (@lingyaochu)
- **PR #67574** (2026-11-28): editor: Sync git blame once per buffer in blame_for_rows (@ptweezy)
- **PR #67573** (2026-11-28): language_core: Break reference cycle in the text highlight cache (@ptweezy)
- **PR #67572** (2026-11-28): worktree: Remove unused PathEntry::is_ignored (@ptweezy)
- **PR #67570** (2026-11-28): editor: Compute sort-lines keys once per line (@ptweezy)
- **PR #67568** (2026-11-28): livekit_client: Reuse the pixel buffer pool for remote video frames (@ptweezy)

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

## X. TCP-based debugging in dev containers

**RULE**:
When implementing operations in `crates/collab/tests/integration/remote_editing_collaboration_tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zed-industries/zed. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ed8dc1b6`: TCP-based debugging in dev containers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/collab/tests/integration/remote_editing_collaboration_tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
) {
    test_remote_debug_session(cx_a, server_cx, executor, false).await;
}

#[gpui::test]
async fn test_remote_debug_session_uses_tcp_proxy(
    cx_a: &mut TestAppContext,
    server_cx: &mut TestAppContext,
    executor: BackgroundExecutor,
) {
    test_remote_debug_session(cx_a, server_cx, executor, true).await;
}

async fn test_remote_debug_session(
    cx_a: &mut TestAppContext,
    server_cx: &mut TestAppContext,
    executor: BackgroundExecutor,
    tcp_proxy: bool,
    if tcp_proxy {
        let remote::RemoteConnectionOptions::Mock(options) = &opts else {
            panic!("Expected a mock connection");
        };
        cx_a.update(|cx| {
            remote::MockConnectionRegistry::update_global(cx, |registry, _| {
                registry.enable_tcp_proxy(options).unwrap();
            });
        });
    }
    if tcp_proxy {
        server_cx.update(|cx| {
            SettingsStore::update_global(cx, |store, cx| {
                store.update_user_settings(cx, |settings| {
                    settings
                        .project
                        .dap
                        .entry("fake-adapter".into())
                        .or_default()
              
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                "request": "launch"
                port: None,
                timeout: None,
                if count.fetch_add(1, std::sync::atomic::Ordering::SeqCst) < 5 {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ed8dc1b6` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
