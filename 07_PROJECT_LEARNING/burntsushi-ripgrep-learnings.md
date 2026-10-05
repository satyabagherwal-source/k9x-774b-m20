# Forensic Learning Record (Deep Inspection): BurntSushi/ripgrep

> **Canonical Artifact**: `07_PROJECT_LEARNING/burntsushi-ripgrep-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:29:41.774Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `BurntSushi/ripgrep`
- **Description**: ripgrep recursively searches directories for a regex pattern while respecting your gitignore
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 68852 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/core/flags/complete/bash.rs`
```
/*!
Provides completions for ripgrep's CLI for the bash shell.
*/

use crate::flags::defs::FLAGS;

const TEMPLATE_FULL: &'static str = "
_rg() {
  local i cur prev opts cmds
  COMPREPLY=()
  cur=\"${COMP_WORDS[COMP_CWORD]}\"
  prev=\"${COMP_WORDS[COMP_CWORD-1]}\"
  cmd=\"\"
  opts=\"\"

  for i in ${COMP_WORDS[@]}; do
    case \"${i}\" in
      rg)
        cmd=\"rg\"
        ;;
      *)
        ;;
    esac
  done

  case \"${cmd}\" in
    rg)
      opts=\"!OPTS!\"
      if [[ ${cur} == -* || ${COMP_CWORD} -eq 1 ]] ; then
        COMPREPLY=($(compgen -W \"${opts}\" -- \"${cur}\"))
        return 0
      fi
      case \"${prev}\" in
!CASES!
      esac
      COMPREPLY=($(compgen -W \"${opts}\" -- \"${cur}\"))
      return 0
      ;;
  esac
}

complete -F _rg -o bashdefault -o default rg
";

const TEMPLATE_CASE: &'static str = "
        !FLAG!)
          COMPREPLY=($(compgen -f \"${cur}\"))
          return 0
          ;;
";

const TEMPLATE_CASE_CHOICES: &'static str = "
        !FLAG!)
          COMPREPLY=($(compgen -W \"!CHOICES!\" -- \"${cur}\"))
          return 0
          ;;
";

/// Generate completions for Bash.
///
/// Note that these completions are based on what was produced for ripgrep <=13
/// using Clap 2.x. Improvements on this are welcome.
pub(crate) fn generate() -> String {
    let mut opts = String::new();
    for flag in FLAGS.iter() {
        opts.push_str("--");
        opts.push_str(flag.name_long());
        opts.push(' ');
        if let Some(short) = flag.name_short() {
            opts.push('-');
            opts.push(char::from(short));
            opts.push(' ');
        }
        if let Some(name) = flag.name_negated() {
            opts.push_str("--");
            opts.push_str(name);
            opts.push(' ');
        }
    }
    opts.push_str("<PATTERN> <PATH>...");

    let mut cases = String::new();
    for flag in FLAGS.iter() {
        let template = if !flag.doc_choices().is_empty() {
            let choices = flag.doc_choices().join(" ");
            TEMPLATE_CASE_CHOICES.trim_end().replace("!CHOICES!", &choices)
        } else {
            TEMPLATE_CASE.trim_end().to_string()
        };
        let name = format!("--{}", flag.name_long());
        cases.push_str(&template.replace("!FLAG!", &name));
        if let Some(short) = flag.name_short() {
            let name = format!("-{}", char::from(short));
            cases.push_str(&template.replace("!FLAG!", &name));
        }
        if let Some(negated) = flag.name_negated() {
            let name = format!("--{negated}");
            cases.push_str(&template.replace("!FLAG!", &name));
        }
    }

    TEMPLATE_FULL
        .replace("!OPTS!", &opts)
        .replace("!CASES!", &cases)
        .trim_start()
        .to_string()
}

```

### Core Architecture Module: `crates/core/flags/complete/fish.rs`
```
/*!
Provides completions for ripgrep's CLI for the fish shell.
*/

use crate::flags::{CompletionType, defs::FLAGS};

const TEMPLATE: &'static str = "complete -c rg !SHORT! -l !LONG! -d '!DOC!'";
const TEMPLATE_NEGATED: &'static str = "complete -c rg -l !NEGATED! -n '__rg_contains_opt !LONG! !SHORT!' -d '!DOC!'\n";

/// Generate completions for Fish.
///
/// Reference: <https://fishshell.com/docs/current/completions.html>
pub(crate) fn generate() -> String {
    let mut out = String::new();
    out.push_str(include_str!("prelude.fish"));
    out.push('\n');
    for flag in FLAGS.iter() {
        let short = match flag.name_short() {
            None => "".to_string(),
            Some(byte) => format!("-s {}", char::from(byte)),
        };
        let long = flag.name_long();
        let doc = flag.doc_short().replace("'", "\\'");
        let mut completion = TEMPLATE
            .replace("!SHORT!", &short)
            .replace("!LONG!", &long)
            .replace("!DOC!", &doc);

        match flag.completion_type() {
            CompletionType::Filename => {
                completion.push_str(" -r -F");
            }
            CompletionType::Executable => {
                completion.push_str(" -r -f -a '(__fish_complete_command)'");
            }
            CompletionType::Filetype => {
                completion.push_str(
                    " -r -f -a '(rg --type-list | string replace : \\t)'",
                );
            }
            CompletionType::Encoding => {
                completion.push_str(" -r -f -a '");
                completion.push_str(super::ENCODINGS);
                completion.push_str("'");
            }
            CompletionType::Other if !flag.doc_choices().is_empty() => {
                completion.push_str(" -r -f -a '");
                completion.push_str(&flag.doc_choices().join(" "));
                completion.push_str("'");
            }
            CompletionType::Other if !flag.is_switch() => {
                completion.push_str(" -r -f");
            }
            CompletionType::Other => (),
        }

        completion.push('\n');
        out.push_str(&completion);

        if let Some(negated) = flag.name_negated() {
            let short = match flag.name_short() {
                None => "".to_string(),
                Some(byte) => char::from(byte).to_string(),
            };
            out.push_str(
                &TEMPLATE_NEGATED
                    .replace("!NEGATED!", &negated)
                    .replace("!SHORT!", &short)
                    .replace("!LONG!", &long)
                    .replace("!DOC!", &doc),
            );
        }
    }
    out
}

```

### Core Architecture Module: `crates/core/flags/complete/mod.rs`
```
/*!
Modules for generating completions for various shells.
*/

static ENCODINGS: &'static str = include_str!("encodings.sh");

pub(super) mod bash;
pub(super) mod fish;
pub(super) mod powershell;
pub(super) mod zsh;

```

### Core Architecture Module: `crates/core/flags/complete/powershell.rs`
```
/*!
Provides completions for ripgrep's CLI for PowerShell.
*/

use crate::flags::defs::FLAGS;

const TEMPLATE: &'static str = "
using namespace System.Management.Automation
using namespace System.Management.Automation.Language

Register-ArgumentCompleter -Native -CommandName 'rg' -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commandElements = $commandAst.CommandElements
  $command = @(
    'rg'
    for ($i = 1; $i -lt $commandElements.Count; $i++) {
        $element = $commandElements[$i]
        if ($element -isnot [StringConstantExpressionAst] -or
            $element.StringConstantType -ne [StringConstantType]::BareWord -or
            $element.Value.StartsWith('-')) {
            break
    }
    $element.Value
  }) -join ';'

  $completions = @(switch ($command) {
    'rg' {
!FLAGS!
    }
  })

  $completions.Where{ $_.CompletionText -like \"$wordToComplete*\" } |
    Sort-Object -Property ListItemText
}
";

const TEMPLATE_FLAG: &'static str = "[CompletionResult]::new('!DASH_NAME!', '!NAME!', [CompletionResultType]::ParameterName, '!DOC!')";

/// Generate completions for PowerShell.
///
/// Note that these completions are based on what was produced for ripgrep <=13
/// using Clap 2.x. Improvements on this are welcome.
pub(crate) fn generate() -> String {
    let mut flags = String::new();
    for (i, flag) in FLAGS.iter().enumerate() {
        let doc = flag.doc_short().replace("'", "''");

        let dash_name = format!("--{}", flag.name_long());
        let name = flag.name_long();
        if i > 0 {
            flags.push('\n');
        }
        flags.push_str("      ");
        flags.push_str(
            &TEMPLATE_FLAG
                .replace("!DASH_NAME!", &dash_name)
                .replace("!NAME!", &name)
                .replace("!DOC!", &doc),
        );

        if let Some(byte) = flag.name_short() {
            let dash_name = format!("-{}", char::from(byte));
            let name = char::from(byte).to_string();
            flags.push_str("\n      ");
            flags.push_str(
                &TEMPLATE_FLAG
                    .replace("!DASH_NAME!", &dash_name)
                    .replace("!NAME!", &name)
                    .replace("!DOC!", &doc),
            );
        }

        if let Some(negated) = flag.name_negated() {
            let dash_name = format!("--{negated}");
            flags.push_str("\n      ");
            flags.push_str(
                &TEMPLATE_FLAG
                    .replace("!DASH_NAME!", &dash_name)
                    .replace("!NAME!", &negated)
                    .replace("!DOC!", &doc),
            );
        }
    }
    TEMPLATE.trim_start().replace("!FLAGS!", &flags)
}

```

### Core Architecture Module: `crates/core/flags/complete/zsh.rs`
```
/*!
Provides completions for ripgrep's CLI for the zsh shell.

Unlike completion short for other shells (at time of writing), zsh's
completions for ripgrep are maintained by hand. This is because:

1. They are lovingly written by an expert in such things.
2. Are much higher in quality than the ones below that are auto-generated.
Namely, the zsh completions take application level context about flag
compatibility into account.
3. There is a CI script that fails if a new flag is added to ripgrep that
isn't included in the zsh completions.
4. There is a wealth of documentation in the zsh script explaining how it
works and how it can be extended.

In principle, I'd be open to maintaining any completion script by hand so
long as it meets criteria 3 and 4 above.
*/

/// Generate completions for zsh.
pub(crate) fn generate() -> String {
    let hyperlink_alias_descriptions = grep::printer::hyperlink_aliases()
        .iter()
        .map(|alias| {
            format!(r#"    {}:"{}""#, alias.name(), alias.description())
        })
        .collect::<Vec<String>>()
        .join("\n");
    include_str!("rg.zsh")
        .replace("!ENCODINGS!", super::ENCODINGS.trim_end())
        .replace("!HYPERLINK_ALIASES!", &hyperlink_alias_descriptions)
}

```

### Core Architecture Module: `crates/core/flags/config.rs`
```
/*!
This module provides routines for reading ripgrep config "rc" files.

The primary output of these routines is a sequence of arguments, where each
argument corresponds precisely to one shell argument.
*/

use std::{
    ffi::OsString,
    path::{Path, PathBuf},
};

use bstr::{ByteSlice, io::BufReadExt};

/// Return a sequence of arguments derived from ripgrep rc configuration files.
pub fn args() -> Vec<OsString> {
    let config_path = match std::env::var_os("RIPGREP_CONFIG_PATH") {
        None => {
            log::debug!(
                "RIPGREP_CONFIG_PATH environment variable is not set, \
                 therefore not reading any config file"
            );
            return vec![];
        }
        Some(config_path) => {
            if config_path.is_empty() {
                return vec![];
            }
            PathBuf::from(config_path)
        }
    };
    let (args, errs) = match parse(&config_path) {
        Ok((args, errs)) => (args, errs),
        Err(err) => {
            message!(
                "failed to read the file specified in RIPGREP_CONFIG_PATH: {}",
                err
            );
            return vec![];
        }
    };
    if !errs.is_empty() {
        for err in errs {
            message!("{}:{}", config_path.display(), err);
        }
    }
    log::debug!(
        "{}: arguments loaded from config file: {:?}",
        config_path.display(),
        args
    );
    args
}

/// Parse a single ripgrep rc file from the given path.
///
/// On success, this returns a set of shell arguments, in order, that should
/// be pre-pended to the arguments given to ripgrep at the command line.
///
/// If the file could not be read, then an error is returned. If there was
/// a problem parsing one or more lines in the file, then errors are returned
/// for each line in addition to successfully parsed arguments.
fn parse<P: AsRef<Path>>(
    path: P,
) -> anyhow::Result<(Vec<OsString>, Vec<anyhow::Error>)> {
    let path = path.as_ref();
    match std::fs::File::open(&path) {
        Ok(file) => parse_reader(file),
        Err(err) => anyhow::bail!("{}: {}", path.display(), err),
    }
}

/// Parse a single ripgrep rc file from the given reader.
///
/// Callers should not provided a buffered reader, as this routine will use its
/// own buffer internally.
///
/// On success, this returns a set of shell arguments, in order, that should
/// be pre-pended to the arguments given to ripgrep at the command line.
///
/// If the reader could not be read, then an error is returned. If there was a
/// problem parsing one or more lines, then errors are returned for each line
/// in addition to successfully parsed arguments.
fn parse_reader<R: std::io::Read>(
    rdr: R,
) -> anyhow::Result<(Vec<OsString>, Vec<anyhow::Error>)> {
    let mut bufrdr = std::io::BufReader::new(rdr);
    let (mut args, mut errs) = (vec![], vec![]);
    let mut line_number = 0;
    bufrdr.for_byte_line_with_terminator(|line| {
        line_number += 1;

        let line = line.trim();
        if line.is_empty() || line[0] == b'#' {
            return Ok(true);
        }
        match line.to_os_str() {
            Ok(osstr) => {
                args.push(osstr.to_os_string());
            }
            Err(err) => {
                errs.push(anyhow::anyhow!("{line_number}: {err}"));
            }
        }
        Ok(true)
    })?;
    Ok((args, errs))
}

#[cfg(test)]
mod tests {
    use super::parse_reader;
    use std::ffi::OsString;

    #[test]
    fn basic() {
        let (args, errs) = parse_reader(
            &b"\
# Test
--context=0
   --smart-case
-u


   # --bar
--foo
"[..],
        )
        .unwrap();
        assert!(errs.is_empty());
        let args: Vec<String> =
            args.into_iter().map(|s| s.into_string().unwrap()).collect();
        assert_eq!(args, vec!["--context=0", "--smart-case", "-u", "--foo",]);
    }

    // We test that we can handle invalid UTF-8 on Unix-like systems.
    #[test]
    #[cfg(unix)]
    fn error() {
        use std::os::unix::ffi::OsStringExt;

        let (args, errs) = parse_reader(
            &b"\
quux
foo\xFFbar
baz
"[..],
        )
        .unwrap();
        assert!(errs.is_empty());
        assert_eq!(
            args,
            vec![
                OsString::from("quux"),
                OsString::from_vec(b"foo\xFFbar".to_vec()),
                OsString::from("baz"),
            ]
        );
    }

    // ... but test that invalid UTF-8 fails on Windows.
    #[test]
    #[cfg(not(unix))]
    fn error() {
        let (args, errs) = parse_reader(
            &b"\
quux
foo\xFFbar
baz
"[..],
        )
        .unwrap();
        assert_eq!(errs.len(), 1);
        assert_eq!(args, vec![OsString::from("quux"), OsString::from("baz"),]);
    }
}

```

