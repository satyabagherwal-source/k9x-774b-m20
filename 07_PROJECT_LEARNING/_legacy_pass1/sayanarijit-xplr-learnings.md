# Forensic Learning Record (Deep Inspection): sayanarijit/xplr

> **Canonical Artifact**: `07_PROJECT_LEARNING/sayanarijit-xplr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sayanarijit/xplr](https://github.com/sayanarijit/xplr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:13:46.373Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sayanarijit/xplr`
- **Description**: A hackable, minimal, fast TUI file explorer
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4835 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/criterion.rs`
```
use crate::app;
use crate::ui;
use criterion::{criterion_group, criterion_main, Criterion};
use std::fs;
use tui::backend::CrosstermBackend;
use tui::crossterm::execute;
use tui::crossterm::terminal as term;
use tui::Terminal;
use xplr::runner::get_tty;
use xplr::*;

const PWD: &str = "/tmp/xplr_bench";

fn navigation_benchmark(c: &mut Criterion) {
    fs::create_dir_all(PWD).unwrap();
    (1..10000).for_each(|i| {
        fs::File::create(std::path::Path::new(PWD).join(i.to_string())).unwrap();
    });

    let lua = mlua::Lua::new();
    let mut app =
        app::App::create("xplr".into(), None, PWD.into(), &lua, None, [].into())
            .expect("failed to create app");

    app = app
        .clone()
        .handle_task(app::Task::new(
            app::MsgIn::External(app::ExternalMsg::ChangeDirectory(PWD.into())),
            None,
        ))
        .unwrap();

    c.bench_function("focus next item", |b| {
        b.iter(|| {
            app.clone()
                .handle_task(app::Task::new(
                    app::MsgIn::External(app::ExternalMsg::FocusNext),
                    None,
                ))
                .unwrap()
        })
    });

    c.bench_function("focus previous item", |b| {
        b.iter(|| {
            app.clone()
                .handle_task(app::Task::new(
                    app::MsgIn::External(app::ExternalMsg::FocusPrevious),
                    None,
                ))
                .unwrap()
        })
    });

    c.bench_function("focus first item", |b| {
        b.iter(|| {
            app.clone()
                .handle_task(app::Task::new(
                    app::MsgIn::External(app::ExternalMsg::FocusFirst),
                    None,
                ))
                .unwrap()
        })
    });

    c.bench_function("focus last item", |b| {
        b.iter(|| {
            app.clone()
                .handle_task(app::Task::new(
                    app::MsgIn::External(app::ExternalMsg::FocusLast),
                    None,
                ))
                .unwrap()
        })
    });

    c.bench_function("leave and enter directory", |b| {
        b.iter(|| {
            app.clone()
                .handle_task(app::Task::new(
                    app::MsgIn::External(app::ExternalMsg::Back),
                    None,
                ))
                .unwrap()
                .handle_task(app::Task::new(
                    app::MsgIn::External(app::ExternalMsg::Enter),
                    None,
                ))
                .unwrap()
        })
    });
}

fn draw_benchmark(c: &mut Criterion) {
    fs::create_dir_all(PWD).unwrap();
    (1..10000).for_each(|i| {
        fs::File::create(std::path::Path::new(PWD).join(i.to_string())).unwrap();
    });

    let lua = mlua::Lua::new();
    let mut ui = ui::UI::new(&lua);
    let mut app =
        app::App::create("xplr".into(), None, PWD.into(), &lua, None, [].into())
            .expect("failed to create app");

    app = app
        .clone()
        .handle_task(app::Task::new(
            app::MsgIn::External(app::ExternalMsg::ChangeDirectory(PWD.into())),
            None,
        ))
        .unwrap();

    term::enable_raw_mode().unwrap();
    let mut stdout = get_tty().unwrap();
    // let mut stdout = stdout.lock();
    execute!(stdout, term::EnterAlternateScreen).unwrap();
    // let stdout = MouseTerminal::from(stdout);
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend).unwrap();
    terminal.hide_cursor().unwrap();

    c.bench_function("draw on terminal", |b| {
        b.iter(|| {
            terminal.draw(|f| ui.draw(f, &app)).unwrap();
        })
    });

    terminal.clear().unwrap();
    terminal.set_cursor_position((0, 0)).unwrap();
    execute!(terminal.backend_mut(), term::LeaveAlternateScreen).unwrap();
    term::disable_raw_mode().unwrap();
    terminal.show_cursor().unwrap();
}

criterion_group!(benches, navigation_benchmark, draw_benchmark);
criterion_main!(benches);

```

### Core Architecture Module: `examples/run.rs`
```
fn main() {
    match xplr::runner::runner().and_then(|a| a.run()) {
        Ok(Some(out)) => print!("{}", out),
        Ok(None) => {}
        Err(err) => {
            if !err.to_string().is_empty() {
                eprintln!("error: {}", err);
            };

            std::process::exit(1);
        }
    }
}

```

### Core Architecture Module: `src/app.rs`
```
use crate::config::Config;
use crate::config::Hooks;
use crate::config::Mode;
pub use crate::directory_buffer::DirectoryBuffer;
use crate::dirs;
use crate::explorer;
use crate::input::{InputOperation, Key};
use crate::lua;
pub use crate::msg::in_::external::Command;
pub use crate::msg::in_::external::ExplorerConfig;
pub use crate::msg::in_::external::NodeFilter;
pub use crate::msg::in_::external::NodeFilterApplicable;
use crate::msg::in_::external::NodeSearcherApplicable;
pub use crate::msg::in_::external::NodeSorter;
pub use crate::msg::in_::external::NodeSorterApplicable;
pub use crate::msg::in_::ExternalMsg;
pub use crate::msg::in_::InternalMsg;
pub use crate::msg::in_::MsgIn;
pub use crate::msg::out::MsgOut;
pub use crate::node::Node;
pub use crate::node::ResolvedNode;
pub use crate::pipe::Pipe;
use crate::search::SearchAlgorithm;
use crate::ui::Layout;
use anyhow::{bail, Result};
use gethostname::gethostname;
use indexmap::set::IndexSet;
use path_absolutize::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::VecDeque;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use time::OffsetDateTime;
use tui_input::{Input, InputRequest};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const TEMPLATE_TABLE_ROW: &str = "TEMPLATE_TABLE_ROW";
pub const UNSUPPORTED_STR: &str = "???";

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct Task {
    pub msg: MsgIn,
    pub key: Option<Key>,
}

