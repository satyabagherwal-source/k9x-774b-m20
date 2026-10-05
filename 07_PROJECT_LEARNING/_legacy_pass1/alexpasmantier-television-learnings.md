# Forensic Learning Record (Deep Inspection): alexpasmantier/television

> **Canonical Artifact**: `07_PROJECT_LEARNING/alexpasmantier-television-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alexpasmantier/television](https://github.com/alexpasmantier/television))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:17:17.492Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alexpasmantier/television`
- **Description**: A very fast, portable and hackable fuzzy finder.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6302 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/main.rs`
```
use criterion::criterion_main;

pub mod main {
    pub mod load_candidates;
    pub mod previewer;
    pub mod render;
    pub mod strings;
    pub mod ui;
    pub mod update;
}

pub use main::*;

criterion_main!(
    ui::benches,
    load_candidates::benches,
    previewer::benches,
    render::benches,
    strings::benches,
    update::benches,
);

```

### Core Architecture Module: `benches/main/load_candidates.rs`
```
use criterion::criterion_group;
use criterion::{BenchmarkId, Criterion, Throughput};
use std::hint::black_box;
use television::channels::entry_processor::{
    AnsiProcessor, DisplayProcessor, PlainProcessor,
};
use television::channels::prototypes::SourceSpec;
use television::matcher::{Matcher, SortStrategy, matcher_threads};
use television::utils::ansi::StyleRuns;
use tokio::runtime::Runtime;

pub fn load_candidates_by_size(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("load_candidates");

    let sizes = vec![10_000, 100_000, 1_000_000];

    for size in sizes {
        group.throughput(Throughput::Elements(size));

        group.bench_with_input(
            BenchmarkId::new("default_delimiter", size),
            &size,
            |b, &size| {
                b.to_async(&rt).iter(|| async move {
                    // Generate a command that produces `size` lines
                    let command_str =
                        format!("seq 1 {} | sed 's/.*/entry_&/'", size);

                    let source_spec: SourceSpec = toml::from_str(&format!(
                        r#"
                        command = "{}"
                        "#,
                        command_str
                    ))
                    .unwrap();

                    // Plain mode uses Matcher<()> for memory efficiency
                    let matcher = Matcher::<()>::new(
                        SortStrategy::Score,
                        matcher_threads(),
                    );
                    let injector = matcher.injector();

                    television::channels::channel::load_candidates(
                        black_box(source_spec.command),
                        black_box(source_spec.entry_delimiter),
                        black_box(0),
                        black_box(PlainProcessor),
                        injector,
                    )
                    .await;

                    // Ensure matcher has processed entries
                    matcher.wait_for_idle();
                });
            },
        );
    }

    group.finish();
}

pub fn load_candidates_with_ansi(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let size = 100_000;

    let mut group = c.benchmark_group("load_candidates_ansi");
    group.throughput(Throughput::Elements(size));

    group.bench_function("no_ansi", |b| {
        b.to_async(&rt).iter(|| async {
            let source_spec: SourceSpec = toml::from_str(&format!(
                r#"
                command = "seq 1 {} | sed 's/.*/entry_&/'"
                ansi = false
                "#,
                size
            ))
            .unwrap();

            // Plain mode uses Matcher<()>
            let matcher =
                Matcher::<()>::new(SortStrategy::Score, matcher_threads());
            let injector = matcher.injector();

            television::channels::channel::load_candidates(
                black_box(source_spec.command),
                black_box(source_spec.entry_delimiter),
                black_box(0),
                black_box(PlainProcessor),
                injector,
            )
            .await;

            matcher.wait_for_idle();
        });
    });

    group.bench_function("with_ansi", |b| {
        b.to_async(&rt).iter(|| async {
            // Use colored output to generate ANSI codes
            let source_spec: SourceSpec = toml::from_str(&format!(
                r#"
                command = "seq 1 {} | sed 's/.*/\\x1b[31mentry_&\\x1b[0m/'"
                ansi = true
                "#,
                size
            ))
            .unwrap();

            // ANSI mode stores the styling of each line, not the raw line
            let matcher = Matcher::<StyleRuns>::new(
                SortStrategy::Score,
                matcher_threads(),
            );
            let injector = matcher.injector();

            television::channels::channel::load_candidates(
                black_box(source_spec.command),
                black_box(source_spec.entry_delimiter),
                black_box(0),
                black_box(AnsiProcessor::new()),
                injector,
            )
            .await;

            matcher.wait_for_idle();
        });
    });

    group.finish();
}