### Core Architecture Module: `crates/core/flags/defs.rs`
```
/*!
Defines all of the flags available in ripgrep.

Each flag corresponds to a unit struct with a corresponding implementation
of `Flag`. Note that each implementation of `Flag` might actually have many
possible manifestations of the same "flag." That is, each implementation of
`Flag` can have the following flags available to an end user of ripgrep:

* The long flag name.
* An optional short flag name.
* An optional negated long flag name.
* An arbitrarily long list of aliases.

The idea is that even though there are multiple flags that a user can type,
one implementation of `Flag` corresponds to a single _logical_ flag inside of
ripgrep. For example, `-E`, `--encoding` and `--no-encoding` all manipulate the
same encoding state in ripgrep.
*/

use std::{path::PathBuf, sync::LazyLock};

use {anyhow::Context as AnyhowContext, bstr::ByteVec};

use crate::flags::{
    Category, Flag, FlagValue,
    lowargs::{
        BinaryMode, BoundaryMode, BufferMode, CaseMode, ColorChoice,
        ContextMode, EncodingMode, EngineChoice, GenerateMode, IndexMode,
        LoggingMode, LowArgs, MmapMode, Mode, PatternSource, SearchMode,
        SortMode, SortModeKind, SpecialMode, TypeChange,
    },
};

#[cfg(test)]
use crate::flags::parse::parse_low_raw;

use super::CompletionType;

/// A list of all flags in ripgrep via implementations of `Flag`.
///
/// The order of these flags matter. It determines the order of the flags in
/// the generated documentation (`-h`, `--help` and the man page) within each
/// category. (This is why the deprecated flags are last.)
pub(super) const FLAGS: &[&dyn Flag] = &[
    // -e/--regexp and -f/--file should come before anything else in the
    // same category.
    &Regexp,
    &File,
    &AfterContext,
    &BeforeContext,
    &Binary,
    &BlockBuffered,
    &ByteOffset,
    &CaseSensitive,
    &Color,
    &Colors,
    &Column,
    &Context,
    &ContextSeparator,
    &Count,
    &CountMatches,
    &Crlf,
    &Debug,
    &DfaSizeLimit,
    &Encoding,
    &Engine,
    &FieldContextSeparator,
    &FieldMatchSeparator,
    &Files,
    &FilesWithMatches,
    &FilesWithoutMatch,
    &FixedStrings,
    &Follow,
    &Generate,
    &Glob,
    &GlobCaseInsensitive,
    &Heading,
    &Help,
    &Hidden,
    &HostnameBin,
    &HyperlinkFormat,
    &IGlob,
    &IgnoreCase,
    &IgnoreFile,
    &IgnoreFileCaseInsensitive,
    &IncludeZero,
    &Index,
    &IndexCrud,
    &IndexForce,
    &IndexPath,
    &InvertMatch,
    &JSON,
    &LineBuffered,
    &LineNumber,
    &LineNumberNo,
    &LineRegexp,
    &MaxColumns,
    &MaxColumnsPreview,
    &MaxCount,
    &MaxDepth,
    &MaxFilesize,
    &Mmap,
    &Multiline,
    &MultilineDotall,
    &NoConfig,
    &NoIgnore,
    &NoIgnoreDot,
    &NoIgnoreExclude,
    &NoIgnoreFiles,
    &NoIgnoreGlobal,
    &NoIgnoreMessages,
    &NoIgnoreParent,
    &NoIgnoreVcs,
    &NoMessages,
    &NoRequireGit,
    &NoUnicode,
    &Null,
    &NullData,
    &OneFileSystem,
    &OnlyMatching,
    &PathSeparator,
    &Passthru,
    &PCRE2,
    &PCRE2Version,
    &Pre,
    &PreGlob,
    &Pretty,
    &Quiet,
    &RegexSizeLimit,
    &Replace,
    &SearchZip,
    &SmartCase,
    &Sort,
    &Sortr,
    &Stats,
    &StopOnNonmatch,
    &Text,
    &Threads,
    &Trace,
    &Trim,
    &Type,
    &TypeNot,
    &TypeAdd,
    &TypeClear,
    &TypeList,
    &Unrestricted,
    &Version,
    &Vimgrep,
    &WithFilename,
    &WithFilenameNo,
    &WordRegexp,
    // DEPRECATED (make them show up last in their respective categories)
    &AutoHybridRegex,
    &NoPcre2Unicode,
    &SortFiles,
];

impl LowArgs {
    /// Returns a flag that does not support indexing, if it's enabled.
    ///
    /// If there aren't any flags enabled that don't support indexing, then
    /// `None` is returned.
    ///
    /// The idea of this routine is to start out very paranoid about what is
    /// allowed to be used when indexing is enabled. Ideally, most or all of
    /// these would eventually become supported.
    pub(super) fn indexing_unsupported_flag(
        &self,
    ) -> Option<&'static dyn Flag> {
        if matches!(self.mode, Mode::Search(SearchMode::FilesWithoutMatch)) {
            return Some(&FilesWithoutMatch);
        }
        if matches!(self.binary, BinaryMode::AsText) {
            return Some(&Binary);
        }
        if !matches!(self.encoding, EncodingMode::Auto) {
            return Some(&Encoding);
        }
        if matches!(self.engine, EngineChoice::PCRE2) {
            return Some(&Engine);
        }
        if self.follow {
            return Some(&Follow);
        }
        if !self.globs.is_empty() {
            return Some(&Glob);
        }
        if self.hidden {
            return Some(&Hidden);
        }
        if !self.iglobs.is_empty() {
            return Some(&Glob);
        }
        if !self.ignore_file.is_empty() {
            return Some(&IgnoreFile);
        }
        if self.no_ignore_dot {
            return Some(&NoIgnoreDot);
        }
        if self.no_ignore_exclude {
            return Some(&NoIgnoreExclude);
        }
        if self.no_ignore_files {
            return Some(&NoIgnoreFiles);
        }
        if self.no_ignore_global {
            return Some(&NoIgnoreGlobal);
        }
        if self.no_ignore_parent {
            return Some(&NoIgnoreParent);
        }
        if self.no_ignore_vcs {
            return Some(&NoIgnoreVcs);
        }
        if self.no_require_git {
            return Some(&NoRequireGit);
        }
        if self.one_file_system {
            return Some(&OneFileSystem);
        }
        if self.pre.is_some() {
            return Some(&Pre);
        }
        if self.search_zip {
            return Some(&SearchZip);
        }
        None
    }
}

/// -A/--after-context
#[derive(Debug)]
struct AfterContext;

impl Flag for AfterContext {
    fn is_switch(&self) -> bool {
        false
    }
    fn name_short(&self) -> Option<u8> {
        Some(b'A')
    }
    fn name_long(&self) -> &'static str {
        "after-context"
    }
    fn doc_variable(&self) -> Option<&'static str> {
        Some("NUM")
    }
    fn doc_category(&self) -> Category {
        Category::Output
    }
    fn doc_short(&self) -> &'static str {
        "Show NUM lines after each match."
    }
    fn doc_long(&self) -> &'static str {
        r"
Show \fINUM\fP lines after each match.
.sp
This overrides the \flag{passthru} flag and partially overrides the
\flag{context} flag.
"
    }

    fn update(&self, v: FlagValue, args: &mut LowArgs) -> anyhow::Result<()> {
        args.context.set_after(convert::usize(&v.unwrap_value())?);
        Ok(())
    }
}

#[cfg(test)]
#[test]
fn test_after_context() {
    let mkctx = |lines| {
        let mut mode = ContextMode::default();
        mode.set_after(lines);
        mode
    };

    let args = parse_low_raw(None::<&str>).unwrap();
    assert_eq!(ContextMode::default(), args.context);

    let args = parse_low_raw(["--after-context", "5"]).unwrap();
    assert_eq!(mkctx(5), args.context);

    let args = parse_low_raw(["--after-context=5"]).unwrap();
    assert_eq!(mkctx(5), args.context);

    let args = parse_low_raw(["-A", "5"]).unwrap();
    assert_eq!(mkctx(5), args.context);

    let args = parse_low_raw(["-A5"]).unwrap();
    assert_eq!(mkctx(5), args.context);

    let args = parse_low_raw(["-A5", "-A10"]).unwrap();
    assert_eq!(mkctx(10), args.context);

    let args = parse_low_raw(["-A5", "-A0"]).unwrap();
    assert_eq!(mkctx(0), args.context);

    let args = parse_low_raw(["-A5", "--passthru"]).unwrap();
    assert_eq!(ContextMode::Passthru, args.context);

    let args = parse_low_raw(["--passthru", "-A5"]).unwrap();
    assert_eq!(mkctx(5), args.context);

    let n = usize::MAX.to_string();
    let args = parse_low_raw(["--after-context", n.as_str()]).unwrap();
    assert_eq!(mkctx(usize::MAX), args.context);

    #[cfg(target_pointer_width = "64")]
    {
        let n = (u128::from(u64::MAX) + 1).to_string();
        let result = parse_low_raw(["--after-context", n.as_str()]);
        assert!(result.is_err(), "{result:?}");
    }
}

/// --auto-hybrid-regex
#[derive(Debug)]
struct AutoHybridRegex;

impl Flag for AutoHybridRegex {
    fn is_switch(&self) -> bool {
        true
    }
    fn name_long(&self) -> &'static str {
        "auto-hybrid-regex"
    }
    fn name_negated(&self) -> Option<&'static str> {
        Some("no-auto-hybrid-regex")
    }
    fn doc_category(&self) -> Category {
        Category::Search
    }
    fn doc_short(&self) -> &'static str {
        "(DEPRECATED) Use PCRE2 if appropriate."
    }
    fn doc_long(&self) -> &'static str {
        r"
DEPRECATED. Use \flag{engine} instead.
.sp
When this flag is used, ripgrep will dynamically choose between supported regex
engines depending on the features used in a pattern. When ripgrep chooses a
regex engine, it applies that choice for every regex provided to ripgrep (e.g.,
via multiple \flag{regexp} or \flag{file} flags).
.sp
As an example of how this flag might behave, ripgrep will attempt to use
its default finite automata based regex engine whenever the pattern can be
successfully compiled with that regex engine. If PCRE2 is enabled and if the
pattern given could not be compiled with the default regex engine, then PCRE2
will be automatically used for searching. If PCRE2 isn't available, then this
flag has no effect because there is only one regex engine to choose from.
.sp
In the future, ripgrep may adjust its heuristics for how it decides which
regex engine to use. In general, the heuristics will be limited to a static
analysis of the patterns, and not to any specific runtime behavior observed
while searching files.
.sp
The primary downside of using this flag is that it may not always be obvious
which regex engine ripgrep uses, and thus, the match semantics or performance
profile of ripgrep may subtly and unexpectedly change. However, in many cases,
all regex engines will agree on what constitutes a match and it can 
```

