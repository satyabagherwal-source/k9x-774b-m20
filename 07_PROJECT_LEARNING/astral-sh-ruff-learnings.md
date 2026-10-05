# Forensic Learning Record (Deep Inspection): astral-sh/ruff

> **Canonical Artifact**: `07_PROJECT_LEARNING/astral-sh-ruff-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/astral-sh/ruff](https://github.com/astral-sh/ruff))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:46:38.747Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `astral-sh/ruff`
- **Description**: An extremely fast Python linter and code formatter, written in Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 49915 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/ruff_annotate_snippets/src/renderer/margin.rs`
```
use core::cmp::{max, min};

const ELLIPSIS_PASSING: usize = 6;
const LONG_WHITESPACE: usize = 20;
const LONG_WHITESPACE_PADDING: usize = 4;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Margin {
    /// The available whitespace in the left that can be consumed when centering.
    whitespace_left: usize,
    /// The column of the beginning of left-most span.
    span_left: usize,
    /// The column of the end of right-most span.
    span_right: usize,
    /// The beginning of the line to be displayed.
    computed_left: usize,
    /// The end of the line to be displayed.
    computed_right: usize,
    /// The current width of the terminal. 140 by default and in tests.
    pub(crate) term_width: usize,
    /// The end column of a span label, including the span. Doesn't account for labels not in the
    /// same line as the span.
    label_right: usize,
}

impl Margin {
    pub(crate) fn new(
        whitespace_left: usize,
        span_left: usize,
        span_right: usize,
        label_right: usize,
        term_width: usize,
        max_line_len: usize,
    ) -> Self {
        // The 6 is padding to give a bit of room for `...` when displaying:
        // ```
        // error: message
        //   --> file.rs:16:58
        //    |
        // 16 | ... fn foo(self) -> Self::Bar {
        //    |                     ^^^^^^^^^
        // ```

        let mut m = Margin {
            whitespace_left: whitespace_left.saturating_sub(ELLIPSIS_PASSING),
            span_left: span_left.saturating_sub(ELLIPSIS_PASSING),
            span_right: span_right + ELLIPSIS_PASSING,
            computed_left: 0,
            computed_right: 0,
            term_width,
            label_right: label_right + ELLIPSIS_PASSING,
        };
        m.compute(max_line_len);
        m
    }

    pub(crate) fn was_cut_left(&self) -> bool {
        self.computed_left > 0
    }

    fn compute(&mut self, max_line_len: usize) {
        // When there's a lot of whitespace (>20), we want to trim it as it is useless.
        self.computed_left = if self.whitespace_left > LONG_WHITESPACE {
            self.whitespace_left - (LONG_WHITESPACE - LONG_WHITESPACE_PADDING) // We want some padding.
        } else {
            0
        };
        // We want to show as much as possible, max_line_len is the right-most boundary for the
        // relevant code.
        self.computed_right = max(max_line_len, self.computed_left);

        if self.computed_right - self.computed_left > self.term_width {
            // Trimming only whitespace isn't enough, let's get craftier.
            if self.label_right.saturating_sub(self.whitespace_left) <= self.term_width
                // Trimming whitespace when the right-most label is somewhrere
                // within it would result in the label pointing to the wrong
                // place
                && self.label_right >= self.whitespace_left
            {
                // Attempt to fit the code window only trimming whitespace.
                self.computed_left = self.whitespace_left;
                self.computed_right = self.computed_left + self.term_width;
            } else if self.label_right - self.span_left <= self.term_width {
                // Attempt to fit the code window considering only the spans and labels.
                let padding_left = (self.term_width - (self.label_right - self.span_left)) / 2;
                self.computed_left = self.span_left.saturating_sub(padding_left);
                self.computed_right = self.computed_left + self.term_width;
            } else if self.span_right - self.span_left <= self.term_width {
                // Attempt to fit the code window considering the spans and labels plus padding.
                let padding_left = (self.term_width - (self.span_right - self.span_left)) / 5 * 2;
                self.computed_left = self.span_left.saturating_sub(padding_left);
                self.computed_right = self.computed_left + self.term_width;
            } else {
                // Mostly give up but still don't show the full line.
                self.computed_left = self.span_left;
                self.computed_right = self.span_right;
            }
        }
    }

    pub(crate) fn left(&self, line_len: usize) -> usize {
        min(self.computed_left, line_len)
    }

    pub(crate) fn right(&self, line_len: usize) -> usize {
        if line_len.saturating_sub(self.computed_left) <= self.term_width {
            line_len
        } else {
            min(line_len, self.computed_right)
        }
    }
}

```

### Core Architecture Module: `crates/ruff_annotate_snippets/src/renderer/mod.rs`
```
//! The [Renderer] and its settings
//!
//! # Example
//!
//! ```
//! # use annotate_snippets::*;
//! # use annotate_snippets::renderer::*;
//! # use annotate_snippets::Level;
//! let report = // ...
//! # &[Group::with_title(
//! #     Level::ERROR
//! #         .primary_title("unresolved import `baz::zed`")
//! #         .id("E0432")
//! # )];
//!
//! let renderer = Renderer::styled().decor_style(DecorStyle::Unicode);
//! let output = renderer.render(report);
//! anstream::println!("{output}");
//! ```

pub(crate) mod render;
pub(crate) mod source_map;
pub(crate) mod stylesheet;

mod margin;
mod styled_buffer;

use alloc::string::String;

use crate::Report;

pub(crate) use render::ElementStyle;
pub(crate) use render::UnderlineParts;
pub(crate) use render::normalize_whitespace;
pub(crate) use render::{LineAnnotation, LineAnnotationType, char_width, num_overlap};
pub(crate) use stylesheet::Stylesheet;

pub use anstyle::*;

/// See [`Renderer::term_width`]
pub const DEFAULT_TERM_WIDTH: usize = 140;

const USE_WINDOWS_COLORS: bool = cfg!(windows) && !cfg!(feature = "testing-colors");
const BRIGHT_BLUE: Style = if USE_WINDOWS_COLORS {
    AnsiColor::BrightCyan.on_default()
} else {
    AnsiColor::BrightBlue.on_default()
};
/// [`Renderer::error`] applied by [`Renderer::styled`]
pub const DEFAULT_ERROR_STYLE: Style = AnsiColor::BrightRed.on_default().effects(Effects::BOLD);
/// [`Renderer::warning`] applied by [`Renderer::styled`]
pub const DEFAULT_WARNING_STYLE: Style = if USE_WINDOWS_COLORS {
    AnsiColor::BrightYellow.on_default()
} else {
    AnsiColor::Yellow.on_default()
}
.effects(Effects::BOLD);
/// [`Renderer::info`] applied by [`Renderer::styled`]
pub const DEFAULT_INFO_STYLE: Style = BRIGHT_BLUE.effects(Effects::BOLD);
/// [`Renderer::note`] applied by [`Renderer::styled`]
pub const DEFAULT_NOTE_STYLE: Style = AnsiColor::BrightGreen.on_default().effects(Effects::BOLD);
/// [`Renderer::help`] applied by [`Renderer::styled`]
pub const DEFAULT_HELP_STYLE: Style = AnsiColor::BrightCyan.on_default().effects(Effects::BOLD);
/// [`Renderer::line_num`] applied by [`Renderer::styled`]
pub const DEFAULT_LINE_NUM_STYLE: Style = BRIGHT_BLUE.effects(Effects::BOLD);
/// [`Renderer::emphasis`] applied by [`Renderer::styled`]
pub const DEFAULT_EMPHASIS_STYLE: Style = if USE_WINDOWS_COLORS {
    AnsiColor::BrightWhite.on_default()
} else {
    Style::new()
}
.effects(Effects::BOLD);
/// [`Renderer::none`] applied by [`Renderer::styled`]
pub const DEFAULT_NONE_STYLE: Style = Style::new();
/// [`Renderer::context`] applied by [`Renderer::styled`]
pub const DEFAULT_CONTEXT_STYLE: Style = BRIGHT_BLUE.effects(Effects::BOLD);
/// [`Renderer::addition`] applied by [`Renderer::styled`]
pub const DEFAULT_ADDITION_STYLE: Style = AnsiColor::BrightGreen.on_default();
/// [`Renderer::removal`] applied by [`Renderer::styled`]
pub const DEFAULT_REMOVAL_STYLE: Style = AnsiColor::BrightRed.on_default();

/// The [Renderer] for a [`Report`]
///
/// The caller is expected to detect any relevant terminal features and configure the renderer,
/// including
/// - ANSI Escape code support (always outputted with [`Renderer::styled`])
/// - Terminal width ([`Renderer::term_width`])
/// - Unicode support ([`Renderer::decor_style`])
///
/// # Example
///
/// ```
/// # use annotate_snippets::*;
/// # use annotate_snippets::renderer::*;
/// # use annotate_snippets::Level;
/// let report = // ...
/// # &[Group::with_title(
/// #     Level::ERROR
/// #         .primary_title("unresolved import `baz::zed`")
/// #         .id("E0432")
/// # )];
///
/// let renderer = Renderer::styled();
/// let output = renderer.render(report);
/// anstream::println!("{output}");
/// ```
#[derive(Clone, Debug)]
pub struct Renderer {
    anonymized_line_numbers: bool,
    term_width: usize,
    decor_style: DecorStyle,
    stylesheet: Stylesheet,
    hyperlink: bool,
    short_message: bool,
    cut_indicator: Option<&'static str>,
}

impl Renderer {
    /// No terminal styling
    pub const fn plain() -> Self {
        Self {
            anonymized_line_numbers: false,
            term_width: DEFAULT_TERM_WIDTH,
            decor_style: DecorStyle::Ascii,
            stylesheet: Stylesheet::plain(),
            hyperlink: false,
            short_message: false,
            cut_indicator: None,
        }
    }

    /// Default terminal styling
    ///
    /// If ANSI escape codes are not supported, either
    /// - Call [`Renderer::plain`] instead
    /// - Strip them after the fact, like with [`anstream`](https://docs.rs/anstream/latest/anstream/)
    ///
    /// # Note
    ///
    /// When testing styled terminal output, see the [`testing-colors` feature](crate#features)
    pub const fn styled() -> Self {
        Self {
            stylesheet: Stylesheet {
                error: DEFAULT_ERROR_STYLE,
                warning: DEFAULT_WARNING_STYLE,
                info: DEFAULT_INFO_STYLE,
                note: DEFAULT_NOTE_STYLE,
                help: DEFAULT_HELP_STYLE,
                line_num: DEFAULT_LINE_NUM_STYLE,
                emphasis: DEFAULT_EMPHASIS_STYLE,
                none: DEFAULT_NONE_STYLE,
                context: DEFAULT_CONTEXT_STYLE,
                addition: DEFAULT_ADDITION_STYLE,
                removal: DEFAULT_REMOVAL_STYLE,
            },
            hyperlink: true,
            ..Self::plain()
        }
    }

    /// Abbreviate the message
    pub const fn short_message(mut self, short_message: bool) -> Self {
        self.short_message = short_message;
        self
    }

    /// Set the width to render within
    ///
    /// Affects the rendering of [`Snippet`][crate::Snippet]s
    pub const fn term_width(mut self, term_width: usize) -> Self {
        self.term_width = term_width;
        self
    }

    /// Set the character set used for rendering decor
    pub const fn decor_style(mut self, decor_style: DecorStyle) -> Self {
        self.decor_style = decor_style;
        self
    }

    /// Anonymize line numbers
    ///
    /// When enabled, line numbers are replaced with `LL` which is useful for tests.
    ///
    /// # Example
    ///
    /// ```text
    ///   --> $DIR/whitespace-trimming.rs:4:193
    ///    |
    /// LL | ...                   let _: () = 42;
    ///    |                                   ^^ expected (), found integer
    ///    |
    /// ```
    pub const fn anonymized_line_numbers(mut self, anonymized_line_numbers: bool) -> Self {
        self.anonymized_line_numbers = anonymized_line_numbers;
        self
    }
}

impl Renderer {
    /// Render a diagnostic [`Report`]
    pub fn render(&self, groups: Report<'_>) -> String {
        render::render(self, groups)
    }
}

/// Customize [`Renderer::styled`]
impl Renderer {
    /// Override the output style for [error][crate::Level::ERROR]
    pub const fn error(mut self, style: Style) -> Self {
        self.stylesheet.error = style;
        self
    }

    /// Override the output style for [warnings][crate::Level::WARNING]
    pub const fn warning(mut self, style: Style) -> Self {
        self.stylesheet.warning = style;
        self
    }

    /// Override the output style for [info][crate::Level::INFO]
    pub const fn info(mut self, style: Style) -> Self {
        self.stylesheet.info = style;
        self
    }

    /// Override the output style for [notes][crate::Level::NOTE]
    pub const fn note(mut self, style: Style) -> Self {
        self.stylesheet.note = style;
        self
    }

    /// Override the output style for [help][crate::Level::HELP]
    pub const fn help(mut self, style: Style) -> Self {
        self.stylesheet.help = style;
        self
    }

    /// Override the output style for line numbers in the [`Snippet`][crate::Snippet] gutter
    pub const fn line_num(mut self, style: Style) -> Self {
        self.stylesheet.line_num = style;
        self
    }

    /// Override the output style for emphasis for the
    /// [`primary_title`][crate::Level::primary_title]
    pub const fn emphasis(mut self, style: Style) -> Self {
        self.stylesheet.emphasis = style;
        self
    }

    /// Override the output style for [`AnnotationKind::Context`][crate::AnnotationKind::Context]
    pub const fn context(mut self, style: Style) -> Self {
        self.stylesheet.context = style;
        self
    }

    /// Override the output style for [`Patch`][crate::Patch] additions
    pub const fn addition(mut self, style: Style) -> Self {
        self.stylesheet.addition = style;
        self
    }

    /// Override the output style for [`Patch`][crate::Patch] removals
    pub const fn removal(mut self, style: Style) -> Self {
        self.stylesheet.removal = style;
        self
    }

    /// Override the output style for all other text
    pub const fn none(mut self, style: Style) -> Self {
        self.stylesheet.none = style;
        self
    }

    pub const fn hyperlink(mut self, hyperlink: bool) -> Self {
        self.hyperlink = hyperlink;
        self
    }

    /// Set the string used for when a long line is cut.
    ///
    /// The default for [`DecorStyle::Ascii`] is `...` (three `U+002E` characters).
    pub const fn cut_indicator(mut self, cut: &'static str) -> Self {
        self.cut_indicator = Some(cut);
        self
    }
}

/// The character set for rendering for decor
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecorStyle {
    Ascii,
    Unicode,
}

impl DecorStyle {
    fn col_separator(&self) -> char {
        match self {
            DecorStyle::Ascii => '|',
            DecorStyle::Unicode => '│',
        }
    }

    fn note_separator(&self, is_cont: bool) -> &str {
        match self {
            DecorStyle::Ascii => "= ",
            DecorStyle::Unicode if is_cont => "├ ",
            DecorStyle::Unicode => "╰ ",
        }
    }

    fn multi_suggestion_separator(&self) -> &'static str {
        match self {
            DecorStyle::Ascii => "|",
            DecorStyle::Unicode => "├╴",
        }
    }

    fn 
```

### Core Architecture Module: `crates/ruff_annotate_snippets/src/renderer/render.rs`
```
// Most of this file is adapted from https://github.com/rust-lang/rust/blob/160905b6253f42967ed4aef4b98002944c7df24c/compiler/rustc_errors/src/emitter.rs

use alloc::borrow::Cow;
use alloc::collections::BTreeMap;
use alloc::string::{String, ToString};
use alloc::{format, vec, vec::Vec};
use core::cmp::{Ordering, Reverse, max, min};
use core::fmt;

use anstyle::Style;

use super::DecorStyle;
use super::Renderer;
use super::margin::Margin;
use super::stylesheet::Stylesheet;
use crate::level::{Level, LevelInner};
use crate::renderer::source_map::{
    AnnotatedLineInfo, LineInfo, Loc, SourceMap, SplicedLines, SubstitutionHighlight, TrimmedPatch,
};
use crate::renderer::styled_buffer::StyledBuffer;
use crate::snippet::Id;
use crate::{
    Annotation, AnnotationKind, Element, Group, Message, Origin, Padding, Patch, Report, Snippet,
    Title,
};

const ANONYMIZED_LINE_NUM: &str = "LL";

pub(crate) fn render(renderer: &Renderer, groups: Report<'_>) -> String {
    if renderer.short_message {
        render_short_message(renderer, groups).unwrap()
    } else {
        let lineno_offset = groups.iter().map(|g| g.lineno_offset).max().unwrap_or(0);
        let (max_line_num, og_primary_path, groups) = pre_process(groups);
        let max_line_num_len = lineno_offset
            + if renderer.anonymized_line_numbers {
                ANONYMIZED_LINE_NUM.len()
            } else {
                num_decimal_digits(max_line_num)
            };
        let mut out_string = String::new();
        let group_len = groups.len();
        for (
            g,
            PreProcessedGroup {
                group,
                elements,
                primary_path,
                max_depth,
            },
        ) in groups.into_iter().enumerate()
        {
            let mut buffer = StyledBuffer::new();
            let level = group.primary_level.clone();
            let mut message_iter = elements.into_iter().enumerate().peekable();
            if let Some(title) = &group.title {
                let peek = message_iter.peek().map(|(_, s)| s);
                let title_style = if title.allows_styling {
                    TitleStyle::Header
                } else {
                    TitleStyle::MainHeader
                };
                let buffer_msg_line_offset = buffer.num_lines();
                render_title(
                    renderer,
                    &mut buffer,
                    title,
                    max_line_num_len,
                    title_style,
                    matches!(peek, Some(PreProcessedElement::Message(_))),
                    buffer_msg_line_offset,
                );
                let buffer_msg_line_offset = buffer.num_lines();

                if matches!(peek, Some(PreProcessedElement::Message(_))) {
                    draw_col_separator_no_space(
                        renderer,
                        &mut buffer,
                        buffer_msg_line_offset,
                        max_line_num_len + 1,
                    );
                }
                if peek.is_none()
                    && title_style == TitleStyle::MainHeader
                    && g == 0
                    && group_len > 1
                {
                    draw_col_separator_end(
                        renderer,
                        &mut buffer,
                        buffer_msg_line_offset,
                        max_line_num_len + 1,
                    );
                }
            }
            let mut seen_primary = false;
            let mut last_suggestion_path = None;
            while let Some((i, section)) = message_iter.next() {
                let peek = message_iter.peek().map(|(_, s)| s);
                let is_first = i == 0;
                match section {
                    PreProcessedElement::Message(title) => {
                        let title_style = TitleStyle::Secondary;
                        let buffer_msg_line_offset = buffer.num_lines();
                        render_title(
                            renderer,
                            &mut buffer,
                            title,
                            max_line_num_len,
                            title_style,
                            peek.is_some(),
                            buffer_msg_line_offset,
                        );
                    }
                    PreProcessedElement::Cause((cause, source_map, annotated_lines)) => {
                        let is_primary = primary_path == cause.path.as_ref() && !seen_primary;
                        seen_primary |= is_primary;
                        render_snippet_annotations(
                            renderer,
                            &mut buffer,
                            max_line_num_len,
                            cause,
                            is_primary,
                            &source_map,
                            &annotated_lines,
                            max_depth,
                            peek.is_some() || (g == 0 && group_len > 1),
                            is_first,
                        );

                        if g == 0 {
                            let current_line = buffer.num_lines();
                            match peek {
                                Some(PreProcessedElement::Message(_)) => {
                                    draw_col_separator_no_space(
                                        renderer,
                                        &mut buffer,
                                        current_line,
                                        max_line_num_len + 1,
                                    );
                                }
                                None if group_len > 1 => draw_col_separator_end(
                                    renderer,
                                    &mut buffer,
                                    current_line,
                                    max_line_num_len + 1,
                                ),
                                _ => {}
                            }
                        }
                    }
                    PreProcessedElement::Suggestion((
                        suggestion,
                        source_map,
                        spliced_lines,
                        display_suggestion,
                    )) => {
                        let matches_previous_suggestion = last_suggestion_path
                            == Some((Some(suggestion.path.as_ref()), suggestion.cell_index));
                        emit_suggestion_default(
                            renderer,
                            &mut buffer,
                            suggestion,
                            spliced_lines,
                            display_suggestion,
                            max_line_num_len,
                            &source_map,
                            primary_path.or(og_primary_path),
                            matches_previous_suggestion,
                            is_first,
                            //matches!(peek, Some(Element::Message(_) | Element::Padding(_))),
                            peek.is_some(),
                        );

                        if matches!(peek, Some(PreProcessedElement::Suggestion(_))) {
                            last_suggestion_path =
                                Some((Some(suggestion.path.as_ref()), suggestion.cell_index));
                        } else {
                            last_suggestion_path = None;
                        }
                    }

                    PreProcessedElement::Origin(origin) => {
                        let buffer_msg_line_offset = buffer.num_lines();
                        let is_primary = primary_path == origin.path.as_ref() && !seen_primary;
                        seen_primary |= is_primary;
                        render_origin(
                            renderer,
                            &mut buffer,
                            max_line_num_len,
                            origin,
                            is_primary,
                            is_first,
                            peek.is_none(),
                            buffer_msg_line_offset,
                        );
                        let current_line = buffer.num_lines();
                        if g == 0 && peek.is_none() && group_len > 1 {
                            draw_col_separator_end(
                                renderer,
                                &mut buffer,
                                current_line,
                                max_line_num_len + 1,
                            );
                        }
                    }
                    PreProcessedElement::Padding(_) => {
                        let current_line = buffer.num_lines();
                        if peek.is_none() {
                            draw_col_separator_end(
                                renderer,
                                &mut buffer,
                                current_line,
                                max_line_num_len + 1,
                            );
                        } else {
                            draw_col_separator_no_space(
                                renderer,
                                &mut buffer,
                                current_line,
                                max_line_num_len + 1,
                            );
                        }
                    }
                }
            }
            buffer
                .render(&level, &renderer.stylesheet, &mut out_string)
                .unwrap();
            if g != group_len - 1 {
                out_string.push('\n');
            }
        }
        out_string
    }
}

