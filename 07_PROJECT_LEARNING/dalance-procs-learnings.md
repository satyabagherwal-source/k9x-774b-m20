# Forensic Learning Record (Deep Inspection): dalance/procs

> **Canonical Artifact**: `07_PROJECT_LEARNING/dalance-procs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dalance/procs](https://github.com/dalance/procs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:29:16.902Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dalance/procs`
- **Description**: A modern replacement for ps written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6190 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/columns/state.rs`
```
use crate::process::ProcessInfo;
use crate::{column_default, Column};
use std::cmp;
use std::collections::HashMap;

#[cfg(target_os = "windows")]
use crate::process::{thread_state, wait_reason, ThreadState};

pub struct State {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, String>,
    width: usize,
}

impl State {
    pub fn new(header: Option<String>) -> Self {
        let header = header.unwrap_or_else(|| String::from("State"));
        let unit = String::new();
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
        }
    }
}

#[cfg(any(target_os = "linux", target_os = "android"))]
impl Column for State {
    fn add(&mut self, proc: &ProcessInfo) {
        let fmt_content = format!("{}", proc.curr_proc.stat().state);
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

#[cfg(target_os = "macos")]
impl Column for State {
    fn add(&mut self, proc: &ProcessInfo) {
        let mut state = 7;
        for t in &proc.curr_threads {
            let s = match t.pth_run_state {
                1 => 1, // TH_STATE_RUNNING
                2 => 5, // TH_STATE_STOPPED
                3 => {
                    if t.pth_sleep_time > 20 {
                        4
                    } else {
                        3
                    }
                } // TH_STATE_WAITING
                4 => 2, // TH_STATE_UNINTERRUPTIBLE
                5 => 6, // TH_STATE_HALTED
                _ => 7,
            };
            state = cmp::min(s, state);
        }
        let state = match state {
            0 => "",
            1 => "R",
            2 => "U",
            3 => "S",
            4 => "I",
            5 => "T",
            6 => "H",
            _ => "?",
        };
        let fmt_content = state.to_string();
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

#[cfg(target_os = "freebsd")]
impl Column for State {
    fn add(&mut self, proc: &ProcessInfo) {
        let info = &proc.curr_proc.info;
        let flag = info.flag;
        let tdflags = info.tdflags;
        let cr_flags = info.cr_flags;
        let kiflag = info.kiflag;

        let mut state = match info.stat {
            libc::SSTOP => "T",
            libc::SSLEEP => {
                if (tdflags & libc::TDF_SINTR as i64) != 0 {
                    if info.slptime >= 20 {
                        "I"
                    } else {
                        "S"
                    }
                } else {
                    "D"
                }
            }
            libc::SRUN | libc::SIDL => "R",
            libc::SWAIT => "W",
            libc::SLOCK => "L",
            libc::SZOMB => "Z",
            _ => "?",
        }
        .to_string();
        if (flag & libc::P_INMEM as i64) == 0 {
            state.push_str("W");
        }
        if info.nice < libc::NZERO as i8 || info.pri.class == bsd_kvm_sys::PRI_REALTIME as u8 {
            state.push_str("<");
        }
        if info.nice > libc::NZERO as i8 || info.pri.class == bsd_kvm_sys::PRI_IDLE as u8 {
            state.push_str("N");
        }
        if (flag & libc::P_TRACED as i64) != 0 {
            state.push_str("X");
        }
        if (flag & libc::P_WEXIT as i64) != 0 && info.stat != libc::SZOMB as std::os::raw::c_char {
            state.push_str("E");
        }
        if (flag & libc::P_PPWAIT as i64) != 0 {
            state.push_str("V");
        }
        if (flag & libc::P_SYSTEM as i64) != 0 || info.lock > 0 {
            state.push_str("L");
        }
        if (cr_flags & libc::KI_CRF_CAPABILITY_MODE as u32) != 0 {
            state.push_str("C");
        }
        if (kiflag & libc::KI_SLEADER as i64) != 0 {
            state.push_str("s");
        }
        if (flag & libc::P_CONTROLT as i64) != 0 && info.pgid == info.tpgid {
            state.push_str("+");
        }
        if (flag & libc::P_JAILED as i64) != 0 {
            state.push_str("J");
        }
        let fmt_content = state;
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

// ---------------------------------------------------------------------------
// Windows
//
// There is no per-process state to read: `SYSTEM_PROCESS_INFORMATION` only
// counts the threads, while `SYSTEM_THREAD_INFORMATION` is what carries the
// scheduler state. A row is therefore described by the threads behind it.
// ---------------------------------------------------------------------------

/// The letter `ps` prints for one thread's state.
///
/// `WaitReason` is only read while the thread is in `WAITING`: it is a leftover
/// from the last wait otherwise, and a thread that is runnable again still
/// carries the reason it sleeps on.
#[cfg(target_os = "windows")]
fn thread_state_char(state: ThreadState) -> char {
    use thread_state::*;

    match state.state {
        // Runnable, or on its way there: `TRANSITION` only means the kernel
        // stack is still being brought in.
        INITIALIZED | READY | RUNNING | STANDBY | TRANSITION | DEFERRED_READY => 'R',
        WAITING | GATE_WAIT | WAITING_FOR_PROCESS_IN_SWAP => match state.wait_reason {
            wait_reason::SUSPENDED | wait_reason::WR_SUSPENDED => 'T',
            _ => 'S',
        },
        TERMINATED => 'Z',
        _ => '?',
    }
}

/// The state letter of one row.
///
/// `state` is the most active thread's raw state, reduced by the snapshot
/// layer; `thread_count` is the `NumberOfThreads` the snapshot reported. It
/// is what separates a process that has no threads left from one whose
/// records simply could not be read.
#[cfg(target_os = "windows")]
fn state_char(state: Option<ThreadState>, thread_count: i32) -> char {
    match state {
        // No thread left at all: the process has terminated and is only still
        // listed because handles to it remain open.
        None if thread_count <= 0 => 'Z',
        // Threads were claimed but none could be read: not enough to call it.
        None => '?',
        Some(state) => thread_state_char(state),
    }
}

#[cfg(target_os = "windows")]
impl Column for State {
    fn add(&mut self, proc: &ProcessInfo) {
        let fmt_content = String::from(state_char(proc.state, proc.thread));
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

```

### Core Architecture Module: `src/util.rs`
```
use crate::Opt;
use crate::column::Column;
use crate::columns::{ConfigColumnKind, KIND_LIST};
use crate::config::{Config, ConfigColumnAlign, ConfigSearchCase, ConfigSearchLogic, ConfigTheme};
use crate::opt::ArgThemeMode;
use byte_unit::{Byte, UnitType};
use std::borrow::Cow;
use std::io;
use std::io::IsTerminal;
use std::time::Duration;
use std::time::Instant;
use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};
#[cfg(not(target_os = "windows"))]
use uzers::UsersCache;

const ANSI_RESET: &str = "\u{1b}[0m";

impl From<ArgThemeMode> for ConfigTheme {
    fn from(item: ArgThemeMode) -> Self {
        match item {
            ArgThemeMode::Auto => ConfigTheme::Auto,
            ArgThemeMode::Dark => ConfigTheme::Dark,
            ArgThemeMode::Light => ConfigTheme::Light,
        }
    }
}

pub enum KeywordClass {
    Numeric,
    NonNumeric,
}

pub fn find_partial<T: AsRef<str>>(
    columns: &[&dyn Column],
    pid: i32,
    keyword: &[T],
    logic: &ConfigSearchLogic,
    case: &ConfigSearchCase,
) -> bool {
    let mut ret = match logic {
        ConfigSearchLogic::And => true,
        ConfigSearchLogic::Or => false,
        ConfigSearchLogic::Nand => true,
        ConfigSearchLogic::Nor => false,
    };
    for w in keyword {
        let mut hit = false;
        let keyword = w.as_ref();
        let keyword_lowercase = keyword.to_ascii_lowercase();

        let ignore_case = match case {
            ConfigSearchCase::Smart => keyword == keyword.to_ascii_lowercase(),
            ConfigSearchCase::Insensitive => true,
            ConfigSearchCase::Sensitive => false,
        };

        let (keyword, content_to_lowercase) = if ignore_case {
            (keyword_lowercase.as_str(), true)
        } else {
            (keyword, false)
        };

        for c in columns {
            if c.find_partial(pid, keyword, content_to_lowercase) {
                hit = true;
                break;
            }
        }
        ret = match logic {
            ConfigSearchLogic::And => ret & hit,
            ConfigSearchLogic::Or => ret | hit,
            ConfigSearchLogic::Nand => ret & hit,
            ConfigSearchLogic::Nor => ret | hit,
        };
    }
    ret
}

pub fn find_exact<T: AsRef<str>>(
    columns: &[&dyn Column],
    pid: i32,
    keyword: &[T],
    logic: &ConfigSearchLogic,
    case: &ConfigSearchCase,
) -> bool {
    let mut ret = match logic {
        ConfigSearchLogic::And => true,
        ConfigSearchLogic::Or => false,
        ConfigSearchLogic::Nand => true,
        ConfigSearchLogic::Nor => false,
    };
    for w in keyword {
        let mut hit = false;
        let keyword = w.as_ref();
        let keyword_lowercase = keyword.to_ascii_lowercase();

        let ignore_case = match case {
            ConfigSearchCase::Smart => keyword == keyword.to_ascii_lowercase(),
            ConfigSearchCase::Insensitive => true,
            ConfigSearchCase::Sensitive => false,
        };

        let (keyword, content_to_lowercase) = if ignore_case {
            (keyword_lowercase.as_str(), true)
        } else {
            (keyword, false)
        };

        for c in columns {
            if c.find_exact(pid, keyword, content_to_lowercase) {
                hit = true;
                break;
            }
        }
        ret = match logic {
            ConfigSearchLogic::And => ret & hit,
            ConfigSearchLogic::Or => ret | hit,
            ConfigSearchLogic::Nand => ret & hit,
            ConfigSearchLogic::Nor => ret | hit,
        };
    }
    ret
}

pub fn classify(keyword: &str) -> KeywordClass {
    let parsed = keyword.parse::<i64>();
    match parsed {
        Ok(_) => KeywordClass::Numeric,
        _ => KeywordClass::NonNumeric,
    }
}

pub fn has_regex_syntax(pattern: &str) -> bool {
    let mut escaped = false;
    for c in pattern.chars() {
        if escaped {
            escaped = false;
            continue;
        }
        if c == '\\' {
            escaped = true;
            continue;
        }
        if matches!(
            c,
            '|' | '(' | ')' | '[' | ']' | '{' | '}' | '*' | '+' | '?' | '^' | '$'
        ) {
            return true;
        }
    }
    false
}

pub fn adjust(x: &str, len: usize, align: &ConfigColumnAlign) -> String {
    if len < UnicodeWidthStr::width(x) {
        String::from(truncate(x, len))
    } else {
        match align {
            ConfigColumnAlign::Left => {
                format!("{}{}", x, " ".repeat(len - UnicodeWidthStr::width(x)))
            }
            ConfigColumnAlign::Right => {
                format!("{}{}", " ".repeat(len - UnicodeWidthStr::width(x)), x)
            }
            ConfigColumnAlign::Center => {
                let space = len - UnicodeWidthStr::width(x);
                let left = space / 2;
                let right = space / 2 + space % 2;
                format!("{}{}{}", " ".repeat(left), x, " ".repeat(right))
            }
        }
    }
}

pub fn parse_time(x: u64) -> String {
    let rest = x;

    let sec = rest % 60;
    let rest = rest / 60;

    let min = rest % 60;
    let rest = rest / 60;

    let hour = rest % 24;

    let day = x as f64 / (60.0 * 60.0 * 24.0);
    let year = x as f64 / (365.0 * 60.0 * 60.0 * 24.0);

    if year >= 1.0 {
        format!("{year:.1}years")
    } else if day >= 1.0 {
        format!("{day:.1}days")
    } else {
        format!("{hour:02}:{min:02}:{sec:02}")
    }
}

pub fn truncate(s: &'_ str, width: usize) -> Cow<'_, str> {
    let mut total_width = 0;
    let mut ret = None;
    let mut buf = String::new();
    let mut escape = false;
    for c in s.chars() {
        if c == '\u{1b}' {
            escape = true;
        }
        if escape {
            if c == 'm' {
                escape = false;
            }
            buf.push(c);
            continue;
        }
        total_width += UnicodeWidthChar::width(c).unwrap_or_default();
        if total_width > width {
            ret = Some(buf);
            break;
        }
        buf.push(c);
    }
    if let Some(mut buf) = ret {
        // Truncation discards everything after the cut point, including any trailing
        // ANSI reset. Without it the terminal keeps the last style after procs exits.
        if buf.contains('\u{1b}') {
            buf.push_str(ANSI_RESET);
        }
        Cow::Owned(buf)
    } else {
        Cow::Borrowed(s)
    }
}

/// Replace control characters with spaces.
///
/// Process command lines are fully attacker-controlled, so any ESC/CSI/OSC
/// sequence they contain would otherwise be interpreted by the terminal of
/// whoever runs procs.
pub fn sanitize_control_chars(s: &str) -> String {
    s.replace(|c: char| char::is_control(c), " ")
}

/// Trim trailing whitespace from a string that may contain ANSI escape sequences.
/// Unlike str::trim_end(), this correctly handles ANSI codes at the end of the string
/// that would otherwise prevent trimming of trailing whitespace.
pub fn ansi_trim_end(s: &str) -> String {
    let stripped = console::strip_ansi_codes(s);
    let trimmed_width = UnicodeWidthStr::width(stripped.trim_end());
    if trimmed_width == UnicodeWidthStr::width(stripped.as_ref()) {
        return s.to_string();
    }
    truncate(s, trimmed_width).into_owned()
}

pub fn find_column_kind(pat: &str) -> Option<ConfigColumnKind> {
    // strict search at first
    for (k, (v, _)) in KIND_LIST.iter() {
        if v.to_lowercase().eq(&pat.to_lowercase()) {
            return Some(k.clone());
        }
    }

    for (k, (v, _)) in KIND_LIST.iter() {
        if v.to_lowercase().contains(&pat.to_lowercase()) {
            return Some(k.clone());
        }
    }
    eprintln!("Can't find column kind: {pat}");
    None
}

#[cfg(target_os = "macos")]
pub fn change_endian(val: u32) -> u32 {
    let mut ret = 0;
    ret |= val >> 24 & 0x000000ff;
    ret |= val >> 8 & 0x0000ff00;
    ret |= val << 8 & 0x00ff0000;
    ret |= val << 24 & 0xff000000;
    ret
}

#[cfg(target_os = "macos")]
pub unsafe fn get_sys_value(
    high: u32,
    low: u32,
    mut len: usize,
    value: *mut libc::c_void,
    mib: &mut [i32; 2],
) -> bool {
    mib[0] = high as i32;
    mib[1] = low as i32;
    libc::sysctl(
        mib.as_mut_ptr(),
        2,
        value,
        &mut len as *mut usize,
        ::std::ptr::null_mut(),
        0,
    ) == 0
}

pub fn bytify(x: u64) -> String {
    let byte = Byte::from_u64(x);
    let byte = byte.get_appropriate_unit(UnitType::Binary);
    format!("{:.3}", byte).replace([' ', 'B', 'i'], "")
}

pub fn lap(instant: &mut Instant, msg: &str) {
    let period = instant.elapsed();
    eprintln!(
        "{} [{}.{:03}s]",
        msg,
        period.as_secs(),
        period.subsec_millis()
    );
    instant.clone_from(&Instant::now());
}

pub fn get_theme(opt: &Opt, config: &Config) -> ConfigTheme {
    let theme = match (opt.theme, &config.display.theme) {
        (Some(x), _) => x.into(),
        (_, x) => x.clone(),
    };
    match theme {
        ConfigTheme::Auto => {
            if io::stdout().is_terminal() && io::stderr().is_terminal() && io::stdin().is_terminal()
            {
                let minimum_timeout = Duration::from_millis(100);
                let timeout = if let Ok(latency) = termbg::latency(Duration::from_millis(1000)) {
                    if latency * 2 > minimum_timeout {
                        latency * 2
                    } else {
                        minimum_timeout
                    }
                } else {
                    // If latency detection failed, fallback to dark theme
                    return ConfigTheme::Dark;
                };

                if let Ok(theme) = termbg::theme(timeout) {
                    match theme {
                        termbg::Theme::Dark => ConfigTheme::Dark,
                        termbg::Theme::Light => ConfigTheme::Light,
                    }
                } else {
                    // If termbg failed, fallback to dark theme
                  
```

### Core Architecture Module: `src/column.rs`
```
use crate::config::{Config, ConfigColumnAlign, ConfigSortOrder};
use crate::process::ProcessInfo;

pub trait Column {
    fn add(&mut self, proc: &ProcessInfo);

    fn available(&self) -> bool {
        true
    }

    fn sortable(&self) -> bool {
        true
    }

    fn display_header(
        &self,
        align: &ConfigColumnAlign,
        order: Option<ConfigSortOrder>,
        config: &Config,
    ) -> String;
    fn display_unit(&self, align: &ConfigColumnAlign) -> String;
    fn display_content(&self, pid: i32, align: &ConfigColumnAlign) -> Option<String>;
    fn display_json(&self, pid: i32) -> String;
    fn find_partial(&self, pid: i32, keyword: &str, content_to_lowercase: bool) -> bool;
    fn find_exact(&self, pid: i32, keyword: &str, content_to_lowercase: bool) -> bool;
    fn sorted_pid(&self, order: &ConfigSortOrder) -> Vec<i32>;
    fn apply_visible(&mut self, visible_pids: &[i32]);
    fn reset_width(
        &mut self,
        order: Option<ConfigSortOrder>,
        config: &Config,
        max_width: Option<usize>,
        min_width: Option<usize>,
    );
    fn update_width(&mut self, pid: i32, max_width: Option<usize>);
    fn get_width(&self) -> usize;
    fn is_numeric(&self) -> bool;
}

#[macro_export]
macro_rules! column_default_display_header {
    () => {
        fn display_header(
            &self,
            align: &$crate::config::ConfigColumnAlign,
            order: Option<$crate::config::ConfigSortOrder>,
            config: &$crate::config::Config,
        ) -> String {
            if let Some(order) = order {
                let header = match order {
                    $crate::config::ConfigSortOrder::Ascending => {
                        format!("{}:{}", self.header, config.display.ascending)
                    }
                    $crate::config::ConfigSortOrder::Descending => {
                        format!("{}:{}", self.header, config.display.descending)
                    }
                };
                $crate::util::adjust(&header, self.width, align)
            } else {
                $crate::util::adjust(&self.header, self.width, align)
            }
        }
    };
}

#[macro_export]
macro_rules! column_default_display_unit {
    () => {
        fn display_unit(&self, align: &$crate::config::ConfigColumnAlign) -> String {
            $crate::util::adjust(&self.unit, self.width, align)
        }
    };
}

#[macro_export]
macro_rules! column_default_display_content {
    () => {
        fn display_content(
            &self,
            pid: i32,
            align: &$crate::config::ConfigColumnAlign,
        ) -> Option<String> {
            self.fmt_contents
                .get(&pid)
                .map(|content| $crate::util::adjust(content, self.width, align))
        }
    };
}

#[macro_export]
macro_rules! column_default_display_json {
    () => {
        fn display_json(&self, pid: i32) -> String {
            let value = if self.is_numeric() {
                self.raw_contents
                    .get(&pid)
                    .map(|x| x.to_string())
                    .unwrap_or("".to_string())
            } else {
                let value = self
                    .fmt_contents
                    .get(&pid)
                    .map(|x| x.clone())
                    .unwrap_or("".to_string());
                let value = value.replace("\\", "\\\\");
                let value = value.replace("\"", "\\\"");
                format!("\"{}\"", value)
            };
            format!("\"{}\": {}", self.header, value)
        }
    };
}

#[macro_export]
macro_rules! column_default_find_partial {
    () => {
        fn find_partial(&self, pid: i32, keyword: &str, content_to_lowercase: bool) -> bool {
            if let Some(content) = self.fmt_contents.get(&pid) {
                if content_to_lowercase {
                    content.to_ascii_lowercase().find(keyword).is_some()
                } else {
                    content.find(keyword).is_some()
                }
            } else {
                false
            }
        }
    };
}

#[macro_export]
macro_rules! column_default_find_exact {
    () => {
        fn find_exact(&self, pid: i32, keyword: &str, content_to_lowercase: bool) -> bool {
            if let Some(content) = self.fmt_contents.get(&pid) {
                if content_to_lowercase {
                    content.to_ascii_lowercase() == keyword
                } else {
                    content == keyword
                }
            } else {
                false
            }
        }
    };
}

#[macro_export]
macro_rules! column_default_sorted_pid {
    ($x:ty) => {
        fn sorted_pid(&self, order: &$crate::config::ConfigSortOrder) -> Vec<i32> {
            let mut contents: Vec<(&i32, &$x)> = self.raw_contents.iter().collect();
            contents.sort_by_key(|&(_x, y)| y);
            if matches!(*order, $crate::config::ConfigSortOrder::Descending) {
                contents.reverse()
            }
            contents.iter().map(|(x, _y)| **x).collect()
        }
    };
}

#[macro_export]
macro_rules! column_default_apply_visible {
    () => {
        fn apply_visible(&mut self, _visible_pids: &[i32]) {}
    };
}

#[macro_export]
macro_rules! column_default_reset_width {
    () => {
        fn reset_width(
            &mut self,
            order: Option<$crate::config::ConfigSortOrder>,
            config: &$crate::config::Config,
            max_width: Option<usize>,
            min_width: Option<usize>,
        ) {
            // +1 for spacing between header and sort indicator
            let sorted_space = if let Some(order) = order {
                match order {
                    $crate::config::ConfigSortOrder::Ascending => {
                        unicode_width::UnicodeWidthStr::width(config.display.ascending.as_str()) + 1
                    }
                    $crate::config::ConfigSortOrder::Descending => {
                        unicode_width::UnicodeWidthStr::width(config.display.descending.as_str())
                            + 1
                    }
                }
            } else {
                0
            };
            let header_len = unicode_width::UnicodeWidthStr::width(self.header.as_str());
            let unit_len = unicode_width::UnicodeWidthStr::width(self.unit.as_str());
            self.width = std::cmp::max(header_len + sorted_space, unit_len);
            if let Some(min_width) = min_width {
                self.width = std::cmp::max(self.width, min_width);
            }
            if let Some(max_width) = max_width {
                self.width = std::cmp::min(self.width, max_width);
            }
        }
    };
}

#[macro_export]
macro_rules! column_default_update_width {
    () => {
        fn update_width(&mut self, pid: i32, max_width: Option<usize>) {
            if let Some(content) = self.fmt_contents.get(&pid) {
                let content_len = unicode_width::UnicodeWidthStr::width(content.as_str());
                self.width = cmp::max(content_len, self.width);
                if let Some(max_width) = max_width {
                    self.width = std::cmp::min(self.width, max_width);
                }
            }
        }
    };
}

#[macro_export]
macro_rules! column_default_get_width {
    () => {
        fn get_width(&self) -> usize {
            self.width
        }
    };
}

#[macro_export]
macro_rules! column_default_is_numeric {
    ($x:expr) => {
        fn is_numeric(&self) -> bool {
            $x
        }
    };
}

#[macro_export]
macro_rules! column_default {
    ($x:ty, $y:expr) => {
        $crate::column_default_display_header!();
        $crate::column_default_display_unit!();
        $crate::column_default_display_content!();
        $crate::column_default_display_json!();
        $crate::column_default_find_partial!();
        $crate::column_default_find_exact!();
        $crate::column_default_sorted_pid!($x);
        $crate::column_default_apply_visible!();
        $crate::column_default_reset_width!();
        $crate::column_default_update_width!();
        $crate::column_default_get_width!();
        $crate::column_default_is_numeric!($y);
    };
}

```

### Core Architecture Module: `src/columns.rs`
```
#[cfg(any(target_os = "linux", target_os = "android"))]
include!("./columns/os_linux.rs");
#[cfg(target_os = "macos")]
include!("./columns/os_macos.rs");
#[cfg(target_os = "windows")]
include!("./columns/os_windows.rs");
#[cfg(target_os = "freebsd")]
include!("./columns/os_freebsd.rs");

```

### Core Architecture Module: `src/columns/arch.rs`
```
use crate::process::ProcessInfo;
use crate::{column_default, Column};
use std::cmp;
use std::collections::HashMap;

#[cfg(target_os = "macos")]
const CTL_MAXNAME: i32 = 12;
#[cfg(target_os = "macos")]
const P_TRANSLATED: i32 = 131072;
#[cfg(target_os = "macos")]
const CPU_TYPE_X86_64: i32 = 16777223;
#[cfg(target_os = "macos")]
const CPU_TYPE_ARM64: i32 = 16777228;

pub struct Arch {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, String>,
    width: usize,
}

impl Arch {
    pub fn new(header: Option<String>) -> Self {
        let header = header.unwrap_or_else(|| String::from("Arch"));
        let unit = String::new();
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit
        }
    }
}

impl Column for Arch {
    fn add(&mut self, proc: &ProcessInfo) {
        let pid = proc.pid;
        let arch = arch_from_pid(pid);

        let fmt_content = arch.to_string();
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/// `IMAGE_FILE_MACHINE_*` constants.
///
/// <https://learn.microsoft.com/zh-cn/windows/win32/sysinfo/image-file-machine-constants>
#[cfg(target_os = "windows")]
mod machine {
    pub const UNKNOWN: u16 = 0x0000;
    pub const ALPHA: u16 = 0x0184;
    /// Same value as `IMAGE_FILE_MACHINE_AXP64`.
    pub const ALPHA64: u16 = 0x0284;
    pub const AM33: u16 = 0x01d3;
    pub const AMD64: u16 = 0x8664;
    pub const ARM: u16 = 0x01c0;
    pub const ARM64: u16 = 0xaa64;
    /// x86_64 code that runs on ARM64 through emulation.
    pub const ARM64EC: u16 = 0xa641;
    /// Image loadable both as ARM64 and as ARM64EC.
    pub const ARM64X: u16 = 0xa64e;
    /// ARMv7 / Thumb-2; `IMAGE_FILE_MACHINE_ARMV7` shares this value.
    pub const ARMNT: u16 = 0x01c4;
    pub const CEE: u16 = 0xc0ee;
    pub const CEF: u16 = 0x0cef;
    pub const EBC: u16 = 0x0ebc;
    pub const I386: u16 = 0x014c;
    pub const IA64: u16 = 0x0200;
    pub const M32R: u16 = 0x9041;
    pub const MIPS16: u16 = 0x0266;
    pub const MIPSFPU: u16 = 0x0366;
    pub const MIPSFPU16: u16 = 0x0466;
    pub const POWERPC: u16 = 0x01f0;
    pub const POWERPCFP: u16 = 0x01f1;
    pub const R3000: u16 = 0x0162;
    pub const R4000: u16 = 0x0166;
    pub const R10000: u16 = 0x0168;
    pub const SH3: u16 = 0x01a2;
    pub const SH3DSP: u16 = 0x01a3;
    pub const SH3E: u16 = 0x01a4;
    pub const SH4: u16 = 0x01a6;
    pub const SH5: u16 = 0x01a8;
    pub const THUMB: u16 = 0x01c2;
    pub const TRICORE: u16 = 0x0520;
    pub const WCEMIPSV2: u16 = 0x0169;
}

/// Reports the architecture of the image `pid` was started from.
///
/// WOW64 processes report their own architecture, not the host's: a 32-bit
/// process on an x86_64 machine yields `x86`.
#[cfg(target_os = "windows")]
pub fn arch_from_pid(pid: i32) -> &'static str {
    use windows_sys::Win32::Foundation::{CloseHandle, FALSE, HANDLE};
    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};

    // 0 is the idle process and has no image; negative pids are not real.
    if pid <= 0 {
        return "unknown";
    }

    // SAFETY: `pid` is only handed to `OpenProcess`, and the handle it hands
    // back is closed before this function returns.
    let handle: HANDLE = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid as u32) };
    if handle.is_null() {
        return "unknown";
    }

    let arch = crate::process::process_image_machine(handle)
        .map(arch_from_machine)
        .unwrap_or("unknown");
    unsafe { CloseHandle(handle) };

    arch
}

/// Names an `IMAGE_FILE_MACHINE_*` value the way the rest of the crate spells
/// architectures (`x86_64`, `arm64`, ...).
#[cfg(target_os = "windows")]
fn arch_from_machine(machine: u16) -> &'static str {
    use machine::*;

    match machine {
        UNKNOWN => "unknown",
        I386 => "x86",
        AMD64 => "x86_64",
        ARM | ARMNT | THUMB => "arm",
        ARM64 => "arm64",
        ARM64EC => "arm64ec",
        ARM64X => "arm64x",
        IA64 => "ia64",
        EBC => "ebc",
        ALPHA | ALPHA64 => "alpha",
        MIPS16 | MIPSFPU | MIPSFPU16 | R3000 | R4000 | R10000 | WCEMIPSV2 => "mips",
        POWERPC | POWERPCFP => "ppc",
        SH3 | SH3DSP | SH3E | SH4 | SH5 => "sh",
        M32R => "m32r",
        AM33 => "am33",
        TRICORE => "tricore",
        CEF => "cef",
        // Pure IL assembly: no architecture of its own.
        CEE => "msil",
        _ => "unknown",
    }
}

// ---------------------------------------------------------------------------
// macOS
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
pub fn arch_from_pid(pid: i32) -> &'static str {
    use {
        libc::{sysctl, sysctlnametomib, cpu_type_t, size_t, CTL_KERN, KERN_PROC, KERN_PROC_PID},
        std::{mem, ffi::CString},
        crate::process::kinfo_proc,
    };

    let mut mib = [0; CTL_MAXNAME as usize];
    let mut length = CTL_MAXNAME as size_t;
    let mut cpu_type: cpu_type_t = -1;
    let mut size = mem::size_of::<cpu_type_t>();

    let sysctl_name = CString::new("sysctl.proc_cputype").unwrap();
    if unsafe { sysctlnametomib(sysctl_name.as_ptr(), mib.as_mut_ptr(), &mut length) } != 0 {
        return "unknown";
    }

    mib[length as usize] = pid;
    length += 1;

    if unsafe { sysctl(mib.as_mut_ptr(), length as u32, &mut cpu_type as *mut _ as *mut _, &mut size, core::ptr::null_mut(), 0) } != 0 {
        return "unknown";
    }

    if cpu_type == CPU_TYPE_X86_64 {
        return "x86_64";
    }

    if cpu_type == CPU_TYPE_ARM64 {
        let mut proc_info: kinfo_proc = unsafe { mem::zeroed() };
        mib[0] = CTL_KERN;
        mib[1] = KERN_PROC;
        mib[2] = KERN_PROC_PID;
        mib[3] = pid;

        length = 4;
        size = mem::size_of::<kinfo_proc>();

        if unsafe { sysctl(mib.as_mut_ptr(), length as u32, &mut proc_info as *mut _ as *mut _, &mut size, core::ptr::null_mut(), 0) } != 0 {
            return "arm64";
        }

        if (proc_info.kp_proc.p_flag & P_TRANSLATED) != 0 {
            return "x86_64";
        }
        return "arm64";
    }

    "unknown"
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::{arch_from_machine, machine};

    #[test]
    fn machine_names() {
        assert_eq!(arch_from_machine(machine::AMD64), "x86_64");
        assert_eq!(arch_from_machine(machine::I386), "x86");
        assert_eq!(arch_from_machine(machine::ARM64), "arm64");
        assert_eq!(arch_from_machine(machine::ARM64EC), "arm64ec");
        // ARMv7 and Thumb-2 are both 32-bit ARM.
        assert_eq!(arch_from_machine(machine::ARMNT), "arm");
        assert_eq!(arch_from_machine(machine::THUMB), "arm");
        // No image, and a value outside the table.
        assert_eq!(arch_from_machine(machine::UNKNOWN), "unknown");
        assert_eq!(arch_from_machine(0x1234), "unknown");
    }
}

```

### Core Architecture Module: `src/columns/ccgroup.rs`
```
use crate::process::ProcessInfo;
use crate::{column_default, Column};
use regex::Regex;
use std::cmp;
use std::collections::HashMap;

pub struct Ccgroup {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, String>,
    width: usize,
    pat_user: Regex,
    pat_machine: Regex,
    pat_lxc_monitor: Regex,
    pat_lxc_payload: Regex,
    pat_scope: Regex,
    pat_service: Regex,
    pat_slice: Regex,
}

impl Ccgroup {
    pub fn new(header: Option<String>) -> Self {
        let header = header.unwrap_or_else(|| String::from("Cgroup (compressed)"));
        let unit = String::new();
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
            pat_user: Regex::new(r"/user-([^/]*)\.slice").unwrap(),
            pat_machine: Regex::new(r"/machine-([^/]*)\.scope").unwrap(),
            pat_lxc_monitor: Regex::new(r"/lxc\.monitor\.([^/]*)").unwrap(),
            pat_lxc_payload: Regex::new(r"/lxc\.payload\.([^/]*)").unwrap(),
            pat_scope: Regex::new(r"/([^/]*)\.scope").unwrap(),
            pat_service: Regex::new(r"/([^/]*)\.service").unwrap(),
            pat_slice: Regex::new(r"/([^/]*)\.slice").unwrap(),
        }
    }
}

macro_rules! replace {
    ( $x: ident, $pat: expr, $fmt: literal) => {
        if let Some(x) = $pat.captures(&$x) {
            $pat.replace(&$x, &format!($fmt, &x[1])).to_string()
        } else {
            $x
        }
    };
}

#[cfg(any(target_os = "linux", target_os = "android"))]
impl Column for Ccgroup {
    fn add(&mut self, proc: &ProcessInfo) {
        let fmt_content = if let Ok(cgroups) = &proc.curr_proc.cgroups() {
            let name = cgroups
                .last()
                .map_or_else(|| "".to_string(), |x| x.pathname.to_string());
            let name = name.replace("/system.slice", "/[S]");
            let name = name.replace("/user.slice", "/[U]");
            let name = replace!(name, self.pat_user, "/[U:{}]");
            let name = name.replace("/machine.slice", "/[M]");
            let name = replace!(name, self.pat_machine, "/[SNC:{}]");
            let name = replace!(name, self.pat_lxc_monitor, "/[LXC:{}]");
            let name = replace!(name, self.pat_lxc_payload, "/[lxc:{}]");
            let name = replace!(name, self.pat_scope, "/!{}");
            let name = replace!(name, self.pat_service, "/{}");
            replace!(name, self.pat_slice, "/[{}]")
        } else {
            "".to_string()
        };
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

```

### Core Architecture Module: `src/columns/cgroup.rs`
```
use crate::process::ProcessInfo;
use crate::{column_default, Column};
use std::cmp;
use std::collections::HashMap;

pub struct Cgroup {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, String>,
    width: usize,
}

impl Cgroup {
    pub fn new(header: Option<String>) -> Self {
        let header = header.unwrap_or_else(|| String::from("Cgroup"));
        let unit = String::new();
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
        }
    }
}

#[cfg(any(target_os = "linux", target_os = "android"))]
impl Column for Cgroup {
    fn add(&mut self, proc: &ProcessInfo) {
        let fmt_content = if let Ok(cgroups) = &proc.curr_proc.cgroups() {
            cgroups
                .last()
                .map_or_else(|| "".to_string(), |x| x.pathname.to_string())
        } else {
            "".to_string()
        };
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

```

### Core Architecture Module: `src/columns/command.rs`
```
use crate::process::ProcessInfo;
use crate::util::sanitize_control_chars;
use crate::{column_default, Column};
use std::cmp;
use std::collections::HashMap;

pub struct Command {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, String>,
    width: usize,
}

impl Command {
    pub fn new(header: Option<String>) -> Self {
        let header = header.unwrap_or_else(|| String::from("Command"));
        let unit = String::new();
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
        }
    }
}

#[cfg(any(target_os = "linux", target_os = "android"))]
impl Column for Command {
    fn add(&mut self, proc: &ProcessInfo) {
        let fmt_content = if let Ok(cmd) = &proc.curr_proc.cmdline() {
            if !cmd.is_empty() {
                let mut cmd = cmd
                    .iter()
                    .cloned()
                    .map(|mut x| {
                        x.push(' ');
                        x
                    })
                    .collect::<String>();
                cmd.pop();
                cmd
            } else {
                format!("[{}]", proc.curr_proc.stat().comm)
            }
        } else {
            proc.curr_proc.stat().comm.clone()
        };
        let fmt_content = sanitize_control_chars(&fmt_content);
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

#[cfg(target_os = "macos")]
impl Column for Command {
    fn add(&mut self, proc: &ProcessInfo) {
        let fmt_content = if let Some(path) = &proc.curr_path {
            if !path.cmd.is_empty() {
                let mut cmd = path
                    .cmd
                    .iter()
                    .cloned()
                    .map(|mut x| {
                        x.push(' ');
                        x
                    })
                    .collect::<String>();
                cmd.pop();
                cmd
            } else {
                String::from("")
            }
        } else {
            String::from("")
        };
        let fmt_content = sanitize_control_chars(&fmt_content);
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

#[cfg(target_os = "windows")]
impl Column for Command {
    fn add(&mut self, proc: &ProcessInfo) {
        // Show the command line when present, otherwise fall back to the image
        // name (e.g. System, Idle, or protected processes with no command line).
        let fmt_content = proc
            .command
            .as_ref()
            .filter(|c| !c.is_empty())
            .cloned()
            .unwrap_or_else(|| proc.file_name.clone());
        let fmt_content = sanitize_control_chars(&fmt_content);
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

#[cfg(target_os = "freebsd")]
impl Column for Command {
    fn add(&mut self, proc: &ProcessInfo) {
        let command = if proc.curr_proc.arg.is_empty() {
            let comm = crate::util::ptr_to_cstr(proc.curr_proc.info.comm.as_ref());
            if let Ok(comm) = comm {
                format!("[{}]", comm.to_string_lossy())
            } else {
                String::from("")
            }
        } else {
            let mut x = String::from("");
            for arg in &proc.curr_proc.arg {
                x.push_str(&arg);
                x.push_str(" ");
            }
            x
        };
        let fmt_content = command;
        let fmt_content = sanitize_control_chars(&fmt_content);
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(String, false);
}

```

### Core Architecture Module: `src/columns/context_sw.rs`
```
use crate::process::ProcessInfo;
use crate::util::bytify;
use crate::{column_default, Column};
use std::cmp;
use std::collections::HashMap;

pub struct ContextSw {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, u64>,
    width: usize,
}

impl ContextSw {
    pub fn new(header: Option<String>) -> Self {
        let header = header.unwrap_or_else(|| String::from("ContextSw"));
        let unit = String::new();
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
        }
    }
}

#[cfg(any(target_os = "linux", target_os = "android"))]
impl Column for ContextSw {
    fn add(&mut self, proc: &ProcessInfo) {
        let (fmt_content, raw_content) = if let Some(ref status) = proc.curr_status {
            if let Some(voluntary_ctxt_switches) = status.voluntary_ctxt_switches
                && let Some(nonvoluntary_ctxt_switches) = status.nonvoluntary_ctxt_switches
            {
                let sw = voluntary_ctxt_switches
                    + nonvoluntary_ctxt_switches;
                (bytify(sw), sw)
            } else {
                (String::new(), 0)
            }
        } else {
            (String::new(), 0)
        };

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(u64, true);
}

#[cfg(target_os = "macos")]
impl Column for ContextSw {
    fn add(&mut self, proc: &ProcessInfo) {
        let raw_content = proc.curr_task.ptinfo.pti_csw as u64;
        let fmt_content = bytify(raw_content);

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(u64, true);
}

#[cfg(target_os = "freebsd")]
impl Column for ContextSw {
    fn add(&mut self, proc: &ProcessInfo) {
        let raw_content =
            (proc.curr_proc.info.rusage.nvcsw + proc.curr_proc.info.rusage.nivcsw) as u64;
        let fmt_content = bytify(raw_content);

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(u64, true);
}

```

### Core Architecture Module: `src/columns/cpu_time.rs`
```
use crate::process::ProcessInfo;
use crate::{column_default, util, Column};
use std::cmp;
use std::collections::HashMap;

pub struct CpuTime {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, u64>,
    width: usize,
}

impl CpuTime {
    pub fn new(header: Option<String>) -> Self {
        let header = header.unwrap_or_else(|| String::from("CPU Time"));
        let unit = String::new();
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
        }
    }
}

#[cfg(any(target_os = "linux", target_os = "android"))]
impl Column for CpuTime {
    fn add(&mut self, proc: &ProcessInfo) {
        let time_sec = (proc.curr_proc.stat().utime + proc.curr_proc.stat().stime)
            / procfs::ticks_per_second();

        let fmt_content = util::parse_time(time_sec);
        let raw_content = time_sec;

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(u64, true);
}

#[cfg(target_os = "macos")]
impl Column for CpuTime {
    fn add(&mut self, proc: &ProcessInfo) {
        let time_sec = (proc.curr_task.ptinfo.pti_total_user
            + proc.curr_task.ptinfo.pti_total_system)
            / 1_000_000_000u64;

        let fmt_content = util::parse_time(time_sec);
        let raw_content = time_sec;

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(u64, true);
}

#[cfg(target_os = "windows")]
impl Column for CpuTime {
    fn add(&mut self, proc: &ProcessInfo) {
        let time_sec = (proc.cpu_info.curr_sys + proc.cpu_info.curr_user) / 10_000_000u64;

        let fmt_content = util::parse_time(time_sec);
        let raw_content = time_sec;

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(u64, true);
}

#[cfg(target_os = "freebsd")]
impl Column for CpuTime {
    fn add(&mut self, proc: &ProcessInfo) {
        let time_sec = ((proc.curr_proc.info.rusage.utime.sec * 1_000_000i64
            + proc.curr_proc.info.rusage.utime.usec
            + proc.curr_proc.info.rusage.stime.sec * 1_000_000i64
            + proc.curr_proc.info.rusage.stime.usec)
            / 1_000_000) as u64;

        let fmt_content = util::parse_time(time_sec);
        let raw_content = time_sec;

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(u64, true);
}

```

### Core Architecture Module: `src/columns/docker.rs`
```
use crate::process::ProcessInfo;
use crate::{column_default, Column};
use dockworker::container::ContainerFilters;
use std::cmp;
use std::collections::HashMap;
use tokio::runtime::Runtime;

pub struct Docker {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, String>,
    width: usize,
    #[cfg(any(target_os = "linux", target_os = "android"))]
    containers: HashMap<String, String>,
    #[cfg(target_os = "macos")]
    containers: HashMap<i32, String>,
    available: bool,
}

#[cfg(any(target_os = "linux", target_os = "android"))]
impl Docker {
    pub fn new(header: Option<String>, path: &str) -> Self {
        let header = header.unwrap_or_else(|| String::from("Docker"));
        let unit = String::new();
        let mut containers = HashMap::new();
        let mut available = true;
        if let Ok(docker) = dockworker::Docker::connect_with_unix(path) {
            let rt = Runtime::new().unwrap();
            if let Ok(cont) =
                rt.block_on(docker.list_containers(None, None, None, ContainerFilters::new()))
            {
                for c in cont {
                    // remove the first letter '/' from container name
                    let name = String::from(&c.Names[0][1..]);
                    containers.insert(c.Id, name);
                }
            } else {
                available = false;
            }
        } else {
            available = false;
        }
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
            containers,
            available,
        }
    }
}

#[cfg(target_os = "macos")]
impl Docker {
    pub fn new(header: Option<String>, path: &str) -> Self {
        let header = header.unwrap_or_else(|| String::from("Docker"));
        let unit = String::from("");
        let mut containers = HashMap::new();
        let mut available = true;
        if let Ok(docker) = dockworker::Docker::connect_with_unix(path) {
            let rt = Runtime::new().unwrap();
            if let Ok(cont) =
                rt.block_on(docker.list_containers(None, None, None, ContainerFilters::new()))
            {
                for c in cont {
                    // remove the first letter '/' from container name
                    let name = String::from(&c.Names[0][1..]);
                    if let Ok(processes) = rt.block_on(docker.processes(c.Id.as_str())) {
                        for p in processes {
                            if let Ok(pid) = p.pid.parse::<i32>() {
                                containers.insert(pid, name.clone());
                            }
                        }
                    }
                }
            } else {
                available = false;
            }
        } else {
            available = false;
        }
        Docker {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
            containers,
            available,
        }
    }
}

/// Extract a Docker container ID from a cgroup path.
///
/// The container's cgroup can be nested at an arbitrary depth: rootful Docker
/// puts it directly under `/system.slice`, while rootless Docker nests it under
/// the invoking user's slice. Matching a path *component* rather than a prefix
/// covers both without enumerating every hierarchy shape.
#[cfg(any(target_os = "linux", target_os = "android"))]
fn container_id_from_cgroup(cgroup_path: &str) -> Option<&str> {
    fn is_container_id(s: &str) -> bool {
        s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
    }

    let mut components = cgroup_path.split('/').filter(|x| !x.is_empty()).peekable();
    while let Some(component) = components.next() {
        // cgroup v1: `.../docker/<id>`
        if component == "docker" {
            if let Some(id) = components.peek().copied().filter(|x| is_container_id(x)) {
                return Some(id);
            }
            continue;
        }
        // cgroup v2 with systemd: `.../docker-<id>.scope`
        if let Some(id) = component
            .strip_prefix("docker-")
            .and_then(|x| x.strip_suffix(".scope"))
            .filter(|x| is_container_id(x))
        {
            return Some(id);
        }
    }
    None
}

#[cfg(any(target_os = "linux", target_os = "android"))]
impl Column for Docker {
    fn add(&mut self, proc: &ProcessInfo) {
        let fmt_content = if let Ok(cgroups) = proc.curr_proc.cgroups() {
            let mut ret = String::new();
            for cgroup in cgroups {
                if let Some(container_id) = container_id_from_cgroup(&cgroup.pathname) {
                    ret = match self.containers.get(container_id) {
                        Some(name) => name.to_string(),
                        None => String::from("?"),
                    };
                    break;
                }
            }
            ret
        } else {
            String::new()
        };
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    fn available(&self) -> bool {
        self.available
    }

    column_default!(String, false);
}

#[cfg(target_os = "macos")]
impl Column for Docker {
    fn add(&mut self, proc: &ProcessInfo) {
        let fmt_content = if let Some(name) = self.containers.get(&proc.pid) {
            name.to_string()
        } else {
            String::from("")
        };
        let raw_content = fmt_content.clone();

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    fn available(&self) -> bool {
        self.available
    }

    column_default!(String, false);
}

#[cfg(all(test, any(target_os = "linux", target_os = "android")))]
mod tests {
    use super::container_id_from_cgroup;

    const ID: &str = "b9fc2a3d3e1c4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f809a1b2c3";

    #[test]
    fn cgroup_v1() {
        let path = format!("/docker/{ID}");
        assert_eq!(container_id_from_cgroup(&path), Some(ID));
    }

    #[test]
    fn cgroup_v2_rootful() {
        let path = format!("/system.slice/docker-{ID}.scope");
        assert_eq!(container_id_from_cgroup(&path), Some(ID));
    }

    #[test]
    fn cgroup_v2_rootless() {
        let path = format!(
            "/user.slice/user-1000.slice/user@1000.service/user.slice/docker-{ID}.scope"
        );
        assert_eq!(container_id_from_cgroup(&path), Some(ID));
    }

    #[test]
    fn non_container_cgroups() {
        for path in [
            "/",
            "/init.scope",
            "/system.slice/docker.service",
            "/system.slice/containerd.service",
            "/user.slice/user-1000.slice/user@1000.service/app.slice/docker-desktop.scope",
            "/docker/not-a-container-id",
        ] {
            assert_eq!(container_id_from_cgroup(path), None, "path: {path}");
        }
    }

    #[test]
    fn id_must_be_a_whole_component() {
        let path = format!("/system.slice/prefix-docker-{ID}.scope");
        assert_eq!(container_id_from_cgroup(&path), None);
    }
}

```

### Core Architecture Module: `src/columns/eip.rs`
```
use crate::process::ProcessInfo;
use crate::{column_default, Column};
use std::cmp;
use std::collections::HashMap;

pub struct Eip {
    header: String,
    unit: String,
    fmt_contents: HashMap<i32, String>,
    raw_contents: HashMap<i32, u64>,
    width: usize,
}

impl Eip {
    pub fn new(header: Option<String>) -> Self {
        let header = header.unwrap_or_else(|| String::from("EIP"));
        let unit = String::new();
        Self {
            fmt_contents: HashMap::new(),
            raw_contents: HashMap::new(),
            width: 0,
            header,
            unit,
        }
    }
}

impl Column for Eip {
    fn add(&mut self, proc: &ProcessInfo) {
        let raw_content = proc.curr_proc.stat().kstkeip;
        let fmt_content = format!("{raw_content:016x}");

        self.fmt_contents.insert(proc.pid, fmt_content);
        self.raw_contents.insert(proc.pid, raw_content);
    }

    column_default!(u64, true);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #985** (2026-10-05): **build(deps): bump libc from 0.2.189 to 0.2.190**
  *Symptoms*: Bumps [libc](https://github.com/rust-lang/libc) from 0.2.189 to 0.2.190. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/rust-lang/libc/releases">libc's releases</a>.</em></p> <blockquote> <h2>0.2.190</h2> <p>There is now a single config for enabling 64-bit <code>time_t</code>: <code>libc_unstable_time64</code>. This can be set unconditionally; it opts in to 64-bit <code>time_t</code> on the following platforms that use 32-bit by default:</p> <ul> <li>32-bit Linux-GNU</li> <li>32-bit Linux-uClibc</li> <li>32-bit Linux-musl. Note that setting this flag also enables some other changes that happend in musl v1.2.</li> <li>32-bit Windows-GNU</li> <li>ESP-IDF (all targets with this environment are 32-bit)</li> </ul> <p>Most other 32-bit platforms are either already using 64-bit <code>time_t</code>, or are considered legacy and will not be gaining support from their upstream maintainers.</p> <p>You can enable this using <code>RUSTFLAGS</code>:</p> <pre lang="sh"><code>RUSTFLAGS='--cfg=libc_unstable_time64' cargo ... </code></pre> <p>Note that there may still be some changes to features gated by this config option, hence &quot;unstable&quot; in its name. In the near future we will rename it to just <code>libc_time64</code>. Until then, please test it out and report any bugs you find!</p> <h3>Support</h3> <ul> <li>Add initial support for HelenOS (<a href="https://redirect.github.com/rust-lang/libc/pull/4355">#4355</a>)</li> </ul> <h3>Added</h

- **Issue #981** (2026-09-22): **build(deps): bump minus from 5.7.2 to 5.8.0**
  *Symptoms*: Bumps [minus](https://github.com/AMythicDev/minus) from 5.7.2 to 5.8.0. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/AMythicDev/minus/blob/main/CHANGELOG.md">minus's changelog</a>.</em></p> <blockquote> <h2>v5.8.0 [2026-09-19]</h2> <h3>Added</h3> <ul> <li><a href="https://redirect.github.com/arijit79/minus/pull/167">#164</a>: Introduce the <code>OutputSink</code> to allow custom output sinks like stderr, files, etc.</li> <li><a href="https://redirect.github.com/arijit79/minus/pull/167">#164</a>: Implemented the <code>OutputSink</code> trait on some <code>std</code> types like <code>io::Stdout</code>, <code>io::Stderr</code>, <code>io::File</code> <code>io::Cursor</code>, <code>Vec&lt;u8&gt;</code>, <code>io::Sink</code> to use them directly without implementing them manually.</li> <li><a href="https://redirect.github.com/arijit79/minus/pull/168">#158</a>: Added a help screen for keybindings generated directly from keybinding help docs.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/AMythicDev/minus/commit/32b6f7c51ab42e38e476dcb1d471a1349e2f7b61"><code>32b6f7c</code></a> release v5.8.0</li> <li><a href="https://github.com/AMythicDev/minus/commit/9276c037e8993268b87b07e07318dc414755ba3a"><code>9276c03</code></a> add help screen keybinding to docs</li> <li><a href="https://github.com/AMythicDev/minus/commit/a1d453d1eba3175b7aaf84d05462cd75602188b6"><code>a1d453d</code></a> f

- **Issue #980** (2026-09-16): **build(deps): bump byte-unit from 5.2.5 to 5.2.6**
  *Symptoms*: Bumps [byte-unit](https://github.com/magiclen/byte-unit) from 5.2.5 to 5.2.6. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/magiclen/Byte-Unit/commit/3f2dcb8c0f3f11f0df32b63bbaab5f79911eaae1"><code>3f2dcb8</code></a> bump version</li> <li><a href="https://github.com/magiclen/Byte-Unit/commit/06edf4effc825d0cd1b112554035e64b3f7e7e0f"><code>06edf4e</code></a> fix numeric conversions and improve serialization</li> <li>See full diff in <a href="https://github.com/magiclen/byte-unit/compare/v5.2.5...v5.2.6">compare view</a></li> </ul> </details> <br /> 

- **Issue #979** (2026-09-16): **build(deps): bump fancy-regex from 0.19.1 to 0.19.2**
  *Symptoms*: Bumps [fancy-regex](https://github.com/fancy-regex/fancy-regex) from 0.19.1 to 0.19.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/fancy-regex/fancy-regex/releases">fancy-regex's releases</a>.</em></p> <blockquote> <h2>0.19.2</h2> <h3>Added</h3> <ul> <li>Add a <code>leftmost_longest</code> feature (off by default) that adds a method to the <code>RegexBuilder</code>/<code>RegexOptionsBuilder</code> for building a VM which would operate in leftmost-longest match mode instead of the regular leftmost-first mode. Useful for POSIX compliance. (<a href="https://redirect.github.com/fancy-regex/fancy-regex/issues/281">#281</a>)</li> </ul> <h3>Changed</h3> <h3>Fixed</h3> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/fancy-regex/fancy-regex/blob/main/CHANGELOG.md">fancy-regex's changelog</a>.</em></p> <blockquote> <h2>[0.19.2] - 2026-09-13</h2> <h3>Added</h3> <ul> <li>Add a <code>leftmost_longest</code> feature (off by default) that adds a method to the <code>RegexBuilder</code>/<code>RegexOptionsBuilder</code> for building a VM which would operate in leftmost-longest match mode instead of the regular leftmost-first mode. Useful for POSIX compliance. (<a href="https://redirect.github.com/fancy-regex/fancy-regex/issues/281">#281</a>)</li> </ul> <h3>Changed</h3> <h3>Fixed</h3> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/fan

- **Issue #978** (2026-09-14): **build(deps): bump toml from 1.1.5+spec-1.1.0 to 1.1.6+spec-1.1.0**
  *Symptoms*: Bumps [toml](https://github.com/toml-rs/toml) from 1.1.5+spec-1.1.0 to 1.1.6+spec-1.1.0. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/toml-rs/toml/commit/572c005d80cca5f7bd163805c2f33ba0a5207b6d"><code>572c005</code></a> chore: Release</li> <li><a href="https://github.com/toml-rs/toml/commit/66d0c53e1ec7cfc61f98c30b92f72e2ad1df4536"><code>66d0c53</code></a> docs: Update changelog</li> <li><a href="https://github.com/toml-rs/toml/commit/07af4e7644d34d2d784bcd4f570c0619ee1626b2"><code>07af4e7</code></a> perf: Reduce allocations in toml_edit parsing and dumping (<a href="https://redirect.github.com/toml-rs/toml/issues/1215">#1215</a>)</li> <li><a href="https://github.com/toml-rs/toml/commit/0ff90dbd7d7931b995f91cac661a12818cfd7ab7"><code>0ff90db</code></a> perf(display): Write encoded strings directly</li> <li><a href="https://github.com/toml-rs/toml/commit/efb25365450e5512efa76457fcd53b0bb1ee9c41"><code>efb2536</code></a> perf(display): Move generated representation strings</li> <li><a href="https://github.com/toml-rs/toml/commit/075c444fa05f359cce53dda0f1382a07ad72776e"><code>075c444</code></a> refactor(display): Consolidate key-path encoding</li> <li><a href="https://github.com/toml-rs/toml/commit/b48f33869f1024949945157c0ab540a114676fc0"><code>b48f338</code></a> perf(display): Borrow table keys during document output</li> <li><a href="https://github.com/toml-rs/toml/commit/c6c1de348f6e276a58ce57ffdcdeb51065698709"><code>c6c1de3</code></a> perf(pa

- **Issue #977** (2026-09-14): **build(deps): bump console from 0.16.4 to 0.16.6**
  *Symptoms*: Bumps [console](https://github.com/console-rs/console) from 0.16.4 to 0.16.6. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/console-rs/console/releases">console's releases</a>.</em></p> <blockquote> <h2>0.16.6</h2> <h2>What's Changed</h2> <ul> <li>Fix truncate_str panicking mid-character without ansi-parsing by <a href="https://github.com/lenamonj"><code>@​lenamonj</code></a> in <a href="https://redirect.github.com/console-rs/console/pull/296">console-rs/console#296</a></li> <li>perf: accelerate printable ASCII text width by <a href="https://github.com/dexhunter"><code>@​dexhunter</code></a> in <a href="https://redirect.github.com/console-rs/console/pull/297">console-rs/console#297</a></li> <li>fix: measure the truncation tail in visible columns, not raw width by <a href="https://github.com/youdie006"><code>@​youdie006</code></a> in <a href="https://redirect.github.com/console-rs/console/pull/298">console-rs/console#298</a></li> <li>Prepare 0.16.6 by <a href="https://github.com/djc"><code>@​djc</code></a> in <a href="https://redirect.github.com/console-rs/console/pull/299">console-rs/console#299</a></li> </ul> <h2>0.16.5</h2> <h2>What's Changed</h2> <ul> <li>Strip OSC and DCS sequences to support e.g. OSC 8 hyperlinks over tmux. by <a href="https://github.com/khoek"><code>@​khoek</code></a> in <a href="https://redirect.github.com/console-rs/console/pull/280">console-rs/console#280</a></li> </ul> </blockquote> </details> <details> <

- **Issue #973** (2026-09-09): **build(deps): bump fancy-regex from 0.19.0 to 0.19.1**
  *Symptoms*: Bumps [fancy-regex](https://github.com/fancy-regex/fancy-regex) from 0.19.0 to 0.19.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/fancy-regex/fancy-regex/releases">fancy-regex's releases</a>.</em></p> <blockquote> <h2>0.19.1</h2> <h3>Added</h3> <ul> <li>Add a <code>perf-dfa-full</code> feature (off by default, mirroring the <code>regex</code> crate) that lets regex-automata eagerly build fully compiled dense DFAs for small patterns, for workloads that compile few regexes and match them very heavily (<a href="https://redirect.github.com/fancy-regex/fancy-regex/issues/272">#272</a>)</li> </ul> <h3>Changed</h3> <ul> <li>Add VM instruction for case insensitive literals when in Unicode mode, to keep the build cost bounded (<a href="https://redirect.github.com/fancy-regex/fancy-regex/issues/268">#268</a>) and ensured the toy example graph output remains readable instead of being super verbose (<a href="https://redirect.github.com/fancy-regex/fancy-regex/issues/269">#269</a>)</li> <li>Compilation performance: the <code>regex-automata</code> dependency no longer enables the <code>dfa-build</code> feature by default. With <code>dfa-build</code> enabled, <code>meta::Regex</code> eagerly determinizes a full dense DFA for every small pattern, which dominated build time of simple class-containing patterns (e.g. <code>\b(extern)\s+(crate)</code> compiled ~4x slower than with the <code>regex</code> crate, which also ships without <code>dfa-bui

- **Issue #971** (2026-09-10): **Windows: adds external pager support**
  *Symptoms*: <img width="2132" height="1418" alt="image" src="https://github.com/user-attachments/assets/46058073-0969-4a74-9c2a-a705c34902c9" />

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

### Incident Patch 1: `e4e5753a` (2026-10-05)
**Commit Message**: build(deps): bump libc from 0.2.189 to 0.2.190

Bumps [libc](https://github.com/rust-lang/libc) from 0.2.189 to 0.2.190.
- [Release notes](https://github.com/rust-lang/libc/releases)
- [Changelog](https://github.com/rust-lang/libc/blob/0.2.190/CHANGELOG.md)
- [Commits](https://github.com/rust-lang/libc/compare/0.2.189...0.2.190)

---
updated-dependencies:
- dependency-name: libc
  dependency-version: 0.2.190
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1160,9 +1160,9 @@ checksum = "830d08ce1d1d941e6b30645f1a0eb5643013d835ce3779a5fc208261dbe10f55"
 
 [[package]]
 name = "libc"
-version = "0.2.189"
+version = "0.2.190"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3eaf3ede3fee6db1a4c2ee091bf8a8b4dccdc6d17f656fb07896ee72867612f2"
+checksum = "ce5d3ddc6d3fa000eb1536d85e147bfe31aacaba692ed6a876f95cb7c855be78"
 
 [[package]]
 name = "libloading"
```

---

### Incident Patch 2: `ee979c37` (2026-09-22)
**Commit Message**: build(deps): bump minus from 5.7.2 to 5.8.0

Bumps [minus](https://github.com/AMythicDev/minus) from 5.7.2 to 5.8.0.
- [Changelog](https://github.com/AMythicDev/minus/blob/main/CHANGELOG.md)
- [Commits](https://github.com/AMythicDev/minus/compare/v5.7.2...v5.8.0)

---
updated-dependencies:
- dependency-name: minus
  dependency-version: 5.8.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1263,9 +1263,9 @@ dependencies = [
 
 [[package]]
 name = "minus"
-version = "5.7.2"
+version = "5.8.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1db1df1b8dd701aa57b41283b50b751b3ebc8fe1406955ec90c53b46b475fa56"
+checksum = "b20be26a360f37e73a59ba17f4bee3ad24cd67417d82b9946acd58173a495bfe"
 dependencies = [
  "crossbeam-channel",
  "crossterm 0.29.0",
```

---

### Incident Patch 3: `344950ca` (2026-09-16)
**Commit Message**: build(deps): bump byte-unit from 5.2.5 to 5.2.6

Bumps [byte-unit](https://github.com/magiclen/byte-unit) from 5.2.5 to 5.2.6.
- [Commits](https://github.com/magiclen/byte-unit/compare/v5.2.5...v5.2.6)

---
updated-dependencies:
- dependency-name: byte-unit
  dependency-version: 5.2.6
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -276,9 +276,9 @@ checksum = "72f5acc6cb2ba439de613abc23857ec3d78374d8ed5ac84e9d11336e87da8649"
 
 [[package]]
 name = "byte-unit"
-version = "5.2.5"
+version = "5.2.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4a813de7f2bbedb7dce265b64f1cf5908ebe4d56281ece8d847e98113788b9b0"
+checksum = "c719d56f7e96194cfc53460976d3ba51c85719747c9c62ed99981847b551152b"
 dependencies = [
  "rust_decimal",
  "schemars",
```

---

### Incident Patch 4: `1536c50e` (2026-09-16)
**Commit Message**: build(deps): bump fancy-regex from 0.19.1 to 0.19.2

Bumps [fancy-regex](https://github.com/fancy-regex/fancy-regex) from 0.19.1 to 0.19.2.
- [Release notes](https://github.com/fancy-regex/fancy-regex/releases)
- [Changelog](https://github.com/fancy-regex/fancy-regex/blob/main/CHANGELOG.md)
- [Commits](https://github.com/fancy-regex/fancy-regex/compare/0.19.1...0.19.2)

---
updated-dependencies:
- dependency-name: fancy-regex
  dependency-version: 0.19.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -703,9 +703,9 @@ dependencies = [
 
 [[package]]
 name = "fancy-regex"
-version = "0.19.1"
+version = "0.19.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "52e0387578e845beb7a1acff126228499f26cb18edf12919cc513bb863266464"
+checksum = "d301f5bf187b3c295fce6468d3875037a0bccc5f6b151c63cac2f85babf21912"
 dependencies = [
  "bit-set",
  "regex-automata",
```

---

### Incident Patch 5: `d68975d0` (2026-09-14)
**Commit Message**: build(deps): bump console from 0.16.4 to 0.16.6

Bumps [console](https://github.com/console-rs/console) from 0.16.4 to 0.16.6.
- [Release notes](https://github.com/console-rs/console/releases)
- [Changelog](https://github.com/console-rs/console/blob/main/CHANGELOG.md)
- [Commits](https://github.com/console-rs/console/compare/0.16.4...0.16.6)

---
updated-dependencies:
- dependency-name: console
  dependency-version: 0.16.6
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -440,9 +440,9 @@ checksum = "1d07550c9036bf2ae0c684c4297d503f838287c83c53686d05370d0e139ae570"
 
 [[package]]
 name = "console"
-version = "0.16.4"
+version = "0.16.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "4fe5f465a4f6fee88fad41b85d990f84c835335e85b5d9e6e63e0d06d28cba7c"
+checksum = "e96a4956774c13c126a8b5af4daa79384f4d826534c95a02d76afb39e2ab64e3"
 dependencies = [
  "encode_unicode",
  "libc",
```

---

### Incident Patch 6: `2f1a55a5` (2026-09-14)
**Commit Message**: build(deps): bump toml from 1.1.5+spec-1.1.0 to 1.1.6+spec-1.1.0

Bumps [toml](https://github.com/toml-rs/toml) from 1.1.5+spec-1.1.0 to 1.1.6+spec-1.1.0.
- [Commits](https://github.com/toml-rs/toml/compare/toml-v1.1.5...toml-v1.1.6)

---
updated-dependencies:
- dependency-name: toml
  dependency-version: 1.1.6+spec-1.1.0
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2295,9 +2295,9 @@ dependencies = [
 
 [[package]]
 name = "toml"
-version = "1.1.5+spec-1.1.0"
+version = "1.1.6+spec-1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "12c0ba9680044b4ce98d391a62094047eada0d64860b80166c39f4a6b5640785"
+checksum = "920602543f0911ab71da12c50d59701da54c196d1a2bf5cb4b75667f137a406a"
 dependencies = [
  "indexmap",
  "serde_core",
```

---

### Incident Patch 7: `4a02e3b6` (2026-09-09)
**Commit Message**: build(deps): bump fancy-regex from 0.19.0 to 0.19.1

Bumps [fancy-regex](https://github.com/fancy-regex/fancy-regex) from 0.19.0 to 0.19.1.
- [Release notes](https://github.com/fancy-regex/fancy-regex/releases)
- [Changelog](https://github.com/fancy-regex/fancy-regex/blob/main/CHANGELOG.md)
- [Commits](https://github.com/fancy-regex/fancy-regex/compare/0.19.0...0.19.1)

---
updated-dependencies:
- dependency-name: fancy-regex
  dependency-version: 0.19.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -703,9 +703,9 @@ dependencies = [
 
 [[package]]
 name = "fancy-regex"
-version = "0.19.0"
+version = "0.19.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "476de73bddf2ef8490aa4ee8f1cf40b430bf1d56c48c22080e5186952cd580e6"
+checksum = "52e0387578e845beb7a1acff126228499f26cb18edf12919cc513bb863266464"
 dependencies = [
  "bit-set",
  "regex-automata",
```

---

### Incident Patch 8: `cc451ea9` (2026-09-07)
**Commit Message**: build(deps): bump toml from 1.1.4+spec-1.1.0 to 1.1.5+spec-1.1.0

Bumps [toml](https://github.com/toml-rs/toml) from 1.1.4+spec-1.1.0 to 1.1.5+spec-1.1.0.
- [Commits](https://github.com/toml-rs/toml/compare/toml-v1.1.4...toml-v1.1.5)

---
updated-dependencies:
- dependency-name: toml
  dependency-version: 1.1.5+spec-1.1.0
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2295,9 +2295,9 @@ dependencies = [
 
 [[package]]
 name = "toml"
-version = "1.1.4+spec-1.1.0"
+version = "1.1.5+spec-1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3aace63f4bbcdfc2c965b059de67119c89c4017a70d633be6c104910f67056f5"
+checksum = "12c0ba9680044b4ce98d391a62094047eada0d64860b80166c39f4a6b5640785"
 dependencies = [
  "indexmap",
  "serde_core",
```

---

### Incident Patch 9: `312cc7aa` (2026-09-07)
**Commit Message**: Fix fmt

**File**: `src/util.rs` (modified, +1/-1)
```diff
@@ -414,7 +414,7 @@ mod tests {
         let row = "\u{1b}[1;37mCommand\u{1b}[0m";
         assert_eq!(ansi_trim_end(row), row);
     }
-  
+
     #[test]
     fn test_sanitize_control_chars() {
         // OSC 52 clipboard-write sequence embedded in a crafted argv0
```

---

### Incident Patch 10: `39bc8c21` (2026-09-07)
**Commit Message**: Merge pull request #956 from MsfPablo/fix/778-ansi-reset-on-truncate

fix: emit ANSI reset when truncation drops it (#778)

**File**: `src/util.rs` (modified, +35/-1)
```diff
@@ -13,6 +13,8 @@ use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};
 #[cfg(not(target_os = "windows"))]
 use uzers::UsersCache;
 
+const ANSI_RESET: &str = "\u{1b}[0m";
+
 impl From<ArgThemeMode> for ConfigTheme {
     fn from(item: ArgThemeMode) -> Self {
         match item {
@@ -216,7 +218,12 @@ pub fn truncate(s: &'_ str, width: usize) -> Cow<'_, str> {
         }
         buf.push(c);
     }
-    if let Some(buf) = ret {
+    if let Some(mut buf) = ret {
+        // Truncation discards everything after the cut point, including any trailing
+        // ANSI reset. Without it the terminal keeps the last style after procs exits.
+        if buf.contains('\u{1b}') {
+            buf.push_str(ANSI_RESET);
+        }
         Cow::Owned(buf)
     } else {
         Cow::Borrowed(s)
@@ -381,6 +388,33 @@ pub fn process_new(
 mod tests {
     use super::*;
 
+    #[test]
+    fn test_truncate_keeps_reset_for_styled_text() {
+        let styled = "\u{1b}[1;37mabcdef\u{1b}[0m";
+        assert_eq!(truncate(styled, 3), "\u{1b}[1;37mabc\u{1b}[0m");
+    }
+
+    #[test]
+    fn test_truncate_plain_text_unchanged() {
+        assert_eq!(truncate("abcdef", 3), "abc");
+        assert_eq!(truncate("abcdef", 6), "abcdef");
+    }
+
+    #[test]
+    fn test_ansi_trim_end_keeps_reset() {
+        // Trailing padding inside a styled column: trimming it must not drop the reset.
+        let row = "\u{1b}[1;37mCommand   \u{1b}[0m";
+        let trimmed = ansi_trim_end(row);
+        assert!(trimmed.ends_with(ANSI_RESET), "{trimmed:?}");
+        assert_eq!(console::strip_ansi_codes(&trimmed), "Command");
+    }
+
+    #[test]
+    fn test_ansi_trim_end_without_trailing_space_unchanged() {
+        let row = "\u{1b}[1;37mCommand\u{1b}[0m";
+        assert_eq!(ansi_trim_end(row), row);
+    }
+  
     #[test]
     fn test_sanitize_control_chars() {
         // OSC 52 clipboard-write sequence embedded in a crafted argv0
```

---

### Incident Patch 11: `1f3cc794` (2026-09-07)
**Commit Message**: Merge branch 'master' into fix/778-ansi-reset-on-truncate

**File**: `.github/workflows/regression.yml` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ jobs:
           - os: windows-latest
             rust: stable
             target: x86_64-pc-windows-msvc
+          - os: windows-11-arm
+            rust: stable
+            target: aarch64-pc-windows-msvc
 
     runs-on: ${{ matrix.os }}
     steps:
```

**File**: `.github/workflows/release.yml` (modified, +4/-1)
```diff
@@ -10,7 +10,7 @@ jobs:
 
     strategy:
       matrix:
-        os: [ubuntu-latest, ubuntu-24.04-arm, macOS-latest, windows-latest]
+        os: [ubuntu-latest, ubuntu-24.04-arm, macOS-latest, windows-latest, windows-11-arm]
         rust: [stable]
 
     runs-on: ${{ matrix.os }}
@@ -52,6 +52,9 @@ jobs:
     - name: Build for Windows
       if: matrix.os == 'windows-latest'
       run: make release_win
+    - name: Build for Windows ARM64
+      if: matrix.os == 'windows-11-arm'
+      run: make release_win_arm64
     - name: Release
       uses: softprops/action-gh-release@v1
       with:
```

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -2,6 +2,21 @@
 
 ## [Unreleased](https://github.com/dalance/procs/compare/v0.14.12...Unreleased) - ReleaseDate
 
+* [Added] Arch column for Windows (process image architecture)
+* [Added] Real Command column for Windows (command line arguments). This column was printing pure file name, which is now moved to FileName column.
+* [Added] Priority column for Windows (user-mode priority class)
+* [Added] RtPriority column for Windows (kernel base priority)
+* [Added] Threads column for Windows (thread count)
+* [Added] Session column for Windows (session ID)
+* [Added] State column for Windows (scheduler state derived from thread states)
+* [Added] Env column for Windows (environment variables)
+* [Added] RecvBytes and SendBytes columns for Windows (network I/O rate; needs Windows 11 or later)
+* [Added] WorkDir column for Windows (current working directory)
+* [Added] `--thread` support for Windows
+* [Changed] Group and Gid columns for Windows read the process token only when the column is displayed
+* [Fixed] ReadBytes / WriteBytes divided by a mis-scaled interval (seconds added to milliseconds)
+* [Fixed] Fix invalid JSON output when a column is skipped by --only or --tree
+
 ## [v0.14.12](https://github.com/dalance/procs/compare/v0.14.11...v0.14.12) - 2026-06-25
 
 * [Added] Add fancy regex fallback for advanced filters [#913](https://github.com/dalance/procs/pull/913)
```

**File**: `Cargo.lock` (modified, +7/-7)
```diff
@@ -703,9 +703,9 @@ dependencies = [
 
 [[package]]
 name = "fancy-regex"
-version = "0.18.0"
+version = "0.19.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e1e1dacd0d2082dfcf1351c4bdd566bbe89a2b263235a2b50058f1e130a47277"
+checksum = "476de73bddf2ef8490aa4ee8f1cf40b430bf1d56c48c22080e5186952cd580e6"
 dependencies = [
  "bit-set",
  "regex-automata",
@@ -1235,9 +1235,9 @@ checksum = "0ceec5bc11778974d1bcb055b18002eba7f4b3518b6a0081b3af5f21666da9ad"
 
 [[package]]
 name = "mach2"
-version = "0.6.0"
+version = "0.7.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dae608c151f68243f2b000364e1f7b186d9c29845f7d2d85bd31b9ad77ad552b"
+checksum = "b0d28e293f2b8c9d2b2d1c0193bd3c1cbdc0d2cf396888dc01162f7cf9d6c3f3"
 
 [[package]]
 name = "memchr"
@@ -1593,7 +1593,7 @@ dependencies = [
  "toml",
  "unicode-width",
  "uzers",
- "which 8.0.5",
+ "which 8.0.6",
  "windows-sys 0.61.2",
 ]
 
@@ -2523,9 +2523,9 @@ dependencies = [
 
 [[package]]
 name = "which"
-version = "8.0.5"
+version = "8.0.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8f3ef584124b911bcc3875c2f1472e80f24361ceb789bd1c62b3e9a3df9ff43c"
+checksum = "bae2f2b2b816647a1cab1acc91f5bd20812d53cb344382635ec2181940c8034f"
 dependencies = [
  "libc",
 ]
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -54,7 +54,7 @@ tokio         = { version = "1.52", optional = true, features = ["rt"] }
 toml          = "1.1"
 unicode-width = "0.2"
 regex         = "1.12"
-fancy-regex   = "0.18"
+fancy-regex   = "0.19"
 
 [build-dependencies]
 anyhow        = "1.0"
@@ -75,10 +75,10 @@ errno         = "0.3"
 pager         = "0.16"
 uzers         = "0.12"
 which         = "8"
-mach2         = "0.6.0"
+mach2         = "0.7.0"
 
 [target.'cfg(target_os = "windows")'.dependencies]
-windows-sys   = { version = "0.61", features = ["Win32_Foundation", "Win32_Networking_WinSock", "Win32_NetworkManagement_IpHelper", "Win32_Security", "Win32_System_Diagnostics_ToolHelp", "Win32_System_ProcessStatus", "Win32_System_Threading"] }
+windows-sys   = { version = "0.61", features = ["Wdk_System_SystemInformation", "Wdk_System_SystemServices", "Wdk_System_Threading", "Win32_Foundation", "Win32_Networking_WinSock", "Win32_NetworkManagement_IpHelper", "Win32_Security", "Win32_System_Diagnostics_Debug", "Win32_System_Kernel", "Win32_System_Threading", "Win32_System_WindowsProgramming"] }
 
 [target.'cfg(target_os = "freebsd")'.dependencies]
 bsd-kvm       = "0.1.5"
```

**File**: `Makefile` (modified, +6/-1)
```diff
@@ -7,7 +7,7 @@ BIN_NAME = procs
 
 export LONG_VERSION
 
-.PHONY: all test clean release_lnx release_win release_mac
+.PHONY: all test clean release_lnx release_win release_win_arm64 release_mac
 
 all: test
 
@@ -33,6 +33,11 @@ release_win:
 	mv -v target/x86_64-pc-windows-msvc/release/${BIN_NAME}.exe ./
 	7z a ${BIN_NAME}-v${VERSION}-x86_64-windows.zip ${BIN_NAME}.exe
 
+release_win_arm64:
+	cargo build --locked --release --target=aarch64-pc-windows-msvc
+	mv -v target/aarch64-pc-windows-msvc/release/${BIN_NAME}.exe ./
+	7z a ${BIN_NAME}-v${VERSION}-aarch64-windows.zip ${BIN_NAME}.exe
+
 release_mac:
 	cargo build --locked --release --target=x86_64-apple-darwin
 	cargo build --locked --release --target=aarch64-apple-darwin
```

**File**: `README.md` (modified, +10/-8)
```diff
@@ -434,7 +434,7 @@ The first `[[columns]]` is shown at left side, and the last is shown at right si
 
 | procs `kind`         | `ps` STANDARD FORMAT  | Description                                   | Linux | macOS | Windows | FreeBSD |
 | -------------------- | --------------------- | --------------------------------------------- | ----- | ----- | ------- | ------- |
-| Arch                 | -not supported-       | Architecture of binary (macOS specific)       |       | o     |         |         |
+| Arch                 | -not supported-       | Architecture of binary                        |       | o     | o       |         |
 | Ccgroup              | -not supported-       | Control group by compressed format            | o     |       |         |         |
 | Cgroup               | cgroup                | Control group                                 | o     |       |         |         |
 | Command              | args                  | Command with all arguments                    | o     | o     | o       | o       |
@@ -445,7 +445,7 @@ The first `[[columns]]` is shown at left side, and the last is shown at right si
 | ElapsedTime          | -not supported-       | Elapsed time                                  | o     | o     | o       | o       |
 | Env                  | `e` output modifier   | Environment variables                         | o     |       |         | o       |
 | Esp                  | esp                   | Stack pointer                                 | o     |       |         |         |
-| FileName             | comm                  | File name                                     | o     |       |         | o       |
+| FileName             | comm                  | File name                                     | o     |       | o       | o       |
 | Gid                  | egid                  | Group ID                                      | o     | o     | o       | o       |
 | GidFs                | fgid                  | File system group ID                          | o     |       |         |         |
 | GidReal              | rgid                  | Real group ID                                 | o     | o     |         | o       |
@@ -466,10 +466,12 @@ The first `[[columns]]` is shown at left side, and the last is shown at right si
 | Priority             | pri                   | Priority                                      | o     | o     | o       | o       |
 | Processor            | psr                   | Currently assigned processor                  | o     |       |         | o       |
 | ReadBytes            | -not supported-       | Read bytes from storage                       | o     | o     | o       | o       |
-| RtPriority           | rtprio                | Real-time priority                            | o     |       |         |         |
+| RecvBytes            | -not supported-       | Received bytes per second (Windows 11)        |       |       | o       |         |
+| RtPriority           | rtprio                | Kernel base priority (Windows) / real-time priority (Linux) | o     |       | o       |         |
 | SecContext           | label                 | Security context                              | o     |       |         |         |
+| SendBytes            | -not supported-       | Sent bytes per second (Windows 11)            |       |       | o       |         |
 | Separator            | -not supported-       | Show `\|` for column separation               | o     | o     | o       | o       |
-| Session              | sid                   | Session ID                                    | o     | o     |         | o       |
+| Session              | sid                   | Session ID                                    | o     | o     | o       | o       |
 | ShdPnd               | pending               | Pending signal mask for process               | o     |       |         | o       |
 | SigBlk               | blocked               | Blocked signal mask                           | o     |       |         | o       |
 | SigCgt               | caught                | Caught signal mask                            | o     |       |         | o       |
@@ -478,9 +480,9 @@ The first `[[columns]]` is shown at left side, and the last is shown at right si
 | Slot                 | -not supported-       | Slot for `--insert` option                    | o     | o     | o       | o       |
 | Ssb                  | -not supported-       | Speculative store bypass status               | o     |       |         |         |
 | StartTime            | start_time            | Starting time                                 | o     | o     | o       | o       |
-| State                | s                     | Process state                                 | o     | o     |         | o       |
-| TcpPort              | -not supported-       | Bound TCP ports                               | o     | o     |         |         |
-| Threads            
```

**File**: `src/columns/arch.rs` (modified, +134/-3)
```diff
@@ -3,9 +3,13 @@ use crate::{column_default, Column};
 use std::cmp;
 use std::collections::HashMap;
 
+#[cfg(target_os = "macos")]
 const CTL_MAXNAME: i32 = 12;
+#[cfg(target_os = "macos")]
 const P_TRANSLATED: i32 = 131072;
+#[cfg(target_os = "macos")]
 const CPU_TYPE_X86_64: i32 = 16777223;
+#[cfg(target_os = "macos")]
 const CPU_TYPE_ARM64: i32 = 16777228;
 
 pub struct Arch {
@@ -16,7 +20,6 @@ pub struct Arch {
     width: usize,
 }
 
-#[cfg(target_os = "macos")]
 impl Arch {
     pub fn new(header: Option<String>) -> Self {
         let header = header.unwrap_or_else(|| String::from("Arch"));
@@ -31,13 +34,12 @@ impl Arch {
     }
 }
 
-#[cfg(target_os = "macos")]
 impl Column for Arch {
     fn add(&mut self, proc: &ProcessInfo) {
         let pid = proc.pid;
         let arch = arch_from_pid(pid);
 
-        let fmt_content = format!("{}", arch);
+        let fmt_content = arch.to_string();
         let raw_content = fmt_content.clone();
 
         self.fmt_contents.insert(proc.pid, fmt_content);
@@ -47,6 +49,116 @@ impl Column for Arch {
     column_default!(String, false);
 }
 
+// ---------------------------------------------------------------------------
+// Windows
+// ---------------------------------------------------------------------------
+
+/// `IMAGE_FILE_MACHINE_*` constants.
+///
+/// <https://learn.microsoft.com/zh-cn/windows/win32/sysinfo/image-file-machine-constants>
+#[cfg(target_os = "windows")]
+mod machine {
+    pub const UNKNOWN: u16 = 0x0000;
+    pub const ALPHA: u16 = 0x0184;
+    /// Same value as `IMAGE_FILE_MACHINE_AXP64`.
+    pub const ALPHA64: u16 = 0x0284;
+    pub const AM33: u16 = 0x01d3;
+    pub const AMD64: u16 = 0x8664;
+    pub const ARM: u16 = 0x01c0;
+    pub const ARM64: u16 = 0xaa64;
+    /// x86_64 code that runs on ARM64 through emulation.
+    pub const ARM64EC: u16 = 0xa641;
+    /// Image loadable both as ARM64 and as ARM64EC.
+    pub const ARM64X: u16 = 0xa64e;
+    /// ARMv7 / Thumb-2; `IMAGE_FILE_MACHINE_ARMV7` shares this value.
+    pub const ARMNT: u16 = 0x01c4;
+    pub const CEE: u16 = 0xc0ee;
+    pub const CEF: u16 = 0x0cef;
+    pub const EBC: u16 = 0x0ebc;
+    pub const I386: u16 = 0x014c;
+    pub const IA64: u16 = 0x0200;
+    pub const M32R: u16 = 0x9041;
+    pub const MIPS16: u16 = 0x0266;
+    pub const MIPSFPU: u16 = 0x0366;
+    pub const MIPSFPU16: u16 = 0x0466;
+    pub const POWERPC: u16 = 0x01f0;
+    pub const POWERPCFP: u16 = 0x01f1;
+    pub const R3000: u16 = 0x0162;
+    pub const R4000: u16 = 0x0166;
+    pub const R10000: u16 = 0x0168;
+    pub const SH3: u16 = 0x01a2;
+    pub const SH3DSP: u16 = 0x01a3;
+    pub const SH3E: u16 = 0x01a4;
+    pub const SH4: u16 = 0x01a6;
+    pub const SH5: u16 = 0x01a8;
+    pub const THUMB: u16 = 0x01c2;
+    pub const TRICORE: u16 = 0x0520;
+    pub const WCEMIPSV2: u16 = 0x0169;
+}
+
+/// Reports the architecture of the image `pid` was started from.
+///
+/// WOW64 processes report their own architecture, not the host's: a 32-bit
+/// process on an x86_64 machine yields `x86`.
+#[cfg(target_os = "windows")]
+pub fn arch_from_pid(pid: i32) -> &'static str {
+    use windows_sys::Win32::Foundation::{CloseHandle, FALSE, HANDLE};
+    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
+
+    // 0 is the idle process and has no image; negative pids are not real.
+    if pid <= 0 {
+        return "unknown";
+    }
+
+    // SAFETY: `pid` is only handed to `OpenProcess`, and the handle it hands
+    // back is closed before this function returns.
+    let handle: HANDLE = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid as u32) };
+    if handle.is_null() {
+        return "unknown";
+    }
+
+    let arch = crate::process::process_image_machine(handle)
+        .map(arch_from_machine)
+        .unwrap_or("unknown");
+    unsafe { CloseHandle(handle) };
+
+    arch
+}
+
+/// Names an `IMAGE_FILE_MACHINE_*` value the way the rest of the crate spells
+/// architectures (`x86_64`, `arm64`, ...).
+#[cfg(target_os = "windows")]
+fn arch_from_machine(machine: u16) -> &'static str {
+    use machine::*;
+
+    match machine {
+        UNKNOWN => "unknown",
+        I386 => "x86",
+        AMD64 => "x86_64",
+        ARM | ARMNT | THUMB => "arm",
+        ARM64 => "arm64",
+        ARM64EC => "arm64ec",
+        ARM64X => "arm64x",
+        IA64 => "ia64",
+        EBC => "ebc",
+        ALPHA | ALPHA64 => "alpha",
+        MIPS16 | MIPSFPU | MIPSFPU16 | R3000 | R4000 | R10000 | WCEMIPSV2 => "mips",
+        POWERPC | POWERPCFP => "ppc",
+        SH3 | SH3DSP | SH3E | SH4 | SH5 => "sh",
+        M32R => "m32r",
+        AM33 => "am33",
+        TRICORE => "tricore",
+        CEF => "cef",
+        // Pure IL assembly: no architecture of its own.
+        CEE => "msil",
+        _ => "unknown",
+    }
+}
+
+// ---------------------------------------------------------------------------
+// macOS
+// -------------------------------------
```

---

### Incident Patch 12: `a064cec7` (2026-09-07)
**Commit Message**: Merge pull request #955 from MsfPablo/fix/command-escape-sequences

Strip control characters from the Command column (fixes #950)

**File**: `src/columns/command.rs` (modified, +5/-2)
```diff
@@ -1,4 +1,5 @@
 use crate::process::ProcessInfo;
+use crate::util::sanitize_control_chars;
 use crate::{column_default, Column};
 use std::cmp;
 use std::collections::HashMap;
@@ -39,14 +40,14 @@ impl Column for Command {
                     })
                     .collect::<String>();
                 cmd.pop();
-                cmd = cmd.replace(['\n', '\t'], " ");
                 cmd
             } else {
                 format!("[{}]", proc.curr_proc.stat().comm)
             }
         } else {
             proc.curr_proc.stat().comm.clone()
         };
+        let fmt_content = sanitize_control_chars(&fmt_content);
         let raw_content = fmt_content.clone();
 
         self.fmt_contents.insert(proc.pid, fmt_content);
@@ -71,14 +72,14 @@ impl Column for Command {
                     })
                     .collect::<String>();
                 cmd.pop();
-                cmd = cmd.replace(['\n', '\t'], " ");
                 cmd
             } else {
                 String::from("")
             }
         } else {
             String::from("")
         };
+        let fmt_content = sanitize_control_chars(&fmt_content);
         let raw_content = fmt_content.clone();
 
         self.fmt_contents.insert(proc.pid, fmt_content);
@@ -99,6 +100,7 @@ impl Column for Command {
             .filter(|c| !c.is_empty())
             .cloned()
             .unwrap_or_else(|| proc.file_name.clone());
+        let fmt_content = sanitize_control_chars(&fmt_content);
         let raw_content = fmt_content.clone();
 
         self.fmt_contents.insert(proc.pid, fmt_content);
@@ -127,6 +129,7 @@ impl Column for Command {
             x
         };
         let fmt_content = command;
+        let fmt_content = sanitize_control_chars(&fmt_content);
         let raw_content = fmt_content.clone();
 
         self.fmt_contents.insert(proc.pid, fmt_content);
```

**File**: `src/util.rs` (modified, +29/-0)
```diff
@@ -223,6 +223,15 @@ pub fn truncate(s: &'_ str, width: usize) -> Cow<'_, str> {
     }
 }
 
+/// Replace control characters with spaces.
+///
+/// Process command lines are fully attacker-controlled, so any ESC/CSI/OSC
+/// sequence they contain would otherwise be interpreted by the terminal of
+/// whoever runs procs.
+pub fn sanitize_control_chars(s: &str) -> String {
+    s.replace(|c: char| char::is_control(c), " ")
+}
+
 /// Trim trailing whitespace from a string that may contain ANSI escape sequences.
 /// Unlike str::trim_end(), this correctly handles ANSI codes at the end of the string
 /// that would otherwise prevent trimming of trailing whitespace.
@@ -367,3 +376,23 @@ pub fn process_new(
         procfs::process::Process::new(pid)
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_sanitize_control_chars() {
+        // OSC 52 clipboard-write sequence embedded in a crafted argv0
+        let injected = "\u{1b}]52;c;bWFya2Vy\u{7}sleep\t60\nrm -rf /";
+        let sanitized = sanitize_control_chars(injected);
+        assert_eq!(sanitized, " ]52;c;bWFya2Vy sleep 60 rm -rf /");
+        assert!(!sanitized.chars().any(char::is_control));
+
+        // CSI sequences are neutralized too
+        assert_eq!(sanitize_control_chars("\u{1b}[2J\u{1b}[H"), " [2J [H");
+
+        // Normal command lines are untouched
+        assert_eq!(sanitize_control_chars("/bin/sleep 60"), "/bin/sleep 60");
+    }
+}
```

---

### Incident Patch 13: `2698608d` (2026-09-07)
**Commit Message**: Merge branch 'master' into fix/command-escape-sequences

**File**: `.github/workflows/regression.yml` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ jobs:
           - os: windows-latest
             rust: stable
             target: x86_64-pc-windows-msvc
+          - os: windows-11-arm
+            rust: stable
+            target: aarch64-pc-windows-msvc
 
     runs-on: ${{ matrix.os }}
     steps:
```

**File**: `.github/workflows/release.yml` (modified, +4/-1)
```diff
@@ -10,7 +10,7 @@ jobs:
 
     strategy:
       matrix:
-        os: [ubuntu-latest, ubuntu-24.04-arm, macOS-latest, windows-latest]
+        os: [ubuntu-latest, ubuntu-24.04-arm, macOS-latest, windows-latest, windows-11-arm]
         rust: [stable]
 
     runs-on: ${{ matrix.os }}
@@ -52,6 +52,9 @@ jobs:
     - name: Build for Windows
       if: matrix.os == 'windows-latest'
       run: make release_win
+    - name: Build for Windows ARM64
+      if: matrix.os == 'windows-11-arm'
+      run: make release_win_arm64
     - name: Release
       uses: softprops/action-gh-release@v1
       with:
```

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -2,6 +2,21 @@
 
 ## [Unreleased](https://github.com/dalance/procs/compare/v0.14.12...Unreleased) - ReleaseDate
 
+* [Added] Arch column for Windows (process image architecture)
+* [Added] Real Command column for Windows (command line arguments). This column was printing pure file name, which is now moved to FileName column.
+* [Added] Priority column for Windows (user-mode priority class)
+* [Added] RtPriority column for Windows (kernel base priority)
+* [Added] Threads column for Windows (thread count)
+* [Added] Session column for Windows (session ID)
+* [Added] State column for Windows (scheduler state derived from thread states)
+* [Added] Env column for Windows (environment variables)
+* [Added] RecvBytes and SendBytes columns for Windows (network I/O rate; needs Windows 11 or later)
+* [Added] WorkDir column for Windows (current working directory)
+* [Added] `--thread` support for Windows
+* [Changed] Group and Gid columns for Windows read the process token only when the column is displayed
+* [Fixed] ReadBytes / WriteBytes divided by a mis-scaled interval (seconds added to milliseconds)
+* [Fixed] Fix invalid JSON output when a column is skipped by --only or --tree
+
 ## [v0.14.12](https://github.com/dalance/procs/compare/v0.14.11...v0.14.12) - 2026-06-25
 
 * [Added] Add fancy regex fallback for advanced filters [#913](https://github.com/dalance/procs/pull/913)
```

**File**: `Cargo.lock` (modified, +5/-5)
```diff
@@ -1235,9 +1235,9 @@ checksum = "0ceec5bc11778974d1bcb055b18002eba7f4b3518b6a0081b3af5f21666da9ad"
 
 [[package]]
 name = "mach2"
-version = "0.6.0"
+version = "0.7.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dae608c151f68243f2b000364e1f7b186d9c29845f7d2d85bd31b9ad77ad552b"
+checksum = "b0d28e293f2b8c9d2b2d1c0193bd3c1cbdc0d2cf396888dc01162f7cf9d6c3f3"
 
 [[package]]
 name = "memchr"
@@ -1593,7 +1593,7 @@ dependencies = [
  "toml",
  "unicode-width",
  "uzers",
- "which 8.0.5",
+ "which 8.0.6",
  "windows-sys 0.61.2",
 ]
 
@@ -2523,9 +2523,9 @@ dependencies = [
 
 [[package]]
 name = "which"
-version = "8.0.5"
+version = "8.0.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8f3ef584124b911bcc3875c2f1472e80f24361ceb789bd1c62b3e9a3df9ff43c"
+checksum = "bae2f2b2b816647a1cab1acc91f5bd20812d53cb344382635ec2181940c8034f"
 dependencies = [
  "libc",
 ]
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -75,10 +75,10 @@ errno         = "0.3"
 pager         = "0.16"
 uzers         = "0.12"
 which         = "8"
-mach2         = "0.6.0"
+mach2         = "0.7.0"
 
 [target.'cfg(target_os = "windows")'.dependencies]
-windows-sys   = { version = "0.61", features = ["Win32_Foundation", "Win32_Networking_WinSock", "Win32_NetworkManagement_IpHelper", "Win32_Security", "Win32_System_Diagnostics_ToolHelp", "Win32_System_ProcessStatus", "Win32_System_Threading"] }
+windows-sys   = { version = "0.61", features = ["Wdk_System_SystemInformation", "Wdk_System_SystemServices", "Wdk_System_Threading", "Win32_Foundation", "Win32_Networking_WinSock", "Win32_NetworkManagement_IpHelper", "Win32_Security", "Win32_System_Diagnostics_Debug", "Win32_System_Kernel", "Win32_System_Threading", "Win32_System_WindowsProgramming"] }
 
 [target.'cfg(target_os = "freebsd")'.dependencies]
 bsd-kvm       = "0.1.5"
```

**File**: `Makefile` (modified, +6/-1)
```diff
@@ -7,7 +7,7 @@ BIN_NAME = procs
 
 export LONG_VERSION
 
-.PHONY: all test clean release_lnx release_win release_mac
+.PHONY: all test clean release_lnx release_win release_win_arm64 release_mac
 
 all: test
 
@@ -33,6 +33,11 @@ release_win:
 	mv -v target/x86_64-pc-windows-msvc/release/${BIN_NAME}.exe ./
 	7z a ${BIN_NAME}-v${VERSION}-x86_64-windows.zip ${BIN_NAME}.exe
 
+release_win_arm64:
+	cargo build --locked --release --target=aarch64-pc-windows-msvc
+	mv -v target/aarch64-pc-windows-msvc/release/${BIN_NAME}.exe ./
+	7z a ${BIN_NAME}-v${VERSION}-aarch64-windows.zip ${BIN_NAME}.exe
+
 release_mac:
 	cargo build --locked --release --target=x86_64-apple-darwin
 	cargo build --locked --release --target=aarch64-apple-darwin
```

**File**: `README.md` (modified, +10/-8)
```diff
@@ -434,7 +434,7 @@ The first `[[columns]]` is shown at left side, and the last is shown at right si
 
 | procs `kind`         | `ps` STANDARD FORMAT  | Description                                   | Linux | macOS | Windows | FreeBSD |
 | -------------------- | --------------------- | --------------------------------------------- | ----- | ----- | ------- | ------- |
-| Arch                 | -not supported-       | Architecture of binary (macOS specific)       |       | o     |         |         |
+| Arch                 | -not supported-       | Architecture of binary                        |       | o     | o       |         |
 | Ccgroup              | -not supported-       | Control group by compressed format            | o     |       |         |         |
 | Cgroup               | cgroup                | Control group                                 | o     |       |         |         |
 | Command              | args                  | Command with all arguments                    | o     | o     | o       | o       |
@@ -445,7 +445,7 @@ The first `[[columns]]` is shown at left side, and the last is shown at right si
 | ElapsedTime          | -not supported-       | Elapsed time                                  | o     | o     | o       | o       |
 | Env                  | `e` output modifier   | Environment variables                         | o     |       |         | o       |
 | Esp                  | esp                   | Stack pointer                                 | o     |       |         |         |
-| FileName             | comm                  | File name                                     | o     |       |         | o       |
+| FileName             | comm                  | File name                                     | o     |       | o       | o       |
 | Gid                  | egid                  | Group ID                                      | o     | o     | o       | o       |
 | GidFs                | fgid                  | File system group ID                          | o     |       |         |         |
 | GidReal              | rgid                  | Real group ID                                 | o     | o     |         | o       |
@@ -466,10 +466,12 @@ The first `[[columns]]` is shown at left side, and the last is shown at right si
 | Priority             | pri                   | Priority                                      | o     | o     | o       | o       |
 | Processor            | psr                   | Currently assigned processor                  | o     |       |         | o       |
 | ReadBytes            | -not supported-       | Read bytes from storage                       | o     | o     | o       | o       |
-| RtPriority           | rtprio                | Real-time priority                            | o     |       |         |         |
+| RecvBytes            | -not supported-       | Received bytes per second (Windows 11)        |       |       | o       |         |
+| RtPriority           | rtprio                | Kernel base priority (Windows) / real-time priority (Linux) | o     |       | o       |         |
 | SecContext           | label                 | Security context                              | o     |       |         |         |
+| SendBytes            | -not supported-       | Sent bytes per second (Windows 11)            |       |       | o       |         |
 | Separator            | -not supported-       | Show `\|` for column separation               | o     | o     | o       | o       |
-| Session              | sid                   | Session ID                                    | o     | o     |         | o       |
+| Session              | sid                   | Session ID                                    | o     | o     | o       | o       |
 | ShdPnd               | pending               | Pending signal mask for process               | o     |       |         | o       |
 | SigBlk               | blocked               | Blocked signal mask                           | o     |       |         | o       |
 | SigCgt               | caught                | Caught signal mask                            | o     |       |         | o       |
@@ -478,9 +480,9 @@ The first `[[columns]]` is shown at left side, and the last is shown at right si
 | Slot                 | -not supported-       | Slot for `--insert` option                    | o     | o     | o       | o       |
 | Ssb                  | -not supported-       | Speculative store bypass status               | o     |       |         |         |
 | StartTime            | start_time            | Starting time                                 | o     | o     | o       | o       |
-| State                | s                     | Process state                                 | o     | o     |         | o       |
-| TcpPort              | -not supported-       | Bound TCP ports                               | o     | o     |         |         |
-| Threads            
```

**File**: `src/columns/arch.rs` (modified, +134/-3)
```diff
@@ -3,9 +3,13 @@ use crate::{column_default, Column};
 use std::cmp;
 use std::collections::HashMap;
 
+#[cfg(target_os = "macos")]
 const CTL_MAXNAME: i32 = 12;
+#[cfg(target_os = "macos")]
 const P_TRANSLATED: i32 = 131072;
+#[cfg(target_os = "macos")]
 const CPU_TYPE_X86_64: i32 = 16777223;
+#[cfg(target_os = "macos")]
 const CPU_TYPE_ARM64: i32 = 16777228;
 
 pub struct Arch {
@@ -16,7 +20,6 @@ pub struct Arch {
     width: usize,
 }
 
-#[cfg(target_os = "macos")]
 impl Arch {
     pub fn new(header: Option<String>) -> Self {
         let header = header.unwrap_or_else(|| String::from("Arch"));
@@ -31,13 +34,12 @@ impl Arch {
     }
 }
 
-#[cfg(target_os = "macos")]
 impl Column for Arch {
     fn add(&mut self, proc: &ProcessInfo) {
         let pid = proc.pid;
         let arch = arch_from_pid(pid);
 
-        let fmt_content = format!("{}", arch);
+        let fmt_content = arch.to_string();
         let raw_content = fmt_content.clone();
 
         self.fmt_contents.insert(proc.pid, fmt_content);
@@ -47,6 +49,116 @@ impl Column for Arch {
     column_default!(String, false);
 }
 
+// ---------------------------------------------------------------------------
+// Windows
+// ---------------------------------------------------------------------------
+
+/// `IMAGE_FILE_MACHINE_*` constants.
+///
+/// <https://learn.microsoft.com/zh-cn/windows/win32/sysinfo/image-file-machine-constants>
+#[cfg(target_os = "windows")]
+mod machine {
+    pub const UNKNOWN: u16 = 0x0000;
+    pub const ALPHA: u16 = 0x0184;
+    /// Same value as `IMAGE_FILE_MACHINE_AXP64`.
+    pub const ALPHA64: u16 = 0x0284;
+    pub const AM33: u16 = 0x01d3;
+    pub const AMD64: u16 = 0x8664;
+    pub const ARM: u16 = 0x01c0;
+    pub const ARM64: u16 = 0xaa64;
+    /// x86_64 code that runs on ARM64 through emulation.
+    pub const ARM64EC: u16 = 0xa641;
+    /// Image loadable both as ARM64 and as ARM64EC.
+    pub const ARM64X: u16 = 0xa64e;
+    /// ARMv7 / Thumb-2; `IMAGE_FILE_MACHINE_ARMV7` shares this value.
+    pub const ARMNT: u16 = 0x01c4;
+    pub const CEE: u16 = 0xc0ee;
+    pub const CEF: u16 = 0x0cef;
+    pub const EBC: u16 = 0x0ebc;
+    pub const I386: u16 = 0x014c;
+    pub const IA64: u16 = 0x0200;
+    pub const M32R: u16 = 0x9041;
+    pub const MIPS16: u16 = 0x0266;
+    pub const MIPSFPU: u16 = 0x0366;
+    pub const MIPSFPU16: u16 = 0x0466;
+    pub const POWERPC: u16 = 0x01f0;
+    pub const POWERPCFP: u16 = 0x01f1;
+    pub const R3000: u16 = 0x0162;
+    pub const R4000: u16 = 0x0166;
+    pub const R10000: u16 = 0x0168;
+    pub const SH3: u16 = 0x01a2;
+    pub const SH3DSP: u16 = 0x01a3;
+    pub const SH3E: u16 = 0x01a4;
+    pub const SH4: u16 = 0x01a6;
+    pub const SH5: u16 = 0x01a8;
+    pub const THUMB: u16 = 0x01c2;
+    pub const TRICORE: u16 = 0x0520;
+    pub const WCEMIPSV2: u16 = 0x0169;
+}
+
+/// Reports the architecture of the image `pid` was started from.
+///
+/// WOW64 processes report their own architecture, not the host's: a 32-bit
+/// process on an x86_64 machine yields `x86`.
+#[cfg(target_os = "windows")]
+pub fn arch_from_pid(pid: i32) -> &'static str {
+    use windows_sys::Win32::Foundation::{CloseHandle, FALSE, HANDLE};
+    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
+
+    // 0 is the idle process and has no image; negative pids are not real.
+    if pid <= 0 {
+        return "unknown";
+    }
+
+    // SAFETY: `pid` is only handed to `OpenProcess`, and the handle it hands
+    // back is closed before this function returns.
+    let handle: HANDLE = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid as u32) };
+    if handle.is_null() {
+        return "unknown";
+    }
+
+    let arch = crate::process::process_image_machine(handle)
+        .map(arch_from_machine)
+        .unwrap_or("unknown");
+    unsafe { CloseHandle(handle) };
+
+    arch
+}
+
+/// Names an `IMAGE_FILE_MACHINE_*` value the way the rest of the crate spells
+/// architectures (`x86_64`, `arm64`, ...).
+#[cfg(target_os = "windows")]
+fn arch_from_machine(machine: u16) -> &'static str {
+    use machine::*;
+
+    match machine {
+        UNKNOWN => "unknown",
+        I386 => "x86",
+        AMD64 => "x86_64",
+        ARM | ARMNT | THUMB => "arm",
+        ARM64 => "arm64",
+        ARM64EC => "arm64ec",
+        ARM64X => "arm64x",
+        IA64 => "ia64",
+        EBC => "ebc",
+        ALPHA | ALPHA64 => "alpha",
+        MIPS16 | MIPSFPU | MIPSFPU16 | R3000 | R4000 | R10000 | WCEMIPSV2 => "mips",
+        POWERPC | POWERPCFP => "ppc",
+        SH3 | SH3DSP | SH3E | SH4 | SH5 => "sh",
+        M32R => "m32r",
+        AM33 => "am33",
+        TRICORE => "tricore",
+        CEF => "cef",
+        // Pure IL assembly: no architecture of its own.
+        CEE => "msil",
+        _ => "unknown",
+    }
+}
+
+// ---------------------------------------------------------------------------
+// macOS
+// -------------------------------------
```

---

### Incident Patch 14: `6845bb7b` (2026-09-05)
**Commit Message**: fix `cargo clippy` errors

**File**: `src/columns/usage_mem.rs` (modified, +4/-2)
```diff
@@ -62,8 +62,10 @@ fn get_mem_total() -> u64 {
 
 #[cfg(target_os = "windows")]
 fn get_mem_total() -> u64 {
-    let mut info: MEMORYSTATUSEX = Default::default();
-    info.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
+    let mut info = MEMORYSTATUSEX {
+        dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
+        ..Default::default()
+    };
     let ret = unsafe { GlobalMemoryStatusEx(&mut info) };
 
     if ret != 0 {
```

**File**: `src/process/ntapi.rs` (modified, +3/-5)
```diff
@@ -287,8 +287,8 @@ impl SID_MAX {
             if abbr {
                 write!(&mut ret, "-...-{}", subs[count - 1]).unwrap();
             } else {
-                for i in 1..count {
-                    write!(&mut ret, "-{}", subs[i]).unwrap();
+                for sub in &subs[1..] {
+                    write!(&mut ret, "-{sub}").unwrap();
                 }
             }
         }
@@ -807,9 +807,7 @@ impl<'a> Iterator for ProcessIter<'a> {
         // Alignment is deliberately not required: a full snapshot pads entries
         // to 2 bytes, so demanding 8 would silently truncate the process list.
         let next = info.NextEntryOffset as usize;
-        let end = if next == 0 {
-            limit
-        } else if next < header {
+        let end = if next == 0 || next < header {
             limit
         } else {
             offset.saturating_add(next).min(limit)
```

**File**: `src/process/windows.rs` (modified, +2/-9)
```diff
@@ -145,10 +145,7 @@ pub fn collect_proc(
 
         // The snapshot SID saves an `OpenProcessToken`; the token is only
         // opened for processes the snapshot could not name.
-        let user = proc
-            .user_sid
-            .clone()
-            .or_else(|| handles.full.and_then(get_user));
+        let user = proc.user_sid.or_else(|| handles.full.and_then(get_user));
         let groups = handles.full.and_then(get_groups);
         let priority = proc.base_priority;
 
@@ -205,11 +202,7 @@ pub fn collect_proc(
 
             let (command, user, groups) = {
                 let parent = &ret[owner];
-                (
-                    parent.command.clone(),
-                    parent.user.clone(),
-                    parent.groups.clone(),
-                )
+                (parent.command.clone(), parent.user, parent.groups.clone())
             };
 
             ret.push(ProcessInfo {
```

---

### Incident Patch 15: `9e4d4c53` (2026-09-03)
**Commit Message**: replace GetPerformanceInfo for GlobalMemoryStatusEx

one less DLL to load

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ which         = "8"
 mach2         = "0.7.0"
 
 [target.'cfg(target_os = "windows")'.dependencies]
-windows-sys   = { version = "0.61", features = ["Win32_Foundation", "Win32_Networking_WinSock", "Win32_NetworkManagement_IpHelper", "Win32_Security", "Win32_System_Diagnostics_Debug", "Win32_System_LibraryLoader", "Win32_System_ProcessStatus", "Win32_System_Threading"] }
+windows-sys   = { version = "0.61", features = ["Win32_Foundation", "Win32_Networking_WinSock", "Win32_NetworkManagement_IpHelper", "Win32_Security", "Win32_System_Diagnostics_Debug", "Win32_System_LibraryLoader", "Win32_System_Threading"] }
 
 [target.'cfg(target_os = "freebsd")'.dependencies]
 bsd-kvm       = "0.1.5"
```

**File**: `src/columns/usage_mem.rs` (modified, +5/-6)
```diff
@@ -5,9 +5,7 @@ use procfs::{Current, Meminfo, WithCurrentSystemInfo};
 use std::cmp;
 use std::collections::HashMap;
 #[cfg(target_os = "windows")]
-use std::mem::{size_of, zeroed};
-#[cfg(target_os = "windows")]
-use windows_sys::Win32::System::ProcessStatus::{GetPerformanceInfo, PERFORMANCE_INFORMATION};
+use windows_sys::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
 
 pub struct UsageMem {
     header: String,
@@ -64,11 +62,12 @@ fn get_mem_total() -> u64 {
 
 #[cfg(target_os = "windows")]
 fn get_mem_total() -> u64 {
-    let mut info: PERFORMANCE_INFORMATION = unsafe { zeroed() };
-    let ret = unsafe { GetPerformanceInfo(&mut info, size_of::<PERFORMANCE_INFORMATION>() as u32) };
+    let mut info: MEMORYSTATUSEX = Default::default();
+    info.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
+    let ret = unsafe { GlobalMemoryStatusEx(&mut info) };
 
     if ret != 0 {
-        info.PhysicalTotal as u64 * info.PageSize as u64
+        info.ullTotalPhys
     } else {
         0
     }
```

#### Recent Merged Pull Requests:
- **PR #985** (2026-10-05): build(deps): bump libc from 0.2.189 to 0.2.190 (@dependabot[bot])
- **PR #981** (2026-09-22): build(deps): bump minus from 5.7.2 to 5.8.0 (@dependabot[bot])
- **PR #980** (2026-09-16): build(deps): bump byte-unit from 5.2.5 to 5.2.6 (@dependabot[bot])
- **PR #979** (2026-09-16): build(deps): bump fancy-regex from 0.19.1 to 0.19.2 (@dependabot[bot])
- **PR #978** (2026-09-14): build(deps): bump toml from 1.1.5+spec-1.1.0 to 1.1.6+spec-1.1.0 (@dependabot[bot])
- **PR #977** (2026-09-14): build(deps): bump console from 0.16.4 to 0.16.6 (@dependabot[bot])
- **PR #973** (2026-09-09): build(deps): bump fancy-regex from 0.19.0 to 0.19.1 (@dependabot[bot])
- **PR #971** (closed): Windows: adds external pager support (@CarterLi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
