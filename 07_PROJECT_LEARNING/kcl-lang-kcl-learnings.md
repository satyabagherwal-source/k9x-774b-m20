> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kcl-lang-kcl-learnings.md`  
> **Source**: github ([https://github.com/kcl-lang/kcl](https://github.com/kcl-lang/kcl))  
> **Source Version**: `ee6cfba9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T04:19:36.238Z  
> **Learning ID**: `learn-github-kcl-lang-kcl`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kcl-lang/kcl

> **Canonical Artifact**: `07_PROJECT_LEARNING/kcl-lang-kcl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kcl-lang/kcl](https://github.com/kcl-lang/kcl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T04:19:36.231Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kcl-lang/kcl`
- **Description**: KCL Language Core and API
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2432 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `3rdparty/serde_yaml/src/libyaml/util.rs`
```
use std::marker::PhantomData;
use std::mem::{self, MaybeUninit};
use std::ops::Deref;
use std::ptr::{addr_of, NonNull};

pub(crate) struct Owned<T, Init = T> {
    ptr: NonNull<T>,
    marker: PhantomData<NonNull<Init>>,
}

impl<T> Owned<T> {
    pub fn new_uninit() -> Owned<MaybeUninit<T>, T> {
        // FIXME: use Box::new_uninit when stable
        let boxed = Box::new(MaybeUninit::<T>::uninit());
        Owned {
            ptr: unsafe { NonNull::new_unchecked(Box::into_raw(boxed)) },
            marker: PhantomData,
        }
    }

    pub unsafe fn assume_init(definitely_init: Owned<MaybeUninit<T>, T>) -> Owned<T> {
        let ptr = definitely_init.ptr;
        mem::forget(definitely_init);
        Owned {
            ptr: ptr.cast(),
            marker: PhantomData,
        }
    }
}

#[repr(transparent)]
pub(crate) struct InitPtr<T> {
    pub ptr: *mut T,
}

impl<T, Init> Deref for Owned<T, Init> {
    type Target = InitPtr<Init>;

    fn deref(&self) -> &Self::Target {
        unsafe { &*addr_of!(self.ptr).cast::<InitPtr<Init>>() }
    }
}

impl<T, Init> Drop for Owned<T, Init> {
    fn drop(&mut self) {
        let _ = unsafe { Box::from_raw(self.ptr.as_ptr()) };
    }
}

```

### Core Architecture Module: `crates/api/src/service/util.rs`
```
use crate::gpyrpc::ExecProgramArgs;

/// Transform the str with zero value into [`Option<String>`]
#[inline]
pub(crate) fn transform_str_para(para: &str) -> Option<String> {
    if para.is_empty() {
        None
    } else {
        Some(para.to_string())
    }
}

#[inline]
pub(crate) fn transform_exec_para(
    exec_args: &Option<ExecProgramArgs>,
    plugin_agent: u64,
) -> anyhow::Result<kcl_runner::ExecProgramArgs> {
    let mut args = match exec_args {
        Some(exec_args) => {
            let args_json = serde_json::to_string(exec_args)?;
            kcl_runner::ExecProgramArgs::from_json(args_json.as_str())
        }
        None => kcl_runner::ExecProgramArgs::default(),
    };
    args.plugin_agent = plugin_agent;
    Ok(args)
}

```

### Core Architecture Module: `crates/cmd/src/util.rs`
```
use anyhow::Result;
use clap::ArgMatches;
use std::collections::HashMap;

#[inline]
pub(crate) fn strings_from_matches(matches: &ArgMatches, key: &str) -> Option<Vec<String>> {
    matches.get_many::<String>(key).map(|files| {
        files
            .into_iter()
            .map(|v| v.to_string())
            .collect::<Vec<String>>()
    })
}

#[inline]
pub(crate) fn hashmaps_from_matches(
    matches: &ArgMatches,
    key: &str,
) -> Option<Result<HashMap<String, String>>> {
    matches.get_many::<String>(key).map(|files| {
        files
            .into_iter()
            .map(|s| {
                let split_values = s.split('=').collect::<Vec<&str>>();
                if split_values.len() == 2
                    && !split_values[0].trim().is_empty()
                    && !split_values[1].trim().is_empty()
                {
                    Ok((split_values[0].to_string(), split_values[1].to_string()))
                } else {
                    Err(anyhow::anyhow!("Invalid value for top level arguments"))
                }
            })
            .collect::<Result<HashMap<String, String>>>()
    })
}

#[inline]
pub(crate) fn bool_from_matches(matches: &ArgMatches, key: &str) -> Option<bool> {
    if matches.get_flag(key) {
        Some(true)
    } else {
        None
    }
}

#[inline]
pub(crate) fn u32_from_matches(matches: &ArgMatches, key: &str) -> Option<u32> {
    let occurrences = matches.get_count(key);
    if occurrences > 0 {
        Some(occurrences as u32)
    } else {
        None
    }
}

```

### Core Architecture Module: `crates/loader/src/util.rs`
```
use std::collections::HashMap;

use kcl_ast::ast;
use kcl_ast_pretty::{ASTNode, print_ast_node};
use kcl_sema::eval::str_literal_eval;

pub(crate) fn get_call_args_bool(
    call_expr: &ast::CallExpr,
    index: usize,
    key: Option<&str>,
) -> bool {
    let val = get_call_args_string(call_expr, index, key);
    val == "True" || val == "true"
}

pub(crate) fn get_call_args_strip_string(
    call_expr: &ast::CallExpr,
    index: usize,
    key: Option<&str>,
) -> String {
    let value = get_call_args_string(call_expr, index, key);
    match str_literal_eval(&value, false, false) {
        Some(value) => value,
        None => value,
    }
}

pub(crate) fn get_call_args_string(
    call_expr: &ast::CallExpr,
    index: usize,
    key: Option<&str>,
) -> String {
    let (args, kwargs) = arguments_to_string(&call_expr.args, &call_expr.keywords);
    if let Some(key) = key
        && let Some(val) = kwargs.get(key)
    {
        return val.to_string();
    }
    if index < args.len() {
        return args[index].to_string();
    }
    "".to_string()
}

/// Print call arguments to argument vector and keyword mapping.
pub fn arguments_to_string(
    args: &[ast::NodeRef<ast::Expr>],
    kwargs: &[ast::NodeRef<ast::Keyword>],
) -> (Vec<String>, HashMap<String, String>) {
    (
        args.iter()
            .map(|a| print_ast_node(ASTNode::Expr(a)))
            .collect(),
        kwargs
            .iter()
            .map(|a| {
                (
                    a.node.arg.node.get_name(),
                    a.node
                        .value
                        .as_ref()
                        .map(|v| print_ast_node(ASTNode::Expr(v)))
                        .unwrap_or_default(),
                )
            })
            .collect(),
    )
}

```

### Core Architecture Module: `crates/query/src/util.rs`
```
use anyhow::{Result, anyhow};

/// Get field package path and identifier name from the path.
/// (TODO: Needs to be a package related to the language specification
/// and move this function into it.)
///
/// split_field_path("pkg.to.path:field") -> ("pkg.to.path", "field")
pub(crate) fn split_field_path(path: &str) -> Result<(String, String)> {
    let err = Err(anyhow!("Invalid field path {:?}", path));
    let paths = path.splitn(2, ':').collect::<Vec<&str>>();
    let (pkgpath, field_path) = if paths.len() == 1 {
        ("".to_string(), paths[0].to_string())
    } else if paths.len() == 2 {
        (paths[0].to_string(), paths[1].to_string())
    } else {
        return err;
    };
    if field_path.is_empty() {
        err
    } else {
        Ok((pkgpath, field_path))
    }
}

/// Get the invalid spec error message.
#[inline]
pub(crate) fn invalid_spec_error(spec: &str) -> anyhow::Error {
    anyhow!(
        "Invalid spec format '{}', expected <field_path>=<filed_value>, <field_path>:<filed_value>, <field_path>+=<filed_value> or <field_path>-",
        spec
    )
}

/// Get the invalid symbol selector spec error message.
#[inline]
pub(crate) fn invalid_symbol_selector_spec_error(spec: &str) -> anyhow::Error {
    anyhow!(
        "Invalid spec format '{}', expected <pkgpath>:<field_path>",
        spec
    )
}

```