fn render_short_message(renderer: &Renderer, groups: &[Group<'_>]) -> Result<String, fmt::Error> {
    let mut buffer = StyledBuffer::new();
    let mut labels = None;
    let group = groups.first().expect("Expected at
```

### Core Architecture Module: `crates/ruff_annotate_snippets/src/renderer/source_map.rs`
```
use alloc::borrow::Cow;
use alloc::string::String;
use alloc::{vec, vec::Vec};
use core::cmp::{max, min};
use core::ops::Range;

use crate::renderer::{LineAnnotation, LineAnnotationType, char_width, num_overlap};
use crate::{Annotation, AnnotationKind, Patch};

#[derive(Debug)]
pub(crate) struct SourceMap<'a> {
    lines: Vec<LineInfo<'a>>,
    pub(crate) source: &'a str,
}

impl<'a> SourceMap<'a> {
    pub(crate) fn new(source: &'a str, line_start: usize) -> Self {
        // Empty sources do have a "line", but it is empty, so we need to add
        // a line with an empty string to the source map.
        if source.is_empty() {
            return Self {
                lines: vec![LineInfo {
                    line: "",
                    line_index: line_start,
                    start_byte: 0,
                    end_byte: 0,
                    end_line_size: 0,
                }],
                source,
            };
        }

        let mut current_index = 0;

        let mut mapping = vec![];
        for (idx, (line, end_line)) in CursorLines::new(source).enumerate() {
            let line_length = line.len();
            let line_range = current_index..current_index + line_length;
            let end_line_size = end_line.len();

            mapping.push(LineInfo {
                line,
                line_index: line_start + idx,
                start_byte: line_range.start,
                end_byte: line_range.end + end_line_size,
                end_line_size,
            });

            current_index += line_length + end_line_size;
        }
        Self {
            lines: mapping,
            source,
        }
    }

    pub(crate) fn get_line(&self, idx: usize) -> Option<&'a str> {
        self.lines
            .iter()
            .find(|l| l.line_index == idx)
            .map(|info| info.line)
    }

    pub(crate) fn span_to_locations(&self, span: Range<usize>) -> (Loc, Loc) {
        let start_info = self
            .lines
            .iter()
            .find(|info| span.start >= info.start_byte && span.start < info.end_byte)
            .unwrap_or(self.lines.last().unwrap());
        let (mut start_char_pos, start_display_pos) = start_info.line
            [0..(span.start - start_info.start_byte).min(start_info.line.len())]
            .chars()
            .fold((0, 0), |(char_pos, byte_pos), c| {
                let display = char_width(c);
                (char_pos + 1, byte_pos + display)
            });
        // correct the char pos if we are highlighting the end of a line
        if (span.start - start_info.start_byte).saturating_sub(start_info.line.len()) > 0 {
            start_char_pos += 1;
        }
        let start = Loc {
            line: start_info.line_index,
            char: start_char_pos,
            display: start_display_pos,
            byte: span.start,
        };

        if span.start == span.end {
            return (start, start);
        }

        let (end_idx, end_info, eof) = self
            .lines
            .iter()
            .enumerate()
            .find(|(_, info)| span.end >= info.start_byte && span.end < info.end_byte)
            .map(|(idx, info)| (idx, info, false))
            .unwrap_or((self.lines.len() - 1, self.lines.last().unwrap(), true));
        let (end_char_pos, end_display_pos) = end_info.line
            [0..(span.end - end_info.start_byte).min(end_info.line.len())]
            .chars()
            .fold((0, 0), |(char_pos, byte_pos), c| {
                let display = char_width(c);
                (char_pos + 1, byte_pos + display)
            });

        let mut end = Loc {
            line: end_info.line_index,
            char: end_char_pos,
            display: end_display_pos,
            byte: span.end,
        };
        if start.line < end.line && end.char == 0 && !eof {
            let prev_line_info = &self.lines[end_idx - 1];
            let (end_char_pos, end_display_pos) = prev_line_info.line
                [0..(span.end - prev_line_info.start_byte).min(prev_line_info.line.len())]
                .chars()
                .fold((0, 0), |(char_pos, byte_pos), c| {
                    let display = char_width(c);
                    (char_pos + 1, byte_pos + display)
                });
            if prev_line_info.end_byte == start.byte {
                end = Loc {
                    line: prev_line_info.line_index,
                    char: end_char_pos + 1,
                    display: end_display_pos + 1,
                    byte: span.end,
                };
            } else {
                end = Loc {
                    line: prev_line_info.line_index,
                    char: end_char_pos,
                    display: end_display_pos,
                    byte: span.end,
                };
            }
        }
        if start.line != end.line && end.byte > end_info.end_byte - end_info.end_line_size {
            end.char += 1;
            end.display += 1;
        }

        (start, end)
    }

    pub(crate) fn span_to_snippet(&self, span: Range<usize>) -> Option<&str> {
        self.source.get(span)
    }

    pub(crate) fn span_to_lines(&self, span: Range<usize>) -> Vec<&LineInfo<'a>> {
        let mut lines = vec![];
        let start = span.start;
        let end = span.end;
        for line_info in &self.lines {
            if start >= line_info.end_byte {
                continue;
            }
            if end < line_info.start_byte {
                break;
            }
            lines.push(line_info);
        }

        if lines.is_empty() && !self.lines.is_empty() {
            lines.push(self.lines.last().unwrap());
        }

        lines
    }

    pub(crate) fn annotated_lines(
        &self,
        annotations: Vec<Annotation<'a>>,
        fold: bool,
    ) -> (usize, Vec<AnnotatedLineInfo<'a>>) {
        let source_len = self.source.len();
        if let Some(bigger) = annotations.iter().find_map(|x| {
            // Allow highlighting one past the last character in the source.
            if source_len + 1 < x.span.end {
                Some(&x.span)
            } else {
                None
            }
        }) {
            panic!("Annotation range `{bigger:?}` is beyond the end of buffer `{source_len}`")
        }

        let mut annotated_line_infos = self
            .lines
            .iter()
            .map(|info| AnnotatedLineInfo {
                line: info.line,
                line_index: info.line_index,
                annotations: vec![],
                keep: false,
            })
            .collect::<Vec<_>>();
        let mut multiline_annotations = vec![];

        for Annotation {
            span,
            label,
            kind,
            highlight_source,
            is_file_level: _,
        } in annotations
        {
            let (lo, mut hi) = self.span_to_locations(span.clone());
            if kind == AnnotationKind::Visible {
                for line_idx in lo.line..=hi.line {
                    self.keep_line(&mut annotated_line_infos, line_idx);
                }
                continue;
            }
            // Watch out for "empty spans". If we get a span like 6..6, we
            // want to just display a `^` at 6, so convert that to
            // 6..7. This is degenerate input, but it's best to degrade
            // gracefully -- and the parser likes to supply a span like
            // that for EOF, in particular.

            if lo.display == hi.display && lo.line == hi.line {
                hi.display += 1;
            }

            if lo.line == hi.line {
                let line_ann = LineAnnotation {
                    start: lo,
                    end: hi,
                    kind,
                    label,
                    annotation_type: LineAnnotationType::Singleline,
                    highlight_source,
                };
                self.add_annotation_to_file(&mut annotated_line_infos, lo.line, line_ann);
            } else {
                multiline_annotations.push(MultilineAnnotation {
                    depth: 1,
                    start: lo,
                    end: hi,
                    kind,
                    label,
                    overlaps_exactly: false,
                    highlight_source,
                });
            }
        }

        let mut primary_spans = vec![];

        // Find overlapping multiline annotations, put them at different depths
        multiline_annotations.sort_by_key(|ml| (ml.start.line, usize::MAX - ml.end.line));
        for (outer_i, ann) in multiline_annotations.clone().into_iter().enumerate() {
            if ann.kind.is_primary() {
                primary_spans.push((ann.start, ann.end));
            }
            for (inner_i, a) in &mut multiline_annotations.iter_mut().enumerate() {
                // Move all other multiline annotations overlapping with this one
                // one level to the right.
                if !ann.same_span(a)
                    && num_overlap(ann.start.line, ann.end.line, a.start.line, a.end.line, true)
                {
                    a.increase_depth();
                } else if ann.same_span(a) && outer_i != inner_i {
                    a.overlaps_exactly = true;
                } else {
                    if primary_spans
                        .iter()
                        .any(|(s, e)| a.start == *s && a.end == *e)
                    {
                        a.kind = AnnotationKind::Primary;
                    }
                    break;
                }
            }
        }

        let mut max_depth = 0; // max overlapping multiline spans
        for ann in &multiline_annotations {
            max_depth = max(max_depth, ann.depth);
        }
        // Change order of multispan depth to minimize the number of overlaps in the ASCII art.
        for a in &mut multiline_annotations {
            a.depth = max_depth - a.depth + 1;
        }
        for ann in multil
```

### Core Architecture Module: `crates/ruff_annotate_snippets/src/renderer/styled_buffer.rs`
```
//! Adapted from [styled_buffer]
//!
//! [styled_buffer]: https://github.com/rust-lang/rust/blob/894f7a4ba6554d3797404bbf550d9919df060b97/compiler/rustc_errors/src/styled_buffer.rs

use alloc::string::String;
use alloc::{vec, vec::Vec};
use core::fmt::{self, Write};

use crate::Level;
use crate::renderer::ElementStyle;
use crate::renderer::stylesheet::Stylesheet;

#[derive(Debug)]
pub(crate) struct StyledBuffer {
    lines: Vec<Vec<StyledChar>>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct StyledChar {
    ch: char,
    style: ElementStyle,
}

impl StyledChar {
    pub(crate) const SPACE: Self = StyledChar::new(' ', ElementStyle::NoStyle);

    pub(crate) const fn new(ch: char, style: ElementStyle) -> StyledChar {
        StyledChar { ch, style }
    }
}

impl StyledBuffer {
    pub(crate) fn new() -> StyledBuffer {
        StyledBuffer { lines: vec![] }
    }

    fn ensure_lines(&mut self, line: usize) {
        if line >= self.lines.len() {
            self.lines.resize(line + 1, Vec::new());
        }
    }

    pub(crate) fn render(
        &self,
        level: &Level<'_>,
        stylesheet: &Stylesheet,
        str: &mut String,
    ) -> Result<(), fmt::Error> {
        let capacity = self.lines.iter().map(|line| line.len()).sum();
        str.reserve(capacity);

        for (i, line) in self.lines.iter().enumerate() {
            let mut current_style = stylesheet.none;
            for StyledChar { ch, style } in line {
                let ch_style = style.color_spec(level, stylesheet);
                if ch_style != current_style {
                    if !line.is_empty() {
                        write!(str, "{current_style:#}")?;
                    }
                    current_style = ch_style;
                    write!(str, "{current_style}")?;
                }
                str.push(*ch);
            }
            write!(str, "{current_style:#}")?;
            if i != self.lines.len() - 1 {
                str.push('\n');
            }
        }
        Ok(())
    }

    /// Sets `chr` with `style` for given `line`, `col`.
    /// If `line` does not exist in our buffer, adds empty lines up to the given
    /// and fills the last line with unstyled whitespace.
    pub(crate) fn putc(&mut self, line: usize, col: usize, chr: char, style: ElementStyle) {
        self.ensure_lines(line);
        if col >= self.lines[line].len() {
            self.lines[line].resize(col + 1, StyledChar::SPACE);
        }
        self.lines[line][col] = StyledChar::new(chr, style);
    }

    /// Sets `string` with `style` for given `line`, starting from `col`.
    /// If `line` does not exist in our buffer, adds empty lines up to the given
    /// and fills the last line with unstyled whitespace.
    pub(crate) fn puts(&mut self, line: usize, col: usize, string: &str, style: ElementStyle) {
        if string.is_empty() {
            // don't add trailing whitespace (from column offset) for blank strings
            return;
        }

        self.ensure_lines(line);
        let line = &mut self.lines[line];

        let new_len = col + string.chars().count();
        if new_len > line.len() {
            line.resize(new_len, StyledChar::SPACE);
        }

        for (offset, chr) in string.chars().enumerate() {
            let col = col + offset;
            line[col] = StyledChar::new(chr, style);
        }
    }

    /// For given `line` inserts `string` with `style` after old content of that line,
    /// adding lines if needed
    pub(crate) fn append(&mut self, line: usize, string: &str, style: ElementStyle) {
        if line >= self.lines.len() {
            self.puts(line, 0, string, style);
        } else {
            let col = self.lines[line].len();
            self.puts(line, col, string, style);
        }
    }

    pub(crate) fn replace(&mut self, line: usize, start: usize, end: usize, string: &str) {
        if start == end {
            return;
        }
        // If the replacement range would be out of bounds, do nothing, as we
        // can't replace things that don't exist.
        if start > self.lines[line].len() || end > self.lines[line].len() {
            return;
        };
        self.lines[line].splice(
            start..end,
            string
                .chars()
                .map(|c| StyledChar::new(c, ElementStyle::LineNumber)),
        );
    }

    pub(crate) fn num_lines(&self) -> usize {
        self.lines.len()
    }

    /// Set `style` for `line`, `col_start..col_end` range if:
    /// 1. That line and column range exist in `StyledBuffer`
    /// 2. `overwrite` is `true` or existing style is `Style::NoStyle` or `Style::Quotation`
    pub(crate) fn set_style_range(
        &mut self,
        line: usize,
        col_start: usize,
        col_end: usize,
        style: ElementStyle,
        overwrite: bool,
    ) {
        for col in col_start..col_end {
            self.set_style(line, col, style, overwrite);
        }
    }

    /// Set `style` for `line`, `col` if:
    /// 1. That line and column exist in `StyledBuffer`
    /// 2. `overwrite` is `true` or existing style is `Style::NoStyle` or `Style::Quotation`
    pub(crate) fn set_style(
        &mut self,
        line: usize,
        col: usize,
        style: ElementStyle,
        overwrite: bool,
    ) {
        if let Some(ref mut line) = self.lines.get_mut(line)
            && let Some(StyledChar { style: s, .. }) = line.get_mut(col)
            && (overwrite || matches!(s, ElementStyle::NoStyle | ElementStyle::Quotation))
        {
            *s = style;
        }
    }
}

```

### Core Architecture Module: `crates/ruff_annotate_snippets/src/renderer/stylesheet.rs`
```
use anstyle::Style;

#[derive(Clone, Copy, Debug)]
pub(crate) struct Stylesheet {
    pub(crate) error: Style,
    pub(crate) warning: Style,
    pub(crate) info: Style,
    pub(crate) note: Style,
    pub(crate) help: Style,
    pub(crate) line_num: Style,
    pub(crate) emphasis: Style,
    pub(crate) none: Style,
    pub(crate) context: Style,
    pub(crate) addition: Style,
    pub(crate) removal: Style,
}

impl Default for Stylesheet {
    fn default() -> Self {
        Self::plain()
    }
}

impl Stylesheet {
    pub(crate) const fn plain() -> Self {
        Self {
            error: Style::new(),
            warning: Style::new(),
            info: Style::new(),
            note: Style::new(),
            help: Style::new(),
            line_num: Style::new(),
            emphasis: Style::new(),
            none: Style::new(),
            context: Style::new(),
            addition: Style::new(),
            removal: Style::new(),
        }
    }
}

```

### Core Architecture Module: `crates/ruff_db/src/diagnostic/render.rs`
```
use std::borrow::Cow;
use std::collections::BTreeMap;
use std::path::Path;

use annotate_snippets::{
    Annotation as AnnotateAnnotation, AnnotationKind, Group as AnnotateGroup,
    Level as AnnotateLevel, Snippet as AnnotateSnippet,
};
use full::FullRenderer;
use ruff_notebook::{Notebook, NotebookIndex};
use ruff_source_file::{LineIndex, OneIndexed, SourceCode};
use ruff_text_size::{TextLen, TextRange, TextSize};

use crate::{
    Db,
    files::File,
    source::{SourceText, line_index, source_text},
};

use super::{
    Annotation, Diagnostic, DiagnosticFormat, DiagnosticSource, DisplayDiagnosticConfig,
    SubDiagnostic, UnifiedFile,
};

use azure::AzureRenderer;
use concise::ConciseRenderer;
use github::GithubRenderer;
use pylint::PylintRenderer;

mod azure;
mod concise;
mod full;
pub mod github;
#[cfg(feature = "serde")]
mod gitlab;
#[cfg(feature = "serde")]
mod json;
#[cfg(feature = "serde")]
mod json_lines;
#[cfg(feature = "junit")]
mod junit;
mod pylint;
#[cfg(feature = "serde")]
mod rdjson;

/// A type that implements `std::fmt::Display` for diagnostic rendering.
///
/// It is created via [`Diagnostic::display`].
///
/// The lifetime parameter, `'a`, refers to the shorter of:
///
/// * The lifetime of the rendering configuration.
/// * The lifetime of the resolver used to load the contents of `Span`
///   values. When using Salsa, this most commonly corresponds to the lifetime
///   of a Salsa `Db`.
/// * The lifetime of the diagnostic being rendered.
pub struct DisplayDiagnostic<'a> {
    config: &'a DisplayDiagnosticConfig,
    resolver: &'a dyn FileResolver,
    diag: &'a Diagnostic,
}

impl<'a> DisplayDiagnostic<'a> {
    pub(crate) fn new(
        resolver: &'a dyn FileResolver,
        config: &'a DisplayDiagnosticConfig,
        diag: &'a Diagnostic,
    ) -> DisplayDiagnostic<'a> {
        DisplayDiagnostic {
            config,
            resolver,
            diag,
        }
    }
}

impl std::fmt::Display for DisplayDiagnostic<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        DisplayDiagnostics::new(self.resolver, self.config, std::slice::from_ref(self.diag)).fmt(f)
    }
}

/// A type that implements `std::fmt::Display` for rendering a collection of diagnostics.
///
/// It is intended for collections of diagnostics that need to be serialized together, as is the
/// case for JSON, for example.
///
/// See [`DisplayDiagnostic`] for rendering individual `Diagnostic`s and details about the lifetime
/// constraints.
pub struct DisplayDiagnostics<'a> {
    config: &'a DisplayDiagnosticConfig,
    resolver: &'a dyn FileResolver,
    diagnostics: &'a [Diagnostic],
}

impl<'a> DisplayDiagnostics<'a> {
    pub fn new(
        resolver: &'a dyn FileResolver,
        config: &'a DisplayDiagnosticConfig,
        diagnostics: &'a [Diagnostic],
    ) -> DisplayDiagnostics<'a> {
        DisplayDiagnostics {
            config,
            resolver,
            diagnostics,
        }
    }
}

impl std::fmt::Display for DisplayDiagnostics<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self.config.format {
            DiagnosticFormat::Concise => {
                ConciseRenderer::new(self.resolver, self.config).render(f, self.diagnostics)?;
            }
            DiagnosticFormat::Full => {
                FullRenderer::new(self.resolver, self.config).render(f, self.diagnostics)?;
            }
            DiagnosticFormat::Azure => {
                AzureRenderer::new(self.resolver, self.config).render(f, self.diagnostics)?;
            }
            #[cfg(feature = "serde")]
            DiagnosticFormat::Json => {
                json::JsonRenderer::new(self.resolver, self.config).render(f, self.diagnostics)?;
            }
            #[cfg(feature = "serde")]
            DiagnosticFormat::JsonLines => {
                json_lines::JsonLinesRenderer::new(self.resolver, self.config)
                    .render(f, self.diagnostics)?;
            }
            #[cfg(feature = "serde")]
            DiagnosticFormat::Rdjson => {
                rdjson::RdjsonRenderer::new(self.resolver, self.config)
                    .render(f, self.diagnostics)?;
            }
            DiagnosticFormat::Pylint => {
                PylintRenderer::new(self.resolver, self.config).render(f, self.diagnostics)?;
            }
            #[cfg(feature = "junit")]
            DiagnosticFormat::Junit => {
                junit::JunitRenderer::new(self.resolver, self.config)
                    .render(f, self.diagnostics)?;
            }
            #[cfg(feature = "serde")]
            DiagnosticFormat::Gitlab => {
                gitlab::GitlabRenderer::new(self.resolver, self.config)
                    .render(f, self.diagnostics)?;
            }
            DiagnosticFormat::Github => {
                GithubRenderer::new(self.resolver, self.config).render(f, self.diagnostics)?;
            }
        }

        Ok(())
    }
}

/// A sequence of resolved diagnostics.
///
/// Resolving a diagnostic refers to the process of restructuring its internal
/// data in a way that enables rendering decisions. For example, a `Span`
/// on an `Annotation` in a `Diagnostic` is intentionally very minimal, and
/// thus doesn't have information like line numbers or even the actual file
/// path. Resolution retrieves this information and puts it into a structured
/// representation specifically intended for diagnostic rendering.
///
/// The lifetime `'a` refers to the shorter of the lifetimes between the file
/// resolver and the diagnostic itself. (The resolved types borrow data from
/// both.)
#[derive(Debug)]
struct Resolved<'a> {
    diagnostics: Vec<ResolvedDiagnostic<'a>>,
}

impl<'a> Resolved<'a> {
    /// Creates a new resolved set of diagnostics.
    fn new(
        resolver: &'a dyn FileResolver,
        diag: &'a Diagnostic,
        config: &DisplayDiagnosticConfig,
    ) -> Resolved<'a> {
        let mut diagnostics = vec![];
        diagnostics.push(ResolvedDiagnostic::from_diagnostic(resolver, config, diag));
        for sub in &diag.inner.subs {
            diagnostics.push(ResolvedDiagnostic::from_sub_diagnostic(resolver, sub));
        }
        Resolved { diagnostics }
    }

    /// Creates a value that is amenable to rendering directly.
    fn to_renderable(&self, config: &DisplayDiagnosticConfig) -> Renderable<'_> {
        Renderable {
            diagnostics: self
                .diagnostics
                .iter()
                .map(|diag| diag.to_renderable(config))
                .collect(),
        }
    }
}

/// A single resolved diagnostic.
///
/// The lifetime `'a` refers to the shorter of the lifetimes between the file
/// resolver and the diagnostic itself. (The resolved types borrow data from
/// both.)
#[derive(Debug)]
struct ResolvedDiagnostic<'a> {
    level: AnnotateLevel<'static>,
    id: Option<String>,
    documentation_url: Option<String>,
    message: String,
    annotations: Vec<ResolvedAnnotation<'a>>,
    is_fixable: bool,
    header_offset: usize,
}

impl<'a> ResolvedDiagnostic<'a> {
    /// Resolve a single diagnostic.
    fn from_diagnostic(
        resolver: &'a dyn FileResolver,
        config: &DisplayDiagnosticConfig,
        diag: &'a Diagnostic,
    ) -> ResolvedDiagnostic<'a> {
        let annotations: Vec<_> = diag
            .inner
            .annotations
            .iter()
            .filter_map(|ann| {
                let path = ann
                    .span
                    .file
                    .relative_path(resolver)
                    .to_str()
                    .unwrap_or_else(|| ann.span.file.path(resolver));
                let diagnostic_source = ann.span.file.diagnostic_source(resolver);
                ResolvedAnnotation::new(path, &diagnostic_source, ann, resolver)
            })
            .collect();

        let use_code = !config.preview || config.prefer_rule_codes;
        let id = if use_code && let Some(code) = diag.secondary_code() {
            code.to_string()
        } else if config.hide_severity {
            // When Ruff gets real severities, we should put the colon back in
            // `DisplaySet::format_annotation` for both cases, but this is a small hack to improve the
            // formatting of human-readable names for now. This should also be kept consistent with the
            // concise formatting.
            format!("{id}:", id = diag.id())
        } else {
            diag.id().to_string()
        };

        let level = diag.inner.severity.to_annotate();
        let level = if config.hide_severity {
            level.no_name()
        } else {
            level
        };

        ResolvedDiagnostic {
            level,
            id: Some(id),
            documentation_url: diag.documentation_url().map(ToString::to_string),
            message: diag.inner.message.as_str().to_string(),
            annotations,
            is_fixable: config.show_fix_status
                && diag.has_applicable_fix(config.fix_applicability()),
            header_offset: diag.inner.header_offset,
        }
    }

    /// Resolve a single sub-diagnostic.
    fn from_sub_diagnostic(
        resolver: &'a dyn FileResolver,
        diag: &'a SubDiagnostic,
    ) -> ResolvedDiagnostic<'a> {
        let annotations: Vec<_> = diag
            .inner
            .annotations
            .iter()
            .filter_map(|ann| {
                let path = ann
                    .span
                    .file
                    .relative_path(resolver)
                    .to_str()
                    .unwrap_or_else(|| ann.span.file.path(resolver));
                let diagnostic_source = ann.span.file.diagnostic_source(resolver);
                ResolvedAnnotation::new(path, &diagnostic_source, ann, resolver)
            })
            .collect();
        ResolvedDiagnostic {
            level: diag.inner.severity.to_annotate(),
            id: None,
            d
```

### Core Architecture Module: `crates/ruff_db/src/diagnostic/render/azure.rs`
```
use ruff_source_file::LineColumn;

use crate::diagnostic::{Diagnostic, DisplayDiagnosticConfig, Severity};

use super::FileResolver;

pub(super) struct AzureRenderer<'a> {
    resolver: &'a dyn FileResolver,
    config: &'a DisplayDiagnosticConfig,
}

impl<'a> AzureRenderer<'a> {
    pub(super) fn new(resolver: &'a dyn FileResolver, config: &'a DisplayDiagnosticConfig) -> Self {
        Self { resolver, config }
    }
}

impl AzureRenderer<'_> {
    pub(super) fn render(
        &self,
        f: &mut std::fmt::Formatter,
        diagnostics: &[Diagnostic],
    ) -> std::fmt::Result {
        for diag in diagnostics {
            let severity = match diag.severity() {
                Severity::Info | Severity::Warning => "warning",
                Severity::Error | Severity::Fatal => "error",
            };
            write!(f, "##vso[task.logissue type={severity};")?;
            if let Some(span) = diag.primary_span() {
                let filename = span.file().path(self.resolver);
                write!(f, "sourcepath={filename};")?;
                if let Some(range) = span.range() {
                    let location = if self.resolver.notebook_index(span.file()).is_some() {
                        // We can't give a reasonable location for the structured formats,
                        // so we show one that's clearly a fallback
                        LineColumn::default()
                    } else {
                        span.file()
                            .diagnostic_source(self.resolver)
                            .as_source_code()
                            .line_column(range.start())
                    };
                    write!(
                        f,
                        "linenumber={line};columnnumber={col};",
                        line = location.line,
                        col = location.column,
                    )?;
                }
            }
            let code = if self.config.preview && !self.config.prefer_rule_codes {
                diag.id().as_str()
            } else {
                diag.secondary_code_or_id()
            };
            writeln!(f, "code={code};]{body}", body = diag.concise_message(),)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::diagnostic::{
        DiagnosticFormat,
        render::tests::{create_diagnostics, create_syntax_error_diagnostics},
    };

    #[test]
    fn output() {
        let (env, diagnostics) = create_diagnostics(DiagnosticFormat::Azure);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics));
    }

    #[test]
    fn syntax_errors() {
        let (env, diagnostics) = create_syntax_error_diagnostics(DiagnosticFormat::Azure);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics));
    }
}

```

### Core Architecture Module: `crates/ruff_db/src/diagnostic/render/concise.rs`
```
use crate::diagnostic::{
    Diagnostic, DisplayDiagnosticConfig, Severity,
    stylesheet::{DiagnosticStylesheet, fmt_styled, fmt_with_hyperlink},
};

use super::FileResolver;

pub(super) struct ConciseRenderer<'a> {
    resolver: &'a dyn FileResolver,
    config: &'a DisplayDiagnosticConfig,
}

impl<'a> ConciseRenderer<'a> {
    pub(super) fn new(resolver: &'a dyn FileResolver, config: &'a DisplayDiagnosticConfig) -> Self {
        Self { resolver, config }
    }

