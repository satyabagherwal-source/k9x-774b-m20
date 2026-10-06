# Forensic Learning Record (Deep Inspection): XAMPPRocky/tokei

> **Canonical Artifact**: `07_PROJECT_LEARNING/xampprocky-tokei-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/XAMPPRocky/tokei](https://github.com/XAMPPRocky/tokei))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:35:17.736Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `XAMPPRocky/tokei`
- **Description**: Count your code, quickly.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 14980 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/cli_utils.rs`
```
use std::{
    borrow::Cow,
    fmt,
    io::{self, Write},
    process,
    str::FromStr,
};

use clap::crate_version;
use colored::Colorize;
use num_format::ToFormattedString;

use crate::input::Format;
use tokei::{find_char_boundary, CodeStats, Language, LanguageType, Report};

use crate::consts::{
    BLANKS_COLUMN_WIDTH, CODE_COLUMN_WIDTH, COMMENTS_COLUMN_WIDTH, FILES_COLUMN_WIDTH,
    LINES_COLUMN_WIDTH,
};

const NO_LANG_HEADER_ROW_LEN: usize = 69;
const NO_LANG_ROW_LEN: usize = 63;
const NO_LANG_ROW_LEN_NO_SPACES: usize = 56;
const IDENT_INACCURATE: &str = "(!)";

pub fn crate_version() -> String {
    if Format::supported().is_empty() {
        format!(
            "{} compiled without serialization formats.",
            crate_version!()
        )
    } else {
        format!(
            "{} compiled with serialization support: {}",
            crate_version!(),
            Format::supported().join(", ")
        )
    }
}

pub fn setup_logger(verbose_option: u64) {
    use log::LevelFilter;

    let mut builder = env_logger::Builder::new();

    let filter_level = match verbose_option {
        1 => LevelFilter::Warn,
        2 => LevelFilter::Debug,
        3 => LevelFilter::Trace,
        _ => LevelFilter::Error,
    };

    builder.filter(None, filter_level);
    builder.init();
}

pub fn parse_or_exit<T>(s: impl AsRef<str>) -> T
where
    T: FromStr,
    T::Err: fmt::Display,
{
    T::from_str(s.as_ref()).unwrap_or_else(|e| {
        eprintln!("Error:\n{}", e);
        process::exit(1);
    })
}

#[non_exhaustive]
#[derive(Debug, Copy, Clone)]
pub enum NumberFormatStyle {
    // 1234 (Default)
    Plain,
    // 1,234
    Commas,
    // 1.234
    Dots,
    // 1_234
    Underscores,
}

impl Default for NumberFormatStyle {
    fn default() -> Self {
        Self::Plain
    }
}

impl FromStr for NumberFormatStyle {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "plain" => Ok(Self::Plain),
            "commas" => Ok(Self::Commas),
            "dots" => Ok(Self::Dots),
            "underscores" => Ok(Self::Underscores),
            _ => Err(format!(
                "Expected 'plain', 'commas', 'underscores', or 'dots' for num-format, but got '{}'",
                s,
            )),
        }
    }
}

impl NumberFormatStyle {
    fn separator(self) -> &'static str {
        match self {
            Self::Plain => "",
            Self::Commas => ",",
            Self::Dots => ".",
            Self::Underscores => "_",
        }
    }

    pub fn get_format(self) -> Result<num_format::CustomFormat, num_format::Error> {
        num_format::CustomFormat::builder()
            .grouping(num_format::Grouping::Standard)
            .separator(self.separator())
            .build()
    }
}

pub struct Printer<W> {
    writer: W,
    columns: usize,
    path_length: usize,
    row: String,
    subrow: String,
    list_files: bool,
    number_format: num_format::CustomFormat,
}

impl<W> Printer<W> {
    pub fn new(
        columns: usize,
        list_files: bool,
        writer: W,
        number_format: num_format::CustomFormat,
    ) -> Self {
        Self {
            columns,
            list_files,
            path_length: columns - NO_LANG_ROW_LEN_NO_SPACES,
            writer,
            row: "━".repeat(columns),
            subrow: "─".repeat(columns),
            number_format,
        }
    }
}

impl<W: Write> Printer<W> {
    pub fn print_header(&mut self) -> io::Result<()> {
        self.print_row()?;

        let files_column_width: usize = FILES_COLUMN_WIDTH + 6;
        writeln!(
            self.writer,
            " {:<6$} {:>files_column_width$} {:>LINES_COLUMN_WIDTH$} {:>CODE_COLUMN_WIDTH$} {:>COMMENTS_COLUMN_WIDTH$} {:>BLANKS_COLUMN_WIDTH$}",
            "Language".bold().blue(),
            "Files".bold().blue(),
            "Lines".bold().blue(),
            "Code".bold().blue(),
            "Comments".bold().blue(),
            "Blanks".bold().blue(),
            self.columns - NO_LANG_HEADER_ROW_LEN
        )?;
        self.print_row()
    }

    pub fn print_inaccuracy_warning(&mut self) -> io::Result<()> {
        writeln!(
            self.writer,
            "Note: results can be inaccurate for languages marked with '{}'",
            IDENT_INACCURATE
        )
    }

    pub fn print_language(&mut self, language: &Language, name: &str) -> io::Result<()>
    where
        W: Write,
    {
        self.print_language_name(language.inaccurate, name, None)?;
        write!(self.writer, " ")?;
        writeln!(
            self.writer,
            "{:>FILES_COLUMN_WIDTH$} {:>LINES_COLUMN_WIDTH$} {:>CODE_COLUMN_WIDTH$} {:>COMMENTS_COLUMN_WIDTH$} {:>BLANKS_COLUMN_WIDTH$}",
            language
                .reports
                .len()
                .to_formatted_string(&self.number_format),
            language.lines().to_formatted_string(&self.number_format),
            language.code.to_formatted_string(&self.number_format),
            language.comments.to_formatted_string(&self.number_format),
            language.blanks.to_formatted_string(&self.number_format),
        )
    }

    fn print_language_in_print_total(&mut self, language: &Language) -> io::Result<()>
    where
        W: Write,
    {
        self.print_language_name(language.inaccurate, "Total", None)?;
        write!(self.writer, " ")?;
        writeln!(
            self.writer,
            "{:>FILES_COLUMN_WIDTH$} {:>LINES_COLUMN_WIDTH$} {:>CODE_COLUMN_WIDTH$} {:>COMMENTS_COLUMN_WIDTH$} {:>BLANKS_COLUMN_WIDTH$}",
            language
                .children
                .values()
                .map(Vec::len)
                .sum::<usize>()
                .to_formatted_string(&self.number_format)
                .blue(),
            language
                .lines()
                .to_formatted_string(&self.number_format)
                .blue(),
            language
                .code
                .to_formatted_string(&self.number_format)
                .blue(),
            language
                .comments
                .to_formatted_string(&self.number_format)
                .blue(),
            language
                .blanks
                .to_formatted_string(&self.number_format)
                .blue(),
        )
    }

    pub fn print_language_name(
        &mut self,
        inaccurate: bool,
        name: &str,
        prefix: Option<&str>,
    ) -> io::Result<()> {
        let mut lang_section_len = self.columns - NO_LANG_ROW_LEN - prefix.map_or(0, str::len);
        if inaccurate {
            lang_section_len -= IDENT_INACCURATE.len();
        }

        if let Some(prefix) = prefix {
            write!(self.writer, "{}", prefix)?;
        }
        // truncate and replace the last char with a `|` if the name is too long
        if lang_section_len < name.len() {
            write!(self.writer, " {:.len$}", name, len = lang_section_len - 1)?;
            write!(self.writer, "|")?;
        } else {
            write!(
                self.writer,
                " {:<len$}",
                name.bold().magenta(),
                len = lang_section_len
            )?;
        }
        if inaccurate {
            write!(self.writer, "{}", IDENT_INACCURATE)?;
        };

        Ok(())
    }

    fn print_code_stats(
        &mut self,
        language_type: LanguageType,
        stats: &[CodeStats],
    ) -> io::Result<()> {
        self.print_language_name(false, &language_type.to_string(), Some(" |-"))?;
        let mut code = 0;
        let mut comments = 0;
        let mut blanks = 0;

        for stats in stats.iter().map(tokei::CodeStats::summarise) {
            code += stats.code;
            comments += stats.comments;
            blanks += stats.blanks;
        }

        if stats.is_empty() {
            Ok(())
        } else {
            writeln!(
                self.writer,
                " {:>FILES_COLUMN_WIDTH$} {:>LINES_COLUMN_WIDTH$} {:>CODE_COLUMN_WIDTH$} {:>COMMENTS_COLUMN_WIDTH$} {:>BLANKS_COLUMN_WIDTH$}",
                stats.len().to_formatted_string(&self.number_format),
                (code + comments + blanks).to_formatted_string(&self.number_format),
                code.to_formatted_string(&self.number_format),
                comments.to_formatted_string(&self.number_format),
                blanks.to_formatted_string(&self.number_format),
            )
        }
    }

    fn print_language_total(&mut self, parent: &Language) -> io::Result<()> {
        for (language, reports) in &parent.children {
            self.print_code_stats(
                *language,
                &reports
                    .iter()
                    .map(|r| r.stats.summarise())
                    .collect::<Vec<_>>(),
            )?;
        }
        let mut subtotal = tokei::Report::new("(Total)".into());
        let summary = parent.summarise();
        subtotal.stats.code += summary.code;
        subtotal.stats.comments += summary.comments;
        subtotal.stats.blanks += summary.blanks;
        self.print_report_with_name(&subtotal)?;

        Ok(())
    }

    pub fn print_results<'a, I>(
        &mut self,
        languages: I,
        compact: bool,
        is_sorted: bool,
    ) -> io::Result<()>
    where
        I: Iterator<Item = (&'a LanguageType, &'a Language)>,
    {
        let (a, b): (Vec<_>, Vec<_>) = languages
            .filter(|(_, v)| !v.is_empty())
            .partition(|(_, l)| compact || l.children.is_empty());
        let mut first = true;

        for languages in &[&a, &b] {
            for &(name, language) in *languages {
                let has_children = !(compact || language.children.is_empty());
                if first {
                    first = false;
                } else if has_children || self.list_files {
                    self.print_subrow()?;
                }

                self.print_language(language, name.name())?;
                if has_child
```

### Core Architecture Module: `src/utils/ext.rs`
```
//! Various extensions to Rust std types.

pub(crate) trait AsciiExt {
    fn is_whitespace(&self) -> bool;
    fn is_line_ending_whitespace(&self) -> bool;
}

impl AsciiExt for u8 {
    fn is_whitespace(&self) -> bool {
        *self == b' ' || (b'\x09'..=b'\x0d').contains(self)
    }

    fn is_line_ending_whitespace(&self) -> bool {
        *self == b'\n'
    }
}

pub(crate) trait SliceExt {
    fn trim_first_and_last_line_of_whitespace(&self) -> &Self;
    fn trim_start(&self) -> &Self;
    fn trim(&self) -> &Self;
    fn contains_slice(&self, needle: &Self) -> bool;
}

impl SliceExt for [u8] {
    fn trim_first_and_last_line_of_whitespace(&self) -> &Self {
        let start = self
            .iter()
            .position(|c| c.is_line_ending_whitespace() || !c.is_whitespace())
            .map_or(0, |i| (i + 1).min(self.len().saturating_sub(1)));

        let end = self
            .iter()
            .rposition(|c| c.is_line_ending_whitespace() || !c.is_whitespace())
            .map_or_else(
                || self.len().saturating_sub(1),
                |i| {
                    // Remove the entire `\r\n` in the case that it was the line ending whitespace
                    if self[i.saturating_sub(1)] == b'\r' && self[i] == b'\n' {
                        i - 1
                    } else {
                        i
                    }
                },
            );

        if self[start..].is_empty() {
            return &[];
        }

        &self[start..=end]
    }

    fn trim_start(&self) -> &Self {
        let length = self.len();

        if length == 0 {
            return self;
        }

        let start = match self.iter().position(|c| !c.is_whitespace()) {
            Some(start) => start,
            None => return &[],
        };

        &self[start..]
    }

    fn trim(&self) -> &Self {
        let length = self.len();

        if length == 0 {
            return self;
        }

        let start = match self.iter().position(|c| !c.is_whitespace()) {
            Some(start) => start,
            None => return &[],
        };

        let end = match self.iter().rposition(|c| !c.is_whitespace()) {
            Some(end) => end.max(start),
            _ => length,
        };

        &self[start..=end]
    }

    fn contains_slice(&self, needle: &Self) -> bool {
        let self_length = self.len();
        let needle_length = needle.len();

        if needle_length == 0 || needle_length > self_length {
            return false;
        } else if needle_length == self_length {
            return self == needle;
        }

        for window in self.windows(needle_length) {
            if needle == window {
                return true;
            }
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use proptest::prelude::*;

    #[test]
    fn is_whitespace() {
        assert!(b' '.is_whitespace());
        assert!(b'\r'.is_whitespace());
        assert!(b'\n'.is_whitespace());
    }

    #[test]
    fn trim() {
        assert!([b' ', b' ', b' '].trim().is_empty());
        assert!([b' ', b'\r', b'\n'].trim().is_empty());
        assert!([b'\n'].trim().is_empty());
        assert!([].trim().is_empty());

        assert_eq!([b'a', b'b'], [b'a', b'b'].trim());
        assert_eq!([b'h', b'i'], [b' ', b'h', b'i'].trim());
        assert_eq!([b'h', b'i'], [b'h', b'i', b' '].trim());
        assert_eq!([b'h', b'i'], [b' ', b'h', b'i', b' '].trim());
    }

    #[test]
    fn contains() {
        assert!([1, 2, 3, 4, 5].contains_slice(&[1, 2, 3, 4, 5]));
        assert!([1, 2, 3, 4, 5].contains_slice(&[1, 2, 3]));
        assert!([1, 2, 3, 4, 5].contains_slice(&[3, 4, 5]));
        assert!([1, 2, 3, 4, 5].contains_slice(&[2, 3, 4]));
        assert!(![1, 2, 3, 4, 5].contains_slice(&[]));
    }

    #[test]
    fn trim_first_and_last_line_of_whitespace_edge_cases() {
        assert_eq!(b"", b"\ra ".trim_first_and_last_line_of_whitespace());
        assert_eq!(b"a", b"\r\na ".trim_first_and_last_line_of_whitespace());

        assert_eq!(b" ", b" ".trim_first_and_last_line_of_whitespace());
    }

    proptest! {
        #[test]
        fn trim_first_and_last_line_of_whitespace_doesnt_panic(input: Vec<u8>) {
            let _ = &input.trim_first_and_last_line_of_whitespace();
        }
    }
}

```