### Core Architecture Module: `crates/runtime/src/api/utils.rs`
```
//! Copyright The KCL Authors. All rights reserved.

use std::os::raw::c_char;

use crate::{Context, ValueRef, kcl_size_t};

/// New a mutable raw pointer.
/// Safety: The caller must ensure that `ctx` lives longer than the returned pointer
/// and that the pointer is properly deallocated by calling `free_mut_ptr`.
pub fn new_mut_ptr(ctx: &mut Context, x: ValueRef) -> *mut ValueRef {
    let ptr = Box::into_raw(Box::new(x));
    // Store the object pointer address to
    // drop it it after execution is complete
    ctx.objects.insert(ptr as usize);
    ptr
}

/// Free a mutable raw pointer.
/// # Safety
/// The caller must ensure `p` is a valid pointer obtained from `new_mut_ptr`.
pub unsafe fn free_mut_ptr<T>(p: *mut T) {
    if !p.is_null() {
        unsafe {
            drop(Box::from_raw(p));
        }
    }
}

/// Convert a const raw pointer to a immutable borrow.
/// # Safety
/// The caller must ensure that `p` is a valid pointer.
pub unsafe fn ptr_as_ref<'a, T>(p: *const T) -> &'a T {
    assert!(!p.is_null());
    unsafe { &*p }
}

/// Convert a mutable raw pointer to a mutable borrow.
/// # Safety
/// The caller must ensure that `p` is a valid pointer.
pub unsafe fn mut_ptr_as_ref<'a, T>(p: *mut T) -> &'a mut T {
    assert!(!p.is_null());

    unsafe { &mut *p }
}

/// Copy str to mutable pointer with length
///
/// Copies the byte contents of a Rust string to a C-compatible mutable char pointer,
/// and updates the provided size pointer with the actual string length (in bytes).
///
/// # Safety
/// The caller **must** ensure all of the following conditions are met:
/// 1. `p` is a **non-null, valid, writable pointer** to a contiguous block of memory.
/// 2. `size` is a **non-null, valid, writable pointer** to a `kcl_size_t` value.
/// 3. The memory block pointed to by `p` has a capacity of at least `*size` bytes (before the call).
/// 4. The memory referenced by `p` and `size` remains **valid and unmodified** for the entire duration of this function call.
/// 5. The memory block at `p` does **not overlap** with the memory of the input string `v` (violating this causes undefined behavior for `ptr::copy`).
pub unsafe fn copy_str_to(v: &str, p: *mut c_char, size: *mut kcl_size_t) {
    assert!(!p.is_null() || !size.is_null());

    let c_str_ptr = v.as_ptr() as *const c_char;
    let c_str_len = v.len() as i32;
    if c_str_len <= unsafe { *size } {
        unsafe { std::ptr::copy(c_str_ptr, p, c_str_len as usize) };
        unsafe { *size = c_str_len }
    }
}

/// Convert a C str pointer to a Rust &str.
///
/// # Safety
/// The caller must ensure all of the following conditions are met:
/// 1. `p` is a **non-null, valid pointer** to a null-terminated C string.
/// 2. The memory referenced by `p` remains **valid and unmodified** for the entire lifetime `'a`.
/// 3. The C string pointed to by `p` is encoded in **valid UTF-8** (otherwise this function will panic).
pub unsafe fn c2str<'a>(p: *const c_char) -> &'a str {
    assert!(!p.is_null());

    unsafe { std::ffi::CStr::from_ptr(p) }.to_str().unwrap() as _
}

/// Convert a C str pointer pointer to a Rust Vec<String>.
///
/// # Safety
/// The caller must ensure all of the following conditions are met:
/// 1. `ptr_array` is a **non-null, valid pointer** to an array of `*const c_char` (C string pointers).
/// 2. The array pointed to by `ptr_array` is **null-terminated** (the end of the array is marked by a `null` pointer).
/// 3. Each non-null `*const c_char` in the array points to a **valid, null-terminated C string** (UTF-8 or compatible).
/// 4. The memory referenced by `ptr_array` and all inner C string pointers remains **valid and unmodified** for the duration of this function call.
/// 5. The pointers in the array are properly **aligned** for `*const c_char` (which is always true for C-compatible pointers).
pub unsafe fn c2str_vec(ptr_array: *const *const c_char) -> Vec<String> {
    assert!(!ptr_array.is_null());

    let mut result = Vec::new();
    let mut index = 0;

    loop {
        let current_ptr = unsafe { *ptr_array.offset(index) };
        if current_ptr.is_null() {
            break;
        }
        let c_str = unsafe { std::ffi::CStr::from_ptr(current_ptr) };
        let rust_string = c_str.to_string_lossy().to_string();
        result.push(rust_string);
        index += 1;
    }

    result
}

pub fn assert_panic<F: FnOnce() + std::panic::UnwindSafe>(msg: &str, func: F) {
    match std::panic::catch_unwind(func) {
        Ok(_v) => {
            panic!("not panic, expect={msg}");
        }
        Err(e) => match e.downcast::<String>() {
            Ok(v) => {
                let got = v.to_string();
                assert!(got.contains(msg), "expect={msg}, got={got}");
            }
            Err(e) => match e.downcast::<&str>() {
                Ok(v) => {
                    let got = v.to_string();
                    assert!(got.contains(msg), "expect={msg}, got={got}");
                }
                _ => unreachable!(),
            },
        },
    };
}

```

### Core Architecture Module: `crates/runtime/src/file/utils.rs`
```
use std::{
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
};

pub(crate) fn copy_directory(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let new_src = entry.path();
        let new_dst = dst.join(entry.file_name());
        if file_type.is_dir() {
            copy_directory(&new_src, &new_dst)?;
        } else if file_type.is_file() {
            fs::copy(&new_src, &new_dst)?;
        }
    }
    Ok(())
}

/// Resolve `user_path` against the module root derived from
/// `module_root` and return the canonicalized absolute path. Relative paths
/// are joined onto the canonical root; absolute paths are only accepted when
/// they lie inside the root (compared after canonicalization, so symlinks
/// pointing outside the root are rejected as well). Paths that would escape
/// — via `..` or by targeting a location outside the root — come back with
/// an error. If `module_root` itself cannot be canonicalized, the path is
/// returned unchanged with `Ok(())` so callers can still surface a regular
/// filesystem error (instead of a scope error) and avoid masking real bugs.
///
/// Set the env var `KCL_FILE_SCOPE=off` (or the literal value `"0"`,
/// `"false"`, `"no"`) to bypass the scope check entirely — useful for
/// ad-hoc scripts and existing tests that intentionally reach outside
/// their package directory. See kcl-lang/kcl#1886 for context.
pub(crate) fn resolve_scoped_path<P: AsRef<Path>>(
    module_root: P,
    user_path: &str,
) -> (PathBuf, Result<(), String>) {
    let module_root = module_root.as_ref();

    // Allow opting out of the scope check.
    if let Some(value) = std::env::var_os("KCL_FILE_SCOPE") {
        let value = value.to_string_lossy().to_ascii_lowercase();
        if matches!(value.as_str(), "off" | "0" | "false" | "no") {
            return (PathBuf::from(user_path), Ok(()));
        }
    }

    // Reject obvious traversal attempts up-front so we don't depend on
    // the target existing (the caller's `fs::*` call will surface that error
    // itself). This check is purely syntactic and deliberately runs before
    // any filesystem access: `canonicalize` on the module root can fail
    // transiently (observed on the Windows CI runners for freshly created
    // directories), and a traversal attempt must not slip through just
    // because the root could not be canonicalized. It is also load-bearing
    // on Windows, where a `..` inside an otherwise verbatim path is treated
    // literally by the filesystem.
    if path_has_parent_ref(Path::new(user_path)) {
        return (
            PathBuf::from(user_path),
            Err(format!(
                "path '{}' escapes module root '{}'",
                user_path,
                module_root.display()
            )),
        );
    }

    let canonical_root = match fs::canonicalize(module_root) {
        Ok(p) => p,
        Err(_) => return (PathBuf::from(user_path), Ok(())),
    };

    let candidate = Path::new(user_path);
    let candidate = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        canonical_root.join(candidate)
    };

    // Absolute paths (and relative paths routed through a symlink that
    // points outside the root) must not escape either. Compare
    // canonicalized forms so symlink components are resolved before the
    // check; paths that don't exist yet are canonicalized through their
    // nearest existing ancestor so writes to new files still get checked.
    if !path_within_root(&candidate, &canonical_root) {
        return (
            candidate,
            Err(format!(
                "path '{}' escapes module root '{}'",
                user_path,
                canonical_root.display()
            )),
        );
    }

    (candidate, Ok(()))
}

/// Canonicalize `p`, falling back to the nearest existing ancestor for paths
/// that do not exist yet (writes to new files), re-appending the missing
/// trailing components. Returns `None` only when no ancestor can be
/// canonicalized at all (e.g. a path on a drive that doesn't exist).
fn canonicalize_existing(p: &Path) -> Option<PathBuf> {
    let mut missing = Vec::new();
    let mut cur = p;
    loop {
        if let Ok(c) = fs::canonicalize(cur) {
            let mut out = c;
            for comp in missing.iter().rev() {
                out.push(comp);
            }
            return Some(out);
        }
        missing.push(cur.file_name()?);
        cur = cur.parent()?;
    }
}

fn path_within_root(candidate: &Path, canonical_root: &Path) -> bool {
    match canonicalize_existing(candidate) {
        Some(cc) => cc.starts_with(canonical_root),
        // Nothing exists up to the filesystem root (e.g. a nonexistent
        // drive): the path cannot be inside the module root.
        None => false,
    }
}

fn path_has_parent_ref(p: &Path) -> bool {
    p.components().any(|c| matches!(c, Component::ParentDir))
}

/// True if the scope check is currently enabled (i.e. `KCL_FILE_SCOPE` is
/// unset or set to something other than an opt-out value). Mirrors the
/// opt-out logic in [`resolve_scoped_path`] so callers can short-circuit
/// before doing the `canonicalize` work.
pub(crate) fn scope_enabled() -> bool {
    match std::env::var_os("KCL_FILE_SCOPE") {
        None => true,
        Some(value) => {
            let value = value.to_string_lossy().to_ascii_lowercase();
            !matches!(value.as_str(), "off" | "0" | "false" | "no")
        }
    }
}

/// Split a `filepath[:ref]` argument into its path and (optional) git
/// ref parts.
///
/// The supported grammar is `path:ref` where:
/// * `path` is any string accepted by `fs::read_to_string`, including
///   absolute paths and POSIX/Windows paths,
/// * `ref` is a git ref (branch, tag, commit SHA, or `HEAD`) — i.e. it
///   only contains `[A-Za-z0-9_./-]` characters and never begins with
///   `.`, `/`, or contains a `..` segment.
///
/// Windows drive letters (`C:foo`) are skipped when searching for the
/// separator so `C:\path\to\file.txt` is left untouched.
pub(crate) fn split_path_ref(input: &str) -> (&str, Option<&str>) {
    let bytes = input.as_bytes();

    // Skip a leading Windows drive letter ("C:" followed by a path
    // separator or end of string) so we don't split on it. Real drive
    // letters are always followed by `\` or `/`, never by an
    // alphanumeric — which keeps `x:HEAD` from being misread.
    let scan_start = if bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
    {
        2
    } else {
        0
    };

    let Some(rel_idx) = input[scan_start..].rfind(':') else {
        return (input, None);
    };
    let sep_idx = scan_start + rel_idx;
    let rest = &input[sep_idx + 1..];

    // Empty ref ("path:") is treated as no ref — fall back to fs::read.
    if rest.is_empty() {
        return (input, None);
    }

    let first = rest.as_bytes()[0];
    if first == b'.' || first == b'/' || first == b'\\' {
        return (input, None);
    }

    // A ref is made of safe, ref-name characters only.
    if !rest
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-' | '/'))
    {
        return (input, None);
    }

    if rest.contains("..") {
        return (input, None);
    }

    (&input[..sep_idx], Some(rest))
}