    pub(super) fn render(
        &self,
        f: &mut std::fmt::Formatter,
        diagnostics: &[Diagnostic],
    ) -> std::fmt::Result {
        let stylesheet = if self.config.color {
            DiagnosticStylesheet::styled().hyperlinks(self.config.hyperlinks)
        } else {
            DiagnosticStylesheet::plain()
        };

        let sep = fmt_styled(":", stylesheet.separator);
        for diag in diagnostics {
            if self.config.is_canceled() {
                return Ok(());
            }

            if let Some(span) = diag.primary_span() {
                write!(
                    f,
                    "{path}",
                    path = fmt_styled(
                        span.file().relative_path(self.resolver).to_string_lossy(),
                        stylesheet.emphasis
                    )
                )?;
                if let Some(range) = span.range() {
                    let diagnostic_source = span.file().diagnostic_source(self.resolver);
                    let start = diagnostic_source
                        .as_source_code()
                        .line_column(range.start());

                    if let Some(notebook_index) = self.resolver.notebook_index(span.file()) {
                        write!(
                            f,
                            "{sep}cell {cell}{sep}{line}{sep}{col}",
                            cell = notebook_index.cell(start.line).unwrap_or_default(),
                            line = notebook_index.cell_row(start.line).unwrap_or_default(),
                            col = start.column,
                        )?;
                    } else {
                        write!(
                            f,
                            "{sep}{line}{sep}{col}",
                            line = start.line,
                            col = start.column,
                        )?;
                    }
                }
                write!(f, "{sep} ")?;
            }

            let use_name = self.config.preview && !self.config.prefer_rule_codes;
            if self.config.hide_severity {
                if !use_name && let Some(code) = diag.secondary_code() {
                    write!(
                        f,
                        "{code} ",
                        code = fmt_styled(
                            fmt_with_hyperlink(&code, diag.documentation_url(), &stylesheet),
                            stylesheet.secondary_code
                        )
                    )?;
                } else {
                    write!(
                        f,
                        "{id}: ",
                        id = fmt_styled(
                            fmt_with_hyperlink(
                                &diag.inner.id,
                                diag.documentation_url(),
                                &stylesheet
                            ),
                            stylesheet.secondary_code
                        )
                    )?;
                }
            } else {
                let (severity, severity_style) = match diag.severity() {
                    Severity::Info => ("info", stylesheet.info),
                    Severity::Warning => ("warning", stylesheet.warning),
                    Severity::Error => ("error", stylesheet.error),
                    Severity::Fatal => ("fatal", stylesheet.error),
                };
                let id = if use_name {
                    diag.id().as_str()
                } else {
                    diag.secondary_code_or_id()
                };
                write!(
                    f,
                    "{severity}[{id}] ",
                    severity = fmt_styled(severity, severity_style),
                    id = fmt_styled(
                        fmt_with_hyperlink(id, diag.documentation_url(), &stylesheet),
                        stylesheet.emphasis
                    )
                )?;
            }
            if self.config.show_fix_status {
                // Do not display an indicator for inapplicable fixes
                if diag.has_applicable_fix(self.config.fix_applicability()) {
                    write!(f, "[{fix}] ", fix = fmt_styled("*", stylesheet.separator))?;
                }
            }

            writeln!(f, "{message}", message = diag.concise_message())?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use ruff_diagnostics::Applicability;

    use crate::diagnostic::{
        DiagnosticFormat,
        render::tests::{
            TestEnvironment, create_diagnostics, create_notebook_diagnostics,
            create_syntax_error_diagnostics,
        },
    };

    #[test]
    fn output() {
        let (env, diagnostics) = create_diagnostics(DiagnosticFormat::Concise);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics), @"
        fib.py:1:8: error[F401] `os` imported but unused
        fib.py:6:5: error[F841] Local variable `x` is assigned to but never used
        undef.py:1:4: error[F821] Undefined name `a`
        fib.py:12:16: error[F821] Undefined name `fibonaccii`
        ");
    }

    #[test]
    fn show_fixes() {
        let (mut env, diagnostics) = create_diagnostics(DiagnosticFormat::Concise);
        env.hide_severity(true);
        env.show_fix_status(true);
        env.fix_applicability(Applicability::DisplayOnly);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics), @"
        fib.py:1:8: F401 [*] `os` imported but unused
        fib.py:6:5: F841 [*] Local variable `x` is assigned to but never used
        undef.py:1:4: F821 Undefined name `a`
        fib.py:12:16: F821 Undefined name `fibonaccii`
        ");
    }

    #[test]
    fn show_fixes_preview() {
        let (mut env, diagnostics) = create_diagnostics(DiagnosticFormat::Concise);
        env.hide_severity(true);
        env.show_fix_status(true);
        env.fix_applicability(Applicability::DisplayOnly);
        env.preview(true);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics), @"
        fib.py:1:8: unused-import: [*] `os` imported but unused
        fib.py:6:5: unused-variable: [*] Local variable `x` is assigned to but never used
        undef.py:1:4: undefined-name: Undefined name `a`
        fib.py:12:16: undefined-name: Undefined name `fibonaccii`
        ");
    }

    #[test]
    fn show_fixes_syntax_errors() {
        let (mut env, diagnostics) = create_syntax_error_diagnostics(DiagnosticFormat::Concise);
        env.hide_severity(true);
        env.show_fix_status(true);
        env.fix_applicability(Applicability::DisplayOnly);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics), @"
        syntax_errors.py:1:15: invalid-syntax: Expected one or more symbol names after import
        syntax_errors.py:3:12: invalid-syntax: Expected ')', found newline
        ");
    }

    #[test]
    fn syntax_errors() {
        let (env, diagnostics) = create_syntax_error_diagnostics(DiagnosticFormat::Concise);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics), @"
        syntax_errors.py:1:15: error[invalid-syntax] Expected one or more symbol names after import
        syntax_errors.py:3:12: error[invalid-syntax] Expected ')', found newline
        ");
    }

    #[test]
    fn notebook_output() {
        let (env, diagnostics) = create_notebook_diagnostics(DiagnosticFormat::Concise);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics), @"
        notebook.ipynb:cell 1:2:8: error[F401] `os` imported but unused
        notebook.ipynb:cell 2:2:8: error[F401] `math` imported but unused
        notebook.ipynb:cell 3:4:5: error[F841] Local variable `x` is assigned to but never used
        ");
    }

    #[test]
    fn missing_file() {
        let mut env = TestEnvironment::new();
        env.format(DiagnosticFormat::Concise);

        let diag = env.err().build();

        insta::assert_snapshot!(
            env.render(&diag),
            @"error[test-diagnostic] main diagnostic message",
        );
    }
}

```

### Core Architecture Module: `crates/ruff_db/src/diagnostic/render/full.rs`
```
use std::borrow::Cow;
use std::num::NonZeroUsize;

use similar::{ChangeTag, DiffOp, TextDiff};

use annotate_snippets::{
    Group as AnnotateGroup, Level as AnnotateLevel, Renderer as AnnotateRenderer,
};
use ruff_diagnostics::{Applicability, Fix};
use ruff_notebook::NotebookIndex;
use ruff_source_file::OneIndexed;
use ruff_text_size::{Ranged, TextLen, TextRange, TextSize};

use crate::diagnostic::render::{FileResolver, Resolved};
use crate::diagnostic::stylesheet::{DiagnosticStylesheet, fmt_styled};
use crate::diagnostic::{Diagnostic, DiagnosticSource, DisplayDiagnosticConfig};

pub(super) struct FullRenderer<'a> {
    resolver: &'a dyn FileResolver,
    config: &'a DisplayDiagnosticConfig,
}

impl<'a> FullRenderer<'a> {
    pub(super) fn new(resolver: &'a dyn FileResolver, config: &'a DisplayDiagnosticConfig) -> Self {
        Self { resolver, config }
    }

    pub(super) fn render(
        &self,
        f: &mut std::fmt::Formatter,
        diagnostics: &[Diagnostic],
    ) -> std::fmt::Result {
        let stylesheet = if self.config.color {
            DiagnosticStylesheet::styled().hyperlinks(self.config.hyperlinks)
        } else {
            DiagnosticStylesheet::plain()
        };

        let mut renderer = if self.config.color {
            AnnotateRenderer::styled()
        } else {
            AnnotateRenderer::plain()
        }
        .cut_indicator("…")
        .anonymized_line_numbers(self.config.anonymized_line_numbers);

        renderer = renderer
            .error(stylesheet.error)
            .warning(stylesheet.warning)
            .info(stylesheet.info)
            .note(stylesheet.note)
            .help(stylesheet.help)
            .line_num(stylesheet.line_no)
            .emphasis(stylesheet.emphasis)
            .none(stylesheet.none)
            .hyperlink(stylesheet.hyperlink);

        for diag in diagnostics {
            if self.config.is_canceled() {
                return Ok(());
            }

            let resolved = Resolved::new(self.resolver, diag, self.config);
            let renderable = resolved.to_renderable(self.config);
            for diag in renderable.diagnostics.iter() {
                writeln!(f, "{}", renderer.render(&[diag.to_annotate()]))?;
            }

            if diag.has_applicable_fix(self.config.fix_applicability())
                && let Some(diff) =
                    Diff::from_diagnostic(diag, &stylesheet, self.resolver, self.config)
            {
                write!(f, "{diff}")?;
                if let Some(applicability) = to_applicability_annotate(diff.fix) {
                    writeln!(f, "{}", renderer.render(&[applicability]))?;
                }
            }

            writeln!(f)?;
        }

        Ok(())
    }
}

const FIX_CONTEXT: usize = 1;

/// Renders a diff that shows the code fixes.
///
/// The implementation isn't fully fledged out and only used by tests. Before using in production, try
/// * Improve layout
/// * Replace tabs with spaces for a consistent experience across terminals
/// * Replace zero-width whitespaces
/// * Print a simpler diff if only a single line has changed
/// * Compute the diff from the `Edit` because diff calculation is expensive.
struct Diff<'a> {
    fix: &'a Fix,
    diagnostic_source: DiagnosticSource,
    notebook_index: Option<NotebookIndex>,
    stylesheet: &'a DiagnosticStylesheet,
    merge_window: usize,
}

impl<'a> Diff<'a> {
    fn from_diagnostic(
        diagnostic: &'a Diagnostic,
        stylesheet: &'a DiagnosticStylesheet,
        resolver: &'a dyn FileResolver,
        config: &DisplayDiagnosticConfig,
    ) -> Option<Diff<'a>> {
        let file = &diagnostic.primary_span_ref()?.file;
        Some(Diff {
            fix: diagnostic.fix()?,
            diagnostic_source: file.diagnostic_source(resolver),
            notebook_index: resolver.notebook_index(file),
            stylesheet,
            merge_window: config.merge_window,
        })
    }

    fn write(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        let source_code = self.diagnostic_source.as_source_code();
        let source_text = source_code.text();

        let cell_ranges = self.cell_ranges();

        for (cell_index, range) in cell_ranges {
            // For non-notebooks, construct and diff only the source surrounding the edits.
            let (range, line_offset) = if cell_index.is_none()
                && let Some(first) = self.fix.edits().first()
                && let Some(last) = self.fix.edits().last()
            {
                let start_line = source_code
                    .line_index(first.start())
                    .saturating_sub(DIFF_CONTEXT_WINDOW);
                let last_source_line = source_code.line_index(source_text.text_len());
                let end_line = source_code
                    .line_index(last.end())
                    .saturating_add(DIFF_CONTEXT_WINDOW)
                    .min(last_source_line);

                (
                    TextRange::new(
                        source_code.line_start(start_line),
                        source_code.line_end(end_line),
                    ),
                    start_line.to_zero_indexed(),
                )
            } else {
                (range, 0)
            };

            let edits = self
                .fix
                .edits()
                .iter()
                .filter(|edit| range.contains_range(edit.range()))
                .collect::<Vec<_>>();
            // No edits were applied, so there's no need to diff.
            if edits.is_empty() {
                continue;
            }

            let input = source_code.slice(range);

            let mut output = String::with_capacity(input.len());
            let mut last_end = range.start();

            for edit in edits {
                output.push_str(source_code.slice(TextRange::new(last_end, edit.start())));
                output.push_str(edit.content().unwrap_or_default());
                last_end = edit.end();
            }

            output.push_str(&source_text[usize::from(last_end)..usize::from(range.end())]);

            let diff = TextDiff::from_lines(input, &output);

            let mut grouped_ops: Vec<Vec<DiffOp>> = Vec::new();
            for group in diff.grouped_ops(FIX_CONTEXT) {
                if let Some(previous) = grouped_ops.last_mut()
                    && let Some(DiffOp::Equal { new_index, len, .. }) = previous.last_mut()
                    && let [
                        DiffOp::Equal {
                            new_index: next_new_index,
                            len: next_len,
                            ..
                        },
                        rest @ ..,
                    ] = group.as_slice()
                    && next_new_index.saturating_sub(*new_index + *len) <= self.merge_window
                {
                    // Restore the unchanged lines that `grouped_ops` omitted between the groups.
                    *len = next_new_index + next_len - *new_index;
                    previous.extend_from_slice(rest);
                } else {
                    grouped_ops.push(group);
                }
            }

            // Find the new line number with the largest number of digits to align all of the line
            // number separators.
            let last_op = grouped_ops.last().and_then(|group| group.last());
            let largest_new = last_op
                .map(|op| op.new_range().end + line_offset)
                .unwrap_or_default();

            let digit_with = OneIndexed::new(largest_new).unwrap_or_default().digits();

            if let Some(cell_index) = cell_index {
                // Room for 1 digit, 1 space, 1 `|`, and 1 more following space. This centers the
                // three colons on the pipe.
                writeln!(f, "{:>1$} cell {cell_index}", ":::", digit_with.get() + 3)?;
            }

            self.write_gutter(f, digit_with)?;

            for (idx, group) in grouped_ops.iter().enumerate() {
                if idx > 0 {
                    writeln!(f, "{:-^1$}", "-", 80)?;
                }
                for op in group {
                    for change in diff.iter_inline_changes(op) {
                        let (sign, style, line_no_style, index) = match change.tag() {
                            ChangeTag::Delete => (
                                "-",
                                self.stylesheet.deletion,
                                self.stylesheet.deletion_line_no,
                                None,
                            ),
                            ChangeTag::Insert => (
                                "+",
                                self.stylesheet.insertion,
                                self.stylesheet.insertion_line_no,
                                change.new_index(),
                            ),
                            ChangeTag::Equal => (
                                "|",
                                self.stylesheet.none,
                                self.stylesheet.line_no,
                                change.new_index(),
                            ),
                        };

                        let line = Line {
                            index: index.map(|i| {
                                OneIndexed::from_zero_indexed(i).saturating_add(line_offset)
                            }),
                            width: digit_with,
                        };

                        write!(
                            f,
                            "{line} {sign}",
                            line = fmt_styled(line, self.stylesheet.line_no),
                            sign = fmt_styled(sign, line_no_style),
                        )?;

                        let mut needs_separator = true;
                        for (emphasized, value) in change.iter_strings_lossy() {
                            if needs_separator && !value.
```

### Core Architecture Module: `crates/ruff_db/src/diagnostic/render/github.rs`
```
use ruff_text_size::TextRange;

use crate::diagnostic::{
    Annotation, Diagnostic, DisplayDiagnosticConfig, FileResolver, Severity, SubDiagnosticSeverity,
    UnifiedFile,
};

pub(super) struct GithubRenderer<'a> {
    resolver: &'a dyn FileResolver,
    config: &'a DisplayDiagnosticConfig,
}

impl<'a> GithubRenderer<'a> {
    pub(super) fn new(resolver: &'a dyn FileResolver, config: &'a DisplayDiagnosticConfig) -> Self {
        Self { resolver, config }
    }

    pub(super) fn render(
        &self,
        f: &mut std::fmt::Formatter,
        diagnostics: &[Diagnostic],
    ) -> std::fmt::Result {
        for diagnostic in diagnostics {
            let severity = match diagnostic.severity() {
                Severity::Info => "notice",
                Severity::Warning => "warning",
                Severity::Error | Severity::Fatal => "error",
            };
            let use_name = self.config.preview && !self.config.prefer_rule_codes;
            let code = if use_name {
                diagnostic.id().as_str()
            } else {
                diagnostic.secondary_code_or_id()
            };
            write!(
                f,
                "::{severity} title={program} ({code})",
                program = self.config.program,
            )?;

            if let Some(span) = diagnostic.primary_span() {
                let file = span.file();
                write!(f, ",file={file}", file = file.path(self.resolver))?;

                let (start_location, end_location) = if self.resolver.is_notebook(file) {
                    // We can't give a reasonable location for the structured formats,
                    // so we show one that's clearly a fallback
                    None
                } else {
                    let diagnostic_source = file.diagnostic_source(self.resolver);
                    let source_code = diagnostic_source.as_source_code();

                    span.range().map(|range| {
                        (
                            source_code.line_column(range.start()),
                            source_code.line_column(range.end()),
                        )
                    })
                }
                .unwrap_or_default();

                // GitHub Actions workflow commands have constraints on error annotations:
                // - `col` and `endColumn` cannot be set if `line` and `endLine` are different
                // See: https://github.com/astral-sh/ruff/issues/22074
                if start_location.line == end_location.line {
                    write!(
                        f,
                        ",line={row},col={column},endLine={end_row},endColumn={end_column}::",
                        row = start_location.line,
                        column = start_location.column,
                        end_row = end_location.line,
                        end_column = end_location.column,
                    )?;
                } else {
                    write!(
                        f,
                        ",line={row},endLine={end_row}::",
                        row = start_location.line,
                        end_row = end_location.line,
                    )?;
                }

                write!(
                    f,
                    "{path}:{row}:{column}: ",
                    path = file.relative_path(self.resolver).display(),
                    row = start_location.line,
                    column = start_location.column,
                )?;
            } else {
                write!(f, "::")?;
            }

            if !use_name && let Some(code) = diagnostic.secondary_code() {
                write!(f, "{code}")?;
            } else {
                write!(f, "{id}:", id = diagnostic.id())?;
            }

            write!(f, " {}", diagnostic.concise_message())?;

            // After rendering the main diagnostic, render its secondary annotations and
            // sub-diagnostics. Note that lines within a single diagnostic must be separated by
            // URL-encoded newlines (`%0A`) to render properly in GitHub annotations.
            for annotation in diagnostic.secondary_annotations().filter_map(|annotation| {
                GithubAnnotation::from_annotation(annotation, self.resolver)
            }) {
                write!(f, "%0A{annotation}")?;
            }

            for subdiagnostic in diagnostic.sub_diagnostics() {
                let severity = match subdiagnostic.severity() {
                    SubDiagnosticSeverity::Help => "help",
                    SubDiagnosticSeverity::Info => "info",
                    SubDiagnosticSeverity::Warning => "warning",
                    SubDiagnosticSeverity::Error | SubDiagnosticSeverity::Fatal => "error",
                };
                if let Some(annotation) = subdiagnostic.primary_annotation()
                    && let span = annotation.get_span()
                    && let file = span.file()
                    && let Some(range) = span.range()
                {
                    let diagnostic_source = file.diagnostic_source(self.resolver);
                    let source_code = diagnostic_source.as_source_code();
                    let message = subdiagnostic.concise_message();
                    let start_location = source_code.line_column(range.start());
                    write!(
                        f,
                        "%0A  {path}:{row}:{column}: {severity}: {message}",
                        path = file.relative_path(self.resolver).display(),
                        row = start_location.line,
                        column = start_location.column,
                    )?;
                } else {
                    write!(f, "%0A  {severity}: {}", subdiagnostic.concise_message())?;
                }

                for annotation in subdiagnostic
                    .secondary_annotations()
                    .filter_map(|annotation| {
                        GithubAnnotation::from_annotation(annotation, self.resolver)
                    })
                {
                    write!(f, "%0A  {annotation}")?;
                }
            }

            writeln!(f)?;
        }

        Ok(())
    }
}

struct GithubAnnotation<'a> {
    message: &'a str,
    range: TextRange,
    file: &'a UnifiedFile,
    resolver: &'a dyn FileResolver,
}

impl<'a> GithubAnnotation<'a> {
    fn from_annotation(annotation: &'a Annotation, resolver: &'a dyn FileResolver) -> Option<Self> {
        let span = annotation.get_span();
        Some(Self {
            message: annotation.get_message()?,
            range: span.range()?,
            file: span.file(),
            resolver,
        })
    }
}

impl std::fmt::Display for GithubAnnotation<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let diagnostic_source = self.file.diagnostic_source(self.resolver);
        let source_code = diagnostic_source.as_source_code();
        let start_location = source_code.line_column(self.range.start());
        write!(
            f,
            "  {path}:{row}:{column}:",
            path = self.file.relative_path(self.resolver).display(),
            row = start_location.line,
            column = start_location.column,
        )?;

        write!(f, " {message}", message = self.message)
    }
}

#[cfg(test)]
mod tests {
    use crate::diagnostic::{
        DiagnosticFormat,
        render::tests::{TestEnvironment, create_diagnostics, create_syntax_error_diagnostics},
    };

    #[test]
    fn output() {
        let (env, diagnostics) = create_diagnostics(DiagnosticFormat::Github);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics));
    }

    #[test]
    fn syntax_errors() {
        let (env, diagnostics) = create_syntax_error_diagnostics(DiagnosticFormat::Github);
        insta::assert_snapshot!(env.render_diagnostics(&diagnostics));
    }

    #[test]
    fn missing_file() {
        let mut env = TestEnvironment::new();
        env.format(DiagnosticFormat::Github);

        let diag = env.err().build();

        insta::assert_snapshot!(
            env.render(&diag),
            @"::error title=ty (test-diagnostic)::test-diagnostic: main diagnostic message",
        );
    }
}

```

### Core Architecture Module: `crates/ruff_db/src/diagnostic/render/gitlab.rs`
```
use std::{
    collections::HashSet,
    hash::{DefaultHasher, Hash, Hasher},
    path::Path,
};

use ruff_source_file::LineColumn;
use serde::{Serialize, Serializer, ser::SerializeSeq};

use crate::diagnostic::{Diagnostic, DisplayDiagnosticConfig, Severity};

use super::FileResolver;

pub(super) struct GitlabRenderer<'a> {
    resolver: &'a dyn FileResolver,
    config: &'a DisplayDiagnosticConfig,
}

impl<'a> GitlabRenderer<'a> {
    pub(super) fn new(resolver: &'a dyn FileResolver, config: &'a DisplayDiagnosticConfig) -> Self {
        Self { resolver, config }
    }
}

impl GitlabRenderer<'_> {
    pub(super) fn render(
        &self,
        f: &mut std::fmt::Formatter,
        diagnostics: &[Diagnostic],
    ) -> std::fmt::Result {
        write!(
            f,
            "{}",
            serde_json::to_string_pretty(&SerializedMessages {
                diagnostics,
                resolver: self.resolver,
                config: self.config,
                #[expect(
                    clippy::disallowed_methods,
                    reason = "We don't have access to a `System` here, \
                              and this is only intended for use by GitLab CI, \
                              which runs on a real `System`."
                )]
                project_dir: std::env::var("CI_PROJECT_DIR").ok().as_deref(),
            })
            .unwrap()
        )
    }
}

struct SerializedMessages<'a> {
    diagnostics: &'a [Diagnostic],
    resolver: &'a dyn FileResolver,
    config: &'a DisplayDiagnosticConfig,
    project_dir: Option<&'a str>,
}

impl Serialize for SerializedMessages<'_> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut s = serializer.serialize_seq(Some(self.diagnostics.len()))?;
        let mut fingerprints = HashSet::<u64>::with_capacity(self.diagnostics.len());

        for diagnostic in self.diagnostics {
            let location = diagnostic
                .primary_span()
                .map(|span| {
                    let file = span.file();
                    let positions = if self.resolver.is_notebook(file) {
                        // We can't give a reasonable location for the structured formats,
                        // so we show one that's clearly a fallback
                        Default::default()
                    } else {
                        let diagnostic_source = file.diagnostic_source(self.resolver);
                        let source_code = diagnostic_source.as_source_code();
                        span.range()
                            .map(|range| Positions {
                                begin: source_code.line_column(range.start()),
                                end: source_code.line_column(range.end()),
                            })
                            .unwrap_or_default()
                    };

                    let path = self.project_dir.as_ref().map_or_else(
                        || file.relative_path(self.resolver).display().to_string(),
                        |project_dir| relativize_path_to(file.path(self.resolver), project_dir),
                    );

                    Location { path, positions }
                })
                .unwrap_or_default();

            let mut message_fingerprint = fingerprint(diagnostic, &location.path, 0);

            // Make sure that we do not get a fingerprint that is already in use
            // by adding in the previously generated one.
            while fingerprints.contains(&message_fingerprint) {
                message_fingerprint = fingerprint(diagnostic, &location.path, message_fingerprint);
            }
            fingerprints.insert(message_fingerprint);

            let description = diagnostic.concise_message();
            let check_name = if self.config.preview && !self.config.prefer_rule_codes {
                diagnostic.id().as_str()
            } else {
                diagnostic.secondary_code_or_id()
            };
            let severity = match diagnostic.severity() {
                Severity::Info => "info",
                Severity::Warning => "minor",
                Severity::Error => "major",
                // Another option here is `blocker`
                Severity::Fatal => "critical",
            };

            let value = Message {
                check_name,
                // GitLab doesn't display the separate `check_name` field in a Code Quality report,
                // so prepend it to the description too.
                description: format!("{check_name}: {description}"),
                severity,
                fingerprint: format!("{:x}", message_fingerprint),
                location,
            };

            s.serialize_element(&value)?;
        }

        s.end()
    }
}