### Core Architecture Module: `src/utils/fs.rs`
```
use std::{collections::BTreeMap, path::Path};

use ignore::{overrides::OverrideBuilder, DirEntry, WalkBuilder, WalkState::Continue};

use rayon::prelude::*;

use crate::{
    config::Config,
    language::{Language, LanguageType},
};

const IGNORE_FILE: &str = ".tokeignore";

pub fn get_all_files<A: AsRef<Path>>(
    paths: &[A],
    ignored_directories: &[&str],
    languages: &mut BTreeMap<LanguageType, Language>,
    config: &Config,
) {
    let languages = parking_lot::Mutex::new(languages);
    let (tx, rx) = crossbeam_channel::unbounded();

    let mut paths = paths.iter();
    let mut walker = WalkBuilder::new(paths.next().unwrap());

    for path in paths {
        walker.add(path);
    }

    if !ignored_directories.is_empty() {
        let mut overrides = OverrideBuilder::new(".");

        for ignored in ignored_directories {
            rs_error!(overrides.add(&format!("!{}", ignored)));
        }

        walker.overrides(overrides.build().expect("Excludes provided were invalid"));
    }

    let ignore = config.no_ignore.map(|b| !b).unwrap_or(true);
    let ignore_dot = ignore && config.no_ignore_dot.map(|b| !b).unwrap_or(true);
    let ignore_vcs = ignore && config.no_ignore_vcs.map(|b| !b).unwrap_or(true);

    // Custom ignore files always work even if the `ignore` option is false,
    // so we only add if that option is not present.
    if ignore_dot {
        walker.add_custom_ignore_filename(IGNORE_FILE);
    }

    walker
        .git_exclude(ignore_vcs)
        .git_global(ignore_vcs)
        .git_ignore(ignore_vcs)
        .hidden(config.hidden.map(|b| !b).unwrap_or(true))
        .ignore(ignore_dot)
        .parents(ignore && config.no_ignore_parent.map(|b| !b).unwrap_or(true));

    walker.build_parallel().run(move || {
        let tx = tx.clone();
        Box::new(move |entry| {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    use ignore::Error;
                    if let Error::WithDepth { err: ref error, .. } = error {
                        if let Error::WithPath {
                            ref path,
                            err: ref error,
                        } = **error
                        {
                            error!("{} reading {}", error, path.display());
                            return Continue;
                        }
                    }
                    error!("{}", error);
                    return Continue;
                }
            };

            if entry.file_type().map_or(false, |ft| ft.is_file()) {
                tx.send(entry).unwrap();
            }

            Continue
        })
    });

    let rx_iter = rx
        .into_iter()
        .par_bridge()
        .filter_map(|e| LanguageType::from_path(e.path(), config).map(|l| (e, l)));

    let process = |(entry, language): (DirEntry, LanguageType)| {
        let result = language.parse(entry.into_path(), config);
        let mut lock = languages.lock();
        let entry = lock.entry(language).or_insert_with(Language::new);
        match result {
            Ok(stats) => {
                let func = config.for_each_fn;
                if let Some(f) = func {
                    f(language, stats.clone())
                };
                entry.add_report(stats)
            }
            Err((error, path)) => {
                entry.mark_inaccurate();
                error!("Error reading {}:\n{}", path.display(), error);
            }
        }
    };

    if let Some(types) = config.types.as_deref() {
        rx_iter.filter(|(_, l)| types.contains(l)).for_each(process)
    } else {
        rx_iter.for_each(process)
    }
}

pub(crate) fn get_extension(path: &Path) -> Option<String> {
    path.extension().map(|e| e.to_string_lossy().to_lowercase())
}

pub(crate) fn get_filename(path: &Path) -> Option<String> {
    path.file_name().map(|e| e.to_string_lossy().to_lowercase())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::IGNORE_FILE;
    use crate::{
        config::Config,
        language::{languages::Languages, LanguageType},
    };

    const FILE_CONTENTS: &[u8] = b"fn main() {}";
    const FILE_NAME: &str = "main.rs";
    const IGNORE_PATTERN: &str = "*.rs";
    const LANGUAGE: &LanguageType = &LanguageType::Rust;

    #[test]
    fn ignore_directory_with_extension() {
        let mut languages = Languages::new();
        let tmp_dir = TempDir::new().expect("Couldn't create temp dir");
        let path_name = tmp_dir.path().join("directory.rs");

        fs::create_dir(path_name).expect("Couldn't create directory.rs within temp");

        super::get_all_files(
            &[tmp_dir.into_path().to_str().unwrap()],
            &[],
            &mut languages,
            &Config::default(),
        );

        assert!(languages.get(LANGUAGE).is_none());
    }

    #[test]
    fn hidden() {
        let dir = TempDir::new().expect("Couldn't create temp dir.");
        let mut config = Config::default();
        let mut languages = Languages::new();

        fs::write(dir.path().join(".hidden.rs"), FILE_CONTENTS).unwrap();

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_none());

        config.hidden = Some(true);

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_some());
    }

    #[test]
    fn no_ignore_implies_dot() {
        let dir = TempDir::new().expect("Couldn't create temp dir.");
        let mut config = Config::default();
        let mut languages = Languages::new();

        fs::write(dir.path().join(".ignore"), IGNORE_PATTERN).unwrap();
        fs::write(dir.path().join(FILE_NAME), FILE_CONTENTS).unwrap();

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_none());

        config.no_ignore = Some(true);

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_some());
    }

    #[test]
    fn no_ignore_implies_vcs_gitignore() {
        let dir = TempDir::new().expect("Couldn't create temp dir.");
        let mut config = Config::default();
        let mut languages = Languages::new();

        git2::Repository::init(dir.path()).expect("Couldn't create git repo.");

        fs::write(dir.path().join(".gitignore"), IGNORE_PATTERN).unwrap();
        fs::write(dir.path().join(FILE_NAME), FILE_CONTENTS).unwrap();

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_none());

        config.no_ignore = Some(true);

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_some());
    }

    #[test]
    fn no_ignore_parent() {
        let parent_dir = TempDir::new().expect("Couldn't create temp dir.");
        let child_dir = parent_dir.path().join("child/");
        let mut config = Config::default();
        let mut languages = Languages::new();

        fs::create_dir_all(&child_dir)
            .unwrap_or_else(|_| panic!("Couldn't create {:?}", child_dir));
        fs::write(parent_dir.path().join(".ignore"), IGNORE_PATTERN)
            .expect("Couldn't create .gitignore.");
        fs::write(child_dir.join(FILE_NAME), FILE_CONTENTS).expect("Couldn't create child.rs");

        super::get_all_files(
            &[child_dir.as_path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_none());

        config.no_ignore_parent = Some(true);

        super::get_all_files(
            &[child_dir.as_path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_some());
    }

    #[test]
    fn no_ignore_dot() {
        let dir = TempDir::new().expect("Couldn't create temp dir.");
        let mut config = Config::default();
        let mut languages = Languages::new();

        fs::write(dir.path().join(".ignore"), IGNORE_PATTERN).unwrap();
        fs::write(dir.path().join(FILE_NAME), FILE_CONTENTS).unwrap();

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_none());

        config.no_ignore_dot = Some(true);

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_some());
    }

    #[test]
    fn no_ignore_dot_still_vcs_gitignore() {
        let dir = TempDir::new().expect("Couldn't create temp dir.");
        let mut config = Config::default();
        let mut languages = Languages::new();

        git2::Repository::init(dir.path()).expect("Couldn't create git repo.");

        fs::write(dir.path().join(".gitignore"), IGNORE_PATTERN).unwrap();
        fs::write(dir.path().join(FILE_NAME), FILE_CONTENTS).unwrap();

        config.no_ignore_dot = Some(true);

        super::get_all_files(
            &[dir.path().to_str().unwrap()],
            &[],
            &mut languages,
            &config,
        );

        assert!(languages.get(LANGUAGE).is_none());
    }

    #[test]
    fn no_ignore_dot_includes_custom_ignore() {
        let di
```

### Core Architecture Module: `src/utils/macros.rs`
```
#![allow(unused_macros)]

macro_rules! opt_warn {
    ($option:expr, $message:expr) => {
        match $option {
            Some(result) => result,
            None => {
                warn!($message);
                continue;
            }
        }
    };
}

macro_rules! rs_warn {
    ($result:expr, $message: expr) => {
        match $result {
            Ok(result) => result,
            Err(error) => {
                warn!("{}", error);
                continue;
            }
        }
    };
}

macro_rules! opt_error {
    ($option:expr, $message:expr) => {
        match $option {
            Some(result) => result,
            None => {
                error!($message);
                continue;
            }
        }
    };
}

macro_rules! rs_error {
    ($result:expr) => {
        match $result {
            Ok(result) => result,
            Err(error) => {
                error!("{}", error);
                continue;
            }
        }
    };
}

macro_rules! opt_ret_warn {
    ($option:expr, $message:expr) => {
        match $option {
            Some(result) => result,
            None => {
                warn!($message);
                return None;
            }
        }
    };
}

macro_rules! rs_ret_warn {
    ($result:expr, $message: expr) => {
        match $result {
            Ok(result) => result,
            Err(error) => {
                warn!("{}", error);
                return None;
            }
        }
    };
}

macro_rules! opt_ret_error {
    ($option:expr, $message:expr) => {
        match $option {
            Some(result) => result,
            None => {
                error!($message);
                return None;
            }
        }
    };
}

macro_rules! rs_ret_error {
    ($result:expr) => {
        match $result {
            Ok(result) => result,
            Err(error) => {
                error!("{}", error);
                return None;
            }
        }
    };
}

macro_rules! debug {
    ($fmt:expr) => (if cfg!(debug_assertions) {println!($fmt)});
    ($fmt:expr, $($arg:tt)*) => (if cfg!(debug_assertions) {println!($fmt, $($arg)*)});
}

```

### Core Architecture Module: `src/utils/mod.rs`
```
#[macro_use]
mod macros;
pub(crate) mod ext;
pub mod fs;

```

