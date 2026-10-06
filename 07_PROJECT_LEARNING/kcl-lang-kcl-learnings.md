# Forensic Learning Record (Deep Inspection): kcl-lang/kcl

> **Canonical Artifact**: `07_PROJECT_LEARNING/kcl-lang-kcl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kcl-lang/kcl](https://github.com/kcl-lang/kcl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:22:51.642Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kcl-lang/kcl`
- **Description**: KCL Language Core and API
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2427 stars

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

### Core Architecture Module: `crates/sema/src/core/scope.rs`
```
use std::collections::{HashMap, HashSet};

use kcl_ast::pos::ContainsPos;
use kcl_error::{Position, diagnostic::Range};
use kcl_primitives::{IndexMap, IndexSet};
use serde::Serialize;

use crate::core::symbol::SymbolRef;

use super::{package::ModuleInfo, symbol::SymbolData};

pub trait Scope {
    type SymbolData;
    fn get_filename(&self) -> &str;
    fn get_parent(&self) -> Option<ScopeRef>;
    fn get_children(&self) -> Vec<ScopeRef>;

    fn contains_pos(&self, pos: &Position) -> bool;
    fn get_range(&self) -> Option<(Position, Position)>;

    fn get_owner(&self) -> Option<SymbolRef>;
    fn look_up_def(
        &self,
        name: &str,
        scope_data: &ScopeData,
        symbol_data: &Self::SymbolData,
        module_info: Option<&ModuleInfo>,
        // lookup in local scope
        local: bool,
        // lookup in scope owner
        get_def_from_owner: bool,
    ) -> Option<SymbolRef>;

    /// Get all defs within current scope and parent scope
    fn get_all_defs(
        &self,
        scope_data: &ScopeData,
        symbol_data: &Self::SymbolData,
        module_info: Option<&ModuleInfo>,
        maybe_in_key: bool,
        get_def_from_owner: bool,
    ) -> HashMap<String, SymbolRef>;

    /// Get all defs within current scope
    fn get_defs_within_scope(
        &self,
        scope_data: &ScopeData,
        symbol_data: &Self::SymbolData,
        module_info: Option<&ModuleInfo>,
        maybe_in_key: bool,
        get_def_from_owner: bool,
    ) -> HashMap<String, SymbolRef>;

    fn dump(&self, scope_data: &ScopeData, symbol_data: &Self::SymbolData) -> Option<String>;
}

#[derive(Debug, PartialEq, Eq, Clone, Copy, Hash, Serialize)]
pub enum ScopeKind {
    Local,
    Root,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy, Hash)]
pub struct ScopeRef {
    pub(crate) id: generational_arena::Index,
    pub(crate) kind: ScopeKind,
}

impl Serialize for ScopeRef {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let (index, generation) = self.id.into_raw_parts();
        let data = SerializableScopeRef {
            i: index as u64,
            g: generation,
            kind: self.kind,
        };
        data.serialize(serializer)
    }
}

#[derive(Debug, Clone, Serialize)]

struct SerializableScopeRef {
    i: u64,
    g: u64,
    kind: ScopeKind,
}

impl ScopeRef {
    pub fn get_id(&self) -> generational_arena::Index {
        self.id
    }

    pub fn get_kind(&self) -> ScopeKind {
        self.kind
    }
}

#[derive(Default, Debug, Clone)]
pub struct ScopeData {
    /// map pkgpath to root_scope
    pub(crate) root_map: IndexMap<String, ScopeRef>,
    /// map schema fully qualified name to schema local scope
    pub(crate) schema_scope_map: IndexMap<String, ScopeRef>,
    pub(crate) locals: generational_arena::Arena<LocalSymbolScope>,
    pub(crate) roots: generational_arena::Arena<RootSymbolScope>,
    pub(crate) config_scope_context: IndexMap<generational_arena::Index, ConfigScopeContext>,
}

/// Determine the position of pos in the config scope for completion in lsp.
/// Refer to gopls `compLitInfo`: https://github.com/golang/tools/blob/28ba9914c6b79f6cf3a56cc477398f7fd686c84d/gopls/internal/golang/completion/completion.go#L298
/// But the semantics are different. Complete item in:
/// Go: left = keys + right  right = all def in scope and parent scope
/// kcl: left = keys if in schema, right = all def in left and parent scope
#[derive(Default, Debug, Clone)]
pub struct ConfigScopeContext {
    pub entries_range: Vec<(Option<Range>, Range)>,
}

impl ConfigScopeContext {
    pub fn in_entry(&self, pos: &Position) -> bool {
        self.entries_range.iter().any(|(key, value)| {
            let start = if key.is_some() {
                key.clone().unwrap().0
            } else {
                value.0.clone()
            };
            start.less_equal(pos) && pos.less_equal(&value.1)
        })
    }

    pub fn maybe_in_key(&self, pos: &Position) -> bool {
        !self.in_right_value(pos)
    }

    pub fn in_right_value(&self, pos: &Position) -> bool {
        self.entries_range
            .iter()
            .any(|(_, value)| value.contains_pos(pos))
    }
}

impl ScopeData {
    #[inline]
    pub fn get_root_scope_map(&self) -> &IndexMap<String, ScopeRef> {
        &self.root_map
    }

    pub fn get_scope(&self, scope: &ScopeRef) -> Option<&dyn Scope<SymbolData = SymbolData>> {
        match scope.get_kind() {
            ScopeKind::Local => {
                Some(self.locals.get(scope.get_id())? as &dyn Scope<SymbolData = SymbolData>)
            }
            ScopeKind::Root => {
                Some(self.roots.get(scope.get_id())? as &dyn Scope<SymbolData = SymbolData>)
            }
        }
    }

    pub fn remove_scope(&mut self, scope: &ScopeRef) {
        match scope.get_kind() {
            ScopeKind::Local => {
                self.locals.remove(scope.get_id());
            }
            ScopeKind::Root => {
                self.roots.remove(scope.get_id());
            }
        }
    }

    pub fn try_get_local_scope(&self, scope: &ScopeRef) -> Option<&LocalSymbolScope> {
        match scope.get_kind() {
            ScopeKind::Local => Some(self.locals.get(scope.get_id())?),
            ScopeKind::Root => None,
        }
    }

    pub fn get_root_scope(&self, name: String) -> Option<ScopeRef> {
        self.root_map.get(&name).copied()
    }

    pub fn add_def_to_scope(&mut self, scope: ScopeRef, name: String, symbol: SymbolRef) {
        match scope.get_kind() {
            ScopeKind::Local => {
                if let Some(local) = self.locals.get_mut(scope.get_id()) {
                    local.defs.insert(name, symbol);
                }
            }
            ScopeKind::Root => {
                unreachable!("never add symbol to root scope after namer pass")
            }
        }
    }

    pub fn add_ref_to_scope(&mut self, scope: ScopeRef, symbol: SymbolRef) {
        match scope.get_kind() {
            ScopeKind::Local => {
                if let Some(local) = self.locals.get_mut(scope.get_id()) {
                    local.refs.push(symbol);
                }
            }
            ScopeKind::Root => {
                if let Some(root) = self.roots.get_mut(scope.get_id()) {
                    root.refs.push(symbol);
                }
            }
        }
    }

    pub fn set_owner_to_scope(&mut self, scope: ScopeRef, owner: SymbolRef) {
        match scope.get_kind() {
            ScopeKind::Local => {
                if let Some(local) = self.locals.get_mut(scope.get_id()) {
                    local.owner = Some(owner);
                }
            }
            ScopeKind::Root => {
                if let Some(root) = self.roots.get_mut(scope.get_id()) {
                    root.owner = owner;
                }
            }
        }
    }

    pub fn alloc_root_scope(&mut self, root: RootSymbolScope) -> ScopeRef {
        let filepath = root.pkgpath.clone();
        let id = self.roots.insert(root);
        let scope_ref = ScopeRef {
            id,
            kind: ScopeKind::Root,
        };
        self.root_map.insert(filepath, scope_ref);
        scope_ref
    }

    pub fn alloc_local_scope(&mut self, local: LocalSymbolScope) -> ScopeRef {
        let id = self.locals.insert(local);
        ScopeRef {
            id,
            kind: ScopeKind::Local,
        }
    }

    pub fn clear_cache(&mut self, invalidate_pkgs: &HashSet<String>) {
        for invalidate_pkg in invalidate_pkgs {
            if let Some(scope_ref) = self.root_map.swap_remove(invalidate_pkg) {
                self.clear_scope_and_child(scope_ref);
                self.roots.remove(scope_ref.get_id());
            }
            self.schema_scope_map
                .retain(|key, _| !key.starts_with(invalidate_pkg));
        }
    }

    pub fn clear_scope_and_child(&mut self, scope_ref: ScopeRef) {
        if let Some(scope) = self.get_scope(&scope_ref) {
            for c in scope.get_children() {
                self.clear_scope_and_child(c)
            }
        }
        self.remove_scope(&scope_ref)
    }

    pub fn set_config_scope_ctx(&mut self, scope: ScopeRef, ctx: ConfigScopeContext) {
        self.config_scope_context.insert(scope.get_id(), ctx);
    }

    pub fn get_config_scope_ctx(&self, scope: ScopeRef) -> Option<ConfigScopeContext> {
        self.config_scope_context.get(&scope.get_id()).cloned()
    }
}

#[derive(Debug, Clone)]
pub struct RootSymbolScope {
    pub(crate) pkgpath: String,

    pub(crate) filename: String,

    pub(crate) kfile_path: IndexSet<String>,

    /// PackageSymbol of this scope
    pub(crate) owner: SymbolRef,

    /// map filepath to children
    pub(crate) children: IndexMap<String, Vec<ScopeRef>>,

    pub(crate) refs: Vec<SymbolRef>,
}

impl Scope for RootSymbolScope {
    type SymbolData = SymbolData;
    fn get_filename(&self) -> &str {
        &self.filename
    }

    fn get_children(&self) -> Vec<ScopeRef> {
        let mut children = vec![];
        for scopes in self.children.values() {
            children.append(&mut scopes.clone())
        }
        children
    }

    fn get_parent(&self) -> Option<ScopeRef> {
        None
    }

    fn contains_pos(&self, pos: &Position) -> bool {
        self.kfile_path.contains(&pos.filename)
    }
    fn get_owner(&self) -> Option<SymbolRef> {
        Some(self.owner)
    }

    fn look_up_def(
        &self,
        name: &str,
        _scope_data: &ScopeData,
        symbol_data: &Self::SymbolData,
        module_info: Option<&ModuleInfo>,
        _local: bool,
        _owner: bool,
    ) -> Option<SymbolRef> {
        let package_symbol = symbol_data.get_symbol(self.owner)?;

        package_symbol.get_attribute(name, symbol_data, module_info)
    }

    fn get_all_defs(
        &self,
        _scope_data: &ScopeData,
        symbol_data: &Self::SymbolData,
        module_info: Option
```

