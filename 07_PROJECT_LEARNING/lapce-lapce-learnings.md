# Forensic Learning Record (Deep Inspection): lapce/lapce

> **Canonical Artifact**: `07_PROJECT_LEARNING/lapce-lapce-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lapce/lapce](https://github.com/lapce/lapce))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:14:10.952Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lapce/lapce`
- **Description**: Lightning-fast and Powerful Code Editor written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 38897 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lapce-app/src/config/core.rs`
```
use serde::{Deserialize, Serialize};
use structdesc::FieldNames;

#[derive(FieldNames, Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "kebab-case")]
pub struct CoreConfig {
    #[field_names(desc = "Enable modal editing (Vim like)")]
    pub modal: bool,
    #[field_names(desc = "Set the color theme of Lapce")]
    pub color_theme: String,
    #[field_names(desc = "Set the icon theme of Lapce")]
    pub icon_theme: String,
    #[field_names(
        desc = "Enable customised titlebar and disable OS native one (Linux, BSD, Windows)"
    )]
    pub custom_titlebar: bool,
    #[field_names(
        desc = "Only allow double-click to open files in the file explorer"
    )]
    pub file_explorer_double_click: bool,
    #[field_names(
        desc = "Enable auto-reload for the plugin when its configuration changes."
    )]
    pub auto_reload_plugin: bool,
}

```

### Core Architecture Module: `lapce-core/src/directory.rs`
```
use std::path::PathBuf;

use directories::{BaseDirs, ProjectDirs};

use crate::meta::NAME;

pub struct Directory {}

impl Directory {
    pub fn home_dir() -> Option<PathBuf> {
        BaseDirs::new().map(|d| PathBuf::from(d.home_dir()))
    }

    #[cfg(not(feature = "portable"))]
    fn project_dirs() -> Option<ProjectDirs> {
        ProjectDirs::from("dev", "lapce", NAME)
    }

    /// Return path adjacent to lapce executable when built as portable
    #[cfg(feature = "portable")]
    fn project_dirs() -> Option<ProjectDirs> {
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(parent) = current_exe.parent() {
                return ProjectDirs::from_path(parent.join("lapce-data"));
            }
            unreachable!("Couldn't obtain current process parent path");
        }
        unreachable!("Couldn't obtain current process path");
    }

    // Get path of local data directory
    // Local data directory differs from data directory
    // on some platforms and is not transferred across
    // machines
    pub fn data_local_directory() -> Option<PathBuf> {
        match Self::project_dirs() {
            Some(dir) => {
                let dir = dir.data_local_dir();
                if !dir.exists() {
                    if let Err(err) = std::fs::create_dir_all(dir) {
                        tracing::error!("{:?}", err);
                    }
                }
                Some(dir.to_path_buf())
            }
            None => None,
        }
    }

    /// Get the path to logs directory
    /// Each log file is for individual application startup
    pub fn logs_directory() -> Option<PathBuf> {
        if let Some(dir) = Self::data_local_directory() {
            let dir = dir.join("logs");
            if !dir.exists() {
                if let Err(err) = std::fs::create_dir(&dir) {
                    tracing::error!("{:?}", err);
                }
            }
            Some(dir)
        } else {
            None
        }
    }

    /// Get the path to cache directory
    pub fn cache_directory() -> Option<PathBuf> {
        if let Some(dir) = Self::data_local_directory() {
            let dir = dir.join("cache");
            if !dir.exists() {
                if let Err(err) = std::fs::create_dir(&dir) {
                    tracing::error!("{:?}", err);
                }
            }
            Some(dir)
        } else {
            None
        }
    }

    /// Directory to store proxy executables used on local
    /// host as well, as ones uploaded to remote host when
    /// connecting
    pub fn proxy_directory() -> Option<PathBuf> {
        if let Some(dir) = Self::data_local_directory() {
            let dir = dir.join("proxy");
            if !dir.exists() {
                if let Err(err) = std::fs::create_dir(&dir) {
                    tracing::error!("{:?}", err);
                }
            }
            Some(dir)
        } else {
            None
        }
    }
    /// Get the path to the themes folder
    /// Themes are stored within as individual toml files
    pub fn themes_directory() -> Option<PathBuf> {
        if let Some(dir) = Self::data_local_directory() {
            let dir = dir.join("themes");
            if !dir.exists() {
                if let Err(err) = std::fs::create_dir(&dir) {
                    tracing::error!("{:?}", err);
                }
            }
            Some(dir)
        } else {
            None
        }
    }
    // Get the path to plugins directory
    // Each plugin has own directory that contains
    // metadata file and plugin wasm
    pub fn plugins_directory() -> Option<PathBuf> {
        if let Some(dir) = Self::data_local_directory() {
            let dir = dir.join("plugins");
            if !dir.exists() {
                if let Err(err) = std::fs::create_dir(&dir) {
                    tracing::error!("{:?}", err);
                }
            }
            Some(dir)
        } else {
            None
        }
    }

    // Config directory contain only configuration files
    pub fn config_directory() -> Option<PathBuf> {
        match Self::project_dirs() {
            Some(dir) => {
                let dir = dir.config_dir();
                if !dir.exists() {
                    if let Err(err) = std::fs::create_dir_all(dir) {
                        tracing::error!("{:?}", err);
                    }
                }
                Some(dir.to_path_buf())
            }
            None => None,
        }
    }

    pub fn local_socket() -> Option<PathBuf> {
        Self::data_local_directory().map(|dir| dir.join("local.sock"))
    }

    pub fn updates_directory() -> Option<PathBuf> {
        if let Some(dir) = Self::data_local_directory() {
            let dir = dir.join("updates");
            if !dir.exists() {
                if let Err(err) = std::fs::create_dir(&dir) {
                    tracing::error!("{:?}", err);
                }
            }
            Some(dir)
        } else {
            None
        }
    }

    pub fn queries_directory() -> Option<PathBuf> {
        if let Some(dir) = Self::config_directory() {
            let dir = dir.join("queries");
            if !dir.exists() {
                if let Err(err) = std::fs::create_dir(&dir) {
                    tracing::error!("{:?}", err);
                }
            }

            Some(dir)
        } else {
            None
        }
    }

    pub fn grammars_directory() -> Option<PathBuf> {
        if let Some(dir) = Self::data_local_directory() {
            let dir = dir.join("grammars");
            if !dir.exists() {
                if let Err(err) = std::fs::create_dir(&dir) {
                    tracing::error!("{:?}", err);
                }
            }

            Some(dir)
        } else {
            None
        }
    }
}

```

### Core Architecture Module: `lapce-core/src/encoding.rs`
```
/// Convert a utf8 offset into a utf16 offset, if possible  
/// `text` is what the offsets are into
pub fn offset_utf8_to_utf16(
    char_indices: impl Iterator<Item = (usize, char)>,
    offset: usize,
) -> usize {
    if offset == 0 {
        return 0;
    }

    let mut utf16_offset = 0;
    let mut last_ich = None;
    for (utf8_offset, ch) in char_indices {
        last_ich = Some((utf8_offset, ch));

        match utf8_offset.cmp(&offset) {
            std::cmp::Ordering::Less => {}
            // We found the right offset
            std::cmp::Ordering::Equal => {
                return utf16_offset;
            }
            // Implies that the offset was inside of a character
            std::cmp::Ordering::Greater => return utf16_offset,
        }

        utf16_offset += ch.len_utf16();
    }

    // TODO: We could use TrustedLen when that is stabilized and it is impl'd on
    // the iterators we use

    // We did not find the offset. This means that it is either at the end
    // or past the end.
    let text_len = last_ich.map(|(i, c)| i + c.len_utf8());
    if text_len == Some(offset) {
        // Since the utf16 offset was being incremented each time, by now it is equivalent to the length
        // but in utf16 characters
        return utf16_offset;
    }

    utf16_offset
}

pub fn offset_utf8_to_utf16_str(text: &str, offset: usize) -> usize {
    offset_utf8_to_utf16(text.char_indices(), offset)
}

/// Convert a utf16 offset into a utf8 offset, if possible  
/// `char_indices` is an iterator over utf8 offsets and the characters
/// It is cloneable so that it can be iterated multiple times. Though it should be cheaply cloneable.
pub fn offset_utf16_to_utf8(
    char_indices: impl Iterator<Item = (usize, char)>,
    offset: usize,
) -> usize {
    if offset == 0 {
        return 0;
    }

    // We accumulate the utf16 char lens until we find the utf8 offset that matches it
    // or, we find out that it went into the middle of sometext
    // We also keep track of the last offset and char in order to calculate the length of the text
    // if we the index was at the end of the string
    let mut utf16_offset = 0;
    let mut last_ich = None;
    for (utf8_offset, ch) in char_indices {
        last_ich = Some((utf8_offset, ch));

        let ch_utf16_len = ch.len_utf16();

        match utf16_offset.cmp(&offset) {
            std::cmp::Ordering::Less => {}
            // We found the right offset
            std::cmp::Ordering::Equal => {
                return utf8_offset;
            }
            // This implies that the offset was in the middle of a character as we skipped over it
            std::cmp::Ordering::Greater => return utf8_offset,
        }

        utf16_offset += ch_utf16_len;
    }

    // We did not find the offset, this means that it was either at the end
    // or past the end
    // Since we've iterated over all the char indices, the utf16_offset is now the
    // utf16 length
    if let Some((last_utf8_offset, last_ch)) = last_ich {
        last_utf8_offset + last_ch.len_utf8()
    } else {
        0
    }
}

pub fn offset_utf16_to_utf8_str(text: &str, offset: usize) -> usize {
    offset_utf16_to_utf8(text.char_indices(), offset)
}

#[cfg(test)]
mod tests {
    // TODO: more tests with unicode characters

    use crate::encoding::{offset_utf8_to_utf16_str, offset_utf16_to_utf8_str};

    #[test]
    fn utf8_to_utf16() {
        let text = "hello world";

        assert_eq!(offset_utf8_to_utf16_str(text, 0), 0);
        assert_eq!(offset_utf8_to_utf16_str("", 0), 0);

        assert_eq!(offset_utf8_to_utf16_str("", 1), 0);

        assert_eq!(offset_utf8_to_utf16_str("h", 0), 0);
        assert_eq!(offset_utf8_to_utf16_str("h", 1), 1);

        assert_eq!(offset_utf8_to_utf16_str(text, text.len()), text.len());

        assert_eq!(
            offset_utf8_to_utf16_str(text, text.len() - 1),
            text.len() - 1
        );

        assert_eq!(offset_utf8_to_utf16_str(text, text.len() + 1), text.len());

        assert_eq!(offset_utf8_to_utf16_str("×", 0), 0);
        assert_eq!(offset_utf8_to_utf16_str("×", 1), 1);
        assert_eq!(offset_utf8_to_utf16_str("×", 2), 1);
        assert_eq!(offset_utf8_to_utf16_str("a×", 0), 0);
        assert_eq!(offset_utf8_to_utf16_str("a×", 1), 1);
        assert_eq!(offset_utf8_to_utf16_str("a×", 2), 2);
        assert_eq!(offset_utf8_to_utf16_str("a×", 3), 2);
    }

    #[test]
    fn utf16_to_utf8() {
        let text = "hello world";

        assert_eq!(offset_utf16_to_utf8_str(text, 0), 0);
        assert_eq!(offset_utf16_to_utf8_str("", 0), 0);

        assert_eq!(offset_utf16_to_utf8_str("", 1), 0);

        assert_eq!(offset_utf16_to_utf8_str("h", 0), 0);
        assert_eq!(offset_utf16_to_utf8_str("h", 1), 1);

        assert_eq!(offset_utf16_to_utf8_str(text, text.len()), text.len());

        assert_eq!(
            offset_utf16_to_utf8_str(text, text.len() - 1),
            text.len() - 1
        );

        assert_eq!(offset_utf16_to_utf8_str(text, text.len() + 1), text.len());

        assert_eq!(offset_utf16_to_utf8_str("×", 0), 0);
        assert_eq!(offset_utf16_to_utf8_str("×", 1), 2);
        assert_eq!(offset_utf16_to_utf8_str("a×", 0), 0);
        assert_eq!(offset_utf16_to_utf8_str("a×", 1), 1);
        assert_eq!(offset_utf16_to_utf8_str("a×", 2), 3);
        assert_eq!(offset_utf16_to_utf8_str("×a", 1), 2);
        assert_eq!(offset_utf16_to_utf8_str("×a", 2), 3);
    }
}

```

### Core Architecture Module: `lapce-core/src/language.rs`
```
use std::{
    collections::{HashMap, HashSet, hash_map::Entry},
    fmt::Write,
    path::Path,
    str::FromStr,
};

use lapce_rpc::style::{LineStyle, Style};
use once_cell::sync::Lazy;
use regex::Regex;
use strum_macros::{AsRefStr, Display, EnumMessage, EnumString, IntoStaticStr};
use tracing::{Level, event};
use tree_sitter::{Point, TreeCursor};

use crate::{
    directory::Directory,
    syntax::highlight::{HighlightConfiguration, HighlightIssue},
};

#[remain::sorted]
pub enum Indent {
    Space(u8),
    Tab,
}

