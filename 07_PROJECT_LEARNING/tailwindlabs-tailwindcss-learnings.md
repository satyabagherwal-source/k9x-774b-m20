# Forensic Learning Record (Deep Inspection): tailwindlabs/tailwindcss

> **Canonical Artifact**: `07_PROJECT_LEARNING/tailwindlabs-tailwindcss-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:18:45.592Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tailwindlabs/tailwindcss`
- **Description**: A utility-first CSS framework for rapid UI development.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 97775 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/ignore/src/pathutil.rs`
```
use std::{ffi::OsStr, path::Path};

use crate::walk::DirEntry;

/// Returns true if and only if this path is considered to be hidden.
///
/// # Platform behavior
///
/// ## Windows
///
/// This returns true if one of the following is true:
///
/// * The base name of the path starts with a `.`.
/// * The file attributes have the `HIDDEN` property set.
///
/// ## All other platforms
///
/// This only returns true if the base name of the path starts with a `.`.
pub(crate) fn is_hidden_path(dent: &Path) -> bool {
    #[cfg(not(windows))]
    fn imp(path: &Path) -> bool {
        is_hidden_path_only(path)
    }

    #[cfg(windows)]
    fn imp(path: &Path) -> bool {
        use std::os::windows::fs::MetadataExt;
        use winapi_util::file;

        if let Ok(md) = path.metadata() {
            if file::is_hidden(md.file_attributes() as u64) {
                return true;
            }
        }
        is_hidden_path_only(path)
    }

    imp(dent)
}

/// Returns true if and only if this directory entry is considered to be
/// hidden.
///
/// # Platform behavior
///
/// ## Windows
///
/// This returns true if one of the following is true:
///
/// * The base name of the path starts with a `.`.
/// * The file attributes have the `HIDDEN` property set.
///
/// ## All other platforms
///
/// This only returns true if the base name of the path starts with a `.`.
pub(crate) fn is_hidden_entry(dent: &DirEntry) -> bool {
    #[cfg(not(windows))]
    fn imp(dent: &DirEntry) -> bool {
        is_hidden_path_only(dent.path())
    }

    #[cfg(windows)]
    fn imp(dent: &DirEntry) -> bool {
        use std::os::windows::fs::MetadataExt;
        use winapi_util::file;

        // This looks like we're doing an extra stat call, but on Windows, the
        // directory traverser reuses the metadata retrieved from each directory
        // entry and stores it on the DirEntry itself. So this is "free."
        if let Ok(md) = dent.metadata() {
            if file::is_hidden(md.file_attributes() as u64) {
                return true;
            }
        }
        is_hidden_path_only(dent.path())
    }

    imp(dent)
}

/// Returns true if and only if this path is considered to be hidden from only
/// the path itself.
///
/// This has the same behavior on all platforms.
fn is_hidden_path_only(path: &Path) -> bool {
    if let Some(name) = file_name(path) {
        name.as_encoded_bytes().starts_with(b".")
    } else {
        false
    }
}

/// Strip `prefix` from the `path` and return the remainder.
///
/// If `path` doesn't have a prefix `prefix`, then return `None`.
pub(crate) fn strip_prefix<'a, P: AsRef<Path> + ?Sized>(
    prefix: &'a P,
    path: &'a Path,
) -> Option<&'a Path> {
    #[cfg(unix)]
    fn imp<'a>(prefix: &'a Path, path: &'a Path) -> Option<&'a Path> {
        use std::os::unix::ffi::OsStrExt;

        let prefix = prefix.as_os_str().as_bytes();
        let path = path.as_os_str().as_bytes();
        if prefix.len() > path.len() || prefix != &path[0..prefix.len()] {
            None
        } else {
            Some(&Path::new(OsStr::from_bytes(&path[prefix.len()..])))
        }
    }

    #[cfg(not(unix))]
    fn imp<'a>(prefix: &'a Path, path: &'a Path) -> Option<&'a Path> {
        path.strip_prefix(prefix).ok()
    }

    imp(prefix.as_ref(), path)
}

/// Returns true if this file path is just a file name. i.e., Its parent is
/// the empty string.
pub(crate) fn is_file_name<P: AsRef<Path>>(path: P) -> bool {
    #[cfg(unix)]
    {
        memchr::memchr(b'/', path.as_ref().as_os_str().as_encoded_bytes())
            .is_none()
    }
    #[cfg(not(unix))]
    {
        path.as_ref()
            .parent()
            .map(|p| p.as_os_str().is_empty())
            .unwrap_or(false)
    }
}

/// The final component of the path, if it is a normal file.
///
/// If the path terminates in `.`, `..`, or consists solely of a root of
/// prefix, this will return `None`.
pub(crate) fn file_name<'a, P: AsRef<Path> + ?Sized>(
    path: &'a P,
) -> Option<&'a OsStr> {
    #[cfg(unix)]
    fn imp(path: &Path) -> Option<&OsStr> {
        use std::os::unix::ffi::OsStrExt;

        use memchr::memrchr;

        let path = path.as_os_str().as_bytes();
        if path.is_empty() {
            return None;
        } else if path.len() == 1 && path[0] == b'.' {
            return None;
        } else if path.last() == Some(&b'.') {
            return None;
        } else if path.len() >= 2 && &path[path.len() - 2..] == &b".."[..] {
            return None;
        }
        let last_slash = memrchr(b'/', path).map(|i| i + 1).unwrap_or(0);
        Some(OsStr::from_bytes(&path[last_slash..]))
    }

    #[cfg(not(unix))]
    fn imp(path: &Path) -> Option<&OsStr> {
        path.file_name()
    }

    imp(path.as_ref())
}

```

### Core Architecture Module: `crates/oxide/src/extractor/named_utility_machine.rs`
```
use crate::cursor;
use crate::extractor::arbitrary_value_machine::ArbitraryValueMachine;
use crate::extractor::arbitrary_variable_machine::ArbitraryVariableMachine;
use crate::extractor::boundary::is_valid_after_boundary;
use crate::extractor::machine::{Machine, MachineState};
use classification_macros::ClassifyBytes;
use std::marker::PhantomData;

#[derive(Debug, Default)]
pub struct IdleState;

#[derive(Debug, Default)]
pub struct ParsingState;

/// Extracts named utilities from an input.
///
/// E.g.:
///
/// ```text
/// flex
/// ^^^^
///
/// bg-red-500
/// ^^^^^^^^^^
/// ```
#[derive(Debug, Default)]
pub struct NamedUtilityMachine<State = IdleState> {
    /// Start position of the utility
    start_pos: usize,

    arbitrary_variable_machine: ArbitraryVariableMachine,
    arbitrary_value_machine: ArbitraryValueMachine,

    _state: PhantomData<State>,
}

impl<State> NamedUtilityMachine<State> {
    #[inline(always)]
    fn transition<NextState>(&self) -> NamedUtilityMachine<NextState> {
        NamedUtilityMachine {
            start_pos: self.start_pos,
            arbitrary_variable_machine: Default::default(),
            arbitrary_value_machine: Default::default(),
            _state: PhantomData,
        }
    }
}

impl Machine for NamedUtilityMachine<IdleState> {
    #[inline(always)]
    fn reset(&mut self) {}

    #[inline]
    fn next(&mut self, cursor: &mut cursor::Cursor<'_>) -> MachineState {
        match cursor.curr().into() {
            Class::AlphaLower => match cursor.next().into() {
                // Valid single character utility in between quotes
                //
                // E.g.: `<div class="a"></div>`
                //                    ^
                // E.g.: `<div class="a "></div>`
                //                    ^
                // E.g.: `<div class=" a"></div>`
                //                     ^
                Class::Whitespace | Class::Quote | Class::End => self.done(cursor.pos, cursor),

                // Valid start characters
                //
                // E.g.: `flex`
                //        ^
                _ => {
                    self.start_pos = cursor.pos;
                    cursor.advance();
                    self.transition::<ParsingState>().next(cursor)
                }
            },

            // Valid start characters
            //
            // E.g.: `@container`
            //        ^
            Class::At => {
                self.start_pos = cursor.pos;
                cursor.advance();
                self.transition::<ParsingState>().next(cursor)
            }

            // Valid start of a negative utility, if followed by another set of valid
            // characters. `@` as a second character is invalid.
            //
            // E.g.: `-mx-2.5`
            //        ^^
            Class::Dash => match cursor.next().into() {
                Class::AlphaLower => {
                    self.start_pos = cursor.pos;
                    cursor.advance();
                    self.transition::<ParsingState>().next(cursor)
                }

                // A dash should not be followed by anything else
                _ => MachineState::Idle,
            },

            // Everything else, is not a valid start of the utility.
            _ => MachineState::Idle,
        }
    }
}

impl Machine for NamedUtilityMachine<ParsingState> {
    #[inline(always)]
    fn reset(&mut self) {
        self.start_pos = 0;
    }