#[derive(Serialize)]
struct Message<'a> {
    check_name: &'a str,
    description: String,
    severity: &'static str,
    fingerprint: String,
    location: Location,
}

/// The place in the source code where the issue was discovered.
///
/// According to the CodeClimate report format [specification] linked from the GitLab [docs], this
/// field is required, so we fall back on a default `path` and position if the diagnostic doesn't
/// have a primary span.
///
/// [specification]: https://github.com/codeclimate/platform/blob/master/spec/analyzers/SPEC.md#data-types
/// [docs]: https://docs.gitlab.com/ci/testing/code_quality/#code-quality-report-format
#[derive(Default, Serialize)]
struct Location {
    path: String,
    positions: Positions,
}

#[derive(Default, Serialize)]
struct Positions {
    begin: LineColumn,
    end: LineColumn,
}

/// Generate a unique fingerprint to identify a violation.
fn fingerprint(diagnostic: &Diagnostic, project_path: &str, salt: u64) -> u64 {
    let mut hasher = DefaultHasher::new();

    salt.hash(&mut hasher);
    diagnostic.name().hash(&mut hasher);
    project_path.hash(&mut hasher);

    hasher.finish()
}

/// Convert an absolute path to be relative to the specified project root.
fn relativize_path_to<P: AsRef<Path>, R: AsRef<Path>>(path: P, project_root: R) -> String {
    format!(
        "{}",
        pathdiff::diff_paths(&path, project_root)
            .expect("Could not diff paths")
            .display()
    )
}

#[cfg(test)]
mod tests {
    use crate::diagnostic::{
        DiagnosticFormat,
        render::tests::{create_diagnostics, create_syntax_error_diagnostics},
    };

    const FINGERPRINT_FILTERS: [(&str, &str); 1] = [(
        r#""fingerprint": "[a-z0-9]+","#,
        r#""fingerprint": "<redacted>","#,
    )];

    #[test]
    fn output() {
        let (env, diagnostics) = create_diagnostics(DiagnosticFormat::Gitlab);
        insta::with_settings!({filters => FINGERPRINT_FILTERS}, {
            insta::assert_snapshot!(env.render_diagnostics(&diagnostics));
        });
    }