/// Walk up from `start` looking for a directory that contains `.git`.
/// Returns the absolute path to the git working tree root, or `None`
/// if no git repository is found.
pub(crate) fn find_git_root(start: &Path) -> Option<PathBuf> {
    let mut current = Some(start.to_path_buf());
    while let Some(dir) = current {
        if dir.join(".git").exists() {
            return Some(dir);
        }
        current = dir.parent().map(Path::to_path_buf);
    }
    None
}

/// Express the absolute `abs` path relative to `git_root`. Errors out if
/// the path escapes the repo. `original` is the user-supplied path, used
/// for error messages.
pub(crate) fn path_relative_to_git_root(
    abs: &Path,
    git_root: &Path,
    original: &str,
) -> Result<String, String> {
    let rel = abs
        .strip_prefix(git_root)
        .map_err(|_| format!("file '{}' is not inside the git repository", original))?;
    // `git show <ref>:<path>` wants forward slashes even on Windows.
    Ok(rel.to_string_lossy().replace('\\', "/"))
}

/// Run `git show <ref>:<repo_rel_path>` inside the git working tree
/// `repo` and return its stdout as a `String`. Running with the repo as
/// the child cwd keeps the lookup anchored to the repository discovered
/// by `find_git_root` instead of the process-wide current working
/// directory (which tests and embedders may relocate). Any failure (git
/// missing, bad ref, bad path, non-zero exit) is reported as an error
/// string.
pub(crate) fn git_show(repo: &Path, repo_rel_path: &str, ref_name: &str) -> Result<String, String> {
    let spec = format!("{}:{}", ref_name, repo_rel_path);
    let output = Command::new("git")
        .args(["show", &spec])
        .current_dir(repo)
        .output()
        .map_err(|e| format!("failed to invoke git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let trimmed = stderr.trim();
        return Err(if trimmed.is_empty() {
            format!("git show '{}' exited with status {}", spec, output.status)
        } else {
            format!("git show '{}' failed: {}", spec, trimmed)
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Read the contents of the already scope-resolved `filepath` pinned to
/// the git revision `ref_name`, by walking up from the resolved path to
/// the enclosing git repository and running `git s
```

### Core Architecture Module: `crates/sema/src/core/global_state.rs`
```
use std::collections::HashSet;

use kcl_error::Position;
use kcl_primitives::{IndexMap, IndexSet};

use super::{
    package::{ModuleInfo, PackageDB},
    scope::{ScopeData, ScopeKind, ScopeRef},
    semantic_information::{CachedLocation, CachedRange, FileSemanticInfo, SemanticDB},
    symbol::{SymbolData, SymbolKind, SymbolRef},
};

/// GlobalState is used to store semantic information of KCL source code
#[derive(Default, Debug, Clone)]
pub struct GlobalState {
    // store all allocated symbols
    symbols: SymbolData,
    // store all allocated scopes
    scopes: ScopeData,
    // store package information for name mapping
    packages: PackageDB,
    // store semantic information after analysis
    pub(crate) sema_db: SemanticDB,
    // new and invalidate(changed and affected by changed) pkg from CachedScope::update()
    pub new_or_invalidate_pkgs: HashSet<String>,

    pub ctx: GlobalStateContext,
}

#[derive(Default, Debug, Clone)]
pub struct GlobalStateContext {
    pub has_init_builtin: bool,
}

impl GlobalState {
    pub fn get_symbols(&self) -> &SymbolData {
        &self.symbols
    }

    pub fn get_symbols_mut(&mut self) -> &mut SymbolData {
        &mut self.symbols
    }

    pub fn get_scopes(&self) -> &ScopeData {
        &self.scopes
    }

    pub fn get_scopes_mut(&mut self) -> &mut ScopeData {
        &mut self.scopes
    }

    pub fn get_packages(&self) -> &PackageDB {
        &self.packages
    }

    pub fn get_packages_mut(&mut self) -> &mut PackageDB {
        &mut self.packages
    }

    pub fn get_sema_db(&self) -> &SemanticDB {
        &self.sema_db
    }

    pub fn get_sema_db_mut(&mut self) -> &mut SemanticDB {
        &mut self.sema_db
    }
}

impl GlobalState {
    /// look up symbol by name within specific scope
    ///
    /// # Parameters
    ///
    ///
    /// `name`: [&str]
    ///     The name of symbol
    ///
    /// `scope_ref`: [ScopeRef]
    ///     the reference of scope which was allocated by [ScopeData]
    ///
    /// `module_info`: [Option<&ModuleInfo>]
    ///     the module import information
    /// `local`: [bool]
    ///     look up in current scope
    ///
    /// # Returns
    ///
    /// result: [Option<SymbolRef>]
    ///     the matched symbol
    pub fn look_up_symbol(
        &self,
        name: &str,
        scope_ref: ScopeRef,
        module_info: Option<&ModuleInfo>,
        local: bool,
        get_def_from_owner: bool,
    ) -> Option<SymbolRef> {
        let scope = self.scopes.get_scope(&scope_ref)?;
        match scope.look_up_def(
            name,
            &self.scopes,
            &self.symbols,
            module_info,
            local,
            get_def_from_owner,
        ) {
            None => self
                .symbols
                .symbols_info
                .global_builtin_symbols
                .get(name)
                .cloned(),
            some => some,
        }
    }

    /// look up scope by specific position
    ///
    /// # Parameters
    ///
    /// `pos`: [&Position]
    ///     The pos within the scope
    ///
    ///
    /// # Returns
    ///
    /// result: [Option<ScopeRef>]
    ///     the matched scope
    pub fn look_up_scope(&self, pos: &Position) -> Option<ScopeRef> {
        let scopes = &self.scopes;
        for root_ref in scopes.root_map.values() {
            if let Some(root) = scopes.get_scope(root_ref)
                && root.contains_pos(pos)
            {
                if let Some(inner_ref) = self.look_up_into_scope(*root_ref, pos) {
                    return Some(inner_ref);
                } else {
                    return Some(*root_ref);
                }
            }
        }
        None
    }

    fn look_up_closest_sub_scope(&self, parent: ScopeRef, pos: &Position) -> Option<ScopeRef> {
        let file_sema_info = self.sema_db.file_sema_map.get(&pos.filename)?;
        let loc = CachedLocation {
            line: pos.line,
            column: pos.column.unwrap_or(0),
        };
        let children = match parent.kind {
            ScopeKind::Local => &self.scopes.locals.get(parent.id)?.children,
            ScopeKind::Root => self
                .scopes
                .roots
                .get(parent.id)?
                .children
                .get(&pos.filename)?,
        };

        match children.binary_search_by(|scope_ref| {
            file_sema_info
                .local_scope_locs
                .get(scope_ref)
                .unwrap()
                .start
                .cmp(&loc)
        }) {
            Ok(symbol_index) => Some(children[symbol_index]),
            Err(symbol_index) => {
                if symbol_index > 0 {
                    Some(children[symbol_index - 1])
                } else {
                    None
                }
            }
        }
    }

    /// get all definition symbols within specific scope and parent scope
    ///
    /// # Parameters
    ///
    /// `scope`: [ScopeRef]
    ///     the reference of scope which was allocated by [ScopeData]
    ///
    ///
    /// # Returns
    ///
    /// result: [Option<Vec<SymbolRef>>]
    ///      all definition symbols in the scope
    pub fn get_all_defs_in_scope(
        &self,
        scope_ref: ScopeRef,
        pos: &Position,
    ) -> Option<Vec<SymbolRef>> {
        let scopes = &self.scopes;
        let scope = scopes.get_scope(&scope_ref)?;
        let mut maybe_in_key = false;
        let get_def_from_owner = match scope_ref.kind {
            ScopeKind::Local => match scopes.try_get_local_scope(&scope_ref) {
                Some(local) => match local.kind {
                    super::scope::LocalSymbolScopeKind::Config => {
                        maybe_in_key = scopes.get_config_scope_ctx(scope_ref)?.maybe_in_key(pos);
                        maybe_in_key
                    }
                    _ => true,
                },
                None => true,
            },
            ScopeKind::Root => true,
        };

        let all_defs: Vec<SymbolRef> = scope
            .get_all_defs(
                scopes,
                &self.symbols,
                self.packages.get_module_info(scope.get_filename()),
                maybe_in_key,
                get_def_from_owner,
            )
            .values()
            .cloned()
            .collect();
        Some(all_defs)
    }

    /// get all definition symbols within specific scope
    ///
    /// # Parameters
    ///
    /// `scope`: [ScopeRef]
    ///     the reference of scope which was allocated by [ScopeData]
    ///
    ///
    /// # Returns
    ///
    /// result: [Option<Vec<SymbolRef>>]
    ///      all definition symbols in the scope
    pub fn get_defs_within_scope(
        &self,
        scope_ref: ScopeRef,
        pos: &Position,
    ) -> Option<Vec<SymbolRef>> {
        let scopes = &self.scopes;
        let mut maybe_in_key = false;
        let get_def_from_owner = match scope_ref.kind {
            ScopeKind::Local => match scopes.try_get_local_scope(&scope_ref) {
                Some(local) => match local.kind {
                    super::scope::LocalSymbolScopeKind::Config => {
                        maybe_in_key = scopes.get_config_scope_ctx(scope_ref)?.maybe_in_key(pos);
                        maybe_in_key
                    }
                    _ => true,
                },
                None => true,
            },
            ScopeKind::Root => true,
        };

        let scope = scopes.get_scope(&scope_ref)?;
        let all_defs: Vec<SymbolRef> = scope
            .get_defs_within_scope(
                scopes,
                &self.symbols,
                self.packages.get_module_info(scope.get_filename()),
                maybe_in_key,
                get_def_from_owner,
            )
            .values()
            .cloned()
            .collect();
        Some(all_defs)
    }

    /// look up closest symbol by specific position, which means  
    /// the specified position is located after the starting position of the returned symbol
    /// and before the starting position of the next symbol
    ///
    /// # Parameters
    ///
    /// `pos`: [&Position]
    ///     The target pos
    ///
    ///
    /// # Returns
    ///
    /// result: [Option<SymbolRef>]
    ///     the closest symbol to the target pos
    pub fn look_up_closest_symbol(&self, pos: &Position) -> Option<SymbolRef> {
        let file_sema_info = self.sema_db.file_sema_map.get(&pos.filename)?;
        let candidate = file_sema_info.look_up_closest_symbol(&CachedLocation {
            line: pos.line,
            column: pos.column.unwrap_or(0),
        });
        match self.look_up_scope(pos) {
            Some(parent_scope_ref) => {
                let candidate_symbol = self.symbols.get_symbol(candidate?)?;
                let (start, _) = candidate_symbol.get_range();
                let parent_scope = self.scopes.get_scope(&parent_scope_ref)?;
                if parent_scope.contains_pos(&start) {
                    let barrier_scope = self.look_up_closest_sub_scope(parent_scope_ref, pos);
                    match barrier_scope {
                        Some(barrier_scope) => {
                            let barrier_scope = self.scopes.locals.get(barrier_scope.id)?;
                            // there is no local scope between the candidate and the specified position
                            // the candidate is the answer
                            if barrier_scope.end.less(&candidate_symbol.get_range().0) {
                                candidate
                            }
                            // otherwise, it indicates that the found symbol is shadowed by the local scope.
                            // we just skip the scope and directly look up its start pos
                            else {
                                file_sema_info.look_up_closest_symbol(&CachedLocation {
                                    line: barrier_scope.start.line,
          
```

### Core Architecture Module: `crates/sema/src/core/mod.rs`
```
pub mod global_state;
pub mod package;
pub mod scope;
pub mod semantic_information;
pub mod symbol;

```

### Core Architecture Module: `crates/sema/src/core/package.rs`
```
use std::collections::HashSet;

use kcl_primitives::{IndexMap, IndexSet};

#[derive(Default, Debug, Clone)]
pub struct PackageDB {
    pub(crate) package_info: IndexMap<String, PackageInfo>,
    pub(crate) module_info: IndexMap<String, ModuleInfo>,
}

impl PackageDB {
    pub fn add_package(&mut self, info: PackageInfo) {
        self.package_info
            .insert(info.fully_qualified_name.clone(), info);
    }

    pub fn remove_package_info(&mut self, name: &str) {
        self.package_info.swap_remove(name);
    }

    pub fn get_package_info(&self, name: &str) -> Option<&PackageInfo> {
        self.package_info.get(name)
    }

    pub fn get_package_info_mut(&mut self, name: &str) -> Option<&mut PackageInfo> {
        self.package_info.get_mut(name)
    }

    pub fn add_module_info(&mut self, info: ModuleInfo) {
        self.module_info.insert(info.filename.clone(), info);
    }

    pub fn remove_module_info(&mut self, name: &str) {
        self.module_info.swap_remove(name);
    }

    pub fn get_module_info_mut(&mut self, name: &str) -> Option<&mut ModuleInfo> {
        self.module_info.get_mut(name)
    }

    pub fn get_module_info(&self, name: &str) -> Option<&ModuleInfo> {
        self.module_info.get(name)
    }

    pub fn clear_cache(&mut self, invalidate_pkgs: &HashSet<String>) {
        for invalidate_pkg in invalidate_pkgs {
            self.package_info.swap_remove(invalidate_pkg);
        }
    }
}
#[derive(Debug, Clone)]
pub struct PackageInfo {
    pub(crate) fully_qualified_name: String,
    pub(crate) pkg_filepath: String,
    pub(crate) kfile_paths: IndexSet<String>,
    pub(crate) is_system: bool,
}

impl PackageInfo {
    pub fn new(fully_qualified_name: String, pkg_filepath: String, is_system: bool) -> Self {
        Self {
            fully_qualified_name,
            pkg_filepath,
            kfile_paths: IndexSet::default(),
            is_system,
        }
    }

    pub fn get_kfile_paths(&self) -> &IndexSet<String> {
        &self.kfile_paths
    }

    pub fn get_pkg_filepath(&self) -> &String {
        &self.pkg_filepath
    }

    pub fn is_system(&self) -> bool {
        self.is_system
    }
}
#[allow(unused)]
#[derive(Debug, Clone)]
pub struct ImportInfo {
    pub(crate) unqualified_name: String,
    pub(crate) fully_qualified_name: String,
}

impl ImportInfo {
    pub fn new(unqualified_name: String, fully_qualified_name: String) -> Self {
        Self {
            unqualified_name,
            fully_qualified_name,
        }
    }

    pub fn get_fully_qualified_name(&self) -> String {
        self.fully_qualified_name.clone()
    }
}
#[allow(unused)]
#[derive(Debug, Clone)]
pub struct ModuleInfo {
    pub(crate) filename: String,
    pub(crate) pkgpath: String,
    pub(crate) imports: IndexMap<String, ImportInfo>,
}

impl ModuleInfo {
    pub fn new(filename: String, pkgpath: String) -> Self {
        Self {
            filename,
            pkgpath,
            imports: IndexMap::default(),
        }
    }

    pub fn add_import_info(&mut self, info: ImportInfo) {
        self.imports.insert(info.unqualified_name.clone(), info);
    }

    pub fn remove_import_info(&mut self, name: &str) {
        self.imports.swap_remove(name);
    }

    pub fn get_import_info(&self, name: &str) -> Option<&ImportInfo> {
        self.imports.get(name)
    }

    pub fn get_imports(&self) -> IndexMap<String, ImportInfo> {
        self.imports.clone()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2212** (2026-10-07): **Regression (0.12.9+): config-literal key silently shadows enclosing schema attribute, positionally**
  *Symptoms*: ## Bug  In **0.12.9 and later** (including 0.13.0), a key inside a config literal shadows an enclosing schema attribute of the same name. A reference to that attribute from a sibling key then resolves to the literal's key, yields `Undefined`, and — if the target field is optional — is **silently dropped from the output**. No error, no warning.  Correct up to and including **0.12.8**.  ### Reproduce  ```kcl schema Cfg:     super_users: [str] = ["alice", "bob"]  schema Outer:     config: Cfg     res: {str:any} = {         config = {"num.threads" = "8"}         authorization = {superUsers = config.super_users}     }  out = Outer {config = Cfg {}}.res ```  ``` kcl run bug.k ```  | version | `out.authorization` | |---------|---------------------| | 0.12.1  | `{superUsers: [alice, bob]}` | | 0.13.0  | `{}` |  Removing the `config = {...}` line makes 0.13.0 resolve correctly, which isolates the cause to the name collision.  ### The shadowing is positional  Placing the same reference both before and after the colliding key — only the one *after* it breaks:  ```kcl schema Outer:     config: Cfg     before: {str:any} = {         authorization = {superUsers = config.super_users}         config = {"num.threads" = "8"}     }     after: {str:any} = {         config = {"num.threads" = "8"}         authorization = {superUsers = config.super_users}     } ```  | reference position | 0.12.1 | 0.13.0 | |---|---|---| | before `config = {...}` | `{superUsers: [alice, bob]}` | `{superUsers: [alice,

- **Issue #2130** (2026-08-24): **Evaluator regression (0.12.x): sibling-key reads inside a dict literal resolve to Undefined when the dict also contains a lambda-call + merge key**
  *Symptoms*: ## Evaluator regression: sibling-key reads inside a dict literal resolve to Undefined when the dict also contains a lambda-call + merge key  ### Summary  In KCL 0.12.x, evaluating certain expressions inside a dict literal silently (or loudly) resolves to `Undefined` even though the referenced variable is bound. The trigger pattern is a dict literal whose **one key is a lambda call followed by `|` and an override dict**, and whose **sibling key reads an attribute from the surrounding scope** — most commonly `config.X` where `config` is a schema instance.  This is a regression: the same code renders correctly under KCL 0.11.x.  The konfig project (kcl-lang/konfig#36) hit this and had to ship a multi-file workaround; reporting here so it can be fixed at the evaluator.  ### Minimal reproducer (kcl 0.12.8)  ```kcl schema Server:     name: str = "x"     workloadType: str = "Deployment"  MetaBuilder = lambda c -> {str:} {     {         name: c?.name or "default"         labels: c?.labels  # bare optional access, no fallback     } }  config_dict = {     name = "x"     workloadType = "Deployment" }  my_dict = {     metadata = MetaBuilder(config_dict) | {name = "override"}     spec = {         # reading config_dict.workloadType silently returns Undefined         selector = config_dict?.services or config_dict[config_dict.workloadType]     } }  print("spec.selector:", my_dict.spec.selector) ```  Observed (kcl 0.12.8):  ``` spec.selector: Undefined ```  Expected (kcl 0.11.x):  ``` spec.s

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

### Incident Patch 1: `ee6cfba9` (2026-10-19)
**Commit Message**: fix(runner): install the panic hook once instead of swapping it per run (#2224)

`FastRunner::run` replaced the process-wide panic hook for each evaluation
and restored the previous one afterwards. When evaluations run concurrently
in one process, one run can restore the previous hook while another is
still evaluating. A failing `assert` in the other run then reaches the
restored hook, `KCL_RUNTIME_PANIC_RECORD` is never written, and the error
carries its location with an empty message. The interleaved restores can
also leave a run's hook installed for good, after which the host's own hook
never sees another panic. `libkcl_run`, `libkcl_main` and the JSON-RPC
server swapped the hook the same way.

Install one hook per process, chained to the hook it replaces. It records
every panic into the thread-local record and prints it through the previous
hook only on threads outside `catch_unwind_silent`. Silencing is therefore
per thread: panics outside KCL calls, such as on `kcl server` worker threads
or while a wasm32 call parses its input, reach the previous hook instead of
being swallowed. The runner, the three entry points, the C API panic test
and the test and benchmark helpers that w

**File**: `crates/api/src/capi_test.rs` (modified, +1/-5)
```diff
@@ -900,10 +900,7 @@ where
 {
     let _test_lock = TEST_MUTEX.lock().unwrap_or_else(|p| p.into_inner());
     let serv = unsafe { kcl_service_new(0) };
-    let prev_hook = std::panic::take_hook();
-    // disable print panic info
-    std::panic::set_hook(Box::new(|_info| {}));
-    let result = std::panic::catch_unwind(|| {
+    let result = kcl_runner::runner::catch_unwind_silent(|| {
         let input_path = Path::new(TEST_DATA_PATH).join(input);
         let input = fs::read_to_string(&input_path)
             .unwrap_or_else(|_| panic!("Something went wrong reading {}", input_path.display()));
@@ -912,7 +909,6 @@ where
         let call = CString::new(svc_name).unwrap();
         unsafe { kcl_service_call(serv, call.as_ptr(), args.as_ptr(), args_vec.len()) }
     });
-    std::panic::set_hook(prev_hook);
     match result {
         Ok(result_ptr) => {
             let result = unsafe { CStr::from_ptr(result_ptr) };
```

**File**: `crates/api/src/service/jsonrpc.rs` (modified, +2/-6)
```diff
@@ -22,12 +22,8 @@ pub async fn start_stdio_server() -> Result<(), anyhow::Error> {
 
 macro_rules! catch {
     ($serv:expr, $args:expr, $serv_name:ident) => {{
-        let prev_hook = std::panic::take_hook();
-
-        // disable print panic info
-        std::panic::set_hook(Box::new(|_info| {}));
-        let result = std::panic::catch_unwind(|| to_json_result(&$serv.$serv_name(&$args)));
-        std::panic::set_hook(prev_hook);
+        let result =
+            kcl_runner::runner::catch_unwind_silent(|| to_json_result(&$serv.$serv_name(&$args)));
         match result {
             Ok(result) => result,
             Err(panic_err) => {
```

**File**: `crates/lib/src/lib.rs` (modified, +3/-13)
```diff
@@ -10,6 +10,7 @@ mod capi;
 pub use capi::*;
 use kcl_parser::ParseSessionRef;
 use kcl_runner::exec_program;
+use kcl_runner::runner::catch_unwind_silent;
 use kcl_runtime::PanicInfo;
 
 /// KCL CLI run function CAPI.
@@ -20,13 +21,7 @@ pub unsafe extern "C-unwind" fn libkcl_run(
     args: *const c_char,
     plugin_agent: *const c_char,
 ) -> *const c_char {
-    let prev_hook = std::panic::take_hook();
-
-    // disable print panic info
-    std::panic::set_hook(Box::new(|_info| {}));
-    let libkcl_run_unsafe_result =
-        std::panic::catch_unwind(|| libkcl_run_unsafe(args, plugin_agent));
-    std::panic::set_hook(prev_hook);
+    let libkcl_run_unsafe_result = catch_unwind_silent(|| libkcl_run_unsafe(args, plugin_agent));
 
     match libkcl_run_unsafe_result {
         Ok(result) => match result {
@@ -71,11 +66,7 @@ pub unsafe extern "C-unwind" fn libkcl_main(
     argc: c_int,
     argv: *const *const c_char,
 ) -> *mut ExitCode {
-    let prev_hook = std::panic::take_hook();
-
-    // disable print panic info
-    std::panic::set_hook(Box::new(|_info| {}));
-    let libkcl_main_result = std::panic::catch_unwind(|| {
+    let libkcl_main_result = catch_unwind_silent(|| {
         let args: Vec<&str> = unsafe {
             std::slice::from_raw_parts(argv, argc as usize)
                 .iter()
@@ -84,7 +75,6 @@ pub unsafe extern "C-unwind" fn libkcl_main(
         };
         kcl_cmd::main(args.as_slice())
     });
-    std::panic::set_hook(prev_hook);
 
     match libkcl_main_result {
         Ok(result) => match result {
```

**File**: `crates/runner/benches/bench_runner.rs` (modified, +5/-6)
```diff
@@ -6,23 +6,22 @@ use criterion::{Criterion, criterion_group, criterion_main};
 use walkdir::WalkDir;
 
 use kcl_parser::{ParseSession, load_program};
-use kcl_runner::{execute, runner::ExecProgramArgs};
+use kcl_runner::{
+    execute,
+    runner::{ExecProgramArgs, catch_unwind_silent},
+};
 
 const EXEC_DATA_PATH: &str = "./src/exec_data/";
 
 pub fn criterion_benchmark(c: &mut Criterion) {
     c.bench_function("refactor kcl-runner", |b| {
         b.iter(|| {
-            let prev_hook = std::panic::take_hook();
-            // disable print panic info
-            std::panic::set_hook(Box::new(|_| {}));
-            let result = std::panic::catch_unwind(|| {
+            let result = catch_unwind_silent(|| {
                 for file in get_files(EXEC_DATA_PATH, false, true, ".k") {
                     exec(&file).unwrap();
                 }
             });
             assert!(result.is_ok());
-            std::panic::set_hook(prev_hook);
         })
     });
 }
```

**File**: `crates/runner/src/runner.rs` (modified, +47/-46)
```diff
@@ -1,7 +1,10 @@
 use anyhow::{Result, anyhow};
 use kcl_evaluator::Evaluator;
 use std::collections::{HashMap, HashSet};
-use std::{cell::RefCell, rc::Rc};
+use std::{
+    cell::{Cell, RefCell},
+    rc::Rc,
+};
 
 use kcl_ast::ast;
 use kcl_config::{
@@ -12,7 +15,6 @@ use kcl_error::{Diagnostic, Handler, RenderedError};
 #[cfg(not(target_arch = "wasm32"))]
 use kcl_runtime::kcl_plugin_init;
 use kcl_runtime::{Context, PanicInfo, RuntimePanicRecord};
-#[cfg(target_arch = "wasm32")]
 use once_cell::sync::Lazy;
 use serde::{Deserialize, Serialize};
 use std::os::raw::c_char;
@@ -301,14 +303,18 @@ pub trait ProgramRunner {
 }
 
 thread_local! {
-    pub static KCL_RUNTIME_PANIC_RECORD: RefCell<RuntimePanicRecord> = RefCell::new(RuntimePanicRecord::default())
+    pub static KCL_RUNTIME_PANIC_RECORD: RefCell<RuntimePanicRecord> = RefCell::new(RuntimePanicRecord::default());
+    static RECORDING_PANICS: Cell<bool> = const { Cell::new(false) };
 }
 
-#[cfg(target_arch = "wasm32")]
 static ONCE_PANIC_HOOK: Lazy<()> = Lazy::new(|| {
-    std::panic::set_hook(Box::new(|info: &std::panic::PanicHookInfo| {
-        KCL_RUNTIME_PANIC_RECORD.with(|record| {
-            let mut record = record.borrow_mut();
+    let prev_hook = std::panic::take_hook();
+    std::panic::set_hook(Box::new(move |info: &std::panic::PanicHookInfo| {
+        // This hook runs for every panic in the process, so it must not panic.
+        let _ = KCL_RUNTIME_PANIC_RECORD.try_with(|record| {
+            let Ok(mut record) = record.try_borrow_mut() else {
+                return;
+            };
             record.kcl_panic_info = true;
             record.message = if let Some(s) = info.payload().downcast_ref::<&str>() {
                 s.to_string()
@@ -324,10 +330,30 @@ static ONCE_PANIC_HOOK: Lazy<()> = Lazy::new(|| {
                 record.rust_line = location.line() as i32;
                 record.rust_col = location.column() as i32;
             }
-        })
+        });
+        if !RECORDING_PANICS.get() {
+            prev_hook(info);
+        }
     }));
 });
 
+/// Run `f` like [`std::panic::catch_unwind`] without printing its panic.
+///
+/// The panic hook is process-global, so it is installed once. It records
+/// every panic into the thread-local [`KCL_RUNTIME_PANIC_RECORD`] and prints
+/// it through the hook it replaced only on threads outside this function. A
+/// hook set after the first call replaces this one for the whole process, so
+/// panics inside this function then reach that hook and are not recorded.
+pub fn catch_unwind_silent<F: FnOnce() -> R + std::panic::UnwindSafe, R>(
+    f: F,
+) -> std::thread::Result<R> {
+    Lazy::force(&ONCE_PANIC_HOOK);
+    let recording = RECORDING_PANICS.replace(true);
+    let result = std::panic::catch_unwind(f);
+    RECORDING_PANICS.set(recording);
+    result
+}
+
 pub struct FastRunner {
     opts: RunnerOptions,
 }
@@ -358,34 +384,9 @@ impl FastRunner {
         if let Some(pkgs) = self.opts.referenced_pkgs_set() {
             evaluator.set_referenced_pkgs(pkgs);
         }
-        #[cfg(target_arch = "wasm32")]
-        // Ensure the panic hook is set (this will only happen once) for the WASM target,
-        // because it is single threaded.
-        Lazy::force(&ONCE_PANIC_HOOK);
-        #[cfg(not(target_arch = "wasm32"))]
-        let prev_hook = std::panic::take_hook();
-        #[cfg(not(target_arch = "wasm32"))]
-        std::panic::set_hook(Box::new(|info: &std::panic::PanicHookInfo| {
-            KCL_RUNTIME_PANIC_RECORD.with(|record| {
-                let mut record = record.borrow_mut();
-                record.kcl_panic_info = true;
-                record.message = if let Some(s) = info.payload().downcast_ref::<&str>() {
-                    s.to_string()
-                } else if let Some(s) = info.payload().downcast_ref::<&String>() {
-                    (*s).clone()
-                } else if let Some(s) = info.payload().downcast_ref::<String>() {
-                    (*s).clone()
-                } else {
-                    "unknown runtime error".to_string()
-                };
-                if let Some(location) = info.location() {
-                    record.rust_file = location.file().to_string();
-                    record.rust_line = location.line() as i32;
-                    record.rust_col = location.column() as i32;
-                }
-            })
-        }));
-        let evaluator_result = std::panic::catch_unwind(|| {
+        // Drop panics recorded on this thread before this run.
+        KCL_RUNTIME_PANIC_RECORD.take();
+        let evaluator_result = catch_unwind_silent(|| {
             if self.opts.plugin_agent_ptr > 0 {
                 #[cfg(not(target_arch = "wasm32"))]
                 unsafe {
@@ -399,8 +400,6 @@ impl FastRunner {
             }
             evaluator.run()
         });
-        #[cfg(not(target_arch = "wasm32"))]
-        std::panic::set_hook(prev_hook);
         KCL_RUNTIME_PANIC_RECORD.wit
```

**File**: `crates/runner/src/test_issues/github.com/kcl-lang/kcl/2223/main.k` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+items = [i * i for i in range(1000)]
+assert len(items) == 0, "items must be empty"
```

**File**: `crates/runner/src/tests.rs` (modified, +48/-5)
```diff
@@ -330,10 +330,7 @@ fn exec_with_err_result_at(path: &str) {
     let kcl_files = get_files(path, false, true, ".k");
     let output_files = get_files(path, false, true, ".stderr.json");
 
-    let prev_hook = std::panic::take_hook();
-    // disable print panic info
-    std::panic::set_hook(Box::new(|_| {}));
-    let result = std::panic::catch_unwind(|| {
+    let result = crate::runner::catch_unwind_silent(|| {
         for (kcl_file, _) in kcl_files.iter().zip(&output_files) {
             let mut args = ExecProgramArgs::default();
             args.k_filename_list.push(kcl_file.to_string());
@@ -346,7 +343,6 @@ fn exec_with_err_result_at(path: &str) {
         }
     });
     assert!(result.is_ok());
-    std::panic::set_hook(prev_hook);
 }
 
 /// Get kcl files from path.
@@ -524,3 +520,50 @@ fn test_eval_error_reports_diagnostics_on_result() {
         "runtime diagnostics must carry a line: {pos:?}"
     );
 }
+
+/// Regression test for issue #2223: evaluations running concurrently in one
+/// process must each report their own runtime error message.
+#[test]
+fn test_concurrent_eval_errors_keep_message() {
+    let main_test_path = PathBuf::from("./src/test_issues/github.com/kcl-lang/kcl/2223/main.k");
+    for _ in 0..20 {
+        // Each evaluation runs on a fresh thread so that no message can
+        // carry over from an earlier evaluation on the same thread.
+        let handles: Vec<_> = (0..8)
+            .map(|_| {
+                let main_test_path = main_test_path.clone();
+                std::thread::spawn(move || {
+                    let mut args = ExecProgramArgs::default();
+                    args.k_filename_list
+                        .push(main_test_path.display().to_string());
+                    args.work_dir = Some(".".to_string());
+                    let res = exec_program(Arc::new(ParseSession::default()), &args).unwrap();
+                    res.diagnostics[0].messages[0].message.clone()
+                })
+            })
+            .collect();
+        for handle in handles {
+            assert_eq!(handle.join().unwrap(), "items must be empty");
+        }
+    }
+}
+
+/// A host that replaces the panic hook after KCL installed its own must not
+/// lose runtime error messages.
+#[test]
+fn test_eval_error_keeps_message_after_hook_replaced() {
+    let mut args = ExecProgramArgs::default();
+    args.k_filename_list
+        .push("./src/test_issues/github.com/kcl-lang/kcl/2223/main.k".to_string());
+    args.work_dir = Some(".".to_string());
+    // Install KCL's hook, then replace it as a host would.
+    crate::runner::catch_unwind_silent(|| ()).unwrap();
+    let prev_hook = std::panic::take_hook();
+    std::panic::set_hook(Box::new(|_| {}));
+    let res = exec_program(Arc::new(ParseSession::default()), &args);
+    std::panic::set_hook(prev_hook);
+    assert_eq!(
+        res.unwrap().diagnostics[0].messages[0].message,
+        "items must be empty"
+    );
+}
```

**File**: `crates/runner/tests/panic_hook.rs` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+//! A host's panic hook installed before KCL's first call must keep receiving
+//! the host's own panics, and none of KCL's, while evaluations run
+//! concurrently. This file holds a single test so that its process installs
+//! the host hook before anything else installs KCL's.
+#![allow(clippy::arc_with_non_send_sync)]
+
+use kcl_parser::ParseSession;
+use kcl_runner::{ExecProgramArgs, exec_program};
+use std::sync::Arc;
+use std::sync::atomic::{AtomicUsize, Ordering};
+
+const FIXTURE: &str = "src/test_issues/github.com/kcl-lang/kcl/2223/main.k";
+
+static HOST_PANICS: AtomicUsize = AtomicUsize::new(0);
+
+#[test]
+fn host_hook_survives_concurrent_evaluations() {
+    let default_hook = std::panic::take_hook();
+    std::panic::set_hook(Box::new(move |info| {
+        HOST_PANICS.fetch_add(1, Ordering::SeqCst);
+        default_hook(info);
+    }));
+
+    for _ in 0..20 {
+        let handles: Vec<_> = (0..8)
+            .map(|_| {
+                std::thread::spawn(|| {
+                    let args = ExecProgramArgs {
+                        k_filename_list: vec![FIXTURE.to_string()],
+                        ..Default::default()
+                    };
+                    exec_program(Arc::new(ParseSession::default()), &args).unwrap()
+                })
+            })
+            .collect();
+        for handle in handles {
+            assert!(!handle.join().unwrap().err_message.is_empty());
+        }
+    }
+    assert_eq!(HOST_PANICS.load(Ordering::SeqCst), 0);
+
+    std::thread::spawn(|| panic!("host panic"))
+        .join()
+        .unwrap_err();
+    assert_eq!(HOST_PANICS.load(Ordering::SeqCst), 1);
+}
```

---

### Incident Patch 2: `da013146` (2026-09-29)
**Commit Message**: fix(runtime): self-contained plugin stub on wasm32-unknown-unknown (#2208)

runtime: self-contained plugin stub on wasm32-unknown-unknown

The kcl_plugin_invoke_json_wasm import only makes sense when there's a
host to fill it in - wasmtime in akua's render worker, or any WASI
host. On wasm32-unknown-unknown (e.g. a JS-loaded SDK bundle) there is
no host, so the extern becomes an unresolved env.* import that every
JS loader stumbles over.

Gate the extern to target_os = "wasi" and provide a self-contained
stub on the non-WASI path. The stub returns a __kcl_PanicInfo__
envelope pointing users at the CLI, so Packages that try to call
helm.template / kustomize.build / pkg.render in the SDK bundle surface
a clean diagnostic instead of a silent misevaluation.

Verified against a temporary `uuid` "js" feature addition (kcl's own
separate, pre-existing wasm32-unknown-unknown gap, tracked
independently and not part of this patch - the consuming crate closes
it via Cargo feature unification, see akuapkg's
docs/spikes/kcl-wasm-feasibility.md) - kcl-runtime alone checks clean
for wasm32-unknown-unknown with that gap closed.

Originally landed as akua-dev/kcl@5b214696 on the akua-wasm32 branch;

**File**: `crates/runtime/src/stdlib/plugin.rs` (modified, +25/-1)
```diff
@@ -116,7 +116,13 @@ pub unsafe extern "C-unwind" fn kcl_plugin_invoke_json(
     }
 }
 
-#[cfg(target_arch = "wasm32")]
+// `wasm32-wasip1` expects a wasmtime host (or any WASI host) to link
+// `kcl_plugin_invoke_json_wasm` at instantiation - that's how akua's
+// render worker ferries plugin callouts back to host handlers. On
+// `wasm32-unknown-unknown` (e.g. a JS-loaded SDK bundle) there is no
+// host, so the extern would leave an unresolved `env.*` import that
+// every JS loader stumbles over.
+#[cfg(all(target_arch = "wasm32", target_os = "wasi"))]
 unsafe extern "C-unwind" {
     pub fn kcl_plugin_invoke_json_wasm(
         method: *const c_char,
@@ -125,6 +131,24 @@ unsafe extern "C-unwind" {
     ) -> *const c_char;
 }
 
+/// Self-contained no-op stub for `wasm32-unknown-unknown`, where there
+/// is no host to link the real `kcl_plugin_invoke_json_wasm` extern.
+/// Callers that need plugins stick with `wasm32-wasip1` + a wasmtime
+/// host.
+#[cfg(all(target_arch = "wasm32", not(target_os = "wasi")))]
+pub unsafe fn kcl_plugin_invoke_json_wasm(
+    _method: *const c_char,
+    _args: *const c_char,
+    _kwargs: *const c_char,
+) -> *const c_char {
+    // `__kcl_PanicInfo__` shape - KCL's plugin-invoke glue treats this
+    // response as a runtime panic, so Packages that call a plugin
+    // surface a clean evaluator error with the message below rather
+    // than a silent misevaluation.
+    c"{\"__kcl_PanicInfo__\":\"plugin callouts are not available in this KCL build (wasm32-unknown-unknown) - use a wasmtime-hosted build for helm.template / kustomize.build / pkg.render\"}"
+        .as_ptr() as *const c_char
+}
+
 #[cfg(all(test, not(target_arch = "wasm32")))]
 mod tests {
     use super::*;
```

---

### Incident Patch 3: `ce101d61` (2026-10-09)
**Commit Message**: fix(error): populate source locations in arcanist/sarif output (#2217)

fix(error): populate source locations in arcanist/sarif output (#2216)

The machine-readable renderers were never the problem. They read the
position off the `Diagnostic` they were handed, but the runner flattened
every compile and evaluation failure into an already-rendered,
ANSI-colored string before returning, so the structure was gone by the
time anything rendered it.

Both the CLI (`crates/cmd/src/run.rs`) and the C API
(`crates/api/src/service/service_impl.rs`) then wrapped that whole
rendered string in a fresh `Diagnostic` at `Position::dummy_pos()` and
rendered *that*. Hence `Path` and `uri` came out empty, every error was
reported as the generic `error[E3M38] EvaluationError`, and
`Description` / `message.text` carried the entire pretty block including
its escape codes.

Keep the structure instead of dropping it:

* `emit_compile_diag_to_string` now bails with a `RenderedError` that
  carries the parse and resolve diagnostics it just rendered.
  `Display` yields the rendered message, so `to_string()` and the
  human-readable output are byte-identical to before.
* `FastRunner::run` keeps the `PanicInfo`

**File**: `crates/api/src/capi_test.rs` (modified, +5/-1)
```diff
@@ -11,7 +11,11 @@ use std::os::raw::c_char;
 use std::path::{Path, PathBuf};
 use std::sync::Mutex;
 const TEST_DATA_PATH: &str = "./src/testdata";
-static TEST_MUTEX: Lazy<Mutex<i32>> = Lazy::new(|| Mutex::new(0i32));
+/// Serialises the C API tests. It also has to be held by any *other* test
+/// that evaluates a KCL program against [`TEST_DATA_PATH`]: the evaluator
+/// caches into a `.kcl` directory inside the work dir, so two concurrent
+/// runs over the same fixtures fight over the same files.
+pub(crate) static TEST_MUTEX: Lazy<Mutex<i32>> = Lazy::new(|| Mutex::new(0i32));
 
 #[test]
 fn test_c_api_call_exec_program() {
```

**File**: `crates/api/src/service/service_impl.rs` (modified, +172/-42)
```diff
@@ -9,7 +9,7 @@ use crate::gpyrpc::{self, *};
 use kcl_ast::ast::SerializeProgram;
 use kcl_config::settings::build_settings_pathbuf;
 use kcl_error::format::DiagnosticFormat;
-use kcl_error::{Diagnostic, Handler, Level, Message};
+use kcl_error::{Diagnostic, Handler, Level, Message, RenderedError};
 use kcl_language_server::rename;
 use kcl_loader::option::list_options;
 use kcl_loader::{LoadPackageOptions, load_packages_with_cache};
@@ -66,43 +66,56 @@ pub(crate) fn resolve_error_format(args_error_format: &str) -> anyhow::Result<Di
     Ok(DiagnosticFormat::Pretty)
 }
 
-/// Render a machine-readable representation of `err_message` using the
-/// requested `format`. Returns an empty string when the caller asked for the
-/// default `Pretty` output or when `err_message` is empty. Otherwise wraps
-/// the message in a `Diagnostic` and dispatches to the format-specific
-/// renderer so the result can be inspected (e.g. in tests) without needing
-/// to capture process-global stderr.
+/// Render a machine-readable representation of `diagnostics` — falling back
+/// to `err_message` when the run produced none — using the requested
+/// `format`. Returns an empty string when the caller asked for the default
+/// `Pretty` output or when there is nothing to report.
+///
+/// The `diagnostics` come from the run itself and carry real file/line/column
+/// information, which is exactly what these formats exist to expose;
+/// re-wrapping the rendered text instead leaves the location fields blank
+/// (issue #2216).
 pub(crate) fn render_machine_readable_error(
     err_message: &str,
     format: DiagnosticFormat,
+    diagnostics: &[Diagnostic],
 ) -> anyhow::Result<String> {
-    if format == DiagnosticFormat::Pretty || err_message.is_empty() {
+    if format == DiagnosticFormat::Pretty || (err_message.is_empty() && diagnostics.is_empty()) {
         return Ok(String::new());
     }
     let mut handler = Handler::new();
-    let pos = kcl_error::Position::dummy_pos();
-    handler.add_diagnostic(Diagnostic {
-        level: Level::Error,
-        messages: vec![Message {
-            range: (pos.clone(), pos),
-            style: kcl_error::Style::LineAndColumn,
-            message: err_message.to_string(),
-            note: None,
-            suggested_replacement: None,
-        }],
-        code: None,
-    });
+    for diag in diagnostics {
+        handler.add_diagnostic(diag.clone());
+    }
+    if handler.diagnostics.is_empty() {
+        let pos = kcl_error::Position::dummy_pos();
+        handler.add_diagnostic(Diagnostic {
+            level: Level::Error,
+            messages: vec![Message {
+                range: (pos.clone(), pos),
+                style: kcl_error::Style::LineAndColumn,
+                // The text was rendered for a terminal; drop the color codes
+                // before it reaches a machine-readable record.
+                message: kcl_error::format::strip_ansi(err_message).into_owned(),
+                note: None,
+                suggested_replacement: None,
+            }],
+            code: None,
+        });
+    }
     handler.emit_to_string_as(format)
 }
 
-/// Emit a machine-readable representation of `err_message` to stderr when the
-/// caller asked for a non-pretty diagnostic format. Returns Ok(()) always so
-/// callers can use it in a tail position.
+/// Emit a machine-readable representation of `diagnostics` — falling back to
+/// `err_message` — to stderr when the caller asked for a non-pretty
+/// diagnostic format. Returns Ok(()) always so callers can use it in a tail
+/// position.
 pub(crate) fn emit_machine_readable_error(
     err_message: &str,
     format: DiagnosticFormat,
+    diagnostics: &[Diagnostic],
 ) -> anyhow::Result<()> {
-    let rendered = render_machine_readable_error(err_message, format)?;
+    let rendered = render_machine_readable_error(err_message, format, diagnostics)?;
     if !rendered.is_empty() {
         use std::io::Write;
         let mut stderr = std::io::stderr().lock();
@@ -271,8 +284,9 @@ fn from_proto_test_result(result: &gpyrpc::TestResult) -> testing::TestResult {
 ///
 /// Now: when the caller asked for `Pretty` (the default) we keep the existing
 /// pretty rendering so the wire text is byte-compatible with the previous
-/// behaviour; for the other formats we wrap the pretty text in a
-/// `Diagnostic` and re-dispatch to `render_machine_readable_error`. If
+/// behaviour; for the other formats we re-dispatch to
+/// `render_machine_readable_error`, preferring the structured diagnostics the
+/// runner attached to the error (issue #2216) over the rendered text. If
 /// re-rendering itself fails (extremely rare — only if the renderer can't
 /// construct a `Diagnostic` for the given input) we fall back to the raw
 /// pretty text so the caller never sees an empty error message.
@@ -281,7 +295,11 @@ pub(crate) fn format_anyhow_error(err: &anyhow::Error, format: DiagnosticFormat)
     if format == DiagnosticFormat::P
```

**File**: `crates/api/src/testdata/exec-program-with-arcanist-error-format-and-compile-error.response.error` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 [
   {
     "Char": 1,
-    "Code": "error[E3M38]",
-    "Description": "\nerror[E2G22]: TypeError\n---> File main.k:1:1: expected int, got str(str)\n\n",
+    "Code": "error[E2G22]",
+    "Description": "expected int, got str(str)",
     "Line": 1,
-    "Name": "EvaluationError",
+    "Name": "TypeError",
     "OriginalText": "",
-    "Path": ""
+    "Path": "main.k"
   }
 ]
\ No newline at end of file
```

**File**: `crates/api/src/testdata/exec-program-with-sarif-error-format-and-compile-error.response.error` (modified, +9/-7)
```diff
@@ -9,31 +9,33 @@
           "informationUri": "https://kcl-lang.io/",
           "rules": [
             {
-              "id": "E3M38",
-              "name": "EvaluationError",
+              "id": "E2G22",
+              "name": "TypeError",
               "shortDescription": {
-                "text": "EvaluationError"
+                "text": "TypeError"
               }
             }
           ]
         }
       },
       "results": [
         {
-          "ruleId": "E3M38",
+          "ruleId": "E2G22",
           "level": "error",
           "message": {
-            "text": "\nerror[E2G22]: TypeError\n---> File main.k:1:1: expected int, got str(str)\n\n"
+            "text": "expected int, got str(str)"
           },
           "locations": [
             {
               "physicalLocation": {
                 "artifactLocation": {
-                  "uri": ""
+                  "uri": "main.k"
                 },
                 "region": {
                   "startLine": 1,
-                  "startColumn": 1
+                  "startColumn": 1,
+                  "endLine": 1,
+                  "endColumn": 2
                 }
               }
             }
```

**File**: `crates/api/src/testdata/exec-program-with-short-error-format-and-compile-error.response.error` (modified, +1/-5)
```diff
@@ -1,5 +1 @@
-error[E3M38]: EvaluationError - 
-error[E2G22]: TypeError
----> File main.k:1:1: expected int, got str(str)
-
-
+main.k:1:1 - error[E2G22]: TypeError - expected int, got str(str)
```

**File**: `crates/cmd/src/run.rs` (modified, +31/-8)
```diff
@@ -3,7 +3,7 @@
 use anyhow::Result;
 use clap::ArgMatches;
 use kcl_error::format::DiagnosticFormat;
-use kcl_error::{Diagnostic, Handler, Level, Message, StringError};
+use kcl_error::{Diagnostic, Handler, Level, Message, RenderedError, StringError};
 use kcl_parser::ParseSession;
 use kcl_runner::exec_program;
 use std::io::Write;
@@ -31,9 +31,10 @@ pub fn resolve_error_format(matches: &ArgMatches) -> Result<DiagnosticFormat> {
 
 /// Build a fallback KCL [`Diagnostic`] from a plain error message string.
 ///
-/// The runner reports compile/eval failures as plain text via
-/// `ExecProgramResult.err_message`. For machine-readable formats we still
-/// want to surface *something*, even without structured position info.
+/// Used only when the run produced no structured diagnostics (e.g. an
+/// argument error reported before compilation starts). The text has already
+/// been rendered for a terminal, so its ANSI escapes are stripped before it
+/// is embedded in a machine-readable record.
 fn diag_from_err_message(message: &str) -> Diagnostic {
     Diagnostic {
         level: Level::Error,
@@ -43,20 +44,42 @@ fn diag_from_err_message(message: &str) -> Diagnostic {
                 kcl_error::Position::dummy_pos(),
             ),
             style: kcl_error::Style::LineAndColumn,
-            message: message.to_string(),
+            message: kcl_error::format::strip_ansi(message).into_owned(),
             note: None,
             suggested_replacement: None,
         }],
         code: None,
     }
 }
 
+/// A [`Handler`] pre-loaded with the diagnostics the run produced.
+fn handler_with_diagnostics(diagnostics: Vec<Diagnostic>) -> Handler {
+    let mut handler = Handler::new();
+    for diag in diagnostics {
+        handler.add_diagnostic(diag);
+    }
+    handler
+}
+
+/// The structured diagnostics behind a failed run.
+///
+/// Compile failures arrive as a [`RenderedError`] carrying them; evaluation
+/// failures carry them on the result. Either way they hold the real
+/// file/line/column that the machine-readable formats report (issue #2216).
+fn diagnostics_from_error(err: &anyhow::Error) -> Vec<Diagnostic> {
+    err.downcast_ref::<RenderedError>()
+        .map(|rendered| rendered.diagnostics.clone())
+        .unwrap_or_default()
+}
+
 fn emit_machine_readable(
     handler: &mut Handler,
     message: &str,
     format: DiagnosticFormat,
 ) -> Result<()> {
-    handler.add_diagnostic(diag_from_err_message(message));
+    if handler.diagnostics.is_empty() {
+        handler.add_diagnostic(diag_from_err_message(message));
+    }
     let _ = handler.emit_as(format)?;
     Ok(())
 }
@@ -84,7 +107,7 @@ pub fn run_command<W: Write>(matches: &ArgMatches, writer: &mut W) -> Result<()>
                     }
                     sess.0.emit_stashed_diagnostics_and_abort()?;
                 } else {
-                    let mut handler = Handler::new();
+                    let mut handler = handler_with_diagnostics(result.diagnostics);
                     emit_machine_readable(&mut handler, &result.err_message, error_format)?;
                     std::process::exit(1);
                 }
@@ -121,7 +144,7 @@ pub fn run_command<W: Write>(matches: &ArgMatches, writer: &mut W) -> Result<()>
                 }
                 sess.0.emit_stashed_diagnostics_and_abort()?;
             } else {
-                let mut handler = Handler::new();
+                let mut handler = handler_with_diagnostics(diagnostics_from_error(&msg));
                 emit_machine_readable(&mut handler, &msg.to_string(), error_format)?;
                 std::process::exit(1);
             }
```

**File**: `crates/error/src/diagnostic.rs` (modified, +38/-0)
```diff
@@ -136,6 +136,44 @@ impl Diagnostic {
 
 pub type Range = (Position, Position);
 
+/// An error that carries the [`Diagnostic`]s behind an error message which
+/// has already been rendered to text.
+///
+/// The runner reports compile failures as a rendered string, which drops the
+/// positions that machine-readable formats (arcanist JSON, SARIF) exist to
+/// carry. Embedding the original diagnostics lets callers re-render them
+/// with the real file/line/column instead of re-wrapping the text in a
+/// position-less [`Diagnostic`].
+///
+/// [`Display`](std::fmt::Display) yields the rendered message, so
+/// `anyhow::Error::to_string()` is byte-identical to rendering the message
+/// directly and the pretty output is unaffected.
+#[derive(Debug, Clone)]
+pub struct RenderedError {
+    /// The already-rendered, human-readable error text.
+    pub message: String,
+    /// The diagnostics `message` was rendered from, in emission order.
+    pub diagnostics: Vec<Diagnostic>,
+}
+
+impl fmt::Display for RenderedError {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        f.write_str(&self.message)
+    }
+}
+
+impl std::error::Error for RenderedError {}
+
+impl RenderedError {
+    /// Pair a rendered error message with the diagnostics it came from.
+    pub fn new(message: String, diagnostics: Vec<Diagnostic>) -> Self {
+        Self {
+            message,
+            diagnostics,
+        }
+    }
+}
+
 /// Returns a dummy range whose filename is empty, line is 1 and column is None.
 #[inline]
 pub fn dummy_range() -> Range {
```

**File**: `crates/error/src/format/mod.rs` (modified, +53/-0)
```diff
@@ -18,6 +18,7 @@ pub mod short;
 
 use crate::{Diagnostic, DiagnosticId, Level, Message, Position, Style};
 use compiler_base_session::Session;
+use std::borrow::Cow;
 use std::str::FromStr;
 use thiserror::Error;
 
@@ -93,6 +94,41 @@ pub fn external_column(pos: &Position) -> u64 {
     pos.column.map(|c| c + 1).unwrap_or(1)
 }
 
+/// Strip ANSI escape sequences from already-rendered diagnostic text.
+///
+/// The fallback machine-readable record for an error that carries no
+/// structured [`Diagnostic`]s is built from the human-readable rendering,
+/// which is colorized for terminals. The structured fields of arcanist /
+/// SARIF output are consumed by tools, not a terminal, so the escape codes
+/// must not travel with them.
+pub fn strip_ansi(text: &str) -> Cow<'_, str> {
+    if !text.contains('\u{1b}') {
+        return Cow::Borrowed(text);
+    }
+    let mut out = String::with_capacity(text.len());
+    let mut chars = text.chars().peekable();
+    while let Some(c) = chars.next() {
+        if c != '\u{1b}' {
+            out.push(c);
+            continue;
+        }
+        // CSI sequences (`ESC [ … final`), which is what `annotate_snippets`
+        // emits. Consume up to and including the final byte in `@`..`~`.
+        if chars.peek() == Some(&'[') {
+            chars.next();
+            for c in chars.by_ref() {
+                if ('@'..='~').contains(&c) {
+                    break;
+                }
+            }
+        } else {
+            // Any other two-character escape sequence.
+            chars.next();
+        }
+    }
+    Cow::Owned(out)
+}
+
 /// Look up the source line that contains `pos.line` from `filename`.
 ///
 /// Returns `None` when the file cannot be opened or the line is out of
@@ -271,6 +307,23 @@ mod tests {
         assert_eq!(primary_message(&diag).unwrap().message, "anything");
     }
 
+    #[test]
+    fn strip_ansi_removes_csi_sequences() {
+        let colored = "\u{1b}[1;38;5;12mboom\u{1b}[0m";
+        assert_eq!(strip_ansi(colored), "boom");
+        // Text without escapes is borrowed, not copied.
+        assert!(matches!(strip_ansi("plain"), Cow::Borrowed("plain")));
+    }
+
+    #[test]
+    fn strip_ansi_keeps_surrounding_text() {
+        let rendered = "error[E2L23]\n --> a.k:2:5\n\u{1b}[1;38;5;12m2 | b = x\u{1b}[0m";
+        let stripped = strip_ansi(rendered);
+        assert!(!stripped.contains('\u{1b}'), "got: {stripped}");
+        assert!(stripped.contains("a.k:2:5"), "got: {stripped}");
+        assert!(stripped.contains("2 | b = x"), "got: {stripped}");
+    }
+
     #[test]
     fn external_column_handles_missing_column() {
         let pos = Position {
```

#### Recent Merged Pull Requests:
- **PR #2224** (2026-10-19): fix(runner): install the panic hook once instead of swapping it per run (@tobias-karlsson)
- **PR #2222** (2026-10-16): chore(release): bump version to v0.13.2 (@Peefy)
- **PR #2221** (2026-10-16): fix(lsp): keep completion on an attribute name typed before its `:` or `=` (@jul-m)
- **PR #2220** (2026-10-13): fix(ci): stop three doctests sharing a mutable fixture (@Peefy)
- **PR #2219** (2026-10-13): ci(release): publish kcl-lib for windows/arm64 (@Peefy)
- **PR #2217** (2026-10-09): fix(error): populate source locations in arcanist/sarif output (@Peefy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. runner): install the panic hook once instead of swapping it per run (#2224)

**RULE**:
When implementing operations in `crates/api/src/capi_test.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kcl-lang/kcl. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ee6cfba9`: runner): install the panic hook once instead of swapping it per run (#2224). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/api/src/capi_test.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    let result = kcl_runner::runner::catch_unwind_silent(|| {
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    let prev_hook = std::panic::take_hook();
    // disable print panic info
    std::panic::set_hook(Box::new(|_info| {}));
    let result = std::panic::catch_unwind(|| {
    std::panic::set_hook(prev_hook);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ee6cfba9` are properly handled with clean fallback behavior.