impl Indent {
    const fn tab() -> &'static str {
        Indent::Tab.as_str()
    }

    const fn space(count: u8) -> &'static str {
        Indent::Space(count).as_str()
    }

    const fn as_str(&self) -> &'static str {
        match self {
            Indent::Tab => "\u{0009}",
            #[allow(clippy::wildcard_in_or_patterns)]
            Indent::Space(v) => match v {
                2 => "\u{0020}\u{0020}",
                4 => "\u{0020}\u{0020}\u{0020}\u{0020}",
                8 | _ => {
                    "\u{0020}\u{0020}\u{0020}\u{0020}\u{0020}\u{0020}\u{0020}\u{0020}"
                }
            },
        }
    }
}

const DEFAULT_CODE_GLANCE_LIST: &[&str] = &["source_file"];
const DEFAULT_CODE_GLANCE_IGNORE_LIST: &[&str] = &["source_file"];

#[macro_export]
macro_rules! comment_properties {
    () => {
        CommentProperties {
            single_line_start: None,
            single_line_end: None,

            multi_line_start: None,
            multi_line_end: None,
            multi_line_prefix: None,
        }
    };
    ($s:expr) => {
        CommentProperties {
            single_line_start: Some($s),
            single_line_end: None,

            multi_line_start: None,
            multi_line_end: None,
            multi_line_prefix: None,
        }
    };
    ($s:expr, $e:expr) => {
        CommentProperties {
            single_line_start: Some($s),
            single_line_end: Some($e),

            multi_line_start: None,
            multi_line_end: None,
            multi_line_prefix: None,
        }
    };
    ($sl_s:expr, $sl_e:expr, $ml_s:expr, $ml_e:expr) => {
        CommentProperties {
            single_line_start: Some($sl_s),
            single_line_end: Some($sl_e),

            multi_line_start: Some($sl_s),
            multi_line_end: None,
            multi_line_prefix: Some($sl_e),
        }
    };
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug, PartialOrd, Ord, Default)]
pub struct SyntaxProperties {
    /// An extra check to make sure that the array elements are in the correct order.  
    /// If this id does not match the enum value, a panic will happen with a debug assertion message.
    id: LapceLanguage,

    /// All tokens that can be used for comments in language
    comment: CommentProperties,
    /// The indent unit.  
    /// "  " for bash, "    " for rust, for example.
    indent: &'static str,
    /// Filenames that belong to this language  
    /// `["Dockerfile"]` for Dockerfile, `[".editorconfig"]` for EditorConfig
    files: &'static [&'static str],
    /// File name extensions to determine the language.  
    /// `["py"]` for python, `["rs"]` for rust, for example.
    extensions: &'static [&'static str],
    /// Tree-sitter properties
    tree_sitter: TreeSitterProperties,
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug, PartialOrd, Ord, Default)]
struct TreeSitterProperties {
    /// the grammar name that's in the grammars folder
    grammar: Option<&'static str>,
    /// the grammar fn name
    grammar_fn: Option<&'static str>,
    /// the query folder name
    query: Option<&'static str>,
    /// Preface: Originally this feature was called "Code Lens", which is not
    /// an LSP "Code Lens". It is renamed to "Code Glance", below doc text is
    /// left unchanged.  
    ///
    /// Lists of tree-sitter node types that control how code lenses are built.
    /// The first is a list of nodes that should be traversed and included in
    /// the lens, along with their children. The second is a list of nodes that
    /// should be excluded from the lens, though they will still be traversed.
    /// See `walk_tree` for more details.
    ///
    /// The tree-sitter playground may be useful when creating these lists:
    /// https://tree-sitter.github.io/tree-sitter/playground
    ///
    /// If unsure, use `DEFAULT_CODE_GLANCE_LIST` and
    /// `DEFAULT_CODE_GLANCE_IGNORE_LIST`.
    code_glance: (&'static [&'static str], &'static [&'static str]),
    /// the tree-sitter tag names that can be put in sticky headers
    sticky_headers: &'static [&'static str],
}

impl TreeSitterProperties {
    const DEFAULT: Self = Self {
        grammar: None,
        grammar_fn: None,
        query: None,
        code_glance: (DEFAULT_CODE_GLANCE_LIST, DEFAULT_CODE_GLANCE_IGNORE_LIST),
        sticky_headers: &[],
    };
}

#[derive(Eq, PartialEq, Hash, Clone, Copy, Debug, PartialOrd, Ord, Default)]
struct CommentProperties {
    /// Single line comment token used when commenting out one line.
    /// "#" for python, "//" for rust for example.
    single_line_start: Option<&'static str>,
    single_line_end: Option<&'static str>,

    /// Multi line comment token used when commenting a selection of lines.
    /// "#" for python, "//" for rust for example.
    multi_line_start: Option<&'static str>,
    multi_line_end: Option<&'static str>,
    multi_line_prefix: Option<&'static str>,
}

/// NOTE: Keep the enum variants "fieldless" so they can cast to usize as array
/// indices into the LANGUAGES array.  See method `LapceLanguage::properties`.
///
/// Do not assign values to the variants because the number of variants and
/// number of elements in the LANGUAGES array change as different features
/// selected by the cargo build command.
#[derive(
    Eq,
    PartialEq,
    Ord,
    PartialOrd,
    Hash,
    Clone,
    Copy,
    Debug,
    Display,
    AsRefStr,
    IntoStaticStr,
    EnumString,
    EnumMessage,
    Default,
)]
#[strum(ascii_case_insensitive)]
#[remain::sorted]
pub enum LapceLanguage {
    // Do not move
    #[remain::unsorted]
    #[default]
    #[strum(message = "Plain Text")]
    PlainText,

    #[strum(message = "Ada")]
    Ada,
    #[strum(message = "Adl")]
    Adl,
    #[strum(message = "Agda")]
    Agda,
    #[strum(message = "Astro")]
    Astro,
    #[strum(message = "Bash")]
    Bash,
    #[strum(message = "Bass")]
    Bass,
    #[strum(message = "Beancount")]
    Beancount,
    #[strum(message = "Bibtex")]
    Bibtex,
    #[strum(message = "Bitbake")]
    Bitbake,
    #[strum(message = "Blade")]
    Blade,
    #[strum(message = "C")]
    C,
    #[strum(message = "Clojure")]
    Clojure,
    #[strum(message = "CMake")]
    Cmake,
    #[strum(message = "Comment")]
    Comment,
    #[strum(message = "C++")]
    Cpp,
    #[strum(message = "C#")]
    Csharp,
    #[strum(message = "CSS")]
    Css,
    #[strum(message = "Cue")]
    Cue,
    #[strum(message = "D")]
    D,
    #[strum(message = "Dart")]
    Dart,
    #[strum(message = "Dhall")]
    Dhall,
    #[strum(message = "Diff")]
    Diff,
    #[strum(message = "Dockerfile")]
    Dockerfile,
    #[strum(message = "Dot")]
    Dot,
    #[strum(message = "Elixir")]
    Elixir,
    #[strum(message = "Elm")]
    Elm,
    #[strum(message = "Erlang")]
    Erlang,
    #[strum(message = "Fish Shell")]
    Fish,
    #[strum(message = "Fluent")]
    Fluent,
    #[strum(message = "Forth")]
    Forth,
    #[strum(message = "Fortran")]
    Fortran,
    #[strum(message = "F#")]
    FSharp,
    #[strum(message = "Gitattributes")]
    Gitattributes,
    #[strum(message = "Git (commit)")]
    GitCommit,
    #[strum(message = "Git (config)")]
    GitConfig,
    #[strum(message = "Git (rebase)")]
    GitRebase,
    #[strum(message = "Gleam")]
    Gleam,
    #[strum(message = "Glimmer")]
    Glimmer,
    #[strum(message = "GLSL")]
    Glsl,
    #[strum(message = "Gn")]
    Gn,
    #[strum(message = "Go")]
    Go,
    #[strum(message = "Go (go.mod)")]
    GoMod,
    #[strum(message = "Go (template)")]
    GoTemplate,
    #[strum(message = "Go (go.work)")]
    GoWork,
    #[strum(message = "GraphQL")]
    GraphQl,
    #[strum(message = "Groovy")]
    Groovy,
    #[strum(message = "Hare")]
    Hare,
    #[strum(message = "Haskell")]
    Haskell,
    #[strum(message = "Haxe")]
    Haxe,
    #[strum(message = "HCL")]
    Hcl,
    #[strum(message = "Hosts file (/etc/hosts)")]
    Hosts,
    #[strum(message = "HTML")]
    Html,
    #[strum(message = "INI")]
    Ini,
    #[strum(message = "Java")]
    Java,
    #[strum(message = "JavaScript")]
    Javascript,
    #[strum(message = "JSDoc")]
    Jsdoc,
    #[strum(message = "JSON")]
    Json,
    #[strum(message = "JSON5")]
    Json5,
    #[strum(message = "Jsonnet")]
    Jsonnet,
    #[strum(message = "JavaScript React")]
    Jsx,
    #[strum(message = "Julia")]
    Julia,
    #[strum(message = "Just")]
    Just,
    #[strum(message = "KDL")]
    Kdl,
    #[strum(message = "Kotlin")]
    Kotlin,
    #[strum(message = "Kotlin Build Script")]
    KotlinBuildScript,
    #[strum(message = "LaTeX")]
    Latex,
    #[strum(message = "Linker Script")]
    Ld,
    #[strum(message = "LLVM")]
    Llvm,
    #[strum(message = "LLVM MIR")]
    LlvmMir,
    #[strum(message = "Log")]
    Log,
    #[strum(message = "Lua")]
    Lua,
    #[strum(message = "Makefile")]
    Make,
    #[strum(message = "Markdown")]
    Markdown,
    #[strum(serialize = "markdown.inline")]
    MarkdownInline,
    #[strum(message = "Meson")]
    Meson,
    #[strum(message = "NASM")]
    Nasm,
    #[strum(message = "Nix")]
    Nix,
    #[strum(message = "Nu (nushell)")]
    Nushell,
    #[strum(message = "Ocaml")]
    Ocaml,
    #[strum(serialize = "ocaml.interface")]
    OcamlInterface,
    #[strum(message = "Odin")]
    Odin,
    #[strum(message = "OpenCL")]
    OpenCl,
    #[strum(message = "Pascal")]
    Pascal,
    #[strum(message = "Password file (/etc/passwd)")]
    Passwd,
    #
```

### Core Architecture Module: `lapce-core/src/lens.rs`
```
use std::mem;

use lapce_xi_rope::{
    Cursor, Delta, Interval, Metric,
    interval::IntervalBounds,
    tree::{DefaultMetric, Leaf, Node, NodeInfo, TreeBuilder},
};

const MIN_LEAF: usize = 5;
const MAX_LEAF: usize = 10;

pub type LensNode = Node<LensInfo>;

#[derive(Clone)]
pub struct Lens(LensNode);

#[derive(Clone, Debug)]
pub struct LensInfo(usize);

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LensData {
    len: usize,
    line_height: usize,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LensLeaf {
    len: usize,
    data: Vec<LensData>,
    total_height: usize,
}

pub struct LensIter<'a> {
    cursor: Cursor<'a, LensInfo>,
    end: usize,
}

impl Lens {
    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn line_of_height(&self, height: usize) -> usize {
        let max_height = self.0.count::<LensMetric>(self.0.len());
        if height >= max_height {
            return self.0.len();
        }
        self.0.count_base_units::<LensMetric>(height)
    }

    pub fn height_of_line(&self, line: usize) -> usize {
        let line = self.0.len().min(line);
        self.0.count::<LensMetric>(line)
    }

    pub fn iter(&self) -> LensIter<'_> {
        LensIter {
            cursor: Cursor::new(&self.0, 0),
            end: self.len(),
        }
    }

    pub fn iter_chunks<I: IntervalBounds>(&self, range: I) -> LensIter<'_> {
        let Interval { start, end } = range.into_interval(self.len());

        LensIter {
            cursor: Cursor::new(&self.0, start),
            end,
        }
    }

    pub fn apply_delta<M: NodeInfo>(&mut self, _delta: &Delta<M>) {}
}

impl NodeInfo for LensInfo {
    type L = LensLeaf;

    fn accumulate(&mut self, other: &Self) {
        self.0 += other.0;
    }

    fn compute_info(l: &LensLeaf) -> LensInfo {
        LensInfo(l.total_height)
    }
}

impl Leaf for LensLeaf {
    fn len(&self) -> usize {
        self.len
    }

    fn is_ok_child(&self) -> bool {
        self.data.len() >= MIN_LEAF
    }