    #[inline]
    fn next(&mut self, cursor: &mut cursor::Cursor<'_>) -> MachineState {
        let len = cursor.input.len();

        while cursor.pos < len {
            match cursor.curr().into() {
                // Followed by a boundary character, we are at the end of the utility.
                //
                // E.g.: `'flex'`
                //             ^
                // E.g.: `<div class="flex items-center">`
                //                        ^
                // E.g.: `[flex]` (Angular syntax)
                //             ^
                // E.g.: `[class.flex.items-center]` (Angular syntax)
                //                   ^
                // E.g.: `:div="{ flex: true }"` (JavaScript object syntax)
                //                    ^
                Class::AlphaLower | Class::AlphaUpper => {
                    if is_valid_after_boundary(&cursor.next()) || {
                        // Or any of these characters
                        //
                        // - `:`, because of JS object keys
                        // - `/`, because of modifiers
                        // - `!`, because of important
                        matches!(
                            cursor.next().into(),
                            Class::Colon | Class::Slash | Class::Exclamation
                        )
                    } {
                        return self.done(self.start_pos, cursor);
                    }

                    // Still valid characters
                    cursor.advance()
                }

                Class::Dash => match cursor.next().into() {
                    // Start of an arbitrary value
                    //
                    // E.g.: `bg-[#0088cc]`
                    //          ^^
                    Class::OpenBracket => {
                        cursor.advance();
                        return match self.arbitrary_value_machine.next(cursor) {
                            MachineState::Idle => self.restart(),
                            MachineState::Done(_) => self.done(self.start_pos, cursor),
                        };
                    }

                    // Start of an arbitrary variable
                    //
                    // E.g.: `bg-(--my-color)`
                    //          ^^
                    Class::OpenParen => {
                        cursor.advance();
                        return match self.arbitrary_variable_machine.next(cursor) {
                            MachineState::Idle => self.restart(),
                            MachineState::Done(_) => self.done(self.start_pos, cursor),
                        };
                    }

                    // A dash is a valid character if it is followed by another valid
                    // character.
                    //
                    // E.g.: `flex-`
                    //            ^    Invalid
                    // E.g.: `flex-!`
                    //            ^    Invalid
                    // E.g.: `flex-/`
                    //            ^    Invalid
                    // E.g.: `flex-2`
                    //            ^    Valid
                    // E.g.: `foo--bar`
                    //            ^    Valid
                    Class::AlphaLower | Class::AlphaUpper | Class::Number | Class::Dash => {
                        cursor.advance();
                    }

                    // Everything else is invalid
                    _ => return self.restart(),
                },

                Class::Underscore => match cursor.next().into() {
                    // Valid characters _if_ followed by another valid character. These characters are
                    // only valid inside of the utility but not at the end of the utility.
                    //
                    // E.g.: `custom_`
                    //              ^    Invalid
                    // E.g.: `custom_!`
                    //              ^    Invalid
                    // E.g.: `custom_/`
                    //              ^    Invalid
                    // E.g.: `custom_2`
                    //              ^    Valid
                    //
                    Class::AlphaLower | Class::AlphaUpper | Class::Number | Class::Underscore => {
                        cursor.advance();
                    }

                    // Followed by a boundary character, we are at the end of the utility.
                    //
                    // E.g.: `'flex'`
                    //             ^
                    // E.g.: `<div class="flex items-center">`
                    //                        ^
                    // E.g.: `[flex]` (Angular syntax)
                    //             ^
                    // E.g.: `[class.flex.items-center]` (Angular syntax)
                    //                   ^
                    // E.g.: `:div="{ flex: true }"` (JavaScript object syntax)
                    //                    ^
                    _ if is_valid_after_boundary(&cursor.next()) || {
                        // Or any of these characters
                        //
                        // - `:`, because of JS object keys
                        // - `/`, because of modifiers
                        // - `!`, because of important
                        matches!(
                            cursor.next().into(),
                            Class::Colon | Class::Slash | Class::Exclamation
                        )
                    } =>
                    {
                        return self.done(self.start_pos, cursor)
                    }

                    // Everything else is invalid
                    _ => return self.restart(),
                },

                // A dot must be surrounded by numbers
                //
                // E.g.: `px-2.5`
                //           ^^^
                Class::Dot => {
                    if !matches!(cursor.prev().into(), Class::Number) {
                        return self.restart();
                    }

                    if !matches!(cursor.next().into(), Class::Number) {
                        return self.restart();
                    }

                    cursor.advance();
                }

                // A number must be preceded by a `-`, `.` or another alphanumeric
                // character, and can be followed by a `.` or an alphanumeric character or
                // dash or underscore.
                //
                // E.g.: `tex
```

### Core Architecture Module: `crates/oxide/src/extractor/utility_machine.rs`
```
use crate::cursor;
use crate::extractor::arbitrary_property_machine::ArbitraryPropertyMachine;
use crate::extractor::machine::{Machine, MachineState};
use crate::extractor::modifier_machine::ModifierMachine;
use crate::extractor::named_utility_machine::NamedUtilityMachine;
use classification_macros::ClassifyBytes;

#[derive(Debug, Default)]
pub struct UtilityMachine {
    /// Start position of the utility
    start_pos: usize,

    /// Whether the legacy important marker `!` was used
    legacy_important: bool,

    arbitrary_property_machine: ArbitraryPropertyMachine,
    named_utility_machine: NamedUtilityMachine,
    modifier_machine: ModifierMachine,
}

impl Machine for UtilityMachine {
    #[inline(always)]
    fn reset(&mut self) {
        self.start_pos = 0;
        self.legacy_important = false;
    }

    #[inline]
    fn next(&mut self, cursor: &mut cursor::Cursor<'_>) -> MachineState {
        match cursor.curr().into() {
            // LEGACY: Important marker
            Class::Exclamation => {
                self.legacy_important = true;

                match cursor.next().into() {
                    // Start of an arbitrary property
                    //
                    // E.g.: `![color:red]`
                    //        ^
                    Class::OpenBracket => {
                        self.start_pos = cursor.pos;
                        cursor.advance();
                        self.parse_arbitrary_property(cursor)
                    }

                    // Start of a named utility
                    //
                    // E.g.: `!flex`
                    //        ^
                    _ => {
                        self.start_pos = cursor.pos;
                        cursor.advance();
                        self.parse_named_utility(cursor)
                    }
                }
            }

            // Start of an arbitrary property
            //
            // E.g.: `[color:red]`
            //        ^
            Class::OpenBracket => {
                self.start_pos = cursor.pos;
                self.parse_arbitrary_property(cursor)
            }

            // Everything else might be a named utility. Delegate to the named utility machine
            // to determine if it's a named utility or not.
            _ => {
                self.start_pos = cursor.pos;
                self.parse_named_utility(cursor)
            }
        }
    }
}

impl UtilityMachine {
    fn parse_arbitrary_property(&mut self, cursor: &mut cursor::Cursor<'_>) -> MachineState {
        match self.arbitrary_property_machine.next(cursor) {
            MachineState::Idle => self.restart(),
            MachineState::Done(_) => match cursor.next().into() {
                // End of arbitrary property, but there is a potential modifier.
                //
                // E.g.: `[color:#0088cc]/`
                //                       ^
                Class::Slash => {
                    cursor.advance();
                    self.parse_modifier(cursor)
                }

                // End of arbitrary property, but there is an `!`.
                //
                // E.g.: `[color:#0088cc]!`
                //                       ^
                Class::Exclamation => {
                    cursor.advance();
                    self.parse_important(cursor)
                }

                // End of arbitrary property
                //
                // E.g.: `[color:#0088cc]`
                //                      ^
                _ => self.done(self.start_pos, cursor),
            },
        }
    }

    fn parse_named_utility(&mut self, cursor: &mut cursor::Cursor<'_>) -> MachineState {
        match self.named_utility_machine.next(cursor) {
            MachineState::Idle => self.restart(),
            MachineState::Done(_) => match cursor.next().into() {
                // End of a named utility, but there is a potential modifier.
                //
                // E.g.: `bg-red-500/`
                //                  ^
                Class::Slash => {
                    cursor.advance();
                    self.parse_modifier(cursor)
                }

                // End of named utility, but there is an `!`.
                //
                // E.g.: `bg-red-500!`
                //                  ^
                Class::Exclamation => {
                    cursor.advance();
                    self.parse_important(cursor)
                }

                // End of a named utility
                //
                // E.g.: `bg-red-500`
                //                 ^
                _ => self.done(self.start_pos, cursor),
            },
        }
    }

    fn parse_modifier(&mut self, cursor: &mut cursor::Cursor<'_>) -> MachineState {
        match self.modifier_machine.next(cursor) {
            MachineState::Idle => self.restart(),
            MachineState::Done(_) => match cursor.next().into() {
                // A modifier followed by a modifier is invalid
                Class::Slash => self.restart(),

                // A modifier followed by the important marker `!`
                Class::Exclamation => {
                    cursor.advance();
                    self.parse_important(cursor)
                }

                // Everything else is valid
                _ => self.done(self.start_pos, cursor),
            },
        }
    }

    fn parse_important(&mut self, cursor: &mut cursor::Cursor<'_>) -> MachineState {
        // Only the `!` is valid if we didn't start with `!`
        //
        // E.g.:
        //
        // ```
        // !bg-red-500!
        //            ^ invalid because of the first `!`
        // ```
        if self.legacy_important {
            return self.restart();
        }

        self.done(self.start_pos, cursor)
    }
}

#[derive(Debug, Clone, Copy, ClassifyBytes)]
enum Class {
    #[bytes(b'!')]
    Exclamation,

    #[bytes(b'[')]
    OpenBracket,

    #[bytes(b'/')]
    Slash,

    #[fallback]
    Other,
}

#[cfg(test)]
mod tests {
    use super::UtilityMachine;
    use crate::extractor::machine::Machine;
    use pretty_assertions::assert_eq;

    #[test]
    #[ignore]
    fn test_utility_machine_performance() {
        let input = r#"<button type="button" class="absolute -top-1 -left-1.5 flex items-center justify-center p-1.5 text-gray-400">"#.repeat(100);

        UtilityMachine::test_throughput(100_000, &input);
        UtilityMachine::test_duration_once(&input);

        todo!()
    }

    #[test]
    fn test_utility_extraction() {
        for (input, expected) in [
            // Simple utility
            ("flex", vec!["flex"]),
            // Simple utility with special character(s)
            ("@container", vec!["@container"]),
            // Single character utility
            ("a", vec!["a"]),
            // Important utilities
            ("!flex", vec!["!flex"]),
            ("flex!", vec!["flex!"]),
            ("flex! block", vec!["flex!", "block"]),
            // With dashes
            ("items-center", vec!["items-center"]),
            ("items--center", vec!["items--center"]),
            // Inside a string
            ("'flex'", vec!["flex"]),
            // Multiple utilities
            ("flex items-center", vec!["flex", "items-center"]),
            // Arbitrary property
            ("[color:red]", vec!["[color:red]"]),
            ("![color:red]", vec!["![color:red]"]),
            ("[color:red]!", vec!["[color:red]!"]),
            ("[color:red]/20", vec!["[color:red]/20"]),
            ("![color:red]/20", vec!["![color:red]/20"]),
            ("[color:red]/20!", vec!["[color:red]/20!"]),
            // Modifiers
            ("bg-red-500/20", vec!["bg-red-500/20"]),
            ("bg-red-500/[20%]", vec!["bg-red-500/[20%]"]),
            (
                "bg-red-500/(--my-opacity)",
                vec!["bg-red-500/(--my-opacity)"],
            ),
            // Modifiers with important (legacy)
            ("!bg-red-500/20", vec!["!bg-red-500/20"]),
            ("!bg-red-500/[20%]", vec!["!bg-red-500/[20%]"]),
            (
                "!bg-red-500/(--my-opacity)",
                vec!["!bg-red-500/(--my-opacity)"],
            ),
            // Modifiers with important
            ("bg-red-500/20!", vec!["bg-red-500/20!"]),
            ("bg-red-500/[20%]!", vec!["bg-red-500/[20%]!"]),
            (
                "bg-red-500/(--my-opacity)!",
                vec!["bg-red-500/(--my-opacity)!"],
            ),
            // Arbitrary value with bracket notation
            ("bg-[#0088cc]", vec!["bg-[#0088cc]"]),
            // Arbitrary value with arbitrary property shorthand modifier
            (
                "bg-[#0088cc]/(--my-opacity)",
                vec!["bg-[#0088cc]/(--my-opacity)"],
            ),
            // Arbitrary value with CSS property shorthand
            ("bg-(--my-color)", vec!["bg-(--my-color)"]),
            // Multiple utilities including arbitrary property shorthand
            (
                "bg-(--my-color) flex px-(--my-padding)",
                vec!["bg-(--my-color)", "flex", "px-(--my-padding)"],
            ),
            // --------------------------------------------------------

            // Exceptions:
            ("bg-red-500/20/20", vec![]),
            ("bg-[#0088cc]/20/20", vec![]),
        ] {
            for (wrapper, additional) in [
                // No wrapper
                ("{}", vec![]),
                // With leading spaces
                (" {}", vec![]),
                // With trailing spaces
                ("{} ", vec![]),
                // Surrounded by spaces
                (" {} ", vec![]),
                // Inside a string
                ("'{}'", vec![]),
                // Inside a function call
                ("fn('{}')", vec![]),
                // Inside nested function calls
                ("fn1(fn2('{}'))", vec!["fn1", "fn2"]),
                // -------------------------
```

### Core Architecture Module: `integrations/utils.ts`
```
import dedent from 'dedent'
import fastGlob from 'fast-glob'
import { exec, execFile, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import { createServer } from 'node:net'
import { platform, tmpdir } from 'node:os'
import path from 'node:path'
import { promisify, stripVTControlCharacters } from 'node:util'
import { RawSourceMap, SourceMapConsumer } from 'source-map-js'
import { test as defaultTest, type ExpectStatic } from 'vitest'
import * as Yaml from 'yaml'
import { createLineTable } from '../packages/tailwindcss/src/source-maps/line-table'
import { escape } from '../packages/tailwindcss/src/utils/escape'

const REPO_ROOT = path.join(__dirname, '..')
const ROOT_PNPM_WORKSPACE = Yaml.parse(
  await fs.readFile(path.join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8'),
)
const PUBLIC_PACKAGES = (await fs.readdir(path.join(REPO_ROOT, 'dist'))).map((name) =>
  name.replace('tailwindcss-', '@tailwindcss/').replace('.tgz', ''),
)

interface SpawnedProcess {
  dispose: () => Promise<void>
  flush: () => void
  onStdout: (predicate: (message: string) => boolean) => Promise<void>
  onStderr: (predicate: (message: string) => boolean) => Promise<void>
}

interface ChildProcessOptions {
  cwd?: string
  env?: Record<string, string>
}

interface ExecOptions {
  ignoreStdErr?: boolean
  stdin?: string
}

interface TestConfig {
  fs: {
    [filePath: string]: string | Uint8Array
  }

  timeout?: number
  installDependencies?: boolean
  retry?: number
}
interface TestContext {
  root: string
  expect: ExpectStatic
  exec(command: string, options?: ChildProcessOptions, execOptions?: ExecOptions): Promise<string>
  spawn(command: string, options?: ChildProcessOptions): Promise<SpawnedProcess>
  parseSourceMap(opts: string | SourceMapOptions): SourceMap
  fs: {
    write(filePath: string, content: string, encoding?: BufferEncoding): Promise<void>
    symlink(dst: string, src: string): Promise<void>
    create(filePaths: string[]): Promise<void>
    read(filePath: string): Promise<string>
    delete(filePath: string): Promise<void>
    glob(pattern: string): Promise<[string, string][]>
    dumpFiles(pattern: string): Promise<string>
    expectFileToContain(
      filePath: string,
      contents: string | RegExp | (string | RegExp)[],
    ): Promise<void>
    expectFileNotToContain(filePath: string, contents: string[]): Promise<void>
  }
}
type TestCallback = (context: TestContext) => Promise<void> | void
interface TestFlags {
  only?: boolean
  skip?: boolean
  debug?: boolean
  concurrent?: boolean
}

type SpawnActor = { predicate: (message: string) => boolean; resolve: () => void }

export const IS_WINDOWS = platform() === 'win32'

const execFileAsync = promisify(execFile)

const TEST_TIMEOUT = IS_WINDOWS ? 120000 : 60000
const ASSERTION_TIMEOUT = IS_WINDOWS ? 10000 : 5000

// On Windows CI, tmpdir returns a path containing a weird RUNNER~1 folder that
// apparently causes the vite builds to not work.
const TMP_ROOT =
  process.env.CI && IS_WINDOWS ? path.dirname(process.env.GITHUB_WORKSPACE!) : tmpdir()

export function test(
  name: string,
  config: TestConfig,
  testCallback: TestCallback,
  { only = false, skip = false, debug = false, concurrent = false }: TestFlags = {},
) {
  return defaultTest(
    name,
    {
      timeout: config.timeout ?? TEST_TIMEOUT,
      retry: config.retry ?? (process.env.CI ? 2 : 0),
      only: only || (!process.env.CI && debug),
      skip,
      concurrent,
    },
    async (options) => {
      let rootDir = debug ? path.join(REPO_ROOT, '.debug') : TMP_ROOT
      await fs.mkdir(rootDir, { recursive: true })

      let root = await fs.mkdtemp(path.join(rootDir, 'tailwind-integrations'))

      if (debug) {
        console.log('Running test in debug mode. File system will be written to:')
        console.log(root)
        console.log()
      }

      let context = {
        root,
        expect: options.expect,
        parseSourceMap,
        async exec(
          command: string,
          childProcessOptions: ChildProcessOptions = {},
          execOptions: ExecOptions = {},
        ) {
          let cwd = childProcessOptions.cwd ?? root
          let originalCommand = command

          // Avoid `pnpm exec upgrade` on Windows because the upgrader runs
          // `pnpm add`, which rewrites Windows `.cmd` shims while the current
          // shim is still executing.
          //
          // Pretty sure this is a pnpm v11 bug on Windows.
          if (IS_WINDOWS && command.includes('pnpm exec upgrade')) {
            for (let base = cwd; ; base = path.dirname(base)) {
              let upgradeBin = path.join(
                base,
                'node_modules',
                '@tailwindcss',
                'upgrade',
                'dist',
                'index.mjs',
              )

              try {
                await fs.access(upgradeBin)
                command = command.replace('pnpm exec upgrade', `node "${upgradeBin}"`)
                break
              } catch (error: any) {
                if (error?.code !== 'ENOENT') throw error
              }

              let parent = path.dirname(base)
              if (parent === base) {
                throw new Error(`Unable to resolve @tailwindcss/upgrade from ${cwd}`)
              }
            }
          }

          if (debug && cwd !== root) {
            let relative = path.relative(root, cwd)
            if (relative[0] !== '.') relative = `./${relative}`
            console.log(`> cd ${relative}`)
          }
          if (debug) console.log(`> ${command}`)
          return new Promise((resolve, reject) => {
            let child = exec(
              command,
              {
                cwd,
                ...childProcessOptions,
                env: {
                  ...process.env,
                  ...childProcessOptions.env,
                },
              },
              (error, stdout, stderr) => {
                if (error) {
                  if (command !== originalCommand) {
                    error.message = error.message.replace(command, originalCommand)
                    let mappedError = error as any
                    mappedError.cmd = originalCommand
                  }
                  if (execOptions.ignoreStdErr !== true) console.error(stderr)
                  if (only || debug) {
                    console.error(stdout)
                  }
                  reject(error)
                } else {
                  if (only || debug) {
                    console.log(stdout.toString() + '\n\n' + stderr.toString())
                  }
                  resolve(stdout.toString() + '\n\n' + stderr.toString())
                }
              },
            )
            if (execOptions.stdin) {
              child.stdin?.write(execOptions.stdin)
              child.stdin?.end()
            }
          })
        },
        async spawn(command: string, childProcessOptions: ChildProcessOptions = {}) {
          let resolveDisposal: (() => void) | undefined
          let rejectDisposal: ((error: Error) => void) | undefined
          let disposePromise = new Promise<void>((resolve, reject) => {
            resolveDisposal = resolve
            rejectDisposal = reject
          })

          let cwd = childProcessOptions.cwd ?? root
          if (debug && cwd !== root) {
            let relative = path.relative(root, cwd)
            if (relative[0] !== '.') relative = `./${relative}`
            console.log(`> cd ${relative}`)
          }
          if (debug) console.log(`>& ${command}`)
          let child = spawn(command, {
            cwd,
            detached: !IS_WINDOWS,
            shell: true,
            ...childProcessOptions,
            env: {
              ...process.env,
              ...childProcessOptions.env,
            },
          })

          let disposed = false

          async function dispose() {
            if (disposed) return disposePromise
            disposed = true

            await killProcessTree(child)

            let timer = setTimeout(() => {
              forceKillProcessTree(child)
              rejectDisposal?.(new Error(`spawned process (${command}) did not exit in time`))
            }, ASSERTION_TIMEOUT)
            disposePromise.then(
              () => clearTimeout(timer),
              () => clearTimeout(timer),
            )
            return disposePromise
          }
          disposables.push(dispose)

          function onExit() {
            resolveDisposal?.()
          }

          let stdoutMessages: string[] = []
          let stderrMessages: string[] = []

          let stdoutActors: SpawnActor[] = []
          let stderrActors: SpawnActor[] = []

          function notifyNext(actors: SpawnActor[], messages: string[]) {
            if (actors.length <= 0) return
            let [next] = actors

            for (let [idx, message] of messages.entries()) {
              if (next.predicate(message)) {
                messages.splice(0, idx + 1)
                let actorIdx = actors.indexOf(next)
                actors.splice(actorIdx, 1)
                next.resolve()
                break
              }
            }
          }

          let combined: ['stdout' | 'stderr', string][] = []

          child.stdout.on('data', (result) => {
            let content = result.toString()
            if (debug || only) console.log(content)
            combined.push(['stdout', content])
            for (let line of content.split('\n')) {
              stdoutMessages.push(stripVTControlCharacters(line))
            }
            notifyNext(stdoutActors, stdoutMessages)
          })
          child.stderr.on('data', (result) => {
            let content = result.toString()
            if (debug || only) console.error(content)
            combined.push(['stderr', content])
            for (let line of content.split('\n')) {
              stderrMessages.push(stripVTControlCharacters(line))
            
```

### Core Architecture Module: `packages/@tailwindcss-cli/src/utils/args.ts`
```
import parse from 'mri'

// Definition of the arguments for a command in the CLI.
export type Arg = {
  [key: `--${string}`]: {
    type: keyof Types
    description: string
    alias?: `-${string}`
    default?: Types[keyof Types]
    values?: string[]
  }
}

// Each argument will have a type and we want to convert the incoming raw string
// based value to the correct type. We can't use pure TypeScript types because
// these don't exist at runtime. Instead, we define a string-based type that
// maps to a TypeScript type.
type Types = {
  boolean: boolean
  number: number | null
  string: string | null
  'boolean | string': boolean | string | null
  'number | string': number | string | null
  'boolean | number': boolean | number | null
  'boolean | number | string': boolean | number | string | null
}

// Convert the `Arg` type to a type that can be used at runtime.
//
// E.g.:
//
// Arg:
// ```
// { '--input': { type: 'string', description: 'Input file', alias: '-i' } }
// ```
//
// Command:
// ```
// ./tailwindcss -i input.css
// ./tailwindcss --input input.css
// ```
//
// Result type:
// ```
// {
//   _: string[],             // All non-flag arguments
//   '--input': string | null // The `--input` flag will be filled with `null`, if the flag is not used.
//                            // The `null` type will not be there if `default` is provided.
// }
// ```
//
// Result runtime object:
// ```
// {
//   _: [],
//   '--input': 'input.css'
// }
// ```
export type Result<T extends Arg> = {
  [K in keyof T]: T[K] extends { type: keyof Types; default?: any }
    ? undefined extends T[K]['default']
      ? Types[T[K]['type']]
      : NonNullable<Types[T[K]['type']]>
    : never
} & {
  // All non-flag arguments
  _: string[]
}

export function args<const T extends Arg>(options: T, argv = process.argv.slice(2)): Result<T> {
  for (let [idx, value] of argv.entries()) {
    if (value === '-') {
      argv[idx] = '__IO_DEFAULT_VALUE__'
    }
  }

  let parsed = parse(argv)

  for (let key in parsed) {
    let value = parsed[key]

    if (key !== '_' && Array.isArray(value)) {
      value = value[value.length - 1]
    }

    if (value === '__IO_DEFAULT_VALUE__') {
      value = '-'
    }

    parsed[key] = value
  }

  let result: { _: string[]; [key: string]: unknown } = {
    _: parsed._,
  }

  for (let [
    flag,
    { type, alias, default: defaultValue = type === 'boolean' ? false : null },
  ] of Object.entries(options)) {
    // Start with the default value
    result[flag] = defaultValue

    // Try to find the `alias`, and map it to long form `flag`
    if (alias) {
      let key = alias.slice(1)
      if (parsed[key] !== undefined) {
        result[flag] = convert(parsed[key], type)
      }
    }

    // Try to find the long form `flag`
    {
      let key = flag.slice(2)
      if (parsed[key] !== undefined) {
        result[flag] = convert(parsed[key], type)
      }
    }
  }

  return result as Result<T>
}

// ---

type ArgumentType = string | boolean

// Try to convert the raw incoming `value` (which will be a string or a boolean,
// this is coming from `mri`'s parse function'), to the correct type based on
// the `type` of the argument.
function convert<T extends keyof Types>(value: string | boolean, type: T) {
  switch (type) {
    case 'string':
      return convertString(value)
    case 'boolean':
      return convertBoolean(value)
    case 'number':
      return convertNumber(value)
    case 'boolean | string':
      return convertBoolean(value) ?? convertString(value)
    case 'number | string':
      return convertNumber(value) ?? convertString(value)
    case 'boolean | number':
      return convertBoolean(value) ?? convertNumber(value)
    case 'boolean | number | string':
      return convertBoolean(value) ?? convertNumber(value) ?? convertString(value)
    default:
      throw new Error(`Unhandled type: ${type}`)
  }
}

function convertBoolean(value: ArgumentType) {
  if (value === true || value === false) {
    return value
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }
}

function convertNumber(value: ArgumentType) {
  if (typeof value === 'number') {
    return value
  }

  {
    let valueAsNumber = Number(value)
    if (!Number.isNaN(valueAsNumber)) {
      return valueAsNumber
    }
  }
}

function convertString(value: ArgumentType) {
  return `${value}`
}

```

### Core Architecture Module: `packages/@tailwindcss-cli/src/utils/disposables.ts`
```
/**
 * Disposables allow you to manage resources that can be cleaned up. Each helper
 * function returns a dispose function to clean up the resource.
 *
 * The `dispose` method can be called to clean up all resources at once.
 */
export class Disposables {
  // Track all disposables
  #disposables = new Set<Function>([])

  /**
   * Enqueue a callback in the macrotasks queue.
   */
  queueMacrotask(cb: () => void) {
    let timer = setTimeout(cb, 0)

    return this.add(() => {
      clearTimeout(timer)
    })
  }

  /**
   * General purpose disposable function that can be cleaned up.
   */
  add(dispose: () => void) {
    this.#disposables.add(dispose)

    return () => {
      this.#disposables.delete(dispose)

      dispose()
    }
  }

  /**
   * Dispose all disposables at once.
   */
  async dispose() {
    for (let dispose of this.#disposables) {
      await dispose()
    }

    this.#disposables.clear()
  }
}

```

### Core Architecture Module: `packages/@tailwindcss-cli/src/utils/format-ns.ts`
```
export function formatNanoseconds(input: bigint | number) {
  let ns = typeof input === 'number' ? BigInt(input) : input

  if (ns < 1_000n) return `${ns}ns`
  ns /= 1_000n

  if (ns < 1_000n) return `${ns}µs`
  ns /= 1_000n

  if (ns < 1_000n) return `${ns}ms`
  ns /= 1_000n

  if (ns < 60n) return `${ns}s`
  ns /= 60n

  if (ns < 60n) return `${ns}m`
  ns /= 60n

  if (ns < 24n) return `${ns}h`
  ns /= 24n

  return `${ns}d`
}

```

### Core Architecture Module: `packages/@tailwindcss-cli/src/utils/renderer.ts`
```
import fs from 'node:fs'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import pc from 'picocolors'
import { resolve } from '../utils/resolve'
import { formatNanoseconds } from './format-ns'

export const UI = {
  indent: 2,
}
export function header() {
  return `${pc.italic(pc.bold(pc.blue('\u2248')))} tailwindcss ${pc.blue(`v${getVersion()}`)}`
}

export function highlight(file: string) {
  return `${pc.dim(pc.blue('`'))}${pc.blue(file)}${pc.dim(pc.blue('`'))}`
}

/**
 * Convert an `absolute` path to a `relative` path from the current working
 * directory.
 */
export function relative(
  to: string,
  from = process.cwd(),
  { preferAbsoluteIfShorter = true } = {},
) {
  let result = path.relative(from, to)
  if (!result.startsWith('..')) {
    result = `.${path.sep}${result}`
  }

  if (preferAbsoluteIfShorter && result.length > to.length) {
    return to
  }

  return result
}

/**
 * Wrap `text` into multiple lines based on the `width`.
 */
export function wordWrap(text: string, width: number) {
  let words = text.split(' ')
  let lines = []

  let line = ''
  let lineLength = 0
  for (let word of words) {
    let wordLength = stripVTControlCharacters(word).length

    // A word longer than `width` is kept on its own line rather than
    // introducing an empty line before it.
    if (lineLength > 0 && lineLength + wordLength + 1 > width) {
      lines.push(line)
      line = ''
      lineLength = 0
    }

    line += (lineLength ? ' ' : '') + word
    lineLength += wordLength + (lineLength ? 1 : 0)
  }

  if (lineLength) {
    lines.push(line)
  }

  return lines
}

/**
 * Format a duration in nanoseconds to a more human readable format.
 */
export function formatDuration(ns: bigint) {
  let formatted = formatNanoseconds(ns)

  if (ns <= 50 * 1e6) return pc.green(formatted)
  if (ns <= 300 * 1e6) return pc.blue(formatted)
  if (ns <= 1000 * 1e6) return pc.yellow(formatted)

  return pc.red(formatted)
}

export function indent(value: string, offset = 0) {
  return `${' '.repeat(offset + UI.indent)}${value}`
}

// Rust inspired functions to print to the console:

export function eprintln(value = '') {
  process.stderr.write(`${value}\n`)
}

export function println(value = '') {
  process.stdout.write(`${value}\n`)
}

function getVersion(): string {
  if (typeof globalThis.__tw_version === 'string') {
    return globalThis.__tw_version
  }
  let { version } = JSON.parse(fs.readFileSync(resolve('tailwindcss/package.json'), 'utf-8'))
  return version
}

```

### Core Architecture Module: `packages/@tailwindcss-cli/src/utils/resolve.ts`
```
import EnhancedResolve from 'enhanced-resolve'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const localResolve = createRequire(import.meta.url).resolve
export function resolve(id: string) {
  if (typeof globalThis.__tw_resolve === 'function') {
    let resolved = globalThis.__tw_resolve(id)
    if (resolved) {
      return resolved
    }
  }
  return localResolve(id)
}

const resolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem: new EnhancedResolve.CachedInputFileSystem(fs, 4000),
  useSyncFileSystemCalls: true,
  extensions: ['.css'],
  mainFields: ['style'],
  conditionNames: ['style'],
})
export function resolveCssId(id: string, base: string) {
  if (typeof globalThis.__tw_resolve === 'function') {
    let resolved = globalThis.__tw_resolve(id, base)
    if (resolved) {
      return resolved
    }
  }

  return resolver.resolveSync({}, base, id)
}

```

### Core Architecture Module: `packages/@tailwindcss-upgrade/src/codemods/css/migrate-at-layer-utilities.ts`
```
import { type AtRule, type Comment, type Container, type Plugin, type Rule } from 'postcss'
import SelectorParser from 'postcss-selector-parser'
import { segment } from '../../../../tailwindcss/src/utils/segment'
import { Stylesheet } from '../../stylesheet'
import * as version from '../../utils/version'
import { walk, WalkAction, walkDepth } from '../../utils/walk'

export function migrateAtLayerUtilities(stylesheet: Stylesheet): Plugin {
  function migrate(atRule: AtRule) {
    // Migrating `@layer utilities` to `@utility` is only supported in Tailwind
    // CSS v3 projects. Tailwind CSS v4 projects could also have `@layer
    // utilities` but those aren't actual utilities.
    if (!version.isMajor(3)) return

    // Only migrate `@layer utilities` and `@layer components`.
    if (atRule.params !== 'utilities' && atRule.params !== 'components') return

    // Keep rules that should not be turned into utilities as is. This will
    // include rules with element or ID selectors.
    let defaultsAtRule = atRule.clone()

    // Clone each rule with multiple selectors into their own rule with a single
    // selector.
    walk(atRule, (node) => {
      if (node.type !== 'rule') return

      // Clone the node for each selector
      let selectors = segment(node.selector, ',')
      if (selectors.length > 1) {
        let clonedNodes: Rule[] = []
        for (let selector of selectors) {
          let clone = node.clone({ selector })
          clonedNodes.push(clone)
        }
        node.replaceWith(clonedNodes)
      }

      return WalkAction.Skip
    })

    // Track all the classes that we want to create an `@utility` for.
    let classes = new Set<string>()

    walk(atRule, (node) => {
      if (node.type !== 'rule') return
      if (isEmpty(node)) return

      // Find all the classes in the selector
      SelectorParser((selectors) => {
        selectors.each((selector) => {
          walk(selector, (selectorNode) => {
            // Ignore everything in `:not(…)`
            if (selectorNode.type === 'pseudo' && selectorNode.value === ':not') {
              return WalkAction.Skip
            }

            if (selectorNode.type === 'class') {
              classes.add(selectorNode.value)
            }
          })
        })
      }).processSync(node.selector, { updateSelector: false })

      return WalkAction.Skip
    })

    // Remove all the nodes from the default `@layer utilities` that we know
    // should be turned into `@utility` at-rules.
    walk(defaultsAtRule, (node) => {
      if (node.type !== 'rule') return

      SelectorParser((selectors) => {
        selectors.each((selector) => {
          walk(selector, (selectorNode) => {
            // Ignore everything in `:not(…)`
            if (selectorNode.type === 'pseudo' && selectorNode.value === ':not') {
              return WalkAction.Skip
            }

            // Remove the node if the class is in the list
            if (selectorNode.type === 'class' && classes.has(selectorNode.value)) {
              node.remove()
              return WalkAction.Stop
            }
          })
        })
      }).processSync(node, { updateSelector: true })
    })

    // Upgrade every Rule in `@layer utilities` to an `@utility` at-rule.
    let clones: AtRule[] = [defaultsAtRule]
    for (let cls of classes) {
      let clone = atRule.clone()
      clones.push(clone)

      walk(clone, (node) => {
        if (node.type === 'atrule') {
          if (!node.nodes || node.nodes?.length === 0) {
            node.remove()
          }
        }

        if (node.type !== 'rule') return

        // Fan out each utility into its own rule.
        //
        // E.g.:
        // ```css
        // .foo .bar:hover .baz {
        //   color: red;
        // }
        // ```
        //
        // Becomes:
        // ```css
        // @utility foo {
        //   & .bar:hover .baz {
        //     color: red;
        //   }
        // }
        //
        // @utility bar {
        //   .foo &:hover .baz {
        //     color: red;
        //   }
        // }
        //
        // @utility baz {
        //   .foo .bar:hover & {
        //     color: red;
        //   }
        // }
        // ```
        let containsClass = false
        SelectorParser((selectors) => {
          selectors.each((selector) => {
            walk(selector, (selectorNode) => {
              // Ignore everything in `:not(…)`
              if (selectorNode.type === 'pseudo' && selectorNode.value === ':not') {
                return WalkAction.Skip
              }

              // Replace the class with `&` and track the new selector
              if (selectorNode.type === 'class' && selectorNode.value === cls) {
                containsClass = true

                // Find the node in the clone based on the position of the
                // original node.
                let target = selector.atPosition(
                  selectorNode.source!.start!.line,
                  selectorNode.source!.start!.column,
                )

                // Keep moving the target to the front until we hit the start or
                // find a combinator. This is to prevent `.foo.bar` from
                // becoming `.bar&`. Instead we want `&.bar`.
                let parent = target.parent!
                let idx = (target.parent?.index(target) ?? 0) - 1
                while (idx >= 0 && parent.at(idx)?.type !== 'combinator') {
                  let current = parent.at(idx + 1)
                  let previous = parent.at(idx)
                  parent.at(idx + 1).replaceWith(previous)
                  parent.at(idx).replaceWith(current)

                  idx--
                }

                // Replace the class with `&`
                target.replaceWith(SelectorParser.nesting())
              }
            })
          })
        }).processSync(node, { updateSelector: true })

        // Cleanup all the nodes that should not be part of the `@utility` rule.
        if (!containsClass) {
          let toRemove: (Comment | Rule)[] = [node]
          let idx = node.parent?.index(node) ?? null
          if (idx !== null) {
            for (let i = idx - 1; i >= 0; i--) {
              if (node.parent?.nodes.at(i)?.type === 'rule') {
                break
              }
              if (node.parent?.nodes.at(i)?.type === 'comment') {
                toRemove.push(node.parent?.nodes.at(i) as Comment)
              }
            }

            let commentsAfter: Comment[] = []
            for (let i = idx + 1; i < (node.parent?.nodes.length ?? 0); i++) {
              if (node.parent?.nodes.at(i)?.type === 'rule') {
                commentsAfter = []
                break
              }
              if (node.parent?.nodes.at(i)?.type === 'comment') {
                commentsAfter.push(node.parent?.nodes.at(i) as Comment)
              }
            }
            toRemove.push(...commentsAfter)
          }
          for (let node of toRemove) {
            node.remove()
          }
        }

        return WalkAction.Skip
      })

      // Migrate the `@layer utilities` to `@utility <name>`
      clone.name = 'utility'
      clone.params = cls

      clone.raws.before = `${clone.raws.before ?? ''}\n\n`
    }

    // Cleanup
    for (let idx = clones.length - 1; idx >= 0; idx--) {
      let clone = clones[idx]

      walkDepth(clone, (node) => {
        // Remove comments from the main `@layer utilities` we want to keep,
        // that are part of any of the other clones.
        if (clone === defaultsAtRule) {
          if (node.type === 'comment') {
            let found = false
            for (let other of clones) {
              if (other === defaultsAtRule) continue

              walk(other, (child) => {
                if (
                  child.type === 'comment' &&
                  child.source?.start?.offset === node.source?.start?.offset
                ) {
                  node.remove()
                  found = true
                  return WalkAction.Stop
                }
              })

              if (found) {
                return WalkAction.Skip
              }
            }
          }
        }

        // Remove empty rules from `@utility` clones and empty wrapper at-rules
        // from the default `@layer` clone.
        if (
          (node.type === 'atrule' && node.nodes?.length === 0) ||
          (clone !== defaultsAtRule && node.type === 'rule' && node.nodes?.length === 0)
        ) {
          node.remove()
        }

        // Replace `&` selectors with its children
        else if (node.type === 'rule' && node.selector === '&') {
          interface PostCSSNode {
            type: string
            parent?: PostCSSNode
          }

          let parent: PostCSSNode | undefined = node.parent
          let skip = false
          while (parent) {
            if (parent.type === 'rule') {
              skip = true
              break
            }

            parent = parent.parent
          }

          if (!skip) node.replaceWith(node.nodes)
        }
      })

      // Remove empty clones entirely
      if (clone.nodes?.length === 0) {
        clones.splice(idx, 1)
      } else if (clone === defaultsAtRule) {
        let first = clone.nodes?.[0]
        if (first) {
          first.raws.before = first.raws.before?.replace(/\n\s*\n/g, '\n')
        }
      }
    }

    // Finally, replace the original `@layer utilities` with the new rules.
    atRule.replaceWith(clones)
  }

  return {
    postcssPlugin: '@tailwindcss/upgrade/migrate-at-layer-utilities',
    OnceExit: (root, { atRule }) => {
      let layers = stylesheet.layers()
      let isUtilityStylesheet = layers.has('utilities') || layers.has('components')

      if (isUtilityStylesheet) {
        let rule = atRule({ name: 'layer', params: 'utilities' })
        rule.append(root.nodes)
        root.append(rule)
      }

      // Migrate `@layer utilities` and `@layer components` into `
```

### Core Architecture Module: `packages/@tailwindcss-upgrade/src/utils/args.ts`
```
import parse from 'mri'

// Definition of the arguments for a command in the CLI.
export type Arg = {
  [key: `--${string}`]: {
    type: keyof Types
    description: string
    alias?: `-${string}`
    default?: Types[keyof Types]
  }
}

// Each argument will have a type and we want to convert the incoming raw string
// based value to the correct type. We can't use pure TypeScript types because
// these don't exist at runtime. Instead, we define a string-based type that
// maps to a TypeScript type.
type Types = {
  boolean: boolean
  number: number | null
  string: string | null
  'boolean | string': boolean | string | null
  'number | string': number | string | null
  'boolean | number': boolean | number | null
  'boolean | number | string': boolean | number | string | null
}

// Convert the `Arg` type to a type that can be used at runtime.
//
// E.g.:
//
// Arg:
// ```
// { '--input': { type: 'string', description: 'Input file', alias: '-i' } }
// ```
//
// Command:
// ```
// ./tailwindcss -i input.css
// ./tailwindcss --input input.css
// ```
//
// Result type:
// ```
// {
//   _: string[],             // All non-flag arguments
//   '--input': string | null // The `--input` flag will be filled with `null`, if the flag is not used.
//                            // The `null` type will not be there if `default` is provided.
// }
// ```
//
// Result runtime object:
// ```
// {
//   _: [],
//   '--input': 'input.css'
// }
// ```
export type Result<T extends Arg> = {
  [K in keyof T]: T[K] extends { type: keyof Types; default?: any }
    ? undefined extends T[K]['default']
      ? Types[T[K]['type']]
      : NonNullable<Types[T[K]['type']]>
    : never
} & {
  // All non-flag arguments
  _: string[]
}

export function args<const T extends Arg>(options: T, argv = process.argv.slice(2)): Result<T> {
  let parsed = parse(argv)

  let result: { _: string[]; [key: string]: unknown } = {
    _: parsed._,
  }

  for (let [
    flag,
    { type, alias, default: defaultValue = type === 'boolean' ? false : null },
  ] of Object.entries(options)) {
    // Start with the default value
    result[flag] = defaultValue

    // Try to find the `alias`, and map it to long form `flag`
    if (alias) {
      let key = alias.slice(1)
      if (parsed[key] !== undefined) {
        result[flag] = convert(parsed[key], type)
      }
    }

    // Try to find the long form `flag`
    {
      let key = flag.slice(2)
      if (parsed[key] !== undefined) {
        result[flag] = convert(parsed[key], type)
      }
    }
  }

  return result as Result<T>
}

// ---

type ArgumentType = string | boolean

// Try to convert the raw incoming `value` (which will be a string or a boolean,
// this is coming from `mri`'s parse function'), to the correct type based on
// the `type` of the argument.
function convert<T extends keyof Types>(value: string | boolean, type: T) {
  switch (type) {
    case 'string':
      return convertString(value)
    case 'boolean':
      return convertBoolean(value)
    case 'number':
      return convertNumber(value)
    case 'boolean | string':
      return convertBoolean(value) ?? convertString(value)
    case 'number | string':
      return convertNumber(value) ?? convertString(value)
    case 'boolean | number':
      return convertBoolean(value) ?? convertNumber(value)
    case 'boolean | number | string':
      return convertBoolean(value) ?? convertNumber(value) ?? convertString(value)
    default:
      throw new Error(`Unhandled type: ${type}`)
  }
}

function convertBoolean(value: ArgumentType) {
  if (value === true || value === false) {
    return value
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }
}

function convertNumber(value: ArgumentType) {
  if (typeof value === 'number') {
    return value
  }

  {
    let valueAsNumber = Number(value)
    if (!Number.isNaN(valueAsNumber)) {
      return valueAsNumber
    }
  }
}

function convertString(value: ArgumentType) {
  return `${value}`
}

```

### Core Architecture Module: `packages/@tailwindcss-upgrade/src/utils/extract-static-plugins.ts`
```
import Parser from 'tree-sitter'
import TS from 'tree-sitter-typescript'

let parser = new Parser()
parser.setLanguage(TS.typescript)
const treesitter = String.raw

// Extract `plugins` property of the object export for both ESM and CJS files
const PLUGINS_QUERY = new Parser.Query(
  TS.typescript,
  treesitter`
    ; export default {}
    (export_statement
      value: [
        (satisfies_expression (object
          (pair
            key: (property_identifier) @_name (#eq? @_name "plugins")
            value: (array) @imports
          )
        ))
        value: (as_expression (object
          (pair
            key: (property_identifier) @_name (#eq? @_name "plugins")
            value: (array) @imports
          )
        ))
        value: (object
          (pair
            key: (property_identifier) @_name (#eq? @_name "plugins")
            value: (array) @imports
          )
        )
      ]
    )

    ; module.exports = {}
    (expression_statement
      (assignment_expression
        left: (member_expression) @left (#eq? @left "module.exports")
        right: [
          (satisfies_expression (object
            (pair
              key: (property_identifier) @_name (#eq? @_name "plugins")
              value: (array) @imports
            )
          ))
          (as_expression (object
            (pair
              key: (property_identifier) @_name (#eq? @_name "plugins")
              value: (array) @imports
            )
          ))
          (object
            (pair
              key: (property_identifier) @_name (#eq? @_name "plugins")
              value: (array) @imports
            )
          )
        ]
      )
    )
  `,
)

// Extract require() calls, as well as identifiers with options or require()
// with options
const PLUGIN_CALL_OPTIONS_QUERY = new Parser.Query(
  TS.typescript,
  treesitter`
    (call_expression
      function: [
        (call_expression
          function: (identifier) @_name (#eq? @_name "require")
          arguments: (arguments
            (string (string_fragment) @module_string)
          )
        )
        (identifier) @module_identifier
      ]
      arguments: [
        (arguments
          (object
            (pair
              key: [
                (property_identifier) @property
                (string (string_fragment) @property)
              ]

              value: [
                (string (string_fragment) @str_value)
                (template_string
                  . (string_fragment) @str_value
                  ; If the template string has more than exactly one string
                  ; fragment at the top, the migration should bail.
                  _ @error
                )
                (number) @num_value
                (true) @true_value
                (false) @false_value
                (null) @null_value
                (array [
                  (string (string_fragment) @str_value)
                  (template_string (string_fragment) @str_value)
                  (number) @num_value
                  (true) @true_value
                  (false) @false_value
                  (null) @null_value
                ]) @array_value
              ]
            )
          )
        )
        (arguments) @_empty_args (#eq? @_empty_args "()")
      ]
    )
    (call_expression
      function: (identifier) @_name (#eq? @_name "require")
      arguments: (arguments
      (string (string_fragment) @module_string)
      )
    )
  `,
)

export type StaticPluginOptions = Record<
  string,
  | string
  | number
  | boolean
  | null
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean | null>
>

export function findStaticPlugins(source: string): [string, null | StaticPluginOptions][] | null {
  try {
    let tree = parser.parse(source)
    let root = tree.rootNode

    let imports = extractStaticImportMap(source)
    let captures = PLUGINS_QUERY.matches(root)

    let plugins: [string, null | StaticPluginOptions][] = []
    for (let match of captures) {
      for (let capture of match.captures) {
        if (capture.name !== 'imports') continue

        for (let pluginDefinition of capture.node.children) {
          if (
            pluginDefinition.type === '[' ||
            pluginDefinition.type === ']' ||
            pluginDefinition.type === ','
          )
            continue

          switch (pluginDefinition.type) {
            case 'identifier':
              let source = imports[pluginDefinition.text]
              if (!source || source.export !== null) {
                return null
              }
              plugins.push([source.module, null])
              break
            case 'string':
              plugins.push([pluginDefinition.children[1].text, null])
              break
            case 'call_expression':
              let matches = PLUGIN_CALL_OPTIONS_QUERY.matches(pluginDefinition)
              if (matches.length === 0) return null

              let moduleName: string | null = null
              let moduleIdentifier: string | null = null

              let options: StaticPluginOptions | null = null
              let lastProperty: string | null = null

              let captures = matches.flatMap((m) => m.captures)
              for (let i = 0; i < captures.length; i++) {
                let capture = captures[i]
                switch (capture.name) {
                  case 'module_identifier': {
                    moduleIdentifier = capture.node.text
                    break
                  }
                  case 'module_string': {
                    moduleName = capture.node.text
                    break
                  }
                  case 'property': {
                    if (lastProperty !== null) return null
                    lastProperty = capture.node.text
                    break
                  }
                  case 'str_value':
                  case 'num_value':
                  case 'null_value':
                  case 'true_value':
                  case 'false_value': {
                    if (lastProperty === null) return null
                    options ??= {}
                    options[lastProperty] = extractValue(capture)
                    lastProperty = null
                    break
                  }
                  case 'array_value': {
                    if (lastProperty === null) return null
                    options ??= {}

                    // Loop over all captures after this one that are on the
                    // same property (it will be one match for any array
                    // element)
                    let array: Array<string | number | boolean | null> = []
                    let lastConsumedIndex = i
                    arrayLoop: for (let j = i + 1; j < captures.length; j++) {
                      let innerCapture = captures[j]

                      switch (innerCapture.name) {
                        case 'property': {
                          if (innerCapture.node.text !== lastProperty) {
                            break arrayLoop
                          }
                          break
                        }
                        case 'str_value':
                        case 'num_value':
                        case 'null_value':
                        case 'true_value':
                        case 'false_value': {
                          array.push(extractValue(innerCapture))
                          lastConsumedIndex = j
                        }
                      }
                    }

                    i = lastConsumedIndex
                    options[lastProperty] = array
                    lastProperty = null
                    break
                  }

                  case '_name':
                  case '_empty_args':
                    break
                  default:
                    return null
                }
              }

              if (lastProperty !== null) return null

              if (moduleIdentifier !== null) {
                let source = imports[moduleIdentifier]
                if (!source || (source.export !== null && source.export !== '*')) {
                  return null
                }
                moduleName = source.module
              }

              if (moduleName === null) {
                return null
              }

              plugins.push([moduleName, options])
              break
            default:
              return null
          }
        }
      }
    }
    return plugins
  } catch (error: any) {
    error(`${error?.message ?? error}`, { prefix: '↳ ' })
    return null
  }
}

// Extract all top-level imports for both ESM and CJS files
const IMPORT_QUERY = new Parser.Query(
  TS.typescript,
  treesitter`
    ; ESM import
    (import_statement
      (import_clause
        (identifier)? @default
        (named_imports
          (import_specifier
            name: (identifier) @imported-name
                alias: (identifier)? @imported-alias
              )
        )?
        (namespace_import (identifier) @imported-namespace)?
      )
      (string
        (string_fragment) @imported-from)
    )

    ; CJS require
    (variable_declarator
      name: (identifier)? @default
      name: (object_pattern
        (shorthand_property_identifier_pattern)? @imported-name
        (pair_pattern
          key: (property_identifier) @imported-name
          value: (identifier) @imported-alias
        )?
        (rest_pattern
          (identifier) @imported-namespace
        )?
      )?
      value: (call_expression
        function: (identifier) @_fn (#eq? @_fn "require")
        arguments: (arguments
          (string
              (string_fragment) @imported-from
            )
        )
      )
    )
  `,
)

export function extractStaticImportMap(source: string) {
  let tree = parser.parse(source)
  let root = tree.rootNode

  let captures = IMPORT_QUERY.matches(root)

  let imports: Record<string, { module: string; 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #19463** (2025-12-19): **Nested color objects with mixed-case parent keys don't generate utilities in v4**
  *Symptoms*: **Tailwind CSS version** : v4.1.18  **Build tool**: Next.js 15.5.7 with @tailwindcss/postcss   **Node.js version** : v20.11.1  **Browser**: Chrome (also tested in Safari - same behavior)  **OS**: macOS 15.2  **Issue**  In Tailwind CSS v4, nested color objects in `tailwind.config.ts` fail to generate utility classes when the parent key contains mixed-case or alphanumeric characters (e.g., `iosV3`, `myTheme`, `v3Landing`). However, lowercase-only parent keys (e.g., `iosv3`, `glass`, `electric`) work correctly.  This behavior is **undocumented** and creates confusion during migration from v3 to v4, as mixed-case keys worked fine in v3.  ## Steps to Reproduce  ### 1. Configuration Setup  **globals.css:**  ```css @import "tailwindcss"; @config "./tailwind.config.ts"; ```  **tailwind.config.ts:**  ```typescript import type { Config } from "tailwindcss";  const config: Config = {   content: ["./src/**/*.{js,ts,jsx,tsx}"],   theme: {     extend: {       colors: {         // ❌ This DOESN'T generate utilities         iosV3: {           "glass-700": "rgba(26, 26, 27, 1)",           "glass-800": "rgba(17, 17, 18, 1)",           "electric-400": "rgba(34, 80, 225, 1)",         },          // ✅ This DOES generate utilities         glass: {           700: "rgba(31, 31, 31, 1)",           800: "rgba(17, 17, 18, 1)",         },          // ✅ This DOES generate utilities         electric: {           400: "rgb(33, 55, 252)",         },       },     },   }, };  export default config; ```  ### 2.
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated issue plan by CodeRabbit -->   ### 📝 CodeRabbit Plan Mode Generate an implementation plan and prompts that you can use with your favorite coding agent.  - [ ] <!-- {"checkboxId": "8d4f2b9c-3e1a-4f7c-a9b2-d5e8f1c4a7b9"} --> Create Plan  <details> <summary>Examples</summary>  - [Example 1](https://github.com/coderabbitai/git-worktree-runner/issues/29#issuecomment-3589134556) - [Example 2](https://github.com/coderabbitai/git-worktree-runner/issues/12#issuecomment-3606665167)  </details>  ---  <details> <summary><b>🔗 Similar Issues</b></summary>  **Possible Duplicates** - https://github.com/tailwindlabs/tailwindcss/issues/18114  **Related Issues** - https://github.com/tailwindlabs/tailwindcss/issues/17960 - https://github.com/tailwindlabs/tailwindcss/issues/19336 - https://github.com/tailwindlabs/tailwindcss/issues/18841 </details> <details> <summary><b>🔗 Related PRs</b></summary>  tailwindlabs/tailwindcss#19337 - Don’t unconditionally convert config keys 
  > Will be fixed in the next release 👍 

- **Issue #19345** (2025-11-28): **Upgrade tool doesn't migrate `ringColor.DEFAULT` correctly**
  *Symptoms*: It should be migrated to `--default-ring-color` instead of `--ring-color`

- **Issue #19104** (2025-10-13): **`theme()` function evaluates to garbage in the `@theme` definition in some cases**
  *Symptoms*: **What version of Tailwind CSS are you using?**  v4.1.14  **Reproduction URL**  https://play.tailwindcss.com/ZQ4brTr12g  **Describe your issue**  ```css @theme {     --color-lime: light-dark(theme(colors.lime.950), theme(colors.lime.50)); } ```  The second argument, `theme(colors.lime.50)`, somehow evaluates to `m`. This does not happen with 3-digit color variants.  <img width="589" height="99" alt="Image" src="https://github.com/user-attachments/assets/a533988d-7f1b-4159-9033-3941c1696673" />
  **Post-Mortem & Fix Analysis**:
  > Seems to be because it is referencing itself as a string. Character index `50`:  ``` light-dark(theme(colors.lime.950), theme(colors.lime.50));                                                   ↑                                                  50 ````  You can test this out by checking other numbers 0 to mid-50.  As a workaround for now, you could consider [using `var()`, `theme()` with CSS variable, or `--theme()`](https://play.tailwindcss.com/qaE6rso9Wl?file=css). 
  > @wongjn Thanks, I didn't know you could use `theme()` it with CSS variables. It also works with opacity, which I use in some places. I kind of expected `theme(color / opacity)` to simplify into one color value rather than the `color-mix` expression (no big deal, just an optimization)
  > What a weird bug…  Minimal repro: ```css @theme default {   --color-what-50: #f00;   --color-what-950: #f00; }  @theme {   --color-what: some-func(theme(colors.what.950), theme(colors.what.50)); }  @source inline("text-what");  @tailwind utilities; ```  https://play.tailwindcss.com/U3q7F9lVr2 

- **Issue #18852** (2025-09-05): **Hmr not work in monorepo ui lib**
  *Symptoms*: <!-- Please provide all of the information requested below. We're a small team and without all of this information it's not possible for us to help and your bug report will be closed. -->  **What version of Tailwind CSS are you using?**      "@tailwindcss/vite": "^4.1.12",     "tailwindcss": "^4.1.12"  **What build tool (or framework if it abstracts the build tool) are you using?**      "vite": "^7.1.4"  **What version of Node.js are you using?**      v22.15.0  **What browser are you using?**      Chrome/139.0.7258.155  **What operating system are you using?**      Windows11/24H2/26100.4946  **Reproduction URL**  https://github.com/zyycn/tailwindcss-vite-monorepo  **Describe your issue**  In a monorepo, when code is changed in Tailwind CSS within the packages/ui, the page does not hot-update to apply the latest changes. i thought it was a Vite issue, but I found that commenting out the `@import '@packages/ui/styles.css'`;  in `apps/vue-project/styles/tailwind.css` makes everything work normally. It seems like there might be some conflict between Tailwind CSS and Vite, right?  I also tried writing styles without using tailwind.css and found that everything worked normally, with hot updates functioning perfectly. I'm not sure why this is happening, so I wanted to seek help from Tailwind CSS. Sorry, English is not my native language, so my description might not be clear enough. If there's any confusion, I can provide further details.
  **Post-Mortem & Fix Analysis**:
  > It looks like this is a problem on Windows and *only* if there's a `@source "…"` inside the CSS file. Other rules seem to work fine.  Some notes: - Only breaks if the `@source` covers the vue file - Going from an `@source` that does not to one that does will refresh and you'll get the latest classes _once_. Further updates won't work until you change the source path to something else, save, then change it back, and save - Whether or not the file is more than 1 directory down also matters 🤔  - `addWatchFile` in Vite appears to be the trigger of the bug - I've reduced this a good bit already internally and it *seems* like this is a Vite bug. Need to reduce this further before I can be sure.  ---  I can reproduce this in `example-1.vue` and `example-2.vue` with this plugin and dir structure: ``` apps/vue-project/src/app.css apps/vue-project/src/app.vue apps/vue-project/src/main.ts apps/vue-project/vite.config.ts  dir-1/example-1.vue dir-1/dir-2/example-2.vue ```  ```js {   name: 'wip',  
  > > It looks like this is a problem on Windows and _only_ if there's a `@source "…"` inside the CSS file. Other rules seem to work fine. >  > Some notes: >  > * Only breaks if the `@source` covers the vue file > * Going from an `@source` that does not to one that does will refresh and you'll get the latest classes _once_. Further updates won't work until you change the source path to something else, save, then change it back, and save > * Whether or not the file is more than 1 directory down also matters 🤔 > * `addWatchFile` in Vite appears to be the trigger of the bug > * I've reduced this a good bit already internally and it _seems_ like this is a Vite bug. Need to reduce this further before I can be sure. >  > I can reproduce this in `example-1.vue` and `example-2.vue` with this plugin and dir structure: >  > ``` > apps/vue-project/src/app.css > apps/vue-project/src/app.vue > apps/vue-project/src/main.ts > apps/vue-project/vite.config.ts >  > dir-1/example-1.vue > dir-1/dir-2/example
  > No worries — I'll be prepping a reproduction for Vite and filing a bug with them. 👍 

- **Issue #18812** (2025-08-29): **IntelliSense suggests weird `__CSS_VALUES__` value**
  *Symptoms*: **What version of Tailwind CSS are you using?**  v4.1.12, and actually even the most recent insiders version (`0.0.0-insiders.8165e04`)  **What build tool (or framework if it abstracts the build tool) are you using?**  None, just `tailwindcss` and `@tailwindcss/cli`  **What version of Node.js are you using?**  v24.5.0  **What browser are you using?**  N/A  **What operating system are you using?**  macOS  **Reproduction ~~URL~~ steps / Describe your issue**  In a legacy `@plugin`: ```js matchUtilities(   {     foo: (value) => ({       "--foo": value,     }),   },   {     values: theme("colors"),   } ); ```  In the HTML: ```html <div class="foo-                ^                First IntelliSense suggestion:                - foo-__CSS_VALUES__ ```
  **Post-Mortem & Fix Analysis**:
  > Will have this fixed in the next release 👍 

- **Issue #18678** (2025-09-29): **Error: "Parsing css source code failed" in Tailwind V3**
  *Symptoms*: <!-- Please provide all of the information requested below. We're a small team and without all of this information it's not possible for us to help and your bug report will be closed. -->  **What version of Tailwind CSS are you using?**  TailwindCSS: v3.4.17  **What build tool (or framework if it abstracts the build tool) are you using?**  Nextjs: 15.4.5 React: 19.1.0  **What version of Node.js are you using?**  NodeJS: 22  **What browser are you using?**  Browser: Chrome  **What operating system are you using?**  OS: macOS  **Reproduction URL**  https://github.com/NishargShah/tailwindcss-v3-issue  **Describe your issue**  Hi Tailwind team,  I’m working on a client project where I had to change **padding values for large screens (min-width: 1728px)** using a custom plugin in `tailwind.config.ts`.  Everything was working fine until I used the `--turbopack` flag in the dev script.  After many hours of debugging, I found a specific issue that causes the development server to break. I also created a **minimal repo to reproduce the bug**.  ---  ### 🧩 What I Did  1. In my `tailwind.config.ts`, I added a plugin to support custom padding values.  2. In `page.tsx` at 7th line I used the class `!pt-1.25`.      Please take a note, it only reproduce when important (!) is there, without important it will work as aspected.  3. Then I ran this command to generate CSS:     ```bash    npx tailwindcss -i ./src/styles/globals.css -o ./src/styles/output.css    ```  4. When I start the Next.js d
  **Post-Mortem & Fix Analysis**:
  > Seems like Tailwind is getting confused with your class names in your plugin matching the candidate class names that would be generated. As a work around to get well-formed CSS, you could use attribute selectors instead:  ```diff --- a/tailwind.config.ts +++ b/tailwind.config.ts @@ -33,27 +33,27 @@ const config = {          const spacingValue = `calc(var(--fluid-spacing) * ${multiplier})`            // Padding -        largerFluidUtilities[`.p-${escapedSize}`] = { +        largerFluidUtilities[`[class~="p-${escapedSize}"]`] = {            padding: `${spacingValue} !important`,          } -        largerFluidUtilities[`.px-${escapedSize}`] = { +        largerFluidUtilities[`[class~="px-${escapedSize}"]`] = {            'padding-left': `${spacingValue} !important`,            'padding-right': `${spacingValue} !important`,          } -        largerFluidUtilities[`.py-${escapedSize}`] = { +        largerFluidUtilities[`[class~="py-${escapedSize}"]`] = {            'padding-top': `${spacin
  > It worked, thanks a lot but its workaround, please close it after resolving the bug.
  > minimal repro:  ```css @tailwind base; ```  ```js export default {   content: [{ raw: '!a' },],   plugins: [     ({ addBase }) => addBase({       '@media (min-width: 1728px)': {         '.a': { 'padding-top': '1rem !important' },         '.b': { 'padding-right': '1rem !important' },       }     }),   ], } ```  ```sh npx tailwindcss -i src/styles/globals.css -o out.css ```

- **Issue #18524** (2025-09-05): **Nested `@variant` inside `@custom-variant`**
  *Symptoms*: <!-- Please provide all of the information requested below. We're a small team and without all of this information it's not possible for us to help and your bug report will be closed. -->  **What version of Tailwind CSS are you using?**  v4.1.11  **Reproduction URL**  https://play.tailwindcss.com/BK1Bs5n1jp?file=css  **Describe your issue**  For the purpose of reusing, I declare a `@custom-variant` for `@support`. In another custom variant `@scroll-stuck-top`, I would like to use that `supports-scroll-state` variant to add fallback. I expected the nested `@variant` would be replaced with the definition of the corresponding `@custom-variant`, but instead, it was kept as-is.  ```css @custom-variant supports-scroll-state {   @supports (container-type: scroll-state) {     @slot;   } }  @custom-variant @scroll-stuck-top {   @container scroll-state(stuck: top) { @slot; }    @variant not-supports-scroll-state {     \@scroll-stuck-top & { @slot }   } } ```  ### Expected Output  ```css .\@scroll-stuck-top\:border-b-2 {   @container scroll-state(stuck: top) {     border-bottom-style: var(--tw-border-style);     border-bottom-width: 2px;   }   @supports not (container-type: scroll-state) {     \@scroll-stuck-top & {       border-bottom-style: var(--tw-border-style);       border-bottom-width: 2px;     }   } } ```  ### Actual Output  ```css .\@scroll-stuck-top\:border-b-2 {   @container scroll-state(stuck: top) {     border-bottom-style: var(--tw-border-style);     border-bottom-width: 2
  **Post-Mortem & Fix Analysis**:
  > Maybe it's because of this? https://github.com/parcel-bundler/lightningcss/issues/887
  > > Maybe it's because of this? [parcel-bundler/lightningcss#887](https://github.com/parcel-bundler/lightningcss/issues/887)  I thought it may have been the case, so I tried something more supported:  https://play.tailwindcss.com/0ylqcfre9X  The output still generates:  ```css .stuck\:border-b-2 {   @variant not-supports-sticky {     &.stuck {       border-bottom-style: var(--tw-border-style);       border-bottom-width: 2px;     }   } } ```  
  > Nah, this is because we're not evaluating `@variant`s used inside custom variants.

- **Issue #18082** (2025-05-19): **@tailwindcss/postcss 4.1.6 with @parcel/transformer-postcss: Cannot read properties of undefined (reading 'input')**
  *Symptoms*: <!-- Please provide all of the information requested below. We're a small team and without all of this information it's not possible for us to help and your bug report will be closed. -->  **What version of Tailwind CSS are you using?**  tailwindcss: 4.1.7  **What build tool (or framework if it abstracts the build tool) are you using?**  parcel 2.15.1  **What version of Node.js are you using?**  v22.14.0  **What browser are you using?**  Safari  **What operating system are you using?**  macOS  **Describe your issue**  ``` {   "name": "test",   "version": "0.0.0",   "source": "src/index.html",   "scripts": {     "start": "parcel",     "build": "parcel build"   },   "staticFiles": {     "staticPath": "src/img",     "distDir": "dist/img"   },   "devDependencies": {     "@tailwindcss/postcss": "4.1.6",     "parcel": "^2.15.1",     "parcel-reporter-static-files-copy": "^1.5.3",     "tailwindcss": "^4.1.7"   } } ```  When use over @tailwindcss/postcss 4.1.5, run npm start I got follow message:  ``` 🚨 Build failed.  @parcel/transformer-postcss: Cannot read properties of undefined (reading 'input')    TypeError: Cannot read properties of undefined (reading 'input')       at Comment.toJSON (/package/node_modules/postcss/lib/node.js:387:40)       at /package/node_modules/postcss/lib/node.js:379:22       at Array.map (<anonymous>)       at Root.toJSON (/package/node_modules/postcss/lib/node.js:377:29)       at Object.transform (/package/node_modules/@parcel/transformer-postcss/lib/Post
  **Post-Mortem & Fix Analysis**:
  > Please provide a git repo that reproduces the issue so we can troubleshoot for you, thanks!
  > I know the issue here. Will be looking at this today.
  > This will be fixed in the next release (likely will push one out this week).  In about 20–30 minutes you should be able to test it using our insiders build: ``` npm install tailwindcss@insiders ``` 

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

### Incident Patch 1: `9798a8ab` (2026-09-25)
**Commit Message**: fix: correct two comment typos (#20507)

Fixes two typos in code comments (no behavior affected):

- `packages/@tailwindcss-cli/src/commands/build/index.ts`: `Succesfully`
-> `Successfully`
- `packages/tailwindcss/src/candidate.ts`: `preceeded` -> `preceded`

Co-authored-by: Dextheking1 <[REDACTED_EMAIL]>

**File**: `packages/@tailwindcss-cli/src/commands/build/index.ts` (modified, +1/-1)
```diff
@@ -376,7 +376,7 @@ export async function handle(args: Result<ReturnType<typeof options>>) {
             // Create a new compiler, given the new `input`
             ;[compiler, scanner] = await createCompiler(input, I)
 
-            // Succesfully created a new compiler, so the `fullRebuildPaths`
+            // Successfully created a new compiler, so the `fullRebuildPaths`
             // will be updated. If other errors occur, we should be able to
             // restore the paths unconditionally.
             backupRebuildPaths = fullRebuildPaths.slice()
```

**File**: `packages/tailwindcss/src/candidate.ts` (modified, +1/-1)
```diff
@@ -1098,7 +1098,7 @@ const printArbitraryValueCache = new DefaultMap<string, string>((input) => {
       node.value = ','
     }
 
-    // Wrap custom functions starting with `--`, in parentheses if preceeded by
+    // Wrap custom functions starting with `--`, in parentheses if preceded by
     // a symbol. E.g.: `calc(100%---spacing(2))` → `calc(100%-(--spacing(2)))`
     else if (node.kind === 'function' && node.value.startsWith('--')) {
       let idx = ctx.index
```

---

### Incident Patch 2: `722acdfe` (2026-09-25)
**Commit Message**: Don't treat `\` as an escape inside CSS comments (#20508)

<!--

👋 Hey, thanks for your interest in contributing to Tailwind!

**Please ask first before starting work on any significant new
features.**

It's never a fun experience to have your pull request declined after
investing a lot of time and effort into a new feature. To avoid this
from happening, we request that contributors create a discussion to
first discuss any significant new features.

For more info, check out the contributing guide:


https://github.com/tailwindlabs/tailwindcss/blob/main/.github/CONTRIBUTING.md

-->

## Summary

<!--

Provide a summary of the issue and the changes you're making. How does
your change solve the problem?

-->

The CSS parser treated `\` inside comments as an escape and skipped the
character after it. Because of that, a comment ending in `\*/` was never
closed, and the CSS that followed was swallowed or turned into a broken
rule:

```css
/* C:\temp\*/
.a { color: red }
```

Before this change the `.a` rule disappeared entirely, and `/* \*/ .a {
color: red }` produced the selector `* \*/ .a`. The same thing happened
to comments inside declaration values, where the comment ran on until
th

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Don't warn about Angular's `::ng-deep` and `:host-context()` when optimizing CSS ([#20434](https://github.com/tailwindlabs/tailwindcss/pull/20434))
 - Don't generate CSS for candidates containing an empty additional modifier (e.g. `bg-red-500/50/` and `group-hover/foo//bar:flex`) ([#20466](https://github.com/tailwindlabs/tailwindcss/pull/20466))
 - Sort `min-*`, `max-*`, and container query variants with decimal values numerically (e.g. `min-[40.25rem]` before `min-[40.5rem]`) ([#20512](https://github.com/tailwindlabs/tailwindcss/pull/20512))
+- Ensure CSS comments ending with `\*/` are closed correctly instead of swallowing the CSS that follows (e.g. `/* C:\temp\*/`) ([#20508](https://github.com/tailwindlabs/tailwindcss/pull/20508))
 
 ## [4.3.3] - 2026-07-16
 
```

**File**: `packages/tailwindcss/src/css-parser.test.ts` (modified, +39/-0)
```diff
@@ -31,6 +31,23 @@ describe.each(['Unix', 'Windows'])('Line endings: %s', (lineEndings) => {
       ).toEqual([])
     })
 
+    it('should end a comment at `*/` even when it is preceded by a `\\`', () => {
+      expect(
+        parse(css`
+          /* C:\temp\*/
+          .foo {
+            color: red;
+          }
+        `),
+      ).toEqual([
+        {
+          kind: 'rule',
+          selector: '.foo',
+          nodes: [{ kind: 'declaration', property: 'color', value: 'red', important: false }],
+        },
+      ])
+    })
+
     it('should parse a comment inside of a selector and ignore it', () => {
       expect(
         parse(css`
@@ -448,6 +465,28 @@ describe.each(['Unix', 'Windows'])('Line endings: %s', (lineEndings) => {
         ])
       })
 
+      it('should end a comment in a custom property at `*/` even when it is preceded by a `\\`', () => {
+        expect(
+          parse(css`
+            --foo: /* C:\temp\*/ bar;
+            --bar: /* baz */ qux;
+          `),
+        ).toEqual([
+          {
+            kind: 'declaration',
+            property: '--foo',
+            value: '/* C:\\temp\\*/ bar',
+            important: false,
+          },
+          {
+            kind: 'declaration',
+            property: '--bar',
+            value: '/* baz */ qux',
+            important: false,
+          },
+        ])
+      })
+
       it('should parse empty custom properties', () => {
         expect(
           parse(css`
```

**File**: `packages/tailwindcss/src/css-parser.ts` (modified, +14/-13)
```diff
@@ -128,19 +128,24 @@ export function parse(input: string, opts?: ParseOptions) {
     //         ^^^^^^^^^^^^^
     // }
     // ```
+    //
+    // The escape character `\` in comments are ignored, this means that a
+    // the end of a comment preceded by `\` does _not_ mean that the end of the
+    // comment is escaped and therefore we have to keep parsing.
+    //
+    // This is a valid comment:
+    // ```
+    // /*C:\*/
+    // ```
+    // See: https://www.w3.org/TR/css-syntax-3/#consume-comment
     else if (currentChar === SLASH && input.charCodeAt(i + 1) === ASTERISK) {
       let start = i
 
       for (let j = i + 2; j < input.length; j++) {
         peekChar = input.charCodeAt(j)
 
-        // Current character is a `\` therefore the next character is escaped.
-        if (peekChar === BACKSLASH) {
-          j += 1
-        }
-
-        // End of the comment
-        else if (peekChar === ASTERISK && input.charCodeAt(j + 1) === SLASH) {
+        // End of the comment.
+        if (peekChar === ASTERISK && input.charCodeAt(j + 1) === SLASH) {
           i = j + 1
           break
         }
@@ -224,13 +229,9 @@ export function parse(input: string, opts?: ParseOptions) {
         else if (peekChar === SLASH && input.charCodeAt(j + 1) === ASTERISK) {
           for (let k = j + 2; k < input.length; k++) {
             peekChar = input.charCodeAt(k)
-            // Current character is a `\` therefore the next character is escaped.
-            if (peekChar === BACKSLASH) {
-              k += 1
-            }
 
-            // End of the comment
-            else if (peekChar === ASTERISK && input.charCodeAt(k + 1) === SLASH) {
+            // End of the comment.
+            if (peekChar === ASTERISK && input.charCodeAt(k + 1) === SLASH) {
               j = k + 1
               break
             }
```

---

### Incident Patch 3: `f723e834` (2026-08-31)
**Commit Message**: Don't warn about Angular's `::ng-deep` and `:host-context()` when optimizing CSS (#20434)

Fixes #20433.

The warning filter in `optimize.ts` already ignores `:deep()`,
`:slotted()` and `:global()`. Angular's two deep selectors are the same
kind of thing — non-standard pseudo-selectors that the framework's
compiler resolves before the CSS reaches a browser — but they aren't
covered, so every Angular component stylesheet using them prints a
warning block per occurrence.

```
Found 2 warnings while optimizing generated CSS:

Issue #1:
│ :host ::ng-deep .some-child, :host
┆        ^-- 'ng-deep' is not recognized as a valid pseudo-element. Did you mean ':ng-deep' (pseudo-class) or is this a typo?
```

Angular strips both during view-encapsulation shimming — `::ng-deep` via
`_shadowDeepSelectors = /(?:>>>)|(?:\/deep\/)|(?:::ng-deep)/g`, and
`:host-context()` in the same pass — so neither ever reaches a browser.

Worth noting that `/deep/` and `>>>`, Angular's two other spellings of
the deep selector, already pass silently because
`nonStandard.deepSelectorCombinator` is enabled. `::ng-deep` is the only
one that warns, and it's the spelling the Angular docs use — so in
practice every Angu

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Canonicalization: don't merge utilities that reference different theme variables set to CSS-wide keywords like `unset` ([#20417](https://github.com/tailwindlabs/tailwindcss/pull/20417))
 - Don't generate utilities when a modifier is used that would otherwise be silently ignored (e.g. `rounded-sm/[5]`, `shadow-sm/foo`, `stroke-2/50`) ([#20419](https://github.com/tailwindlabs/tailwindcss/pull/20419))
 - Only normalize top-level `and`, `or`, and `not` keywords in `supports-[…]` variants (e.g. `selector(a: not (.foo))` → `selector(a:not(.foo))`) ([#20420](https://github.com/tailwindlabs/tailwindcss/pull/20420))
+- Don't warn about Angular's `::ng-deep` and `:host-context()` when optimizing CSS ([#20434](https://github.com/tailwindlabs/tailwindcss/pull/20434))
 
 ## [4.3.3] - 2026-07-16
 
```

**File**: `packages/@tailwindcss-node/src/optimize.ts` (modified, +8/-4)
```diff
@@ -61,10 +61,14 @@ export function optimize(
   map = result.map?.toString()
 
   result.warnings = result.warnings.filter((warning) => {
-    // Ignore warnings about unknown pseudo-classes as they are likely caused
-    // by the use of `:deep()`, `:slotted()`, and `:global()` which are not
-    // standard CSS but are commonly used in frameworks like Vue.
-    if (/'(deep|slotted|global)' is not recognized as a valid pseudo-/.test(warning.message)) {
+    // Ignore warnings about unknown pseudo-classes that are used in frameworks
+    // such as Vue or Angular and are handled by their own compilers, before
+    // reaching the browser.
+    if (
+      /'(deep|slotted|global|ng-deep|host-context)' is not recognized as a valid pseudo-/.test(
+        warning.message,
+      )
+    ) {
       return false
     }
 
```

---

### Incident Patch 4: `021b7fe6` (2026-08-14)
**Commit Message**: Canonicalization: prevent inlining CSS-wide keywords (#20417)

This PR fixes an issue where canonicalization suggestions in
intellisense result in 'weird' suggestions.

```
The class text-foreground/60 can be written as text-default-soft-hover
```

If we look at the CSS provided by the issue, this doesn't immediately
make sense:
```css
@theme {
  --color-foreground: var(--foreground);
  --color-default-soft-hover: color-mix(in oklab, var(--default) 60%, transparent);
}

:root {
  --foreground: oklch(0.2103 0.0059 285.89); /* near-black */
  --default: oklch(94% 0.001 286.375); /* light gray */
}
```

But it turns out that when you use Uniwind (React Native) with HeroUI,
that the setup looks more like this:
```css
@import 'tailwindcss';

@theme {
  --foreground: unset;
  --default: unset;
}

@theme inline {
  --color-foreground: var(--foreground);
  --color-default-soft-hover: color-mix(in oklab, var(--default) 60%, transparent);
}
```

During the canonicalization step, we inline all the `@theme` values, the
reason for this is that `text-[#fff]` can be turned into `text-white`
even though they look slightly different:
```css
.text-\[\#fff\] {
  color: #fff;
}
.text-white {
  color: 

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Skip ignored directories entirely when computing watch globs (`scanner.globs`), instead of walking their full contents on every rebuild ([#20408](https://github.com/tailwindlabs/tailwindcss/pull/20408))
 - Oxide: drop invalid UTF-8 candidates ([#20389](https://github.com/tailwindlabs/tailwindcss/pull/20389))
 - `@tailwindcss/vite` no longer forces a full page reload for external files (e.g.: `.php` files) ([#20414](https://github.com/tailwindlabs/tailwindcss/issues/20414))
+- Canonicalization: don't merge utilities that reference different theme variables set to CSS-wide keywords like `unset` ([#20417](https://github.com/tailwindlabs/tailwindcss/pull/20417))
 
 ## [4.3.3] - 2026-07-16
 
```

**File**: `packages/tailwindcss/src/canonicalize-candidates.test.ts` (modified, +22/-0)
```diff
@@ -1638,4 +1638,26 @@ describe('regressions', () => {
       'lg:flex',
     ])
   })
+
+  // https://github.com/tailwindlabs/tailwindcss-intellisense/issues/1610
+  test('does not merge utilities whose theme variables resolve to CSS-wide keywords', async () => {
+    let designSystem = await __unstable__loadDesignSystem(
+      css`
+        @tailwind utilities;
+        @theme {
+          --foreground: unset;
+          --default: unset;
+        }
+        @theme inline {
+          --color-foreground: var(--foreground);
+          --color-default-soft-hover: color-mix(in oklab, var(--default) 60%, transparent);
+        }
+      `,
+      { base: __dirname },
+    )
+
+    expect(
+      designSystem.canonicalizeCandidates(['text-foreground/60', 'text-default-soft-hover']),
+    ).toEqual(['text-foreground/60', 'text-default-soft-hover'])
+  })
 })
```

**File**: `packages/tailwindcss/src/canonicalize-candidates.ts` (modified, +30/-8)
```diff
@@ -2563,6 +2563,25 @@ function canonicalizeAst(designSystem: DesignSystem, ast: AstNode[], options: Si
   return ast
 }
 
+// Variables whose theme value is a CSS-wide keyword (e.g.: `unset`) are never
+// inlined. These are typically registered as a placeholder to be re-assigned at
+// runtime, so two variables that share such a value are not interchangeable.
+//
+// E.g.:
+//
+// ```css
+// @theme {
+//   --foreground: unset;
+//   --background: unset;
+// }
+// ```
+//
+// Inlining would make `text-(--foreground)` and `text-(--background)` produce
+// the same signature `color: unset`, even though they are different at runtime.
+//
+// https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/Data_types#css-wide_keywords
+const CSS_WIDE_KEYWORDS = ['initial', 'inherit', 'revert', 'revert-layer', 'revert-rule', 'unset']
+
 // Resolve theme values to their inlined value.
 //
 // E.g.:
@@ -2578,8 +2597,8 @@ function canonicalizeAst(designSystem: DesignSystem, ast: AstNode[], options: Si
 // }
 // ```
 //
-// Which conveniently will be equivalent to: `text-red-500` when we inline
-// the value.
+// Which conveniently will be equivalent to: `text-red-500` when we inline the
+// value.
 //
 // Without inlining:
 // ```css
@@ -2595,13 +2614,13 @@ function canonicalizeAst(designSystem: DesignSystem, ast: AstNode[], options: Si
 // }
 // ```
 //
-// Recently we made sure that utilities like `text-red-500` also generate
-// the fallback value for usage in `@reference` mode.
+// Recently we made sure that utilities like `text-red-500` also generate the
+// fallback value for usage in `@reference` mode.
 //
-// The second assumption is that if you use `var(--key, fallback)` that
-// happens to match a known variable _and_ its inlined value. Then we can
-// replace it with the inlined variable. This allows us to handle custom
-// `@theme` and `@theme inline` definitions.
+// The second assumption is that if you use `var(--key, fallback)` that happens
+// to match a known variable _and_ its inlined value. Then we can replace it
+// with the inlined variable. This allows us to handle custom `@theme` and
+// `@theme inline` definitions.
 function resolveVariablesInValue(value: string, designSystem: DesignSystem): string {
   let changed = false
   let valueAst = ValueParser.parse(value)
@@ -2630,6 +2649,9 @@ function resolveVariablesInValue(value: string, designSystem: DesignSystem): str
     seen.add(variable)
     if (variableValue === undefined) return // Couldn't resolve the variable
 
+    // CSS-wide keywords are never inlined
+    if (CSS_WIDE_KEYWORDS.includes(variableValue.toLowerCase())) return
+
     // Inject variable fallbacks when no fallback is present yet.
     //
     // A fallback could consist of multiple values.
```

---

### Incident Patch 5: `f7f58f08` (2026-08-13)
**Commit Message**: Move debug logs in `.tailwindcss` folder (#20416)

Instead of writing debug logs (triggered by using `DEBUG=*`) in the root
of the project as `tailwindcss-<pid>.log`, we will write them to
`.tailwindcss/logs/scanner-<timestamp>-<pid>.log` instead.

The reasoning for this is that we won't pollute the root of the project.
Another reason is that if you don't ignore `.log` files via
`.gitignore`, it could be that you end up in a loop if you use `DEBUG=*
vite` because a new `.log` file might trigger a new build. We noticed
this while looking at
https://github.com/tailwindlabs/tailwindcss/discussions/20382.

The `.tailwindcss` folder will come with a `.gitignore` file that
ignores everything (`*`).

## Test plan

1. Nothing really changed here, all tests should pass


Testing this in a local project, it looks like this:
<img width="483" height="165"
alt="file-35bfc43606c556f2380a161c7595d103"
src="https://github.com/user-attachments/assets/629519c8-8f2b-46ee-8046-9ba3749f319a"
/>

**File**: `crates/oxide/src/scanner/init_tracing.rs` (modified, +39/-7)
```diff
@@ -37,20 +37,52 @@ pub fn init_tracing() {
         return;
     }
 
-    let file_path = format!("tailwindcss-{}.log", std::process::id());
-    let file = OpenOptions::new()
+    let root = Path::new(".tailwindcss");
+    let logs_dir = root.join("logs");
+    if let Err(err) = std::fs::create_dir_all(&logs_dir) {
+        eprintln!(
+            "{} Failed to create {}, skipping debug logs ({err})",
+            dim("[DEBUG]"),
+            highlight(&logs_dir.display().to_string())
+        );
+        return;
+    }
+
+    // Ensure everything inside `.tailwindcss/` is ignored by git. The file is only created if it
+    // doesn't exist yet, an existing `.gitignore` is left untouched.
+    if let Ok(mut file) = std::fs::File::create_new(root.join(".gitignore")) {
+        _ = file.write_all(b"*\n");
+    }
+
+    let file_path = logs_dir.join(format!(
+        "scanner-{}-{}.log",
+        std::time::SystemTime::now()
+            .duration_since(std::time::UNIX_EPOCH)
+            .map(|d| d.as_millis())
+            .unwrap_or(0),
+        std::process::id()
+    ));
+    let file = match OpenOptions::new()
         .create(true)
         .append(true)
         .open(&file_path)
-        .unwrap_or_else(|_| panic!("Failed to open {file_path}"));
+    {
+        Ok(file) => file,
+        Err(err) => {
+            eprintln!(
+                "{} Failed to create {}, skipping debug logs ({err})",
+                dim("[DEBUG]"),
+                highlight(&file_path.display().to_string())
+            );
+            return;
+        }
+    };
 
-    let file_path = Path::new(&file_path);
-    let absolute_file_path = dunce::canonicalize(file_path)
-        .unwrap_or_else(|_| panic!("Failed to canonicalize {file_path:?}"));
+    let absolute_file_path = dunce::canonicalize(&file_path).unwrap_or_else(|_| file_path.clone());
     eprintln!(
         "{} Writing debug info to: {}\n",
         dim("[DEBUG]"),
-        highlight(absolute_file_path.as_path().to_str().unwrap())
+        highlight(&absolute_file_path.display().to_string())
     );
 
     let file = Arc::new(Mutex::new(file));
```

---

### Incident Patch 6: `de9e71c5` (2026-08-13)
**Commit Message**: fix referenced link

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Ensure `@tailwindcss/oxide` falls back to WASM on platforms without native bindings ([#20383](https://github.com/tailwindlabs/tailwindcss/pull/20383))
 - Detect classes in Ruby percent literals using angle brackets or custom delimiters (e.g. `%w<flex>`, `%w|flex|`), including in Slim and Haml templates ([#20387](https://github.com/tailwindlabs/tailwindcss/pull/20387))
 - Preserve whitespace in `--default(…)` values in custom functional utilities (e.g. `--default(box alphabetic)` no longer becomes `boxalphabetic`) ([#20392](https://github.com/tailwindlabs/tailwindcss/pull/20392))
-- Don't scan gitignored directories (e.g. `node_modules` and `.git`) when the project uses a safelist-style `.gitignore` (e.g. `/*` followed by `!/…` negations) ([#20397](https://github.com/tailwindlabs/tailwindcss/discussions/20397))
+- Don't scan gitignored directories (e.g. `node_modules` and `.git`) when the project uses a safelist-style `.gitignore` (e.g. `/*` followed by `!/…` negations) ([#20397](https://github.com/tailwindlabs/tailwindcss/pull/20397))
 - Ensure root `theme('…')` namespace lookups in JavaScript plugins and config files return the full namespace object instead of the value of its `DEFAULT` key ([#20399](https://github.com/tailwindlabs/tailwindcss/pull/20399))
 - Skip ignored directories entirely when computing watch globs (`scanner.globs`), instead of walking their full contents on every rebuild ([#20408](https://github.com/tailwindlabs/tailwindcss/pull/20408))
 - Oxide: drop invalid UTF-8 candidates ([#20389](https://github.com/tailwindlabs/tailwindcss/pull/20389))
```

---

### Incident Patch 7: `00ef99df` (2026-08-13)
**Commit Message**: Do not force full page reloads when using `@tailwindcss/vite` (#20414)

This PR removes all of the custom HMR handling we had in the
`@tailwindcss/vite` plugin.

When Vite 7.1 was introduced, Vite stopped performing a full page reload
for unknown files and instead started performing normal `hmr` updates.
This resulted in this issue:
https://github.com/tailwindlabs/tailwindcss/issues/19637

At the time, it felt like something we could easily re-add: if a file is
not covered by Vite, we can perform a `full-reload`. This meant that a
`.php` file would trigger a full page reload as expected.

The reason the `.php` file triggered Vite in the first place is because
those files were scanned by us (`@tailwindcss/vite`) so it made sense.

However, this then resulted in a plethora of issues, and it feels a bit
like a game of whac-a-mole.

- https://github.com/tailwindlabs/tailwindcss/issues/19744
- https://github.com/tailwindlabs/tailwindcss/issues/19903
- https://github.com/tailwindlabs/tailwindcss/issues/20320
- https://github.com/tailwindlabs/tailwindcss/issues/20378
- https://github.com/tailwindlabs/tailwindcss/issues/20411

Fixes: #19744
Fixes: #19903
Fixes: #20320
Fixes: #20378
Fixes: 

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Ensure root `theme('…')` namespace lookups in JavaScript plugins and config files return the full namespace object instead of the value of its `DEFAULT` key ([#20399](https://github.com/tailwindlabs/tailwindcss/pull/20399))
 - Skip ignored directories entirely when computing watch globs (`scanner.globs`), instead of walking their full contents on every rebuild ([#20408](https://github.com/tailwindlabs/tailwindcss/pull/20408))
 - Oxide: drop invalid UTF-8 candidates ([#20389](https://github.com/tailwindlabs/tailwindcss/pull/20389))
+- `@tailwindcss/vite` no longer forces a full page reload for external files (e.g.: `.php` files) ([#20414](https://github.com/tailwindlabs/tailwindcss/issues/20414))
 
 ## [4.3.3] - 2026-07-16
 
```

**File**: `integrations/vite/index.test.ts` (modified, +28/-20)
```diff
@@ -580,11 +580,11 @@ describe.each(['postcss', 'lightningcss'])('%s', (transformer) => {
     },
   )
 
-  describe.sequential.each([['^6'], ['7.0.8'], ['7.1.12'], ['7.3.1'], ['8.0.0']])(
+  describe.each([['^6'], ['7.0.8'], ['7.1.12'], ['7.3.1'], ['8.0.0']])(
     'Using Vite %s',
     (version) => {
       test(
-        'external source file changes trigger a full reload',
+        'external source file changes update the CSS',
         {
           fs: {
             'package.json': json`{}`,
@@ -661,26 +661,33 @@ describe.each(['postcss', 'lightningcss'])('%s', (transformer) => {
             expect(styles).toContain(candidate`content-['project-b/src/index.php']`)
           })
 
-          // Flush all messages so that we can be sure the next messages are from
-          // the file changes we're about to make
+          // Flush all messages so that we can be sure the next messages are
+          // from the file changes we're about to make
           process.flush()
 
-          // Changing an external .php file should trigger a full reload
+          // Changing an external .php file hot-updates the generated CSS
           {
             await fs.write(
               'project-b/src/index.php',
               txt`<div class="content-['updated:project-b/src/index.php']"></div>`,
             )
 
-            // Ensure the page reloaded
+            // On Vite < 7.1, Vite itself hard-invalidates watched files that
+            // aren't part of the module graph and reloads the page.
+            //
+            // On newer versions nothing reloads the page: the CSS hot-updates
+            // through the regular pipeline because the changed file is a
+            // watch dependency of the CSS root.
+            //
+            // Reloading the page for external template changes is the
+            // responsibility of the backend integration (e.g. `laravel-vite-plugin`'s `refresh` option, or `vite-plugin-full-reload`).
+            //
+            // https://github.com/tailwindlabs/tailwindcss/issues/20411
             if (version === '^6' || version === '7.0.8') {
               await process.onStdout((m) => m.includes('page reload') && m.includes('index.php'))
             } else {
-              await process.onStderr(
-                (m) => m.includes('vite:hmr (client)') && m.includes('index.php'),
-              )
+              await process.onStdout((m) => m.includes('hmr update') && m.includes('index.css'))
             }
-            await process.onStderr((m) => m.includes('vite:hmr (ssr)') && m.includes('index.php'))
 
             // Ensure the styles were regenerated with the new content
             let styles = await fetchStyles(url, '/index.html')
@@ -853,7 +860,6 @@ describe.each(['postcss', 'lightningcss'])('%s', (transformer) => {
           let styles = await fetchStyles(url, '/index.html')
           expect(styles).toContain(candidate`content-['updated:src/lazy.tsx']`)
         })
-        expect(await fs.read('project-a/hmr.log')).not.toContain('full-reload')
       }
 
       // The same holds for a custom file type as long as some file of the
@@ -868,7 +874,6 @@ describe.each(['postcss', 'lightningcss'])('%s', (transformer) => {
           let styles = await fetchStyles(url, '/index.html')
           expect(styles).toContain(candidate`content-['updated:src/comp-b.custom']`)
         })
-        expect(await fs.read('project-a/hmr.log')).not.toContain('full-reload')
       }
 
       // Changing a scanned stylesheet that is not part of the module graph
@@ -893,23 +898,26 @@ describe.each(['postcss', 'lightningcss'])('%s', (transformer) => {
           let log = await fs.read('project-a/hmr.log')
           expect(log.split('"type":"update"').length).toBeGreaterThan(updates)
         })
-        expect(await fs.read('project-a/hmr.log')).not.toContain('full-reload')
       }
 
-      // Changing an external file (e.g. a PHP template) should still trigger
-      // a full reload. This must work even though `snippet.php` is part of
-      // the module graph via the `?raw` import: a query import only pulls
-      // the file's contents into the graph (and creates an untransformed
-      // module node for the underlying file), it is not evidence that Vite
-      // processes `.php` files as modules.
+      // Changing an external file (e.g. a PHP template) hot-updates the
+      // generated CSS but does not trigger a full reload either. Reloading the
+      // page for external template changes is the responsibility of the backend
+      // integration (e.g. `laravel-vite-plugin`'s `refresh` option, or
+      // `vite-plugin-full-reload`).
+      //
+      // https://github.com/tailwindlabs/tailwindcss/issues/20411
       {
+        let updates = (await fs.read('project-a/hmr.log')).split('"type":"update"').length
+
         await fs.write(
           'project-b/src/index.php',
           html`<div class="content-['updated:project-b/src/index.php']"></div>`,
         )
 
   
```

**File**: `integrations/vite/preact.test.ts` (added, +165/-0)
```diff
@@ -0,0 +1,165 @@
+import { candidate, css, fetchStyles, html, json, retryAssertion, test, ts, txt } from '../utils'
+
+test(
+  'dev mode',
+  {
+    fs: {
+      'package.json': json`
+        {
+          "type": "module",
+          "dependencies": {
+            "preact": "^10"
+          },
+          "devDependencies": {
+            "@preact/preset-vite": "^2",
+            "@tailwindcss/vite": "workspace:^",
+            "tailwindcss": "workspace:^",
+            "vite": "^8"
+          }
+        }
+      `,
+      'vite.config.ts': ts`
+        import fs from 'node:fs'
+        import path from 'node:path'
+        import preact from '@preact/preset-vite'
+        import tailwindcss from '@tailwindcss/vite'
+        import { defineConfig } from 'vite'
+
+        export default defineConfig({
+          plugins: [
+            tailwindcss(),
+            preact(),
+            {
+              // Log all HMR payloads to a file so the test can assert on them
+              name: 'hmr-wiretap',
+              configureServer(server) {
+                let logFile = path.resolve('hmr.log')
+                fs.writeFileSync(logFile, '')
+                for (let environment of Object.values(server.environments)) {
+                  let send = environment.hot.send.bind(environment.hot)
+                  environment.hot.send = (payload) => {
+                    fs.appendFileSync(logFile, JSON.stringify(payload) + '\\n')
+                    return send(payload)
+                  }
+                }
+              },
+            },
+          ],
+        })
+      `,
+      'index.html': html`
+        <html>
+          <head>
+            <link rel="stylesheet" href="./src/index.css" />
+          </head>
+          <body>
+            <div id="app"></div>
+            <script type="module" src="./src/main.tsx"></script>
+          </body>
+        </html>
+      `,
+      'src/main.tsx': ts`
+        import { render } from 'preact'
+        import { App } from './app'
+
+        render(<App />, document.getElementById('app')!)
+      `,
+      'src/app.tsx': ts`
+        import { useState } from 'preact/hooks'
+
+        export function App() {
+          const [count, setCount] = useState(0)
+          return (
+            <button className="underline" onClick={() => setCount((c) => c + 1)}>
+              Count: {count}
+            </button>
+          )
+        }
+      `,
+      'src/index.css': css`@import 'tailwindcss';`,
+    },
+  },
+  async ({ fs, spawn, expect }) => {
+    let process = await spawn('pnpm vite dev')
+    await process.onStdout((m) => m.includes('ready in'))
+
+    let url = ''
+    await process.onStdout((m) => {
+      let match = /Local:\s*(http.*)\//.exec(m)
+      if (match) url = match[1]
+      return Boolean(url)
+    })
+
+    await retryAssertion(async () => {
+      let styles = await fetchStyles(url)
+      expect(styles).toContain(candidate`underline`)
+    })
+
+    // Load the component modules, like a browser visiting the page would
+    await fetch(`${url}/src/main.tsx`)
+    await fetch(`${url}/src/app.tsx`)
+
+    // Editing a component keeps HMR intact: new classes are delivered through
+    // a regular update, not a full page reload (which would lose all state)
+    {
+      await fs.write(
+        'src/app.tsx',
+        ts`
+          import { useState } from 'preact/hooks'
+
+          export function App() {
+            const [count, setCount] = useState(0)
+            return (
+              <button className="underline flex" onClick={() => setCount((c) => c + 1)}>
+                Count: {count}
+              </button>
+            )
+          }
+        `,
+      )
+
+      await retryAssertion(async () => {
+        let styles = await fetchStyles(url)
+        expect(styles).toContain(candidate`underline`)
+        expect(styles).toContain(candidate`flex`)
+      })
+      expect(await fs.read('hmr.log')).toContain('"type":"update"')
+      expect(await fs.read('hmr.log')).not.toContain('full-reload')
+    }
+
+    // Changing a scanned file that is not part of the module graph (e.g.
+    // `package.json`, which package managers and other tooling write to while
+    // the dev server is running) should not trigger a full reload either —
+    // that would destroy client state. New candidates should still be picked
+    // up because the file is a watch dependency of the CSS root, so the CSS
+    // hot-updates through Vite's regular pipeline.
+    //
+    // https://github.com/tailwindlabs/tailwindcss/issues/20411
+    {
+      await fs.write(
+        'package.json',
+        txt`
+          {
+            "type": "module",
+            "description": "content-['package.json']",
+            "dependencies": {
+              "preact": "^10"
+            },
+            "devDependencies": {
+              "@preact/preset-vite": "^2",
+              "@tailwindcss/vite": "workspace:^",
+              "tailwindcss": "workspace:^",
+    
```

**File**: `packages/@tailwindcss-vite/src/index.test.ts` (removed, +0/-28)
```diff
@@ -1,28 +0,0 @@
-import { expect, test } from 'vitest'
-import tailwindcss from './index'
-
-// Vite's experimental `bundledDev` mode calls `hotUpdate` without a `server`,
-// so the handler must not dereference it.
-//
-// - https://github.com/vitejs/vite/discussions/22746
-// - https://github.com/tailwindlabs/tailwindcss/issues/20378
-// - https://vite.dev/blog/announcing-vite8-1#experimental-bundled-dev-mode
-test('hotUpdate does not crash when Vite omits the server (bundledDev)', () => {
-  let plugin = tailwindcss().find((plugin) => plugin.name === '@tailwindcss/vite:generate:serve')!
-
-  let hotUpdate = plugin.hotUpdate as unknown as (options: {
-    file: string
-    modules: unknown[]
-    timestamp: number
-    server: undefined
-  }) => unknown
-
-  expect(() =>
-    hotUpdate.call(plugin, {
-      file: '/app/template.html',
-      modules: [{ type: 'asset', id: undefined }],
-      timestamp: Date.now(),
-      server: undefined,
-    }),
-  ).not.toThrow()
-})
```

**File**: `packages/@tailwindcss-vite/src/index.ts` (modified, +1/-221)
```diff
@@ -9,23 +9,15 @@ import {
 } from '@tailwindcss/node'
 import { clearRequireCache } from '@tailwindcss/node/require-cache'
 import { Scanner } from '@tailwindcss/oxide'
-import { realpathSync } from 'node:fs'
 import fs from 'node:fs/promises'
 import path from 'node:path'
-import type {
-  Environment,
-  InternalResolveOptions,
-  Plugin,
-  ResolvedConfig,
-  ViteDevServer,
-} from 'vite'
+import type { Environment, InternalResolveOptions, Plugin, ResolvedConfig } from 'vite'
 import * as vite from 'vite'
 
 const DEBUG = env.DEBUG
 const SPECIAL_QUERY_RE = /[?&](?:worker|sharedworker|raw|url)\b/
 const COMMON_JS_PROXY_RE = /\?commonjs-proxy/
 const INLINE_STYLE_ID_RE = /[?&]index=\d+\.css$/
-const JS_EXTENSIONS_RE = /^\.[cm]?[jt]sx?$/
 
 export type PluginOptions = {
   /**
@@ -73,17 +65,9 @@ function createCustomResolver(
 }
 
 export default function tailwindcss(opts: PluginOptions = {}): Plugin[] {
-  let servers: ViteDevServer[] = []
   let config: ResolvedConfig | null = null
   let rootsByEnv = new DefaultMap<string, Map<string, Root>>((env: string) => new Map())
 
-  // File extensions that Vite (or one of its plugins) has been seen to process
-  // as a module. Plugins don't get added or removed while the dev server is
-  // running (changing the Vite config restarts the server), so once we've seen
-  // evidence for a file type we don't need to scan the module graphs for it
-  // again.
-  let viteProcessedExtensions = new Set<string>()
-
   let isSSR = false
   let shouldOptimize = true
   let minify = true
@@ -196,10 +180,6 @@ export default function tailwindcss(opts: PluginOptions = {}): Plugin[] {
       name: '@tailwindcss/vite:scan',
       enforce: 'pre',
 
-      configureServer(server) {
-        servers.push(server)
-      },
-
       async configResolved(_config) {
         config = _config
         isSSR = config.build.ssr !== false && config.build.ssr !== undefined
@@ -256,151 +236,6 @@ export default function tailwindcss(opts: PluginOptions = {}): Plugin[] {
           return result
         },
       },
-
-      hotUpdate({ file, modules, timestamp, server }) {
-        // Vite's experimental `bundledDev` mode invokes `hotUpdate` without a
-        // `server`, so there are no sibling environments to inspect and no
-        // server-level `hot`/`ws` channel to reload through. Bail out early
-        // rather than dereferencing `undefined`.
-        //
-        // https://github.com/tailwindlabs/tailwindcss/issues/20378
-        if (!server) return
-
-        // Ensure full-reloads are triggered for files that are being watched by
-        // Tailwind but aren't part of the module graph (like PHP or HTML
-        // files). If we don't do this, then changes to those files won't
-        // trigger a reload at all since Vite doesn't know about them.
-        {
-          // It's a little bit confusing, because due to the `addWatchFile`
-          // calls, it _is_ part of the module graph but nothing is really
-          // handling those files. These modules typically have an id of
-          // undefined and/or have a type of 'asset'.
-          //
-          // If we call `addWatchFile` on a file that is part of the actual
-          // module graph, then we will see a module for it with a type of `js`
-          // and a type of `asset`. We are only interested if _all_ of them are
-          // missing an id and/or have a type of 'asset', which is a strong
-          // signal that the changed file is not being handled by Vite or any of
-          // the plugins.
-          //
-          // Note: in Vite v7.0.6 the modules here will have a type of `js`, not
-          // 'asset'. But it will also have a `HARD_INVALIDATED` state and will
-          // do a full page reload already.
-          //
-          // Empty modules can be skipped since it means it's not
-          // `addWatchFile`d and thus irrelevant to Tailwind.
-          let isExternalFile =
-            modules.length > 0 &&
-            modules.every((mod) => mod.type === 'asset' || mod.id === undefined)
-          if (!isExternalFile) return
-
-          // Skip files that Vite (or one of its plugins) processes as a
-          // module — in this environment (e.g. a lazily-loaded route that
-          // hasn't been visited yet) or in another one (e.g. an SSR-only
-          // module). Such a file can only affect the page through Vite's own
-          // pipeline, so a full reload would only destroy client state. Any
-          // changes to the generated CSS still go through the regular
-          // `css-update` flow because the file is registered via
-          // `addWatchFile`.
-          //
-          // If the file exists as a real module in another environment, then
-          // that environment is responsible for it. E.g. an SSR framework
-          // has its own server side hmr/reload mechanism when handling
-          // server only modules. See https://v6.vite.dev/guide/migration.html
-         
```

---

### Incident Patch 8: `b9286a73` (2026-08-13)
**Commit Message**: fix: Drop invalid UTF-8 scanner candidates (#20389)

## Summary

Replace the three unchecked scanner conversions in
`crates/oxide/src/scanner/mod.rs` with checked conversions that omit
only extracted slices that are not valid UTF-8. Apply the check in the
shared `extract` pipeline so initial scans, incremental `scan_content`
calls, and CSS-variable extraction cannot insert invalid strings into
scanner state, and apply the same policy to both branches of
`get_candidates_with_positions` while preserving byte offsets and the
legacy `-[]` restoration. Keep the extractor's byte-oriented CSS
identifier classification unchanged: accepting non-ASCII bytes during
extraction is useful for valid multibyte code points, while the
conversion boundary is the authoritative place to enforce the `String`
contract.

The scanner currently converts extracted byte slices with unchecked
UTF-8 constructors at the shared extraction boundary and both
candidate-with-position branches. A source file containing a stray
continuation byte can therefore produce an invalid `String`, violating
Rust's string invariant and allowing corrupted candidates to persist in
a long-lived scanner. The thread provides a determi

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Don't scan gitignored directories (e.g. `node_modules` and `.git`) when the project uses a safelist-style `.gitignore` (e.g. `/*` followed by `!/…` negations) ([#20397](https://github.com/tailwindlabs/tailwindcss/discussions/20397))
 - Ensure root `theme('…')` namespace lookups in JavaScript plugins and config files return the full namespace object instead of the value of its `DEFAULT` key ([#20399](https://github.com/tailwindlabs/tailwindcss/pull/20399))
 - Skip ignored directories entirely when computing watch globs (`scanner.globs`), instead of walking their full contents on every rebuild ([#20408](https://github.com/tailwindlabs/tailwindcss/pull/20408))
+- Oxide: drop invalid UTF-8 candidates ([#20389](https://github.com/tailwindlabs/tailwindcss/pull/20389))
 
 ## [4.3.3] - 2026-07-16
 
```

**File**: `crates/oxide/src/scanner/mod.rs` (modified, +7/-8)
```diff
@@ -356,15 +356,14 @@ impl Scanner {
                     let i = s.as_ptr() as usize - offset;
                     let original = &original_content[i..i + s.len()];
                     if original.contains_str("-[]") {
-                        return Some(unsafe {
-                            (String::from_utf8_unchecked(original.to_vec()), i)
-                        });
+                        return String::from_utf8(original.to_vec())
+                            .ok()
+                            .map(|candidate| (candidate, i));
                     }
 
-                    // SAFETY: When we parsed the candidates, we already guaranteed that the byte
-                    // slices are valid, therefore we don't have to re-check here when we want to
-                    // convert it back to a string.
-                    Some(unsafe { (String::from_utf8_unchecked(s.to_vec()), i) })
+                    String::from_utf8(s.to_vec())
+                        .ok()
+                        .map(|candidate| (candidate, i))
                 }
 
                 _ => None,
@@ -617,7 +616,7 @@ where
             a
         })
         .into_iter()
-        .map(|s| unsafe { String::from_utf8_unchecked(s.to_vec()) })
+        .filter_map(|s| String::from_utf8(s.to_vec()).ok())
         .collect()
 }
 
```

**File**: `crates/oxide/tests/scanner.rs` (modified, +101/-0)
```diff
@@ -1076,6 +1076,102 @@ mod scanner {
         assert_eq!(normalized_sources, vec!["**/*", "*.styl"]);
     }
 
+    #[test]
+    fn it_should_drop_invalid_utf8_candidates() {
+        let dir = tempdir().unwrap();
+        fs::write(dir.path().join("index.html"), b"flex bg-[\x80] block").unwrap();
+
+        let mut scanner = Scanner::new(vec![public_source_entry_from_pattern(
+            dir.path().to_path_buf(),
+            "@source '*.html'",
+        )]);
+
+        let candidates = scanner
+            .scan()
+            .into_iter()
+            .map(String::into_bytes)
+            .collect::<Vec<_>>();
+
+        assert_eq!(candidates, vec![b"block".to_vec(), b"flex".to_vec()]);
+    }
+
+    #[test]
+    fn it_should_not_store_invalid_utf8_candidates_during_incremental_scans() {
+        let dir = tempdir().unwrap();
+        let file = dir.path().join("index.html");
+        fs::write(&file, b"flex bg-[\x80]").unwrap();
+
+        let mut scanner = Scanner::new(vec![public_source_entry_from_pattern(
+            dir.path().to_path_buf(),
+            "@source '*.html'",
+        )]);
+
+        let candidates = scanner
+            .scan_content(vec![ChangedContent::File(file, "html".into())])
+            .into_iter()
+            .map(String::into_bytes)
+            .collect::<Vec<_>>();
+        assert_eq!(candidates, vec![b"flex".to_vec()]);
+
+        let candidates =
+            scanner.scan_content(vec![ChangedContent::Content("block".into(), "html".into())]);
+        assert_eq!(candidates, vec!["block"]);
+
+        let candidates = scanner
+            .scan()
+            .into_iter()
+            .map(String::into_bytes)
+            .collect::<Vec<_>>();
+        assert_eq!(candidates, vec![b"block".to_vec(), b"flex".to_vec()]);
+    }
+
+    #[test]
+    fn it_should_drop_invalid_utf8_candidates_with_positions() {
+        let dir = tempdir().unwrap();
+        let file = dir.path().join("index.html");
+        fs::write(
+            &file,
+            b"flex bg-[\x80] group-[]:block group-[]:bg-[\x80] grid",
+        )
+        .unwrap();
+
+        let mut scanner = Scanner::new(vec![]);
+        let candidates = scanner
+            .get_candidates_with_positions(ChangedContent::File(file, "html".into()))
+            .into_iter()
+            .map(|(candidate, position)| (candidate.into_bytes(), position))
+            .collect::<Vec<_>>();
+
+        assert_eq!(
+            candidates,
+            vec![
+                (b"flex".to_vec(), 0),
+                (b"group-[]:block".to_vec(), 12),
+                (b"grid".to_vec(), 43),
+            ]
+        );
+    }
+
+    #[test]
+    fn it_should_preserve_valid_utf8_candidates() {
+        let dir = tempdir().unwrap();
+        fs::write(
+            dir.path().join("index.html"),
+            "before:content-['💩'] bg-[é] font-[中文]".as_bytes(),
+        )
+        .unwrap();
+
+        let mut scanner = Scanner::new(vec![public_source_entry_from_pattern(
+            dir.path().to_path_buf(),
+            "@source '*.html'",
+        )]);
+
+        assert_eq!(
+            scanner.scan(),
+            vec!["before:content-['💩']", "bg-[é]", "font-[中文]"]
+        );
+    }
+
     #[test]
     fn it_should_preserve_paths_for_sources_ending_in_a_deep_glob() {
         let ScanResult {
@@ -3967,6 +4063,11 @@ mod scanner {
                 ("src/defined-at-start.css", "--color-defined-at-start: red;"),
             ],
         );
+        fs::write(
+            dir.join("src/invalid.css"),
+            b".button { color: var(--color-\x80); }",
+        )
+        .unwrap();
 
         let mut scanner = Scanner::new(vec![public_source_entry_from_pattern(
             dir.clone(),
```

---

### Incident Patch 9: `8ac18c7e` (2026-08-13)
**Commit Message**: test: fix 'with with' typo in css parser tests (#20410)

<!--

👋 Hey, thanks for your interest in contributing to Tailwind!

**Please ask first before starting work on any significant new
features.**

It's never a fun experience to have your pull request declined after
investing a lot of time and effort into a new feature. To avoid this
from happening, we request that contributors create a discussion to
first discuss any significant new features.

For more info, check out the contributing guide:


https://github.com/tailwindlabs/tailwindcss/blob/main/.github/CONTRIBUTING.md

-->

## Summary

<!--

Provide a summary of the issue and the changes you're making. How does
your change solve the problem?

-->

## Test plan

<!--

Explain how you tested your changes. Include the exact commands that you
used to verify the change works and include screenshots/screen
recordings of the update behavior in the browser if applicable.

-->

**File**: `packages/tailwindcss/src/css-parser.test.ts` (modified, +1/-1)
```diff
@@ -203,7 +203,7 @@ describe.each(['Unix', 'Windows'])('Line endings: %s', (lineEndings) => {
       ])
     })
 
-    it('should parse declarations with with strings and escaped string endings', () => {
+    it('should parse declarations with strings and escaped string endings', () => {
       expect(
         parse(css`
           content: 'These are not the end "\' of the string';
```

---

### Incident Patch 10: `b86a6e0a` (2026-08-12)
**Commit Message**: Fix slow Vite rebuilds in projects with large gitignored directories (#20408)

Preface: For full transparency, I used AI (Claude) to help dig into this
issue we're having and write some of the explanation below.

Our local Laravel application (with Docker) takes between 2-6s seconds
(re)building `app.css` after each Blade file update. After checking with
Claude, there seems to be some potential unnecessary traversing of big
(gitignored) directories, specifically `vendor` and `storage`.

As far as I understand it, two scans happen in tailwindcss:

- a first scan, the content scan. This one reads the project files
(auto-detect). It respects .gitignore, so it correctly skips vendor/ and
storage/.

- a second scan, the glob resolution (resolve_globs() in the oxide
crate). It builds watch patterns that the Vite plugin registers, so a
file save can trigger a CSS rebuild. It walks the project again, but
this walk does not respect .gitignore. It only skips a hardcoded list of
directory names from `ignored-content-dirs.txt` (node_modules, .git,
venv, ...). vendor/ and storage/ are not on that list, so it descends
into them and stats every file. These directories can never produce a
watch pa

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Preserve whitespace in `--default(…)` values in custom functional utilities (e.g. `--default(box alphabetic)` no longer becomes `boxalphabetic`) ([#20392](https://github.com/tailwindlabs/tailwindcss/pull/20392))
 - Don't scan gitignored directories (e.g. `node_modules` and `.git`) when the project uses a safelist-style `.gitignore` (e.g. `/*` followed by `!/…` negations) ([#20397](https://github.com/tailwindlabs/tailwindcss/discussions/20397))
 - Ensure root `theme('…')` namespace lookups in JavaScript plugins and config files return the full namespace object instead of the value of its `DEFAULT` key ([#20399](https://github.com/tailwindlabs/tailwindcss/pull/20399))
+- Skip ignored directories entirely when computing watch globs (`scanner.globs`), instead of walking their full contents on every rebuild ([#20408](https://github.com/tailwindlabs/tailwindcss/pull/20408))
 
 ## [4.3.3] - 2026-07-16
 
```

**File**: `crates/oxide/src/scanner/detect_sources.rs` (modified, +1/-0)
```diff
@@ -112,6 +112,7 @@ pub fn resolve_globs(
         }
 
         if !dirs.contains(path) {
+            it.skip_current_dir();
             continue;
         }
 
```

**File**: `crates/oxide/tests/scanner.rs` (modified, +25/-0)
```diff
@@ -2641,6 +2641,31 @@ mod scanner {
         assert_eq!(candidates, vec!["content-['b']"]);
     }
 
+    // https://github.com/tailwindlabs/tailwindcss/pull/20408
+    #[test]
+    fn test_resolving_globs_does_not_traverse_gitignored_directories() {
+        let ScanResult { files, globs, .. } = scan_with_globs(
+            &[
+                (".gitignore", "/vendor\n"),
+                ("vendor/pkg/canary/index.html", ""),
+                ("src/index.html", ""),
+            ],
+            vec!["@source '**/*'", "@source './vendor/pkg/canary'"],
+        );
+
+        assert_eq!(
+            files,
+            vec!["src/index.html", "vendor/pkg/canary/index.html"]
+        );
+        assert_eq!(globs, vec![
+            "*",
+            "src/**/*.{aspx,astro,cjs,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue}",
+
+            // This should not include `**` or `**.*.{aspx,...}` otherwise this might be scanned recursively.
+            "vendor/pkg/canary/*",
+        ]);
+    }
+
     #[test]
     fn test_extract_used_css_variables_from_css() {
         let dir = tempdir().unwrap().into_path();
```

---

### Incident Patch 11: `3524b453` (2026-08-05)
**Commit Message**: Attempt to fix flaky integration test (#20384)

One of the integration tests is flaky on CI. This is an attempt to "fix"
it.

It has probably something to do with the availability of the resources
provided by GitHub because locally this works flawlessly for 100 runs
straight.

## Test plan

- Once we get 5 consecutive positive runs we van merge it.
- No actual code was changed, only the flaky integration test itself.

<img width="336" height="445" alt="image"
src="https://github.com/user-attachments/assets/bec81687-62f5-4df3-8109-d0aaa4ffbd8a"
/>

**File**: `integrations/vite/bundled-dev.test.ts` (modified, +65/-46)
```diff
@@ -60,19 +60,31 @@ test(
   async ({ root, spawn, fs, expect }) => {
     let process = await spawn('pnpm vite dev', {
       cwd: path.join(root, 'project-a'),
+      env: {
+        // Some CI machines have an upstream rolldown bug where its file watcher
+        // never delivers a single event. The debug output is the only way to
+        // tell that apart from a real regression (see below).
+        DEBUG: 'vite:full-bundle-mode',
+      },
     })
 
+    // Any debug output beyond the "INITIAL:" startup lines proves rolldown's
+    // watcher delivered at least one file event.
+    let watcherAlive = false
+
     // `hotUpdate` errors don't kill the dev server, they are only printed to
     // stderr. Track them explicitly so a crash fails the test even if the
     // rebuild happens to succeed anyway.
     let pluginErrors: string[] = []
     process.onStderr((message) => {
-      if (message.includes('@tailwindcss/vite')) pluginErrors.push(message)
+      if (message.includes('vite:full-bundle-mode')) {
+        if (!message.includes('INITIAL:')) watcherAlive = true
+      } else if (message.includes('@tailwindcss/vite')) {
+        pluginErrors.push(message)
+      }
       return false
     })
 
-    await process.onStdout((m) => m.includes('ready in'))
-
     let url = ''
     await process.onStdout((m) => {
       let match = /Local:\s*(http.*)\//.exec(m)
@@ -119,55 +131,62 @@ test(
       { timeout: 10_000, delay: 100 },
     )
 
-    // A file change is only picked up once rolldown's watcher is fully set up,
-    // which races with the first write on slow machines. Retried writes must
-    // also produce _different_ content each time, because rolldown compares
-    // module contents and treats a write of identical content as a no-op — so a
-    // lost first change could never be recovered by re-writing the same file.
-    let iteration = 0
-
-    // Each iteration writes the file and then immediately fetches, so the fetch
-    // can only observe the rebuild of a _previous_ write. The delay between
-    // iterations is what gives that rebuild time to finish. The default 5ms
-    // would queue a new rebuild on every poll and keep the served bundle
-    // permanently one edit behind, so retry once per second instead.
-    let retryOptions = { timeout: 15_000, delay: 1_000 }
+    // Edit a module file and a manually `@source`d file. Without a connected
+    // HMR websocket client (this test only uses HTTP fetches), a file change
+    // does not trigger an eager rebuild — it only marks the bundle as stale,
+    // and the next fetch kicks off the rebuild. So poll with fetches without
+    // touching the files again: rewriting would re-mark the bundle stale right
+    // before each fetch and the rebuild could never be observed.
+    await fs.write(
+      'project-a/index.html',
+      html`
+        <head>
+          <link rel="stylesheet" href="./src/index.css" />
+        </head>
+        <body>
+          <div class="underline m-2">Hello, world!</div>
+        </body>
+      `,
+    )
 
-    await retryAssertion(async () => {
-      // Updates are additive and cause new candidates to be added.
-      await fs.write(
-        'project-a/index.html',
-        html`
-          <head>
-            <link rel="stylesheet" href="./src/index.css" />
-          </head>
-          <body>
-            <div class="underline m-2">Hello, world! (${++iteration})</div>
-          </body>
-        `,
+    await fs.write('project-b/src/index.html', html`
+      <div class="flex font-bold" />
+    `)
+
+    try {
+      await retryAssertion(
+        async () => {
+          let styles = await fetchBundledStyles()
+          expect(styles).toContain(candidate`underline`)
+          expect(styles).toContain(candidate`flex`)
+          expect(styles).toContain(candidate`m-2`)
+          expect(styles).toContain(candidate`font-bold`)
+        },
+        { timeout: 15_000, delay: 100 },
       )
-
+    } catch (error) {
+      // If rolldown's watcher delivered any file event, the updates were
+      // genuinely dropped somewhere along the way — a real failure.
+      if (watcherAlive) throw error
+
+      // Otherwise the watcher never delivered a single event, so the updates
+      // can never be observed no matter how long we wait — an upstream
+      // rolldown bug on some CI machines, not a plugin regression. The crash
+      // regression this test guards is still covered: `hotUpdate` is driven
+      // by Vite's own (working) chokidar watcher and asserted via
+      // `pluginErrors` below.
+      //
+      // Skipping is only sound while the server still healthily serves the
+      // original bundle. If it stopped serving (crashed, or wedged on the
+      // fallback page), that's real breakage a silent watcher must not mask.
+      console.log(error)
       let styles = await fetchBundledStyles()
       expect(styles).toContain(candidate`underline`)
       expect(styles).toContain(candidat
```

---

### Incident Patch 12: `d1903435` (2026-08-04)
**Commit Message**: Use wasm as a fallback for `@tailwindcss/oxide` (#20383)

Right now, we use Rust for `@tailwindcss/oxide` which has 2
responsibilities:

1. Traverse the file system and figure out which files need to be
scanned based on auto source detection and `@source` directives.
2. Given those files, extract possible Tailwind CSS classes which we
call candidates.

Since this is using native code, we use napi-rs to get native `.node`
files on a per platform / arch basis.

So far so good, however, if you are on an OS that doesn't have a
prebuilt binary, you will receive an error that might look like this:

```
Error: Cannot find native binding. npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i` again after removing both package-lock.json and node_modules directory.
    at Object.<anonymous> (/private/var/folders/1k/bdv8blv93xq7qgwjdwc9z88h0000gn/T/tailwind-integrationspYHIVP/node_modules/.pnpm/@tailwindcss+oxide@file+..+..+..+..+..+..+..+Users+robin+github.com+tailwindlabs+tailwi_47ae1688f61c719f66c73e2ff35e430f/node_modules/@tailwindcss/oxide/index.js:573:19)
    at Module._compile (node:internal/modules/cjs/loader:1829:14)
    at Object.

**File**: `crates/node/npm/wasm32-wasi/README.md` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 # `@tailwindcss/oxide-wasm32-wasi`
 
-This is the **wasm32-wasip1-threads** binary for `@tailwindcss/oxide`
+This is the **wasm32-wasip1-threads** build of `@tailwindcss/oxide`
```

**File**: `crates/node/npm/wasm32-wasi/package.json` (modified, +0/-3)
```diff
@@ -1,9 +1,6 @@
 {
   "name": "@tailwindcss/oxide-wasm32-wasi",
   "version": "4.3.3",
-  "cpu": [
-    "wasm32"
-  ],
   "main": "tailwindcss-oxide.wasi.cjs",
   "files": [
     "tailwindcss-oxide.wasm32-wasi.wasm",
```

**File**: `integrations/oxide/wasm.test.ts` (modified, +185/-1)
```diff
@@ -1,4 +1,4 @@
-import { css, js, json, test } from '../utils'
+import { css, js, json, test, yaml } from '../utils'
 
 // This test runs the wasm build using the `node:wasi` runtime.
 //
@@ -57,3 +57,187 @@ testFn(
     `)
   },
 )
+
+testFn(
+  '`@tailwindcss/oxide` falls back to the wasm build when no native binding is available',
+  {
+    fs: {
+      'package.json': json`
+        {
+          "dependencies": {
+            "@tailwindcss/oxide": "workspace:^"
+          }
+        }
+      `,
+      'pnpm-workspace.yaml': yaml`
+        # Trick pnpm in only supporting an architecture that @tailwindcss/oxide
+        # doesn't support, and therefore should fallback to the wasm version.
+        supportedArchitectures:
+          os:
+            - openbsd
+          cpu:
+            - x64
+      `,
+      'src/index.js': js`
+        const className = "content-['src/index.js']"
+        module.exports = { className }
+      `,
+      'index.mjs': js`
+        import { createRequire } from 'node:module'
+        import { join } from 'node:path'
+
+        let require = createRequire(import.meta.url)
+        let { Scanner } = require('@tailwindcss/oxide')
+
+        let loaded = Object.keys(require.cache)
+
+        let scanner = new Scanner({
+          sources: [
+            {
+              base: join(process.cwd(), 'src'),
+              pattern: '**/*',
+              negated: false,
+            },
+          ],
+        })
+
+        console.log(
+          JSON.stringify({
+            native: loaded.filter((file) => file.endsWith('.node')),
+            wasi: loaded.some((file) => file.endsWith('tailwindcss-oxide.wasi.cjs')),
+            candidates: scanner.scan(),
+          }),
+        )
+        process.exit()
+      `,
+    },
+  },
+  async ({ expect, exec }) => {
+    // Since vitest runs under `pnpm run`, pnpm's bin shims export a NODE_PATH
+    // that includes the repository's hidden hoist directory
+    // (`node_modules/.pnpm/node_modules`), which links every workspace package,
+    // including all native `@tailwindcss/oxide-*` bindings.
+    //
+    // Node uses `NODE_PATH` exactly when the local `node_modules` lookup fails,
+    // which would defeat the simulated unsupported platform, so clear it.
+    let output = await exec(`node index.mjs`, { env: { NODE_PATH: '' } })
+    let { native, wasi, candidates } = JSON.parse(output)
+
+    // No native binding was installed or loaded, ...
+    expect(native).toEqual([])
+
+    // ... the wasm32-wasi binding is what actually loaded, ...
+    expect(wasi).toBe(true)
+
+    // ... and scanning real files on disk works through it.
+    expect(candidates).toMatchInlineSnapshot(`
+      [
+        "className",
+        "const",
+        "content-['src/index.js']",
+        "exports",
+      ]
+    `)
+  },
+)
+
+testFn(
+  'the wasm build loads even when preopening the filesystem root is denied',
+  {
+    fs: {
+      'package.json': json`
+        {
+          "dependencies": {
+            "@tailwindcss/oxide": "workspace:^"
+          }
+        }
+      `,
+      'pnpm-workspace.yaml': yaml`
+        # Trick pnpm in only supporting an architecture that @tailwindcss/oxide
+        # doesn't support, and therefore should fallback to the wasm version.
+        supportedArchitectures:
+          os:
+            - openbsd
+          cpu:
+            - x64
+      `,
+      // The wasm bindings generated by `@napi-rs/cli` preopen the filesystem
+      // root, which sandboxed platforms (e.g. OpenHarmony, Android) deny with
+      // `UVWASI_EACCES`, making the wasm fallback fail to load on exactly the
+      // platforms that need it.
+      //
+      // We patch `@napi-rs/cli`'s templates to retry with narrower preopens
+      // (see `patches/@napi-rs__cli@3.7.4.patch`). Simulate such a sandbox by
+      // denying `/` preopens.
+      'preload.cjs': js`
+        const wasi = require('node:wasi')
+        const RealWASI = wasi.WASI
+
+        wasi.WASI = class WASI extends RealWASI {
+          constructor(options) {
+            if (options?.preopens?.['/'] !== undefined) {
+              const error = new Error('UVWASI_EACCES, uvwasi_init')
+              error.code = 'UVWASI_EACCES'
+              error.syscall = 'uvwasi_init'
+              throw error
+            }
+            super(options)
+          }
+        }
+      `,
+      'src/index.js': js`
+        const className = "content-['src/index.js']"
+        module.exports = { className }
+      `,
+      'index.mjs': js`
+        import { createRequire } from 'node:module'
+        import { join } from 'node:path'
+
+        let require = createRequire(import.meta.url)
+        let { Scanner } = require('@tailwindcss/oxide')
+
+        let loaded = Object.keys(require.cache)
+
+        let scanner = new Scanner({
+          sources: [
+            {
+              base: join(process.cwd(), 'src'),
+              pattern: '**/*',
+              negated: false,
+         
```

**File**: `patches/@napi-rs__cli@3.7.4.patch` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+diff --git a/dist/cli.js b/dist/cli.js
+index c4c2d568bc070c07dbf3a1f9f4a0c946466668cf..353bbca86e3261a2ba9a8fc56dc612c7c84dab6d 100755
+--- a/dist/cli.js
++++ b/dist/cli.js
+@@ -1,4 +1,13 @@
+ #!/usr/bin/env node
++// PATCHED (see patches/@napi-rs__cli@3.7.4.patch): the embedded wasi loader
++// and worker templates below retry `new WASI(...)` with narrower preopens,
++// because preopening `/` throws `UVWASI_EACCES` on sandboxed platforms (e.g.
++// OpenHarmony), which would make the generated wasm binding fail to load.
++//
++// The same templates also exist in `dist/index.js` and `dist/index.cjs` (the
++// programmatic API). Those are intentionally NOT patched because we only
++// build through the `napi` bin, which runs this file. If we ever start using
++// the programmatic API, update the patch to cover those bundles too.
+ import { createRequire } from "node:module";
+ import { Cli, Command, Option } from "clipanion";
+ import path, { basename, dirname, isAbsolute, join, parse, resolve } from "node:path";
+@@ -1021,13 +1030,25 @@ const {
+ 
+ const __rootDir = __nodePath.parse(process.cwd()).root
+ 
+-const __wasi = new __nodeWASI({
+-  version: 'preview1',
+-  env: process.env,
+-  preopens: {
+-    [__rootDir]: __rootDir,
++const __wasi = (() => {
++  // Preopening '/' fails with UVWASI_EACCES in sandboxed environments (e.g.
++  // OpenHarmony, Android), which would prevent the wasm binding from loading
++  // at all. Retry with narrower preopens instead. Without any preopens the
++  // binding still loads; only file system access is unavailable.
++  let lastError = null
++  for (const dir of [__rootDir, process.cwd(), null]) {
++    try {
++      return new __nodeWASI({
++        version: 'preview1',
++        env: process.env,
++        preopens: dir === null ? {} : { [dir]: dir },
++      })
++    } catch (error) {
++      lastError = error
++    }
+   }
+-})
++  throw lastError
++})()
+ 
+ const __emnapiContext = __emnapiGetDefaultContext()
+ 
+@@ -1151,13 +1172,22 @@ const __rootDir = parse(process.cwd()).root;
+ 
+ const handler = new MessageHandler({
+   onLoad({ wasmModule, wasmMemory }) {
+-    const wasi = new WASI({
+-      version: 'preview1',
+-      env: process.env,
+-      preopens: {
+-        [__rootDir]: __rootDir,
+-      },
+-    });
++    // Keep in sync with the preopen fallback in the main-thread loader.
++    const wasi = (() => {
++      let lastError = null;
++      for (const dir of [__rootDir, process.cwd(), null]) {
++        try {
++          return new WASI({
++            version: 'preview1',
++            env: process.env,
++            preopens: dir === null ? {} : { [dir]: dir },
++          });
++        } catch (error) {
++          lastError = error;
++        }
++      }
++      throw lastError;
++    })();
+ 
+     return instantiateNapiModuleSync(wasmModule, {
+       childThread: true,
```

**File**: `pnpm-lock.yaml` (modified, +3/-2)
```diff
@@ -77,6 +77,7 @@ catalogs:
       version: 5.109.2
 
 patchedDependencies:
+  '@napi-rs/cli@3.7.4': 9912bf0a9c2cef8329d11c41fbce4d33ce2bdcf660a630b258c962c0a3c44bed
   '@parcel/watcher@2.6.0': 705ce75ccea54337110c4d7fe0a8b421658ea0c23e1a77c1fa890a86041179da
   lightningcss@1.33.0: 1d4a8800d60d13d42887b88b3a86576df4b451670308145fb432ec8abbf40930
 
@@ -128,7 +129,7 @@ importers:
         version: 1.11.3
       '@napi-rs/cli':
         specifier: 3.7.4
-        version: 3.7.4(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(@types/node@25.9.1)(node-addon-api@8.7.0)
+        version: 3.7.4(patch_hash=9912bf0a9c2cef8329d11c41fbce4d33ce2bdcf660a630b258c962c0a3c44bed)(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(@types/node@25.9.1)(node-addon-api@8.7.0)
       '@napi-rs/wasm-runtime':
         specifier: ^1.2.2
         version: 1.2.2(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)
@@ -3895,7 +3896,7 @@ snapshots:
       '@jridgewell/resolve-uri': 3.1.2
       '@jridgewell/sourcemap-codec': 1.5.5
 
-  '@napi-rs/cli@3.7.4(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(@types/node@25.9.1)(node-addon-api@8.7.0)':
+  '@napi-rs/cli@3.7.4(patch_hash=9912bf0a9c2cef8329d11c41fbce4d33ce2bdcf660a630b258c962c0a3c44bed)(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)(@types/node@25.9.1)(node-addon-api@8.7.0)':
     dependencies:
       '@inquirer/prompts': 8.5.2(@types/node@25.9.1)
       '@napi-rs/cross-toolchain': 1.0.3(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)
```

**File**: `pnpm-workspace.yaml` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ packages:
   - 'integrations'
 
 patchedDependencies:
+  '@napi-rs/cli@3.7.4': patches/@napi-rs__cli@3.7.4.patch
   '@parcel/watcher@2.6.0': patches/@parcel__watcher@2.6.0.patch
   lightningcss@1.33.0: patches/lightningcss@1.33.0.patch
 
```

---

### Incident Patch 13: `50daebde` (2026-08-03)
**Commit Message**: Prevent `@tailwindcss/vite` crash under Vite's experimental `bundledDev` (#20379)

## Summary

Under Vite's experimental `bundledDev` mode, the `hotUpdate` hook in
`@tailwindcss/vite` gets called without a `server`. Vite only passes `{
type, file, modules }` here, but the hook loops over
`Object.values(server.environments)`, so editing any file (JS, CSS, or
HTML) throws `TypeError: Cannot read properties of undefined (reading
'environments')` and the dev server build fails.

The fix returns early when `server` is missing. Those environment loops
only look at environments other than the current one, and the
server-level `hot`/`ws` reload channels don't exist in this mode, so
bailing out leaves the classic (non-`bundledDev`) dev path untouched.

Fixes #20378

## Test plan

- Added a unit test that calls `hotUpdate` without a `server` and checks
it doesn't throw. It fails on the current code and passes with the
guard.
- Reproduced with a Vite 8 project using `experimental.bundledDev:
true`: before the change, editing any JS/CSS/HTML file crashed the dev
server; after it, edits work.
- `pnpm run test` and the `@tailwindcss/vite` integration suite both
pass.


[ci-all]

---------

Co-au

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Fix standalone declarations in `@scope`, wrap them in `:where(:scope)` ([#20369](https://github.com/tailwindlabs/tailwindcss/pull/20369))
 - Always emit a space for empty fallback values in CSS variables (e.g. `var(--tw-blur,)` → `var(--tw-blur, )`) ([#20373](https://github.com/tailwindlabs/tailwindcss/pull/20373))
 - Canonicalization: convert arbitrary breakpoint and container query variants to named equivalents (e.g. `max-[64rem]` → `max-lg`) ([#20380](https://github.com/tailwindlabs/tailwindcss/pull/20380))
+- Prevent `@tailwindcss/vite` from crashing on every edit under Vite's experimental `bundledDev` mode ([#20379](https://github.com/tailwindlabs/tailwindcss/pull/20379))
 
 ## [4.3.3] - 2026-07-16
 
```

**File**: `integrations/vite/bundled-dev.test.ts` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+import path from 'node:path'
+import { candidate, css, html, json, retryAssertion, test, ts, txt, yaml } from '../utils'
+
+// Vite's experimental `bundledDev` mode invokes the `hotUpdate` hook without a
+// `server`, which used to crash the plugin on every file edit.
+//
+// - https://github.com/tailwindlabs/tailwindcss/issues/20378
+// - https://vite.dev/blog/announcing-vite8-1#experimental-bundled-dev-mode
+test(
+  'dev mode (experimental `bundledDev`)',
+  {
+    fs: {
+      'package.json': json`{}`,
+      'pnpm-workspace.yaml': yaml`
+        #
+        packages:
+          - project-a
+      `,
+      'project-a/package.json': txt`
+        {
+          "type": "module",
+          "dependencies": {
+            "@tailwindcss/vite": "workspace:^",
+            "tailwindcss": "workspace:^"
+          },
+          "devDependencies": {
+            "vite": "^8.1"
+          }
+        }
+      `,
+      'project-a/vite.config.ts': ts`
+        import tailwindcss from '@tailwindcss/vite'
+        import { defineConfig } from 'vite'
+
+        export default defineConfig({
+          experimental: {
+            bundledDev: true,
+          },
+          plugins: [tailwindcss()],
+        })
+      `,
+      'project-a/index.html': html`
+        <head>
+          <link rel="stylesheet" href="./src/index.css" />
+        </head>
+        <body>
+          <div class="underline">Hello, world!</div>
+        </body>
+      `,
+      'project-a/src/index.css': css`
+        @reference 'tailwindcss/theme';
+        @import 'tailwindcss/utilities';
+        @source '../../project-b/src/**/*.html';
+      `,
+      'project-b/src/index.html': html`
+        <div class="flex" />
+      `,
+    },
+  },
+  async ({ root, spawn, fs, expect }) => {
+    let process = await spawn('pnpm vite dev', {
+      cwd: path.join(root, 'project-a'),
+    })
+
+    // `hotUpdate` errors don't kill the dev server, they are only printed to
+    // stderr. Track them explicitly so a crash fails the test even if the
+    // rebuild happens to succeed anyway.
+    let pluginErrors: string[] = []
+    process.onStderr((message) => {
+      if (message.includes('@tailwindcss/vite')) pluginErrors.push(message)
+      return false
+    })
+
+    await process.onStdout((m) => m.includes('ready in'))
+
+    let url = ''
+    await process.onStdout((m) => {
+      let match = /Local:\s*(http.*)\//.exec(m)
+      if (match) url = match[1]
+      return Boolean(url)
+    })
+
+    // In `bundledDev` mode the stylesheet is not served separately. Instead the
+    // generated CSS is embedded in the bundled JS and injected at runtime, so
+    // extract the bundle from the served HTML. While the bundle is being built,
+    // Vite serves a temporary fallback page instead.
+    //
+    // The bundle can be split into multiple chunks (e.g. the HMR client runtime
+    // and the app itself), and the chunk containing the CSS is not always the
+    // first one, so fetch every referenced script and stylesheet.
+    async function fetchBundledStyles(): Promise<string> {
+      let index = await fetch(`${url}/`)
+      let html = await index.text()
+      if (html.includes('__vite_is_fallback_page__')) {
+        throw new Error('Bundling still in progress')
+      }
+
+      let sources = [
+        ...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g),
+        ...html.matchAll(/<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"/g),
+      ].map((match) => match[1])
+      if (sources.length === 0) throw new Error(`No scripts or stylesheets found in:\n\n${html}`)
+
+      let contents = await Promise.all(
+        sources.map(async (src) => {
+          let response = await fetch(new URL(src, `${url}/`))
+          return await response.text()
+        }),
+      )
+      return contents.join('\n')
+    }
+
+    await retryAssertion(async () => {
+      let styles = await fetchBundledStyles()
+      expect(styles).toContain(candidate`underline`)
+      expect(styles).toContain(candidate`flex`)
+    })
+
+    // A file change is only picked up once rolldown's watcher is fully set up,
+    // which races with the first write on slow machines. Retried writes must
+    // also produce _different_ content each time, because rolldown compares
+    // module contents and treats a write of identical content as a no-op — so a
+    // lost first change could never be recovered by re-writing the same file.
+    let iteration = 0
+
+    await retryAssertion(async () => {
+      // Updates are additive and cause new candidates to be added.
+      await fs.write(
+        'project-a/index.html',
+        html`
+          <head>
+            <link rel="stylesheet" href="./src/index.css" />
+          </head>
+          <body>
+            <div class="underline m-2">Hello, world! (${++iteration})</div>
+          </body>
+        `,
+      )
+
+      let styles = await fetchBundledStyles()
+      expect(styles).toContain(candidate`underline`)
+    
```

**File**: `packages/@tailwindcss-vite/src/index.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { expect, test } from 'vitest'
+import tailwindcss from './index'
+
+// Vite's experimental `bundledDev` mode calls `hotUpdate` without a `server`,
+// so the handler must not dereference it.
+//
+// - https://github.com/vitejs/vite/discussions/22746
+// - https://github.com/tailwindlabs/tailwindcss/issues/20378
+// - https://vite.dev/blog/announcing-vite8-1#experimental-bundled-dev-mode
+test('hotUpdate does not crash when Vite omits the server (bundledDev)', () => {
+  let plugin = tailwindcss().find((plugin) => plugin.name === '@tailwindcss/vite:generate:serve')!
+
+  let hotUpdate = plugin.hotUpdate as unknown as (options: {
+    file: string
+    modules: unknown[]
+    timestamp: number
+    server: undefined
+  }) => unknown
+
+  expect(() =>
+    hotUpdate.call(plugin, {
+      file: '/app/template.html',
+      modules: [{ type: 'asset', id: undefined }],
+      timestamp: Date.now(),
+      server: undefined,
+    }),
+  ).not.toThrow()
+})
```

**File**: `packages/@tailwindcss-vite/src/index.ts` (modified, +8/-0)
```diff
@@ -258,6 +258,14 @@ export default function tailwindcss(opts: PluginOptions = {}): Plugin[] {
       },
 
       hotUpdate({ file, modules, timestamp, server }) {
+        // Vite's experimental `bundledDev` mode invokes `hotUpdate` without a
+        // `server`, so there are no sibling environments to inspect and no
+        // server-level `hot`/`ws` channel to reload through. Bail out early
+        // rather than dereferencing `undefined`.
+        //
+        // https://github.com/tailwindlabs/tailwindcss/issues/20378
+        if (!server) return
+
         // Ensure full-reloads are triggered for files that are being watched by
         // Tailwind but aren't part of the module graph (like PHP or HTML
         // files). If we don't do this, then changes to those files won't
```

---

### Incident Patch 14: `a4e0f756` (2026-07-31)
**Commit Message**: try converting variants with arbitrary values to builtin variants

**File**: `packages/@tailwindcss-upgrade/src/codemods/template/migrate-arbitrary-variants.ts` (modified, +7/-3)
```diff
@@ -16,8 +16,8 @@ export function migrateArbitraryVariants(
   rawCandidate: string,
 ): string {
   let designSystem = prepareDesignSystemStorage(baseDesignSystem)
-  let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY]
-  let variants = designSystem.storage[PRE_COMPUTED_VARIANTS_KEY]
+  let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY].get(null)
+  let variants = designSystem.storage[PRE_COMPUTED_VARIANTS_KEY].get(null)
 
   for (let readonlyCandidate of designSystem.parseCandidate(rawCandidate)) {
     // We are only interested in the variants
@@ -35,7 +35,11 @@ export function migrateArbitraryVariants(
       if (typeof targetSignature !== 'string') continue
 
       let foundVariants = variants.get(targetSignature)
-      if (foundVariants.length !== 1) continue
+      if (foundVariants.length === 0) continue
+
+      // The variant is already in a canonical form, e.g.: `min-lg` and `lg`
+      // produce the same CSS, but both are valid so we keep them as-is.
+      if (foundVariants.includes(targetString)) continue
 
       let foundVariant = foundVariants[0]
       let parsedVariant = designSystem.parseVariant(foundVariant)
```

**File**: `packages/tailwindcss/src/canonicalize-candidates.ts` (modified, +124/-99)
```diff
@@ -72,12 +72,11 @@ interface InternalCanonicalizeOptions {
   signatureOptions: SignatureOptions
 }
 
+type RemValue = number | null
+
 interface DesignSystem extends BaseDesignSystem {
   storage: {
-    [SIGNATURE_OPTIONS_KEY]: DefaultMap<
-      number | null, // Rem value
-      DefaultMap<SignatureFeatures, SignatureOptions>
-    >
+    [SIGNATURE_OPTIONS_KEY]: DefaultMap<RemValue, DefaultMap<SignatureFeatures, SignatureOptions>>
     [COMPARE_CANDIDATES_KEY]: DefaultMap<
       SignatureOptions,
       (a: Candidate | string, b: Candidate | string) => boolean
@@ -107,8 +106,8 @@ interface DesignSystem extends BaseDesignSystem {
       DefaultMap<string, DefaultMap<string, Set<string>>>
     >
     [PRE_COMPUTED_UTILITIES_KEY]: DefaultMap<SignatureOptions, DefaultMap<string, string[]>>
-    [VARIANT_SIGNATURE_KEY]: DefaultMap<string, string | symbol>
-    [PRE_COMPUTED_VARIANTS_KEY]: DefaultMap<string, string[]>
+    [VARIANT_SIGNATURE_KEY]: DefaultMap<RemValue, DefaultMap<string, string | symbol>>
+    [PRE_COMPUTED_VARIANTS_KEY]: DefaultMap<RemValue, DefaultMap<string, string[]>>
   }
 }
 
@@ -1537,8 +1536,8 @@ function arbitraryVariants(
   options: InternalCanonicalizeOptions,
 ): Variant | Variant[] {
   let designSystem = options.designSystem
-  let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY]
-  let variants = designSystem.storage[PRE_COMPUTED_VARIANTS_KEY]
+  let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY].get(options.signatureOptions.rem)
+  let variants = designSystem.storage[PRE_COMPUTED_VARIANTS_KEY].get(options.signatureOptions.rem)
 
   let iterator = walkVariants(variant)
   for (let [variant] of iterator) {
@@ -1549,7 +1548,11 @@ function arbitraryVariants(
     if (typeof targetSignature !== 'string') continue
 
     let foundVariants = variants.get(targetSignature)
-    if (foundVariants.length !== 1) continue
+    if (foundVariants.length === 0) continue
+
+    // The variant is already in a canonical form, e.g.: `min-lg` and `lg`
+    // produce the same CSS, but both are valid so we keep them as-is.
+    if (foundVariants.includes(targetString)) continue
 
     let foundVariant = foundVariants[0]
     let parsedVariant = designSystem.parseVariant(foundVariant)
@@ -1769,7 +1772,7 @@ function modernizeArbitraryValuesVariant(
 ): Variant | Variant[] {
   let result = [variant]
   let designSystem = options.designSystem
-  let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY]
+  let signatures = designSystem.storage[VARIANT_SIGNATURE_KEY].get(options.signatureOptions.rem)
 
   let iterator = walkVariants(variant)
   for (let [variant, parent] of iterator) {
@@ -2785,120 +2788,142 @@ export const VARIANT_SIGNATURE_KEY = Symbol()
 function createVariantSignatureCache(
   designSystem: DesignSystem,
 ): DesignSystem['storage'][typeof VARIANT_SIGNATURE_KEY] {
-  return new DefaultMap<string, string | symbol>((variant) => {
-    try {
-      // Ensure the prefix is added to the utility if it is not already present.
-      variant =
-        designSystem.theme.prefix && !variant.startsWith(designSystem.theme.prefix)
-          ? `${designSystem.theme.prefix}:${variant}`
-          : variant
-
-      // Use `@apply` to normalize the selector to `.x`
-      let ast: AstNode[] = [styleRule('.x', [atRule('@apply', `${variant}:flex`)])]
-      substituteAtApply(ast, designSystem)
-
-      // Canonicalize selectors to their minimal form
-      walk(ast, (node) => {
-        // At-rules
-        if (node.kind === 'at-rule' && node.params.includes(' ')) {
-          node.params = node.params.replaceAll(' ', '')
-        }
+  return new DefaultMap((rem: number | null) => {
+    return new DefaultMap<string, string | symbol>((variant) => {
+      try {
+        // Ensure the prefix is added to the utility if it is not already present.
+        variant =
+          designSystem.theme.prefix && !variant.startsWith(designSystem.theme.prefix)
+            ? `${designSystem.theme.prefix}:${variant}`
+            : variant
 
-        // Style rules
-        else if (node.kind === 'rule') {
-          let selectorAst = SelectorParser.parse(node.selector)
-          let changed = false
-          walk(selectorAst, (node) => {
-            // Assumption: when we have a list of selectors: `.foo, .bar` we
-            // want to mark this as changed because this will be re-printed as
-            // `.foo,.bar`.
-            //
-            // Similarly, when we receive a combinator like `.foo + .bar`, this
-            // will be printed as `.foo+.bar`.
-            //
-            // It could be that this was already optimal, but then this would be
-            // a no-op situation.
-            if (node.kind === 'list' || node.kind === 'combinator') {
-              changed = true
+        // Use `@apply` to normalize the selector to `.x`
+        let ast: AstNode[] = [styleRule('.x', [atRule('@apply', `${variant}:flex`)])]
+        substituteAtApply(ast, designSystem)
+
+    
```

---

### Incident Patch 15: `c9689a44` (2026-07-30)
**Commit Message**: Add @tailwindcss/turbopack loader

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Added
+
+- Add `@tailwindcss/turbopack` loader for Tailwind CSS v4
+
 ### Fixed
 
 - Ensure watch mode detects changes to symlinked `@source` files whose real paths aren't otherwise scanned ([#20356](https://github.com/tailwindlabs/tailwindcss/pull/20356))
```

**File**: `integrations/utils.ts` (modified, +1/-0)
```diff
@@ -612,6 +612,7 @@ function overwriteVersionsInPnpmWorkspace(content: string): string {
       workspace.overrides['@tailwindcss/upgrade>tailwindcss'] = resolveVersion(pkg)
       workspace.overrides['@tailwindcss/cli>tailwindcss'] = resolveVersion(pkg)
       workspace.overrides['@tailwindcss/postcss>tailwindcss'] = resolveVersion(pkg)
+      workspace.overrides['@tailwindcss/turbopack>tailwindcss'] = resolveVersion(pkg)
       workspace.overrides['@tailwindcss/vite>tailwindcss'] = resolveVersion(pkg)
       workspace.overrides['@tailwindcss/webpack>tailwindcss'] = resolveVersion(pkg)
     } else {
```

**File**: `packages/@tailwindcss-turbopack/README.md` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+<p align="center">
+  <a href="https://tailwindcss.com" target="_blank">
+    <picture>
+      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tailwindlabs/tailwindcss/HEAD/.github/logo-dark.svg">
+      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/tailwindlabs/tailwindcss/HEAD/.github/logo-light.svg">
+      <img alt="Tailwind CSS" src="https://raw.githubusercontent.com/tailwindlabs/tailwindcss/HEAD/.github/logo-light.svg" width="350" height="70" style="max-width: 100%;">
+    </picture>
+  </a>
+</p>
+
+<p align="center">
+  A utility-first CSS framework for rapidly building custom user interfaces.
+</p>
+
+<p align="center">
+    <a href="https://github.com/tailwindlabs/tailwindcss/actions"><img src="https://img.shields.io/github/actions/workflow/status/tailwindlabs/tailwindcss/ci.yml?branch=main" alt="Build Status"></a>
+    <a href="https://www.npmjs.com/package/tailwindcss"><img src="https://img.shields.io/npm/dt/tailwindcss.svg" alt="Total Downloads"></a>
+    <a href="https://github.com/tailwindlabs/tailwindcss/releases"><img src="https://img.shields.io/npm/v/tailwindcss.svg" alt="Latest Release"></a>
+    <a href="https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/tailwindcss.svg" alt="License"></a>
+</p>
+
+---
+
+## Documentation
+
+For full documentation, visit [tailwindcss.com](https://tailwindcss.com).
+
+## Community
+
+For help, discussion about best practices, or feature ideas:
+
+[Discuss Tailwind CSS on GitHub](https://github.com/tailwindlabs/tailwindcss/discussions)
+
+## Contributing
+
+If you're interested in contributing to Tailwind CSS, please read our [contributing docs](https://github.com/tailwindlabs/tailwindcss/blob/main/.github/CONTRIBUTING.md) **before submitting a pull request**.
+
+---
+
+## @tailwindcss/turbopack
+
+A Turbopack loader for Tailwind CSS v4.
+
+## Installation
+
+```sh
+npm install @tailwindcss/turbopack
+```
+
+### Usage
+
+```javascript
+// next.config.js
+module.exports = {
+  turbopack: {
+    rules: {
+      '*.css': {
+        loaders: ['@tailwindcss/turbopack'],
+        as: '*.css',
+      },
+    },
+  },
+}
+```
+
+Then create a CSS file that imports Tailwind:
+
+```css
+/* src/index.css */
+@import 'tailwindcss';
+```
+
+### Options
+
+#### `base`
+
+The base directory to scan for class candidates. Defaults to the current working directory.
+
+```javascript
+{
+  loader: '@tailwindcss/turbopack',
+  options: {
+    base: process.cwd(),
+  },
+}
+```
+
+#### `optimize`
+
+Whether to optimize and minify the output CSS. Defaults to `true` in production mode.
+
+```javascript
+{
+  loader: '@tailwindcss/turbopack',
+  options: {
+    optimize: true, // or { minify: true }
+  },
+}
+```
```

**File**: `packages/@tailwindcss-turbopack/package.json` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+{
+  "name": "@tailwindcss/turbopack",
+  "version": "4.3.3",
+  "description": "A Turbopack loader for Tailwind CSS v4.",
+  "license": "MIT",
+  "repository": {
+    "type": "git",
+    "url": "https://github.com/tailwindlabs/tailwindcss.git",
+    "directory": "packages/@tailwindcss-turbopack"
+  },
+  "bugs": "https://github.com/tailwindlabs/tailwindcss/issues",
+  "homepage": "https://tailwindcss.com",
+  "scripts": {
+    "build": "tsup-node",
+    "dev": "pnpm run build -- --watch"
+  },
+  "files": [
+    "dist/"
+  ],
+  "publishConfig": {
+    "provenance": true,
+    "access": "public"
+  },
+  "exports": {
+    ".": {
+      "types": "./dist/index.d.ts",
+      "import": "./dist/index.mjs",
+      "require": "./dist/index.js"
+    }
+  },
+  "main": "./dist/index.js",
+  "types": "./dist/index.d.ts",
+  "dependencies": {
+    "@alloc/quick-lru": "^5.2.0",
+    "@tailwindcss/node": "workspace:*",
+    "@tailwindcss/oxide": "workspace:*",
+    "tailwindcss": "workspace:*"
+  },
+  "devDependencies": {
+    "@types/node": "catalog:",
+    "webpack": "catalog:"
+  }
+}
```

**File**: `packages/@tailwindcss-turbopack/src/index.cts` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+import tailwindLoader from './index.ts'
+
+// CommonJS export for webpack loaders - must be the function directly
+// @ts-ignore
+export = tailwindLoader
```

**File**: `packages/@tailwindcss-turbopack/src/index.ts` (added, +287/-0)
```diff
@@ -0,0 +1,287 @@
+import QuickLRU from '@alloc/quick-lru'
+import {
+  compile,
+  env,
+  Features,
+  Instrumentation,
+  normalizePath,
+  optimize,
+  Polyfills,
+} from '@tailwindcss/node'
+import { clearRequireCache } from '@tailwindcss/node/require-cache'
+import { Scanner } from '@tailwindcss/oxide'
+import fs from 'node:fs'
+import path from 'node:path'
+import type { LoaderContext } from 'webpack'
+
+const DEBUG = env.DEBUG
+
+export interface LoaderOptions {
+  /**
+   * The base directory to scan for class candidates.
+   *
+   * Defaults to the current working directory.
+   */
+  base?: string
+
+  /**
+   * Optimize and minify the output CSS.
+   */
+  optimize?: boolean | { minify?: boolean }
+}
+
+interface CacheEntry {
+  mtimes: Map<string, number>
+  compiler: null | Awaited<ReturnType<typeof compile>>
+  scanner: null | Scanner
+  candidates: Set<string>
+  fullRebuildPaths: string[]
+}
+
+const cache = new QuickLRU<string, CacheEntry>({ maxSize: 50 })
+
+function getCacheKey(resourceId: string, opts: LoaderOptions): string {
+  return `${resourceId}:${opts.base ?? ''}:${JSON.stringify(opts.optimize)}`
+}
+
+function getContextFromCache(resourceId: string, opts: LoaderOptions): CacheEntry {
+  let key = getCacheKey(resourceId, opts)
+  if (cache.has(key)) return cache.get(key)!
+  let entry: CacheEntry = {
+    mtimes: new Map<string, number>(),
+    compiler: null,
+    scanner: null,
+    candidates: new Set<string>(),
+    fullRebuildPaths: [],
+  }
+  cache.set(key, entry)
+  return entry
+}
+
+export default async function tailwindLoader(
+  this: LoaderContext<LoaderOptions>,
+  source: string,
+): Promise<void> {
+  let callback = this.async()
+  let options = this.getOptions() ?? {}
+  let inputFile = this.resourcePath
+  let resourceId = this.resource
+  let base = options.base ?? process.cwd()
+  let shouldOptimize = options.optimize ?? process.env.NODE_ENV === 'production'
+  let isCSSModuleFile = inputFile.endsWith('.module.css')
+
+  using I = new Instrumentation()
+
+  DEBUG && I.start(`[@tailwindcss/webpack] ${path.relative(base, inputFile)}`)
+
+  // Bail out early if this is guaranteed to be a non-Tailwind CSS file.
+  {
+    DEBUG && I.start('Quick bail check')
+    let canBail = !/@(import|reference|theme|variant|config|plugin|apply|tailwind)\b/.test(source)
+    if (canBail) {
+      DEBUG && I.end('Quick bail check')
+      DEBUG && I.end(`[@tailwindcss/webpack] ${path.relative(base, inputFile)}`)
+      callback(null, source)
+      return
+    }
+    DEBUG && I.end('Quick bail check')
+  }
+
+  try {
+    let context = getContextFromCache(resourceId, options)
+    let inputBasePath = path.dirname(path.resolve(inputFile))
+
+    // Whether this is the first build or not
+    let isInitialBuild = context.compiler === null
+
+    async function createCompiler() {
+      DEBUG && I.start('Setup compiler')
+      if (context.fullRebuildPaths.length > 0 && !isInitialBuild) {
+        clearRequireCache(context.fullRebuildPaths)
+      }
+
+      context.fullRebuildPaths = []
+
+      DEBUG && I.start('Create compiler')
+      let compiler = await compile(source, {
+        from: inputFile,
+        base: inputBasePath,
+        shouldRewriteUrls: true,
+        onDependency: (depPath) => context.fullRebuildPaths.push(depPath),
+        // In CSS Module files, we have to disable the `@property` polyfill since these will
+        // emit global `*` rules which are considered to be non-pure and will cause builds
+        // to fail.
+        polyfills: isCSSModuleFile ? Polyfills.All ^ Polyfills.AtProperty : Polyfills.All,
+      })
+      DEBUG && I.end('Create compiler')
+
+      DEBUG && I.end('Setup compiler')
+      return compiler
+    }
+
+    // Setup the compiler if it doesn't exist yet
+    context.compiler ??= await createCompiler()
+
+    // Early exit if no Tailwind features are used
+    if (context.compiler.features === Features.None) {
+      DEBUG && I.end(`[@tailwindcss/webpack] ${path.relative(base, inputFile)}`)
+      callback(null, source)
+      return
+    }
+
+    let rebuildStrategy: 'full' | 'incremental' = 'incremental'
+
+    // Track file modification times to CSS files
+    DEBUG && I.start('Register full rebuild paths')
+    {
+      // Report dependencies for config files, plugins, etc.
+      for (let file of context.fullRebuildPaths) {
+        this.addDependency(path.resolve(file))
+      }
+
+      let files = [...context.fullRebuildPaths, inputFile]
+
+      for (let file of files) {
+        let changedTime: number | null = null
+        try {
+          changedTime = fs.statSync(file)?.mtimeMs ?? null
+        } catch {
+          // File might not exist
+        }
+
+        if (changedTime === null) {
+          if (file === inputFile) {
+            rebuildStrategy = 'full'
+          }
+          continue
+        }
+
+        let prevTime = context.mtimes.get(file)
+        if (prevTime === changedTime) continue
+
+        rebui
```

**File**: `packages/@tailwindcss-turbopack/tsconfig.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "extends": "../tsconfig.base.json",
+  "compilerOptions": {
+    "verbatimModuleSyntax": false,
+  },
+}
```

**File**: `packages/@tailwindcss-turbopack/tsup.config.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { defineConfig } from 'tsup'
+
+export default defineConfig([
+  {
+    format: ['esm'],
+    clean: true,
+    minify: true,
+    cjsInterop: true,
+    dts: true,
+    entry: ['src/index.ts'],
+  },
+  {
+    format: ['cjs'],
+    minify: true,
+    cjsInterop: true,
+    dts: true,
+    entry: ['src/index.cts'],
+  },
+])
```

#### Recent Merged Pull Requests:
- **PR #20513** (2026-09-25): Improve style invalidation performance of `group-*` and `peer-*` variants (@RobinMalfait)
- **PR #20512** (2026-09-25): Sort breakpoint variants with decimal values numerically (@kwy404)
- **PR #20508** (2026-09-25): Don't treat `\` as an escape inside CSS comments (@koreahghg)
- **PR #20507** (2026-09-25): fix: correct two comment typos (@Dextheking1)
- **PR #20505** (closed): fix: two comment typos (Succesfully, preceeded) (@haimingZZ)
- **PR #20502** (closed): docs: update resource directory (@phamhanhleanthat-gif)
- **PR #20466** (2026-09-08): Reject candidates with multiple modifiers (@cuishuang)
- **PR #20442** (closed): feat: add `self-hover` variant for direct pointer hover only (@seb-jean)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