pub fn load_candidates_with_display_template(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let size = 100_000;

    let mut group = c.benchmark_group("load_candidates_display");
    group.throughput(Throughput::Elements(size));

    group.bench_function("no_template", |b| {
        b.to_async(&rt).iter(|| async {
            let source_spec: SourceSpec = toml::from_str(&format!(
                r#"
                command = "seq 1 {} | sed 's/.*/entry_&/'"
                "#,
                size
            ))
            .unwrap();

            // Plain mode uses Matcher<()>
            let matcher =
                Matcher::<()>::new(SortStrategy::Score, matcher_threads());
            let injector = matcher.injector();

            television::channels::channel::load_candidates(
                black_box(source_spec.command),
                black_box(source_spec.entry_delimiter),
                black_box(0),
                black_box(PlainProcessor),
                injector,
            )
            .await;

            matcher.wait_for_idle();
        });
    });

    group.bench_function("with_template", |b| {
        b.to_async(&rt).iter(|| async {
            let source_spec: SourceSpec = toml::from_str(&format!(
                r#"
                command = "seq 1 {} | sed 's/.*/entry_&/'"
                display = "{{}} - displayed"
                "#,
                size
            ))
            .unwrap();

            // Display mode uses Matcher<String> to store original
            let matcher =
                Matcher::<String>::new(SortStrategy::Score, matcher_threads());
            let injector = matcher.injector();

            television::channels::channel::load_candidates(
                black_box(source_spec.command),
                black_box(source_spec.entry_delimiter),
                black_box(0),
                black_box(DisplayProcessor {
                    template: source_spec.display.unwrap(),
                }),
                injector,
            )
            .await;

            matcher.wait_for_idle();
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    load_candidates_by_size,
    load_candidates_with_ansi,
    load_candidates_with_display_template,
);

```

### Core Architecture Module: `benches/main/previewer.rs`
```
use criterion::{Criterion, criterion_group};
use std::hint::black_box;
use television::{
    channels::{
        entry::Entry,
        prototypes::{CommandSpec, Template},
    },
    previewer::try_preview,
};
use tokio::sync::mpsc;

fn make_command(cmd: &str) -> CommandSpec {
    CommandSpec::from(Template::parse(cmd).unwrap())
}

fn bench_preview(
    c: &mut Criterion,
    name: &str,
    entry_name: &str,
    command: &str,
) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function(name, |b| {
        b.to_async(&rt).iter(|| async {
            let entry = black_box(Entry::new(entry_name.to_string()));
            let command = black_box(make_command(command));
            let (tx, mut rx) = mpsc::unbounded_channel();

            try_preview(command, 0, None, None, None, entry, tx, None)
                .await
                .unwrap();

            let _ = rx.recv().await;
        });
    });
}

pub fn preview_ascii(c: &mut Criterion) {
    bench_preview(
        c,
        "preview_ascii",
        "test_file.txt",
        "echo \"Hello, World! This is a simple ASCII preview.\"",
    );
}

pub fn preview_ansi_colors(c: &mut Criterion) {
    bench_preview(
        c,
        "preview_ansi_colors",
        "colored_file.txt",
        r#"echo -e "\x1b[31mRed text\x1b[0m \x1b[32mGreen text\x1b[0m \x1b[34mBlue text\x1b[0m""#,
    );
}

pub fn preview_unicode(c: &mut Criterion) {
    bench_preview(
        c,
        "preview_unicode",
        "unicode.txt",
        "echo \"Hello 世界 🌍 こんにちは 안녕하세요 नमस्ते!\"",
    );
}

pub fn preview_with_tabs(c: &mut Criterion) {
    bench_preview(
        c,
        "preview_with_tabs",
        "code.rs",
        "echo -e \"fn main() {\\n\\tprintln!(\\\"Hello\\\");\\n}\"",
    );
}

pub fn preview_multiline(c: &mut Criterion) {
    let text = (1..=500)
        .map(|i| {
            format!("Line {}: The quick brown fox jumps over the lazy dog", i)
        })
        .collect::<Vec<_>>()
        .join("\\n");

    bench_preview(
        c,
        "preview_multiline",
        "large_file.txt",
        &format!("echo -e \"{}\"", text),
    );
}

pub fn preview_large_ansi(c: &mut Criterion) {
    let text = (1..=1000)
        .map(|i| {
            format!(
                "\\x1b[31mLine {}:\\x1b[0m The quick brown fox jumps over the lazy dog",
                i
            )
        })
        .collect::<Vec<_>>()
        .join("\\n");

    bench_preview(
        c,
        "preview_large_ansi",
        "large_ansi_file.txt",
        &format!("echo -e \"{}\"", text),
    );
}

criterion_group!(
    benches,
    preview_ascii,
    preview_ansi_colors,
    preview_unicode,
    preview_with_tabs,
    preview_multiline,
    preview_large_ansi,
);

```

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

### Core Architecture Module: `benches/main/strings.rs`
```
use criterion::{Criterion, criterion_group};
use std::hint::black_box;
use television::utils::strings::{
    ReplaceNonPrintableConfig, replace_non_printable_bulk,
};

/// Benchmark for pure ASCII text (most common case)
pub fn replace_non_printable_ascii(c: &mut Criterion) {
    let input = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
                  Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. \
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";
    let config = ReplaceNonPrintableConfig::default();

    c.bench_function("replace_non_printable_ascii", |b| {
        b.iter(|| {
            replace_non_printable_bulk(black_box(input), black_box(&config))
        });
    });
}

/// Benchmark for text with tabs (triggers tab expansion)
pub fn replace_non_printable_with_tabs(c: &mut Criterion) {
    let input = "fn main() {\n\tprintln!(\"Hello, world!\");\n\tlet x = 42;\n\treturn x;\n}";
    let config = ReplaceNonPrintableConfig::default();

    c.bench_function("replace_non_printable_with_tabs", |b| {
        b.iter(|| {
            replace_non_printable_bulk(black_box(input), black_box(&config))
        });
    });
}

/// Benchmark for text with control characters
pub fn replace_non_printable_with_control_chars(c: &mut Criterion) {
    let input = "Hello\x00World\x01Test\x7FMore\x1Ftext\u{FEFF}here";
    let config = ReplaceNonPrintableConfig::default();

    c.bench_function("replace_non_printable_with_control_chars", |b| {
        b.iter(|| {
            replace_non_printable_bulk(black_box(input), black_box(&config))
        });
    });
}

/// Benchmark for Unicode text (CJK, emoji, etc.)
pub fn replace_non_printable_unicode(c: &mut Criterion) {
    let input = "Hello 世界 🌍 こんにちは 안녕하세요 สวัสดี नमस्ते!";
    let config = ReplaceNonPrintableConfig::default();

    c.bench_function("replace_non_printable_unicode", |b| {
        b.iter(|| {
            replace_non_printable_bulk(black_box(input), black_box(&config))
        });
    });
}

/// Benchmark for mixed content (realistic scenario)
pub fn replace_non_printable_mixed(c: &mut Criterion) {
    let input = "src/main.rs:42:    fn process_data() {\n\
                 \tlet items = vec![1, 2, 3];\n\
                 \t// Process 世界 items\n\
                 \tfor item in items {\n\
                 \t\tprintln!(\"Item: {}\", item);\n\
                 \t}\n\
                 }";
    let config = ReplaceNonPrintableConfig::default();

    c.bench_function("replace_non_printable_mixed", |b| {
        b.iter(|| {
            replace_non_printable_bulk(black_box(input), black_box(&config))
        });
    });
}

/// Benchmark for large ASCII text (stress test)
pub fn replace_non_printable_large_ascii(c: &mut Criterion) {
    let line = "The quick brown fox jumps over the lazy dog. ";
    let input = line.repeat(100);
    let config = ReplaceNonPrintableConfig::default();

    c.bench_function("replace_non_printable_large_ascii", |b| {
        b.iter(|| {
            replace_non_printable_bulk(black_box(&input), black_box(&config))
        });
    });
}

/// Benchmark for text with Nerd Font icons (tests NF optimization)
pub fn replace_non_printable_nerd_fonts(c: &mut Criterion) {
    // Using actual Nerd Font characters in the ranges we optimized
    let input = " file.rs  folder  test.txt ";
    let config = ReplaceNonPrintableConfig::default();

    c.bench_function("replace_non_printable_nerd_fonts", |b| {
        b.iter(|| {
            replace_non_printable_bulk(black_box(input), black_box(&config))
        });
    });
}

criterion_group!(
    benches,
    // Original implementation
    replace_non_printable_ascii,
    replace_non_printable_with_tabs,
    replace_non_printable_with_control_chars,
    replace_non_printable_unicode,
    replace_non_printable_mixed,
    replace_non_printable_large_ascii,
    replace_non_printable_nerd_fonts,
);

```

### Core Architecture Module: `benches/main/ui.rs`
```
use criterion::Criterion;
use criterion::criterion_group;
use ratatui::Terminal;
use ratatui::backend::TestBackend;
use ratatui::layout::Rect;
use std::hint::black_box;
use std::sync::Arc;
use television::channels::prototypes::ChannelPrototype;
use television::config::layers::ConfigLayers;
use television::frecency::Frecency;
use television::picker::Movement;
use television::{
    action::Action,
    cable::Cable,
    cli::PostProcessedCli,
    config::{Config, ConfigEnv},
    television::Television,
};
use tokio::runtime::Runtime;

#[allow(clippy::missing_panics_doc)]
pub fn draw(c: &mut Criterion) {
    let width = 250;
    let height = 80;

    let rt = Runtime::new().unwrap();

    let cable = Cable::from_prototypes(vec![ChannelPrototype::new(
        "files", "fd -t f",
    )]);

    c.bench_function("draw", |b| {
        b.to_async(&rt).iter_batched(
            // FIXME: this is kind of hacky
            || {
                let config =
                    Config::new(&ConfigEnv::init().unwrap(), None).unwrap();
                let backend = TestBackend::new(width, height);
                let terminal = Terminal::new(backend).unwrap();
                let (tx, _) = tokio::sync::mpsc::unbounded_channel();
                let channel_prototype = cable.get_channel("files");
                let layered_config = ConfigLayers::new(
                    config.clone(),
                    channel_prototype.clone(),
                    PostProcessedCli::default(),
                );
                let frecency =
                    Arc::new(Frecency::new(100, &config.application.data_dir));
                // Wait for the channel to finish loading
                let mut tv = Television::new(
                    tx,
                    layered_config,
                    cable.clone(),
                    frecency,
                );
                tv.find("television");
                for _ in 0..5 {
                    // tick the matcher
                    let _ = tv.channel.results(10, 0);
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                tv.move_cursor(Movement::Next, 10);
                let selected_entry = tv.get_selected_entry();
                let _ = tv.update_preview_state(&selected_entry);
                let _ = tv.update(&Action::Tick);
                (tv, terminal)
            },
            // Measurement
            |(tv, mut terminal)| async move {
                television::draw::draw(
                    black_box(tv.dump_context()),
                    black_box(&mut terminal.get_frame()),
                    black_box(Rect::new(0, 0, width, height)),
                )
                .unwrap();
            },
            criterion::BatchSize::SmallInput,
        );
    });
}

criterion_group!(benches, draw);

```

### Core Architecture Module: `benches/main/update.rs`
```
use criterion::Criterion;
use criterion::criterion_group;
use std::hint::black_box;
use std::sync::Arc;
use television::channels::prototypes::ChannelPrototype;
use television::config::layers::ConfigLayers;
use television::frecency::Frecency;
use television::{
    action::Action,
    cable::Cable,
    cli::PostProcessedCli,
    config::{Config, ConfigEnv},
    television::Television,
};

/// Helper to create a Television instance in a steady state with matched results.
fn setup_tv() -> Television {
    let cable = Cable::from_prototypes(vec![ChannelPrototype::new(
        "files", "fd -t f",
    )]);

    let config = Config::new(&ConfigEnv::init().unwrap(), None).unwrap();
    let (tx, _) = tokio::sync::mpsc::unbounded_channel();
    let channel_prototype = cable.get_channel("files");
    let layered_config = ConfigLayers::new(
        config.clone(),
        channel_prototype.clone(),
        PostProcessedCli::default(),
    );
    let frecency = Arc::new(Frecency::new(100, &config.application.data_dir));
    let mut tv = Television::new(tx, layered_config, cable, frecency);

    // Search for a pattern and let the matcher reach steady state
    tv.find("television");
    for _ in 0..10 {
        let _ = tv.channel.results(50, 0);
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    tv.update_results_picker_state();

    tv
}

/// Benchmark `update()` with a Tick action.
///
/// Tick actions affect results (the matcher may still be processing items),
/// so this exercises the full pipeline: matcher tick + snapshot + UTF32
/// conversion + entry construction + Arc allocation.
pub fn update_tick(c: &mut Criterion) {
    let mut tv = setup_tv();

    c.bench_function("update_tick", |b| {
        b.iter(|| {
            let _ = black_box(tv.update(black_box(&Action::Tick)));
        });
    });
}

/// Benchmark `update()` with an action that doesn't affect results.
///
/// Actions like `ScrollPreviewDown` only change UI state and skip the
/// expensive results pipeline entirely (only a cheap `channel.tick()` runs).
pub fn update_no_results(c: &mut Criterion) {
    let mut tv = setup_tv();

    c.bench_function("update_no_results", |b| {
        b.iter(|| {
            let _ =
                black_box(tv.update(black_box(&Action::ScrollPreviewDown)));
        });
    });
}

/// Benchmark `update()` with a navigation action.
///
/// `SelectNextEntry` changes the viewport offset, triggering the full results
/// pipeline to fetch entries for the new visible window.
pub fn update_select_next(c: &mut Criterion) {
    let mut tv = setup_tv();

    c.bench_function("update_select_next", |b| {
        b.iter(|| {
            let _ = black_box(tv.update(black_box(&Action::SelectNextEntry)));
        });
    });
}

/// Benchmark `update()` with input that changes the search pattern.
///
/// `AddInputChar` triggers pattern reparse + full results pipeline, the
/// most expensive update path.
pub fn update_add_char(c: &mut Criterion) {
    let mut tv = setup_tv();

    c.bench_function("update_add_char", |b| {
        b.iter(|| {
            // Alternate between adding and removing a char to keep pattern
            // from growing unbounded
            let _ =
                black_box(tv.update(black_box(&Action::AddInputChar('x'))));
            let _ = black_box(tv.update(black_box(&Action::DeletePrevChar)));
        });
    });
}

criterion_group!(
    benches,
    update_tick,
    update_no_results,
    update_select_next,
    update_add_char,
);

```

### Core Architecture Module: `scripts/generate_legacy_config_pairs.py`
```
#!/usr/bin/env python3
"""Regenerate television/config/legacy_config_templates.json.

Extracts every version of .config/config.toml ever shipped (tv used to
auto-write it to users' config directories on first run) and flattens each
to leaf (path, value) pairs. `tv migrate-config` matches a user's config
against these templates to tell machine-written boilerplate apart from
deliberate settings.

Templates are kept separate (deduplicated, not unioned) on purpose: a value
only counts as boilerplate if it appears in the template the user's file
descends from — e.g. `ui_scale = 80` was the default of one era and a user
choice in any other.

The current template is excluded: it is never auto-written, so a user config
matching it was copied deliberately. The list is otherwise frozen — tv
stopped auto-writing the config file — so regeneration should only be needed
if this script itself changes.

Usage: python3 scripts/generate_legacy_config_pairs.py > television/config/legacy_config_templates.json
"""

import json
import subprocess
import sys
import tomllib


def git(*args, binary=False):
    out = subprocess.run(["git", *args], capture_output=True, check=True)
    return out.stdout if binary else out.stdout.decode("utf-8").strip()


current_blob = git("rev-parse", "HEAD:.config/config.toml")
commits = git("log", "--format=%H", "main", "--", ".config/config.toml").split()

blobs = []
for commit in commits:
    blob = subprocess.run(
        ["git", "rev-parse", f"{commit}:.config/config.toml"],
        capture_output=True,
        text=True,
    ).stdout.strip()
    if blob and blob != current_blob and blob not in blobs:
        blobs.append(blob)


def flatten(prefix, node, out):
    if isinstance(node, dict):
        for k, v in node.items():
            flatten(prefix + (k,), v, out)
    else:
        out.append((prefix, node))


templates = []
seen = set()
failures = 0

for blob in blobs:
    try:
        doc = tomllib.loads(git("cat-file", "blob", blob, binary=True).decode("utf-8"))
    except Exception as e:
        failures += 1
        print(f"skipping unparseable template {blob}: {e}", file=sys.stderr)
        continue
    leaves = []
    flatten((), doc, leaves)
    key = frozenset(
        (path, json.dumps(value, sort_keys=True)) for path, value in leaves
    )
    if key in seen:
        continue
    seen.add(key)
    templates.append(
        {"pairs": [{"path": list(path), "value": value} for path, value in leaves]}
    )

json.dump(templates, sys.stdout, separators=(",", ":"))
print()
print(
    f"{len(blobs) - failures}/{len(blobs)} historical templates parsed, "
    f"{len(templates)} distinct",
    file=sys.stderr,
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

### Incident Patch 1: `7ef0e75b` (2026-09-15)
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

### Incident Patch 2: `c2b208ee` (2026-09-22)
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
+ 
```

---

### Incident Patch 3: `49eb4801` (2026-09-08)
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

### Incident Patch 4: `bdf4f48e` (2026-09-08)
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

### Incident Patch 5: `453c8eb5` (2026-09-06)
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

### Incident Patch 6: `90b567cb` (2026-09-05)
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

### Incident Patch 7: `363db8e4` (2026-09-05)
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

---

### Incident Patch 8: `e7d4cbd8` (2026-09-05)
**Commit Message**: fix(television): `--input`with no other interactions wasn't printing the pattern to stdout

**File**: `television/television.rs` (modified, +5/-2)
```diff
@@ -187,7 +187,10 @@ impl Television {
             });
         let colorscheme = (&theme).into();
 
-        channel.find(merged_config.input.as_deref().unwrap_or(EMPTY_STRING));
+        // input query
+        let input_query =
+            merged_config.input.as_deref().unwrap_or(EMPTY_STRING);
+        channel.find(input_query);
 
         let preview_state = PreviewState::new(
             channel.supports_preview(),
@@ -217,7 +220,7 @@ impl Television {
             action_picker,
             mode: Mode::Channel,
             currently_selected: None,
-            current_pattern: EMPTY_STRING.to_string(),
+            current_pattern: input_query.to_string(),
             results_picker,
             rc_picker: Picker::default(),
             ap_picker: Picker::default(),
```

---

### Incident Patch 9: `03b972b8` (2026-09-02)
**Commit Message**: chore: fix stale comments in default config and justfile

**File**: `.config/config.toml` (modified, +2/-2)
```diff
@@ -193,14 +193,14 @@ fallback_channel = "files"
 # by the corresponding commands.
 # Example: say you want the following commands to trigger the following channels
 # when pressing <CTRL-T>:
-#          `git checkout`  should trigger the `git-branches` channel
+#          `git checkout`  should trigger the `git-branch` channel
 #          `ls`            should trigger the `dirs` channel
 #          `cat` and `cp`  should trigger the `files` channel
 #
 # You would add the following to your configuration file:
 # ```
 # [shell_integration.channel_triggers]
-# "git-branches" = ["git checkout"]
+# "git-branch" = ["git checkout"]
 # "dirs" = ["ls"]
 # "files" = ["cat", "cp"]
 # ```
```

**File**: `justfile` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ bump-version kind='patch':
 	python -m ensurepip && \
 	python -m pip install toml && \
 	python scripts/generate_cable_docs.py
-	echo "Docs generated in docs/cable_channels.md"
+	echo "Docs generated in docs/community/channels-unix.md and docs/community/channels-windows.md"
 	rm -rf .venv
 
 # Update CLI docs from tv --help
```

---

### Incident Patch 10: `49c272aa` (2026-09-02)
**Commit Message**: fix(cli): correct keybindings example in help text

**File**: `docs/reference/01-cli.md` (modified, +1/-1)
```diff
@@ -446,7 +446,7 @@ Keybindings:
           The keybindings are specified as a semicolon separated list of keybinding
           expressions using the configuration file formalism.
           
-          Example: `tv --keybindings='quit="esc";select_next_entry=["down","ctrl-j"]'`
+          Example: `tv --keybindings='esc="quit";down="select_next_entry";ctrl-j="select_next_entry"'`
 
       --expect <STRING>
           Keys that can be used to confirm the current selection in addition to the default ones
```

**File**: `television/cli/args.rs` (modified, +1/-1)
```diff
@@ -619,7 +619,7 @@ pub struct Cli {
     /// The keybindings are specified as a semicolon separated list of keybinding
     /// expressions using the configuration file formalism.
     ///
-    /// Example: `tv --keybindings='quit="esc";select_next_entry=["down","ctrl-j"]'`
+    /// Example: `tv --keybindings='esc="quit";down="select_next_entry";ctrl-j="select_next_entry"'`
     #[arg(
         short,
         long,
```

**File**: `television/cli/mod.rs` (modified, +1/-2)
```diff
@@ -476,7 +476,7 @@ const CLI_PADDING_DELIMITER: char = ';';
 ///
 /// The formalism used is the same as the one used in the configuration file:
 /// ```ignore
-///     quit="esc";select_next_entry=["down","ctrl-j"]
+///     esc="quit";down="select_next_entry";ctrl-j="select_next_entry"
 /// ```
 /// Parsing it globally consists of splitting by the delimiter, reconstructing toml key-value pairs
 /// and parsing that using logic already implemented in the configuration module.
@@ -752,7 +752,6 @@ mod tests {
     }
 
     #[test]
-    #[ignore = "expects binding toml structure"]
     fn test_custom_keybindings() {
         let cli = Cli {
             channel: Some("files".to_string()),
```

#### Recent Merged Pull Requests:
- **PR #1154** (2026-09-28): ci: sharing rust cache from main (@alexpasmantier)
- **PR #1153** (2026-09-28): ci: update apt index before installing packages (@alexpasmantier)
- **PR #1151** (2026-09-23): docs(contributing): update log file path on macos (@alexpasmantier)
- **PR #1150** (2026-09-22): feat(website): navbar menu, catppuccin theme and layout fixes (@alexpasmantier)
- **PR #1147** (2026-09-22): Select all feature (@alexpasmantier)
- **PR #1146** (2026-09-22): Website redesign work (@alexpasmantier)
- **PR #1145** (2026-09-19): test: reorganize integration tests into headless and pty (@alexpasmantier)
- **PR #1144** (2026-09-28): fix: respect channel preview cache settings (@nwiizo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