    fn push_maybe_split(
        &mut self,
        other: &LensLeaf,
        iv: Interval,
    ) -> Option<LensLeaf> {
        let (iv_start, iv_end) = iv.start_end();
        let mut accum = 0;
        let mut added_len = 0;
        let mut added_height = 0;
        for sec in &other.data {
            if accum + sec.len < iv_start {
                accum += sec.len;
                continue;
            }

            if accum + sec.len <= iv_end {
                accum += sec.len;
                self.data.push(LensData {
                    len: sec.len,
                    line_height: sec.line_height,
                });
                added_len += sec.len;
                added_height += sec.len * sec.line_height;
                continue;
            }

            let len = iv_end - (accum + sec.len);
            self.data.push(LensData {
                len,
                line_height: sec.line_height,
            });
            added_len += len;
            added_height += sec.len * sec.line_height;
            break;
        }
        self.len += added_len;
        self.total_height += added_height;

        if self.data.len() <= MAX_LEAF {
            None
        } else {
            let splitpoint = self.data.len() / 2; // number of spans
            let new = self.data.split_off(splitpoint);
            let new_len = new.iter().map(|d| d.len).sum();
            let new_height = new.iter().map(|d| d.len * d.line_height).sum();
            self.len -= new_len;
            self.total_height -= new_height;
            Some(LensLeaf {
                len: new_len,
                data: new,
                total_height: new_height,
            })
        }
    }
}

#[derive(Copy, Clone)]
pub struct LensMetric(());

impl Metric<LensInfo> for LensMetric {
    fn measure(info: &LensInfo, _len: usize) -> usize {
        info.0
    }

    fn to_base_units(l: &LensLeaf, in_measured_units: usize) -> usize {
        if in_measured_units > l.total_height {
            l.len
        } else if in_measured_units == 0 {
            0
        } else {
            let mut line = 0;
            let mut accum = 0;
            for data in l.data.iter() {
                let leaf_height = data.line_height * data.len;
                let accum_height = accum + leaf_height;
                if accum_height > in_measured_units {
                    return line + (in_measured_units - accum) / data.line_height;
                }
                accum = accum_height;
                line += data.len;
            }
            line
        }
    }

    fn from_base_units(l: &LensLeaf, in_base_units: usize) -> usize {
        let mut line = 0;
        let mut accum = 0;
        for data in l.data.iter() {
            if in_base_units < line + data.len {
                return accum + (in_base_units - line) * data.line_height;
            }
            accum += data.len * data.line_height;
            line += data.len;
        }
        accum
    }

    fn is_boundary(_l: &LensLeaf, _offset: usize) -> bool {
        true
    }

    fn prev(_l: &LensLeaf, offset: usize) -> Option<usize> {
        if offset == 0 { None } else { Some(offset - 1) }
    }

    fn next(l: &LensLeaf, offset: usize) -> Option<usize> {
        if offset < l.len {
            Some(offset + 1)
        } else {
            None
        }
    }

    fn can_fragment() -> bool {
        false
    }
}

impl DefaultMetric for LensInfo {
    type DefaultMetric = LensBaseMetric;
}

#[derive(Copy, Clone)]
pub struct LensBaseMetric(());

impl Metric<LensInfo> for LensBaseMetric {
    fn measure(_: &LensInfo, len: usize) -> usize {
        len
    }

    fn to_base_units(_: &LensLeaf, in_measured_units: usize) -> usize {
        in_measured_units
    }

    fn from_base_units(_: &LensLeaf, in_base_units: usize) -> usize {
        in_base_units
    }

    fn is_boundary(l: &LensLeaf, offset: usize) -> bool {
        LensMetric::is_boundary(l, offset)
    }

    fn prev(l: &LensLeaf, offset: usize) -> Option<usize> {
        LensMetric::prev(l, offset)
    }

    fn next(l: &LensLeaf, offset: usize) -> Option<usize> {
        LensMetric::next(l, offset)
    }

    fn can_fragment() -> bool {
        false
    }
}

pub struct LensBuilder {
    b: TreeBuilder<LensInfo>,
    leaf: LensLeaf,
}

impl Default for LensBuilder {
    fn default() -> LensBuilder {
        LensBuilder {
            b: TreeBuilder::new(),
            leaf: LensLeaf::default(),
        }
    }
}

impl LensBuilder {
    pub fn new() -> LensBuilder {
        LensBuilder::default()
    }

    pub fn add_section(&mut self, len: usize, line_height: usize) {
        if self.leaf.data.len() == MAX_LEAF {
            let leaf = mem::take(&mut self.leaf);
            self.b.push(Node::from_leaf(leaf));
        }
        self.leaf.len += len;
        self.leaf.total_height += len * line_height;
        self.leaf.data.push(LensData { len, line_height });
    }

    pub fn build(mut self) -> Lens {
        self.b.push(Node::from_leaf(self.leaf));
        Lens(self.b.build())
    }
}