### Core Architecture Module: `fuzz/fuzz_targets/parse_from_slice.rs`
```
use arbitrary::Arbitrary;
use std::str;

use tokei::{Config, LanguageType};

#[derive(Arbitrary, Debug)]
pub struct FuzzInput<'a> {
    lang: LanguageType,
    treat_doc_strings_as_comments: bool,
    data: &'a [u8],
}

// The first byte of data is used to select a language; remaining input is parsed
// If check_total is true, asserts that the parsed stats pass a basic sanity test
pub fn parse_from_slice(input: FuzzInput, check_total: bool) {
    let config = &Config {
        treat_doc_strings_as_comments: Some(input.treat_doc_strings_as_comments),

        // these options don't impact the behaviour of parse_from_slice:
        columns: None,
        hidden: None,
        no_ignore: None,
        no_ignore_parent: None,
        no_ignore_dot: None,
        no_ignore_vcs: None,
        sort: None,
        types: None,
        for_each_fn: None,
    };

    // check that parsing doesn't panic
    let stats = input.lang.parse_from_slice(input.data, config);

    if check_total {
        // verify that the parsed total lines is not more than the total occurrences of \n and \r\n.
        // if/when all of the current discrepancies are fixed, we could make this stronger by checking it is equal.
        if let Ok(s) = str::from_utf8(input.data) {
            assert!(
            stats.lines() <= s.lines().count(),
            "{} got more total lines ({}) than str::lines ({}). Code: {}, Comments: {}, Blanks: {}. treat_doc_strings_as_comments: {}. File contents (as UTF-8):\n{}",
            input.lang.name(),
            stats.lines(),
            s.lines().count(),
            stats.code,
            stats.comments,
            input.treat_doc_strings_as_comments,
            stats.blanks,
            s
        )
        };
    }
}

```

### Core Architecture Module: `fuzz/fuzz_targets/parse_from_slice_panic.rs`
```
#![no_main]
use libfuzzer_sys::fuzz_target;

mod parse_from_slice;
use parse_from_slice::{parse_from_slice, FuzzInput};

fuzz_target!(|data: FuzzInput| {
    parse_from_slice(data, false);
});

```

### Core Architecture Module: `fuzz/fuzz_targets/parse_from_slice_total.rs`
```
#![no_main]
use libfuzzer_sys::fuzz_target;

mod parse_from_slice;
use parse_from_slice::{parse_from_slice, FuzzInput};

fuzz_target!(|data: FuzzInput| {
    parse_from_slice(data, true);
});

```

### Core Architecture Module: `src/cli.rs`
```
use std::{process, str::FromStr};

use clap::{crate_description, value_parser, Arg, ArgAction, ArgMatches};
use colored::Colorize;
use tokei::{Config, LanguageType, Sort};

use crate::{
    cli_utils::{crate_version, parse_or_exit, NumberFormatStyle},
    consts::{
        BLANKS_COLUMN_WIDTH, CODE_COLUMN_WIDTH, COMMENTS_COLUMN_WIDTH, LANGUAGE_COLUMN_WIDTH,
        LINES_COLUMN_WIDTH, PATH_COLUMN_WIDTH,
    },
    input::Format,
};

/// Used for sorting languages.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum Streaming {
    /// simple lines.
    Simple,
    /// Json outputs.
    Json,
}

impl std::str::FromStr for Streaming {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.to_lowercase().as_ref() {
            "simple" => Streaming::Simple,
            "json" => Streaming::Json,
            s => return Err(format!("Unsupported streaming option: {}", s)),
        })
    }
}

#[derive(Debug)]
pub struct Cli {
    matches: ArgMatches,
    pub columns: Option<usize>,
    pub files: bool,
    pub hidden: bool,
    pub no_ignore: bool,
    pub no_ignore_parent: bool,
    pub no_ignore_dot: bool,
    pub no_ignore_vcs: bool,
    pub output: Option<Format>,
    pub streaming: Option<Streaming>,
    pub print_languages: bool,
    pub sort: Option<Sort>,
    pub sort_reverse: bool,
    pub types: Option<Vec<LanguageType>>,
    pub compact: bool,
    pub number_format: num_format::CustomFormat,
}

impl Cli {
    pub fn from_args() -> Self {
        let matches = clap::Command::new("tokei")
            .version(crate_version())
            .author("Erin P. <xampprocky@gmail.com> + Contributors")
            .styles(clap_cargo::style::CLAP_STYLING)
            .about(concat!(
                crate_description!(),
                "\n",
                "Support this project on GitHub Sponsors: https://github.com/sponsors/XAMPPRocky"
            ))
            .arg(
                Arg::new("columns")
                    .long("columns")
                    .short('c')
                    .value_parser(value_parser!(usize))
                    .conflicts_with("output")
                    .help(
                        "Sets a strict column width of the output, only available for \
                        terminal output.",
                    ),
            )
            .arg(
                Arg::new("exclude")
                    .long("exclude")
                    .short('e')
                    .action(ArgAction::Append)
                    .help("Ignore all files & directories matching the pattern."),
            )
            .arg(
                Arg::new("files")
                    .long("files")
                    .short('f')
                    .action(ArgAction::SetTrue)
                    .help("Will print out statistics on individual files."),
            )
            .arg(
                Arg::new("file_input")
                    .long("input")
                    .short('i')
                    .help(
                        "Gives statistics from a previous tokei run. Can be given a file path, \
                        or \"stdin\" to read from stdin.",
                    ),
            )
            .arg(
                Arg::new("hidden")
                    .long("hidden")
                    .action(ArgAction::SetTrue)
                    .help("Count hidden files."),
            )
            .arg(
                Arg::new("input")
                    .num_args(1..)
                    .conflicts_with("languages")
                    .help("The path(s) to the file or directory to be counted. (default current directory)"),
            )
            .arg(
                Arg::new("languages")
                    .long("languages")
                    .short('l')
                    .action(ArgAction::SetTrue)
                    .conflicts_with("input")
                    .help("Prints out supported languages and their extensions."),
            )
            .arg(Arg::new("no_ignore")
                .long("no-ignore")
                .action(ArgAction::SetTrue)
                .help(
                    "\
                        Don't respect ignore files (.gitignore, .ignore, etc.). This implies \
                        --no-ignore-parent, --no-ignore-dot, and --no-ignore-vcs.\
                    ",
                ))
            .arg(Arg::new("no_ignore_parent")
                .long("no-ignore-parent")
                .action(ArgAction::SetTrue)
                .help(
                    "\
                        Don't respect ignore files (.gitignore, .ignore, etc.) in parent \
                        directories.\
                    ",
                ))
            .arg(Arg::new("no_ignore_dot")
                .long("no-ignore-dot")
                .action(ArgAction::SetTrue)
                .help(
                    "\
                        Don't respect .ignore and .tokeignore files, including those in \
                        parent directories.\
                    ",
                ))
            .arg(Arg::new("no_ignore_vcs")
                .long("no-ignore-vcs")
                .action(ArgAction::SetTrue)
                .help(
                    "\
                        Don't respect VCS ignore files (.gitignore, .hgignore, etc.) including \
                        those in parent directories.\
                    ",
                ))
            .arg(
                Arg::new("output")
                    .long("output")
                    .short('o')
                    .value_parser(Format::from_str)
                    .help(
                        "Outputs Tokei in a specific format. Compile with additional features for \
                        more format support.",
                    ),
            )
            .arg(
                Arg::new("streaming")
                    .long("streaming")
                    .value_parser(["simple", "json"])
                    .ignore_case(true)
                    .help(
                        "prints the (language, path, lines, blanks, code, comments) records as \
                        simple lines or as Json for batch processing",
                    ),
            )
            .arg(
                Arg::new("sort")
                    .long("sort")
                    .short('s')
                    .value_parser(["files", "lines", "blanks", "code", "comments"])
                    .ignore_case(true)
                    .conflicts_with("rsort")
                    .help("Sort languages based on column"),
            )
            .arg(
                Arg::new("rsort")
                    .long("rsort")
                    .short('r')
                    .value_parser(["files", "lines", "blanks", "code", "comments"])
                    .ignore_case(true)
                    .conflicts_with("sort")
                    .help("Reverse sort languages based on column"),
            )
            .arg(
                Arg::new("types")
                    .long("types")
                    .short('t')
                    .action(ArgAction::Append)
                    .help(
                        "Filters output by language type, separated by a comma. i.e. \
                        -t=Rust,Markdown",
                    ),
            )
            .arg(
                Arg::new("compact")
                    .long("compact")
                    .short('C')
                    .action(ArgAction::SetTrue)
                    .help("Do not print statistics about embedded languages."),
            )
            .arg(
                Arg::new("num_format_style")
                    .long("num-format")
                    .short('n')
                    .value_parser(["commas", "dots", "plain", "underscores"])
                    .conflicts_with("output")
                    .help(
                        "Format of printed numbers, i.e., plain (1234, default), \
                        commas (1,234), dots (1.234), or underscores (1_234). Cannot be \
                        used with --output.",
                    ),
            )
            .arg(
                Arg::new("verbose")
                    .long("verbose")
                    .short('v')
                    .action(ArgAction::Count)
                    .help(
                        "Set log output level:
                        1: to show unknown file extensions,
                        2: reserved for future debugging,
                        3: enable file level trace. Not recommended on multiple files",
                    ),
            )
            .get_matches();

        let columns = matches.get_one::<usize>("columns").cloned();
        let files = matches.get_flag("files");
        let hidden = matches.get_flag("hidden");
        let no_ignore = matches.get_flag("no_ignore");
        let no_ignore_parent = matches.get_flag("no_ignore_parent");
        let no_ignore_dot = matches.get_flag("no_ignore_dot");
        let no_ignore_vcs = matches.get_flag("no_ignore_vcs");
        let print_languages = matches.get_flag("languages");
        let verbose = matches.get_count("verbose") as u64;
        let compact = matches.get_flag("compact");
        let types = matches.get_many("types").map(|e| {
            e.flat_map(|x: &String| {
                x.split(',')
                    .map(str::parse::<LanguageType>)
                    .filter_map(Result::ok)
                    .collect::<Vec<_>>()
            })
            .collect()
        });

        let num_format_style = matches
            .get_one::<String>("num_format_style")
            .map(parse_or_exit::<NumberFormatStyle>)
            .unwrap_or_default();

        let number_format = match num_format_style.get_format() {
            Ok(format) => format,
            Err(e) => {
                eprintln!("Error:\n{}", e);
                process::exit(1);
            }
        };

        let sort = matches.g
```

### Core Architecture Module: `src/config.rs`
```
use std::{env, fs, path::PathBuf};

use etcetera::BaseStrategy;

use crate::language::LanguageType;
use crate::sort::Sort;
use crate::stats::Report;

/// A configuration struct for how [`Languages::get_statistics`] searches and
/// counts languages.
///
/// ```
/// use tokei::Config;
///
/// let config = Config {
///     treat_doc_strings_as_comments: Some(true),
///     ..Config::default()
/// };
/// ```
///
/// [`Languages::get_statistics`]: struct.Languages.html#method.get_statistics
#[derive(Debug, Default, Deserialize)]
pub struct Config {
    /// Width of columns to be printed to the terminal. _This option is ignored
    /// in the library._ *Default:* Auto detected width of the terminal.
    pub columns: Option<usize>,
    /// Count hidden files and directories. *Default:* `false`.
    pub hidden: Option<bool>,
    /// Don't respect ignore files (.gitignore, .ignore, etc.). This implies --no-ignore-parent,
    /// --no-ignore-dot, and --no-ignore-vcs. *Default:* `false`.
    pub no_ignore: Option<bool>,
    /// Don't respect ignore files (.gitignore, .ignore, etc.) in parent directories.
    /// *Default:* `false`.
    pub no_ignore_parent: Option<bool>,
    /// Don't respect .ignore and .tokeignore files, including those in parent directories.
    /// *Default:* `false`.
    pub no_ignore_dot: Option<bool>,
    /// Don't respect VCS ignore files (.gitignore, .hgignore, etc.), including those in
    /// parent directories. *Default:* `false`.
    pub no_ignore_vcs: Option<bool>,
    /// Whether to treat doc strings in languages as comments.  *Default:*
    /// `false`.
    pub treat_doc_strings_as_comments: Option<bool>,
    /// Sort languages. *Default:* `None`.
    pub sort: Option<Sort>,
    /// Filters languages searched to just those provided. E.g. A directory
    /// containing `C`, `Cpp`, and `Rust` with a `Config.types` of `[Cpp, Rust]`
    /// will count only `Cpp` and `Rust`. *Default:* `None`.
    pub types: Option<Vec<LanguageType>>,
    // /// A map of individual language configuration.
    // pub languages: Option<HashMap<LanguageType, LanguageConfig>>,
    /// Whether to output only the paths for downstream batch processing
    /// *Default:* false
    #[serde(skip)]
    /// Adds a closure for each function, e.g., print the result
    pub for_each_fn: Option<fn(LanguageType, Report)>,
}

impl Config {
    /// Constructs a new `Config` from either `$base/tokei.toml` or
    /// `$base/.tokeirc`. `tokei.toml` takes precedence over `.tokeirc`
    /// as the latter is a hidden file on Unix and not an idiomatic
    /// filename on Windows.
    fn get_config(base: PathBuf) -> Option<Self> {
        fs::read_to_string(base.join("tokei.toml"))
            .ok()
            .or_else(|| fs::read_to_string(base.join(".tokeirc")).ok())
            .and_then(|s| toml::from_str(&s).ok())
    }