### Core Architecture Module: `crates/core/flags/doc/help.rs`
```
/*!
Provides routines for generating ripgrep's "short" and "long" help
documentation.

The short version is used when the `-h` flag is given, while the long version
is used when the `--help` flag is given.
*/

use std::{collections::BTreeMap, fmt::Write};

use crate::flags::{Category, Flag, defs::FLAGS, doc::version};

const TEMPLATE_SHORT: &'static str = include_str!("template.short.help");
const TEMPLATE_LONG: &'static str = include_str!("template.long.help");

/// Wraps `std::write!` and asserts there is no failure.
///
/// We only write to `String` in this module.
macro_rules! write {
    ($($tt:tt)*) => { std::write!($($tt)*).unwrap(); }
}

/// Generate short documentation, i.e., for `-h`.
pub(crate) fn generate_short() -> String {
    let mut cats: BTreeMap<Category, (Vec<String>, Vec<String>)> =
        BTreeMap::new();
    let (mut maxcol1, mut maxcol2) = (0, 0);
    for flag in FLAGS.iter().copied() {
        let columns =
            cats.entry(flag.doc_category()).or_insert((vec![], vec![]));
        let (col1, col2) = generate_short_flag(flag);
        maxcol1 = maxcol1.max(col1.len());
        maxcol2 = maxcol2.max(col2.len());
        columns.0.push(col1);
        columns.1.push(col2);
    }
    let mut out =
        TEMPLATE_SHORT.replace("!!VERSION!!", &version::generate_digits());
    for (cat, (col1, col2)) in cats.iter() {
        let var = format!("!!{name}!!", name = cat.as_str());
        if !cfg!(feature = "unstable-index")
            && matches!(cat, crate::flags::Category::Indexing)
        {
            out = out.replace(
                &var,
                &format!("  {}", crate::flags::INDEXING_NOT_SUPPORTED),
            );
        } else {
            let val = format_short_columns(col1, col2, maxcol1, maxcol2);
            out = out.replace(&var, &val);
        }
    }
    out
}

/// Generate short for a single flag.
///
/// The first element corresponds to the flag name while the second element
/// corresponds to the documentation string.
fn generate_short_flag(flag: &dyn Flag) -> (String, String) {
    let (mut col1, mut col2) = (String::new(), String::new());

    // Some of the variable names are fine for longer form
    // docs, but they make the succinct short help very noisy.
    // So just shorten some of them.
    let var = flag.doc_variable().map(|s| {
        let mut s = s.to_string();
        s = s.replace("SEPARATOR", "SEP");
        s = s.replace("REPLACEMENT", "TEXT");
        s = s.replace("NUM+SUFFIX?", "NUM");
        s
    });

    // Generate the first column, the flag name.
    if let Some(byte) = flag.name_short() {
        let name = char::from(byte);
        write!(col1, r"-{name}");
        write!(col1, r", ");
    }
    write!(col1, r"--{name}", name = flag.name_long());
    if let Some(var) = var.as_ref() {
        write!(col1, r"={var}");
    }

    // And now the second column, with the description.
    write!(col2, "{}", flag.doc_short());

    (col1, col2)
}

/// Write two columns of documentation.
///
/// `maxcol1` should be the maximum length (in bytes) of the first column,
/// while `maxcol2` should be the maximum length (in bytes) of the second
/// column.
fn format_short_columns(
    col1: &[String],
    col2: &[String],
    maxcol1: usize,
    _maxcol2: usize,
) -> String {
    assert_eq!(col1.len(), col2.len(), "columns must have equal length");
    const PAD: usize = 2;
    let mut out = String::new();
    for (i, (c1, c2)) in col1.iter().zip(col2.iter()).enumerate() {
        if i > 0 {
            write!(out, "\n");
        }

        let pad = maxcol1 - c1.len() + PAD;
        write!(out, "  ");
        write!(out, "{c1}");
        write!(out, "{}", " ".repeat(pad));
        write!(out, "{c2}");
    }
    out
}

/// Generate long documentation, i.e., for `--help`.
pub(crate) fn generate_long() -> String {
    let mut cats = BTreeMap::new();
    for flag in FLAGS.iter().copied() {
        let mut cat = cats.entry(flag.doc_category()).or_insert(String::new());
        if !cat.is_empty() {
            write!(cat, "\n\n");
        }
        generate_long_flag(flag, &mut cat);
    }

    let mut out =
        TEMPLATE_LONG.replace("!!VERSION!!", &version::generate_digits());
    for (cat, value) in cats.iter() {
        let var = format!("!!{name}!!", name = cat.as_str());
        if !cfg!(feature = "unstable-index")
            && matches!(cat, crate::flags::Category::Indexing)
        {
            out = out.replace(
                &var,
                &format!("    {}", crate::flags::INDEXING_NOT_SUPPORTED),
            );
        } else {
            out = out.replace(&var, value);
        }
    }
    out
}

/// Write generated documentation for `flag` to `out`.
fn generate_long_flag(flag: &dyn Flag, out: &mut String) {
    if let Some(byte) = flag.name_short() {
        let name = char::from(byte);
        write!(out, r"    -{name}");
        if let Some(var) = flag.doc_variable() {
            write!(out, r" {var}");
        }
        write!(out, r", ");
    } else {
        write!(out, r"    ");
    }

    let name = flag.name_long();
    write!(out, r"--{name}");
    if let Some(var) = flag.doc_variable() {
        write!(out, r"={var}");
    }
    write!(out, "\n");

    let doc = flag.doc_long().trim();
    let doc = super::render_custom_markup(doc, "flag", |name, out| {
        let Some(flag) = crate::flags::parse::lookup(name) else {
            unreachable!(r"found unrecognized \flag{{{name}}} in --help docs")
        };
        if let Some(name) = flag.name_short() {
            write!(out, r"-{}/", char::from(name));
        }
        write!(out, r"--{}", flag.name_long());
    });
    let doc = super::render_custom_markup(&doc, "flag-negate", |name, out| {
        let Some(flag) = crate::flags::parse::lookup(name) else {
            unreachable!(
                r"found unrecognized \flag-negate{{{name}}} in --help docs"
            )
        };
        let Some(name) = flag.name_negated() else {
            let long = flag.name_long();
            unreachable!(
                "found \\flag-negate{{{long}}} in --help docs but \
                 {long} does not have a negation"
            );
        };
        write!(out, r"--{name}");
    });

    let mut cleaned = remove_roff(&doc);
    if let Some(negated) = flag.name_negated() {
        // Flags that can be negated that aren't switches, like
        // --context-separator, are somewhat weird. Because of that, the docs
        // for those flags should discuss the semantics of negation explicitly.
        // But for switches, the behavior is always the same.
        if flag.is_switch() {
            write!(cleaned, "\n\nThis flag can be disabled with --{negated}.");
        }
    }
    let indent = " ".repeat(8);
    let wrapopts = textwrap::Options::new(71)
        // Normally I'd be fine with breaking at hyphens, but ripgrep's docs
        // includes a lot of flag names, and they in turn contain hyphens.
        // Breaking flag names across lines is not great.
        .word_splitter(textwrap::WordSplitter::NoHyphenation);
    for (i, paragraph) in cleaned.split("\n\n").enumerate() {
        if i > 0 {
            write!(out, "\n\n");
        }
        let mut new = paragraph.to_string();
        if paragraph.lines().all(|line| line.starts_with("    ")) {
            // Re-indent but don't refill so as to preserve line breaks
            // in code/shell example snippets.
            new = textwrap::indent(&new, &indent);
        } else {
            new = new.replace("\n", " ");
            new = textwrap::refill(&new, &wrapopts);
            new = textwrap::indent(&new, &indent);
        }
        write!(out, "{}", new.trim_end());
    }
}

/// Removes roff syntax from `v` such that the result is approximately plain
/// text readable.
///
/// This is basically a mish mash of heuristics based on the specific roff used
/// in the docs for the flags in this tool. If new kinds of roff are used in
/// the docs, then this may need to be updated to handle them.
fn remove_roff(v: &str) -> String {
    let mut lines = vec![];
    for line in v.trim().lines() {
        assert!(!line.is_empty(), "roff should have no empty lines");
        if line.starts_with(".") {
            if line.starts_with(".IP ") {
                let item_label = line
                    .split(" ")
                    .nth(1)
                    .expect("first argument to .IP")
                    .replace(r"\(bu", r"•")
                    .replace(r"\fB", "")
                    .replace(r"\fP", ":");
                lines.push(format!("{item_label}"));
            } else if line.starts_with(".IB ") || line.starts_with(".BI ") {
                let pieces = line
                    .split_whitespace()
                    .skip(1)
                    .collect::<Vec<_>>()
                    .concat();
                lines.push(format!("{pieces}"));
            } else if line.starts_with(".sp")
                || line.starts_with(".PP")
                || line.starts_with(".TP")
            {
                lines.push("".to_string());
            }
        } else if line.starts_with(r"\fB") && line.ends_with(r"\fP") {
            let line = line.replace(r"\fB", "").replace(r"\fP", "");
            lines.push(format!("{line}:"));
        } else {
            lines.push(line.to_string());
        }
    }
    // Squash multiple adjacent paragraph breaks into one.
    lines.dedup_by(|l1, l2| l1.is_empty() && l2.is_empty());
    lines
        .join("\n")
        .replace(r"\fB", "")
        .replace(r"\fI", "")
        .replace(r"\fP", "")
        .replace(r"\-", "-")
        .replace(r"\\", r"\")
}

```

### Core Architecture Module: `crates/core/flags/doc/man.rs`
```
/*!
Provides routines for generating ripgrep's man page in `roff` format.
*/

use std::{collections::BTreeMap, fmt::Write};

use crate::flags::{Flag, defs::FLAGS, doc::version};

const TEMPLATE: &'static str = include_str!("template.rg.1");

/// Wraps `std::write!` and asserts there is no failure.
///
/// We only write to `String` in this module.
macro_rules! write {
    ($($tt:tt)*) => { std::write!($($tt)*).unwrap(); }
}

/// Wraps `std::writeln!` and asserts there is no failure.
///
/// We only write to `String` in this module.
macro_rules! writeln {
    ($($tt:tt)*) => { std::writeln!($($tt)*).unwrap(); }
}

/// Returns a `roff` formatted string corresponding to ripgrep's entire man
/// page.
pub(crate) fn generate() -> String {
    let mut cats = BTreeMap::new();
    for flag in FLAGS.iter().copied() {
        let mut cat = cats.entry(flag.doc_category()).or_insert(String::new());
        if !cat.is_empty() {
            writeln!(cat, ".sp");
        }
        generate_flag(flag, &mut cat);
    }

    let mut out = TEMPLATE.replace("!!VERSION!!", &version::generate_digits());
    for (cat, value) in cats.iter() {
        let var = format!("!!{name}!!", name = cat.as_str());
        if !cfg!(feature = "unstable-index")
            && matches!(cat, crate::flags::Category::Indexing)
        {
            out = out.replace(&var, crate::flags::INDEXING_NOT_SUPPORTED);
        } else {
            out = out.replace(&var, value);
        }
    }
    out
}

/// Writes `roff` formatted documentation for `flag` to `out`.
fn generate_flag(flag: &'static dyn Flag, out: &mut String) {
    if let Some(byte) = flag.name_short() {
        let name = char::from(byte);
        write!(out, r"\fB\-{name}\fP");
        if let Some(var) = flag.doc_variable() {
            write!(out, r" \fI{var}\fP");
        }
        write!(out, r", ");
    }

    let name = flag.name_long().replace("-", r"\-");
    write!(out, r"\fB\-\-{name}\fP");
    if let Some(var) = flag.doc_variable() {
        write!(out, r"=\fI{var}\fP");
    }
    write!(out, "\n");

    writeln!(out, ".RS 4");
    let doc = flag.doc_long().trim();
    // Convert \flag{foo} into something nicer.
    let doc = super::render_custom_markup(doc, "flag", |name, out| {
        let Some(flag) = crate::flags::parse::lookup(name) else {
            unreachable!(r"found unrecognized \flag{{{name}}} in roff docs")
        };
        out.push_str(r"\fB");
        if let Some(name) = flag.name_short() {
            write!(out, r"\-{}/", char::from(name));
        }
        write!(out, r"\-\-{}", flag.name_long().replace("-", r"\-"));
        out.push_str(r"\fP");
    });
    // Convert \flag-negate{foo} into something nicer.
    let doc = super::render_custom_markup(&doc, "flag-negate", |name, out| {
        let Some(flag) = crate::flags::parse::lookup(name) else {
            unreachable!(
                r"found unrecognized \flag-negate{{{name}}} in roff docs"
            )
        };
        let Some(name) = flag.name_negated() else {
            let long = flag.name_long();
            unreachable!(
                "found \\flag-negate{{{long}}} in roff docs but \
                 {long} does not have a negation"
            );
        };
        out.push_str(r"\fB");
        write!(out, r"\-\-{name}");
        out.push_str(r"\fP");
    });
    writeln!(out, "{doc}");
    if let Some(negated) = flag.name_negated() {
        // Flags that can be negated that aren't switches, like
        // --context-separator, are somewhat weird. Because of that, the docs
        // for those flags should discuss the semantics of negation explicitly.
        // But for switches, the behavior is always the same.
        if flag.is_switch() {
            writeln!(out, ".sp");
            writeln!(
                out,
                r"This flag can be disabled with \fB\-\-{negated}\fP."
            );
        }
    }
    writeln!(out, ".RE");
}

```

### Core Architecture Module: `crates/core/flags/doc/mod.rs`
```
/*!
Modules for generating documentation for ripgrep's flags.
*/

pub(crate) mod help;
pub(crate) mod man;
pub(crate) mod version;

/// Searches for `\tag{...}` occurrences in `doc` and calls `replacement` for
/// each such tag found.
///
/// The first argument given to `replacement` is the tag value, `...`. The
/// second argument is the buffer that accumulates the full replacement text.
///
/// Since this function is only intended to be used on doc strings written into
/// the program source code, callers should panic in `replacement` if there are
/// any errors or unexpected circumstances.
fn render_custom_markup(
    mut doc: &str,
    tag: &str,
    mut replacement: impl FnMut(&str, &mut String),
) -> String {
    let mut out = String::with_capacity(doc.len());
    let tag_prefix = format!(r"\{tag}{{");
    while let Some(offset) = doc.find(&tag_prefix) {
        out.push_str(&doc[..offset]);

        let start = offset + tag_prefix.len();
        let Some(end) = doc[start..].find('}').map(|i| start + i) else {
            unreachable!(r"found {tag_prefix} without closing }}");
        };
        let name = &doc[start..end];
        replacement(name, &mut out);
        doc = &doc[end + 1..];
    }
    out.push_str(doc);
    out
}

```

### Core Architecture Module: `crates/core/flags/doc/version.rs`
```
/*!
Provides routines for generating version strings.

Version strings can be just the digits, an overall short one-line description
or something more verbose that includes things like CPU target feature support.
*/

use std::fmt::Write;

/// Generates just the numerical part of the version of ripgrep.
///
/// This includes the git revision hash.
pub(crate) fn generate_digits() -> String {
    let semver = option_env!("CARGO_PKG_VERSION").unwrap_or("N/A");
    match option_env!("RIPGREP_BUILD_GIT_HASH") {
        None => semver.to_string(),
        Some(hash) => format!("{semver} (rev {hash})"),
    }
}

/// Generates a short version string of the form `ripgrep x.y.z`.
pub(crate) fn generate_short() -> String {
    let digits = generate_digits();
    format!("ripgrep {digits}")
}

/// Generates a longer multi-line version string.
///
/// This includes not only the version of ripgrep but some other information
/// about its build. For example, SIMD support and PCRE2 support.
pub(crate) fn generate_long() -> String {
    let (compile, runtime) = (compile_cpu_features(), runtime_cpu_features());

    let mut out = String::new();
    writeln!(out, "{}", generate_short()).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "features:{}", features().join(",")).unwrap();
    if !compile.is_empty() {
        writeln!(out, "simd(compile):{}", compile.join(",")).unwrap();
    }
    if !runtime.is_empty() {
        writeln!(out, "simd(runtime):{}", runtime.join(",")).unwrap();
    }
    let (pcre2_version, _) = generate_pcre2();
    writeln!(out, "\n{pcre2_version}").unwrap();
    out
}

/// Generates multi-line version string with PCRE2 information.
///
/// This also returns whether PCRE2 is actually available in this build of
/// ripgrep.
pub(crate) fn generate_pcre2() -> (String, bool) {
    let mut out = String::new();

    #[cfg(feature = "pcre2")]
    {
        use grep::pcre2;

        let (major, minor) = pcre2::version();
        write!(out, "PCRE2 {}.{} is available", major, minor).unwrap();
        if cfg!(target_pointer_width = "64") && pcre2::is_jit_available() {
            writeln!(out, " (JIT is available)").unwrap();
        } else {
            writeln!(out, " (JIT is unavailable)").unwrap();
        }
        (out, true)
    }

    #[cfg(not(feature = "pcre2"))]
    {
        writeln!(out, "PCRE2 is not available in this build of ripgrep.")
            .unwrap();
        (out, false)
    }
}

/// Returns the relevant SIMD features supported by the CPU at runtime.
///
/// This is kind of a dirty violation of abstraction, since it assumes
/// knowledge about what specific SIMD features are being used by various
/// components.
fn runtime_cpu_features() -> Vec<String> {
    #[cfg(target_arch = "x86_64")]
    {
        let mut features = vec![];

        let sse2 = is_x86_feature_detected!("sse2");
        features.push(format!("{sign}SSE2", sign = sign(sse2)));

        let ssse3 = is_x86_feature_detected!("ssse3");
        features.push(format!("{sign}SSSE3", sign = sign(ssse3)));

        let avx2 = is_x86_feature_detected!("avx2");
        features.push(format!("{sign}AVX2", sign = sign(avx2)));

        features
    }
    #[cfg(target_arch = "aarch64")]
    {
        let mut features = vec![];

        // memchr and aho-corasick only use NEON when it is available at
        // compile time. This isn't strictly necessary, but NEON is supposed
        // to be available for all aarch64 targets. If this isn't true, please
        // file an issue at https://github.com/BurntSushi/memchr.
        let neon = cfg!(target_feature = "neon");
        features.push(format!("{sign}NEON", sign = sign(neon)));

        features
    }
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        vec![]
    }
}

/// Returns the SIMD features supported while compiling ripgrep.
///
/// In essence, any features listed here are required to run ripgrep correctly.
///
/// This is kind of a dirty violation of abstraction, since it assumes
/// knowledge about what specific SIMD features are being used by various
/// components.
///
/// An easy way to enable everything available on your current CPU is to
/// compile ripgrep with `RUSTFLAGS="-C target-cpu=native"`. But note that
/// the binary produced by this will not be portable.
fn compile_cpu_features() -> Vec<String> {
    #[cfg(target_arch = "x86_64")]
    {
        let mut features = vec![];

        let sse2 = cfg!(target_feature = "sse2");
        features.push(format!("{sign}SSE2", sign = sign(sse2)));

        let ssse3 = cfg!(target_feature = "ssse3");
        features.push(format!("{sign}SSSE3", sign = sign(ssse3)));

        let avx2 = cfg!(target_feature = "avx2");
        features.push(format!("{sign}AVX2", sign = sign(avx2)));

        features
    }
    #[cfg(target_arch = "aarch64")]
    {
        let mut features = vec![];

        let neon = cfg!(target_feature = "neon");
        features.push(format!("{sign}NEON", sign = sign(neon)));

        features
    }
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        vec![]
    }
}

/// Returns a list of "features" supported (or not) by this build of ripgrpe.
fn features() -> Vec<String> {
    let mut features = vec![];

    let pcre2 = cfg!(feature = "pcre2");
    features.push(format!("{sign}pcre2", sign = sign(pcre2)));

    features
}

/// Returns `+` when `enabled` is `true` and `-` otherwise.
fn sign(enabled: bool) -> &'static str {
    if enabled { "+" } else { "-" }
}

```

