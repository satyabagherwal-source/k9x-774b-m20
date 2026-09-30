# Forensic Learning Record (Deep Inspection): PaulJuliusMartinez/jless

> **Canonical Artifact**: `07_PROJECT_LEARNING/pauljuliusmartinez-jless-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PaulJuliusMartinez/jless](https://github.com/PaulJuliusMartinez/jless))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:18:38.554Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PaulJuliusMartinez/jless`
- **Description**: jless is a command-line JSON viewer designed for reading, exploring, and searching through JSON data.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5505 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app.rs`
```
use std::error::Error;
use std::fs::File;
use std::io;
use std::io::Write;

use clipboard::{ClipboardContext, ClipboardProvider};
use rustyline::error::ReadlineError;
use rustyline::Editor;
use termion::event::Key;
use termion::event::MouseButton::{Left, WheelDown, WheelUp};
use termion::event::MouseEvent::Press;
use termion::raw::RawTerminal;
use termion::screen::{ToAlternateScreen, ToMainScreen};

use crate::flatjson;
use crate::input::TuiEvent;
use crate::input::TuiEvent::{KeyEvent, MouseEvent, WinChEvent};
use crate::jsonstringunescaper::{safe_unescape_json_string, UnescapeError};
use crate::lineprinter::JS_IDENTIFIER;
use crate::options::{DataFormat, Opt};
use crate::screenwriter::{MessageSeverity, ScreenWriter};
use crate::search::{JumpDirection, SearchDirection, SearchState};
use crate::types::TTYDimensions;
use crate::viewer::{Action, JsonViewer, Mode};

pub struct App {
    viewer: JsonViewer,
    screen_writer: ScreenWriter,
    input_state: InputState,
    input_buffer: Vec<u8>,
    input_filename: String,
    search_state: SearchState,
    message: Option<(String, MessageSeverity)>,
    clipboard_context: Result<ClipboardContext, Box<dyn Error>>,
}

// State to determine how to process the next event input.
//
// The default state accepts most commands, and also buffers
// number inputs to provide a count for movement commands.
//
// Other commands require a combination of (non-numeric) key
// presses. When one of these commands is partially inputted,
// pressing a key not part of the combination will cancel
// the combination command, and no action will be performed.
#[derive(PartialEq)]
enum InputState {
    Default,
    PendingPCommand,
    PendingYCommand,
    PendingZCommand,
    WaitingForAnyKeyPress,
}

// Various things that can be copied/printed.
#[derive(Copy, Clone)]
enum ContentTarget {
    PrettyPrintedValue,
    OneLineValue,
    String,
    Key,
    DotPath,
    BracketPath,
    QueryPath,
}

#[derive(Copy, Clone)]
enum WriteFormat {
    Json,
    #[cfg(feature = "sexp")]
    Sexp,
}

enum Command {
    Quit,
    Help,
    SetShowLineNumber(Option<bool>),
    SetShowRelativeLineNumber(Option<bool>),
    WriteFile {
        filename: String,
        overwrite_existing: bool,
        write_format: WriteFormat,
    },
    Unknown,
}

// Help contents that we pipe to less.
const HELP: &str = std::include_str!("./jless.help");

pub const MAX_BUFFER_SIZE: usize = 9;
const BELL: &str = "\x07";

// https://docs.rs/termion/2.0.1/src/termion/input.rs.html#176-180
//
// The termion MouseTerminal sends the following escape codes:
//
// ESC [ ? 1000 h
// ESC [ ? 1002 h
// ESC [ ? 1015 h
// ESC [ ? 1006 h
//
// https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
//
// 1000 enables better mouse support; 1002 enables button-event tracking,
// then 1015 and 1006 change the format that mouse events are sent in.
// (It seems like 1006 overrides 1015, but probably some legacy issue somewhere.)
//
// When we print stuff to the screen with 'p', we want to allow the user to
// highlight it with their mouse, so we disable the regular mouse button tracking.
const DISABLE_MOUSE_BUTTON_TRACKING: &str = "\x1b[?1002l";
const ENABLE_MOUSE_BUTTON_TRACKING: &str = "\x1b[?1002h";

impl App {
    pub fn new(
        opt: &Opt,
        data: String,
        data_format: DataFormat,
        input_filename: String,
        stdout: RawTerminal<Box<dyn Write>>,
    ) -> Result<App, String> {
        let flatjson = match Self::parse_input(data, data_format) {
            Ok(flatjson) => flatjson,
            Err(err) => return Err(format!("Unable to parse input: {err:?}")),
        };

        let mut viewer = JsonViewer::new(flatjson, opt.mode);
        viewer.scrolloff_setting = opt.scrolloff;

        let screen_writer =
            ScreenWriter::init(opt, stdout, Editor::<()>::new(), TTYDimensions::default());

        Ok(App {
            viewer,
            screen_writer,
            input_state: InputState::Default,
            input_buffer: vec![],
            input_filename,
            search_state: SearchState::empty(),
            message: None,
            clipboard_context: ClipboardProvider::new(),
        })
    }

    fn parse_input(data: String, data_format: DataFormat) -> Result<flatjson::FlatJson, String> {
        match data_format {
            DataFormat::Json => flatjson::parse_top_level_json(data),
            DataFormat::Yaml => flatjson::parse_top_level_yaml(data),
        }
    }