    /// Creates a `Config` from three configuration files if they are available.
    /// Files can have two different names `tokei.toml` and `.tokeirc`.
    /// Firstly it will attempt to find a config in the configuration directory
    /// (see below), secondly from the home directory, `$HOME/`,
    /// and thirdly from the current directory, `./`.
    /// The current directory's configuration will take priority over the configuration
    /// directory.
    ///
    /// |Platform | Value                                 | Example                        |
    /// | ------- | ------------------------------------- | ------------------------------ |
    /// | Linux   | `$XDG_CONFIG_HOME` or `$HOME`/.config | /home/alice/.config            |
    /// | macOS   | `$XDG_CONFIG_HOME` or `$HOME`/.config | /Users/alice/.config           |
    /// | Windows | `{FOLDERID_RoamingAppData}`           | C:\Users\Alice\AppData\Roaming |
    ///
    /// # Example
    /// ```toml
    /// columns = 80
    /// types = ["Python"]
    /// treat_doc_strings_as_comments = true
    // ///
    // /// [[languages.Python]]
    // /// extensions = ["py3"]
    /// ```
    pub fn from_config_files() -> Self {
        let conf_dir = etcetera::choose_base_strategy()
            .ok()
            .map(|basedirs| basedirs.config_dir())
            .and_then(Self::get_config)
            .unwrap_or_default();

        let home_dir = etcetera::home_dir()
            .ok()
            .and_then(Self::get_config)
            .unwrap_or_default();

        let current_dir = env::current_dir()
            .ok()
            .and_then(Self::get_config)
            .unwrap_or_default();

        #[allow(clippy::or_fun_call)]
        Config {
            columns: current_dir
                .columns
                .or(home_dir.columns.or(conf_dir.columns)),
            hidden: current_dir.hidden.or(home_dir.hidden.or(conf_dir.hidden)),
            //languages: current_dir.languages.or(conf_dir.languages),
            treat_doc_strings_as_comments: current_dir.treat_doc_strings_as_comments.or(home_dir
                .treat_doc_strings_as_comments
                .or(conf_dir.treat_doc_strings_as_comments)),
            sort: current_dir.sort.or(home_dir.sort.or(conf_dir.sort)),
            types: current_dir.types.or(home_dir.types.or(conf_dir.types)),
            for_each_fn: current_dir
                .for_each_fn
                .or(home_dir.for_each_fn.or(conf_dir.for_each_fn)),
            no_ignore: current_dir
                .no_ignore
                .or(home_dir.no_ignore.or(conf_dir.no_ignore)),
            no_ignore_parent: current_dir
                .no_ignore_parent
                .or(home_dir.no_ignore_parent.or(conf_dir.no_ignore_parent)),
            no_ignore_dot: current_dir
                .no_ignore_dot
                .or(home_dir.no_ignore_dot.or(conf_dir.no_ignore_dot)),
            no_ignore_vcs: current_dir
                .no_ignore_vcs
                .or(home_dir.no_ignore_vcs.or(conf_dir.no_ignore_vcs)),
        }
    }
}

/*
/// Configuration for an individual [`LanguageType`].
///
/// ```
/// use std::collections::HashMap;
/// use tokei::{Config, LanguageConfig, LanguageType};
///
/// let config = Config {
///     languages: {
///         let cpp_conf = LanguageConfig {
///             extensions: vec![String::from("c")],
///         };
///
///         let mut languages_config = HashMap::new();
///         languages_config.insert(LanguageType::Cpp, cpp_conf);
///
///         Some(languages_config)
///     },
///
///     ..Config::default()
/// };
///
/// ```
///
/// [`LanguageType`]: enum.LanguageType.html
#[derive(Debug, Default, Deserialize)]
pub struct LanguageConfig {
    /// Additional extensions for a language. Any extensions that overlap with
    /// already defined extensions from `tokei` will be ignored.
    pub extensions: Vec<String>,
}

impl LanguageConfig {
    /// Creates a new empty configuration. By default this will not change
    /// anything from the default.
    pub fn new() -> Self {
        Self::default()
    }

    /// Accepts a `Vec<String>` representing additional extensions for a
    /// language. Any extensions that overlap with already defined extensions
    /// from `tokei` will be ignored.
    pub fn extensions(&mut self, extensions: Vec<String>) {
        self.extensions = extensions;
    }
}
*/

```

### Core Architecture Module: `src/consts.rs`
```
// Set of common pub consts.

/// Fallback row length
pub const FALLBACK_ROW_LEN: usize = 81;

// Column widths used for console printing.

/// Language column width
pub const LANGUAGE_COLUMN_WIDTH: usize = 10;

/// Path column width
pub const PATH_COLUMN_WIDTH: usize = 80;

/// Files column width
pub const FILES_COLUMN_WIDTH: usize = 8;

/// Lines column width
pub const LINES_COLUMN_WIDTH: usize = 12;

/// Code column width
pub const CODE_COLUMN_WIDTH: usize = 12;

/// Comments column width
pub const COMMENTS_COLUMN_WIDTH: usize = 12;

/// Blanks column width
pub const BLANKS_COLUMN_WIDTH: usize = 12;

```

### Core Architecture Module: `src/input.rs`
```
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, error::Error, str::FromStr};

use tokei::{Language, LanguageType, Languages};

type LanguageMap = BTreeMap<LanguageType, Language>;

#[derive(Deserialize, Serialize, Debug)]
struct Output {
    #[serde(flatten)]
    languages: LanguageMap,
    #[serde(rename = "Total")]
    totals: Language,
}

macro_rules! supported_formats {
    ($(
        ($name:ident, $feature:expr, $variant:ident [$($krate:ident),+]) =>
            $parse_kode:expr,
            $print_kode:expr,
    )+) => (
        $( // for each format
            $( // for each required krate
                #[cfg(feature = $feature)] extern crate $krate;
            )+
        )+

        /// Supported serialization formats.
        ///
        /// To enable all formats compile with the `all` feature.
        #[cfg_attr(test, derive(strum_macros::EnumIter))]
        #[derive(Debug, Clone)]
        pub enum Format {
            Json,
            $(
                #[cfg(feature = $feature)] $variant
            ),+
            // TODO: Allow adding format at runtime when used as a lib?
        }

        impl Format {
            pub fn supported() -> &'static [&'static str] {
                &[
                    "json",
                    $(
                        #[cfg(feature = $feature)] stringify!($name)
                    ),+
                ]
            }

            pub fn all() -> &'static [&'static str] {
                &[
                    $( stringify!($name) ),+
                ]
            }

            pub fn all_feature_names() -> &'static [&'static str] {
                &[
                    $( $feature ),+
                ]
            }

            pub fn not_supported() -> &'static [&'static str] {
                &[
                    $(
                        #[cfg(not(feature = $feature))] stringify!($name)
                    ),+
                ]
            }

            pub fn parse(input: &str) -> Option<LanguageMap> {
                if input.is_empty() {
                    return None
                }

                if let Ok(Output { languages, .. }) = serde_json::from_str::<Output>(input) {
                    return Some(languages);
                }

                $(
                    // attributes are not yet allowed on `if` expressions
                    #[cfg(feature = $feature)]
                    {
                        let parse = &{ $parse_kode };

                        if let Ok(Output { languages, .. }) = parse(input) {
                            return Some(languages)
                        }
                    }
                )+

                // Didn't match any of the compiled serialization formats
                None
            }

            pub fn print(&self, languages: &Languages) -> Result<String, Box<dyn Error>> {
                let output = Output {
                    languages: (*languages).to_owned(),
                    totals: languages.total()
                };

                match *self {
                    Format::Json => Ok(serde_json::to_string(&output)?),
                    $(
                        #[cfg(feature = $feature)] Format::$variant => {
                            let print= &{ $print_kode };
                            Ok(print(&output)?)
                        }
                    ),+
                }
            }
        }

        impl FromStr for Format {
            type Err = String;

            fn from_str(format: &str) -> Result<Self, Self::Err> {
                match format {
                    "json" => Ok(Format::Json),
                    $(
                        stringify!($name) => {
                            #[cfg(feature = $feature)]
                            return Ok(Format::$variant);

                            #[cfg(not(feature = $feature))]
                            return Err(format!(
"This version of tokei was compiled without \
any '{format}' serialization support, to enable serialization, \
reinstall tokei with the features flag.

    cargo install tokei --features {feature}

If you want to enable all supported serialization formats, you can use the 'all' feature.

    cargo install tokei --features all\n",
                                format = stringify!($name),
                                feature = $feature)
                            );
                        }
                    ),+
                    format => Err(format!("{:?} is not a supported serialization format", format)),
                }
            }
        }
    )
}

// The ordering of these determines the attempted order when parsing.
supported_formats!(
    (cbor, "cbor", Cbor [serde_cbor, hex]) =>
        |input| {
            hex::FromHex::from_hex(input)
                .map_err(|e: hex::FromHexError| <Box<dyn Error>>::from(e))
                .and_then(|hex: Vec<_>| Ok(serde_cbor::from_slice(&hex)?))
        },
        |languages| serde_cbor::to_vec(&languages).map(hex::encode),

    (json, "json", Json [serde_json]) =>
        serde_json::from_str,
        serde_json::to_string,

    (yaml, "yaml", Yaml [serde_yaml]) =>
        serde_yaml::from_str,
        serde_yaml::to_string,
);

pub fn add_input(input: &str, languages: &mut Languages) -> bool {
    use std::fs::File;
    use std::io::Read;

    let map = match File::open(input) {
        Ok(mut file) => {
            let contents = {
                let mut contents = String::new();
                file.read_to_string(&mut contents)
                    .expect("Couldn't read file");
                contents
            };

            convert_input(&contents)
        }
        Err(_) => {
            if input == "stdin" {
                let mut stdin = ::std::io::stdin();
                let mut buffer = String::new();

                let _ = stdin.read_to_string(&mut buffer);
                convert_input(&buffer)
            } else {
                convert_input(input)
            }
        }
    };

    if let Some(map) = map {
        *languages += map;
        true
    } else {
        false
    }
}

fn convert_input(contents: &str) -> Option<LanguageMap> {
    self::Format::parse(contents)
}

#[cfg(test)]
mod tests {
    use super::*;

    use strum::IntoEnumIterator;
    use tokei::Config;

    use std::path::Path;