### Core Architecture Module: `crates/core/flags/hiargs.rs`
```
/*!
Provides the definition of high level arguments from CLI flags.
*/

use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};

use {
    bstr::BString,
    grep::printer::{ColorSpecs, SummaryKind},
};

use crate::{
    flags::lowargs::{
        BinaryMode, BoundaryMode, BufferMode, CaseMode, ColorChoice,
        ContextMode, ContextSeparator, EncodingMode, EngineChoice,
        FieldContextSeparator, FieldMatchSeparator, LowArgs, MmapMode, Mode,
        PatternSource, SearchMode, SortMode, SortModeKind, TypeChange,
    },
    haystack::{Haystack, HaystackBuilder},
    search::{PatternMatcher, Printer, SearchWorker, SearchWorkerBuilder},
};

/// A high level representation of CLI arguments.
///
/// The distinction between low and high level arguments is somewhat arbitrary
/// and wishy washy. The main idea here is that high level arguments generally
/// require all of CLI parsing to be finished. For example, one cannot
/// construct a glob matcher until all of the glob patterns are known.
///
/// So while low level arguments are collected during parsing itself, high
/// level arguments aren't created until parsing has completely finished.
#[derive(Debug)]
pub(crate) struct HiArgs {
    binary: BinaryDetection,
    boundary: Option<BoundaryMode>,
    buffer: BufferMode,
    byte_offset: bool,
    case: CaseMode,
    color: ColorChoice,
    colors: grep::printer::ColorSpecs,
    column: bool,
    context: ContextMode,
    context_separator: ContextSeparator,
    crlf: bool,
    cwd: PathBuf,
    dfa_size_limit: Option<usize>,
    encoding: EncodingMode,
    engine: EngineChoice,
    field_context_separator: FieldContextSeparator,
    field_match_separator: FieldMatchSeparator,
    file_separator: Option<Vec<u8>>,
    fixed_strings: bool,
    follow: bool,
    globs: ignore::overrides::Override,
    heading: bool,
    hidden: bool,
    hyperlink_config: grep::printer::HyperlinkConfig,
    ignore_file_case_insensitive: bool,
    ignore_file: Vec<PathBuf>,
    include_zero: bool,
    index: usize,
    invert_match: bool,
    is_terminal_stdout: bool,
    line_number: bool,
    max_columns: Option<u64>,
    max_columns_preview: bool,
    max_count: Option<u64>,
    max_depth: Option<usize>,
    max_filesize: Option<u64>,
    mmap_choice: grep::searcher::MmapChoice,
    mode: Mode,
    multiline: bool,
    multiline_dotall: bool,
    no_ignore_dot: bool,
    no_ignore_exclude: bool,
    no_ignore_files: bool,
    no_ignore_global: bool,
    no_ignore_parent: bool,
    no_ignore_vcs: bool,
    no_require_git: bool,
    no_unicode: bool,
    null_data: bool,
    one_file_system: bool,
    only_matching: bool,
    path_separator: Option<u8>,
    paths: Paths,
    path_terminator: Option<u8>,
    patterns: Patterns,
    pre: Option<PathBuf>,
    pre_globs: ignore::overrides::Override,
    quiet: bool,
    quit_after_match: bool,
    regex_size_limit: Option<usize>,
    replace: Option<BString>,
    search_zip: bool,
    sort: Option<SortMode>,
    stats: Option<grep::printer::Stats>,
    stop_on_nonmatch: bool,
    threads: usize,
    trim: bool,
    types: ignore::types::Types,
    vimgrep: bool,
    with_filename: bool,
}

impl HiArgs {
    /// Convert low level arguments into high level arguments.
    ///
    /// This process can fail for a variety of reasons. For example, invalid
    /// globs or some kind of environment issue.
    pub(crate) fn from_low_args(mut low: LowArgs) -> anyhow::Result<HiArgs> {
        // Callers should not be trying to convert low-level arguments when
        // a short-circuiting special mode is present.
        assert_eq!(None, low.special, "special mode demands short-circuiting");
        // If the sorting mode isn't supported, then we bail loudly. I'm not
        // sure if this is the right thing to do. We could silently "not sort"
        // as well. If we wanted to go that route, then we could just set
        // `low.sort = None` if `supported()` returns an error.
        if let Some(ref sort) = low.sort {
            sort.supported()?;
        }
        // We aggressively ban things from indexing at present.
        if (low.index > 0 || matches!(low.mode, Mode::Index(_)))
            && let Some(flag) = low.indexing_unsupported_flag()
        {
            anyhow::bail!(
                "flag --{} does not support indexing",
                flag.name_long()
            );
        }

        // We modify the mode in-place on `low` so that subsequent conversions
        // see the correct mode.
        match low.mode {
            Mode::Search(ref mut mode) => match *mode {
                // treat `-v --count-matches` as `-v --count`
                SearchMode::CountMatches if low.invert_match => {
                    *mode = SearchMode::Count;
                }
                // treat `-o --count` as `--count-matches`
                SearchMode::Count if low.only_matching => {
                    *mode = SearchMode::CountMatches;
                }
                _ => {}
            },
            _ => {}
        }

        let mut state = State::new()?;
        let patterns = Patterns::from_low_args(&mut state, &mut low)?;
        let paths = Paths::from_low_args(&mut state, &patterns, &mut low)?;

        let binary = BinaryDetection::from_low_args(&state, &low);
        let colors = take_color_specs(&mut state, &mut low);
        let hyperlink_config = take_hyperlink_config(&mut state, &mut low)?;
        let stats = stats(&low);
        let types = types(&low)?;
        let globs = globs(&state, &low)?;
        let pre_globs = preprocessor_globs(&state, &low)?;

        let color = match low.color {
            ColorChoice::Auto if !state.is_terminal_stdout => {
                ColorChoice::Never
            }
            _ => low.color,
        };
        let column = low.column.unwrap_or(low.vimgrep);
        let heading = match low.heading {
            None => !low.vimgrep && state.is_terminal_stdout,
            Some(false) => false,
            Some(true) => !low.vimgrep,
        };
        let path_terminator = if low.null { Some(b'\x00') } else { None };
        let quit_after_match = stats.is_none() && low.quiet;
        let threads = if low.sort.is_some() || paths.is_one_file {
            1
        } else if let Some(threads) = low.threads {
            threads
        } else {
            std::thread::available_parallelism().map_or(1, |n| n.get()).min(12)
        };
        log::debug!("using {threads} thread(s)");
        let with_filename = low
            .with_filename
            .unwrap_or_else(|| low.vimgrep || !paths.is_one_file);

        let file_separator = match low.mode {
            Mode::Search(SearchMode::Standard) => {
                if heading {
                    Some(b"".to_vec())
                } else if let ContextMode::Limited(ref limited) = low.context {
                    let (before, after) = limited.get();
                    if before > 0 || after > 0 {
                        low.context_separator.clone().into_bytes()
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            _ => None,
        };

        let line_number = low.line_number.unwrap_or_else(|| {
            if low.quiet {
                return false;
            }
            let Mode::Search(ref search_mode) = low.mode else { return false };
            match *search_mode {
                SearchMode::FilesWithMatches
                | SearchMode::FilesWithoutMatch
                | SearchMode::Count
                | SearchMode::CountMatches => return false,
                SearchMode::JSON => return true,
                SearchMode::Standard => {
                    // A few things can imply counting line numbers. In
                    // particular, we generally want to show line numbers by
                    // default when printing to a tty for human consumption,
                    // except for one interesting case: when we're only
                    // searching stdin. This makes pipelines work as expected.
                    (state.is_terminal_stdout && !paths.is_only_stdin())
                        || column
                        || low.vimgrep
                }
            }
        });

        let mmap_choice = {
            // SAFETY: Memory maps are difficult to impossible to encapsulate
            // safely in a portable way that doesn't simultaneously negate some
            // of the benefits of using memory maps. For ripgrep's use, we never
            // mutate a memory map and generally never store the contents of
            // memory map in a data structure that depends on immutability.
            // Generally speaking, the worst thing that can happen is a SIGBUS
            // (if the underlying file is truncated while reading it), which
            // will cause ripgrep to abort. This reasoning should be treated as
            // suspect.
            let maybe = unsafe { grep::searcher::MmapChoice::auto() };
            let never = grep::searcher::MmapChoice::never();
            match low.mmap {
                MmapMode::Auto => {
                    if paths.paths.len() <= 10
                        && paths.paths.iter().all(|p| p.is_file())
                    {
                        // If we're only searching a few paths and all of them
                        // are files, then memory maps are probably faster.
                        maybe
                    } else {
                        never
                    }
                }
                MmapMode::AlwaysTryMmap => maybe,
                MmapMode::Never => never,
            }
        };

        Ok(HiArgs {
            mode: low.mode,
            patterns,
            paths,
            binary,
            boundary: low.boundary,
            buffer: low.buffer,
            byte_offset: low.byte_offset,
            case: low.case,
     
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3419** (2026-06-05): **Nondeterminism in ignore::WalkBuilder parallel multi-root walk**
  *Symptoms*: ### Please tick this box to confirm you have reviewed the above.  - [x] I have a different issue.  ### What version of ripgrep are you using?  14.1.1  ### How did you install ripgrep?  Cargo  ### What operating system are you using ripgrep on?  macOS 26.5  ### Describe your bug.  `ignore::WalkBuilder` appears to produce nondeterministic results for a parallel multi-root walk when one root has a scoped ignore rule that should not apply to another root.    ### What are the steps to reproduce the behavior?  Minimal layout:  ```text .git/ .gitignore noxfile.py src/scikit_build_core/build/metadata.py tests/test_metadata.py ```  `.gitignore`:  ```gitignore tests/**/build/ ```  The source build file should always be included: the ignore rule only matches `build/` directories below `tests/`.  Minimal Rust repro with `ignore = "0.4.25"`:  ```rust use std::path::Path; use std::sync::atomic::{AtomicBool, Ordering};  fn source_build_file_was_seen(root: &Path) -> bool {     let source_build_file = root.join("src/scikit_build_core/build/metadata.py");     let seen = AtomicBool::new(false);      let mut builder = ignore::WalkBuilder::new(root.join("src"));     builder.current_dir(root);     builder.standard_filters(true);     builder.add(root.join("tests"));     builder.add(root.join("noxfile.py"));     builder.threads(12);      builder.build_parallel().run(|| {         Box::new(|entry| {             if let Ok(entry) = entry {                 if entry.path() == source_build_file {          

- **Issue #3194** (2025-10-19): **Line buffering appears broken in 15.0.0**
  *Symptoms*: ### Please tick this box to confirm you have reviewed the above.  - [x] I have a different issue.  ### What version of ripgrep are you using?  ``` ripgrep 15.0.0  features:+pcre2 simd(compile):+SSE2,+SSSE3,+AVX2 simd(runtime):+SSE2,+SSSE3,+AVX2  PCRE2 10.45 is available (JIT is available) ```  ### How did you install ripgrep?  Bug appears when built locally with Cargo as well as the binaries provided on the release page  ### What operating system are you using ripgrep on?  Arch Linux -- kernel `6.17.3`  ### Describe your bug.  I've been using ripgrep to filter `journalctl` output in follow mode for years and thus need the `--line-buffered` option otherwise nothing is output since `stdin` doesn't close.  With the latest release that switch doesn't appear to be having any affect.  ### What are the steps to reproduce the behavior?  No output:      journalctl -n5 -f | ./rg --no-config --line-buffered  'Oct'  Does produce some output -- I assume this is because the "block buffer" is getting full?      journalctl -n5000 -f | ./rg --no-config --line-buffered  'Oct'  When run with < `15.0.0` each line that is matched is output as soon as it's printed by `journalctl`.  Obviously you'll have to adjust the search to match whatever's in your logs.  ### What is the actual behavior?  Same as "steps to reproduce"  ### What is the expected behavior?  Match lines (or inverse matches with `-v`) should be output as soon as they're output by the pipe
  **Post-Mortem & Fix Analysis**:
  > Ugh, yeah, this apparently broke in 8c6595c215d1e24bed5b7b86e2b18f3c871439ef (found via `git bisect`). No clue why yet though.

- **Issue #3184** (2025-10-14): **Excessive slowdown with larger `-A` context windows?**
  *Symptoms*: ### Please tick this box to confirm you have reviewed the above.  - [x] I have a different issue.  ### What version of ripgrep are you using?  rg --version ripgrep 14.1.1  features:-pcre2 simd(compile):+SSE2,-SSSE3,-AVX2 simd(runtime):+SSE2,+SSSE3,+AVX2  PCRE2 is not available in this build of ripgrep.  ### How did you install ripgrep?  `emerge`  ### What operating system are you using ripgrep on?  Gentoo  ### Describe your bug.  On large files, `rg` seems to slow down significantly with larger `-A` values.  ``` $ ls -lh large_file > -rwxr-xr-x 1 XXX XXX 9.8G Oct 10 11:35 large_file ```  ```sh $ time cat large_file | rg XXXXX -A99 binary file matches (found "\0" byte around offset 7)  ________________________________________________________ Executed in  334.68 millis    fish           external    usr time  260.39 millis    2.94 millis  257.45 millis    sys time   75.03 millis    0.99 millis   74.04 millis  $ time cat large_file | rg XXXXX -A999 binary file matches (found "\0" byte around offset 7)  ________________________________________________________ Executed in  349.03 millis    fish           external    usr time  269.92 millis    1.57 millis  268.36 millis    sys time   91.83 millis    1.02 millis   90.81 millis  $ time cat large_file | rg XXXXX -A9999 binary file matches (found "\0" byte around offset 7)  ________________________________________________________ Executed in  667.18 millis    fish           external    usr time  565.68 millis    1.62 millis  564.06 mill
  **Post-Mortem & Fix Analysis**:
  > I can't seem to reproduce this. Or at least, not in a way that results in a meaningful difference with GNU grep. Can you please provide an MRE?  Here's what I tried. First, the setup:  ``` $ curl -LO 'https://burntsushi.net/stuff/opensubtitles/2018/en/sixteenth.txt.gz' $ gzip -d sixteenth.txt.gz $ ls -lh total 773M -rw-rw-r-- 1 andrew users 773M Oct 13 16:57 sixteenth.txt $ (echo ZQZQZQZQZQ && for ((i=0;i<10;i++)); do cat sixteenth.txt; done) > bigger.txt $ time rg -c ZQZQZQZQZQ bigger.txt 1  real    0.645 user    0.414 sys     0.229 maxmem  7734 MB faults  0 ```  Now `grep` timings:  ``` $ (time grep ZQZQZQZQZQ bigger.txt -A999999) | wc -l  real    0.711 user    0.202 sys     0.506 maxmem  29 MB faults  0 1000000 $ (time grep ZQZQZQZQZQ bigger.txt -A9999999) | wc -l  real    1.055 user    0.514 sys     0.538 maxmem  29 MB faults  0 10000000 $ (time grep ZQZQZQZQZQ bigger.txt -A99999999) | wc -l  real    4.543 user    3.691 sys     0.845 maxmem  29 MB faults  0 100000000 $ (time grep Z
  > Oh wait, if I `cat` the file into ripgrep...  ``` $ cat bigger.txt | (time rg ZQZQZQZQZQ -A9) | wc -l  real    1.897 user    0.300 sys     0.943 maxmem  29 MB faults  0 10  $ cat bigger.txt | (time rg ZQZQZQZQZQ -A99) | wc -l  real    1.855 user    0.421 sys     0.840 maxmem  29 MB faults  0 100  $ cat bigger.txt | (time rg ZQZQZQZQZQ -A999) | wc -l  real    2.009 user    1.265 sys     0.667 maxmem  29 MB faults  0 1000  $ cat bigger.txt | (time rg ZQZQZQZQZQ -A9999) | wc -l  real    10.459 user    9.894 sys     0.549 maxmem  29 MB faults  0 10000 ```  And indeed, GNU grep does not exhibit a similar slowdown.  WTF.
  > This was a very subtle problem related to the apparent difference in how much the caller's buffer is filled on `read` syscalls. It's seemingly different when reading from `stdin` versus an explicit file. (Which kind of boggles my mind.) That isn't a problem in and of itself, but it caused a pathological problem in ripgrep where it ended up not amortizing `read` calls as well at it should. See https://github.com/BurntSushi/ripgrep/pull/3185/commits/8bf6f0a2a8fd4d0786561b2901f2b1443ff2d8d4 for more details.  Also, I discovered that GNU grep has a similar problem with `-B/--before-context`:  ``` $ cat bigger.txt | (time grep ZQZQZQZQZQ -B9) | wc -l  real    1.568 user    0.170 sys     0.885 maxmem  30 MB faults  0 1  $ cat bigger.txt | (time grep ZQZQZQZQZQ -B99) | wc -l  real    1.734 user    0.338 sys     0.879 maxmem  30 MB faults  0 1  $ cat bigger.txt | (time grep ZQZQZQZQZQ -B999) | wc -l  real    2.349 user    1.723 sys     0.620 maxmem  30 MB faults  0 1  $ cat bigger.txt | (time 

- **Issue #3180** (2025-10-12): **rg panic caused by --replace, --multiline, a particular pattern, and search text containing repeats and newlines**
  *Symptoms*: ### Please tick this box to confirm you have reviewed the above.  - [x] I have a different issue.  ### What version of ripgrep are you using?  ripgrep 14.1.1  features:+pcre2 simd(compile):+SSE2,-SSSE3,-AVX2 simd(runtime):+SSE2,+SSSE3,+AVX2  PCRE2 10.43 is available (JIT is available)  ### How did you install ripgrep?  Gentoo Portage  ### What operating system are you using ripgrep on?  Gentoo Linux  ### Describe your bug.  When using the --replace and --multiline flags w/ certain search patterns, ripgrep panics when it searches text containing certain sequences of repeated text and newlines. The panic message is "slice index starts at x but ends at y", where x and y are integers and y < x.  Background: I have a program that runs ripgrep (and other regex software), parses its output, and counts and displays word sequences. Ripgrep has performed great; I've used many, many different search patterns on ~50 MiB of English text in ~5,000 files. Recently ran across this bug. The initial search pattern was much more complicated -- I spent some time simplifying it down to these 2 minimal test cases. (If it's useful, I can explain why the various groups in the pattern are there.)  Each minimal search pattern is extremely specific. Removing almost any element will prevent the bug from appearing; for example, changing the initial group from `(^|[^a-z])` to `^`, or changing the "\s" in the middle to " ". Similar situation for the search text: for the lines2 test case, changing the initi
  **Post-Mortem & Fix Analysis**:
  > Nice find, thank you! This will be fixed in the next release.

- **Issue #3179** (2025-10-15): **ignore::WalkBuilder.git_global(true) does not behave correctly with rooted files**
  *Symptoms*: This bug was originally reported in the helix repository: https://github.com/helix-editor/helix/issues/12604  I was doing a bit of a research in that issue, and I found that helix [is using the package `ignore`](https://github.com/helix-editor/helix/blob/5b0563419eeeaf0595c848865c46be4abad246a7/helix-term/Cargo.toml#L73), and we can see instances of `WalkBuilder` in the file picker function [here](https://github.com/helix-editor/helix/blob/5b0563419eeeaf0595c848865c46be4abad246a7/helix-term/src/ui/mod.rs#L234).  The full explanation of the bug can be read there, but the TLDR is: if the global `.gitignore`, specified in git's config `core.excludesfile` option contains a rooted pattern, for example `/.venv`, it is **not** ignored as expected.  I looked for similar issues to see if anyone have reported it already, but I was unable to find any.
  **Post-Mortem & Fix Analysis**:
  > Please provide an MRE.
  > I was able to reproduce the issue with the code bellow:  ```rust use ignore::WalkBuilder; use std::env;  fn main() {     let root = env::current_dir().unwrap();     println!("Root is {:?}", root);     let mut walk_builder = WalkBuilder::new(root);     let walk = walk_builder         .hidden(false)         .git_ignore(true)         .git_global(true)         .build();     for dir_entry in walk {         println!("{:?}", dir_entry.unwrap().path());     } } ```  And created a dummy `.venv` folder with two files:  ```shell mkdir .venv touch .venv/foo touch .venv/bar ```  With `/.venv` ignored in the global ignore file, `.venv` entries are printed:  ```txt "/home/mateus/Projects/ripgrep-issue/.venv" "/home/mateus/Projects/ripgrep-issue/.venv/bar" "/home/mateus/Projects/ripgrep-issue/.venv/foo" ```  If I copy/move the `/.venv` entry from the global ignore to my project's `.gitignore` (in my case, `~/Projects/ripgrep-issue/.gitignore`) and run again, `.venv` is properly ignored and not printed
  > Thanks for reporting this! This was gnarly to fix. And this bug appeared in ripgrep as well. Moreover, the bug occurs with `WalkBuilder::add_ignore`. I have a fix in #3189.

- **Issue #3173** (2025-10-09): **hidden files whitelisted by ancestor .ignore are not searched when . is directory argument**
  *Symptoms*: ### Please tick this box to confirm you have reviewed the above.  - [x] I have a different issue.  ### What version of ripgrep are you using?  ``` ripgrep 14.1.1  features:+pcre2 simd(compile):+SSE2,-SSSE3,-AVX2 simd(runtime):+SSE2,+SSSE3,+AVX2  PCRE2 10.43 is available (JIT is available) ```  ### How did you install ripgrep?  dnf ``` rpm -q ripgrep   ripgrep-14.1.1-1.el8.x86_64 ```  ### What operating system are you using ripgrep on?  Rocky Linux 8.10 (Green Obsidian)  ### Describe your bug.  When the current directory is passed to ripgrep as `.`, hidden-but-whitelisted files that are immediate children of the current directory are not searched.  This does not happen if no directory argument is provided, or if the directory is provided as `./.` instead.  (For extra context, the Emacs [consult](https://github.com/minad/consult) package always passes a `.` argument to ripgrep when searching under the current working directory, which is how I discovered this.)  ### What are the steps to reproduce the behavior?  ```sh cd "$(mktemp -d)" mkdir subdir echo "foo text" >subdir/.foo.txt cat <<EOF >.ignore !.foo.txt EOF  rg -l 'text' . # finds subdir/.foo.txt cd subdir  # STEP 1 rg -l 'text'     # finds .foo.txt as expected rg -l 'text' .   # bad: no results rg -l 'text' ./. # finds ././.foo.txt as expected  mkdir subsubdir echo "foo text" >subsubdir/.foo.txt  # STEP 2 rg -l 'text'     # finds both .foo.txt and subsubdir/.foo.txt rg -l 'text' .   # only finds ./subsubdir/.foo.txt rg -l
  **Post-Mortem & Fix Analysis**:
  > This has been bugging me and my use of `M-x consult-ripgrep` too.  I initially wondered if #2933 / 14f4957b3d605f14ad58bc67e54197a3084fef5a may address it, but I think I could still reproduce the issue with the latest master (bb88a1ac45c70bef97e0d6ccd6e91595610de860)... although I'm not 100% sure I tested the right thing, and ran of out time for my experiments.  The `./.` workaround is nifty, and can be used in an advice:  ```elisp (defun advice/consult--ripgrep-make-builder/workaround-rg-3173 (args)   "Workaround https://github.com/BurntSushi/ripgrep/issues/3173: `rg .' doesn't follow inverse .ignores properly, while `rg ./.' does."   ;; consult--ripgrep-make-builder accepts one arg: `paths'   (pcase-let ((`(,paths) args))     (list      (mapcar (lambda (path) (if (equal path ".") "./." path)) paths))))  (advice-add 'consult--ripgrep-make-builder :filter-args #'advice/consult--ripgrep-make-builder/workaround-rg-3173) ```
  > It looks like this is still present on `master` yeah.  And it looks like you can just do `./` to work around this. You don't need `./.`.
  > Thank you for looking at this!

- **Issue #3155** (2025-09-22): **ripgrep is not self-contained on aarach64 darwin**
  *Symptoms*: ### Please tick this box to confirm you have reviewed the above.  - [x] I have a different issue.  ### What version of ripgrep are you using?  14.1.1  ### How did you install ripgrep?  Download tarball from github release  ### What operating system are you using ripgrep on?  arm64 macOS 12.5  ### Describe your bug.  ripgrep misses dependencies on libprce2.  ### What are the steps to reproduce the behavior?  ```console $ wget https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-aarch64-apple-darwin.tar.gz $ tar xf ripgrep*.tar.gz ```  ### What is the actual behavior?  ```console $ ./ripgrep-14.1.1-aarch64-apple-darwin/rg dyld[624]: Library not loaded: '/opt/homebrew/opt/pcre2/lib/libpcre2-8.0.dylib'   Referenced from: '/Users/user/ripgrep-14.1.1-aarch64-apple-darwin/rg'   Reason: tried: '/opt/homebrew/opt/pcre2/lib/libpcre2-8.0.dylib' (no such file), '/usr/local/lib/libpcre2-8.0.dylib' (no such file), '/usr/lib/libpcre2-8.0.dylib' (no such file) ```   ### What is the expected behavior?  Could we ship another arm64 apple tarball with ripgrep has libprce2 statically linked?  I'm using a shared account on a Mac so I have no root privilege to use Homebrew and install libprce2. There is no internet and no rust toolchain on that machine so I can't build ripgrep myself.
  **Post-Mortem & Fix Analysis**:
  > I found a workaround. So this issue is not important to me anymore.  I download libpcre2 and build it with prefix `$HOME/local`. Then I used ``` export DYLD_LIBRARY_PATH="$HOME/local/lib:$DYLD_LIBRARY_PATH" ``` to run ripgrep.

- **Issue #3140** (2025-09-20): **rg man page miscodes interior hyphens in long option names as unicode hyphen**
  *Symptoms*: ### Please tick this box to confirm you have reviewed the above.  - [x] I have a different issue.  ### What version of ripgrep are you using?  ripgrep 14.1.1  ### How did you install ripgrep?  homebrew  ### What operating system are you using ripgrep on?  macOS 15.6.1  ### Describe your bug.  I believe rg's man page miscodes hyphens within option names.  Using Gnu man on mac the rg.1 man page shows switches as `--case‐sensitive` and `--files‐without‐match` where the leading hyphens are properly Ascii HYPHEN-MINUS #x2d but the interior ones are Unicode HYPHEN #x2010 which makes it difficult to search for the option name. (I think/hope this came through properly on GitHub).  ### What are the steps to reproduce the behavior?  $ gman rg  ### What is the actual behavior?  ```        --pre‐glob=GLOB            This  flag works in conjunction with the --pre flag. Namely, when one or more --pre‐glob flags are given, then only files that match the given set of globs will be handed to the command specified            by the --pre flag. Any non‐matching files will be searched without using the preprocessor command. ```  ### What is the expected behavior?  hyphen in switch names should be ascii hyphen-minus as you would type them so they can be cut and pasted to a command line.
  **Post-Mortem & Fix Analysis**:
  > ripgrep does not do this. Something else is. It renders correctly as an ASCII hyphen in my `man` version `2.13.1`. My `man` comes from the `man-db` package on Archlinux, whose homepage is: https://gitlab.com/man-db/man-db  It also renders correctly using `man` on macOS. I don't have `gman` even though I have `coreutils` installed. I don't know how to install GNU man. All of the obvious searches don't show anything for me.  And finally, to prove that ripgrep is not emitting some kind of weird hyphen, you can ask it to generate the man page:  ``` $ rg --generate man | rg pre-glob flag. One possible mitigation to this is to use the \fB\-\-pre-glob\fP flag to \fB\-\-pre-glob\fP=\fIGLOB\fP more \fB\-\-pre-glob\fP flags are given, then only files that match the given set then it is possible to use \fB\-\-pre\fP \fIpre-pdftotext\fP \fB--pre-glob Multiple \fB\-\-pre-glob\fP flags may be used. Globbing rules match ```
  > In `\-\-pre-glob` the leading hyphens are escaped but the internal hyphen isn't.  Seems like some roff implementations in some environments need all the hyphens to be escaped in order to stay ASCII: https://lists.gnu.org/archive/html/groff/2021-01/msg00074.html
  > Wow, okay. Your link doesn't work, but it's an easy change on my end regardless.

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

### Incident Patch 1: `7525479a` (2026-08-03)
**Commit Message**: ci: fix binary discovery

It looks like the location of executables is changing in Cargo's test
runner, so use the blessed way of discovering an executable. That is,
for ripgrep, consult the `CARGO_BIN_EXE_rg` environment variable.

**File**: `tests/util.rs` (modified, +5/-1)
```diff
@@ -177,7 +177,11 @@ impl Dir {
 
     /// Returns the path to the ripgrep executable.
     pub fn bin(&self) -> process::Command {
-        let rg = self.root.join(format!("../rg{}", env::consts::EXE_SUFFIX));
+        let rg = std::env::var_os("CARGO_BIN_EXE_rg")
+            .map(PathBuf::from)
+            .unwrap_or_else(|| {
+                self.root.join(format!("../rg{}", env::consts::EXE_SUFFIX))
+            });
         match cross_runner() {
             None => process::Command::new(rg),
             Some(runner) => {
```

---

### Incident Patch 2: `dffd776a` (2026-07-28)
**Commit Message**: ci: attest build provenance for release archives

PR #3495

**File**: `.github/workflows/release.yml` (modified, +7/-0)
```diff
@@ -9,6 +9,8 @@ on:
 # We need this to be able to create releases.
 permissions:
   contents: write
+  id-token: write # for build provenance signing
+  attestations: write # to record the attestation
 
 jobs:
   # The create-release job runs purely to initialize the GitHub release itself,
@@ -282,6 +284,11 @@ jobs:
         echo "ASSET=$ARCHIVE.tar.gz" >> $GITHUB_ENV
         echo "ASSET_SUM=$ARCHIVE.tar.gz.sha256" >> $GITHUB_ENV
 
+    - name: Attest build provenance
+      uses: actions/attest-build-provenance@977bb373ede98d70efdf65b84cb5f73e068dcc2a # v3.0.0
+      with:
+        subject-path: ${{ env.ASSET }}
+
     - name: Upload release archive
       env:
         GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### Incident Patch 3: `d958105d` (2026-07-20)
**Commit Message**: cargo: add new build-time `unstable-index` feature

... and add some of the initial flags, spec'd out in #1497, for adding
indexing to ripgrep. These don't do anything yet.

I chose to go this route because indexing will be a big feature, and it
would be better to develop it on master instead of maintaining a
long-lived branch for it.

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -171,6 +171,9 @@ jobs:
         fi
         set -x
 
+    - name: Run tests with indexing enabled
+      run: ${{ env.CARGO }} test --verbose --workspace --features unstable-index ${{ env.TARGET_FLAGS }}
+
     - name: Run tests with PCRE2 (sans cross)
       if: matrix.target == ''
       run: ${{ env.CARGO }} test --verbose --workspace --features pcre2 ${{ env.TARGET_FLAGS }}
```

**File**: `Cargo.toml` (modified, +3/-0)
```diff
@@ -70,6 +70,9 @@ walkdir = "2"
 
 [features]
 pcre2 = ["grep/pcre2"]
+# This provides opt-in support for indexing. This is currently in active
+# development and may have very serious bugs. Use at your own risk.
+unstable-index = []
 
 [profile.release]
 debug = 1
```

**File**: `crates/core/flags/defs.rs` (modified, +312/-3)
```diff
@@ -25,9 +25,9 @@ use crate::flags::{
     Category, Flag, FlagValue,
     lowargs::{
         BinaryMode, BoundaryMode, BufferMode, CaseMode, ColorChoice,
-        ContextMode, EncodingMode, EngineChoice, GenerateMode, LoggingMode,
-        LowArgs, MmapMode, Mode, PatternSource, SearchMode, SortMode,
-        SortModeKind, SpecialMode, TypeChange,
+        ContextMode, EncodingMode, EngineChoice, GenerateMode, IndexMode,
+        LoggingMode, LowArgs, MmapMode, Mode, PatternSource, SearchMode,
+        SortMode, SortModeKind, SpecialMode, TypeChange,
     },
 };
 
@@ -84,6 +84,10 @@ pub(super) const FLAGS: &[&dyn Flag] = &[
     &IgnoreFile,
     &IgnoreFileCaseInsensitive,
     &IncludeZero,
+    &Index,
+    &IndexCrud,
+    &IndexForce,
+    &IndexPath,
     &InvertMatch,
     &JSON,
     &LineBuffered,
@@ -3373,6 +3377,304 @@ fn test_include_zero() {
     assert_eq!(false, args.include_zero);
 }
 
+/// -X/--index
+#[derive(Debug)]
+struct Index;
+
+impl Flag for Index {
+    fn is_switch(&self) -> bool {
+        true
+    }
+    fn name_short(&self) -> Option<u8> {
+        Some(b'X')
+    }
+    fn name_long(&self) -> &'static str {
+        "index"
+    }
+    fn doc_category(&self) -> Category {
+        Category::Indexing
+    }
+    fn doc_short(&self) -> &'static str {
+        r"Use a search index when one is available."
+    }
+    fn doc_long(&self) -> &'static str {
+        r"
+Enable searching with an index. Without this flag, ripgrep never uses an
+index.
+.sp
+ripgrep looks for an index in the following order. The first step that finds
+one or more indexes wins:
+.sp
+.IP 1. 4
+When path operands are given on the command line, each operand is interpreted
+as an index directory and every index is searched in command line order. An
+operand that is not a valid index is an error.
+.sp
+.IP 2. 4
+The index named by the \fBRIPGREP_INDEX_PATH\fP environment variable.
+.sp
+.IP 3. 4
+A valid index in a \fB.ripgrep\fP directory in the current working directory.
+.sp
+.IP 4. 4
+A valid index in a \fB.ripgrep\fP directory in the nearest parent of the current
+working directory.
+.PP
+If no index is found, ripgrep performs an ordinary search.
+.sp
+Indexed candidates are filtered by explicit glob and file-type selections,
+hidden-file and depth settings, and the maximum file size. Ignore files,
+including \fB.gitignore\fP, are not read or reapplied during an indexed search.
+Options that require transformed contents or every file make the query
+ineligible for candidate filtering and therefore trigger the fallback below.
+.sp
+This flag may be given at most twice. When it is given once and the query
+cannot use an index, ripgrep performs an ordinary search. When it is given
+twice and an index was found, ripgrep stops instead of performing an ordinary
+search if the query cannot use the index.
+"
+    }
+
+    fn update(&self, v: FlagValue, args: &mut LowArgs) -> anyhow::Result<()> {
+        check_indexing_allowed()?;
+        assert!(v.unwrap_switch(), "--index has no negation");
+        args.index = args.index.saturating_add(1);
+        anyhow::ensure!(
+            args.index <= 2,
+            "-X/--index may be given at most twice"
+        );
+        Ok(())
+    }
+}
+
+#[cfg(test)]
+#[test]
+fn test_index() {
+    if !cfg!(feature = "unstable-index") {
+        assert!(parse_low_raw(["-X"]).is_err());
+        return;
+    }
+
+    let args = parse_low_raw(None::<&str>).unwrap();
+    assert_eq!(0, args.index);
+    assert_eq!(Mode::Search(SearchMode::Standard), args.mode);
+
+    let args = parse_low_raw(["-X"]).unwrap();
+    assert_eq!(1, args.index);
+    assert_eq!(Mode::Search(SearchMode::Standard), args.mode);
+
+    let args = parse_low_raw(["--index"]).unwrap();
+    assert_eq!(1, args.index);
+
+    let args = parse_low_raw(["-XX"]).unwrap();
+    assert_eq!(2, args.index);
+
+    let args = parse_low_raw(["-X", "--index"]).unwrap();
+    assert_eq!(2, args.index);
+
+    let result = parse_low_raw(["-XXX"]);
+    assert!(result.is_err(), "{result:?}");
+}
+
+/// --x-crud
+#[derive(Debug)]
+struct IndexCrud;
+
+impl Flag for IndexCrud {
+    fn is_switch(&self) -> bool {
+        true
+    }
+    fn name_long(&self) -> &'static str {
+        "x-crud"
+    }
+    fn doc_category(&self) -> Category {
+        Category::Indexing
+    }
+    fn doc_short(&self) -> &'static str {
+        r"Create or update a search index."
+    }
+    fn doc_long(&self) -> &'static str {
+        r"
+Create or update an index for the files and directories given on the command
+line. When no path is given, this recursively indexes the current working
+directory. The files added to the index are exactly those selected by
+ripgrep's normal traversal and filtering options.
+.sp
+An existing file is re-indexed only when its modification time is newer than
+the time at which it was indexed. Use \flag{x-force} to re-index every selected
+file, including files on file systems with unreliable or deliberat
```

**File**: `crates/core/flags/doc/help.rs` (modified, +21/-3)
```diff
@@ -38,8 +38,17 @@ pub(crate) fn generate_short() -> String {
         TEMPLATE_SHORT.replace("!!VERSION!!", &version::generate_digits());
     for (cat, (col1, col2)) in cats.iter() {
         let var = format!("!!{name}!!", name = cat.as_str());
-        let val = format_short_columns(col1, col2, maxcol1, maxcol2);
-        out = out.replace(&var, &val);
+        if !cfg!(feature = "unstable-index")
+            && matches!(cat, crate::flags::Category::Indexing)
+        {
+            out = out.replace(
+                &var,
+                &format!("  {}", crate::flags::INDEXING_NOT_SUPPORTED),
+            );
+        } else {
+            let val = format_short_columns(col1, col2, maxcol1, maxcol2);
+            out = out.replace(&var, &val);
+        }
     }
     out
 }
@@ -122,7 +131,16 @@ pub(crate) fn generate_long() -> String {
         TEMPLATE_LONG.replace("!!VERSION!!", &version::generate_digits());
     for (cat, value) in cats.iter() {
         let var = format!("!!{name}!!", name = cat.as_str());
-        out = out.replace(&var, value);
+        if !cfg!(feature = "unstable-index")
+            && matches!(cat, crate::flags::Category::Indexing)
+        {
+            out = out.replace(
+                &var,
+                &format!("    {}", crate::flags::INDEXING_NOT_SUPPORTED),
+            );
+        } else {
+            out = out.replace(&var, value);
+        }
     }
     out
 }
```

**File**: `crates/core/flags/doc/man.rs` (modified, +7/-1)
```diff
@@ -37,7 +37,13 @@ pub(crate) fn generate() -> String {
     let mut out = TEMPLATE.replace("!!VERSION!!", &version::generate_digits());
     for (cat, value) in cats.iter() {
         let var = format!("!!{name}!!", name = cat.as_str());
-        out = out.replace(&var, value);
+        if !cfg!(feature = "unstable-index")
+            && matches!(cat, crate::flags::Category::Indexing)
+        {
+            out = out.replace(&var, crate::flags::INDEXING_NOT_SUPPORTED);
+        } else {
+            out = out.replace(&var, value);
+        }
     }
     out
 }
```

**File**: `crates/core/flags/doc/template.long.help` (modified, +3/-0)
```diff
@@ -54,6 +54,9 @@ OUTPUT OPTIONS:
 OUTPUT MODES:
 !!output-modes!!
 
+INDEXING:
+!!indexing!!
+
 LOGGING OPTIONS:
 !!logging!!
 
```

**File**: `crates/core/flags/doc/template.rg.1` (modified, +3/-0)
```diff
@@ -114,6 +114,9 @@ In all cases, the flag specified last takes precedence.
 .SS OUTPUT MODES
 !!output-modes!!
 .
+.SS INDEXING
+!!indexing!!
+.
 .SS LOGGING OPTIONS
 !!logging!!
 .
```

**File**: `crates/core/flags/doc/template.short.help` (modified, +3/-0)
```diff
@@ -31,6 +31,9 @@ OUTPUT OPTIONS:
 OUTPUT MODES:
 !!output-modes!!
 
+INDEXING:
+!!indexing!!
+
 LOGGING OPTIONS:
 !!logging!!
 
```

---

### Incident Patch 4: `0d7054d8` (2026-07-16)
**Commit Message**: ignore: fix deadlock when visitor panics

When a visitor panics and the workers shutdown, we indicate as such and
quit everything. This effectively acts as a sort of poison that will
cause all other workers to stop even when in their idle loop.

Fixes #3009

**File**: `crates/ignore/src/walk.rs` (modified, +66/-13)
```diff
@@ -1445,21 +1445,28 @@ impl WalkParallel {
         let quit_now = Arc::new(AtomicBool::new(false));
         let active_workers = Arc::new(AtomicUsize::new(threads));
         let stacks = Stack::new_for_each_thread(threads, stack);
+        // Collect all of the workers first. In the case that
+        // `builder.build()` panics, we want that to happen and
+        // propagate before we actually start to run any of the
+        // workers.
+        let workers: Vec<_> = stacks
+            .into_iter()
+            .map(|stack| Worker {
+                visitor: builder.build(),
+                stack,
+                quit_now: quit_now.clone(),
+                active_workers: active_workers.clone(),
+                max_depth: self.max_depth,
+                min_depth: self.min_depth,
+                max_filesize: self.max_filesize,
+                follow_links: self.follow_links,
+                skip: self.skip.clone(),
+                filter: self.filter.clone(),
+            })
+            .collect();
         std::thread::scope(|s| {
-            let handles: Vec<_> = stacks
+            let handles: Vec<_> = workers
                 .into_iter()
-                .map(|stack| Worker {
-                    visitor: builder.build(),
-                    stack,
-                    quit_now: quit_now.clone(),
-                    active_workers: active_workers.clone(),
-                    max_depth: self.max_depth,
-                    min_depth: self.min_depth,
-                    max_filesize: self.max_filesize,
-                    follow_links: self.follow_links,
-                    skip: self.skip.clone(),
-                    filter: self.filter.clone(),
-                })
                 .map(|worker| s.spawn(|| worker.run()))
                 .collect();
             for handle in handles {
@@ -1905,6 +1912,9 @@ impl<'s> Worker<'s> {
                     }
                     // Wait for next `Work` or `Quit` message.
                     loop {
+                        if self.is_quit_now() {
+                            return None;
+                        }
                         if let Some(v) = self.recv() {
                             self.activate_worker();
                             value = Some(v);
@@ -1958,6 +1968,14 @@ impl<'s> Worker<'s> {
     }
 }
 
+impl<'s> Drop for Worker<'s> {
+    fn drop(&mut self) {
+        if std::thread::panicking() {
+            self.quit_now();
+        }
+    }
+}
+
 fn check_symlink_loop(
     ig_parent: &Ignore,
     child_path: &Path,
@@ -2604,4 +2622,39 @@ mod tests {
             ],
         );
     }
+
+    // This should always panic and never hang.
+    //
+    // Ref: https://github.com/BurntSushi/ripgrep/issues/3009
+    #[test]
+    #[should_panic]
+    fn panic_in_parallel() {
+        let td = tmpdir();
+        wfile(td.path().join("foo.txt"), "");
+
+        WalkBuilder::new(td.path())
+            .threads(40)
+            .build_parallel()
+            .run(|| Box::new(|_| panic!("oops!")));
+    }
+
+    // This should always panic and never hang. The first call to the visitor
+    // builder is used while processing the root paths. Previously, a panic on
+    // the third call occurred after the first worker had already been spawned,
+    // leaving it waiting indefinitely for workers that were never created.
+    #[test]
+    #[should_panic(expected = "builder panic")]
+    fn panic_in_parallel_builder() {
+        let td = tmpdir();
+        wfile(td.path().join("foo.txt"), "");
+
+        let mut builds = 0;
+        WalkBuilder::new(td.path()).threads(2).build_parallel().run(|| {
+            builds += 1;
+            if builds == 3 {
+                panic!("builder panic");
+            }
+            Box::new(|_| WalkState::Continue)
+        });
+    }
 }
```

---

### Incident Patch 5: `b6849dae` (2026-01-09)
**Commit Message**: ignore/walk: add `WalkBuilder::empty` and `WalkBuilder::from_iter`

Closes #1761, Closes #3261

**File**: `crates/ignore/src/walk.rs` (modified, +79/-1)
```diff
@@ -549,8 +549,16 @@ impl WalkBuilder {
     /// is better to call `add` on this builder than to create multiple
     /// `Walk` values.
     pub fn new<P: AsRef<Path>>(path: P) -> WalkBuilder {
+        WalkBuilder::from_iter([path])
+    }
+
+    /// Create an empty builder to which paths can be added.
+    ///
+    /// Note that if you call `build` on this instance before calling `add`
+    /// on it, it will return exactly zero items during iteration.
+    pub fn empty() -> WalkBuilder {
         WalkBuilder {
-            paths: vec![path.as_ref().to_path_buf()],
+            paths: vec![],
             ig_builder: IgnoreBuilder::new(),
             max_depth: None,
             min_depth: None,
@@ -565,6 +573,21 @@ impl WalkBuilder {
         }
     }
 
+    /// Create a new builder for a recursive directory iterator from the
+    /// sequence of paths.
+    ///
+    /// Note that if the iterator is empty, this is the same as
+    /// `WalkBuilder::empty`.
+    pub fn from_iter<P: AsRef<Path>, I: IntoIterator<Item = P>>(
+        paths: I,
+    ) -> WalkBuilder {
+        let mut builder = WalkBuilder::empty();
+        for path in paths.into_iter() {
+            builder.add(path);
+        }
+        builder
+    }
+
     /// Build a new `Walk` iterator.
     pub fn build(&self) -> Walk {
         let follow_links = self.follow_links;
@@ -1058,6 +1081,17 @@ impl Walk {
         WalkBuilder::new(path).build()
     }
 
+    /// Create a new recursive directory iterator from the sequence of paths
+    /// given.
+    ///
+    /// Note that if the provided iterator is empty, then `Walk` is guaranteed
+    /// to yield zero entries.
+    pub fn from_iter<P: AsRef<Path>, I: IntoIterator<Item = P>>(
+        paths: I,
+    ) -> Walk {
+        WalkBuilder::from_iter(paths).build()
+    }
+
     fn skip_entry(&self, ent: &DirEntry) -> Result<bool, Error> {
         if ent.depth() == 0 {
             return Ok(false);
@@ -2526,4 +2560,48 @@ mod tests {
             &["x", "x/y", "x/y/foo"],
         );
     }
+
+    #[test]
+    fn empty() {
+        let td = tmpdir();
+        assert_paths(td.path(), &WalkBuilder::empty(), &[]);
+
+        let empty_paths: Vec<&OsStr> = Vec::new();
+        assert_paths(td.path(), &WalkBuilder::from_iter(empty_paths), &[]);
+    }
+
+    #[test]
+    fn from_iter() {
+        let td = tmpdir();
+        mkdirp(td.path().join("a/b/c"));
+        mkdirp(td.path().join("d/e/f"));
+        mkdirp(td.path().join("x/y"));
+        wfile(td.path().join("a/b/foo"), "");
+        wfile(td.path().join("d/e/f/foo"), "");
+        wfile(td.path().join("x/y/foo"), "");
+
+        let paths = vec![
+            td.path().join("a"),
+            td.path().join("d"),
+            td.path().join("x"),
+        ];
+
+        assert_paths(
+            td.path(),
+            &WalkBuilder::from_iter(paths),
+            &[
+                "x",
+                "x/y",
+                "x/y/foo",
+                "d",
+                "d/e",
+                "d/e/f",
+                "d/e/f/foo",
+                "a",
+                "a/b",
+                "a/b/foo",
+                "a/b/c",
+            ],
+        );
+    }
 }
```

---

### Incident Patch 6: `8bca2ebf` (2025-11-02)
**Commit Message**: doc: fix typo in man page

Closes #3216

**File**: `crates/core/flags/defs.rs` (modified, +1/-1)
```diff
@@ -4146,7 +4146,7 @@ impl Flag for Multiline {
     }
     fn doc_long(&self) -> &'static str {
         r#"
-This flag enable searching across multiple lines.
+This flag enables searching across multiple lines.
 .sp
 When multiline mode is enabled, ripgrep will lift the restriction that a
 match cannot include a line terminator. For example, when multiline mode
```

---

### Incident Patch 7: `61a9fd82` (2025-11-25)
**Commit Message**: doc: fix typo

Closes #3227

**File**: `crates/searcher/src/searcher/mod.rs` (modified, +2/-2)
```diff
@@ -576,7 +576,7 @@ impl SearcherBuilder {
     /// limit, regardless of how many lines it spans.
     ///
     /// Note that `0` is a legal value. This will cause the searcher to
-    /// immediately quick without searching anything.
+    /// immediately quit without searching anything.
     ///
     /// By default, no limit is set.
     #[inline]
@@ -880,7 +880,7 @@ impl Searcher {
     /// limit, regardless of how many lines it spans.
     ///
     /// Note that `0` is a legal value. This will cause the searcher to
-    /// immediately quick without searching anything.
+    /// immediately quit without searching anything.
     #[inline]
     pub fn max_matches(&self) -> Option<u64> {
         self.config.max_matches
```

---

### Incident Patch 8: `767086db` (2025-12-15)
**Commit Message**: searcher: hint at sequential memory map reading

Note that we continue to disable memory maps on macOS.

Note also that I've generally been unable to observe a performance
improvement from a change like this. However, I think it's fine to do
this for reasons of "good sense."

Closes #3246

**File**: `crates/searcher/src/searcher/mmap.rs` (modified, +21/-2)
```diff
@@ -71,15 +71,34 @@ impl MmapChoice {
             return None;
         }
         if cfg!(target_os = "macos") {
-            // I guess memory maps on macOS aren't great. Should re-evaluate.
+            // I guess memory maps on macOS aren't great.
+            //
+            // See: https://github.com/BurntSushi/ripgrep/issues/36
+            // See: https://github.com/BurntSushi/ripgrep/pull/3246
             return None;
         }
         // SAFETY: This is acceptable because the only way `MmapChoiceImpl` can
         // be `Auto` is if the caller invoked the `auto` constructor, which
         // is itself not safe. Thus, this is a propagation of the caller's
         // assertion that using memory maps is safe.
         match unsafe { Mmap::map(file) } {
-            Ok(mmap) => Some(mmap),
+            Ok(mmap) => {
+                // Hint to the kernel that we'll read sequentially. This is
+                // only available on Unix.
+                #[cfg(unix)]
+                if let Err(err) = mmap.advise(memmap::Advice::Sequential) {
+                    if let Some(path) = path {
+                        log::debug!(
+                            "{}: madvise failed: {}",
+                            path.display(),
+                            err
+                        );
+                    } else {
+                        log::debug!("madvise failed: {}", err);
+                    }
+                }
+                Some(mmap)
+            }
             Err(err) => {
                 if let Some(path) = path {
                     log::debug!(
```

---

### Incident Patch 9: `9548e86b` (2026-03-12)
**Commit Message**: ignore/types: add PKGBUILD type

Closes #3299

**File**: `crates/ignore/src/default_types.rs` (modified, +1/-0)
```diff
@@ -209,6 +209,7 @@ pub(crate) const DEFAULT_TYPES: &[(&[&str], &[&str])] = &[
         "*.php", "*.php3", "*.php4", "*.php5", "*.php7", "*.php8",
         "*.pht", "*.phtml"
     ]),
+    (&["pkgbuild"], &["PKGBUILD"]),
     (&["po"], &["*.po"]),
     (&["pod"], &["*.pod"]),
     (&["postscript"], &["*.eps", "*.ps"]),
```

---

### Incident Patch 10: `f55548ba` (2026-05-28)
**Commit Message**: globset: fix `matches_all` false positives

Make sure that we correctly check that all globs are matched, even if
multiple globs use the same strategy.

Previously we only checked that all strategies matched, but didn't
check with the strategies themselves.

This now adds a `matches_all` method to each strategy to check all
globs within a strategy.

This avoids allocating for tracking the number of matches.

Fixes #3290, Closes #3302

**File**: `crates/globset/src/lib.rs` (modified, +178/-10)
```diff
@@ -389,7 +389,7 @@ impl GlobSet {
     /// `0` of the globs will match.
     pub fn matches_all_candidate(&self, path: &Candidate<'_>) -> bool {
         for strat in &self.strats {
-            if !strat.is_match(path) {
+            if !strat.matches_all(path) {
                 return false;
             }
         }
@@ -691,6 +691,19 @@ impl GlobSetMatchStrategy {
             Regex(ref s) => s.matches_into(candidate, matches),
         }
     }
+
+    fn matches_all(&self, candidate: &Candidate<'_>) -> bool {
+        use self::GlobSetMatchStrategy::*;
+        match *self {
+            Literal(ref s) => s.matches_all(candidate),
+            BasenameLiteral(ref s) => s.matches_all(candidate),
+            Extension(ref s) => s.matches_all(candidate),
+            Prefix(ref s) => s.matches_all(candidate),
+            Suffix(ref s) => s.matches_all(candidate),
+            RequiredExtension(ref s) => s.matches_all(candidate),
+            Regex(ref s) => s.matches_all(candidate),
+        }
+    }
 }
 
 #[derive(Clone, Debug)]
@@ -709,6 +722,10 @@ impl LiteralStrategy {
         self.0.contains_key(candidate.path.as_bytes())
     }
 
+    fn matches_all(&self, candidate: &Candidate<'_>) -> bool {
+        self.0.len() == 1 && self.is_match(candidate)
+    }
+
     #[inline(never)]
     fn matches_into(
         &self,
@@ -740,6 +757,10 @@ impl BasenameLiteralStrategy {
         self.0.contains_key(candidate.basename.as_bytes())
     }
 
+    fn matches_all(&self, candidate: &Candidate<'_>) -> bool {
+        self.0.len() == 1 && self.is_match(candidate)
+    }
+
     #[inline(never)]
     fn matches_into(
         &self,
@@ -774,6 +795,10 @@ impl ExtensionStrategy {
         self.0.contains_key(candidate.ext.as_bytes())
     }
 
+    fn matches_all(&self, candidate: &Candidate<'_>) -> bool {
+        self.0.len() == 1 && self.is_match(candidate)
+    }
+
     #[inline(never)]
     fn matches_into(
         &self,
@@ -807,6 +832,19 @@ impl PrefixStrategy {
         false
     }
 
+    fn matches_all(&self, candidate: &Candidate<'_>) -> bool {
+        let path = candidate.path_prefix(self.longest);
+        let mut count = 0;
+        // If all the prefixes match, we should get exactly one match for each
+        // prefix at the beginning.
+        for m in self.matcher.find_overlapping_iter(path) {
+            if m.start() == 0 {
+                count += 1;
+            }
+        }
+        count == self.map.len()
+    }
+
     fn matches_into(
         &self,
         candidate: &Candidate<'_>,
@@ -839,6 +877,19 @@ impl SuffixStrategy {
         false
     }
 
+    fn matches_all(&self, candidate: &Candidate<'_>) -> bool {
+        let path = candidate.path_suffix(self.longest);
+        let mut count = 0;
+        // If all the suffixes match, we should get exactly one match
+        // for each suffix at the end.
+        for m in self.matcher.find_overlapping_iter(path) {
+            if m.end() == path.len() {
+                count += 1;
+            }
+        }
+        count == self.map.len()
+    }
+
     fn matches_into(
         &self,
         candidate: &Candidate<'_>,
@@ -874,6 +925,22 @@ impl RequiredExtensionStrategy {
         }
     }
 
+    fn matches_all(&self, candidate: &Candidate<'_>) -> bool {
+        if candidate.ext.is_empty() {
+            return false;
+        }
+        if let Some(regexes) = self.0.get(candidate.ext.as_bytes()) {
+            for &(_, ref re) in regexes {
+                if !re.is_match(candidate.path.as_bytes()) {
+                    return false;
+                }
+            }
+            true
+        } else {
+            false
+        }
+    }
+
     #[inline(never)]
     fn matches_into(
         &self,
@@ -916,15 +983,28 @@ impl RegexSetStrategy {
         self.matcher.is_match(candidate.path.as_bytes())
     }
 
-    fn matches_into(
+    fn find_matches(
         &self,
         candidate: &Candidate<'_>,
-        matches: &mut Vec<usize>,
-    ) {
+    ) -> PoolGuard<'_, PatternSet, PatternSetPoolFn> {
         let input = regex_automata::Input::new(candidate.path.as_bytes());
         let mut patset = self.patset.get();
         patset.clear();
         self.matcher.which_overlapping_matches(&input, &mut patset);
+        patset
+    }
+
+    fn matches_all(&self, candidate: &Candidate<'_>) -> bool {
+        let patset = self.find_matches(candidate);
+        patset.is_full()
+    }
+
+    fn matches_into(
+        &self,
+        candidate: &Candidate<'_>,
+        matches: &mut Vec<usize>,
+    ) {
+        let patset = self.find_matches(candidate);
         for i in patset.iter() {
             matches.push(self.map[i]);
         }
@@ -1053,17 +1133,21 @@ pub fn escape(s: &str) -> String {
 
 #[cfg(test)]
 mod tests {
-    use crate::glob::Glob;
+    use crate::glob::{Glob, GlobBuilder};
 
     use super::{GlobSet, GlobSetBuilder};
 
+    fn build_glob_set(globs: &[&str]) -> GlobSet {
+        let mut builder = GlobSetBuild
```

---

### Incident Patch 11: `653d7f5b` (2026-06-27)
**Commit Message**: ignore: add multi-root parent matcher regression tests

Parent ignore matchers are cached by directory across search roots, but
each root must keep its own absolute_base for path rewriting when applying
parent .gitignore / .rgignore rules. Document that invariant and lock it
in with unit and integration tests for the order-dependent multi-root
bugs in #3376, #3419, and #3320.

Closes #3320, Closes #3376, Ref #3419, Closes #3451

**File**: `crates/ignore/src/dir.rs` (modified, +128/-2)
```diff
@@ -96,8 +96,18 @@ pub(crate) struct Ignore {
     // Parent matchers are cached independently of the path being walked, but
     // matching them still needs the canonicalized path originally passed to
     // `add_parents`. For example, when walking `/tmp/project/src`, parent
-    // matchers use `/tmp/project/src` to rewrite `foo.py` before matching it
-    // against ignore files from `/tmp/project` and its ancestors.
+    // matchers use `/tmp/project/src` to rewrite `/tmp/project/src/foo.py`
+    // before matching it against ignore files from `/tmp/project` and its
+    // ancestors.
+    //
+    // For ripgrep itself, this means that `rg pat src tests` must rewrite
+    // `src/foo` relative to `.../src`, and not whatever root was prepared
+    // first.
+    //
+    // See: https://github.com/BurntSushi/ripgrep/pull/3420
+    // See: https://github.com/BurntSushi/ripgrep/issues/3376
+    // See: https://github.com/BurntSushi/ripgrep/issues/3419
+    // See: https://github.com/BurntSushi/ripgrep/issues/3320
     absolute_base: Option<Arc<PathBuf>>,
 }
 
@@ -1330,6 +1340,122 @@ mod tests {
         assert!(tests.matched("build", true).is_ignore());
     }
 
+    /// Parent matchers are shared across search roots, but path rewriting for
+    /// absolute parents must use each root's own base path. Otherwise a rule
+    /// like `src/invalid` is matched against the wrong absolute path when
+    /// `src` is searched before a sibling root (e.g. `tests`).
+    ///
+    /// Paths passed to `matched` use the same relative layout as `Walk` when
+    /// roots are given as relative directory names.
+    ///
+    /// Regression for: https://github.com/BurntSushi/ripgrep/issues/3376
+    /// and https://github.com/BurntSushi/ripgrep/issues/3419
+    #[test]
+    fn multi_root_gitignore_order_independent() {
+        let td = tmpdir();
+        let cwd = std::env::current_dir().unwrap();
+        // Use paths relative to CWD like the CLI walk does for `rg pat src tests`.
+        let root = td.path().strip_prefix(&cwd).unwrap_or(td.path());
+        let src_root = root.join("src");
+        let tests_root = root.join("tests");
+
+        mkdirp(td.path().join(".git"));
+        mkdirp(td.path().join("src"));
+        mkdirp(td.path().join("tests"));
+        wfile(td.path().join(".gitignore"), "src/invalid\n");
+        wfile(td.path().join("src/invalid"), "x");
+        wfile(td.path().join("src/valid"), "x");
+        wfile(td.path().join("tests/valid"), "x");
+
+        let ig0 = IgnoreBuilder::new().build();
+
+        // Historically buggy order: search `src` first, then `tests`.
+        let (src_parents, err) = ig0.add_parents(&src_root);
+        assert!(err.is_none());
+        let (src, err) = src_parents.add_child(&src_root);
+        assert!(err.is_none());
+        let (tests_parents, err) = ig0.add_parents(&tests_root);
+        assert!(err.is_none());
+        let (tests, err) = tests_parents.add_child(&tests_root);
+        assert!(err.is_none());
+
+        assert!(Arc::ptr_eq(&src_parents.inner, &tests_parents.inner));
+        // Each root must carry its own absolute_base even though inners are shared.
+        assert_ne!(
+            src.absolute_base.as_ref().unwrap().as_path(),
+            tests.absolute_base.as_ref().unwrap().as_path()
+        );
+        assert!(
+            src.matched(src_root.join("invalid"), false).is_ignore(),
+            "parent .gitignore must apply for the src root even when \
+             another root was prepared in the same process"
+        );
+        assert!(src.matched(src_root.join("valid"), false).is_none());
+        assert!(tests.matched(tests_root.join("valid"), false).is_none());
+
+        // Reverse order should behave the same way.
+        let ig0 = IgnoreBuilder::new().build();
+        let (tests_parents, err) = ig0.add_parents(&tests_root);
+        assert!(err.is_none());
+        let (tests, err) = tests_parents.add_child(&tests_root);
+        assert!(err.is_none());
+        let (src_parents, err) = ig0.add_parents(&src_root);
+        assert!(err.is_none());
+        let (src, err) = src_parents.add_child(&src_root);
+        assert!(err.is_none());
+
+        assert!(src.matched(src_root.join("invalid"), false).is_ignore());
+        assert!(src.matched(src_root.join("valid"), false).is_none());
+        assert!(tests.matched(tests_root.join("valid"), false).is_none());
+    }
+
+    /// Same multi-root / order issue for non-git ignore files (e.g. `.rgignore`
+    /// via custom ignore names).
+    ///
+    /// Regression for: https://github.com/BurntSushi/ripgrep/issues/3320
+    #[test]
+    fn multi_root_custom_ignore_order_independent() {
+        let td = tmpdir();
+        let cwd = std::env::current_dir().unwrap();
+        let root = td.path().strip_prefix(&cwd).unwrap_or(td.path());
+        let alpha_root = root.join("alpha");
+        let beta_root = root.join("beta");
+
+        mkdirp(td.path().join("alpha"));
+       
```

**File**: `tests/misc.rs` (modified, +62/-0)
```diff
@@ -742,6 +742,68 @@ sherlock:be, to a very large extent, the result of luck. Sherlock Holmes
     eqnice!(expected, cmd.stdout());
 });
 
+// Multiple explicit search roots must apply parent .gitignore rules using each
+// root's own path base. Searching `src` before `tests` used to leak the wrong
+// absolute base into cached parent matchers so `src/invalid` was not ignored.
+// See: https://github.com/BurntSushi/ripgrep/issues/3376
+rgtest!(ignore_git_multi_root_order, |dir: Dir, mut cmd: TestCommand| {
+    dir.create_dir(".git");
+    dir.create(".gitignore", "src/invalid\n");
+    dir.create_dir("src");
+    dir.create_dir("tests");
+    dir.create("src/invalid", "this\n");
+    dir.create("src/valid", "this\n");
+    dir.create("tests/valid", "this\n");
+
+    cmd.args(&["--files-with-matches", "this", "src", "tests"]);
+    let got = cmd.stdout();
+    assert!(
+        !got.contains("invalid"),
+        "src/invalid must stay ignored with multiple roots, got:\n{}",
+        got
+    );
+    assert!(got.contains("src/valid"), "missing src/valid in:\n{}", got);
+    assert!(got.contains("tests/valid"), "missing tests/valid in:\n{}", got);
+
+    // Reverse CLI order should behave the same.
+    let mut cmd = dir.command();
+    cmd.args(&["--files-with-matches", "this", "tests", "src"]);
+    let got = cmd.stdout();
+    assert!(
+        !got.contains("invalid"),
+        "src/invalid must stay ignored with roots reversed, got:\n{}",
+        got
+    );
+});
+
+// Same multi-root path-base issue for `.rgignore`.
+// See: https://github.com/BurntSushi/ripgrep/issues/3320
+rgtest!(ignore_rgignore_multi_root_order, |dir: Dir, mut cmd: TestCommand| {
+    dir.create(".rgignore", "beta/**/*.svg\n");
+    dir.create_dir("alpha");
+    dir.create_dir("beta");
+    dir.create("alpha/a.txt", "AWS\n");
+    dir.create("beta/x.svg", "AWS\n");
+
+    cmd.args(&["--files-with-matches", "AWS", "alpha", "beta"]);
+    let got = cmd.stdout();
+    assert!(
+        !got.contains("x.svg"),
+        "beta/x.svg must be ignored with multiple roots, got:\n{}",
+        got
+    );
+    assert!(got.contains("alpha/a.txt"), "missing alpha/a.txt in:\n{}", got);
+
+    let mut cmd = dir.command();
+    cmd.args(&["--files-with-matches", "AWS", "beta", "alpha"]);
+    let got = cmd.stdout();
+    assert!(
+        !got.contains("x.svg"),
+        "beta/x.svg must be ignored with roots reversed, got:\n{}",
+        got
+    );
+});
+
 rgtest!(symlink_nofollow, |dir: Dir, mut cmd: TestCommand| {
     dir.create_dir("foo");
     dir.create_dir("foo/bar");
```

---

### Incident Patch 12: `3a570990` (2026-07-09)
**Commit Message**: doc: fix typo

PR #3446

**File**: `crates/searcher/src/lib.rs` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ For example, the [`grep-regex`](https://crates.io/crates/grep-regex)
 crate provides an implementation of the `Matcher` trait using Rust's
 [`regex`](https://crates.io/crates/regex) crate.
 
-Finally, a `Sink` describes how callers receive search results producer by a
+Finally, a `Sink` describes how callers receive search results produced by a
 `Searcher`. This includes routines that are called at the beginning and end of
 a search, in addition to routines that are called when matching or contextual
 lines are found by the `Searcher`. Implementations of `Sink` can be trivially
```

---

### Incident Patch 13: `c4f34e06` (2026-06-28)
**Commit Message**: _rg: update $no pattern to account for --require-git and --unicode

**File**: `crates/core/flags/complete/rg.zsh` (modified, +3/-2)
```diff
@@ -28,8 +28,9 @@ _rg() {
   if
     # We also want to list all of these options during testing
     [[ $_RG_COMPLETE_LIST_ARGS == (1|t*|y*) ]] ||
-    # (--[imnp]* => --ignore*, --messages, --no-*, --pcre2-unicode)
-    [[ $PREFIX$SUFFIX == --[imnp]* ]] ||
+    # --[imnpru]* => --ignore*, --messages, --no-*, --pcre2-unicode,
+    #                --require-git, --unicode
+    [[ $PREFIX$SUFFIX == --[imnpru]* ]] ||
     zstyle -t ":completion:${curcontext}:" complete-all
   then
     no=
```

---

### Incident Patch 14: `365edbfd` (2026-06-28)
**Commit Message**: _rg: misc. spec fixes

- eliminate redundant groups
- eliminate redundant option specs
- use conventional description wording, clarify some descriptions
- complete --pre-glob argument
- offer files for glob patterns (why not)

**File**: `crates/core/flags/complete/rg.zsh` (modified, +19/-24)
```diff
@@ -84,8 +84,8 @@ _rg() {
     $no'--no-encoding[use default text encoding]'
 
     + '(engine)' # Engine choice options
-    '--engine=[select which regex engine to use]:when:((
-      default\:"use default engine"
+    '--engine=[specify regex engine to use]:regex engine:((
+      default\:"default engine"
       pcre2\:"identical to --pcre2"
       auto\:"identical to --auto-hybrid-regex"
     ))'
@@ -113,18 +113,9 @@ _rg() {
     {-L,--follow}'[follow symlinks]'
     $no"--no-follow[don't follow symlinks]"
 
-    + '(generate)' # Options for generating ancillary data
-    '--generate=[generate man page or completion scripts]:when:((
-      man\:"man page"
-      complete-bash\:"shell completions for bash"
-      complete-zsh\:"shell completions for zsh"
-      complete-fish\:"shell completions for fish"
-      complete-powershell\:"shell completions for PowerShell"
-    ))'
-
     + glob # File-glob options
-    '*'{-g+,--glob=}'[include/exclude files matching specified glob]:glob'
-    '*--iglob=[include/exclude files matching specified case-insensitive glob]:glob'
+    '*'{-g+,--glob=}'[include/exclude files matching specified glob]:glob pattern:_files'
+    '*--iglob=[include/exclude files matching specified case-insensitive glob]:glob pattern:_files'
 
     + '(glob-case-insensitive)' # File-glob case sensitivity options
     '--glob-case-insensitive[treat -g/--glob patterns case insensitively]'
@@ -180,7 +171,7 @@ _rg() {
 
     + '(invert-match)'
     {-v,--invert-match}'[invert matching]'
-    $no"--no-invert-match[do not invert matching]"
+    $no"--no-invert-match[don't invert matching]"
 
     + '(json)' # JSON options
     '--json[output results in JSON Lines format]'
@@ -201,7 +192,6 @@ _rg() {
 
     + '(max-depth)' # Directory-depth options
     {-d,--max-depth}'[specify max number of directories to descend]:number of directories'
-    '--maxdepth=[alias for --max-depth]:number of directories'
     '!--maxdepth=:number of directories'
 
     + '(messages)' # Error-message options
@@ -229,7 +219,7 @@ _rg() {
 
     + '(passthru)' # Pass-through options
     '(--vimgrep)--passthru[show both matching and non-matching lines]'
-    '(--vimgrep)--passthrough[alias for --passthru]'
+    '!(--vimgrep)--passthrough'
 
     + '(pcre2)' # PCRE2 options
     {-P,--pcre2}'[enable matching with PCRE2]'
@@ -243,15 +233,12 @@ _rg() {
     '(-z --search-zip)--pre=[specify preprocessor utility]:preprocessor utility:_command_names -e'
     $no'--no-pre[disable preprocessor utility]'
 
-    + pre-glob # Preprocessing glob options
-    '*--pre-glob[include/exclude files for preprocessing with --pre]'
-
     + '(pretty-vimgrep)' # Pretty/vimgrep display options
     '(heading)'{-p,--pretty}'[alias for --color=always --heading -n]'
     '(heading passthru)--vimgrep[show results in vim-compatible format]'
 
     + regexp # Explicit pattern options
-    '(1 file)*'{-e+,--regexp=}'[specify pattern]:pattern'
+    '(1 file)*'{-e+,--regexp=}'[specify search pattern]:pattern'
 
     + '(replace)' # Replacement options
     {-r+,--replace=}'[specify string used to replace matches]:replace string'
@@ -272,7 +259,7 @@ _rg() {
       created\:"sort by creation time"
     ))'
     '(threads)--sort-files[DEPRECATED: sort results by file path (disables parallelism)]'
-    $no"--no-sort-files[DEPRECATED: do not sort results]"
+    $no"--no-sort-files[DEPRECATED: don't sort results]"
 
     + '(stats)' # Statistics options
     '(--files file-match)--stats[show search statistics]'
@@ -312,7 +299,7 @@ _rg() {
     $no"--no-search-zip[don't search in compressed files]"
 
     + misc # Other options — no need to separate these at the moment
-    '--color=[specify when to use colors in output]:when:((
+    '--color=[specify when to use colors in output]:when to use colors:((
       never\:"never use colors"
       auto\:"use colors or not based on stdout, TERM, etc."
       always\:"always use colors"
@@ -322,7 +309,14 @@ _rg() {
     '--debug[show debug messages]'
     '--field-context-separator[set string to delimit fields in context lines]'
     '--field-match-separator[set string to delimit fields in matching lines]'
-    '--hostname-bin=[executable for getting system hostname]:hostname executable:_command_names -e'
+    '--generate=[generate specified data (e.g. man page or completion script)]:data to generate:((
+      man\:"man page"
+      complete-bash\:"shell completions for bash"
+      complete-zsh\:"shell completions for zsh"
+      complete-fish\:"shell completions for fish"
+      complete-powershell\:"shell completions for PowerShell"
+    ))'
+    '--hostname-bin=[specify executable for getting system hostname]:hostname executable:_command_names -e'
     '--hyperlink-format=[specify pattern for hyperlinks]: :_rg_hyperlink_formats'
     '--trace[show more verbose debug messages]'
     '--dfa-size-limit=[specify upper size limit of generated DFA]:DFA size (bytes)'
@@ -334,13 +328,14 @@ _rg() {
     "--no-config[don't
```

---

### Incident Patch 15: `e0156728` (2026-07-08)
**Commit Message**: doc: fix typos in code comments



#### Recent Merged Pull Requests:
- **PR #3544** (closed): fix(ignore): keep excluded ancestor ignored despite path whitelist (@nikolas-sapa)
- **PR #3543** (closed): pattern: report file and line numbers for pattern compilation errors (@ReturnKartikey)
- **PR #3539** (closed): ignore: ignore empty gitignore negation patterns (@BrocodeADI)
- **PR #3536** (closed): hyperlink: percent-encode invalid UTF-8 bytes in file URLs (@nikolas-sapa)
- **PR #3531** (closed): ignore: treat a bare "!" gitignore line as a no-op, not a whitelist-e… (@voidstackloop)
- **PR #3509** (closed): Update GUIDE.md examples for latest release (15.2.0) (@mmustafasenoglu)
- **PR #3502** (2026-08-04): ignore,globset: increase pool capacity (@BurntSushi)
- **PR #3501** (2026-08-03): ci: fix binary discovery (@BurntSushi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
