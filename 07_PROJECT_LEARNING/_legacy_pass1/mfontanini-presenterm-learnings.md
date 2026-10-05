# Forensic Learning Record (Deep Inspection): mfontanini/presenterm

> **Canonical Artifact**: `07_PROJECT_LEARNING/mfontanini-presenterm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mfontanini/presenterm](https://github.com/mfontanini/presenterm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:35:49.361Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mfontanini/presenterm`
- **Description**: A markdown terminal slideshow tool
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 8885 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/code/execute.rs`
```
//! Code execution.

use super::snippet::SnippetExecutorSpec;
use crate::{
    code::snippet::{Snippet, SnippetExecution, SnippetLanguage, SnippetRepr},
    config::{LanguageSnippetExecutionConfig, SnippetExecutorConfig},
};
use once_cell::sync::Lazy;
use os_pipe::PipeReader;
use std::{
    collections::{BTreeMap, HashMap},
    fmt::{self, Debug},
    fs::File,
    io::{self, BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{self, Child, Stdio},
    sync::{Arc, Mutex},
    thread,
};
use tempfile::TempDir;

static EXECUTORS: Lazy<BTreeMap<SnippetLanguage, LanguageSnippetExecutionConfig>> =
    Lazy::new(|| serde_yaml::from_slice(include_bytes!("../../executors.yaml")).expect("executors.yaml is broken"));

/// Strip verbatim UNC prefix when drive letters
#[cfg(windows)]
fn strip_drive_unc_prefix(path: &Path) -> String {
    // Convert to string (lossy if needed)
    let path_str = path.to_string_lossy();

    // If it starts with \\?\ and the next part looks like a drive letter, strip it
    if let Some(rest) = path_str.strip_prefix(r"\\?\") {
        if rest.len() >= 2 && rest.as_bytes()[1] == b':' {
            // Example: \\?\C:\foo -> C:\foo
            return rest.to_string();
        }
    }

    // Otherwise, return the original string unchanged
    path_str.into_owned()
}

/// Allows executing code.
pub struct SnippetExecutor {
    executors: BTreeMap<SnippetLanguage, LanguageSnippetExecutionConfig>,
    cwd: PathBuf,
}

impl SnippetExecutor {
    pub fn new(
        custom_executors: BTreeMap<SnippetLanguage, LanguageSnippetExecutionConfig>,
        cwd: PathBuf,
    ) -> Result<Self, InvalidSnippetConfig> {
        let mut executors = EXECUTORS.clone();
        executors.extend(custom_executors);
        for (language, config) in &executors {
            Self::validate_executor_config(language, &config.executor)?;
            for alternative in config.alternative.values() {
                Self::validate_executor_config(language, alternative)?;
            }
        }
        Ok(Self { executors, cwd })
    }

    pub(crate) fn language_executor(
        &self,
        language: &SnippetLanguage,
        spec: &SnippetExecutorSpec,
        custom_env: HashMap<String, String>,
    ) -> Result<LanguageSnippetExecutor, UnsupportedExecution> {
        let language_config = self
            .executors
            .get(language)
            .ok_or_else(|| UnsupportedExecution(language.clone(), "no executors found".into()))?;
        let config = match spec {
            SnippetExecutorSpec::Default => language_config.executor.clone(),
            SnippetExecutorSpec::Alternative(name) => {
                language_config.alternative.get(name).cloned().ok_or_else(|| {
                    UnsupportedExecution(language.clone(), format!("alternative executor '{name}' is not defined"))
                })?
            }
        };

        let mut env = config.environment.clone();
        env.extend(custom_env);
        Ok(LanguageSnippetExecutor {
            hidden_line_prefix: language_config.hidden_line_prefix.clone(),
            config,
            cwd: self.cwd.clone(),
            env,
        })
    }

    pub(crate) fn hidden_line_prefix(&self, language: &SnippetLanguage) -> Option<&str> {
        self.executors.get(language).and_then(|lang| lang.hidden_line_prefix.as_deref())
    }

    fn validate_executor_config(
        language: &SnippetLanguage,
        executor: &SnippetExecutorConfig,
    ) -> Result<(), InvalidSnippetConfig> {
        if executor.filename.is_empty() {
            return Err(InvalidSnippetConfig(language.clone(), "filename is empty"));
        }
        if executor.commands.is_empty() {
            return Err(InvalidSnippetConfig(language.clone(), "no commands given"));
        }
        for command in &executor.commands {
            if command.is_empty() {
                return Err(InvalidSnippetConfig(language.clone(), "empty command given"));
            }
        }
        Ok(())
    }
}

impl Default for SnippetExecutor {
    fn default() -> Self {
        Self::new(Default::default(), PathBuf::from("./")).expect("initialization failed")
    }
}

impl Debug for SnippetExecutor {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SnippetExecutor {{ .. }}")
    }
}

#[derive(Clone, Debug)]
pub(crate) struct LanguageSnippetExecutor {
    hidden_line_prefix: Option<String>,
    config: SnippetExecutorConfig,
    cwd: PathBuf,
    env: HashMap<String, String>,
}

impl LanguageSnippetExecutor {
    /// Execute a piece of code asynchronously.
    pub(crate) fn execute_async(&self, snippet: &Snippet) -> Result<ExecutionHandle, CodeExecuteError> {
        let script_dir = self.write_snippet(snippet)?;
        let state: Arc<Mutex<ExecutionState>> = Default::default();
        let output_type = match &snippet.attributes.execution {
            SnippetExecution::Exec(args) if matches!(args.repr, SnippetRepr::Image) => OutputType::Binary,
            _ => OutputType::Lines,
        };
        let reader_handle = CommandsRunner::spawn(
            state.clone(),
            script_dir,
            self.config.commands.clone(),
            self.env.clone(),
            self.cwd.clone(),
            output_type,
        );
        let handle = ExecutionHandle { state, reader_handle };
        Ok(handle)
    }

    /// Executes a piece of code synchronously.
    pub(crate) fn execute_sync(&self, snippet: &Snippet) -> Result<(), CodeExecuteError> {
        let script_dir = self.write_snippet(snippet)?;
        let script_dir_path = script_dir.path().to_string_lossy();
        for commands in self.config.commands.clone() {
            self.execute_command(commands, &script_dir_path)?;
        }
        Ok(())
    }

    /// Creates the necessary context to run this snippet in a PTY.
    pub(crate) fn pty_execution_context(&self, snippet: &Snippet) -> Result<PtySnippetContext, CodeExecuteError> {
        let script_dir = self.write_snippet(snippet)?;
        let script_dir_path = script_dir.path().to_string_lossy();

        // Run the first N-1 commands normally and assume the last one is the one that actually
        // invokes the thing (e.g. rust snippet compilation happens here, snippet execution in PTY)
        for commands in self.config.commands.iter().take(self.config.commands.len() - 1).cloned() {
            self.execute_command(commands, &script_dir_path)?;
        }
        let mut commands = self.config.commands.last().cloned().unwrap();
        for command in &mut commands {
            *command = command.replace("$pwd", &script_dir_path);
        }
        let (command, args) = commands.split_first().expect("no commands");
        let mut command = portable_pty::CommandBuilder::new(command);
        command.args(args);
        command.cwd(&self.cwd);
        for (key, value) in &self.env {
            command.env(key, value);
        }
        Ok(PtySnippetContext { command, _temp: script_dir })
    }

    fn execute_command(&self, mut commands: Vec<String>, script_dir_path: &str) -> Result<(), CodeExecuteError> {
        for command in &mut commands {
            *command = command.replace("$pwd", script_dir_path);
        }
        let (command, args) = commands.split_first().expect("no commands");
        let child = process::Command::new(command)
            .args(args)
            .envs(&self.env)
            .current_dir(&self.cwd)
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| CodeExecuteError::SpawnProcess(command.clone(), e))?;