impl Task {
    pub fn new(msg: MsgIn, key: Option<Key>) -> Self {
        Self { msg, key }
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Info,
    Warning,
    Success,
    Error,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct Log {
    pub level: LogLevel,
    pub message: String,
    pub created_at: OffsetDateTime,
}

impl Log {
    pub fn new(level: LogLevel, message: String) -> Self {
        Self {
            level,
            message,
            created_at: OffsetDateTime::now_local()
                .ok()
                .unwrap_or_else(OffsetDateTime::now_utc),
        }
    }
}

impl std::fmt::Display for Log {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let level_str = match self.level {
            LogLevel::Info => "INFO   ",
            LogLevel::Warning => "WARNING",
            LogLevel::Success => "SUCCESS",
            LogLevel::Error => "ERROR  ",
        };
        write!(f, "[{0}] {level_str} {1}", self.created_at, self.message)
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum HelpMenuLine {
    KeyMap(String, Vec<String>, String),
    Paragraph(String),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct History {
    pub loc: usize,
    pub paths: Vec<String>,
}

impl History {
    fn loc_exists(&self) -> bool {
        self.peek()
            .map(|p| PathBuf::from(p).exists())
            .unwrap_or(false)
    }

    fn cleanup(mut self) -> Self {
        while self.loc > 0
            && self
                .paths
                .get(self.loc.saturating_sub(1))
                .and_then(|p1| self.peek().map(|p2| p1 == p2))
                .unwrap_or(false)
        {
            self.paths.remove(self.loc);
            self.loc = self.loc.saturating_sub(1);
        }

        while self.loc < self.paths.len().saturating_sub(1)
            && self
                .paths
                .get(self.loc.saturating_add(1))
                .and_then(|p1| self.peek().map(|p2| p1 == p2))
                .unwrap_or(false)
        {
            self.paths.remove(self.loc.saturating_add(1));
        }

        self
    }

    fn peek(&self) -> Option<&String> {
        self.paths.get(self.loc)
    }

    fn push(mut self, path: String) -> Self {
        if self.peek() != Some(&path) {
            self.paths = self.paths.into_iter().take(self.loc + 1).collect();
            self.paths.push(path);
            self.loc = self.paths.len().saturating_sub(1);
        }
        self
    }

    fn visit_last(mut self) -> Self {
        self.loc = self.loc.saturating_sub(1);

        while self.loc > 0 && !self.loc_exists() {
            self.paths.remove(self.loc);
            self.loc = self.loc.saturating_sub(1);
        }
        self.cleanup()
    }

    fn visit_next(mut self) -> Self {
        self.loc = self
            .loc
            .saturating_add(1)
            .min(self.paths.len().saturating_sub(1));

        while self.loc < self.paths.len().saturating_sub(1) && !self.loc_exists() {
            self.paths.remove(self.loc);
        }

        self.cleanup()
    }

    fn _is_deepest_dir(&self, path: &str) -> bool {
        !self
            .paths
            .iter()
            .any(|p| p.ends_with('/') && p.starts_with(path) && path != p)
    }

    fn _uniq_deep_dirs(&self) -> IndexSet<String> {
        self.paths
            .clone()
            .into_iter()
            .filter(|p| p.ends_with('/') && self._is_deepest_dir(p))
            .collect::<IndexSet<String>>()
    }

    fn visit_next_deep_branch(self, pwd: &str) -> Self {
        let uniq_deep_dirs = self._uniq_deep_dirs();

        if let Some(path) = uniq_deep_dirs
            .iter()
            .skip_while(|p| p.trim_end_matches('/') != pwd)
            .nth(1)
        {
            self.push(path.to_string())
        } else {
            self
        }
    }

    fn visit_previous_deep_branch(self, pwd: &str) -> Self {
        let uniq_deep_dirs = self._uniq_deep_dirs();
        if let Some(path) = uniq_deep_dirs
            .iter()
            .rev()
            .skip_while(|p| p.trim_end_matches('/') != pwd)
            .nth(1)
        {
            self.push(path.to_string())
        } else {
            self
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LuaContextHeavy {
    pub version: String,
    pub pwd: String,
    pub initial_pwd: String,
    pub vroot: Option<String>,
    pub focused_node: Option<Node>,
    pub directory_buffer: Option<DirectoryBuffer>,
    pub selection: IndexSet<Node>,
    pub mode: Mode,
    pub layout: Layout,
    pub input_buffer: Option<String>,
    pub pid: u32,
    pub session_path: String,
    pub explorer_config: ExplorerConfig,
    pub history: History,
    pub last_modes: Vec<Mode>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LuaContextLight {
    pub version: String,
    pub pwd: String,
    pub initial_pwd: String,
    pub vroot: Option<String>,
    pub focused_node: Option<Node>,
    pub selection: IndexSet<Node>,
    pub mode: Mode,
    pub layout: Layout,
    pub input_buffer: Option<String>,
    pub pid: u32,
    pub session_path: String,
    pub explorer_config: ExplorerConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputBuffer {
    pub buffer: Option<Input>,
    pub prompt: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct App {
    pub bin: String,
    pub version: String,
    pub config: Config,
    pub hooks: Hooks,
    pub vroot: Option<String>,
    pub initial_vroot: Option<String>,
    pub pwd: String,
    pub initial_pwd: String,
    pub directory_buffer: Option<DirectoryBuffer>,
    pub last_focus: HashMap<String, Option<String>>,
    pub selection: IndexSet<Node>,
    pub msg_out: VecDeque<MsgOut>,
    pub mode: Mode,
    pub layout: Layout,
    pub input: InputBuffer,
    pub pid: u32,
    pub session_path: String,
    pub pipe: Pipe,
    pub explorer_config: ExplorerConfig,
    pub logs: Vec<Log>,
    pub logs_hidden: bool,
    pub history: History,
    pub last_modes: Vec<Mode>,
    pub hostname: String,
}

impl App {
    pub fn create(
        bin: String,
        vroot: Option<PathBuf>,
        pwd: PathBuf,
        lua: &mlua::Lua,
        config_file: Option<PathBuf>,
        extra_config_files: Vec<PathBuf>,
    ) -> Result<Self> {
        let (mut config, hoo
```

### Core Architecture Module: `src/bin/xplr.rs`
```
#![allow(clippy::too_many_arguments)]

use std::env;
use std::io::Write;
use xplr::cli::{self, Cli};
use xplr::runner;

fn main() {
    let cli = Cli::parse(env::args()).unwrap_or_else(|e| {
        eprintln!("error: {e}");
        std::process::exit(1);
    });

    if cli.help {
        let usage = r###"
    xplr [FLAG]... [OPTION]... [PATH] [SELECTION]..."###;

        let flags = r###"
  -                            Reads new-line (\n) separated paths from stdin
  --                           Denotes the end of command-line flags and options
      --force-focus            Focuses on the given <PATH>, even if it is a directory
  -h, --help                   Prints help information
  -m, --pipe-msg-in            Helps safely passing messages to the active xplr
                                 session, use %%, %s and %q as the placeholders
  -M, --print-msg-in           Like --pipe-msg-in, but prints the message instead of
                                 passing to the active xplr session
      --print-pwd-as-result    Prints the present working directory when quitting
                                 with `PrintResultAndQuit`
      --read-only              Enables read-only mode (config.general.read_only)
      --read0                  Reads paths separated using the null character (\0)
      --write0                 Prints paths separated using the null character (\0)
  -0  --null                   Combines --read0 and --write0
  -V, --version                Prints version information"###;

        let options = r###"
  -c, --config <PATH>             Specifies a custom config file (default is
                                    "$HOME/.config/xplr/init.lua")
  -C, --extra-config <PATH>...    Specifies extra config files to load
      --on-load <MESSAGE>...      Sends messages when xplr loads
      --vroot <PATH>              Treats the specified path as the virtual root"###;

        let args = r###"
  <PATH>            Path to focus on, or enter if directory, (default is `.`)
  <SELECTION>...    Paths to select, requires <PATH> to be set explicitly"###;

        let help = format!(
            "xplr {}\n{}\n{}\n\nUSAGE:{}\n\nFLAGS:{}\n\nOPTIONS:{}\n\nARGS:{}",
            xplr::app::VERSION,
            env!("CARGO_PKG_AUTHORS"),
            env!("CARGO_PKG_DESCRIPTION"),
            usage,
            flags,
            options,
            args,
        );
        let help = help.trim();

        println!("{help}");
    } else if cli.version {
        println!("xplr {}", xplr::app::VERSION);
    } else if !cli.pipe_msg_in.is_empty() {
        if let Err(err) = cli::pipe_msg_in(cli.pipe_msg_in) {
            eprintln!("error: {err}");
            std::process::exit(1);
        }
    } else if !cli.print_msg_in.is_empty() {
        if let Err(err) = cli::print_msg_in(cli.print_msg_in) {
            eprintln!("error: {err}");
            std::process::exit(1);
        }
    } else {
        match runner::from_cli(cli).and_then(|a| a.run()) {
            Ok(Some(out)) => {
                let mut stdout = std::io::stdout().lock();
                write!(stdout, "{out}").unwrap_or_else(|err| {
                    eprintln!("error: {err}");
                    std::process::exit(1);
                })
            }
            Ok(None) => {}
            Err(err) => {
                if !err.to_string().is_empty() {
                    eprintln!("error: {err}");
                };

                std::process::exit(1);
            }
        }
    }
}

```

### Core Architecture Module: `src/cli.rs`
```
use crate::{app, yaml};
use anyhow::{bail, Context, Result};
use app::ExternalMsg;
use path_absolutize::*;
use serde_json as json;
use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::{env, fs};

/// The arguments to pass
#[derive(Debug, Clone, Default)]
pub struct Cli {
    pub bin: String,
    pub version: bool,
    pub help: bool,
    pub read_only: bool,
    pub force_focus: bool,
    pub print_pwd_as_result: bool,
    pub read0: bool,
    pub write0: bool,
    pub vroot: Option<PathBuf>,
    pub config: Option<PathBuf>,
    pub extra_config: Vec<PathBuf>,
    pub on_load: Vec<app::ExternalMsg>,
    pub pipe_msg_in: Vec<String>,
    pub print_msg_in: Vec<String>,
    pub paths: Vec<PathBuf>,
}

impl Cli {
    fn read_path(arg: &str) -> Result<PathBuf> {
        if arg.is_empty() {
            bail!("empty string passed")
        };

        let path = PathBuf::from(arg).absolutize()?.to_path_buf();
        if path.exists() {
            Ok(path)
        } else {
            bail!("path doesn't exist: {}", path.to_string_lossy())
        }
    }

    /// Parse arguments from the command-line
    pub fn parse(args: env::Args) -> Result<Self> {
        let mut cli = Self::default();
        let mut args = args.peekable();
        cli.bin = args
            .next()
            .map(which::which)
            .context("failed to parse xplr binary path")?
            .context("failed to find xplr binary path")?
            .absolutize()?
            .to_path_buf()
            .to_string_lossy()
            .to_string();

        let mut flag_ends = false;

        while let Some(arg) = args.next() {
            if flag_ends {
                cli.paths.push(Cli::read_path(&arg)?);
            } else {
                match arg.as_str() {
                    // Flags
                    "-" => {
                        let reader = BufReader::new(std::io::stdin());
                        if cli.read0 {
                            for path in reader.split(b'\0') {
                                cli.paths
                                    .push(Cli::read_path(&String::from_utf8(path?)?)?);
                            }
                        } else {
                            for path in reader.lines() {
                                cli.paths.push(Cli::read_path(&path?)?);
                            }
                        };
                    }

                    "-h" | "--help" => {
                        cli.help = true;
                    }

                    "-V" | "--version" => {
                        cli.version = true;
                    }

                    "--read0" => {
                        cli.read0 = true;
                    }

                    "--write0" => {
                        cli.write0 = true;
                    }

                    "-0" | "--null" => {
                        cli.read0 = true;
                        cli.write0 = true;
                    }

                    "--" => {
                        flag_ends = true;
                    }

                    // Options
                    "-c" | "--config" => {
                        cli.config = Some(
                            args.next()
                                .map(|a| Cli::read_path(&a))
                                .with_context(|| format!("usage: xplr {arg} PATH"))??,
                        );
                    }

                    "--vroot" => {
                        cli.vroot = Some(
                            args.next()
                                .map(|a| Cli::read_path(&a))
                                .with_context(|| format!("usage: xplr {arg} PATH"))??,
                        );
                    }

                    "-C" | "--extra-config" => {
                        while let Some(path) =
                            args.next_if(|path| !path.starts_with('-'))
                        {
                            cli.extra_config.push(Cli::read_path(&path)?);
                        }
                    }

                    "--read-only" => cli.read_only = true,

                    "--on-load" => {
                        while let Some(msg) = args.next_if(|msg| !msg.starts_with('-')) {
                            cli.on_load.push(yaml::from_str(&msg)?);
                        }
                    }

                    "--force-focus" => {
                        cli.force_focus = true;
                    }

                    "--print-pwd-as-result" => {
                        cli.print_pwd_as_result = true;
                    }

                    "-m" | "--pipe-msg-in" => {
                        cli.pipe_msg_in.extend(args.by_ref());
                        if cli.pipe_msg_in.is_empty() {
                            bail!("usage: xplr {} FORMAT [ARGUMENT]...", arg)
                        }
                    }

                    "-M" | "--print-msg-in" => {
                        cli.print_msg_in.extend(args.by_ref());
                        if cli.print_msg_in.is_empty() {
                            bail!("usage: xplr {} FORMAT [ARGUMENT]...", arg)
                        }
                    }

                    // path
                    path => {
                        if path.starts_with('-') && !flag_ends {
                            bail!(
                                "invalid argument: {0:?}, try `-- {0:?}` or `--help`",
                                path
                            )
                        } else {
                            cli.paths.push(Cli::read_path(path)?);
                        }
                    }
                }
            }
        }
        Ok(cli)
    }
}

pub fn pipe_msg_in(args: Vec<String>) -> Result<()> {
    let mut msg = fmt_msg_in(args)?;

    if let Ok(path) = std::env::var("XPLR_PIPE_MSG_IN") {
        let delimiter = fs::read(&path)?
            .first()
            .cloned()
            .context("failed to detect delimmiter")?;

        msg.push(delimiter.into());
        File::options()
            .append(true)
            .open(&path)?
            .write_all(msg.as_bytes())?;
    } else {
        println!("{msg}");
    };

    Ok(())
}

pub fn print_msg_in(args: Vec<String>) -> Result<()> {
    let msg = fmt_msg_in(args)?;
    print!("{msg}");
    Ok(())
}

fn fmt_msg_in(args: Vec<String>) -> Result<String> {
    let msg = match jf::format(args.into_iter().map(Into::into)) {
        Ok(msg) => msg,
        Err(jf::Error::Jf(e)) => bail!("xplr -m: {e}"),
        Err(jf::Error::Json(e)) => bail!("xplr -m: json: {e}"),
        Err(jf::Error::Yaml(e)) => bail!("xplr -m: yaml: {e}"),
        Err(jf::Error::Io(e)) => bail!("xplr -m: io: {e}"),
    };

    // validate
    let _: ExternalMsg = json::from_str(&msg)?;

    Ok(msg)
}

```

### Core Architecture Module: `src/compat.rs`
```
// Things of the past, mostly bad decisions, which cannot erased, stays in this
// haunted module.

use crate::app;
use crate::lua;
use crate::ui::block;
use crate::ui::string_to_text;
use crate::ui::Constraint;
use crate::ui::ContentRendererArg;
use crate::ui::UI;
use serde::{Deserialize, Serialize};
use tui::layout::Constraint as TuiConstraint;
use tui::layout::Rect as TuiRect;
use tui::widgets::Cell;
use tui::widgets::List;
use tui::widgets::ListItem;
use tui::widgets::Paragraph;
use tui::widgets::Row;
use tui::widgets::Table;
use tui::Frame;

/// A cursed enum from crate::ui.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub enum ContentBody {
    /// A paragraph to render
    StaticParagraph { render: String },

    /// A Lua function that returns a paragraph to render
    DynamicParagraph { render: String },

    /// List to render
    StaticList { render: Vec<String> },

    /// A Lua function that returns lines to render
    DynamicList { render: String },

    /// A table to render
    StaticTable {
        widths: Vec<Constraint>,
        col_spacing: Option<u16>,
        render: Vec<Vec<String>>,
    },

    /// A Lua function that returns a table to render
    DynamicTable {
        widths: Vec<Constraint>,
        col_spacing: Option<u16>,
        render: String,
    },
}

/// A cursed struct from crate::ui.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct CustomContent {
    pub title: Option<String>,
    pub body: ContentBody,
}

/// A cursed function from crate::ui.
pub fn draw_custom_content(
    ui: &mut UI,
    f: &mut Frame,
    layout_size: TuiRect,
    app: &app::App,
    content: CustomContent,
) {
    let config = app.config.general.panel_ui.default.clone();
    let title = content.title;
    let body = content.body;

    match body {
        ContentBody::StaticParagraph { render } => {
            let render = string_to_text(render);
            let content = Paragraph::new(render).block(block(
                config,
                title.map(|t| format!(" {t} ")).unwrap_or_default(),
            ));
            f.render_widget(content, layout_size);
        }

        ContentBody::DynamicParagraph { render } => {
            let ctx = ContentRendererArg {
                app: app.to_lua_ctx_light(),
                layout_size: layout_size.into(),
                screen_size: ui.screen_size.into(),
                scrolltop: ui.scrolltop as u16,
            };

            let render = lua::serialize(ui.lua, &ctx)
                .map(|arg| {
                    lua::call(ui.lua, &render, arg).unwrap_or_else(|e| format!("{e:?}"))
                })
                .unwrap_or_else(|e| e.to_string());

            let render = string_to_text(render);

            let content = Paragraph::new(render).block(block(
                config,
                title.map(|t| format!(" {t} ")).unwrap_or_default(),
            ));
            f.render_widget(content, layout_size);
        }

        ContentBody::StaticList { render } => {
            let items = render
                .into_iter()
                .map(string_to_text)
                .map(ListItem::new)
                .collect::<Vec<ListItem>>();

            let content = List::new(items).block(block(
                config,
                title.map(|t| format!(" {t} ")).unwrap_or_default(),
            ));
            f.render_widget(content, layout_size);
        }

        ContentBody::DynamicList { render } => {
            let ctx = ContentRendererArg {
                app: app.to_lua_ctx_light(),
                layout_size: layout_size.into(),
                screen_size: ui.screen_size.into(),
                scrolltop: ui.scrolltop as u16,
            };

            let items = lua::serialize(ui.lua, &ctx)
                .map(|arg| {
                    lua::call(ui.lua, &render, arg)
                        .unwrap_or_else(|e| vec![format!("{e:?}")])
                })
                .unwrap_or_else(|e| vec![e.to_string()])
                .into_iter()
                .map(string_to_text)
                .map(ListItem::new)
                .collect::<Vec<ListItem>>();

            let content = List::new(items).block(block(
                config,
                title.map(|t| format!(" {t} ")).unwrap_or_default(),
            ));
            f.render_widget(content, layout_size);
        }

        ContentBody::StaticTable {
            widths,
            col_spacing,
            render,
        } => {
            let rows = render
                .into_iter()
                .map(|cols| {
                    Row::new(
                        cols.into_iter()
                            .map(string_to_text)
                            .map(Cell::from)
                            .collect::<Vec<Cell>>(),
                    )
                })
                .collect::<Vec<Row>>();

            let widths = widths
                .into_iter()
                .map(|w| w.to_tui(ui.screen_size, layout_size))
                .collect::<Vec<TuiConstraint>>();

            let content = Table::new(rows, widths)
                .column_spacing(col_spacing.unwrap_or(1))
                .block(block(
                    config,
                    title.map(|t| format!(" {t} ")).unwrap_or_default(),
                ));

            f.render_widget(content, layout_size);
        }

        ContentBody::DynamicTable {
            widths,
            col_spacing,
            render,
        } => {
            let ctx = ContentRendererArg {
                app: app.to_lua_ctx_light(),
                layout_size: layout_size.into(),
                screen_size: ui.screen_size.into(),
                scrolltop: ui.scrolltop as u16,
            };

            let rows = lua::serialize(ui.lua, &ctx)
                .map(|arg| {
                    lua::call(ui.lua, &render, arg)
                        .unwrap_or_else(|e| vec![vec![format!("{e:?}")]])
                })
                .unwrap_or_else(|e| vec![vec![e.to_string()]])
                .into_iter()
                .map(|cols| {
                    Row::new(
                        cols.into_iter()
                            .map(string_to_text)
                            .map(Cell::from)
                            .collect::<Vec<Cell>>(),
                    )
                })
                .collect::<Vec<Row>>();

            let widths = widths
                .into_iter()
                .map(|w| w.to_tui(ui.screen_size, layout_size))
                .collect::<Vec<TuiConstraint>>();

            let mut content = Table::new(rows, &widths).block(block(
                config,
                title.map(|t| format!(" {t} ")).unwrap_or_default(),
            ));

            if let Some(col_spacing) = col_spacing {
                content = content.column_spacing(col_spacing);
            };

            f.render_widget(content, layout_size);
        }
    }
}

```

### Core Architecture Module: `src/config.rs`
```
use crate::app::ExternalMsg;
use crate::app::HelpMenuLine;
use crate::app::NodeFilter;
use crate::app::NodeSorter;
use crate::app::NodeSorterApplicable;
use crate::node::Node;
use crate::search::RankCriteria;
use crate::search::SearchAlgorithm;
use crate::ui::Border;
use crate::ui::BorderType;
use crate::ui::Constraint;
use crate::ui::Layout;
use crate::ui::Style;
use indexmap::IndexSet;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::collections::HashMap;
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Action {
    #[serde(default)]
    pub help: Option<String>,

    #[serde(default)]
    pub messages: Vec<ExternalMsg>,
}

impl Action {
    pub fn sanitized(self, read_only: bool) -> Option<Self> {
        if self.messages.is_empty() {
            None
        } else if read_only {
            if self.messages.iter().all(ExternalMsg::is_read_only) {
                Some(self)
            } else {
                None
            }
        } else {
            Some(self)
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NodeTypeConfig {
    #[serde(default)]
    pub style: Style,

    #[serde(default)]
    pub meta: HashMap<String, String>,
}

impl NodeTypeConfig {
    pub fn extend(mut self, other: &Self) -> Self {
        self.style = self.style.extend(&other.style);
        self.meta.extend(other.meta.clone());
        self
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NodeTypesConfig {
    #[serde(default)]
    pub directory: NodeTypeConfig,

    #[serde(default)]
    pub file: NodeTypeConfig,

    #[serde(default)]
    pub symlink: NodeTypeConfig,

    #[serde(default)]
    pub mime_essence: HashMap<String, HashMap<String, NodeTypeConfig>>,

    #[serde(default)]
    pub extension: HashMap<String, NodeTypeConfig>,

    #[serde(default)]
    pub special: HashMap<String, NodeTypeConfig>,
}

impl NodeTypesConfig {
    pub fn get(&self, node: &Node) -> NodeTypeConfig {
        let mut node_type = if node.is_symlink {
            self.symlink.clone()
        } else if node.is_dir {
            self.directory.clone()
        } else {
            self.file.clone()
        };

        let mut me = node.mime_essence.splitn(2, '/');
        let mimetype: String = me.next().map(|s| s.into()).unwrap_or_default();
        let mimesub: String = me.next().map(|s| s.into()).unwrap_or_default();

        if let Some(conf) = self
            .mime_essence
            .get(&mimetype)
            .and_then(|t| t.get(&mimesub).or_else(|| t.get("*")))
        {
            node_type = node_type.extend(conf);
        }

        if let (Some(conf), false) = (self.extension.get(&node.extension), node.is_dir) {
            node_type = node_type.extend(conf);
        }

        if let Some(conf) = self.special.get(&node.relative_path) {
            node_type = node_type.extend(conf);
        }

        node_type
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UiConfig {
    #[serde(default)]
    pub prefix: Option<String>,

    #[serde(default)]
    pub suffix: Option<String>,

    #[serde(default)]
    pub style: Style,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct UiElement {
    #[serde(default)]
    pub format: Option<String>,

    #[serde(default)]
    pub style: Style,
}

impl UiElement {
    pub fn extend(mut self, other: &Self) -> Self {
        self.format = other.format.clone().or(self.format);
        self.style = self.style.extend(&other.style);
        self
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TableRowConfig {
    #[serde(default)]
    pub cols: Option<Vec<UiElement>>,

    #[serde(default)]
    pub style: Style,

    #[serde(default)]
    pub height: Option<u16>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TableConfig {
    #[serde(default)]
    pub header: TableRowConfig,

    #[serde(default)]
    pub row: TableRowConfig,

    #[serde(default)]
    pub style: Style,

    #[serde(default)]
    pub tree: Option<(UiElement, UiElement, UiElement)>,

    #[serde(default)]
    pub col_spacing: Option<u16>,

    #[serde(default)]
    pub col_widths: Option<Vec<Constraint>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SelectionConfig {
    #[serde(default)]
    pub item: UiElement,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SearchConfig {
    #[serde(default)]
    pub algorithm: SearchAlgorithm,

    #[serde(default)]
    pub unordered: bool,

    #[serde(default)]
    pub exact_mode: bool,

    #[serde(default)]
    pub rank_criteria: Option<Vec<RankCriteria>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LogsConfig {
    #[serde(default)]
    pub info: UiElement,

    #[serde(default)]
    pub success: UiElement,

    #[serde(default)]
    pub warning: UiElement,

    #[serde(default)]
    pub error: UiElement,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SortDirectionIdentifiersUi {
    #[serde(default)]
    pub forward: UiElement,

    #[serde(default)]
    pub reverse: UiElement,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SearchDirectionIdentifiersUi {
    #[serde(default)]
    pub ordered: UiElement,

    #[serde(default)]
    pub unordered: UiElement,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SortAndFilterUi {
    #[serde(default)]
    pub separator: UiElement,

    #[serde(default)]
    pub default_identifier: UiElement,

    #[serde(default)]
    pub sort_direction_identifiers: SortDirectionIdentifiersUi,

    #[serde(default)]
    pub sorter_identifiers: HashMap<NodeSorter, UiElement>,

    #[serde(default)]
    pub filter_identifiers: HashMap<NodeFilter, UiElement>,

    #[serde(default)]
    pub search_direction_identifiers: SearchDirectionIdentifiersUi,

    #[serde(default)]
    pub search_identifiers: HashMap<SearchAlgorithm, UiElement>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PanelUi {
    #[serde(default)]
    pub default: PanelUiConfig,

    #[serde(default)]
    pub table: PanelUiConfig,

    #[serde(default)]
    pub sort_and_filter: PanelUiConfig,

    #[serde(default)]
    pub selection: PanelUiConfig,

    #[serde(default)]
    pub input_and_logs: PanelUiConfig,

    #[serde(default)]
    pub help_menu: PanelUiConfig,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GeneralConfig {
    #[serde(default)]
    pub disable_debug_error_mode: bool,

    #[serde(default)]
    pub enable_mouse: bool,

    #[serde(default)]
    pub show_hidden: bool,

    #[serde(default)]
    pub read_only: bool,

    #[serde(default)]
    pub enable_recover_mode: bool,

    #[serde(default)]
    pub hide_remaps_in_help_menu: bool,

    #[serde(default)]
    pub enforce_bounded_index_navigation: bool,

    #[serde(default)]
    pub prompt: UiElement,

    #[serde(default)]
    pub logs: LogsConfig,

    #[serde(default)]
    pub table: TableConfig,

    #[serde(default)]
    pub selection: SelectionConfig,

    #[serde(default)]
    pub search: SearchConfig,

    #[serde(default)]
    pub default_ui: UiConfig,

    #[serde(default)]
    pub focus_ui: UiConfig,

    #[serde(default)]
    pub selection_ui: UiConfig,

    #[serde(default)]
    pub focus_selection_ui: UiConfig,

    #[serde(default)]
    
```

### Core Architecture Module: `src/directory_buffer.rs`
```
use crate::node::Node;
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct DirectoryBuffer {
    pub parent: String,
    pub nodes: Vec<Node>,
    pub total: usize,
    pub focus: usize,

    #[serde(skip, default = "now")]
    pub explored_at: OffsetDateTime,
}

impl DirectoryBuffer {
    pub fn new(parent: String, nodes: Vec<Node>, focus: usize) -> Self {
        let total = nodes.len();
        Self {
            parent,
            nodes,
            total,
            focus,
            explored_at: now(),
        }
    }

    pub fn focused_node(&self) -> Option<&Node> {
        self.nodes.get(self.focus)
    }
}

fn now() -> OffsetDateTime {
    OffsetDateTime::now_local()
        .ok()
        .unwrap_or_else(OffsetDateTime::now_utc)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #565** (2024-05-01): **panicked at 'assertion failed: tv_nsec >= 0 && tv_nsec < NSEC_PER_SEC as i64**
  *Symptoms*: With the latest update 0.20.2, when I try to run the `xplr` command in the terminal, I'm getting this error: ``` thread 'main' panicked at 'assertion failed: tv_nsec >= 0 && tv_nsec < NSEC_PER_SEC as i64', library/std/src/sys/unix/time.rs:66:9 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace nushell: oops, process 'xplr' core dumped ``` OS: Arch Linux Terminal: Alacritty Shell: Nushell (I tried with Bash too but still the same error) Rust: 1.66.1 stable Compositor: Labwc (Wayland)
  **Post-Mortem & Fix Analysis**:
  > Is your system time correct?
  > I think so, `xplr` was working in previous versions. Here is my `timedatectl`: ``` Local time: Mon 2023-01-16 12:52:48 CET Universal time: Mon 2023-01-16 11:52:48 UTC RTC time: Mon 2023-01-16 11:51:27 Time zone: Europe/Madrid (CET, +0100) System clock synchronized: no NTP service: inactive RTC in local TZ: no ```
  > Can you try in docker?  ```bash # Ubuntu docker run -w / -it --rm ubuntu sh -uec '   apt-get update -y   apt-get install -y wget tar vim less   wget https://github.com/sayanarijit/xplr/releases/latest/download/xplr-linux.tar.gz   tar -xzvf xplr-linux.tar.gz   ./xplr ' ``` ```bash # Arch docker run -w / -it --rm archlinux sh -uec '   pacman -Sy wget tar vim less   wget https://github.com/sayanarijit/xplr/releases/latest/download/xplr-linux.tar.gz   tar -xzvf xplr-linux.tar.gz   ./xplr ' ```

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

### Incident Patch 1: `0cf90f20` (2026-09-22)
**Commit Message**: fix: Redraw terminal screen after clearing (#786)

rather than only clearing the screen and leaving it in that state. This
behavior was introduced in eb905ba2, apparently as a side-effect to
handling pipe crashes. The result of it is that opening and closing an
alt-screen application such as `less` from within `xplr` leaves the
terminal surface blank, without the ability to redraw the screen.
Subsequent updates of UI elements (such as selecting another dir entry)
redraw the screen only partially, leaving the UI broken.

I checked the upstream sources and `terminal.clear` does perform a full
redraw, which I think `execute!(...)` does not. I didn't find another
way to trivially trigger the redraw, so I figured I'll just revert the
change. The original commit message that introduced this change didn't
make it obvious to me why this was changed in the first place. The
`NOTE` merely mentioned the cursor position being stored/restored, but
that is only part of the functionality that `terminal.clear()`
implemented.


## Reproducing the issue

To verify, here's the config snippet I use to invoke `less`:

```lua
xplr.config.modes.builtin.default.key_bindings.on_key["i"] = {
    help = "to p

**File**: `src/runner.rs` (modified, +18/-33)
```diff
@@ -80,8 +80,8 @@ fn call(
 
         event_reader.stop();
 
-        // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-        execute!(terminal.backend_mut(), term::Clear(term::ClearType::All))?;
+        // Clear AND redraw the terminal surface
+        terminal.clear()?;
         terminal.set_cursor_position((0, 0))?;
         term::disable_raw_mode()?;
         terminal.show_cursor()?;
@@ -176,8 +176,8 @@ fn call(
     };
 
     if !silent {
-        // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-        execute!(terminal.backend_mut(), term::Clear(term::ClearType::All))?;
+        // Clear AND redraw the terminal surface
+        terminal.clear()?;
         term::enable_raw_mode()?;
         terminal.hide_cursor()?;
         event_reader.start();
@@ -340,8 +340,8 @@ impl Runner {
         let backend = CrosstermBackend::new(stdout);
         let mut terminal = Terminal::new(backend)?;
         terminal.hide_cursor()?;
-        // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-        execute!(terminal.backend_mut(), term::Clear(term::ClearType::All))?;
+        // Clear AND redraw the terminal surface
+        terminal.clear()?;
 
         // Threads
         pwd_watcher::keep_watching(app.pwd.as_ref(), tx_msg_in.clone(), rx_pwd_watcher)?;
@@ -416,11 +416,8 @@ impl Runner {
                             }
 
                             ClearScreen => {
-                                // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-                                execute!(
-                                    terminal.backend_mut(),
-                                    term::Clear(term::ClearType::All)
-                                )?;
+                                // Clear AND redraw the terminal surface
+                                terminal.clear()?;
                             }
 
                             ScrollUp => {
@@ -628,11 +625,8 @@ impl Runner {
 
                                 event_reader.stop();
 
-                                // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-                                execute!(
-                                    terminal.backend_mut(),
-                                    term::Clear(term::ClearType::All)
-                                )?;
+                                // Clear AND redraw the terminal surface
+                                terminal.clear()?;
                                 terminal.set_cursor_position((0, 0))?;
                                 term::disable_raw_mode()?;
                                 terminal.show_cursor()?;
@@ -647,11 +641,8 @@ impl Runner {
                                     }
                                 };
 
-                                // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-                                execute!(
-                                    terminal.backend_mut(),
-                                    term::Clear(term::ClearType::All)
-                                )?;
+                                // Clear AND redraw the terminal surface
+                                terminal.clear()?;
                                 term::enable_raw_mode()?;
                                 terminal.hide_cursor()?;
                                 event_reader.start();
@@ -680,11 +671,8 @@ impl Runner {
 
                                 event_reader.stop();
 
-                                // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-                                execute!(
-                                    terminal.backend_mut(),
-                                    term::Clear(term::ClearType::All)
-                                )?;
+                                // Clear AND redraw the terminal surface
+                            
```

---

### Incident Patch 2: `a3e119b8` (2026-09-19)
**Commit Message**: fix: Redraw terminal screen after clearing

rather than only clearing the screen and leaving it in that state. This
behavior was introduced in eb905ba2, apparently as a side-effect to
handling pipe crashes. The result of it is that opening and closing an
alt-screen application such as `less` from within `xplr` leaves the
terminal surface blank, without the ability to redraw the screen.
Subsequent updates of UI elements (such as selecting another dir entry)
redraw the screen only partially, leaving the UI broken.

**File**: `src/runner.rs` (modified, +18/-33)
```diff
@@ -80,8 +80,8 @@ fn call(
 
         event_reader.stop();
 
-        // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-        execute!(terminal.backend_mut(), term::Clear(term::ClearType::All))?;
+        // Clear AND redraw the terminal surface
+        terminal.clear()?;
         terminal.set_cursor_position((0, 0))?;
         term::disable_raw_mode()?;
         terminal.show_cursor()?;
@@ -176,8 +176,8 @@ fn call(
     };
 
     if !silent {
-        // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-        execute!(terminal.backend_mut(), term::Clear(term::ClearType::All))?;
+        // Clear AND redraw the terminal surface
+        terminal.clear()?;
         term::enable_raw_mode()?;
         terminal.hide_cursor()?;
         event_reader.start();
@@ -340,8 +340,8 @@ impl Runner {
         let backend = CrosstermBackend::new(stdout);
         let mut terminal = Terminal::new(backend)?;
         terminal.hide_cursor()?;
-        // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-        execute!(terminal.backend_mut(), term::Clear(term::ClearType::All))?;
+        // Clear AND redraw the terminal surface
+        terminal.clear()?;
 
         // Threads
         pwd_watcher::keep_watching(app.pwd.as_ref(), tx_msg_in.clone(), rx_pwd_watcher)?;
@@ -416,11 +416,8 @@ impl Runner {
                             }
 
                             ClearScreen => {
-                                // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-                                execute!(
-                                    terminal.backend_mut(),
-                                    term::Clear(term::ClearType::All)
-                                )?;
+                                // Clear AND redraw the terminal surface
+                                terminal.clear()?;
                             }
 
                             ScrollUp => {
@@ -628,11 +625,8 @@ impl Runner {
 
                                 event_reader.stop();
 
-                                // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-                                execute!(
-                                    terminal.backend_mut(),
-                                    term::Clear(term::ClearType::All)
-                                )?;
+                                // Clear AND redraw the terminal surface
+                                terminal.clear()?;
                                 terminal.set_cursor_position((0, 0))?;
                                 term::disable_raw_mode()?;
                                 terminal.show_cursor()?;
@@ -647,11 +641,8 @@ impl Runner {
                                     }
                                 };
 
-                                // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-                                execute!(
-                                    terminal.backend_mut(),
-                                    term::Clear(term::ClearType::All)
-                                )?;
+                                // Clear AND redraw the terminal surface
+                                terminal.clear()?;
                                 term::enable_raw_mode()?;
                                 terminal.hide_cursor()?;
                                 event_reader.start();
@@ -680,11 +671,8 @@ impl Runner {
 
                                 event_reader.stop();
 
-                                // terminal.clear()?; NOTE: https://github.com/ratatui/ratatui/pull/2694/changes
-                                execute!(
-                                    terminal.backend_mut(),
-                                    term::Clear(term::ClearType::All)
-                                )?;
+                                // Clear AND redraw the terminal surface
+                            
```

---

### Incident Patch 3: `fe2f3547` (2026-08-17)
**Commit Message**: Fix snap publish

**File**: `.github/workflows/cd.yml` (modified, +1/-1)
```diff
@@ -275,7 +275,7 @@ jobs:
 
       - id: publish_snapcraft_store
         name: Publish to Snapcraft Store
-        uses: snapcore/action-publish@v2
+        uses: snapcore/action-publish@v1
         with:
           snap: ${{ steps.prepare_snap.outputs.snap_path }}
           release: ${{ startsWith(github.ref, 'refs/tags/v') && 'stable' || 'edge' }}
```

---

### Incident Patch 4: `683fdab4` (2026-09-15)
**Commit Message**: fix: detach silent commands into their own process group (#783)

Silent commands (BashExecSilently0 etc.) inherited xplr's process group,
so background jobs they left behind died with xplr when the terminal
emulator closed the session. This only showed when xplr was launched
directly by the terminal (xterm -e, foot, ghostty -e) since there was no
parent shell in between.

Now silent commands run as process group leaders, so their backgrounded
children stay in the new group and survive the SIGHUP sent to xplr's
foreground group on exit. Interactive commands are untouched so Ctrl-C
etc. keep working.

Verified the mechanism locally: a backgrounded sleep sharing the group
dies on group SIGHUP, one in its own group survives. cargo test, fmt and
clippy all pass.

Fixes #764

**File**: `src/runner.rs` (modified, +16/-2)
```diff
@@ -108,7 +108,8 @@ fn call(
         .map(Input::to_string)
         .unwrap_or_default();
 
-    let status = Command::new(cmd.command.clone())
+    let mut command = Command::new(cmd.command.clone());
+    command
         .env("XPLR", &app.bin)
         .env("XPLR_VROOT", app.vroot.clone().unwrap_or_default())
         .env("XPLR_APP_VERSION", &app.version)
@@ -135,7 +136,20 @@ fn call(
         .stdin(stdin)
         .stdout(stdout)
         .stderr(stderr)
-        .args(cmd.args)
+        .args(cmd.args);
+
+    // Run silent commands in their own process group so that processes they
+    // leave behind (e.g. `cmd &`) are not in xplr's foreground process group
+    // and survive the terminal emulator closing after xplr quits (see #764).
+    // Interactive commands keep xplr's process group so terminal signals
+    // like Ctrl-C are still delivered to them.
+    #[cfg(unix)]
+    if silent {
+        use std::os::unix::process::CommandExt;
+        command.process_group(0);
+    }
+
+    let status = command
         .status()
         .map(|s| {
             if s.success() {
```

---

### Incident Patch 5: `5f6c2f0c` (2026-09-14)
**Commit Message**: fix: detach silent commands into their own process group

Silent commands (BashExecSilently0 etc.) inherited xplr's process group, so processes they left behind in the background were killed together with xplr when the terminal emulator closed (no parent shell to shield them).

Run silent commands as process group leaders instead. Their backgrounded grandchildren stay in the new group and survive the SIGHUP sent to xplr's foreground group on terminal exit. Interactive commands are untouched so terminal signals like Ctrl-C keep working.

Fixes #764

Signed-off-by: Mustafa Senoglu <mmustafasenoglu0@gmail.com>

**File**: `src/runner.rs` (modified, +16/-2)
```diff
@@ -108,7 +108,8 @@ fn call(
         .map(Input::to_string)
         .unwrap_or_default();
 
-    let status = Command::new(cmd.command.clone())
+    let mut command = Command::new(cmd.command.clone());
+    command
         .env("XPLR", &app.bin)
         .env("XPLR_VROOT", app.vroot.clone().unwrap_or_default())
         .env("XPLR_APP_VERSION", &app.version)
@@ -135,7 +136,20 @@ fn call(
         .stdin(stdin)
         .stdout(stdout)
         .stderr(stderr)
-        .args(cmd.args)
+        .args(cmd.args);
+
+    // Run silent commands in their own process group so that processes they
+    // leave behind (e.g. `cmd &`) are not in xplr's foreground process group
+    // and survive the terminal emulator closing after xplr quits (see #764).
+    // Interactive commands keep xplr's process group so terminal signals
+    // like Ctrl-C are still delivered to them.
+    #[cfg(unix)]
+    if silent {
+        use std::os::unix::process::CommandExt;
+        command.process_group(0);
+    }
+
+    let status = command
         .status()
         .map(|s| {
             if s.success() {
```

---

### Incident Patch 6: `2dcd3ea1` (2026-09-14)
**Commit Message**: fix: return Permissions::default() on Windows instead of panicking (#781) (#782)

Fixes #781

## Problem

On Windows, `Permissions::from(&Metadata)` unconditionally panics with
`"Cannot get permissions from metadata on Windows"`. Since `metadata()`
typically succeeds on Windows, any directory listing crashes xplr — the
`Permissions::default()` fallback in `node.rs` is never reached because
the panic fires first.

## Fix

Replace the `panic!` with `Self::default()` in the `#[cfg(windows)]`
implementation of `From<&Metadata> for Permissions`. This returns
all-permissions-false (`---------`), matching the existing
metadata-error fallback style and allowing xplr to degrade gracefully on
Windows.

## Impact

- Windows users can browse directories without crashes
- No behavior change on Unix platforms
- Consistent with the existing `Permissions::default()` fallback already
used in `node.rs` for metadata errors

**File**: `src/permissions.rs` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ impl From<&Metadata> for Permissions {
 
     #[cfg(windows)]
     fn from(_: &Metadata) -> Self {
-        panic!("Cannot get permissions from metadata on Windows")
+        Self::default()
     }
 }
 
```

---

### Incident Patch 7: `7c0004e5` (2026-09-13)
**Commit Message**: fix: return Permissions::default() on Windows instead of panicking (#781)

Signed-off-by: Mustafa Senoglu <mmustafasenoglu0@gmail.com>

**File**: `src/permissions.rs` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ impl From<&Metadata> for Permissions {
 
     #[cfg(windows)]
     fn from(_: &Metadata) -> Self {
-        panic!("Cannot get permissions from metadata on Windows")
+        Self::default()
     }
 }
 
```

---

### Incident Patch 8: `d96991f6` (2026-08-25)
**Commit Message**: fix: use portable mkdir for create_file mode (#780)

**File**: `src/init.lua` (modified, +2/-2)
```diff
@@ -1955,8 +1955,8 @@ xplr.config.modes.builtin.create_file = {
               PTH="$XPLR_INPUT_BUFFER"
               PTH_ESC=$(printf %q "$PTH")
               if [ "$PTH" ]; then
-                mkdir -p -- "$(dirname $(realpath -m $PTH))"  # This may fail.
-                touch -- "$PTH" \
+                mkdir -p -- "$(dirname -- "$PTH")" \
+                && touch -- "$PTH" \
                 && "$XPLR" -m 'SetInputBuffer: ""' \
                 && "$XPLR" -m 'LogSuccess: %q' "$PTH_ESC created" \
                 && "$XPLR" -m 'ExplorePwd' \
```

---

### Incident Patch 9: `3050b817` (2026-08-24)
**Commit Message**: fix: use portable mkdir for create_file mode

Fixes #770

The create_file mode used `realpath -m` which is not portable
(macOS doesn't support the -m flag). Changed to use `dirname`
directly like the create_conditional mode does.

This ensures parent directories are created when creating a file
with a nested path like `parser/mod.rs`.

**File**: `src/init.lua` (modified, +2/-2)
```diff
@@ -1955,8 +1955,8 @@ xplr.config.modes.builtin.create_file = {
               PTH="$XPLR_INPUT_BUFFER"
               PTH_ESC=$(printf %q "$PTH")
               if [ "$PTH" ]; then
-                mkdir -p -- "$(dirname $(realpath -m $PTH))"  # This may fail.
-                touch -- "$PTH" \
+                mkdir -p -- "$(dirname -- "$PTH")" \
+                && touch -- "$PTH" \
                 && "$XPLR" -m 'SetInputBuffer: ""' \
                 && "$XPLR" -m 'LogSuccess: %q' "$PTH_ESC created" \
                 && "$XPLR" -m 'ExplorePwd' \
```

---

### Incident Patch 10: `d173eed5` (2026-08-15)
**Commit Message**: Fix CD

**File**: `.github/workflows/cd.yml` (modified, +2/-2)
```diff
@@ -65,7 +65,7 @@ jobs:
       - id: install_macos_deps
         name: Installing needed macOS dependencies
         if: matrix.os == 'macos-latest'
-        run: brew install openssl@1.1
+        run: brew install openssl
 
       - id: install_linux_deps
         name: Installing needed Ubuntu dependencies
@@ -135,7 +135,7 @@ jobs:
 
       - id: build_snap
         name: Build Snap via Snapcraft
-        uses: snapcore/action-build@v2
+        uses: snapcore/action-build@v1
         with:
           snapcraft-args: "--use-lxd"
 
```

#### Recent Merged Pull Requests:
- **PR #787** (2026-09-22): v1.1.3 (@sayanarijit)
- **PR #786** (2026-09-22): fix: Redraw terminal screen after clearing (@har7an)
- **PR #785** (2026-09-16): Support installing via cargo binstall (@mmustafasenoglu)
- **PR #784** (2026-09-15): v1.1.2 (@sayanarijit)
- **PR #783** (2026-09-15): fix: detach silent commands into their own process group (@mmustafasenoglu)
- **PR #782** (2026-09-14): fix: return Permissions::default() on Windows instead of panicking (#781) (@mmustafasenoglu)
- **PR #780** (2026-08-25): fix: use portable mkdir for create_file mode (@mmustafasenoglu)
- **PR #779** (2026-08-15): release v1.1.1 (@sayanarijit)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