    #[test]
    fn formatting_print_matches_parse() {
        // Get language results from sample dir
        let data_dir = Path::new("tests").join("data");
        let mut langs = Languages::new();
        langs.get_statistics(&[data_dir], &[], &Config::default());

        // Check that the value matches after serializing and deserializing
        for variant in Format::iter() {
            let serialized = variant
                .print(&langs)
                .unwrap_or_else(|_| panic!("Failed serializing variant: {:?}", variant));
            let deserialized = Format::parse(&serialized)
                .unwrap_or_else(|| panic!("Failed deserializing variant: {:?}", variant));
            assert_eq!(*langs, deserialized);
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1361** (2026-06-14): **README: fix option documentation**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Oh TheRootDaemon was ahead of me.

- **Issue #1353** (2026-05-06): **Add Laravel Blade language support**
  *Symptoms*: Laravel Blade: https://laravel.com/docs/12.x/blade  - Detect Blade by .blade extension and .blade.php compound suffix  - Generic path_suffixes field for any future compound-extension language; matched in from_path before extension lookup so .blade.php wins over PHP - Recognise Blade ({{-- --}}) and HTML (<!-- -->) multi-line comments - Sanitise auto-generated test idents so blade.blade.php produces a valid Rust function name - Add blade.blade.php fixture covering both comment styles
  **Post-Mortem & Fix Analysis**:
  > Thank you for your PR, and congrats on your first contribution! 🎉 

- **Issue #1346** (2026-09-06): **Bump toml from 0.8 to 0.9**
  *Symptoms*: Bumps `toml` from `0.8.19` to `0.9` (stable since 2025-08-29).  The single call site is `src/config.rs:68`, which uses `toml::from_str(&s).ok()`. That API is stable across 0.8 and 0.9, so no source changes are required.  ### MSRV  `toml 0.9.0`'s MSRV is `1.66`, well under tokei's current `rust-version = "1.71"`. No MSRV impact.  ### Verification  * `cargo build`: clean * `cargo test`: 22 passed, 0 failed * `cargo fmt --all --check`: clean  Note: `cargo clippy --all-targets -- -D warnings` currently fails with 7 pre-existing errors on master (reproducible on vanilla master before this change). CI does not run clippy, so this bump does not affect CI results.  ### Lockfile  `cargo update --package toml --precise 0.9.11` produced the 90-line lockfile diff. Most of the churn is adding `toml_writer 1.1.1` and splitting `winnow` (the toml 0.9 stack depends on `winnow 0.7` in some places and `winnow 1.0` in others). This matches what every consumer of toml 0.9 will see.  ### Context  The bump is part of the Debian Rust team's `toml 0.9` transition (tracked at debcargo-conf#147). tokei is one of the reverse-dependencies currently on 0.8; merging this removes it from the transition list. 
  **Post-Mortem & Fix Analysis**:
  > Hi - this PR has been sitting since 2026-04-19 with green CI across every target and no review comments. The change is narrow (toml 0.8 to 0.9). Is there anything blocking it, or anything I can help with?  Context: Debian currently carries a relax-deps patch to widen tokei's toml upper bound so it keeps building against the toml transition in progress (salsa.debian.org/rust-team/debcargo-conf/-/issues/147). Landing this upstream would let that patch be dropped.
  > Thank you for your PR, and congrats on your first contribution! 🎉 
  > >  Is there anything blocking it, or anything I can help with?  Thank you, the project just isn't much of a focus for me at the moment. :)

- **Issue #1336** (2026-09-06): **Update strum/strum_macros to 0.28.0**
  *Symptoms*: This doesn’t affect MSRV, and `cargo test` still passes.
  **Post-Mortem & Fix Analysis**:
  > Thank you for your PR! 

- **Issue #1333** (2026-02-24): **add .github/workflows/release_artifacts.yml for prebuild binaries in release page**
  *Symptoms*: This PR is to solve the problem mentioned in this discussion <https://github.com/XAMPPRocky/tokei/discussions/1330>  @XAMPPRocky , may be it is a good idea to try to issue a new release for an experiment.
  **Post-Mortem & Fix Analysis**:
  > Thank you for your PR! However we already have a ci for releasing artifacts and there are glaring issues with this code that lead me to believe it was not reviewed or tested before being opened so I'm going to close it. Code changes need to be tested and reviewed before being opened.
  > @XAMPPRocky   > However we already have a ci for releasing artifacts  Which script or workflow YAML is for publishing the prebuilt artifacts?  >  there are glaring issues with this code   Can you give me some hint, may be I can fix it.   It is a fact that after `13.0.0`, there is no longer prebuilt binaries in release page.
  > This is painful.

- **Issue #1324** (2026-09-06): **Add support for Godot TextScene(tscn)**
  *Symptoms*: Add support for Godot TextScene files (tscn)
  **Post-Mortem & Fix Analysis**:
  > I'd like to be included as well
  > Same here!
  > Hello @XAMPPRocky!  Could you please bring some love for this PR? 

- **Issue #1321** (2026-01-25): **Add Djot language support in languages.json**
  *Symptoms*: It's like markdown. https://djot.net/
  **Post-Mortem & Fix Analysis**:
  > Thank you for your PR, and congrats on your first contribution! 🎉 

- **Issue #1319** (2026-01-25): **Added C3 programming language.**
  *Symptoms*: Hi.  I have added support for the [C3 programming language](https://github.com/c3lang/c3c).
  **Post-Mortem & Fix Analysis**:
  > Thank you for your PR, and congrats on your first contribution! 🎉 
  > Thank you.

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

### Incident Patch 1: `cba46d52` (2025-12-26)
**Commit Message**: Fix downcast type mismatches in clap_builder (#1310)

* Fix downcast type mismatches in clap_builder

* Fix downcast type mismatch for --num-format

* Apply changes from #1233 and #1237

**File**: `src/cli.rs` (modified, +10/-24)
```diff
@@ -256,9 +256,9 @@ impl Cli {
             .collect()
         });
 
-        let num_format_style: NumberFormatStyle = matches
-            .get_one::<NumberFormatStyle>("num_format_style")
-            .cloned()
+        let num_format_style = matches
+            .get_one::<String>("num_format_style")
+            .map(parse_or_exit::<NumberFormatStyle>)
             .unwrap_or_default();
 
         let number_format = match num_format_style.get_format() {
@@ -269,30 +269,16 @@ impl Cli {
             }
         };
 
-        // Sorting category should be restricted by clap but parse before we do
-        // work just in case.
-        let (sort, sort_reverse) = if let Some(sort) = matches.get_one::<String>("sort") {
-            (Some(sort.clone()), false)
-        } else {
-            let sort = matches.get_one::<String>("rsort");
-            (sort.cloned(), sort.is_some())
-        };
-        let sort = sort.map(|x| match Sort::from_str(&x) {
-            Ok(sort) => sort,
-            Err(e) => {
-                eprintln!("Error:\n{}", e);
-                process::exit(1);
-            }
-        });
+        let sort = matches.get_one::<String>("sort");
+        let rsort = matches.get_one::<String>("rsort");
+        let sort = sort.or(rsort).map(parse_or_exit);
+        let sort_reverse = rsort.is_some();
 
         // Format category is overly accepting by clap (so the user knows what
         // is supported) but this will fail if support is not compiled in and
         // give a useful error to the user.
         let output = matches.get_one("output").cloned();
-        let streaming = matches
-            .get_one("streaming")
-            .cloned()
-            .map(parse_or_exit::<Streaming>);
+        let streaming = matches.get_one::<String>("streaming").map(parse_or_exit);
 
         crate::cli_utils::setup_logger(verbose);
 
@@ -320,8 +306,8 @@ impl Cli {
         cli
     }
 
-    pub fn file_input(&self) -> Option<&str> {
-        self.matches.get_one("file_input").cloned()
+    pub fn file_input(&self) -> Option<&String> {
+        self.matches.get_one("file_input")
     }
 
     pub fn ignored_directories(&self) -> Vec<&str> {
```

**File**: `src/cli_utils.rs` (modified, +2/-2)
```diff
@@ -54,12 +54,12 @@ pub fn setup_logger(verbose_option: u64) {
     builder.init();
 }
 
-pub fn parse_or_exit<T>(s: &str) -> T
+pub fn parse_or_exit<T>(s: impl AsRef<str>) -> T
 where
     T: FromStr,
     T::Err: fmt::Display,
 {
-    T::from_str(s).unwrap_or_else(|e| {
+    T::from_str(s.as_ref()).unwrap_or_else(|e| {
         eprintln!("Error:\n{}", e);
         process::exit(1);
     })
```

---

### Incident Patch 2: `fc5cea5a` (2025-12-07)
**Commit Message**: chore: fix typos (#1303)

**File**: `tests/data/chapel.chpl` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
 
 /* Cheeky // block comments */
 
-// Caculate a factorial
+// Calculate a factorial
 proc factorial(n: int): int {
     var x = 1; // this will eventually be returned
     for i in 1..n {
```

**File**: `tests/data/jq.jq` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 # A function to perform arithmetic
 def add_mul(adder; multiplier):
-  # comment chararacter in quotes
+  # comment character in quotes
   "# Result: " + ((. + adder) * multiplier | tostring);
 
 # and demonstrate it
```

---

### Incident Patch 3: `fe513a7b` (2025-11-16)
**Commit Message**: Fix several typos (#1294)

**File**: `CHANGELOG.md` (modified, +4/-4)
```diff
@@ -148,7 +148,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ## [13.0.0-alpha.1](https://github.com/XAMPPRocky/tokei/compare/v13.0.0-alpha.0...v13.0.0-alpha.1) - 2024-03-04
 
 ### Fixed
-- fixed language names not showing when in Light mode (light background ([#1048](https://github.com/XAMPPRocky/tokei/pull/1048))
+- fixed language names not showing when in Light mode (light background) ([#1048](https://github.com/XAMPPRocky/tokei/pull/1048))
 
 ### Other
 - Create release-plz.yaml
@@ -227,7 +227,7 @@ Tokei 12 comes with some of the biggest user facing changes since 1.0, now in
 the latest version tokei will now **analyse and count multiple languages
 embedded in your source code** as well as adding support for
 **Jupyter Notebooks**. Now for the first time is able to handle and display
-different languages contained in a single source file. This currently available
+different languages contained in a single source file. This is currently available
 for a limited set of languages, with plans to add more support for more in the
 future. The currently supported languages are;
 
@@ -471,13 +471,13 @@ notable that `scc` takes nearly 3x as long to complete on smaller codebases
 - [Tokei's README has been translated
   to chinese.](https://github.com/chinanf-boy/tokei-zh#tokei-)
 - `LanguageType` now implements `Hash`.
-- Tokei now batches it's console output, this should result in a small
+- Tokei now batches its console output, this should result in a small
   performance boost.
 - There is now a `--columns` argument for manually setting tokei's output width.
 - The `--sort` argument is now case-insensitive.
 - Tokei will now mark languages who's files failed to parse correctly as
   potentially inaccurate.
-- Due to a bug in trust-ci `x86_64-unknown-netbsd` versions are will not be
+- Due to a bug in trust-ci `x86_64-unknown-netbsd` versions will not be
   available in GitHub releases. (You will still be able to install from source.)
 - Due to toml-rs's lacking enum support the TOML output option has
   been disabled.
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -68,7 +68,7 @@ Tokei is a program that displays statistics about your code. Tokei will show the
 - Tokei has huge range of languages, supporting over **150** languages, and
   their various extensions.
 
-- Tokei can output in multiple formats(**CBOR**, **JSON**, **YAML**)
+- Tokei can output in multiple formats (**CBOR**, **JSON**, **YAML**)
   allowing Tokei's output to be easily stored, and reused. These can also be
   reused in tokei combining a previous run's statistics with another set.
 
@@ -290,7 +290,7 @@ Tokei's URL scheme is as follows.
 https://tokei.rs/b1/{host: values: github|gitlab}/{Repo Owner eg: XAMPPRocky}/{Repo name eg: tokei}
 ```
 
-By default the badge will show the repo's LoC(_Lines of Code_), you can also
+By default the badge will show the repo's LoC (_Lines of Code_), you can also
 specify for it to show a different category, by using the `?category=` query
 string. It can be either `code`, `blanks`, `files`, `lines`, `comments`,
 Example show total lines:
```

**File**: `fuzz/README.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ To launch a fuzzing job: `cargo +nightly fuzz run <target>` - it will run until
 
 To use multiple cores: `cargo +nightly fuzz run <target> --jobs=6`
 
-To speed things up (at the expensive of missing bugs that only manifest in larger files):
+To speed things up (at the expense of missing bugs that only manifest in larger files):
 `cargo +nightly fuzz run <target> -- -max_len=200`
 
 Available fuzz targets:
```

**File**: `src/config.rs` (modified, +2/-2)
```diff
@@ -52,7 +52,7 @@ pub struct Config {
     /// Whether to output only the paths for downstream batch processing
     /// *Default:* false
     #[serde(skip)]
-    /// adds a closure for each function, e.g., print the result
+    /// Adds a closure for each function, e.g., print the result
     pub for_each_fn: Option<fn(LanguageType, Report)>,
 }
 
@@ -140,7 +140,7 @@ impl Config {
 }
 
 /*
-/// Configuration for a individual [`LanguageType`].
+/// Configuration for an individual [`LanguageType`].
 ///
 /// ```
 /// use std::collections::HashMap;
```

**File**: `src/language/languages.rs` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ impl Languages {
     /// provided by [`Language`].
     ///
     /// Takes a `&[&str]` of paths to recursively traverse, paths can be
-    /// relative, absolute or glob paths. a second `&[&str]` of paths to ignore,
+    /// relative, absolute or glob paths. A second `&[&str]` of paths to ignore,
     /// these strings use the `.gitignore` syntax, such as `target`
     /// or `**/*.bk`.
     ///
```

---

### Incident Patch 4: `f78be23e` (2025-08-15)
**Commit Message**: chore: remove alpha prefix

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ license = "MIT OR Apache-2.0"
 name = "tokei"
 readme = "README.md"
 repository = "https://github.com/XAMPPRocky/tokei.git"
-version = "13.0.0-alpha.9"
+version = "13.0.0"
 rust-version = "1.71"
 edition = "2021"
 
```

---

### Incident Patch 5: `7f258f47` (2025-01-23)
**Commit Message**: Fix CRLF or mixed CRLF/LF line terminations in Markdown files (#1219)

**File**: `CHANGELOG.md` (modified, +722/-722)
```diff
@@ -164,725 +164,725 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Disable *-android
 - Add HiCAD to languages.json ([#985](https://github.com/XAMPPRocky/tokei/pull/985))
 - Add Nushell to languages.json ([#982](https://github.com/XAMPPRocky/tokei/pull/982))
-# 12.1.0
-
-## Introduction
-Tokei is a fast and accurate code analysis CLI tool and library, allowing you to
-easily and quickly see how many blank lines, comments, and lines of code are in
-your codebase. All releases and work on Tokei and tokei.rs ([the free companion
-badge service][rs-info]) are [funded by the community through
-GitHub Sponsors][sponsor].
-
-You can always download the latest version of tokei through GitHub Releases or
-Cargo. Tokei is also available through other [package managers][pkg], though
-they may not always contain the latest release.
-
-```
-cargo install tokei
-```
-
-[pkg]: https://github.com/XAMPPRocky/tokei#package-managers
-[rs-info]: https://github.com/XAMPPRocky/tokei/blob/master/README.md#Badges
-[sponsor]: https://github.com/sponsors/XAMPPRocky
-
-## What's New?
-
-- [Added `-n/--num-format=[commas, dots, plain, underscores]` for adding
-  separator formatting for numbers.](https://github.com/XAMPPRocky/tokei/pull/591)
-- [The total is now included in output formats such as JSON.](https://github.com/XAMPPRocky/tokei/pull/580)
-- [`--no-ignore` now implies other ignore flags.](https://github.com/XAMPPRocky/tokei/pull/588)
-- [Added `--no-ignore-dot` flag to ignore files such as `.ignore`.](https://github.com/XAMPPRocky/tokei/pull/588)
-- [Added single line comments to F\*](https://github.com/XAMPPRocky/tokei/pull/670)
-- Updated various dependencies.
-
-### Added Languages
-
-- [ABNF](https://github.com/XAMPPRocky/tokei/pull/577)
-- [CodeQL](https://github.com/XAMPPRocky/tokei/pull/604)
-- [LiveScript](https://github.com/XAMPPRocky/tokei/pull/607)
-- [Stylus](https://github.com/XAMPPRocky/tokei/pull/619)
-- [DAML](https://github.com/XAMPPRocky/tokei/pull/620)
-- [Tera](https://github.com/XAMPPRocky/tokei/pull/627)
-- [TTCN-3](https://github.com/XAMPPRocky/tokei/pull/621)
-- [Beancount](https://github.com/XAMPPRocky/tokei/pull/630)
-- [Gleam](https://github.com/XAMPPRocky/tokei/pull/646)
-- [JSONNet](https://github.com/XAMPPRocky/tokei/pull/634)
-- [Stan](https://github.com/XAMPPRocky/tokei/pull/633)
-- [Gwion](https://github.com/XAMPPRocky/tokei/pull/659)
-
-# 12.0.0
-
-## What's New? 
-Tokei 12 comes with some of the biggest user facing changes since 1.0, now in
-the latest version tokei will now **analyse and count multiple languages
-embedded in your source code** as well as adding support for
-**Jupyter Notebooks**. Now for the first time is able to handle and display
-different languages contained in a single source file. This currently available
-for a limited set of languages, with plans to add more support for more in the
-future. The currently supported languages are;
-
-### HTML + Siblings (Vue, Svelte, Etc...)
-Tokei will now analyse and report the source code contained in `<script>`,
-`<style>`, and `<template>` tags in HTML and other similar languages. Tokei will
-read the value of the`type` attribute from the `<script>` tag and detects the
-appropriate language based on its mime type or JavaScript if not present. Tokei
-will do the same for `<style>` and `<template>` except reading the `lang`
-attribute instead of `type` and defaulting to CSS and HTML each respectively.
-
-### Jupyter Notebooks
-Tokei will now read Jupyter Notebook files (`.ipynb`) and will read the source
-code and markdown from Jupyter's JSON and output the analysed result.
-
-### Markdown
-Tokei will now detect any code blocks marked with specified source language and
-count each as their respective languages or as Markdown if not present or not
-found. Now you can easily see how many code examples are included in
-your documentation.
-
-### Rust
-Tokei will now detect blocks of rustdoc documentation  (e.g. `///`/`//!`) and
-parse them as markdown.
-
-### Verbatim Strings
-Tokei is now also capable of handling "verbatim" strings, which are strings that
-do not accept escape sequences like `\`. Thanks to @NickHackman for providing
-the implementation! This is initially supported for C++, C#, F#, and Rust.
-
-## New Look
-To be able to show these new features, tokei's output has been changed to look
-like below. For brevity the CLI only displays one level deep in each language,
-however the library's parser is fully recursive and you can get access to the
-complete report using the library or by outputting the JSON format.
-
-```
-===============================================================================
- Language            Files        Lines         Code     Comments       Blanks
-===============================================================================
- BASH                    4     
```

**File**: `README.md` (modified, +614/-614)
```diff
@@ -1,614 +1,614 @@
-# Tokei ([時計](https://en.wiktionary.org/wiki/%E6%99%82%E8%A8%88))
-[![Mean Bean CI](https://github.com/XAMPPRocky/tokei/workflows/Mean%20Bean%20CI/badge.svg)](https://github.com/XAMPPRocky/tokei/actions?query=workflow%3A%22Mean+Bean+CI%22)
-[![Help Wanted](https://img.shields.io/github/issues/XAMPPRocky/tokei/help%20wanted?color=green)](https://github.com/XAMPPRocky/tokei/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
-[![Lines Of Code](https://tokei.rs/b1/github/XAMPPRocky/tokei?category=code)](https://github.com/XAMPPRocky/tokei)
-[![Documentation](https://docs.rs/tokei/badge.svg)](https://docs.rs/tokei/)
-![](https://img.shields.io/crates/d/tokei?label=downloads%20%28crates.io%29)
-![](https://img.shields.io/github/downloads/xampprocky/tokei/total?label=downloads%20%28GH%29)
-![](https://img.shields.io/homebrew/installs/dy/tokei?color=brightgreen&label=downloads%20%28brew%29)
-![Chocolatey Downloads](https://img.shields.io/chocolatey/dt/tokei?label=Downloads%20(Chocolately))
-[![dependency status](https://deps.rs/repo/github/XAMPPRocky/tokei/status.svg)](https://deps.rs/repo/github/XAMPPRocky/tokei)
-[![Packaging status](https://repology.org/badge/tiny-repos/tokei.svg)](https://repology.org/project/tokei/versions)
-
-
-Tokei is a program that displays statistics about your code. Tokei will show the number of files, total lines within those files and code, comments, and blanks grouped by language.
-
-### Translations
-- [中文](https://github.com/chinanf-boy/tokei-zh#支持的语言)
-
-## Example
-```console
-━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Language            Files        Lines         Code     Comments       Blanks
-━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- BASH                    4           49           30           10            9
- JSON                    1         1332         1332            0            0
- Shell                   1           49           38            1           10
- TOML                    2           77           64            4            9
-───────────────────────────────────────────────────────────────────────────────
- Markdown                5         1355            0         1074          281
- |- JSON                 1           41           41            0            0
- |- Rust                 2           53           42            6            5
- |- Shell                1           22           18            0            4
- (Total)                           1471          101         1080          290
-───────────────────────────────────────────────────────────────────────────────
- Rust                   19         3416         2840          116          460
- |- Markdown            12          351            5          295           51
- (Total)                           3767         2845          411          511
-━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Total                  32         6745         4410         1506          829
-━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-```
-
-## [API Documentation](https://docs.rs/tokei)
-
-## Table of Contents
-
-- [Features](#features)
-- [Installation](#installation)
-    - [Package Managers](#package-managers)
-    - [Manual](#manual)
-- [Configuration](#configuration)
-- [How to use Tokei](#how-to-use-tokei)
-- [Options](#options)
-- [Badges](#badges)
-- [Supported Languages](#supported-languages)
-- [Changelog](CHANGELOG.md)
-- [Common Issues](#common-issues)
-- [Canonical Source](#canonical-source)
-- [Copyright and License](#copyright-and-license)
-
-## Features
-
-- Tokei is **very fast**, and is able to count millions of lines of code in seconds.
-  Check out the [11.0.0 release](https://github.com/XAMPPRocky/tokei/releases/v11.0.0)
-  to see how Tokei's speed compares to others.
-
-- Tokei is **accurate**, Tokei correctly handles multi line comments,
-  nested comments, and not counting comments that are in strings. Providing an
-  accurate code statistics.
-
-- Tokei has huge range of languages, supporting over **150** languages, and
-  their various extensions.
-
-- Tokei can output in multiple formats(**CBOR**, **JSON**, **YAML**)
-  allowing Tokei's output to be easily stored, and reused. These can also be
-  reused in tokei combining a previous run's statistics with another set.
-
-- Tokei is available on **Mac**, **Linux**, and **Windows**. See [installation
-  instructions](#installation) for how to get Tokei on your platform.
-
-- Tokei is also a **library** allowing you to easily integrate it with other
-  projects.
-
-- Tokei comes with and without color. Set the env variable NO_COLOR to 1, and
-  it'll be black and white.
-
-## Installation
-
-### Package Managers
-
-#### Unix
-```console
-# Alpine Linux (since 3.13)
-apk add
```

---

### Incident Patch 6: `97e6892d` (2025-01-23)
**Commit Message**: Fix a minor typo in CLI help text (#1217)

The typo was introduced during the clap v3 migration in
177d32e024b1dfb2b083d74fdbdb97fedd3b93ea.

**File**: `src/cli.rs` (modified, +1/-1)
```diff
@@ -141,7 +141,7 @@ impl Cli {
                 .action(ArgAction::SetTrue)
                 .help(
                     "\
-                        Don't respect .ignore and .tokeignore files, including this in \
+                        Don't respect .ignore and .tokeignore files, including those in \
                         parent directories.\
                     ",
                 ))
```

---

### Incident Patch 7: `6f2b9b22` (2025-01-23)
**Commit Message**: Fix a missing space in CLI help text (#1218)

**File**: `src/cli.rs` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ impl Cli {
                 Arg::new("input")
                     .num_args(1..)
                     .conflicts_with("languages")
-                    .help("The path(s) to the file or directory to be counted.(default current directory)"),
+                    .help("The path(s) to the file or directory to be counted. (default current directory)"),
             )
             .arg(
                 Arg::new("languages")
```

---

### Incident Patch 8: `563f1539` (2024-11-16)
**Commit Message**: Add support for Uiua language (#1191)

**File**: `languages.json` (modified, +5/-0)
```diff
@@ -1781,6 +1781,11 @@
       "quotes": [["\\\"", "\\\""]],
       "extensions": ["typ"]
     },
+    "Uiua": {
+      "line_comment": ["#"],
+      "quotes": [["\\\"", "\\\""]],
+      "extensions": ["ua"]
+    },
     "UMPL": {
       "line_comment": ["!"],
       "quotes": [["`", "`"]],
```

**File**: `tests/data/uiua.ua` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# 9 lines 5 code 3 comments 1 blanks
+# Calculate factorial
+# Result ? Number
+Factorial ← |1 (
+  ×. # Line comment
+)
+
+FactorialThree ← Factorial 3 # Another line comment
+FactorialFour  ← Factorial 4
```

---

### Incident Patch 9: `91f20434` (2024-11-10)
**Commit Message**: Fix alternative output formats (#1188)

**File**: `src/cli.rs` (modified, +1/-7)
```diff
@@ -158,13 +158,7 @@ impl Cli {
                 Arg::new("output")
                     .long("output")
                     .short('o')
-                    .value_parser(|x: &str| {
-                        if Format::all().contains(&x) {
-                            Ok(x.to_string())
-                        } else {
-                            Err(format!("Invalid output format: {x:?}"))
-                        }
-                    })
+                    .value_parser(Format::from_str)
                     .help(
                         "Outputs Tokei in a specific format. Compile with additional features for \
                         more format support.",
```

---

### Incident Patch 10: `bf009ef2` (2024-08-23)
**Commit Message**: fix issue https://github.com/XAMPPRocky/tokei/issues/1147 (#1149)

**File**: `src/cli.rs` (modified, +11/-4)
```diff
@@ -1,4 +1,4 @@
-use std::process;
+use std::{process, str::FromStr};
 
 use clap::{crate_description, value_parser, Arg, ArgAction, ArgMatches};
 use colored::Colorize;
@@ -276,12 +276,19 @@ impl Cli {
 
         // Sorting category should be restricted by clap but parse before we do
         // work just in case.
-        let (sort, sort_reverse) = if let Some(sort) = matches.get_one::<Sort>("sort") {
-            (Some(*sort), false)
+        let (sort, sort_reverse) = if let Some(sort) = matches.get_one::<String>("sort") {
+            (Some(sort.clone()), false)
         } else {
-            let sort = matches.get_one::<Sort>("rsort");
+            let sort = matches.get_one::<String>("rsort");
             (sort.cloned(), sort.is_some())
         };
+        let sort = sort.map(|x| match Sort::from_str(&x) {
+            Ok(sort) => sort,
+            Err(e) => {
+                eprintln!("Error:\n{}", e);
+                process::exit(1);
+            }
+        });
 
         // Format category is overly accepting by clap (so the user knows what
         // is supported) but this will fail if support is not compiled in and
```

---

### Incident Patch 11: `3e09c235` (2024-08-23)
**Commit Message**: Fix issue #1145 (part 2) (#1148)

**File**: `src/cli.rs` (modified, +2/-2)
```diff
@@ -331,8 +331,8 @@ impl Cli {
     }
 
     pub fn input(&self) -> Vec<&str> {
-        match self.matches.get_many::<&str>("input") {
-            Some(vs) => vs.cloned().collect(),
+        match self.matches.get_many::<String>("input") {
+            Some(vs) => vs.map(|x| x.as_str()).collect(),
             None => vec!["."],
         }
     }
```

---

### Incident Patch 12: `03b0dc56` (2024-08-22)
**Commit Message**: fix: fix issue https://github.com/XAMPPRocky/tokei/issues/1145 (#1146)

Co-authored-by: qtfkwk <[REDACTED_EMAIL]>

**File**: `src/cli.rs` (modified, +3/-3)
```diff
@@ -79,7 +79,7 @@ impl Cli {
                 Arg::new("exclude")
                     .long("exclude")
                     .short('e')
-                    .num_args(0..)
+                    .action(ArgAction::Append)
                     .help("Ignore all files & directories matching the pattern."),
             )
             .arg(
@@ -324,8 +324,8 @@ impl Cli {
 
     pub fn ignored_directories(&self) -> Vec<&str> {
         let mut ignored_directories: Vec<&str> = Vec::new();
-        if let Some(user_ignored) = self.matches.get_many::<&str>("exclude") {
-            ignored_directories.extend(user_ignored);
+        if let Some(user_ignored) = self.matches.get_many::<String>("exclude") {
+            ignored_directories.extend(user_ignored.map(|x| x.as_str()));
         }
         ignored_directories
     }
```

---

### Incident Patch 13: `2645a116` (2024-08-21)
**Commit Message**: Fix issue #1141 (#1142)

**File**: `src/cli.rs` (modified, +0/-2)
```diff
@@ -52,7 +52,6 @@ pub struct Cli {
     pub types: Option<Vec<LanguageType>>,
     pub compact: bool,
     pub number_format: num_format::CustomFormat,
-    pub verbose: u64,
 }
 
 impl Cli {
@@ -312,7 +311,6 @@ impl Cli {
             types,
             compact,
             number_format,
-            verbose,
         };
 
         debug!("CLI Config: {:#?}", cli);
```

**File**: `src/cli_utils.rs` (modified, +0/-4)
```diff
@@ -111,10 +111,6 @@ impl NumberFormatStyle {
         }
     }
 
-    pub fn all() -> &'static [&'static str] {
-        &["commas", "dots", "plain", "underscores"]
-    }
-
     pub fn get_format(self) -> Result<num_format::CustomFormat, num_format::Error> {
         num_format::CustomFormat::builder()
             .grouping(num_format::Grouping::Standard)
```

**File**: `src/consts.rs` (modified, +15/-0)
```diff
@@ -1,12 +1,27 @@
 // Set of common pub consts.
 
+/// Fallback row length
 pub const FALLBACK_ROW_LEN: usize = 81;
 
 // Column widths used for console printing.
+
+/// Language column width
 pub const LANGUAGE_COLUMN_WIDTH: usize = 10;
+
+/// Path column width
 pub const PATH_COLUMN_WIDTH: usize = 80;
+
+/// Files column width
 pub const FILES_COLUMN_WIDTH: usize = 8;
+
+/// Lines column width
 pub const LINES_COLUMN_WIDTH: usize = 12;
+
+/// Code column width
 pub const CODE_COLUMN_WIDTH: usize = 12;
+
+/// Comments column width
 pub const COMMENTS_COLUMN_WIDTH: usize = 12;
+
+/// Blanks column width
 pub const BLANKS_COLUMN_WIDTH: usize = 12;
```

**File**: `src/lib.rs` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ mod stats;
 
 pub use self::{
     config::Config,
+    consts::*,
     language::{Language, LanguageType, Languages},
     sort::Sort,
     stats::{find_char_boundary, CodeStats, Report},
```

**File**: `src/utils/ext.rs` (modified, +0/-5)
```diff
@@ -2,7 +2,6 @@
 
 pub(crate) trait AsciiExt {
     fn is_whitespace(&self) -> bool;
-    fn is_not_line_ending_whitespace(&self) -> bool;
     fn is_line_ending_whitespace(&self) -> bool;
 }
 
@@ -11,10 +10,6 @@ impl AsciiExt for u8 {
         *self == b' ' || (b'\x09'..=b'\x0d').contains(self)
     }
 
-    fn is_not_line_ending_whitespace(&self) -> bool {
-        self.is_whitespace() && !self.is_line_ending_whitespace()
-    }
-
     fn is_line_ending_whitespace(&self) -> bool {
         *self == b'\n'
     }
```

---

### Incident Patch 14: `389ef938` (2024-08-20)
**Commit Message**: fix issue https://github.com/XAMPPRocky/tokei/issues/1138 (#1139)

**File**: `src/cli.rs` (modified, +40/-16)
```diff
@@ -87,6 +87,7 @@ impl Cli {
                 Arg::new("files")
                     .long("files")
                     .short('f')
+                    .action(ArgAction::SetTrue)
                     .help("Will print out statistics on individual files."),
             )
             .arg(
@@ -101,6 +102,7 @@ impl Cli {
             .arg(
                 Arg::new("hidden")
                     .long("hidden")
+                    .action(ArgAction::SetTrue)
                     .help("Count hidden files."),
             )
             .arg(
@@ -113,25 +115,46 @@ impl Cli {
                 Arg::new("languages")
                     .long("languages")
                     .short('l')
+                    .action(ArgAction::SetTrue)
                     .conflicts_with("input")
                     .help("Prints out supported languages and their extensions."),
             )
-            .arg(Arg::new("no_ignore").long("no-ignore").help(
-                "Don't respect ignore files (.gitignore, .ignore, etc.). This implies \
-                --no-ignore-parent, --no-ignore-dot, and --no-ignore-vcs.",
-            ))
-            .arg(Arg::new("no_ignore_parent").long("no-ignore-parent").help(
-                "Don't respect ignore files (.gitignore, .ignore, etc.) in parent \
-                directories.",
-            ))
-            .arg(Arg::new("no_ignore_dot").long("no-ignore-dot").help(
-                "Don't respect .ignore and .tokeignore files, including this in \
-                parent directories.",
-            ))
-            .arg(Arg::new("no_ignore_vcs").long("no-ignore-vcs").help(
-                "Don't respect VCS ignore files (.gitignore, .hgignore, etc.) including \
-                those in parent directories.",
-            ))
+            .arg(Arg::new("no_ignore")
+                .long("no-ignore")
+                .action(ArgAction::SetTrue)
+                .help(
+                    "\
+                        Don't respect ignore files (.gitignore, .ignore, etc.). This implies \
+                        --no-ignore-parent, --no-ignore-dot, and --no-ignore-vcs.\
+                    ",
+                ))
+            .arg(Arg::new("no_ignore_parent")
+                .long("no-ignore-parent")
+                .action(ArgAction::SetTrue)
+                .help(
+                    "\
+                        Don't respect ignore files (.gitignore, .ignore, etc.) in parent \
+                        directories.\
+                    ",
+                ))
+            .arg(Arg::new("no_ignore_dot")
+                .long("no-ignore-dot")
+                .action(ArgAction::SetTrue)
+                .help(
+                    "\
+                        Don't respect .ignore and .tokeignore files, including this in \
+                        parent directories.\
+                    ",
+                ))
+            .arg(Arg::new("no_ignore_vcs")
+                .long("no-ignore-vcs")
+                .action(ArgAction::SetTrue)
+                .help(
+                    "\
+                        Don't respect VCS ignore files (.gitignore, .hgignore, etc.) including \
+                        those in parent directories.\
+                    ",
+                ))
             .arg(
                 Arg::new("output")
                     .long("output")
@@ -190,6 +213,7 @@ impl Cli {
                 Arg::new("compact")
                     .long("compact")
                     .short('C')
+                    .action(ArgAction::SetTrue)
                     .help("Do not print statistics about embedded languages."),
             )
             .arg(
```

---

### Incident Patch 15: `9627a24c` (2024-08-19)
**Commit Message**: Fix cargo audit issues (#1137)

* run cargo outdated and cargo audit

* run cargo upgrade -i && cargo update

* apply fixes due to updating dependencies and running cargo clippy -- -D clippy::all

* clean up; run cargo outdated/audit again; update; build; test

* cargo fmt

---------

Co-authored-by: qtfkwk <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +509/-501)
```diff
@@ -4,9 +4,9 @@ version = 3
 
 [[package]]
 name = "aho-corasick"
-version = "1.0.2"
+version = "1.1.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "43f6cb1bf222025340178f382c426f13757b2960e89779dfcb319c32542a5a41"
+checksum = "8e60d3430d3a69478ad0993f19238d2df97c507009a52b3c10addcd7f6bcb916"
 dependencies = [
  "memchr",
 ]
@@ -27,36 +27,74 @@ dependencies = [
 ]
 
 [[package]]
-name = "arbitrary"
-version = "1.3.0"
+name = "anstream"
+version = "0.6.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e2d098ff73c1ca148721f37baad5ea6a465a13f9573aba8641fbbbae8164a54e"
+checksum = "64e15c1ab1f89faffbf04a634d5e1962e9074f2741eef6d97f3c4e322426d526"
 dependencies = [
- "derive_arbitrary",
+ "anstyle",
+ "anstyle-parse",
+ "anstyle-query",
+ "anstyle-wincon",
+ "colorchoice",
+ "is_terminal_polyfill",
+ "utf8parse",
 ]
 
 [[package]]
-name = "arrayvec"
-version = "0.7.4"
+name = "anstyle"
+version = "1.0.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "96d30a06541fbafbc7f82ed10c06164cfbd2c401138f6addd8404629c4b16711"
+checksum = "1bec1de6f59aedf83baf9ff929c98f2ad654b97c9510f4e70cf6f661d49fd5b1"
 
 [[package]]
-name = "atty"
-version = "0.2.14"
+name = "anstyle-parse"
+version = "0.2.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d9b39be18770d11421cdb1b9947a45dd3f37e93092cbf377614828a319d5fee8"
+checksum = "eb47de1e80c2b463c735db5b217a0ddc39d612e7ac9e2e96a5aed1f57616c1cb"
 dependencies = [
- "hermit-abi 0.1.19",
- "libc",
- "winapi",
+ "utf8parse",
+]
+
+[[package]]
+name = "anstyle-query"
+version = "1.1.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "6d36fc52c7f6c869915e99412912f22093507da8d9e942ceaf66fe4b7c14422a"
+dependencies = [
+ "windows-sys 0.52.0",
+]
+
+[[package]]
+name = "anstyle-wincon"
+version = "3.0.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "5bf74e1b6e971609db8ca7a9ce79fd5768ab6ae46441c572e46cf596f59e57f8"
+dependencies = [
+ "anstyle",
+ "windows-sys 0.52.0",
+]
+
+[[package]]
+name = "arbitrary"
+version = "1.3.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7d5a26814d8dcb93b0e5a0ff3c6d80a8843bafb21b39e8e18a6f05471870e110"
+dependencies = [
+ "derive_arbitrary",
 ]
 
+[[package]]
+name = "arrayvec"
+version = "0.7.6"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7c02d123df017efcdfbd739ef81735b36c5ba83ec3c59c80a9d7ecc718f92e50"
+
 [[package]]
 name = "autocfg"
-version = "1.1.0"
+version = "1.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d468802bab17cbc0cc575e9b053f41e72aa36bfa6b7f55e3529ffa43161b97fa"
+checksum = "0c4b4d0bd25bd0b74681c0ad21497610ce1b7c91b1022cd21c80c6fbdd9476b0"
 
 [[package]]
 name = "bit-set"
@@ -75,15 +113,9 @@ checksum = "349f9b6a179ed607305526ca489b34ad0a41aed5f7980fa90eb03160b69598fb"
 
 [[package]]
 name = "bitflags"
-version = "1.3.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
-
-[[package]]
-name = "bitflags"
-version = "2.3.3"
+version = "2.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "630be753d4e58660abd17930c71b647fe46c27ea6b63cc59e1e3851406972e42"
+checksum = "b048fb63fd8b5923fc5aa7b340d8e156aec7ec02f0c78fa8a6ddc2613f6f71de"
 
 [[package]]
 name = "block-buffer"
@@ -96,40 +128,35 @@ dependencies = [
 
 [[package]]
 name = "bstr"
-version = "1.6.0"
+version = "1.10.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6798148dccfbff0fae41c7574d2fa8f1ef3492fba0face179de5d8d447d67b05"
+checksum = "40723b8fb387abc38f4f4a37c09073622e41dd12327033091ef8950659e6dc0c"
 dependencies = [
  "memchr",
  "serde",
 ]
 
 [[package]]
 name = "bumpalo"
-version = "3.13.0"
+version = "3.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a3e2c3daef883ecc1b5d58c15adae93470a91d425f3532ba1695849656af3fc1"
-
-[[package]]
-name = "bytecount"
-version = "0.6.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2c676a478f63e9fa2dd5368a42f28bba0d6c560b775f38583c8bbaa7fcd67c9c"
+checksum = "79296716171880943b8470b5f8d03aa55eb2e645a4874bdbb28adb49162e012c"
 
 [[package]]
 name = "byteorder"
-version = "1.4.3"
+version = "1.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "14c189c53d098945499cdfa7ecc63567cf3886b3332b312a5b4585d8d3a6a610"
+checksum = "1fd0f2584146f6f2ef48085050886acf353beff7305ebd1ae69500e27c67f64b"
 
 [[package]]
 name = "cc"
-version = "1.0.81"
+version = "1.1.13"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6c6b2562119bf28c3439f7f02db99faf0aa1a8cdfe5772a2ee155d32227239f0"
+checksum = "72db2f7947ecee9b03b510377e8bb9077afa27176fdbff55c51027e976fdcc48"
 dependencies = [
  "jobserver
```

**File**: `Cargo.toml` (modified, +26/-26)
```diff
@@ -32,37 +32,37 @@ lto = "thin"
 panic = "abort"
 
 [build-dependencies]
-tera = "1.19.0"
-ignore = "0.4.20"
-serde_json = "1.0.104"
+tera = "1.20.0"
+ignore = "0.4.22"
+serde_json = "1.0.125"
 json5 = "0.4.1"
 
 [dependencies]
-aho-corasick = "1.0.2"
-arbitrary = { version = "1.3.0", features = ["derive"] }
-clap = { version = "3", features = ["cargo", "wrap_help"] }
-colored = "2.0.4"
-crossbeam-channel = "0.5.8"
+aho-corasick = "1.1.3"
+arbitrary = { version = "1.3.2", features = ["derive"] }
+clap = { version = "4", features = ["cargo", "string", "wrap_help"] }
+colored = "2.1.0"
+crossbeam-channel = "0.5.13"
 encoding_rs_io = "0.1.7"
-grep-searcher = "0.1.11"
-ignore = "0.4.20"
-log = "0.4.19"
-rayon = "1.7.0"
-serde = { version = "1.0.180", features = ["derive", "rc"] }
+grep-searcher = "0.1.13"
+ignore = "0.4.22"
+log = "0.4.22"
+rayon = "1.10.0"
+serde = { version = "1.0.208", features = ["derive", "rc"] }
 term_size = "0.3.2"
-toml = "0.7.6"
-parking_lot = "0.12.1"
-dashmap = { version = "5.5.0", features = ["serde"] }
+toml = "0.8.19"
+parking_lot = "0.12.3"
+dashmap = { version = "6.0.1", features = ["serde"] }
 num-format = "0.4.4"
-once_cell = "1.18.0"
-regex = "1.9.1"
-serde_json = "1.0.104"
+once_cell = "1.19.0"
+regex = "1.10.6"
+serde_json = "1.0.125"
 etcetera = "0.8.0"
 table_formatter = "0.6.1"
 
 [dependencies.env_logger]
 features = []
-version = "0.10.0"
+version = "0.11.5"
 
 [dependencies.hex]
 optional = true
@@ -74,11 +74,11 @@ version = "0.11.2"
 
 [dependencies.serde_yaml]
 optional = true
-version = "0.9.25"
+version = "0.9.34"
 
 [dev-dependencies]
-proptest = "1.2.0"
-strum = "0.25.0"
-strum_macros = "0.25.1"
-tempfile = "3.7.0"
-git2 = { version = "0.17.2", default-features = false, features = [] }
+proptest = "1.5.0"
+strum = "0.26.3"
+strum_macros = "0.26.4"
+tempfile = "3.12.0"
+git2 = { version = "0.19.0", default-features = false, features = [] }
```

**File**: `build.rs` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 extern crate ignore;
-extern crate serde_json;
 extern crate json5;
+extern crate serde_json;
 
 use std::ffi::OsStr;
 use std::fs;
```

**File**: `src/cli.rs` (modified, +59/-53)
```diff
@@ -1,8 +1,6 @@
-use std::mem;
 use std::process;
 
-use clap::Arg;
-use clap::{crate_description, ArgMatches};
+use clap::{crate_description, value_parser, Arg, ArgAction, ArgMatches};
 use colored::Colorize;
 use tokei::{Config, LanguageType, Sort};
 
@@ -59,8 +57,8 @@ pub struct Cli {
 
 impl Cli {
     pub fn from_args() -> Self {
-        let matches = clap::App::new("tokei")
-            .version(&*crate_version())
+        let matches = clap::Command::new("tokei")
+            .version(crate_version())
             .author("Erin P. <xampprocky@gmail.com> + Contributors")
             .about(concat!(
                 crate_description!(),
@@ -71,7 +69,7 @@ impl Cli {
                 Arg::new("columns")
                     .long("columns")
                     .short('c')
-                    .takes_value(true)
+                    .value_parser(value_parser!(usize))
                     .conflicts_with("output")
                     .help(
                         "Sets a strict column width of the output, only available for \
@@ -82,8 +80,7 @@ impl Cli {
                 Arg::new("exclude")
                     .long("exclude")
                     .short('e')
-                    .takes_value(true)
-                    .multiple_values(true)
+                    .num_args(0..)
                     .help("Ignore all files & directories matching the pattern."),
             )
             .arg(
@@ -96,7 +93,6 @@ impl Cli {
                 Arg::new("file_input")
                     .long("input")
                     .short('i')
-                    .takes_value(true)
                     .help(
                         "Gives statistics from a previous tokei run. Can be given a file path, \
                         or \"stdin\" to read from stdin.",
@@ -109,7 +105,7 @@ impl Cli {
             )
             .arg(
                 Arg::new("input")
-                    .min_values(1)
+                    .num_args(1..)
                     .conflicts_with("languages")
                     .help("The path(s) to the file or directory to be counted.(default current directory)"),
             )
@@ -140,8 +136,13 @@ impl Cli {
                 Arg::new("output")
                     .long("output")
                     .short('o')
-                    .takes_value(true)
-                    .possible_values(Format::all())
+                    .value_parser(|x: &str| {
+                        if Format::all().contains(&x) {
+                            Ok(x.to_string())
+                        } else {
+                            Err(format!("Invalid output format: {x:?}"))
+                        }
+                    })
                     .help(
                         "Outputs Tokei in a specific format. Compile with additional features for \
                         more format support.",
@@ -150,8 +151,7 @@ impl Cli {
             .arg(
                 Arg::new("streaming")
                     .long("streaming")
-                    .takes_value(true)
-                    .possible_values(["simple", "json"])
+                    .value_parser(["simple", "json"])
                     .ignore_case(true)
                     .help(
                         "prints the (language, path, lines, blanks, code, comments) records as \
@@ -162,8 +162,7 @@ impl Cli {
                 Arg::new("sort")
                     .long("sort")
                     .short('s')
-                    .takes_value(true)
-                    .possible_values(["files", "lines", "blanks", "code", "comments"])
+                    .value_parser(["files", "lines", "blanks", "code", "comments"])
                     .ignore_case(true)
                     .conflicts_with("rsort")
                     .help("Sort languages based on column"),
@@ -172,8 +171,7 @@ impl Cli {
                 Arg::new("rsort")
                     .long("rsort")
                     .short('r')
-                    .takes_value(true)
-                    .possible_values(["files", "lines", "blanks", "code", "comments"])
+                    .value_parser(["files", "lines", "blanks", "code", "comments"])
                     .ignore_case(true)
                     .conflicts_with("sort")
                     .help("Reverse sort languages based on column"),
@@ -182,7 +180,7 @@ impl Cli {
                 Arg::new("types")
                     .long("types")
                     .short('t')
-                    .takes_value(true)
+                    .action(ArgAction::Append)
                     .help(
                         "Filters output by language type, separated by a comma. i.e. \
                         -t=Rust,Markdown",
@@ -198,8 +196,7 @@ impl Cli {
                 Arg::new("num_format_style")
                     .long("num-format")
                     .short('n')
-                    .takes_value(true)
-                    .possible_values(NumberFormatStyle::all())
+                    .value_parser(["commas", "dots", "plain",
```

**File**: `src/cli_utils.rs` (modified, +1/-2)
```diff
@@ -348,8 +348,7 @@ impl<W: Write> Printer<W> {
 
                 if self.list_files {
                     self.print_subrow()?;
-                    let mut reports: Vec<&Report> =
-                        language.reports.iter().map(|report| &*report).collect();
+                    let mut reports: Vec<&Report> = language.reports.iter().collect();
                     if !is_sorted {
                         reports.sort_by(|&a, &b| a.name.cmp(&b.name));
                     }
```

**File**: `src/config.rs` (modified, +0/-1)
```diff
@@ -135,7 +135,6 @@ impl Config {
             no_ignore_vcs: current_dir
                 .no_ignore_vcs
                 .or(home_dir.no_ignore_vcs.or(conf_dir.no_ignore_vcs)),
-            ..Self::default()
         }
     }
 }
```

**File**: `src/input.rs` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ macro_rules! supported_formats {
         ///
         /// To enable all formats compile with the `all` feature.
         #[cfg_attr(test, derive(strum_macros::EnumIter))]
-        #[derive(Debug)]
+        #[derive(Debug, Clone)]
         pub enum Format {
             Json,
             $(
```

**File**: `src/language/embedding.rs` (modified, +11/-5)
```diff
@@ -79,7 +79,6 @@ pub(crate) struct SimpleCapture<'a> {
     starts: Option<Box<[Capture<'a>]>>,
 }
 
-
 impl<'a> HtmlLike<'a> {
     pub fn start_script_in_range(
         &'a self,
@@ -111,7 +110,12 @@ impl<'a> SimpleCapture<'a> {
         filter_range(self.starts.as_ref()?, start, end).and_then(|mut it| it.next())
     }
 
-    fn make_capture(regex: &Regex, lines: &'a [u8], start: usize, end: usize) -> Option<SimpleCapture<'a>> {
+    fn make_capture(
+        regex: &Regex,
+        lines: &'a [u8],
+        start: usize,
+        end: usize,
+    ) -> Option<SimpleCapture<'a>> {
         let capture = SimpleCapture {
             starts: save_captures(regex, lines, start, end),
         };
@@ -156,12 +160,14 @@ impl<'a> RegexCache<'a> {
     pub(crate) fn build(lang: LanguageType, lines: &'a [u8], start: usize, end: usize) -> Self {
         let inner = match lang {
             LanguageType::Markdown | LanguageType::UnrealDeveloperMarkdown => {
-                SimpleCapture::make_capture(&STARTING_MARKDOWN_REGEX, lines, start, end).map(RegexFamily::Markdown)
+                SimpleCapture::make_capture(&STARTING_MARKDOWN_REGEX, lines, start, end)
+                    .map(RegexFamily::Markdown)
             }
             LanguageType::Rust => Some(RegexFamily::Rust),
             LanguageType::LinguaFranca => {
-                SimpleCapture::make_capture(&STARTING_LF_BLOCK_REGEX, lines, start, end).map(RegexFamily::LinguaFranca)
-            },
+                SimpleCapture::make_capture(&STARTING_LF_BLOCK_REGEX, lines, start, end)
+                    .map(RegexFamily::LinguaFranca)
+            }
             LanguageType::Html
             | LanguageType::RubyHtml
             | LanguageType::Svelte
```

#### Recent Merged Pull Requests:
- **PR #1361** (closed): README: fix option documentation (@Managor)
- **PR #1353** (2026-05-06): Add Laravel Blade language support (@benfaerber)
- **PR #1346** (2026-09-06): Bump toml from 0.8 to 0.9 (@glamberson)
- **PR #1336** (2026-09-06): Update strum/strum_macros to 0.28.0 (@musicinmybrain)
- **PR #1333** (closed): add .github/workflows/release_artifacts.yml for prebuild binaries in release page (@stevenleeS0ht)
- **PR #1324** (2026-09-06): Add support for Godot TextScene(tscn) (@wrn4)
- **PR #1321** (2026-01-25): Add Djot language support in languages.json (@kevinschweikert)
- **PR #1319** (2026-01-25): Added C3 programming language. (@stpettersens)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
