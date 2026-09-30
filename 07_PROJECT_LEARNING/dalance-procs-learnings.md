# Forensic Learning Record (Deep Inspection): dalance/procs

> **Canonical Artifact**: `07_PROJECT_LEARNING/dalance-procs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dalance/procs](https://github.com/dalance/procs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:17:29.534Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dalance/procs`
- **Description**: A modern replacement for ps written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6185 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #970** (2026-09-07): **build(deps): bump toml from 1.1.4+spec-1.1.0 to 1.1.5+spec-1.1.0**
  *Symptoms*: Bumps [toml](https://github.com/toml-rs/toml) from 1.1.4+spec-1.1.0 to 1.1.5+spec-1.1.0. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/toml-rs/toml/commit/e93ed4e1dec245fb523aec2afd0a300da4207f4e"><code>e93ed4e</code></a> chore: Release</li> <li><a href="https://github.com/toml-rs/toml/commit/d23436d0ff5f0c898915537d667de60aa2cfa4f7"><code>d23436d</code></a> docs: Update changelog</li> <li><a href="https://github.com/toml-rs/toml/commit/151afcd426ba92c59dc945a7cace6a2a640f96de"><code>151afcd</code></a> fix(de): Ensure DeValue::make_owned includes DeInteger/DeFloat (<a href="https://redirect.github.com/toml-rs/toml/issues/1211">#1211</a>)</li> <li><a href="https://github.com/toml-rs/toml/commit/26a4050b3c4657732340d9397ce962a1c804df89"><code>26a4050</code></a> fix(de): Ensure DeValue::make_owned includes DeInteger/DeFloat</li> <li><a href="https://github.com/toml-rs/toml/commit/232f1369e90a7f6a5c26579547a2968e4d671390"><code>232f136</code></a> chore(deps): Update Prek to v0.5.1 (<a href="https://redirect.github.com/toml-rs/toml/issues/1209">#1209</a>)</li> <li><a href="https://github.com/toml-rs/toml/commit/9ee4b4eee39f3dec2cde66764f083e90f7e68560"><code>9ee4b4e</code></a> chore(deps): Update crate-ci/typos digest to 4d9c206 (<a href="https://redirect.github.com/toml-rs/toml/issues/1208">#1208</a>)</li> <li><a href="https://github.com/toml-rs/toml/commit/525f3526199f5645da72dab5b486a22b9e97760b"><code>525f352</code></a> chore(deps): Update crate-ci/

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

### Incident Patch 1: `312cc7aa` (2026-09-07)
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

### Incident Patch 2: `39bc8c21` (2026-09-07)
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

### Incident Patch 3: `1f3cc794` (2026-09-07)
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

---

### Incident Patch 4: `a064cec7` (2026-09-07)
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

### Incident Patch 5: `2698608d` (2026-09-07)
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

---

### Incident Patch 6: `6845bb7b` (2026-09-05)
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

### Incident Patch 7: `9e4d4c53` (2026-09-03)
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

---

### Incident Patch 8: `dcc1d53b` (2026-09-07)
**Commit Message**: Merge pull request #958 from VXNCXNX/fix-json-trailing-comma

fix: --json emits invalid JSON when a column is skipped by --only or --tree

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 
 ## [Unreleased](https://github.com/dalance/procs/compare/v0.14.12...Unreleased) - ReleaseDate
 
+* [Fixed] Fix invalid JSON output when a column is skipped by --only or --tree
 * [Fixed] ReadBytes / WriteBytes divided by a mis-scaled interval (seconds added to milliseconds)
 
 ## [v0.14.12](https://github.com/dalance/procs/compare/v0.14.11...v0.14.12) - 2026-06-25
```

**File**: `src/view.rs` (modified, +38/-12)
```diff
@@ -604,18 +604,13 @@ impl View {
 
         let len_pid = self.visible_pids.len();
         for (i, pid) in self.visible_pids.iter().enumerate() {
-            let mut line = "{".to_string();
-            let len_column = self.columns.len();
-            for (j, c) in self.columns.iter().enumerate() {
-                if c.visible && c.kind != ConfigColumnKind::Separator {
-                    let text = c.column.display_json(*pid);
-                    line.push_str(&text);
-                    if j != len_column - 1 {
-                        line.push_str(", ");
-                    }
-                }
-            }
-            line.push('}');
+            let fields: Vec<String> = self
+                .columns
+                .iter()
+                .filter(|c| c.visible && c.kind != ConfigColumnKind::Separator)
+                .map(|c| c.column.display_json(*pid))
+                .collect();
+            let mut line = json_object(&fields);
             if i != len_pid - 1 {
                 line.push(',');
             }
@@ -775,3 +770,34 @@ impl View {
         current
     }
 }
+
+/// Builds one JSON object row. Columns without a JSON representation
+/// (e.g. Tree) yield an empty string and must not produce a separator.
+fn json_object(fields: &[String]) -> String {
+    let fields: Vec<&str> = fields
+        .iter()
+        .map(String::as_str)
+        .filter(|x| !x.is_empty())
+        .collect();
+    format!("{{{}}}", fields.join(", "))
+}
+
+#[cfg(test)]
+mod tests {
+    use super::json_object;
+
+    #[test]
+    fn json_object_skips_columns_without_json() {
+        assert_eq!(json_object(&[]), "{}");
+        assert_eq!(json_object(&[r#""PID": 1"#.into()]), r#"{"PID": 1}"#);
+        // a hidden (--only) or Tree column contributes nothing, not a comma
+        assert_eq!(
+            json_object(&["".into(), r#""PID": 1"#.into(), "".into()]),
+            r#"{"PID": 1}"#
+        );
+        assert_eq!(
+            json_object(&[r#""PID": 1"#.into(), r#""CPU": 0"#.into()]),
+            r#"{"PID": 1, "CPU": 0}"#
+        );
+    }
+}
```

---

### Incident Patch 9: `b76625fe` (2026-09-07)
**Commit Message**: Merge branch 'master' into fix-json-trailing-comma

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

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## [Unreleased](https://github.com/dalance/procs/compare/v0.14.12...Unreleased) - ReleaseDate
 
 * [Fixed] Fix invalid JSON output when a column is skipped by --only or --tree
+* [Fixed] ReadBytes / WriteBytes divided by a mis-scaled interval (seconds added to milliseconds)
 
 ## [v0.14.12](https://github.com/dalance/procs/compare/v0.14.11...v0.14.12) - 2026-06-25
 
```

**File**: `Cargo.lock` (modified, +2/-2)
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
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ errno         = "0.3"
 pager         = "0.16"
 uzers         = "0.12"
 which         = "8"
-mach2         = "0.6.0"
+mach2         = "0.7.0"
 
 [target.'cfg(target_os = "windows")'.dependencies]
 windows-sys   = { version = "0.61", features = ["Win32_Foundation", "Win32_Networking_WinSock", "Win32_NetworkManagement_IpHelper", "Win32_Security", "Win32_System_Diagnostics_ToolHelp", "Win32_System_ProcessStatus", "Win32_System_Threading"] }
```

---

### Incident Patch 10: `1ae12e12` (2026-09-07)
**Commit Message**: Merge pull request #968 from CarterLi/fix

fix: ReadBytes / WriteBytes divided by a mis-scaled interval

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## [Unreleased](https://github.com/dalance/procs/compare/v0.14.12...Unreleased) - ReleaseDate
 
+* [Fixed] ReadBytes / WriteBytes divided by a mis-scaled interval (seconds added to milliseconds)
+
 ## [v0.14.12](https://github.com/dalance/procs/compare/v0.14.11...v0.14.12) - 2026-06-25
 
 * [Added] Add fancy regex fallback for advanced filters [#913](https://github.com/dalance/procs/pull/913)
```

**File**: `src/columns/read_bytes.rs` (modified, +4/-4)
```diff
@@ -32,7 +32,7 @@ impl Column for ReadBytes {
         let (fmt_content, raw_content) = if let Some(curr_io) = proc.curr_io
             && let Some(prev_io) = proc.prev_io
         {
-            let interval_ms = proc.interval.as_secs() + u64::from(proc.interval.subsec_millis());
+            let interval_ms = proc.interval.as_secs() * 1000 + u64::from(proc.interval.subsec_millis());
             let io = (curr_io.read_bytes - prev_io.read_bytes) * 1000 / interval_ms;
             (bytify(io), io)
         } else {
@@ -50,7 +50,7 @@ impl Column for ReadBytes {
 impl Column for ReadBytes {
     fn add(&mut self, proc: &ProcessInfo) {
         let (fmt_content, raw_content) = if proc.curr_res.is_some() && proc.prev_res.is_some() {
-            let interval_ms = proc.interval.as_secs() + u64::from(proc.interval.subsec_millis());
+            let interval_ms = proc.interval.as_secs() * 1000 + u64::from(proc.interval.subsec_millis());
             let io = (proc.curr_res.as_ref().unwrap().ri_diskio_bytesread
                 - proc.prev_res.as_ref().unwrap().ri_diskio_bytesread)
                 * 1000
@@ -70,7 +70,7 @@ impl Column for ReadBytes {
 #[cfg(target_os = "windows")]
 impl Column for ReadBytes {
     fn add(&mut self, proc: &ProcessInfo) {
-        let interval_ms = proc.interval.as_secs() + u64::from(proc.interval.subsec_millis());
+        let interval_ms = proc.interval.as_secs() * 1000 + u64::from(proc.interval.subsec_millis());
         let io = (proc.disk_info.curr_read - proc.disk_info.prev_read) * 1000 / interval_ms;
 
         let raw_content = io;
@@ -88,7 +88,7 @@ impl Column for ReadBytes {
     fn add(&mut self, proc: &ProcessInfo) {
         // io block size: 128KB
         let block_size = 128 * 1024;
-        let interval_ms = proc.interval.as_secs() + u64::from(proc.interval.subsec_millis());
+        let interval_ms = proc.interval.as_secs() * 1000 + u64::from(proc.interval.subsec_millis());
         let io = (proc.curr_proc.info.rusage.inblock as u64
             - proc.prev_proc.info.rusage.inblock as u64)
             * block_size
```

**File**: `src/columns/write_bytes.rs` (modified, +4/-4)
```diff
@@ -32,7 +32,7 @@ impl Column for WriteBytes {
         let (fmt_content, raw_content) = if let Some(curr_io) = proc.curr_io
             && let Some(prev_io) = proc.prev_io
         {
-            let interval_ms = proc.interval.as_secs() + u64::from(proc.interval.subsec_millis());
+            let interval_ms = proc.interval.as_secs() * 1000 + u64::from(proc.interval.subsec_millis());
             let io = (curr_io.write_bytes - prev_io.write_bytes) * 1000 / interval_ms;
             (bytify(io), io)
         } else {
@@ -50,7 +50,7 @@ impl Column for WriteBytes {
 impl Column for WriteBytes {
     fn add(&mut self, proc: &ProcessInfo) {
         let (fmt_content, raw_content) = if proc.curr_res.is_some() && proc.prev_res.is_some() {
-            let interval_ms = proc.interval.as_secs() + u64::from(proc.interval.subsec_millis());
+            let interval_ms = proc.interval.as_secs() * 1000 + u64::from(proc.interval.subsec_millis());
             let io = (proc.curr_res.as_ref().unwrap().ri_diskio_byteswritten
                 - proc.prev_res.as_ref().unwrap().ri_diskio_byteswritten)
                 * 1000
@@ -70,7 +70,7 @@ impl Column for WriteBytes {
 #[cfg(target_os = "windows")]
 impl Column for WriteBytes {
     fn add(&mut self, proc: &ProcessInfo) {
-        let interval_ms = proc.interval.as_secs() + u64::from(proc.interval.subsec_millis());
+        let interval_ms = proc.interval.as_secs() * 1000 + u64::from(proc.interval.subsec_millis());
         let io = (proc.disk_info.curr_write - proc.disk_info.prev_write) * 1000 / interval_ms;
 
         let raw_content = io;
@@ -88,7 +88,7 @@ impl Column for WriteBytes {
     fn add(&mut self, proc: &ProcessInfo) {
         // io block size: 128KB
         let block_size = 128 * 1024;
-        let interval_ms = proc.interval.as_secs() + u64::from(proc.interval.subsec_millis());
+        let interval_ms = proc.interval.as_secs() * 1000 + u64::from(proc.interval.subsec_millis());
         let io = (proc.curr_proc.info.rusage.oublock as u64
             - proc.prev_proc.info.rusage.oublock as u64)
             * block_size
```

#### Recent Merged Pull Requests:
- **PR #981** (2026-09-22): build(deps): bump minus from 5.7.2 to 5.8.0 (@dependabot[bot])
- **PR #980** (2026-09-16): build(deps): bump byte-unit from 5.2.5 to 5.2.6 (@dependabot[bot])
- **PR #979** (2026-09-16): build(deps): bump fancy-regex from 0.19.1 to 0.19.2 (@dependabot[bot])
- **PR #978** (2026-09-14): build(deps): bump toml from 1.1.5+spec-1.1.0 to 1.1.6+spec-1.1.0 (@dependabot[bot])
- **PR #977** (2026-09-14): build(deps): bump console from 0.16.4 to 0.16.6 (@dependabot[bot])
- **PR #973** (2026-09-09): build(deps): bump fancy-regex from 0.19.0 to 0.19.1 (@dependabot[bot])
- **PR #971** (closed): Windows: adds external pager support (@CarterLi)
- **PR #970** (2026-09-07): build(deps): bump toml from 1.1.4+spec-1.1.0 to 1.1.5+spec-1.1.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