### Core Architecture Module: `crates/sema/src/core/semantic_information.rs`
```
use kcl_ast::ast::AstIndex;
use kcl_primitives::IndexMap;
use std::sync::Arc;

use super::{
    scope::ScopeRef,
    symbol::{SymbolHint, SymbolRef},
};
use crate::ty::Type;
#[allow(unused)]
#[derive(Debug, Default, Clone)]
pub struct SemanticDB {
    pub(crate) tys: IndexMap<AstIndex, Arc<Type>>,
    pub(crate) file_sema_map: IndexMap<String, FileSemanticInfo>,
}

impl SemanticDB {
    pub fn get_file_sema(&self, file: &str) -> Option<&FileSemanticInfo> {
        self.file_sema_map.get(file)
    }
}

#[allow(unused)]
#[derive(Debug, Clone)]
pub struct FileSemanticInfo {
    pub(crate) filename: String,
    pub(crate) symbols: Vec<SymbolRef>,
    pub(crate) scopes: Vec<ScopeRef>,
    pub(crate) symbol_locs: IndexMap<SymbolRef, CachedLocation>,
    pub(crate) local_scope_locs: IndexMap<ScopeRef, CachedRange>,
    pub(crate) hints: Vec<SymbolHint>,
}

impl FileSemanticInfo {
    pub fn new(filename: String) -> Self {
        Self {
            filename,
            symbols: vec![],
            scopes: vec![],
            symbol_locs: IndexMap::default(),
            local_scope_locs: IndexMap::default(),
            hints: vec![],
        }
    }

    pub fn look_up_closest_symbol(&self, loc: &CachedLocation) -> Option<SymbolRef> {
        match self
            .symbols
            .binary_search_by(|symbol_ref| self.symbol_locs.get(symbol_ref).unwrap().cmp(loc))
        {
            Ok(symbol_index) => Some(self.symbols[symbol_index]),
            Err(symbol_index) => {
                if symbol_index > 0 {
                    Some(self.symbols[symbol_index - 1])
                } else {
                    None
                }
            }
        }
    }

    pub fn get_symbols(&self) -> &Vec<SymbolRef> {
        &self.symbols
    }

    pub fn get_hints(&self) -> &Vec<SymbolHint> {
        &self.hints
    }
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct CachedLocation {
    pub(crate) line: u64,
    pub(crate) column: u64,
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct CachedRange {
    pub(crate) start: CachedLocation,
    pub(crate) end: CachedLocation,
}

impl Ord for CachedLocation {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match self.line.cmp(&other.line) {
            core::cmp::Ordering::Equal => self.column.cmp(&other.column),
            ord => ord,
        }
    }
}

impl PartialOrd for CachedLocation {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2130** (2026-08-24): **Evaluator regression (0.12.x): sibling-key reads inside a dict literal resolve to Undefined when the dict also contains a lambda-call + merge key**
  *Symptoms*: ## Evaluator regression: sibling-key reads inside a dict literal resolve to Undefined when the dict also contains a lambda-call + merge key  ### Summary  In KCL 0.12.x, evaluating certain expressions inside a dict literal silently (or loudly) resolves to `Undefined` even though the referenced variable is bound. The trigger pattern is a dict literal whose **one key is a lambda call followed by `|` and an override dict**, and whose **sibling key reads an attribute from the surrounding scope** — most commonly `config.X` where `config` is a schema instance.  This is a regression: the same code renders correctly under KCL 0.11.x.  The konfig project (kcl-lang/konfig#36) hit this and had to ship a multi-file workaround; reporting here so it can be fixed at the evaluator.  ### Minimal reproducer (kcl 0.12.8)  ```kcl schema Server:     name: str = "x"     workloadType: str = "Deployment"  MetaBuilder = lambda c -> {str:} {     {         name: c?.name or "default"         labels: c?.labels  # bare optional access, no fallback     } }  config_dict = {     name = "x"     workloadType = "Deployment" }  my_dict = {     metadata = MetaBuilder(config_dict) | {name = "override"}     spec = {         # reading config_dict.workloadType silently returns Undefined         selector = config_dict?.services or config_dict[config_dict.workloadType]     } }  print("spec.selector:", my_dict.spec.selector) ```  Observed (kcl 0.12.8):  ``` spec.selector: Undefined ```  Expected (kcl 0.11.x):  ``` spec.s

- **Issue #2080** (2026-04-07): **Assign by value is not working properly when using different schemas**
  *Symptoms*: ## Bug Report  According to the documentation, [assignments are always by value](https://www.kcl-lang.io/docs/reference/lang/spec/schema#assign-by-value).   However deleting properties from an object after it was assign to a variable, still triggers validation of the original object's schema. In some other cases it will even delete properties from the old schema. I was not able yet, to reproduce the deletion outside of my project.   ### 1. Minimal reproduce step (Required)  ``` schema Foo:     hello: str  schema Bar(Foo):     world: str  testCopyByValue = lambda input: Bar -> Foo {     foo: any = input     foo.world = Undefined      foo }  bar = Bar {     hello = "world"     world = "hello" }   output = testCopyByValue(bar) ``` ### 2. What did you expect to see? (Required) ``` output:    hello: world ```  ### 3. What did you see instead (Required)  ``` EvaluationError   --> /test.k:12:1    | 12 |     foo.world = Undefined    |  attribute 'world' of Bar is required and can't be None or Undefined    | ```  ### 4. What is your KCL components version? (Required)  ``` kcl version 0.12.4 ```
  **Post-Mortem & Fix Analysis**:
  > Amazing, thanks for the fix. Any idea when this is going to be released?  Edit: Right now I am using the workaround that I set the type to `any`.

- **Issue #2072** (2026-08-26): **evaluation is order dependent in local scope (missing attribute)**
  *Symptoms*: # Bug: Lambda evaluation only computes last field when depending on local variables  **Disclaimer:** This issue is the result of human-AI collaboration after searching for the bug cause . I indeed experienced and reproduced the error and provided the code(partially the file is long and contains bunch of colors). The analysis down below was primarily generated by an LLM (DeepSeek) and is speculative - the author does not fully understand the codebase and this analysis may be incorrect. Please verify independently.  ## Description  When defining a lambda that creates a config object with multiple computed fields depending on local variables (defined in the same lambda), only the last field in declaration order appears in the output. Earlier fields are missing entirely.  This works correctly in global scope but fails in lambda/local scope.  ## Reproduction  ```kcl # some types and schemas like Palette ... # Base data structure (validated as correct YAML was indeed output) everforest_src = { 	light = { 		fg = {...},  		bg = { 			hard = {...},  			..other variants 		} 	},  	dark = {..similar to light mode} }  # Schema-validated theme, no errors  # ✅ WORKS - Global scope _mode = "light" _variant = "hard" everforest_light_hard = {     mode = _mode     variant = _variant     fg = everforest_src[mode].fg     bg = everforest_src[mode].bg[variant] } # Result: {mode="light", variant="hard", fg=..., bg=...} - both fields present  # ❌ FAILS - Lambda scope (fg first, bg last) get_palette2 =
  **Post-Mortem & Fix Analysis**:
  > The reproduction is clear and the per-field bisect (swapping `fg`/`bg` order consistently shows only the last field) strongly points to a scope-resolution bug in lambda body compilation rather than a data-dependency cycle. The analysis in the issue correctly isolates `scope.rs`, `lazy.rs`, and `context.rs` as the likely culprits — particularly the interaction between `emit_setters` (which records field setters in `LazyEvalScope`) and `get_variable` (which may use a direct scope lookup path that bypasses lazy forcing for earlier fields). Can you share the minimal reproducer as a standalone `.k` file rather than the theming snippet, so the bug can be isolated in the KCL test harness without the `Palette` schema overhead? A unit test that asserts `len(result.fields) == len(lambda.body.fields)` for a two-field lambda would pin the regression and prevent re-introduction.
  > **Update: False alarm - this was a syntax misunderstanding, not a bug**  After re-reading the docs and testing more carefully, I found the root cause.  I was using: ```kcl func1 = lambda x, y -> any {     a = x     b = y } ```  But KCL treats `{ ... }` as a function body block (like Scala/Rust), not as an implicit return. The last expression is what gets returned - so `func1` returns `b` only.  What I intended and understood (influenced by JavaScript where `() => {a: x, b: y}` is common) was: ```kcl func2 = lambda x, y -> any { 	{ 	    a = x 	    b = y 	} } ``` I mistakenly thought the `-> Type` (`Palette` in my case) part was syntax for a typed dict literal, not the function's return type annotation.  The nested braces `{ { ... } }` create a single expression returning the config object. With this fix applied to my original theming code, both fields appear correctly. No order-dependence, no bug.  **Apologies for the noise! And yes, confirmation bias is real - I framed it so convincing
  > Ah, good catch — lambda blocks returning the last expression rather than all assignments makes sense. Thanks for closing the loop on this.

- **Issue #2059** (2026-02-12): **Relative imports as show in the language tour don't seem to work**
  *Symptoms*: ## Bug Report  Please answer these questions before submitting your issue. Thanks!  ### 1. Minimal reproduce step (Required)  Create a folder structure like is demonstrated in the KCL language tour at https://www.kcl-lang.io/docs/reference/lang/tour#module (note that it's the first example which DOES NOT contain a `kcl.mod` file).  ### 2. What did you expect to see? (Required)  I expected that running `kcl run model/main.k` in the `root` folder or `kcl run main.k` in the `root/model` folder would correctly print the model.   ### 3. What did you see instead (Required)  I get all sorts of error: failed to import errors, various attribute and schemas not defined, etc. It seems to me that relative paths simply don't work as shown (unless there's some kind of flag I have to pass to the CLI command).   ### 4. What is your KCL components version? (Required)  0.12.3

- **Issue #2054** (2026-01-27): **builtin类型转换函数int转换16进制时出现coredump**
  *Symptoms*: ## Bug Report  Please answer these questions before submitting your issue. Thanks!  ### 1. Minimal reproduce step (Required) 使用命令行kcl工具编译如下源码文件  print(int("E4",base=16)) 或者print(int("0xe4",base=16))  ### 2. What did you expect to see? (Required) 228  ### 3. What did you see instead (Required) 发生coredump ``` [11:55:59]ci@~/kcl-tool/build/kcl> kcl ../../a.k  thread caused non-unwinding panic. aborting. SIGABRT: abort PC=0x7371e7e1b9fc m=0 sigcode=18446744073709551610 signal arrived during cgo execution  goroutine 1 gp=0xc000002380 m=0 mp=0x4deffc0 [syscall]: runtime.cgocall(0xfd74c0, 0xc0004da5b0)         /opt/buildtools/golang_go-1.24.1/go/src/runtime/cgocall.go:167 +0x4b fp=0xc000836888 sp=0xc000836850 pc=0x47980b github.com/ebitengine/purego.RegisterFunc.func1({0xc00081f780?, 0x5?, 0x5?})         /home/ci/go/pkg/mod/github.com/ebitengine/purego@v0.7.1/func.go:302 +0xc3f fp=0xc000836d08 sp=0xc000836888 pc=0xfd4a3f reflect.callReflect(0xc00087e090, 0xc0008371c0, 0xc000837098, 0xc0008370a0)         /opt/buildtools/golang_go-1.24.1/go/src/reflect/value.go:770 +0x519 fp=0xc000837048 sp=0xc000836d08 pc=0x4b88d9 reflect.callReflect(0xc00087e090, 0xc0008371c0, 0xc000837098, 0xc0008370a0)         <autogenerated>:1 +0x45 fp=0xc000837078 sp=0xc000837048 pc=0x4ca6c5 reflect.makeFuncStub()         /opt/buildtools/golang_go-1.24.1/go/src/reflect/asm_amd64.s:47 +0x6e fp=0xc0008371c0 sp=0xc000837078 pc=0x4c69ce kcl-lang.io/lib/go/native.cApiCall[...](0xc00088b830, {0x243c339, 0x18}, 0x1eb52

- **Issue #2046** (2026-07-19): **Kcl run causes stack overflow**
  *Symptoms*: ## Bug Report  Please answer these questions before submitting your issue. Thanks!  ### Minimal reproduce step (Required)  ```bash cd /tmp git clone https://github.com/kcl-lang/kcl.git cd kcl cargo build ```  running the following gives us the stack overflow:   ```bash user@/t/kcl (main) [2]> /tmp/kcl/_build/dist/linux/core/libkcl run test.k  thread 'main' (79949) has overflowed its stack fatal runtime error: stack overflow, aborting fish: Job 1, '/tmp/kcl/_build/dist/linux/core…' terminated by signal SIGABRT (Abort) ```  with   `test.k` ```kcl test = {   bean: "test" } test ```  being the offending minimal test case identified  the following does not cause an issue:  ```kcl _test = {   bean: "test" } _test ```  ### What is your KCL components version? (Required)  Version: 0.12.3-c020ab3eb4b9179219d6837a57f5d323 Platform: x86_64-unknown-linux-gnu GitCommit: 7a5fabf7fa10f7bea0d6d3aaddc6345d5b13e63f 

- **Issue #2042** (2026-01-09): **KCL grammar parse error**
  *Symptoms*: ## Bug Report  Please answer these questions before submitting your issue. Thanks!  ### 1. Minimal reproduce step (Required)  ``` cd /tmp git clone https://github.com/kcl-lang/kcl.git cd kcl cargo build  /tmp/kcl/_build/dist/linux/core/libkcl run test.k error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:5:5   | 5 |     {   |     ^ expected one of ["]"] got {   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:7:5   | 7 |     }   |     ^ expected one of [":", "=", "+="] got newline   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:8:5   | 8 |     ]   |     ^ expected one of ["identifier", "literal", "(", "[", "{"] got ]   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:8:5   | 8 |     ]   |     ^ expected one of ["identifier", "literal", "(", "[", "{"] got ]   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:8:5   | 8 |     ]   |     ^ expected one of [":", "=", "+="] got ]   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:8:5   | 8 |     ]   |     ^ expected one of ["identifier", "literal", "(", "[", "{"] got newline   |  error[E2A31]: IllegalAttributeError  --> /tmp/kcl/test.k:5:5   | 5 |     {   |     ^ A attribute must be string type, got '{str(name):str(test2)}'   |  ```  the issue happens with the following the following kcl file:   ```test.k {     hi: [{         name: "test"     }     {         name: "test2"     }     ] } ```  but goes away if you run this version:  ```working version  {     hi: [     {         name: "test"     }     {         name: "test

- **Issue #2020** (2025-12-30): **calling lambda from checks always fail that check**
  *Symptoms*: ### 1. Minimal reproduce step (Required) ```kcl _check_uniq = lambda xs -> bool {   isunique(xs) }  schema S1:   elems: [int]    check:     _check_uniq(elems) if elems, "elems of ${elems} MUST be unique"  schema S2:   elems: [int]    check:     isunique(elems) if elems, "elems ${elems} MUST be unique"  s1 = S1 {   elems: [1,2,3] } ``` When trying to validate a YAML file against schema S1, the validation always fails, but the same input file successfully validates against schema S2. I.e ``` # kcl run ./main.k | yq -y '.s1' | kcl vet --format yaml - ./main.k -s S1 EvaluationError  --> /tmp/.tmpodArdm:1:6   | 1 | elems:   |      ^ Instance check failed   |  ---> File validationTempKCLCode.k:9: Check failed on the condition: elems of [1, 2, 3] MUST be unique  # kcl run ./main.k | yq -y '.s1' | kcl vet --format yaml - ./main.k -s S2 Validate success! ```  ### 2. What did you expect to see? (Required) checks with lambda calls should success if input data is valid  ### 3. What did you see instead (Required) checks with lambda calls fails event if the input data is valid  ### 4. What is your KCL components version? (Required) # kcl --version kcl version 0.12.3  The same behavior with kcl 0.11.3

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

### Incident Patch 1: `3ec296a9` (2026-10-04)
**Commit Message**: fix(api): forward exec_args.work_dir in GetSchemaTypeMappingUnderPath (#2211)

The gen_schema refactor (#2209) extracted the load-and-collect path into
load_pkg_schema_types taking only ParseProgramArgs, which has no
work_dir knob — so the RPC silently dropped exec_args.work_dir and
relative entry paths resolved against the process CWD instead of the
caller's working directory (surfaced by the C example
get_schema_type_mapping_under_path_api as 'Cannot find the kcl file
main.k' once bindings picked up a core containing the refactor).

Thread an explicit work_dir through the helper: the existing RPC
forwards exec_args.work_dir; the GenerateOpenAPI/Proto/Doc RPCs pass
""

Signed-off-by: Peefy <[REDACTED_EMAIL]>
Co-authored-by: Peefy <[REDACTED_EMAIL]>

**File**: `crates/api/src/service/gen_doc.rs` (modified, +7/-4)
```diff
@@ -127,10 +127,13 @@ mod tests {
             .unwrap()
             .display()
             .to_string();
-        load_pkg_schema_types(&crate::gpyrpc::ParseProgramArgs {
-            paths: vec![path],
-            ..Default::default()
-        })
+        load_pkg_schema_types(
+            &crate::gpyrpc::ParseProgramArgs {
+                paths: vec![path],
+                ..Default::default()
+            },
+            "",
+        )
         .unwrap()
     }
 
```

**File**: `crates/api/src/service/gen_openapi.rs` (modified, +7/-4)
```diff
@@ -222,10 +222,13 @@ mod tests {
             .unwrap()
             .display()
             .to_string();
-        load_pkg_schema_types(&crate::gpyrpc::ParseProgramArgs {
-            paths: vec![path],
-            ..Default::default()
-        })
+        load_pkg_schema_types(
+            &crate::gpyrpc::ParseProgramArgs {
+                paths: vec![path],
+                ..Default::default()
+            },
+            "",
+        )
         .unwrap()
     }
 
```

**File**: `crates/api/src/service/gen_proto.rs` (modified, +7/-4)
```diff
@@ -238,10 +238,13 @@ mod tests {
             .unwrap()
             .display()
             .to_string();
-        load_pkg_schema_types(&crate::gpyrpc::ParseProgramArgs {
-            paths: vec![path],
-            ..Default::default()
-        })
+        load_pkg_schema_types(
+            &crate::gpyrpc::ParseProgramArgs {
+                paths: vec![path],
+                ..Default::default()
+            },
+            "",
+        )
         .unwrap()
     }
 
```

**File**: `crates/api/src/service/gen_schema.rs` (modified, +6/-0)
```diff
@@ -22,8 +22,13 @@ use kcl_sema::resolver::Options;
 ///
 /// This is the shared load-and-collect path previously inlined in
 /// `get_schema_type_mapping_under_path`; that RPC now delegates here.
+/// `work_dir` resolves relative entry paths; the generation RPCs pass ""
+/// (their `ParseProgramArgs` has no working-directory knob), while
+/// `GetSchemaTypeMappingUnderPath` forwards `exec_args.work_dir` to preserve
+/// its pre-refactor behavior.
 pub(crate) fn load_pkg_schema_types(
     parse_args: &ParseProgramArgs,
+    work_dir: &str,
 ) -> anyhow::Result<HashMap<String, gpyrpc::SchemaTypes>> {
     let mut package_maps = HashMap::new();
     for p in &parse_args.external_pkgs {
@@ -38,6 +43,7 @@ pub(crate) fn load_pkg_schema_types(
                 k_code_list: parse_args.sources.clone(),
                 package_maps,
                 load_plugins: true,
+                work_dir: work_dir.to_string(),
                 ..Default::default()
             }),
             resolve_opts: Options {
```

**File**: `crates/api/src/service/service_impl.rs` (modified, +8/-5)
```diff
@@ -1082,13 +1082,16 @@ impl KclServiceImpl {
     ) -> anyhow::Result<GetSchemaTypeMappingUnderPathResult> {
         let exec_args = args.exec_args.clone().unwrap_or_default();
         // The extractor only speaks ParseProgramArgs; the exec-only knobs
-        // (work_dir, plugin agent, ...) do not affect schema collection.
+        // The plugin agent does not affect schema collection; work_dir DOES —
+        // callers may pass relative entry paths, so forward it (the
+        // pre-refactor implementation resolved them through exec_args).
+        let work_dir = exec_args.work_dir.clone();
         let parse_args = ParseProgramArgs {
             paths: exec_args.k_filename_list,
             sources: exec_args.k_code_list,
             external_pkgs: exec_args.external_pkgs,
         };
-        let mut type_mapping = gen_schema::load_pkg_schema_types(&parse_args)?;
+        let mut type_mapping = gen_schema::load_pkg_schema_types(&parse_args, &work_dir)?;
         if !args.schema_name.is_empty() {
             // Post-filter by schema name, mirroring the in-loader filter
             // (packages left without a matching schema drop out entirely).
@@ -1713,7 +1716,7 @@ impl KclServiceImpl {
             .parse_args
             .as_ref()
             .ok_or_else(|| anyhow::anyhow!("parse_args must be set to parse a KCL program"))?;
-        let mapping = gen_schema::load_pkg_schema_types(parse_args)?;
+        let mapping = gen_schema::load_pkg_schema_types(parse_args, "")?;
         Ok(GenerateOpenApiResult {
             spec: gen_openapi::generate_openapi(&mapping, &args.version)?,
         })
@@ -1751,7 +1754,7 @@ impl KclServiceImpl {
             .parse_args
             .as_ref()
             .ok_or_else(|| anyhow::anyhow!("parse_args must be set to parse a KCL program"))?;
-        let mapping = gen_schema::load_pkg_schema_types(parse_args)?;
+        let mapping = gen_schema::load_pkg_schema_types(parse_args, "")?;
         Ok(GenerateProtoResult {
             proto: gen_proto::generate_proto(&mapping, &args.package)?,
         })
@@ -1788,7 +1791,7 @@ impl KclServiceImpl {
             .parse_args
             .as_ref()
             .ok_or_else(|| anyhow::anyhow!("parse_args must be set to parse a KCL program"))?;
-        let mapping = gen_schema::load_pkg_schema_types(parse_args)?;
+        let mapping = gen_schema::load_pkg_schema_types(parse_args, "")?;
         Ok(GenerateDocResult {
             content: gen_doc::generate_doc(&mapping, &args.format)?,
         })
```

---

### Incident Patch 2: `842b02be` (2026-10-03)
**Commit Message**: fix(parser): resolve external/internal packages correctly through WASI preopens on wasm32 (#2206)

* parser: trust caller-registered external_pkgs without .exists() probe

kcl-parser's is_external_pkg used Path::exists() to probe
{pkg_root}/kcl.mod regardless of how the pkg was declared. For pkgs
registered explicitly via opts.package_maps that probe is redundant -
the caller promised the directory is valid. And on wasm32-wasip1 with
the pkg directory handed over through a WASI preopen, Path::exists for
absolute paths through preopens is unreliable in Rust's current std;
the probe returns false and the caller's explicit registration is
silently discarded, surfacing later as "pkgroot not found: <pkg>".

Split the resolution into two branches:

- Caller-registered (package_maps hit): skip the .exists() probe,
  TRUST the caller. Proceed straight to canonicalize + k-file walk.
- Vendor-dirs fallback: probe with .exists() as before - the caller
  didn't declare anything and we're scanning.

Zero behaviour change on native: if .exists() was going to return true
for caller-registered pkgs (it always was, on native), we bypass a
filesystem round-trip. If it would have returned false, nati

**File**: `crates/parser/src/lib.rs` (modified, +55/-11)
```diff
@@ -632,11 +632,30 @@ fn pkg_exists_in_path(path: &str, pkgpath: &str, load_cache: &mut ParseLoadCache
         return *exists;
     }
     let pathbuf = pkgpath_to_path_buf(Path::new(path), pkgpath);
-    let exists = pathbuf.exists() || pathbuf.with_extension(KCL_FILE_EXTENSION).exists();
+    let exists = path_exists_or_file(&pathbuf)
+        || path_exists_or_file(&pathbuf.with_extension(KCL_FILE_EXTENSION));
     load_cache.pkg_exists_in_path.insert(cache_key, exists);
     exists
 }
 
+/// Check whether a path exists. On `wasm32-wasip1`, `Path::exists()` is
+/// unreliable for absolute paths that traverse WASI preopens - the std
+/// implementation doesn't resolve them through the preopen table for
+/// metadata calls (`path_filestat_get`), so probes against host-mounted
+/// paths spuriously return false. Fall back to an actual read attempt
+/// (`read_dir` for directories, `File::open` for files), which DOES go
+/// through `path_open` and honors the preopens.
+fn path_exists_or_file(path: &std::path::Path) -> bool {
+    #[cfg(target_arch = "wasm32")]
+    {
+        std::fs::read_dir(path).is_ok() || std::fs::File::open(path).is_ok()
+    }
+    #[cfg(not(target_arch = "wasm32"))]
+    {
+        path.exists()
+    }
+}
+
 /// Compute the canonical [`pkgpath`] for [`pkgpath`] under [`pkgroot`].
 ///
 /// KCL allows importing a single file via its dotted path (e.g. `import a.b.c`
@@ -732,6 +751,13 @@ fn is_internal_pkg(
     pkg_path: &str,
     load_cache: &mut ParseLoadCache,
 ) -> Result<Option<PkgInfo>> {
+    // No internal pkg can exist without a pkg_root on disk - skip the
+    // probe. Avoids a bogus get_pkg_kfile_list("", pkg_path) call in
+    // cases (like inline k_code_list compilation) where main has no
+    // kcl.mod anchor.
+    if pkg_root.is_empty() {
+        return Ok(None);
+    }
     if pkg_exists_in_path(pkg_root, pkg_path, load_cache) {
         // Canonicalize the pkgpath so that `import a.b` (directory) and
         // `import a.b.c` (single file) refer to the same package when both
@@ -783,14 +809,19 @@ fn get_pkg_kfile_list(
     let pathbuf = pkgpath_to_path_buf(std::path::Path::new(pkgroot), pkgpath);
 
     let abspath = canonicalize_path_cached(pathbuf.as_path(), load_cache);
-    if abspath.exists() {
-        let k_files = get_dir_files(abspath.to_str().unwrap())?;
-        load_cache.pkg_kfile_list.insert(cache_key, k_files.clone());
-        return Ok(k_files);
+    if path_exists_or_file(abspath.as_path()) {
+        // Only a real directory enumerates k-files; if abspath resolves
+        // to a file (e.g. a `.k` mistakenly passed without extension)
+        // let the next branch handle it.
+        if std::fs::read_dir(abspath.as_path()).is_ok() {
+            let k_files = get_dir_files(abspath.to_str().unwrap())?;
+            load_cache.pkg_kfile_list.insert(cache_key, k_files.clone());
+            return Ok(k_files);
+        }
     }
 
     let as_k_path = format!("{}{}", abspath.display(), KCL_FILE_SUFFIX);
-    if std::path::Path::new(as_k_path.as_str()).exists() {
+    if path_exists_or_file(std::path::Path::new(as_k_path.as_str())) {
         let k_files = vec![as_k_path];
         load_cache.pkg_kfile_list.insert(cache_key, k_files.clone());
         return Ok(k_files);
@@ -802,7 +833,7 @@ fn get_pkg_kfile_list(
 
 /// Get file list in the directory.
 fn get_dir_files(dir: &str) -> Result<Vec<String>> {
-    if !std::path::Path::new(dir).exists() {
+    if !path_exists_or_file(std::path::Path::new(dir)) {
         return Ok(Vec::new());
     }
 
@@ -845,16 +876,29 @@ fn is_external_pkg(
     load_cache: &mut ParseLoadCache,
 ) -> Result<Option<PkgInfo>> {
     let pkg_name = parse_external_pkg_name(pkg_path)?;
-    let external_pkg_root = if let Some(root) = opts.package_maps.get(&pkg_name) {
-        PathBuf::from(root).join(KCL_MOD_FILE)
+    // Two resolution paths:
+    //
+    // 1. Caller registered the pkg explicitly via `opts.package_maps` —
+    //    e.g. an embedder that materialized the pkg to a known path
+    //    (possibly via WASI preopens on wasip1, where `Path::exists`
+    //    through absolute preopen paths is unreliable in std).
+    //    TRUST the caller: skip the .exists() probe, jump straight
+    //    to the pkg-root resolution below.
+    // 2. Fall back to `vendor_dirs`, where we do probe with
+    //    `.exists()` since the caller didn't declare anything.
+    let (external_pkg_root, explicit) = if let Some(root) = opts.package_maps.get(&pkg_name) {
+        (PathBuf::from(root).join(KCL_MOD_FILE), true)
     } else {
         match pkg_exists(&opts.vendor_dirs, pkg_path, load_cache) {
-            Some(path) => PathBuf::from(path).join(&pkg_name).join(KCL_MOD_FILE),
+            Some(path) => (
+                PathBuf::from(path).join(&pkg_name).join(KCL_MOD_FILE),
+                false,
+            ),
             None => return Ok(None),
         }
     };
 
-    if external_pkg_root.exists() {
+    if ex
```

---

### Incident Patch 3: `da013146` (2026-09-29)
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

### Incident Patch 4: `d2b50eb8` (2026-09-29)
**Commit Message**: fix(lsp): wasm32 shim for Url::from_file_path / to_file_path (#2207)

LSP: wasm32 shim for Url::from_file_path

The url crate's from_file_path is gated on cfg(any(unix, windows)) and
doesn't exist on wasm32-unknown-unknown. The LSP uses it to build
file:// URIs for diagnostic locations; without the helper,
kcl-language-server (and therefore kcl-api, which depends on it
unconditionally) fails to compile for targets without a filesystem.

Provide util::url_from_file_path that forwards to Url::from_file_path
on native and parses file://${path} via Url::parse on wasm32 - LSP
responses carry the same URL shape either way. Swap production call
sites to the helper; the two Url::from_file_path calls in
quick_fix.rs's own test module stay on the native API since tests
never run on wasm32.

Unblocks embedding KCL via wasm32-unknown-unknown for a JS-loaded SDK
bundle (akua's Phase 4B - not yet built in this repo, but the crate
must still compile for that target since kcl-api pulls in
kcl-language-server unconditionally, not behind a feature flag).

Originally landed as akua-dev/kcl@29dda76e on the akua-wasm32 branch;
from_lsp.rs and to_lsp.rs applied unchanged, util.rs rebased onto
upstream's

**File**: `crates/tools/src/LSP/src/from_lsp.rs` (modified, +4/-2)
```diff
@@ -5,10 +5,12 @@ use kcl_utils::path::PathPrefix;
 use lsp_types::{Position, Url};
 use ra_ap_vfs::AbsPathBuf;
 
+use crate::util::url_to_file_path;
+
 /// Converts the specified `uri` to an absolute path. Returns an error if the url could not be
 /// converted to an absolute path.
 pub(crate) fn abs_path(uri: &Url) -> anyhow::Result<AbsPathBuf> {
-    uri.to_file_path()
+    url_to_file_path(uri)
         .ok()
         .and_then(|path| AbsPathBuf::try_from(path).ok())
         .ok_or_else(|| anyhow::anyhow!("invalid uri: {}", uri))
@@ -51,7 +53,7 @@ pub(crate) fn text_range(text: &str, range: lsp_types::Range) -> Range<usize> {
 /// Converts the specified `url` to a utf8 encoded file path string. Returns an error if the url could not be
 /// converted to a valid utf8 encoded file path string.
 pub(crate) fn file_path_from_url(url: &Url) -> anyhow::Result<String> {
-    url.to_file_path()
+    url_to_file_path(url)
         .ok()
         .and_then(|path| {
             path.to_str()
```

**File**: `crates/tools/src/LSP/src/to_lsp.rs` (modified, +7/-5)
```diff
@@ -8,6 +8,8 @@ use kcl_utils::path::PathPrefix;
 use lsp_types::*;
 use serde_json::json;
 
+use crate::util::url_from_file_path;
+
 use std::{
     path::{Component, Path, Prefix},
     str::FromStr,
@@ -25,7 +27,7 @@ pub fn lsp_pos(pos: &KCLPos) -> Position {
 /// Convert start and pos format to lsp location.
 /// The position of the location in lsp protocol is different with position in ast node whose line number is 1 based.
 pub fn lsp_location(file_path: String, start: &KCLPos, end: &KCLPos) -> Option<Location> {
-    let uri = Url::from_file_path(file_path).ok()?;
+    let uri = url_from_file_path(file_path).ok()?;
     Some(Location {
         uri,
         range: Range {
@@ -69,7 +71,7 @@ pub fn kcl_msg_to_lsp_diags(
         Some(
             related_msg
                 .iter()
-                .filter_map(|m| match Url::from_file_path(m.range.0.filename.clone()) {
+                .filter_map(|m| match url_from_file_path(m.range.0.filename.clone()) {
                     Ok(uri) => Some(DiagnosticRelatedInformation {
                         location: Location {
                             uri,
@@ -183,7 +185,7 @@ pub(crate) fn url_from_path(path: impl AsRef<Path>) -> anyhow::Result<Url> {
 /// Returns a `Url` object from a given path, will lowercase drive letters if present.
 /// This will only happen when processing Windows paths.
 ///
-/// When processing non-windows path, this is essentially do the same as `Url::from_file_path`.
+/// When processing non-windows path, this is essentially do the same as `url_from_file_path`.
 pub(crate) fn url_from_path_with_drive_lowercasing(path: impl AsRef<Path>) -> anyhow::Result<Url> {
     let component_has_windows_drive = path.as_ref().components().any(|comp| {
         if let Component::Prefix(c) = comp {
@@ -197,7 +199,7 @@ pub(crate) fn url_from_path_with_drive_lowercasing(path: impl AsRef<Path>) -> an
 
     // VSCode expects drive letters to be lowercased, whereas rust will uppercase the drive letters.
     if component_has_windows_drive {
-        let url_original = Url::from_file_path(&path).map_err(|_| {
+        let url_original = url_from_file_path(&path).map_err(|_| {
             anyhow::anyhow!("can't convert path to url: {}", path.as_ref().display())
         })?;
 
@@ -214,7 +216,7 @@ pub(crate) fn url_from_path_with_drive_lowercasing(path: impl AsRef<Path>) -> an
             .map_err(|e| anyhow::anyhow!("Url from str ParseError: {}", e))?;
         Ok(url)
     } else {
-        Ok(Url::from_file_path(&path).map_err(|_| {
+        Ok(url_from_file_path(&path).map_err(|_| {
             anyhow::anyhow!("can't convert path to url: {}", path.as_ref().display())
         })?)
     }
```

**File**: `crates/tools/src/LSP/src/util.rs` (modified, +33/-1)
```diff
@@ -18,6 +18,38 @@ use serde::{Serialize, de::DeserializeOwned};
 use std::fs;
 use std::path::{Path, PathBuf};
 
+/// `Url::from_file_path` is `cfg(any(unix, windows))` in the `url`
+/// crate - unavailable on `wasm32-unknown-unknown`. The LSP only
+/// needs a `file://` URL for a path, so on wasm32 we build one via
+/// `Url::parse`. No Windows-drive handling on wasm32 since that
+/// target has no filesystem anyway.
+pub(crate) fn url_from_file_path<P: AsRef<Path>>(path: P) -> Result<Url, ()> {
+    #[cfg(not(target_arch = "wasm32"))]
+    {
+        Url::from_file_path(path)
+    }
+    #[cfg(target_arch = "wasm32")]
+    {
+        let p = path.as_ref().to_string_lossy();
+        Url::parse(&format!("file://{p}")).map_err(|_| ())
+    }
+}
+
+/// Inverse of [`url_from_file_path`]. Same story: `to_file_path` is
+/// `cfg(any(unix, windows))` on `url`. On wasm32 we strip the
+/// `file://` prefix and return the remainder as a `PathBuf`.
+pub(crate) fn url_to_file_path(url: &Url) -> Result<PathBuf, ()> {
+    #[cfg(not(target_arch = "wasm32"))]
+    {
+        url.to_file_path()
+    }
+    #[cfg(target_arch = "wasm32")]
+    {
+        let s = url.as_str();
+        s.strip_prefix("file://").map(PathBuf::from).ok_or(())
+    }
+}
+
 /// Deserializes a `T` from a json value.
 pub(crate) fn from_json<T: DeserializeOwned>(
     what: &'static str,
@@ -73,7 +105,7 @@ pub(crate) fn load_files_code_from_vfs(
     let mut res = vec![];
     let vfs = &mut vfs.read();
     for file in files {
-        let url = Url::from_file_path(file)
+        let url = url_from_file_path(file)
             .map_err(|_| anyhow::anyhow!("can't convert file to url: {}", file))?;
         let path = from_lsp::abs_path(&url)?;
         match vfs.file_id(&path.clone().into()) {
```

---

### Incident Patch 5: `931e6a98` (2026-09-26)
**Commit Message**: fix(api): use a single service method registry for BuiltinService.ListMethod (#2205)

Signed-off-by: Peefy <[REDACTED_EMAIL]>
Co-authored-by: Peefy <[REDACTED_EMAIL]>

**File**: `crates/api/src/service/capi.rs` (modified, +13/-3)
```diff
@@ -203,7 +203,17 @@ pub unsafe extern "C-unwind" fn kcl_service_call_with_length(
 }
 
 pub(crate) fn kcl_get_service_fn_ptr_by_name(name: &str) -> u64 {
-    match name {
+    lookup_service_fn_ptr(name).unwrap_or_else(|| panic!("unknown method name : {name}"))
+}
+
+/// Look up the native FFI function pointer for a service method name.
+///
+/// Returns `None` for unknown names instead of panicking so the registry
+/// consistency against [`SERVICE_METHODS`](crate::service::SERVICE_METHODS)
+/// can be unit-tested; [`kcl_get_service_fn_ptr_by_name`] wraps this with
+/// the panicking behavior the C ABI expects.
+pub(crate) fn lookup_service_fn_ptr(name: &str) -> Option<u64> {
+    Some(match name {
         "KclService.Ping" => ping as *const () as u64,
         "KclService.GetVersion" => get_version as *const () as u64,
         "KclService.ParseFile" => parse_file as *const () as u64,
@@ -230,8 +240,8 @@ pub(crate) fn kcl_get_service_fn_ptr_by_name(name: &str) -> u64 {
         // both services share the same PingArgs/PingResult message types.
         "BuiltinService.Ping" => ping as *const () as u64,
         "BuiltinService.ListMethod" => list_method as *const () as u64,
-        _ => panic!("unknown method name : {name}"),
-    }
+        _ => return None,
+    })
 }
 
 /// ping is used to test whether kcl service is successfully imported
```

**File**: `crates/api/src/service/jsonrpc.rs` (modified, +26/-24)
```diff
@@ -1,4 +1,5 @@
 use crate::gpyrpc::*;
+use crate::service::SERVICE_METHODS;
 use crate::service::service_impl::KclServiceImpl;
 use core::fmt::Display;
 use jsonrpc_stdio_server::ServerBuilder;
@@ -244,30 +245,10 @@ fn register_builtin_service(io: &mut IoHandler) {
     });
     io.add_sync_method("BuiltinService.ListMethod", |_params: Params| {
         let result = ListMethodResult {
-            method_name_list: vec![
-                "KclService.Ping".to_owned(),
-                "KclService.GetVersion".to_owned(),
-                "KclService.ParseFile".to_owned(),
-                "KclService.ParseProgram".to_owned(),
-                "KclService.ExecProgram".to_owned(),
-                "KclService.BuildProgram".to_owned(),
-                "KclService.ExecArtifact".to_owned(),
-                "KclService.OverrideFile".to_owned(),
-                "KclService.GetSchemaType".to_owned(),
-                "KclService.GetFullSchemaType".to_owned(),
-                "KclService.GetSchemaTypeMapping".to_owned(),
-                "KclService.FormatCode".to_owned(),
-                "KclService.FormatPath".to_owned(),
-                "KclService.LintPath".to_owned(),
-                "KclService.ValidateCode".to_owned(),
-                "KclService.LoadSettingsFiles".to_owned(),
-                "KclService.Rename".to_owned(),
-                "KclService.RenameCode".to_owned(),
-                "KclService.Test".to_owned(),
-                "KclService.UpdateDependencies".to_owned(),
-                "BuiltinService.Ping".to_owned(),
-                "BuiltinService.PingListMethod".to_owned(),
-            ],
+            method_name_list: SERVICE_METHODS
+                .iter()
+                .map(|name| name.to_string())
+                .collect(),
         };
         serde_json::to_value(result).map_err(|e| Error {
             code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
@@ -276,3 +257,24 @@ fn register_builtin_service(io: &mut IoHandler) {
         })
     });
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    /// The JSON-RPC `BuiltinService.ListMethod` response must advertise
+    /// exactly the shared registry.
+    #[test]
+    fn builtin_list_method_matches_registry() {
+        let mut io = IoHandler::default();
+        register_builtin_service(&mut io);
+        let request =
+            r#"{"jsonrpc":"2.0","method":"BuiltinService.ListMethod","params":{},"id":1}"#;
+        let response = io
+            .handle_request_sync(request)
+            .expect("BuiltinService.ListMethod should be registered");
+        let response: serde_json::Value = serde_json::from_str(&response).unwrap();
+        let expected = serde_json::json!({ "method_name_list": SERVICE_METHODS });
+        assert_eq!(response["result"], expected);
+    }
+}
```

**File**: `crates/api/src/service/mod.rs` (modified, +82/-0)
```diff
@@ -9,3 +9,85 @@ pub(crate) mod ty;
 pub(crate) mod util;
 
 pub use service_impl::KclServiceImpl;
+
+/// Single source of truth for the KCL service method registry.
+///
+/// Every name advertised by `BuiltinService.ListMethod` must be dispatchable
+/// through the native FFI table ([`capi::lookup_service_fn_ptr`]) and
+/// registered on the JSON-RPC server, and vice versa. The order follows the
+/// `KclService` RPC declaration order in `spec.proto` — methods that were
+/// removed from the spec (`BuildProgram`, `ExecArtifact`, ...) are
+/// intentionally absent — followed by the `BuiltinService` methods.
+pub(crate) const SERVICE_METHODS: &[&str] = &[
+    "KclService.Ping",
+    "KclService.GetVersion",
+    "KclService.ParseProgram",
+    "KclService.ParseFile",
+    "KclService.LoadPackage",
+    "KclService.ListOptions",
+    "KclService.ListVariables",
+    "KclService.ExecProgram",
+    "KclService.OverrideFile",
+    "KclService.GetSchemaTypeMapping",
+    "KclService.GetSchemaTypeMappingUnderPath",
+    "KclService.FormatCode",
+    "KclService.FormatPath",
+    "KclService.LintPath",
+    "KclService.ValidateCode",
+    "KclService.LoadSettingsFiles",
+    "KclService.Rename",
+    "KclService.RenameCode",
+    "KclService.Test",
+    "KclService.UpdateDependencies",
+    "BuiltinService.Ping",
+    "BuiltinService.ListMethod",
+];
+
+#[cfg(test)]
+mod tests {
+    use super::SERVICE_METHODS;
+    use crate::service::capi::lookup_service_fn_ptr;
+    use crate::service::service_impl::KclServiceImpl;
+
+    /// Every method advertised by `BuiltinService.ListMethod` must have a
+    /// native FFI entry so callers can actually invoke it.
+    #[test]
+    fn advertised_methods_are_dispatchable() {
+        for name in SERVICE_METHODS {
+            assert!(
+                lookup_service_fn_ptr(name).is_some(),
+                "advertised method {name} is missing from the native dispatch table"
+            );
+        }
+        assert!(lookup_service_fn_ptr("KclService.DoesNotExist").is_none());
+    }
+
+    /// `KclServiceImpl::list_method` must return exactly the registry.
+    #[test]
+    fn list_method_matches_registry() {
+        let serv = KclServiceImpl::default();
+        let result = serv.list_method(&Default::default()).unwrap();
+        let expected: Vec<String> = SERVICE_METHODS
+            .iter()
+            .map(|name| name.to_string())
+            .collect();
+        assert_eq!(result.method_name_list, expected);
+    }
+
+    /// Methods removed from the spec must not creep back into the registry.
+    #[test]
+    fn registry_excludes_removed_methods() {
+        for removed in [
+            "KclService.BuildProgram",
+            "KclService.ExecArtifact",
+            "KclService.ListDepFiles",
+            "KclService.GetSchemaType",
+            "KclService.GetFullSchemaType",
+        ] {
+            assert!(
+                !SERVICE_METHODS.contains(&removed),
+                "registry still advertises removed method {removed}"
+            );
+        }
+    }
+}
```

**File**: `crates/api/src/service/service_impl.rs` (modified, +9/-29)
```diff
@@ -37,6 +37,7 @@ use kcl_tools::vet::validator::ValidateOption;
 use kcl_tools::vet::validator::validate;
 use tempfile::NamedTempFile;
 
+use super::SERVICE_METHODS;
 use super::into::*;
 use super::ty::kcl_schema_ty_to_pb_ty;
 use super::util::{transform_exec_para, transform_str_para};
@@ -331,37 +332,16 @@ impl KclServiceImpl {
     }
 
     /// ListMethod KclService, return the list of KCL service method names
-    /// available in the underlying runtime. Mirrors the JSON-RPC
-    /// `BuiltinService.ListMethod` registration so the C ABI dispatch table
-    /// stays in sync with what callers see over JSON-RPC.
+    /// available in the underlying runtime. The list is sourced from the
+    /// shared [`SERVICE_METHODS`](crate::service::SERVICE_METHODS) registry
+    /// so it stays in sync with the C ABI dispatch table and the JSON-RPC
+    /// `BuiltinService.ListMethod` registration.
     pub fn list_method(&self, _args: &ListMethodArgs) -> anyhow::Result<ListMethodResult> {
         Ok(ListMethodResult {
-            method_name_list: vec![
-                "KclService.Ping".to_owned(),
-                "KclService.GetVersion".to_owned(),
-                "KclService.ParseFile".to_owned(),
-                "KclService.ParseProgram".to_owned(),
-                "KclService.LoadPackage".to_owned(),
-                "KclService.ListOptions".to_owned(),
-                "KclService.ListVariables".to_owned(),
-                "KclService.ExecProgram".to_owned(),
-                "KclService.BuildProgram".to_owned(),
-                "KclService.ExecArtifact".to_owned(),
-                "KclService.OverrideFile".to_owned(),
-                "KclService.GetSchemaTypeMapping".to_owned(),
-                "KclService.GetSchemaTypeMappingUnderPath".to_owned(),
-                "KclService.FormatCode".to_owned(),
-                "KclService.FormatPath".to_owned(),
-                "KclService.LintPath".to_owned(),
-                "KclService.ValidateCode".to_owned(),
-                "KclService.LoadSettingsFiles".to_owned(),
-                "KclService.Rename".to_owned(),
-                "KclService.RenameCode".to_owned(),
-                "KclService.Test".to_owned(),
-                "KclService.UpdateDependencies".to_owned(),
-                "BuiltinService.Ping".to_owned(),
-                "BuiltinService.ListMethod".to_owned(),
-            ],
+            method_name_list: SERVICE_METHODS
+                .iter()
+                .map(|name| name.to_string())
+                .collect(),
         })
     }
 
```

---

### Incident Patch 6: `dccc38ec` (2026-09-26)
**Commit Message**: fix(api): make ValidateCode, Rename and UpdateDependencies work on WASI/wasm32 (#2203)

The wasm32-wasip1 build of KclService had three sandbox-related defects:

- ValidateCode panicked because NamedTempFile::new() calls
  std::env::temp_dir(), which panics with "no filesystem on wasm" on
  wasip1. With panic=abort that traps and destroys the whole WASI
  instance. Create the temporary data file in the sandbox working
  directory instead on wasm32 so ValidateCode works.
- UpdateDependencies was compiled out on wasm32, so the C API dispatcher
  panicked with "unknown method name" (another instance-killing trap).
  Register the method on all targets and return a graceful error on
  wasm32: the WASI sandbox has no network or subprocess support to
  download KCL modules.
- Rename failed with "operation not supported" because
  std::fs::canonicalize is unsupported on wasip1. Fall back to a lexical
  path normalization (resolving . and .. against the sandbox working
  directory, no symlink resolution) on wasm32 so Rename works on
  sandbox files.

Also report check/assert runtime errors gracefully on wasm32. The
evaluator signals failing schema check blocks, rules and assert
statements b

**File**: `crates/api/src/service/capi.rs` (modified, +0/-2)
```diff
@@ -225,7 +225,6 @@ pub(crate) fn kcl_get_service_fn_ptr_by_name(name: &str) -> u64 {
         "KclService.Rename" => rename as *const () as u64,
         "KclService.RenameCode" => rename_code as *const () as u64,
         "KclService.Test" => test as *const () as u64,
-        #[cfg(not(target_arch = "wasm32"))]
         "KclService.UpdateDependencies" => update_dependencies as *const () as u64,
         // BuiltinService.Ping reuses the KclService.Ping implementation —
         // both services share the same PingArgs/PingResult message types.
@@ -652,7 +651,6 @@ pub(crate) fn test(
     call!(serv, args, args_len, result_len, TestArgs, test)
 }
 
-#[cfg(not(target_arch = "wasm32"))]
 /// Service for the dependencies updating
 /// calling information.
 ///
```

**File**: `crates/api/src/service/service_impl.rs` (modified, +55/-3)
```diff
@@ -1171,7 +1171,13 @@ impl KclServiceImpl {
     /// assert_eq!(result.success, true);
     /// ```
     pub fn validate_code(&self, args: &ValidateCodeArgs) -> anyhow::Result<ValidateCodeResult> {
+        // WASI has no temporary directory (`std::env::temp_dir` panics on
+        // wasm32-wasip1), so the data file is created inside the sandbox
+        // working directory instead. The file is removed when `file` drops.
+        #[cfg(not(target_arch = "wasm32"))]
         let mut file = NamedTempFile::new()?;
+        #[cfg(target_arch = "wasm32")]
+        let mut file = NamedTempFile::new_in(".")?;
         let file_path = if args.datafile.is_empty() {
             // Write some test data to the first handle.
             file.write_all(args.data.as_bytes())?;
@@ -1277,14 +1283,13 @@ impl KclServiceImpl {
     /// # fs::remove_file(path.clone()).unwrap();
     /// ```
     pub fn rename(&self, args: &RenameArgs) -> anyhow::Result<RenameResult> {
-        let pkg_root = PathBuf::from(args.package_root.clone())
-            .canonicalize()?
+        let pkg_root = normalize_path(&PathBuf::from(args.package_root.clone()))?
             .display()
             .to_string();
         let symbol_path = args.symbol_path.clone();
         let mut file_paths = vec![];
         for path in args.file_paths.iter() {
-            file_paths.push(PathBuf::from(path).canonicalize()?.display().to_string());
+            file_paths.push(normalize_path(&PathBuf::from(path))?.display().to_string());
         }
         let new_name = args.new_name.clone();
         Ok(RenameResult {
@@ -1447,6 +1452,53 @@ impl KclServiceImpl {
                 .collect(),
         })
     }
+
+    #[cfg(target_arch = "wasm32")]
+    /// update_dependencies is unavailable on WASM/WASI: resolving module
+    /// dependencies requires network access and git subprocesses, which the
+    /// WASI sandbox does not provide. This returns a graceful error (instead
+    /// of the dispatcher panicking on the unknown method name) so the WASM
+    /// instance stays usable.
+    pub fn update_dependencies(
+        &self,
+        _args: &UpdateDependenciesArgs,
+    ) -> anyhow::Result<UpdateDependenciesResult> {
+        anyhow::bail!(
+            "updating dependencies is not supported in the WASM build: the WASI sandbox has no network access or subprocess support to download KCL modules"
+        )
+    }
+}
+
+/// Normalize a path for the rename service.
+///
+/// On native targets this is `fs::canonicalize` (resolving symlinks). On
+/// WASM/WASI `fs::canonicalize` is unsupported, so fall back to a lexical
+/// normalization that resolves `.` and `..` segments against the sandbox
+/// working directory without touching the filesystem (WASI preview1 has no
+/// path resolution against symlinks anyway).
+#[cfg(not(target_arch = "wasm32"))]
+fn normalize_path(path: &std::path::Path) -> anyhow::Result<PathBuf> {
+    Ok(path.canonicalize()?)
+}
+
+#[cfg(target_arch = "wasm32")]
+fn normalize_path(path: &std::path::Path) -> anyhow::Result<PathBuf> {
+    use std::path::Component;
+    let mut normalized = if path.is_absolute() {
+        PathBuf::new()
+    } else {
+        std::env::current_dir()?
+    };
+    for component in path.components() {
+        match component {
+            Component::CurDir => {}
+            Component::ParentDir => {
+                normalized.pop();
+            }
+            other => normalized.push(other.as_os_str()),
+        }
+    }
+    Ok(normalized)
 }
 
 #[cfg(test)]
```

**File**: `crates/evaluator/src/lib.rs` (modified, +7/-0)
```diff
@@ -222,6 +222,13 @@ impl<'ctx> Evaluator<'ctx> {
         let modules = self.program.get_modules_for_pkg(kcl_ast::MAIN_PKG);
         self.init_scope(kcl_ast::MAIN_PKG);
         self.compile_ast_modules(&modules);
+        // On wasm32, runtime errors from check/assert blocks are recorded
+        // into the context instead of panicking (panic=abort would trap the
+        // whole WASI instance); bail out with the recorded error here.
+        #[cfg(target_arch = "wasm32")]
+        if let Some(info) = self.runtime_ctx.borrow().get_panic_info_json_string() {
+            return Err(anyhow::anyhow!(info));
+        }
         Ok(self.plan_globals_to_string())
     }
 
```

**File**: `crates/evaluator/src/node.rs` (modified, +17/-2)
```diff
@@ -269,9 +269,24 @@ impl<'ctx> TypedResultWalker<'ctx> for Evaluator<'ctx> {
             };
             if !assert_result.is_truthy() {
                 let mut ctx = self.runtime_ctx.borrow_mut();
-                ctx.set_err_type(&RuntimeErrorType::AssertionError);
                 let msg = msg.as_str();
-                panic!("{}", msg);
+                // On wasm32, record the error instead of panicking: the
+                // build uses panic=abort, so a panic would trap and destroy
+                // the whole WASI instance. The evaluator bails out after
+                // the run finishes.
+                #[cfg(target_arch = "wasm32")]
+                {
+                    if !ctx.has_panic_info() {
+                        ctx.record_runtime_error_message(msg.to_string());
+                    }
+                    ctx.set_err_type(&RuntimeErrorType::AssertionError);
+                    return;
+                }
+                #[cfg(not(target_arch = "wasm32"))]
+                {
+                    ctx.set_err_type(&RuntimeErrorType::AssertionError);
+                    panic!("{}", msg);
+                }
             }
         };
         if let Some(if_cond) = &assert_stmt.if_cond {
```

**File**: `crates/evaluator/src/rule.rs` (modified, +15/-0)
```diff
@@ -142,8 +142,23 @@ pub fn rule_check(
     }
     // Call self check function
     for check_expr in &ctx.borrow().node.checks {
+        #[cfg(not(target_arch = "wasm32"))]
         s.walk_check_expr(&check_expr.node)
             .expect(kcl_error::RUNTIME_ERROR_MSG);
+        // On wasm32 a panic would trap the whole WASI instance (the build
+        // uses panic=abort); record the error instead and let the evaluator
+        // bail out with it after the run finishes.
+        #[cfg(target_arch = "wasm32")]
+        if let Err(err) = s.walk_check_expr(&check_expr.node) {
+            let mut runtime_ctx = s.runtime_ctx.borrow_mut();
+            if !runtime_ctx.has_panic_info() {
+                runtime_ctx.record_runtime_error_message(format!(
+                    "{}: {}",
+                    kcl_error::RUNTIME_ERROR_MSG,
+                    err
+                ));
+            }
+        }
     }
     ctx.borrow().value.clone()
 }
```

**File**: `crates/evaluator/src/schema.rs` (modified, +15/-0)
```diff
@@ -801,8 +801,23 @@ pub(crate) fn schema_check(
     {
         let ctx = ctx.borrow();
         for check_expr in &ctx.node.checks {
+            #[cfg(not(target_arch = "wasm32"))]
             s.walk_check_expr(&check_expr.node)
                 .expect(kcl_error::RUNTIME_ERROR_MSG);
+            // On wasm32 a panic would trap the whole WASI instance (the
+            // build uses panic=abort); record the error instead and let the
+            // evaluator bail out with it after the run finishes.
+            #[cfg(target_arch = "wasm32")]
+            if let Err(err) = s.walk_check_expr(&check_expr.node) {
+                let mut runtime_ctx = s.runtime_ctx.borrow_mut();
+                if !runtime_ctx.has_panic_info() {
+                    runtime_ctx.record_runtime_error_message(format!(
+                        "{}: {}",
+                        kcl_error::RUNTIME_ERROR_MSG,
+                        err
+                    ));
+                }
+            }
         }
     }
 
```

**File**: `crates/runtime/src/context/mod.rs` (modified, +23/-0)
```diff
@@ -180,6 +180,29 @@ impl crate::Context {
         self.panic_info.rust_col = record.rust_col;
     }
 
+    /// Whether a runtime error was already recorded. The first recorded
+    /// error wins, mirroring the native behavior where the first panic
+    /// unwinds the evaluation and later errors are never evaluated.
+    #[cfg(target_arch = "wasm32")]
+    pub fn has_panic_info(&self) -> bool {
+        self.panic_info.__kcl_PanicInfo__
+    }
+
+    /// Record a runtime error message without panicking. On wasm32 the
+    /// module is built with `panic = abort`, so the panic-based error
+    /// propagation used on native targets would trap and destroy the whole
+    /// WASI instance. The evaluator bails out with the recorded panic info
+    /// after the evaluation finishes instead.
+    #[cfg(target_arch = "wasm32")]
+    pub fn record_runtime_error_message(&mut self, message: String) {
+        let record = RuntimePanicRecord {
+            kcl_panic_info: true,
+            message,
+            ..Default::default()
+        };
+        self.set_panic_info(&record);
+    }
+
     pub fn gc(&self) {
         unsafe {
             for o in &self.objects {
```

**File**: `crates/runtime/src/value/val_schema.rs` (modified, +8/-0)
```diff
@@ -37,6 +37,13 @@ pub fn schema_config_meta(filename: &str, line: u64, column: u64) -> ValueRef {
 
 pub fn schema_assert(ctx: &mut Context, value: &ValueRef, msg: &str, config_meta: &ValueRef) {
     if !value.is_truthy() {
+        // On wasm32, record the error instead of panicking below: the WASM
+        // build uses panic=abort, so a panic would trap and destroy the
+        // whole WASI instance. The evaluator bails out after finishing.
+        #[cfg(target_arch = "wasm32")]
+        if !ctx.has_panic_info() {
+            ctx.record_runtime_error_message(msg.to_string());
+        }
         ctx.set_err_type(&RuntimeErrorType::SchemaCheckFailure);
         if let Some(config_meta_file) = config_meta.get_by_key(CONFIG_META_FILENAME) {
             let config_meta_line = config_meta.get_by_key(CONFIG_META_LINE).unwrap();
@@ -59,6 +66,7 @@ pub fn schema_assert(ctx: &mut Context, value: &ValueRef, msg: &str, config_meta
         );
         ctx.set_kcl_location_info(Some(arg_msg.as_str()), None, None, None);
 
+        #[cfg(not(target_arch = "wasm32"))]
         panic!("{}", msg);
     }
 }
```

---

### Incident Patch 7: `8613484e` (2026-09-26)
**Commit Message**: fix(runtime): scope file.* builtin operations to the current module root (#2189)

* fix(runtime): scope file.* builtin operations to the current module root

The `file.read`, `file.write`, `file.glob`, and related builtins accepted
arbitrary user-supplied paths, which let a KCL module reach outside its
own directory (e.g. via `../../../etc/passwd`). Now every path-taking
function is resolved relative to the current module's directory and a
panic is raised if the resolved path escapes via `..`.

This mirrors Kustomize's `--load-restrictor` and keeps KCL packages
self-contained, an explicit ask from kcl-lang/kcl#1886. The check is
based on the currently-executing source file in `panic_info.kcl_file`,
falling back to the runtime `workdir` for synthetic contexts.

Users who genuinely need to reach outside their package (e.g. tooling
that consumes system-wide fixtures) can opt out by setting
`KCL_FILE_SCOPE=off` (or `0`/`false`/`no`).

* Scope-check helper + 5 unit tests in `crates/runtime/src/file/utils.rs`
* `module_root` / `scope_or_panic` helpers and per-function call sites
  in `crates/runtime/src/file/mod.rs`
* Five stderr.golden files updated to reflect that scoped paths are
  no

**File**: `crates/runtime/src/file/mod.rs` (modified, +87/-18)
```diff
@@ -6,6 +6,50 @@ use crate::*;
 use glob::glob;
 use std::io::Write;
 use std::path::Path;
+use utils::{resolve_scoped_path, scope_enabled};
+
+/// Return the directory that should be treated as the root for `file.*`
+/// operations issued from this context — i.e. the directory containing the
+/// KCL source file currently being executed. Falls back to the runtime
+/// `workdir` when the current file is not set (which can happen for some
+/// synthetic/test contexts); in that case scope checks still apply, just
+/// with a different root.
+///
+/// Returns `None` if neither is available, in which case the caller should
+/// skip the scope check (the path is returned as-is).
+fn module_root(ctx: &crate::Context) -> Option<std::path::PathBuf> {
+    let file = ctx.panic_info.kcl_file.trim();
+    if !file.is_empty()
+        && let Some(parent) = std::path::Path::new(file).parent()
+        && !parent.as_os_str().is_empty()
+    {
+        return Some(parent.to_path_buf());
+    }
+    let workdir = ctx.workdir.trim();
+    if !workdir.is_empty() {
+        return Some(std::path::PathBuf::from(workdir));
+    }
+    None
+}
+
+/// Resolve `user_path` against the module root, panicking with a clear
+/// scope error if the path would escape the root. Skips the check when no
+/// module root can be determined (we'd rather let the underlying I/O fail
+/// than over-restrict on synthetic contexts) or when the user has opted
+/// out via `KCL_FILE_SCOPE=off`.
+fn scope_or_panic(ctx: &crate::Context, user_path: &str) -> std::path::PathBuf {
+    if !scope_enabled() {
+        return std::path::PathBuf::from(user_path);
+    }
+    let Some(root) = module_root(ctx) else {
+        return std::path::PathBuf::from(user_path);
+    };
+    let (resolved, err) = resolve_scoped_path(&root, user_path);
+    if let Err(msg) = err {
+        panic!("{}", msg);
+    }
+    resolved
+}
 
 /// # Safety
 /// The caller must ensure that `ctx`, `args`, and `kwargs` are valid pointers
@@ -20,8 +64,9 @@ pub unsafe extern "C-unwind" fn kcl_file_read(
     let ctx = unsafe { mut_ptr_as_ref(ctx) };
 
     if let Some(x) = get_call_arg_str(args, kwargs, 0, Some("filepath")) {
+        let x = scope_or_panic(ctx, &x);
         let contents = fs::read_to_string(&x)
-            .unwrap_or_else(|e| panic!("failed to access the file '{}': {}", x, e));
+            .unwrap_or_else(|e| panic!("failed to access the file '{}': {}", x.display(), e));
 
         let s = ValueRef::str(contents.as_ref());
         return s.into_raw(ctx);
@@ -50,8 +95,9 @@ pub unsafe extern "C-unwind" fn kcl_file_readbase64(
     let ctx = unsafe { mut_ptr_as_ref(ctx) };
 
     if let Some(x) = get_call_arg_str(args, kwargs, 0, Some("filepath")) {
-        let bytes =
-            fs::read(&x).unwrap_or_else(|e| panic!("failed to access the file '{}': {}", x, e));
+        let x = scope_or_panic(ctx, &x);
+        let bytes = fs::read(&x)
+            .unwrap_or_else(|e| panic!("failed to access the file '{}': {}", x.display(), e));
         // Use the fully-qualified path so we don't collide with the
         // local `kcl_runtime::base64` re-export that the runtime ships.
         let encoded = ::base64::encode(&bytes);
@@ -77,8 +123,17 @@ pub unsafe extern "C-unwind" fn kcl_file_glob(
     let pattern = get_call_arg_str(args, kwargs, 0, Some("pattern"))
         .expect("glob() takes exactly one argument (0 given)");
 
+    // Resolve the pattern against the module root first so that it cannot
+    // escape the package directory; glob the scoped form (this also makes
+    // relative patterns resolve against the module root rather than the
+    // process working directory).
+    let scoped_pattern = scope_or_panic(ctx, &pattern);
+    let scoped_pattern = scoped_pattern.to_str().unwrap_or(&pattern);
+
     let mut matched_paths = vec![];
-    for entry in glob(&pattern).unwrap_or_else(|e| panic!("Failed to read glob pattern: {}", e)) {
+    for entry in
+        glob(scoped_pattern).unwrap_or_else(|e| panic!("Failed to read glob pattern: {}", e))
+    {
         match entry {
             Ok(path) => matched_paths.push(path.display().to_string()),
             Err(e) => panic!("failed to access the file matching '{}': {}", pattern, e),
@@ -144,6 +199,7 @@ pub unsafe extern "C-unwind" fn kcl_file_exists(
     let ctx = unsafe { mut_ptr_as_ref(ctx) };
 
     if let Some(path) = get_call_arg_str(args, kwargs, 0, Some("filepath")) {
+        let path = scope_or_panic(ctx, &path);
         let exist = Path::new(&path).exists();
         return ValueRef::bool(exist).into_raw(ctx);
     }
@@ -166,10 +222,11 @@ pub unsafe extern "C-unwind" fn kcl_file_abs(
     let ctx = unsafe { mut_ptr_as_ref(ctx) };
 
     if let Some(path) = get_call_arg_str(args, kwargs, 0, Some("filepath")) {
+        let path = scope_or_panic(ctx, &path);
         if let Ok(abs_path) = Path::new(&path).canonicalize() {
             return ValueRef::str(abs_path.to_str().unwrap()).into_raw(ctx);

```

**File**: `crates/runtime/src/file/utils.rs` (modified, +294/-1)
```diff
@@ -1,4 +1,7 @@
-use std::{fs, path::Path};
+use std::{
+    fs,
+    path::{Component, Path, PathBuf},
+};
 
 pub(crate) fn copy_directory(src: &Path, dst: &Path) -> std::io::Result<()> {
     if !dst.exists() {
@@ -17,3 +20,293 @@ pub(crate) fn copy_directory(src: &Path, dst: &Path) -> std::io::Result<()> {
     }
     Ok(())
 }
+
+/// Resolve `user_path` against the module root derived from
+/// `module_root` and return the canonicalized absolute path. Relative paths
+/// are joined onto the canonical root; absolute paths are only accepted when
+/// they lie inside the root (compared after canonicalization, so symlinks
+/// pointing outside the root are rejected as well). Paths that would escape
+/// — via `..` or by targeting a location outside the root — come back with
+/// an error. If `module_root` itself cannot be canonicalized, the path is
+/// returned unchanged with `Ok(())` so callers can still surface a regular
+/// filesystem error (instead of a scope error) and avoid masking real bugs.
+///
+/// Set the env var `KCL_FILE_SCOPE=off` (or the literal value `"0"`,
+/// `"false"`, `"no"`) to bypass the scope check entirely — useful for
+/// ad-hoc scripts and existing tests that intentionally reach outside
+/// their package directory. See kcl-lang/kcl#1886 for context.
+pub(crate) fn resolve_scoped_path<P: AsRef<Path>>(
+    module_root: P,
+    user_path: &str,
+) -> (PathBuf, Result<(), String>) {
+    let module_root = module_root.as_ref();
+
+    // Allow opting out of the scope check.
+    if let Some(value) = std::env::var_os("KCL_FILE_SCOPE") {
+        let value = value.to_string_lossy().to_ascii_lowercase();
+        if matches!(value.as_str(), "off" | "0" | "false" | "no") {
+            return (PathBuf::from(user_path), Ok(()));
+        }
+    }
+
+    // Reject obvious traversal attempts up-front so we don't depend on the
+    // target existing (the caller's `fs::*` call will surface that error
+    // itself). This check is purely syntactic and deliberately runs before
+    // any filesystem access: `canonicalize` on the module root can fail
+    // transiently (observed on the Windows CI runners for freshly created
+    // directories), and a traversal attempt must not slip through just
+    // because the root could not be canonicalized. It is also load-bearing
+    // on Windows, where a `..` inside an otherwise verbatim path is treated
+    // literally by the filesystem.
+    if path_has_parent_ref(Path::new(user_path)) {
+        return (
+            PathBuf::from(user_path),
+            Err(format!(
+                "path '{}' escapes module root '{}'",
+                user_path,
+                module_root.display()
+            )),
+        );
+    }
+
+    let canonical_root = match fs::canonicalize(module_root) {
+        Ok(p) => p,
+        Err(_) => return (PathBuf::from(user_path), Ok(())),
+    };
+
+    let candidate = Path::new(user_path);
+    let candidate = if candidate.is_absolute() {
+        candidate.to_path_buf()
+    } else {
+        canonical_root.join(candidate)
+    };
+
+    // Absolute paths (and relative paths routed through a symlink that
+    // points outside the root) must not escape either. Compare
+    // canonicalized forms so symlink components are resolved before the
+    // check; paths that don't exist yet are canonicalized through their
+    // nearest existing ancestor so writes to new files still get checked.
+    if !path_within_root(&candidate, &canonical_root) {
+        return (
+            candidate,
+            Err(format!(
+                "path '{}' escapes module root '{}'",
+                user_path,
+                canonical_root.display()
+            )),
+        );
+    }
+
+    (candidate, Ok(()))
+}
+
+/// Canonicalize `p`, falling back to the nearest existing ancestor for paths
+/// that do not exist yet (writes to new files), re-appending the missing
+/// trailing components. Returns `None` only when no ancestor can be
+/// canonicalized at all (e.g. a path on a drive that doesn't exist).
+fn canonicalize_existing(p: &Path) -> Option<PathBuf> {
+    let mut missing = Vec::new();
+    let mut cur = p;
+    loop {
+        if let Ok(c) = fs::canonicalize(cur) {
+            let mut out = c;
+            for comp in missing.iter().rev() {
+                out.push(comp);
+            }
+            return Some(out);
+        }
+        missing.push(cur.file_name()?);
+        cur = cur.parent()?;
+    }
+}
+
+fn path_within_root(candidate: &Path, canonical_root: &Path) -> bool {
+    match canonicalize_existing(candidate) {
+        Some(cc) => cc.starts_with(canonical_root),
+        // Nothing exists up to the filesystem root (e.g. a nonexistent
+        // drive): the path cannot be inside the module root.
+        None => false,
+    }
+}
+
+fn path_has_parent_ref(p: &Path) -> bool {
+    p.components().any(|c| matches!(c, Component::ParentDir))
+}
+
+/// True if the scope check is currently enabled (i.e. `K
```

**File**: `tests/grammar/builtins/file/cp/stderr.golden` (modified, +1/-1)
```diff
@@ -2,5 +2,5 @@ error[E3M38]: EvaluationError
  --> ${CWD}/main.k:3:1
   |
 3 | file.cp("source.txt", "destination.txt")
-  |  Failed to copy from 'source.txt' to 'destination.txt': No such file or directory (os error 2)
+  |  Failed to copy from '${CWD}/source.txt' to '${CWD}/destination.txt': No such file or directory (os error 2)
   |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/file/delete/stderr.golden` (modified, +1/-1)
```diff
@@ -2,5 +2,5 @@ error[E3M38]: EvaluationError
  --> ${CWD}/main.k:3:1
   |
 3 | file.delete("test_dir")
-  |  failed to delete 'test_dir': No such file or directory (os error 2)
+  |  failed to delete '${CWD}/test_dir': No such file or directory (os error 2)
   |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/file/load_file_invalid/stderr.golden` (modified, +1/-1)
```diff
@@ -1 +1 @@
-failed to access the file 'not_exist.txt': No such file or directory
\ No newline at end of file
+failed to access the file '${CWD}/not_exist.txt': No such file or directory
\ No newline at end of file
```

**File**: `tests/grammar/builtins/file/mv/stderr.golden` (modified, +1/-1)
```diff
@@ -2,5 +2,5 @@ error[E3M38]: EvaluationError
  --> ${CWD}/main.k:3:1
   |
 3 | file.mv("source.txt", "destination.txt")
-  |  Failed to move 'source.txt' to 'destination.txt': No such file or directory (os error 2)
+  |  Failed to move '${CWD}/source.txt' to '${CWD}/destination.txt': No such file or directory (os error 2)
   |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/file/size/stderr.golden` (modified, +1/-1)
```diff
@@ -2,5 +2,5 @@ error[E3M38]: EvaluationError
  --> ${CWD}/main.k:3:1
   |
 3 | file.size("source_file.txt")
-  |  failed to get size of 'source_file.txt': No such file or directory (os error 2)
+  |  failed to get size of '${CWD}/source_file.txt': No such file or directory (os error 2)
   |
\ No newline at end of file
```

---

### Incident Patch 8: `e2721030` (2026-09-25)
**Commit Message**: ci(release): zigbuild kcl-language-server for older glibc (#2202)

* ci(release): zigbuild kcl-language-server for older glibc

The kcl-language-server binary was being built with `cargo build` on the
runner host, which links it against the runner's glibc (currently 2.39
on ubuntu-latest). This made the v0.13.0 binary unusable on common
older but still-supported Linux distributions:

  ubuntu-20.04 (glibc 2.31) - "version `GLIBC_2.39' not found"
  ubuntu-22.04 (glibc 2.35) - "version `GLIBC_2.39' not found"

kcl-lib already gets cross-compiled with cargo-zigbuild against the
glibc-2.17 baseline (the same target kcl-lib has always used), so the
two artifacts had drifted apart.

Build kcl-language-server with cargo-zigbuild against the same glibc 2.17
target so a single artifact set works on every Linux distribution the
project claims to support. musl targets still don't produce a
language-server (no change there).

Also relax the Package / upload-artifact `if:` filters so they trigger
for zigbuild Linux builds too — otherwise the binary would build but
never be packaged or uploaded.

Signed-off-by: Peefy <[REDACTED_EMAIL]>

* fix(lsp): drop the workspaces read guard before re-lockin

**File**: `.github/workflows/release.yaml` (modified, +21/-7)
```diff
@@ -22,15 +22,19 @@ jobs:
             lib_target: x86_64-unknown-linux-gnu.2.17
             lib_subpath: x86_64-unknown-linux-gnu
             lib_name: libkcl.so
-            lsp_build: native
+            lsp_build: zigbuild
+            lsp_target: x86_64-unknown-linux-gnu.2.17
+            lsp_subpath: x86_64-unknown-linux-gnu
             lsp_bin: kcl-language-server
           - target: linux-arm64
             os: ubuntu-22.04-arm
             lib_build: zigbuild
             lib_target: aarch64-unknown-linux-gnu.2.17
             lib_subpath: aarch64-unknown-linux-gnu
             lib_name: libkcl.so
-            lsp_build: native
+            lsp_build: zigbuild
+            lsp_target: aarch64-unknown-linux-gnu.2.17
+            lsp_subpath: aarch64-unknown-linux-gnu
             lsp_bin: kcl-language-server
           # Linux musl (staticlib)
           - target: linux-musl-amd64
@@ -92,12 +96,13 @@ jobs:
           override: true
 
       - name: Install cargo-zigbuild (Linux glibc / musl)
-        if: matrix.lib_build == 'zigbuild'
+        if: matrix.lib_build == 'zigbuild' || matrix.lsp_build == 'zigbuild'
         shell: bash
         run: |
           pip3 install ziglang
           cargo install --locked cargo-zigbuild
-          rustup target add ${{ matrix.lib_subpath }}
+          [ -n "${{ matrix.lib_subpath }}" ] && rustup target add ${{ matrix.lib_subpath }}
+          [ -n "${{ matrix.lsp_subpath }}" ] && rustup target add ${{ matrix.lsp_subpath }}
 
       - name: Set up MSVC dev command prompt (Windows)
         if: matrix.os == 'windows-latest'
@@ -137,7 +142,16 @@ jobs:
           mkdir -p release/lib
           cp -f target/wasm32-wasip1/release/${{ matrix.lib_name }} release/lib/
 
-      - name: Build kcl-language-server (Linux / macOS)
+      - name: "Build kcl-language-server (zigbuild: Linux glibc)"
+        if: matrix.lsp_build == 'zigbuild'
+        shell: bash
+        run: |
+          cargo zigbuild --target ${{ matrix.lsp_target }} -r \
+            --manifest-path crates/tools/src/LSP/Cargo.toml
+          mkdir -p release/language-server
+          cp -f target/${{ matrix.lsp_subpath }}/release/${{ matrix.lsp_bin }} release/language-server/
+
+      - name: "Build kcl-language-server (native: macOS)"
         if: matrix.lsp_build == 'native' && matrix.os != 'windows-latest'
         shell: bash
         run: |
@@ -170,7 +184,7 @@ jobs:
           Compress-Archive -Path release/lib/* -DestinationPath "kcl-lib-${tag}-${{ matrix.target }}.zip" -Force
 
       - name: Package kcl-language-server (Linux / macOS)
-        if: matrix.lsp_build == 'native' && matrix.os != 'windows-latest'
+        if: (matrix.lsp_build == 'native' || matrix.lsp_build == 'zigbuild') && matrix.os != 'windows-latest'
         shell: bash
         run: |
           TAG="${{ github.ref_name }}"
@@ -202,7 +216,7 @@ jobs:
           path: kcl-lib-${{ github.ref_name }}-${{ matrix.target }}.*
 
       - uses: actions/upload-artifact@v4
-        if: matrix.lsp_build == 'native'
+        if: matrix.lsp_build != 'none'
         with:
           name: kcl-language-server-${{ matrix.target }}
           if-no-files-found: error
```

**File**: `crates/tools/src/LSP/src/mod_update.rs` (modified, +63/-21)
```diff
@@ -241,11 +241,16 @@ mod tests {
             .unwrap();
     }
 
+    // The waits below answer on the server's schedule, not the test's:
+    // every hop runs on a different thread, and on heavily loaded CI
+    // runners a round trip can stall well beyond the old 30s budget.
+    const WAIT_TIMEOUT: Duration = Duration::from_secs(120);
+
     fn wait_for_notification(
         rx: &Receiver<lsp_server::Message>,
         pred: impl Fn(&lsp_server::Notification) -> bool,
     ) -> lsp_server::Notification {
-        let deadline = std::time::Instant::now() + Duration::from_secs(30);
+        let deadline = std::time::Instant::now() + WAIT_TIMEOUT;
         loop {
             let remaining = deadline.saturating_duration_since(std::time::Instant::now());
             match rx.recv_timeout(remaining) {
@@ -293,7 +298,7 @@ mod tests {
         rx: &Receiver<lsp_server::Message>,
         request_id: RequestId,
     ) -> lsp_server::Response {
-        let deadline = std::time::Instant::now() + Duration::from_secs(30);
+        let deadline = std::time::Instant::now() + WAIT_TIMEOUT;
         loop {
             let remaining = deadline.saturating_duration_since(std::time::Instant::now());
             match rx.recv_timeout(remaining) {
@@ -462,6 +467,26 @@ mod tests {
         let _ = std::fs::remove_dir_all(&dir);
     }
 
+    /// Wait until the fake toolchain's update counter reaches `target`,
+    /// polling instead of keying on a single notification: the counter is
+    /// set on the thread pool before the main loop even gets to log
+    /// anything, so it is the earliest reliable signal that an update
+    /// ran, immune to log-delivery delays on loaded machines.
+    fn wait_for_update_count(updates: &AtomicUsize, target: usize) -> usize {
+        let deadline = std::time::Instant::now() + WAIT_TIMEOUT;
+        loop {
+            let current = updates.load(Ordering::SeqCst);
+            if current >= target {
+                return current;
+            }
+            assert!(
+                std::time::Instant::now() < deadline,
+                "timed out waiting for the update counter to reach {target}"
+            );
+            std::thread::sleep(Duration::from_millis(50));
+        }
+    }
+
     #[test]
     fn execute_command_kcl_update_dependencies_runs_update() {
         let dir = temp_workspace();
@@ -479,8 +504,7 @@ mod tests {
         // path so we know the workspace is settled before we send the
         // manual command.
         open_file(&client_tx, &dir.join("main.k"));
-        wait_for_notification(&server_rx, is_log_containing("Dependencies updated"));
-        let baseline = updates.load(Ordering::SeqCst);
+        let baseline = wait_for_update_count(&updates, 1);
         assert!(
             baseline >= 1,
             "auto-trigger should have run once before the manual command",
@@ -490,28 +514,46 @@ mod tests {
         // for the workspace rooted at the given `kcl.mod` directory. The
         // handler normalizes the argument, so either the plain or the
         // canonicalized directory string works here.
-        let request_id = 1;
+        let argument = dir.canonicalize().unwrap().adjust_canonicalization();
+
+        // Manual triggers always bypass the update guard, so re-sending
+        // the command while waiting for a slow server is safe (a request
+        // handled while another update is in flight is simply skipped).
+        // Key the assertion on the update counter rather than a single
+        // notification wait, which CI runners can stall past the timeout
+        // when the whole test binary competes for a few cores.
+        let deadline = std::time::Instant::now() + WAIT_TIMEOUT;
+        let mut request_id = 1;
         send_execute_command(
             &client_tx,
             request_id,
             UPDATE_DEPENDENCIES_COMMAND,
-            // `adjust_canonicalization` returns a `String`.
-            &dir.canonicalize().unwrap().adjust_canonicalization(),
+            &argument,
         );
-
-        // The handler returns `Ok(None)` so the response carries no error;
-        // assert the LSP machinery actually answered without error.
-        let response = wait_for_response(&server_rx, RequestId::from(request_id));
-        assert!(
-            response.error.is_none(),
-            "executeCommand response should be error-free, got {:?}",
-            response.error,
-        );
-
-        // Manual triggers always bypass the guard, so the counter must
-        // advance by exactly one for this command.
-        wait_for_notification(&server_rx, is_log_containing("Dependencies updated"));
-        assert_eq!(updates.load(Ordering::SeqCst), baseline + 1);
+        loop {
+            // The handler returns `Ok(None)` so the response must not
+            // carry an error, however long the server took to answer.
+            let response = wait_for_response(&server_rx, RequestId::from(request_id));
+            a
```

**File**: `crates/tools/src/LSP/src/state.rs` (modified, +7/-1)
```diff
@@ -420,7 +420,7 @@ impl LanguageServerState {
                 match filename {
                     Ok(filename) => {
                         let uri = url_from_path(&filename).unwrap();
-                        let mut state_workspaces = self.analysis.workspaces.read();
+                        let state_workspaces = self.analysis.workspaces.read();
                         self.temporary_workspace.write().insert(file.file_id, None);
 
                         let mut may_contain = false;
@@ -463,6 +463,12 @@ impl LanguageServerState {
                                 DBState::Failed(_) => continue,
                             }
                         }
+                        // Release the workspaces read guard before the fresh
+                        // `workspaces.read()` below: parking_lot read locks
+                        // are not reentrant, so a compile thread waiting for
+                        // the write lock in between would turn the second
+                        // read into a self-deadlock.
+                        drop(state_workspaces);
 
                         if !may_contain {
                             self.log_message(format!(
```

---

### Incident Patch 9: `93d3035a` (2026-09-25)
**Commit Message**: feat(sema): enforce `_\`-prefixed top-level declarations as module-private (#1576) (#2193)

* feat(sema): enforce `_`-prefixed top-level declarations as module-private (#1576)

Top-level declarations prefixed with `_` are now rejected when referenced
from a different package, formalizing the existing convention that was
previously only honored at the JSON/YAML output layer (`show_hidden`,
`ignore_private`) and the config-merge layer (`is_private_field`).

Same-package references still resolve, so a file can use its own
helpers without ceremony. Schema attributes named `_foo` remain
inheritance-visible because they go through `schema_load_attr`, not
this branch.

A new test case (`test_resolve_program_private_cross_pkg_fail`) covers
the rejection; existing tests are unaffected.

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>
Signed-off-by: Peefy <[REDACTED_EMAIL]>

* style: apply cargo fmt

Signed-off-by: Peefy <[REDACTED_EMAIL]>

* fix(sema): unwrap resolve_program() result in private-member test (post #2191)

Signed-off-by: Peefy <[REDACTED_EMAIL]>

* test(tools): drop cross-package _b reference from lint fixture

The lint test data referenced import_test.b._b, which the new
m

**File**: `crates/sema/src/resolver/attr.rs` (modified, +16/-0)
```diff
@@ -2,6 +2,7 @@ use std::sync::Arc;
 
 use crate::builtin::system_module::{UNITS, UNITS_NUMBER_MULTIPLIER, get_system_module_members};
 use crate::builtin::{STRING_MEMBER_FUNCTIONS, get_system_member_function_ty};
+use crate::info::is_private_field;
 use crate::resolver::Resolver;
 use crate::ty::TypeKind::Schema;
 use crate::ty::{
@@ -101,6 +102,21 @@ impl<'ctx> Resolver<'_> {
                                     self.handler
                                             .add_compile_error(&format!("can not import the attribute '{}' from the module '{}'", attr, module_ty.pkgpath), range.clone());
                                 }
+                                // Enforce `_`-prefixed top-level declarations as
+                                // module-private (kcl-lang/kcl#1576). The error
+                                // is recorded but resolution continues so the
+                                // rest of the program still gets a type (Any)
+                                // and downstream symbol registration is not
+                                // short-circuited.
+                                if is_private_field(attr) && module_ty.pkgpath != self.ctx.pkgpath {
+                                    self.handler.add_compile_error(
+                                        &format!(
+                                            "cannot reference private member '{}' from module '{}'",
+                                            attr, module_ty.pkgpath
+                                        ),
+                                        range.clone(),
+                                    );
+                                }
                                 (true, v.borrow().ty.clone())
                             }
                             None => (false, self.any_ty()),
```

**File**: `crates/sema/src/resolver/test_fail_data/cross_pkg_private/file1.k` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+_internal = 42
+public_api = "ok"
\ No newline at end of file
```

**File**: `crates/sema/src/resolver/test_fail_data/cross_pkg_private/file2.k` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+import .file1
+
+leak = file1._internal
+use_public = file1.public_api
\ No newline at end of file
```

**File**: `crates/sema/src/resolver/tests.rs` (modified, +23/-0)
```diff
@@ -275,6 +275,29 @@ fn test_resolve_program_cycle_reference_fail() {
     }
 }
 
+#[test]
+fn test_resolve_program_private_cross_pkg_fail() {
+    // kcl-lang/kcl#1576: top-level declarations prefixed with `_` are
+    // module-private and must not be referenced from another package.
+    let sess = Arc::new(ParseSession::default());
+    let mut program = load_program(
+        sess.clone(),
+        &["./src/resolver/test_fail_data/cross_pkg_private/file2.k"],
+        None,
+        None,
+    )
+    .unwrap()
+    .program;
+    let scope = resolve_program(&mut program).unwrap();
+    let diagnostics = &scope.handler.diagnostics;
+    assert!(
+        diagnostics.iter().any(|d| d.messages[0]
+            .message
+            .contains("cannot reference private member '_internal' from module 'file1'")),
+        "expected the private-member diagnostic, got {diagnostics:?}"
+    );
+}
+
 #[test]
 fn test_record_used_module() {
     let sess = Arc::new(ParseSession::default());
```

**File**: `crates/tools/src/lint/test_data/import_test/b.k` (modified, +1/-1)
```diff
@@ -1 +1 @@
-_b = 1
\ No newline at end of file
+value = 1
\ No newline at end of file
```

**File**: `crates/tools/src/lint/test_data/lint.k` (modified, +1/-1)
```diff
@@ -7,6 +7,6 @@ schema Person:
     name: str
     age: int
 
-b1 = b._b
+b1 = b.value
 
 import import_test.b  # ImportPosition
```

---

### Incident Patch 10: `1f8ac019` (2026-09-25)
**Commit Message**: feat(api): register ListMethod / ListDepFiles / BuiltinService.Ping

These three RPC names were defined in `spec.proto` and routed over
JSON-RPC, but the C ABI dispatch table in `kcl_get_service_fn_ptr_by_name`
returned `unknown method name` for them. That left every language
binding that talks to KCL via `call_native` (C, C++, Python, Node.js,
Swift, dotnet, Java/Kotlin, WASM) unable to enumerate the RPC surface
or walk a KCL package even though they had typed wrappers for the
same operations.

* Register `BuiltinService.Ping` against the existing `ping` C entry —
  both services share `PingArgs`/`PingResult`, so no new function is
  needed.
* Implement `KclServiceImpl::list_method`, returning the canonical RPC
  list (kept in sync with the JSON-RPC registration in
  `service/jsonrpc.rs`), and register it as `BuiltinService.ListMethod`
  in the C ABI table.
* Implement `KclServiceImpl::list_dep_files`, walking the package
  rooted at `work_dir` (looking up to find a `kcl.mod` marker) and
  collecting its `.k` files with the requested absolute-path /
  include-all / fast-parser toggles. Register it as
  `KclService.ListDepFiles`.
* Add the matching `pub(crate) fn` C wrappers (`list

**File**: `crates/api/src/service/capi.rs` (modified, +47/-0)
```diff
@@ -32,6 +32,8 @@ impl HasErrorFormat for RenameArgs {}
 impl HasErrorFormat for RenameCodeArgs {}
 impl HasErrorFormat for TestArgs {}
 impl HasErrorFormat for UpdateDependenciesArgs {}
+impl HasErrorFormat for ListMethodArgs {}
+impl HasErrorFormat for ListDepFilesArgs {}
 
 #[allow(non_camel_case_types)]
 type kcl_service = KclServiceImpl;
@@ -226,6 +228,11 @@ pub(crate) fn kcl_get_service_fn_ptr_by_name(name: &str) -> u64 {
         "KclService.Test" => test as *const () as u64,
         #[cfg(not(target_arch = "wasm32"))]
         "KclService.UpdateDependencies" => update_dependencies as *const () as u64,
+        // BuiltinService.Ping reuses the KclService.Ping implementation —
+        // both services share the same PingArgs/PingResult message types.
+        "BuiltinService.Ping" => ping as *const () as u64,
+        "BuiltinService.ListMethod" => list_method as *const () as u64,
+        "KclService.ListDepFiles" => list_dep_files as *const () as u64,
         _ => panic!("unknown method name : {name}"),
     }
 }
@@ -680,3 +687,43 @@ pub(crate) fn update_dependencies(
         update_dependencies
     )
 }
+
+/// list_method returns the list of KCL service method names available in the
+/// underlying runtime, mirroring the JSON-RPC `BuiltinService.ListMethod`
+/// registration. `ListMethodArgs` is empty so the runtime encodes a
+/// zero-byte payload for the universal dispatcher.
+pub(crate) fn list_method(
+    serv: *mut kcl_service,
+    args: *const c_char,
+    args_len: usize,
+    result_len: *mut usize,
+) -> *const c_char {
+    call!(
+        serv,
+        args,
+        args_len,
+        result_len,
+        ListMethodArgs,
+        list_method
+    )
+}
+
+/// list_dep_files walks the KCL package rooted at `work_dir` and returns
+/// the package root, the package's path-style identifier, and the list of
+/// `.k` files reachable from there. See `KclServiceImpl::list_dep_files`
+/// for the actual implementation.
+pub(crate) fn list_dep_files(
+    serv: *mut kcl_service,
+    args: *const c_char,
+    args_len: usize,
+    result_len: *mut usize,
+) -> *const c_char {
+    call!(
+        serv,
+        args,
+        args_len,
+        result_len,
+        ListDepFilesArgs,
+        list_dep_files
+    )
+}
```

**File**: `crates/api/src/service/service_impl.rs` (modified, +106/-0)
```diff
@@ -330,6 +330,42 @@ impl KclServiceImpl {
         })
     }
 
+    /// ListMethod KclService, return the list of KCL service method names
+    /// available in the underlying runtime. Mirrors the JSON-RPC
+    /// `BuiltinService.ListMethod` registration so the C ABI dispatch table
+    /// stays in sync with what callers see over JSON-RPC.
+    pub fn list_method(&self, _args: &ListMethodArgs) -> anyhow::Result<ListMethodResult> {
+        Ok(ListMethodResult {
+            method_name_list: vec![
+                "KclService.Ping".to_owned(),
+                "KclService.GetVersion".to_owned(),
+                "KclService.ParseFile".to_owned(),
+                "KclService.ParseProgram".to_owned(),
+                "KclService.LoadPackage".to_owned(),
+                "KclService.ListOptions".to_owned(),
+                "KclService.ListVariables".to_owned(),
+                "KclService.ListDepFiles".to_owned(),
+                "KclService.ExecProgram".to_owned(),
+                "KclService.BuildProgram".to_owned(),
+                "KclService.ExecArtifact".to_owned(),
+                "KclService.OverrideFile".to_owned(),
+                "KclService.GetSchemaTypeMapping".to_owned(),
+                "KclService.GetSchemaTypeMappingUnderPath".to_owned(),
+                "KclService.FormatCode".to_owned(),
+                "KclService.FormatPath".to_owned(),
+                "KclService.LintPath".to_owned(),
+                "KclService.ValidateCode".to_owned(),
+                "KclService.LoadSettingsFiles".to_owned(),
+                "KclService.Rename".to_owned(),
+                "KclService.RenameCode".to_owned(),
+                "KclService.Test".to_owned(),
+                "KclService.UpdateDependencies".to_owned(),
+                "BuiltinService.Ping".to_owned(),
+                "BuiltinService.ListMethod".to_owned(),
+            ],
+        })
+    }
+
     /// GetVersion KclService, return the kcl service version information
     ///
     /// # Examples
@@ -582,6 +618,76 @@ impl KclServiceImpl {
     /// let result = serv.list_options(args).unwrap();
     /// assert_eq!(result.options.len(), 3);
     /// ```
+    /// ListDepFiles walks the KCL package rooted at `work_dir` and returns the
+    /// package root, the package's path-style identifier, and the list of
+    /// `.k` files reachable from there. When `work_dir` does not point at a
+    /// recognised package (no `kcl.mod`), the call falls back to listing the
+    /// `.k` files directly under `work_dir` itself.
+    pub fn list_dep_files(&self, args: &ListDepFilesArgs) -> anyhow::Result<ListDepFilesResult> {
+        use kcl_config::modfile::{KCL_FILE_SUFFIX, KCL_MOD_FILE};
+
+        let work_dir = PathBuf::from(&args.work_dir);
+        // Try to find a package root (directory containing `kcl.mod`) by
+        // walking up from `work_dir`. Fall back to `work_dir` itself if no
+        // marker file is found.
+        let mut pkgroot: Option<PathBuf> = None;
+        if work_dir.join(KCL_MOD_FILE).is_file() {
+            pkgroot = Some(work_dir.clone());
+        } else if work_dir.is_dir() {
+            // Walk up looking for a `kcl.mod` marker.
+            let mut cursor = work_dir.clone();
+            loop {
+                if cursor.join(KCL_MOD_FILE).is_file() {
+                    pkgroot = Some(cursor);
+                    break;
+                }
+                if !cursor.pop() {
+                    break;
+                }
+            }
+        }
+        let pkgroot = pkgroot.unwrap_or_else(|| work_dir.clone());
+
+        let mut files: Vec<String> = Vec::new();
+        if pkgroot.is_dir() {
+            let entries = std::fs::read_dir(&pkgroot)?;
+            for entry in entries {
+                let entry = entry?;
+                let entry_path = entry.path();
+                if !entry_path.is_file() {
+                    continue;
+                }
+                let name = match entry_path.file_name().and_then(|n| n.to_str()) {
+                    Some(n) => n,
+                    None => continue,
+                };
+                // Skip hidden files and non-KCL sources. Without
+                // `include_all` we also drop test files (`*_test.k`/`*_test/*.k`).
+                if name.starts_with('_') || !name.ends_with(KCL_FILE_SUFFIX) {
+                    continue;
+                }
+                if !args.include_all && (name.ends_with("_test.k") || name == "kcl.mod") {
+                    continue;
+                }
+                let display_path = if args.use_abs_path {
+                    std::fs::canonicalize(&entry_path)
+                        .map(|p| p.to_string_lossy().to_string())
+                        .unwrap_or_else(|_| entry_path.to_string_lossy().to_string())
+                } else {
+                    entry_path.to_string_lossy().to_string()
+                };
+                files.push(display_path);
+            }
+        }
+     
```

---

### Incident Patch 11: `3414a84a` (2026-09-25)
**Commit Message**: refactor(sema): convert panic/expect sites to Result for graceful error handling (#2191)

* refactor(sema): convert panic/expect sites to Result for graceful error handling

Convert panic/expect/unwrap sites throughout the resolver pipeline to
return Result or record diagnostics, so a missing module, a poisoned
lock, or an inconsistent scope lookup no longer aborts the whole
compile. Runtime and evaluator panics are intentionally left untouched
since those are the KCL VM error-throwing mechanism.

Resolver methods with Handler access (global.rs, ty.rs) now record
the invariant violation as a `Handler::add_panic_info` diagnostic
and fall back to a usable span instead of panicking inside an
unwrapping expression.

Free functions that walk the program (pre_process_program,
type_func_erasure_pass, type_alias_pass, fix_rel_import_path_with_file)
now return `anyhow::Result<()>`. This cascades through the public
`resolve_program` / `resolve_program_with_opts` APIs which now return
`anyhow::Result<ProgramScope>`. All call sites have been updated:

- `runner`, `loader`, `query`, `tools/lint`, `tools/LSP/{compile,rename}`
  propagate via `?` or convert the error to a diagnostic so the LSP
  

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -84,3 +84,4 @@ _a.out_*.*
 
 # KCL mod lock file
 !.mod.lock
+.vercel
```

**File**: `crates/api/src/service/jsonrpc.rs` (modified, +15/-3)
```diff
@@ -49,7 +49,11 @@ where
     E: Display,
 {
     match val {
-        Ok(val) => Ok(serde_json::to_value(val).unwrap()),
+        Ok(val) => serde_json::to_value(val).map_err(|e| Error {
+            code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
+            message: format!("failed to serialize result: {e}"),
+            data: None,
+        }),
         Err(err) => Err(Error {
             code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
             message: err.to_string(),
@@ -232,7 +236,11 @@ fn register_builtin_service(io: &mut IoHandler) {
     io.add_sync_method("BuiltinService.Ping", |params: Params| {
         let args: PingArgs = params.parse()?;
         let result = PingResult { value: args.value };
-        Ok(serde_json::to_value(result).unwrap())
+        serde_json::to_value(result).map_err(|e| Error {
+            code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
+            message: format!("failed to serialize ping result: {e}"),
+            data: None,
+        })
     });
     io.add_sync_method("BuiltinService.ListMethod", |_params: Params| {
         let result = ListMethodResult {
@@ -261,6 +269,10 @@ fn register_builtin_service(io: &mut IoHandler) {
                 "BuiltinService.PingListMethod".to_owned(),
             ],
         };
-        Ok(serde_json::to_value(result).unwrap())
+        serde_json::to_value(result).map_err(|e| Error {
+            code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
+            message: format!("failed to serialize list-method result: {e}"),
+            data: None,
+        })
     });
 }
```

**File**: `crates/ast/src/ast.rs` (modified, +17/-2)
```diff
@@ -401,10 +401,25 @@ impl From<Program> for SerializeProgram {
                         modules
                             .iter()
                             .map(|m| {
+                                // The `From<Program>` impl cannot return a
+                                // `Result`, so true invariant violations
+                                // (poisoned lock or module missing from
+                                // `modules`) have to panic. Surface them
+                                // with the standard "report a bug" prefix
+                                // so they're easy to triage from bug
+                                // reports.
                                 val.get_module(m)
-                                    .expect("Failed to acquire module lock")
+                                    .expect(
+                                        "Internal error, please report a bug to us: \
+                                         failed to acquire module lock while serializing \
+                                         program",
+                                    )
                                     .unwrap_or_else(|| {
-                                        panic!("module {:?} not found in program", m)
+                                        panic!(
+                                            "Internal error, please report a bug to us: \
+                                             module {:?} not found in program while serializing",
+                                            m
+                                        )
                                     })
                                     .clone()
                             })
```

**File**: `crates/cli/src/main.rs` (modified, +9/-1)
```diff
@@ -14,7 +14,15 @@ unsafe extern "C-unwind" {
 fn main() -> ExitCode {
     // create a vector of zero terminated strings
     let args = std::env::args()
-        .map(|arg| CString::new(arg).unwrap())
+        .map(|arg| {
+            CString::new(arg).unwrap_or_else(|err| {
+                // argv containing an interior NUL byte is unrecoverable
+                // (libkcl_main takes raw C strings), so report and exit with
+                // a generic non-zero status instead of panicking.
+                eprintln!("kcl: invalid CLI argument (contains NUL byte): {err}");
+                CString::new("kcl").expect("static literal contains no NUL byte")
+            })
+        })
         .collect::<Vec<CString>>();
     // convert the strings to raw pointers
     let c_args = args
```

**File**: `crates/driver/src/client/git.rs` (modified, +6/-6)
```diff
@@ -29,8 +29,8 @@ pub(crate) fn cmd_clone_git_repo_to(
         bail!(
             "Failed to clone Git repository {}: stdout: {} stderr: {}",
             url,
-            String::from_utf8(output.stdout).unwrap(),
-            String::from_utf8(output.stderr).unwrap()
+            String::from_utf8_lossy(&output.stdout),
+            String::from_utf8_lossy(&output.stderr)
         );
     }
     if let Some(tag_name) = tag {
@@ -42,8 +42,8 @@ pub(crate) fn cmd_clone_git_repo_to(
             bail!(
                 "Failed to checkout Git tag {}: stdout: {} stderr: {}",
                 tag_name,
-                String::from_utf8(output.stdout).unwrap(),
-                String::from_utf8(output.stderr).unwrap()
+                String::from_utf8_lossy(&output.stdout),
+                String::from_utf8_lossy(&output.stderr)
             );
         }
     } else if let Some(commit_hash) = commit {
@@ -55,8 +55,8 @@ pub(crate) fn cmd_clone_git_repo_to(
             bail!(
                 "Failed to checkout Git commit {}: stdout: {} stderr: {}",
                 commit_hash,
-                String::from_utf8(output.stdout).unwrap(),
-                String::from_utf8(output.stderr).unwrap()
+                String::from_utf8_lossy(&output.stdout),
+                String::from_utf8_lossy(&output.stderr)
             )
         }
     }
```

**File**: `crates/evaluator/src/tests.rs` (modified, +2/-2)
```diff
@@ -2032,7 +2032,7 @@ fn issue_1758_import_unused_pkg_skips_body() {
     // Compute the set of referenced packages from sema. main.k does
     // not read anything from `sub`, so `sub` should be excluded.
     let mut program = packages.program.clone();
-    let scope = kcl_sema::resolver::resolve_program(&mut program);
+    let scope = kcl_sema::resolver::resolve_program(&mut program).unwrap();
     let referenced = kcl_sema::resolver::collect_referenced_pkgs(&scope);
     let sub_pgx = packages
         .program
@@ -2144,7 +2144,7 @@ leaf_value = "from_leaf"
     // Now compute the referenced set: only `mid` is directly
     // referenced from main, so `leaf` should be absent.
     let mut program = packages.program.clone();
-    let scope = kcl_sema::resolver::resolve_program(&mut program);
+    let scope = kcl_sema::resolver::resolve_program(&mut program).unwrap();
     let referenced = kcl_sema::resolver::collect_referenced_pkgs(&scope);
     let leaf_pgx = packages
         .program
```

**File**: `crates/lib/src/capi.rs` (modified, +34/-0)
```diff
@@ -242,6 +242,40 @@ pub unsafe extern "C-unwind" fn kcl_version() -> *const c_char {
     CString::new(kcl_version::VERSION).unwrap().into_raw()
 }
 
+/// Exposes a universal KCL API entry point to the WASM host.
+///
+/// Mirrors the C ABI `call_native` from `kcl-api`: the caller passes
+/// the RPC name (e.g. `KclService.ExecProgram`) and the protobuf
+/// encoded argument bytes; the function returns the protobuf encoded
+/// result bytes as a null-terminated C string that the host is
+/// responsible for freeing with `kcl_free`.
+///
+/// On internal failure the returned string is prefixed with `ERROR:`.
+#[unsafe(no_mangle)]
+pub unsafe extern "C-unwind" fn kcl_call(
+    name_ptr: *const c_char,
+    name_len: usize,
+    args_ptr: *const u8,
+    args_len: usize,
+) -> *const c_char {
+    if name_ptr.is_null() || args_ptr.is_null() {
+        return std::ptr::null();
+    }
+
+    let name_bytes = unsafe { std::slice::from_raw_parts(name_ptr as *const u8, name_len) };
+    let arg_bytes = unsafe { std::slice::from_raw_parts(args_ptr, args_len) };
+
+    let result_bytes = match unsafe { kcl_api::call(name_bytes, arg_bytes) } {
+        Ok(bytes) => bytes,
+        Err(err) => format!("ERROR:{err}").into_bytes(),
+    };
+
+    match CString::new(result_bytes) {
+        Ok(s) => s.into_raw(),
+        Err(_) => std::ptr::null(),
+    }
+}
+
 /// Exposes a normal kcl runtime error function to the WASM host.
 #[unsafe(no_mangle)]
 pub unsafe extern "C-unwind" fn kcl_runtime_err(buffer: *mut u8, length: usize) -> isize {
```

**File**: `crates/loader/src/lib.rs` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ pub fn load_packages_with_cache(
                 ..Default::default()
             },
             Some(scope_cache),
-        );
+        )?;
         let node_ty_map = prog_scope.node_ty_map;
         Namer::find_symbols(&program, gs);
         AdvancedResolver::resolve_program(&program, gs, node_ty_map.clone())?;
```

---

### Incident Patch 12: `14a9c7c5` (2026-09-25)
**Commit Message**: fix(config): sanitize hyphens in LockDependency::gen_filename (#2188)

The OCI and Git URL branches of `gen_filename` returned the last path
segment verbatim, so a dependency whose registry or repo name contained
`-` (e.g. `oci://ghcr.io/some-org/hello-world`) ended up on disk as
`hello-world/`. KCL identifiers reject `-`, so the package could not be
imported — see kcl-lang/modules#281 — and the user had to clone the
package locally and rename the directory by hand.

Unify all three branches behind a `sanitize` closure that replaces `-`
with `_`, matching the behaviour the `name` fallback already had, and
add a regression test that exercises every branch.

Co-authored-by: Peefy <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `crates/config/src/modfile.rs` (modified, +10/-3)
```diff
@@ -117,14 +117,21 @@ pub struct LockDependency {
 
 impl LockDependency {
     pub fn gen_filename(&self) -> String {
+        // KCL identifiers do not allow `-`, so the on-disk package name and the
+        // import path derived from it must use `_` instead. Apply the
+        // normalization on every branch (git, oci, and the name fallback) so
+        // that packages whose registry or repo name contains `-` can still be
+        // resolved and imported consistently. See kcl-lang/modules#281.
+        let sanitize = |s: &str| s.replace('-', "_");
+
         if let Some(git_url) = &self.url
             && let Ok(parsed_url) = Url::parse(git_url)
             && let Some(last_segment) = parsed_url
                 .path_segments()
                 .and_then(|mut segments| segments.next_back())
         {
             let trimmed_segment = last_segment.trim_end_matches(".git");
-            return trimmed_segment.to_string();
+            return sanitize(trimmed_segment);
         }
 
         if let Some(oci_repo) = &self.repo
@@ -133,10 +140,10 @@ impl LockDependency {
                 .path_segments()
                 .and_then(|mut segments| segments.next_back())
         {
-            return last_segment.to_string();
+            return sanitize(last_segment);
         }
 
-        self.name.replace('-', "_")
+        sanitize(&self.name)
     }
 }
 
```

**File**: `crates/config/src/tests.rs` (modified, +77/-1)
```diff
@@ -9,7 +9,7 @@ use std::{
 
 use crate::{
     cache::{CacheOption, load_pkg_cache, save_pkg_cache},
-    modfile::{KCL_PKG_PATH, get_vendor_home},
+    modfile::{KCL_PKG_PATH, LockDependency, get_vendor_home},
 };
 
 #[test]
@@ -76,3 +76,79 @@ fn test_pkg_cache() {
         Some("test_data".to_string())
     )
 }
+
+/// Regression test for kcl-lang/modules#281: importing an OCI / Git package
+/// whose repo or dependency name contains `-` previously failed because
+/// `gen_filename` returned the unsanitized last URL segment. KCL identifiers
+/// disallow `-`, so the on-disk filename must use `_` instead — same as the
+/// `name` fallback branch.
+#[test]
+fn test_gen_filename_sanitizes_hyphens() {
+    // OCI repo with a hyphen in the last segment.
+    let dep = LockDependency {
+        name: "ignored".to_string(),
+        full_name: None,
+        version: None,
+        sum: None,
+        reg: Some("ghcr.io".to_string()),
+        repo: Some("oci://ghcr.io/some-org/hello-world".to_string()),
+        oci_tag: None,
+        url: None,
+        branch: None,
+        commit: None,
+        git_tag: None,
+        path: None,
+    };
+    assert_eq!(dep.gen_filename(), "hello_world");
+
+    // Git URL with a hyphen in the last segment and a `.git` suffix.
+    let dep = LockDependency {
+        name: "ignored".to_string(),
+        full_name: None,
+        version: None,
+        sum: None,
+        reg: None,
+        repo: None,
+        oci_tag: None,
+        url: Some("https://github.com/some-org/hello-world.git".to_string()),
+        branch: None,
+        commit: None,
+        git_tag: None,
+        path: None,
+    };
+    assert_eq!(dep.gen_filename(), "hello_world");
+
+    // No URL/repo → fall back to `name`.
+    let dep = LockDependency {
+        name: "hello-world".to_string(),
+        full_name: None,
+        version: None,
+        sum: None,
+        reg: None,
+        repo: None,
+        oci_tag: None,
+        url: None,
+        branch: None,
+        commit: None,
+        git_tag: None,
+        path: None,
+    };
+    assert_eq!(dep.gen_filename(), "hello_world");
+
+    // Names without hyphens must be unchanged on every branch.
+    let dep = LockDependency {
+        name: "hello_world".to_string(),
+        full_name: None,
+        version: None,
+        sum: None,
+        reg: Some("ghcr.io".to_string()),
+        repo: Some("oci://ghcr.io/some-org/hello_world".to_string()),
+        oci_tag: None,
+        url: None,
+        branch: None,
+        commit: None,
+        git_tag: None,
+        path: None,
+    };
+    assert_eq!(dep.gen_filename(), "hello_world");
+}
```

---

### Incident Patch 13: `e5cbe209` (2026-09-25)
**Commit Message**: ci(release): fix zigbuild output subpath and Windows MSVC linker

Two fixes uncovered by the v0.13.0 dry-run:

- Linux gnu zigbuild: cargo-zigbuild uses the target name without the
  GLIBC version suffix as the output directory, so
  `target/x86_64-unknown-linux-gnu.2.17/release/libkcl.so` does not
  exist — the file actually lives under
  `target/x86_64-unknown-linux-gnu/release/libkcl.so`. Split the matrix
  into `lib_target` (passed to cargo, keeps the `.2.17` GLIBC hint) and
  `lib_subpath` (used in the cp source path). Musl targets, which have
  no GLIBC suffix, set both fields to the same value.

- Windows MSVC: `ilammy/msvc-dev-cmd@v1` exposes MSVC paths via
  GITHUB_PATH, but on `shell: bash` the runner's Git Bash resolves
  `link.exe` against `/usr/bin/link.exe` (GNU coreutils' link command)
  before MSVC's link.exe. Switch all Windows build / package steps to
  `shell: pwsh` so the linker resolution matches `windows.yaml`. As a
  bonus, package Windows artifacts as `.zip` instead of `.tar.gz` since
  that's the idiomatic format on Windows.

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yaml` (modified, +55/-14)
```diff
@@ -20,13 +20,15 @@ jobs:
             os: ubuntu-latest
             lib_build: zigbuild
             lib_target: x86_64-unknown-linux-gnu.2.17
+            lib_subpath: x86_64-unknown-linux-gnu
             lib_name: libkcl.so
             lsp_build: native
             lsp_bin: kcl-language-server
           - target: linux-arm64
             os: ubuntu-22.04-arm
             lib_build: zigbuild
             lib_target: aarch64-unknown-linux-gnu.2.17
+            lib_subpath: aarch64-unknown-linux-gnu
             lib_name: libkcl.so
             lsp_build: native
             lsp_bin: kcl-language-server
@@ -35,12 +37,14 @@ jobs:
             os: ubuntu-latest
             lib_build: zigbuild
             lib_target: x86_64-unknown-linux-musl
+            lib_subpath: x86_64-unknown-linux-musl
             lib_name: libkcl.a
             lsp_build: none
           - target: linux-musl-arm64
             os: ubuntu-22.04-arm
             lib_build: zigbuild
             lib_target: aarch64-unknown-linux-musl
+            lib_subpath: aarch64-unknown-linux-musl
             lib_name: libkcl.a
             lsp_build: none
           # macOS
@@ -69,7 +73,7 @@ jobs:
           - target: wasm32-wasip1
             os: ubuntu-latest
             lib_build: wasm
-            lib_target: wasm32-wasip1
+            lib_subpath: wasm32-wasip1
             lib_name: kcl.wasm
             lsp_build: none
     runs-on: ${{ matrix.os }}
@@ -104,16 +108,24 @@ jobs:
         run: |
           cargo zigbuild --target ${{ matrix.lib_target }} -r -p kcl-lib
           mkdir -p release/lib
-          cp -f target/${{ matrix.lib_target }}/release/${{ matrix.lib_name }} release/lib/
+          cp -f target/${{ matrix.lib_subpath }}/release/${{ matrix.lib_name }} release/lib/
 
-      - name: "Build kcl-lib (native: macOS / Windows)"
-        if: matrix.lib_build == 'native'
+      - name: "Build kcl-lib (native: macOS)"
+        if: matrix.lib_build == 'native' && matrix.os != 'windows-latest'
         shell: bash
         run: |
           cargo build --release -p kcl-lib
           mkdir -p release/lib
           cp -f target/release/${{ matrix.lib_name }} release/lib/
 
+      - name: "Build kcl-lib (native: Windows MSVC)"
+        if: matrix.lib_build == 'native' && matrix.os == 'windows-latest'
+        shell: pwsh
+        run: |
+          cargo build --release -p kcl-lib
+          New-Item -ItemType Directory -Force -Path release/lib | Out-Null
+          Copy-Item -Force "target/release/${{ matrix.lib_name }}" release/lib/
+
       - name: Build kcl-lib (WASM)
         if: matrix.lib_build == 'wasm'
         shell: bash
@@ -124,47 +136,76 @@ jobs:
           mkdir -p release/lib
           cp -f target/wasm32-wasip1/release/${{ matrix.lib_name }} release/lib/
 
-      - name: Build kcl-language-server
-        if: matrix.lsp_build == 'native'
+      - name: Build kcl-language-server (Linux / macOS)
+        if: matrix.lsp_build == 'native' && matrix.os != 'windows-latest'
         shell: bash
         run: |
           cargo build --release --manifest-path crates/tools/src/LSP/Cargo.toml
           mkdir -p release/language-server
           cp -f target/release/${{ matrix.lsp_bin }} release/language-server/
 
-      - name: Package kcl-lib
+      - name: Build kcl-language-server (Windows)
+        if: matrix.lsp_build == 'native' && matrix.os == 'windows-latest'
+        shell: pwsh
+        run: |
+          cargo build --release --manifest-path crates/tools/src/LSP/Cargo.toml
+          New-Item -ItemType Directory -Force -Path release/language-server | Out-Null
+          Copy-Item -Force "target/release/${{ matrix.lsp_bin }}" release/language-server/
+
+      - name: Package kcl-lib (Linux / macOS / WASM)
+        if: matrix.os != 'windows-latest'
         shell: bash
         run: |
           TAG="${{ github.ref_name }}"
           cd release/lib
           tar -czvf "../../kcl-lib-${TAG}-${{ matrix.target }}.tar.gz" .
           cd ../..
 
-      - name: Package kcl-language-server
-        if: matrix.lsp_build == 'native'
+      - name: Package kcl-lib (Windows)
+        if: matrix.os == 'windows-latest'
+        shell: pwsh
+        run: |
+          $tag = "${{ github.ref_name }}"
+          Compress-Archive -Path release/lib/* -DestinationPath "kcl-lib-${tag}-${{ matrix.target }}.zip" -Force
+
+      - name: Package kcl-language-server (Linux / macOS)
+        if: matrix.lsp_build == 'native' && matrix.os != 'windows-latest'
         shell: bash
         run: |
           TAG="${{ github.ref_name }}"
           cd release/language-server
           tar -czvf "../../kcl-language-server-${TAG}-${{ matrix.target }}.tar.gz" .
           cd ../..
 
-      - name: List packaged artifacts
+      - name: Package kcl-language-server (Windows)
+        if: matrix.lsp_build == 'native' && matrix.os == 'windows-latest'
+        shell: pwsh
+        run: |
+          $tag = "${{ github.ref_name }}"
+          Compre
```

---

### Incident Patch 14: `3c9816f7` (2026-09-22)
**Commit Message**: feat(lsp): walk up to find kcl.mod/kcl.yaml/kcl.work workspace (fixes #1510) (#2185)

The previous lookup logic only checked the file's immediate parent directory
for `kcl.mod`/`kcl.yaml`, so opening a nested file in a sub-package that
lives below a `kcl.mod` in an ancestor directory produced the wrong
compilation workspace.

* Add `lookup_compile_unit_path_bounded`, `lookup_workspace_bounded`,
  `lookup_compile_workspace_bounded`, and `lookup_compile_workspaces_bounded`
  in `crates/driver/src/lib.rs` that walk upwards until they find a
  `kcl.work`/`kcl.mod`/`kcl.yaml` or hit `max_root` (defaults to the
  filesystem root).
* `kcl.mod` is only treated as a compile-unit root when it has a
  `[package]` section or `[profile].entries`, so legacy `[module]`-only
  manifests no longer hijack the lookup.
* `kcl.work` files are expanded into one workspace per entry, each looked
  up through the same bounded walk so a sub-package keeps its parent
  context when it has no config of its own.
* LSP:
  - `workspace_folders` now falls back to a synthetic folder derived from
    `root_uri` so the bounded lookup still has a sane `max_root` when the
    client only sends a single root URI.
  - `i

**File**: `crates/driver/src/lib.rs` (modified, +353/-99)
```diff
@@ -26,89 +26,225 @@ use std::{
 use toolchain::{Metadata, Toolchain, fill_pkg_maps_for_k_file};
 use walkdir::WalkDir;
 
-/// Get compile workspace(files and options) from a single file input.
-/// 1. Lookup entry files in kcl.yaml
-/// 2. Lookup entry files in kcl.mod
-/// 3. If not found, consider the path or folder where the file is
-///    located as the compilation entry point
-pub fn lookup_compile_workspace(
+fn default_compile_unit_res(
     tool: &dyn Toolchain,
     file: &str,
     load_pkg: bool,
 ) -> CompileUnitOptions {
-    fn default_res(tool: &dyn Toolchain, file: &str, load_pkg: bool) -> CompileUnitOptions {
-        let mut default_res: CompileUnitOptions = (vec![], None, None);
-        let mut load_opt = kcl_parser::LoadProgramOptions::default();
-        let metadata = fill_pkg_maps_for_k_file(tool, file.into(), &mut load_opt).unwrap_or(None);
-        let path = Path::new(file);
-        if let Some(ext) = path.extension() {
-            if load_pkg {
-                if let Some(parent) = path.parent()
-                    && let Ok(files) = get_kcl_files(parent, false)
-                {
-                    default_res = (files, Some(load_opt), metadata);
-                }
-            } else if ext == KCL_FILE_EXTENSION && path.is_file() {
-                default_res = (vec![file.to_string()], Some(load_opt), metadata);
+    let mut default_res: CompileUnitOptions = (vec![], None, None);
+    let mut load_opt = kcl_parser::LoadProgramOptions::default();
+    let metadata = fill_pkg_maps_for_k_file(tool, file.into(), &mut load_opt).unwrap_or(None);
+    let path = Path::new(file);
+    if let Some(ext) = path.extension() {
+        if load_pkg {
+            if let Some(parent) = path.parent()
+                && let Ok(files) = get_kcl_files(parent, false)
+            {
+                default_res = (files, Some(load_opt), metadata);
             }
+        } else if ext == KCL_FILE_EXTENSION && path.is_file() {
+            default_res = (vec![file.to_string()], Some(load_opt), metadata);
         }
-        default_res
     }
+    default_res
+}
 
-    match lookup_compile_unit_path(file) {
-        Ok(CompileUnitPath::SettingFile(dir)) => {
-            let settings_files = lookup_setting_files(&dir);
-            let files = if settings_files.is_empty() {
-                default_res(tool, file, load_pkg).0.to_vec()
-            } else {
-                vec![]
+fn lookup_setting_file_compile_unit(
+    tool: &dyn Toolchain,
+    file: &str,
+    load_pkg: bool,
+    dir: &Path,
+) -> CompileUnitOptions {
+    let settings_files = lookup_setting_files(dir);
+    let files = if settings_files.is_empty() {
+        default_compile_unit_res(tool, file, load_pkg).0.to_vec()
+    } else {
+        vec![]
+    };
+    let files: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
+    let settings_files: Vec<&str> = settings_files.iter().map(|f| f.to_str().unwrap()).collect();
+    match build_settings_pathbuf(&files, Some(settings_files), None) {
+        Ok(setting_buf) => {
+            let setting = setting_buf.settings();
+            let files = setting.input();
+
+            let work_dir = setting_buf
+                .path()
+                .clone()
+                .map(|p| p.to_string_lossy().to_string())
+                .unwrap_or_default();
+
+            let mut load_opt = kcl_parser::LoadProgramOptions {
+                work_dir: work_dir.clone(),
+                ..Default::default()
             };
-            let files: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
-            let settings_files: Vec<&str> =
-                settings_files.iter().map(|f| f.to_str().unwrap()).collect();
-            match build_settings_pathbuf(&files, Some(settings_files), None) {
-                Ok(setting_buf) => {
-                    let setting = setting_buf.settings();
-                    let files = setting.input();
-
-                    let work_dir = setting_buf
-                        .path()
-                        .clone()
-                        .map(|p| p.to_string_lossy().to_string())
-                        .unwrap_or_default();
+            let metadata =
+                fill_pkg_maps_for_k_file(tool, file.into(), &mut load_opt).unwrap_or(None);
+            if files.is_empty() {
+                default_compile_unit_res(tool, file, load_pkg)
+            } else {
+                (files, Some(load_opt), metadata)
+            }
+        }
+        Err(_) => default_compile_unit_res(tool, file, load_pkg),
+    }
+}
 
-                    let mut load_opt = kcl_parser::LoadProgramOptions {
-                        work_dir: work_dir.clone(),
-                        ..Default::default()
-                    };
-                    let metadata =
-                        fill_pkg_maps_for_k_file(tool, file.into(), &mut load_opt).unwrap_or(None);
-                    if files.is_empty() {
-                        default_res(tool, file
```

**File**: `crates/driver/src/test_data/lookup_walkup/kcl_work_proj/a/main.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+main = "work_a"
```

**File**: `crates/driver/src/test_data/lookup_walkup/kcl_work_proj/a/sub/b.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+b = "b"
```

**File**: `crates/driver/src/test_data/lookup_walkup/kcl_work_proj/kcl.work` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+workspace ./a
```

**File**: `crates/driver/src/test_data/lookup_walkup/konfig_like/base/pkg1/a.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+a = "a"
```

**File**: `crates/driver/src/test_data/lookup_walkup/konfig_like/kcl.mod` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+[module]
+name = "konfig"
```

**File**: `crates/driver/src/test_data/lookup_walkup/konfig_like/prog/prod/kcl.yaml` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+kcl_cli_configs:
+  files:
+    - main.k
```

**File**: `crates/driver/src/test_data/lookup_walkup/konfig_like/prog/prod/main.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+main = "prod"
```

---

### Incident Patch 15: `2a3b1397` (2026-09-21)
**Commit Message**: feat(lsp): auto-update dependencies through the kcl mod toolchain (fixes #1428) (#2183)

* feat(lsp): auto-update dependencies through the kcl mod toolchain (fixes #1428)

When a workspace is loaded whose third-party dependencies are missing or
outdated, the language server now updates them through the configured
kcl mod toolchain instead of leaving the user with a bare
CannotFindModule diagnostic:

- a compile that reports CannotFindModule automatically schedules
  `kcl mod update` for the workspace (bounded by a per-kcl.mod-generation
  guard, can be turned off with the client initialization option
  `kcl.mod.autoUpdate`)
- saving kcl.mod updates the dependencies of every workspace rooted at it
- the server registers a `kcl.updateDependencies` execute command and a
  CannotFindModule quick fix that runs it, so no client changes are needed
- failures are surfaced via window/showMessage instead of failing silently

On success the workspace metadata is refreshed and the workspace is
recompiled so the newly downloaded dependencies are picked up.

Signed-off-by: Peefy <[REDACTED_EMAIL]>

* chore(lsp): polish auto-update flow and drop superseded design docs

Follow-up to #1428 / PR #21

**File**: `crates/driver/src/toolchain.rs` (modified, +45/-3)
```diff
@@ -1,5 +1,5 @@
 use crate::{kcl, lookup_the_nearest_file_dir};
-use anyhow::{Result, bail};
+use anyhow::{Result, anyhow, bail};
 use kcl_config::modfile::KCL_MOD_FILE;
 use kcl_parser::LoadProgramOptions;
 use kcl_utils::pkgpath::external_pkgpath_to_rel_path_buf;
@@ -54,6 +54,19 @@ impl Default for CommandToolchain<PathBuf> {
     }
 }
 
+/// Builds a helpful error when the `kcl` executable cannot be spawned,
+/// e.g. when the CLI is not installed or not on `PATH`.
+fn command_spawn_error(operation: &str, err: std::io::Error) -> anyhow::Error {
+    if err.kind() == std::io::ErrorKind::NotFound {
+        anyhow!(
+            "failed to {operation}: the `kcl` CLI executable was not found in PATH. \
+             Install it from https://kcl-lang.io/docs/user_docs/getting-started/install"
+        )
+    } else {
+        anyhow!("failed to {operation} with error: {err}")
+    }
+}
+
 impl<S: AsRef<OsStr> + Send + Sync> Toolchain for CommandToolchain<S> {
     fn fetch_metadata(&self, manifest_path: PathBuf) -> Result<Metadata> {
         match Command::new(&self.path)
@@ -74,7 +87,7 @@ impl<S: AsRef<OsStr> + Send + Sync> Toolchain for CommandToolchain<S> {
                     String::from_utf8_lossy(&output.stdout).to_string(),
                 )?)
             }
-            Err(err) => bail!("fetch metadata failed with error: {}", err),
+            Err(err) => Err(command_spawn_error("fetch metadata", err)),
         }
     }
 
@@ -94,7 +107,7 @@ impl<S: AsRef<OsStr> + Send + Sync> Toolchain for CommandToolchain<S> {
                 }
                 Ok(())
             }
-            Err(err) => bail!("update failed with error: {}", err),
+            Err(err) => Err(command_spawn_error("update dependencies", err)),
         }
     }
 }
@@ -222,3 +235,32 @@ pub fn get_real_path_from_external(
     real_path.push(external_pkgpath_to_rel_path_buf(pkgpath));
     real_path
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn missing_cli_reports_install_hint() {
+        let tool = CommandToolchain {
+            path: PathBuf::from("kcl-binary-that-does-not-exist"),
+        };
+        let err = tool
+            .update_dependencies(PathBuf::from("."))
+            .unwrap_err()
+            .to_string();
+        assert!(
+            err.contains("not found in PATH"),
+            "unexpected error message: {err}"
+        );
+
+        let err = tool
+            .fetch_metadata(PathBuf::from("."))
+            .unwrap_err()
+            .to_string();
+        assert!(
+            err.contains("not found in PATH"),
+            "unexpected error message: {err}"
+        );
+    }
+}
```

**File**: `crates/tools/src/LSP/src/capabilities.rs` (modified, +9/-4)
```diff
@@ -1,11 +1,12 @@
 use lsp_types::{
     ClientCapabilities, CodeActionKind, CodeActionOptions, CodeActionProviderCapability,
-    CodeLensOptions, CompletionOptions, HoverProviderCapability, OneOf, SemanticTokensFullOptions,
-    SemanticTokensLegend, SemanticTokensOptions, ServerCapabilities, SignatureHelpOptions,
-    TextDocumentSyncCapability, TextDocumentSyncKind, WorkDoneProgressOptions,
+    CodeLensOptions, CompletionOptions, ExecuteCommandOptions, HoverProviderCapability, OneOf,
+    SemanticTokensFullOptions, SemanticTokensLegend, SemanticTokensOptions, ServerCapabilities,
+    SignatureHelpOptions, TextDocumentSyncCapability, TextDocumentSyncKind,
+    WorkDoneProgressOptions,
 };
 
-use crate::semantic_token::LEGEND_TYPE;
+use crate::{mod_update::UPDATE_DEPENDENCIES_COMMAND, semantic_token::LEGEND_TYPE};
 
 /// Returns the capabilities of this LSP server implementation given the capabilities of the client.
 pub fn server_capabilities(client_caps: &ClientCapabilities) -> ServerCapabilities {
@@ -73,6 +74,10 @@ pub fn server_capabilities(client_caps: &ClientCapabilities) -> ServerCapabiliti
         code_lens_provider: Some(CodeLensOptions {
             resolve_provider: Some(false),
         }),
+        execute_command_provider: Some(ExecuteCommandOptions {
+            commands: vec![UPDATE_DEPENDENCIES_COMMAND.to_string()],
+            ..Default::default()
+        }),
         ..Default::default()
     }
 }
```

**File**: `crates/tools/src/LSP/src/lib.rs` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ pub mod formatting;
 pub mod goto_def;
 pub mod hover;
 pub mod inlay_hints;
+pub mod mod_update;
 pub mod quick_fix;
 pub mod rename;
 pub mod request;
```

**File**: `crates/tools/src/LSP/src/main.rs` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ mod from_lsp;
 mod goto_def;
 mod hover;
 mod inlay_hints;
+mod mod_update;
 mod notification;
 mod quick_fix;
 mod request;
```

**File**: `crates/tools/src/LSP/src/mod_update.rs` (added, +519/-0)
```diff
@@ -0,0 +1,519 @@
+//! Automatic dependency updates through the kcl mod toolchain.
+//!
+//! When a workspace is loaded whose third-party dependencies are missing or
+//! outdated, the language server can update them through
+//! [`kcl_driver::toolchain::Toolchain::update_dependencies`] (i.e. the
+//! `kcl mod update` command for the default command toolchain) instead of
+//! leaving the user with a bare `CannotFindModule` diagnostic.
+//!
+//! All entry points (a missing-module compile result, saving `kcl.mod`, and
+//! the manual `kcl.updateDependencies` command / quick fix) funnel into
+//! [`LanguageServerState::schedule_update_dependencies`], which runs the
+//! update on the thread pool and recompiles the workspace on success.
+//!
+//! See https://github.com/kcl-lang/kcl/issues/1428.
+
+use std::collections::HashMap;
+use std::path::{Path, PathBuf};
+use std::time::SystemTime;
+
+use kcl_config::modfile::{KCL_MOD_FILE, get_pkg_root};
+use kcl_driver::WorkSpaceKind;
+
+/// LSP command (registered in `execute_command_provider`) that updates the
+/// dependencies of the workspace whose `kcl.mod` lives in the given directory.
+pub(crate) const UPDATE_DEPENDENCIES_COMMAND: &str = "kcl.updateDependencies";
+
+/// What caused a dependency update to be scheduled. Manual triggers bypass
+/// the per-generation guard so an explicit user action always runs.
+#[derive(Clone, Copy, PartialEq, Eq, Debug)]
+pub(crate) enum UpdateTrigger {
+    /// Triggered automatically by a `CannotFindModule` compile result.
+    Auto,
+    /// Triggered by an explicit user action (quick fix, command, `kcl.mod` save).
+    Manual,
+}
+
+#[derive(Clone, Copy, PartialEq, Eq, Debug)]
+enum UpdateState {
+    InFlight,
+    Done,
+    Failed,
+}
+
+/// Records dependency-update attempts per workspace. Only accessed from the
+/// main loop thread.
+#[derive(Default)]
+pub(crate) struct DependencyUpdater {
+    /// The `SystemTime` is the mtime of the workspace's `kcl.mod` at the time
+    /// of the attempt, used as a generation key: changing `kcl.mod` (e.g.
+    /// through `kcl mod add`) re-arms the guard for automatic triggers.
+    states: HashMap<WorkSpaceKind, (UpdateState, SystemTime)>,
+}
+
+impl DependencyUpdater {
+    /// Begin an update attempt for `workspace` unless one is in flight, or an
+    /// automatic attempt was already made for the same `kcl.mod` generation.
+    pub(crate) fn try_begin(
+        &mut self,
+        workspace: &WorkSpaceKind,
+        generation: SystemTime,
+        trigger: UpdateTrigger,
+    ) -> bool {
+        let blocked = match self.states.get(workspace) {
+            Some((UpdateState::InFlight, _)) => true,
+            Some((_, recorded_gen))
+                if trigger == UpdateTrigger::Auto && *recorded_gen == generation =>
+            {
+                true
+            }
+            _ => false,
+        };
+        if !blocked {
+            self.states
+                .insert(workspace.clone(), (UpdateState::InFlight, generation));
+        }
+        !blocked
+    }
+
+    fn mark(&mut self, workspace: &WorkSpaceKind, state: UpdateState) {
+        if let Some(entry) = self.states.get_mut(workspace) {
+            entry.0 = state;
+        }
+    }
+
+    pub(crate) fn mark_done(&mut self, workspace: &WorkSpaceKind) {
+        self.mark(workspace, UpdateState::Done);
+    }
+
+    pub(crate) fn mark_failed(&mut self, workspace: &WorkSpaceKind) {
+        self.mark(workspace, UpdateState::Failed);
+    }
+}
+
+/// The anchor path used to resolve a workspace's `kcl.mod`.
+pub(crate) fn workspace_anchor(workspace: &WorkSpaceKind) -> Option<PathBuf> {
+    match workspace {
+        WorkSpaceKind::WorkFile(path)
+        | WorkSpaceKind::ModFile(path)
+        | WorkSpaceKind::SettingFile(path)
+        | WorkSpaceKind::Folder(path)
+        | WorkSpaceKind::File(path) => Some(path.clone()),
+        WorkSpaceKind::NotFound => None,
+    }
+}
+
+/// Resolve the directory containing the nearest `kcl.mod` for `anchor`,
+/// together with the mtime of that `kcl.mod` as the generation key.
+pub(crate) fn resolve_mod_dir(anchor: &Path) -> Option<(PathBuf, SystemTime)> {
+    let dir = get_pkg_root(anchor.to_str()?)?;
+    let modified = std::fs::metadata(Path::new(&dir).join(KCL_MOD_FILE))
+        .ok()?
+        .modified()
+        .ok()?;
+    Some((PathBuf::from(dir), modified))
+}
+
+/// The directory containing the nearest `kcl.mod` of the workspace, if any.
+pub(crate) fn workspace_mod_dir(workspace: &WorkSpaceKind) -> Option<PathBuf> {
+    workspace_anchor(workspace).and_then(|anchor| resolve_mod_dir(&anchor).map(|(dir, _)| dir))
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::state::LanguageServerState;
+    use crate::util::to_json;
+    use crossbeam_channel::{Receiver, Sender, unbounded};
+    use kcl_driver::toolchain::{Metadata, Toolchain};
+    use kcl_utils::path::PathPrefix;
+    use lsp_server::RequestId;
+    use lsp_types::notification::{
+   
```

**File**: `crates/tools/src/LSP/src/notification.rs` (modified, +41/-0)
```diff
@@ -4,6 +4,11 @@ use lsp_types::notification::{
 };
 use std::collections::HashSet;
 
+use kcl_config::modfile::KCL_MOD_FILE;
+use kcl_driver::WorkSpaceKind;
+use kcl_utils::path::PathPrefix;
+
+use crate::mod_update::{self, UpdateTrigger};
 use crate::util::apply_document_changes;
 use crate::{
     analysis::OpenFileInfo, dispatcher::NotificationDispatcher, from_lsp,
@@ -71,6 +76,42 @@ impl LanguageServerState {
 
         let path = from_lsp::abs_path(&text_document.uri)?;
         self.log_message(format!("on did save file: {:?}", path));
+
+        // Saving `kcl.mod` may have changed the dependency requirements —
+        // update the dependencies of every workspace rooted at it.
+        if path.file_name().is_some_and(|name| name == KCL_MOD_FILE)
+            && let Some(saved_dir) = {
+                let std_path: &std::path::Path = path.as_ref();
+                std_path
+                    .parent()
+                    .and_then(|parent| parent.canonicalize().ok())
+                    // `canonicalize` returns a `\\?\` UNC path on Windows;
+                    // normalize it (and convert the resulting `String`) to
+                    // match `workspace_mod_dir` (via `get_pkg_root`).
+                    .map(|parent| std::path::PathBuf::from(parent.adjust_canonicalization()))
+            }
+        {
+            let workspaces: Vec<WorkSpaceKind> =
+                self.analysis.workspaces.read().keys().cloned().collect();
+            let temporary_workspaces: Vec<WorkSpaceKind> = self
+                .temporary_workspace
+                .read()
+                .values()
+                .flatten()
+                .cloned()
+                .collect();
+            for workspace in
+                workspaces
+                    .into_iter()
+                    .chain(temporary_workspaces)
+                    .filter(|workspace| {
+                        mod_update::workspace_mod_dir(workspace).as_deref()
+                            == Some(saved_dir.as_path())
+                    })
+            {
+                self.schedule_update_dependencies(workspace, UpdateTrigger::Manual);
+            }
+        }
         Ok(())
     }
 
```

**File**: `crates/tools/src/LSP/src/quick_fix.rs` (modified, +90/-4)
```diff
@@ -1,11 +1,15 @@
 use std::collections::HashMap;
 
+use kcl_config::modfile::get_pkg_root;
 use kcl_error::{DiagnosticId, ErrorKind, WarningKind};
 use lsp_types::{
-    CodeAction, CodeActionKind, CodeActionOrCommand, Diagnostic, NumberOrString, TextEdit, Url,
+    CodeAction, CodeActionKind, CodeActionOrCommand, Command, Diagnostic, NumberOrString, TextEdit,
+    Url,
 };
 use serde_json::Value;
 
+use crate::mod_update::UPDATE_DEPENDENCIES_COMMAND;
+
 pub fn quick_fix(uri: &Url, diags: &[Diagnostic]) -> Vec<lsp_types::CodeActionOrCommand> {
     let mut code_actions: Vec<lsp_types::CodeActionOrCommand> = vec![];
     for diag in diags {
@@ -71,6 +75,24 @@ pub fn quick_fix(uri: &Url, diags: &[Diagnostic]) -> Vec<lsp_types::CodeActionOr
                             }));
                         }
                     }
+                    ErrorKind::CannotFindModule => {
+                        // The imported package may not be downloaded yet —
+                        // offer to update the dependencies through `kcl mod update`.
+                        let mod_dir = crate::from_lsp::abs_path(uri).ok().and_then(|path| {
+                            let std_path: &std::path::Path = path.as_ref();
+                            std_path
+                                .to_str()
+                                .and_then(get_pkg_root)
+                                .map(std::path::PathBuf::from)
+                        });
+                        if let Some(dir) = mod_dir {
+                            code_actions.push(CodeActionOrCommand::Command(Command {
+                                title: "Update dependencies (kcl mod update)".to_string(),
+                                command: UPDATE_DEPENDENCIES_COMMAND.to_string(),
+                                arguments: Some(vec![Value::String(dir.display().to_string())]),
+                            }));
+                        }
+                    }
                     _ => continue,
                 },
                 DiagnosticId::Warning(warn) => match warn {
@@ -148,6 +170,7 @@ pub(crate) fn convert_code_to_kcl_diag_id(code: &NumberOrString) -> Option<Diagn
             "ReimportWarning" => Some(DiagnosticId::Warning(WarningKind::ReimportWarning)),
             "CompileError" => Some(DiagnosticId::Error(ErrorKind::CompileError)),
             "InvalidSyntax" => Some(DiagnosticId::Error(ErrorKind::InvalidSyntax)),
+            "CannotFindModule" => Some(DiagnosticId::Error(ErrorKind::CannotFindModule)),
             "ImportPositionWarning" => {
                 Some(DiagnosticId::Warning(WarningKind::ImportPositionWarning))
             }
@@ -159,13 +182,15 @@ pub(crate) fn convert_code_to_kcl_diag_id(code: &NumberOrString) -> Option<Diagn
 #[cfg(test)]
 mod tests {
     use lsp_types::{
-        CodeAction, CodeActionKind, CodeActionOrCommand, Diagnostic, Position, Range, TextEdit,
-        Url, WorkspaceEdit,
+        CodeAction, CodeActionKind, CodeActionOrCommand, Diagnostic, DiagnosticSeverity,
+        NumberOrString, Position, Range, TextEdit, Url, WorkspaceEdit,
     };
     use proc_macro_crate::bench_test;
     use std::path::PathBuf;
 
-    use super::quick_fix;
+    use kcl_utils::path::PathPrefix;
+
+    use super::{UPDATE_DEPENDENCIES_COMMAND, quick_fix};
     use crate::{
         compile::{Params, compile_with_params},
         state::KCLVfs,
@@ -270,4 +295,65 @@ mod tests {
         assert_eq!(expected[0], code_actions[0]);
         assert_eq!(expected[1], code_actions[1]);
     }
+
+    #[test]
+    #[bench_test]
+    fn cannot_find_module_quick_fix_test() {
+        let dir = std::env::temp_dir().join(format!(
+            "kcl-lsp-quick-fix-{}-{}",
+            std::process::id(),
+            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
+        ));
+        std::fs::create_dir_all(&dir).unwrap();
+        std::fs::write(
+            dir.join("kcl.mod"),
+            "[package]\nname = \"quick_fix_test\"\n",
+        )
+        .unwrap();
+        let test_file = dir.join("main.k");
+        std::fs::write(&test_file, "import nonexistent_pkg\n").unwrap();
+
+        let diag = Diagnostic {
+            range: Range {
+                start: Position {
+                    line: 0,
+                    character: 0,
+                },
+                end: Position {
+                    line: 0,
+                    character: 5,
+                },
+            },
+            severity: Some(DiagnosticSeverity::ERROR),
+            code: Some(NumberOrString::String("CannotFindModule".to_string())),
+            code_description: None,
+            source: Some("kcl".to_string()),
+            message: "Cannot find the module nonexistent_pkg".to_string(),
+            related_information: None,
+            tags: None,
+            data: None,
+        };
+
+        let uri = Url::from_file_path(&test_file).unwrap();
+        let code_actions = quick_fix(&uri, &[diag]);
+
+        assert_eq!(code_a
```

**File**: `crates/tools/src/LSP/src/request.rs` (modified, +30/-1)
```diff
@@ -3,6 +3,7 @@ use crossbeam_channel::Sender;
 
 use kcl_driver::WorkSpaceKind;
 use kcl_sema::info::is_valid_kcl_name;
+use kcl_utils::path::PathPrefix;
 use lsp_types::{Location, SemanticTokensResult, TextEdit};
 use ra_ap_vfs::VfsPath;
 use std::collections::HashMap;
@@ -22,7 +23,7 @@ use crate::{
     goto_def::goto_def,
     hover,
     inlay_hints::inlay_hints,
-    quick_fix,
+    mod_update, quick_fix,
     semantic_token::semantic_tokens_full,
     signature_help::signature_help,
     state::{LanguageServerSnapshot, LanguageServerState, Task, log_message},
@@ -65,6 +66,7 @@ impl LanguageServerState {
             .on::<lsp_types::request::InlayHintRequest>(handle_inlay_hint)?
             .on::<lsp_types::request::SignatureHelpRequest>(handle_signature_help)?
             .on::<lsp_types::request::CodeLensRequest>(handle_code_lens)?
+            .on::<lsp_types::request::ExecuteCommand>(handle_execute_command)?
             .on_maybe_retry::<lsp_types::request::Completion>(handle_completion)?
             .finish();
 
@@ -257,6 +259,33 @@ pub(crate) fn handle_code_lens(
     Ok(code_lens(&file, &src))
 }
 
+/// Called when a `workspace/executeCommand` request was received.
+pub(crate) fn handle_execute_command(
+    _snapshot: LanguageServerSnapshot,
+    params: lsp_types::ExecuteCommandParams,
+    sender: Sender<Task>,
+) -> anyhow::Result<Option<serde_json::Value>> {
+    if params.command == mod_update::UPDATE_DEPENDENCIES_COMMAND {
+        // The single argument is the directory containing the workspace's
+        // `kcl.mod`. The update itself is scheduled back on the main loop.
+        // Normalize the argument (canonicalize + UNC-strip on Windows) so it
+        // matches `workspace_mod_dir` however the client constructed it;
+        // fall back to the raw argument if it cannot be canonicalized.
+        let mod_dir = params
+            .arguments
+            .first()
+            .and_then(|value| value.as_str())
+            .map(std::path::PathBuf::from)
+            .map(|dir| {
+                dir.canonicalize()
+                    .map(|canonical| std::path::PathBuf::from(canonical.adjust_canonicalization()))
+                    .unwrap_or(dir)
+            });
+        let _ = sender.send(Task::RequestUpdateDependencies(mod_dir));
+    }
+    Ok(None)
+}
+
 /// Called when a `textDocument/codeAction` request was received.
 pub(crate) fn handle_code_action(
     _snapshot: LanguageServerSnapshot,
```

#### Recent Merged Pull Requests:
- **PR #2211** (2026-10-04): fix(api): forward exec_args.work_dir in GetSchemaTypeMappingUnderPath (@Peefy)
- **PR #2210** (2026-10-04): feat(api): LoadPackage info fields, FormatTestReport and code generation RPCs (@Peefy)
- **PR #2209** (2026-10-04): feat(api): LoadPackage info fields, FormatTestReport and code generation RPCs (@Peefy)
- **PR #2208** (2026-09-29): fix(runtime): self-contained plugin stub on wasm32-unknown-unknown (@robinbraemer)
- **PR #2207** (2026-09-29): fix(lsp): wasm32 shim for Url::from_file_path / to_file_path (@robinbraemer)
- **PR #2206** (2026-10-03): fix(parser): resolve external/internal packages correctly through WASI preopens on wasm32 (@robinbraemer)
- **PR #2205** (2026-09-26): fix(api): use a single service method registry for BuiltinService.ListMethod (@Peefy)
- **PR #2204** (2026-09-26): feat(api): add sourcemap_output to ExecProgramArgs for Source Map v3 requests (@Peefy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
