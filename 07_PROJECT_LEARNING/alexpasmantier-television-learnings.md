# Forensic Learning Record (Deep Inspection): alexpasmantier/television

> **Canonical Artifact**: `07_PROJECT_LEARNING/alexpasmantier-television-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alexpasmantier/television](https://github.com/alexpasmantier/television))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:27:05.430Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alexpasmantier/television`
- **Description**: A very fast, portable and hackable fuzzy finder.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6327 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/main/render.rs`
```
use criterion::Criterion;
use criterion::criterion_group;
use std::hint::black_box;
use std::sync::Arc;
use television::channels::prototypes::ChannelPrototype;
use television::config::layers::ConfigLayers;
use television::frecency::Frecency;
use television::{
    cable::Cable,
    cli::PostProcessedCli,
    config::{Config, ConfigEnv},
    television::Television,
};

/// Benchmark a render cycle (context dump + drawing)
pub fn render(c: &mut Criterion) {
    use ratatui::Terminal;
    use ratatui::backend::TestBackend;
    use ratatui::layout::Rect;

    let width = 250;
    let height = 80;

    let cable = Cable::from_prototypes(vec![ChannelPrototype::new(
        "files", "fd -t f",
    )]);

    let config = Config::new(&ConfigEnv::init().unwrap(), None).unwrap();
    let backend = TestBackend::new(width, height);
    let mut terminal = Terminal::new(backend).unwrap();
    let (tx, _) = tokio::sync::mpsc::unbounded_channel();
    let channel_prototype = cable.get_channel("files");
    let layered_config = ConfigLayers::new(
        config.clone(),
        channel_prototype.clone(),
        PostProcessedCli::default(),
    );
    let frecency = Arc::new(Frecency::new(100, &config.application.data_dir));
    let mut tv = Television::new(tx, layered_config, cable.clone(), frecency);
    tv.find("visio");
    // just make sure we're in a steady state
    for _ in 0..5 {
        let _ = tv.channel.results(50, 0);
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    tv.update_results_picker_state();

    c.bench_function("render_cycle", |b| {
        b.iter(|| {
            let ctx = black_box(Box::new(tv.dump_context()));
            television::draw::draw(
                black_box(*ctx),
                black_box(&mut terminal.get_frame()),
                black_box(Rect::new(0, 0, width, height)),
            )
            .unwrap();
        });
    });
}

criterion_group!(benches, render);

```

### Core Architecture Module: `television/matcher/worker.rs`
```
use super::{MatcherConfig, Notify, PromoteTable, SortStrategy};
use frizbee::Match;
use parking_lot::{Mutex, RwLock};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
    mpsc,
};

pub(super) const INITIAL_CHUNK_SIZE: usize = 512 * 1024;

/// This caps how long a pass can run without publishing results or noticing new messages (pattern
/// changes, new items).
const MAX_CHUNK_SIZE: usize = 8 * 1024 * 1024;

/// The items and corresponding haystacks that have been pushed into the matcher so far.
///
/// The two are kept separate so that the haystacks can be passed as a contiguous slice to the
/// matcher.
///
/// This is shared between the background worker (writes new items and matches against the
/// haystacks) and the [`super::Matcher`] handle (which reads item data when assembling results).
///
/// The store is append-only.
pub(super) struct Store<I> {
    /// Bumped on every restart (see [`super::Matcher::restart`]) so that snapshots and injector
    /// batches computed for a previous store can be detected and discarded.
    pub(super) generation: u64,
    pub(super) items: Vec<I>,
    pub(super) haystacks: Vec<Box<str>>,
}

impl<I> Store<I> {
    pub(super) fn new(generation: u64) -> Self {
        Self {
            generation,
            items: Vec::new(),
            haystacks: Vec::new(),
        }
    }
}

/// The matches published in a [`Snapshot`].
pub(super) enum Matches {
    /// Every item in store, in the order they were ingested (and how many).
    All(u32),
    /// Same as [`Matches::All`], but with promoted entries materialized and sorted at the front of
    /// the list.
    AllWithPromoted {
        /// Total number of matched items, promoted entries included.
        total: u32,
        /// The promoted matches, in display order.
        promoted: Vec<Match>,
        /// The promoted store indices in ascending order, used to skip over
        /// promoted entries when indexing into the implicit remainder.
        by_index: Vec<u32>,
    },
    /// The matched items, ordered according to the sort strategy. The first
    /// `promoted` entries are the promoted prefix (see [`SortStrategy::Promoted`]).
    Sorted { matches: Vec<Match>, promoted: u32 },
}

impl Matches {
    pub(super) fn len(&self) -> usize {
        match self {
            Matches::All(count) => *count as usize,
            Matches::AllWithPromoted { total, .. } => *total as usize,
            Matches::Sorted { matches, .. } => matches.len(),
        }
    }

    #[allow(clippy::cast_possible_truncation)]
    pub(super) fn get(&self, index: u32) -> Option<Match> {
        match self {
            Matches::All(count) => {
                (index < *count).then(|| Match::from_index(index as usize))
            }
            Matches::AllWithPromoted {
                total,
                promoted,
                by_index,
            } => {
                if let Some(m) = promoted.get(index as usize) {
                    return Some(*m);
                }
                if index >= *total {
                    return None;
                }
                // The remainder is every store index in order minus the
                // promoted ones: walk the promoted indices to translate the
                // rank into a store index.
                let mut store_index = index - promoted.len() as u32;
                for &promoted_index in by_index {
                    if promoted_index <= store_index {
                        store_index += 1;
                    } else {
                        break;
                    }
                }
                Some(Match::from_index(store_index as usize))
            }
            Matches::Sorted { matches, .. } => {
                matches.get(index as usize).copied()
            }
        }
    }

    /// The store index of every match. `All` and `AllWithPromoted` hold the
    /// whole store, so no walk over the matches is needed there.
    pub(super) fn store_indices(&self) -> Vec<u32> {
        match self {
            Matches::All(count) => (0..*count).collect(),
            Matches::AllWithPromoted { total, .. } => (0..*total).collect(),
            Matches::Sorted { matches, .. } => {
                matches.iter().map(|m| m.index).collect()
            }
        }
    }

    /// The materialized matches and the length of their promoted prefix, if
    /// this snapshot holds any.
    fn as_sorted(&self) -> Option<(&[Match], u32)> {
        match self {
            Matches::All(_) | Matches::AllWithPromoted { .. } => None,
            Matches::Sorted { matches, promoted } => {
                Some((matches, *promoted))
            }
        }
    }
}

/// The result of a matcher pass, published by the background worker.
///
/// A long pass over a large store is published incrementally: the snapshot grows chunk by chunk
/// until the whole store has been matched.
pub(super) struct Snapshot {
    /// The store generation this snapshot was computed against (see [`Store::generation`]).
    pub(super) generation: u64,
    /// The raw pattern the matches were computed with.
    pub(super) pattern: String,
    /// The matched items, ordered according to the sort strategy.
    pub(super) matches: Matches,
}

impl Snapshot {
    pub(super) fn empty(generation: u64) -> Self {
        Self {
            generation,
            pattern: String::new(),
            matches: Matches::Sorted {
                matches: Vec::new(),
                promoted: 0,
            },
        }
    }
}

/// Messages sent from the Matcher and its injectors to the Worker.
pub(super) enum WorkerMessage<I> {
    NewPattern(String),
    /// A batch of items pushed through an injector, tagged with the store
    /// generation the injector was created for so that batches in flight
    /// across a restart can be discarded.
    NewItems {
        generation: u64,
        batch: Vec<(I, String)>,
    },
    /// A new store has been created (see [`super::Matcher::restart`]).
    Restart(Arc<RwLock<Store<I>>>),
    /// Wait for the worker to finish its current pass and report idle over the channel.
    WaitForIdle(mpsc::Sender<()>),
}

/// The background worker that owns the inner [`frizbee::Matcher`].
///
/// The worker blocks on its message channel and re-matches the store against the current pattern
/// whenever items are added, the pattern changes, or the matcher is restarted. Pending messages are
/// drained before each pass so that a burst of keystrokes or item batches results in a single pass
/// over the store with the latest state, which also acts as a natural debounce.
///
/// Passes over large stores are chunked: results are published after every chunk and messages
/// arriving mid-pass interrupt it (see [`Worker::match`]).
pub(super) struct Worker<I: Sync + Send + 'static> {
    store: Arc<RwLock<Store<I>>>,
    snapshot: Arc<Mutex<Arc<Snapshot>>>,
    running: Arc<AtomicBool>,
    /// Called after each published snapshot to wake the front-end
    notify: Notify,
    rx: mpsc::Receiver<WorkerMessage<I>>,
    matcher: frizbee::Matcher,
    pattern: String,
    sort_strategy: SortStrategy<I>,
    /// The matching behavior, needed to rebuild the matcher on pattern
    /// changes.
    config: MatcherConfig,
    /// Last item that was matched
    last_match_index: usize,
    /// Number of threads to use when matching.
    n_threads: usize,
    /// Size of the first chunk of a matching pass.
    initial_chunk_size: usize,
    /// Promote table sampled at the start of the current pass.
    promote_table: Option<PromoteTable>,
    /// Promoted matches accumulated by the current pass, tagged with their
    /// promote score and kept in display order.
    promoted_matches: Vec<(u64, Match)>,
}