    #[test]
    fn syntax_errors() {
        let (env, diagnostics) = create_syntax_error_diagnostics(DiagnosticFormat::Gitlab);
        insta::with_settings!({filters => FINGERPRINT_FILTERS}, {
            insta::assert_snapshot!(env.render_diagnostics(&diagnostics));
        });
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29090** (2026-10-03): **[ty] Preserve tuple subclass identity during type expansion**
  *Symptoms*: ## Summary  We now recognize exhaustive class patterns over tuple subclasses, including `NamedTuple`. For example, this function no longer produces an `invalid-return-type` error:  ```python from typing import NamedTuple  class Point(NamedTuple):     x: bool  def handle(value: Point) -> int:     match value:         case Point():             return 42 ```  Tuple expansion now intersects each expanded tuple with the original subclass, preserving its class identity during reachability analysis and overload resolution.  Closes https://github.com/astral-sh/ty/issues/4659. 
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment typing_conformance_diagnostics_diff -->   ## [Typing conformance results](https://github.com/python/typing/blob/d44387d4426429de9e0becda96fc639b8d846515/conformance/)  ### No changes detected ✅  <details> <summary>Current numbers</summary>  <br> The percentage of diagnostics emitted that were expected errors held steady at <b>98.24%</b>. The percentage of expected errors that received a diagnostic held steady at <b>98.24%</b>. The number of fully passing files held steady at <b>134/146</b>.  </details>  
  >  <!-- generated-comment memory_report_diff -->  ## Memory usage report  Memory usage unchanged ✅ 
  >  <!-- generated-comment ty ecosystem-analyzer -->   ## `ecosystem-analyzer` results  No diagnostic changes detected ✅   **[Full report with detailed diff](https://0d83f407.ty-ecosystem-ext.pages.dev/diff)** ([timing results](https://0d83f407.ty-ecosystem-ext.pages.dev/timing))  

- **Issue #29076** (2026-10-02): **[`flake8-builtins`] Expand checks in class scopes (`A001`)**
  *Symptoms*: <!-- Thank you for contributing to Ruff/ty! To help us out with reviewing, please consider the following:  - Does this pull request include a summary of the change? (See below.) - Does this pull request include a descriptive title? (Please prefix with `[ty]` for ty pull   requests.) - Does this pull request include references to any relevant issues? - Does this PR follow our AI policy (https://github.com/astral-sh/.github/blob/main/AI_POLICY.md)? -->  ## Summary  Inside a class body, `flake8-builtins` reports a `for`, `with ... as`, or `:=` target that shadows a builtin, but A001 does not. The A001 call site skipped every stored name in class scope because A003 handles class attributes, but A003 only considers assignment and annotation bindings, so those other binding kinds were reported by neither rule. The class-scope skip now applies only to the binding kinds A003 handles, by checking the stored name's `BindingKind`. Attribute and method bindings in a class still go to A003, so there's no double-reporting.  This is the gap left after #20178, which I picked up because no pull request was opened for it.  Fixes #20179  ## Test Plan  I have added new class-scope cases in the A001 fixture covering both the three bindings that now fire and the attribute and method bindings that stay silent, updated the snapshot with three new diagnostics, and ran the `flake8-builtins` tests, `clippy`, and `fmt`. 
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment ecosystem -->   ## `ruff-ecosystem` results  ### Linter (stable) ✅ ecosystem check detected no linter changes.  ### Linter (preview) ✅ ecosystem check detected no linter changes.    
  > I moved the check into the rule code; thanks for pointing that out.
  > Rerequested review by accident, nothing new. Thanks for being speedy!

- **Issue #29066** (2026-10-03): **[ty] Keep unresolved TypeIs targets provisional**
  *Symptoms*: ## Summary  We now terminate inference for recursive `TypeIs` calls like this one:  ```python from typing import reveal_type from typing_extensions import TypeIs  class Container[T]: ...  def is_container[T](value: object, other: T) -> TypeIs[Container[T]]:     return True  while True:     if is_container(value, type(value)):         value = value.__str__     else:         value = {value}     reveal_type(value) ```  Previously, an unresolved `TypeIs` target could make the `else` branch appear unreachable. We now defer that narrowing until the target is known, preserving the recursive type and diagnostics in both branches.  Addresses https://github.com/astral-sh/ty/issues/3837. 
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment typing_conformance_diagnostics_diff -->   ## [Typing conformance results](https://github.com/python/typing/blob/d44387d4426429de9e0becda96fc639b8d846515/conformance/)  ### No changes detected ✅  <details> <summary>Current numbers</summary>  <br> The percentage of diagnostics emitted that were expected errors held steady at <b>98.24%</b>. The percentage of expected errors that received a diagnostic held steady at <b>98.24%</b>. The number of fully passing files held steady at <b>134/146</b>.  </details>  
  >  <!-- generated-comment memory_report_diff -->  ## Memory usage report  Memory usage unchanged ✅ 
  >  <!-- generated-comment ty ecosystem-analyzer -->   ## `ecosystem-analyzer` results  No diagnostic changes detected ✅   **[Full report with detailed diff](https://a15bbf55.ty-ecosystem-ext.pages.dev/diff)** ([timing results](https://a15bbf55.ty-ecosystem-ext.pages.dev/timing))  

- **Issue #29043** (2026-10-01): **[ty] Specialize instance members once**
  *Symptoms*: ## Summary  We apply a generic class's specialization once when looking up an instance attribute. MRO lookup already specializes each member in its defining class, but the outer lookup applied the specialization again. When type arguments refer to the class's own parameters, that could turn `list[T]` into `list[list[T]]` or undo a swap of `T` and `U`.  Remove the redundant specialization and cover nested and swapped type arguments with both legacy and PEP 695 syntax. 
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment typing_conformance_diagnostics_diff -->   ## [Typing conformance results](https://github.com/python/typing/blob/d44387d4426429de9e0becda96fc639b8d846515/conformance/)  ### No changes detected ✅  <details> <summary>Current numbers</summary>  <br> The percentage of diagnostics emitted that were expected errors held steady at <b>98.24%</b>. The percentage of expected errors that received a diagnostic held steady at <b>98.24%</b>. The number of fully passing files held steady at <b>134/146</b>.  </details>  
  >  <!-- generated-comment memory_report_diff -->  ## Memory usage report  ### Summary  | Project | Old | New | Diff | Outcome | |---------|-----|-----|------|---------| | flake8 | 38.24MB | 38.24MB | - | ✅ | | sphinx | 172.24MB | 172.24MB | - | ✅ | | trio | 92.89MB | 92.88MB | -0.01% (4.87kB) | ⬇️ | | prefect | 475.77MB | 475.74MB | -0.00% (22.62kB) | ⬇️ |  ### Significant changes  <details> <summary>Click to expand detailed breakdown</summary>  ### trio  | Name | Old | New | Diff | Outcome | |------|-----|-----|------|---------| | `Type<'db>::apply_specialization_inner_::interned_arguments` | 931.09kB | 928.59kB | -0.27% (2.50kB) |⬇️ | | `Type<'db>::apply_specialization_inner_` | 653.20kB | 651.70kB | -0.23% (1.50kB) |⬇️ | | `infer_expression_types_impl` | 5.95MB | 5.95MB | -0.00% (240.00B) |⬇️ | | `member_lookup_with_policy_inner` | 1.26MB | 1.26MB | -0.02% (208.00B) |⬇️ | | `infer_definition_types` | 4.67MB | 4.67MB | -0.00% (120.00B) |⬇️ | | `member_lookup_with_policy_and_receiver_in
  >  <!-- generated-comment ty ecosystem-analyzer -->   ## `ecosystem-analyzer` results   | Lint rule | Added | Removed | Changed | |-----------|------:|--------:|--------:| | `invalid-argument-type` | 0 | 2 | 0 | | `invalid-assignment` | 0 | 0 | 1 | | **Total** | **0** | **2** | **1** |   **Raw diff:**  ```diff Expression (https://github.com/cognitedata/Expression) - expression/core/option.py:121:33 error[invalid-argument-type] Argument to bound method `Option.map` is incorrect: Expected `(_TSourceOut@Option, /) -> _TResult@apply`, found `((_TSourceOut@Option, /) -> _TResult@apply) | (((_TSourceOut@Option, /) -> _TResult@apply, /) -> _TResult@apply)` - expression/core/result.py:137:33 error[invalid-argument-type] Argument to bound method `Result.map` is incorrect: Expected `(_TSourceOut@Result, /) -> _TResult@apply`, found `((_TSourceOut@Result, /) -> _TResult@apply) | (((_TSourceOut@Result, /) -> _TResult@apply, /) -> _TResult@apply)`  spark (https://github.com/apache/spark) - python/pys

- **Issue #29024** (2026-09-30): **[ty] Preserve cycle markers in ParamSpec specialization**
  *Symptoms*: ## Summary  We preserve provisional cycle markers when converting a type argument into a `ParamSpec` parameter list. Previously, we treated `Divergent` like `Unknown` and replaced it with unknown parameters, discarding the marker that inference needs to normalize recursive specializations. Repeated specialization could then keep growing the inferred type until cycle inference panicked.  The existing fallback for `Unknown` remains unchanged. Corpus regressions cover recursive specializations with both legacy and PEP 695 generic syntax.  Addresses the generic-specialization reproducer in https://github.com/astral-sh/ty/issues/4615. The additional lambda and collection decorator reproducers are covered by #29025 and #28986, respectively. 
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment typing_conformance_diagnostics_diff -->   ## [Typing conformance results](https://github.com/python/typing/blob/d44387d4426429de9e0becda96fc639b8d846515/conformance/)  ### No changes detected ✅  <details> <summary>Current numbers</summary>  <br> The percentage of diagnostics emitted that were expected errors held steady at <b>98.24%</b>. The percentage of expected errors that received a diagnostic held steady at <b>98.24%</b>. The number of fully passing files held steady at <b>134/146</b>.  </details>  
  >  <!-- generated-comment memory_report_diff -->  ## Memory usage report  Memory usage unchanged ✅ 
  >  <!-- generated-comment ty ecosystem-analyzer -->   ## `ecosystem-analyzer` results  No diagnostic changes detected ✅   **[Full report with detailed diff](https://e0d7cac0.ty-ecosystem-ext.pages.dev/diff)** ([timing results](https://e0d7cac0.ty-ecosystem-ext.pages.dev/timing))  

- **Issue #29001** (2026-10-02): **[`flake8-self`] Allow private access on `object.__new__(cls)` instances (`SLF001`)**
  *Symptoms*: ## Summary  Closes #28989  SLF001 already skips instances created with `super().__new__(cls)`, but not the same pattern written with `object`:  ```python class A:     def __new__(cls):         obj = object().__new__(cls)         obj._private_attr = "bar"  # SLF001 before this change ```  This extends the special case to `object().__new__(...)` and `object.__new__(...)`, as suggested in the issue. `object` has to resolve to the builtin, and `object()` has to be called without arguments.  ## Test Plan  Added cases to `SLF001_1.py`: the two `object` forms with `cls`, `object.__new__(Amet)` inside a classmethod, and two that should still be flagged (`object(1)` and a shadowed `object`). The snapshot only gains those two diagnostics.  Also checked the reproducer from the issue with a local build: flagged before, clean after.
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment ecosystem -->   ## `ruff-ecosystem` results  ### Linter (stable) ℹ️ ecosystem check **detected linter changes**. (+1 -2 violations, +0 -0 fixes in 2 projects; 56 projects unchanged)  <details><summary><a href="https://github.com/apache/airflow">apache/airflow</a> (+0 -2 violations, +0 -0 fixes)</summary> <p> <pre>ruff check --no-cache --exit-zero --no-fix --output-format concise --no-preview --select ALL</pre> </p> <p>  <pre> - <a href='https://github.com/apache/airflow/blob/ba89738639cb54f6d4e79986cbc51db8b5b96de1/task-sdk/src/airflow/sdk/io/path.py#L139'>task-sdk/src/airflow/sdk/io/path.py:139:9:</a> SLF001 Private member accessed: `_conn_id` - <a href='https://github.com/apache/airflow/blob/ba89738639cb54f6d4e79986cbc51db8b5b96de1/task-sdk/src/airflow/sdk/io/path.py#L145'>task-sdk/src/airflow/sdk/io/path.py:145:13:</a> SLF001 Private member accessed: `_inject_authenticated_fs` </pre>  </p> </details> <details><summary><a href="https://github.com/home-assistan

- **Issue #28995** (2026-09-29): **[ty] Fix anchoring of include and exclude patterns after the project's root changed**
  *Symptoms*: ## Summary  After file system changes, ty compares the new resolved `Settings` with what's currently stored on the project and only updates the settings and reloads the files if they're different.   Before, this comparison didn't take the include and exclude anchors (the project root) into account. Therefore, changing a project from `./workspace/member` to `./workspace` wouldn't update its settings, even though the `include` and `exclude` patterns are now anchored at `./workspace` (e.g. `./workspace/member/**/.venv` -> `./workspace/**/.venv`).  We now store the absolute glob in `original`. `original` is used in the `Display` implementation, which is only used for tracing logs (where I think including the anchor is kind of nice).  Extracted from https://github.com/astral-sh/ruff/pull/28529. I'll go ahead and merge this because I need it in that stack. I also think this is not too controversial (and easy to change)  ## Test Plan  Added regressions for both filter types and ran the `ty_project` unit tests. 
  **Post-Mortem & Fix Analysis**:
  >  <!-- generated-comment typing_conformance_diagnostics_diff -->   ## [Typing conformance results](https://github.com/python/typing/blob/d44387d4426429de9e0becda96fc639b8d846515/conformance/)  ### No changes detected ✅  <details> <summary>Current numbers</summary>  <br> The percentage of diagnostics emitted that were expected errors held steady at <b>98.24%</b>. The percentage of expected errors that received a diagnostic held steady at <b>98.24%</b>. The number of fully passing files held steady at <b>134/146</b>.  </details>  
  >  <!-- generated-comment memory_report_diff -->  ## Memory usage report  Memory usage unchanged ✅ 
  >  <!-- generated-comment ty ecosystem-analyzer -->   ## `ecosystem-analyzer` results  No diagnostic changes detected ✅   **[Full report with detailed diff](https://948f9dd6.ty-ecosystem-ext.pages.dev/diff)** ([timing results](https://948f9dd6.ty-ecosystem-ext.pages.dev/timing))  

- **Issue #28989** (2026-10-02): **SLF001 false positives in __new__**
  *Symptoms*: ### Summary  If constructor magic method `__new__` is used also to set some private attributes of the new object, it is reported by ruff as violation of rule SLF001.  Example: using  `ruff check ./test.py --select SLF` on test.py: ```python class A:     def __new__(cls):         obj = object().__new__(cls)         obj.public_attr = 'foo'         obj._private_attr = 'bar' ``` returns: ``` SLF001 Private member accessed: `_private_attr`  --> src/trx5g/test.py:8:9   | 6 |         obj = object().__new__(cls) 7 |         obj.public_attr = 'foo' 8 |         obj._private_attr = 'bar'   |          ```  ### Version  0.16.2
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! It looks like we added special-casing for `super().__new__(cls)` in https://github.com/astral-sh/ruff/pull/16149 but not this `object()` form. It seems okay to me to extend that special handling to `object()` and maybe `object` too?

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

### Incident Patch 1: `678d6b97` (2026-10-02)
**Commit Message**: [`flake8-bugbear`] Report the method name and a more precise range (`B005`) (#27050)

The diagnostic message now reports the method name, and range was
adapted to be more precise and only
cover the call and argument.

Fixes https://github.com/astral-sh/ruff/issues/27085.

## Summary

I got confused by one report of this rule. This is how it looks before
this PR:

```
B005 Using `.strip()` with multi-character strings is misleading
    |
215 | key = ""
216 |
217 | key = key.strip("--").lstrip('--')
    |       ^^^^^^^^^^^^^^^
    |

B005 Using `.strip()` with multi-character strings is misleading
    |
215 | key = ""
216 |
217 | key = key.strip("--").lstrip('--')
    |       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    |
```

## Test Plan

---------

Co-authored-by: Brent Westbrook <[REDACTED_EMAIL]>

**File**: `crates/ruff_linter/resources/test/fixtures/flake8_bugbear/B005.py` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
 s.strip("ああ")  # warning
 s.strip("\ufeff")  # no warning
 s.strip("\u0074\u0065\u0073\u0074")  # warning
+s.strip("--").lstrip("--")  # two warnings
 
 from somewhere import other_type, strip
 
```

**File**: `crates/ruff_linter/src/preview.rs` (modified, +5/-0)
```diff
@@ -357,6 +357,11 @@ pub const fn is_warn_on_unknown_selectors_enabled(preview: PreviewMode) -> bool
     preview.is_enabled()
 }
 
+// https://github.com/astral-sh/ruff/pull/27050
+pub(crate) const fn is_b005_precise_diagnostic_enabled(settings: &LinterSettings) -> bool {
+    settings.preview.is_enabled()
+}
+
 // https://github.com/astral-sh/ruff/pull/27313
 pub(crate) const fn is_pragma_excluded_from_import_width_enabled(preview: PreviewMode) -> bool {
     preview.is_enabled()
```

**File**: `crates/ruff_linter/src/rules/flake8_bugbear/mod.rs` (modified, +1/-0)
```diff
@@ -96,6 +96,7 @@ mod tests {
     #[test_case(Rule::MutableArgumentDefault, Path::new("B006_9.py"))]
     #[test_case(Rule::MutableArgumentDefault, Path::new("B006_B008.py"))]
     #[test_case(Rule::MutableArgumentDefault, Path::new("B006_1.pyi"))]
+    #[test_case(Rule::StripWithMultiCharacters, Path::new("B005.py"))]
     fn preview_rules(rule_code: Rule, path: &Path) -> Result<()> {
         let snapshot = format!("preview__{}_{}", rule_code.name(), path.to_string_lossy());
         let diagnostics = test_path(
```

**File**: `crates/ruff_linter/src/rules/flake8_bugbear/rules/strip_with_multi_characters.rs` (modified, +28/-6)
```diff
@@ -2,11 +2,13 @@ use itertools::Itertools;
 use ruff_python_ast::{self as ast, Expr};
 
 use ruff_macros::{ViolationMetadata, derive_message_formats};
-use ruff_text_size::Ranged;
+use ruff_text_size::{Ranged, TextRange};
 
 use crate::Violation;
 use crate::checkers::ast::Checker;
 use crate::codes::Category;
+use crate::preview::is_b005_precise_diagnostic_enabled;
+use crate::rules::pylint::rules::StripKind;
 
 /// ## What it does
 /// Checks for uses of multi-character strings in `.strip()`, `.lstrip()`, and
@@ -43,16 +45,31 @@ use crate::codes::Category;
 /// "text.txt".removesuffix(".txt")  # "text"
 /// ```
 ///
+/// ## Preview
+/// In [preview], the diagnostic message reflects the actual method name
+/// (`.strip()`, `.lstrip()`, or `.rstrip()`), and the diagnostic range covers
+/// the method call rather than the entire expression.
+///
 /// ## References
 /// - [Python documentation: `str.strip`](https://docs.python.org/3/library/stdtypes.html#str.strip)
+///
+/// [preview]: https://docs.astral.sh/ruff/preview/
 #[derive(ViolationMetadata)]
 #[violation_metadata(stable_since = "v0.0.106", category = Category::Correctness)]
-pub(crate) struct StripWithMultiCharacters;
+pub(crate) struct StripWithMultiCharacters {
+    /// The method name is only reflected in the message in preview mode.
+    strip: Option<StripKind>,
+}
 
 impl Violation for StripWithMultiCharacters {
     #[derive_message_formats]
     fn message(&self) -> String {
-        "Using `.strip()` with multi-character strings is misleading".to_string()
+        let Self { strip } = self;
+        if let Some(strip) = strip {
+            format!("Using `.{strip}()` with multi-character strings is misleading")
+        } else {
+            "Using `.strip()` with multi-character strings is misleading".to_string()
+        }
     }
 }
 
@@ -66,15 +83,20 @@ pub(crate) fn strip_with_multi_characters(
     let Expr::Attribute(ast::ExprAttribute { attr, .. }) = func else {
         return;
     };
-    if !matches!(attr.as_str(), "strip" | "lstrip" | "rstrip") {
+    let Some(strip) = StripKind::from_str(attr.as_str()) else {
         return;
-    }
+    };
 
     let [Expr::StringLiteral(ast::ExprStringLiteral { value, .. })] = args else {
         return;
     };
 
     if value.chars().count() > 1 && !value.chars().all_unique() {
-        checker.report_diagnostic(StripWithMultiCharacters, expr.range());
+        let (strip, range) = if is_b005_precise_diagnostic_enabled(checker.settings()) {
+            (Some(strip), TextRange::new(attr.start(), expr.end()))
+        } else {
+            (None, expr.range())
+        };
+        checker.report_diagnostic(StripWithMultiCharacters { strip }, range);
     }
 }
```

**File**: `crates/ruff_linter/src/rules/flake8_bugbear/snapshots/ruff_linter__rules__flake8_bugbear__tests__preview__strip-with-multi-characters_B005.py.snap` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+---
+source: crates/ruff_linter/src/rules/flake8_bugbear/mod.rs
+---
+B005 Using `.strip()` with multi-character strings is misleading
+ --> B005.py:4:3
+  |
+2 | s.strip(s)  # no warning
+3 | s.strip("we")  # no warning
+4 | s.strip(".facebook.com")  # warning
+  |   ^^^^^^^^^^^^^^^^^^^^^^
+5 | s.strip("e")  # no warning
+6 | s.strip("\n\t ")  # no warning
+  |
+
+B005 Using `.strip()` with multi-character strings is misleading
+ --> B005.py:7:3
+  |
+5 | s.strip("e")  # no warning
+6 | s.strip("\n\t ")  # no warning
+7 | s.strip(r"\n\t ")  # warning
+  |   ^^^^^^^^^^^^^^^
+8 | s.lstrip(s)  # no warning
+9 | s.lstrip("we")  # no warning
+  |
+
+B005 Using `.lstrip()` with multi-character strings is misleading
+  --> B005.py:10:3
+   |
+ 8 | s.lstrip(s)  # no warning
+ 9 | s.lstrip("we")  # no warning
+10 | s.lstrip(".facebook.com")  # warning
+   |   ^^^^^^^^^^^^^^^^^^^^^^^
+11 | s.lstrip("e")  # no warning
+12 | s.lstrip("\n\t ")  # no warning
+   |
+
+B005 Using `.lstrip()` with multi-character strings is misleading
+  --> B005.py:13:3
+   |
+11 | s.lstrip("e")  # no warning
+12 | s.lstrip("\n\t ")  # no warning
+13 | s.lstrip(r"\n\t ")  # warning
+   |   ^^^^^^^^^^^^^^^^
+14 | s.rstrip(s)  # no warning
+15 | s.rstrip("we")  # warning
+   |
+
+B005 Using `.rstrip()` with multi-character strings is misleading
+  --> B005.py:16:3
+   |
+14 | s.rstrip(s)  # no warning
+15 | s.rstrip("we")  # warning
+16 | s.rstrip(".facebook.com")  # warning
+   |   ^^^^^^^^^^^^^^^^^^^^^^^
+17 | s.rstrip("e")  # no warning
+18 | s.rstrip("\n\t ")  # no warning
+   |
+
+B005 Using `.rstrip()` with multi-character strings is misleading
+  --> B005.py:19:3
+   |
+17 | s.rstrip("e")  # no warning
+18 | s.rstrip("\n\t ")  # no warning
+19 | s.rstrip(r"\n\t ")  # warning
+   |   ^^^^^^^^^^^^^^^^
+20 | s.strip("a")  # no warning
+21 | s.strip("あ")  # no warning
+   |
+
+B005 Using `.strip()` with multi-character strings is misleading
+  --> B005.py:22:3
+   |
+20 | s.strip("a")  # no warning
+21 | s.strip("あ")  # no warning
+22 | s.strip("ああ")  # warning
+   |   ^^^^^^^^^^^^^
+23 | s.strip("\ufeff")  # no warning
+24 | s.strip("\u0074\u0065\u0073\u0074")  # warning
+   |
+
+B005 Using `.strip()` with multi-character strings is misleading
+  --> B005.py:24:3
+   |
+22 | s.strip("ああ")  # warning
+23 | s.strip("\ufeff")  # no warning
+24 | s.strip("\u0074\u0065\u0073\u0074")  # warning
+   |   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+25 | s.strip("--").lstrip("--")  # two warnings
+   |
+
+B005 Using `.strip()` with multi-character strings is misleading
+  --> B005.py:25:3
+   |
+23 | s.strip("\ufeff")  # no warning
+24 | s.strip("\u0074\u0065\u0073\u0074")  # warning
+25 | s.strip("--").lstrip("--")  # two warnings
+   |   ^^^^^^^^^^^
+26 |
+27 | from somewhere import other_type, strip
+   |
+
+B005 Using `.lstrip()` with multi-character strings is misleading
+  --> B005.py:25:15
+   |
+23 | s.strip("\ufeff")  # no warning
+24 | s.strip("\u0074\u0065\u0073\u0074")  # warning
+25 | s.strip("--").lstrip("--")  # two warnings
+   |               ^^^^^^^^^^^^
+26 |
+27 | from somewhere import other_type, strip
+   |
```

**File**: `crates/ruff_linter/src/rules/flake8_bugbear/snapshots/ruff_linter__rules__flake8_bugbear__tests__strip-with-multi-characters_B005.py.snap` (modified, +23/-2)
```diff
@@ -85,6 +85,27 @@ B005 Using `.strip()` with multi-character strings is misleading
 23 | s.strip("\ufeff")  # no warning
 24 | s.strip("\u0074\u0065\u0073\u0074")  # warning
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
-25 |
-26 | from somewhere import other_type, strip
+25 | s.strip("--").lstrip("--")  # two warnings
+   |
+
+B005 Using `.strip()` with multi-character strings is misleading
+  --> B005.py:25:1
+   |
+23 | s.strip("\ufeff")  # no warning
+24 | s.strip("\u0074\u0065\u0073\u0074")  # warning
+25 | s.strip("--").lstrip("--")  # two warnings
+   | ^^^^^^^^^^^^^
+26 |
+27 | from somewhere import other_type, strip
+   |
+
+B005 Using `.strip()` with multi-character strings is misleading
+  --> B005.py:25:1
+   |
+23 | s.strip("\ufeff")  # no warning
+24 | s.strip("\u0074\u0065\u0073\u0074")  # warning
+25 | s.strip("--").lstrip("--")  # two warnings
+   | ^^^^^^^^^^^^^^^^^^^^^^^^^^
+26 |
+27 | from somewhere import other_type, strip
    |
```

**File**: `crates/ruff_linter/src/rules/pylint/rules/bad_str_strip_call.rs` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ pub(crate) enum StripKind {
 }
 
 impl StripKind {
-    fn from_str(s: &str) -> Option<Self> {
+    pub(crate) fn from_str(s: &str) -> Option<Self> {
         match s {
             "strip" => Some(Self::Strip),
             "lstrip" => Some(Self::LStrip),
```

---

### Incident Patch 2: `3b1c9287` (2026-10-02)
**Commit Message**: [`pyflakes`] Mark the fix as unsafe when it creates a docstring (`F541`) (#28258)

## Summary

The fix is now unsafe in docstring positions. The reason is that
removing the `f` turns the f-string into a string literal, and this
changes what the program exposes as documentation.

It does not touch the checker or any other rule. The scope is wider than
what was reported in the issue. Listing the positions to make the scope
clear:

- the first statement of a module body
- the first statement of a class body
- the first statement of a function body
- after a simple assignment (`a = 1`) at module level or in a class body
- after an annotated assignment (`b: int = 2`), likewise

I say documentation and not runtime because attribute docstrings don't
touch `__doc__`.

`c = d = 3` stays safe because this mirrors the checker's own criterion.

Fixes #18807

## Test Plan

2828 passed, 0 failed. Tested with:

- new snapshot with 11 diagnostics: 6 with the unsafe note, 5 without it
- `--fix` without the flag on the unsafe case and the file didn't
change; with `--unsafe-fixes` it did. The safe case was fixed without
the flag
- the `F541.py` snapshot didn't move
- `cargo clippy --workspace --all-t

**File**: `crates/ruff_linter/resources/mdtest/pyflakes/f-string-missing-placeholders.md` (added, +271/-0)
```diff
@@ -0,0 +1,271 @@
+# `f-string-missing-placeholders` (`F541`)
+
+```toml
+lint.select = ["F541"]
+```
+
+## Docstring positions
+
+Removing the `f` prefix from an f-string in a docstring position turns it into a docstring, so the
+fix is unsafe there. See [#18807].
+
+### Module docstring
+
+```py
+f"module docstring"  # snapshot: f-string-missing-placeholders
+```
+
+```snapshot
+error[F541]: f-string without any placeholders
+ --> src/mdtest_snippet.py:1:1
+  |
+1 | f"module docstring"  # snapshot: f-string-missing-placeholders
+  | ^^^^^^^^^^^^^^^^^^^
+help: Remove extraneous `f` prefix
+  |
+  - f"module docstring"  # snapshot: f-string-missing-placeholders
+1 + "module docstring"  # snapshot: f-string-missing-placeholders
+  |
+note: This is an unsafe fix and may change runtime behavior
+```
+
+### Function and class docstrings
+
+```py
+def function():
+    f"function docstring"  # snapshot: f-string-missing-placeholders
+
+
+class Class:
+    f"class docstring"  # snapshot: f-string-missing-placeholders
+```
+
+```snapshot
+error[F541]: f-string without any placeholders
+ --> src/mdtest_snippet.py:2:5
+  |
+2 |     f"function docstring"  # snapshot: f-string-missing-placeholders
+  |     ^^^^^^^^^^^^^^^^^^^^^
+help: Remove extraneous `f` prefix
+  |
+1 | def function():
+  -     f"function docstring"  # snapshot: f-string-missing-placeholders
+2 +     "function docstring"  # snapshot: f-string-missing-placeholders
+3 |
+  |
+note: This is an unsafe fix and may change runtime behavior
+
+
+error[F541]: f-string without any placeholders
+ --> src/mdtest_snippet.py:6:5
+  |
+6 |     f"class docstring"  # snapshot: f-string-missing-placeholders
+  |     ^^^^^^^^^^^^^^^^^^
+help: Remove extraneous `f` prefix
+  |
+5 | class Class:
+  -     f"class docstring"  # snapshot: f-string-missing-placeholders
+6 +     "class docstring"  # snapshot: f-string-missing-placeholders
+  |
+note: This is an unsafe fix and may change runtime behavior
+```
+
+### Attribute docstrings
+
+A string literal following a simple assignment at module level or in a class body is an attribute
+docstring, which documentation tools pick up.
+
+```py
+a = 1
+f"attribute docstring"  # snapshot: f-string-missing-placeholders
+
+b: int = 2
+f"annotated attribute docstring"  # snapshot: f-string-missing-placeholders
+
+
+class Class:
+    c = 1
+    f"attribute docstring in a class body"  # snapshot: f-string-missing-placeholders
+```
+
+```snapshot
+error[F541]: f-string without any placeholders
+ --> src/mdtest_snippet.py:2:1
+  |
+2 | f"attribute docstring"  # snapshot: f-string-missing-placeholders
+  | ^^^^^^^^^^^^^^^^^^^^^^
+help: Remove extraneous `f` prefix
+  |
+1 | a = 1
+  - f"attribute docstring"  # snapshot: f-string-missing-placeholders
+2 + "attribute docstring"  # snapshot: f-string-missing-placeholders
+3 |
+  |
+note: This is an unsafe fix and may change runtime behavior
+
+
+error[F541]: f-string without any placeholders
+ --> src/mdtest_snippet.py:5:1
+  |
+5 | f"annotated attribute docstring"  # snapshot: f-string-missing-placeholders
+  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+help: Remove extraneous `f` prefix
+  |
+4 | b: int = 2
+  - f"annotated attribute docstring"  # snapshot: f-string-missing-placeholders
+5 + "annotated attribute docstring"  # snapshot: f-string-missing-placeholders
+6 |
+  |
+note: This is an unsafe fix and may change runtime behavior
+
+
+error[F541]: f-string without any placeholders
+  --> src/mdtest_snippet.py:10:5
+   |
+10 |     f"attribute docstring in a class body"  # snapshot: f-string-missing-placeholders
+   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+help: Remove extraneous `f` prefix
+   |
+9  |     c = 1
+   -     f"attribute docstring in a class body"  # snapshot: f-string-missing-placeholders
+10 +     "attribute docstring in a class body"  # snapshot: f-string-missing-placeholders
+11 | class Class:
+   |
+note: This is an unsafe fix and may change runtime behavior
+```
+
+This also applies to assignments nested within a class body.
+
+```py
+class Class:
+    if condition:
+        value = 1
+        f"attribute docstring"  # snapshot: f-string-missing-placeholders
+```
+
+```snapshot
+error[F541]: f-string without any placeholders
+  --> src/mdtest_snippet.py:14:9
+   |
+14 |         f"attribute docstring"  # snapshot: f-string-missing-placeholders
+   |         ^^^^^^^^^^^^^^^^^^^^^^
+help: Remove extraneous `f` prefix
+   |
+13 |         value = 1
+   -         f"attribute docstring"  # snapshot: f-string-missing-placeholders
+14 +         "attribute docstring"  # snapshot: f-string-missing-placeholders
+   |
+note: This is an unsafe fix and may change runtime behavior
+```
+
+## Not docstring positions
+
+The fix stays safe when removing the prefix does not create a docstring:
+
+```py
+c = d = 3
+f"multiple targets"  # snapshot: f-string-missing-placeholders
+
+e, g = 4, 5
+f"tuple target"  # snapshot: f-string-missing-placeholders
+
+print(1)
+f"after a statement that is n
```

**File**: `crates/ruff_linter/resources/test/fixtures/flake8_implicit_str_concat/ISC003_docstring.py` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     + "?"
 )
 
-# Not a docstring position: not the first statement in the module body.
+# Attribute docstring position (follows a simple assignment): fix is unsafe.
 x = 1
 (
     "not"
```

**File**: `crates/ruff_linter/src/checkers/ast/mod.rs` (modified, +45/-0)
```diff
@@ -37,6 +37,7 @@ use ruff_python_ast::identifier::Identifier;
 use ruff_python_ast::name::QualifiedName;
 use ruff_python_ast::str::Quote;
 use ruff_python_ast::token::Tokens;
+use ruff_python_ast::traversal::{self, EnclosingSuite};
 use ruff_python_ast::visitor::{Visitor, walk_except_handler, walk_pattern};
 use ruff_python_ast::{
     self as ast, AnyParameterRef, ArgOrKeyword, Comprehension, ElifElseClause, ExceptHandler, Expr,
@@ -688,6 +689,50 @@ impl<'a> Checker<'a> {
     pub(crate) fn docstring_state(&self) -> DocstringState {
         self.docstring_state
     }
+
+    /// Returns `true` if the expression spanning `range` sits in a docstring position: it makes
+    /// up the whole of the current expression statement, and that statement is either the first
+    /// in a module, class or function body, or follows a simple assignment at module level or
+    /// in class scope (an attribute docstring).
+    ///
+    /// This only checks the position. Whether the expression is of a type that Python treats as
+    /// a docstring (a plain string literal) is up to the caller.
+    pub(crate) fn in_docstring_position(&self, range: TextRange) -> bool {
+        let stmt = self.semantic.current_statement();
+        let Some(ast::StmtExpr { value, .. }) = stmt.as_expr_stmt() else {
+            return false;
+        };
+        if value.range() != range {
+            return false;
+        }
+
+        let parent = self.semantic.current_statement_parent();
+        let suite = match parent {
+            Some(parent) => traversal::suite(stmt, parent),
+            // No parent statement: the statement is at module level.
+            None => EnclosingSuite::new(self.module.python_ast, stmt.into()),
+        };
+        let Some(suite) = suite else {
+            return false;
+        };
+
+        // Attribute docstrings are also recognized in conditional suites within a class.
+        let allows_attribute_docstring =
+            self.semantic.at_top_level() || self.semantic.current_scope().kind.is_class();
+        match suite.previous_sibling() {
+            None => matches!(
+                parent,
+                None | Some(Stmt::FunctionDef(_) | Stmt::ClassDef(_))
+            ),
+            Some(Stmt::Assign(ast::StmtAssign { targets, .. })) => {
+                allows_attribute_docstring && matches!(targets.as_slice(), [Expr::Name(_)])
+            }
+            Some(Stmt::AnnAssign(ast::StmtAnnAssign { target, .. })) => {
+                allows_attribute_docstring && target.is_name_expr()
+            }
+            Some(_) => false,
+        }
+    }
 }
 
 pub(crate) struct TypingImporter<'a, 'b> {
```

**File**: `crates/ruff_linter/src/rules/flake8_implicit_str_concat/rules/explicit.rs` (modified, +2/-21)
```diff
@@ -1,7 +1,7 @@
 use ruff_diagnostics::Applicability;
 use ruff_macros::{ViolationMetadata, derive_message_formats};
 use ruff_python_ast::token::{TokenKind, parenthesized_range};
-use ruff_python_ast::{self as ast, Expr, Operator, Stmt};
+use ruff_python_ast::{self as ast, Expr, Operator};
 use ruff_python_trivia::is_python_whitespace;
 use ruff_source_file::LineRanges;
 use ruff_text_size::{Ranged, TextLen, TextRange, TextSize};
@@ -133,26 +133,7 @@ fn fix_creates_docstring(checker: &Checker, expr: &ast::ExprBinOp) -> bool {
         return false;
     }
 
-    let semantic = checker.semantic();
-    let stmt = semantic.current_statement();
-    let Some(ast::StmtExpr { value, .. }) = stmt.as_expr_stmt() else {
-        return false;
-    };
-    // The concatenation must be the entire expression statement.
-    if value.range() != expr.range() {
-        return false;
-    }
-
-    // A docstring must be the first statement in the body of a module,
-    // function, or class.
-    let body = match semantic.current_statement_parent() {
-        Some(Stmt::FunctionDef(function)) => &function.body,
-        Some(Stmt::ClassDef(class)) => &class.body,
-        // No parent statement: the statement is at module level.
-        None => checker.module.python_ast,
-        _ => return false,
-    };
-    body.first() == Some(stmt)
+    checker.in_docstring_position(expr.range())
 }
 
 fn generate_fix(checker: &Checker, expr_bin_op: &ast::ExprBinOp) -> Option<Fix> {
```

**File**: `crates/ruff_linter/src/rules/flake8_implicit_str_concat/snapshots/ruff_linter__rules__flake8_implicit_str_concat__tests__explicit-string-concatenation_ISC003_docstring.py.snap` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ help: Remove redundant '+' operator to implicitly concatenate
 13 +      " a docstring"
 14 | )
    |
+note: This is an unsafe fix and may change runtime behavior
 
 ISC003 [*] Explicitly concatenated string should be implicitly concatenated
   --> ISC003_docstring.py:20:9
```

**File**: `crates/ruff_linter/src/rules/pyflakes/rules/f_string_missing_placeholders.rs` (modified, +16/-11)
```diff
@@ -1,3 +1,4 @@
+use ruff_diagnostics::Applicability;
 use ruff_macros::{ViolationMetadata, derive_message_formats};
 use ruff_python_ast as ast;
 use ruff_text_size::{Ranged, TextRange, TextSize};
@@ -52,6 +53,9 @@ use crate::{AlwaysFixableViolation, Edit, Fix};
 ///
 /// See [#10885](https://github.com/astral-sh/ruff/issues/10885) for more.
 ///
+/// ## Fix safety
+/// The fix is marked unsafe when it would create a docstring.
+///
 /// ## References
 /// - [PEP 498 – Literal String Interpolation](https://peps.python.org/pep-0498/)
 #[derive(ViolationMetadata)]
@@ -80,6 +84,12 @@ pub(crate) fn f_string_missing_placeholders(checker: &Checker, expr: &ast::ExprF
         return;
     }
 
+    let applicability = if checker.in_docstring_position(expr.range()) {
+        Applicability::Unsafe
+    } else {
+        Applicability::Safe
+    };
+
     for f_string in expr.value.f_strings() {
         let first_char = checker
             .locator()
@@ -95,10 +105,9 @@ pub(crate) fn f_string_missing_placeholders(checker: &Checker, expr: &ast::ExprF
 
         let mut diagnostic =
             checker.report_diagnostic(FStringMissingPlaceholders, f_string.range());
-        diagnostic.set_fix(convert_f_string_to_regular_string(
-            prefix_range,
-            f_string.range(),
-            checker.locator(),
+        diagnostic.set_fix(Fix::applicable_edit(
+            convert_f_string_to_regular_string(prefix_range, f_string.range(), checker.locator()),
+            applicability,
         ));
     }
 }
@@ -112,12 +121,12 @@ fn unescape_f_string(content: &str) -> String {
     content.replace("{{", "{").replace("}}", "}")
 }
 
-/// Generate a [`Fix`] to rewrite an f-string as a regular string.
+/// Generate an [`Edit`] to rewrite an f-string as a regular string.
 fn convert_f_string_to_regular_string(
     prefix_range: TextRange,
     node_range: TextRange,
     locator: &Locator,
-) -> Fix {
+) -> Edit {
     // Extract the f-string body.
     let mut content =
         unescape_f_string(locator.slice(TextRange::new(prefix_range.end(), node_range.end())));
@@ -134,9 +143,5 @@ fn convert_f_string_to_regular_string(
         content.insert(0, ' ');
     }
 
-    Fix::safe_edit(Edit::replacement(
-        content,
-        prefix_range.start(),
-        node_range.end(),
-    ))
+    Edit::replacement(content, prefix_range.start(), node_range.end())
 }
```

---

### Incident Patch 3: `b4c75cd7` (2026-10-02)
**Commit Message**: [`flake8-builtins`] Expand checks in class scopes (`A001`) (#29076)

## Summary

Inside a class body, `flake8-builtins` reports a `for`, `with ... as`,
or `:=` target that shadows a builtin, but A001 does not. The A001 call
site skipped every stored name in class scope because A003 handles class
attributes, but A003 only considers assignment and annotation bindings,
so those other binding kinds were reported by neither rule. The
class-scope skip now applies only to the binding kinds A003 handles, by
checking the stored name's `BindingKind`. Attribute and method bindings
in a class still go to A003, so there's no double-reporting.

This is the gap left after #20178, which I picked up because no pull
request was opened for it.

Fixes #20179

## Test Plan

I have added new class-scope cases in the A001 fixture covering both the
three bindings that now fire and the attribute and method bindings that
stay silent, updated the snapshot with three new diagnostics, and ran
the `flake8-builtins` tests, `clippy`, and `fmt`.

**File**: `crates/ruff_linter/resources/test/fixtures/flake8_builtins/A001.py` (modified, +19/-0)
```diff
@@ -30,6 +30,25 @@ class slice:
 [0 for sum in ()]
 
 
+class C:
+    # Attribute bindings are handled by A003, not A001.
+    id = 1
+    id: int = 2
+
+    def id(self):
+        pass
+
+    # Other class-scope bindings shadow the builtin like at module level.
+    # See https://github.com/astral-sh/ruff/issues/20179
+    for id in [1]:
+        pass
+
+    (id := 2)
+
+    with open('file') as id:
+        pass
+
+
 # These should not report violations as discussed in
 # https://github.com/astral-sh/ruff/issues/16373
 from importlib.machinery import SourceFileLoader
```

**File**: `crates/ruff_linter/src/checkers/ast/analyze/expression.rs` (modified, +2/-4)
```diff
@@ -385,10 +385,8 @@ pub(crate) fn expression(expr: &Expr, checker: &Checker) {
                     if checker.is_rule_enabled(Rule::AmbiguousVariableName) {
                         pycodestyle::rules::ambiguous_variable_name(checker, id, expr.range());
                     }
-                    if !checker.semantic.current_scope().kind.is_class() {
-                        if checker.is_rule_enabled(Rule::BuiltinVariableShadowing) {
-                            flake8_builtins::rules::builtin_variable_shadowing(checker, id, *range);
-                        }
+                    if checker.is_rule_enabled(Rule::BuiltinVariableShadowing) {
+                        flake8_builtins::rules::builtin_variable_shadowing(checker, id, *range);
                     }
                 }
                 _ => {}
```

**File**: `crates/ruff_linter/src/rules/flake8_builtins/rules/builtin_variable_shadowing.rs` (modified, +16/-0)
```diff
@@ -1,4 +1,5 @@
 use ruff_macros::{ViolationMetadata, derive_message_formats};
+use ruff_python_semantic::BindingKind;
 use ruff_text_size::TextRange;
 
 use crate::Violation;
@@ -69,6 +70,21 @@ pub(crate) fn builtin_variable_shadowing(checker: &Checker, name: &str, range: T
         return;
     }
 
+    // In class scope, attribute bindings (e.g., `id = 1`) are covered by
+    // `builtin-attribute-shadowing` (A003), but other bindings (e.g., a `for`
+    // target or `:=`) are not and still shadow the builtin.
+    let scope = checker.semantic().current_scope();
+    if scope.kind.is_class()
+        && scope.get(name).is_none_or(|binding_id| {
+            matches!(
+                checker.semantic().binding(binding_id).kind,
+                BindingKind::Assignment | BindingKind::Annotation
+            )
+        })
+    {
+        return;
+    }
+
     if shadows_builtin(
         name,
         checker.source_type,
```

**File**: `crates/ruff_linter/src/rules/flake8_builtins/snapshots/ruff_linter__rules__flake8_builtins__tests__builtin-variable-shadowing_A001.py.snap` (modified, +31/-0)
```diff
@@ -173,3 +173,34 @@ A001 Variable `sum` is shadowing a Python builtin
 29 |
 30 | [0 for sum in ()]
    |        ^^^
+
+A001 Variable `id` is shadowing a Python builtin
+  --> A001.py:43:9
+   |
+41 |     # Other class-scope bindings shadow the builtin like at module level.
+42 |     # See https://github.com/astral-sh/ruff/issues/20179
+43 |     for id in [1]:
+   |         ^^
+44 |         pass
+   |
+
+A001 Variable `id` is shadowing a Python builtin
+  --> A001.py:46:6
+   |
+44 |         pass
+45 |
+46 |     (id := 2)
+   |      ^^
+47 |
+48 |     with open('file') as id:
+   |
+
+A001 Variable `id` is shadowing a Python builtin
+  --> A001.py:48:26
+   |
+46 |     (id := 2)
+47 |
+48 |     with open('file') as id:
+   |                          ^^
+49 |         pass
+   |
```

---

### Incident Patch 4: `0a7f89cd` (2026-10-02)
**Commit Message**: [ty] Minimize timeouts in py-fuzzer (#29045)

**File**: `.github/workflows/ci.yaml` (modified, +4/-2)
```diff
@@ -847,13 +847,13 @@ jobs:
           fi
 
   fuzz-ty:
-    name: "Fuzz for new ty panics"
+    name: "Fuzz for new ty panics/timeouts"
     runs-on: ${{ github.repository == 'astral-sh/ruff' && 'depot-ubuntu-22.04-16' || 'ubuntu-latest' }}
     needs:
       - determine_changes
     # Only runs on pull requests, since that is the only we way we can find the base version for comparison.
     if: ${{ !contains(github.event.pull_request.labels.*.name, 'no-test') && github.event_name == 'pull_request' && (needs.determine_changes.outputs.ty == 'true' || needs.determine_changes.outputs.py-fuzzer == 'true') }}
-    timeout-minutes: ${{ github.repository == 'astral-sh/ruff' && 10 || 20 }}
+    timeout-minutes: ${{ github.repository == 'astral-sh/ruff' && 20 || 40 }}
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
@@ -895,6 +895,8 @@ jobs:
           cargo build --profile=profiling --bin=ty
           mv target/profiling/ty ty-old
 
+          git checkout --detach "$GITHUB_SHA"
+
           (
             uv run \
             --python="${PYTHON_VERSION}" \
```

**File**: `python/py-fuzzer/fuzz.py` (modified, +119/-39)
```diff
@@ -26,10 +26,15 @@
 import argparse
 import ast
 import concurrent.futures
+import contextlib
 import enum
+import os
+import signal
 import subprocess
+import sys
 import tempfile
-from collections.abc import Callable
+import time
+from collections.abc import Callable, Sequence
 from dataclasses import KW_ONLY, dataclass
 from functools import partial
 from pathlib import Path
@@ -45,56 +50,96 @@
 ExitCode = NewType("ExitCode", int)
 
 TY_TARGET_PLATFORM: Final = "linux"
+MINIMIZATION_BUDGET_SECONDS: Final = 60
 
 # ty supports `--python-version=3.8`, but typeshed only supports 3.10+,
 # so that's probably the oldest version we can usefully test with.
 OLDEST_SUPPORTED_PYTHON: Final = "3.10"
 
 
+class MinimizationTimedOut(Exception):
+    """Raised when a minimization check is requested after the time budget expires."""
+
+
+def run_executable(command: Sequence[str | Path], *, input: str | None = None) -> int:
+    """Run a command with a five-second timeout and return its exit code.
+
+    Send `input` to standard input if provided; otherwise, inherit standard
+    input from the caller. Standard output and standard error are discarded.
+    On POSIX, start the command in a new session and, on timeout, kill its
+    process group to terminate any children in that group without killing
+    the caller. On other platforms, kill only the command. Then raise
+    `subprocess.TimeoutExpired`.
+
+    Using a process group here is superior due to the fact that ty can
+    spawn `uv workspace metadata` in a subprocess when `TY_UV=1` is set;
+    killing only ty could leave uv running.
+    """
+    with subprocess.Popen(
+        command,
+        stdin=subprocess.PIPE if input is not None else None,
+        stdout=subprocess.DEVNULL,
+        stderr=subprocess.DEVNULL,
+        text=True,
+        start_new_session=os.name == "posix",
+    ) as process:
+        try:
+            process.communicate(input=input, timeout=5)
+        except subprocess.TimeoutExpired:
+            if os.name == "posix":
+                # The process group may have disappeared since the timeout
+                # if its members exited, leaving nothing in the group to kill.
+                # That would result in a `ProcessLookupError` that can be safely ignored.
+                with contextlib.suppress(ProcessLookupError):
+                    os.killpg(process.pid, signal.SIGKILL)
+            else:
+                process.kill()
+            process.wait()
+            raise
+        return process.wait()
+
+
 def ty_contains_bug(code: str, *, ty_executable: Path) -> bool:
     """Return `True` if the code triggers a panic in type-checking code."""
     with tempfile.TemporaryDirectory() as tempdir:
         input_file = Path(tempdir, "input.py")
         input_file.write_text(code)
-        completed_process = subprocess.run(
-            [
-                ty_executable,
-                "check",
-                input_file,
-                "--python-version",
-                OLDEST_SUPPORTED_PYTHON,
-                "--python-platform",
-                TY_TARGET_PLATFORM,
-            ],
-            capture_output=True,
-            check=False,
-            text=True,
-        )
-    return completed_process.returncode not in {0, 1, 2}
+        command: list[str | Path] = [
+            ty_executable,
+            "check",
+            input_file,
+            "--python-version",
+            OLDEST_SUPPORTED_PYTHON,
+            "--python-platform",
+            TY_TARGET_PLATFORM,
+        ]
+        try:
+            returncode = run_executable(command)
+        except subprocess.TimeoutExpired:
+            return True
+    return returncode not in {0, 1, 2}
 
 
 def ruff_contains_bug(code: str, *, ruff_executable: Path) -> bool:
     """Return `True` if the code triggers a parser error."""
-    completed_process = subprocess.run(
-        [
-            ruff_executable,
-            "check",
-            # Keep project settings out of parser checks, including for older Ruff versions.
-            "--isolated",
-            "--config",
-            "lint.select=[]",
-            "--no-cache",
-            "--target-version",
-            "py314",
-            "--preview",
-            "-",
-        ],
-        capture_output=True,
-        check=False,
-        text=True,
-        input=code,
-    )
-    return completed_process.returncode != 0
+    command: list[str | Path] = [
+        ruff_executable,
+        "check",
+        # Keep project settings out of parser checks, including for older Ruff versions.
+        "--isolated",
+        "--config",
+        "lint.select=[]",
+        "--no-cache",
+        "--target-version",
+        "py314",
+        "--preview",
+        "-",
+    ]
+    try:
+        returncode = run_executable(command, input=code)
+    except subprocess.TimeoutExpired:
+        return True
+    return returncode != 0
 
 
 def contains_bug(code: str, *, executable: Executable, executable
```

---

### Incident Patch 5: `1495c75c` (2026-10-01)
**Commit Message**: Add pull request security reviews to CI (#29056)

This uses the new [shared PR security-review
workflow](https://github.com/astral-sh/github-actions/tree/main/security-pr-review)
to run security reviews on all PRs. It will comment on the PR with
findings if there are any.

Right now pinned by hash to satisfy Zizmor, seems a bit annoying to have
to bump the hash when we change the shared workflow but we might end up
doing something which is less annoying to update at some point.

If it breaks, direct complaints at the security automation team.

Tested using a canary change in
https://github.com/astral-sh/ruff/actions/runs/36903969832/ including a
comment posted
https://github.com/astral-sh/ruff/pull/29056#issuecomment-5936986866 .

**File**: `.github/renovate.json5` (modified, +11/-0)
```diff
@@ -91,6 +91,17 @@
     },
   ],
   customManagers: [
+    // uv release used by the reusable security review workflow.
+    {
+      customType: "regex",
+      managerFilePatterns: ["/^\\.github/workflows/ci\\.yaml$/"],
+      matchStrings: [
+        '# renovate: datasource=github-release-attachments depName=astral-sh/uv\\s+uv-version: "(?<currentValue>[^"\\r\\n]+)"\\s+uv-checksum: "(?<currentDigest>[a-f0-9]{64})"',
+      ],
+      depNameTemplate: "astral-sh/uv",
+      datasourceTemplate: "github-release-attachments",
+      versioningTemplate: "semver",
+    },
     // Maturin version used in maturin-action
     {
       customType: "regex",
```

**File**: `.github/workflows/ci.yaml` (modified, +22/-0)
```diff
@@ -34,6 +34,28 @@ env:
   MDTEST_EXTERNAL: "1"
 
 jobs:
+  security-review:
+    needs: determine_changes
+    if: ${{ github.event_name == 'pull_request' && github.repository == 'astral-sh/ruff' && github.event.pull_request.head.repo.full_name == github.repository && needs.determine_changes.outputs.code == 'true' }}
+    uses: astral-sh/github-actions/.github/workflows/pull-request-security-review.yml@45c506043c254690f2612686e5d5a72c81c251a4
+    with:
+      runner: depot-ubuntu-22.04-16
+      helper-runner: github-ubuntu-24.04-x86_64-4
+      # renovate: datasource=github-release-attachments depName=astral-sh/uv
+      uv-version: "0.12.18"
+      uv-checksum: "89eadd7c76fc063887959510d5ba0ab1264dfd5f1143b925ddb73021a40acf16"
+      # Keep the review tools outside the checkout when switching to the PR head.
+      setup-command: |
+        export UV_PROJECT_ENVIRONMENT="$RUNNER_TEMP/pull-request-review-tools"
+        uv sync --locked --only-dev
+        echo "$UV_PROJECT_ENVIRONMENT/bin" >> "$GITHUB_PATH"
+    secrets: inherit # zizmor: ignore[secrets-inherit]
+    permissions:
+      contents: read
+      id-token: write
+      issues: read
+      pull-requests: read
+
   determine_changes:
     name: "Determine changes"
     # CI on main is redundant in the security repository.
```

---

### Incident Patch 6: `e7869644` (2026-10-01)
**Commit Message**: Authorize shared PR security-review workflow to publish findings (#29052)

The goal is to make ruff/ty CI call the new shared PR security review
workflow. To do that, the workflow needs permission to get a token from
STS to publish comments on the PR. And that policy must be on main
before the PR to integrate the call to the workflow can be tested.

The PR to integrate the call to the workflow will follow.

**File**: `.github/secure-token-service.json` (modified, +10/-0)
```diff
@@ -30,6 +30,16 @@
       "permissions": { "contents": "write", "pull_requests": "write" },
       "target": "ruff"
     },
+    {
+      "caller": "ruff",
+      "environment": "automations",
+      "caller_ref": "refs/pull/*/merge",
+      "caller_workflow": "ci.yaml",
+      "reusable_workflow": "astral-sh/github-actions/.github/workflows/pull-request-security-review.yml@45c506043c254690f2612686e5d5a72c81c251a4",
+      "on": ["pull_request"],
+      "permissions": { "pull_requests": "write" },
+      "target": "ruff"
+    },
     {
       "caller": "ruff",
       "environment": "release",
```

---

### Incident Patch 7: `8546752d` (2026-10-01)
**Commit Message**: [ty] Fix member lookup on union-bounded type variables (#29018)

## Summary

Consider the following example where we call a method on an object of
type `T: E1 | E2`:

```py
class E1:
    def f(self) -> list[Self]:
        return [self]

class E2:
    def f(self) -> set[Self]:
        return {self}

def _[T: E1 | E2](obj: T):
    reveal_type(obj.f())
```

How should the `obj.f` attribute access be resolved? We can't bind
`E1.f` to the full `T: E1 | E2` type, since that would invalidate the
implicit `self: Self` annotation of `E1.f`, with `Self: E1`. But we can
use a trick: we can observe that `T = T & (E1 | E2)`. This is true
because `T` is a subtype of `E1 | E2` due to its bound, and so
intersecting `T` with `E1 | E2` just gives us `T`. We can expand that to
get `T = T & E1 | T & E2`. And on the two elements of this union type,
we *can* actually access `E1.f` and `E2.f`, respectively. Accessing `f`
on the first union element `T & E1` gives us `E1.f` as a bound method
with a receiver of `T & E1`, which is accepted by `Self: E1`. After
doing the same for the second union element, we get:
```
(bound method E1.f with receiver T & E1) | (bound method E2.f with receiver T & E2)
```

This

**File**: `crates/ty_python_semantic/resources/mdtest/call/methods.md` (modified, +4/-10)
```diff
@@ -212,13 +212,9 @@ intersection:
 
 ```py
 def generic_bounds[U: E1 | E2, I: E1 & E2](union: U, intersection: I):
-    # revealed: (bound method U@generic_bounds.f() -> list[U@generic_bounds]) | (bound method U@generic_bounds.f() -> list[U@generic_bounds])
+    # revealed: (bound method (U@generic_bounds & E1).f() -> list[U@generic_bounds & E1]) | (bound method (U@generic_bounds & E2).f() -> list[U@generic_bounds & E2])
     reveal_type(union.f)
-    # TODO: This call should be accepted without errors. Pyright and mypy reveal `list[E1] | list[E2]` here, but
-    # `list[U@generic_bounds]` seems more accurate.
-    # error: [invalid-argument-type] "`U@generic_bounds` does not satisfy upper bound `E2` of type variable `Self`"
-    # error: [invalid-argument-type] "`U@generic_bounds` does not satisfy upper bound `E1` of type variable `Self`"
-    reveal_type(union.f())  # revealed: list[Unknown]
+    reveal_type(union.f())  # revealed: list[U@generic_bounds & E1] | list[U@generic_bounds & E2]
 
     # revealed: (bound method I@generic_bounds.f() -> list[I@generic_bounds]) & (bound method I@generic_bounds.f() -> list[I@generic_bounds])
     reveal_type(intersection.f)
@@ -350,13 +346,11 @@ intersection:
 
 ```py
 def generic_bounds[U: E1 | E2, I: E1 & E2](union: U, intersection: I):
-    # revealed: bound method U@generic_bounds.f() -> list[U@generic_bounds]
+    # revealed: bound method (U@generic_bounds & E1).f() -> list[U@generic_bounds & E1]
     # error: [unresolved-attribute]
     reveal_type(union.f)
-    # TODO: Ideally, this would not emit the `invalid-argument-type` error and reveal `list[U@generic_bounds]`
-    # error: [invalid-argument-type] "`U@generic_bounds` does not satisfy upper bound `E1` of type variable `Self`"
     # error: [unresolved-attribute]
-    reveal_type(union.f())  # revealed: list[Unknown]
+    reveal_type(union.f())  # revealed: list[U@generic_bounds & E1]
 
     # revealed: bound method I@generic_bounds.f() -> list[I@generic_bounds]
     reveal_type(intersection.f)
```

**File**: `crates/ty_python_semantic/resources/mdtest/generics/legacy/classes.md` (modified, +26/-2)
```diff
@@ -1918,12 +1918,36 @@ def use_union(value: A | B):
     reveal_type(value.value)
 
 def use_typevar(value: U):
-    # TODO: This should not error once member lookup supports union upper bounds.
-    # error: [invalid-attribute-access] "Invalid access to descriptor attribute `value`"
     # revealed: int | str
     reveal_type(value.value)
 ```
 
+## Self methods on narrowed union-bounded type variables
+
+Narrowing a union-bounded type variable preserves both the type variable and the narrowing when
+binding `Self` to each member of the upper bound.
+
+```py
+from typing_extensions import Self, TypeVar
+
+class A:
+    def f(self) -> list[Self]:
+        return [self]
+
+class B:
+    def f(self) -> set[Self]:
+        return {self}
+
+class Marker: ...
+
+T = TypeVar("T", bound=A | B)
+
+def f(obj: T):
+    if isinstance(obj, Marker):
+        reveal_type(obj)  # revealed: T@f & Marker
+        reveal_type(obj.f())  # revealed: list[T@f & Marker & A] | set[T@f & Marker & B]
+```
+
 ## Correlated constrained receiver calls
 
 Multiple occurrences of the same constrained type variable have the same assignment. Distributing
```

**File**: `crates/ty_python_semantic/resources/mdtest/generics/legacy/functions.md` (modified, +18/-0)
```diff
@@ -1123,6 +1123,24 @@ def bad_return(x: T) -> T:
     return x + 1
 ```
 
+## Using float as an upper bound
+
+An upper bound of `float` is internally treated as if the bound would be `float | int`. Normal
+arithmetic operations are available on that type:
+
+```py
+from typing_extensions import TypeVar
+
+T = TypeVar("T", bound=float)
+
+def f(value: T):
+    reveal_type(value + 1)  # revealed: float
+    reveal_type(value + 1.0)  # revealed: float
+    # TODO: Adding two values of the bounded type variable should be supported.
+    # error: [unsupported-operator]
+    reveal_type(value + value)  # revealed: Unknown
+```
+
 ## All occurrences of the same typevar have the same type
 
 If a typevar appears multiple times in a function signature, all occurrences have the same type.
```

**File**: `crates/ty_python_semantic/resources/mdtest/generics/pep695/classes.md` (modified, +24/-2)
```diff
@@ -1627,12 +1627,34 @@ def use_union(value: A | B):
     reveal_type(value.value)
 
 def use_typevar[U: A | B](value: U):
-    # TODO: This should not error once member lookup supports union upper bounds.
-    # error: [invalid-attribute-access] "Invalid access to descriptor attribute `value`"
     # revealed: int | str
     reveal_type(value.value)
 ```
 
+## Self methods on narrowed union-bounded type variables
+
+Narrowing a union-bounded type variable preserves both the type variable and the narrowing when
+binding `Self` to each member of the upper bound.
+
+```py
+from typing_extensions import Self
+
+class A:
+    def f(self) -> list[Self]:
+        return [self]
+
+class B:
+    def f(self) -> set[Self]:
+        return {self}
+
+class Marker: ...
+
+def f[T: A | B](obj: T):
+    if isinstance(obj, Marker):
+        reveal_type(obj)  # revealed: T@f & Marker
+        reveal_type(obj.f())  # revealed: list[T@f & Marker & A] | set[T@f & Marker & B]
+```
+
 ## Metaclasses of specialized classes
 
 Specializing a class preserves its valid metaclass. Without an explicit metaclass, conflicting
```

**File**: `crates/ty_python_semantic/resources/mdtest/generics/pep695/functions.md` (modified, +14/-0)
```diff
@@ -1473,6 +1473,20 @@ def bad_return[T: int](x: T) -> T:
     return x + 1
 ```
 
+## Using float as an upper bound
+
+An upper bound of `float` is internally treated as if the bound would be `float | int`. Normal
+arithmetic operations are available on that type:
+
+```py
+def f[T: float](value: T):
+    reveal_type(value + 1)  # revealed: float
+    reveal_type(value + 1.0)  # revealed: float
+    # TODO: Adding two values of the bounded type variable should be supported.
+    # error: [unsupported-operator]
+    reveal_type(value + value)  # revealed: Unknown
+```
+
 ## All occurrences of the same typevar have the same type
 
 If a typevar appears multiple times in a function signature, all occurrences have the same type.
```

**File**: `crates/ty_python_semantic/src/types.rs` (modified, +51/-16)
```diff
@@ -5914,6 +5914,41 @@ impl<'db> Type<'db> {
                     let mut error = None;
                     let mut properties = None;
                     let member = union.map_with_boundness_and_qualifiers(db, env, |elem| {
+                        // Consider a method call on an object of type `T: E1 | E2`:
+                        //
+                        // ```py
+                        // from typing import Self, reveal_type
+                        //
+                        // class E1:
+                        //     def f(self) -> list[Self]:
+                        //         return [self]
+                        //
+                        // class E2:
+                        //     def f(self) -> set[Self]:
+                        //         return {self}
+                        //
+                        // def _[T: E1 | E2](obj: T):
+                        //     reveal_type(obj.f())
+                        // ```
+                        //
+                        // For `T: E1 | E2`, we can't bind `E1.f` to the full receiver type `T`,
+                        // since that would invalidate the implicit `self: Self` annotation of
+                        // `E1.f`, with `Self: E1`. But we can observe that `T = T & (E1 | E2)`:
+                        // `T` is a subtype of `E1 | E2` due to its bound, so intersecting the two
+                        // just gives us `T`. Expanding this gives `T = (T & E1) | (T & E2)`.
+                        //
+                        // On the first union element, we can bind `E1.f` to a receiver of type
+                        // `T & E1`, which is accepted by `Self: E1`, and similarly for `E2.f`.
+                        // In this example, the result is `list[T & E1] | set[T & E2]`.
+                        //
+                        // The `Type::TypeVar` match arm below delegates member lookup to the
+                        // type variable's upper bound (`E1 | E2` in this example), preserving
+                        // the original receiver (`T`). Here, we distribute lookup over the union
+                        // and intersect each member with that receiver to obtain `T & E1`
+                        // and `T & E2`, respectively.
+                        let receiver = receiver.map(|receiver| {
+                            IntersectionType::from_two_elements(db, env, receiver, *elem)
+                        });
                         let result = elem.member_lookup_with_policy_and_receiver(
                             db, env, name_str, policy, receiver,
                         );
@@ -6290,6 +6325,20 @@ impl<'db> Type<'db> {
                     .value_type(db)
                     .member_lookup_with_policy_and_receiver(db, env, name_str, policy, receiver),
 
+                Type::TypeVar(typevar)
+                    if let Some(bound_or_constraints) =
+                        typevar.typevar(db).bound_or_constraints(db, env) =>
+                {
+                    distribute_member_lookup_over_bound_or_constraints(
+                        db,
+                        env,
+                        bound_or_constraints,
+                        receiver.unwrap_or(this),
+                        name_str,
+                        policy,
+                    )
+                }
+
                 _ if policy.no_instance_fallback() => {
                     let receiver = receiver.unwrap_or(this);
                     let result = Type::invoke_descriptor_protocol(
@@ -6340,22 +6389,8 @@ impl<'db> Type<'db> {
                 {
                     Place::declared(Type::TypeVar(typevar.with_paramspec_attr(db, attr))).into()
                 }
-                Type::TypeVar(typevar) => {
-                    let receiver = receiver.unwrap_or(this);
-                    if let Some(bound_or_constraints) =
-                        typevar.typevar(db).bound_or_constraints(db, env)
-                    {
-                        distribute_member_lookup_over_bound_or_constraints(
-                            db,
-                            env,
-                            bound_or_constraints,
-                            receiver,
-                            name_str,
-                            policy,
-                        )
-                    } else {
-                        instance_like_member_lookup(db, env, key, receiver)
-                    }
+                Type::TypeVar(_) => {
+                    instance_like_member_lookup(db, env, key, receiver.unwrap_or(this))
                 }
 
                 Type::NominalInstance(instance)
```

---

### Incident Patch 8: `9368abfd` (2026-10-01)
**Commit Message**: [ty] Fix executable-copy race in CLI tests (#29034)

**File**: `crates/ty/tests/cli/main.rs` (modified, +8/-204)
```diff
@@ -10,16 +10,14 @@ mod scripts;
 mod server;
 mod uv_workspace;
 
-use anyhow::Context as _;
-use insta::Settings;
-use insta::internals::SettingsBindDropGuard;
-use insta_cmd::{assert_cmd_snapshot, get_cargo_bin};
-use std::{
-    fmt::Write,
-    path::{Path, PathBuf},
-    process::Command,
-};
-use tempfile::TempDir;
+#[path = "../common/mod.rs"]
+pub mod common;
+
+use std::fmt::Write;
+
+use insta_cmd::assert_cmd_snapshot;
+
+use common::{CliTest, user_config_directory_env_var};
 
 #[test]
 fn test_quiet_output() -> anyhow::Result<()> {
@@ -834,197 +832,3 @@ fn can_handle_large_binop_expressions() -> anyhow::Result<()> {
 
     Ok(())
 }
-
-pub(crate) struct CliTest {
-    _temp_dir: TempDir,
-    settings: Settings,
-    settings_scope: Option<SettingsBindDropGuard>,
-    project_dir: PathBuf,
-    ty_binary_path: PathBuf,
-}
-
-impl CliTest {
-    pub(crate) fn new() -> anyhow::Result<Self> {
-        let temp_dir = TempDir::new()?;
-
-        // Canonicalize the tempdir path because macos uses symlinks for tempdirs
-        // and that doesn't play well with our snapshot filtering.
-        // Simplify with dunce because otherwise we get UNC paths on Windows.
-        let temp_dir_path = dunce::simplified(
-            &temp_dir
-                .path()
-                .canonicalize()
-                .context("Failed to canonicalize temporary directory path")?,
-        )
-        .to_path_buf();
-        let project_dir = temp_dir_path.join("project");
-        std::fs::create_dir_all(&project_dir)
-            .with_context(|| format!("Failed to create directory `{}`", project_dir.display()))?;
-
-        let mut settings = insta::Settings::clone_current();
-        settings.add_filter(&tempdir_filter(&project_dir), "<temp_dir>/");
-        settings.add_filter(r"\bty\.exe\b", "ty");
-        settings.add_filter(r#"\\(\w\w|\s|\.|")"#, "/$1");
-        // 0.003s
-        settings.add_filter(r"\d.\d\d\ds", "0.000s");
-        settings.add_filter(
-            "INFO Checking file `[^`]+` took more than 100ms \\([^)]+\\)\n",
-            "",
-        );
-        settings.add_filter("INFO Defaulting to python-platform `[^`]+`\n", "");
-        settings.add_filter("INFO Python version: [^,]+, platform: [a-z0-9_]+\n", "");
-        settings.add_filter(
-            r#"The system cannot find the file specified."#,
-            "No such file or directory",
-        );
-
-        let settings_scope = settings.bind_to_scope();
-
-        Ok(Self {
-            project_dir,
-            _temp_dir: temp_dir,
-            settings,
-            settings_scope: Some(settings_scope),
-            ty_binary_path: get_cargo_bin("ty"),
-        })
-    }
-
-    pub(crate) fn with_files<'a>(
-        files: impl IntoIterator<Item = (&'a str, &'a str)>,
-    ) -> anyhow::Result<Self> {
-        let case = Self::new()?;
-        case.write_files(files)?;
-        Ok(case)
-    }
-
-    pub(crate) fn with_file(path: impl AsRef<Path>, content: &str) -> anyhow::Result<Self> {
-        let case = Self::new()?;
-        case.write_file(path, content)?;
-        Ok(case)
-    }
-
-    pub(crate) fn write_files<'a>(
-        &self,
-        files: impl IntoIterator<Item = (&'a str, &'a str)>,
-    ) -> anyhow::Result<()> {
-        for (path, content) in files {
-            self.write_file(path, content)?;
-        }
-
-        Ok(())
-    }
-
-    /// Return [`Self`] with the ty binary copied to the specified path instead.
-    pub(crate) fn with_ty_at(mut self, dest_path: impl AsRef<Path>) -> anyhow::Result<Self> {
-        let dest_path = dest_path.as_ref();
-        let dest_path = self.project_dir.join(dest_path);
-
-        Self::ensure_parent_directory(&dest_path)?;
-        std::fs::copy(&self.ty_binary_path, &dest_path)
-            .with_context(|| format!("Failed to copy ty binary to `{}`", dest_path.display()))?;
-
-        self.ty_binary_path = dest_path;
-        Ok(self)
-    }
-
-    /// Add a filter to the settings and rebind them.
-    pub(crate) fn with_filter(mut self, pattern: &str, replacement: &str) -> Self {
-        self.settings.add_filter(pattern, replacement);
-        // Drop the old scope before binding a new one, otherwise the old scope is dropped _after_
-        // binding and assigning the new one, restoring the settings to their state before the old
-        // scope was bound.
-        drop(self.settings_scope.take());
-        self.settings_scope = Some(self.settings.bind_to_scope());
-        self
-    }
-
-    fn ensure_parent_directory(path: &Path) -> anyhow::Result<()> {
-        if let Some(parent) = path.parent() {
-            std::fs::create_dir_all(parent)
-                .with_context(|| format!("Failed to create directory `{}`", parent.display()))?;
-        }
-        Ok(())
-    }
-
-    pub(crate) fn write_file(&self, path: impl AsRef<Path>, content: &str) -> anyhow::Result<()> {
-        let path = path.as_ref();
-        let path = self.project_dir.join(path);
-
-     
```

**File**: `crates/ty/tests/cli/python_environment.rs` (modified, +1/-328)
```diff
@@ -1,7 +1,7 @@
 use insta_cmd::assert_cmd_snapshot;
 use ruff_python_ast::PythonVersion;
 
-use crate::{CliTest, site_packages_filter};
+use crate::CliTest;
 
 /// Specifying an option on the CLI should take precedence over the same setting in the
 /// project's configuration. Here, this is tested for the Python version.
@@ -1878,333 +1878,6 @@ home = ./
     Ok(())
 }
 
-/// ty should include site packages from its own environment when no other environment is found.
-#[test]
-fn ty_environment_is_only_environment() -> anyhow::Result<()> {
-    let ty_venv_site_packages = if cfg!(windows) {
-        "ty-venv/Lib/site-packages"
-    } else {
-        "ty-venv/lib/python3.13/site-packages"
-    };
-
-    let ty_executable_path = if cfg!(windows) {
-        "ty-venv/Scripts/ty.exe"
-    } else {
-        "ty-venv/bin/ty"
-    };
-
-    let ty_package_path = format!("{ty_venv_site_packages}/ty_package/__init__.py");
-
-    let case = CliTest::with_files([
-        (ty_package_path.as_str(), "class TyEnvClass: ..."),
-        (
-            "ty-venv/pyvenv.cfg",
-            r"
-            home = ./
-            version = 3.13
-            ",
-        ),
-        (
-            "test.py",
-            r"
-            from ty_package import TyEnvClass
-            ",
-        ),
-    ])?;
-
-    let case = case.with_ty_at(ty_executable_path)?;
-    assert_cmd_snapshot!(case.command(), @"
-    success: true
-    exit_code: 0
-    ----- stdout -----
-    All checks passed!
-
-    ----- stderr -----
-    ");
-
-    Ok(())
-}
-
-/// ty should include site packages from both its own environment and a local `.venv`. The packages
-/// from ty's environment should take precedence.
-#[test]
-fn ty_environment_and_discovered_venv() -> anyhow::Result<()> {
-    let ty_venv_site_packages = if cfg!(windows) {
-        "ty-venv/Lib/site-packages"
-    } else {
-        "ty-venv/lib/python3.13/site-packages"
-    };
-
-    let ty_executable_path = if cfg!(windows) {
-        "ty-venv/Scripts/ty.exe"
-    } else {
-        "ty-venv/bin/ty"
-    };
-
-    let local_venv_site_packages = if cfg!(windows) {
-        ".venv/Lib/site-packages"
-    } else {
-        ".venv/lib/python3.13/site-packages"
-    };
-
-    let ty_unique_package = format!("{ty_venv_site_packages}/ty_package/__init__.py");
-    let local_unique_package = format!("{local_venv_site_packages}/local_package/__init__.py");
-    let ty_conflicting_package = format!("{ty_venv_site_packages}/shared_package/__init__.py");
-    let local_conflicting_package =
-        format!("{local_venv_site_packages}/shared_package/__init__.py");
-
-    let case = CliTest::with_files([
-        (ty_unique_package.as_str(), "class TyEnvClass: ..."),
-        (local_unique_package.as_str(), "class LocalClass: ..."),
-        (ty_conflicting_package.as_str(), "class FromTyEnv: ..."),
-        (
-            local_conflicting_package.as_str(),
-            "class FromLocalVenv: ...",
-        ),
-        (
-            "ty-venv/pyvenv.cfg",
-            r"
-            home = ./
-            version = 3.13
-            ",
-        ),
-        (
-            ".venv/pyvenv.cfg",
-            r"
-            home = ./
-            version = 3.13
-            ",
-        ),
-        (
-            "test.py",
-            r"
-            # Should resolve from ty's environment
-            from ty_package import TyEnvClass
-            # Should resolve from local .venv
-            from local_package import LocalClass
-            # Should resolve from ty's environment (takes precedence)
-            from shared_package import FromTyEnv
-            # Should NOT resolve (shadowed by ty's environment version)
-            from shared_package import FromLocalVenv
-            ",
-        ),
-    ])?
-    .with_ty_at(ty_executable_path)?;
-
-    assert_cmd_snapshot!(case.command(), @"
-    success: false
-    exit_code: 1
-    ----- stdout -----
-    error[unresolved-import]: Module `shared_package` has no member `FromLocalVenv`
-     --> test.py:9:28
-      |
-    9 | from shared_package import FromLocalVenv
-      |                            ^^^^^^^^^^^^^
-
-    Found 1 diagnostic
-
-    ----- stderr -----
-    ");
-
-    Ok(())
-}
-
-/// When `VIRTUAL_ENV` is set, ty should *not* discover its own environment's site-packages.
-#[test]
-fn ty_environment_and_active_environment() -> anyhow::Result<()> {
-    let ty_venv_site_packages = if cfg!(windows) {
-        "ty-venv/Lib/site-packages"
-    } else {
-        "ty-venv/lib/python3.13/site-packages"
-    };
-
-    let ty_executable_path = if cfg!(windows) {
-        "ty-venv/Scripts/ty.exe"
-    } else {
-        "ty-venv/bin/ty"
-    };
-
-    let active_venv_site_packages = if cfg!(windows) {
-        "active-venv/Lib/site-packages"
-    } else {
-        "active-venv/lib/python3.13/site-packages"
-    };
-
-    let ty_package_path = format!("{ty_venv_site_packages}/ty_package/__init__.py");
-    let active_package_path = format!("{active
```

**File**: `crates/ty/tests/cli/server.rs` (modified, +0/-19)
```diff
@@ -4,7 +4,6 @@ use std::os::unix::fs::PermissionsExt;
 use std::path::{Path, PathBuf};
 use std::process::Command;
 
-use anyhow::Context as _;
 use insta_cmd::assert_cmd_snapshot;
 
 use crate::CliTest;
@@ -129,24 +128,6 @@ fn find_uses_cwd_when_project_discovery_fails() -> anyhow::Result<()> {
     Ok(())
 }
 
-#[test]
-fn find_does_not_fall_back_to_path_or_own_executable() -> anyhow::Result<()> {
-    let case = CliTest::new()?;
-    let own_ty = venv_with_ty(&case, "own environment")?;
-    let case = case.with_ty_at(&own_ty)?;
-    let path = own_ty.parent().context("ty must have a parent")?;
-
-    assert_cmd_snapshot!(find_command(&case).env("PATH", path), @"
-    success: false
-    exit_code: 1
-    ----- stdout -----
-
-    ----- stderr -----
-    ");
-
-    Ok(())
-}
-
 #[test]
 fn find_rejects_wrong_layout() -> anyhow::Result<()> {
     let case = CliTest::with_file(".venv/pyvenv.cfg", "home = .\n")?;
```

**File**: `crates/ty/tests/common/mod.rs` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
+//! Shared fixtures for ty CLI integration tests.
+
+use std::{
+    path::{Path, PathBuf},
+    process::Command,
+};
+
+use anyhow::Context as _;
+use insta::Settings;
+use insta::internals::SettingsBindDropGuard;
+use insta_cmd::get_cargo_bin;
+use tempfile::TempDir;
+
+pub struct CliTest {
+    _temp_dir: TempDir,
+    settings: Settings,
+    settings_scope: Option<SettingsBindDropGuard>,
+    pub(crate) project_dir: PathBuf,
+    pub(crate) ty_binary_path: PathBuf,
+}
+
+impl CliTest {
+    pub fn new() -> anyhow::Result<Self> {
+        let temp_dir = TempDir::new()?;
+
+        // Canonicalize the tempdir path because macos uses symlinks for tempdirs
+        // and that doesn't play well with our snapshot filtering.
+        // Simplify with dunce because otherwise we get UNC paths on Windows.
+        let temp_dir_path = dunce::simplified(
+            &temp_dir
+                .path()
+                .canonicalize()
+                .context("Failed to canonicalize temporary directory path")?,
+        )
+        .to_path_buf();
+        let project_dir = temp_dir_path.join("project");
+        std::fs::create_dir_all(&project_dir)
+            .with_context(|| format!("Failed to create directory `{}`", project_dir.display()))?;
+
+        let mut settings = insta::Settings::clone_current();
+        settings.add_filter(&tempdir_filter(&project_dir), "<temp_dir>/");
+        settings.add_filter(r"\bty\.exe\b", "ty");
+        settings.add_filter(r#"\\(\w\w|\s|\.|")"#, "/$1");
+        // 0.003s
+        settings.add_filter(r"\d.\d\d\ds", "0.000s");
+        settings.add_filter(
+            "INFO Checking file `[^`]+` took more than 100ms \\([^)]+\\)\n",
+            "",
+        );
+        settings.add_filter("INFO Defaulting to python-platform `[^`]+`\n", "");
+        settings.add_filter("INFO Python version: [^,]+, platform: [a-z0-9_]+\n", "");
+        settings.add_filter(
+            r#"The system cannot find the file specified."#,
+            "No such file or directory",
+        );
+
+        let settings_scope = settings.bind_to_scope();
+
+        Ok(Self {
+            project_dir,
+            _temp_dir: temp_dir,
+            settings,
+            settings_scope: Some(settings_scope),
+            ty_binary_path: get_cargo_bin("ty"),
+        })
+    }
+
+    pub fn with_files<'a>(
+        files: impl IntoIterator<Item = (&'a str, &'a str)>,
+    ) -> anyhow::Result<Self> {
+        let case = Self::new()?;
+        case.write_files(files)?;
+        Ok(case)
+    }
+
+    pub fn with_file(path: impl AsRef<Path>, content: &str) -> anyhow::Result<Self> {
+        let case = Self::new()?;
+        case.write_file(path, content)?;
+        Ok(case)
+    }
+
+    pub fn write_files<'a>(
+        &self,
+        files: impl IntoIterator<Item = (&'a str, &'a str)>,
+    ) -> anyhow::Result<()> {
+        for (path, content) in files {
+            self.write_file(path, content)?;
+        }
+
+        Ok(())
+    }
+
+    /// Add a filter to the settings and rebind them.
+    #[must_use]
+    pub fn with_filter(mut self, pattern: &str, replacement: &str) -> Self {
+        self.settings.add_filter(pattern, replacement);
+        // Drop the old scope before binding a new one, otherwise the old scope is dropped _after_
+        // binding and assigning the new one, restoring the settings to their state before the old
+        // scope was bound.
+        drop(self.settings_scope.take());
+        self.settings_scope = Some(self.settings.bind_to_scope());
+        self
+    }
+
+    pub(crate) fn ensure_parent_directory(path: &Path) -> anyhow::Result<()> {
+        if let Some(parent) = path.parent() {
+            std::fs::create_dir_all(parent)
+                .with_context(|| format!("Failed to create directory `{}`", parent.display()))?;
+        }
+        Ok(())
+    }
+
+    pub fn write_file(&self, path: impl AsRef<Path>, content: &str) -> anyhow::Result<()> {
+        let path = path.as_ref();
+        let path = self.project_dir.join(path);
+
+        Self::ensure_parent_directory(&path)?;
+
+        std::fs::write(&path, &*ruff_python_trivia::textwrap::dedent(content))
+            .with_context(|| format!("Failed to write file `{path}`", path = path.display()))?;
+
+        Ok(())
+    }
+
+    #[cfg(unix)]
+    pub fn write_symlink(
+        &self,
+        original: impl AsRef<Path>,
+        link: impl AsRef<Path>,
+    ) -> anyhow::Result<()> {
+        let link = link.as_ref();
+        let link = self.project_dir.join(link);
+
+        let original = original.as_ref();
+        let original = self.project_dir.join(original);
+
+        Self::ensure_parent_directory(&link)?;
+
+        std::os::unix::fs::symlink(original, &link)
+            .with_context(|| format!("Failed to write symlink `{link}`", link = link.display()))?;
+
+        Ok(())
+    }
+
+    pub fn root(&self) -> &Path {
+        &self.project_dir
+    }
+
+    pub fn command(&self
```

**File**: `crates/ty/tests/self_environment.rs` (added, +404/-0)
```diff
@@ -0,0 +1,404 @@
+//! Tests that execute ty from inside a Python environment.
+//!
+//! Copying the executable can race with any concurrent process spawn: a child can inherit the
+//! writable copy descriptor, causing Linux to reject execution with `ETXTBSY`. Keep these tests
+//! in their own executable, and hold `TEST_LOCK` for every test so copying and spawning cannot
+//! overlap between tests. The other CLI tests can continue to run in parallel.
+
+pub mod common;
+
+use std::{
+    path::Path,
+    sync::{Mutex, PoisonError},
+};
+
+use anyhow::Context as _;
+use insta_cmd::assert_cmd_snapshot;
+
+use common::CliTest;
+
+static TEST_LOCK: Mutex<()> = Mutex::new(());
+
+/// ty should include site packages from its own environment when no other environment is found.
+#[test]
+fn ty_environment_is_only_environment() -> anyhow::Result<()> {
+    let _lock = TEST_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
+
+    let ty_venv_site_packages = if cfg!(windows) {
+        "ty-venv/Lib/site-packages"
+    } else {
+        "ty-venv/lib/python3.13/site-packages"
+    };
+
+    let ty_executable_path = if cfg!(windows) {
+        "ty-venv/Scripts/ty.exe"
+    } else {
+        "ty-venv/bin/ty"
+    };
+
+    let ty_package_path = format!("{ty_venv_site_packages}/ty_package/__init__.py");
+
+    let case = CliTest::with_files([
+        (ty_package_path.as_str(), "class TyEnvClass: ..."),
+        (
+            "ty-venv/pyvenv.cfg",
+            r"
+            home = ./
+            version = 3.13
+            ",
+        ),
+        (
+            "test.py",
+            r"
+            from ty_package import TyEnvClass
+            ",
+        ),
+    ])?;
+
+    let case = case.with_ty_at(ty_executable_path)?;
+    assert_cmd_snapshot!(case.command(), @"
+    success: true
+    exit_code: 0
+    ----- stdout -----
+    All checks passed!
+
+    ----- stderr -----
+    ");
+
+    Ok(())
+}
+
+/// ty should include site packages from both its own environment and a local `.venv`. The packages
+/// from ty's environment should take precedence.
+#[test]
+fn ty_environment_and_discovered_venv() -> anyhow::Result<()> {
+    let _lock = TEST_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
+
+    let ty_venv_site_packages = if cfg!(windows) {
+        "ty-venv/Lib/site-packages"
+    } else {
+        "ty-venv/lib/python3.13/site-packages"
+    };
+
+    let ty_executable_path = if cfg!(windows) {
+        "ty-venv/Scripts/ty.exe"
+    } else {
+        "ty-venv/bin/ty"
+    };
+
+    let local_venv_site_packages = if cfg!(windows) {
+        ".venv/Lib/site-packages"
+    } else {
+        ".venv/lib/python3.13/site-packages"
+    };
+
+    let ty_unique_package = format!("{ty_venv_site_packages}/ty_package/__init__.py");
+    let local_unique_package = format!("{local_venv_site_packages}/local_package/__init__.py");
+    let ty_conflicting_package = format!("{ty_venv_site_packages}/shared_package/__init__.py");
+    let local_conflicting_package =
+        format!("{local_venv_site_packages}/shared_package/__init__.py");
+
+    let case = CliTest::with_files([
+        (ty_unique_package.as_str(), "class TyEnvClass: ..."),
+        (local_unique_package.as_str(), "class LocalClass: ..."),
+        (ty_conflicting_package.as_str(), "class FromTyEnv: ..."),
+        (
+            local_conflicting_package.as_str(),
+            "class FromLocalVenv: ...",
+        ),
+        (
+            "ty-venv/pyvenv.cfg",
+            r"
+            home = ./
+            version = 3.13
+            ",
+        ),
+        (
+            ".venv/pyvenv.cfg",
+            r"
+            home = ./
+            version = 3.13
+            ",
+        ),
+        (
+            "test.py",
+            r"
+            # Should resolve from ty's environment
+            from ty_package import TyEnvClass
+            # Should resolve from local .venv
+            from local_package import LocalClass
+            # Should resolve from ty's environment (takes precedence)
+            from shared_package import FromTyEnv
+            # Should NOT resolve (shadowed by ty's environment version)
+            from shared_package import FromLocalVenv
+            ",
+        ),
+    ])?
+    .with_ty_at(ty_executable_path)?;
+
+    assert_cmd_snapshot!(case.command(), @"
+    success: false
+    exit_code: 1
+    ----- stdout -----
+    error[unresolved-import]: Module `shared_package` has no member `FromLocalVenv`
+     --> test.py:9:28
+      |
+    9 | from shared_package import FromLocalVenv
+      |                            ^^^^^^^^^^^^^
+
+    Found 1 diagnostic
+
+    ----- stderr -----
+    ");
+
+    Ok(())
+}
+
+/// When `VIRTUAL_ENV` is set, ty should *not* discover its own environment's site-packages.
+#[test]
+fn ty_environment_and_active_environment() -> anyhow::Result<()> {
+    let _lock = TEST_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
+
+    let ty_venv_site_packages = if cfg!(windows) {
+       
```

---

### Incident Patch 9: `c97af1e7` (2026-09-30)
**Commit Message**: Add a migration guide for categories (#28087)

Summary
--

As the title says, this PR extends our
[category](https://docs.astral.sh/ruff/linter/#rule-categories) docs to
include a migration guide explaining how to approach a migration to the
new categories. Initially I included a migration script and a
description of how it works, but if we're unlikely to remove linter
groups, it seems less helpful. Our recommendation is basically to
`extend-select` the new categories to round out your existing
configuration, and no dramatic migration is necessary.

I guess this is not really a "migration guide" anymore, as reflected in
the updated section title.

---------

Co-authored-by: Micha Reiser <[REDACTED_EMAIL]>

**File**: `docs/linter.md` (modified, +57/-5)
```diff
@@ -203,10 +203,12 @@ The first five categories compose the default rule set:
     ```
 
 while the remaining four (`security`, `formatting`, `pedantic`, and `restriction`) are off by
-default. For certain projects, you may want to enable either `security` or `formatting` as entire
-categories, but `pedantic` and `restriction` contain a wider variety of opinionated lints, and you
+default. For certain projects, you may want to enable `security` as an entire category, but
+`formatting`, `pedantic`, and `restriction` contain a wider variety of opinionated lints, and you
 will typically only want to select individual rules from these categories directly.
 
+See [Trying out categories](#trying-out-categories) for more detailed steps on getting started.
+
 ### Interaction with other selectors
 
 Categories can be freely mixed with linter groups, linter prefixes, rule codes, and rule names. In
@@ -263,9 +265,59 @@ will select all `E` and `F` rules, with the exception of `F401`. Analogously, a
 
 would select all `suspicious` rules, except for the `UP` rules in that category.
 
-Note that we plan to deprecate and eventually remove the linter groups in the future. If you give
-the new categories a try and run into situations where you need to fall back on linter groups,
-please let us know on the [tracking issue](https://github.com/astral-sh/ruff/issues/27959).
+### Trying out categories
+
+This section is intended to help you choose which categories you want to enable, based on the rules
+and linter groups you have selected and on the types of issues you want to catch.
+
+We expect virtually all projects to want the `correctness` rules enabled. The lints in this category
+include syntax errors that are not yet mapped to `invalid-syntax` diagnostics and other problems
+that cause immediate runtime errors. From there, `suspicious` is likely to be the next most helpful
+category. It includes rules that flag deprecated code, as well as classic footguns like
+`mutable-argument-default` (`B006`) that are almost always wrong but may be intentional in some
+cases. We tried to be conservative with the rules in `correctness`, so many rules like this that are
+only _usually_ accurate are found in `suspicious` instead. In general, you should feel comfortable
+using a `ruff: ignore` comment on diagnostics from the `suspicious` or lower categories but think
+twice (or share feedback!) about suppressing a `correctness` lint.
+
+The rules in the `complexity`, `performance`, and `style` categories are all stylistic, but we feel
+that these rules represent widely-accepted styles in the Python community. As demonstrated by their
+inclusion in the defaults, we expect most projects to want these rules enabled. Again, even if you
+enable these categories, you should feel comfortable ignoring certain rules project-wide or inline
+with suppression comments.
+
+The `security` rules are focused on issues that may cause security vulnerabilities and overlap
+closely with the `flake8-bandit` (`S`) linter group. They are in their own category because these
+rules are intentionally biased toward false positives over false negatives and can be quite noisy.
+However, if your project is security-critical or just security-conscious, you will likely want to
+enable this entire category.
+
+The `formatting` category contains rules that overlap with code formatters like the Ruff formatter
+or Black. If you use a code formatter, you will likely want to leave this category off. On the other
+hand, if you don't use a code formatter and rely on lint rules to enforce a consistent code format, you can select
+those rules from this category. Note that it contains rules beyond those related to PEP 8, however,
+so you may still want to select a subset of the `formatting` rules rather than the whole category.
+
+`pedantic` rules, as you may guess, are pedantic, which can mean either "noisy," leading to many
+diagnostics, or overly opinionated, suggesting changes that many Python users disagree with. Unlike
+the `security` category, you probably will not want to enable this category as a whole. Instead, we
+intend for rules from the `pedantic` category to be selected individually.
+
+The `restriction` category goes beyond being pedantic to arbitrarily restrict even common code
+patterns, such as `print` (`T201`) or `assert` (`S101`). Like the `pedantic` category, we do not
+recommend enabling `restriction` as a whole. If you enable any `restriction` lints, they should be
+chosen narrowly for your project's needs.
+
+If you're already using `extend-select` to extend the default rule set, you'll inherit the
+category-based defaults automatically and won't need to modify your configuration. Similarly, if
+you'd like to try out the new categories without replacing your current configuration wholesale, the
+defaults, or a smaller subset like `correctness` and `suspicious`, are a great place to start. You
+can append them to an existing `select` configuration, or add 
```

---

### Incident Patch 10: `ccaed68b` (2026-09-30)
**Commit Message**: Replace actions/attest-build-provenance action with actions/attest v4.2.2 (#29002)

**File**: `.github/workflows/build-docker.yml` (modified, +3/-3)
```diff
@@ -175,7 +175,7 @@ jobs:
           echo "digest=${digest}" >> "$GITHUB_OUTPUT"
 
       - name: Generate artifact attestation
-        uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
+        uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
         with:
           subject-name: ${{ env.RUFF_BASE_IMG }}
           subject-digest: ${{ steps.manifest-digest.outputs.digest }}
@@ -280,7 +280,7 @@ jobs:
           annotations: ${{ steps.meta.outputs.annotations }}
 
       - name: Generate artifact attestation
-        uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
+        uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
         with:
           subject-name: ${{ env.RUFF_BASE_IMG }}
           subject-digest: ${{ steps.build-and-push.outputs.digest }}
@@ -359,7 +359,7 @@ jobs:
           echo "digest=${digest}" >> "$GITHUB_OUTPUT"
 
       - name: Generate artifact attestation
-        uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
+        uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
         with:
           subject-name: ${{ env.RUFF_BASE_IMG }}
           subject-digest: ${{ steps.manifest-digest.outputs.digest }}
```

---

### Incident Patch 11: `7b588c48` (2026-09-30)
**Commit Message**: Update Rust crate uuid to v1.26.0 (#29013)

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -5221,9 +5221,9 @@ checksum = "06abde3611657adf66d383f00b093d7faecc7fa57071cce2578660c9f1010821"
 
 [[package]]
 name = "uuid"
-version = "1.25.0"
+version = "1.26.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f053576934f05a761a402421fbbe3d425d9366f75f978806a037b3ca481abecc"
+checksum = "b5772d71c9be8a8a6ac2117d949c5b224c1b72241bb611d9a3012edcf8af7812"
 dependencies = [
  "js-sys",
  "wasm-bindgen",
```

---

### Incident Patch 12: `28ad9e5d` (2026-09-29)
**Commit Message**: [ty] Avoid recursive lambda class decorator panics (#28984)

## Summary

We avoid a cycle-iteration panic when a lambda used as a class decorator
refers back to the decorated name:

```python
make = lambda cls: result
try:
    raise Exception
except Exception:
    @make
    class result: ...

    result = make
finally:
    from unknown_module import member as result
```

Previously, we treated a provisional `Divergent` decorator result as
preserving the original class. Replacing that result with the class
discarded the cycle marker, allowing the lambda's return type to gain
another callable layer on each inference iteration. We now retain both
the current binding and the cycle marker until inference resolves the
decorator result. Keeping the current binding also lets decorators whose
annotations depend on the decorated class resolve without losing the
class type or its constructor diagnostics.

Closes https://github.com/astral-sh/ty/issues/4616.

**File**: `crates/ty_python_semantic/resources/corpus/ty_4616_recursive_lambda_decorator.py` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# Regression test for https://github.com/astral-sh/ty/issues/4616
+
+(make := lambda: result)
+(alias := make)
+try:
+    first
+except* 0:
+    @make or fallback
+    class result:
+        pass
+
+try:
+    second
+except* 0:
+    (result := alias)
+finally:
+    from unknown_module import member as result
```

**File**: `crates/ty_python_semantic/resources/mdtest/cycle/basic.md` (modified, +100/-0)
```diff
@@ -402,6 +402,106 @@ def f[T](value: T, callback=lambda: f) -> T:
 reveal_type(f)  # revealed: property
 ```
 
+## Class decorator annotations depend on the decorated class
+
+A decorator's annotations can refer to an instance of the decorated class. We report the invalid
+annotations and preserve the class binding, so constructor calls can still be checked.
+
+```pyi
+from typing_extensions import reveal_type
+
+# error: [invalid-type-form] "Variable of type `Example` is not allowed in a parameter annotation"
+# error: [invalid-type-form] "Variable of type `Example` is not allowed in a return type annotation"
+def identity(value: annotation) -> annotation: ...
+
+@identity
+class Example:
+    def __init__(self, name: str) -> None: ...
+
+annotation = Example("example")
+
+reveal_type(Example)  # revealed: <class 'Example'>
+Example(123)  # error: [invalid-argument-type] "Expected `str`, found `Literal[123]`"
+```
+
+## Class decorator annotations depend on the decorated class through a type alias
+
+A type alias can introduce the same dependency on the decorated class. Importers still see the class
+and can check its constructor arguments.
+
+```toml
+[environment]
+python-version = "3.12"
+```
+
+`example.pyi`:
+
+```pyi
+type Alias = annotation
+
+def identity(value: Alias) -> Alias: ...
+
+@identity
+class Example:
+    def __init__(self, name: str) -> None: ...
+
+annotation = type[Example]
+```
+
+`main.py`:
+
+```py
+from example import Example
+
+reveal_type(Example)  # revealed: <class 'Example'>
+Example("example")
+Example(123)  # error: [invalid-argument-type] "Expected `str`, found `Literal[123]`"
+```
+
+## Dataclass outside a decorator whose annotations depend on the class
+
+An outer `@dataclass` still generates an initializer when the inner decorator's annotations depend
+on the decorated class.
+
+```pyi
+from dataclasses import dataclass
+from typing_extensions import reveal_type
+
+# error: [invalid-type-form] "Variable of type `Example` is not allowed in a parameter annotation"
+# error: [invalid-type-form] "Variable of type `Example` is not allowed in a return type annotation"
+def identity(value: annotation) -> annotation: ...
+
+@dataclass
+@identity
+class Example:
+    name: str
+
+annotation = Example("example")
+
+reveal_type(Example)  # revealed: <class 'Example'>
+reveal_type(Example("example").name)  # revealed: str
+Example()  # error: [missing-argument] "No argument provided for required parameter `name`"
+Example(123)  # error: [invalid-argument-type] "Expected `str`, found `Literal[123]`"
+```
+
+## Recursive lambda used as a class decorator
+
+The lambda returns a name that can refer back to the lambda itself. Inferring the decorated class
+converges even when another binding of that name has an unknown type.
+
+```py
+make = lambda cls: result
+try:
+    raise Exception
+except Exception:
+    @make
+    class result: ...
+
+    result = make
+finally:
+    from unknown_module import member as result  # error: [unresolved-import]
+```
+
 ## Decorated methods with implicit class attributes
 
 This is a regression test for <https://github.com/astral-sh/ty/issues/3471>.
```

**File**: `crates/ty_python_semantic/src/types/infer/builder/class.rs` (modified, +9/-2)
```diff
@@ -2,7 +2,7 @@ use crate::Db;
 use crate::ProgramEnvironment;
 use crate::types::{
     CallArguments, DataclassParams, KnownClass, KnownInstanceType, SpecialFormType,
-    StaticClassLiteral, SubclassOfType, Type, TypeContext, TypingModule,
+    StaticClassLiteral, SubclassOfType, Type, TypeContext, TypingModule, UnionType,
     call::CallError,
     function::KnownFunction,
     infer::{
@@ -327,6 +327,11 @@ impl<'db> TypeInferenceBuilder<'db, '_> {
             };
             inferred_ty = if is_unknown_decorator_result(db, decorated_ty) {
                 inferred_ty
+            } else if let divergent_ty @ Type::Divergent(_) = decorated_ty.resolve_type_alias(db) {
+                // Keep the current binding to bootstrap decorators whose return annotations
+                // depend on the decorated class. Retain the cycle marker too: replacing it with
+                // only the class lets inferred lambda return types grow on every iteration.
+                UnionType::from_elements_cycle_recovery(db, env, [inferred_ty, divergent_ty])
             } else if class_decorator_preserves_class_binding(
                 db,
                 env,
@@ -479,7 +484,9 @@ fn class_decorator_preserves_class_binding<'db>(
             .subclass_of()
             .into_class(db, env)
             .is_some_and(|class| class == original_literal.default_specialization(db)),
-        Type::Divergent(_) => true,
+        // A provisional decorator result does not establish that the class is preserved.
+        // Keep its cycle marker so recursive return types can be normalized.
+        Type::Divergent(_) => false,
         Type::Union(union) => union.elements(db).iter().all(|element| {
             class_decorator_preserves_class_binding(db, env, original_class, *element)
         }),
```

---

### Incident Patch 13: `118c4ee8` (2026-09-29)
**Commit Message**: Fix links to moved changelog sections and renamed mdtests (#28941)

## Summary

Four links in the repo point at things that moved:

- `BREAKING_CHANGES.md` links `CHANGELOG.md#090` and `CHANGELOG.md#030`,
but those sections live in `changelogs/0.9.x.md` and
`changelogs/0.3.x.md` now, so on GitHub the links land at the top of
`CHANGELOG.md`.
- `invalid_argument_type.md` points at `invalid_assignment_details.md`,
which #24690 renamed to `error_context.md`.
- `generics/scoping.md` links `./call/methods.md`, which resolves inside
`generics/`; the file is `../call/methods.md`.

## Test Plan

Opened each new target on github.com. The `#090` and `#030` anchors
resolve on the changelog pages; the old ones on `CHANGELOG.md` don't.

I found these while trying Amiss (https://github.com/HardMax71/amiss), a
docs drift checker I'm building.

---------

Co-authored-by: Brent Westbrook <[REDACTED_EMAIL]>

**File**: `BREAKING_CHANGES.md` (modified, +2/-2)
```diff
@@ -247,7 +247,7 @@ This is a follow-up to release 0.10.0. Because of a mistake in the release proce
 
 ## 0.9.0
 
-Ruff now formats your code according to the 2025 style guide. As a result, your code might now get formatted differently. See the [changelog](./CHANGELOG.md#090) for a detailed list of changes.
+Ruff now formats your code according to the 2025 style guide. As a result, your code might now get formatted differently. See the [changelog](./changelogs/0.9.x.md#090) for a detailed list of changes.
 
 ## 0.8.0
 
@@ -336,7 +336,7 @@ Ruff now formats your code according to the 2025 style guide. As a result, your
 
 ### Ruff 2024.2 style
 
-The formatter now formats code according to the Ruff 2024.2 style guide. Read the [changelog](./CHANGELOG.md#030) for a detailed list of stabilized style changes.
+The formatter now formats code according to the Ruff 2024.2 style guide. Read the [changelog](./changelogs/0.3.x.md#030) for a detailed list of stabilized style changes.
 
 ### `isort`: Use one blank line after imports in typing stub files ([#9971](https://github.com/astral-sh/ruff/pull/9971))
 
```

**File**: `crates/ty_python_semantic/resources/mdtest/diagnostics/invalid_argument_type.md` (modified, +1/-1)
```diff
@@ -594,7 +594,7 @@ help: Consider using a protocol instead, such as `typing.SupportsFloat`
 ## Invariant generic classes
 
 We show a special diagnostic hint for invariant generic classes. For more details, see the
-[`invalid_assignment_details.md`](./invalid_assignment_details.md) test.
+[`error_context.md`](./error_context.md#invariant-generic-classes) test.
 
 ```py
 def modify(xs: list[int]):
```

**File**: `crates/ty_python_semantic/resources/mdtest/generics/scoping.md` (modified, +1/-1)
```diff
@@ -237,7 +237,7 @@ class G(Generic[T]):
 
 ## Functions on generic classes are descriptors
 
-This repeats the tests in the [Functions as descriptors](./call/methods.md) test suite, but on a
+This repeats the tests in the [Functions as descriptors](../call/methods.md) test suite, but on a
 generic class. This ensures that we are carrying any specializations through the entirety of the
 descriptor protocol, which is how `self` parameters are bound to instance methods.
 
```

---

### Incident Patch 14: `dab63706` (2026-09-29)
**Commit Message**: [ty] Fix anchoring of include and exclude patterns after the project's root changed (#28995)

**File**: `crates/ty_project/src/glob/exclude.rs` (modified, +33/-4)
```diff
@@ -20,7 +20,7 @@ use crate::glob::portable::AbsolutePortableGlobPattern;
 ///
 /// # Equality
 ///
-/// Two filters are equal if they're constructed from the same patterns (including order).
+/// Two filters are equal if they're constructed from the same absolute globs (including order).
 /// Two filters that exclude the exact same files but were constructed from different patterns aren't considered
 /// equal.
 #[derive(Clone, Debug, PartialEq, Eq, get_size2::GetSize)]
@@ -112,7 +112,7 @@ impl ExcludeFilterBuilder {
 ///
 /// # Equality
 ///
-/// Two ignore matches are only equal if they're constructed from the same patterns (including order).
+/// Two ignore matchers are only equal if they're constructed from the same absolute globs (including order).
 /// Two matchers that were constructed from different patterns but result in
 /// including the same files don't compare equal.
 #[derive(Clone, get_size2::GetSize)]
@@ -192,7 +192,7 @@ impl Match {
 
 #[derive(Debug, Clone, PartialEq, Eq, get_size2::GetSize)]
 struct IgnoreGlob {
-    /// The pattern that was originally parsed.
+    /// The original absolute glob, before removing negation or a trailing slash.
     original: String,
 
     /// This is a pattern allowing a path (it starts with a `!`, possibly undoing a previous ignore)
@@ -247,7 +247,7 @@ impl GitignoreBuilder {
         pattern: &AbsolutePortableGlobPattern,
     ) -> Result<&mut GitignoreBuilder, globset::Error> {
         let mut glob = IgnoreGlob {
-            original: pattern.relative().to_string(),
+            original: pattern.absolute().to_string(),
             is_allow: false,
             is_only_dir: false,
         };
@@ -291,3 +291,32 @@ impl GitignoreBuilder {
         Ok(self)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::{ExcludeFilter, ExcludeFilterBuilder};
+    use crate::GlobFilterCheckMode;
+    use crate::glob::{PortableGlobKind, PortableGlobPattern};
+    use ruff_db::system::SystemPath;
+
+    #[test]
+    fn equality_accounts_for_pattern_root() -> anyhow::Result<()> {
+        let build = |root| -> anyhow::Result<ExcludeFilter> {
+            let mut builder = ExcludeFilterBuilder::new();
+            builder.add(
+                &PortableGlobPattern::parse("**/.venv/", PortableGlobKind::Exclude)?
+                    .into_absolute(root),
+            )?;
+            Ok(builder.build()?)
+        };
+        let member = build("/workspace/project")?;
+        let workspace = build("/workspace")?;
+        let environment = SystemPath::new("/workspace/.venv");
+
+        assert!(!member.match_directory(environment, GlobFilterCheckMode::Adhoc));
+        assert!(workspace.match_directory(environment, GlobFilterCheckMode::Adhoc));
+        assert_ne!(member, workspace);
+        assert_eq!(workspace, build("/workspace")?);
+        Ok(())
+    }
+}
```

**File**: `crates/ty_project/src/glob/include.rs` (modified, +25/-2)
```diff
@@ -29,14 +29,15 @@ const DFA_SIZE_LIMIT: usize = 1_000_000;
 /// regex allows to check for prefix matches.
 ///
 /// ## Equality
-/// Equality is based on the patterns from which a filter was constructed.
+/// Equality is based on the original absolute globs.
 ///
 /// Because of that, two filters that include the exact same files but were
 /// constructed from different patterns (or even just order) compare unequal.
 #[derive(Clone, get_size2::GetSize)]
 pub(crate) struct IncludeFilter {
     #[get_size(ignore)]
     glob_set: GlobSet,
+    /// The original absolute globs, before adding patterns for descendants.
     original_patterns: Box<[Box<str>]>,
     #[get_size(size_fn = bit_box_size)]
     literal_pattern_indices: BitBox,
@@ -216,7 +217,7 @@ impl IncludeFilterBuilder {
             .backslash_escape(true)
             .build()?;
 
-        self.original_patterns.push(input.relative().into());
+        self.original_patterns.push(input.absolute().into());
 
         // `lib` is the same as `lib/**`
         // Add a glob that matches `lib` exactly, change the glob to `lib/**`.
@@ -355,6 +356,28 @@ mod tests {
         assert!(!filter.match_directory(path.replace('/', MAIN_SEPARATOR_STR)));
     }
 
+    #[test]
+    fn equality_accounts_for_pattern_root() -> anyhow::Result<()> {
+        let build = |root| -> anyhow::Result<IncludeFilter> {
+            let mut builder = IncludeFilterBuilder::new();
+            builder.add(
+                &PortableGlobPattern::parse("src", PortableGlobKind::Include)?.into_absolute(root),
+            )?;
+            Ok(builder.build()?)
+        };
+        let member = build("/workspace/project")?;
+        let workspace = build("/workspace")?;
+
+        assert_eq!(member.match_file("/workspace/src/main.py"), MatchFile::No);
+        assert_eq!(
+            workspace.match_file("/workspace/src/main.py"),
+            MatchFile::Pattern
+        );
+        assert_ne!(member, workspace);
+        assert_eq!(workspace, build("/workspace")?);
+        Ok(())
+    }
+
     #[test]
     fn match_directory() {
         // `lib` is the same as `src/**`. It includes a file or directory (including its contents)
```

**File**: `crates/ty_server/tests/e2e/main.rs` (modified, +5/-0)
```diff
@@ -1694,6 +1694,11 @@ impl TestContext {
             .map_err(|()| anyhow!("Failed to convert root directory to uri"))?;
         settings.add_filter(&tempdir_filter(project_dir.as_str()), "<temp_dir>/");
         settings.add_filter(&tempdir_filter(project_dir_uri.path()), "<temp_dir>/");
+        // Absolute globs use forward slashes on every platform.
+        settings.add_filter(
+            &tempdir_filter(project_dir.as_str().replace('\\', "/")),
+            "<temp_dir>/",
+        );
         settings.add_filter(r#"\\\\"#, "/");
         settings.add_filter(
             r#"The system cannot find the file specified."#,
```

**File**: `crates/ty_server/tests/e2e/snapshots/e2e__commands__debug_command.snap` (modified, +20/-20)
```diff
@@ -58,102 +58,102 @@ Settings: Settings {
                 ignore: Gitignore(
                     [
                         IgnoreGlob {
-                            original: "**/.bzr/",
+                            original: "<temp_dir>/**/.bzr/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.direnv/",
+                            original: "<temp_dir>/**/.direnv/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.eggs/",
+                            original: "<temp_dir>/**/.eggs/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.git/",
+                            original: "<temp_dir>/**/.git/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.git-rewrite/",
+                            original: "<temp_dir>/**/.git-rewrite/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.hg/",
+                            original: "<temp_dir>/**/.hg/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.mypy_cache/",
+                            original: "<temp_dir>/**/.mypy_cache/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.nox/",
+                            original: "<temp_dir>/**/.nox/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.pants.d/",
+                            original: "<temp_dir>/**/.pants.d/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.pytype/",
+                            original: "<temp_dir>/**/.pytype/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.ruff_cache/",
+                            original: "<temp_dir>/**/.ruff_cache/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.svn/",
+                            original: "<temp_dir>/**/.svn/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.tox/",
+                            original: "<temp_dir>/**/.tox/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/.venv/",
+                            original: "<temp_dir>/**/.venv/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/__pypackages__/",
+                            original: "<temp_dir>/**/__pypackages__/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/_build/",
+                            original: "<temp_dir>/**/_build/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/buck-out/",
+                            original: "<temp_dir>/**/buck-out/",
                             is_allow: false,
                             is_only_dir: true,
                         },
                         IgnoreGlob {
-                            original: "**/dist/",
+                            original: "<temp_dir>/**/dist/",
        
```

---

### Incident Patch 15: `c7815fea` (2026-09-28)
**Commit Message**: [ty] Update agent guidance for rules and mdtests (#28961)

**File**: `.agents/skills/adding-ty-diagnostics/SKILL.md` (modified, +8/-4)
```diff
@@ -1,11 +1,11 @@
 ---
 name: adding-ty-diagnostics
-description: Use when a user says "add a ty diagnostic", "write this new ty diagnostic", "change a ty error message", "review ty diagnostics", or asks to add, update, or review ty checks, diagnostic messages, subdiagnostics, or concise output behavior.
+description: Use when a user says "add a ty rule", "add a ty diagnostic", "write this new ty diagnostic", "change a ty error message", "review ty diagnostics", or asks to add, update, or review ty checks, diagnostic messages, subdiagnostics, or concise output behavior.
 ---
 
 # Adding Ty Diagnostics
 
-Use this skill when adding or changing a ty diagnostic, especially as part of a new ty check.
+Use this skill when adding a ty rule or adding, changing, or reviewing a ty diagnostic.
 
 **Keep error messages concise.** Think about how the diagnostic will look on a narrow terminal screen.
 
@@ -19,10 +19,14 @@ and the generated `.md` documentation files.
 
 Diagnostics should usually be tested using mdtests. If you are changing behaviour for an existing diagnostic,
 you should usually add your tests to a pre-existing `.md` file; otherwise, it may be appropriate to add a new
-`.md` file for your tests. Snapshot tests are only usually necessary for diagnostics that use secondary annotations
-or subdiagnostics. If you want to add a snapshot, inline `# snapshot` comments are preferred over the legacy
+`.md` file for your tests. A new ty diagnostic should normally have at least one snapshot test showing how ty renders
+it. For changes to existing diagnostics, snapshot tests are only usually necessary for diagnostics that use secondary
+annotations or subdiagnostics. If you want to add a snapshot, inline `# snapshot` comments are preferred over the legacy
 `<!-- snapshot-annotations -->` directive.
 
+When adding a ty rule that is disabled by default, normally enable it at `warn` in `.github/ty-ecosystem.toml` so the
+ecosystem-analyzer workflows report its effects.
+
 When using the `declare_lint!` macro, the `status` field should be set to `LintStatus::stable(<next version of ty>)`.
 You should determine what the next version of ty will be by inspecting https://pypi.org/pypi/ty/json, finding what
 the latest release of ty is, and incrementing the patch version by one. For example, if the latest release of ty is `0.5.3`, the status should be `LintStatus::stable("0.5.4")`.
```

**File**: `AGENTS.md` (modified, +13/-7)
```diff
@@ -8,6 +8,17 @@ Before starting work on an issue and again before opening a pull request, follow
 [guidance on avoiding duplicate work](CONTRIBUTING.md#avoiding-duplicate-work). If an open pull
 request already addresses the issue, do not submit a competing one without maintainer agreement.
 
+## PR conventions
+
+Add appropriate GitHub labels to pull requests if you have permission to do so; if you don't,
+there's no need to worry about it. Labels can affect whether and how a pull request appears in the
+Ruff or ty changelog. The `[tool.rooster]` and `[tool.rooster.section-labels]` sections in
+[Ruff's `pyproject.toml`](pyproject.toml) and
+[ty's `pyproject.toml`](https://github.com/astral-sh/ty/blob/main/pyproject.toml) specify which
+labels affect each changelog.
+
+When working on ty, PR titles should start with `[ty]`. Add the `ty` GitHub label.
+
 ## Code Review Rules
 
 For security reviews of Ruff and ty runtime changes, use the
@@ -98,6 +109,7 @@ Never edit snapshot files or inline snapshot bodies manually. Regenerate them by
 
 - Write mdtests as readable, literate specifications, and minimize the context a reader must hold in mind. Prefer short, focused code blocks, and define types, fixtures, and helpers close to the assertions that use them. Sections and subsections can be long when they develop a coherent topic through many short examples interspersed with prose. Do not split a subsection, or flag it in review, solely because of its length. Give independent scenarios separate sibling Markdown test headings at the same level; only introduce child headings if any existing code beneath their parent is first moved into child sections. When scenarios need shared setup, interleave short prose-and-code blocks under the same heading.
 - Code blocks for the same file within a section are concatenated into one file. For inline snapshots, keep each example's code block close to its `# snapshot` block. Ideally, any given code block only has one snapshot in it, but one codeblock containing several snapshots is also acceptable. Repeating a short, independent function definition, including one with the same name, is fine if it keeps the code triggering a snapshot close to the snapshot demonstrating the expected diagnostic on that code. Reuse shared setup when clearer, and check that repeated names do not affect other examples.
+- When a Python statement in an mdtest is included only or primarily to check that ty does not emit a diagnostic for it, normally add a `# no diagnostic` comment on or above the statement. Statements used as setup for later assertions do not necessarily need such comments.
 - Prioritize document structure and readability over avoiding duplicated setup. Add a test to an existing section when its heading accurately describes the new scenario, adding or improving introductory prose as needed; otherwise, create a separate sibling section, even if that requires repeating a small fixture.
 - Order mdtests from basic, common behavior to more specialized cases. Place narrow regression tests alongside closely related examples when they fit naturally; otherwise, put them near the end of the relevant section or file. Do not put an obscure special case at the beginning simply because it is the newest regression.
 - Aim for readable documents that serve as both documentation and tests. Use prose to explain the key type checker behavior and its rationale where helpful. A sentence or fragment may suffice; avoid repeating what the heading, surrounding explanation, or assertions already make clear. Use clear, precise terminology. Avoid using jargon where it's unnecessary, and avoid inventing new jargon if there's an existing term of art used in that file. Avoid long paragraphs covering multiple scenarios followed by a single long code block.
@@ -138,7 +150,7 @@ The guidance in this section applies to edits to `ty*` crates, reviews of ty PRs
 
 When the task matches a more specific ty workflow, also read and follow that skill from the repository root:
 
-- Diagnostic changes, diagnostic message changes, or diagnostic reviews: `.agents/skills/adding-ty-diagnostics/SKILL.md`.
+- Adding new ty rules, changing diagnostics or diagnostic messages, or reviewing diagnostics: `.agents/skills/adding-ty-diagnostics/SKILL.md`.
 - Ecosystem report summaries: `.agents/skills/summarise-ecosystem-results/SKILL.md`.
 - Reproducing, investigating, or minimizing ecosystem or primer differences: `.agents/skills/minimizing-ty-ecosystem-changes/SKILL.md`.
 
@@ -158,12 +170,6 @@ To inspect one evaluation task, run `cargo run --package ty_completion_eval -- s
 
 When running ty against a temporary Python reproduction file, create it outside the Ruff checkout (for example, under `/tmp`). A file inside the checkout discovers Ruff's root `pyproject.toml`, whose `requires-python = ">=3.7"` causes ty to infer Python 3.7 as the default Python version.
 
-### PR conventions
-
-When working on ty, PR titles should start with `[ty]`.
```

#### Recent Merged Pull Requests:
- **PR #29117** (2026-10-05): Enable color in Hawk's CI output (@AlexWaygood)
- **PR #29113** (2026-10-05): Isolate daily fuzz issue creation from the fuzzer (@AlexWaygood)
- **PR #29111** (2026-10-05): Group uv workflow and pre-commit updates (@AlexWaygood)
- **PR #29110** (closed): [flake8-print] Preserve trailing comments in the T201/T203 fix (@Matthew-Selvam)
- **PR #29109** (closed): Update dependency astral-sh/uv to v0.12.23 - autoclosed (@renovate[bot])
- **PR #29108** (2026-10-05): Enable Renovate updates for the cargo-deny uv version (@AlexWaygood)
- **PR #29105** (closed): [pylint] Preserve trailing comments in the PLR1711 fix (@Matthew-Selvam)
- **PR #29101** (closed): [`flake8-pyi`] Accept stringized annotations in `bad-exit-annotation` (`PYI036`) (@ShivamSharma43)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