impl Iterator for LensIter<'_> {
    type Item = (usize, usize);

    fn next(&mut self) -> Option<Self::Item> {
        if self.cursor.pos() >= self.end {
            return None;
        }
        if let Some((leaf, leaf_pos)) = self.cursor.get_leaf() {
            if leaf.data.is_empty() {
                return None;
            }
            let line = self.cursor.pos();
            self.cursor.next::<LensMetric>();

            let mut lines = 0;
            for data in leaf.data.iter() {
                if leaf_pos < data.len + lines {
                    return Some((line, data.line_height));
                }
                lines += data.len;
            }
            return None;
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lens_metric() {
        let mut builder = LensBuilder::new();
        builder.add_section(10, 2);
        builder.add_section(1, 25);
        builder.add_section(20, 3);
        let lens = builder.build();

        assert_eq!(31, lens.len());
        assert_eq!(0, lens.height_of_line(0));
        assert_eq!(2, lens.height_of_line(1));
        assert_eq!(20, lens.height_of_line(10));
        assert_eq!(45, lens.height_of_line(11));
        assert_eq!(48, lens.height_of_line(12));
        assert_eq!(105, lens.height_of_line(31));
        assert_eq!(105, lens.height_of_line(32));
        assert_eq!(105, lens.height_of_line(62));

        assert_eq!(0, lens.line_of_height(0));
        assert_eq!(0, lens.line_of_height(1));
        assert_eq!(1, lens.line_of_height(2));
        assert_eq!(1, lens.line_of_height(3));
        assert_eq!(2, lens.line_of_height(4));
        assert_eq!(2, lens.line_of_height(5));
        assert_eq!(3, lens.line_of_height(6));
        assert_eq!(10, lens.line_of_height(20));
        assert_eq!(10, lens.line_of_height(44));
        assert_eq!(11, lens.line_of_height(45));
        assert_eq!(11, lens.line_of_height(46));
        assert_eq!(31, lens.line_of_height(105));
        assert_eq!(31, lens.line_of_height(106));
    }

    #[test]
    fn test_lens_iter() {
        let mut builder = LensBuilder::new();
        builder.add_section(10, 2);
        builder.add_section(1, 25);
        builder.add_section(2, 3);
        let lens = builder.build();

        let mut iter = lens.iter();
        assert_eq!(Some((0, 2)), iter.next());
        assert_eq!(Some((1, 2)), iter.next());
        assert_eq!(Some((2, 2)), iter.next());
        for _ in 0..7 {
            iter.next();
        }
        assert_eq!(Some((10, 25)), iter.next());
        assert_eq!(Some((11, 3)), iter.next());
        assert_eq!(Some((12, 3)), iter.next());
        assert_eq!(None, iter.next());

        let mut iter = lens.iter_chunks(9..12);
        assert_eq!(Some((9, 2)), iter.next());
        
```

### Core Architecture Module: `lapce-core/src/lib.rs`
```
#![allow(clippy::manual_clamp)]

pub mod directory;
pub mod encoding;
pub mod language;
pub mod lens;
pub mod meta;
pub mod rope_text_pos;
pub mod style;
pub mod syntax;
// This is primarily being re-exported to avoid changing every single usage
// in lapce-app. We should probably remove this at some point.
pub use floem_editor_core::*;

```

### Core Architecture Module: `lapce-core/src/meta.rs`
```
#[derive(strum_macros::AsRefStr, PartialEq, Eq)]
pub enum ReleaseType {
    Debug,
    Stable,
    Nightly,
}

include!(concat!(env!("OUT_DIR"), "/meta.rs"));

```

### Core Architecture Module: `lapce-core/src/rope_text_pos.rs`
```
use floem_editor_core::buffer::rope_text::RopeText;
use lsp_types::Position;

use crate::encoding::{offset_utf8_to_utf16, offset_utf16_to_utf8};

pub trait RopeTextPosition: RopeText {
    /// Converts a UTF8 offset to a UTF16 LSP position
    /// Returns None if it is not a valid UTF16 offset
    fn offset_to_position(&self, offset: usize) -> Position {
        let (line, col) = self.offset_to_line_col(offset);
        let line_offset = self.offset_of_line(line);

        let utf16_col =
            offset_utf8_to_utf16(self.char_indices_iter(line_offset..), col);

        Position {
            line: line as u32,
            character: utf16_col as u32,
        }
    }

    fn offset_of_position(&self, pos: &Position) -> usize {
        let (line, column) = self.position_to_line_col(pos);

        self.offset_of_line_col(line, column)
    }

    fn position_to_line_col(&self, pos: &Position) -> (usize, usize) {
        let line = pos.line as usize;
        let line_offset = self.offset_of_line(line);

        let column = offset_utf16_to_utf8(
            self.char_indices_iter(line_offset..),
            pos.character as usize,
        );

        (line, column)
    }
}
impl<T: RopeText> RopeTextPosition for T {}

```

### Core Architecture Module: `lapce-core/src/style.rs`
```
use std::str;

use lapce_rpc::style::{LineStyle, Style};
use lapce_xi_rope::{LinesMetric, Rope, spans::Spans};

pub const SCOPES: &[&str] = &[
    "constant",
    "type",
    "type.builtin",
    "property",
    "comment",
    "constructor",
    "function",
    "label",
    "keyword",
    "string",
    "variable",
    "variable.other.member",
    "operator",
    "attribute",
    "escape",
    "embedded",
    "symbol",
    "punctuation",
    "punctuation.special",
    "punctuation.delimiter",
    "text",
    "text.literal",
    "text.title",
    "text.uri",
    "text.reference",
    "string.escape",
    "conceal",
    "none",
    "tag",
    "markup.bold",
    "markup.italic",
    "markup.list",
    "markup.quote",
    "markup.heading",
    "markup.link.url",
    "markup.link.label",
    "markup.link.text",
];

pub fn line_styles(
    text: &Rope,
    line: usize,
    styles: &Spans<Style>,
) -> Vec<LineStyle> {
    let max_line = text.measure::<LinesMetric>() + 1;

    if line >= max_line {
        return Vec::new();
    }

    let start_offset = text.offset_of_line(line);
    let end_offset = text.offset_of_line(line + 1);
    let line_styles: Vec<LineStyle> = styles
        .iter_chunks(start_offset..end_offset)
        .filter_map(|(iv, style)| {
            let start = iv.start();
            let end = iv.end();
            if start > end_offset || end < start_offset {
                None
            } else {
                let start = start.saturating_sub(start_offset);
                let end = end - start_offset;
                let style = style.clone();
                Some(LineStyle { start, end, style })
            }
        })
        .collect();
    line_styles
}

```

### Core Architecture Module: `lapce-core/src/syntax/edit.rs`
```
use floem_editor_core::buffer::{
    InsertsValueIter,
    rope_text::{RopeText, RopeTextRef},
};
use lapce_xi_rope::{
    Rope, RopeDelta, RopeInfo,
    delta::InsertDelta,
    multiset::{CountMatcher, Subset},
};
use tree_sitter::Point;

#[derive(Clone)]
pub struct SyntaxEdit(pub(crate) Vec<tree_sitter::InputEdit>);

impl SyntaxEdit {
    pub fn new(edits: Vec<tree_sitter::InputEdit>) -> Self {
        Self(edits)
    }

    pub fn from_delta(text: &Rope, delta: RopeDelta) -> SyntaxEdit {
        let (ins_delta, deletes) = delta.factor();

        Self::from_factored_delta(text, &ins_delta, &deletes)
    }

    pub fn from_factored_delta(
        text: &Rope,
        ins_delta: &InsertDelta<RopeInfo>,
        deletes: &Subset,
    ) -> SyntaxEdit {
        let deletes = deletes.transform_expand(&ins_delta.inserted_subset());

        let mut edits = Vec::new();

        let mut insert_edits: Vec<tree_sitter::InputEdit> =
            InsertsValueIter::new(ins_delta)
                .map(|insert| {
                    let start = insert.old_offset;
                    let inserted = insert.node;
                    create_insert_edit(text, start, inserted)
                })
                .collect();
        insert_edits.reverse();
        edits.append(&mut insert_edits);

        let text = ins_delta.apply(text);
        let mut delete_edits: Vec<tree_sitter::InputEdit> = deletes
            .range_iter(CountMatcher::NonZero)
            .map(|(start, end)| create_delete_edit(&text, start, end))
            .collect();
        delete_edits.reverse();
        edits.append(&mut delete_edits);

        SyntaxEdit::new(edits)
    }
}

fn point_at_offset(text: &Rope, offset: usize) -> Point {
    let text = RopeTextRef::new(text);
    let line = text.line_of_offset(offset);
    let col = text.offset_of_line(line + 1).saturating_sub(offset);
    Point::new(line, col)
}

fn traverse(point: Point, text: &str) -> Point {
    let Point {
        mut row,
        mut column,
    } = point;

    for ch in text.chars() {
        if ch == '\n' {
            row += 1;
            column = 0;
        } else {
            column += 1;
        }
    }
    Point { row, column }
}

pub fn create_insert_edit(
    old_text: &Rope,
    start: usize,
    inserted: &Rope,
) -> tree_sitter::InputEdit {
    let start_position = point_at_offset(old_text, start);
    tree_sitter::InputEdit {
        start_byte: start,
        old_end_byte: start,
        new_end_byte: start + inserted.len(),
        start_position,
        old_end_position: start_position,
        new_end_position: traverse(
            start_position,
            &inserted.slice_to_cow(0..inserted.len()),
        ),
    }
}

pub fn create_delete_edit(
    old_text: &Rope,
    start: usize,
    end: usize,
) -> tree_sitter::InputEdit {
    let start_position = point_at_offset(old_text, start);
    let end_position = point_at_offset(old_text, end);
    tree_sitter::InputEdit {
        start_byte: start,
        // The old end byte position was at the end
        old_end_byte: end,
        // but since we're deleting everything up to it, it gets 'moved' to where we start
        new_end_byte: start,

        start_position,
        old_end_position: end_position,
        new_end_position: start_position,
    }
}

```

### Core Architecture Module: `lapce-core/src/syntax/highlight.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Much of the code in this file is modified from [helix](https://github.com/helix-editor/helix)'s implementation of their syntax highlighting, which is under the MPL.
 */

use std::{
    borrow::Cow,
    cell::RefCell,
    collections::HashMap,
    path::Path,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};

use arc_swap::ArcSwap;
use lapce_xi_rope::Rope;
use once_cell::sync::Lazy;
use regex::Regex;
use tree_sitter::{
    Language, Point, Query, QueryCaptures, QueryCursor, QueryMatch, Tree,
};

use super::{PARSER, util::RopeProvider};
use crate::{language::LapceLanguage, style::SCOPES};

thread_local! {
    static HIGHLIGHT_CONFIGS: RefCell<HashMap<LapceLanguage, Result<Arc<HighlightConfiguration>, HighlightIssue>>> = Default::default();
}

pub fn reset_highlight_configs() {
    HIGHLIGHT_CONFIGS.with_borrow_mut(|configs| {
        configs.clear();
    });
}

pub(crate) fn get_highlight_config(
    lang: LapceLanguage,
) -> Result<Arc<HighlightConfiguration>, HighlightIssue> {
    HIGHLIGHT_CONFIGS.with(|configs| {
        let mut configs = configs.borrow_mut();
        let config = configs
            .entry(lang)
            .or_insert_with(|| lang.new_highlight_config().map(Arc::new));
        config.clone()
    })
}

/// Indicates which highlight should be applied to a region of source code.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct Highlight(pub usize);

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HighlightIssue {
    Error(String),
    NotAvailable,
}

/// Represents a single step in rendering a syntax-highlighted document.
#[derive(Copy, Clone, Debug)]
pub enum HighlightEvent {
    Source { start: usize, end: usize },
    HighlightStart(Highlight),
    HighlightEnd,
}

#[derive(Debug)]
pub(crate) struct LocalDef<'a> {
    name: Cow<'a, str>,
    value_range: std::ops::Range<usize>,
    highlight: Option<Highlight>,
}

#[derive(Debug)]
pub(crate) struct LocalScope<'a> {
    pub(crate) inherits: bool,
    pub(crate) range: std::ops::Range<usize>,
    pub(crate) local_defs: Vec<LocalDef<'a>>,
}

#[derive(Debug, Clone)]
pub enum InjectionLanguageMarker<'a> {
    Name(Cow<'a, str>),
    Filename(Cow<'a, Path>),
    Shebang(String),
}

const SHEBANG: &str = r"#!\s*(?:\S*[/\\](?:env\s+(?:\-\S+\s+)*)?)?([^\s\.\d]+)";

const CANCELLATION_CHECK_INTERVAL: usize = 100;

/// Contains the data needed to highlight code written in a particular language.
///
/// This struct is immutable and can be shared between threads.
#[derive(Debug)]
pub struct HighlightConfiguration {
    pub language: Language,
    pub query: Query,
    pub injections_query: Query,
    pub combined_injections_patterns: Vec<usize>,
    pub highlights_pattern_index: usize,
    pub highlight_indices: ArcSwap<Vec<Option<Highlight>>>,
    pub non_local_variable_patterns: Vec<bool>,
    pub injection_content_capture_index: Option<u32>,
    pub injection_language_capture_index: Option<u32>,
    pub injection_filename_capture_index: Option<u32>,
    pub injection_shebang_capture_index: Option<u32>,
    pub local_scope_capture_index: Option<u32>,
    pub local_def_capture_index: Option<u32>,
    pub local_def_value_capture_index: Option<u32>,
    pub local_ref_capture_index: Option<u32>,
}

impl HighlightConfiguration {
    /// Creates a `HighlightConfiguration` for a given `Language` and set of highlighting
    /// queries.
    ///
    /// # Parameters
    ///
    /// * `language`  - The Tree-sitter `Language` that should be used for parsing.
    /// * `highlights_query` - A string containing tree patterns for syntax highlighting. This
    ///   should be non-empty, otherwise no syntax highlights will be added.
    /// * `injections_query` -  A string containing tree patterns for injecting other languages
    ///   into the document. This can be empty if no injections are desired.
    /// * `locals_query` - A string containing tree patterns for tracking local variable
    ///   definitions and references. This can be empty if local variable tracking is not needed.
    ///
    /// Returns a `HighlightConfiguration` that can then be used with the `highlight` method.
    pub fn new(
        language: Language,
        highlights_query: &str,
        injection_query: &str,
        locals_query: &str,
    ) -> Result<Self, tree_sitter::QueryError> {
        // Concatenate the query strings, keeping track of the start offset of each section.
        let mut query_source = String::new();
        query_source.push_str(locals_query);
        let highlights_query_offset = query_source.len();
        query_source.push_str(highlights_query);

        // Construct a single query by concatenating the three query strings, but record the
        // range of pattern indices that belong to each individual string.
        let query = Query::new(&language, &query_source)?;
        let mut highlights_pattern_index = 0;
        for i in 0..(query.pattern_count()) {
            let pattern_offset = query.start_byte_for_pattern(i);
            if pattern_offset < highlights_query_offset {
                highlights_pattern_index += 1;
            }
        }

        let injections_query = Query::new(&language, injection_query)?;
        let combined_injections_patterns = (0..injections_query.pattern_count())
            .filter(|&i| {
                injections_query
                    .property_settings(i)
                    .iter()
                    .any(|s| &*s.key == "injection.combined")
            })
            .collect();

        // Find all of the highlighting patterns that are disabled for nodes that
        // have been identified as local variables.
        let non_local_variable_patterns = (0..query.pattern_count())
            .map(|i| {
                query.property_predicates(i).iter().any(|(prop, positive)| {
                    !*positive && prop.key.as_ref() == "local"
                })
            })
            .collect();

        // Store the numeric ids for all of the special captures.
        let mut injection_content_capture_index = None;
        let mut injection_language_capture_index = None;
        let mut injection_filename_capture_index = None;
        let mut injection_shebang_capture_index = None;
        let mut local_def_capture_index = None;
        let mut local_def_value_capture_index = None;
        let mut local_ref_capture_index = None;
        let mut local_scope_capture_index = None;
        for (i, name) in query.capture_names().iter().enumerate() {
            let i = Some(i as u32);
            match *name {
                "local.definition" => local_def_capture_index = i,
                "local.definition-value" => local_def_value_capture_index = i,
                "local.reference" => local_ref_capture_index = i,
                "local.scope" => local_scope_capture_index = i,
                _ => {}
            }
        }

        for (i, name) in injections_query.capture_names().iter().enumerate() {
            let i = Some(i as u32);
            match *name {
                "injection.content" => injection_content_capture_index = i,
                "injection.language" => injection_language_capture_index = i,
                "injection.filename" => injection_filename_capture_index = i,
                "injection.shebang" => injection_shebang_capture_index = i,
                _ => {}
            }
        }

        let highlight_indices: ArcSwap<Vec<_>> =
            ArcSwap::from_pointee(vec![None; query.capture_names().len()]);
        let conf = Self {
            language,
            query,
            injections_query,
            combined_injections_patterns,
            highlights_pattern_index,
            highlight_indices,
            non_local_variable_patterns,
            injection_content_capture_index,
            injection_language_capture_index,
            injection_shebang_capture_index,
            injection_filename_capture_index,
            local_scope_capture_index,
            local_def_capture_index,
            local_def_value_capture_index,
            local_ref_capture_index,
        };
        conf.configure(SCOPES);
        Ok(conf)
    }

    /// Get a slice containing all of the highlight names used in the configuration.
    pub fn names(&self) -> &[&str] {
        self.query.capture_names()
    }

    /// Set the list of recognized highlight names.
    ///
    /// Tree-sitter syntax-highlighting queries specify highlights in the form of dot-separated
    /// highlight names like `punctuation.bracket` and `function.method.builtin`. Consumers of
    /// these queries can choose to recognize highlights with different levels of specificity.
    /// For example, the string `function.builtin` will match against `function.builtin.constructor`
    /// but will not match `function.method.builtin` and `function.method`.
    ///
    /// When highlighting, results are returned as `Highlight` values, which contain the index
    /// of the matched highlight this list of highlight names.
    pub fn configure(&self, recognized_names: &[&str]) {
        let mut capture_parts = Vec::new();
        let indices: Vec<_> = self
            .query
            .capture_names()
            .iter()
            .map(move |capture_name| {
                capture_parts.clear();
                capture_parts.extend(capture_name.split('.'));

                let mut best_index = None;
                let mut best_match_len = 0;
                for (i, recognized_name) in recognized_names.iter().enumerate() {
                    let mut len = 0;
                    let mut matches = true;
                    for (i, part) in recognized_name.split('.').enumerate() {
                        match capture_parts.get(i) {
                            Some(capture_par
```

### Core Architecture Module: `lapce-core/src/syntax/mod.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Much of the code in this file is modified from [helix](https://github.com/helix-editor/helix)'s implementation of their syntax highlighting, which is under the MPL.
 */

use std::{
    cell::RefCell,
    collections::{HashMap, HashSet, VecDeque, hash_map::Entry},
    hash::{Hash, Hasher},
    mem,
    path::Path,
    sync::{Arc, atomic::AtomicUsize},
};

use ahash::RandomState;
use floem_editor_core::util::{matching_bracket_general, matching_pair_direction};
use hashbrown::raw::RawTable;
use itertools::Itertools;
use lapce_rpc::style::{LineStyle, Style};
use lapce_xi_rope::{
    Interval, Rope,
    spans::{Spans, SpansBuilder},
};
use slotmap::{DefaultKey as LayerId, HopSlotMap};
use thiserror::Error;
use tree_sitter::{Node, Parser, Point, QueryCursor, Tree};

use self::{
    edit::SyntaxEdit,
    highlight::{
        Highlight, HighlightConfiguration, HighlightEvent, HighlightIter,
        HighlightIterLayer, IncludedChildren, LocalScope, get_highlight_config,
        intersect_ranges,
    },
    util::RopeProvider,
};
use crate::{
    buffer::{Buffer, rope_text::RopeText},
    language::{self, LapceLanguage},
    lens::{Lens, LensBuilder},
    style::SCOPES,
    syntax::highlight::InjectionLanguageMarker,
};
pub mod edit;
pub mod highlight;
pub mod util;

const TREE_SITTER_MATCH_LIMIT: u32 = 256;

// Uses significant portions Helix's implementation, and on tree-sitter's highlighter implementation

pub struct TsParser {
    parser: tree_sitter::Parser,
    pub cursors: Vec<QueryCursor>,
}

thread_local! {
    pub static PARSER: RefCell<TsParser> = RefCell::new(TsParser {
        parser: Parser::new(),
        cursors: Vec::new(),
    });
}

/// Represents the reason why syntax highlighting failed.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum Error {
    #[error("Cancelled")]
    Cancelled,
    #[error("Invalid ranges")]
    InvalidRanges,
    #[error("Invalid language")]
    InvalidLanguage,
    #[error("Unknown error")]
    Unknown,
}

#[derive(Clone, Debug)]
pub enum NodeType {
    LeftParen,
    RightParen,
    LeftBracket,
    RightBracket,
    LeftCurly,
    RightCurly,
    Pair,
    Code,
    Dummy,
}

#[derive(Clone, Debug)]
pub enum BracketParserMode {
    Parsing,
    NoParsing,
}

#[derive(Clone, Debug)]
pub struct ASTNode {
    pub tt: NodeType,
    pub len: usize,
    pub children: Vec<ASTNode>,
    pub level: usize,
}

impl ASTNode {
    pub fn new() -> Self {
        Self {
            tt: NodeType::Dummy,
            len: 0,
            children: vec![],
            level: 0,
        }
    }

    pub fn new_with_type(tt: NodeType, len: usize) -> Self {
        Self {
            tt,
            len,
            children: vec![],
            level: 0,
        }
    }
}

impl Default for ASTNode {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug)]
pub struct BracketParser {
    pub code: Vec<char>,
    pub cur: usize,
    pub ast: ASTNode,
    bracket_set: HashMap<char, ASTNode>,
    pub bracket_pos: HashMap<usize, Vec<LineStyle>>,
    mode: BracketParserMode,
    noparsing_token: Vec<char>,
    pub active: bool,
    pub limit: u64,
}

impl BracketParser {
    pub fn new(code: String, active: bool, limit: u64) -> Self {
        Self {
            code: code.chars().collect(),
            cur: 0,
            ast: ASTNode::new(),
            bracket_set: HashMap::from([
                ('(', ASTNode::new_with_type(NodeType::LeftParen, 1)),
                (')', ASTNode::new_with_type(NodeType::RightParen, 1)),
                ('{', ASTNode::new_with_type(NodeType::LeftCurly, 1)),
                ('}', ASTNode::new_with_type(NodeType::RightCurly, 1)),
                ('[', ASTNode::new_with_type(NodeType::LeftBracket, 1)),
                (']', ASTNode::new_with_type(NodeType::RightBracket, 1)),
            ]),
            bracket_pos: HashMap::new(),
            mode: BracketParserMode::Parsing,
            noparsing_token: vec!['\'', '"', '`'],
            active,
            limit,
        }
    }

    /*pub fn enable(&self) {
        *(self.active.borrow_mut()) = true;
    }

    pub fn disable(&self) {
        *(self.active.borrow_mut()) = false;
    }*/

    pub fn update_code(
        &mut self,
        code: String,
        buffer: &Buffer,
        syntax: Option<&Syntax>,
    ) {
        let palette = vec![
            "bracket.color.1".to_string(),
            "bracket.color.2".to_string(),
            "bracket.color.3".to_string(),
        ];
        if self.active
            && code
                .chars()
                .fold(0, |i, c| if c == '\n' { i + 1 } else { i })
                < self.limit as usize
        {
            self.bracket_pos = HashMap::new();
            if let Some(syntax) = syntax {
                if let Some(layers) = &syntax.layers {
                    if let Some(tree) = layers.try_tree() {
                        let mut walk_cursor = tree.walk();
                        let mut bracket_pos: HashMap<usize, Vec<LineStyle>> =
                            HashMap::new();
                        language::walk_tree_bracket_ast(
                            &mut walk_cursor,
                            &mut 0,
                            &mut 0,
                            &mut bracket_pos,
                            &palette,
                        );
                        self.bracket_pos = bracket_pos;
                    }
                }
            } else {
                self.code = code.chars().collect();
                self.cur = 0;
                self.parse();
                let mut pos_vec = vec![];
                Self::highlight_pos(
                    &self.ast,
                    &mut pos_vec,
                    &mut 0usize,
                    &mut 0usize,
                    &palette,
                );
                if buffer.is_empty() {
                    return;
                }
                for (offset, color) in pos_vec.iter() {
                    let (line, col) = buffer.offset_to_line_col(*offset);
                    let line_style = LineStyle {
                        start: col,
                        end: col + 1,
                        style: Style {
                            fg_color: Some(color.clone()),
                        },
                    };
                    match self.bracket_pos.entry(line) {
                        Entry::Vacant(v) => _ = v.insert(vec![line_style.clone()]),
                        Entry::Occupied(mut o) => {
                            o.get_mut().push(line_style.clone())
                        }
                    }
                }
            }
        } else {
            self.bracket_pos = HashMap::new();
        }
    }

    fn is_left(c: &char) -> bool {
        if *c == '(' || *c == '{' || *c == '[' {
            return true;
        }
        false
    }

    fn parse(&mut self) {
        let new_ast = &mut ASTNode::new();
        self.parse_bracket(0, new_ast);
        self.ast = new_ast.clone();
        Self::patch_len(&mut self.ast);
        self.cur = 0;
    }

    fn parse_bracket(&mut self, level: usize, parent_node: &mut ASTNode) {
        let mut counter = 0usize;
        while self.cur < self.code.len() {
            if self.noparsing_token.contains(&self.code[self.cur]) {
                if matches!(self.mode, BracketParserMode::Parsing) {
                    self.mode = BracketParserMode::NoParsing;
                } else {
                    self.mode = BracketParserMode::Parsing;
                }
            }
            if self.bracket_set.contains_key(&self.code[self.cur])
                && matches!(self.mode, BracketParserMode::Parsing)
            {
                if Self::is_left(&self.code[self.cur]) {
                    let code_node = ASTNode::new_with_type(NodeType::Code, counter);
                    let left_node =
                        self.bracket_set.get(&self.code[self.cur]).unwrap().clone();
                    let mut pair_node =
                        ASTNode::new_with_type(NodeType::Pair, counter + 1);
                    pair_node.level = level;
                    pair_node.children.push(code_node);
                    pair_node.children.push(left_node);
                    self.cur += 1;
                    self.parse_bracket(level + 1, &mut pair_node);
                    parent_node.children.push(pair_node.clone());
                    counter = 0;
                } else if level <= parent_node.level {
                    let code_node = ASTNode::new_with_type(NodeType::Code, counter);
                    let right_node =
                        self.bracket_set.get(&self.code[self.cur]).unwrap().clone();
                    parent_node.children.push(code_node);
                    parent_node.children.push(right_node);
                    let parent_len = parent_node.len;
                    parent_node.len = parent_len + counter + 1;
                    counter = 0;
                    self.cur += 1;
                } else {
                    let code_node = ASTNode::new_with_type(NodeType::Code, counter);
                    let right_node =
                        self.bracket_set.get(&self.code[self.cur]).unwrap().clone();
                    parent_node.children.push(code_node);
                    parent_node.children.push(right_node);
                    let parent_len = parent_node.len;
                    parent_node.len = parent_len + counter + 1;
                    self.cur += 1;
                    return;
                }
            } else {
                counter += self.code[self.cur].len_utf8();
                self.cur += 1;
            }
        }
    }

    fn patch_len(ast: &mut ASTNode) {
        if !ast.children.is_empty() {
            let mut l
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3941** (2026-10-02): **spam**
  *Symptoms*: Withdrawn. No action is requested from this project.

- **Issue #3936** (2026-09-01): **build: use vendored libgit2**
  *Symptoms*: - [ ] Added an entry to `CHANGELOG.md` if this change could be valuable to users

- **Issue #3924** (2026-09-30): **fix: correct issue reference in dev.lapce.lapce.metainfo.xml (#3786)**
  *Symptoms*: Update the AppStream metainfo by replacing the incorrect issue reference (#3795) with the correct one (#3786) for the v0.4.6 release notes.

- **Issue #3923** (2026-09-01): **ci: add llhttp-dev to alpine build**
  *Symptoms*: - [ ] Added an entry to `CHANGELOG.md` if this change could be valuable to users

- **Issue #3918** (2026-06-20): **feat: add keyboard shortcut to toggle word wrap**
  *Symptoms*: ## Summary Adds a `toggle_word_wrap` workbench command bound to <kbd>Alt</kbd>+<kbd>Z</kbd> that flips the editor wrap style between `none` and `editor-width`. The command is also discoverable via the command palette ("Toggle Word Wrap").  ## Details - `lapce-app/src/command.rs` — new `ToggleWordWrap` workbench command. - `lapce-app/src/window_tab.rs` — handler reads the current `editor.wrap_style` and toggles it (`None` → `EditorWidth`, otherwise → `None`), persisting the change to the user settings file. The config file is watched, so it applies live. - `defaults/keymaps-common.toml` — binds <kbd>Alt</kbd>+<kbd>Z</kbd> to `toggle_word_wrap` (matches VS Code; no conflict with existing bindings).  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #3916** (2026-09-30): **fix: sync deepseek-carp fixes and add LSP smoke example**
  *Symptoms*: ## Summary This PR syncs improvements from the CarpAI integration fork back to upstream Lapce.  ## Changes - Fixed deepseek-carp integration issues - Added LSP smoke example for testing - Various bug fixes and stability improvements  ## Testing - [ ] Tested locally with CarpAI Server - [ ] LSP smoke example runs correctly  ## Related Part of the CarpAI ecosystem integration (jcode → CarpAI fork). 

- **Issue #3910** (2026-06-01): **go version doesnt match to 1.23**
  *Symptoms*: ## Lapce Version 0.4.6  ## System information : windows 11 PRO  ## Describe the bug : ERROR notification show :   <img width="1201" height="275" alt="Image" src="https://github.com/user-attachments/assets/3a9ef9e8-831a-4e2a-8352-9784be0d65ef" />  ## Additional information : i suspected this was due to the go plugins
  **Post-Mortem & Fix Analysis**:
  > my go version : 1.26.3 windows/amd64
  > Not a lapce issue, but extension/LSP
  > @uciharis You may have gcc-go installed instead of regular Go.

- **Issue #3906** (2026-05-23): **Runtime system theme watcher in app.rs**
  *Symptoms*: ## Parent  #3903  ## What to build  Wire up the runtime system theme change watcher in `lapce-app/src/app.rs` (or nearby) so that when the OS appearance changes while Lapce is running, the theme switches automatically.  Specifically: - Initialize `system_theme::watch_system_theme()` during app startup, alongside the existing `ConfigWatcher` - When the callback fires with a new `SystemTheme` value:   - Check if `core.color_theme == "auto"` (to avoid unnecessary reloads when user has a fixed theme)   - If yes, call `app_data.reload_config()` to trigger the full config reload pipeline - The reload pipeline already propagates to all windows reactively — no additional UI changes needed  ## Acceptance criteria  - [ ] System theme watcher is initialized during app startup - [ ] OS appearance change triggers `reload_config()` when in auto mode - [ ] OS appearance change does NOT trigger reload when a fixed theme is selected - [ ] Watcher thread/mechanism is properly cleaned up on shutdown - [ ] Compiles cleanly on all three platforms  ## Blocked by  - Blocked by #3904, #3905

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

### Incident Patch 1: `f66ffaa9` (2026-09-30)
**Commit Message**: docs: fix typo, newlines

**File**: `CHANGELOG.md` (modified, +0/-2)
```diff
@@ -5,9 +5,7 @@
 ### Features/Changes
 - Added document highlight for LSPs which support this feature
 - (Un)confirmed state of the editor is properly (re)stored
-
 - Implemented Folder/File choosing in remotes
-
 - The file explorer can now be focused with the mouse, and has keybinds for renaming/deleting files
 
 ### Bug Fixes
```

**File**: `lapce-app/src/doc.rs` (modified, +1/-1)
```diff
@@ -1634,7 +1634,7 @@ impl Doc {
                             // This is a kind of debouncing - if cursor moves before we got response from LSP,
                             // check if cursor is still in the region.
                             // In case cursor moved too far we may want to issue LSP request again, for new offset
-                            // but it is easily recoverable by the user - just move cursor a bit to update highligts.
+                            // but it is easily recoverable by the user - just move cursor a bit to update highlights.
                             DocumentHighlight::find_for_offset(&result, offset)
                                 .map(|_| result)
                         });
```

---

### Incident Patch 2: `7fb0ded1` (2026-09-30)
**Commit Message**: build: fix linux metainfo issue number

closes https://github.com/lapce/lapce/pull/3924

**File**: `extra/linux/dev.lapce.lapce.metainfo.xml` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@
         <release version="0.4.4" date="2025-08-30">
             <url type="details">https://github.com/lapce/lapce/releases/tag/v0.4.4</url>
             <issues>
-                <issue url="https://github.com/lapce/lapce/issues/3786">#3795</issue>
+                <issue url="https://github.com/lapce/lapce/issues/3786">#3786</issue>
             </issues>
         </release>
         <release version="0.4.3" date="2024-06-27">
```

---

### Incident Patch 3: `5cd70442` (2026-09-30)
**Commit Message**: Prevent Save All crash caused by orphaned Settings editors (search bars) (#3876)

* Memory Leak Fix for Settings UI #3867

These "editors" (search bars) would be deleted
by floem but not lapce's registry.
The `Save All` feature would loop through
the registry and try to interact with a ghost.

* Defensive Safeguard for Save-All Iteration #3867

* cargo fmt cleanup

* added CHANGELOG entry

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@
 
 ### Bug Fixes
 
+- Fix crash on Save All after closing settings (<https://github.com/lapce/lapce/issues/3867>)
+
 ## 0.4.6
 
 ### Features/Changes
```

**File**: `lapce-app/src/settings.rs` (modified, +8/-0)
```diff
@@ -335,6 +335,7 @@ pub fn settings_view(
     let plugin_kinds = settings_data.plugin_kinds;
 
     let search_editor = editors.make_local(cx, common);
+    let search_editor_id = search_editor.id();
     let doc = search_editor.doc_signal();
 
     let items = settings_data.items;
@@ -542,6 +543,9 @@ pub fn settings_view(
     ))
     .style(|s| s.absolute().size_pct(100.0, 100.0))
     .debug_name("Settings")
+    .on_cleanup(move || {
+        editors.remove(search_editor_id);
+    })
 }
 
 fn settings_item_view(
@@ -1082,6 +1086,7 @@ pub fn theme_color_settings_view(
 
     let cx = Scope::current();
     let search_editor = editors.make_local(cx, common.clone());
+    let search_editor_id = search_editor.id();
     let buffer = search_editor.doc_signal().get_untracked().buffer;
 
     scroll(
@@ -1180,6 +1185,9 @@ pub fn theme_color_settings_view(
     )
     .style(|s| s.absolute().size_full())
     .debug_name("Theme Color Settings")
+    .on_cleanup(move || {
+        editors.remove(search_editor_id);
+    })
 }
 
 fn dropdown_view(
```

**File**: `lapce-app/src/window_tab.rs` (modified, +19/-3)
```diff
@@ -816,16 +816,32 @@ impl WindowTabData {
             SaveAll => {
                 self.main_split.editors.with_editors_untracked(|editors| {
                     let mut paths = HashSet::new();
-                    for (_, editor_data) in editors.iter() {
-                        let doc = editor_data.doc();
+                    for (editor_id, editor_data) in editors.iter() {
+                        // Defensive safeguard: `floem`'s `Editor::doc()` panics if the reactive scope was
+                        // already destroyed. This catches "ghost" editors (like closed Settings or Plugin tabs)
+                        // that leaked into the map, preventing "Save All" from crashing the entire app.
+                        let doc_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
+                            editor_data.doc()
+                        }));
+
+                        let doc = match doc_result {
+                            Ok(document) => document,
+                            Err(_) => {
+                                tracing::warn!(
+                                    "Ghost editor caught and bypassed during Save All. View ID: {:?}",
+                                    editor_id
+                                );
+                                continue;
+                            }
+                        };
+
                         let should_save = if let DocContent::File { path, .. } =
                             doc.content.get_untracked()
                         {
                             if paths.contains(&path) {
                                 false
                             } else {
                                 paths.insert(path.clone());
-
                                 true
                             }
                         } else {
```

---

### Incident Patch 4: `b604d57d` (2026-09-06)
**Commit Message**: fix: dont forget to update code after git2 bump

**File**: `lapce-proxy/src/dispatch.rs` (modified, +6/-3)
```diff
@@ -1517,7 +1517,7 @@ fn git_delta_format(
 fn git_diff_new(workspace_path: &Path) -> Option<DiffInfo> {
     let repo = Repository::discover(workspace_path).ok()?;
     let name = match repo.head() {
-        Ok(head) => head.shorthand()?.to_string(),
+        Ok(head) => head.shorthand().ok()?.to_string(),
         _ => "(No branch)".to_owned(),
     };
 
@@ -1529,6 +1529,9 @@ fn git_diff_new(workspace_path: &Path) -> Option<DiffInfo> {
     let mut tags = Vec::new();
     if let Ok(git_tags) = repo.tag_names(None) {
         for tag in git_tags.into_iter().flatten() {
+            let Some(tag) = tag else {
+                continue;
+            };
             tags.push(tag.to_owned());
         }
     }
@@ -1553,7 +1556,7 @@ fn git_diff_new(workspace_path: &Path) -> Option<DiffInfo> {
 
     let oid = match repo.revparse_single("HEAD^{tree}") {
         Ok(obj) => obj.id(),
-        _ => Oid::zero(),
+        _ => Oid::ZERO_SHA1,
     };
 
     let cached_diff = repo
@@ -1641,7 +1644,7 @@ fn git_get_remote_file_url(workspace_path: &Path, file: &Path) -> Result<String>
     // Grab URL part of remote
     let remote = target_remote
         .url()
-        .ok_or(anyhow!("Failed to convert remote to str"))?;
+        .map_err(|e| anyhow!("Failed to convert remote to str: {e}"))?;
 
     let remote_url = match Url::parse(remote) {
         Ok(url) => url,
```

---

### Incident Patch 5: `9200be5f` (2026-09-01)
**Commit Message**: build: bump git2

**File**: `Cargo.lock` (modified, +8/-25)
```diff
@@ -1581,7 +1581,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.59.0",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -2164,17 +2164,15 @@ dependencies = [
 
 [[package]]
 name = "git2"
-version = "0.20.2"
+version = "0.21.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2deb07a133b1520dc1a5690e9bd08950108873d7ed5de38dcc74d3b5ebffa110"
+checksum = "ddddbf932745a6be37109b6112d3ee09696106f848449069d3a57bba937ab82e"
 dependencies = [
  "bitflags 2.9.1",
  "libc",
  "libgit2-sys",
  "log",
- "openssl-probe",
  "openssl-sys",
- "url",
 ]
 
 [[package]]
@@ -3055,7 +3053,7 @@ dependencies = [
  "tracing-subscriber",
  "unicode-width",
  "url",
- "windows-sys 0.45.0",
+ "windows-sys 0.60.2",
  "zip",
  "zstd",
 ]
@@ -3193,13 +3191,12 @@ checksum = "bcc35a38544a891a5f7c865aca548a982ccb3b8650a5b06d0fd33a10283c56fc"
 
 [[package]]
 name = "libgit2-sys"
-version = "0.18.1+1.9.0"
+version = "0.18.8+1.9.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e1dcb20f84ffcdd825c7a311ae347cce604a6f084a767dec4a4929829645290e"
+checksum = "7f7c568b25d7489bc3fb2988ed69ab111d2944d2f5fec3d5c987fe545ea97b50"
 dependencies = [
  "cc",
  "libc",
- "libssh2-sys",
  "libz-sys",
  "openssl-sys",
  "pkg-config",
@@ -3232,20 +3229,6 @@ dependencies = [
  "redox_syscall 0.5.8",
 ]
 
-[[package]]
-name = "libssh2-sys"
-version = "0.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2dc8a030b787e2119a731f1951d6a773e2280c660f8ec4b0f5e1505a386e71ee"
-dependencies = [
- "cc",
- "libc",
- "libz-sys",
- "openssl-sys",
- "pkg-config",
- "vcpkg",
-]
-
 [[package]]
 name = "libz-sys"
 version = "1.1.8"
@@ -4774,7 +4757,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.11.0",
- "windows-sys 0.59.0",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -7067,7 +7050,7 @@ version = "0.1.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0978bf7171b3d90bac376700cb56d606feb40f251a475a5d6634613564460b22"
 dependencies = [
- "windows-sys 0.48.0",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ clap              = { version = "4.5.0", default-features = false, features = ["
 crossbeam-channel = { version = "0.5.12" }
 directories       = { version = "4.0.1" }
 flate2            = { version = "1.0" }
-git2              = { version = "0.20.0", features = ["vendored-openssl", "vendored-libgit2"] }
+git2              = { version = "0.21.0", features = ["vendored-openssl", "vendored-libgit2"] }
 globset           = { version = "0.4.14" }
 hashbrown         = { version = "0.14.5", features = ["serde"] }
 im                = { version = "15.0.0", features = ["serde"] }
```

---

### Incident Patch 6: `3aedbf3d` (2026-09-01)
**Commit Message**: build: bump tar

**File**: `Cargo.lock` (modified, +6/-6)
```diff
@@ -1581,7 +1581,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -3055,7 +3055,7 @@ dependencies = [
  "tracing-subscriber",
  "unicode-width",
  "url",
- "windows-sys 0.60.2",
+ "windows-sys 0.45.0",
  "zip",
  "zstd",
 ]
@@ -4774,7 +4774,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.11.0",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -5470,9 +5470,9 @@ dependencies = [
 
 [[package]]
 name = "tar"
-version = "0.4.41"
+version = "0.4.46"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cb797dad5fb5b76fcf519e702f4a589483b5ef06567f160c392832c1f5e44909"
+checksum = "3f6221d9a6003c78398e3b239969f352578258df48c8eb051caadae0015bc840"
 dependencies = [
  "filetime",
  "libc",
@@ -7067,7 +7067,7 @@ version = "0.1.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0978bf7171b3d90bac376700cb56d606feb40f251a475a5d6634613564460b22"
 dependencies = [
- "windows-sys 0.60.2",
+ "windows-sys 0.48.0",
 ]
 
 [[package]]
```

---

### Incident Patch 7: `43ae29ac` (2026-09-01)
**Commit Message**: build: bump bytes

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -585,9 +585,9 @@ checksum = "8f1fe948ff07f4bd06c30984e69f5b4899c516a3ef74f34df92a2df2ab535495"
 
 [[package]]
 name = "bytes"
-version = "1.5.0"
+version = "1.12.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a2bd12c1caf447e69cd4528f47f94d203fd2582878ecb9e9465484c4148a8223"
+checksum = "fc652a48c352aef3ea3aed32080501cf3ef6ed5da78602a020c991775b0aff04"
 
 [[package]]
 name = "calloop"
```

---

### Incident Patch 8: `c3128683` (2026-09-01)
**Commit Message**: build: bump time

**File**: `Cargo.lock` (modified, +9/-9)
```diff
@@ -1302,9 +1302,9 @@ dependencies = [
 
 [[package]]
 name = "deranged"
-version = "0.3.11"
+version = "0.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b42b6fa04a440b495c8b04d0e71b707c585f83cb9cb28cf8cd0d976c315e31b4"
+checksum = "7cd812cc2bc1d69d4764bd80df88b4317eaef9e773c75226407d9bc0876b211c"
 dependencies = [
  "powerfmt",
 ]
@@ -5557,30 +5557,30 @@ dependencies = [
 
 [[package]]
 name = "time"
-version = "0.3.36"
+version = "0.3.45"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5dfd88e563464686c916c7e46e623e520ddc6d79fa6641390f2e3fa86e83e885"
+checksum = "f9e442fc33d7fdb45aa9bfeb312c095964abdf596f7567261062b2a7107aaabd"
 dependencies = [
  "deranged",
  "itoa",
  "num-conv",
  "powerfmt",
- "serde",
+ "serde_core",
  "time-core",
  "time-macros",
 ]
 
 [[package]]
 name = "time-core"
-version = "0.1.2"
+version = "0.1.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ef927ca75afb808a4d64dd374f00a2adf8d0fcff8e7b184af886c3c87ec4a3f3"
+checksum = "8b36ee98fd31ec7426d599183e8fe26932a8dc1fb76ddb6214d05493377d34ca"
 
 [[package]]
 name = "time-macros"
-version = "0.2.18"
+version = "0.2.25"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3f252a68540fde3a3877aeea552b832b40ab9a69e318efd078774a01ddee1ccf"
+checksum = "71e552d1249bf61ac2a52db88179fd0673def1e1ad8243a00d9ec9ed71fee3dd"
 dependencies = [
  "num-conv",
  "time-core",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ members = ["lapce-app", "lapce-proxy", "lapce-rpc", "lapce-core"]
 [workspace.package]
 version      = "0.4.6"
 edition      = "2024"
-rust-version = "1.87.0"
+rust-version = "1.98.0"
 license      = "Apache-2.0"
 homepage     = "https://lapce.dev"
 authors      = ["Dongdong Zhou <dzhou121@gmail.com>"]
```

---

### Incident Patch 9: `1eb5e029` (2026-09-01)
**Commit Message**: build: bump openssl

**File**: `Cargo.lock` (modified, +4/-5)
```diff
@@ -3988,15 +3988,14 @@ dependencies = [
 
 [[package]]
 name = "openssl"
-version = "0.10.75"
+version = "0.10.81"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "08838db121398ad17ab8531ce9de97b244589089e290a384c900cb9ff7434328"
+checksum = "77823a27f0babb03091cb9ed9ef80af3b39dbc82f97e8fa530374b7dafd87a45"
 dependencies = [
  "bitflags 2.9.1",
  "cfg-if",
  "foreign-types 0.3.2",
  "libc",
- "once_cell",
  "openssl-macros",
  "openssl-sys",
 ]
@@ -4029,9 +4028,9 @@ dependencies = [
 
 [[package]]
 name = "openssl-sys"
-version = "0.9.111"
+version = "0.9.117"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "82cab2d520aa75e3c58898289429321eb788c3106963d0dc886ec7a5f4adc321"
+checksum = "b47e7e6bb2c38cd930d25a23b40fa52e068c10e85f3e03a7f5ba5aaca5713695"
 dependencies = [
  "cc",
  "libc",
```

---

### Incident Patch 10: `2ba9854c` (2026-09-01)
**Commit Message**: fix: explicit f32

warning: this was previously accepted by the compiler but is being phased out; it will become a hard error in a future release!
note: for more information, see issue #154024 <https://github.com/rust-lang/rust/issues/154024>

**File**: `lapce-app/src/about.rs` (modified, +1/-1)
```diff
@@ -182,7 +182,7 @@ fn exclusive_popup<V: View + 'static>(
                 .on_event_stop(EventListener::PointerDown, move |_| {}),
         )
         .style(move |s| {
-            s.flex_grow(1.0)
+            s.flex_grow(1.0f32)
                 .flex_row()
                 .items_center()
                 .hover(move |s| s.cursor(CursorStyle::Default))
```

**File**: `lapce-app/src/app.rs` (modified, +30/-18)
```diff
@@ -852,7 +852,7 @@ fn editor_tab_header(
                     .padding_horiz(6.)
                     .gap(6.)
                     .grid()
-                    .grid_template_columns(vec![auto(), fr(1.), auto()])
+                    .grid_template_columns(vec![auto(), fr(1_f32), auto()])
                     .apply_if(
                         config.get().ui.tab_separator_height
                             == TabSeparatorHeight::Full,
@@ -936,7 +936,9 @@ fn editor_tab_header(
                         )
                         .border_color(config.color(LapceColor::LAPCE_BORDER))
                 })
-                .style(|s| s.align_items(Some(AlignItems::Center)).flex_grow(1.0)),
+                .style(|s| {
+                    s.align_items(Some(AlignItems::Center)).flex_grow(1.0f32)
+                }),
             empty()
                 .style(move |s| {
                     s.size_full()
@@ -1097,7 +1099,7 @@ fn editor_tab_header(
                 .style(move |s| s.items_center()),
             )
         })
-        .style(|s| s.flex_shrink(0.)),
+        .style(|s| s.flex_shrink(0f32)),
         container(
             scroll({
                 dyn_stack(items, key, view_fn)
@@ -1126,7 +1128,12 @@ fn editor_tab_header(
                     .size_full()
             }),
         )
-        .style(|s| s.height_full().flex_grow(1.0).flex_basis(0.).min_width(10.))
+        .style(|s| {
+            s.height_full()
+                .flex_grow(1.0f32)
+                .flex_basis(0.)
+                .min_width(10.)
+        })
         .debug_name("Tab scroll"),
         stack({
             let size = create_rw_signal(Size::ZERO);
@@ -1200,7 +1207,7 @@ fn editor_tab_header(
             let content_size = content_size.get();
             let scroll_offset = scroll_offset.get();
             s.height_full()
-                .flex_shrink(0.)
+                .flex_shrink(0f32)
                 .margin_left(PxPctAuto::Auto)
                 .apply_if(scroll_offset.x1 < content_size.width, |s| {
                     s.margin_left(0.)
@@ -1356,7 +1363,7 @@ fn editor_tab_content(
                         })
                         .style(move |s| {
                             s.height_full()
-                                .flex_grow(1.0)
+                                .flex_grow(1.0f32)
                                 .flex_basis(0.0)
                                 .border_right(1.0)
                                 .border_color(
@@ -1382,7 +1389,9 @@ fn editor_tab_content(
                         .on_event_cont(EventListener::PointerDown, move |_| {
                             focus_right.set(true);
                         })
-                        .style(|s| s.height_full().flex_grow(1.0).flex_basis(0.0)),
+                        .style(|s| {
+                            s.height_full().flex_grow(1.0f32).flex_basis(0.0)
+                        }),
                         diff_show_more_section_view(
                             &diff_editor_data.left,
                             &diff_editor_data.right,
@@ -2049,7 +2058,7 @@ fn main_split(window_tab_data: Rc<WindowTabData>) -> impl View {
             .background(config.color(LapceColor::EDITOR_BACKGROUND))
             .apply_if(is_hidden, |s| s.display(Display::None))
             .width_full()
-            .flex_grow(1.0)
+            .flex_grow(1.0f32)
             .flex_basis(0.0)
     })
     .debug_name("Main Split")
@@ -2201,7 +2210,7 @@ fn workbench(window_tab_data: Rc<WindowTabData>) -> impl View {
                     main_split_width.set(width);
                 }
             })
-            .style(|s| s.flex_col().flex_grow(1.0))
+            .style(|s| s.flex_col().flex_grow(1.0f32))
         },
         panel_container_view(window_tab_data.clone(), PanelContainerPosition::Right),
         window_message_view(window_tab_data.messages, window_tab_data.common.config),
@@ -2290,7 +2299,7 @@ fn palette_item(
                     .style(move |s| {
                         s.color(config.get().color(LapceColor::EDITOR_DIM))
                             .min_width(0.0)
-                            .flex_grow(1.0)
+                            .flex_grow(1.0f32)
                             .flex_basis(0.0)
                     }),
                 ))
@@ -2357,7 +2366,7 @@ fn palette_item(
                     .style(move |s| {
                         s.color(config.get().color(LapceColor::EDITOR_DIM))
                             .min_width(0.0)
-                            .flex_grow(1.0)
+                            .flex_grow(1.0f32)
                             .flex_basis(0.0)
                     }),
                 ))
@@ -2434,7 +2443,7 @@ fn palette_item(
                     .style(move |s| {
                         s.color(config.get().color(LapceColor::EDITOR_DIM))
                             .min_width(0.0)
-                            .flex_grow(1.0)
+                            .flex_grow(1.0f32)
      
```

**File**: `lapce-app/src/editor/view.rs` (modified, +1/-1)
```diff
@@ -1344,7 +1344,7 @@ pub fn editor_container_view(
             )
             .debug_name("find view"),
         ))
-        .style(|s| s.width_full().flex_basis(0).flex_grow(1.0)),
+        .style(|s| s.width_full().flex_basis(0).flex_grow(1.0f32)),
     ))
     .on_cleanup(move || {
         let editor = editor.get_untracked();
```

**File**: `lapce-app/src/file_explorer/view.rs` (modified, +3/-3)
```diff
@@ -296,7 +296,7 @@ fn file_node_input_view(data: FileExplorerData, err: Option<String>) -> Containe
                         .z_index(100)
                 }),
             ))
-            .style(|s| s.flex_grow(1.0)),
+            .style(|s| s.flex_grow(1.0f32)),
         )
     } else {
         container(text_input_view)
@@ -351,7 +351,7 @@ fn file_explorer_view(
                             Color::TRANSPARENT
                         };
                         s.size(size, size)
-                            .flex_shrink(0.0)
+                            .flex_shrink(0.0f32)
                             .margin_left(10.0)
                             .color(color)
                     }),
@@ -378,7 +378,7 @@ fn file_explorer_view(
                             let size = config.ui.icon_size() as f32;
 
                             s.size(size, size)
-                                .flex_shrink(0.0)
+                                .flex_shrink(0.0f32)
                                 .margin_horiz(6.0)
                                 .apply_if(is_dir, |s| {
                                     s.color(
```

**File**: `lapce-app/src/keymap.rs` (modified, +5/-5)
```diff
@@ -130,7 +130,7 @@ pub fn keymap_view(editors: Editors, common: Rc<CommonData>) -> impl View {
                     s.height_pct(100.0)
                         .min_width(0.0)
                         .flex_basis(0.0)
-                        .flex_grow(1.0)
+                        .flex_grow(1.0f32)
                         .border_right(1.0)
                         .border_color(config.get().color(LapceColor::LAPCE_BORDER))
                 }),
@@ -245,7 +245,7 @@ pub fn keymap_view(editors: Editors, common: Rc<CommonData>) -> impl View {
                     s.height_pct(100.0)
                         .min_width(0.0)
                         .flex_basis(0.0)
-                        .flex_grow(1.0)
+                        .flex_grow(1.0f32)
                 }),
             ))
             .on_click_stop(move |_| {
@@ -301,7 +301,7 @@ pub fn keymap_view(editors: Editors, common: Rc<CommonData>) -> impl View {
                     .height_pct(100.0)
                     .min_width(0.0)
                     .flex_basis(0.0)
-                    .flex_grow(1.0)
+                    .flex_grow(1.0f32)
                     .border_right(1.0)
                     .border_color(config.get().color(LapceColor::LAPCE_BORDER))
             }),
@@ -330,7 +330,7 @@ pub fn keymap_view(editors: Editors, common: Rc<CommonData>) -> impl View {
                     .height_pct(100.0)
                     .min_width(0.0)
                     .flex_basis(0.0)
-                    .flex_grow(1.0)
+                    .flex_grow(1.0f32)
             }),
         ))
         .style(move |s| {
@@ -358,7 +358,7 @@ pub fn keymap_view(editors: Editors, common: Rc<CommonData>) -> impl View {
             )
             .style(|s| s.absolute().size_pct(100.0, 100.0)),
         )
-        .style(|s| s.width_pct(100.0).flex_basis(0.0).flex_grow(1.0)),
+        .style(|s| s.width_pct(100.0).flex_basis(0.0).flex_grow(1.0f32)),
         keyboard_picker_view(picker, common.ui_line_height, config),
     ))
     .style(|s| {
```

**File**: `lapce-app/src/panel/debug_view.rs` (modified, +9/-4)
```diff
@@ -280,7 +280,7 @@ fn debug_processes(
                         })
                     },
                     label(move || p.config.name.clone()).style(|s| {
-                        s.flex_grow(1.0)
+                        s.flex_grow(1.0f32)
                             .flex_basis(0.0)
                             .min_width(0.0)
                             .text_ellipsis()
@@ -448,7 +448,12 @@ fn variables_view(window_tab_data: Rc<WindowTabData>) -> impl View {
         )
         .style(|s| s.absolute().size_full()),
     )
-    .style(|s| s.width_full().line_height(1.6).flex_grow(1.0).flex_basis(0))
+    .style(|s| {
+        s.width_full()
+            .line_height(1.6)
+            .flex_grow(1.0f32)
+            .flex_basis(0)
+    })
 }
 
 fn debug_stack_frames(
@@ -617,7 +622,7 @@ fn debug_stack_traces(
     .style(|s| {
         s.width_pct(100.0)
             .line_height(1.6)
-            .flex_grow(1.0)
+            .flex_grow(1.0f32)
             .flex_basis(0.0)
     })
 }
@@ -712,7 +717,7 @@ fn breakpoints_view(window_tab_data: Rc<WindowTabData>) -> impl View {
                         ),
                         text(folder).style(move |s| {
                             s.text_ellipsis()
-                                .flex_grow(1.0)
+                                .flex_grow(1.0f32)
                                 .flex_basis(0.0)
                                 .color(config.get().color(LapceColor::EDITOR_DIM))
                                 .min_width(0.0)
```

**File**: `lapce-app/src/panel/plugin_view.rs` (modified, +16/-6)
```diff
@@ -154,7 +154,7 @@ fn installed_view(plugin: PluginData) -> impl View {
                     ))
                     .style(|s| {
                         s.justify_between()
-                            .flex_grow(1.0)
+                            .flex_grow(1.0f32)
                             .flex_basis(0.0)
                             .min_width(0.0)
                     }),
@@ -172,7 +172,12 @@ fn installed_view(plugin: PluginData) -> impl View {
                 ))
                 .style(|s| s.width_pct(100.0).items_center()),
             ))
-            .style(|s| s.flex_col().flex_grow(1.0).flex_basis(0.0).min_width(0.0)),
+            .style(|s| {
+                s.flex_col()
+                    .flex_grow(1.0f32)
+                    .flex_basis(0.0)
+                    .min_width(0.0)
+            }),
         ))
         .on_click_stop(move |_| {
             internal_command.send(InternalCommand::OpenVoltView {
@@ -207,7 +212,7 @@ fn installed_view(plugin: PluginData) -> impl View {
     .style(|s| {
         s.width_pct(100.0)
             .line_height(1.6)
-            .flex_grow(1.0)
+            .flex_grow(1.0f32)
             .flex_basis(0.0)
     })
 }
@@ -305,15 +310,20 @@ fn available_view(plugin: PluginData, core_rpc: CoreRpcHandler) -> impl View {
                     label(move || info.author.clone()).style(|s| {
                         s.text_ellipsis()
                             .min_width(0.0)
-                            .flex_grow(1.0)
+                            .flex_grow(1.0f32)
                             .flex_basis(0.0)
                             .selectable(false)
                     }),
                     install_button(id, volt.info, volt.installing),
                 ))
                 .style(|s| s.width_pct(100.0).items_center()),
             ))
-            .style(|s| s.flex_col().flex_grow(1.0).flex_basis(0.0).min_width(0.0)),
+            .style(|s| {
+                s.flex_col()
+                    .flex_grow(1.0f32)
+                    .flex_basis(0.0)
+                    .min_width(0.0)
+            }),
         ))
         .on_click_stop(move |_| {
             internal_command.send(InternalCommand::OpenVoltView {
@@ -400,7 +410,7 @@ fn available_view(plugin: PluginData, core_rpc: CoreRpcHandler) -> impl View {
     .style(|s| {
         s.width_pct(100.0)
             .line_height(1.6)
-            .flex_grow(1.0)
+            .flex_grow(1.0f32)
             .flex_basis(0.0)
             .flex_col()
     })
```

**File**: `lapce-app/src/panel/source_control_view.rs` (modified, +1/-1)
```diff
@@ -266,7 +266,7 @@ fn file_diffs_view(source_control: SourceControlData) -> impl View {
             }),
             label(move || folder.clone()).style(move |s| {
                 s.text_ellipsis()
-                    .flex_grow(1.0)
+                    .flex_grow(1.0f32)
                     .flex_basis(0.0)
                     .color(config.get().color(LapceColor::EDITOR_DIM))
                     .min_width(0.0)
```

---

### Incident Patch 11: `51d43310` (2026-09-01)
**Commit Message**: build: use vendored libgit2 (#3936)

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ clap              = { version = "4.5.0", default-features = false, features = ["
 crossbeam-channel = { version = "0.5.12" }
 directories       = { version = "4.0.1" }
 flate2            = { version = "1.0" }
-git2              = { version = "0.20.0", features = ["vendored-openssl"] }
+git2              = { version = "0.20.0", features = ["vendored-openssl", "vendored-libgit2"] }
 globset           = { version = "0.4.14" }
 hashbrown         = { version = "0.14.5", features = ["serde"] }
 im                = { version = "15.0.0", features = ["serde"] }
```

---

### Incident Patch 12: `15f2f19b` (2026-04-03)
**Commit Message**: fix: remove duplicate issue ref and add missing fixes for v0.4.6 (#3877)

Remove duplicate 3821 entry and add missing 3818 (editor tab
selectability/flickering) and 3819 (cursor style inconsistencies)
which were fixed in v0.4.6 per CHANGELOG.md but absent from the
AppStream metainfo.

**File**: `extra/linux/dev.lapce.lapce.metainfo.xml` (modified, +2/-1)
```diff
@@ -40,7 +40,8 @@
             <issues>
                 <issue url="https://github.com/lapce/lapce/issues/3821">#3821</issue>
                 <issue url="https://github.com/lapce/lapce/issues/3832">#3832</issue>
-                <issue url="https://github.com/lapce/lapce/issues/3821">#3821</issue>
+                <issue url="https://github.com/lapce/lapce/pull/3818">#3818</issue>
+                <issue url="https://github.com/lapce/lapce/pull/3819">#3819</issue>
             </issues>
         </release>
         <release version="0.4.5" date="2025-09-05">
```

---

### Incident Patch 13: `b7ef6f98` (2026-03-26)
**Commit Message**: ci: remove rust 1.94 workaround

**File**: `.github/workflows/ci.yml` (modified, +1/-3)
```diff
@@ -40,7 +40,6 @@ jobs:
 
       - name: Update toolchain
         run: |
-          rustup default 1.93
           rustup update --no-self-update
 
       - name: Cache Rust dependencies
@@ -61,7 +60,7 @@ jobs:
 
       - name: Build as portable
         if: startsWith(matrix.os, 'windows')
-        run: cargo +1.93 build --profile ci --frozen --features lapce-app/portable
+        run: cargo build --profile ci --frozen --features lapce-app/portable
 
       - name: Free space on Windows
         if: startsWith(matrix.os, 'windows')
@@ -96,7 +95,6 @@ jobs:
 
       - name: Update toolchain & add clippy
         run: |
-          rustup default 1.93
           rustup update --no-self-update
           rustup component add clippy
 
```

**File**: `.github/workflows/release.yml` (modified, +0/-3)
```diff
@@ -64,9 +64,6 @@ jobs:
       - name: Update rust
         run: rustup update --no-self-update
 
-      - name: Workaround https://github.com/rust-lang/rust/issues/153486
-        run: rustup default 1.93
-
       - name: Fetch dependencies
         run: cargo fetch --locked
 
```

---

### Incident Patch 14: `30cfb663` (2026-03-13)
**Commit Message**: fix: update floem for gpu fallback, add crash notif on unix

**File**: `Cargo.lock` (modified, +6/-6)
```diff
@@ -1704,7 +1704,7 @@ checksum = "98de4bbd547a563b716d8dfa9aad1cb19bfab00f4fa09a6a4ed21dbcf44ce9c4"
 [[package]]
 name = "floem"
 version = "0.2.0"
-source = "git+https://github.com/lapce/floem?rev=703d22f1de711bf443ba0fae2802de32bbbfc8fd#703d22f1de711bf443ba0fae2802de32bbbfc8fd"
+source = "git+https://github.com/lapce/floem?rev=31fa8f444c37f4c314f47d88c23ffdbc25f2ab53#31fa8f444c37f4c314f47d88c23ffdbc25f2ab53"
 dependencies = [
  "bitflags 2.9.1",
  "clipboard-win",
@@ -1746,7 +1746,7 @@ dependencies = [
 [[package]]
 name = "floem-editor-core"
 version = "0.2.0"
-source = "git+https://github.com/lapce/floem?rev=703d22f1de711bf443ba0fae2802de32bbbfc8fd#703d22f1de711bf443ba0fae2802de32bbbfc8fd"
+source = "git+https://github.com/lapce/floem?rev=31fa8f444c37f4c314f47d88c23ffdbc25f2ab53#31fa8f444c37f4c314f47d88c23ffdbc25f2ab53"
 dependencies = [
  "bitflags 2.9.1",
  "itertools 0.14.0",
@@ -1772,15 +1772,15 @@ dependencies = [
 [[package]]
 name = "floem_reactive"
 version = "0.2.0"
-source = "git+https://github.com/lapce/floem?rev=703d22f1de711bf443ba0fae2802de32bbbfc8fd#703d22f1de711bf443ba0fae2802de32bbbfc8fd"
+source = "git+https://github.com/lapce/floem?rev=31fa8f444c37f4c314f47d88c23ffdbc25f2ab53#31fa8f444c37f4c314f47d88c23ffdbc25f2ab53"
 dependencies = [
  "smallvec",
 ]
 
 [[package]]
 name = "floem_renderer"
 version = "0.2.0"
-source = "git+https://github.com/lapce/floem?rev=703d22f1de711bf443ba0fae2802de32bbbfc8fd#703d22f1de711bf443ba0fae2802de32bbbfc8fd"
+source = "git+https://github.com/lapce/floem?rev=31fa8f444c37f4c314f47d88c23ffdbc25f2ab53#31fa8f444c37f4c314f47d88c23ffdbc25f2ab53"
 dependencies = [
  "cosmic-text",
  "futures",
@@ -1796,7 +1796,7 @@ dependencies = [
 [[package]]
 name = "floem_tiny_skia_renderer"
 version = "0.2.0"
-source = "git+https://github.com/lapce/floem?rev=703d22f1de711bf443ba0fae2802de32bbbfc8fd#703d22f1de711bf443ba0fae2802de32bbbfc8fd"
+source = "git+https://github.com/lapce/floem?rev=31fa8f444c37f4c314f47d88c23ffdbc25f2ab53#31fa8f444c37f4c314f47d88c23ffdbc25f2ab53"
 dependencies = [
  "anyhow",
  "floem_renderer",
@@ -1809,7 +1809,7 @@ dependencies = [
 [[package]]
 name = "floem_vger_renderer"
 version = "0.2.0"
-source = "git+https://github.com/lapce/floem?rev=703d22f1de711bf443ba0fae2802de32bbbfc8fd#703d22f1de711bf443ba0fae2802de32bbbfc8fd"
+source = "git+https://github.com/lapce/floem?rev=31fa8f444c37f4c314f47d88c23ffdbc25f2ab53#31fa8f444c37f4c314f47d88c23ffdbc25f2ab53"
 dependencies = [
  "anyhow",
  "floem-vger",
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -79,13 +79,13 @@ lapce-proxy = { path = "./lapce-proxy" }
 [workspace.dependencies.floem]
 # path = "../floem"
 git = "https://github.com/lapce/floem"
-rev = "703d22f1de711bf443ba0fae2802de32bbbfc8fd"
+rev = "31fa8f444c37f4c314f47d88c23ffdbc25f2ab53"
 features = ["editor", "serde", "default-image-formats", "rfd-async-std"]
 
 [workspace.dependencies.floem-editor-core]
 # path = "../floem/editor-core/"
 git = "https://github.com/lapce/floem"
-rev = "703d22f1de711bf443ba0fae2802de32bbbfc8fd"
+rev = "31fa8f444c37f4c314f47d88c23ffdbc25f2ab53"
 features = ["serde"]
 
 [patch.crates-io]
```

**File**: `lapce-app/src/app.rs` (modified, +4/-2)
```diff
@@ -13,7 +13,7 @@ use std::{
     },
 };
 
-use anyhow::{Result, anyhow};
+use anyhow::{Context, Result, anyhow};
 use clap::Parser;
 use floem::{
     IntoView, View,
@@ -3839,7 +3839,9 @@ pub fn launch() {
     let plugin_paths = Arc::new(cli.plugin_path);
 
     let (tx, rx) = channel();
-    let mut watcher = notify::recommended_watcher(ConfigWatcher::new(tx)).unwrap();
+    let mut watcher = notify::recommended_watcher(ConfigWatcher::new(tx))
+        .context("Failed to spawn file watcher")
+        .unwrap();
     if let Some(path) = LapceConfig::settings_file() {
         if let Err(err) = watcher.watch(&path, notify::RecursiveMode::Recursive) {
             tracing::error!("{:?}", err);
```

**File**: `lapce-app/src/app/logging.rs` (modified, +20/-0)
```diff
@@ -99,6 +99,9 @@ pub(super) fn panic_hook() {
 
         #[cfg(windows)]
         error_modal("Error", &info.to_string());
+
+        #[cfg(unix)]
+        error_notification("Error", &info.to_string());
     }))
 }
 
@@ -131,3 +134,20 @@ pub(super) fn error_modal(title: &str, msg: &str) -> i32 {
 
     result
 }
+
+#[cfg(unix)]
+pub fn error_notification(title: &str, msg: &str) {
+    let res = std::process::Command::new("notify-send")
+        .args([
+            "-a",
+            "dev.lapce.lapce",
+            "-w",
+            "-n",
+            "dev.lapce.lapce",
+            "-c",
+            "error",
+            title,
+            msg,
+        ])
+        .spawn();
+}
```

---

### Incident Patch 15: `80a0e0dd` (2026-03-13)
**Commit Message**: ci: update actions, use separate cargo profile, upload builds

**File**: `.cargo/config.toml` (modified, +5/-0)
```diff
@@ -1,3 +1,8 @@
 # Link runtime statically so Visual C++ Redist is not required
 [target.'cfg(all(windows, target_env = "msvc"))']
 rustflags = ["-C", "target-feature=+crt-static"]
+
+[profile.ci]
+inherits  = "dev"
+opt-level = 0
+debug     = false
```

**File**: `.github/workflows/ci.yml` (modified, +14/-7)
```diff
@@ -32,7 +32,7 @@ jobs:
         os: [ubuntu-latest, macos-latest, windows-latest]
     runs-on: ${{ matrix.os }}
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - name: Install dependencies on Ubuntu
         if: startsWith(matrix.os, 'ubuntu')
@@ -50,24 +50,31 @@ jobs:
         run: cargo fetch --locked
 
       - name: Build
-        run: cargo build --frozen
+        run: cargo build --profile ci --frozen
+
+      - uses: actions/upload-artifact@v4
+        with:
+          name: lapce-${{ matrix.os }}
+          path: |
+            target/ci/lapce*
+          retention-days: 1
 
       - name: Build as portable
         if: startsWith(matrix.os, 'windows')
-        run: cargo +1.93 build --frozen --features lapce-app/portable
+        run: cargo +1.93 build --profile ci --frozen --features lapce-app/portable
 
       - name: Free space on Windows
         if: startsWith(matrix.os, 'windows')
         run: cargo clean
 
       - name: Run doc tests
-        run: cargo test --doc --workspace
+        run: cargo test --profile ci --doc --workspace
 
   fmt:
     name: Rustfmt
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - name: Update toolchain & add rustfmt
         run: |
@@ -85,7 +92,7 @@ jobs:
         os: [ubuntu-latest, windows-latest, macos-latest]
     runs-on: ${{ matrix.os }}
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - name: Update toolchain & add clippy
         run: |
@@ -104,4 +111,4 @@ jobs:
         run: cargo fetch --locked
 
       - name: Run clippy
-        run: cargo clippy
+        run: cargo clippy --profile ci
```

**File**: `.github/workflows/release.yml` (modified, +7/-7)
```diff
@@ -59,7 +59,7 @@ jobs:
         shell: bash
 
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - name: Update rust
         run: rustup update --no-self-update
@@ -113,7 +113,7 @@ jobs:
     env:
       RELEASE_TAG_NAME: ${{ needs.tagname.outputs.tag_name }}
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
       - name: Build deb packages
         run: |
           docker buildx create --driver=docker-container --use
@@ -168,7 +168,7 @@ jobs:
           - os-name: ubuntu
             os-version: plucky
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - name: Build deb packages
         run: |
@@ -196,7 +196,7 @@ jobs:
           - os-name: fedora
             os-version: 43
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - name: Build rpm packages
         run: |
@@ -222,7 +222,7 @@ jobs:
           - os-name: alpine
             os-version: "" # uses latest
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - name: Set up QEMU
         uses: docker/setup-qemu-action@v3
@@ -254,7 +254,7 @@ jobs:
       NOTARIZE_PASSWORD: ${{ secrets.NOTARIZE_PASSWORD }}
 
     steps:
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - name: Install ARM target
         run: rustup update && rustup target add x86_64-apple-darwin
@@ -320,7 +320,7 @@ jobs:
     steps:
       # Must perform checkout first, since it deletes the target directory
       # before running, and would therefore delete the downloaded artifacts
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@v6
 
       - uses: actions/download-artifact@v4
 
```

#### Recent Merged Pull Requests:
- **PR #3936** (2026-09-01): build: use vendored libgit2 (@panekj)
- **PR #3924** (closed): fix: correct issue reference in dev.lapce.lapce.metainfo.xml (#3786) (@ujjwalraj123)
- **PR #3923** (closed): ci: add llhttp-dev to alpine build (@panekj)
- **PR #3918** (closed): feat: add keyboard shortcut to toggle word wrap (@xiangkaiz)
- **PR #3916** (closed): fix: sync deepseek-carp fixes and add LSP smoke example (@juming75)
- **PR #3887** (2026-04-03): chore: were spellcecked nauw (@panekj)
- **PR #3883** (2026-03-26): ci: drop permissions where not needed, use commit hash for actions (@panekj)
- **PR #3881** (closed): ci: remove rust 1.94 workaround (@panekj)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