    pub fn run(&mut self, input: Box<dyn Iterator<Item = io::Result<TuiEvent>>>) {
        let dimensions = TTYDimensions::from_size(termion::terminal_size().unwrap());
        self.viewer.dimensions = dimensions.without_status_bar();
        self.screen_writer.dimensions = dimensions;
        self.draw_screen();

        for event in input {
            let event = match event {
                Ok(event) => event,
                Err(io_error) => {
                    self.set_error_message(format!("Error: {io_error}"));
                    self.draw_status_bar();
                    continue;
                }
            };

            // This state trumps everything else. We won't do anything until the user
            // hits a key, then we will redraw the screen and return to the default input
            // state. (We ignore the actual value of the key they press.)
            if self.input_state == InputState::WaitingForAnyKeyPress {
                if matches!(event, KeyEvent(_)) {
                    let _ = write!(self.screen_writer.stdout, "{ToAlternateScreen}");
                    let _ = write!(self.screen_writer.stdout, "{ENABLE_MOUSE_BUTTON_TRACKING}");
                    self.input_state = InputState::Default;
                    self.draw_screen();
                    self.message = None;
                }
                continue;
            }

            // If the user hits Ctrl-z, we don't modify state at all, just send SIGSTOP to
            // ourself, then loop around and process the next input.
            if matches!(event, KeyEvent(Key::Ctrl('z'))) {
                // Restore terminal prior to suspending.
                let _ = self.screen_writer.stdout.suspend_raw_mode();
                let _ = write!(self.screen_writer.stdout, "{DISABLE_MOUSE_BUTTON_TRACKING}");
                let _ = write!(self.screen_writer.stdout, "{ToMainScreen}");
                let _ = write!(self.screen_writer.stdout, "{}", termion::cursor::Show);
                let _ = self.screen_writer.stdout.flush();
                unsafe {
                    libc::kill(0, libc::SIGSTOP);
                }
                // Re-enable all the terminal settings.
                let _ = write!(self.screen_writer.stdout, "{}", termion::cursor::Hide);
                let _ = write!(self.screen_writer.stdout, "{ToAlternateScreen}");
                let _ = write!(self.screen_writer.stdout, "{ENABLE_MOUSE_BUTTON_TRACKING}");
                let _ = self.screen_writer.stdout.activate_raw_mode();
                // I'm not exactly sure why we have to do this.
                self.draw_screen();
                continue;
            }

            // When "actively" searching, we want to show highlighted search terms.
            // We consider someone "actively" searching immediately after the start
            // of a search, and while they navigate between matches using n/N.
            //
            // Once the user moves the focused row via another input, we will no longer
            // consider them actively searching. (So scrolling, as long as it doesn't
            // result in the cursor moving, does not stop the "active" search.)
            //
            // If a user expands a node that contained a search match, then we want
            // the next jump to go to that match inside the container. To handle this
            // we'll also stop considering the search active if the collapsed state
            // of the focused row changes.
           
```

### Core Architecture Module: `src/flatjson.rs`
```
use std::fmt::{Debug, Write};
use std::ops::Range;

use crate::jsonparser;
use crate::lineprinter;
use crate::yamlparser;

#[cfg(feature = "sexp")]
use crate::jsonstringunescaper::{unsafe_unescape_json_string, UnescapeError};

pub type Index = usize;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum OptionIndex {
    Nil,
    Index(Index),
}

impl OptionIndex {
    pub fn is_nil(&self) -> bool {
        matches!(self, OptionIndex::Nil)
    }

    pub fn is_some(&self) -> bool {
        !self.is_nil()
    }

    pub fn unwrap(&self) -> Index {
        match self {
            OptionIndex::Nil => panic!("Called .unwrap() on Nil OptionIndex"),
            OptionIndex::Index(i) => *i,
        }
    }
}

pub const NIL: usize = usize::MAX;

impl From<usize> for OptionIndex {
    fn from(i: usize) -> Self {
        if i == NIL {
            OptionIndex::Nil
        } else {
            OptionIndex::Index(i)
        }
    }
}

#[derive(PartialEq, Copy, Clone)]
pub enum PathType {
    Dot,
    Bracket,
    Query,
    // Just used for the status bar.
    DotWithTopLevelIndex,
}

#[derive(Debug)]
pub struct FlatJson(
    pub Vec<Row>,
    // Single-line pretty printed version of the JSON.
    // Rows will contain references into this.
    pub String,
    // Max nesting depth.
    pub usize,
);

impl FlatJson {
    pub fn last_visible_index(&self) -> Index {
        let last_index = self.0.len() - 1;

        let row = &self.0[last_index];

        if row.is_container() && row.is_collapsed() {
            row.pair_index().unwrap()
        } else {
            last_index
        }
    }

    pub fn last_visible_item(&self) -> Index {
        let mut last_index = self.0.len() - 1;

        loop {
            let row = &self.0[last_index];

            if row.is_primitive() {
                return last_index;
            }

            if row.is_closing_of_container() && row.is_collapsed() {
                return row.pair_index().unwrap();
            }

            last_index -= 1;
        }
    }

    pub fn prev_visible_row(&self, index: Index) -> OptionIndex {
        if index == 0 {
            return OptionIndex::Nil;
        }

        let row = &self.0[index - 1];

        if row.is_closing_of_container() && row.is_collapsed() {
            row.pair_index()
        } else {
            OptionIndex::Index(index - 1)
        }
    }

    pub fn next_visible_row(&self, mut index: Index) -> OptionIndex {
        // If row is collapsed container, jump to closing char and move past there.
        if self.0[index].is_opening_of_container() && self.0[index].is_collapsed() {
            index = self.0[index].pair_index().unwrap();
        }

        // We can always go to the next row, unless we're at the end of the file.
        if index == self.0.len() - 1 {
            return OptionIndex::Nil;
        }

        OptionIndex::Index(index + 1)
    }

    pub fn prev_item(&self, mut index: Index) -> OptionIndex {
        while let OptionIndex::Index(i) = self.prev_visible_row(index) {
            if !self.0[i].is_closing_of_container() {
                return OptionIndex::Index(i);
            }

            index = i;
        }

        OptionIndex::Nil
    }

    pub fn next_item(&self, mut index: Index) -> OptionIndex {
        while let OptionIndex::Index(i) = self.next_visible_row(index) {
            if !self.0[i].is_closing_of_container() {
                return OptionIndex::Index(i);
            }

            index = i;
        }

        OptionIndex::Nil
    }

    pub fn expand(&mut self, index: Index) {
        if let OptionIndex::Index(pair) = self.0[index].pair_index() {
            self.0[pair].expand();
        }
        self.0[index].expand();
    }

    pub fn collapse(&mut self, index: Index) {
        if let OptionIndex::Index(pair) = self.0[index].pair_index() {
            self.0[pair].collapse();
        }
        self.0[index].collapse();
    }

    pub fn toggle_collapsed(&mut self, index: Index) {
        if let OptionIndex::Index(pair) = self.0[index].pair_index() {
            self.0[pair].toggle_collapsed();
        }
        self.0[index].toggle_collapsed();
    }

    pub fn first_visible_ancestor(&self, mut index: Index) -> Index {
        let mut visible_ancestor = index;
        while let OptionIndex::Index(parent) = self[index].parent {
            if self[parent].is_collapsed() {
                visible_ancestor = parent;
            }
            index = parent;
        }
        visible_ancestor
    }

    pub fn build_path_to_node(&self, path_type: PathType, index: Index) -> Result<String, String> {
        let mut buf = String::new();

        // Some special handling for top-level elements.
        if self[index].parent.is_nil() {
            match path_type {
                PathType::Dot | PathType::Bracket => {
                    return Err("Cannot build path to top-level element".to_string());
                }
                PathType::Query => {
                    return Ok(".".to_string());
                }
                PathType::DotWithTopLevelIndex => { /* Handled in impl */ }
            }
        }

        self.build_path_to_node_impl(path_type, index, &mut buf)?;
        Ok(buf)
    }

    fn build_path_to_node_impl(
        &self,
        path_type: PathType,
        index: Index,
        buf: &mut String,
    ) -> Result<(), String> {
        let row = &self[index];

        if row.is_closing_of_container() {
            return self.build_path_to_node_impl(path_type, row.pair_index().unwrap(), buf);
        }

        if let OptionIndex::Index(parent_index) = row.parent {
            self.build_path_to_node_impl(path_type, parent_index, buf)?;
        }

        let res = if let Some(key_range) = &row.key_range {
            let key_open_delimiter = &self.1[key_range.start..key_range.start + 1];
            let key = &self.1[key_range.start + 1..key_range.end - 1];

            // For non-string keys in YAML.
            if key_open_delimiter == "[" {
                if path_type == PathType::Query {
                    return Err(
                        "Path to node contains non-string keys not supported in JSON".to_string(),
                    );
                }

                write!(buf, "[{key}]")
            } else {
                if path_type != PathType::Bracket && lineprinter::JS_IDENTIFIER.is_match(key) {
                    write!(buf, ".{key}")
                } else {
                    if path_type == PathType::Query && row.depth == 1 {
                        // Handle square brackets as the first part of the path.
                        write!(buf, ".[\"{key}\"]")
                    } else {
                        write!(buf, "[\"{key}\"]")
                    }
                }
            }
        } else {
            if row.parent.is_nil() {
                // We only print the top level index for this PathType,
                // but we don't print it out if there's only a single
                // top-level element.
                if path_type == PathType::DotWithTopLevelIndex
                    && (index != 0 || row.next_sibling.is_some())
                {
                    write!(buf, "[{}]", row.index_in_parent)
                } else {
                    Ok(())
                }
            } else {
                match path_type {
                    PathType::Query => {
                        if row.depth == 1 {
                            // Handle square brackets as the first part of the path.
                            write!(buf, ".[]")
                        } else {
                            write!(buf, "[]")
                        }
                    }
                    _ => write!(buf, "[{}]", row.index_in_parent),
                }
            }
        };

        res.map_err(|e| e.to_string())
    }

    pub fn pretty_printed(&self) -> String {
        let mut buf = String::new();

        for row in self.0.iter() {
          
```

### Core Architecture Module: `src/highlighting.rs`
```
use std::fmt;
use std::iter::Peekable;
use std::ops::Range;

use crate::search::MatchRangeIter;
use crate::terminal;
use crate::terminal::{Style, Terminal};
use crate::truncatedstrview::TruncatedStrView;

// This module is responsible for highlighting text in the
// appropriate colors when we print it out.
//
// We use different colors for different JSON value types,
// as well as different shades of gray.
//
// We searching for text, we highlight matches in yellow.
// In certain cases, when highlighted matches are also focused,
// we invert the normal colors of the terminal (to handle
// both light and dark color schemes).
//
//
// These are all the different things that we print out that
// may require special formatting:
//
// - Literal Values:
//   - null
//   - boolean
//   - number
//   - string
//   - empty objects and arrays
// - Object Keys
// - The ": " between an object key and its value
// - Array indexes in data mode (e.g., "[123]")
// - The ": " between an array index and the value
//   - Note that unlike the ": " between object keys and
//     values, these do not actually appear in the source
//     JSON and cannot be part of a search match
// - Commas after object and array elements
// - Open and close braces and brackets ("{}[]")
// - Container previews

//      Thing      |  Default Style  |  Focused Style  |      Match     |  Focused/Current Match
// ----------------+-----------------+-----------------+----------------+------------------------
//      null       |      Gray       |        X        | Yellow/Default |        Inverted
//     boolean     |     Yellow      |        X        | Yellow/Default |        Inverted
//     number      |     Magenta     |        X        | Yellow/Default |        Inverted
//     string      |      Green      |        X        | Yellow/Default |        Inverted
//  empty obj/arr  |     Default     |        X        | Yellow/Default |        Inverted
//
//  ^ Object values can't be focused
//
//   ": " and ","  |     Default     |     Default     | Yellow/Default |        Inverted
//
//  Object Labels  |      Blue       |  Inverted/Blue  | Yellow/Default |        Inverted
//                                        + Bold
//
//   Array Labels  |      Gray       | Default + Bold  |       X        |            X
//
//    Container    |     Default     |      Bold       | Yellow/Default |     Inverted + Bold
//    Delimiters
//
//    Container    |      Gray       |     Default     | Inverted Gray  |        Inverted
//     Previews

pub const DEFAULT_STYLE: Style = Style::default();

pub const BOLD_STYLE: Style = Style {
    bold: true,
    ..Style::default()
};

pub const BOLD_INVERTED_STYLE: Style = Style {
    inverted: true,
    bold: true,
    ..Style::default()
};

pub const GRAY_INVERTED_STYLE: Style = Style {
    fg: terminal::LIGHT_BLACK,
    inverted: true,
    ..Style::default()
};

pub const SEARCH_MATCH_HIGHLIGHTED: Style = Style {
    fg: terminal::YELLOW,
    inverted: true,
    ..Style::default()
};

pub const DIMMED_STYLE: Style = Style {
    dimmed: true,
    ..Style::default()
};

pub const CURRENT_LINE_NUMBER: Style = Style {
    fg: terminal::YELLOW,
    ..Style::default()
};

pub const PREVIEW_STYLES: (&Style, &Style) = (&DIMMED_STYLE, &GRAY_INVERTED_STYLE);

pub const BLUE_STYLE: Style = Style {
    fg: terminal::LIGHT_BLUE,
    ..Style::default()
};

pub const INVERTED_BOLD_BLUE_STYLE: Style = Style {
    bg: terminal::BLUE,
    inverted: true,
    bold: true,
    ..Style::default()
};

#[allow(clippy::too_many_arguments)]
pub fn highlight_truncated_str_view(
    out: &mut dyn Terminal,
    mut s: &str,
    str_view: &TruncatedStrView,
    mut str_range_start: Option<usize>,
    style: &Style,
    highlight_style: &Style,
    matches_iter: &mut Option<&mut Peekable<MatchRangeIter<'_>>>,
    focused_search_match: &Range<usize>,
) -> fmt::Result {
    let mut leading_ellipsis = false;
    let mut replacement_character = false;
    let mut trailing_ellipsis = false;

    if let Some(tr) = str_view.range {
        leading_ellipsis = tr.print_leading_ellipsis();
        replacement_character = tr.showing_replacement_character;
        trailing_ellipsis = tr.print_trailing_ellipsis(s);
        s = &s[tr.start..tr.end];
        str_range_start = str_range_start.map(|start| start + tr.start);
    }

    if leading_ellipsis {
        out.set_style(&DIMMED_STYLE)?;
        out.write_char('…')?;
    }

    // Print replacement character
    if replacement_character {
        out.set_style(style)?;
        // TODO: Technically we should figure out whether this
        // character's range should be highlighted, but also
        // maybe not bad to not highlight the replacement character;
        out.write_char('�')?;
    }

    // Print actual string itself
    highlight_matches(
        out,
        s,
        str_range_start,
        style,
        highlight_style,
        matches_iter,
        focused_search_match,
    )?;

    // Print trailing ellipsis
    if trailing_ellipsis {
        out.set_style(&DIMMED_STYLE)?;
        out.write_char('…')?;
    }

    Ok(())
}

pub fn highlight_matches(
    out: &mut dyn Terminal,
    mut s: &str,
    str_range_start: Option<usize>,
    style: &Style,
    highlight_style: &Style,
    matches_iter: &mut Option<&mut Peekable<MatchRangeIter<'_>>>,
    focused_search_match: &Range<usize>,
) -> fmt::Result {
    if str_range_start.is_none() {
        out.set_style(style)?;
        write!(out, "{s}")?;
        return Ok(());
    }

    let mut start_index = str_range_start.unwrap();

    while !s.is_empty() {
        // Initialize the next match to be a fake match past the end of the string.
        let string_end = start_index + s.len();
        let mut match_start = string_end;
        let mut match_end = string_end;
        let mut match_is_focused_match = false;

        // Get rid of matches before the string.
        while let Some(range) = matches_iter.as_mut().and_then(|i| i.peek()) {
            if start_index < range.end {
                if *range == focused_search_match {
                    match_is_focused_match = true;
                }

                match_start = range.start.clamp(start_index, string_end);
                match_end = range.end.clamp(start_index, string_end);
                break;
            }
            matches_iter.as_mut().unwrap().next();
        }

        // Print out stuff before the start of the match, if there's any.
        if start_index < match_start {
            let print_end = match_start - start_index;
            out.set_style(style)?;
            write!(out, "{}", &s[..print_end])?;
        }

        // Highlight the matching substring.
        if match_start < string_end {
            if match_is_focused_match {
                out.set_style(&BOLD_INVERTED_STYLE)?;
            } else {
                out.set_style(highlight_style)?;
            }
            let print_start = match_start - start_index;
            let print_end = match_end - start_index;
            write!(out, "{}", &s[print_start..print_end])?;
        }

        // Update start_index and s
        s = &s[(match_end - start_index)..];
        start_index = match_end;
    }

    Ok(())
}

```

### Core Architecture Module: `src/input.rs`
```
use signal_hook::consts::SIGWINCH;
use signal_hook::low_level::pipe;
use termion::event::{parse_event, Event, Key, MouseEvent};

use std::io;
use std::io::{stdin, Read, Stdin};
use std::os::unix::io::AsRawFd;
use std::os::unix::net::UnixStream;

const POLL_INFINITE_TIMEOUT: i32 = -1;
const SIGWINCH_PIPE_INDEX: usize = 0;
const BUFFER_SIZE: usize = 1024;

const ESCAPE: u8 = 0o33;

pub fn remap_dev_tty_to_stdin() {
    // The readline library we use, rustyline, always gets its input from STDIN.
    // If jless accepts its input from STDIN, then rustyline can't accept input.
    // To fix this, we open up /dev/tty, and remap it to STDIN, as suggested in
    // this StackOverflow post:
    //
    // https://stackoverflow.com/questions/29689034/piped-stdin-and-keyboard-same-time-in-c
    //
    // rustyline may add its own fix to support reading from /dev/tty:
    //
    // https://github.com/kkawakam/rustyline/issues/599
    unsafe {
        // freopen(3) docs: https://linux.die.net/man/3/freopen
        let filename = std::ffi::CString::new("/dev/tty").unwrap();
        let path = std::ffi::CString::new("r").unwrap();
        let _ = libc::freopen(filename.as_ptr(), path.as_ptr(), libc_stdhandle::stdin());
    }
}

pub fn get_input() -> impl Iterator<Item = io::Result<TuiEvent>> {
    let (sigwinch_read, sigwinch_write) = UnixStream::pair().unwrap();
    // NOTE: This overrides the SIGWINCH handler registered by rustyline.
    // We should maybe get a reference to the existing signal handler
    // and call it when appropriate, but it seems to only be used to handle
    // line wrapping, and it seems to work fine without it.
    pipe::register(SIGWINCH, sigwinch_write).unwrap();
    TuiInput::new(stdin(), sigwinch_read)
}

fn read_and_retry_on_interrupt(input: &mut Stdin, buf: &mut [u8]) -> io::Result<usize> {
    loop {
        match input.read(buf) {
            res @ Ok(_) => {
                return res;
            }
            Err(err) => {
                if err.kind() != io::ErrorKind::Interrupted {
                    return Err(err);
                }
                // Otherwise just try again
            }
        }
    }
}

struct BufferedInput<const N: usize> {
    input: Stdin,
    buffer: [u8; N],
    buffer_size: usize,
    buffer_index: usize,
    might_have_more_data: bool,
}

impl<const N: usize> BufferedInput<N> {
    fn new(input: Stdin) -> BufferedInput<N> {
        BufferedInput {
            input,
            buffer: [0; N],
            buffer_size: 0,
            buffer_index: 0,
            might_have_more_data: false,
        }
    }

    fn next_u8(&mut self) -> u8 {
        if self.buffer_index >= self.buffer_size {
            panic!("No data in buffer");
        }

        let val = self.buffer[self.buffer_index];
        self.buffer_index += 1;
        val
    }

    fn clear(&mut self) {
        // Clear buffer in debug mode.
        if cfg!(debug_assertions) {
            for elem in self.buffer.iter_mut() {
                *elem = 0;
            }
        }

        self.buffer_size = 0;
        self.buffer_index = 0;
        self.might_have_more_data = false;
    }

    fn might_have_buffered_data(&self) -> bool {
        self.might_have_more_data || self.has_buffered_data()
    }

    fn has_buffered_data(&self) -> bool {
        self.buffer_index < self.buffer_size
    }

    fn take_pure_escape(&mut self) -> bool {
        if self.buffer_index == 0 && self.buffer_size == 1 && self.buffer[0] == ESCAPE {
            // This will set self.might_have_more_data = true, which is fine,
            // because that only gets set to true when buffer_size == N, but
            // we just checked that it is 1 and not N.
            self.clear();
            return true;
        }

        false
    }

    fn read_more_if_needed(&mut self) -> Option<io::Error> {
        if self.has_buffered_data() {
            return None;
        }

        self.clear();

        match read_and_retry_on_interrupt(&mut self.input, &mut self.buffer) {
            Ok(bytes_read) => {
                self.buffer_size = bytes_read;
                self.might_have_more_data = bytes_read == N;
                None
            }
            Err(err) => Some(err),
        }
    }
}

impl<const N: usize> Iterator for BufferedInput<N> {
    type Item = io::Result<u8>;

    fn next(&mut self) -> Option<io::Result<u8>> {
        if !self.has_buffered_data() {
            return None;
        }

        Some(Ok(self.next_u8()))
    }
}

struct TuiInput {
    poll_fds: [libc::pollfd; 2],
    sigwinch_pipe: UnixStream,
    buffered_input: BufferedInput<BUFFER_SIZE>,
}

impl TuiInput {
    fn new(input: Stdin, sigwinch_pipe: UnixStream) -> TuiInput {
        let sigwinch_fd = sigwinch_pipe.as_raw_fd();
        let stdin_fd = input.as_raw_fd();

        let poll_fds: [libc::pollfd; 2] = [
            libc::pollfd {
                fd: sigwinch_fd,
                events: libc::POLLIN,
                revents: 0,
            },
            libc::pollfd {
                fd: stdin_fd,
                events: libc::POLLIN,
                revents: 0,
            },
        ];

        TuiInput {
            poll_fds,
            sigwinch_pipe,
            buffered_input: BufferedInput::new(input),
        }
    }

    fn get_event_from_buffered_input(&mut self) -> Option<io::Result<TuiEvent>> {
        if !self.buffered_input.has_buffered_data() {
            if let Some(err) = self.buffered_input.read_more_if_needed() {
                return Some(Err(err));
            }
        }

        if self.buffered_input.take_pure_escape() {
            return Some(Ok(TuiEvent::KeyEvent(Key::Esc)));
        }

        match self.buffered_input.next() {
            Some(Ok(byte)) => match parse_event(byte, &mut self.buffered_input) {
                Ok(Event::Key(k)) => Some(Ok(TuiEvent::KeyEvent(k))),
                Ok(Event::Mouse(m)) => Some(Ok(TuiEvent::MouseEvent(m))),
                Ok(Event::Unsupported(bytes)) => Some(Ok(TuiEvent::Unknown(bytes))),
                Err(err) => Some(Err(err)),
            },
            Some(Err(err)) => Some(Err(err)),
            None => None,
        }
    }
}

impl Iterator for TuiInput {
    type Item = io::Result<TuiEvent>;

    fn next(&mut self) -> Option<io::Result<TuiEvent>> {
        if self.buffered_input.might_have_buffered_data() {
            return self.get_event_from_buffered_input();
        }

        let poll_res: Option<io::Error>;

        loop {
            match unsafe { libc::poll(self.poll_fds.as_mut_ptr(), 2, POLL_INFINITE_TIMEOUT) } {
                -1 => {
                    let err = io::Error::last_os_error();
                    if err.kind() != io::ErrorKind::Interrupted {
                        poll_res = Some(err);
                        break;
                    }
                    // Try poll again.
                }
                _ => {
                    poll_res = None;
                    break;
                }
            };
        }

        if let Some(poll_err) = poll_res {
            return Some(Err(poll_err));
        }

        if self.poll_fds[SIGWINCH_PIPE_INDEX].revents & libc::POLLIN != 0 {
            // Just make this big enough to absorb a bunch of unacknowledged SIGWINCHes.
            let mut buf = [0; 32];
            let _ = self.sigwinch_pipe.read(&mut buf);
            return Some(Ok(TuiEvent::WinChEvent));
        }

        self.get_event_from_buffered_input()
    }
}

#[derive(Debug)]
pub enum TuiEvent {
    WinChEvent,
    KeyEvent(Key),
    MouseEvent(MouseEvent),
    Unknown(Vec<u8>),
}

```

### Core Architecture Module: `src/jsonparser.rs`
```
use logos::{Lexer, Logos};

use crate::flatjson::{ContainerType, Index, OptionIndex, Row, Value};
use crate::jsontokenizer::JsonToken;

struct JsonParser<'a> {
    tokenizer: Lexer<'a, JsonToken>,
    parents: Vec<Index>,
    rows: Vec<Row>,
    pretty_printed: String,
    max_depth: usize,

    peeked_token: Option<Option<JsonToken>>,
}

pub fn parse(json: String) -> Result<(Vec<Row>, String, usize), String> {
    let mut parser = JsonParser {
        tokenizer: JsonToken::lexer(&json),
        parents: vec![],
        rows: vec![],
        pretty_printed: String::new(),
        max_depth: 0,
        peeked_token: None,
    };

    parser.parse_top_level_json()?;

    Ok((parser.rows, parser.pretty_printed, parser.max_depth))
}

impl<'a> JsonParser<'a> {
    fn next_token(&mut self) -> Option<JsonToken> {
        if self.peeked_token.is_some() {
            self.peeked_token.take().unwrap()
        } else {
            self.tokenizer.next()
        }
    }

    fn advance(&mut self) {
        self.next_token();
    }

    fn advance_and_consume_whitespace(&mut self) {
        self.advance();
        self.consume_whitespace();
    }

    fn peek_token_or_eof(&mut self) -> Option<JsonToken> {
        if self.peeked_token.is_none() {
            self.peeked_token = Some(self.tokenizer.next());
        }

        self.peeked_token.unwrap()
    }

    fn peek_token(&mut self) -> Result<JsonToken, String> {
        self.peek_token_or_eof()
            .ok_or_else(|| "Unexpected EOF".to_string())
    }

    fn unexpected_token(&mut self) -> Result<usize, String> {
        Err(format!("Unexpected token: {:?}", self.peek_token()))
    }

    fn consume_whitespace(&mut self) {
        while let Some(JsonToken::Whitespace | JsonToken::Newline) = self.peek_token_or_eof() {
            self.advance();
        }
    }

    fn parse_top_level_json(&mut self) -> Result<(), String> {
        self.consume_whitespace();
        let mut prev_top_level = self.parse_elem()?;
        let mut num_child = 0;

        loop {
            self.consume_whitespace();

            if self.peek_token_or_eof().is_none() {
                break;
            }

            self.pretty_printed.push('\n');
            let next_top_level = self.parse_elem()?;
            num_child += 1;

            self.rows[next_top_level].prev_sibling = OptionIndex::Index(prev_top_level);
            self.rows[next_top_level].index_in_parent = num_child;
            self.rows[prev_top_level].next_sibling = OptionIndex::Index(next_top_level);

            prev_top_level = next_top_level;
        }

        Ok(())
    }

    fn parse_elem(&mut self) -> Result<usize, String> {
        self.consume_whitespace();

        self.max_depth = self.max_depth.max(self.parents.len());

        loop {
            match self.peek_token()? {
                JsonToken::OpenCurly => {
                    return self.parse_object();
                }
                JsonToken::OpenSquare => {
                    return self.parse_array();
                }
                JsonToken::Null => {
                    return self.parse_null();
                }
                JsonToken::True => {
                    return self.parse_bool(true);
                }
                JsonToken::False => {
                    return self.parse_bool(false);
                }
                JsonToken::Number => {
                    return self.parse_number();
                }
                JsonToken::String => {
                    return self.parse_string();
                }

                JsonToken::Whitespace | JsonToken::Newline => {
                    panic!("Should have just consumed whitespace");
                }

                JsonToken::Error => {
                    return Err("Parse error".to_string());
                }
                JsonToken::CloseCurly
                | JsonToken::CloseSquare
                | JsonToken::Colon
                | JsonToken::Comma => {
                    return Err(format!("Unexpected character: {:?}", self.tokenizer.span()));
                }
            }
        }
    }

    fn parse_array(&mut self) -> Result<usize, String> {
        let open_value = Value::OpenContainer {
            container_type: ContainerType::Array,
            collapsed: false,
            // To be set when parsing is complete.
            first_child: 0,
            close_index: 0,
        };

        let array_open_index = self.create_row(open_value);

        self.parents.push(array_open_index);
        self.pretty_printed.push('[');
        self.advance_and_consume_whitespace();

        let mut prev_sibling = OptionIndex::Nil;
        let mut num_children = 0;

        loop {
            if num_children != 0 {
                match self.peek_token()? {
                    // Great, we needed a comma; eat it up.
                    JsonToken::Comma => self.advance_and_consume_whitespace(),
                    // We're going to peek again below and check for ']', so we don't
                    // need to do anything.
                    JsonToken::CloseSquare => {}
                    _ => return self.unexpected_token(),
                }
            }

            if self.peek_token()? == JsonToken::CloseSquare {
                self.advance();
                break;
            }

            // Add comma to pretty printed version _after_ we know
            // we didn't see a CloseSquare so we don't add a trailing comma.
            if num_children != 0 {
                self.pretty_printed.push_str(", ");
            }

            let child = self.parse_elem()?;
            self.consume_whitespace();

            if num_children == 0 {
                match self.rows[array_open_index].value {
                    Value::OpenContainer {
                        ref mut first_child,
                        ..
                    } => {
                        *first_child = child;
                    }
                    _ => panic!("Must be Array!"),
                }
            }

            self.rows[child].prev_sibling = prev_sibling;
            self.rows[child].index_in_parent = num_children;
            if let OptionIndex::Index(prev) = prev_sibling {
                self.rows[prev].next_sibling = OptionIndex::Index(child);
            }

            num_children += 1;
            prev_sibling = OptionIndex::Index(child);
        }

        self.parents.pop();

        if num_children == 0 {
            self.rows[array_open_index].value = Value::EmptyArray;
            self.rows[array_open_index].range.end = self.rows[array_open_index].range.start + 2;
        } else {
            let close_value = Value::CloseContainer {
                container_type: ContainerType::Array,
                collapsed: false,
                last_child: prev_sibling.unwrap(),
                open_index: array_open_index,
            };

            let array_close_index = self.create_row(close_value);

            // Update end of the Array range; we add the ']' to pretty_printed
            // below, hence the + 1.
            self.rows[array_open_index].range.end = self.pretty_printed.len() + 1;

            match self.rows[array_open_index].value {
                Value::OpenContainer {
                    ref mut close_index,
                    ..
                } => {
                    *close_index = array_close_index;
                }
                _ => panic!("Must be Array!"),
            }
        }

        self.pretty_printed.push(']');
        Ok(array_open_index)
    }

    fn parse_object(&mut self) -> Result<usize, String> {
        let open_value = Value::OpenContainer {
            container_type: ContainerType::Object,
            collapsed: false,
            // To be set when parsing is complete.
            first_child: 0,
            close_index: 0,
        };

        let object_open_index = self.create_row(open_value);

        self.parents.push(object_open_index
```

### Core Architecture Module: `src/jsonstringunescaper.rs`
```
use std::fmt;
use std::fmt::Write;

#[derive(Debug)]
pub struct UnescapeError {
    index: usize,
    codepoint_chars: [u8; 4],
    error: UnicodeError,
}

#[derive(Debug)]
enum UnicodeError {
    UnexpectedLowSurrogate,
    UnmatchedHighSurrogate,
}

impl fmt::Display for UnescapeError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "unescaping error at char {}: ", self.index)?;
        let codepoint_chars = std::str::from_utf8(&self.codepoint_chars).unwrap();
        match &self.error {
            UnicodeError::UnexpectedLowSurrogate => {
                write!(f, "unexpected low surrogate \"\\u{codepoint_chars}\"")
            }
            UnicodeError::UnmatchedHighSurrogate => write!(
                f,
                "high surrogate \"\\u{codepoint_chars}\" not followed by low surrogate"
            ),
        }
    }
}

enum DecodedCodepoint {
    Char(char),
    LowSurrogate(u16),
    HighSurrogate(u16),
}

// Unescapes a syntactically valid JSON string into a valid UTF-8 string.
// If [escape_control_characters] is true, Unicode control characters will be
// be escaped.
//
// This makes the assumption that the only characters following a '\' are:
// - single character escapes: "\/bfnrt
// - a unicode character escape: uxxxx
//
// Unicode escapes are exactly four characters, and essentially represent
// UTF-16 encoded codepoints.
//
// Unicode codepoints between U+010000 and U+10FFFF (codepoints outside
// the Basic Multilingual Plane) must be encoded as a surrogate pair.
//
// For more information, and a walkthrough of how to convert the surrogate pairs
// back into an actual char, see:
// https://en.wikipedia.org/wiki/UTF-16#Code_points_from_U+010000_to_U+10FFFF
fn unescape_json_string(s: &str, escape_control_characters: bool) -> Result<String, UnescapeError> {
    let mut chars = s.chars();
    let mut unescaped = String::with_capacity(s.len());
    let mut index = 1;

    while let Some(ch) = chars.next() {
        index += 1;
        if ch != '\\' {
            if escape_control_characters && is_control(ch) {
                unescaped.push_str("\\u00");
                write!(unescaped, "{:02X}", ch as u32).unwrap();
            } else {
                unescaped.push(ch);
            }
            continue;
        }

        let escaped = chars.next().unwrap();
        index += 1;

        match escaped {
            '"' => unescaped.push('"'),
            '\\' => unescaped.push('\\'),
            '/' => unescaped.push('/'),
            // '\b' is backspace, a control character.
            'b' => {
                if escape_control_characters {
                    unescaped.push_str("\\b");
                } else {
                    unescaped.push(0x08 as char);
                }
            }
            'f' => unescaped.push('\x0c'),
            'n' => unescaped.push('\n'),
            'r' => unescaped.push('\r'),
            't' => unescaped.push('\t'),
            'u' => {
                let (codepoint, codepoint_chars) = parse_codepoint_from_chars(&mut chars);
                index += 4;

                match decode_codepoint(codepoint) {
                    DecodedCodepoint::Char(ch) => {
                        if escape_control_characters && is_control(ch) {
                            unescaped.push_str("\\u");
                            unescaped.push(codepoint_chars[0] as char);
                            unescaped.push(codepoint_chars[1] as char);
                            unescaped.push(codepoint_chars[2] as char);
                            unescaped.push(codepoint_chars[3] as char);
                        } else {
                            unescaped.push(ch)
                        }
                    }
                    DecodedCodepoint::LowSurrogate(_) => {
                        return Err(UnescapeError {
                            index: index - 6,
                            codepoint_chars,
                            error: UnicodeError::UnexpectedLowSurrogate,
                        });
                    }
                    DecodedCodepoint::HighSurrogate(hs) => match (chars.next(), chars.next()) {
                        (Some('\\'), Some('u')) => {
                            index += 2;
                            let (codepoint, _) = parse_codepoint_from_chars(&mut chars);
                            index += 4;

                            match decode_codepoint(codepoint) {
                                DecodedCodepoint::LowSurrogate(ls) => {
                                    let codepoint = (hs as u32) * 0x400 + (ls as u32) + 0x10000;
                                    unescaped.push(char::from_u32(codepoint).unwrap());
                                }
                                _ => {
                                    return Err(UnescapeError {
                                        index,
                                        codepoint_chars,
                                        error: UnicodeError::UnmatchedHighSurrogate,
                                    });
                                }
                            }
                        }
                        _ => {
                            return Err(UnescapeError {
                                index,
                                codepoint_chars,
                                error: UnicodeError::UnmatchedHighSurrogate,
                            });
                        }
                    },
                }
            }
            _ => panic!("Unexpected escape character in JSON string: {}", ch),
        }
    }

    Ok(unescaped)
}

// Unescapes a syntactically valid JSON string into a valid UTF-8 string, but
// leaves control characters escaped.
pub fn safe_unescape_json_string(s: &str) -> Result<String, UnescapeError> {
    unescape_json_string(s, true)
}

// Unescapes a syntactically valid JSON string into a valid UTF-8 string, including
// control characters.
#[allow(dead_code)] // Only used with #[cfg(feature = "sexp")], but we want to write
                    // regular tests for it
pub fn unsafe_unescape_json_string(s: &str) -> Result<String, UnescapeError> {
    unescape_json_string(s, false)
}

fn is_control(ch: char) -> bool {
    matches!(ch as u32, 0x00..=0x1F | 0x7F..=0x9F)
}

// Consumes four hex characters from a Chars iterator, and converts it to a u16.
// Also returns the four original characters as a mini [u8] that can be safely
// interpreted as a str.
fn parse_codepoint_from_chars(chars: &mut std::str::Chars<'_>) -> (u16, [u8; 4]) {
    let mut codepoint = 0;
    let chars = [
        chars.next().unwrap(),
        chars.next().unwrap(),
        chars.next().unwrap(),
        chars.next().unwrap(),
    ];
    let utf8_chars = [
        chars[0] as u8,
        chars[1] as u8,
        chars[2] as u8,
        chars[3] as u8,
    ];
    codepoint += hex_char_to_int(chars[0]) * 0x1000;
    codepoint += hex_char_to_int(chars[1]) * 0x0100;
    codepoint += hex_char_to_int(chars[2]) * 0x0010;
    codepoint += hex_char_to_int(chars[3]);
    (codepoint, utf8_chars)
}

fn hex_char_to_int(ch: char) -> u16 {
    match ch {
        '0'..='9' => (ch as u16) - ('0' as u16),
        'a'..='f' => (ch as u16) - ('a' as u16) + 10,
        'A'..='f' => (ch as u16) - ('A' as u16) + 10,
        _ => panic!("Unexpected non-hex digit: {}", ch),
    }
}

// Interprets a codepoint in the Basic Multilingual Plane as either an actual
// char, or one of a surrogate pair. The value associated with the surrogate
// has had the offset removed.
fn decode_codepoint(codepoint: u16) -> DecodedCodepoint {
    match codepoint {
        0xD800..=0xDBFF => DecodedCodepoint::HighSurrogate(codepoint - 0xD800),
        0xDC00..=0xDFFF => DecodedCodepoint::LowSurrogate(codepoint - 0xDC00),
        _ => DecodedCodepoint::Char(char::from_u32(codepoint as u32).unwrap()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[track_caller]
    fn check(escaped:
```

### Core Architecture Module: `src/jsontokenizer.rs`
```
use logos::Logos;

// A basic JSON tokenizer

#[derive(Logos, Debug, Copy, Clone, PartialEq)]
pub enum JsonToken {
    // Characters
    #[token("{")]
    OpenCurly,
    #[token("}")]
    CloseCurly,
    #[token("[")]
    OpenSquare,
    #[token("]")]
    CloseSquare,
    #[token(":")]
    Colon,
    #[token(",")]
    Comma,
    #[token("null")]
    Null,
    #[token("true")]
    True,
    #[token("false")]
    False,
    #[regex(r"-?(0|([1-9][0-9]*))(\.[0-9]+)?([eE][-+]?[0-9]+)?")]
    Number,
    // I get an error when I do [0-9a-fA-F]{4}.
    #[regex("\"((\\\\([\"\\\\/bfnrt]|u[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]))|[^\"\\\\\x00-\x1F])*\"")]
    String,

    // Whitespace; need separate newline token to handle newline-delimited JSON.
    #[token("\n")]
    Newline,
    #[regex("[ \t\r]+", logos::skip)]
    Whitespace,

    #[error]
    Error,
}

```

### Core Architecture Module: `src/lineprinter.rs`
```
use std::collections::hash_map::Entry;
use std::fmt;
use std::fmt::Write;
use std::iter::Peekable;
use std::ops::Range;

use regex::Regex;

use crate::flatjson::{FlatJson, OptionIndex, Row, Value};
use crate::highlighting;
use crate::search::MatchRangeIter;
use crate::terminal;
use crate::terminal::{Color, Style, Terminal};
use crate::truncatedstrview::TruncatedStrView;
use crate::viewer::Mode;

// This module is responsible for printing single lines of JSON to
// the screen, complete with syntax highlighting and highlighting
// of search matches.
//
// A single line is one of the following:
// - The start of a non-empty object or array
// - The end of a non-empty object or array
// - A key/value pair of an object
// - An element of an array
// - Or a top-level primitive
//
// Objects and containers can be collapsed, and at certain times
// we show previews next to containers.
//
// The viewer can be in one of two modes: Line mode, or Data mode.
// In Line mode, the goal is that the text on the screen is mostly
// valid JSON. In Data mode, we try to present a "cleaner" version
// of the data, by for example, not showing quotes around object keys
// or trailing commas.
//
// Here's the main set of differences:
//                                  Line Mode                 Data Mode
// Quotes around object keys:         Yes         Only when not a valid JS identifier
// Trailing commas:                   Yes                       No
// Object and Array previews: Only when collapsed               Always
// Array Indexes:                     No                        Yes
// Open delimiters:                   Yes                       No
// Line for closing delimiters:       Yes                       No
//
// In addition to the above behavior that depends on the current
// viewer mode, when rendering a line we also apply syntax
// highlighting and highlight search results. The currently focused
// search result is also displayed slightly differently.
//
// Great care is taken to highlight every character that is actually
// part of a match, including quotes around keys and string values,
// and even other syntax (colons, commas, and spaces). It is
// difficult to keep track of everything as the text displayed on
// the screen doesn't exactly match the source JSON. Beware of
// off-by-one errors.
//
//
// Naturally, there may be cases where an entire line does not fit
// on the screen without wrapping. Rather than implement line
// wrapping (which seems difficult), we truncate values and show
// ellipses to indicate truncated content. When printing out multiple
// values, such as the key and value of an Object entry, the index
// and element of an array, or the many container elements in an
// object preview, we fill in the available space from left to right
// while keeping track of what still needs to be displayed so we
// can show appropriate truncation indicators.
//
// Here are some examples:
//
//     key: "long text her…" |
//     medium_length_key: t… |
//
// If something is totally off the screen we just show a '>':
//
//     really_long_key_h…: > |
//                   [10…]: >|
//                     "d": >|
//                          >|

const FOCUSED_LINE: &str = "▶ ";
const NOT_FOCUSED_LINE: &str = "  ";
const FOCUSED_COLLAPSED_CONTAINER: &str = "▶ ";
const FOCUSED_EXPANDED_CONTAINER: &str = "▼ ";
const COLLAPSED_CONTAINER: &str = "▷ ";
const EXPANDED_CONTAINER: &str = "▽ ";
const INDICATOR_WIDTH: isize = 2;
const NO_FOCUSED_MATCH: Range<usize> = 0..0;

lazy_static::lazy_static! {
    pub static ref JS_IDENTIFIER: Regex = Regex::new("^[_$a-zA-Z][_$a-zA-Z0-9]*$").unwrap();
}

enum LabelType {
    Key,
    Index,
}

#[derive(Eq, PartialEq)]
enum DelimiterPair {
    None,
    Quote,
    Square,
}

impl DelimiterPair {
    fn left(&self) -> &'static str {
        match self {
            DelimiterPair::None => "",
            DelimiterPair::Quote => "\"",
            DelimiterPair::Square => "[",
        }
    }

    fn right(&self) -> &'static str {
        match self {
            DelimiterPair::None => "",
            DelimiterPair::Quote => "\"",
            DelimiterPair::Square => "]",
        }
    }

    fn width(&self) -> isize {
        match self {
            DelimiterPair::None => 0,
            _ => 2,
        }
    }
}

// What line number should be displayed
#[derive(Copy, Clone)]
pub struct LineNumber {
    pub absolute: Option<usize>,
    pub relative: Option<usize>,
    pub max_width: isize,
}

pub struct LinePrinter<'a, 'b> {
    pub mode: Mode,
    pub terminal: &'a mut dyn Terminal,

    // The entire FlatJson data structure and the specific line
    // we're printing out.
    pub flatjson: &'a FlatJson,
    pub row: &'a Row,
    pub line_number: LineNumber,

    // Width of the terminal and how much we should indent the line.
    pub width: isize,
    pub indentation: isize,

    // Line-by-line formatting options
    pub focused: bool,
    pub focused_because_matching_container_pair: bool,
    pub trailing_comma: bool,

    // For highlighting
    pub search_matches: Option<Peekable<MatchRangeIter<'b>>>,
    pub focused_search_match: &'a Range<usize>,

    // It's unfortunate that this has to be exposed publicly; it's only
    // used internally to disable the special syntax highlighting for
    // the current focused match in container previews.
    pub emphasize_focused_search_match: bool,

    // For remembering horizontal scroll positions of long lines.
    pub cached_truncated_value: Option<Entry<'a, usize, TruncatedStrView>>,
}

impl<'a, 'b> LinePrinter<'a, 'b> {
    pub fn print_line(&mut self) -> fmt::Result {
        self.terminal.reset_style()?;

        let mut available_space = self.width;

        let space_used_for_line_number = self.print_line_number(available_space)?;
        available_space -= space_used_for_line_number;

        let expected_space_used_for_indicators = INDICATOR_WIDTH + self.indentation;
        let space_used_for_indicators =
            self.print_focus_and_container_indicators(available_space)?;

        if space_used_for_indicators == expected_space_used_for_indicators {
            available_space -= space_used_for_indicators;

            let space_used_for_label = self.fill_in_label(available_space)?;
            available_space -= space_used_for_label;

            if self.has_label() && space_used_for_label == 0 {
                self.print_truncated_indicator()?;
            } else {
                let space_used_for_value = self.fill_in_value(available_space)?;

                if space_used_for_value == 0 {
                    self.print_truncated_indicator()?;
                }
            }
        } else {
            self.print_truncated_indicator()?;
        }

        Ok(())
    }

    // Absolute | Relative | Focused | Format
    // ---------+----------+---------+--------
    //     N    |     N    |    -    | Nothing
    //     Y    |     N    |    N    | Right aligned, dimmed
    //     Y    |     N    |    Y    | Right aligned, yellow
    //     N    |     Y    |    N    | Right aligned, dimmed
    //     N    |     Y    |    Y    | Right aligned, yellow
    //     Y    |     Y    |    N    | Relative, right aligned, dimmed
    //     Y    |     Y    |    Y    | Absolute, left aligned, yellow
    fn print_line_number(&mut self, available_space: isize) -> Result<isize, fmt::Error> {
        let LineNumber {
            absolute,
            relative,
            max_width,
        } = self.line_number;

        // If the line number is going to fill up all the available space (or overfill it)
        // then don't print the line number.
        if max_width + 1 >= available_space {
            return Ok(0);
        }

        let (n, style, right_aligned) = match (absolute, relative, self.focused) {
            (None, None, _) => return Ok(0),
            (Some(n), None, false) | (None, Some(n), false) | (Some(_), Some(n), false) => {
                (n, &highlight
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #71** (2023-07-17): **No non-zero exit code in case of parsing errors**
  *Symptoms*: ### Description `jless` currently returns 0 (success) as an exit code, even if the command failed (e.g. if the input wasn't valid JSON). To reproduce: ```bash jless - <<<"This is no JSON"; echo $? ``` will result the following output: ``` Unable to parse input: "Parse error" 0 ```  ### Impact / use-case Having a non-zero exit code increases interoperability and allows for fallbacks in scripts, e.g. `jless "$@" || less "$@"`
  **Post-Mortem & Fix Analysis**:
  > This has been implemented in [`v0.9.0`](https://github.com/PaulJuliusMartinez/jless/releases/tag/v0.9.0).

- **Issue #62** (2022-03-10): **jless no longer handles window resizing in v0.7.2**
  *Symptoms*: This is a regression from v0.7.1. jless seemingly no longer responds to SIGWINCH signals. Likely introduced in https://github.com/PaulJuliusMartinez/jless/pull/32.
  **Post-Mortem & Fix Analysis**:
  > Fixed in 880ef2d181f2acfffb534de4f668ffab45da1830.
  > I'll leave this open until a new version is released with the fix.
  > This is now fixed in the [v0.8.0](https://github.com/PaulJuliusMartinez/jless/releases/tag/v0.8.0) release.

- **Issue #7** (2022-02-20): **Cannot use `/` to search when piped.**
  *Symptoms*: This tool is _glorious_!  But, I found a problem. If you pipe info to it, say from an aws cli: `aws iam list-instance-profiles | jless` for example, I cannot search.   Hitting `/` immediately exits, which was surprising.
  **Post-Mortem & Fix Analysis**:
  > Thank you!  I'm able to reproduce the issue. Looks like it might be an issue with the readline library I'm using, so it might take some time to figure out.
  > I also faced this bug when piping the output
  > I ran into this also. From strace it looks like the readline implementation is attempting to read the "/" from fd=0, which is connected to the file being piped as input, not the TTY, and hitting the EOF (since the file has already been fully read):  ```c poll([{fd=4, events=POLLIN}, {fd=3, events=POLLIN}], 2, -1) = 1 ([{fd=3, revents=POLLIN}]) // the read below on fd 3 looks like a read on sigwinch_pipe by TuiInput read(3, "/", 1024)                      = 1 write(1, "\33[?25h\33[65;1H\33[0m", 17) = 17 // oops? I think this is a read by rustyline readline_with() (on stdin/the file instead of a terminal connected fd): read(0, "", 8192)                       = 0 write(1, "\33[?25l\33[65;1H\33[0m\33[2K", 21) = 21 write(2, "thread '", 8thread ')                 = 8 write(2, "main", 4main)                     = 4 write(2, "' panicked at '", 15' panicked at ')         = 15 write(2, "called `Result::unwrap()` on an `Err` value: Eof", 48called `Result::unwrap()` on an `Err` value:

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

### Incident Patch 1: `a469b272` (2023-07-20)
**Commit Message**: Fix a few spelling mistakes.

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ New features:
   before the desired one will be focused. When using `<count>G`
   (uppercase 'G'), all the ancestors of the desired line will be
   expanded to ensure it is visible.
-- Add `C` and `E` commands, analagous to the existing `c` and `e`
+- Add `C` and `E` commands, analogous to the existing `c` and `e`
   commands, to deeply collapse/expand a node and all its siblings.
 
 Improvements:
```

**File**: `src/search.rs` (modified, +1/-1)
```diff
@@ -293,7 +293,7 @@ impl SearchState {
                         });
 
                         // If NONE of the matches start after the end of the focused row,
-                        // parition_point returns the length of the array, but then we
+                        // partition_point returns the length of the array, but then we
                         // want to jump back to the start in that case.
                         let next_match_index = if next_match == self.matches.len() {
                             0
```

**File**: `src/truncatedstrview.rs` (modified, +5/-5)
```diff
@@ -50,8 +50,8 @@ pub struct TruncatedStrView {
 /// character.
 ///
 /// Since showing a replacement character is less than ideal, when
-/// we are showing other chracters, we will opt for not using the
-/// entire available space, rather than including the replacment
+/// we are showing other characters, we will opt for not using the
+/// entire available space, rather than including the replacement
 /// character.
 ///
 /// This range also keeps track of how much space it takes up.
@@ -570,7 +570,7 @@ impl<'a> RangeAdjuster<'a> {
         let mut more_on_left = true;
         let mut more_on_right = true;
 
-        // Need to try to expand even even when used_space == available_space
+        // Need to try to expand even when used_space == available_space
         // to possible consume ellipses.
         while self.used_space <= self.available_space {
             let mut added_to_left = false;
@@ -657,7 +657,7 @@ impl<'a> RangeAdjuster<'a> {
         // ellipsis (because it's the last character), so
         // something like "🦀" is represented as "…", not "�".
         let showing_replacement_character =
-            // We only show a repacement character if we're not
+            // We only show a replacement character if we're not
             // showing anything at all...
             self.start == self.end &&
                 // But we have room to showing something...
@@ -783,7 +783,7 @@ mod tests {
         assert_init_states("🦀🦀abc🦀🦀", 5, "🦀🦀…", "…🦀🦀", Some(5));
 
         // Since we're showing a normal character, these don't use the
-        // replacment, so the lengths are different for front vs. back.
+        // replacement, so the lengths are different for front vs. back.
         assert_init_start("a🦀bc", 3, "a…", Some(2));
         assert_init_back("a🦀bc", 3, "…bc", Some(3));
 
```

**File**: `src/viewer.rs` (modified, +4/-4)
```diff
@@ -660,7 +660,7 @@ impl JsonViewer {
         }
     }
 
-    // If the user provided a count to a jump command, sets that as the the new
+    // If the user provided a count to a jump command, sets that as the new
     // jump distance. Otherwise, use the stored jump distance, or if none has
     // been set yet, use the default of half a window size.
     fn determine_jump_distance(&mut self, distance: Option<usize>) -> usize {
@@ -787,7 +787,7 @@ impl JsonViewer {
 
     fn toggle_mode(&mut self) {
         // If we're transitioning from line mode to focused mode, and we're focused on
-        // the closing of a container, we need to move the focuse.
+        // the closing of a container, we need to move the focus.
         if self.mode == Mode::Line && self.flatjson[self.focused_row].is_closing_of_container() {
             // We'll move focus to the next item, unless we're at the end of
             // the file and have to move focus backwards.
@@ -831,7 +831,7 @@ impl JsonViewer {
         // row and the top or bottom of the screen.
         let max_padding = self.dimensions.height - scrolloff - 1;
 
-        // Normally as the user moves down the the file we'll keep the focused line
+        // Normally as the user moves down the file we'll keep the focused line
         // scrolloff lines from the bottom of the screen.
         //
         // But if the user jumps well past the end of the screen, rather than leaving
@@ -1510,7 +1510,7 @@ mod tests {
                 // Can scroll so end of file is in middle of screen
                 (Action::ScrollDown(1), 6, 8),
                 (Action::ScrollDown(4), 10, 12),
-                // Can scoll past scrolloff padding
+                // Can scroll past scrolloff padding
                 (Action::ScrollDown(1), 11, 12),
                 (Action::ScrollDown(1), 12, 12),
                 // Can't scroll past last line
```

---

### Incident Patch 2: `8bbfa771` (2023-07-08)
**Commit Message**: Fix last clippy issues.

**File**: `src/app.rs` (modified, +4/-12)
```diff
@@ -155,10 +155,7 @@ impl App {
             if self.input_state == InputState::WaitingForAnyKeyPress {
                 if matches!(event, KeyEvent(_)) {
                     let _ = write!(self.screen_writer.stdout, "{ToAlternateScreen}");
-                    let _ = write!(
-                        self.screen_writer.stdout,
-                        "{ENABLE_MOUSE_BUTTON_TRACKING}"
-                    );
+                    let _ = write!(self.screen_writer.stdout, "{ENABLE_MOUSE_BUTTON_TRACKING}");
                     self.input_state = InputState::Default;
                     self.draw_screen();
                     self.message = None;
@@ -741,15 +738,13 @@ impl App {
                 let quoteless_range = (key_range.start + 1)..(key_range.end - 1);
 
                 // Don't copy quotes in Data mode.
-                let copied_key = if self.viewer.mode == Mode::Data
+                if self.viewer.mode == Mode::Data
                     && JS_IDENTIFIER.is_match(&json[quoteless_range.clone()])
                 {
                     json[quoteless_range].to_string()
                 } else {
                     json[key_range.clone()].to_string()
-                };
-
-                copied_key
+                }
             }
             ct @ (ContentTarget::DotPath
             | ContentTarget::BracketPath
@@ -816,10 +811,7 @@ impl App {
                 let _ = write!(self.screen_writer.stdout, "{ToMainScreen}");
                 // Disable mouse button tracking so that the user can use their mouse
                 // to highlight the text.
-                let _ = write!(
-                    self.screen_writer.stdout,
-                    "{DISABLE_MOUSE_BUTTON_TRACKING}"
-                );
+                let _ = write!(self.screen_writer.stdout, "{DISABLE_MOUSE_BUTTON_TRACKING}");
                 let _ = write!(
                     self.screen_writer.stdout,
                     "{}{}{}\n\nPress any key to continue.",
```

**File**: `src/jsonstringunescaper.rs` (modified, +1/-5)
```diff
@@ -141,11 +141,7 @@ pub fn unescape_json_string(s: &str) -> Result<String, UnescapeError> {
 }
 
 fn is_control(ch: char) -> bool {
-    match ch as u32 {
-        0x00..=0x1F => true,
-        0x7F..=0x9F => true,
-        _ => false,
-    }
+    matches!(ch as u32, 0x00..=0x1F | 0x7F..=0x9F)
 }
 
 // Consumes four hex characters from a Chars iterator, and converts it to a u16.
```

**File**: `src/search.rs` (modified, +2/-5)
```diff
@@ -173,11 +173,8 @@ impl SearchState {
     }
 
     pub fn set_matches_visible_if_actively_searching(&mut self) {
-        match self.immediate_state {
-            ImmediateSearchState::ActivelySearching { .. } => {
-                self.immediate_state = ImmediateSearchState::MatchesVisible
-            }
-            _ => {}
+        if let ImmediateSearchState::ActivelySearching { .. } = self.immediate_state {
+            self.immediate_state = ImmediateSearchState::MatchesVisible;
         }
     }
 
```

---

### Incident Patch 3: `7c6edb76` (2023-07-08)
**Commit Message**: Fix some simple clippy lints.

**File**: `src/highlighting.rs` (modified, +4/-4)
```diff
@@ -112,14 +112,14 @@ pub const INVERTED_BOLD_BLUE_STYLE: Style = Style {
 };
 
 #[allow(clippy::too_many_arguments)]
-pub fn highlight_truncated_str_view<'a>(
+pub fn highlight_truncated_str_view(
     out: &mut dyn Terminal,
     mut s: &str,
     str_view: &TruncatedStrView,
     mut str_range_start: Option<usize>,
     style: &Style,
     highlight_style: &Style,
-    matches_iter: &mut Option<&mut Peekable<MatchRangeIter<'a>>>,
+    matches_iter: &mut Option<&mut Peekable<MatchRangeIter<'_>>>,
     focused_search_match: &Range<usize>,
 ) -> fmt::Result {
     let mut leading_ellipsis = false;
@@ -168,13 +168,13 @@ pub fn highlight_truncated_str_view<'a>(
     Ok(())
 }
 
-pub fn highlight_matches<'a>(
+pub fn highlight_matches(
     out: &mut dyn Terminal,
     mut s: &str,
     str_range_start: Option<usize>,
     style: &Style,
     highlight_style: &Style,
-    matches_iter: &mut Option<&mut Peekable<MatchRangeIter<'a>>>,
+    matches_iter: &mut Option<&mut Peekable<MatchRangeIter<'_>>>,
     focused_search_match: &Range<usize>,
 ) -> fmt::Result {
     if str_range_start.is_none() {
```

**File**: `src/jsonstringunescaper.rs` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ fn is_control(ch: char) -> bool {
 // Consumes four hex characters from a Chars iterator, and converts it to a u16.
 // Also returns the four original characters as a mini [u8] that can be safely
 // interpreted as a str.
-fn parse_codepoint_from_chars<'a, 'b>(chars: &'a mut std::str::Chars<'b>) -> (u16, [u8; 4]) {
+fn parse_codepoint_from_chars(chars: &mut std::str::Chars<'_>) -> (u16, [u8; 4]) {
     let mut codepoint = 0;
     let chars = [
         chars.next().unwrap(),
```

**File**: `src/lineprinter.rs` (modified, +3/-3)
```diff
@@ -172,7 +172,7 @@ impl<'a, 'b> LinePrinter<'a, 'b> {
     pub fn print_line(&mut self) -> fmt::Result {
         self.terminal.reset_style()?;
 
-        let mut available_space = self.width as isize;
+        let mut available_space = self.width;
 
         let space_used_for_line_number = self.print_line_number(available_space)?;
         available_space -= space_used_for_line_number;
@@ -1078,7 +1078,7 @@ impl<'a, 'b> LinePrinter<'a, 'b> {
         }
 
         let focused_search_match = if self.emphasize_focused_search_match {
-            &self.focused_search_match
+            self.focused_search_match
         } else {
             &NO_FOCUSED_MATCH
         };
@@ -1148,7 +1148,7 @@ impl<'a, 'b> LinePrinter<'a, 'b> {
         self.highlight_str(delimiter.left(), str_open_delimiter_range_start, styles)?;
 
         let focused_search_match = if self.emphasize_focused_search_match {
-            &self.focused_search_match
+            self.focused_search_match
         } else {
             &NO_FOCUSED_MATCH
         };
```

**File**: `src/main.rs` (modified, +2/-0)
```diff
@@ -1,6 +1,8 @@
 // I don't like this rule because it changes the semantic
 // structure of the code.
 #![allow(clippy::collapsible_else_if)]
+// Sometimes "x >= y + 1" is semantically clearer than "x > y"
+#![allow(clippy::int_plus_one)]
 
 extern crate lazy_static;
 extern crate libc_stdhandle;
```

**File**: `src/screenwriter.rs` (modified, +4/-4)
```diff
@@ -247,10 +247,10 @@ impl ScreenWriter {
         );
 
         if self.show_line_numbers {
-            absolute_line_number = Some(index + 1 as usize);
+            absolute_line_number = Some(index + 1);
         }
         if self.show_relative_line_numbers {
-            relative_line_number = Some(delta_to_focused_row.abs() as usize);
+            relative_line_number = Some(delta_to_focused_row.unsigned_abs());
         }
 
         let mut line = lp::LinePrinter {
@@ -411,7 +411,7 @@ impl ScreenWriter {
             TruncatedStrView::init_start(filename, space_available_for_filename);
 
         if truncated_filename.any_contents_visible() {
-            let filename_width = truncated_filename.used_space().unwrap() as isize;
+            let filename_width = truncated_filename.used_space().unwrap();
             space_available_for_base -= filename_width - SPACE_BETWEEN_PATH_AND_FILENAME;
         }
 
@@ -449,7 +449,7 @@ impl ScreenWriter {
         }
 
         if truncated_filename.any_contents_visible() {
-            let filename_width = truncated_filename.used_space().unwrap() as isize;
+            let filename_width = truncated_filename.used_space().unwrap();
 
             self.terminal
                 .position_cursor(self.dimensions.width - (filename_width as u16) + 1, row)?;
```

---

### Incident Patch 4: `0f4691a5` (2023-01-02)
**Commit Message**: Fix pacman installation command.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ You can install `jless` using various package managers:
 | macOS - [HomeBrew](https://formulae.brew.sh/formula/jless) | `brew install jless`      |
 | macOS - [MacPorts](https://ports.macports.org/port/jless/) | `sudo port install jless` |
 | Linux - [HomeBrew](https://formulae.brew.sh/formula/jless) | `brew install jless`      |
-| [Arch Linux](https://archlinux.org/packages/community/x86_64/jless/)     | `pacman -U jless`         |
+| [Arch Linux](https://archlinux.org/packages/community/x86_64/jless/)     | `pacman -S jless`         |
 | [Void Linux](https://github.com/void-linux/void-packages/tree/master/srcpkgs/jless) | `sudo xbps-install jless` |
 | [NetBSD](https://pkgsrc.se/textproc/jless/)                | `pkgin install jless`     |
 | [FreeBSD](https://freshports.org/textproc/jless/)          | `pkg install jless`       |
```

---

### Incident Patch 5: `4e14f706` (2022-03-04)
**Commit Message**: Fix new lint issues flagged by clippy.

**File**: `src/highlighting.rs` (modified, +1/-1)
```diff
@@ -188,7 +188,7 @@ pub fn highlight_matches<'a>(
         let mut match_is_focused_match = false;
 
         // Get rid of matches before the string.
-        while let Some(range) = matches_iter.as_mut().map(|i| i.peek()).flatten() {
+        while let Some(range) = matches_iter.as_mut().and_then(|i| i.peek()) {
             if start_index < range.end {
                 if *range == focused_search_match {
                     match_is_focused_match = true;
```

**File**: `src/search.rs` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ impl SearchState {
         let regex = RegexBuilder::new(&inverted)
             .case_insensitive(!case_sensitive)
             .build()
-            .map_err(|e| format!("{}", e).replace("\n", " "))?;
+            .map_err(|e| format!("{}", e).replace('\n', " "))?;
 
         let matches: Vec<Range<usize>> = regex.find_iter(haystack).map(|m| m.range()).collect();
 
```

**File**: `src/yamlparser.rs` (modified, +2/-2)
```diff
@@ -95,7 +95,7 @@ impl YamlParser {
         let row_index = self.create_row(Value::String);
 
         // Escape newlines.
-        let s = s.replace("\n", "\\n");
+        let s = s.replace('\n', "\\n");
 
         self.pretty_printed.push('"');
         self.pretty_printed.push_str(&s);
@@ -290,7 +290,7 @@ impl YamlParser {
     fn pretty_print_key_item(&mut self, item: Yaml, is_key: bool) -> Result<(), String> {
         if let Yaml::String(s) = item {
             // Replace newlines.
-            let s = s.replace("\n", "\\n");
+            let s = s.replace('\n', "\\n");
             self.pretty_printed.push('"');
             self.pretty_printed.push_str(&s);
             self.pretty_printed.push('"');
```

---

### Incident Patch 6: `7cddcd20` (2022-03-04)
**Commit Message**: Fix panic when using Ctrl-C or Ctrl-D to cancel entering search input. (#54)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@ Bug Fixes:
   sequences and other IO errors instead of panicking.
 - [Issue #62]: Fix broken window resizing / SIGWINCH detection caused
   by clashing signal handler registered by rustyline.
+- [PR #54]: Fix panic when using Ctrl-C or Ctrl-D to cancel entering
+  search input.
 
 
 v0.7.2 (2022-02-20)
```

**File**: `src/app.rs` (modified, +22/-2)
```diff
@@ -1,6 +1,7 @@
 use std::io;
 use std::io::Write;
 
+use rustyline::error::ReadlineError;
 use rustyline::Editor;
 use termion::event::Key;
 use termion::event::MouseButton::{Left, WheelDown, WheelUp};
@@ -261,7 +262,7 @@ impl App {
                             None
                         }
                         Key::Char(':') => {
-                            if let Ok(command) = self.screen_writer.get_command(":") {
+                            if let Some(command) = self.readline(":", "command") {
                                 match Self::parse_command(&command) {
                                     Command::Quit => break,
                                     Command::Help => self.show_help(),
@@ -366,6 +367,24 @@ impl App {
         );
     }
 
+    // Get user input via a readline prompt. May fail to return input if
+    // the user deliberately cancels the prompt via Ctrl-C or Ctrl-D, or
+    // if an actual error occurs, in which case an error message is set.
+    fn readline(&mut self, prompt: &str, purpose: &str) -> Option<String> {
+        match self.screen_writer.get_command(prompt) {
+            Ok(s) => Some(s),
+            // User hit Ctrl-C or Ctrl-D to cancel prompt
+            Err(ReadlineError::Interrupted) | Err(ReadlineError::Eof) => None,
+            Err(err) => {
+                self.message = Some((
+                    format!("Error getting {}: {}", purpose, err),
+                    MessageSeverity::Error,
+                ));
+                None
+            }
+        }
+    }
+
     fn buffer_input(&mut self, ch: u8) {
         // Don't buffer leading 0s.
         if self.input_buffer.is_empty() && ch == b'0' {
@@ -409,7 +428,8 @@ impl App {
             SearchDirection::Forward => "/",
             SearchDirection::Reverse => "?",
         };
-        let search_term = self.screen_writer.get_command(prompt_str).unwrap();
+
+        let search_term = self.readline(prompt_str, "search input")?;
 
         // In vim, /<CR> or ?<CR> is a longcut for repeating the previous search.
         if search_term.is_empty() {
```

---

### Incident Patch 7: `880ef2d1` (2022-03-03)
**Commit Message**: Fix broken SIGWINCH detection / window resizing caused by clashing signal handler registered by rustyline.

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -18,6 +18,8 @@ Bug Fixes:
   status bar to be highlighted and copied.
 - [Issue #61]: Display error message for unrecognized CSI escape
   sequences and other IO errors instead of panicking.
+- [Issue #62]: Fix broken window resizing / SIGWINCH detection caused
+  by clashing signal handler registered by rustyline.
 
 
 v0.7.2 (2022-02-20)
```

**File**: `src/input.rs` (modified, +7/-1)
```diff
@@ -13,7 +13,7 @@ const BUFFER_SIZE: usize = 1024;
 
 const ESCAPE: u8 = 0o33;
 
-pub fn get_input() -> impl Iterator<Item = io::Result<TuiEvent>> {
+pub fn remap_dev_tty_to_stdin() {
     // The readline library we use, rustyline, always gets its input from STDIN.
     // If jless accepts its input from STDIN, then rustyline can't accept input.
     // To fix this, we open up /dev/tty, and remap it to STDIN, as suggested in
@@ -30,8 +30,14 @@ pub fn get_input() -> impl Iterator<Item = io::Result<TuiEvent>> {
         let path = std::ffi::CString::new("r").unwrap();
         let _ = libc::freopen(filename.as_ptr(), path.as_ptr(), libc_stdhandle::stdin());
     }
+}
 
+pub fn get_input() -> impl Iterator<Item = io::Result<TuiEvent>> {
     let (sigwinch_read, sigwinch_write) = UnixStream::pair().unwrap();
+    // NOTE: This overrides the SIGWINCH handler registered by rustyline.
+    // We should maybe get a reference to the existing signal handler
+    // and call it when appropriate, but it seems to only be used to handle
+    // line wrapping, and it seems to work fine without it.
     pipe::register(SIGWINCH, sigwinch_write).unwrap();
     TuiInput::new(stdin(), sigwinch_read)
 }
```

**File**: `src/main.rs` (modified, +6/-6)
```diff
@@ -53,12 +53,12 @@ fn main() {
         std::process::exit(0);
     }
 
-    // Create our input *before* constructing the App. When we get the input,
-    // we use freopen to remap /dev/tty to STDIN so that rustyline works when
+    // We use freopen to remap /dev/tty to STDIN so that rustyline works when
     // JSON input is provided via STDIN. rustyline gets initialized when we
-    // create the App, so by putting this before, we make sure rustyline gets
-    // the /dev/tty input.
-    let input = Box::new(input::get_input());
+    // create the App, so by putting this before creating the app, we make
+    // sure rustyline gets the /dev/tty input.
+    input::remap_dev_tty_to_stdin();
+
     let stdout = MouseTerminal::from(HideCursor::from(AlternateScreen::from(
         io::stdout().into_raw_mode().unwrap(),
     )));
@@ -77,7 +77,7 @@ fn main() {
         }
     };
 
-    app.run(input);
+    app.run(Box::new(input::get_input()));
 }
 
 fn print_pretty_printed_input(input: String, data_format: DataFormat) {
```

---

### Incident Patch 8: `bf055336` (2022-02-26)
**Commit Message**: Revert Arch Linux installation command now that the package has been added to the official community repository.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ You can install `jless` using various package managers:
 | macOS - [HomeBrew](https://formulae.brew.sh/formula/jless) | `brew install jless`      |
 | macOS - [MacPorts](https://ports.macports.org/port/jless/) | `sudo port install jless` |
 | Linux - [HomeBrew](https://formulae.brew.sh/formula/jless) | `brew install jless`      |
-| Arch Linux     | Available in the [AUR](https://aur.archlinux.org/packages/jless)      |
+| [Arch Linux](https://archlinux.org/packages/community/x86_64/jless/)     | `pacman -U jless`         |
 | [NetBSD](https://pkgsrc.se/textproc/jless/)                | `pkgin install jless`     |
 | [FreeBSD](https://freshports.org/textproc/jless/)          | `pkg install jless`       |
 
```

---

### Incident Patch 9: `e5df1687` (2022-02-20)
**Commit Message**: Fix clippy errors.

**File**: `src/highlighting.rs` (modified, +1/-0)
```diff
@@ -106,6 +106,7 @@ pub const INVERTED_BOLD_BLUE_STYLE: Style = Style {
     ..Style::default()
 };
 
+#[allow(clippy::too_many_arguments)]
 pub fn highlight_truncated_str_view<'a>(
     out: &mut dyn Terminal,
     mut s: &str,
```

**File**: `src/lineprinter.rs` (modified, +5/-4)
```diff
@@ -758,10 +758,11 @@ impl<'a, 'b, 'c> LinePrinter<'a, 'b, 'c> {
                 // printed the ", " separator.
                 self.highlight_str("…", None, highlighting::PREVIEW_STYLES)?;
 
-                // This variable technically isn't used again, but for "correctness"
-                // we'll keep it in case we do use the variable later, or code gets
-                // moved around.
-                available_space -= 1;
+                // This variable isn't used again, but if it were, we'd need this
+                // line for correctness. Unfortunately Cargo check complains about it,
+                // so we'll just leave it here commented out in case code moves around
+                // and we need it.
+                // available_space -= 1;
 
                 num_printed += 1;
                 break;
```

**File**: `src/terminal.rs` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ pub enum Color {
 }
 
 // Commented out colors are unused.
+#[cfg(test)]
 pub const BLACK: Color = Color::C16(0);
 pub const RED: Color = Color::C16(1);
 pub const GREEN: Color = Color::C16(2);
```

---

### Incident Patch 10: `619f7469` (2022-02-09)
**Commit Message**: Fix direction for ?pattern in Usage Guide docs.

**File**: `docs/usage.html` (modified, +4/-2)
```diff
@@ -250,10 +250,12 @@ <h3 id="search">Search</h3>
       </p>
     <ul>
       <li>
-        <code>/pattern</code> Search forward for the given pattern.
+        <i>count</i>
+        <code>/pattern</code> Search forward for the given pattern, or to its <code>N</code>th occurrence.
       </li>
       <li>
-        <code>?pattern</code> Search forward for the given pattern.
+        <i>count</i>
+        <code>?pattern</code> Search backwards for the given pattern, or to its <code>N</code>th previous occurrence.
       </li>
       <li>
         <i>count</i>
```

#### Recent Merged Pull Requests:
- **PR #171** (closed): make clipboard functionality optional (@mzhang28)
- **PR #159** (closed): typos suggestion (@ccoVeille)
- **PR #148** (closed): Update README.md (@DeeliN221)
- **PR #139** (2023-11-29): Update Arch Linux package URL in README.md (@felixonmars)
- **PR #128** (closed): use a channel for stdin and SIGWINCH (@yshavit)
- **PR #122** (2023-07-17): Moved cargo install description into the Installation table (@GeroVanMi)
- **PR #107** (closed): Bump clap to version 4.0 (@tranzystorekk)
- **PR #106** (closed): Spelling (@jsoref)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