        let output = child.wait_with_output().map_err(CodeExecuteError::Waiting)?;
        if output.status.success() {
            Ok(())
        } else {
            let error = String::from_utf8_lossy(&output.stderr).to_string();
            Err(CodeExecuteError::Running(error))
        }
    }

    fn write_snippet(&self, snippet: &Snippet) -> Result<TempDir, CodeExecuteError> {
       
```

### Core Architecture Module: `src/code/highlighting.rs`
```
use crate::{
    code::snippet::SnippetLanguage,
    markdown::{
        elements::{Line, Text},
        text_style::{Color, TextStyle},
    },
    theme::CodeBlockStyle,
};
use flate2::read::ZlibDecoder;
use once_cell::sync::Lazy;
use serde::Deserialize;
use std::{cell::RefCell, collections::BTreeMap, fs, path::Path, rc::Rc};
use syntect::{
    LoadingError,
    easy::HighlightLines,
    highlighting::{Style, Theme, ThemeSet},
    parsing::SyntaxSet,
};

static SYNTAX_SET: Lazy<SyntaxSet> = Lazy::new(|| {
    let contents = include_bytes!("../../bat/syntaxes.bin");
    bincode::deserialize(contents).expect("syntaxes are broken")
});

static BAT_THEMES: Lazy<LazyThemeSet> = Lazy::new(|| {
    let contents = include_bytes!("../../bat/themes.bin");
    let theme_set: LazyThemeSet = bincode::deserialize(contents).expect("syntaxes are broken");
    theme_set
});

// This structure mimic's `bat`'s serialized theme set's.
#[derive(Debug, Deserialize)]
struct LazyThemeSet {
    serialized_themes: BTreeMap<String, Vec<u8>>,
}

pub struct HighlightThemeSet {
    themes: RefCell<BTreeMap<String, Rc<Theme>>>,
}

impl HighlightThemeSet {
    /// Construct a new highlighter using the given [syntect] theme name.
    pub fn load_by_name(&self, name: &str) -> Option<SnippetHighlighter> {
        let mut themes = self.themes.borrow_mut();
        // Check if we already loaded this one.
        if let Some(theme) = themes.get(name).cloned() {
            Some(SnippetHighlighter { theme })
        }
        // Otherwise try to deserialize it from bat's themes
        else if let Some(theme) = self.deserialize_bat_theme(name) {
            themes.insert(name.into(), theme.clone());
            Some(SnippetHighlighter { theme })
        } else {
            None
        }
    }

    /// Register all highlighting themes in the given directory.
    pub fn register_from_directory<P: AsRef<Path>>(&mut self, path: P) -> Result<(), LoadingError> {
        let Ok(metadata) = fs::metadata(&path) else {
            return Ok(());
        };
        if !metadata.is_dir() {
            return Ok(());
        }
        let themes = ThemeSet::load_from_folder(path)?;
        let themes = themes.themes.into_iter().map(|(name, theme)| (name, Rc::new(theme)));
        self.themes.borrow_mut().extend(themes);
        Ok(())
    }

    fn deserialize_bat_theme(&self, name: &str) -> Option<Rc<Theme>> {
        let serialized = BAT_THEMES.serialized_themes.get(name)?;
        let decoded: Theme = bincode::deserialize_from(ZlibDecoder::new(serialized.as_slice())).ok()?;
        let decoded = Rc::new(decoded);
        Some(decoded)
    }
}

impl Default for HighlightThemeSet {
    fn default() -> Self {
        let themes = ThemeSet::load_defaults();
        let themes = themes.themes.into_iter().map(|(name, theme)| (name, Rc::new(theme))).collect();
        Self { themes: RefCell::new(themes) }
    }
}

/// A snippet highlighter.
#[derive(Clone)]
pub(crate) struct SnippetHighlighter {
    theme: Rc<Theme>,
}

impl SnippetHighlighter {
    /// Create a highlighter for a specific language.
    pub(crate) fn language_highlighter(&self, language: &SnippetLanguage) -> LanguageHighlighter<'_> {
        let extension = Self::language_extension(language);
        let syntax = SYNTAX_SET.find_syntax_by_extension(extension).unwrap();
        let highlighter = HighlightLines::new(syntax, &self.theme);
        LanguageHighlighter::new(language.clone(), highlighter)
    }

    fn language_extension(language: &SnippetLanguage) -> &'static str {
        use SnippetLanguage::*;
        match language {
            Ada => "adb",
            Asp => "asa",
            Awk => "awk",
            Bash => "sh",
            BatchFile => "cmd",
            C => "c",
            CMake => "cmake",
            CSharp => "cs",
            Clojure => "clj",
            Cpp => "cpp",
            Crontab => "crontab",
            Css => "css",
            Dart => "dart",
            D2 => "txt",
            DLang => "d",
            Diff => "diff",
            Docker => "Dockerfile",
            Dotenv => "env",
            Elixir => "ex",
            Elm => "elm",
            Erlang => "erl",
            File => "txt",
            Fish => "fish",
            FSharp => "fsx",
            GdScript => "gd",
            Go => "go",
            GraphQL => "graphql",
            Haskell => "hs",
            Html => "html",
            Java => "java",
            JavaScript => "js",
            Json => "json",
            Jsonnet => "jsonnet",
            Julia => "jl",
            Kotlin => "kt",
            Latex => "tex",
            Lua => "lua",
            Makefile => "make",
            Markdown => "md",
            Mermaid => "txt",
            Nix => "nix",
            Nushell => "txt",
            OCaml => "ml",
            Perl => "pl",
            Php => "php",
            PowerShell => "ps1",
            Protobuf => "proto",
            Puppet => "pp",
            Python => "py",
            R => "r",
            Racket => "rkt",
            Ruby => "rb",
            Rust => "rs",
            RustScript => "rs",
            Scala => "scala",
            Shell => "sh",
            Sql => "sql",
            Swift => "swift",
            Svelte => "svelte",
            Tcl => "tcl",
            Terraform => "tf",
            Toml => "toml",
            TypeScript => "ts",
            TypeScriptReact => "tsx",
            Typst => "txt",
            // default to plain text so we get the same look&feel
            Unknown(_) => "txt",
            Verilog => "v",
            Vue => "vue",
            Wsl => "sh",
            Xml => "xml",
            Yaml => "yaml",
            Zsh => "sh",
            Zig => "zig",
        }
    }
}

impl Default for SnippetHighlighter {
    fn default() -> Self {
        let themes = HighlightThemeSet::default();
        themes.load_by_name("base16-eighties.dark").expect("default theme not found")
    }
}

pub(crate) struct LanguageHighlighter<'a> {
    language: SnippetLanguage,
    highlighter: HighlightLines<'a>,
    parse_started: bool,
}

impl<'a> LanguageHighlighter<'a> {
    fn new(language: SnippetLanguage, highlighter: HighlightLines<'a>) -> Self {
        Self { language, highlighter, parse_started: false }
    }

    pub(crate) fn style_line(&mut self, line: &str, block_style: &CodeBlockStyle) -> Line {
        if !self.parse_started {
            let line = line.trim();
            if !line.is_empty() {
                self.parse_started = true;
                // Parse a fake "<?php" line if PHP code doesn't start with one so highlighting
                // looks good.
                if matches!(self.language, SnippetLanguage::Php) && !line.starts_with("<?php") {
                    self.highlighter.highlight_line("<?php\n", &SYNTAX_SET).unwrap();
                }
            }
        }
        let texts: Vec<_> = self
            .highlighter
            .highlight_line(line, &SYNTAX_SET)
            .unwrap()
            .into_iter()
            .map(|(style, tokens)| StyledTokens::new(style, tokens, block_style).apply_style())
            .collect();
        Line(texts)
    }
}