impl<I> Worker<I>
where
    I: Sync + Send + 'static,
{
    #[allow(clippy::too_many_arguments)]
    pub(super) fn new(
        store: Arc<RwLock<Store<I>>>,
        snapshot: Arc<Mutex<Arc<Snapshot>>>,
        running: Arc<AtomicBool>,
        notify: Notify,
        rx: mpsc::Receiver<WorkerMessage<I>>,
        sort_strategy: SortStrategy<I>,
        config: MatcherConfig,
        n_threads: usize,
        initial_chunk_size: usize,
    ) -> Self {
        Self {
            store,
            snapshot,
            running,
            notify,
            rx,
            matcher: build_matcher("", config, &sort_strategy),
            pattern: String::new(),
            sort_strategy,
            config,
            last_match_index: 0,
            n_threads,
            initial_chunk_size,
            promote_table: None,
            promoted_matches: Vec::new(),
        }
    }

    pub(super) fn run(mut self) {
        // A message that interrupted a chunked matching pass (see `self.rematch`), to be processed
        // before the pass resumes.
        let mut next_message: Option<WorkerMessage<I>> = None;
        // Whether an interrupted pass still has items left to match.
        let mut pass_pending = false;
        let mut waiters: Vec<mpsc::Sender<()>> = Vec::new();

        loop {
            let message = match next_message.take() {
                Some(msg) => msg,
                None => match self.rx.recv() {
                    Ok(msg) => msg,
                    // The matcher handle and all of its injectors have been dropped, so
                    // the worker can exit.
                    Err(_) => return,
                },
            };
            self.running.store(true, Ordering::Relaxed);

            let mut dirty = self.handle_message(message, &mut waiters);
            // Gather all pending messages into a single matcher pass
            while let Ok(msg) = self.rx.try_recv() {
                dirty |= self.handle_message(msg, &mut waiters);
            }

            if dirty || pass_pending {
                next_message = self.r#match();
                pass_pending = next_message.is_some();
            }

            // Only report idle (and ack waiters) once the 
```

### Core Architecture Module: `television/previewer/state.rs`
```
use ratatui::text::Text;
use std::sync::Arc;

use crate::previewer::Preview;

#[derive(Debug, Clone, Default)]
pub struct PreviewState {
    pub enabled: bool,
    pub preview: Preview,
    pub scroll: u16,
}

const PREVIEW_MIN_SCROLL_LINES: u16 = 3;

impl PreviewState {
    pub fn new(enabled: bool, preview: Preview, scroll: u16) -> Self {
        PreviewState {
            enabled,
            preview,
            scroll,
        }
    }

    pub fn scroll_down(&mut self, offset: u16) {
        self.scroll = self.scroll.saturating_add(offset).min(
            self.preview
                .total_lines
                .saturating_sub(PREVIEW_MIN_SCROLL_LINES),
        );
    }

    pub fn scroll_up(&mut self, offset: u16) {
        self.scroll = self.scroll.saturating_sub(offset);
    }

    pub fn reset(&mut self) {
        self.preview = Preview::default();
        self.scroll = 0;
    }

    pub fn update(&mut self, preview: Preview, scroll: u16) {
        // cached previews for the same entry come back as the same `Arc`:
        // the pointer check skips the deep content comparison
        let content_changed =
            !Arc::ptr_eq(&self.preview.content, &preview.content)
                && self.preview.content != preview.content;
        if self.preview.entry_raw != preview.entry_raw
            || content_changed
            || self.preview.target_line != preview.target_line
        {
            self.preview = preview;
            self.scroll = scroll;
        }
    }

    // FIXME: does this really need to happen for every render?
    // What if we did it only when the preview content or scroll changes?
    pub fn for_render_context(&self, height: usize) -> Self {
        // only the visible lines are copied for the render context
        let content_len = self.preview.content.lines.len();
        let scroll = (self.scroll as usize).min(content_len);
        let num_lines = content_len.saturating_sub(scroll);
        let cropped_content: Text<'_> = self.preview.content.lines
            [scroll..scroll + num_lines.min(height)]
            .to_vec()
            .into();

        let adjusted_line_number = self
            .preview
            .target_line
            .map(|line| line.saturating_sub(self.scroll));

        PreviewState::new(
            self.enabled,
            Preview::new(
                self.preview.entry_raw.clone(),
                self.preview.formatted_command.clone(),
                &self.preview.title,
                Arc::new(cropped_content),
                adjusted_line_number,
                self.preview.total_lines,
                self.preview.footer.clone(),
                self.preview.preview_index,
                self.preview.preview_count,
            ),
            self.scroll,
        )
    }
}

```

### Core Architecture Module: `television/render.rs`
```
use std::io::Write;

use crate::{
    action::Action,
    draw::{Ctx, draw},
    screen::layout::Layout,
    tui::Tui,
};
use anyhow::Result;
use crossterm::{
    execute, queue,
    terminal::{BeginSynchronizedUpdate, EndSynchronizedUpdate},
};
use tokio::sync::mpsc;
use tracing::{debug, warn};

#[derive(Debug, Clone)]
pub enum RenderingTask {
    ClearScreen,
    Render(Box<Ctx>),
    Resize(u16, u16),
    Resume,
    Suspend,
    Quit,
}

#[derive(Default)]
/// The state of the UI after rendering.
///
/// This struct is returned by the UI thread to the main thread after each rendering cycle.
/// It contains information that the main thread might be able to exploit to make certain
/// decisions and optimizations.
pub struct UiState {
    pub layout: Layout,
}

impl UiState {
    pub fn new(layout: Layout) -> Self {
        Self { layout }
    }
}

/// The main UI rendering task loop.
///
/// This function is responsible for rendering the UI based on the rendering tasks it receives from
/// the main thread via `render_rx`.
///
/// This has a handle to the main action queue `action_tx` (for things like self-triggering
/// subsequent rendering instructions) and the UI state queue `ui_state_tx` to send back the layout
/// of the UI after each rendering cycle to the main thread to help make decisions and
/// optimizations.
///
/// When starting the rendering loop, a choice is made to either render to stdout or stderr based
/// on if the output is believed to be a TTY or not.
pub async fn render<W: Write>(
    mut render_rx: mpsc::UnboundedReceiver<RenderingTask>,
    action_tx: mpsc::UnboundedSender<Action>,
    ui_state_tx: mpsc::UnboundedSender<UiState>,
    mut tui: Tui<W>,
) -> Result<()> {
    let mut buffer = Vec::with_capacity(256);

    // Rendering loop
    'rendering: while render_rx.recv_many(&mut buffer, 256).await > 0 {
        // Only the last render instruction in the batch matters: pull it
        // out (its context is large, so no cloning) and process it after
        // the other tasks.
        let last_render = buffer
            .iter()
            .rposition(|e| matches!(e, RenderingTask::Render(_)))
            .map(|idx| buffer.remove(idx));

        for event in buffer
            .drain(..)
            .filter(|e| !matches!(e, RenderingTask::Render(_)))
            .chain(last_render)
        {
            match event {
                RenderingTask::ClearScreen => {
                    tui.clear()?;
                }
                RenderingTask::Render(context) => {
                    if let Ok(size) = tui.size() {
                        // Ratatui uses `u16`s to encode terminal dimensions and its
                        // content for each terminal cell is stored linearly in a
                        // buffer with a `u16` index which means we can't support
                        // terminal areas larger than `u16::MAX`.
                        if size.width.checked_mul(size.height).is_some() {
                            queue!(tui.backend_mut(), BeginSynchronizedUpdate)
                                .ok();
                            tui.terminal.draw(|frame| {
                                let current_layout = context.layout;
                                match draw(*context, frame, frame.area()) {
                                    Ok(layout) => {
                                        if layout != current_layout {
                                            let _ = ui_state_tx
                                                .send(UiState::new(layout));
                                        }
                                    }
                                    Err(err) => {
                                        warn!("Failed to draw: {:?}", err);
                                        let _ = action_tx.send(Action::Error(
                                            format!("Failed to draw: {err:?}"),
                                        ));
                                    }
                                }
                            })?;
                            execute!(tui.backend_mut(), EndSynchronizedUpdate)
                                .ok();
                        } else {
                            warn!("Terminal area too large");
                        }
                    }
                }
                RenderingTask::Resize(w, h) => {
                    tui.resize_viewport(w, h)?;
                    action_tx.send(Action::Render)?;
                }
                RenderingTask::Suspend => {
                    tui.suspend()?;
                    action_tx.send(Action::Resume)?;
                    action_tx.send(Action::ClearScreen)?;
                    tui.enter()?;
                }
                RenderingTask::Resume => {
                    tui.enter()?;
                }
                RenderingTask::Quit => {
                    debug!("Exiting rendering loop");
                    tui.exit()?;
                    break 'rendering;
                }
            }
        }
    }

    Ok(())
}

```

### Core Architecture Module: `television/utils/ansi.rs`
```
//! Compact storage for the styling of ANSI source lines.
//!
//! Channels whose source emits ANSI escape codes used to keep the raw line
//! next to the stripped one, which is what the matcher works on. That doubled
//! what a store costs for styling that only ever reaches a few dozen visible
//! rows. The escapes are parsed once at ingest instead: the text is kept
//! stripped and the styling is reduced to a handful of runs pointing into a
//! palette of interned styles.
//!
//! The stripped text comes out of the same parser `fast_strip_ansi` uses, so
//! haystacks are byte for byte what they were when the raw line was stripped
//! separately.

use parking_lot::RwLock;
use ratatui::style::{Color, Modifier, Style};
use rustc_hash::FxHashMap;
use smallvec::SmallVec;
use std::sync::Arc;
use vt_push_parser::{VT_PARSER_INTEREST_CSI, VTPushParser, event::VTEvent};

/// The style a line takes from a character offset onwards, as an index into
/// a [`StylePalette`].
pub type StyleRun = (u32, u16);

/// The style runs of a single line.
///
/// The inline capacity covers the common case without allocating: colored
/// `rg` output, the heaviest source we know of, is exactly 5 runs per line.
pub type StyleRuns = SmallVec<[StyleRun; 5]>;

/// The distinct styles seen in a channel's output.
///
/// Sources reuse a handful of styles across all their lines, so interning
/// them keeps a stored line's styling down to a few bytes per run.
#[derive(Debug, Default)]
pub struct StylePalette {
    styles: Vec<Style>,
    ids: FxHashMap<Style, u16>,
}

impl StylePalette {
    /// The id of `style`, registering it if it's new.
    ///
    /// Ids saturate at `u16::MAX`: a source with that many distinct styles
    /// is pathological, and reusing the last id only mis-styles it.
    fn intern(&mut self, style: Style) -> u16 {
        if let Some(&id) = self.ids.get(&style) {
            return id;
        }
        let id = u16::try_from(self.styles.len()).unwrap_or(u16::MAX);
        if usize::from(id) == self.styles.len() {
            self.styles.push(style);
            self.ids.insert(style, id);
        }
        id
    }

    /// The style registered under `id`, or the default style if unknown.
    pub fn resolve(&self, id: u16) -> Style {
        self.styles
            .get(usize::from(id))
            .copied()
            .unwrap_or_default()
    }
}

/// A handle to the palette shared by a channel's ingest workers and its
/// result rendering.
pub type SharedPalette = Arc<RwLock<StylePalette>>;

/// Parses ANSI lines against a shared palette.
///
/// Ingest runs on several workers at once, so each keeps a small local cache
/// of the styles it has already interned and only takes the shared lock when
/// a genuinely new one turns up — which stops happening within the first few
/// lines of a source.
#[derive(Debug, Clone)]
pub struct AnsiParser {
    palette: SharedPalette,
    cache: Vec<(Style, u16)>,
}

impl AnsiParser {
    pub fn new(palette: SharedPalette) -> Self {
        Self {
            palette,
            cache: Vec::new(),
        }
    }

    fn intern(&mut self, style: Style) -> u16 {
        if let Some(&(_, id)) =
            self.cache.iter().find(|(cached, _)| *cached == style)
        {
            return id;
        }
        let id = self.palette.write().intern(style);
        self.cache.push((style, id));
        id
    }

    /// Split a line into its stripped text and the style runs over it.
    ///
    /// Offsets are character (not byte) based so they line up with the match
    /// indices the results list overlays on top of them. A line with no
    /// styling at all yields no runs.
    #[allow(clippy::cast_possible_truncation)]
    pub fn parse(&mut self, line: &str) -> (String, StyleRuns) {
        let mut text = String::with_capacity(line.len());
        let mut runs = StyleRuns::new();
        let mut style = Style::default();
        let mut last_id: Option<u16> = None;
        let mut chars: u32 = 0;
        // The palette is behind a lock, so styles are interned after the
        // parse rather than from inside its callback.
        let mut pending: Vec<(u32, Style)> = Vec::new();

        let mut parser =
            VTPushParser::new_with_interest::<VT_PARSER_INTEREST_CSI>();
        parser.feed_with(line.as_bytes(), |event: VTEvent| match event {
            VTEvent::Raw(bytes) => {
                let chunk = String::from_utf8_lossy(bytes);
                if chunk.is_empty() {
                    return;
                }
                if pending.last().is_none_or(|(_, last)| *last != style) {
                    pending.push((chars, style));
                }
                chars += chunk.chars().count() as u32;
                text.push_str(&chunk);
            }
            // `m` is SGR, the only sequence that carries styling
            VTEvent::Csi(csi) if csi.final_byte == b'm' => {
                style = apply_sgr(style, &csi);
            }
            _ => {}
        });

        for (offset, style) in pending {
            let id = self.intern(style);
            if last_id != Some(id) {
                runs.push((offset, id));
                last_id = Some(id);
            }
        }
        // A single default run means the line wasn't styled at all
        if runs.len() == 1 && runs[0] == (0, self.intern(Style::default())) {
            runs.clear();
        }
        text.shrink_to_fit();
        (text, runs)
    }
}

/// Apply an SGR sequence to a style.
///
/// Unknown parameters are skipped rather than treated as a reset, so an
/// exotic sequence degrades to slightly-off colors instead of dropping the
/// styling of the rest of the line.
fn apply_sgr(mut style: Style, csi: &vt_push_parser::event::CSI<'_>) -> Style {
    let params: Vec<u16> = csi
        .params
        .into_iter()
        .map(|p| {
            std::str::from_utf8(p)
                .ok()
                .and_then(|s| s.parse::<u16>().ok())
                .unwrap_or(0)
        })
        .collect();
    // An SGR with no parameters at all (`ESC[m`) is a reset
    if params.is_empty() {
        return Style::default();
    }

    let mut i = 0;
    while i < params.len() {
        match params[i] {
            0 => style = Style::default(),
            1 => style = style.add_modifier(Modifier::BOLD),
            2 => style = style.add_modifier(Modifier::DIM),
            3 => style = style.add_modifier(Modifier::ITALIC),
            4 => style = style.add_modifier(Modifier::UNDERLINED),
            5 | 6 => style = style.add_modifier(Modifier::SLOW_BLINK),
            7 => style = style.add_modifier(Modifier::REVERSED),
            8 => style = style.add_modifier(Modifier::HIDDEN),
            9 => style = style.add_modifier(Modifier::CROSSED_OUT),
            22 => {
                style = style.remove_modifier(Modifier::BOLD | Modifier::DIM);
            }
            23 => style = style.remove_modifier(Modifier::ITALIC),
            24 => style = style.remove_modifier(Modifier::UNDERLINED),
            25 => style = style.remove_modifier(Modifier::SLOW_BLINK),
            27 => style = style.remove_modifier(Modifier::REVERSED),
            28 => style = style.remove_modifier(Modifier::HIDDEN),
            29 => style = style.remove_modifier(Modifier::CROSSED_OUT),
            c @ 30..=37 => style = style.fg(ansi_color(c - 30)),
            38 => {
                if let Some((color, consumed)) = extended_color(&params[i..]) {
                    style = style.fg(color);
                    i += consumed;
                    continue;
                }
            }
            39 => style = style.fg(Color::Reset),
            c @ 40..=47 => style = style.bg(ansi_color(c - 40)),
            48 => {
                if let Some((color, consumed)) = extended_color(&params[i..]) {
                    style = style.bg(color);
                    i += consumed;
                    continue;
                }
            }
            49 => style = style.bg(Color::Reset),
            c @ 90..=97 => style = style.fg(bright_color(c - 90)),
            c @ 100..=107 => style = style.bg(bright_color(c - 100)),
            _ => {}
        }
        i += 1;
    }
    style
}

/// Decode a `38`/`48` extended color, returning it with the number of
/// parameters it consumed.
fn extended_color(params: &[u16]) -> Option<(Color, usize)> {
    match params.get(1)? {
        // 5;n -> 256-color palette
        5 => {
            let n = *params.get(2)?;
            Some((Color::Indexed(u8::try_from(n).ok()?), 3))
        }
        // 2;r;g;b -> truecolor
        2 => {
            let r = u8::try_from(*params.get(2)?).ok()?;
            let g = u8::try_from(*params.get(3)?).ok()?;
            let b = u8::try_from(*params.get(4)?).ok()?;
            Some((Color::Rgb(r, g, b), 5))
        }
        _ => None,
    }
}

const fn ansi_color(n: u16) -> Color {
    match n {
        0 => Color::Black,
        1 => Color::Red,
        2 => Color::Green,
        3 => Color::Yellow,
        4 => Color::Blue,
        5 => Color::Magenta,
        6 => Color::Cyan,
        _ => Color::Gray,
    }
}

const fn bright_color(n: u16) -> Color {
    match n {
        0 => Color::DarkGray,
        1 => Color::LightRed,
        2 => Color::LightGreen,
        3 => Color::LightYellow,
        4 => Color::LightBlue,
        5 => Color::LightMagenta,
        6 => Color::LightCyan,
        _ => Color::White,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use fast_strip_ansi::strip_ansi_string;
    use std::fmt::Write;

    fn parser() -> AnsiParser {
        AnsiParser::new(Arc::new(RwLock::new(StylePalette::default())))
    }

    /// The line `rg` emits for the text channel: path, line number and
    /// content, each in its own color.
    const RG_LINE: &str = "\x1b[0m\x1b[34mKconfig\x1b[0m:\x1b[0m\x1b[32m12\x1b[0m:\x1b[0m\x1b[1m\x1b[37m# a comment\x1b[0m";

    #[test]
    fn stripped_text_matches_the_standalone_st
```

### Core Architecture Module: `television/utils/cache.rs`
```
use rustc_hash::{FxBuildHasher, FxHashSet};
use std::collections::{HashSet, VecDeque};
use tracing::{debug, trace};

/// A ring buffer that also keeps track of the keys it contains to avoid duplicates.
///
/// This serves as a backend for the preview cache.
/// Basic idea:
/// - When a new key is pushed, if it's already in the buffer, do nothing.
/// - If the buffer is full, remove the oldest key and push the new key.
///
/// # Example
/// ```rust
/// use television::utils::cache::RingSet;
///
/// let mut ring_set = RingSet::with_capacity(3);
/// // push 3 values into the ringset
/// assert_eq!(ring_set.push(1), None);
/// assert_eq!(ring_set.push(2), None);
/// assert_eq!(ring_set.push(3), None);
///
/// // check that the values are in the buffer
/// assert!(ring_set.contains(&1));
/// assert!(ring_set.contains(&2));
/// assert!(ring_set.contains(&3));
///
/// // push an existing value (should do nothing)
/// assert_eq!(ring_set.push(1), None);
///
/// // entries should still be there
/// assert!(ring_set.contains(&1));
/// assert!(ring_set.contains(&2));
/// assert!(ring_set.contains(&3));
///
/// // push a new value, should remove the oldest value (1)
/// assert_eq!(ring_set.push(4), Some(1));
///
/// // 1 is no longer there but 2 and 3 remain
/// assert!(!ring_set.contains(&1));
/// assert!(ring_set.contains(&2));
/// assert!(ring_set.contains(&3));
/// assert!(ring_set.contains(&4));
/// ```
#[derive(Debug)]
pub struct RingSet<T> {
    ring_buffer: VecDeque<T>,
    known_keys: FxHashSet<T>,
    capacity: usize,
}

const DEFAULT_CAPACITY: usize = 20;

impl<T> Default for RingSet<T>
where
    T: Eq + std::hash::Hash + Clone + std::fmt::Debug,
{
    fn default() -> Self {
        RingSet::with_capacity(DEFAULT_CAPACITY)
    }
}

impl<T> RingSet<T>
where
    T: Eq + std::hash::Hash + Clone + std::fmt::Debug,
{
    /// Create a new `RingSet` with the given capacity.
    pub fn with_capacity(capacity: usize) -> Self {
        RingSet {
            ring_buffer: VecDeque::with_capacity(capacity),
            known_keys: HashSet::with_capacity_and_hasher(
                capacity,
                FxBuildHasher,
            ),
            capacity,
        }
    }

    /// Push a new item to the back of the buffer, removing the oldest item if the buffer is full.
    /// Returns the item that was removed, if any.
    /// If the item is already in the buffer, do nothing and return None.
    pub fn push(&mut self, item: T) -> Option<T> {
        // If the key is already in the buffer, do nothing
        if self.contains(&item) {
            trace!("Key already in ring buffer: {:?}", item);
            return None;
        }
        let mut popped_key = None;
        // If the buffer is full, remove the oldest key (e.g. pop from the front of the buffer)
        if self.ring_buffer.len() >= self.capacity {
            popped_key = self.pop();
        }
        // finally, push the new key to the back of the buffer
        self.ring_buffer.push_back(item.clone());
        self.known_keys.insert(item);
        popped_key
    }

    fn pop(&mut self) -> Option<T> {
        if let Some(item) = self.ring_buffer.pop_front() {
            debug!("Removing key from ring buffer: {:?}", item);
            self.known_keys.remove(&item);
            Some(item)
        } else {
            None
        }
    }

    pub fn contains(&self, key: &T) -> bool {
        self.known_keys.contains(key)
    }

    /// Returns an iterator that goes from the back to the front of the buffer.
    pub fn back_to_front(&self) -> impl Iterator<Item = T> {
        self.ring_buffer.clone().into_iter().rev()
    }

    /// Returns the current size of the ring buffer, which is the number of unique keys it
    /// contains.
    pub fn size(&self) -> usize {
        self.known_keys.len()
    }

    /// Wipes the ring buffer clean.
    pub fn clear(&mut self) {
        debug!("Clearing ring buffer");
        self.ring_buffer.clear();
        self.known_keys.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_set() {
        let mut ring_set = RingSet::with_capacity(3);
        // push 3 values into the ringset
        assert_eq!(ring_set.push(1), None);
        assert_eq!(ring_set.push(2), None);
        assert_eq!(ring_set.push(3), None);

        // check that the values are in the buffer
        assert!(ring_set.contains(&1));
        assert!(ring_set.contains(&2));
        assert!(ring_set.contains(&3));

        // push an existing value (should do nothing)
        assert_eq!(ring_set.push(1), None);

        // entries should still be there
        assert!(ring_set.contains(&1));
        assert!(ring_set.contains(&2));
        assert!(ring_set.contains(&3));

        // push a new value, should remove the oldest value (1)
        assert_eq!(ring_set.push(4), Some(1));

        // 1 is no longer there but 2 and 3 remain
        assert!(!ring_set.contains(&1));
        assert!(ring_set.contains(&2));
        assert!(ring_set.contains(&3));
        assert!(ring_set.contains(&4));

        // push two new values, should remove 2 and 3
        assert_eq!(ring_set.push(5), Some(2));
        assert_eq!(ring_set.push(6), Some(3));

        // 2 and 3 are no longer there but 4, 5 and 6 remain
        assert!(!ring_set.contains(&2));
        assert!(!ring_set.contains(&3));
        assert!(ring_set.contains(&4));
        assert!(ring_set.contains(&5));
        assert!(ring_set.contains(&6));
    }
}

```

### Core Architecture Module: `television/utils/clipboard.rs`
```
/*
MIT License

Copyright (c) 2023 - sxyazi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

use std::ffi::OsString;

use crate::utils::rocell::RoCell;
use parking_lot::Mutex;

pub static CLIPBOARD: RoCell<Clipboard> = RoCell::new();

#[derive(Default)]
pub struct Clipboard {
    content: Mutex<OsString>,
}

impl Clipboard {
    #[cfg(unix)]
    pub async fn get(&self) -> OsString {
        use std::os::unix::prelude::OsStringExt;

        use tokio::process::Command;

        let all = [
            ("pbpaste", &[][..]),
            ("termux-clipboard-get", &[]),
            ("wl-paste", &[]),
            ("xclip", &["-o", "-selection", "clipboard"]),
            ("xsel", &["-ob"]),
        ];

        for (bin, args) in all {
            let Ok(output) = Command::new(bin)
                .args(args)
                .kill_on_drop(true)
                .output()
                .await
            else {
                continue;
            };
            if output.status.success() {
                return OsString::from_vec(output.stdout);
            }
        }
        self.content.lock().clone()
    }

    #[cfg(windows)]
    pub async fn get(&self) -> OsString {
        use clipboard_win::{formats, get_clipboard};

        let result = tokio::task::spawn_blocking(|| {
            get_clipboard::<String, _>(formats::Unicode)
        });
        if let Ok(Ok(s)) = result.await {
            return s.into();
        }

        self.content.lock().clone()
    }

    #[cfg(unix)]
    pub async fn set(&self, s: impl AsRef<std::ffi::OsStr>) {
        use std::{
            io::{BufWriter, stderr},
            process::Stdio,
        };

        use crossterm::execute;
        use tokio::{io::AsyncWriteExt, process::Command};

        s.as_ref().clone_into(&mut self.content.lock());
        execute!(
            BufWriter::new(stderr()),
            osc52::SetClipboard::new(s.as_ref())
        )
        .ok();

        let all = [
            ("pbcopy", &[][..]),
            ("termux-clipboard-set", &[]),
            ("wl-copy", &[]),
            ("xclip", &["-selection", "clipboard"]),
            ("xsel", &["-ib"]),
        ];

        for (bin, args) in all {
            let cmd = Command::new(bin)
                .args(args)
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .kill_on_drop(true)
                .spawn();

            let Ok(mut child) = cmd else { continue };

            let mut stdin = child.stdin.take().unwrap();
            if stdin
                .write_all(s.as_ref().as_encoded_bytes())
                .await
                .is_err()
            {
                continue;
            }
            drop(stdin);

            if child.wait().await.is_ok_and(|s| s.success()) {
                break;
            }
        }
    }

    #[cfg(windows)]
    pub async fn set(&self, s: impl AsRef<std::ffi::OsStr>) {
        use clipboard_win::{formats, set_clipboard};

        let s = s.as_ref().to_owned();
        *self.content.lock() = s.clone();

        tokio::task::spawn_blocking(move || {
            set_clipboard(formats::Unicode, s.to_string_lossy())
        })
        .await
        .ok();
    }
}

#[cfg(unix)]
mod osc52 {
    use std::ffi::OsStr;

    use base64::{Engine, engine::general_purpose};

    #[derive(Debug)]
    pub struct SetClipboard {
        content: String,
    }

    impl SetClipboard {
        pub fn new(content: &OsStr) -> Self {
            Self {
                content: general_purpose::STANDARD
                    .encode(content.as_encoded_bytes()),
            }
        }
    }

    impl crossterm::Command for SetClipboard {
        fn write_ansi(
            &self,
            f: &mut impl std::fmt::Write,
        ) -> std::fmt::Result {
            write!(f, "\x1b]52;c;{}\x1b\\", self.content)
        }
    }
}

```

### Core Architecture Module: `television/utils/command.rs`
```
use crate::{
    channels::{
        entry::Entry,
        prototypes::{ActionSpec, ExecutionMode, Template},
    },
    utils::{shell::Shell, strings::SPACE},
};
use anyhow::Result;
use lazy_regex::{Lazy, Regex, regex};
use rustc_hash::FxHashSet;
use std::{
    collections::HashMap,
    process::{Command, ExitStatus, Stdio},
};
#[cfg(unix)]
use std::{fs::OpenOptions, os::unix::process::CommandExt};
use tracing::debug;

static COMPLEX_BRACES_REGEX: &Lazy<Regex> = regex!(r"\{[^}]+\}");

/// Create a shell command configured for the current platform
///
/// Creates a `Command` instance configured with the appropriate shell for the current platform
/// and sets up the command to execute the provided command string.
///
/// # Arguments
/// * `command` - The command string to execute
/// * `interactive` - Whether to run in interactive mode (uses `-Interactive`
///   for `PowerShell` and `-i` before `-c` for Unix-like shells)
/// * `envs` - Environment variables to set for the command
/// * `shell_override` - Optionally override the shell used to execute the command.
///   If `None`, the shell is detected from the environment.
///
/// # Returns
/// * `Command` - A configured `Command` ready for execution
pub fn shell_command<S>(
    command: &str,
    interactive: bool,
    envs: &HashMap<String, String, S>,
    shell_override: Option<Shell>,
) -> Command {
    let shell = shell_override
        .unwrap_or_else(|| Shell::from_env().unwrap_or_default());
    let mut cmd = Command::new(shell.executable());

    let args = match shell {
        Shell::Psh if interactive => {
            vec![
                "-NoLogo",
                "-OutputFormat",
                "Text",
                "-Interactive",
                "-Command",
            ]
        }
        Shell::Psh => {
            vec![
                "-NoLogo",
                "-OutputFormat",
                "Text",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
            ]
        }
        Shell::Cmd => vec!["/C"],
        #[cfg(unix)]
        _ if interactive => vec!["-i", "-c"],
        _ => vec!["-c"],
    };

    cmd.args(args);

    cmd.envs(envs).arg(command);
    cmd
}

/// Format a command string from entries using template processing
///
/// Takes a set of entries, concatenates them with the specified separator, and processes them through
/// the provided template to create a formatted command. The template handles escaping, formatting, and any transformations.
///
/// # Arguments
/// * `entries` - A reference to a set of Entry items to process
/// * `template` - The template to process the entries through
/// * `separator` - The separator to use when joining entries
///
/// # Returns
/// * `Result<String>` - The final formatted command ready for execution
///
/// # Example
/// ```no_run
/// # use television::{
///     channels::{entry::Entry, prototypes::Template},
///     utils::command::format_command
/// };
/// # use rustc_hash::FxHashSet;
/// let mut entries = FxHashSet::default();
/// entries.insert(Entry::new("file1.txt".to_string()));
/// entries.insert(Entry::new("file 2.txt".to_string()));
/// let template = Template::parse("nvim {split:\\n:..|map:{append:'|prepend:'}|join: }").unwrap();
/// let result = format_command(&entries, &template, "\n").unwrap();
/// // Should produce something like: nvim 'file1.txt' 'file 2.txt'
/// assert!(result.starts_with("nvim "));
/// assert!(result.contains("'file1.txt'"));
/// assert!(result.contains("'file 2.txt'"));
/// ```
pub fn format_command(
    entries: &FxHashSet<Entry>,
    template: &Template,
    separator: &str,
) -> Result<String> {
    debug!(
        "Formatting command from {} entries using template",
        entries.len()
    );

    let template_str = template.raw();

    // Check if template has only simple braces (syntactic sugar)
    let has_only_simple_braces = !COMPLEX_BRACES_REGEX.is_match(template_str);
    if has_only_simple_braces {
        // Handle simple braces with predictable multi-value logic
        debug!(
            "Using simple brace syntactic sugar for template: {}",
            template_str
        );

        // Multiple entries: quote each and join with spaces
        let quoted_entries: Vec<String> = entries
            .iter()
            .map(|entry| format!("'{}'", entry.raw.replace('\'', r"\'")))
            .collect();
        let entries_joined = quoted_entries.join(SPACE);
        let formatted_command = template_str.replace("{}", &entries_joined);
        debug!("Multiple entries command: {:?}", formatted_command);
        Ok(formatted_command)
    } else {
        // Complex braces: use existing template processing
        debug!("Using complex template processing for: {}", template_str);

        // Concatenate entries with separator for template processing
        let entries_str = entries
            .iter()
            .map(|entry| entry.raw.as_str())
            .collect::<Vec<_>>()
            .join(separator);
        debug!("Concatenated entries input: {:?}", entries_str);

        // Process through template system
        let formatted_command = template.format(&entries_str)?;
        debug!("Final command: {:?}", formatted_command);
        Ok(formatted_command)
    }
}

/// Execute an external action with the appropriate execution mode and output handling
///
/// Takes an `ActionSpec` and a set of entries, creates a command using the action's template,
/// and executes the resulting command with the specified execution mode.
///
/// # Arguments
/// * `action_spec` - The `ActionSpec` containing the command template, execution mode, and output mode
/// * `entries` - A reference to a set of Entry items to process
///
/// # Returns
/// * `Result<ExitStatus>` - The exit status of the executed command
///
/// # Behavior
/// - `ExecutionMode::Execute` - make the current process become what the command does
/// - `ExecutionMode::Fork` - spawns the command as a child process
pub fn execute_action(
    action_spec: &ActionSpec,
    entries: &FxHashSet<Entry>,
) -> Result<ExitStatus> {
    debug!("Executing external action with {} entries", entries.len());

    let template: &Template = action_spec.command.get_nth(0).template();
    let formatted_command =
        format_command(entries, template, &action_spec.separator)?;

    let mut cmd = shell_command(
        &formatted_command,
        action_spec.command.interactive,
        &action_spec.command.env,
        action_spec.command.shell,
    );

    #[cfg(unix)]
    match action_spec.mode {
        ExecutionMode::Execute => {
            attach_to_tty(&mut cmd)?;
            let err = cmd.exec();
            eprintln!("Failed to execute command: {}", err);
            Err(err.into())
        }
        ExecutionMode::Fork => {
            attach_to_tty(&mut cmd)?;
            let mut child = cmd.spawn()?;
            Ok(child.wait()?)
        }
    }

    // On windows we can't replace the current process, so we always fork
    #[cfg(not(unix))]
    {
        if action_spec.mode == ExecutionMode::Execute {
            debug!(
                "ExecutionMode::Execute is not supported on Windows. Falling back to Fork."
            );
        }
        cmd.stdin(Stdio::inherit())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit());

        let mut child = cmd.spawn()?;
        Ok(child.wait()?)
    }
}

#[cfg(unix)]
fn attach_to_tty(cmd: &mut Command) -> Result<()> {
    use std::io::{IsTerminal, stderr, stdin, stdout};

    // If stdin/stdout/stderr are already real TTYs (interactive invocation),
    // inherit them as-is. Reopening `/dev/tty` and dup'ing the resulting FD
    // produces a file descriptor whose ttyname resolves to `/dev/tty` on
    // macOS, which tmux rejects with "can't use /dev/tty" when attaching.
    // Inheriting the original pty FDs preserves the real device path.
    if stdin().is_terminal()
        && stdout().is_terminal()
        && stderr().is_terminal()
    {
        return Ok(());
    }

    let Ok(tty) = OpenOptions::new().read(true).write(true).open("/dev/tty")
    else {
        return Ok(());
    };

    cmd.stdin(Stdio::from(tty.try_clone()?))
        .stdout(Stdio::from(tty.try_clone()?))
        .stderr(Stdio::from(tty));

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::channels::entry::Entry;
    use crate::utils::shell::Shell;

    #[test]
    fn test_simple_braces_syntactic_sugar() {
        let mut entries = FxHashSet::default();
        entries.insert(Entry::new("file1.txt".to_string()));

        // Simple braces should use syntactic sugar with quotes
        let template = Template::parse("nvim {}").unwrap();
        let result = format_command(&entries, &template, "\n").unwrap();
        assert_eq!(result, "nvim 'file1.txt'");
    }

    #[test]
    fn test_simple_braces_multiple_entries() {
        let mut entries = FxHashSet::default();
        entries.insert(Entry::new("file1.txt".to_string()));
        entries.insert(Entry::new("file2.txt".to_string()));

        // Simple braces with multiple entries should quote each and join with spaces
        let template = Template::parse("nvim {}").unwrap();
        let result = format_command(&entries, &template, "\n").unwrap();

        // Result should contain both files quoted and joined with space
        assert!(
            result == "nvim 'file1.txt' 'file2.txt'"
                || result == "nvim 'file2.txt' 'file1.txt'"
        );
    }

    #[test]
    fn test_simple_braces_with_quotes_in_filename() {
        let mut entries = FxHashSet::default();
        entries.insert(Entry::new("file's name.txt".to_string()));

        // Simple braces should escape single quotes in filenames
        let template = Template::parse("nvim {}").unwrap();
        let result = format_command(&entries, &template, "\n").unwrap();
        assert_eq!(result, "nvim 'file\\'s name.txt'");
    }

    #[test]
    fn test_com
```

### Core Architecture Module: `television/utils/files.rs`
```
use crate::utils::{
    strings::{
        PRINTABLE_ASCII_THRESHOLD, proportion_of_printable_ascii_characters,
    },
    threads::default_num_threads,
};
use rustc_hash::FxHashSet;
use std::{
    fmt::Debug,
    fs::File,
    io::{BufRead, BufReader, Read},
    path::Path,
    sync::OnceLock,
};
use tracing::{debug, warn};

pub struct PartialReadResult {
    pub lines: Vec<String>,
    pub bytes_read: usize,
}

pub enum ReadResult {
    Partial(PartialReadResult),
    Full(Vec<String>),
    Error(String),
}

pub fn read_into_lines_capped<R>(r: R, max_bytes: usize) -> ReadResult
where
    R: Read,
{
    let mut buf_reader = BufReader::new(r);
    let mut line = String::new();
    let mut lines = Vec::new();
    let mut bytes_read = 0;

    loop {
        line.clear();
        match buf_reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                if bytes_read > max_bytes {
                    break;
                }
                lines.push(line.trim_end().to_string());
                bytes_read += line.len();
            }
            Err(e) => {
                warn!("Error reading file: {:?}", e);
                return ReadResult::Error(format!("{e:?}"));
            }
        }
    }

    if bytes_read > max_bytes {
        ReadResult::Partial(PartialReadResult { lines, bytes_read })
    } else {
        ReadResult::Full(lines)
    }
}

pub static DEFAULT_NUM_THREADS: OnceLock<usize> = OnceLock::new();

pub fn get_default_num_threads() -> usize {
    *DEFAULT_NUM_THREADS.get_or_init(default_num_threads)
}

pub fn get_file_size(path: &Path) -> Option<u64> {
    std::fs::metadata(path).ok().map(|m| m.len())
}

#[derive(Debug)]
pub enum FileType {
    Text,
    Image,
    Other,
    Unknown,
}

impl<P> From<P> for FileType
where
    P: AsRef<Path> + Debug,
{
    fn from(path: P) -> Self {
        debug!("Getting file type for {:?}", path);
        let p = path.as_ref();
        if is_accepted_image_extension(p) {
            return FileType::Image;
        }
        if is_known_text_extension(p) {
            return FileType::Text;
        }
        if let Ok(mut f) = File::open(p) {
            let mut buffer = [0u8; 256];
            if let Ok(bytes_read) = f.read(&mut buffer)
                && bytes_read > 0
                && proportion_of_printable_ascii_characters(
                    &buffer[..bytes_read],
                ) > PRINTABLE_ASCII_THRESHOLD
            {
                return FileType::Text;
            }
        } else {
            warn!("Error opening file: {:?}", path);
        }
        FileType::Other
    }
}

pub fn is_known_text_extension<P>(path: P) -> bool
where
    P: AsRef<Path>,
{
    path.as_ref()
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| get_known_text_file_extensions().contains(ext))
}

pub static KNOWN_TEXT_FILE_EXTENSIONS: OnceLock<FxHashSet<&'static str>> =
    OnceLock::new();

pub fn get_known_text_file_extensions() -> &'static FxHashSet<&'static str> {
    KNOWN_TEXT_FILE_EXTENSIONS.get_or_init(|| {
        [
            "ada",
            "adb",
            "ads",
            "applescript",
            "as",
            "asc",
            "ascii",
            "ascx",
            "asm",
            "asmx",
            "asp",
            "aspx",
            "atom",
            "au3",
            "awk",
            "bas",
            "bash",
            "bashrc",
            "bat",
            "bbcolors",
            "bcp",
            "bdsgroup",
            "bdsproj",
            "bib",
            "bowerrc",
            "c",
            "cbl",
            "cc",
            "cfc",
            "cfg",
            "cfm",
            "cfml",
            "cgi",
            "cjs",
            "clj",
            "cljs",
            "cls",
            "cmake",
            "cmd",
            "cnf",
            "cob",
            "code-snippets",
            "coffee",
            "coffeekup",
            "conf",
            "cp",
            "cpp",
            "cpt",
            "cpy",
            "crt",
            "cs",
            "csh",
            "cson",
            "csproj",
            "csr",
            "css",
            "csslintrc",
            "csv",
            "ctl",
            "curlrc",
            "cxx",
            "d",
            "dart",
            "dfm",
            "diff",
            "dof",
            "dpk",
            "dpr",
            "dproj",
            "dtd",
            "eco",
            "editorconfig",
            "ejs",
            "el",
            "elm",
            "emacs",
            "eml",
            "ent",
            "erb",
            "erl",
            "eslintignore",
            "eslintrc",
            "ex",
            "exs",
            "f",
            "f03",
            "f77",
            "f90",
            "f95",
            "fish",
            "for",
            "fpp",
            "frm",
            "fs",
            "fsproj",
            "fsx",
            "ftn",
            "gemrc",
            "gemspec",
            "gitattributes",
            "gitconfig",
            "gitignore",
            "gitkeep",
            "gitmodules",
            "go",
            "gpp",
            "gradle",
            "graphql",
            "groovy",
            "groupproj",
            "grunit",
            "gtmpl",
            "gvimrc",
            "h",
            "haml",
            "hbs",
            "hgignore",
            "hh",
            "hpp",
            "hrl",
            "hs",
            "hta",
            "htaccess",
            "htc",
            "htm",
            "html",
            "htpasswd",
            "hxx",
            "iced",
            "iml",
            "inc",
            "inf",
            "info",
            "ini",
            "ino",
            "int",
            "irbrc",
            "itcl",
            "itermcolors",
            "itk",
            "jade",
            "java",
            "jhtm",
            "jhtml",
            "js",
            "jscsrc",
            "jshintignore",
            "jshintrc",
            "json",
            "json5",
            "jsonld",
            "jsp",
            "jspx",
            "jsx",
            "ksh",
            "less",
            "lhs",
            "lisp",
            "log",
            "ls",
            "lsp",
            "lua",
            "m",
            "m4",
            "mak",
            "map",
            "markdown",
            "master",
            "md",
            "mdown",
            "mdwn",
            "mdx",
            "metadata",
            "mht",
            "mhtml",
            "mjs",
            "mk",
            "mkd",
            "mkdn",
            "mkdown",
            "ml",
            "mli",
            "mm",
            "mxml",
            "nfm",
            "nfo",
            "noon",
            "npmignore",
            "npmrc",
            "nuspec",
            "nvmrc",
            "ops",
            "pas",
            "pasm",
            "patch",
            "pbxproj",
            "pch",
            "pem",
            "pg",
            "php",
            "php3",
            "php4",
            "php5",
            "phpt",
            "phtml",
            "pir",
            "pl",
            "pm",
            "pmc",
            "pod",
            "pot",
            "prettierrc",
            "properties",
            "props",
            "pt",
            "pug",
            "purs",
            "py",
            "pyx",
            "r",
            "rake",
            "rb",
            "rbw",
            "rc",
            "rdoc",
            "rdoc_options",
            "resx",
            "rexx",
            "rhtml",
            "rjs",
            "rlib",
            "ron",
            "rs",
            "rss",
            "rst",
            "rtf",
            "rvmrc",
            "rxml",
            "s",
            "sass",
            "scala",
            "scm",
            "scss",
            "seestyle",
            "sh",
            "shtml",
            "sln",
            "sls",
            "spec",
            "sql",
            "sqlite",
            "sqlproj",
            "srt",
            "ss",
            "sss",
            "st",
            "strings",
            "sty",
            "styl",
            "stylus",
            "sub",
            "sublime-build",
            "sublime-commands",
            "sublime-completions",
            "sublime-keymap",
            "sublime-macro",
            "sublime-menu",
            "sublime-project",
            "sublime-settings",
            "sublime-workspace",
            "sv",
            "svc",
            "svg",
            "swift",
            "t",
            "tcl",
            "tcsh",
            "terminal",
            "tex",
            "text",
            "textile",
            "tg",
            "tk",
            "tmLanguage",
            "tmpl",
            "tmTheme",
            "toml",
            "tpl",
            "ts",
            "tsv",
            "tsx",
            "tt",
            "tt2",
            "ttml",
            "twig",
            "txt",
            "v",
            "vb",
            "vbproj",
            "vbs",
            "vcproj",
            "vcxproj",
            "vh",
            "vhd",
            "vhdl",
            "vim",
            "viminfo",
            "vimrc",
            "vm",
            "vue",
            "webapp",
            "webmanifest",
            "wsc",
            "x-php",
            "xaml",
            "xht",
            "xhtml",
            "xml",
            "xs",
            "xsd",
            "xsl",
            "xslt",
            "y",
            "yaml",
            "yml",
            "zsh",
            "zshrc",
        ]
        .iter()
        .copied()
        .collect()
    })
}

pub fn is_accepted_image_extension<P>(path: P) -> bool
where
    P: AsRef<Path>,
{
    path.as_ref()
        .extension()
        .and_then(|ext| ext.to_str())
   
```

### Core Architecture Module: `television/utils/hashmaps.rs`
```
use std::hash::Hash;

use rustc_hash::FxHashMap;

pub fn invert_hashmap<K, V>(hashmap: &FxHashMap<K, V>) -> FxHashMap<V, K>
where
    K: Eq + Hash + Clone,
    V: Eq + Hash + Clone,
{
    let mut inverted = FxHashMap::default();
    for (key, value) in hashmap {
        inverted.insert(value.clone(), key.clone());
    }
    inverted
}

pub fn invert_nested_hashmap<K, V, I>(
    hashmap: &FxHashMap<K, V>,
) -> FxHashMap<I, K>
where
    K: Eq + Hash + Clone,
    V: Eq + Hash + Clone + IntoIterator<Item = I>,
    I: Eq + Hash + Clone,
{
    let mut inverted = FxHashMap::default();
    for (key, values) in hashmap {
        for value in values.clone() {
            inverted.insert(value, key.clone());
        }
    }
    inverted
}

```

### Core Architecture Module: `television/utils/indices.rs`
```
use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};

const ELLIPSIS: &str = "…";
const ELLIPSIS_CHAR_WIDTH_U16: u16 = 1;
const ELLIPSIS_CHAR_WIDTH_U32: u32 = 1;
const ELLIPSIS_CHAR_WIDTH_USIZE: usize = 1;

/// Truncate a string to fit within a certain width, while keeping track of the
/// indices of the highlighted characters.
///
/// This will either truncate from the start or the end of the string, depending
/// on where the highlighted characters are.
///
/// This will take care of non-unit width characters such as emojis, or certain
/// CJK characters that are wider than a single character.
///
/// # Note
/// This function assumes that the highlighted ranges are sorted and non-overlapping.
///
/// # Examples
/// ```
/// use television::utils::indices::truncate_highlighted_string;
///
/// let s = "hello world";
/// let highlighted_ranges = vec![(0, 2), (4, 8), (10, 11)];
/// let max_width = 6;
/// let (truncated, ranges) = truncate_highlighted_string(
///     s,
///     &highlighted_ranges,
///     max_width,
/// );
///
/// assert_eq!(truncated, "…world");
/// assert_eq!(ranges, vec![(1, 3), (5, 6)]);
///
/// let s = "下地.mp3";
/// let highlighted_ranges = vec![(3, 5)];
/// let max_width = 5;
/// let (truncated, ranges) = truncate_highlighted_string(
///     s,
///     &highlighted_ranges,
///     max_width,
/// );
/// assert_eq!(truncated, "….mp3");
/// assert_eq!(ranges, vec![(2, 4)]);
/// ```
///
/// See unit tests for more examples.
pub fn truncate_highlighted_string<'a>(
    s: &'a str,
    highlighted_ranges: &'a [(u32, u32)],
    max_width: u16,
) -> (String, Vec<(u32, u32)>) {
    let str_width = s.width();

    if str_width <= max_width as usize {
        return (s.to_string(), highlighted_ranges.to_vec());
    }

    let last_highlighted_char_index =
        (highlighted_ranges.last().unwrap_or(&(0, 0)).1 as usize)
            // ranges are exclusive on the right
            .saturating_sub(1);
    let width_to_last_highlighted_char = s
        .chars()
        .take(last_highlighted_char_index + 1)
        .fold(0, |acc, c| acc + c.width().unwrap_or(0));

    // if the string isn't highlighted, or all highlighted characters are within the max index,
    // simply truncate it from the right and add an ellipsis
    if highlighted_ranges.is_empty()
        // is the last highlighted char index within the first "`max_width` of" characters?
        || width_to_last_highlighted_char < max_width as usize
    {
        let mut cumulative_width = 0;
        return (
            s.chars()
                .take_while(|c| {
                    cumulative_width += c.width().unwrap_or(0);
                    cumulative_width
                        <= max_width.saturating_sub(ELLIPSIS_CHAR_WIDTH_U16)
                            as usize
                })
                .collect::<String>()
                + ELLIPSIS,
            highlighted_ranges.to_vec(),
        );
    }

    // otherwise, if the last highlighted char index is within the last "max width" chars of the
    // string, truncate it from the left and add an ellipsis at the beginning
    // |<------- str_width ------->|
    //           |<-- max_width -->|
    // |--------> start_width_offset - 1 (for the ellipsis)
    let start_width_offset = str_width.saturating_sub(max_width as usize)
        + ELLIPSIS_CHAR_WIDTH_USIZE;
    if width_to_last_highlighted_char > start_width_offset {
        let mut truncated_width = str_width;
        let chars_to_skip = s
            .chars()
            .take_while(|c| {
                if truncated_width >= max_width as usize {
                    truncated_width -= c.width().unwrap_or(0);
                    true
                } else {
                    false
                }
            })
            .count();
        let truncated_string =
            s.chars().skip(chars_to_skip).collect::<String>();
        return (
            ELLIPSIS.to_string() + &truncated_string,
            highlighted_ranges
                .iter()
                .map(|(start, end)| {
                    (
                        start.saturating_sub(
                            u32::try_from(chars_to_skip).unwrap(),
                        ) + ELLIPSIS_CHAR_WIDTH_U32,
                        end.saturating_sub(
                            u32::try_from(chars_to_skip).unwrap(),
                        ) + ELLIPSIS_CHAR_WIDTH_U32,
                    )
                })
                .filter(|(start, end)| start != end)
                .collect(),
        );
    }

    // otherwise, try to put the last highlighted character towards the end of the truncated string and
    // truncate from both sides to fit the max width
    let start_width_offset =
        // 0123456789012
        //    ^^  ^     highlights
        // a long string
        // -------x     width to last highlighted char: 7
        //              max width = 4
        //      … s…    truncated string
        //      <--> 4
        width_to_last_highlighted_char.saturating_sub(max_width.saturating_sub(2*ELLIPSIS_CHAR_WIDTH_U16) as usize);

    let mut cumulated_width = 0;
    let chars_to_skip = s
        .chars()
        .take_while(|c| {
            if cumulated_width < start_width_offset {
                cumulated_width += c.width().unwrap_or(0);
                true
            } else {
                false
            }
        })
        .count();

    (
        ELLIPSIS.to_string()
            + &s.chars()
                .skip(chars_to_skip)
                .take(max_width.saturating_sub(2 * ELLIPSIS_CHAR_WIDTH_U16)
                    as usize)
                .collect::<String>()
            + ELLIPSIS,
        highlighted_ranges
            .iter()
            .map(|(start, end)| {
                (
                    start
                        .saturating_sub(u32::try_from(chars_to_skip).unwrap())
                        + ELLIPSIS_CHAR_WIDTH_U32,
                    end.saturating_sub(u32::try_from(chars_to_skip).unwrap())
                        + ELLIPSIS_CHAR_WIDTH_U32,
                )
            })
            .filter(|(start, end)| start != end)
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    #[test]
    /// string:         themes/solarized-light.toml
    /// highlights:                            ----
    /// max width:      ---------------------------
    /// result:         themes/solarized-light.toml
    /// expected:                              ----
    fn test_truncate_hightlighted_string_no_op() {
        let s = "themes/solarized-light.toml";
        let highlighted_ranges = vec![(23, 27)];
        let max_width = 27;
        let (truncated, ranges) = super::truncate_highlighted_string(
            s,
            &highlighted_ranges,
            max_width,
        );
        assert_eq!(truncated, s);
        assert_eq!(ranges, highlighted_ranges);
    }

    #[test]
    /// string:     hello world
    /// highlights:
    /// max width:  -----
    /// result:     hell…
    fn test_truncate_hightlighted_string_no_highlight() {
        let s = "hello world";
        let highlighted_ranges = vec![];
        let max_width = 5;
        let (truncated, ranges) = super::truncate_highlighted_string(
            s,
            &highlighted_ranges,
            max_width,
        );
        assert_eq!(truncated, "hell…");
        assert_eq!(ranges, highlighted_ranges);
    }

    #[test]
    /// string:     hello world
    /// highlights: -----
    /// max width:  ----------
    /// result:     hello wor…
    fn test_truncate_hightlighted_string_highlights_fit_left() {
        let s = "hello world";
        let highlighted_ranges = vec![(0, 5)];
        let max_width = 10;
        let (truncated, ranges) = super::truncate_highlighted_string(
            s,
            &highlighted_ranges,
            max_width,
        );
        assert_eq!(truncated, "hello wor…");
        assert_eq!(ranges, highlighted_ranges);
    }

    #[test]
    /// string:     hello world
    /// highlights: --  ----  -
    ///             he  o wo  d
    /// max width:  ------
    ///                  ------
    /// result:          …world
    fn test_truncate_highlighted_string_highlights_right() {
        let s = "hello world";
        let highlighted_ranges = vec![(0, 2), (4, 8), (10, 11)];
        let max_width = 6;
        let (truncated, ranges) = super::truncate_highlighted_string(
            s,
            &highlighted_ranges,
            max_width,
        );

        assert_eq!(truncated, "…world");
        assert_eq!(ranges, vec![(1, 3), (5, 6)]);
    }

    #[test]
    /// string:     下地.mp3
    /// highlights:      ---
    /// max width:     -----
    /// result:        ….mp3
    fn test_truncate_hightlighted_string_highlights_right_wide_chars() {
        let s = "下地.mp3";
        let highlighted_ranges = vec![(3, 5)];
        let max_width = 5;
        let (truncated, ranges) = super::truncate_highlighted_string(
            s,
            &highlighted_ranges,
            max_width,
        );
        assert_eq!(truncated, "….mp3");
        assert_eq!(ranges, vec![(2, 4)]);
    }

    #[test]
    /// string:         themes/solarized-light.toml
    /// highlights:                            ----
    /// max width:       --------------------------
    /// result:          …emes/solarized-light.toml
    /// expected:                              ----
    fn test_truncate_highlighted_string_truncate_left() {
        let s = "themes/solarized-light.toml";
        let highlighted_ranges = vec![(23, 27)];
        let max_width = 26;
        let (truncated, ranges) = super::truncate_highlighted_string(
            s,
            &highlighted_ranges,
            max_width,
        );

        assert_eq!(truncated, "…emes/solarized-light.toml");
        assert_eq!(ranges, vec![(22, 26)]);
    }

    #[test]
    fn ellipsis_len() {
        assert_eq!(
            super::ELLIPSIS.chars().count(),
            super::ELLIPSIS_CHAR_WIDTH_U
```

### Core Architecture Module: `television/utils/input.rs`
```
// Adapted from https://github.com/sayanarijit/tui-input
//
// MIT License

// Copyright (c) 2021 Arijit Basu
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/// Input requests are used to change the input state.
///
/// Different backends can be used to convert events into requests.
#[allow(clippy::module_name_repetitions)]
#[derive(Debug, PartialOrd, PartialEq, Eq, Clone, Copy, Hash)]
pub enum InputRequest {
    SetCursor(usize),
    InsertChar(char),
    GoToPrevChar,
    GoToNextChar,
    GoToPrevWord,
    GoToNextWord,
    GoToStart,
    GoToEnd,
    DeletePrevChar,
    DeleteNextChar,
    DeletePrevWord,
    DeleteNextWord,
    DeleteLine,
    DeleteTillEnd,
}

#[derive(Debug, PartialOrd, PartialEq, Eq, Clone, Copy, Hash)]
pub struct StateChanged {
    pub value: bool,
    pub cursor: bool,
}

#[allow(clippy::module_name_repetitions)]
pub type InputResponse = Option<StateChanged>;

/// An input buffer with cursor support.
#[derive(Default, Debug, Clone, PartialEq, Hash)]
pub struct Input {
    value: String,
    cursor: usize,
}

impl Input {
    /// Initialize a new instance with a given value
    /// Cursor will be set to the given value's length.
    pub fn new(value: String) -> Self {
        let len = value.chars().count();
        Self { value, cursor: len }
    }

    /// Set the value manually.
    /// Cursor will be set to the given value's length.
    pub fn with_value(mut self, value: String) -> Self {
        self.cursor = value.chars().count();
        self.value = value;
        self
    }

    /// Set the cursor manually.
    /// If the input is larger than the value length, it'll be auto adjusted.
    pub fn with_cursor(mut self, cursor: usize) -> Self {
        self.cursor = cursor.min(self.value.chars().count());
        self
    }

    // Reset the cursor and value to default
    pub fn reset(&mut self) {
        self.cursor = Default::default();
        self.value = String::default();
    }

    /// Handle request and emit response.
    #[allow(clippy::too_many_lines)]
    pub fn handle(&mut self, req: InputRequest) -> InputResponse {
        use InputRequest::{
            DeleteLine, DeleteNextChar, DeleteNextWord, DeletePrevChar,
            DeletePrevWord, DeleteTillEnd, GoToEnd, GoToNextChar,
            GoToNextWord, GoToPrevChar, GoToPrevWord, GoToStart, InsertChar,
            SetCursor,
        };
        match req {
            SetCursor(pos) => {
                let pos = pos.min(self.value.chars().count());
                if self.cursor == pos {
                    None
                } else {
                    self.cursor = pos;
                    Some(StateChanged {
                        value: false,
                        cursor: true,
                    })
                }
            }
            InsertChar(c) => {
                if self.cursor == self.value.chars().count() {
                    self.value.push(c);
                } else {
                    self.value = self
                        .value
                        .chars()
                        .take(self.cursor)
                        .chain(
                            std::iter::once(c)
                                .chain(self.value.chars().skip(self.cursor)),
                        )
                        .collect();
                }
                self.cursor += 1;
                Some(StateChanged {
                    value: true,
                    cursor: true,
                })
            }

            DeletePrevChar => {
                if self.cursor == 0 {
                    None
                } else {
                    self.cursor -= 1;
                    self.value = self
                        .value
                        .chars()
                        .enumerate()
                        .filter(|(i, _)| i != &self.cursor)
                        .map(|(_, c)| c)
                        .collect();

                    Some(StateChanged {
                        value: true,
                        cursor: true,
                    })
                }
            }

            DeleteNextChar => {
                if self.cursor == self.value.chars().count() {
                    None
                } else {
                    self.value = self
                        .value
                        .chars()
                        .enumerate()
                        .filter(|(i, _)| i != &self.cursor)
                        .map(|(_, c)| c)
                        .collect();
                    Some(StateChanged {
                        value: true,
                        cursor: false,
                    })
                }
            }

            GoToPrevChar => {
                if self.cursor == 0 {
                    None
                } else {
                    self.cursor -= 1;
                    Some(StateChanged {
                        value: false,
                        cursor: true,
                    })
                }
            }

            GoToPrevWord => {
                if self.cursor == 0 {
                    None
                } else {
                    self.cursor = self
                        .value
                        .chars()
                        .rev()
                        .skip(
                            self.value.chars().count().max(self.cursor)
                                - self.cursor,
                        )
                        .skip_while(|c| !c.is_alphanumeric())
                        .skip_while(|c| c.is_alphanumeric())
                        .count();
                    Some(StateChanged {
                        value: false,
                        cursor: true,
                    })
                }
            }

            GoToNextChar => {
                if self.cursor == self.value.chars().count() {
                    None
                } else {
                    self.cursor += 1;
                    Some(StateChanged {
                        value: false,
                        cursor: true,
                    })
                }
            }

            GoToNextWord => {
                if self.cursor == self.value.chars().count() {
                    None
                } else {
                    self.cursor = self
                        .value
                        .chars()
                        .enumerate()
                        .skip(self.cursor)
                        .skip_while(|(_, c)| c.is_alphanumeric())
                        .find(|(_, c)| c.is_alphanumeric())
                        .map(|(i, _)| i)
                        .unwrap_or_else(|| self.value.chars().count());

                    Some(StateChanged {
                        value: false,
                        cursor: true,
                    })
                }
            }

            DeleteLine => {
                if self.value.is_empty() {
                    None
                } else {
                    let cursor = self.cursor;
                    self.value = String::new();
                    self.cursor = 0;
                    Some(StateChanged {
                        value: true,
                        cursor: self.cursor == cursor,
                    })
                }
            }

            DeletePrevWord => {
                if self.cursor == 0 {
                    None
                } else {
                    let remaining = self.value.chars().skip(self.cursor);
                    let rev = self
                        .value
                        .chars()
                        .rev()
                        .skip(
                            self.value.chars().count().max(self.cursor)
                                - self.cursor,
                        )
                        .skip_while(|c| !c.is_alphanumeric())
                        .skip_while(|c| c.is_alphanumeric())
                        .collect::<Vec<char>>();
                    let rev_len = rev.len();
                    self.value =
                        rev.into_iter().rev().chain(remaining).collect();
                    self.cursor = rev_len;
                    Some(StateChanged {
                        value: true,
                        cursor: true,
                    })
                }
            }

            DeleteNextWord => {
                if self.cursor == self.value.chars().count() {
                    None
                } else {
                    self.value = self
                        .value
                        .chars()
                        .take(self.cursor)
                        .chain(
                            self.value
                                .chars()
                                .skip(self.cursor)
                                .skip_while(|c| c.is_alphanumeric())
                                .skip_while(|c| !c.is_alphanumeric()),
                        )
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1148** (2026-09-23): **kitty keyboard protocol queries show up in tv**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Fixed by c2b208eef4c9ad4ad50a6e9b38c1535d68c3bb7c

- **Issue #1141** (2026-09-10): **Missing characters**
  *Symptoms*: **Description** Characters I use in my ls are missing, and probably some others too.  **Example** I don't really have an example, but these are the missing characters: ``` ፨ ``` ``` ፠ ```  **Expected behavior** These should just render like everywhere else, e.g. in my terminal, yazi etc.  **Environment**  - OS: Arch - TV version: 0.15.9 - shell: fish - terminal: ghostty - channel: dirs  television:  <img width="2532" height="1418" alt="Image" src="https://github.com/user-attachments/assets/cec1cbcc-c145-48d7-a5e6-458554737b27" />  ghostty:  <img width="2532" height="1418" alt="Image" src="https://github.com/user-attachments/assets/496d10da-88d2-45dd-90b5-85207ed7e988" />  This is similar to #1109, but that one should already be resolved whilst mine persists.
  **Post-Mortem & Fix Analysis**:
  > Hey, thanks for the report! I believe the previous PR solved the issue, it just hasn't been released yet (a big release is coming). In the meantime you can use the `main` version by building yourself or installing with `--HEAD` (or equivalent) for package managers that support it.  <img width="1200" height="680" alt="Image" src="https://github.com/user-attachments/assets/a1522065-000f-48ec-a667-79d30026fbe4" />

- **Issue #1139** (2026-09-19): **Systematic crash using history on debian trixie 13 aarch64 (freebox delta)**
  *Symptoms*: **Description** systematic crash wheen starting to fuzzy search through history after CTRL-R on debian 13 trixie aarch 64 runnning on freebox delta  **Expected behavior** Crash when fuzzy  searching through history  **Environment**  - OS: [e.g. Windows] - TV version: 0.15.9 - shell: zsh - terminal: ghostty - **Your configuration file: attached   **Additional context** Any other context about the bug here.  Crash file:  ``` name = "television" operating_system = "Debian 13.0.0 (trixie) [64-bit]" crate_version = "0.15.9" explanation = """ Panic occurred in file '/cargo/registry/src/index.crates.io-1949cf8c6b5b557f/television-nucleo-0.5.0/src/worker.rs' at line 21 """ cause = "index out of bounds: the len is 0 but the index is 0" method = "Panic" backtrace = """    0:     0xaaaae098b4cc - <unresolved>    1:     0xaaaae0cad0cc - <unresolved>    2:     0xaaaae0af0fcc - <unresolved>    3:     0xaaaae0b0ef48 - <unresolved>    4:     0xaaaae0b0ef04 - <unresolved>    5:     0xaaaae0b0f468 - <unresolved>    6:     0xaaaae086ecd0 - <unresolved>    7:     0xaaaae086ee24 - <unresolved>    8:     0xaaaae0beefe4 - <unresolved>    9:     0xaaaae0bf66ac - <unresolved>   10:     0xaaaae0beef58 - <unresolved>   11:     0xaaaae0bf66ac - <unresolved>   12:     0xaaaae0beef58 - <unresolved>   13:     0xaaaae0bede94 - <unresolved>   14:     0xaaaae087879c - <unresolved>   15:     0xaaaae09cd4e0 - <unresolved>   16:     0xaaaae09cd250 - <unresolved>   17:     0xaaaae0b10ebc - <unresolved>   18:     
  **Post-Mortem & Fix Analysis**:
  > [config.txt](https://github.com/user-attachments/files/31950656/config.txt)
  > I dug into this a bit — I believe I found the root cause, and it's fully explained by the panic location plus the code as of the `0.15.9` tag.  ### The panic  `television-nucleo-0.5.0/src/worker.rs:21` is [`Matchers::get()`](https://github.com/alexpasmantier/nucleo/blob/main/src/worker.rs#L15-L21) in alexpasmantier's fork of `nucleo` (published to crates.io as `television-nucleo`, used by tv 0.15.9):  ```rust struct Matchers(Box<[UnsafeCell<nucleo_matcher::Matcher>]>);  impl Matchers {     unsafe fn get(&self) -> &mut nucleo_matcher::Matcher {         &mut *self.0[rayon::current_thread_index().unwrap()].get()     } } ```  `self.0` is sized once, in `Worker::new`, directly from the `worker_threads` value that's passed in:  ```rust let worker_threads = worker_threads     .unwrap_or_else(|| std::thread::available_parallelism().map_or(4, |it| it.get())); let pool = rayon::ThreadPoolBuilder::new()     .num_threads(worker_threads)     .build()     .expect("creating threadpool failed"); let m
  > Quick follow-up to confirm the hypothesis above — it's no longer a theory, I reproduced the panic standalone.  The trigger is `available_parallelism() <= 3`. I reproduced it on a 2-core Debian 13 trixie aarch64 box (same family as the Freebox this was reported from), with a ~25 line program that just calls `television-nucleo` 0.5.0 the way tv 0.15.9 does:  ``` available_parallelism = Ok(2) -> matcher_threads() = 0 thread 'nucleo worker 0' panicked at television-nucleo-0.5.0/src/worker.rs:21:15: index out of bounds: the len is 0 but the index is 0 thread 'nucleo worker 1' panicked at television-nucleo-0.5.0/src/worker.rs:21:15: index out of bounds: the len is 0 but the index is 1 Rayon: detected unexpected panic; aborting ```  Identical to the crash report, and note the second line: rayon really did build a pool with more than one thread from `num_threads(0)`, while the matcher array was sized `(0..0)`.  So `nproc` on the affected machine answers the question — anything reporting 3 or f

- **Issue #1131** (2026-09-06): **flake fails to build after bump of rust**
  *Symptoms*: **Description** The repo's nix flake no longer builds after the changes in 1b04911afe075932257263f996470667c5c61919   Relevant error output:  ```        … from call site          at /nix/store/9c8pi8f031rbhrr9ibj8h19rlm9mvkgr-source/lib/rust-bin.nix:146:44:           145|       let           146|         toolchain = toolchainFromManifest (selectManifest {              |                                            ^           147|           inherit channel;         … while calling 'selectManifest'          at /nix/store/9c8pi8f031rbhrr9ibj8h19rlm9mvkgr-source/lib/rust-bin.nix:64:5:            63|   selectManifest =            64|     {              |     ^            65|       channel,         … from call site          at /nix/store/9c8pi8f031rbhrr9ibj8h19rlm9mvkgr-source/lib/rust-bin.nix:109:7:           108|     else if asVersion != null then           109|       assertWith (date == null) "Stable version with specific date is not supported" (              |       ^           110|         # "1.49"         … while calling 'assertWith'          at /nix/store/9c8pi8f031rbhrr9ibj8h19rlm9mvkgr-source/lib/rust-bin.nix:70:20:            69|       assertWith =            70|         cond: msg: body:              |                    ^            71|         if cond then body else throw msg;         … while evaluating the attribute 'stable.""'          at /nix/store/9c8pi8f031rbhrr9ibj8h19rlm9mvkgr-source/lib/manifests.nix:158:3:           157| {           158|   stable = uncompressMan
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! Should be fixed by 453c8eb5cefdbe174e3ffaa4f0dcd6ec366f5e25
  > Also added a [ci check](https://github.com/alexpasmantier/television/pull/1137) for the nix build so we catch future issues earlier 👍🏻 

- **Issue #1121** (2026-07-24): **Crash report - Failed to enter TUI mode: The cursor position could not be read within a normal duration (with backtrace)**
  *Symptoms*: **Description** When i try to integrate tv into zed editor or simply when i run `kate $(tv files)` in bash or `zed (tv files)`  **Example** in bash shell: `kate $(tv files)` or in fish shell: `zed (tv files)`  **Expected behavior** Expected normal behavior like when i run "tv files"  **Environment**  - OS: Linux Kubuntu 24.04.4 LTS, plasma desktop (x11) - TV version: v0.15.9 - shell: fish, bash - terminal: konsole - config (not changed from default) ``` # CONFIGURATION FILE LOCATION ON YOUR SYSTEM: # ------------------------------------------- # Defaults: # --------- #  Linux:   `$HOME/.config/television/config.toml` #  macOS:   `$HOME/.config/television/config.toml` #  Windows: `%LocalAppData%\television\config\config.toml` # # XDG dirs: # --------- # You may use XDG_CONFIG_HOME if set on your system. # In that case, television will expect the configuration file to be in: # `$XDG_CONFIG_HOME/television/config.toml` #  # General settings # ---------------------------------------------------------------------------- tick_rate = 50 default_channel = "files" # Shell settings # -------------- # Default shell used for executing commands (source, preview, actions). # Options: bash, zsh, fish, powershell, cmd, nu # If not specified, the shell is detected from the environment ($SHELL on Unix). # Channel-specific shell settings override this global setting. # shell = "bash" # History settings # --------------- # Maximum number of entries to keep in the global history (default: 100) # 
  **Post-Mortem & Fix Analysis**:
  > Do you get the same issue when installing tv with `cargo install --locked television`? My guess is you're resolving to a more recent version of ratatui-core which changed how `Terminal::clear` behaves.
  > You're right. Installing using --locked works. Thank you very much. 

- **Issue #1114** (2026-07-16): **flake doesn't build on latest commit**
  *Symptoms*: **Description** I just updated my flake which includes the one from this repo and tv no longer builds.  **Example** ```        > +++ command cargo build --release --message-format json-render-diagnostics --locked        >    Compiling television v0.15.9 (/build/source)        > error: couldn't read `television/config/legacy_config_templates.json`: No such file or directory (os error 2)        >   --> television/config/migration.rs:22:32        >    |        > 22 | const LEGACY_TEMPLATES: &str = include_str!("legacy_config_templates.json");        >    |                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^        >        > error: could not compile `television` (lib) due to 1 previous error ```  **Environment**  - OS: Linux - TV version: head - shell: nu, fish - terminal: wezterm 
  **Post-Mortem & Fix Analysis**:
  > on it, crane fileset filtered out the file, fixing

- **Issue #1113** (2026-07-17): **nushell integration script error**
  *Symptoms*: **Description** After commit 7b5afe4bbeb6b34cfd668533e37e47aba0d48443 nushell throws an error when loading the tv integration script.  **Example** This is the error:  ``` Error: nu::shell::invalid_value    × Invalid value    ╭─[default_config.nu:4:26] 3 │ # version = "0.114.0" 4 │ $env.config.color_config = {    ·                                        ┬    ·                                        ╰── expected 'char_<char>' or 'char_u<hex code>', but got char_{tv_smart_autocomplete_keybinding} 5 │     separator: default    ╰──── ```  **Environment**  - OS: Linux/Guix System - TV version: head - shell: nu, fish - terminal: wezterm, ghostty, eshell, foot - using default config with no file  
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report.  @maxstrb since you worked on that code recently and have the context (and use nushell 😅), would you mind having a look at what the issue might be? That would be awesome :) 
  > Sure, looking into it,  @emenel What output do you get just running `tv init nu`? More specifically do you see `char_{tv_smart_autocomplete_keybinding}` in the output?
  > > Sure, looking into it, >  > [@emenel](https://github.com/emenel) What output do you get just running `tv init nu`? More specifically do you see `char_{tv_smart_autocomplete_keybinding}` in the output?  I just tested it and no, I don't see that in the output. Here's what I get:  ``` def tv_smart_autocomplete [] {     let line = (commandline)     let cursor = (commandline get-cursor)     let lhs = ($line | str substring 0..$cursor)     let rhs = ($line | str substring $cursor..)     let output = (tv --no-status-bar --inline --autocomplete-prompt $lhs | str trim)      if ($output | str length) > 0 {         let needs_space = not ($lhs | str ends-with " ")         let lhs_with_space = if $needs_space { $"($lhs) " } else { $lhs }         let new_line = $lhs_with_space + $output + $rhs         let new_cursor = ($lhs_with_space + $output | str length)         commandline edit --replace $new_line         commandline set-cursor $new_cursor     } }  def tv_shell_history [] {     let current_pr

- **Issue #1109** (2026-07-20): **Many Unicode/Emoji Chars Render as Null Characters.**
  *Symptoms*: **Description** Hi I am trying to use television as an emoji picker on my system. I have a emoji file I made myself and I also sometimes use the Unicode channel provided. Many emojis or unicode chars are actually shown as null characters.  **Example** Run "tv unicode" and search for melting:  <img width="1918" height="1076" alt="Image" src="https://github.com/user-attachments/assets/6c752258-5677-469d-ac0b-1e44eedb69d3" />  <img width="1918" height="1076" alt="Image" src="https://github.com/user-attachments/assets/a91b07b8-5f30-4580-83c5-ece0f623d612" />  **Expected behavior** from skim: (for example look at the melting face emoji) <img width="1918" height="1076" alt="Image" src="https://github.com/user-attachments/assets/124b43c0-244e-4b3f-8bb7-4d0e0523bf0c" />  **Environment**  - OS: Linux - TV version: 0.15.9 - shell: fish,bash - terminal: alacritty - **Your configuration file (`~/.config/television/config.toml`)** I use the default config file, I only changed the theme. ```toml # CONFIGURATION FILE LOCATION ON YOUR SYSTEM: # ------------------------------------------- # Defaults: # --------- #  Linux:   `$HOME/.config/television/config.toml` #  macOS:   `$HOME/.config/television/config.toml` #  Windows: `%LocalAppData%\television\config\config.toml` # # XDG dirs: # --------- # You may use XDG_CONFIG_HOME if set on your system. # In that case, television will expect the configuration file to be in: # `$XDG_CONFIG_HOME/television/config.toml` #  # General settings # -------
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. Should be fixed by https://github.com/alexpasmantier/television/pull/1119

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

### Incident Patch 1: `1d40215f` (2026-10-05)
**Commit Message**: feat(tui): enable xterm modifyOtherKeys without kitty protocol

**File**: `television/tui.rs` (modified, +15/-0)
```diff
@@ -13,6 +13,7 @@ use crossterm::{
         PopKeyboardEnhancementFlags, PushKeyboardEnhancementFlags,
     },
     execute,
+    style::Print,
     terminal::{
         ClearType, EnterAlternateScreen, LeaveAlternateScreen, ScrollUp,
         disable_raw_mode, enable_raw_mode, is_raw_mode_enabled,
@@ -26,6 +27,10 @@ use ratatui::{
 };
 use tracing::debug;
 
+/// xterm `modifyOtherKeys` mode 2 on / reset.
+const MODIFY_OTHER_KEYS_ON: &str = "\x1b[>4;2m";
+const MODIFY_OTHER_KEYS_OFF: &str = "\x1b[>4;0m";
+
 #[derive(Debug, Clone, PartialEq, Eq)]
 pub enum TuiMode {
     Fullscreen,
@@ -378,6 +383,14 @@ where
                     KeyboardEnhancementFlags::DISAMBIGUATE_ESCAPE_CODES
                 )
             )?;
+        } else {
+            // Terminals without the kitty protocol (e.g. tmux) only report
+            // modified keys like shift-enter if asked via modifyOtherKeys.
+            debug!("Enabling xterm modifyOtherKeys");
+            execute!(
+                self.terminal.backend_mut(),
+                Print(MODIFY_OTHER_KEYS_ON)
+            )?;
         }
         Ok(())
     }
@@ -403,6 +416,8 @@ where
 
             if self.keyboard_enhancement {
                 execute!(backend, PopKeyboardEnhancementFlags)?;
+            } else {
+                execute!(backend, Print(MODIFY_OTHER_KEYS_OFF))?;
             }
 
             execute!(backend, DisableMouseCapture)?;
```

---

### Incident Patch 2: `7ef0e75b` (2026-09-15)
**Commit Message**: fix: respect channel preview cache settings

**File**: `docs/reference/01-cli.md` (modified, +3/-3)
```diff
@@ -120,15 +120,15 @@ Preview:
           entry and its result is displayed below the preview panel.
 
       --cache-preview
-          Whether to cache the preview command output for each entry.
+          Enable caching of the preview command output for each entry.
           
           This can be useful when the preview command is expensive to run
           and you want to avoid running it multiple times for the same entry.
           
           This is enabled by default since most channels will benefit from it.
           
-          This can be disabled for special cases e.g. where the preview command output changes
-          frequently and/or you want live udpates.
+          Set `cached = false` in the channel's [preview] section to disable caching.
+          Passing this flag overrides that setting and enables caching for this invocation.
 
       --preview-offset <STRING>
           A preview line number offset template to use to scroll the preview to for each
```

**File**: `man/tv.1` (modified, +3/-3)
```diff
@@ -112,15 +112,15 @@ The given value is parsed as a `MultiTemplate`. It is evaluated for every
 entry and its result is displayed below the preview panel.
 .TP
 \fB\-\-cache\-preview\fR
-Whether to cache the preview command output for each entry.
+Enable caching of the preview command output for each entry.
 
 This can be useful when the preview command is expensive to run
 and you want to avoid running it multiple times for the same entry.
 
 This is enabled by default since most channels will benefit from it.
 
-This can be disabled for special cases e.g. where the preview command output changes
-frequently and/or you want live udpates.
+Set `cached = false` in the channel\*(Aqs [preview] section to disable caching.
+Passing this flag overrides that setting and enables caching for this invocation.
 .TP
 \fB\-\-preview\-offset\fR \fI<STRING>\fR
 A preview line number offset template to use to scroll the preview to for each
```

**File**: `television/cli/args.rs` (modified, +3/-4)
```diff
@@ -164,18 +164,17 @@ pub struct Cli {
     )]
     pub preview_footer: Option<String>,
 
-    /// Whether to cache the preview command output for each entry.
+    /// Enable caching of the preview command output for each entry.
     ///
     /// This can be useful when the preview command is expensive to run
     /// and you want to avoid running it multiple times for the same entry.
     ///
     /// This is enabled by default since most channels will benefit from it.
     ///
-    /// This can be disabled for special cases e.g. where the preview command output changes
-    /// frequently and/or you want live udpates.
+    /// Set `cached = false` in the channel's [preview] section to disable caching.
+    /// Passing this flag overrides that setting and enables caching for this invocation.
     #[arg(
         long,
-        default_value = "true",
         verbatim_doc_comment,
         conflicts_with = "no_preview",
         help_heading = "Preview"
```

**File**: `television/config/layers.rs` (modified, +66/-2)
```diff
@@ -170,7 +170,7 @@ impl ConfigLayers {
                 },
             );
         let channel_preview_cached = self.channel_cli.cache_preview
-            || self.channel.preview.as_ref().is_some_and(|p| p.cached);
+            || self.channel.preview.as_ref().is_none_or(|p| p.cached);
 
         // Channel > base config fields
         let remote_show_channel_descriptions = self
@@ -763,7 +763,12 @@ impl MergedConfig {
 #[cfg(test)]
 mod tests {
     use super::*;
-    use crate::channels::prototypes::UiSpec;
+    use crate::{
+        cable::Cable,
+        channels::prototypes::UiSpec,
+        cli::{args::Cli, post_process},
+    };
+    use clap::Parser;
 
     fn merge_layers(
         config: Config,
@@ -782,6 +787,65 @@ mod tests {
         .merge()
     }
 
+    #[test]
+    fn preview_cache_respects_channel_config_and_explicit_cli_override() {
+        for (setting, flag, expected) in [
+            ("", false, true),
+            ("cached = true", false, true),
+            ("cached = false", false, false),
+            ("cached = false", true, true),
+        ] {
+            let prototype: ChannelPrototype = toml::from_str(&format!(
+                r#"
+                [metadata]
+                name = "test"
+                [source]
+                command = "echo entry"
+                [preview]
+                command = "echo preview"
+                {setting}
+                "#
+            ))
+            .unwrap();
+            let cable = Cable::from_prototypes(vec![prototype.clone()]);
+            let mut args = vec!["tv", "test"];
+            if flag {
+                args.push("--cache-preview");
+            }
+            let cli = post_process(
+                Cli::try_parse_from(args).unwrap(),
+                false,
+                &cable,
+            );
+            let merged =
+                ConfigLayers::new(Config::default(), prototype, cli).merge();
+            assert_eq!(
+                merged.channel_preview_cached, expected,
+                "{setting:?}, --cache-preview: {flag}"
+            );
+        }
+    }
+
+    #[test]
+    fn preview_cache_defaults_to_enabled_for_adhoc_preview() {
+        let cli = Cli::try_parse_from([
+            "tv",
+            "--source-command",
+            "echo entry",
+            "--preview-command",
+            "echo preview",
+        ])
+        .unwrap();
+        let cli = post_process(cli, false, &Cable::default());
+        let merged = ConfigLayers::new(
+            Config::default(),
+            ChannelPrototype::new("test", "echo entry"),
+            cli,
+        )
+        .merge();
+        assert!(merged.channel_preview_cached);
+    }
+
     #[test]
     fn minimal_preset_applies_to_inline_and_height() {
         for global_cli in [
```

---

### Incident Patch 3: `c2b208ee` (2026-09-22)
**Commit Message**: fix(tui): always query kitty keyboard protocol support through /dev/tty

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2758,6 +2758,7 @@ dependencies = [
  "frizbee",
  "human-panic",
  "lazy-regex",
+ "libc",
  "memchr",
  "parking_lot",
  "phantom-test",
```

**File**: `Cargo.toml` (modified, +3/-0)
```diff
@@ -65,6 +65,9 @@ crossterm = { version = "0.28.1", features = ["serde", "use-dev-tty"] }
 [target.'cfg(not(target_os = "macos"))'.dependencies]
 crossterm = { version = "0.28", features = ["serde"] }
 
+[target.'cfg(unix)'.dependencies]
+libc = "0.2"
+
 [target.'cfg(windows)'.dependencies]
 winapi-util = "0.1.9"
 clipboard-win = "5.4.0"
```

**File**: `television/tui.rs` (modified, +85/-4)
```diff
@@ -1,7 +1,8 @@
 use std::{
     fs::OpenOptions,
-    io::{BufReader, LineWriter, Read, Write, stderr, stdout},
+    io::{self, BufReader, LineWriter, Read, Write, stderr, stdout},
     ops::{Deref, DerefMut},
+    time::{Duration, Instant},
 };
 
 use anyhow::Result;
@@ -15,7 +16,6 @@ use crossterm::{
     terminal::{
         ClearType, EnterAlternateScreen, LeaveAlternateScreen, ScrollUp,
         disable_raw_mode, enable_raw_mode, is_raw_mode_enabled,
-        supports_keyboard_enhancement,
     },
 };
 use ratatui::{
@@ -84,8 +84,7 @@ where
         let mut options = TerminalOptions::default();
         enable_raw_mode()?;
 
-        let keyboard_enhancement =
-            supports_keyboard_enhancement().unwrap_or(false);
+        let keyboard_enhancement = Self::supports_keyboard_enhancement();
 
         let terminal_size = backend.size()?;
         let viewport = match mode {
@@ -236,6 +235,88 @@ where
         }
     }
 
+    /// Whether the terminal supports the kitty keyboard protocol.
+    ///
+    /// Crossterm's current version is broken (it tries to write to /dev/tty with the wrong
+    /// permissions) and causes the query to be sent to stdout which is not always a tty (e.g.
+    /// when piping tv's output to another command).
+    #[cfg(unix)]
+    fn supports_keyboard_enhancement() -> bool {
+        use std::os::fd::AsRawFd;
+
+        /// See <https://sw.kovidgoyal.net/kitty/keyboard-protocol/#detection-of-support-for-this-protocol>.
+        const QUERY: &[u8] = b"\x1b[?u\x1b[c";
+        const TIMEOUT: Duration = Duration::from_secs(2);
+
+        let Ok(mut tty) =
+            OpenOptions::new().read(true).append(true).open("/dev/tty")
+        else {
+            debug!(
+                "Failed to open /dev/tty, assuming no keyboard enhancement support"
+            );
+            return false;
+        };
+        if let Err(e) = tty.write_all(QUERY) {
+            debug!(
+                "Failed to write to /dev/tty ({}), assuming no keyboard enhancement support",
+                e
+            );
+            return false;
+        }
+
+        // poll for the response
+        let deadline = Instant::now() + TIMEOUT;
+        let mut supported = false;
+        let mut buf = [0u8; 64];
+        'wait: loop {
+            let remaining = deadline.saturating_duration_since(Instant::now());
+            let timeout_ms =
+                i32::try_from(remaining.as_millis()).unwrap_or(i32::MAX);
+            let mut pfd = libc::pollfd {
+                fd: tty.as_raw_fd(),
+                events: libc::POLLIN,
+                revents: 0,
+            };
+            let ready = unsafe { libc::poll(&raw mut pfd, 1, timeout_ms) };
+            // poll returns 0 on timeout, -1 on error, and the number of ready fds otherwise
+            if ready == 0 {
+                debug!(
+                    "Timed out waiting for the keyboard enhancement query response"
+                );
+                break;
+            }
+            if ready < 0 {
+                debug!(
+                    "Failed to poll /dev/tty: {}",
+                    io::Error::last_os_error()
+                );
+                break;
+            }
+            let n = match tty.read(&mut buf) {
+                Ok(0) => break,
+                Ok(n) => n,
+                Err(e) => {
+                    debug!("Error reading from /dev/tty: {}", e);
+                    break;
+                }
+            };
+            for &byte in &buf[..n] {
+                match byte {
+                    b'u' => supported = true,
+                    b'c' => break 'wait, // End of the device attributes response
+                    _ => {}
+                }
+            }
+        }
+        debug!("Keyboard enhancement supported: {}", supported);
+        supported
+    }
+
+    #[cfg(windows)]
+    fn supports_keyboard_enhancement() -> bool {
+        crossterm::terminal::supports_keyboard_enhancement().unwrap_or(false)
+    }
+
     pub fn resize_viewport(&mut self, w: u16, h: u16) -> Result<()> {
         debug!("Resizing viewport to: {:?}", (w, h));
         // simpler implementation: just resize the terminal to the new size
```

---

### Incident Patch 4: `e63f48fa` (2026-09-22)
**Commit Message**: feat(ui): respect border settings for action and remote panes

**File**: `television/config/layers.rs` (modified, +2/-15)
```diff
@@ -474,12 +474,8 @@ impl ConfigLayers {
             // 1-column left margin, aligning the entries with the query
             results_panel_padding = Padding::new(0, 0, 1, 0);
         }
-        // a borderless preview still needs a hint of separation from the
-        // results list: a thin hairline on the side facing them
-        let preview_panel_separator =
-            preview_panel_border_type == BorderType::None;
-        // breathing room between the preview title and its content
-        if preview_panel_separator
+        // space between the preview title and its content
+        if preview_panel_border_type == BorderType::None
             && self.channel_cli.preview_padding.is_none()
             && preview_panel_padding == Padding::default()
         {
@@ -579,7 +575,6 @@ impl ConfigLayers {
             preview_panel_word_wrap,
             preview_panel_hidden,
             preview_panel_disabled,
-            preview_panel_separator,
             preview_panel_auto_hide,
             fullscreen,
             // help panel
@@ -686,9 +681,6 @@ pub struct MergedConfig {
     pub preview_panel_word_wrap: bool,
     pub preview_panel_hidden: bool,
     pub preview_panel_disabled: bool,
-    /// Draw a single separator line between results and preview
-    /// (minimal UI preset, only when no preview border is configured).
-    pub preview_panel_separator: bool,
     /// Hide the preview automatically when the viewport is too small to fit
     /// a useful pane next to (or below) the results.
     pub preview_panel_auto_hide: bool,
@@ -818,7 +810,6 @@ mod tests {
             assert_eq!(merged.input_bar_padding, Padding::new(0, 1, 1, 0));
             assert_eq!(merged.results_panel_padding, Padding::new(0, 0, 1, 0));
             assert_eq!(merged.preview_panel_padding, Padding::new(1, 0, 0, 0));
-            assert!(merged.preview_panel_separator);
             assert!(merged.preview_panel_auto_hide);
             assert!(!merged.preview_panel_scrollbar);
             assert!(merged.input_bar_minimal);
@@ -840,7 +831,6 @@ mod tests {
         assert_eq!(merged.preview_panel_border_type, BorderType::None);
         assert!(merged.input_bar_header_hidden());
         assert_eq!(merged.input_bar_prompt.as_deref(), Some(""));
-        assert!(merged.preview_panel_separator);
         assert!(merged.input_bar_minimal);
         // ...but the status bar stays
         assert!(!merged.status_bar_hidden);
@@ -897,7 +887,6 @@ mod tests {
         );
         assert_eq!(merged.preview_panel_size, 60);
         assert_eq!(merged.preview_panel_border_type, BorderType::None);
-        assert!(merged.preview_panel_separator);
         // but a channel explicitly picking a non-default border keeps it
         let mut prototype = ChannelPrototype::new("test", "echo 1");
         prototype.ui = Some(UiSpec {
@@ -917,7 +906,6 @@ mod tests {
             },
         );
         assert_eq!(merged.preview_panel_border_type, BorderType::Thick);
-        assert!(!merged.preview_panel_separator);
     }
 
     #[test]
@@ -939,7 +927,6 @@ mod tests {
         );
         assert!(!merged.status_bar_hidden);
         assert_eq!(merged.preview_panel_border_type, BorderType::Rounded);
-        assert!(!merged.preview_panel_separator);
         assert_eq!(merged.input_bar_header.as_deref(), Some("Custom"));
         // fields the CLI didn't touch still get the preset
         assert_eq!(merged.results_panel_border_type, BorderType::None);
```

**File**: `television/draw.rs` (modified, +8/-18)
```diff
@@ -7,14 +7,14 @@ use crate::{
     picker::Picker,
     previewer::state::PreviewState,
     screen::{
-        action_picker::draw_minimal_actions_pane,
+        action_picker::draw_actions_pane,
         colors::Colorscheme,
         help_panel::draw_help_pane,
         input::{SourceIndicator, draw_input_box},
-        layout::{Layout, pane_separator_side},
+        layout::Layout,
         missing_requirements_popup::draw_missing_requirements_popup,
         preview::draw_preview_content_block,
-        results::{draw_minimal_picker_list, draw_results_list},
+        results::{draw_picker_list, draw_results_list},
         status_bar,
     },
     television::{MissingRequirementsPopup, Mode},
@@ -205,14 +205,16 @@ pub fn draw(ctx: Ctx, f: &mut Frame<'_>, area: Rect) -> Result<Layout> {
     // the remote control takes over the main results and input areas
     if show_remote {
         let picker = &ctx.tv_state.rc_picker;
-        draw_minimal_picker_list(
+        draw_picker_list(
             f,
             layout.results,
             &picker.entries,
             &mut picker.relative_state.clone(),
             ctx.config.input_bar_position,
             &ctx.colorscheme,
             &ctx.config.results_panel_padding,
+            &ctx.config.results_panel_border_type,
+            Some("Channels"),
             ctx.config.remote_show_channel_descriptions,
         )?;
         draw_input_box(
@@ -296,32 +298,20 @@ pub fn draw(ctx: Ctx, f: &mut Frame<'_>, area: Rect) -> Result<Layout> {
             .config
             .input_map
             .get_key_for_action(&Action::CyclePreviews);
-        // when the minimal UI preset is active, draw a hairline on the side
-        // of the preview that faces the results list
-        let separator = ctx.config.preview_panel_separator.then(|| {
-            pane_separator_side(
-                ctx.config.layout,
-                ctx.config.input_bar_position,
-            )
-        });
         draw_preview_content_block(
             f,
             preview_rect,
             ctx.tv_state.preview_state,
             &ctx.colorscheme,
-            &ctx.config.preview_panel_border_type,
-            &ctx.config.preview_panel_padding,
-            ctx.config.preview_panel_scrollbar,
-            ctx.config.preview_panel_word_wrap,
+            &ctx.config,
             cycle_previews_key,
-            separator,
         )?;
     }
 
     // the actions picker borrows the preview pane, so the entry the action
     // applies to stays visible in the results list
     if show_action_picker && let Some(pane) = layout.action_picker {
-        draw_minimal_actions_pane(
+        draw_actions_pane(
             f,
             pane,
             &ctx.tv_state.ap_picker.entries,
```

**File**: `television/screen/action_picker.rs` (modified, +15/-18)
```diff
@@ -1,27 +1,24 @@
 use crate::{
     channels::action_picker::ActionEntry,
     config::layers::MergedConfig,
+    config::ui::BorderType,
     screen::{
         colors::Colorscheme,
-        constants::HAIRLINE_BORDER_SET,
         input::draw_input_box,
-        layout::{InputPosition, pane_separator_side},
-        results::draw_minimal_picker_list,
+        layout::{InputPosition, preview_pane_block},
+        results::{draw_picker_list, picker_list_padding},
     },
     utils::input::Input,
 };
 use anyhow::Result;
 use ratatui::{
     Frame,
     layout::{Constraint, Direction, Layout, Rect},
-    prelude::Style,
-    widgets::{Block, ListState},
+    widgets::ListState,
 };
 
-/// Draw the minimal-mode actions picker inside the preview pane, so the
-/// entry the action applies to stays visible in the results list.
 #[allow(clippy::too_many_arguments)]
-pub fn draw_minimal_actions_pane(
+pub fn draw_actions_pane(
     f: &mut Frame,
     rect: Rect,
     entries: &[ActionEntry],
@@ -33,14 +30,8 @@ pub fn draw_minimal_actions_pane(
     config: &MergedConfig,
     colorscheme: &Colorscheme,
 ) -> Result<()> {
-    // hairline on the side facing the results, mirroring the preview
-    let separator =
-        pane_separator_side(config.layout, config.input_bar_position);
-    let pane_block = Block::default()
-        .style(Style::default().bg(colorscheme.general.background))
-        .borders(separator)
-        .border_set(HAIRLINE_BORDER_SET)
-        .border_style(Style::default().fg(colorscheme.general.border_fg));
+    // the action pane reuses the preview pane
+    let pane_block = preview_pane_block(config, colorscheme);
     let inner = pane_block.inner(rect);
     f.render_widget(pane_block, rect);
     if inner.area() == 0 {
@@ -85,14 +76,20 @@ pub fn draw_minimal_actions_pane(
             .then_some(("actions", colorscheme.mode.action_picker)),
         None,
     )?;
-    draw_minimal_picker_list(
+    let list_padding = picker_list_padding(
+        config.results_panel_padding,
+        config.preview_panel_border_type != BorderType::None,
+    );
+    draw_picker_list(
         f,
         list_rect,
         entries,
         relative_picker_state,
         config.input_bar_position,
         colorscheme,
-        &config.results_panel_padding,
+        &list_padding,
+        &BorderType::None,
+        None,
         true,
     )?;
 
```

**File**: `television/screen/help_panel.rs` (modified, +21/-30)
```diff
@@ -1,6 +1,4 @@
-use crate::screen::{
-    constants::HAIRLINE_BORDER_SET, layout::pane_separator_side,
-};
+use crate::screen::layout::{preview_hairline, preview_pane_block};
 use crate::utils::strings::SPACE;
 use crate::{
     action::{Action, CUSTOM_ACTION_PREFIX},
@@ -13,7 +11,7 @@ use ratatui::{
     layout::{Alignment, Rect},
     style::Style,
     text::{Line, Span},
-    widgets::{Block, Borders, Padding, Paragraph},
+    widgets::{Borders, Padding, Paragraph},
 };
 use std::collections::BTreeMap;
 
@@ -28,8 +26,7 @@ pub fn max_help_scroll(config: &MergedConfig, mode: Mode) -> u16 {
         .saturating_sub(MIN_VISIBLE_LINES)
 }
 
-/// Draws the help panel inside the preview pane (behind the hairline
-/// separator), like the actions picker.
+/// Draws the help panel inside the preview pane
 pub fn draw_help_pane(
     f: &mut Frame<'_>,
     rect: Rect,
@@ -38,36 +35,32 @@ pub fn draw_help_pane(
     scroll: u16,
     colorscheme: &Colorscheme,
 ) {
-    // hairline on the side facing the results, mirroring the preview
-    let separator =
-        pane_separator_side(config.layout, config.input_bar_position);
+    let hairline = preview_hairline(config);
+    let title_included_in_hairline =
+        hairline.is_some_and(|h| h.contains(Borders::TOP));
+    let hairline_style = Style::default().fg(colorscheme.general.border_fg);
+    // centered on a border, left-aligned otherwise
+    let title_alignment = if hairline.is_some() {
+        Alignment::Left
+    } else {
+        Alignment::Center
+    };
     let mode_color = match tv_mode {
         Mode::Channel => colorscheme.mode.channel,
         Mode::RemoteControl => colorscheme.mode.remote_control,
         Mode::ActionPicker => colorscheme.mode.action_picker,
     };
     let mut title_spans = vec![Span::from(" ")];
-    // the title embeds into a horizontal hairline, so lead with a line
-    // segment (same treatment as the preview title)
-    if separator.intersects(Borders::TOP) {
-        title_spans.insert(
-            0,
-            Span::styled(
-                "─",
-                Style::default().fg(colorscheme.general.border_fg),
-            ),
-        );
+    if title_included_in_hairline {
+        // "- title ------------------"
+        title_spans.insert(0, Span::styled("─", hairline_style));
     }
     title_spans
         .push(Span::styled("help", Style::default().fg(mode_color).bold()));
     title_spans.push(Span::from(" "));
 
-    let mut block = Block::default()
-        .title_top(Line::from(title_spans))
-        .style(Style::default().bg(colorscheme.general.background))
-        .borders(separator)
-        .border_set(HAIRLINE_BORDER_SET)
-        .border_style(Style::default().fg(colorscheme.general.border_fg))
+    let mut block = preview_pane_block(config, colorscheme)
+        .title_top(Line::from(title_spans).alignment(title_alignment))
         .padding(Padding {
             top: 1,
             right: 1,
@@ -100,11 +93,9 @@ pub fn draw_help_pane(
                 .fg(colorscheme.general.dimmed_text_fg)
                 .italic(),
         )];
-        if separator.intersects(Borders::TOP) {
-            percent_spans.push(Span::styled(
-                "─",
-                Style::default().fg(colorscheme.general.border_fg),
-            ));
+        // "------------- 7% -"
+        if title_included_in_hairline {
+            percent_spans.push(Span::styled("─", hairline_style));
         }
         block = block
             .title_top(Line::from(percent_spans).alignment(Alignment::Right));
```

**File**: `television/screen/layout.rs` (modified, +37/-6)
```diff
@@ -3,11 +3,14 @@ use crate::{
         layers::MergedConfig,
         ui::{BorderType, Padding},
     },
+    screen::{colors::Colorscheme, constants::HAIRLINE_BORDER_SET},
     television::Mode,
 };
 use clap::ValueEnum;
-use ratatui::layout::{
-    self, Constraint, Direction, Layout as RatatuiLayout, Rect,
+use ratatui::{
+    layout::{self, Constraint, Direction, Layout as RatatuiLayout, Rect},
+    style::Style,
+    widgets::{Block, Borders},
 };
 use serde::{Deserialize, Serialize};
 use std::fmt::Display;
@@ -92,12 +95,11 @@ impl From<crate::cli::args::LayoutOrientation> for Orientation {
 }
 
 /// Which side of the preview pane (or whatever borrows it) faces the
-/// results list — that's where the minimal UI draws its hairline separator.
-pub fn pane_separator_side(
+/// results list.
+fn results_facing_side(
     layout: Orientation,
     input_bar_position: InputPosition,
-) -> ratatui::widgets::Borders {
-    use ratatui::widgets::Borders;
+) -> Borders {
     match (layout, input_bar_position) {
         // pane on the right
         (Orientation::Landscape, _) => Borders::LEFT,
@@ -108,6 +110,35 @@ pub fn pane_separator_side(
     }
 }
 
+/// Even with no borders on the preview, we still draw a hairline to separate it from the results
+/// list.
+pub fn preview_hairline(config: &MergedConfig) -> Option<Borders> {
+    (config.preview_panel_border_type == BorderType::None)
+        .then(|| results_facing_side(config.layout, config.input_bar_position))
+}
+
+/// Block for the preview pane and whatever borrows it (actions picker,
+/// help panel)
+pub fn preview_pane_block(
+    config: &MergedConfig,
+    colorscheme: &Colorscheme,
+) -> Block<'static> {
+    let block = Block::default()
+        .style(Style::default().bg(colorscheme.general.background))
+        .border_style(Style::default().fg(colorscheme.general.border_fg));
+    match config.preview_panel_border_type.to_ratatui_border_type() {
+        Some(border_type) => {
+            block.borders(Borders::ALL).border_type(border_type)
+        }
+        None => block
+            .borders(results_facing_side(
+                config.layout,
+                config.input_bar_position,
+            ))
+            .border_set(HAIRLINE_BORDER_SET),
+    }
+}
+
 #[derive(Debug, Clone, Copy, PartialEq)]
 pub struct Layout {
     pub results: Rect,
```

**File**: `television/screen/preview.rs` (modified, +20/-39)
```diff
@@ -1,8 +1,11 @@
 use crate::{
-    config::ui::{BorderType, Padding},
+    config::layers::MergedConfig,
     event::Key,
     previewer::state::PreviewState,
-    screen::colors::Colorscheme,
+    screen::{
+        colors::Colorscheme,
+        layout::{preview_hairline, preview_pane_block},
+    },
     utils::strings::{
         ReplaceNonPrintableConfig, SPACE, replace_non_printable_bulk,
         shrink_with_ellipsis,
@@ -19,19 +22,15 @@ use ratatui::{
     },
 };
 
-#[allow(clippy::too_many_arguments)]
 pub fn draw_preview_content_block(
     f: &mut Frame,
     rect: Rect,
     preview_state: PreviewState,
     colorscheme: &Colorscheme,
-    border_type: &BorderType,
-    padding: &Padding,
-    scrollbar: bool,
-    word_wrap: bool,
+    config: &MergedConfig,
     cycle_key: Option<Key>,
-    separator: Option<Borders>,
 ) -> Result<()> {
+    let scrollbar = config.preview_panel_scrollbar;
     let total_lines =
         preview_state.preview.total_lines.saturating_sub(1) as usize;
     let scroll = preview_state.scroll;
@@ -52,14 +51,12 @@ pub fn draw_preview_content_block(
         f,
         rect,
         colorscheme,
-        *border_type,
-        *padding,
+        config,
         &preview_state.preview.title,
         preview_state.preview.footer,
         preview_state.preview.preview_index,
         preview_state.preview.preview_count,
         cycle_key,
-        separator,
         scroll_percent,
     );
 
@@ -71,7 +68,7 @@ pub fn draw_preview_content_block(
         content,
         preview_state.preview.target_line,
         colorscheme.preview.highlight_bg,
-        word_wrap,
+        config.preview_panel_word_wrap,
     );
     f.render_widget(Clear, inner);
     f.render_widget(rp, inner);
@@ -138,14 +135,12 @@ fn draw_content_outer_block(
     f: &mut Frame,
     rect: Rect,
     colorscheme: &Colorscheme,
-    border_type: BorderType,
-    padding: Padding,
+    config: &MergedConfig,
     preview_title: &str,
     preview_footer: Option<String>,
     preview_index: usize,
     preview_count: usize,
     cycle_key: Option<Key>,
-    separator: Option<Borders>,
     scroll_percent: Option<u8>,
 ) -> Rect {
     let (indicator, key_hint) = if preview_count > 1 {
@@ -190,27 +185,27 @@ fn draw_content_outer_block(
     }
     preview_title_spans.push(Span::from(SPACE));
 
+    let hairline = preview_hairline(config);
+    let borderless = hairline.is_some();
     // without a border to anchor them, titles read better left-aligned
-    let title_alignment = if border_type.to_ratatui_border_type().is_some() {
-        Alignment::Center
-    } else {
+    let title_alignment = if borderless {
         Alignment::Left
+    } else {
+        Alignment::Center
     };
 
     // ratatui draws titles on the border row: with a horizontal hairline the
     // title embeds into the line, so lead with a line segment instead of a
     // bare space (`─ title ───` rather than ` title ───`)
-    let borderless = border_type.to_ratatui_border_type().is_none();
-    let embeds_into = |side: Borders| {
-        borderless && separator.is_some_and(|s| s.contains(side))
-    };
+    let embeds_into =
+        |side: Borders| hairline.is_some_and(|h| h.contains(side));
     let hairline_style = Style::default().fg(colorscheme.general.border_fg);
 
     if embeds_into(Borders::TOP) {
         preview_title_spans.insert(0, Span::styled("─", hairline_style));
     }
 
-    let mut block = Block::default().title_top(
+    let mut block = preview_pane_block(config, colorscheme).title_top(
         Line::from(preview_title_spans)
             .alignment(title_alignment)
             .style(Style::default().fg(colorscheme.preview.title_fg)),
@@ -248,22 +243,8 @@ fn draw_content_outer_block(
         block = block.title_bottom(footer_line);
     }
 
-    let mut preview_outer_block = block
-        .style(Style::default().bg(colorscheme.general.background))
-        .padding(RatatuiPadding::from(padding));
-    if let Some(border_type) = border_type.to_ratatui_border_type() {
-        preview_outer_block = preview_outer_block
-            .borders(Borders::ALL)
-            .border_type(border_type)
-            .border_style(Style::default().fg(colorscheme.general.border_fg));
-    } else if let Some(separator) = separator {
-        // borderless preview (minimal UI): a thin hairline on the side
-        // facing the results provides just enough separation
-        preview_outer_block = preview_outer_block
-            .borders(separator)
-            .border_set(crate::screen::constants::HAIRLINE_BORDER_SET)
-            .border_style(hairline_style);
-    }
+    let preview_outer_block =
+        block.padding(RatatuiPadding::from(config.preview_panel_padding));
 
     let inner = preview_outer_block.inner(rect);
     f.render_widget(preview_outer_block, rect);
```

**File**: `television/screen/results.rs` (modified, +29/-6)
```diff
@@ -108,23 +108,46 @@ pub fn draw_results_list(
     Ok(())
 }
 
-/// Draw a minimal-mode picker list (remote control / actions picker
-/// takeover): borderless, color-only selection, dimmed description and
-/// shortcut columns.
+/// Picker lists have no pointer column keeping entries off a border, so
+/// inside one they get a 1-column inset.
+pub fn picker_list_padding(padding: Padding, bordered: bool) -> Padding {
+    let mut padding = padding;
+    if bordered {
+        padding.left = padding.left.max(1);
+    }
+    padding
+}
+
 #[allow(clippy::too_many_arguments)]
-pub fn draw_minimal_picker_list<T: result_item::ResultItem>(
+pub fn draw_picker_list<T: result_item::ResultItem>(
     f: &mut Frame,
     rect: Rect,
     entries: &[T],
     relative_picker_state: &mut ListState,
     input_bar_position: InputPosition,
     colorscheme: &Colorscheme,
     padding: &Padding,
+    border_type: &BorderType,
+    title: Option<&str>,
     show_descriptions: bool,
 ) -> Result<()> {
-    let block = Block::default()
+    let padding =
+        picker_list_padding(*padding, *border_type != BorderType::None);
+    let mut block = Block::default()
         .style(Style::default().bg(colorscheme.general.background))
-        .padding(RatatuiPadding::from(*padding));
+        .padding(RatatuiPadding::from(padding));
+    if let Some(border_type) = border_type.to_ratatui_border_type() {
+        block = block
+            .borders(Borders::ALL)
+            .border_type(border_type)
+            .border_style(Style::default().fg(colorscheme.general.border_fg));
+        if let Some(title) = title {
+            block = block.title_top(
+                Line::from(format!(" {} ", title))
+                    .alignment(Alignment::Center),
+            );
+        }
+    }
 
     let list_direction = match input_bar_position {
         InputPosition::Bottom => ratatui::widgets::ListDirection::BottomToTop,
```

**File**: `tests/pty/layout.rs` (modified, +58/-0)
```diff
@@ -406,6 +406,64 @@ fn test_height_minimal_picker_takeover() {
     s.wait().exit_code(0).until().unwrap();
 }
 
+/// The remote control uses the results border (with a title), the actions
+/// picker and the help panel use the preview border.
+#[test]
+fn test_takeover_panes_follow_configured_borders() {
+    let pt = phantom();
+
+    let s = tv_local_config_and_cable_with_args(
+        &pt,
+        &[
+            "files",
+            "--height",
+            "20",
+            "--results-border",
+            "rounded",
+            "--preview-border",
+            "thick",
+        ],
+    )
+    .env(TESTING_ENV_VAR, "1")
+    .start()
+    .unwrap();
+
+    s.wait().text("· files").until().unwrap();
+
+    // remote control: rounded results border with a title, entries not
+    // touching it
+    s.send().key("ctrl-t").unwrap();
+    s.wait()
+        .text("· channels")
+        .text(" Channels ")
+        .until()
+        .unwrap();
+    s.send().type_text("files").unwrap();
+    s.wait().text("│ files").until().unwrap();
+    s.send().key("esc").unwrap();
+    s.wait().text("· files").until().unwrap();
+
+    // actions picker: thick preview border, entries not touching it
+    s.send().key("ctrl-x").unwrap();
+    s.wait().text("· actions").text("┃ edit").until().unwrap();
+    let frame = stable_frame(&s);
+    assert!(
+        frame.contains('┏') && !frame.contains('▏'),
+        "Expected a thick border around the actions picker:\n{}",
+        frame
+    );
+    s.send().key("esc").unwrap();
+    s.wait().text_absent("· actions").until().unwrap();
+
+    // help panel: title centered in the thick top border
+    s.send().key("ctrl-h").unwrap();
+    s.wait().text("━ help ━").until().unwrap();
+    assert_frame_not_contains(&s, "▏");
+
+    s.send().key("ctrl-c").unwrap();
+    s.wait().exit_code(0).until().unwrap();
+}
+
 /// Tests that on a narrow viewport the count line drops the source
 /// indicator as a whole instead of starving the query field or clipping
 /// itself mid-segment.
```

---

### Incident Patch 5: `a755ff66` (2026-09-21)
**Commit Message**: build: colored output for just test

**File**: `justfile` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ alias t := test
 # Run the tests for the project
 @test:
 	echo "Running {{ NAME }}'s test suite..."
-	cargo test --all --all-features -- --nocapture --test-threads=4
+	cargo test --all --all-features -- --nocapture --test-threads=4 --color always
 	echo "Done"
 
 # Run tests with faster delays for local development
```

---

### Incident Patch 6: `cd4947b1` (2026-09-22)
**Commit Message**: build(website): upgrade dependencies

**File**: `website/package.json` (modified, +7/-6)
```diff
@@ -24,16 +24,16 @@
     "@mdx-js/react": "^3.1.1",
     "clsx": "^2.1.1",
     "prism-react-renderer": "^2.4.1",
-    "react": "^19.2.8",
-    "react-dom": "^19.2.8"
+    "react": "^19.3.0",
+    "react-dom": "^19.3.0"
   },
   "devDependencies": {
-    "@algolia/autocomplete-core": "^1.19.9",
+    "@algolia/autocomplete-core": "^1.19.11",
     "@docusaurus/module-type-aliases": "^3.10.2",
     "@docusaurus/tsconfig": "^3.10.2",
     "@docusaurus/types": "^3.10.2",
-    "@types/react": "^19.2.18",
-    "algoliasearch": "^5.56.0",
+    "@types/react": "^19.3.0",
+    "algoliasearch": "^5.59.0",
     "typescript": "~5.9.3"
   },
   "browserslist": {
@@ -52,7 +52,8 @@
     "overrides": {
       "serialize-javascript": ">=7.0.5",
       "minimatch": ">=3.1.4",
-      "uuid": ">=11.1.1"
+      "uuid": ">=11.1.1",
+      "lodash-es": ">=4.18.0"
     }
   },
   "engines": {
```

---

### Incident Patch 7: `8bcb997b` (2026-09-10)
**Commit Message**: build: more codegen units and incremental build for staging

**File**: `Cargo.toml` (modified, +5/-1)
```diff
@@ -73,7 +73,9 @@ clipboard-win = "5.4.0"
 [dev-dependencies]
 criterion = { version = "0.8", features = ["async_tokio"] }
 tempfile = "3.16.0"
-phantom-test = { version = "0.3", default-features = false, features = ["alacritty"] }
+phantom-test = { version = "0.3", default-features = false, features = [
+  "alacritty",
+] }
 
 
 [build-dependencies]
@@ -93,6 +95,8 @@ harness = false
 
 [profile.staging]
 inherits = "release"
+codegen-units = 16
+incremental = true
 opt-level = 3
 lto = false
 
```

---

### Incident Patch 8: `49eb4801` (2026-09-08)
**Commit Message**: refactor(keybindings): match modifier prefixes case-insensitively

**File**: `television/config/keybindings.rs` (modified, +35/-30)
```diff
@@ -136,10 +136,7 @@ pub fn merge_keybindings(
 /// assert_eq!(event.modifiers, KeyModifiers::ALT);
 /// ```
 pub fn parse_key_event(raw: &str) -> anyhow::Result<KeyEvent, String> {
-    let raw_lower = raw.to_ascii_lowercase();
-    let (remaining_lower, modifiers) = extract_modifiers(&raw_lower);
-    // recover the original key (ascii lowercasing preserves boundaries)
-    let remaining = &raw[raw.len() - remaining_lower.len()..];
+    let (remaining, modifiers) = extract_modifiers(raw);
     parse_key_code_with_modifiers(remaining, modifiers)
 }
 
@@ -151,7 +148,7 @@ pub fn parse_key_event(raw: &str) -> anyhow::Result<KeyEvent, String> {
 ///
 /// # Arguments
 ///
-/// * `raw` - The raw key string (already lowercased)
+/// * `raw` - The raw key string (modifier prefixes are matched case-insensitively)
 ///
 /// # Returns
 ///
@@ -165,41 +162,41 @@ pub fn parse_key_event(raw: &str) -> anyhow::Result<KeyEvent, String> {
 /// assert!(mods.contains(KeyModifiers::CONTROL | KeyModifiers::ALT));
 /// ```
 fn extract_modifiers(raw: &str) -> (&str, KeyModifiers) {
+    const MODIFIERS: [(&str, KeyModifiers); 5] = [
+        ("ctrl-", KeyModifiers::CONTROL),
+        ("shift-", KeyModifiers::SHIFT),
+        ("alt-", KeyModifiers::ALT),
+        ("cmd-", KeyModifiers::SUPER),
+        ("super-", KeyModifiers::SUPER),
+    ];
+
     let mut modifiers = KeyModifiers::empty();
     let mut current = raw;
 
-    loop {
-        if let Some(rest) = current.strip_prefix("ctrl-") {
-            modifiers.insert(KeyModifiers::CONTROL);
-            current = rest;
-            continue;
-        }
-        if let Some(rest) = current.strip_prefix("shift-") {
-            modifiers.insert(KeyModifiers::SHIFT);
-            current = rest;
-            continue;
-        }
-        if let Some(rest) = current.strip_prefix("alt-") {
-            modifiers.insert(KeyModifiers::ALT);
-            current = rest;
-            continue;
-        }
-        if let Some(rest) = current.strip_prefix("cmd-") {
-            modifiers.insert(KeyModifiers::SUPER);
-            current = rest;
-            continue;
-        }
-        if let Some(rest) = current.strip_prefix("super-") {
-            modifiers.insert(KeyModifiers::SUPER);
-            current = rest;
-            continue;
+    'strip: loop {
+        for (prefix, modifier) in MODIFIERS {
+            if let Some(rest) = strip_prefix_ignore_ascii_case(current, prefix)
+            {
+                modifiers.insert(modifier);
+                current = rest;
+                continue 'strip;
+            }
         }
         break;
     }
 
     (current, modifiers)
 }
 
+fn strip_prefix_ignore_ascii_case<'a>(
+    s: &'a str,
+    prefix: &str,
+) -> Option<&'a str> {
+    let head = s.get(..prefix.len())?;
+    head.eq_ignore_ascii_case(prefix)
+        .then(|| &s[prefix.len()..])
+}
+
 /// Parses a key code string with pre-extracted modifiers into a `KeyEvent`.
 ///
 /// This function handles the actual key code parsing after modifiers have
@@ -586,6 +583,14 @@ mod tests {
             parse_key_event("AlT-eNtEr").unwrap(),
             KeyEvent::new(KeyCode::Enter, KeyModifiers::ALT)
         );
+
+        assert_eq!(
+            parse_key_event("Ctrl-Shift-A").unwrap(),
+            KeyEvent::new(
+                KeyCode::Char('A'),
+                KeyModifiers::CONTROL | KeyModifiers::SHIFT
+            )
+        );
     }
 
     #[test]
```

**File**: `television/tui.rs` (modified, +0/-3)
```diff
@@ -84,9 +84,6 @@ where
         let mut options = TerminalOptions::default();
         enable_raw_mode()?;
 
-        // This is a blocking round trip to the terminal, so do it once here
-        // (raw mode is on and nothing else is reading events yet) rather
-        // than on every enter/exit.
         let keyboard_enhancement =
             supports_keyboard_enhancement().unwrap_or(false);
 
```

---

### Incident Patch 9: `bdf4f48e` (2026-09-08)
**Commit Message**: fix(tui): query kitty keyboard support once and push into alternate screen

**File**: `television/tui.rs` (modified, +26/-11)
```diff
@@ -55,6 +55,8 @@ where
 {
     pub terminal: ratatui::Terminal<CrosstermBackend<W>>,
     pub viewport: Viewport,
+    /// Whether the terminal supports the kitty keyboard protocol.
+    keyboard_enhancement: bool,
 }
 
 pub const TESTING_ENV_VAR: &str = "TV_TEST";
@@ -82,6 +84,12 @@ where
         let mut options = TerminalOptions::default();
         enable_raw_mode()?;
 
+        // This is a blocking round trip to the terminal, so do it once here
+        // (raw mode is on and nothing else is reading events yet) rather
+        // than on every enter/exit.
+        let keyboard_enhancement =
+            supports_keyboard_enhancement().unwrap_or(false);
+
         let terminal_size = backend.size()?;
         let viewport = match mode {
             TuiMode::Fullscreen => Viewport::Fullscreen,
@@ -128,7 +136,11 @@ where
 
         options.viewport = viewport.clone();
         let terminal = Terminal::with_options(backend, options)?;
-        Ok(Self { terminal, viewport })
+        Ok(Self {
+            terminal,
+            viewport,
+            keyboard_enhancement,
+        })
     }
 
     /// Handles scrolling logic when there's insufficient space for the requested height.
@@ -269,15 +281,6 @@ where
 
         execute!(backend, EnableMouseCapture)?;
 
-        if supports_keyboard_enhancement().unwrap_or(false) {
-            execute!(
-                backend,
-                PushKeyboardEnhancementFlags(
-                    KeyboardEnhancementFlags::DISAMBIGUATE_ESCAPE_CODES,
-                )
-            )?;
-        }
-
         if self.viewport == Viewport::Fullscreen {
             execute!(backend, EnterAlternateScreen)?;
             self.clear()?;
@@ -286,6 +289,18 @@ where
             // steady bar cursor marks the input position instead
             execute!(backend, cursor::SetCursorStyle::SteadyBar)?;
         }
+
+        // Terminals keep separate keyboard flag stacks for the main and
+        // alternate screens, so this has to happen after entering the
+        // alternate screen (and the matching pop before leaving it).
+        if self.keyboard_enhancement {
+            execute!(
+                self.terminal.backend_mut(),
+                PushKeyboardEnhancementFlags(
+                    KeyboardEnhancementFlags::DISAMBIGUATE_ESCAPE_CODES
+                )
+            )?;
+        }
         Ok(())
     }
 
@@ -308,7 +323,7 @@ where
 
             execute!(backend, cursor::Show)?;
 
-            if supports_keyboard_enhancement().unwrap_or(false) {
+            if self.keyboard_enhancement {
                 execute!(backend, PopKeyboardEnhancementFlags)?;
             }
 
```

---

### Incident Patch 10: `aaea6ce7` (2026-04-09)
**Commit Message**: feat(tui): add support for uppercase keybindings

Resolves #966

**File**: `television/config/keybindings.rs` (modified, +85/-9)
```diff
@@ -135,7 +135,8 @@ pub fn merge_keybindings(
 /// ```
 pub fn parse_key_event(raw: &str) -> anyhow::Result<KeyEvent, String> {
     let raw_lower = raw.to_ascii_lowercase();
-    let (remaining, modifiers) = extract_modifiers(&raw_lower);
+    let (remaining_lower, modifiers) = extract_modifiers(&raw_lower);
+    let remaining = &raw[raw.len() - remaining_lower.len()..];
     parse_key_code_with_modifiers(remaining, modifiers)
 }
 
@@ -263,17 +264,19 @@ fn parse_key_code_with_modifiers(
             .collect()
         });
 
-    let c = if let Some(&key_code) = KEY_CODE_MAP.get(raw) {
+    let raw_lower = raw.to_ascii_lowercase();
+    let c = if let Some(&key_code) = KEY_CODE_MAP.get(raw_lower.as_str()) {
         key_code
-    } else if raw == "backtab" {
+    } else if raw_lower == "backtab" {
         modifiers.insert(KeyModifiers::SHIFT);
         KeyCode::BackTab
     } else if raw.len() == 1 {
-        let mut c = raw.chars().next().unwrap();
-        if modifiers.contains(KeyModifiers::SHIFT) {
-            c = c.to_ascii_uppercase();
+        let c = raw.chars().next().unwrap();
+        if c.is_ascii_uppercase() || modifiers.contains(KeyModifiers::SHIFT) {
+            KeyCode::Char(c.to_ascii_uppercase())
+        } else {
+            KeyCode::Char(c)
         }
-        KeyCode::Char(c)
     } else {
         return Err(format!("Unable to parse {raw}"));
     };
@@ -310,6 +313,8 @@ fn parse_key_code_with_modifiers(
 #[allow(dead_code)]
 pub fn key_event_to_string(key_event: &KeyEvent) -> String {
     let char;
+    let is_shifted_char = key_event.modifiers.intersects(KeyModifiers::SHIFT)
+        && matches!(key_event.code, KeyCode::Char(_));
     let key_code = match key_event.code {
         KeyCode::Backspace => "backspace",
         KeyCode::Enter => "enter",
@@ -331,7 +336,11 @@ pub fn key_event_to_string(key_event: &KeyEvent) -> String {
         }
         KeyCode::Char(' ') => "space",
         KeyCode::Char(c) => {
-            char = c.to_string();
+            char = if is_shifted_char {
+                c.to_ascii_uppercase().to_string()
+            } else {
+                c.to_string()
+            };
             &char
         }
         KeyCode::Esc => "esc",
@@ -353,7 +362,8 @@ pub fn key_event_to_string(key_event: &KeyEvent) -> String {
         modifiers.push("ctrl");
     }
 
-    if key_event.modifiers.intersects(KeyModifiers::SHIFT) {
+    if key_event.modifiers.intersects(KeyModifiers::SHIFT) && !is_shifted_char
+    {
         modifiers.push("shift");
     }
 
@@ -490,6 +500,72 @@ mod tests {
         );
     }
 
+    #[test]
+    fn test_uppercase_bindings() {
+        // Bare uppercase char → Char('A') with no modifiers
+        assert_eq!(
+            parse_key_event("A").unwrap(),
+            KeyEvent::new(KeyCode::Char('A'), KeyModifiers::NONE)
+        );
+
+        // ctrl + uppercase char → Char('A') with CONTROL
+        assert_eq!(
+            parse_key_event("ctrl-A").unwrap(),
+            KeyEvent::new(KeyCode::Char('A'), KeyModifiers::CONTROL)
+        );
+
+        // alt + uppercase char → Char('A') with ALT
+        assert_eq!(
+            parse_key_event("alt-A").unwrap(),
+            KeyEvent::new(KeyCode::Char('A'), KeyModifiers::ALT)
+        );
+
+        // shift-a and bare A are equivalent
+        assert_eq!(
+            parse_key_event("shift-a").unwrap(),
+            parse_key_event("A").unwrap()
+        );
+    }
+
+    #[test]
+    fn test_key_event_to_string_uppercase() {
+        // Shift+char → uppercase notation, no "shift-" prefix
+        assert_eq!(
+            key_event_to_string(&KeyEvent::new(
+                KeyCode::Char('a'),
+                KeyModifiers::SHIFT
+            )),
+            "A".to_string()
+        );
+
+        // ctrl + shift + char → "ctrl-A"
+        assert_eq!(
+            key_event_to_string(&KeyEvent::new(
+                KeyCode::Char('a'),
+                KeyModifiers::CONTROL | KeyModifiers::SHIFT
+            )),
+            "ctrl-A".to_string()
+        );
+
+        // Already uppercase char with no modifiers → "A"
+        assert_eq!(
+            key_event_to_string(&KeyEvent::new(
+                KeyCode::Char('A'),
+                KeyModifiers::NONE
+            )),
+            "A".to_string()
+        );
+
+        // Non-char shift (e.g. shift-enter) keeps the "shift-" prefix
+        assert_eq!(
+            key_event_to_string(&KeyEvent::new(
+                KeyCode::Enter,
+                KeyModifiers::SHIFT
+            )),
+            "shift-enter".to_string()
+        );
+    }
+
     #[test]
     fn test_invalid_keys() {
         assert!(parse_key_event("invalid-key").is_err());
```

**File**: `television/event.rs` (modified, +14/-7)
```diff
@@ -380,12 +380,19 @@ pub fn convert_raw_event_to_key(event: KeyEvent) -> Key {
             KeyModifiers::ALT => Key::AltSpace,
             _ => Key::Null,
         },
-        Char(c) => match event.modifiers {
-            KeyModifiers::NONE | KeyModifiers::SHIFT => Key::Char(c),
-            KeyModifiers::CONTROL => Key::Ctrl(c),
-            KeyModifiers::ALT => Key::Alt(c),
-            _ => Key::Null,
-        },
+        Char(c) => {
+            let c = if event.modifiers.contains(KeyModifiers::SHIFT) {
+                c.to_uppercase().next().unwrap_or(c)
+            } else {
+                c
+            };
+            match event.modifiers - KeyModifiers::SHIFT {
+                KeyModifiers::NONE => Key::Char(c),
+                KeyModifiers::CONTROL => Key::Ctrl(c),
+                KeyModifiers::ALT => Key::Alt(c),
+                _ => Key::Null,
+            }
+        }
         _ => Key::Null,
     }
 }
@@ -430,7 +437,7 @@ mod tests {
             kind: KeyEventKind::Press,
             state: KeyEventState::NONE,
         };
-        assert_eq!(convert_raw_event_to_key(event), Key::Char('a'));
+        assert_eq!(convert_raw_event_to_key(event), Key::Char('A'));
 
         let event = KeyEvent {
             code: KeyCode::Char(' '),
```

---

### Incident Patch 11: `8e92d90d` (2026-04-09)
**Commit Message**: feat(tui): enables the kitty keyboard-protocol on supported terminals

Part of #966

**File**: `television/tui.rs` (modified, +19/-1)
```diff
@@ -7,11 +7,15 @@ use std::{
 use anyhow::Result;
 use crossterm::{
     cursor,
-    event::{DisableMouseCapture, EnableMouseCapture},
+    event::{
+        DisableMouseCapture, EnableMouseCapture, KeyboardEnhancementFlags,
+        PopKeyboardEnhancementFlags, PushKeyboardEnhancementFlags,
+    },
     execute,
     terminal::{
         ClearType, EnterAlternateScreen, LeaveAlternateScreen, ScrollUp,
         disable_raw_mode, enable_raw_mode, is_raw_mode_enabled,
+        supports_keyboard_enhancement,
     },
 };
 use ratatui::{
@@ -265,6 +269,15 @@ where
 
         execute!(backend, EnableMouseCapture)?;
 
+        if supports_keyboard_enhancement().unwrap_or(false) {
+            execute!(
+                backend,
+                PushKeyboardEnhancementFlags(
+                    KeyboardEnhancementFlags::DISAMBIGUATE_ESCAPE_CODES,
+                )
+            )?;
+        }
+
         if self.viewport == Viewport::Fullscreen {
             execute!(backend, EnterAlternateScreen)?;
             self.clear()?;
@@ -294,6 +307,11 @@ where
             )?;
 
             execute!(backend, cursor::Show)?;
+
+            if supports_keyboard_enhancement().unwrap_or(false) {
+                execute!(backend, PopKeyboardEnhancementFlags)?;
+            }
+
             execute!(backend, DisableMouseCapture)?;
 
             if self.viewport == Viewport::Fullscreen {
```

---

### Incident Patch 12: `ee8bb99e` (2026-09-06)
**Commit Message**: ci(nix): test flake builds when lockfiles or toolchain changes

**File**: `.github/workflows/nix.yml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+name: Nix
+
+on:
+  push:
+    branches:
+      - main
+    paths:
+      - flake.nix
+      - flake.lock
+      - rust-toolchain.toml
+      - Cargo.toml
+      - Cargo.lock
+  pull_request:
+    paths:
+      - flake.nix
+      - flake.lock
+      - rust-toolchain.toml
+      - Cargo.toml
+      - Cargo.lock
+
+jobs:
+  build:
+    name: Nix Build
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout repository
+        uses: actions/checkout@v7
+      - name: Install Nix
+        uses: cachix/install-nix-action@v31
+      - name: Build flake
+        run: nix flake check -L
```

---

### Incident Patch 13: `453c8eb5` (2026-09-06)
**Commit Message**: fix(nix): update flake.lock

**File**: `flake.lock` (modified, +15/-15)
```diff
@@ -2,11 +2,11 @@
   "nodes": {
     "crane": {
       "locked": {
-        "lastModified": 1775839657,
-        "narHash": "sha256-SPm9ck7jh3Un9nwPuMGbRU04UroFmOHjLP56T10MOeM=",
+        "lastModified": 1788465171,
+        "narHash": "sha256-Y1/TTVXjYXGF068IThQH9fPSZ0SIE74PABlUxnWTUH0=",
         "owner": "ipetkov",
         "repo": "crane",
-        "rev": "7cf72d978629469c4bd4206b95c402514c1f6000",
+        "rev": "eb35abda9f232cc6610b1d1e3200d15c49b7ac54",
         "type": "github"
       },
       "original": {
@@ -20,11 +20,11 @@
         "nixpkgs-lib": "nixpkgs-lib"
       },
       "locked": {
-        "lastModified": 1775087534,
-        "narHash": "sha256-91qqW8lhL7TLwgQWijoGBbiD4t7/q75KTi8NxjVmSmA=",
+        "lastModified": 1788450739,
+        "narHash": "sha256-glZLQlzIn1fXH6PazR2iUmTo7kzzyYSshrWhLS9TqCU=",
         "owner": "hercules-ci",
         "repo": "flake-parts",
-        "rev": "3107b77cd68437b9a76194f0f7f9c55f2329ca5b",
+        "rev": "31729ca8cbdb4fa927b34e5f4353e6a83f39e993",
         "type": "github"
       },
       "original": {
@@ -35,11 +35,11 @@
     },
     "nixpkgs": {
       "locked": {
-        "lastModified": 1776255774,
-        "narHash": "sha256-psVTpH6PK3q1htMJpmdz1hLF5pQgEshu7gQWgKO6t6Y=",
+        "lastModified": 1788549839,
+        "narHash": "sha256-kOrCcSIA6w9J1hX5DqHy2k9pDTJymExTsbV74U9UtCA=",
         "owner": "NixOS",
         "repo": "nixpkgs",
-        "rev": "566acc07c54dc807f91625bb286cb9b321b5f42a",
+        "rev": "17de0b976395537756f30a3e78f2f06e5cec89ed",
         "type": "github"
       },
       "original": {
@@ -51,11 +51,11 @@
     },
     "nixpkgs-lib": {
       "locked": {
-        "lastModified": 1774748309,
-        "narHash": "sha256-+U7gF3qxzwD5TZuANzZPeJTZRHS29OFQgkQ2kiTJBIQ=",
+        "lastModified": 1788057806,
+        "narHash": "sha256-DTQSMxzDWmT0zhguthvegnVkn7CFqGCv4IHCzk5ZUpM=",
         "owner": "nix-community",
         "repo": "nixpkgs.lib",
-        "rev": "333c4e0545a6da976206c74db8773a1645b5870a",
+        "rev": "596e2e3940e09b2abbeb03f75fa1828c57fcd72c",
         "type": "github"
       },
       "original": {
@@ -79,11 +79,11 @@
         ]
       },
       "locked": {
-        "lastModified": 1776309239,
-        "narHash": "sha256-XzTecca59093jBsVAE4PVAMcJO+PAYHYHBPRnOR8iWs=",
+        "lastModified": 1788678114,
+        "narHash": "sha256-pcqbpV4ZI79al6KAlr+WJjaEo/PYfgctRlG43D5BSJM=",
         "owner": "oxalica",
         "repo": "rust-overlay",
-        "rev": "3717ee024da7b0a20744f12c39b41e27cbc12f2d",
+        "rev": "4748ec2f5ed4a881474ed4c98aa71a5308cdac8d",
         "type": "github"
       },
       "original": {
```

**File**: `flake.nix` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@
 
             buildInputs =
               [ ]
-              ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
+              ++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isDarwin [
                 # Additional darwin specific inputs can be set here
                 pkgs.libiconv
               ];
```

---

### Incident Patch 14: `90b567cb` (2026-09-05)
**Commit Message**: fix(app): output current pattern on --expect with no matches

**File**: `television/app.rs` (modified, +10/-1)
```diff
@@ -67,6 +67,7 @@ pub enum ActionOutcome {
     Entries(FxHashSet<Entry>),
     EntriesWithExpect(FxHashSet<Entry>, Key),
     Input(String),
+    InputWithExpect(String, Key),
     None,
     ExternalAction(ActionSpec, FxHashSet<Entry>),
 }
@@ -99,6 +100,13 @@ impl AppOutput {
                 expect_key: None,
                 external_action: None,
             },
+            ActionOutcome::InputWithExpect(input, expect_key) => Self {
+                selected_entries: Some(FxHashSet::from_iter([Entry::new(
+                    input,
+                )])),
+                expect_key: Some(expect_key),
+                external_action: None,
+            },
             ActionOutcome::None => Self {
                 selected_entries: None,
                 expect_key: None,
@@ -578,8 +586,9 @@ impl App {
                             ));
                         }
 
-                        return Ok(ActionOutcome::Input(
+                        return Ok(ActionOutcome::InputWithExpect(
                             self.television.current_pattern.clone(),
+                            k,
                         ));
                     }
                     Action::ClearScreen => {
```

---

### Incident Patch 15: `363db8e4` (2026-09-05)
**Commit Message**: fix(gitignore): add todos/ to gitignore

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -44,4 +44,7 @@ result-*
 
 # Development shell completions, see television/utils/shell/README.md
 dev_shell_integration.*
+
+# dev things
 TODO.md
+todos/
```

#### Recent Merged Pull Requests:
- **PR #1156** (2026-10-05): More mappable keys (@alexpasmantier)
- **PR #1154** (2026-09-28): ci: sharing rust cache from main (@alexpasmantier)
- **PR #1153** (2026-09-28): ci: update apt index before installing packages (@alexpasmantier)
- **PR #1151** (2026-09-23): docs(contributing): update log file path on macos (@alexpasmantier)
- **PR #1150** (2026-09-22): feat(website): navbar menu, catppuccin theme and layout fixes (@alexpasmantier)
- **PR #1147** (2026-09-22): Select all feature (@alexpasmantier)
- **PR #1146** (2026-09-22): Website redesign work (@alexpasmantier)
- **PR #1145** (2026-09-19): test: reorganize integration tests into headless and pty (@alexpasmantier)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
