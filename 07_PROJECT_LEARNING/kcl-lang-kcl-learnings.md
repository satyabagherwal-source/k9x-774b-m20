> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kcl-lang-kcl-learnings.md`  
> **Source**: github ([https://github.com/kcl-lang/kcl](https://github.com/kcl-lang/kcl))  
> **Source Version**: `971eca90`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T04:54:32.170Z  
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
> **Harvest Timestamp**: 2026-10-30T04:54:31.223Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kcl-lang/kcl`
- **Description**: KCL Language Core and API
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2439 stars

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

/// Take back the value behind a pointer that `new_mut_ptr` registered in `ctx`.
///
/// The pointer is removed from `ctx.objects` and its box is freed, so the context
/// no longer keeps an extra `ValueRef` alive. Existing value aliases are unaffected.
/// Returns `None`, leaving `p` untouched, if `ctx` does not own `p`.
///
/// # Safety
/// If `ctx` owns `p`, it must point to a live box allocated by `new_mut_ptr`.
/// No other references to that box may be used during or after this call.
/// References to the underlying reference-counted value remain valid.
pub unsafe fn take_mut_ptr(ctx: &mut Context, p: *const ValueRef) -> Option<ValueRef> {
    if ctx.objects.swap_remove(&(p as usize)) {
        Some(*unsafe { Box::from_raw(p as *mut ValueRef) })
    } else {
        None
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_take_mut_ptr() {
        let mut ctx = Context::new();
        let value = ValueRef::str("value");
        let other = new_mut_ptr(&mut ctx, ValueRef::str("other"));
        let p = new_mut_ptr(&mut ctx, value.clone());
        assert!(ctx.objects.contains(&(p as usize)));
        let taken = unsafe { take_mut_ptr(&mut ctx, p) }.unwrap();
        assert!(taken.is_same_ref(&value));
        assert_eq!(ctx.objects.len(), 1);
        assert!(ctx.objects.contains(&(other as usize)));
        assert_eq!(unsafe { ptr_as_ref(other) }.as_str(), "other");
        // The box is gone: only `value` holds the value once `taken` drops.
        drop(taken);
        assert_eq!(std::rc::Rc::strong_count(&value.rc), 1);
        // Pointers the context does not own are left alone.
        assert!(unsafe { take_mut_ptr(&mut ctx, &value) }.is_none());
        assert!(unsafe { take_mut_ptr(&mut ctx, std::ptr::null()) }.is_none());
        // Context cleanup must not free the box that was taken back.
        ctx.gc();
        assert_eq!(value.as_str(), "value");
    }

    #[test]
    fn test_take_mut_ptr_preserves_function_closure() {
        let mut ctx = Context::new();
        let method = ValueRef::str("value").load_attr("replace");
        let p = new_mut_ptr(&mut ctx, method.clone());
        let taken = unsafe { take_mut_ptr(&mut ctx, p) }.unwrap();
        assert!(taken.is_same_ref(&method));
        assert!(ctx.objects.is_empty());
        // Unlike kcl_value_delete, taking a value must not clear its closure:
        // builtins such as option(default=...) can return a shared function.
        drop(taken);
        assert_eq!(
            method.as_function().closure.arg_0().unwrap().as_str(),
            "value"
        );
    }
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

### Incident Patch 1: `fb51c4df` (2026-10-29)
**Commit Message**: fix(runtime): parse base 10 int() strings exactly and report invalid input (#2247)

int() of a base 10 string goes through to_quantity, which had several
problems:

- For the n, u and m suffixes the exponent is negative, and
  base.pow(exponent as u32) raised 1000 to about 2^32. That wraps to 0 in
  release builds and panics in debug builds, so int("1500m") returned 0
  instead of 1, which is what int(1500m) returns.
- number * base.pow(..) was unchecked, so int("9000Pi") wrapped silently to
  -8313644912125935616.
- validate_unit was passed only the first character of the suffix, so the
  INVALID_UNITS check never ran and int("1ki") returned 1024 although 1ki
  is not a valid literal.
- The number was parsed with .unwrap(), so int("abc") failed with
  "called `Result::unwrap()` on an `Err` value: ParseIntError { kind:
  InvalidDigit }", and int("") failed with "number can't be empty".
- The suffix was found by byte slicing, which panics on a non-ASCII last
  character: int("5é") failed with "start byte index 2 is not a char
  boundary".

to_quantity now matches the exact set of number literal suffixes with
strip_suffix, parses the number as an i64 and returns the exact value as
an

**File**: `crates/runtime/src/stdlib/builtin.rs` (modified, +59/-22)
```diff
@@ -1,6 +1,6 @@
 //! Copyright The KCL Authors. All rights reserved.
 
-use std::{collections::HashSet, ops::Index};
+use std::{collections::HashSet, num::IntErrorKind, ops::Index};
 
 use crate::*;
 
@@ -181,28 +181,44 @@ impl ValueRef {
                 let base = if let Some(v) = base { v.as_int() } else { 10 };
                 // When base is explicitly provided and not 10, don't use to_quantity
                 // because it's designed for decimal-based unit suffixes (Ki, Mi, Gi, etc.)
-                let number_str = if base == 10 {
-                    to_quantity(v.as_str()).to_string()
+                if base == 10 {
+                    return match to_quantity(v.as_str()) {
+                        Ok(value) => match i64::try_from(value) {
+                            Ok(value) => ValueRef::int(value),
+                            Err(_) => {
+                                panic_i64_overflow!(ctx, value);
+                            }
+                        },
+                        Err(err)
+                            if matches!(
+                                err.kind(),
+                                IntErrorKind::PosOverflow | IntErrorKind::NegOverflow
+                            ) =>
+                        {
+                            ctx.set_err_type(&RuntimeErrorType::IntOverflow);
+                            panic!("{v}: A 64 bit integer overflow")
+                        }
+                        Err(_) => panic!("invalid literal for int() with base 10: '{self}'"),
+                    };
+                }
+                // For non-base-10 parsing, strip common prefixes (0x, 0o, 0b) if present
+                // This allows parsing strings like "0xe4" with base=16
+                // Handle negative numbers by stripping the sign first
+                let s = v.as_str();
+                let is_negative = s.starts_with('-');
+                let s = if is_negative { &s[1..] } else { s };
+                let s = s
+                    .strip_prefix("0x")
+                    .or_else(|| s.strip_prefix("0X"))
+                    .or_else(|| s.strip_prefix("0o"))
+                    .or_else(|| s.strip_prefix("0O"))
+                    .or_else(|| s.strip_prefix("0b"))
+                    .or_else(|| s.strip_prefix("0B"))
+                    .unwrap_or(s);
+                let number_str = if is_negative {
+                    format!("-{s}")
                 } else {
-                    // For non-base-10 parsing, strip common prefixes (0x, 0o, 0b) if present
-                    // This allows parsing strings like "0xe4" with base=16
-                    // Handle negative numbers by stripping the sign first
-                    let s = v.as_str();
-                    let is_negative = s.starts_with('-');
-                    let s = if is_negative { &s[1..] } else { s };
-                    let s = s
-                        .strip_prefix("0x")
-                        .or_else(|| s.strip_prefix("0X"))
-                        .or_else(|| s.strip_prefix("0o"))
-                        .or_else(|| s.strip_prefix("0O"))
-                        .or_else(|| s.strip_prefix("0b"))
-                        .or_else(|| s.strip_prefix("0B"))
-                        .unwrap_or(s);
-                    if is_negative {
-                        format!("-{s}")
-                    } else {
-                        s.to_string()
-                    }
+                    s.to_string()
                 };
                 let v: i64 =
                     i64::from_str_radix(number_str.as_str(), base as u32).unwrap_or_else(|_| {
@@ -777,6 +793,27 @@ mod test_builtin {
         }
     }
 
+    #[test]
+    fn test_convert_str_to_int() {
+        let mut ctx = Context::new();
+        for (s, expected) in [("10", 10), ("1024Mi", 1073741824), ("1500m", 1)] {
+            let result = ValueRef::str(s).convert_to_int(&mut ctx, None);
+            assert_eq!(expected, result.as_int(), "int({s:?})");
+        }
+        for s in ["", "abc", "1ki", "5é"] {
+            assert_panic("invalid literal for int() with base 10", || {
+                let mut ctx = Context::new();
+                let _ = ValueRef::str(s).convert_to_int(&mut ctx, None);
+            });
+        }
+        for s in ["9000Pi", "99999999999999999999"] {
+            assert_panic("A 64 bit integer overflow", || {
+                let mut ctx = Context::new();
+                let _ = ValueRef::str(s).convert_to_int(&mut ctx, None);
+            });
+        }
+    }
+
     #[test]
     fn test_zip() {
         let mut list1 = ValueRef::list(Some(&[
```

**File**: `crates/runtime/src/units/mod.rs` (modified, +58/-30)
```diff
@@ -340,46 +340,43 @@ fn to_unit(num: f64, suffix: to_unit_suffix) -> String {
     }
 }
 
+/// Suffixes accepted by [`to_quantity`], the same set as number literal suffixes.
+const QUANTITY_SUFFIXES: [&str; 14] = [
+    "n", "u", "m", "k", "K", "M", "G", "T", "P", "Ki", "Mi", "Gi", "Ti", "Pi",
+];
+
 /// Parse and return number based on input quantity.
 ///
 /// Supported suffixes:
 /// SI: n | u | m | k | K | M | G | T | P
 /// IEC: Ki | Mi | Gi | Ti | Pi
 ///
+/// The `n`, `u` and `m` suffixes divide the number and the result truncates
+/// towards zero, as `int()` does for the number literal `1500m`.
+///
 /// Input:
 /// quantity: &str.
 ///
 /// Returns:
-/// result: i64
-pub fn to_quantity(quantity: &str) -> i64 {
-    let quantity_len = quantity.len();
-    let mut number = quantity;
-    let mut suffix: Option<&str> = None;
-    if quantity_len >= 2 && &quantity[quantity_len - 1..] == IEC_SUFFIX {
-        if EXPONENTS.contains_key(&quantity[quantity_len - 2..quantity_len - 1]) {
-            number = &quantity[..quantity_len - 2];
-            suffix = Some(&quantity[quantity_len - 2..]);
-        }
-    } else if quantity_len >= 1 && EXPONENTS.contains_key(&quantity[quantity_len - 1..]) {
-        number = &quantity[..quantity_len - 1];
-        suffix = Some(&quantity[quantity_len - 1..]);
-    }
-    if number.is_empty() {
-        panic!("number can't be empty")
-    }
-    let number: i64 = number.parse().unwrap();
-    if suffix.is_none() {
-        return number;
-    }
-    let suffix = suffix.unwrap();
-    validate_unit(&suffix[0..1]);
-    let base: i64 = if suffix.ends_with(IEC_SUFFIX) {
-        1024
-    } else {
-        1000
-    };
-    let exponent = EXPONENTS.get(&suffix[0..1]).unwrap();
-    number * (base.pow(*exponent as u32))
+/// result: the exact value, which may not fit in an i64, or the error from
+/// parsing the number before the suffix.
+pub fn to_quantity(quantity: &str) -> Result<i128, std::num::ParseIntError> {
+    let (number, suffix) = QUANTITY_SUFFIXES
+        .iter()
+        .find_map(|suffix| {
+            quantity
+                .strip_suffix(suffix)
+                .map(|number| (number, *suffix))
+        })
+        .unwrap_or((quantity, ""));
+    let number = number.parse::<i64>()? as i128;
+    Ok(match suffix {
+        "" => number,
+        "n" => number / 1_000_000_000,
+        "u" => number / 1_000_000,
+        "m" => number / 1_000,
+        _ => number * u64_unit_value(suffix) as i128,
+    })
 }
 
 /// Calculate number based on value and binary suffix.
@@ -454,3 +451,34 @@ pub fn u64_unit_value(unit: &str) -> u64 {
         _ => 1_u64,
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::to_quantity;
+    use std::num::IntErrorKind;
+
+    #[test]
+    fn test_to_quantity() {
+        assert_eq!(to_quantity("10"), Ok(10));
+        assert_eq!(to_quantity("-10"), Ok(-10));
+        assert_eq!(to_quantity("3k"), Ok(3_000));
+        assert_eq!(to_quantity("1024Mi"), Ok(1_073_741_824));
+        assert_eq!(to_quantity("1500m"), Ok(1));
+        assert_eq!(to_quantity("-1500m"), Ok(-1));
+        assert_eq!(to_quantity("2500000u"), Ok(2));
+        assert_eq!(to_quantity("3000000000n"), Ok(3));
+        // The exact value is returned even when it does not fit in an i64.
+        assert_eq!(to_quantity("9000Pi"), Ok(10_133_099_161_583_616_000));
+    }
+
+    #[test]
+    fn test_to_quantity_invalid() {
+        for quantity in ["", "Ki", "abc", "1.5", "1ki", "1mi", "5é", "5éi"] {
+            assert!(to_quantity(quantity).is_err(), "{quantity}");
+        }
+        assert_eq!(
+            to_quantity("99999999999999999999Ki").map_err(|err| *err.kind()),
+            Err(IntErrorKind::PosOverflow)
+        );
+    }
+}
```

**File**: `tests/grammar/builtins/int/quantity_fail_0/main.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+a = int("1ki")
```

**File**: `tests/grammar/builtins/int/quantity_fail_0/stderr.golden` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+error[E3M38]: EvaluationError
+ --> ${CWD}/main.k:1:1
+  |
+1 | a = int("1ki")
+  |  invalid literal for int() with base 10: '1ki'
+  |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/int/quantity_fail_1/main.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+a = int("9000Pi")
```

**File**: `tests/grammar/builtins/int/quantity_fail_1/stderr.golden` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+error[E3M38]: EvaluationError
+ --> ${CWD}/main.k:1:1
+  |
+1 | a = int("9000Pi")
+  |  10133099161583616000: A 64 bit integer overflow
+  |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/int/quantity_suffix/main.k` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# int() of a string with a number literal suffix
+a = int("1500m")
+b = int("-1500m")
+c = int("2500000u")
+d = int("3000000000n")
+e = int("3k")
+f = int("2G")
+g = int("8Gi")
+h = int("-9223372036854775808")
```

**File**: `tests/grammar/builtins/int/quantity_suffix/stdout.golden` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+a: 1
+b: -1
+c: 2
+d: 3
+e: 3000
+f: 2000000000
+g: 8589934592
+h: -9223372036854775808
```

---

### Incident Patch 2: `c09b0e8b` (2026-10-29)
**Commit Message**: perf(evaluator): free builtin call arguments and results after each call (#2249)

The evaluator's C-ABI builtin and system-module dispatch boxed a clone of
the argument list, and callees boxed their results. Context::objects kept
both boxes alive until teardown, retaining values even after the program
discarded them. Plugin dispatch already borrowed the arguments but kept
the result box in the same way.

Borrow the positional arguments, as keyword arguments already are, and
recover result boxes with take_mut_ptr. It removes tracked allocations
from Context::objects before unboxing them, while untracked borrowed
pointers are cloned and left untouched. Shared reference-counted values
remain valid, including function results whose closures must not be
cleared as kcl_value_delete would do.

Test that repeated builtin, system-module and native plugin calls do not
grow Context::objects, including a caught builtin panic. Cover unrelated
allocation cleanup, shared function/argument-container results, borrowed
result pointers and string-method argument mutation. Add an end-to-end
grammar case for shared collections, bound methods returned through
option/list, JSON, runtime.catch and schema 

**File**: `crates/evaluator/src/runtime.rs` (modified, +10/-5)
```diff
@@ -6,7 +6,7 @@ use std::{
 
 use kcl_runtime::{
     Context, SchemaTypeFunc, UnsafeWrapper, ValueRef, get_call_arg, kcl_builtin_reduce,
-    kcl_plugin_invoke, kcl_runtime_catch, ptr_as_ref,
+    kcl_plugin_invoke, kcl_runtime_catch, ptr_as_ref, take_mut_ptr,
 };
 
 use crate::Evaluator;
@@ -51,18 +51,23 @@ pub fn invoke_function(
             handler(s, args, kwargs)
         } else {
             let ctx: &mut Context = &mut s.runtime_ctx.borrow_mut();
-            // Call schema constructor twice
             let value = if func.is_external {
                 let name = format!("{}\0", func.name);
                 unsafe { kcl_plugin_invoke(ctx, name.as_ptr() as *const c_char, args, kwargs) }
             } else {
                 let call_fn: SchemaTypeFunc = unsafe { transmute_copy(&fn_ptr) };
                 args.list_append_unpack_first(closure);
-                let args = args.clone().into_raw(ctx);
+                // Pass `args` by reference like `kwargs`. Boxing it with `into_raw`
+                // would keep it in `ctx.objects` until the context is dropped.
                 unsafe { call_fn(ctx, args, kwargs) }
             };
-            let value = unsafe { ptr_as_ref(value) };
-            value.clone()
+            // Builtins and plugin dispatch return a fresh box, even when its
+            // ValueRef shares an Rc with another value. No callee keeps the box.
+            // Take it back without clearing shared function closures.
+            match unsafe { take_mut_ptr(ctx, value) } {
+                Some(value) => value,
+                None => unsafe { ptr_as_ref(value) }.clone(),
+            }
         }
     } else {
         ValueRef::undefined()
```

**File**: `crates/evaluator/src/tests.rs` (modified, +125/-0)
```diff
@@ -1513,6 +1513,131 @@ sum = testing.add(1, 1)
     insta::assert_snapshot!(format!("{}", evaluator.run().unwrap().1));
 }
 
+/// Runs `calls` iterations of builtin, member, system module and plugin calls
+/// and returns the output and the number of objects left in the context.
+fn run_builtin_calls(calls: usize) -> (String, usize) {
+    let src = format!(
+        r#"
+import json
+import regex
+import runtime
+import kcl_plugin.testing
+
+_s = "x" * 100
+
+_one = lambda i: int -> int {{
+    _a = _s.replace("x", "y")
+    _b = json.encode({{"i": i}})
+    _c = regex.replace(_a, "y+", "z")
+    _d = runtime.catch(lambda {{ int("x") }})
+    testing.add(len(_c), int(str(i)) - i) if _b and _d else 0
+}}
+
+result = sum([_one(i) for i in range({calls})])
+"#
+    );
+    let p = load_packages(&LoadPackageOptions {
+        paths: vec!["test.k".to_string()],
+        load_opts: Some(LoadProgramOptions {
+            load_plugins: true,
+            k_code_list: vec![src],
+            ..Default::default()
+        }),
+        load_builtin: false,
+        ..Default::default()
+    })
+    .unwrap();
+    let ctx = context_with_plugin();
+    let evaluator = Evaluator::new_with_runtime_ctx(&p.program, ctx.clone());
+    let output = evaluator.run().unwrap().1;
+    let objects = ctx.borrow().objects.len();
+    drop(evaluator);
+    ctx.borrow().gc();
+    (output, objects)
+}
+
+#[test]
+fn test_builtin_call_values_are_not_retained() {
+    // C-ABI calls above return a raw pointer registered in `Context::objects`.
+    // The evaluator must take those back (and must not register the argument
+    // list), including when runtime.catch catches a panic in a builtin.
+    let (output, objects) = run_builtin_calls(1);
+    assert_eq!(output, "result: 1");
+    let (output, many_objects) = run_builtin_calls(200);
+    assert_eq!(output, "result: 200");
+    assert_eq!(objects, many_objects);
+}
+
+#[test]
+fn test_builtin_call_shared_results() {
+    let program = kcl_ast::ast::Program::default();
+    let ctx = context_with_plugin();
+    let evaluator = Evaluator::new_with_runtime_ctx(&program, ctx.clone());
+    let method = ValueRef::str("xy").load_attr("replace");
+    ctx.borrow_mut()
+        .option_values
+        .insert("method".to_string(), method.clone());
+    let option =
+        evaluator.function_value_with_ptr(kcl_runtime::kcl_builtin_option as *const () as u64);
+    let mut args = ValueRef::list(Some(&[&ValueRef::str("method")]));
+    let kwargs = ValueRef::dict(None);
+    let returned = crate::runtime::invoke_function(&evaluator, &option, &mut args, &kwargs);
+    assert!(returned.is_same_ref(&method));
+    let mut args = ValueRef::list(Some(&[&ValueRef::str("x"), &ValueRef::str("z")]));
+    let result = crate::runtime::invoke_function(&evaluator, &returned, &mut args, &kwargs);
+    assert_eq!(result.as_str(), "zy");
+    // String methods pop their receiver from the shared argument list.
+    assert_eq!(args.args_len(), 2);
+    assert_eq!(method.as_function().closure.arg_0().unwrap().as_str(), "xy");
+
+    for return_kwargs in [false, true] {
+        ctx.borrow_mut().plugin_functions.insert(
+            "testing.identity".to_string(),
+            Arc::new(move |_, args, kwargs| Ok(if return_kwargs { kwargs } else { args }.clone())),
+        );
+        let plugin = ValueRef::func(0, 0, ValueRef::undefined(), "testing.identity", "", true);
+        let mut args = ValueRef::list(Some(&[&method]));
+        let kwargs = ValueRef::dict(Some(&[("method", &method)]));
+        let result = crate::runtime::invoke_function(&evaluator, &plugin, &mut args, &kwargs);
+        assert!(result.is_same_ref(if return_kwargs { &kwargs } else { &args }));
+        drop(args);
+        drop(kwargs);
+        let returned = if return_kwargs {
+            result.kwarg("method").unwrap()
+        } else {
+            result.arg_0().unwrap()
+        };
+        assert!(returned.is_same_ref(&method));
+        assert_eq!(
+            returned.as_function().closure.arg_0().unwrap().as_str(),
+            "xy"
+        );
+    }
+    assert!(ctx.borrow().objects.is_empty());
+}
+
+#[test]
+fn test_builtin_call_borrowed_result() {
+    unsafe extern "C-unwind" fn borrow_kwargs(
+        _: *mut Context,
+        _: *const ValueRef,
+        kwargs: *const ValueRef,
+    ) -> *const ValueRef {
+        kwargs
+    }
+
+    let program = kcl_ast::ast::Program::default();
+    let evaluator = Evaluator::new(&program);
+    let func = evaluator.function_value_with_ptr(borrow_kwargs as *const () as u64);
+    let mut args = ValueRef::list(None);
+    let kwargs = ValueRef::dict(Some(&[("value", &ValueRef::str("borrowed"))]));
+    let result = crate::runtime::invoke_function(&evaluator, &func, &mut args, &kwargs);
+    assert!(result.is_same_ref(&kwargs));
+    drop(kwargs);
+    assert_eq!(result.kwarg("value").unwrap().as_str(), "borrowed");
+    assert!(evaluator.runtime_ctx.borrow().objects.is_empty(
```

**File**: `crates/runtime/src/api/utils.rs` (modified, +63/-0)
```diff
@@ -15,6 +15,24 @@ pub fn new_mut_ptr(ctx: &mut Context, x: ValueRef) -> *mut ValueRef {
     ptr
 }
 
+/// Take back the value behind a pointer that `new_mut_ptr` registered in `ctx`.
+///
+/// The pointer is removed from `ctx.objects` and its box is freed, so the context
+/// no longer keeps an extra `ValueRef` alive. Existing value aliases are unaffected.
+/// Returns `None`, leaving `p` untouched, if `ctx` does not own `p`.
+///
+/// # Safety
+/// If `ctx` owns `p`, it must point to a live box allocated by `new_mut_ptr`.
+/// No other references to that box may be used during or after this call.
+/// References to the underlying reference-counted value remain valid.
+pub unsafe fn take_mut_ptr(ctx: &mut Context, p: *const ValueRef) -> Option<ValueRef> {
+    if ctx.objects.swap_remove(&(p as usize)) {
+        Some(*unsafe { Box::from_raw(p as *mut ValueRef) })
+    } else {
+        None
+    }
+}
+
 /// Free a mutable raw pointer.
 /// # Safety
 /// The caller must ensure `p` is a valid pointer obtained from `new_mut_ptr`.
@@ -128,3 +146,48 @@ pub fn assert_panic<F: FnOnce() + std::panic::UnwindSafe>(msg: &str, func: F) {
         },
     };
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_take_mut_ptr() {
+        let mut ctx = Context::new();
+        let value = ValueRef::str("value");
+        let other = new_mut_ptr(&mut ctx, ValueRef::str("other"));
+        let p = new_mut_ptr(&mut ctx, value.clone());
+        assert!(ctx.objects.contains(&(p as usize)));
+        let taken = unsafe { take_mut_ptr(&mut ctx, p) }.unwrap();
+        assert!(taken.is_same_ref(&value));
+        assert_eq!(ctx.objects.len(), 1);
+        assert!(ctx.objects.contains(&(other as usize)));
+        assert_eq!(unsafe { ptr_as_ref(other) }.as_str(), "other");
+        // The box is gone: only `value` holds the value once `taken` drops.
+        drop(taken);
+        assert_eq!(std::rc::Rc::strong_count(&value.rc), 1);
+        // Pointers the context does not own are left alone.
+        assert!(unsafe { take_mut_ptr(&mut ctx, &value) }.is_none());
+        assert!(unsafe { take_mut_ptr(&mut ctx, std::ptr::null()) }.is_none());
+        // Context cleanup must not free the box that was taken back.
+        ctx.gc();
+        assert_eq!(value.as_str(), "value");
+    }
+
+    #[test]
+    fn test_take_mut_ptr_preserves_function_closure() {
+        let mut ctx = Context::new();
+        let method = ValueRef::str("value").load_attr("replace");
+        let p = new_mut_ptr(&mut ctx, method.clone());
+        let taken = unsafe { take_mut_ptr(&mut ctx, p) }.unwrap();
+        assert!(taken.is_same_ref(&method));
+        assert!(ctx.objects.is_empty());
+        // Unlike kcl_value_delete, taking a value must not clear its closure:
+        // builtins such as option(default=...) can return a shared function.
+        drop(taken);
+        assert_eq!(
+            method.as_function().closure.arg_0().unwrap().as_str(),
+            "value"
+        );
+    }
+}
```

**File**: `tests/grammar/builtins/default/call_lifetimes/main.k` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import json
+import runtime
+
+_data = {items = ["kept", "alive"]}
+_alias = option("call_lifetimes_data", default=_data)
+_method = option("call_lifetimes_method", default="xy".replace)
+_methods = list([_method])
+_caught = runtime.catch(lambda {
+    _method()
+})
+
+schema Entry:
+    name: str
+
+_entry = Entry {name = "kept"}
+
+shared = _alias
+method = _methods[0]("x", "z")
+roundtrip = json.decode(json.encode(_alias))
+instances = [entry.name for entry in Entry.instances()]
+caught = bool(_caught)
```

**File**: `tests/grammar/builtins/default/call_lifetimes/stdout.golden` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+shared:
+  items:
+  - kept
+  - alive
+method: zy
+roundtrip:
+  items:
+  - kept
+  - alive
+instances:
+- kept
+caught: true
```

---

### Incident Patch 3: `c76186d2` (2026-10-29)
**Commit Message**: fix(runtime): reject NaN and out-of-range floats in int() instead of saturating (#2248)

int() of a float or a number multiplier value used `*v as i64`. Rust's
`as` cast saturates values outside the i64 range and turns NaN into 0, so
int(1e19) and int(9000Pi) returned 9223372036854775807 and
int(float("nan")) returned 0, all without an error. The number multiplier
path computed an overflow check, but only acted on it in debug mode.

Both paths now go through float_to_int, which truncates towards zero as
documented, fails with "A 64 bit integer overflow" (IntOverflow error
type) when the truncated value is outside the i64 range, and fails with
"cannot convert float NaN to integer" for NaN. -2^63 is still accepted,
because it is exactly i64::MIN.

A unit test covers truncation, both range boundaries, infinity and NaN.
New grammar tests cover truncation and the three error cases.

Fixes #2246

Signed-off-by: NopeCharon <[REDACTED_EMAIL]>

**File**: `crates/runtime/src/stdlib/builtin.rs` (modified, +41/-2)
```diff
@@ -19,6 +19,21 @@ impl Context {
     }
 }
 
+/// Truncate a float towards zero for `int()`. NaN and values whose result does
+/// not fit in an i64 are errors instead of saturating.
+fn float_to_int(ctx: &mut Context, v: f64) -> i64 {
+    if v.is_nan() {
+        panic!("cannot convert float NaN to integer");
+    }
+    let v = v.trunc();
+    // i64::MIN as f64 is exactly -2^63, and i64::MAX as f64 rounds up to 2^63.
+    if v < i64::MIN as f64 || v >= i64::MAX as f64 {
+        ctx.set_err_type(&RuntimeErrorType::IntOverflow);
+        panic!("{v}: A 64 bit integer overflow");
+    }
+    v as i64
+}
+
 impl ValueRef {
     pub fn any_true(&self) -> bool {
         match &*self.rc.borrow() {
@@ -155,7 +170,7 @@ impl ValueRef {
 
         match &*self.rc.borrow() {
             Value::int_value(v) => ValueRef::int(*v),
-            Value::float_value(v) => ValueRef::int(*v as i64),
+            Value::float_value(v) => ValueRef::int(float_to_int(ctx, *v)),
             Value::unit_value(v, raw, unit) => {
                 let v_i128 = crate::real_uint_value(*raw, unit);
                 let int_32_overflow = strict_range_check_i32 && v_i128 != ((v_i128 as i32) as i128);
@@ -174,7 +189,7 @@ impl ValueRef {
                     }
                 }
 
-                ValueRef::int(*v as i64)
+                ValueRef::int(float_to_int(ctx, *v))
             }
             Value::bool_value(v) => ValueRef::int(*v as i64),
             Value::str_value(v) => {
@@ -709,6 +724,30 @@ mod test_builtin {
         });
     }
 
+    #[test]
+    fn test_convert_float_to_int() {
+        let mut ctx = Context::new();
+        for (v, expected) in [
+            (1.9, 1),
+            (-1.9, -1),
+            (9.2e18, 9200000000000000000),
+            (-9223372036854775808.0, i64::MIN),
+        ] {
+            let result = ValueRef::float(v).convert_to_int(&mut ctx, None);
+            assert_eq!(expected, result.as_int(), "int({v})");
+        }
+        for v in [9223372036854775808.0, -9.3e18, 1e300, f64::INFINITY] {
+            assert_panic("A 64 bit integer overflow", || {
+                let mut ctx = Context::new();
+                let _ = ValueRef::float(v).convert_to_int(&mut ctx, None);
+            });
+        }
+        assert_panic("cannot convert float NaN to integer", || {
+            let mut ctx = Context::new();
+            let _ = ValueRef::float(f64::NAN).convert_to_int(&mut ctx, None);
+        });
+    }
+
     #[test]
     fn test_pow() {
         let mut ctx = Context::new();
```

**File**: `tests/grammar/builtins/int/float_fail_0/main.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+a = int(1e19)
```

**File**: `tests/grammar/builtins/int/float_fail_0/stderr.golden` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+error[E3M38]: EvaluationError
+ --> ${CWD}/main.k:1:1
+  |
+1 | a = int(1e19)
+  |  10000000000000000000: A 64 bit integer overflow
+  |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/int/float_fail_1/main.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+a = int(float("nan"))
```

**File**: `tests/grammar/builtins/int/float_fail_1/stderr.golden` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+error[E3M38]: EvaluationError
+ --> ${CWD}/main.k:1:1
+  |
+1 | a = int(float("nan"))
+  |  cannot convert float NaN to integer
+  |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/int/float_fail_2/main.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+a = int(9000Pi)
```

**File**: `tests/grammar/builtins/int/float_fail_2/stderr.golden` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+error[E3M38]: EvaluationError
+ --> ${CWD}/main.k:1:1
+  |
+1 | a = int(9000Pi)
+  |  10133099161583616000: A 64 bit integer overflow
+  |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/int/from_float/main.k` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+# int() of a float truncates towards zero
+a = int(1.9)
+b = int(-1.9)
+c = int(9.2e18)
+d = int(-9223372036854775808.0)
+e = int(1500m)
```

#### Recent Merged Pull Requests:
- **PR #2257** (2026-10-30): perf(evaluator): skip recording schema instances nothing can read (@steeling)
- **PR #2254** (2026-10-29): perf(runtime): cache compiled patterns in the regex module (@steeling)
- **PR #2252** (2026-10-29): perf(runtime): read schema attributes without cloning the schema config (@steeling)
- **PR #2251** (2026-10-29): fix(evaluator): restore panic info after runtime.catch catches an error (@steeling)
- **PR #2250** (2026-10-29): perf(evaluator,runtime): drop per-lookup allocations in scope helpers and is_literal_type (@steeling)
- **PR #2249** (2026-10-29): perf(evaluator): free builtin call arguments and results after each call (@steeling)

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

## X. runtime): parse base 10 int() strings exactly and report invalid input (#2247)

**RULE**:
When implementing operations in `crates/runtime/src/stdlib/builtin.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kcl-lang/kcl. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fb51c4df`: runtime): parse base 10 int() strings exactly and report invalid input (#2247). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/runtime/src/stdlib/builtin.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use std::{collections::HashSet, num::IntErrorKind, ops::Index};
                if base == 10 {
                    return match to_quantity(v.as_str()) {
                        Ok(value) => match i64::try_from(value) {
                            Ok(value) => ValueRef::int(value),
                            Err(_) => {
                                panic_i64_overflow!(ctx, value);
                            }
                        },
                        Err(err)
                            if matches!(
                                err.kind(),
                                IntErrorKind::PosOverflow | IntErrorKind::NegOverflow
                            ) =>
                        {
                            ctx.set_err_type(&RuntimeErrorType::IntOverflow);
                            panic!("{v}: A 64 bit integer overflow")
                        }
                        Err(_) => panic!("invalid literal for int() with base 10: '{self}'"),
                    };
                }
                // For non-base-10 parsing, strip common prefixes (0x, 0o, 0b) if present
                // This allows parsing strings like "0xe4" with base=16
                // Ha
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
use std::{collections::HashSet, ops::Index};
                let number_str = if base == 10 {
                    to_quantity(v.as_str()).to_string()
                    // For non-base-10 parsing, strip common prefixes (0x, 0o, 0b) if present
                    // This allows parsing strings like "0xe4" with base=16
                    // Handle negative numbers by stripping the sign first
                    let s = v.as_str();
                    let is_negative = s.starts_with('-');
                    let s = if is_negative { &s[1..] } else { s };
                    let s = s
                        .strip_prefix("0x")
                        .or_else(|| s.strip_prefix("0X"))
                        .or_else(|| s.strip_prefix("0o"))
                        .or_else(|| s.strip_prefix("0O"))
                        .or_else(|| s.strip_prefix("0b"))
                        .or_else(|| s.strip_prefix("0B"))
                        .unwrap_or(s);
                    if is_negative {
                        format!("-{s}")
                    } else {
                        s.to_string()
                    }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fb51c4df` are properly handled with clean fallback behavior.