pub(crate) struct StyledTokens<'a> {
    pub(crate) style: TextStyle,
    pub(crate) tokens: &'a str,
}

impl<'a> StyledTokens<'a> {
    pub(crate) fn new(style: Style, tokens: &'a str, block_style: &CodeBlockStyle) -> Self {
        let has_background = block_style.background;
        let background = has_background.then_some(parse_color(style.background)).flatten();
        let foreground = parse_color(style.foreground);
        let mut style = TextStyle::default();
        style.colors.background = background;
        style.colors.foreground = foreground;
        Self { style, tokens }
    }

    pub(crate) fn apply_style(&self) -> Text {
        let text: String = self.tokens.split('\n').collect();
        Text::new(text, self.style)
    }
}

// This code has been adapted from bat's: ht
```

### Core Architecture Module: `src/code/mod.rs`
```
pub(crate) mod execute;
pub(crate) mod highlighting;
pub(crate) mod padding;
pub(crate) mod snippet;

```

### Core Architecture Module: `src/code/padding.rs`
```
use std::iter;

pub(crate) struct NumberPadder {
    width: usize,
}

impl NumberPadder {
    pub(crate) fn new(upper_bound: usize) -> Self {
        let width = upper_bound.checked_ilog10().map(|log| log as usize + 1).unwrap_or_default();
        Self { width }
    }

    pub(crate) fn pad_right(&self, number: usize) -> String {
        let line_number_width = number.ilog10() as usize + 1;
        let number_padding = self.width - line_number_width;

        let mut output = String::with_capacity(self.width);
        output.extend(iter::repeat_n(' ', number_padding));
        output.push_str(&number.to_string());
        output
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use rstest::rstest;

    #[rstest]
    #[case(&[1, 2], &["1", "2"])]
    #[case(&[1, 9], &["1", "9"])]
    #[case(&[1, 10], &[" 1", "10"])]
    #[case(&[1, 10, 100], &["  1", " 10", "100"])]
    fn right_padding(#[case] numbers: &[usize], #[case] expected: &[&str]) {
        let max = numbers.iter().max().expect("no numbers");
        let padder = NumberPadder::new(*max);
        let rendered: Vec<_> = numbers.iter().map(|n| padder.pad_right(*n)).collect();
        assert_eq!(rendered, expected);
    }

    #[test]
    fn zero_count() {
        NumberPadder::new(0);
    }
}

```

### Core Architecture Module: `src/code/snippet.rs`
```
use super::{
    highlighting::{LanguageHighlighter, StyledTokens},
    padding::NumberPadder,
};
use crate::{
    markdown::{
        elements::{Percent, PercentParseError},
        text::{WeightedLine, WeightedText},
        text_style::{Color, TextStyle},
    },
    presentation::ChunkMutator,
    render::{
        operation::{AsRenderOperations, BlockLine, RenderOperation},
        properties::WindowSize,
    },
    theme::{Alignment, CodeBlockStyle},
};
use serde::Deserialize;
use std::{cell::RefCell, convert::Infallible, fmt::Write, ops::Range, path::PathBuf, rc::Rc, str::FromStr};
use strum::{EnumDiscriminants, EnumIter};
use unicode_width::UnicodeWidthStr;

pub(crate) struct SnippetSplitter<'a> {
    style: &'a CodeBlockStyle,
    hidden_line_prefix: Option<&'a str>,
}

impl<'a> SnippetSplitter<'a> {
    pub(crate) fn new(style: &'a CodeBlockStyle, hidden_line_prefix: Option<&'a str>) -> Self {
        Self { style, hidden_line_prefix }
    }

    pub(crate) fn split(&self, code: &Snippet) -> Vec<SnippetLine> {
        let mut lines = Vec::new();
        let horizontal_padding = self.style.padding.horizontal;
        let vertical_padding = self.style.padding.vertical;
        if vertical_padding > 0 {
            lines.push(SnippetLine::empty());
        }
        self.push_lines(code, horizontal_padding, &mut lines);
        if vertical_padding > 0 {
            lines.push(SnippetLine::empty());
        }
        lines
    }

    fn push_lines(&self, code: &Snippet, horizontal_padding: u8, lines: &mut Vec<SnippetLine>) {
        if code.contents.is_empty() {
            return;
        }

        let padding = " ".repeat(horizontal_padding as usize);
        let padder = NumberPadder::new(code.visible_lines(self.hidden_line_prefix).count());
        for (index, line) in code.visible_lines(self.hidden_line_prefix).enumerate() {
            let mut line = line.replace('\t', "    ");
            let mut prefix = padding.clone();
            if code.attributes.line_numbers {
                let line_number = index + 1;
                prefix.push_str(&padder.pad_right(line_number));
                prefix.push(' ');
            }
            line.push('\n');
            let line_number = Some(index as u16 + 1);
            lines.push(SnippetLine { prefix, code: line, right_padding_length: padding.len() as u16, line_number });
        }
    }
}

pub(crate) struct SnippetLine {
    pub(crate) prefix: String,
    pub(crate) code: String,
    pub(crate) right_padding_length: u16,
    pub(crate) line_number: Option<u16>,
}

impl SnippetLine {
    pub(crate) fn empty() -> Self {
        Self { prefix: String::new(), code: "\n".into(), right_padding_length: 0, line_number: None }
    }

    pub(crate) fn width(&self) -> usize {
        self.prefix.width() + self.code.width() + self.right_padding_length as usize
    }

    pub(crate) fn highlight(
        &self,
        code_highlighter: &mut LanguageHighlighter,
        block_style: &CodeBlockStyle,
        font_size: u8,
    ) -> WeightedLine {
        let mut line = code_highlighter.style_line(&self.code, block_style);
        line.apply_style(&TextStyle::default().size(font_size));
        line.into()
    }

    pub(crate) fn dim(&self, dim_style: &TextStyle) -> WeightedLine {
        let output = vec![StyledTokens { style: *dim_style, tokens: &self.code }.apply_style()];
        output.into()
    }

    pub(crate) fn dim_prefix(&self, dim_style: &TextStyle) -> WeightedText {
        let text = StyledTokens { style: *dim_style, tokens: &self.prefix }.apply_style();
        text.into()
    }
}

#[derive(Debug)]
pub(crate) struct HighlightContext {
    pub(crate) groups: Vec<HighlightGroup>,
    pub(crate) current: usize,
    pub(crate) block_length: u16,
    pub(crate) alignment: Alignment,
}

#[derive(Debug)]
pub(crate) struct HighlightedLine {
    pub(crate) prefix: WeightedText,
    pub(crate) right_padding_length: u16,
    pub(crate) highlighted: WeightedLine,
    pub(crate) not_highlighted: WeightedLine,
    pub(crate) line_number: Option<u16>,
    pub(crate) context: Rc<RefCell<HighlightContext>>,
    pub(crate) block_color: Option<Color>,
}

impl AsRenderOperations for HighlightedLine {
    fn as_render_operations(&self, _: &WindowSize) -> Vec<RenderOperation> {
        let context = self.context.borrow();
        let group = &context.groups[context.current];
        let needs_highlight = self.line_number.map(|number| group.contains(number)).unwrap_or_default();
        // TODO: Cow<str>?
        let text = match needs_highlight {
            true => self.highlighted.clone(),
            false => self.not_highlighted.clone(),
        };
        vec![
            RenderOperation::RenderBlockLine(BlockLine {
                prefix: self.prefix.clone(),
                right_padding_length: self.right_padding_length,
                repeat_prefix_on_wrap: false,
                text,
                block_length: context.block_length,
                alignment: context.alignment,
                block_color: self.block_color,
            }),
            RenderOperation::RenderLineBreak,
        ]
    }
}

#[derive(Debug)]
pub(crate) struct HighlightMutator {
    context: Rc<RefCell<HighlightContext>>,
}

impl HighlightMutator {
    pub(crate) fn new(context: Rc<RefCell<HighlightContext>>) -> Self {
        Self { context }
    }
}

impl ChunkMutator for HighlightMutator {
    fn mutate_next(&self) -> bool {
        let mut context = self.context.borrow_mut();
        if context.current == context.groups.len() - 1 {
            false
        } else {
            context.current += 1;
            true
        }
    }

    fn mutate_previous(&self) -> bool {
        let mut context = self.context.borrow_mut();
        if context.current == 0 {
            false
        } else {
            context.current -= 1;
            true
        }
    }

    fn reset_mutations(&self) {
        self.context.borrow_mut().current = 0;
    }

    fn apply_all_mutations(&self) {
        let mut context = self.context.borrow_mut();
        context.current = context.groups.len() - 1;
    }

    fn mutations(&self) -> (usize, usize) {
        let context = self.context.borrow();
        (context.current, context.groups.len())
    }
}

pub(crate) type ParseResult<T> = Result<T, SnippetBlockParseError>;

pub(crate) struct SnippetParser;

impl SnippetParser {
    pub(crate) fn parse(info: String, code: String) -> ParseResult<Snippet> {
        let (language, attributes) = Self::parse_block_info(&info)?;
        let code = Snippet { contents: code, language, attributes };
        Ok(code)
    }

    fn parse_block_info(input: &str) -> ParseResult<(SnippetLanguage, SnippetAttributes)> {
        let (language, input) = Self::parse_language(input);
        let attributes = Self::parse_attributes(input)?;
        if attributes.width.is_some() && !matches!(attributes.execution, SnippetExecution::Render) {
            return Err(SnippetBlockParseError::NotRenderSnippet("width"));
        }
        Ok((language, attributes))
    }

    fn parse_language(input: &str) -> (SnippetLanguage, &str) {
        let token = Self::next_identifier(input);
        // this always returns `Ok` given we fall back to `Unknown` if we don't know the language.
        let language = token.parse().expect("language parsing");
        let rest = &input[token.len()..];
        (language, rest)
    }

    fn parse_attributes(mut input: &str) -> ParseResult<SnippetAttributes> {
        let mut attributes = SnippetAttributes::default();
        let mut processed_attributes = Vec::new();
        while let (Some(attribute), rest) = Self::parse_attribute(input)? {
            let discriminant = SnippetAttributeDiscriminants::from(&attribute);
            if processed_attributes.contains(&discriminant) {
                return Err(SnippetBlockParseError::DuplicateAttribute("duplicate attribute"));
            }
            use SnippetAttribute::*;
        
```

### Core Architecture Module: `src/commands/keyboard.rs`
```
use super::listener::{Command, CommandDiscriminants};
use crate::config::KeyBindingsConfig;
use crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers, poll, read};
use std::{fmt, io, iter, mem, str::FromStr, time::Duration};

/// A keyboard command listener.
pub struct KeyboardListener {
    bindings: CommandKeyBindings,
    events: Vec<KeyEvent>,
}

impl KeyboardListener {
    pub fn new(bindings: CommandKeyBindings) -> Self {
        Self { bindings, events: Vec::new() }
    }

    /// Polls for the next input command coming from the keyboard.
    pub(crate) fn poll_next_command(&mut self, timeout: Duration) -> io::Result<Option<Command>> {
        if poll(timeout)? { self.next_command() } else { Ok(None) }
    }

    /// Blocks waiting for the next command.
    pub(crate) fn next_command(&mut self) -> io::Result<Option<Command>> {
        let mut events = mem::take(&mut self.events);
        let (command, events) = match read()? {
            // Ignore release events
            Event::Key(event) if event.kind == KeyEventKind::Release => (None, events),
            Event::Key(event) => {
                events.push(event);
                self.match_events(events)
            }
            Event::Resize(..) => (Some(Command::Redraw), events),
            _ => (None, vec![]),
        };
        self.events = events;
        Ok(command)
    }

    fn match_events(&self, events: Vec<KeyEvent>) -> (Option<Command>, Vec<KeyEvent>) {
        match self.bindings.apply(&events) {
            InputAction::Emit(command) => (Some(command), Vec::new()),
            InputAction::Buffer => (None, events),
            InputAction::Reset => (None, Vec::new()),
        }
    }
}

enum InputAction {
    Buffer,
    Reset,
    Emit(Command),
}

pub struct CommandKeyBindings {
    bindings: Vec<(KeyBinding, CommandDiscriminants)>,
}

impl CommandKeyBindings {
    fn apply(&self, events: &[KeyEvent]) -> InputAction {
        let mut any_partials = false;
        for (binding, identifier) in &self.bindings {
            match binding.match_events(events) {
                BindingMatch::Full(context) => return Self::instantiate(identifier, context),
                BindingMatch::Partial => any_partials = true,
                BindingMatch::None => (),
            }
        }
        if any_partials { InputAction::Buffer } else { InputAction::Reset }
    }

    fn instantiate(discriminant: &CommandDiscriminants, context: MatchContext) -> InputAction {
        use CommandDiscriminants::*;
        let command = match discriminant {
            Redraw => Command::Redraw,
            Next => Command::Next,
            NextFast => Command::NextFast,
            Previous => Command::Previous,
            PreviousFast => Command::PreviousFast,
            FirstSlide => Command::FirstSlide,
            LastSlide => Command::LastSlide,
            GoToSlide => {
                match context {
                    // this means the command is malformed and this should have been caught earlier
                    // on.
                    MatchContext::None => return InputAction::Reset,
                    MatchContext::Number(number) => Command::GoToSlide(number),
                }
            }
            RenderAsyncOperations => Command::RenderAsyncOperations,
            Exit => Command::Exit,
            Suspend => Command::Suspend,
            Reload => Command::Reload,
            HardReload => Command::HardReload,
            ToggleSlideIndex => Command::ToggleSlideIndex,
            ToggleKeyBindingsConfig => Command::ToggleKeyBindingsConfig,
            ToggleLayoutGrid => Command::ToggleLayoutGrid,
            CloseModal => Command::CloseModal,
            SkipPauses => Command::SkipPauses,
            GoToSlideChunk => panic!("go to slide chunk is not configurable"),
        };
        InputAction::Emit(command)
    }

    fn validate_conflicts<'a>(
        bindings: impl Iterator<Item = &'a KeyBinding>,
    ) -> Result<(), KeyBindingsValidationError> {
        let mut bindings: Vec<_> = bindings.map(|binding| &binding.0).collect();
        bindings.sort_by(|a, b| a.partial_cmp(b).unwrap());
        for window in bindings.windows(2) {
            if window[0].iter().eq(window[1].iter().take(window[0].len())) {
                return Err(KeyBindingsValidationError::Conflict(
                    KeyBinding(window[0].clone()),
                    KeyBinding(window[1].clone()),
                ));
            }
        }
        Ok(())
    }
}

impl TryFrom<KeyBindingsConfig> for CommandKeyBindings {
    type Error = KeyBindingsValidationError;

    fn try_from(config: KeyBindingsConfig) -> Result<Self, Self::Error> {
        let zip = |discriminant, bindings: Vec<KeyBinding>| bindings.into_iter().zip(iter::repeat(discriminant));
        if !config.go_to_slide.iter().all(|k| k.expects_number()) {
            return Err(KeyBindingsValidationError::Invalid("go_to_slide", "<number> matcher required"));
        }
        let KeyBindingsConfig {
            next,
            next_fast,
            previous,
            previous_fast,
            first_slide,
            last_slide,
            go_to_slide,
            execute_code,
            reload,
            toggle_slide_index,
            toggle_bindings,
            toggle_layout_grid,
            close_modal,
            exit,
            suspend,
            skip_pauses,
        } = config;
        let bindings: Vec<_> = iter::empty()
            .chain(zip(CommandDiscriminants::Next, next))
            .chain(zip(CommandDiscriminants::NextFast, next_fast))
            .chain(zip(CommandDiscriminants::Previous, previous))
            .chain(zip(CommandDiscriminants::PreviousFast, previous_fast))
            .chain(zip(CommandDiscriminants::FirstSlide, first_slide))
            .chain(zip(CommandDiscriminants::LastSlide, last_slide))
            .chain(zip(CommandDiscriminants::GoToSlide, go_to_slide))
            .chain(zip(CommandDiscriminants::Exit, exit))
            .chain(zip(CommandDiscriminants::Suspend, suspend))
            .chain(zip(CommandDiscriminants::HardReload, reload))
            .chain(zip(CommandDiscriminants::ToggleSlideIndex, toggle_slide_index))
            .chain(zip(CommandDiscriminants::ToggleKeyBindingsConfig, toggle_bindings))
            .chain(zip(CommandDiscriminants::ToggleLayoutGrid, toggle_layout_grid))
            .chain(zip(CommandDiscriminants::RenderAsyncOperations, execute_code))
            .chain(zip(CommandDiscriminants::CloseModal, close_modal))
            .chain(zip(CommandDiscriminants::SkipPauses, skip_pauses))
            .collect();
        Self::validate_conflicts(bindings.iter().map(|binding| &binding.0))?;
        Ok(Self { bindings })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum KeyBindingsValidationError {
    #[error("invalid binding for {0}: {1}")]
    Invalid(&'static str, &'static str),

    #[error("conflicting keybindings: {0} and {1}")]
    Conflict(KeyBinding, KeyBinding),
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum BindingMatch {
    Full(MatchContext),
    Partial,
    None,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "json-schema", derive(schemars::JsonSchema))]
pub struct KeyBinding(#[cfg_attr(feature = "json-schema", schemars(with = "String"))] Vec<KeyMatcher>);

crate::utils::impl_deserialize_from_str!(KeyBinding);

impl KeyBinding {
    fn match_events(&self, mut events: &[KeyEvent]) -> BindingMatch {
        let mut output_context = MatchContext::None;
        for (index, matcher) in self.0.iter().enumerate() {
            let Some((context, rest)) = matcher.try_match_events(events) else {
                return BindingMatch::None;
            };
            if !matches!(context, MatchContext::None) {
                output_context = context;
            }
            events = rest;

            // We ran all matchers but we have no events left; this is a partial match.
            if index != self.0
```

### Core Architecture Module: `src/commands/listener.rs`
```
use super::{
    keyboard::{CommandKeyBindings, KeyBindingsValidationError, KeyboardListener},
    speaker_notes::{SpeakerNotesEvent, SpeakerNotesEventListener},
};
use crate::{config::KeyBindingsConfig, presenter::PresentationError};
use serde::Deserialize;
use std::time::Duration;
use strum::EnumDiscriminants;

/// A command listener that allows polling all command sources in a single place.
pub struct CommandListener {
    keyboard: KeyboardListener,
    speaker_notes_event_listener: Option<SpeakerNotesEventListener>,
}

impl CommandListener {
    /// Create a new command source over the given presentation path.
    pub fn new(
        config: KeyBindingsConfig,
        speaker_notes_event_listener: Option<SpeakerNotesEventListener>,
    ) -> Result<Self, KeyBindingsValidationError> {
        let bindings = CommandKeyBindings::try_from(config)?;
        Ok(Self { keyboard: KeyboardListener::new(bindings), speaker_notes_event_listener })
    }

    /// Try to get the next command.
    ///
    /// This attempts to get a command and returns `Ok(None)` on timeout.
    pub(crate) fn try_next_command(&mut self) -> Result<Option<Command>, PresentationError> {
        if let Some(receiver) = &self.speaker_notes_event_listener {
            if let Some(msg) = receiver.try_recv()? {
                let command = match msg {
                    SpeakerNotesEvent::GoTo { slide, chunk } => Command::GoToSlideChunk { slide, chunk },
                    SpeakerNotesEvent::Exit => Command::Exit,
                };
                return Ok(Some(command));
            }
        }
        match self.keyboard.poll_next_command(Duration::from_millis(20))? {
            Some(command) => Ok(Some(command)),
            None => Ok(None),
        }
    }
}

/// A command.
#[derive(Clone, Debug, PartialEq, Eq, EnumDiscriminants)]
#[strum_discriminants(derive(Deserialize))]
pub(crate) enum Command {
    /// Redraw the presentation.
    ///
    /// This can happen on terminal resize.
    Redraw,

    /// Move forward in the presentation.
    Next,

    /// Move to the next slide fast.
    NextFast,

    /// Move backwards in the presentation.
    Previous,

    /// Move to the previous slide fast.
    PreviousFast,

    /// Go to the first slide.
    FirstSlide,

    /// Go to the last slide.
    LastSlide,

    /// Go to one particular slide.
    GoToSlide(u32),

    /// Go to one particular slide + chunk.
    GoToSlideChunk { slide: u32, chunk: u32 },

    /// Render any async render operations in the current slide.
    RenderAsyncOperations,

    /// Exit the presentation.
    Exit,

    /// Suspend the presentation.
    Suspend,

    /// The presentation has changed and needs to be reloaded.
    Reload,

    /// Hard reload the presentation.
    ///
    /// Like [Command::Reload] but also reloads any external resources like images and themes.
    HardReload,

    /// Toggle the slide index view.
    ToggleSlideIndex,

    /// Toggle the key bindings config view.
    ToggleKeyBindingsConfig,

    /// Toggle layout grid.
    ToggleLayoutGrid,

    /// Hide the currently open modal, if any.
    CloseModal,

    /// Skip pauses in the current slide.
    SkipPauses,
}

```

### Core Architecture Module: `src/commands/mod.rs`
```
pub(crate) mod keyboard;
pub(crate) mod listener;
pub(crate) mod speaker_notes;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #913** (2026-08-10): **feat: load local syntaxes from bat's config directory**
  *Symptoms*: Any `.sublime-syntax` file under `$(bat --config-dir)/syntaxes` is now loaded on startup, in addition to the syntaxes we bundle. Syntaxes are looked up recursively and take precedence over the bundled ones, and unlike bat there's no need to run `bat cache --build` first.  Languages we don't know about are now looked up by name/extension in the syntax set rather than defaulting to plain text, which is what makes locally installed syntaxes usable. As a side effect, syntaxes bat bundles but presenterm doesn't support natively can now be used as well.

- **Issue #911** (2026-07-27): **Migrate PTY terminal backend from vt100 to rio-vt**
  *Symptoms*: Swaps the PTY snippet's terminal backend from vt100 to [rio-vt](https://crates.io/crates/rio-vt), Rio's terminal engine.  The `ui/execution/pty` module parsed PTY output with vt100 and read each cell's contents and style to build `TextStyle`s. rio-vt does the same, exposed here through a small `PtyParser`/`PtyScreen`/`PtyCell` adapter that mirrors the vt100 surface this module used. rio-vt stores cells as packed handles into the grid style table, so the screen is resolved into owned cells on snapshot; rendering behavior is unchanged.  rio-vt is a full terminal engine (scrollback, wide chars/graphemes, sixel/Kitty/iTerm2 image protocols) rather than a parser plus screen model, and it parses and serializes a bit faster.  Benchmark against vt100 and alacritty_terminal: https://github.com/raphamorim/rio-vt-benchmark  Background on the engine and why it was split out of Rio: https://rioterm.com/blog/2026/07/27/rio-vt-and-librio 

- **Issue #903** (2026-06-27): **Images in tmux are stretched vertically (but only when using presenterm)**
  *Symptoms*: I would like to run a presentation that includes images inside a tmux window (running inside a Foot terminal). Sixel images in general display just fine; running `img2sixel example.png` renders like this:  <img width="523" height="477" alt="Image" src="https://github.com/user-attachments/assets/ea9515b3-21d9-489d-92df-c5cfb9ca2b52" />  But that same image, when used in a presenterm slideshow...  ``` # Example w/ OpenTofu logo  ![](example.png) ```  ...in the same terminal, looks like this:  <img width="1042" height="704" alt="Image" src="https://github.com/user-attachments/assets/03c8db28-3b5f-47ed-98c9-71e4f9c0c79d" />  If I exit tmux, the image displays as expected:  <img width="908" height="400" alt="Image" src="https://github.com/user-attachments/assets/a4c6979b-1ae2-4e2b-b128-cbcda42e49cf" />  What is causing the vertical distortion?
  **Post-Mortem & Fix Analysis**:
  > This also causes problems with text following the image. Given this input:  ```markdown # Example w/ OpenTofu logo  ![](example.png)  <!-- alignment: center --> This is a test. ```  We get this:  <img width="1253" height="727" alt="Image" src="https://github.com/user-attachments/assets/308f3ad6-0128-4173-a151-aff1f18a854c" />  While on the same terminal, outside of tmux, the text renders below the image as expected.
  > Some additional data points:  Using XTerm (when run with `-ti vt340), the image displays correctly regardless of whether we are using tmux or not.  <img width="1029" height="438" alt="Image" src="https://github.com/user-attachments/assets/6e460b45-e821-469d-b1c9-fb04f40ab94d" />  Contour shows the same image distortion as Foot.
  > I think this is a bug in tmux. Sixel images by default have an aspect ratio of 2:1 (this is for backwards compatibility with older terminals). Applications that want a 1:1 aspect ratio need to request that explicitly, and they can do that in two different ways:  1. Setting the first parameter of the introducer to 9, so the start of the image sequence will look something like this: `\033P9q` (potentially with additional parameters). 2. Adding a _raster attributes_ command in the first part of the sixel data, in which case the start of the image sequence will look something like this: `\033Pq"1;1`.  I believe the icy_sixel library uses the first technique, while img2sixel uses the second one. And although tmux recognises and retransmits the raster attributes commands (the technique used by img2sixel), it drops the parameters in the introducer, so the aspect ratio set by icy_sixel is lost.  And the reason you don't see this issue in xterm is simply because it doesn't support aspect ratios

- **Issue #897** (2026-05-22): **doc: Very small typo in the install command**
  *Symptoms*: 

- **Issue #895** (2026-05-22): **feat: add exec support for ocaml**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Thanks!

- **Issue #893** (2026-05-17): **Werid/cool behaviour: Text OVER images**
  *Symptoms*: @mfontanini if you fix this bug I will cry  ```md ![image:width:100%](Resources/Meta/attachments/romeo-juliet-baz.png)  Baz Luhrmann's *"Romeo + Juliet"* (1996) is THE BEST ADAPTATION FIGHT ME  <!-- jump_to_middle --> # ROMEO & JULIET ```  Renders with kitty:  <img width="1920" height="1077" alt="Image" src="https://github.com/user-attachments/assets/ecfd7ba3-e921-427e-ad4d-666dfd0bf751" />  HOW COOL IS THIS!? IS THIS INTENTIONAL BEHAVIOUR?   brb, rewriting my entire presentation that I'm giving in 3 hours...!
  **Post-Mortem & Fix Analysis**:
  > Interestingly, text background seems to be ignored when using this trick 
  > Just woke up! Don't know what I'm seeing, what is the bug?
  > Oh what the hell? lol I see it now. Let me see

- **Issue #887** (2026-05-02): **feat: add exec support for scala 3**
  *Symptoms*: Adds support for executing Scala code snippets. Note that it works with Scala 3, not Scala 2.  I spent some time trying to add an alternative executor for Scala 2, doing a `scalac` to compile and a `scala` to execute. I could get it to work if the class in the snippet was called `Snippet`, which seems like an esoteric restriction. So I gave up on Scala 2.
  **Post-Mortem & Fix Analysis**:
  > Thanks!

- **Issue #885** (2026-04-25): **feat: allow passing in env file to snippet**
  *Symptoms*: This adds a `+env:<path>` snippet attribute that allows passing in an env file to a snippet. This can be used both for the script itself _and_ the executor. e.g. this:  ~~~markdown ```bash +exec +env:my_env echo "$FOO" ``` ~~~  With an `my_env` file in the presentation's directory with:  ``` FOO=42 ```  Will print "42". The env file can contain empty lines and lines starting with "#" which will be ignored, otherwise any other lines must have a format like `<VAR_NAME>=<VALUE>`.  Relates to #882

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

### Incident Patch 1: `d4c29336` (2026-04-24)
**Commit Message**: chore: revert assumptions about size

**File**: `src/main.rs` (modified, +1/-10)
```diff
@@ -457,16 +457,7 @@ fn run(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
                 height: dimensions.rows * DEFAULT_EXPORT_PIXELS_PER_ROW,
                 width: dimensions.columns * DEFAULT_EXPORT_PIXELS_PER_COLUMN,
             },
-            None => {
-                const DEFAULT_EXPORT_ROWS: u16 = 40;
-                const DEFAULT_EXPORT_COLUMNS: u16 = 120;
-                WindowSize {
-                    rows: DEFAULT_EXPORT_ROWS,
-                    columns: DEFAULT_EXPORT_COLUMNS,
-                    height: DEFAULT_EXPORT_ROWS * DEFAULT_EXPORT_PIXELS_PER_ROW,
-                    width: DEFAULT_EXPORT_COLUMNS * DEFAULT_EXPORT_PIXELS_PER_COLUMN,
-                }
-            }
+            None => WindowSize::current(config.defaults.terminal_font_size)?,
         };
         let exporter = Exporter::new(
             parser,
```

---

### Incident Patch 2: `29092d39` (2026-04-18)
**Commit Message**: fix: allow selective highlighting on exports if groups == 1 (#880)

This allows selective highlighting to work on exports as long as there's
a single group. e.g. using `{3}` works, but not if using `{3|5}`. This
should have been the intended behavior so I'm considering this a fix.

Fixes #874

**File**: `src/presentation/builder/snippet.rs` (modified, +4/-3)
```diff
@@ -272,9 +272,10 @@ impl PresentationBuilder<'_, '_> {
             let mut highlighter = self.highlighter.language_highlighter(&SnippetLanguage::Rust);
             highlighter.style_line("//", &style).0.first().expect("no styles").style.size(font_size)
         };
-        let groups = match self.options.allow_mutations {
-            true => code.attributes.highlight_groups.clone(),
-            false => vec![HighlightGroup::new(vec![Highlight::All])],
+        let groups = if self.options.allow_mutations || code.attributes.highlight_groups.len() == 1 {
+            code.attributes.highlight_groups.clone()
+        } else {
+            vec![HighlightGroup::new(vec![Highlight::All])]
         };
         let context =
             Rc::new(RefCell::new(HighlightContext { groups, current: 0, block_length, alignment: style.alignment }));
```

---

### Incident Patch 3: `72be4194` (2026-04-18)
**Commit Message**: fix: allow selective highlighting on exports if groups == 1

**File**: `src/presentation/builder/snippet.rs` (modified, +4/-3)
```diff
@@ -272,9 +272,10 @@ impl PresentationBuilder<'_, '_> {
             let mut highlighter = self.highlighter.language_highlighter(&SnippetLanguage::Rust);
             highlighter.style_line("//", &style).0.first().expect("no styles").style.size(font_size)
         };
-        let groups = match self.options.allow_mutations {
-            true => code.attributes.highlight_groups.clone(),
-            false => vec![HighlightGroup::new(vec![Highlight::All])],
+        let groups = if self.options.allow_mutations || code.attributes.highlight_groups.len() == 1 {
+            code.attributes.highlight_groups.clone()
+        } else {
+            vec![HighlightGroup::new(vec![Highlight::All])]
         };
         let context =
             Rc::new(RefCell::new(HighlightContext { groups, current: 0, block_length, alignment: style.alignment }));
```

---

### Incident Patch 4: `3334f3f6` (2026-04-18)
**Commit Message**: fix: fail export gracefully if async tasks fail (#877)

**File**: `src/export/exporter.rs` (modified, +23/-6)
```diff
@@ -137,8 +137,8 @@ impl<'a> Exporter<'a> {
         let mut render = ExportRenderer::new(self.dimensions, output_directory, renderer);
         Self::log("waiting for images to be generated and code to be executed, if any...")?;
         match self.snippet_policy {
-            SnippetsExportPolicy::Parallel => Self::wait_async_renders_parallel(&mut presentation),
-            SnippetsExportPolicy::Sequential => Self::wait_async_renders_sequential(&mut presentation),
+            SnippetsExportPolicy::Parallel => Self::wait_async_renders_parallel(&mut presentation)?,
+            SnippetsExportPolicy::Sequential => Self::wait_async_renders_sequential(&mut presentation)?,
         };
 
         for (index, slide) in presentation.into_slides().into_iter().enumerate() {
@@ -216,7 +216,7 @@ impl<'a> Exporter<'a> {
         Ok(())
     }
 
-    fn wait_async_renders_parallel(presentation: &mut Presentation) {
+    fn wait_async_renders_parallel(presentation: &mut Presentation) -> Result<(), ExportError> {
         let poller = Poller::launch();
         let mut pollables = Vec::new();
         for (index, slide) in presentation.iter_slides().enumerate() {
@@ -231,7 +231,13 @@ impl<'a> Exporter<'a> {
 
         // Poll until they're all done
         for mut pollable in pollables {
-            while let PollableState::Unmodified | PollableState::Modified = pollable.poll() {}
+            loop {
+                match pollable.poll() {
+                    PollableState::Unmodified | PollableState::Modified => continue,
+                    PollableState::Done => break,
+                    PollableState::Failed { error } => return Err(ExportError::RenderAsync(error)),
+                }
+            }
         }
 
         // Replace render asyncs with new operations that contains the replaced image
@@ -245,9 +251,10 @@ impl<'a> Exporter<'a> {
                 }
             }
         }
+        Ok(())
     }
 
-    fn wait_async_renders_sequential(presentation: &mut Presentation) {
+    fn wait_async_renders_sequential(presentation: &mut Presentation) -> Result<(), ExportError> {
         let poller = Poller::launch();
         for (index, slide) in presentation.iter_slides_mut().enumerate() {
             for op in slide.iter_operations_mut() {
@@ -257,7 +264,13 @@ impl<'a> Exporter<'a> {
 
                     // Poll until it's done
                     let mut pollable = inner.pollable();
-                    while let PollableState::Unmodified | PollableState::Modified = pollable.poll() {}
+                    loop {
+                        match pollable.poll() {
+                            PollableState::Unmodified | PollableState::Modified => continue,
+                            PollableState::Done => break,
+                            PollableState::Failed { error } => return Err(ExportError::RenderAsync(error)),
+                        }
+                    }
 
                     // Replace it with its contents
                     let window_size = WindowSize { rows: 0, columns: 0, width: 0, height: 0 };
@@ -266,6 +279,7 @@ impl<'a> Exporter<'a> {
                 }
             }
         }
+        Ok(())
     }
 
     fn validate_weasyprint_exists() -> Result<(), ExportError> {
@@ -323,6 +337,9 @@ pub enum ExportError {
     #[error(transparent)]
     Execution(#[from] ExecutionError),
 
+    #[error("async render failed: {0}")]
+    RenderAsync(String),
+
     #[error("weasyprint not found")]
     WeasyprintMissing,
 
```

---

### Incident Patch 5: `1f4226c4` (2026-04-18)
**Commit Message**: fix: don't blow up if exec is disabled and `snippet_output` is used (#879)

Fixes #870

**File**: `src/presentation/builder/comment.rs` (modified, +7/-4)
```diff
@@ -121,10 +121,13 @@ impl PresentationBuilder<'_, '_> {
                 return Ok(());
             }
             CommentCommand::SnippetOutput(id) => {
-                let handle = self.executable_snippets.get(&id).cloned().ok_or_else(|| {
-                    self.invalid_presentation(source_position, InvalidPresentation::UndefinedSnippetId(id))
-                })?;
-                self.push_detached_code_execution(handle)?;
+                // Ignore this if execution is disabled
+                if self.options.enable_snippet_execution {
+                    let handle = self.executable_snippets.get(&id).cloned().ok_or_else(|| {
+                        self.invalid_presentation(source_position, InvalidPresentation::UndefinedSnippetId(id))
+                    })?;
+                    self.push_detached_code_execution(handle)?;
+                }
                 return Ok(());
             }
         };
```

---

### Incident Patch 6: `f034560a` (2026-04-18)
**Commit Message**: fix: don't blow up if exec is disabled and `snippet_output` is used

**File**: `src/presentation/builder/comment.rs` (modified, +7/-4)
```diff
@@ -121,10 +121,13 @@ impl PresentationBuilder<'_, '_> {
                 return Ok(());
             }
             CommentCommand::SnippetOutput(id) => {
-                let handle = self.executable_snippets.get(&id).cloned().ok_or_else(|| {
-                    self.invalid_presentation(source_position, InvalidPresentation::UndefinedSnippetId(id))
-                })?;
-                self.push_detached_code_execution(handle)?;
+                // Ignore this if execution is disabled
+                if self.options.enable_snippet_execution {
+                    let handle = self.executable_snippets.get(&id).cloned().ok_or_else(|| {
+                        self.invalid_presentation(source_position, InvalidPresentation::UndefinedSnippetId(id))
+                    })?;
+                    self.push_detached_code_execution(handle)?;
+                }
                 return Ok(());
             }
         };
```

---

### Incident Patch 7: `ed98477a` (2026-04-15)
**Commit Message**: fix: fail gracefully if async tasks fail

**File**: `src/export/exporter.rs` (modified, +23/-6)
```diff
@@ -137,8 +137,8 @@ impl<'a> Exporter<'a> {
         let mut render = ExportRenderer::new(self.dimensions, output_directory, renderer);
         Self::log("waiting for images to be generated and code to be executed, if any...")?;
         match self.snippet_policy {
-            SnippetsExportPolicy::Parallel => Self::wait_async_renders_parallel(&mut presentation),
-            SnippetsExportPolicy::Sequential => Self::wait_async_renders_sequential(&mut presentation),
+            SnippetsExportPolicy::Parallel => Self::wait_async_renders_parallel(&mut presentation)?,
+            SnippetsExportPolicy::Sequential => Self::wait_async_renders_sequential(&mut presentation)?,
         };
 
         for (index, slide) in presentation.into_slides().into_iter().enumerate() {
@@ -216,7 +216,7 @@ impl<'a> Exporter<'a> {
         Ok(())
     }
 
-    fn wait_async_renders_parallel(presentation: &mut Presentation) {
+    fn wait_async_renders_parallel(presentation: &mut Presentation) -> Result<(), ExportError> {
         let poller = Poller::launch();
         let mut pollables = Vec::new();
         for (index, slide) in presentation.iter_slides().enumerate() {
@@ -231,7 +231,13 @@ impl<'a> Exporter<'a> {
 
         // Poll until they're all done
         for mut pollable in pollables {
-            while let PollableState::Unmodified | PollableState::Modified = pollable.poll() {}
+            loop {
+                match pollable.poll() {
+                    PollableState::Unmodified | PollableState::Modified => continue,
+                    PollableState::Done => break,
+                    PollableState::Failed { error } => return Err(ExportError::RenderAsync(error)),
+                }
+            }
         }
 
         // Replace render asyncs with new operations that contains the replaced image
@@ -245,9 +251,10 @@ impl<'a> Exporter<'a> {
                 }
             }
         }
+        Ok(())
     }
 
-    fn wait_async_renders_sequential(presentation: &mut Presentation) {
+    fn wait_async_renders_sequential(presentation: &mut Presentation) -> Result<(), ExportError> {
         let poller = Poller::launch();
         for (index, slide) in presentation.iter_slides_mut().enumerate() {
             for op in slide.iter_operations_mut() {
@@ -257,7 +264,13 @@ impl<'a> Exporter<'a> {
 
                     // Poll until it's done
                     let mut pollable = inner.pollable();
-                    while let PollableState::Unmodified | PollableState::Modified = pollable.poll() {}
+                    loop {
+                        match pollable.poll() {
+                            PollableState::Unmodified | PollableState::Modified => continue,
+                            PollableState::Done => break,
+                            PollableState::Failed { error } => return Err(ExportError::RenderAsync(error)),
+                        }
+                    }
 
                     // Replace it with its contents
                     let window_size = WindowSize { rows: 0, columns: 0, width: 0, height: 0 };
@@ -266,6 +279,7 @@ impl<'a> Exporter<'a> {
                 }
             }
         }
+        Ok(())
     }
 
     fn validate_weasyprint_exists() -> Result<(), ExportError> {
@@ -323,6 +337,9 @@ pub enum ExportError {
     #[error(transparent)]
     Execution(#[from] ExecutionError),
 
+    #[error("async render failed: {0}")]
+    RenderAsync(String),
+
     #[error("weasyprint not found")]
     WeasyprintMissing,
 
```

---

### Incident Patch 8: `b2a2306b` (2026-03-17)
**Commit Message**: feat: update URL hash to retain slide position in HTML export, fixes #867

**File**: `src/export/script.js` (modified, +13/-2)
```diff
@@ -1,18 +1,29 @@
 document.addEventListener('DOMContentLoaded', function() {
   const allLines = document.querySelectorAll('body > div');
   const pageBreakMarkers = document.querySelectorAll('.container');
-  let currentPageIndex = 0;
 
+  function getCurrentPageIndex() {
+    const hash = window.location.hash;
+    const match = hash.match(/^#slide-(\d+)$/);
+    if (match) {
+      const idx = parseInt(match[1], 10);
+      const max = pageBreakMarkers.length;
+      if (idx >= 0 && idx < max) return idx;
+    }
+    return 0;
+  }
+
+  let currentPageIndex = getCurrentPageIndex();
 
   function showCurrentPage() {
     allLines.forEach((line) => {
       line.classList.add('hidden');
     });
 
     allLines[currentPageIndex].classList.remove('hidden');
+    history.replaceState(null, '', '#slide-' + currentPageIndex);
   }
 
-
   function scaler() {
     var w = document.documentElement.clientWidth;
     var h = document.documentElement.clientHeight;
```

---

### Incident Patch 9: `244210bf` (2026-02-28)
**Commit Message**: fix: add newlines in included files (#856)

Fixes #853

**File**: `src/presentation/builder/comment.rs` (modified, +13/-2)
```diff
@@ -61,7 +61,7 @@ impl PresentationBuilder<'_, '_> {
             }
             CommentCommand::ResetLayout => {
                 self.slide_state.layout = LayoutState::Default;
-                self.chunk_operations.extend([RenderOperation::ExitLayout, RenderOperation::RenderLineBreak]);
+                self.chunk_operations.push(RenderOperation::ExitLayout);
             }
             CommentCommand::Column(column) => {
                 let (current_column, columns_count) = match self.slide_state.layout {
@@ -179,8 +179,13 @@ impl PresentationBuilder<'_, '_> {
             if let MarkdownElement::FrontMatter(_) = element {
                 return Err(self.invalid_presentation(source_position, InvalidPresentation::IncludeFrontMatter));
             }
+            self.slide_state.ignore_element_line_break = false;
             self.process_element_for_presentation_mode(element)?;
+            if !self.slide_state.ignore_element_line_break {
+                self.push_line_break();
+            }
         }
+        self.slide_state.ignore_element_line_break = true;
         Ok(())
     }
 }
@@ -697,6 +702,8 @@ hola
 first
 ===
 
+foo
+
 ![](inner/img.png)
 
 <!-- include: inner/second.md -->
@@ -730,17 +737,21 @@ hi
 <!-- include: first.md -->
         ";
 
-        let lines = Test::new(input).resources_path(path).render().rows(10).columns(12).into_lines();
+        let lines = Test::new(input).resources_path(path).render().rows(14).columns(12).into_lines();
         let expected = &[
             "            ",
             "hi          ",
             "            ",
             "first       ",
             "            ",
+            "foo         ",
+            "            ",
+            "            ",
             "            ",
             "second      ",
             "            ",
             "            ",
+            "            ",
             "a           ",
         ];
         assert_eq!(lines, expected);
```

---

### Incident Patch 10: `df2cc369` (2026-02-28)
**Commit Message**: fix: add newlines in included files

**File**: `src/presentation/builder/comment.rs` (modified, +13/-2)
```diff
@@ -61,7 +61,7 @@ impl PresentationBuilder<'_, '_> {
             }
             CommentCommand::ResetLayout => {
                 self.slide_state.layout = LayoutState::Default;
-                self.chunk_operations.extend([RenderOperation::ExitLayout, RenderOperation::RenderLineBreak]);
+                self.chunk_operations.push(RenderOperation::ExitLayout);
             }
             CommentCommand::Column(column) => {
                 let (current_column, columns_count) = match self.slide_state.layout {
@@ -179,8 +179,13 @@ impl PresentationBuilder<'_, '_> {
             if let MarkdownElement::FrontMatter(_) = element {
                 return Err(self.invalid_presentation(source_position, InvalidPresentation::IncludeFrontMatter));
             }
+            self.slide_state.ignore_element_line_break = false;
             self.process_element_for_presentation_mode(element)?;
+            if !self.slide_state.ignore_element_line_break {
+                self.push_line_break();
+            }
         }
+        self.slide_state.ignore_element_line_break = true;
         Ok(())
     }
 }
@@ -697,6 +702,8 @@ hola
 first
 ===
 
+foo
+
 ![](inner/img.png)
 
 <!-- include: inner/second.md -->
@@ -730,17 +737,21 @@ hi
 <!-- include: first.md -->
         ";
 
-        let lines = Test::new(input).resources_path(path).render().rows(10).columns(12).into_lines();
+        let lines = Test::new(input).resources_path(path).render().rows(14).columns(12).into_lines();
         let expected = &[
             "            ",
             "hi          ",
             "            ",
             "first       ",
             "            ",
+            "foo         ",
+            "            ",
+            "            ",
             "            ",
             "second      ",
             "            ",
             "            ",
+            "            ",
             "a           ",
         ];
         assert_eq!(lines, expected);
```

#### Recent Merged Pull Requests:
- **PR #913** (closed): feat: load local syntaxes from bat's config directory (@gregerolsson)
- **PR #911** (closed): Migrate PTY terminal backend from vt100 to rio-vt (@raphamorim)
- **PR #897** (closed): doc: Very small typo in the install command (@arthuRHD)
- **PR #895** (2026-05-22): feat: add exec support for ocaml (@kevinschweikert)
- **PR #887** (2026-05-02): feat: add exec support for scala 3 (@hoop33)
- **PR #885** (2026-04-25): feat: allow passing in env file to snippet (@mfontanini)
- **PR #881** (2026-04-18): feat: respect markdown table alignments (@mfontanini)
- **PR #880** (2026-04-18): fix: allow selective highlighting on exports if groups == 1 (@mfontanini)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
