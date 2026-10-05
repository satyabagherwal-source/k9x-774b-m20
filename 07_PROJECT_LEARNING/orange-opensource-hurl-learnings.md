# Forensic Learning Record (Deep Inspection): Orange-OpenSource/hurl

> **Canonical Artifact**: `07_PROJECT_LEARNING/orange-opensource-hurl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Orange-OpenSource/hurl](https://github.com/Orange-OpenSource/hurl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:20:51.333Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Orange-OpenSource/hurl`
- **Description**: Hurl, run and test HTTP requests with plain text.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 19237 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/hurl/src/parallel/worker.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::{fmt, thread};

use super::job::{Job, JobResult};
use super::message::{CompletedMsg, InputReadErrorMsg, ParsingErrorMsg, RunningMsg, WorkerMessage};
use crate::runner;
use crate::runner::EventListener;
use crate::util::logger::Logger;
use crate::util::term::{Stderr, Stdout, WriteMode};
use hurl_core::error::{DisplaySourceError, OutputFormat};
use hurl_core::parser;
use hurl_core::types::Index;

/// A worker runs job in its own thread.
pub struct Worker {
    /// The id of this worker.
    worker_id: WorkerId,
    /// The thread handle of this worker.
    thread: Option<thread::JoinHandle<()>>,
}

impl fmt::Display for Worker {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "id: {}", self.worker_id)
    }
}

/// Identifier of a worker.
#[derive(Copy, Clone, Debug)]
pub struct WorkerId(pub usize);

impl From<usize> for WorkerId {
    fn from(value: usize) -> Self {
        WorkerId(value)
    }
}

impl fmt::Display for WorkerId {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Worker {
    /// Creates a new worker, with id `worker_id`.
    ///
    /// The worker spawns a new thread and process [`Job`] sent by the parallel runner through `rx`
    /// (the receiving part of the `runner -> worker` channel). Worker send message back to the
    /// runner to update the job progression thorough `tx` (the sending part of the `worker -> runner`.
    pub fn new(
        worker_id: WorkerId,
        tx: &Sender<WorkerMessage>,
        rx: &Arc<Mutex<Receiver<Job>>>,
    ) -> Self {
        let rx = Arc::clone(rx);
        let tx = tx.clone();

        let thread = thread::spawn(move || {
            loop {
                let Ok(job) = rx.lock().unwrap().recv() else {
                    return;
                };
                // In parallel execution, standard output and standard error messages are buffered
                // (in sequential mode, we'll use immediate standard output and error).
                let mut stdout = Stdout::new(WriteMode::Buffered);
                let stderr = Stderr::new(WriteMode::Buffered);

                // We also create a common logger for this run (logger verbosity can eventually be
                // mutated on each entry).
                let secrets = job.variables.secrets();
                let mut logger = Logger::new(&job.logger_options, stderr, &secrets);

                // Create a worker progress listener.
                let progress = WorkerProgress::new(worker_id, &job, &tx);

                let content = job.filename.read_to_string();
                let content = match content {
                    Ok(c) => c,
                    Err(e) => {
                        let msg = InputReadErrorMsg::new(worker_id, &job, e);
                        _ = tx.send(WorkerMessage::InputReadError(msg));
                        return;
                    }
                };

                // Try to parse the content
                let hurl_file = parser::parse_hurl_file(&content);
                let hurl_file = match hurl_file {
                    Ok(h) => h,
                    Err(error) => {
                        let filename = job.filename.to_string();
                        let message = error.render(
                            &filename,
                            &content,
                            None,
                            OutputFormat::Terminal(logger.color),
                        );
                        logger.error_rich(&message);
                        let msg = ParsingErrorMsg::new(worker_id, &job, &logger.stderr);
                        _ = tx.send(WorkerMessage::ParsingError(msg));
                        return;
                    }
                };

                // Now, we have a syntactically correct HurlFile instance, we can run it.
                let result = runner::run_entries(
                    &hurl_file.entries,
                    &content,
                    Some(&job.filename),
                    &job.runner_options,
                    &job.variables,
                    &mut stdout,
                    Some(&progress),
                    &mut logger,
                );

                if result.success && result.entries.last().is_none() {
                    logger.warning(&format!(
                        "No entry have been executed for file {}",
                        job.filename
                    ));
                }
                let job_result = JobResult::new(job, content, result);
                let msg = CompletedMsg::new(worker_id, job_result, stdout, logger.stderr);
                _ = tx.send(WorkerMessage::Completed(msg));
            }
        });

        Worker {
            worker_id,
            thread: Some(thread),
        }
    }

    /// Takes the thread out of the worker, leaving a None in its place.
    pub fn take_thread(&mut self) -> Option<thread::JoinHandle<()>> {
        self.thread.take()
    }
}

struct WorkerProgress {
    worker_id: WorkerId,
    job: Job,
    tx: Sender<WorkerMessage>,
}

impl WorkerProgress {
    fn new(worker_id: WorkerId, job: &Job, tx: &Sender<WorkerMessage>) -> Self {
        WorkerProgress {
            worker_id,
            job: job.clone(),
            tx: tx.clone(),
        }
    }
}

impl EventListener for WorkerProgress {
    fn on_entry_running(&self, current: Index, last: Index, retry_count: usize) {
        let msg = RunningMsg::new(self.worker_id, &self.job, current, last, retry_count);
        _ = self.tx.send(WorkerMessage::Running(msg));
    }
}

```

### Core Architecture Module: `packages/hurl/src/report/html/timeline/util.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
use crate::report::html::timeline::svg;
use crate::report::html::timeline::svg::Attribute::{Class, Fill, Id, ViewBox};
use crate::report::html::timeline::svg::Element;
use crate::report::html::timeline::unit::{Interval, Pixel, Px};

/// Truncates a `text` if there are more than `max_len` chars (with ellipsis).
pub fn trunc_str(text: &str, max_len: usize) -> String {
    if text.len() > max_len {
        format!("{}...", &text[0..max_len])
    } else {
        text.to_string()
    }
}

/// Returns the stripe background SVG (1 call over 2)
pub fn new_stripes(
    nb_stripes: usize,
    stripe_height: Pixel,
    pixels_x: Interval<Pixel>,
    pixels_y: Interval<Pixel>,
    color: &str,
) -> Element {
    let mut group = svg::new_group();
    group.add_attr(Class("grid-strip".to_string()));
    let x = pixels_x.start;
    let width = pixels_x.end - pixels_x.start;

    // We want to have an odd number of stripes to have a filled strip at the bottom.
    let nb_calls = 2 * (nb_stripes / 2) + 1;
    (0..nb_calls)
        .step_by(2)
        .map(|index| {
            svg::new_rect(
                x.0,
                (index as f64) * stripe_height.0 + pixels_y.start.0,
                width.0,
                stripe_height.0,
                color,
            )
        })
        .for_each(|r| group.add_child(r));
    group
}

/// Returns the SVG success icon identified by `id`.
pub fn new_success_icon(id: &str) -> Element {
    new_icon(
        id,
        512.px(),
        512.px(),
        "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z",
        "#10bb00",
    )
}

/// Returns the SVG failure icon identified by `id`.
pub fn new_failure_icon(id: &str) -> Element {
    new_icon(
        id,
        512.px(),
        512.px(),
        "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z",
        "red",
    )
}

/// Returns the SVG retry icon identified by id.
pub fn new_retry_icon(id: &str) -> Element {
    new_icon(
        id,
        512.px(),
        512.px(),
        "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z",
        "gold",
    )
}

/// Returns a SVG icon identified by `id`, with a `width` pixel by `height` pixel size, `path` and `color`.
fn new_icon(id: &str, width: Pixel, height: Pixel, path: &str, color: &str) -> Element {
    let mut symbol = svg::new_symbol();
    symbol.add_attr(Id(id.to_string()));
    symbol.add_attr(ViewBox(0.0, 0.0, width.0, height.0));
    let mut path = svg::new_path(path);
    path.add_attr(Fill(color.to_string()));
    symbol.add_child(path);
    symbol
}

#[cfg(test)]
mod tests {
    use crate::report::html::timeline::unit::{Interval, Px};
    use crate::report::html::timeline::util::{new_stripes, trunc_str};

    #[test]
    fn truncates() {
        assert_eq!(trunc_str("foo", 32), "foo");
        assert_eq!(trunc_str("abcdefgh", 3), "abc...");
    }

    #[test]
    fn create_stripes() {
        let elt = new_stripes(
            10,
            1.px(),
            Interval::new(0.px(), 10.px()),
            Interval::new(0.px(), 10.px()),
            "green",
        );
        assert_eq!(
            elt.to_string(),
            "<g class=\"grid-strip\">\
                <rect x=\"0\" y=\"0\" width=\"10\" height=\"1\" fill=\"green\" />\
                <rect x=\"0\" y=\"2\" width=\"10\" height=\"1\" fill=\"green\" />\
                <rect x=\"0\" y=\"4\" width=\"10\" height=\"1\" fill=\"green\" />\
                <rect x=\"0\" y=\"6\" width=\"10\" height=\"1\" fill=\"green\" />\
                <rect x=\"0\" y=\"8\" width=\"10\" height=\"1\" fill=\"green\" />\
                <rect x=\"0\" y=\"10\" width=\"10\" height=\"1\" fill=\"green\" />\
            </g>"
        );
    }
}

```

### Core Architecture Module: `packages/hurl/src/util/logger.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
//! Log utilities.
use hurl_core::ast::SourceInfo;
use hurl_core::error::{DisplaySourceError, OutputFormat};
use hurl_core::input::Input;
use hurl_core::text::{Format, Style, StyledString};

use crate::runner::Value;
use crate::util::redacted::Redact;
use crate::util::term::{Stderr, WriteMode};

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum ErrorFormat {
    Short,
    Long,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Verbosity {
    LowVerbose,
    Verbose,
    VeryVerbose,
}

/// A dedicated logger for an Hurl file. This logger can display rich parsing and runtime errors.
#[derive(Clone)]
pub struct Logger {
    pub(crate) color: bool,
    pub(crate) error_format: ErrorFormat,
    pub(crate) verbosity: Option<Verbosity>,
    pub(crate) stderr: Stderr,
    secrets: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LoggerOptions {
    color: bool,
    error_format: ErrorFormat,
    verbosity: Option<Verbosity>,
}

pub struct LoggerOptionsBuilder {
    color: bool,
    error_format: ErrorFormat,
    verbosity: Option<Verbosity>,
}

impl LoggerOptionsBuilder {
    /// Returns a new Logger builder with a default values.
    pub fn new() -> Self {
        LoggerOptionsBuilder::default()
    }

    /// Sets color usage.
    pub fn color(&mut self, color: bool) -> &mut Self {
        self.color = color;
        self
    }

    /// Control the format of error messages.
    /// If `error_format` is [`ErrorFormat::Long`], the HTTP request and response that has
    /// errors is displayed (headers, body, etc..)
    pub fn error_format(&mut self, error_format: ErrorFormat) -> &mut Self {
        self.error_format = error_format;
        self
    }

    /// Sets verbose logger.
    pub fn verbosity(&mut self, verbosity: Option<Verbosity>) -> &mut Self {
        self.verbosity = verbosity;
        self
    }

    /// Creates a new logger.
    pub fn build(&self) -> LoggerOptions {
        LoggerOptions {
            color: self.color,
            error_format: self.error_format,
            verbosity: self.verbosity,
        }
    }
}

impl Default for LoggerOptionsBuilder {
    fn default() -> Self {
        LoggerOptionsBuilder {
            color: false,
            error_format: ErrorFormat::Short,
            verbosity: None,
        }
    }
}

impl Logger {
    /// Creates a new instance.
    pub fn new(options: &LoggerOptions, term: Stderr, secrets: &[String]) -> Self {
        Logger {
            color: options.color,
            error_format: options.error_format,
            verbosity: options.verbosity,
            stderr: term,
            secrets: secrets.to_vec(),
        }
    }

    fn format(&self) -> Format {
        if self.color {
            Format::Ansi
        } else {
            Format::Plain
        }
    }

    /// Prints a given message to this logger [`Stderr`] instance, no matter what is the verbosity.
    pub fn info(&mut self, message: &str) {
        self.eprintln(message);
    }

    /// Prints curl cmd to this logger [`Stderr`] instance, no matter what is the verbosity.
    ///
    /// Displayed debug messages start with `*`.
    pub fn info_curl_cmd(&mut self, cmd: &str) {
        let fmt = self.format();
        let mut s = StyledString::new();
        s.push_with("*", Style::new().blue().bold());
        s.push(" ");
        s.push("Request can be run with the following curl command:\n");
        s.push_with("*", Style::new().blue().bold());
        s.push(" ");
        s.push(cmd);
        self.eprintln(&s.to_string(fmt));
    }
    /// Prints a given debug message to this logger [`Stderr`] instance, in verbose and very verbose mode.
    ///
    /// Displayed debug messages start with `*`.
    pub fn debug(&mut self, message: &str) {
        if self.verbosity.is_none() || self.verbosity == Some(Verbosity::LowVerbose) {
            return;
        }
        let fmt = self.format();
        let mut s = StyledString::new();
        s.push_with("*", Style::new().blue().bold());
        if !message.is_empty() {
            s.push(" ");
            s.push(message);
        }
        self.eprintln(&s.to_string(fmt));
    }

    /// Prints a given debug message in bold to this logger [`Stderr`] instance, in verbose and very verbose mode.
    ///
    /// Displayed debug messages start with `*`.
    pub fn debug_important(&mut self, message: &str) {
        if self.verbosity.is_none() || self.verbosity == Some(Verbosity::LowVerbose) {
            return;
        }
        let fmt = self.format();
        let mut s = StyledString::new();
        s.push_with("*", Style::new().blue().bold());
        if !message.is_empty() {
            s.push(" ");
            s.push_with(message, Style::new().bold());
        }
        self.eprintln(&s.to_string(fmt));
    }

    /// Prints a given debug message from libcurl to this logger [`Stderr`] instance, in verbose and very verbose mode.
    ///
    /// Displayed libcurl debug messages start with `**`.
    pub fn debug_curl(&mut self, message: &str) {
        if self.verbosity.is_none() || self.verbosity == Some(Verbosity::LowVerbose) {
            return;
        }
        let fmt = self.format();
        let mut s = StyledString::new();
        s.push_with("**", Style::new().blue().bold());
        if !message.is_empty() {
            s.push(" ");
            s.push(message);
        }
        self.eprintln(&s.to_string(fmt));
    }

    /// Prints an error (syntax error or runtime error) to this logger [`Stderr`] instance, in verbose and very verbose mode.
    pub fn debug_error<E: DisplaySourceError>(
        &mut self,
        content: &str,
        filename: Option<&Input>,
        error: &E,
        entry_src_info: SourceInfo,
    ) {
        if self.verbosity.is_none() {
            return;
        }
        let filename = filename.map_or(String::new(), |f| f.to_string());
        let message = error.render(
            &filename,
            content,
            Some(entry_src_info),
            OutputFormat::Terminal(self.color),
        );
        message.lines().for_each(|l| self.debug(l));
    }

    /// Prints a HTTP response header to this logger [`Stderr`] instance, in verbose and very verbose mode.
    ///
    /// Response HTTP headers start with `<`.
    pub fn debug_header_in(&mut self, name: &str, value: &str) {
        if self.verbosity.is_none() {
            return;
        }
        let fmt = self.format();

        let mut s = StyledString::new();
        s.push("< ");
        s.push_with(name, Style::new().cyan().bold());
        s.push(": ");
        s.push(value);
        self.eprintln(&s.to_string(fmt));
    }

    pub fn debug_header_in_end(&mut self) {
        if self.verbosity.is_none() {
            return;
        }
        self.eprintln("<");
    }

    #[deprecated(since = "8.1.0", note = "please use single `debug_header_in` instead")]
    pub fn debug_headers_in(&mut self, headers: &[(&str, &str)]) {
        for (name, value) in headers {
            self.debug_header_in(name, value);
        }
    }

    /// Prints an HTTP request `header` to this logger [`Stderr`] instance, in verbose and very verbose mode.
    ///
    /// Request HTTP headers start with `>`.
    pub fn debug_header_out(&mut self, name: &str, value: &str) {
        if self.verbosity.is_none() {
            return;
        }
        let fmt = self.format();

        let mut s = StyledString::new();
        s.push("> ");
        s.push_with(name, Style::new().cyan().bold());
        s.push(": ");
        s.push(value);
        self.eprintln(&s.to_string(fmt));
    }

    #[deprecated(since = "8.1.0", note = "please use single `debug_header_in` instead")]
    pub fn debug_headers_out(&mut self, headers: &[(&str, &str)]) {
        for (name, value) in headers {
            self.debug_header_out(name, value);
        }
    }

    pub fn debug_header_out_end(&mut self) {
        if self.verbosity.is_none() {
            return;
        }
        self.eprintln(">");
    }

    /// Prints a HTTP response status code to this logger [`Stderr`] instance, in verbose and very verbose mode.
    pub fn debug_status_version_in(&mut self, line: &str) {
        if self.verbosity.is_none() {
            return;
        }
        let fmt = self.format();
        let mut s = StyledString::new();
        s.push("< ");
        s.push_with(line, Style::new().green().bold());
        self.eprintln(&s.to_string(fmt));
    }

    /// Prints a warning given message to this logger [`Stderr`] instance, no matter what is the verbosity.
    ///
    /// Displayed warning messages start with `warning:`.
    pub fn warning(&mut self, message: &str) {
        let fmt = self.format();
        let mut s = StyledString::new();
        s.push_with("warning", Style::new().yellow().bold());
        s.push(": ");
        s.push_with(message, Style::new().bold());
        self.eprintln(&s.to_string(fmt));
    }

    /// Prints an error message to this logger [`Stderr`] instance, no matter what is the verbosity.
    pub fn error_rich(&mut self, message: &str) {
        let fmt = self.format();
        let mut s = StyledString::new();
        s.push_with("error", Style::new().red().bold());
        s.push(": ");
        s.push(message);
        s.push("\n");
        self.eprintln(&s.to_string(fmt));
    }

    /// Prints the request method a
```

### Core Architecture Module: `packages/hurl/src/util/mod.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
//! Common utilities like log, path helpers and standard output/error wrapper.
pub mod logger;
pub mod path;
pub mod redacted;
pub mod term;

```

### Core Architecture Module: `packages/hurl/src/util/path.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
//! Access controlled path.
use std::path::{Component, Path, PathBuf};

/// Represents the contextual directories used to run a Hurl file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContextDir {
    /// The current working directory.
    /// If current directory is a relative path, the `is_access_allowed` method
    /// is not guaranteed to be correct.
    current_dir: PathBuf,
    /// The file root, either inferred or explicitly positioned by the user.
    /// As a consequence, it is always defined (and can't be replaced by a `Option<PathBuf>`).
    /// It can be relative (to the current directory) or absolute.
    file_root: PathBuf,
}

impl Default for ContextDir {
    fn default() -> Self {
        ContextDir {
            current_dir: PathBuf::new(),
            file_root: PathBuf::new(),
        }
    }
}

impl ContextDir {
    /// Returns a context directory with the given current directory and file root.
    pub fn new(current_dir: &Path, file_root: &Path) -> ContextDir {
        ContextDir {
            current_dir: PathBuf::from(current_dir),
            file_root: PathBuf::from(file_root),
        }
    }

    /// Returns a path (absolute or relative), given a filename.
    pub fn resolved_path(&self, filename: &Path) -> PathBuf {
        self.file_root.join(filename)
    }

    /// Checks if a given `filename` access is authorized.
    /// This method is used to check if a local file can be included in POST request or if a
    /// response can be outputted to a given file when using `output` option in \[Options\] sections.
    pub fn is_access_allowed(&self, filename: &Path) -> bool {
        let file = self.resolved_path(filename);
        let absolute_file = self.current_dir.join(file);
        let absolute_file_root = self.current_dir.join(&self.file_root);
        is_descendant(absolute_file.as_path(), absolute_file_root.as_path())
    }
}

/// Return true if `path` is a descendant path of `ancestor`, false otherwise.
/// Both paths are resolved before test, so symlinks can't be used to escape `ancestor`.
fn is_descendant(path: &Path, ancestor: &Path) -> bool {
    let path = resolve_path(path);
    let ancestor = resolve_path(ancestor);
    for a in path.ancestors() {
        if ancestor == a {
            return true;
        }
    }
    false
}

/// Returns the absolute form of this `path`, with symlinks resolved.
///
/// Contrary to the method [`std::fs::canonicalize`] on [`Path`], this function doesn't require
/// `path` to exist: the longest prefix of `path` that exists is canonicalized, then the remaining
/// components are appended to it, lexically normalized (they can't be resolved as they don't exist
/// on the filesystem). This is needed to check files that are not created yet, like `output` files.
fn resolve_path(path: &Path) -> PathBuf {
    let components = path.components().collect::<Vec<_>>();
    for i in (0..=components.len()).rev() {
        let prefix = components[..i].iter().collect::<PathBuf>();
        let Ok(mut resolved) = prefix.canonicalize() else {
            continue;
        };
        for component in &components[i..] {
            match component {
                Component::CurDir => {}
                Component::ParentDir => {
                    resolved.pop();
                }
                _ => resolved.push(component),
            }
        }
        return resolved;
    }
    normalize_path(path)
}

/// Returns the absolute form of this `path` with all intermediate components normalized.
/// Contrary to the methods [`std::fs::canonicalize`] on [`Path`], this function doesn't require
/// the final `path` to exist.
///
/// Borrowed from https://github.com/rust-lang/cargo/blob/master/crates/cargo-util/src/paths.rs
fn normalize_path(path: &Path) -> PathBuf {
    let mut components = path.components().peekable();
    let mut ret = if let Some(c @ Component::Prefix(..)) = components.peek().cloned() {
        components.next();
        PathBuf::from(c.as_os_str())
    } else {
        PathBuf::new()
    };

    for component in components {
        match component {
            Component::Prefix(..) => unreachable!(),
            Component::RootDir => {
                ret.push(component.as_os_str());
            }
            Component::CurDir => {}
            Component::ParentDir => {
                ret.pop();
            }
            Component::Normal(c) => {
                ret.push(c);
            }
        }
    }
    ret
}

// Create parent directories, if missing, given a filepath ending with a file name
pub fn create_dir_all(filename: &Path) -> Result<(), std::io::Error> {
    if let Some(parent) = filename.parent() {
        return std::fs::create_dir_all(parent);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_filename_allowed_access_without_user_file_root() {
        // ```
        // $ cd /dir
        // $ hurl test.hurl
        // ```
        let current_dir = Path::new("/dir");
        let file_root = Path::new("");
        let ctx = ContextDir::new(current_dir, file_root);
        assert!(ctx.is_access_allowed(Path::new("foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("/dir/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("a/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("a/b/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("../dir/a/b/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("../../../dir/a/b/foo.bin")));

        assert!(!ctx.is_access_allowed(Path::new("/file/foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../../foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../../file/foo.bin")));
    }

    #[test]
    fn check_filename_allowed_access_with_explicit_absolute_user_file_root() {
        // ```
        // $ cd /dir
        // $ hurl --file-root /file test.hurl
        // ```
        let current_dir = Path::new("/dir");
        let file_root = Path::new("/file");
        let ctx = ContextDir::new(current_dir, file_root);
        assert!(ctx.is_access_allowed(Path::new("foo.bin"))); // absolute path is /file/foo.bin
        assert!(ctx.is_access_allowed(Path::new("/file/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("a/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("a/b/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("../../file/foo.bin")));

        assert!(!ctx.is_access_allowed(Path::new("/dir/foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../dir/a/b/foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../../foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../../../dir/a/b/foo.bin")));

        let current_dir = Path::new("/dir");
        let file_root = Path::new("../file");
        let ctx = ContextDir::new(current_dir, file_root);
        assert!(ctx.is_access_allowed(Path::new("foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("/file/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("a/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("a/b/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("../../file/foo.bin")));

        assert!(!ctx.is_access_allowed(Path::new("/dir/foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../dir/a/b/foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../../foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../../../dir/a/b/foo.bin")));
    }

    #[test]
    fn check_filename_allowed_access_with_implicit_relative_user_file_root() {
        // ```
        // $ cd /dir
        // $ hurl a/b/test.hurl
        // ```
        let current_dir = Path::new("/dir");
        let file_root = Path::new("a/b");
        let ctx = ContextDir::new(current_dir, file_root);
        assert!(ctx.is_access_allowed(Path::new("foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("c/foo.bin"))); // absolute path is /dir/a/b/c/foo.bin
        assert!(ctx.is_access_allowed(Path::new("/dir/a/b/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("/dir/a/b/c/d/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("../../../dir/a/b/foo.bin")));

        assert!(!ctx.is_access_allowed(Path::new("/dir/foo.bin")));
    }

    #[test]
    fn check_filename_allowed_access_with_explicit_relative_user_file_root() {
        // ```
        // $ cd /dir
        // $ hurl --file-root ../dir test.hurl
        // ```
        let current_dir = Path::new("/dir");
        let file_root = Path::new("../dir");
        let ctx = ContextDir::new(current_dir, file_root);
        assert!(ctx.is_access_allowed(Path::new("foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("/dir/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("a/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("a/b/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("../dir/a/b/foo.bin")));
        assert!(ctx.is_access_allowed(Path::new("../../../dir/a/b/foo.bin")));

        assert!(!ctx.is_access_allowed(Path::new("/file/foo.bin")));
        assert!(!ctx.is_access_allowed(Path::new("../foo.bin")));
        
```

### Core Architecture Module: `packages/hurl/src/util/redacted.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

pub trait Redact {
    /// Redacts this given a list of secrets.
    fn redact(&self, secrets: &[impl AsRef<str>]) -> String;
}

impl<T> Redact for T
where
    T: AsRef<str> + ToString,
{
    fn redact(&self, secrets: &[impl AsRef<str>]) -> String {
        let mut value = self.to_string();
        for s in secrets {
            value = value.replace(s.as_ref(), "***");
        }
        value
    }
}

#[cfg(test)]
mod tests {
    use crate::util::redacted::Redact;

    #[test]
    fn redacted_string_hides_secret() {
        // Inner function to trigger deref from &RedactedString to &str.
        fn assert_eq(left: &str, right: &str) {
            assert_eq!(left, right);
        }
        let secrets = ["foo", "bar", "baz"];
        assert_eq(
            &"Hello, here are secrets values: foo".redact(&secrets),
            "Hello, here are secrets values: ***",
        );
        assert_eq(&"bar".redact(&secrets), "***");
        assert_eq(&"Baz is not secret".redact(&secrets), "Baz is not secret");
    }
}

```

### Core Architecture Module: `packages/hurl/src/util/term.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
//! Wrapper on standard output/error.
use std::io;
use std::io::IsTerminal;
use std::io::Write;

/// The way to write on standard output and error: either immediate like `println!` macro,
/// or buffered in an internal buffer.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum WriteMode {
    /// Messages are printed immediately.
    Immediate,
    /// Messages are saved to an internal buffer, and can be retrieved with [`Stdout::buffer`] /
    /// [`Stderr::buffer`].
    Buffered,
}

/// Indirection for standard output.
///
/// Depending on `mode`, bytes are immediately printed to standard output, or buffered in an
/// internal buffer.
pub struct Stdout {
    /// Write mode of the standard output: immediate or saved to a buffer.
    mode: WriteMode,
    /// Internal buffer, filled when `mode` is [`WriteMode::Buffered`]
    buffer: Vec<u8>,
}

impl Stdout {
    /// Creates a new standard output, buffered or immediate depending on `mode`.
    pub fn new(mode: WriteMode) -> Self {
        Stdout {
            mode,
            buffer: Vec::new(),
        }
    }

    /// Attempts to write an entire buffer into standard output.
    pub fn write_all(&mut self, buf: &[u8]) -> Result<(), io::Error> {
        match self.mode {
            WriteMode::Immediate => write_stdout(buf),
            WriteMode::Buffered => self.buffer.write_all(buf),
        }
    }

    /// Returns the buffered standard output.
    pub fn buffer(&self) -> &[u8] {
        &self.buffer
    }

    /// Returns `true` if the descriptor/handle refers to a terminal/tty, `false` otherwise.
    pub fn is_terminal(&self) -> bool {
        io::stdout().is_terminal()
    }
}

#[cfg(target_family = "unix")]
fn write_stdout(buf: &[u8]) -> Result<(), io::Error> {
    let mut handle = io::stdout().lock();
    handle.write_all(buf)?;
    Ok(())
}

#[cfg(target_family = "windows")]
fn write_stdout(buf: &[u8]) -> Result<(), io::Error> {
    // From <https://doc.rust-lang.org/std/io/struct.Stdout.html>:
    // > When operating in a console, the Windows implementation of this stream does not support
    // > non-UTF-8 byte sequences. Attempting to write bytes that are not valid UTF-8 will return
    // > an error.
    // As a workaround to prevent error, we convert the buffer to an UTF-8 string (with potential
    // bytes losses) before writing to the standard output of the Windows console.
    if io::stdout().is_terminal() {
        println!("{}", String::from_utf8_lossy(buf));
    } else {
        let mut handle = io::stdout().lock();
        handle.write_all(buf)?;
    }
    Ok(())
}

/// Indirection for standard error.
///
/// Depending on `mode`, messages are immediately printed to standard error, or buffered in an
/// internal buffer.
///
/// An optional `progress` string can be used to report temporary progress indication to the user.
/// It's always printed as the last lines of the standard error. When the standard error is created
/// with [`WriteMode::Buffered`], the progress is not saved in the internal buffer.
#[derive(Clone, Debug)]
pub struct Stderr {
    /// Write mode of the standard error: immediate or saved to a buffer.
    mode: WriteMode,
    /// Internal buffer, filled when `mode` is [`WriteMode::Buffered`]
    buffer: String,
    /// Progress bar: when not empty, it is always displayed at the end of the terminal.
    progress_bar: String,
}

impl Stderr {
    /// Creates a new standard error, buffered or immediate depending on `mode`.
    pub fn new(mode: WriteMode) -> Self {
        Stderr {
            mode,
            buffer: String::new(),
            progress_bar: String::new(),
        }
    }

    /// Returns the [`WriteMode`] of this logger.
    pub fn mode(&self) -> WriteMode {
        self.mode
    }

    /// Prints to the standard error, with a newline.
    pub fn eprintln(&mut self, message: &str) {
        match self.mode {
            WriteMode::Immediate => {
                let has_progress = !self.progress_bar.is_empty();
                if has_progress {
                    self.rewind_cursor();
                }
                eprintln!("{message}");
                if has_progress {
                    eprint!("{}", self.progress_bar);
                }
            }
            WriteMode::Buffered => {
                self.buffer.push_str(message);
                self.buffer.push('\n');
            }
        }
    }

    /// Prints to the standard error.
    pub fn eprint(&mut self, message: &str) {
        match self.mode {
            WriteMode::Immediate => {
                let has_progress = !self.progress_bar.is_empty();
                if has_progress {
                    self.rewind_cursor();
                }
                eprint!("{message}");
                if has_progress {
                    eprint!("{}", self.progress_bar);
                }
            }
            WriteMode::Buffered => {
                self.buffer.push_str(message);
            }
        }
    }

    /// Sets the progress bar (only in [`WriteMode::Immediate`] mode).
    pub fn set_progress_bar(&mut self, progress: &str) {
        match self.mode {
            WriteMode::Immediate => {
                self.progress_bar = progress.to_string();
                eprint!("{}", self.progress_bar);
            }
            WriteMode::Buffered => {}
        }
    }

    /// Clears the progress string (only in [`WriteMode::Immediate`] mode).
    pub fn clear_progress_bar(&mut self) {
        self.rewind_cursor();
        self.progress_bar.clear();
    }

    /// Returns the buffered standard error.
    pub fn buffer(&self) -> &str {
        &self.buffer
    }

    /// Set the buffered standard error.
    pub fn set_buffer(&mut self, buffer: String) {
        self.buffer = buffer;
    }

    /// Clears any progress and reset cursor terminal to the position of the last "real" message
    /// (only in [`WriteMode::Immediate`] mode).
    fn rewind_cursor(&self) {
        if self.progress_bar.is_empty() {
            return;
        }
        match self.mode {
            WriteMode::Immediate => {
                // We count the number of new lines \n. We can't use the `String::lines()` because
                // it counts a line for a single char and we don't want to go up for a single char.
                let lines = self.progress_bar.chars().filter(|c| *c == '\n').count();

                // We used the following ANSI codes:
                // - K: "EL - Erase in Line" sequence. It clears from the cursor to the end of line.
                // - 1A: "Cursor Up". Up to one line
                // <https://en.wikipedia.org/wiki/ANSI_escape_code#CSI_sequences>
                if lines > 0 {
                    (0..lines).for_each(|_| eprint!("\x1B[1A\x1B[K"));
                } else {
                    eprint!("\x1B[K");
                }
            }
            WriteMode::Buffered => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::util::term::{Stderr, Stdout, WriteMode};

    #[test]
    fn buffered_stdout() {
        let mut stdout = Stdout::new(WriteMode::Buffered);
        stdout.write_all(b"Hello").unwrap();
        stdout.write_all(b" ").unwrap();
        stdout.write_all(b"World!").unwrap();
        assert_eq!(stdout.buffer(), b"Hello World!");
    }

    #[test]
    fn buffered_stderr() {
        let mut stderr = Stderr::new(WriteMode::Buffered);
        stderr.eprintln("toto");
        stderr.set_progress_bar("some progress...\r");
        stderr.eprintln("tutu");

        assert_eq!(stderr.buffer(), "toto\ntutu\n");
    }
}

```

### Core Architecture Module: `packages/hurl_core/src/ast/core.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
use std::fmt;

use crate::types::{SourceString, ToSource};

use super::option::EntryOption;
use super::primitive::{
    Bytes, I64, KeyValue, LineTerminator, Placeholder, SourceInfo, Template, Whitespace,
};
use super::section::{Assert, Capture, Cookie, MultipartParam, RegexValue, Section, SectionValue};

/// Represents Hurl AST root node.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HurlFile {
    pub entries: Vec<Entry>,
    pub line_terminators: Vec<LineTerminator>,
}

/// Represents an entry; a request AST specification to be run and an optional response AST
/// specification to be checked.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub request: Request,
    pub response: Option<Response>,
}

impl Entry {
    /// Returns the source information for this entry.
    pub fn source_info(&self) -> SourceInfo {
        self.request.space0.source_info
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Request {
    pub line_terminators: Vec<LineTerminator>,
    pub space0: Whitespace,
    pub method: Method,
    pub space1: Whitespace,
    pub url: Template,
    pub line_terminator0: LineTerminator,
    pub headers: Vec<KeyValue>,
    pub sections: Vec<Section>,
    pub body: Option<Body>,
    pub source_info: SourceInfo,
}

impl Request {
    /// Returns the query strings params for this request.
    ///
    /// See <https://developer.mozilla.org/en-US/docs/Web/API/URL/searchParams>.
    pub fn querystring_params(&self) -> &[KeyValue] {
        for section in &self.sections {
            if let SectionValue::QueryParams(params, _) = &section.value {
                return params;
            }
        }
        &[]
    }

    /// Returns the form params for this request.
    ///
    /// See <https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST#url-encoded_form_submission>.
    pub fn form_params(&self) -> &[KeyValue] {
        for section in &self.sections {
            if let SectionValue::FormParams(params, _) = &section.value {
                return params;
            }
        }
        &[]
    }

    /// Returns the multipart form data for this request.
    ///
    /// See <https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST#multipart_form_submission>.
    pub fn multipart_form_data(&self) -> &[MultipartParam] {
        for section in &self.sections {
            if let SectionValue::MultipartFormData(params, _) = &section.value {
                return params;
            }
        }
        &[]
    }

    /// Returns the list of cookies on this request.
    ///
    /// See <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie>.
    pub fn cookies(&self) -> &[Cookie] {
        for section in &self.sections {
            if let SectionValue::Cookies(cookies) = &section.value {
                return cookies;
            }
        }
        &[]
    }

    /// Returns the basic authentication on this request.
    ///
    /// See <https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication>.
    pub fn basic_auth(&self) -> Option<&KeyValue> {
        for section in &self.sections {
            if let SectionValue::BasicAuth(kv) = &section.value {
                return kv.as_ref();
            }
        }
        None
    }

    /// Returns the options specific for this request.
    pub fn options(&self) -> &[EntryOption] {
        for section in &self.sections {
            if let SectionValue::Options(options) = &section.value {
                return options;
            }
        }
        &[]
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Response {
    pub line_terminators: Vec<LineTerminator>,
    pub version: Version,
    pub space0: Whitespace,
    pub status: Status,
    pub space1: Whitespace,
    pub line_terminator0: LineTerminator,
    pub headers: Vec<KeyValue>,
    pub sections: Vec<Section>,
    pub body: Option<Body>,
    pub source_info: SourceInfo,
}

impl Response {
    /// Returns the captures list of this spec response.
    pub fn captures(&self) -> &[Capture] {
        for section in self.sections.iter() {
            if let SectionValue::Captures(captures) = &section.value {
                return captures;
            }
        }
        &[]
    }

    /// Returns the asserts list of this spec response.
    pub fn asserts(&self) -> &[Assert] {
        for section in self.sections.iter() {
            if let SectionValue::Asserts(asserts) = &section.value {
                return asserts;
            }
        }
        &[]
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Method(String);

impl Method {
    /// Creates a new AST element method/
    pub fn new(method: &str) -> Method {
        Method(method.to_string())
    }
}

impl fmt::Display for Method {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl ToSource for Method {
    fn to_source(&self) -> SourceString {
        self.0.to_source()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Version {
    pub value: VersionValue,
    pub source_info: SourceInfo,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum VersionValue {
    Version1,
    Version11,
    Version2,
    Version3,
    VersionAny,
}

impl fmt::Display for VersionValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            VersionValue::Version1 => "HTTP/1.0",
            VersionValue::Version11 => "HTTP/1.1",
            VersionValue::Version2 => "HTTP/2",
            VersionValue::Version3 => "HTTP/3",
            VersionValue::VersionAny => "HTTP",
        };
        write!(f, "{s}")
    }
}

impl ToSource for VersionValue {
    fn to_source(&self) -> SourceString {
        self.to_string().to_source()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Status {
    pub value: StatusValue,
    pub source_info: SourceInfo,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StatusValue {
    Any,
    Specific(u64),
}

impl fmt::Display for StatusValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StatusValue::Any => write!(f, "*"),
            StatusValue::Specific(v) => write!(f, "{v}"),
        }
    }
}

impl ToSource for StatusValue {
    fn to_source(&self) -> SourceString {
        self.to_string().to_source()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Body {
    pub line_terminators: Vec<LineTerminator>,
    pub space0: Whitespace,
    pub value: Bytes,
    pub line_terminator0: LineTerminator,
}

/// Check that variable name is not reserved
/// (would conflicts with an existing function)
pub fn is_variable_reserved(name: &str) -> bool {
    ["getEnv", "newDate", "newUuid"].contains(&name)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Filter {
    pub source_info: SourceInfo,
    pub value: FilterValue,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FilterValue {
    Base64Decode,
    Base64Encode,
    Base64UrlSafeDecode,
    Base64UrlSafeEncode,
    CharsetDecode {
        space0: Whitespace,
        encoding: Template,
    },
    Count,
    DaysAfterNow,
    DaysBeforeNow,
    Decode {
        space0: Whitespace,
        encoding: Template,
    },
    First,
    Format {
        space0: Whitespace,
        fmt: Template,
    },
    DateFormat {
        space0: Whitespace,
        fmt: Template,
    },
    HtmlEscape,
    HtmlUnescape,
    JsonPath {
        space0: Whitespace,
        expr: Template,
    },
    Last,
    Location,
    Nth {
        space0: Whitespace,
        n: IntegerValue,
    },
    Regex {
        space0: Whitespace,
        value: RegexValue,
    },
    Replace {
        space0: Whitespace,
        old_value: Template,
        space1: Whitespace,
        new_value: Template,
    },
    ReplaceRegex {
        space0: Whitespace,
        pattern: RegexValue,
        space1: Whitespace,
        new_value: Template,
    },
    Split {
        space0: Whitespace,
        sep: Template,
    },
    ToDate {
        space0: Whitespace,
        fmt: Template,
    },
    ToFloat,
    ToHex,
    ToInt,
    ToString,
    UrlDecode,
    UrlEncode,
    UrlQueryParam {
        space0: Whitespace,
        param: Template,
    },
    Utf8Decode,
    Utf8Encode,
    XPath {
        space0: Whitespace,
        expr: Template,
    },
}

impl FilterValue {
    /// Returns the Hurl identifier for this filter type.
    pub fn identifier(&self) -> &'static str {
        match self {
            FilterValue::Base64Decode => "base64Decode",
            FilterValue::Base64Encode => "base64Encode",
            FilterValue::Base64UrlSafeDecode => "base64UrlSafeDecode",
            FilterValue::Base64UrlSafeEncode => "base64UrlSafeEncode",
            FilterValue::CharsetDecode { .. } => "charsetDecode",
            FilterValue::Count => "count",
            FilterValue::DaysAfterNow => "daysAfterNow",
            FilterValue::DaysBeforeNow => "daysBeforeNow",
            FilterValue::Decode { .. } => "decode",
            FilterValue::First => "first",
            FilterValue::Format { .. } => "format",
            FilterValue::DateFormat { .. } => "dateFormat",
            FilterValue::HtmlEscape => "htmlEscape",
            FilterValue::HtmlUnescape => "htmlUnescape",
            FilterValue::JsonPath { .. } => "jsonpath",
            FilterVa
```

### Core Architecture Module: `packages/hurl_core/src/ast/json.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
use crate::types::{SourceString, ToSource};

use super::primitive::{Placeholder, Template};

/// This the AST for the JSON used within Hurl (for instance in [implicit JSON body request](https://hurl.dev/docs/request.html#json-body)).
///
/// # Example
///
/// ```hurl
/// POST https://example.org/api/cats
/// {
///     "id": 42,
///     "lives": {{lives_count}},
///     "name": "{{name}}"
/// }
/// ```
///
/// It is a superset of the standard JSON spec. Strings have been replaced by Hurl [`Placeholder`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum JsonValue {
    Placeholder(Placeholder),
    Number(String),
    String(Template),
    Boolean(bool),
    List {
        space0: String,
        elements: Vec<JsonListElement>,
    },
    Object {
        space0: String,
        elements: Vec<JsonObjectElement>,
    },
    Null,
}

impl ToSource for JsonValue {
    fn to_source(&self) -> SourceString {
        match self {
            JsonValue::Placeholder(expr) => format!("{{{{{expr}}}}}").to_source(),
            JsonValue::Number(s) => s.to_source(),
            JsonValue::String(template) => template.to_source(),
            JsonValue::Boolean(value) => {
                if *value {
                    "true".to_source()
                } else {
                    "false".to_source()
                }
            }
            JsonValue::List { space0, elements } => {
                let elements = elements
                    .iter()
                    .map(|e| e.to_source())
                    .collect::<Vec<SourceString>>();
                format!("[{}{}]", space0, elements.join(",")).to_source()
            }
            JsonValue::Object { space0, elements } => {
                let elements = elements
                    .iter()
                    .map(|e| e.to_source())
                    .collect::<Vec<SourceString>>();
                format!("{{{}{}}}", space0, elements.join(",")).to_source()
            }
            JsonValue::Null => "null".to_source(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JsonListElement {
    pub space0: String,
    pub value: JsonValue,
    pub space1: String,
}

impl ToSource for JsonListElement {
    fn to_source(&self) -> SourceString {
        let mut s = SourceString::new();
        s.push_str(self.space0.as_str());
        s.push_str(self.value.to_source().as_str());
        s.push_str(self.space1.as_str());
        s
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JsonObjectElement {
    pub space0: String,
    pub name: Template,
    pub space1: String,
    pub space2: String,
    pub value: JsonValue,
    pub space3: String,
}

impl ToSource for JsonObjectElement {
    fn to_source(&self) -> SourceString {
        let mut s = SourceString::new();
        s.push_str(self.space0.as_str());
        s.push_str(self.name.to_source().as_str());
        s.push_str(self.space1.as_str());
        s.push(':');
        s.push_str(self.space2.as_str());
        s.push_str(self.value.to_source().as_str());
        s.push_str(self.space3.as_str());
        s
    }
}

```

### Core Architecture Module: `packages/hurl_core/src/ast/mod.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
//! Exposes Hurl AST nodes (see [Hurl grammar](https://hurl.dev/docs/grammar.html)).
pub use self::core::*;
pub use self::json::{JsonListElement, JsonObjectElement, JsonValue};
pub use self::option::*;
pub use self::primitive::*;
pub use self::section::*;

mod core;
mod json;
mod option;
mod primitive;
mod section;
pub mod visit;

```

### Core Architecture Module: `packages/hurl_core/src/ast/option.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
use std::fmt;

use crate::types::{Count, DurationUnit, SourceString, ToSource};

use super::primitive::{
    LineTerminator, Number, Placeholder, SourceInfo, Template, U64, Whitespace,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EntryOption {
    pub line_terminators: Vec<LineTerminator>,
    pub space0: Whitespace,
    pub space1: Whitespace,
    pub space2: Whitespace,
    pub kind: OptionKind,
    pub line_terminator0: LineTerminator,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OptionKind {
    AwsSigV4(Template),
    CaCertificate(Template),
    ClientCert(Template),
    ClientKey(Template),
    Compressed(BooleanOption),
    ConnectTo(Template),
    ConnectTimeout(DurationOption),
    Delay(DurationOption),
    Digest(BooleanOption),
    FailWithBody(BooleanOption),
    FollowLocation(BooleanOption),
    FollowLocationTrusted(BooleanOption),
    Header(Template),
    Http10(BooleanOption),
    Http11(BooleanOption),
    Http2(BooleanOption),
    Http2PriorKnowledge(BooleanOption),
    Http3(BooleanOption),
    Insecure(BooleanOption),
    IpV4(BooleanOption),
    IpV6(BooleanOption),
    LimitRate(NaturalOption),
    MaxRedirect(CountOption),
    MaxTime(DurationOption),
    Negotiate(BooleanOption),
    NetRc(BooleanOption),
    NetRcFile(Template),
    NetRcOptional(BooleanOption),
    NoHeader(Template),
    NoJsonpathCoercion(BooleanOption),
    Ntlm(BooleanOption),
    Output(Template),
    PathAsIs(BooleanOption),
    PinnedPublicKey(Template),
    Proxy(Template),
    Repeat(CountOption),
    Resolve(Template),
    Retry(CountOption),
    RetryInterval(DurationOption),
    Skip(BooleanOption),
    UnixSocket(Template),
    User(Template),
    Variable(VariableDefinition),
    Verbose(BooleanOption),
    Verbosity(VerbosityOption),
    VeryVerbose(BooleanOption),
}

impl OptionKind {
    /// Returns the Hurl string identifier of this option.
    pub fn identifier(&self) -> &'static str {
        match self {
            OptionKind::AwsSigV4(_) => "aws-sigv4",
            OptionKind::CaCertificate(_) => "cacert",
            OptionKind::ClientCert(_) => "cert",
            OptionKind::ClientKey(_) => "key",
            OptionKind::Compressed(_) => "compressed",
            OptionKind::ConnectTo(_) => "connect-to",
            OptionKind::ConnectTimeout(_) => "connect-timeout",
            OptionKind::Delay(_) => "delay",
            OptionKind::Digest(_) => "digest",
            OptionKind::FailWithBody(_) => "fail-with-body",
            OptionKind::FollowLocation(_) => "location",
            OptionKind::FollowLocationTrusted(_) => "location-trusted",
            OptionKind::Header(_) => "header",
            OptionKind::Http10(_) => "http1.0",
            OptionKind::Http11(_) => "http1.1",
            OptionKind::Http2(_) => "http2",
            OptionKind::Http2PriorKnowledge(_) => "http2-prior-knowledge",
            OptionKind::Http3(_) => "http3",
            OptionKind::Insecure(_) => "insecure",
            OptionKind::IpV4(_) => "ipv4",
            OptionKind::IpV6(_) => "ipv6",
            OptionKind::LimitRate(_) => "limit-rate",
            OptionKind::MaxRedirect(_) => "max-redirs",
            OptionKind::MaxTime(_) => "max-time",
            OptionKind::Negotiate(_) => "negotiate",
            OptionKind::NetRc(_) => "netrc",
            OptionKind::NetRcFile(_) => "netrc-file",
            OptionKind::NetRcOptional(_) => "netrc-optional",
            OptionKind::NoHeader(_) => "no-header",
            OptionKind::NoJsonpathCoercion(_) => "no-jsonpath-coercion",
            OptionKind::Ntlm(_) => "ntlm",
            OptionKind::Output(_) => "output",
            OptionKind::PathAsIs(_) => "path-as-is",
            OptionKind::PinnedPublicKey(_) => "pinnedpubkey",
            OptionKind::Proxy(_) => "proxy",
            OptionKind::Repeat(_) => "repeat",
            OptionKind::Resolve(_) => "resolve",
            OptionKind::Retry(_) => "retry",
            OptionKind::RetryInterval(_) => "retry-interval",
            OptionKind::Skip(_) => "skip",
            OptionKind::UnixSocket(_) => "unix-socket",
            OptionKind::User(_) => "user",
            OptionKind::Variable(_) => "variable",
            OptionKind::Verbose(_) => "verbose",
            OptionKind::Verbosity(_) => "verbosity",
            OptionKind::VeryVerbose(_) => "very-verbose",
        }
    }
}

impl fmt::Display for OptionKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            OptionKind::AwsSigV4(value) => value.to_string(),
            OptionKind::CaCertificate(filename) => filename.to_string(),
            OptionKind::ClientCert(filename) => filename.to_string(),
            OptionKind::ClientKey(filename) => filename.to_string(),
            OptionKind::Compressed(value) => value.to_string(),
            OptionKind::ConnectTo(value) => value.to_string(),
            OptionKind::ConnectTimeout(value) => value.to_string(),
            OptionKind::Delay(value) => value.to_string(),
            OptionKind::Digest(value) => value.to_string(),
            OptionKind::FailWithBody(value) => value.to_string(),
            OptionKind::FollowLocation(value) => value.to_string(),
            OptionKind::FollowLocationTrusted(value) => value.to_string(),
            OptionKind::Header(value) => value.to_string(),
            OptionKind::Http10(value) => value.to_string(),
            OptionKind::Http11(value) => value.to_string(),
            OptionKind::Http2(value) => value.to_string(),
            OptionKind::Http2PriorKnowledge(value) => value.to_string(),
            OptionKind::Http3(value) => value.to_string(),
            OptionKind::Insecure(value) => value.to_string(),
            OptionKind::IpV4(value) => value.to_string(),
            OptionKind::IpV6(value) => value.to_string(),
            OptionKind::LimitRate(value) => value.to_string(),
            OptionKind::MaxRedirect(value) => value.to_string(),
            OptionKind::MaxTime(value) => value.to_string(),
            OptionKind::Negotiate(value) => value.to_string(),
            OptionKind::NetRc(value) => value.to_string(),
            OptionKind::NetRcFile(filename) => filename.to_string(),
            OptionKind::NetRcOptional(value) => value.to_string(),
            OptionKind::NoHeader(value) => value.to_string(),
            OptionKind::NoJsonpathCoercion(value) => value.to_string(),
            OptionKind::Ntlm(value) => value.to_string(),
            OptionKind::Output(filename) => filename.to_string(),
            OptionKind::PathAsIs(value) => value.to_string(),
            OptionKind::PinnedPublicKey(value) => value.to_string(),
            OptionKind::Proxy(value) => value.to_string(),
            OptionKind::Repeat(value) => value.to_string(),
            OptionKind::Resolve(value) => value.to_string(),
            OptionKind::Retry(value) => value.to_string(),
            OptionKind::RetryInterval(value) => value.to_string(),
            OptionKind::Skip(value) => value.to_string(),
            OptionKind::UnixSocket(value) => value.to_string(),
            OptionKind::User(value) => value.to_string(),
            OptionKind::Variable(value) => value.to_string(),
            OptionKind::Verbose(value) => value.to_string(),
            OptionKind::Verbosity(value) => value.to_string(),
            OptionKind::VeryVerbose(value) => value.to_string(),
        };
        write!(f, "{}: {}", self.identifier(), value)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BooleanOption {
    Literal(bool),
    Placeholder(Placeholder),
}

impl fmt::Display for BooleanOption {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BooleanOption::Literal(v) => write!(f, "{v}"),
            BooleanOption::Placeholder(v) => write!(f, "{v}"),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NaturalOption {
    Literal(U64),
    Placeholder(Placeholder),
}

impl fmt::Display for NaturalOption {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NaturalOption::Literal(v) => write!(f, "{v}"),
            NaturalOption::Placeholder(v) => write!(f, "{v}"),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CountOption {
    Literal(Count),
    Placeholder(Placeholder),
}

impl fmt::Display for CountOption {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CountOption::Literal(v) => write!(f, "{v}"),
            CountOption::Placeholder(v) => write!(f, "{v}"),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DurationOption {
    Literal(Duration),
    Placeholder(Placeholder),
}

impl fmt::Display for DurationOption {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DurationOption::Literal(v) => write!(f, "{v}"),
            DurationOption::Placeholder(v) => write!(f, "{v}"),
        }
    }
}

/// Represent a duration
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Duration {
    pub value: U64,
    pub unit: Option<DurationUnit>,
}

impl Duration {
    pub fn new(value: U64, unit: Option<DurationUnit>) -> Duration {
        Duration { value, unit }
    }
}

impl fmt::Display for Duration {
    fn fmt(&self, f: &mut fmt:
```

### Core Architecture Module: `packages/hurl_core/src/ast/primitive.rs`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2026 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
use std::fmt;
use std::fmt::Formatter;

use crate::reader::Pos;
use crate::types::{SourceString, ToSource};

use super::json::JsonValue;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KeyValue {
    pub line_terminators: Vec<LineTerminator>,
    pub space0: Whitespace,
    pub key: Template,
    pub space1: Whitespace,
    pub space2: Whitespace,
    pub value: Template,
    pub line_terminator0: LineTerminator,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MultilineString {
    pub space: Whitespace,
    pub newline: Whitespace,
    pub kind: MultilineStringKind,
}

impl fmt::Display for MultilineString {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match &self.kind {
            MultilineStringKind::Text(value)
            | MultilineStringKind::Json(value)
            | MultilineStringKind::Xml(value) => write!(f, "{value}"),
            MultilineStringKind::Raw(value) => write!(f, "{value}"),
            MultilineStringKind::GraphQl(value) => write!(f, "{value}"),
        }
    }
}

impl ToSource for MultilineString {
    fn to_source(&self) -> SourceString {
        let mut source = SourceString::new();
        source.push_str("```");
        source.push_str(self.lang());
        source.push_str(self.space.as_str());
        source.push_str(self.newline.as_str());
        source.push_str(self.kind.to_source().as_str());
        source.push_str("```");
        source
    }
}

impl MultilineString {
    pub fn lang(&self) -> &'static str {
        match self.kind {
            MultilineStringKind::Text(_) => "",
            MultilineStringKind::Json(_) => "json",
            MultilineStringKind::Xml(_) => "xml",
            MultilineStringKind::Raw(_) => "raw",
            MultilineStringKind::GraphQl(_) => "graphql",
        }
    }

    pub fn value(&self) -> Template {
        match &self.kind {
            MultilineStringKind::Text(text)
            | MultilineStringKind::Json(text)
            | MultilineStringKind::Xml(text) => text.clone(),
            MultilineStringKind::Raw(text) => text.clone(),
            MultilineStringKind::GraphQl(text) => text.value.clone(),
        }
    }
}

#[allow(clippy::large_enum_variant)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MultilineStringKind {
    Text(Template),
    Json(Template),
    Xml(Template),
    Raw(Template),
    GraphQl(GraphQl),
}

impl ToSource for MultilineStringKind {
    fn to_source(&self) -> SourceString {
        match self {
            MultilineStringKind::Text(value)
            | MultilineStringKind::Json(value)
            | MultilineStringKind::Xml(value) => value.to_source(),
            MultilineStringKind::Raw(value) => value.to_source(),
            MultilineStringKind::GraphQl(value) => value.to_source(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GraphQl {
    pub value: Template,
    pub variables: Option<GraphQlVariables>,
}

impl fmt::Display for GraphQl {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.value)?;
        if let Some(vars) = &self.variables {
            write!(f, "{}", vars.to_source())?;
        }
        Ok(())
    }
}

impl ToSource for GraphQl {
    fn to_source(&self) -> SourceString {
        let mut source = SourceString::new();
        source.push_str(self.value.to_source().as_str());
        if let Some(vars) = &self.variables {
            source.push_str(vars.to_source().as_str());
        }
        source
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GraphQlVariables {
    pub space: Whitespace,
    pub value: JsonValue,
    pub whitespace: Whitespace,
}

impl ToSource for GraphQlVariables {
    fn to_source(&self) -> SourceString {
        let mut source = "variables".to_source();
        source.push_str(self.space.as_str());
        source.push_str(self.value.to_source().as_str());
        source.push_str(self.whitespace.as_str());
        source
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Base64 {
    pub space0: Whitespace,
    pub value: Vec<u8>,
    pub source: SourceString,
    pub space1: Whitespace,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct File {
    pub space0: Whitespace,
    pub filename: Template,
    pub space1: Whitespace,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Template {
    pub delimiter: Option<char>,
    pub elements: Vec<TemplateElement>,
    pub source_info: SourceInfo,
}

impl fmt::Display for Template {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        let mut buffer = String::new();
        for element in self.elements.iter() {
            buffer.push_str(element.to_string().as_str());
        }
        write!(f, "{buffer}")
    }
}

impl ToSource for Template {
    fn to_source(&self) -> SourceString {
        let mut s = SourceString::new();
        if let Some(d) = self.delimiter {
            s.push(d);
        }
        let elements: Vec<SourceString> = self.elements.iter().map(|e| e.to_source()).collect();
        s.push_str(elements.join("").as_str());
        if let Some(d) = self.delimiter {
            s.push(d);
        }
        s
    }
}

impl Template {
    /// Creates a new template.
    pub fn new(
        delimiter: Option<char>,
        elements: Vec<TemplateElement>,
        source_info: SourceInfo,
    ) -> Template {
        Template {
            delimiter,
            elements,
            source_info,
        }
    }

    /// Returns true if this template is empty.
    pub fn is_empty(&self) -> bool {
        self.elements.is_empty()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TemplateElement {
    String { value: String, source: SourceString },
    Placeholder(Placeholder),
}

impl fmt::Display for TemplateElement {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        let s = match self {
            TemplateElement::String { value, .. } => value.clone(),
            // TODO: see why we can't need to us `{{` and `}}` in a to_string method
            TemplateElement::Placeholder(value) => format!("{{{{{value}}}}}"),
        };
        write!(f, "{s}")
    }
}

impl ToSource for TemplateElement {
    fn to_source(&self) -> SourceString {
        match self {
            TemplateElement::String { source, .. } => source.clone(),
            TemplateElement::Placeholder(value) => value.to_source(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Comment {
    pub value: String,
    pub source_info: SourceInfo,
}

impl ToSource for Comment {
    fn to_source(&self) -> SourceString {
        format!("#{}", self.value).to_source()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Whitespace {
    pub value: String,
    pub source_info: SourceInfo,
}

impl fmt::Display for Whitespace {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        write!(f, "{}", self.value)
    }
}

impl Whitespace {
    pub fn as_str(&self) -> &str {
        &self.value
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Number {
    Float(Float),
    Integer(I64),
    BigInteger(String),
}

impl fmt::Display for Number {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        match self {
            Number::Float(value) => write!(f, "{value}"),
            Number::Integer(value) => write!(f, "{value}"),
            Number::BigInteger(value) => write!(f, "{value}"),
        }
    }
}

impl ToSource for Number {
    fn to_source(&self) -> SourceString {
        match self {
            Number::Float(value) => value.to_source(),
            Number::Integer(value) => value.to_source(),
            Number::BigInteger(value) => value.to_source(),
        }
    }
}

// keep Number terminology for both Integer and Decimal Numbers
// different representation for the same float value
// 1.01 and 1.010

#[derive(Clone, Debug)]
pub struct Float {
    value: f64,
    source: SourceString,
}

impl Float {
    pub fn new(value: f64, source: SourceString) -> Float {
        Float { value, source }
    }

    pub fn as_f64(&self) -> f64 {
        self.value
    }
}

impl fmt::Display for Float {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        write!(f, "{}", self.value)
    }
}

impl ToSource for Float {
    fn to_source(&self) -> SourceString {
        self.source.clone()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct U64 {
    value: u64,
    source: SourceString,
}

impl U64 {
    pub fn new(value: u64, source: SourceString) -> U64 {
        U64 { value, source }
    }

    pub fn as_u64(&self) -> u64 {
        self.value
    }
}

impl fmt::Display for U64 {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        write!(f, "{}", self.value)
    }
}

impl ToSource for U64 {
    fn to_source(&self) -> SourceString {
        self.source.clone()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct I64 {
    value: i64,
    source: SourceString,
}

impl I64 {
    pub fn new(value: i64, source: SourceString) -> I64 {
        I64 { value, source }
    }

    pub fn as_i64(&self) -> i64 {
        self.value
    }
}

impl fmt::Display for I64 {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        write!(f, "{}", self.value)
    }
}

impl ToSource for I64 {
    fn to_source(&self) -> SourceString {
        self.source.clone()
    }
}

impl PartialEq for Float {
    fn eq(&self, other: &Self) -> bool {

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5317** (2026-10-02): **Fix JSON parser unbounded recursion**
  *Symptoms*: Currently there is no limit on the nesting depth in JSON Parsing. A 128-level hard-coded limit could be used.  

- **Issue #5207** (2026-09-14): **Publishing `hurl` crate breaks Windows builds: build script references `../../bin/windows/logo.ico`, which is outside the crate and not shipped to crates.io**
  *Symptoms*: ### What is the current *bug* behavior?  Building the `hurl` crate (and by extension `hurl_core`) as a dependency **from crates.io** fails on Windows. The `hurl` build script tries to compile a Windows resource that embeds `../../bin/windows/logo.ico`, but that icon lives at the workspace root, outside the `packages/hurl` crate directory, so it is **not included in the published crate**. The build script then panics because `rc.exe` cannot find the file:      error RC2135 : file not found: ../../bin/windows/logo.ico      thread 'main' panicked at build.rs:29:19:     called `Result::unwrap()` on an `Err` value: Custom { kind: Other, error: "Could not compile resource file" }  Using a `git` dependency works only because a git checkout brings the whole repo, so `../../bin/windows/logo.ico` resolves. The published crate has no such file, so it cannot build on Windows.  Note: this icon only sets the resource icon on the Windows `hurl.exe`. It is irrelevant to library consumers, yet it hard-fails their builds.  ### Steps to reproduce  1. On a Windows machine with the MSVC toolchain (so `rc.exe` from the Windows SDK is used). 2. Create a new Rust project: `cargo new repro && cd repro`. 3. Add the crates.io dependencies to `Cargo.toml`:        [dependencies]        hurl = "8.0.1"        hurl_core = "8.0.1" 4. Run `cargo build`. 5. The build fails while running the custom build command for `hurl v8.0.1` with `RC2135 : file not found: ../../bin/windows/logo.ico` and the `build.rs` pani
  **Post-Mortem & Fix Analysis**:
  > Hi @brenordv thanks fort the issue.We're going to make the icon optionnal (option 1 of your proposal), in the next Hurl version
  > > Hi [@brenordv](https://github.com/brenordv) thanks fort the issue.We're going to make the icon optionnal (option 1 of your proposal), in the next Hurl version  Thank you, @jcamiel! I really appreciate the help!  

- **Issue #5141** (2026-08-06): **Hurl debug curl command are not valid when request binary body contains NUL (\x00) char**
  *Symptoms*: Given this Hurl file:  ```hurl POST http://localhost:8000/post-bytes-null Content-Type: application/octet-stream base64,AAECAw==;  # printf '\x00\x01\x02\x03' | base64 HTTP 200 ```  The request body sent is `\x00\x01\x02\x03` but the curl command produced by Hurl (with `--verbose` or `--curl`) is:  ```shell $ curl --header 'Content-Type: application/octet-stream' --data $'\x00\x01\x02\x03' 'http://localhost:8000/post-bytes-null' ```  Because of the way of bash treats NUL-C terminated string, this does not work.  In this case (and only in this case), we could print the following curl command:  ```shell $ printf '\x00\x01\x02\x03' | curl --header 'Content-Type: application/octet-stream' --data-binary @- 'http://localhost:8000/post-bytes-null' ```       

- **Issue #5094** (2026-06-16): **npm package depending on vulnerable tar version CVE-2026-53655**
  *Symptoms*: https://github.com/advisories/GHSA-vmf3-w455-68vh  https://github.com/Orange-OpenSource/hurl/blob/1e1eb773078cfe95027394f0bb7c34973d480364/contrib/npm/hurl/package.json#L27
  **Post-Mortem & Fix Analysis**:
  > Ho @WestonThayer  Fixed with the 8.0.2 version: <https://www.npmjs.com/package/@orangeopensource/hurl/v/8.0.2> Thanks!  

- **Issue #5091** (2026-06-19): **Incorrect recorded headers when connecting to proxy with CONNECT**
  *Symptoms*: Given this curl call:  ```shell $ curl --verbose --proxy http://127.0.0.1:3128 --cacert tests_ssl/certs/server/cert.pem https://127.0.0.1:8002/hello  ```   The HTTP headers sequences is:  ``` > CONNECT 127.0.0.1:8002 HTTP/1.1 > Host: 127.0.0.1:8002 > User-Agent: curl/8.7.1 > Proxy-Connection: Keep-Alive >  < HTTP/1.1 200 Connection established <  > GET /hello HTTP/1.1 > Host: 127.0.0.1:8002 > User-Agent: curl/8.7.1 > Accept: */* > < HTTP/1.1 200 OK < Server: Werkzeug/3.1.8 Python/3.14.0 < Date: Sat, 13 Jun 2026 15:13:25 GMT < Content-Type: text/html; charset=utf-8 < Content-Length: 12 < Connection: close <  ```  With Hurl, request headers are not well recorded:  ```shell $ echo "GET https://127.0.0.1:8002/hello" | hurl --verbosity brief --proxy http://127.0.0.1:3128 --cacert tests_ssl/certs/server/cert.pem > CONNECT 127.0.0.1:8002 HTTP/1.1 > Host: 127.0.0.1:8002 > Proxy-Connection: Keep-Alive > > GET /hello HTTP/1.1 > Host: 127.0.0.1:8002 > Proxy-Connection: Keep-Alive > Host: 127.0.0.1:8002 > Accept: */* > User-Agent: hurl/8.1.0 > < HTTP/1.1 200 OK < Server: Werkzeug/3.1.8 Python/3.14.0 < Date: Sat, 13 Jun 2026 15:15:58 GMT < Content-Type: text/html; charset=utf-8 < Content-Length: 12 < Connection: close < Hello World! ```  And:  ```shell $ echo "GET https://127.0.0.1:8002/hello" | hurl --verbosity brief --proxy http://127.0.0.1:3128 --cacert tests_ssl/certs/server/cert.pem --json | jq '.entries[0].calls[0].request.headers' | pbcopy [   {     "name": "Host",     "value": "12

- **Issue #5028** (2026-06-24): **Accept options variables like `111xxx` or `truexxx`**
  *Symptoms*: Some Options variables  are rejected while being "usual":  ```hurl GET http://localhost:8000 [Options] variable: foo=aa11 variable: bar=11aa ```  ``` $ hurl /tmp/test.hurl error: Parsing literal   --> /tmp/test.hurl:4:17    |  4 | variable: bar=11aa    |                 ^ expecting 'line_terminator'    | ```  And   ```hurl GET http://localhost:8000 [Options] variable: foo=true_is_true ```  ``` $ hurl /tmp/test.hurl error: Parsing literal   --> /tmp/test.hurl:3:19    |  3 | variable: foo=true_is_true    |                   ^ expecting 'line_terminator'    |  ```  
  **Post-Mortem & Fix Analysis**:
  > @fabricereix I think it's reasonable that these two Hurl snippets work (without quoting the variable value to force the string type)

- **Issue #5007** (2026-05-04): **IPv4 integration test is failing with libcurl 8.20.0**
  *Symptoms*: Integration integration/hurl/tests_failed/ipv4/ipv4.sh is failing with libcurl 8.20.0 (see our ArchLinux tests).  A local IPv6 only server is listening and using `--ipv4` should fail.  A mail has been seen on libcurl mailing list for feedbacks => <https://curl.se/mail/lib-2026-05/0000.html>  Waiting for an anlysis, we disable this test.  

- **Issue #4995** (2026-04-28): **jsonpath functions don't support underscores**
  *Symptoms*: ### What is the current *bug* behavior? Fields with an underscore are rejected in jsonpath functions. `@.foo_bar` generates an error, which can be worked around with `@['foo_bar']`  ### Steps to reproduce Using this JSON response: ```json {   "foo_bar": "a",   "items": [     {       "foo": "b",       "foo_bar": "c"     }   ] } ```  with these asserts: ```hurl [Asserts] jsonpath "$.foo_bar" == "a"  # OK jsonpath "$.items[?(@.foo == 'b')]" exists  # OK jsonpath "$.items[?search(@.foo, 'b')].foo" == "b"  # OK jsonpath "$.items[?(@.foo_bar == 'c')]" exists  # FAILS jsonpath "$.items[?search(@.foo_bar, 'c')].foo_bar" == "c"  # FAILS ```  generates this error: ``` JSONPath expression '$.items[?search(@.foo_bar, 'c')].foo_bar' is not valid ```  ### What is the expected *correct* behavior? If I'm reading the RFC correctly, it should be allowed.  ### Execution context  - Hurl Version (`hurl --version`): ``` hurl 8.0.0 (x86_64-apple-darwin24.0) libcurl/8.7.1 (SecureTransport) LibreSSL/3.3.6 zlib/1.2.12 nghttp2/1.64.0 Features (libcurl):  alt-svc AsynchDNS HSTS HTTP2 IPv6 Largefile libz NTLM SPNEGO SSL UnixSockets Features (built-in): brotli ```  ### Possible fixes  I think the issue is in: https://github.com/Orange-OpenSource/hurl/blob/9743695283efb8b15bead06b86aaf077d7280d25/packages/hurl/src/jsonpath/parser/singular_query.rs#L86-L90  since `is_alphanumeric` does not include `_`
  **Post-Mortem & Fix Analysis**:
  > Thanks @verigak for reporting the bug. We will release a `8.0.1` to include the fix.
  > @verigak  The new release is out! 
  > Thanks, that was fast!

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

### Incident Patch 1: `95312ad7` (2026-10-02)
**Commit Message**: Update docs (non regression after ruff check fixes)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ Security Issues Fixed:
 * Fix CVE-2026-63481 stripping cookie from Cookies section when redirecting to a different host [#5118](https://github.com/Orange-OpenSource/hurl/issues/5118)
 * Fix escaping headers values in HTML report [#5228](https://github.com/Orange-OpenSource/hurl/issues/5228)
 * Fix symlinks escaping file root [#5289](https://github.com/Orange-OpenSource/hurl/issues/5289)
+* Fix credentials leaking using --header and following redirection. [#5310](https://github.com/Orange-OpenSource/hurl/issues/5310)
 
 
 [8.0.1 (2026-04-28)](https://github.com/Orange-OpenSource/hurl/blob/master/CHANGELOG.md#8.0.1)
```

**File**: `docs/manual/hurl.1` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-.TH hurl 1 "31 Aug 2026" "hurl 8.1.0" " Hurl Manual"
+.TH hurl 1 "02 Oct 2026" "hurl 8.1.0" " Hurl Manual"
 .SH NAME
 
 hurl - run and test HTTP requests.
```

**File**: `docs/manual/hurlfmt.1` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-.TH hurl 1 "31 Aug 2026" "hurl 8.1.0" " Hurl Manual"
+.TH hurl 1 "02 Oct 2026" "hurl 8.1.0" " Hurl Manual"
 .SH NAME
 
 hurlfmt - format Hurl files
```

---

### Incident Patch 2: `85edded8` (2026-10-02)
**Commit Message**: Update Python dev dependencies and fixes new ruff check

**File**: `bin/check/license.py` (modified, +7/-6)
```diff
@@ -9,7 +9,7 @@
 
 import json
 import subprocess
-from typing import List, Tuple
+import sys
 
 
 def main():
@@ -41,7 +41,7 @@ def is_forbidden(name: str) -> bool:
     return False
 
 
-def check_licenses(deps: List[Tuple[str, str, str, str]]):
+def check_licenses(deps: list[tuple[str, str, str, str]]):
     authorized = []
     forbidden = []
     unknown = []
@@ -73,14 +73,14 @@ def check_licenses(deps: List[Tuple[str, str, str, str]]):
 
     if len(forbidden) > 0:
         print("There are forbidden licenses")
-        exit(1)
+        sys.exit(1)
 
     if len(unknown) > 0:
         print("There are unknown licenses")
-        exit(2)
+        sys.exit(2)
 
 
-def get_deps() -> List[Tuple[str, str, str, str]]:
+def get_deps() -> list[tuple[str, str, str, str]]:
     """Returns a list of crates name and licenses"""
     p = subprocess.run(
         [
@@ -91,10 +91,11 @@ def get_deps() -> List[Tuple[str, str, str, str]]:
         ],
         capture_output=True,
         text=True,
+        check=False,
     )
     if p.returncode != 0:
         print("Error calling cargo metadata")
-        exit(1)
+        sys.exit(1)
     data = json.loads(p.stdout)
     packages = data["packages"]
     licenses = [
```

**File**: `bin/check/rust_version.py` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@ def get_latest_release(token: str | None) -> None | tuple[str, datetime]:
     latest_release = releases[0]
     version = latest_release["tag_name"]
     date_str = latest_release["published_at"]
-    date = datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ")
+    date = datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S%z")
     return version, date
 
 
@@ -59,7 +59,7 @@ def main():
         sys.stderr.write(
             f"Rust version must be updated from {current_version} to the latest version {latest_version}\n"
         )
-        days_before_now = datetime.datetime.now() - date
+        days_before_now = datetime.datetime.now(datetime.timezone.utc) - date
         if days_before_now > datetime.timedelta(days=num_days_before_error):
             sys.exit(1)
     else:
```

**File**: `bin/coverage_uncovered_lines.py` (modified, +3/-2)
```diff
@@ -9,7 +9,8 @@
 def uncovered_lines(src_file):
     html_file = COVERAGE_DIR + "/" + src_file + ".html"
     sys.stderr.write(html_file + "\n")
-    html = open(html_file).read()
+    with open(html_file) as f:
+        html = f.read()
     soup = BeautifulSoup(html, "html.parser")
     elements = soup.select('div[role="row"]')
     lines = []
@@ -36,7 +37,7 @@ def main():
         if len(lines) > 0:
             print(src_file)
             for line_number, line in lines:
-                print("%s %s" % (line_number, line))
+                print(f"{line_number} {line}")
 
 
 if __name__ == "__main__":
```

**File**: `bin/docs/build_man.py` (modified, +10/-9)
```diff
@@ -13,21 +13,21 @@
 
 import re
 import sys
-from datetime import date
-from typing import Optional
+from datetime import date, datetime, timezone
 
 
 def header(version: str, today: date) -> str:
     today_formatted = today.strftime("%d %b %Y")
     return f'.TH hurl 1 "{today_formatted}" "hurl {version}" " Hurl Manual"'
 
 
-def version() -> Optional[str]:
+def version() -> str | None:
     p = re.compile('version = "(.*)"')
-    for line in open("packages/hurl/Cargo.toml", "r").readlines():
-        m = p.match(line)
-        if m:
-            return m.group(1)
+    with open("packages/hurl/Cargo.toml", "r") as f:
+        for line in f:
+            m = p.match(line)
+            if m:
+                return m.group(1)
     return None
 
 
@@ -78,8 +78,9 @@ def convert_md(s) -> str:
 
 def main():
     input_file = sys.argv[1]
-    data = open(input_file).readlines()
-    print(header(version(), date.today()))
+    with open(input_file) as f:
+        data = f.readlines()
+    print(header(version(), datetime.now(tz=timezone.utc).date()))
 
     s = "".join([convert_md(line) for line in data])
 
```

**File**: `bin/docs/build_man_md.py` (modified, +1/-3)
```diff
@@ -1,4 +1,3 @@
-#!/usr/bin/env python3
 """Build Grammar Markdown Manual File.
 
 This script converts Hurl manual file to Markdown suitable for the Hurl canonical docs.
@@ -13,7 +12,6 @@
 import re
 import sys
 from pathlib import Path
-from typing import List, Optional
 
 from markdown import (
     Header,
@@ -37,7 +35,7 @@ def normalize_h2(doc: MarkdownDoc) -> None:
 
 
 def process_table(
-    doc: MarkdownDoc, nodes: List[Node], col_name: str, level: int, title: Optional[str]
+    doc: MarkdownDoc, nodes: list[Node], col_name: str, level: int, title: str | None
 ) -> None:
     """Transform the list of items from the source manual document to a beautiful HTML tables.
 
```

**File**: `bin/docs/build_standalone_md.py` (modified, +4/-5)
```diff
@@ -1,4 +1,3 @@
-#!/usr/bin/env python3
 """
 Build a standalone Markdown file of all the documentation. All links and anchors are rewritten so the
 links are functional: during the concatenation of two files, the script insures that an anchor is well
@@ -13,7 +12,7 @@
 import re
 import sys
 import unicodedata
-from datetime import datetime
+from datetime import datetime, timezone
 from pathlib import Path
 
 import markdown
@@ -126,7 +125,7 @@ def rewrite_links(md: MarkdownDoc, prefix: str):
         add_header_id(header, prefix=prefix)
 
     # Replace `[Foo](#anchor)` => `[Foo](#current-page-anchor)`
-    nodes = [c for c in md.children if isinstance(c, Paragraph) or isinstance(c, Table)]
+    nodes = [c for c in md.children if isinstance(c, (Paragraph, Table))]
     for node in nodes:
 
         def repl(match_obj):
@@ -140,7 +139,7 @@ def repl(match_obj):
         )
 
     # Replace `[Foo](/docs/some-page.md#anchor)` => `[Foo](#some-page-anchor)`
-    nodes = [c for c in md.children if isinstance(c, Paragraph) or isinstance(c, Table)]
+    nodes = [c for c in md.children if isinstance(c, (Paragraph, Table))]
     for node in nodes:
 
         def repl(match_obj):
@@ -275,7 +274,7 @@ def main() -> int:
     standalone_md.children.insert(0, title)
     ws = Whitespace(content="\n")
     standalone_md.children.insert(1, ws)
-    date = datetime.today().strftime("%d-%m-%Y")
+    date = datetime.now(tz=timezone.utc).strftime("%d-%m-%Y")
     title = Header(title=f"Version {version} - {date}", level=2)
     standalone_md.children.insert(2, title)
     ws = Whitespace(content="\n")
```

**File**: `bin/docs/markdown.py` (modified, +10/-17)
```diff
@@ -10,37 +10,30 @@
 import re
 import unicodedata
 from textwrap import dedent
-from typing import List, Optional
 
 from parser import Parser
 
 
 class Node:
     """Represent the base class for a Markdown document token."""
 
-    content: Optional[str]
+    content: str | None
 
-    def __init__(self, content: Optional[str]) -> None:
+    def __init__(self, content: str | None) -> None:
         self.content = content
 
 
 class Code(Node):
     """A code block token (https://daringfireball.net/projects/markdown/syntax#precode)."""
 
-    pass
-
 
 class Paragraph(Node):
     """A paragraph token (https://daringfireball.net/projects/markdown/syntax#p)."""
 
-    pass
-
 
 class Whitespace(Node):
     """A whitespace token."""
 
-    pass
-
 
 def build_header(title: str, level: int, _id: str | None) -> str:
     """Constructs a header in Markdown format.
@@ -63,7 +56,7 @@ class Header(Node):
     level: int
     _id: str | None
 
-    def __init__(self, title: str, level: int, _id: str = None) -> None:
+    def __init__(self, title: str, level: int, _id: str | None = None) -> None:
         super().__init__(content=None)
         self.title = title
         self.level = level
@@ -300,7 +293,7 @@ class MarkdownDoc:
         children: children nodes of this document.
     """
 
-    children: List[Node]
+    children: list[Node]
 
     def __init__(self) -> None:
         self.children = []
@@ -309,7 +302,7 @@ def add_child(self, node) -> None:
         """Add a node to the document."""
         self.children.append(node)
 
-    def find_first(self, func, start: Optional[Node] = None) -> Optional[Node]:
+    def find_first(self, func, start: Node | None = None) -> Node | None:
         """Search the first child node that meet a criteria.
 
         Args:
@@ -347,7 +340,7 @@ def insert_node(self, start: Node, node: Node) -> None:
         index = self.children.index(start)
         self.children.insert(index, node)
 
-    def insert_nodes(self, start: Node, nodes: List[Node]) -> None:
+    def insert_nodes(self, start: Node, nodes: list[Node]) -> None:
         """Insert children nodes to the current document, before a specified node."""
         index = self.children.index(start)
         self.children[index:index] = nodes
@@ -360,11 +353,11 @@ def remove_node(self, node: Node) -> None:
         except ValueError:
             pass
 
-    def remove_nodes(self, nodes: List[Node]) -> None:
+    def remove_nodes(self, nodes: list[Node]) -> None:
         """Remove children nodes."""
         self.children = [node for node in self.children if node not in nodes]
 
-    def slice(self, node_a: Node, node_b: Node) -> List[Node]:
+    def slice(self, node_a: Node, node_b: Node) -> list[Node]:
         """Return a slice of the current children nodes
 
         Args:
@@ -375,15 +368,15 @@ def slice(self, node_a: Node, node_b: Node) -> List[Node]:
         index_b = self.children.index(node_b)
         return self.children[index_a:index_b]
 
-    def next_node(self, node: Node) -> Optional[Node]:
+    def next_node(self, node: Node) -> Node | None:
         """Return the following node of a specified child node."""
         index = self.children.index(node)
         if index < len(self.children):
             return self.children[index + 1]
         else:
             return None
 
-    def previous_node(self, node: Node) -> Optional[Node]:
+    def previous_node(self, node: Node) -> Node | None:
         """Return the following node of a specified child node."""
         index = self.children.index(node)
         if index > 0:
```

**File**: `bin/docs/markdown.test.py` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-#!/usr/bin/env python3
 import unittest
 
 from markdown import Table
```

---

### Incident Patch 3: `a9403df6` (2026-09-23)
**Commit Message**: Fix credentials leaking using --header and following redirection.

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect.hurl` (modified, +28/-0)
```diff
@@ -74,6 +74,20 @@ header "Location" not exists
 `Followed redirect without Authorization nor Cookie header!`
 
 
+# Yet another way to express headers with `[Options]` section.
+GET http://localhost:8000/follow-redirect-basic-auth?change_host=true
+[Options]
+header: Authorization:Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=
+header: Cookie:fruit=lemon
+HTTP 200
+[Asserts]
+redirects count == 1
+redirects nth 0 location == "http://127.0.0.1:8000/followed-redirect-basic-auth"
+url == "http://127.0.0.1:8000/followed-redirect-basic-auth"
+header "Location" not exists
+`Followed redirect without Authorization nor Cookie header!`
+
+
 # Same has previous but the host doesn't change during redirection.
 # Back checks will insure that `Authorization` and `Cookie` header are forwarded.
 GET http://localhost:8000/follow-redirect-basic-auth?change_host=false
@@ -102,6 +116,20 @@ header "Location" not exists
 `Followed redirect with Authorization and Cookie header!`
 
 
+# Yet another way to express headers with `[Options]` section.
+GET http://localhost:8000/follow-redirect-basic-auth?change_host=false
+[Options]
+header: Authorization:Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=
+header: Cookie:fruit=lemon
+HTTP 200
+[Asserts]
+redirects count == 1
+redirects nth 0 location == "http://localhost:8000/followed-redirect-basic-auth"
+url == "http://localhost:8000/followed-redirect-basic-auth"
+header "Location" not exists
+`Followed redirect with Authorization and Cookie header!`
+
+
 # Another kinds of user authentication with `--user` in `[Options]` section:
 GET http://localhost:8000/follow-redirect-basic-auth?change_host=true
 [Options]
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.curl` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+curl --header 'Authorization: Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=' --header 'Cookie: fruit=lemon' --location 'http://localhost:8000/follow-redirect-leak/host-a-step-1'
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.hurl` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+GET http://localhost:8000/follow-redirect-leak/host-a-step-1
+HTTP 200
+[Asserts]
+redirects count == 2
+redirects nth 0 location == "http://127.0.0.1:8000/follow-redirect-leak/host-b-step-2"
+redirects nth 1 location == "http://localhost:8000/follow-redirect-leak/host-a-step-3"
+url == "http://localhost:8000/follow-redirect-leak/host-a-step-3"
+header "Location" not exists
+`Followed redirect!`
+
+
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.out` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Followed redirect!
\ No newline at end of file
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.ps1` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+Set-StrictMode -Version latest
+$ErrorActionPreference = 'Stop'
+
+hurl --location `
+  --header 'Authorization: Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=' `
+  --header 'Cookie: fruit=lemon' `
+  tests_ok/follow_redirect/follow_redirect_leak.hurl
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.py` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+from app import app
+from flask import redirect, request
+
+
+@app.route("/follow-redirect-leak/host-a-step-1")
+def follow_redirect_leak_host_a_step_1():
+    assert "Authorization" in request.headers
+    assert request.cookies.get("fruit") is not None
+    return redirect("http://127.0.0.1:8000/follow-redirect-leak/host-b-step-2")
+
+
+@app.route("/follow-redirect-leak/host-b-step-2")
+def follow_redirect_leak_host_b_step_2():
+    assert "Authorization" not in request.headers
+    assert request.cookies.get("fruit") is None
+    return redirect("http://localhost:8000/follow-redirect-leak/host-a-step-3")
+
+
+@app.route("/follow-redirect-leak/host-a-step-3")
+def follow_redirect_leak_host_a_step_3():
+    # Back on the original host: credentials must be forwarded again, just like curl does.
+    assert "Authorization" in request.headers
+    assert request.cookies.get("fruit") is not None
+    return "Followed redirect!"
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.sh` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+#!/bin/bash
+set -Eeuo pipefail
+
+hurl --location \
+  --header 'Authorization: Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=' \
+  --header 'Cookie: fruit=lemon' \
+  tests_ok/follow_redirect/follow_redirect_leak.hurl
```

**File**: `packages/hurl/src/http/client.rs` (modified, +21/-6)
```diff
@@ -35,8 +35,7 @@ use super::debug;
 use super::easy_ext;
 use super::error::HttpError;
 use super::header::{
-    ACCEPT_ENCODING, AUTHORIZATION, CONTENT_TYPE, COOKIE, EXPECT, Header, HeaderVec, LOCATION,
-    USER_AGENT,
+    ACCEPT_ENCODING, AUTHORIZATION, CONTENT_TYPE, EXPECT, Header, HeaderVec, LOCATION, USER_AGENT,
 };
 use super::ip::IpAddr;
 use super::options::{ClientOptions, Verbosity};
@@ -95,6 +94,16 @@ impl Client {
         let mut request_spec = request_spec.clone();
         let mut options = options.clone();
 
+        // We keep a pristine copy of the original request's credentials-related headers/cookies
+        // and of the original options' headers/user. On each redirect hop, credentials are
+        // stripped or restored based on a comparison between `original_url` and the redirect
+        // target, so a chain like host A -> host B -> host A forwards credentials again once
+        // back on the original host, mirroring libcurl's behaviour.
+        let original_headers = request_spec.headers.clone();
+        let original_cookies = request_spec.cookies.clone();
+        let original_options_headers = options.headers.clone();
+        let original_options_user = options.user.clone();
+
         // Unfortunately, follow-location feature from libcurl can not be used as libcurl returns a
         // single list of headers for the 2 responses and Hurl needs to keep every header of every
         // response.
@@ -125,8 +134,6 @@ impl Client {
             };
 
             let redirect_method = redirect_method(status, &request_spec.method);
-            let mut headers = request_spec.headers;
-            let mut cookies = request_spec.cookies;
 
             // When following redirection, we filter `Authorization` and `Cookie` headers if the
             // hostname changes unless the user explicitly trusts the redirected host with `--location-trusted`.
@@ -135,14 +142,22 @@ impl Client {
             // > By default, libcurl only sends Authentication: or explicitly set Cookie: headers
             // > to the initial host given in the original URL, to avoid leaking username + password
             // > to other sites.
+            //
+            // We always recompute headers, cookies, user (everything that can have credentials)
+            // from original request rather than from the previous redirection step. A redirect chain
+            // A -> B -> A will forward credentials on the final step.
+            let mut headers = original_headers.clone();
+            let mut cookies = original_cookies.clone();
+            options.headers = original_options_headers.clone();
+            options.user = original_options_user.clone();
             if should_strip_credentials_on_redirect(
                 original_url,
                 &redirect_url,
                 options.follow_location,
             ) {
-                headers.retain(|h| !h.name_eq(AUTHORIZATION));
-                headers.retain(|h| !h.name_eq(COOKIE));
+                headers.remove_credentials();
                 cookies.clear();
+                options.headers.remove_credentials();
                 options.user = None;
             }
 
```

---

### Incident Patch 4: `e2840637` (2026-09-25)
**Commit Message**: Fix hurl.dev ssl integration test.

**File**: `integration/hurl/tests_ssl/keepalive.hurl` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ HTTP 200
 [Asserts]
 header "Connection" not exists
 certificate "Subject" replace " = " "=" replace ";" ", " == "CN=hurl.dev"
-certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=YR2$"
+certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=.*$"
 certificate "Expire-Date" daysAfterNow > 15
 certificate "Serial-Number" matches /^([\da-f]{2}:){17}[\da-f]{2}$/
 
@@ -25,7 +25,7 @@ GET https://hurl.dev
 HTTP 200
 [Asserts]
 certificate "Subject" replace " = " "=" replace ";" ", " == "CN=hurl.dev"
-certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=YR2$"
+certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=.*$"
 certificate "Expire-Date" daysAfterNow > 15
 certificate "Serial-Number" matches /^([\da-f]{2}:){17}[\da-f]{2}$/
 
```

**File**: `integration/hurl/tests_ssl/letsencrypt.hurl` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ GET https://hurl.dev
 HTTP 200
 [Asserts]
 certificate "Subject" replace " = " "=" replace ";" ", " == "CN=hurl.dev"
-certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=YR2$"
+certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=.*$"
 certificate "Expire-Date" isDate
 certificate "Expire-Date" daysAfterNow > 15
 certificate "Serial-Number" matches /^([\da-f]{2}:){17}[\da-f]{2}$/
```

---

### Incident Patch 5: `8c77755d` (2026-09-14)
**Commit Message**: Fix micro typo in semantique JSON spec.

**File**: `docs/spec/runner/assert_json_body.md` (modified, +16/-13)
```diff
@@ -108,12 +108,12 @@ We will use this expected JSON below:
  
 Expected value
    
-   24    "age": 22
+    24    "age": 22
 
 
 Actual Value
 
-        "age": 20
+    "age": 20
 
 
 Explicit jsonpath assert error
@@ -135,8 +135,12 @@ Explicit jsonpath assert error
 
 
     23 |   "is_alive": true,
-       |    ^^^^^^^^  Missing expected key $.is_alive 
+       |    ^^^^^^^^ missing expected key <is_alive> at $.is_alive 
        
+> We output the name of the key rendered because the source code can be templatized:
+> 
+>     23 |   "{{some_key}}": true,
+>        |    ^^^^^^^^ missing expected key <is_alive> at $.is_alive
 
 Explicit jsonpath assert error
 
@@ -150,7 +154,7 @@ Explicit jsonpath assert error
     20 |  {
        |  ...
     47 |  }
-       |  ^ Unexpected actual key <country> at $.country
+       |  ^ unexpected actual key <country> at $.country
 
 
 The line number matches the line for which it could be added in the source Hurl file.
@@ -174,7 +178,8 @@ Expected array
     45      ]
 
 Actual array
-           "children": [
+
+        "children": [
               "Thomas",
               "Trevor"
            ]
@@ -196,8 +201,6 @@ Explicit jsonpath assert error
         |
 
 
-
-
 ### case 5 - mismatch value in array of objects
 
 
@@ -264,9 +267,9 @@ Actual array
 Assert JSON Body Error
 
     44  |    "Trevor" 
-        |    ^^^^^^^^ Missing expected array element at $.children[2] 
-        |  actual: nothing
-        |  expected string <Trevor>
+        |    ^^^^^^^^ missing expected array element at $.children[2] 
+        |  actual:   nothing
+        |  expected: string <Trevor>
 
 
 Explicit jsonpath assert error
@@ -289,19 +292,19 @@ Expected array
     45      ]
 
 Actual array
+
            "children": [
               "Catherine",
               "Thomas",
               "Trevor",
               "Bob"
            ]
 
-
 Assert JSON Body Error
 
     45 |   ]
        |   ^ unexpected actual array element at $.children[3]
-       |  actual:  string <Bob>   
+       |  actual:   string <Bob>   
        |  expected: nothing
 
 
@@ -318,7 +321,7 @@ Explicit jsonpath assert error
  
 Expected value
    
-   24    "age": 22
+    24    "age": 22
 
 
 Actual Value
```

---

### Incident Patch 6: `b5864c95` (2026-09-14)
**Commit Message**: Don't fail build on Windows if file icon is not reachable.

**File**: `packages/hurl/build.rs` (modified, +8/-3)
```diff
@@ -15,7 +15,6 @@
  * limitations under the License.
  *
  */
-
 use std::path::Path;
 
 use cc::Build;
@@ -24,9 +23,15 @@ use winres::WindowsResource;
 
 #[cfg(windows)]
 fn set_icon() {
+    let icon = "../../bin/windows/logo.ico";
+    if !Path::new(icon).exists() {
+        return;
+    }
     let mut res = WindowsResource::new();
-    res.set_icon("../../bin/windows/logo.ico");
-    res.compile().unwrap();
+    res.set_icon(icon);
+    if let Err(e) = res.compile() {
+        println!("cargo:warning=failed to compile Windows resource: {e}");
+    }
 }
 
 #[cfg(unix)]
```

---

### Incident Patch 7: `02a95808` (2026-09-09)
**Commit Message**: Fix symlinks escaping file root.

**File**: `integration/hurl/tests_failed/fileroot/fileroot.err` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+error: Unauthorized file access
+  --> tests_failed/fileroot/fileroot.hurl:3:9
+   |
+   | GET http://localhost:8000/fileroot-ko
+   | ...
+ 3 | output: authorized.bin
+   |         ^^^^^^^^^^^^^^ unauthorized access to file authorized.bin, check --file-root option
+   |
+
+error: Unauthorized file access
+  --> tests_failed/fileroot/fileroot.hurl:8:6
+   |
+   | POST http://localhost:8000/fileroot-ko
+ 8 | file,authorized.bin;
+   |      ^^^^^^^^^^^^^^ unauthorized access to file authorized.bin, check --file-root option
+   |
+
+error: Unauthorized file access
+  --> tests_failed/fileroot/fileroot.hurl:14:9
+   |
+   | GET http://localhost:8000/fileroot-ko
+   | ...
+14 | output: authorized_dir/output.bin
+   |         ^^^^^^^^^^^^^^^^^^^^^^^^^ unauthorized access to file authorized_dir/output.bin, check --file-root option
+   |
+
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.exit` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+3
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.hurl` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+GET http://localhost:8000/fileroot-ko
+[Options]
+output: authorized.bin
+HTTP 200
+
+
+POST http://localhost:8000/fileroot-ko
+file,authorized.bin;
+HTTP 200
+
+
+GET http://localhost:8000/fileroot-ko
+[Options]
+output: authorized_dir/output.bin
+HTTP 200
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.ps1` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+Set-StrictMode -Version latest
+$ErrorActionPreference = 'Stop'
+
+# We test that a symlink cannot access outside the file-root (directory containing the Hurl file by default)
+# Symlinks can be a file, or a directory containing a file that doesn't exist yet.
+
+$unauthorized = Join-Path $env:TEMP 'unauthorized.bin'
+$unauthorizedDir = Join-Path $env:TEMP 'unauthorized_dir'
+Remove-Item -Path $unauthorizedDir -Recurse -Force -ErrorAction SilentlyContinue
+New-Item -Path $unauthorized -Force -ItemType File | Out-Null
+New-Item -Path $unauthorizedDir -Force -ItemType Directory | Out-Null
+New-Item -Path tests_failed/fileroot/authorized.bin -Force -ItemType SymbolicLink -Target $unauthorized | Out-Null
+New-Item -Path tests_failed/fileroot/authorized_dir -Force -ItemType SymbolicLink -Target $unauthorizedDir | Out-Null
+hurl --continue-on-error tests_failed/fileroot/fileroot.hurl
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.py` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+from app import app
+
+
+@app.route("/fileroot-ko", methods=["GET", "POST"])
+def fileroot_ko():
+    return "Error!"
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.sh` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+#!/bin/bash
+set -Eeuo pipefail
+
+# We test that a symlink cannot access outside the file-root (directory containing the Hurl file by default)
+# Symlinks can be a file, or a directory containing a file that doesn't exist yet.
+
+rm -rf /tmp/unauthorized_dir
+mkdir -p /tmp/unauthorized_dir
+touch /tmp/unauthorized.bin
+ln -fs /tmp/unauthorized.bin tests_failed/fileroot/authorized.bin
+ln -fns /tmp/unauthorized_dir tests_failed/fileroot/authorized_dir
+hurl --continue-on-error tests_failed/fileroot/fileroot.hurl
```

**File**: `packages/hurl/src/runner/body.rs` (modified, +2/-2)
```diff
@@ -120,7 +120,7 @@ mod tests {
         });
 
         let variables = VariableSet::new();
-        let current_dir = Path::new("/home");
+        let current_dir = Path::new("/my_home");
         let file_root = Path::new("");
         let context_dir = ContextDir::new(current_dir, file_root);
         assert_eq!(
@@ -152,7 +152,7 @@ mod tests {
 
         let variables = VariableSet::new();
 
-        let current_dir = Path::new("/home");
+        let current_dir = Path::new("/my_home");
         let file_root = Path::new("file_root");
         let context_dir = ContextDir::new(current_dir, file_root);
         let error = eval_bytes(&bytes, &variables, &context_dir).err().unwrap();
```

**File**: `packages/hurl/src/util/path.rs` (modified, +65/-37)
```diff
@@ -66,9 +66,10 @@ impl ContextDir {
 }
 
 /// Return true if `path` is a descendant path of `ancestor`, false otherwise.
+/// Both paths are resolved before test, so symlinks can't be used to escape `ancestor`.
 fn is_descendant(path: &Path, ancestor: &Path) -> bool {
-    let path = normalize_path(path);
-    let ancestor = normalize_path(ancestor);
+    let path = resolve_path(path);
+    let ancestor = resolve_path(ancestor);
     for a in path.ancestors() {
         if ancestor == a {
             return true;
@@ -77,9 +78,36 @@ fn is_descendant(path: &Path, ancestor: &Path) -> bool {
     false
 }
 
+/// Returns the absolute form of this `path`, with symlinks resolved.
+///
+/// Contrary to the method [`std::fs::canonicalize`] on [`Path`], this function doesn't require
+/// `path` to exist: the longest prefix of `path` that exists is canonicalized, then the remaining
+/// components are appended to it, lexically normalized (they can't be resolved as they don't exist
+/// on the filesystem). This is needed to check files that are not created yet, like `output` files.
+fn resolve_path(path: &Path) -> PathBuf {
+    let components = path.components().collect::<Vec<_>>();
+    for i in (0..=components.len()).rev() {
+        let prefix = components[..i].iter().collect::<PathBuf>();
+        let Ok(mut resolved) = prefix.canonicalize() else {
+            continue;
+        };
+        for component in &components[i..] {
+            match component {
+                Component::CurDir => {}
+                Component::ParentDir => {
+                    resolved.pop();
+                }
+                _ => resolved.push(component),
+            }
+        }
+        return resolved;
+    }
+    normalize_path(path)
+}
+
 /// Returns the absolute form of this `path` with all intermediate components normalized.
 /// Contrary to the methods [`std::fs::canonicalize`] on [`Path`], this function doesn't require
-/// the final path to exist.
+/// the final `path` to exist.
 ///
 /// Borrowed from https://github.com/rust-lang/cargo/blob/master/crates/cargo-util/src/paths.rs
 fn normalize_path(path: &Path) -> PathBuf {
@@ -124,18 +152,18 @@ mod tests {
     #[test]
     fn check_filename_allowed_access_without_user_file_root() {
         // ```
-        // $ cd /tmp
+        // $ cd /dir
         // $ hurl test.hurl
         // ```
-        let current_dir = Path::new("/tmp");
+        let current_dir = Path::new("/dir");
         let file_root = Path::new("");
         let ctx = ContextDir::new(current_dir, file_root);
         assert!(ctx.is_access_allowed(Path::new("foo.bin")));
-        assert!(ctx.is_access_allowed(Path::new("/tmp/foo.bin")));
+        assert!(ctx.is_access_allowed(Path::new("/dir/foo.bin")));
         assert!(ctx.is_access_allowed(Path::new("a/foo.bin")));
         assert!(ctx.is_access_allowed(Path::new("a/b/foo.bin")));
-        assert!(ctx.is_access_allowed(Path::new("../tmp/a/b/foo.bin")));
-        assert!(ctx.is_access_allowed(Path::new("../../../tmp/a/b/foo.bin")));
+        assert!(ctx.is_access_allowed(Path::new("../dir/a/b/foo.bin")));
+        assert!(ctx.is_access_allowed(Path::new("../../../dir/a/b/foo.bin")));
 
         assert!(!ctx.is_access_allowed(Path::new("/file/foo.bin")));
         assert!(!ctx.is_access_allowed(Path::new("../foo.bin")));
@@ -146,10 +174,10 @@ mod tests {
     #[test]
     fn check_filename_allowed_access_with_explicit_absolute_user_file_root() {
         // ```
-        // $ cd /tmp
+        // $ cd /dir
         // $ hurl --file-root /file test.hurl
         // ```
-        let current_dir = Path::new("/tmp");
+        let current_dir = Path::new("/dir");
         let file_root = Path::new("/file");
         let ctx = ContextDir::new(current_dir, file_root);
         assert!(ctx.is_access_allowed(Path::new("foo.bin"))); // absolute path is /file/foo.bin
@@ -158,13 +186,13 @@ mod tests {
         assert!(ctx.is_access_allowed(Path::new("a/b/foo.bin")));
         assert!(ctx.is_access_allowed(Path::new("../../file/foo.bin")));
 
-        assert!(!ctx.is_access_allowed(Path::new("/tmp/foo.bin")));
-        assert!(!ctx.is_access_allowed(Path::new("../tmp/a/b/foo.bin")));
+        assert!(!ctx.is_access_allowed(Path::new("/dir/foo.bin")));
+        assert!(!ctx.is_access_allowed(Path::new("../dir/a/b/foo.bin")));
         assert!(!ctx.is_access_allowed(Path::new("../foo.bin")));
         assert!(!ctx.is_access_allowed(Path::new("../../foo.bin")));
-        assert!(!ctx.is_access_allowed(Path::new("../../../tmp/a/b/foo.bin")));
+        assert!(!ctx.is_access_allowed(Path::new("../../../dir/a/b/foo.bin")));
 
-        let current_dir = Path::new("/tmp");
+        let current_dir = Path::new("/dir");
         let file_root = Path::new("../file");
         let ctx = ContextDir::new(current_dir, file_root);
         assert!(ctx.is_access_allowed(Path::new("foo.bin")));
@@ -173,46 +201,46 @@ mod tests {
         assert!(ctx.is_access_allowed(Path::new("a/b/
```

---

### Incident Patch 8: `5c26afe9` (2026-09-09)
**Commit Message**: Use latest libcurl for Windows build

**File**: `bin/install_prerequisites_windows.ps1` (modified, +0/-3)
```diff
@@ -46,9 +46,6 @@ git -C $vcpkg_dir pull
 & "$vcpkg_dir\bootstrap-vcpkg.bat"
 vcpkg upgrade --no-dry-run
 if ($LASTEXITCODE) { Throw }
-# Downgrade to 8.19.0 => https://github.com/Orange-OpenSource/hurl/issues/5105
-git -C "$vcpkg_dir" restore --source=4f326c4072038c8624c36a8ba5ed23f616adda53 --worktree ports/curl
-git -C "$vcpkg_dir" restore --source=4f326c4072038c8624c36a8ba5ed23f616adda53 --worktree ports/zlib
 
 # install libxml and libcurl
 vcpkg install --recurse curl[core,sspi,http2,non-http,ssl]:x64-windows
```

**File**: `bin/release/release.ps1` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ $release_dir="$project_root_path\target\release"
 $package_dir="$project_root_path\target\win-package"
 New-Item -ItemType Directory -Force -Path $package_dir
 Copy-Item -Path $lib_dir\libcurl.dll -Destination $package_dir
-Copy-Item -Path $lib_dir\zlib1.dll -Destination $package_dir
+Copy-Item -Path $lib_dir\z.dll -Destination $package_dir
 Copy-Item -Path $lib_dir\nghttp2.dll -Destination $package_dir
 Copy-Item -Path $lib_dir\libxml2.dll -Destination $package_dir
 Copy-Item -Path $lib_dir\iconv-2.dll -Destination $package_dir
```

**File**: `bin/windows/hurl.nsi` (modified, +2/-2)
```diff
@@ -99,10 +99,10 @@ SectionGroup "dlls"
     SetOutPath $INSTDIR
     File "libxml2.dll"
   SectionEnd
-  Section "zlib1.dll"
+  Section "z.dll"
     SectionIn RO
     SetOutPath $INSTDIR
-    File "zlib1.dll"
+    File "z.dll"
   SectionEnd
   Section "libcurl.dll"
     SectionIn RO
```

**File**: `docs/spec/packages/hurl-x.y.z-x86_64-pc-windows-msvc-installer.exe.anatomy` (modified, +1/-1)
```diff
@@ -22,4 +22,4 @@ attr     user_group  type  file
 -------  ---         file  libxml2.dll
 -------  ---         file  nghttp2.dll
 -------  ---         file  version.txt
--------  ---         file  zlib1.dll
+-------  ---         file  z.dll
```

**File**: `docs/spec/packages/hurl-x.y.z-x86_64-pc-windows-msvc.zip.anatomy` (modified, +1/-1)
```diff
@@ -16,4 +16,4 @@ attr     user_group  type  file
 -rw----  defN        file  libxml2.dll
 -rw----  defN        file  nghttp2.dll
 -rw----  defN        file  version.txt
--rw----  defN        file  zlib1.dll
+-rw----  defN        file  z.dll
```

---

### Incident Patch 9: `0f1b49b7` (2026-09-09)
**Commit Message**: Fix output_type configuration.

**File**: `packages/hurl/src/cli/options/args.rs` (modified, +1/-1)
```diff
@@ -797,7 +797,7 @@ fn output(arg_matches: &ArgMatches, default_value: Option<Output>) -> Option<Out
 fn output_type(arg_matches: &ArgMatches, default_value: OutputType) -> OutputType {
     if has_flag(arg_matches, "json") {
         OutputType::Json
-    } else if has_flag(arg_matches, "no_output") || has_flag(arg_matches, "test") {
+    } else if has_flag(arg_matches, "no_output") {
         OutputType::NoOutput
     } else {
         default_value
```

**File**: `packages/hurl/src/cli/options/env_vars.rs` (modified, +0/-2)
```diff
@@ -651,8 +651,6 @@ fn no_jsonpath_coercion(env_vars: &EnvVars, default_value: bool) -> bool {
 fn output_type(env_vars: &EnvVars, default_value: OutputType) -> OutputType {
     if let Some(true) = env_vars.no_output() {
         OutputType::NoOutput
-    } else if let Some(true) = env_vars.test() {
-        OutputType::NoOutput
     } else {
         default_value
     }
```

**File**: `packages/hurl/src/cli/options/mod.rs` (modified, +8/-1)
```diff
@@ -289,6 +289,13 @@ fn resolve_implicit(context: &RunContext, default_options: CliOptions) -> CliOpt
     if let BoolOpt::Auto = options.parallel {
         options.parallel = BoolOpt::Set(options.test);
     }
+    // No output for test mode
+    if let OutputType::ResponseBody = options.output_type
+        && options.test
+    {
+        options.output_type = OutputType::NoOutput;
+    }
+
     // If stdout is not a terminal, disable prettifying
     if let PrettyMode::Automatic = options.pretty
         && !context.is_stdout_term()
@@ -765,7 +772,7 @@ mod tests {
         assert!(opts.test);
         assert!(opts.progress_bar.get());
         assert!(opts.parallel.get());
-        //assert_eq!(opts.output_type, OutputType::NoOutput);
+        assert_eq!(opts.output_type, OutputType::NoOutput);
     }
 
     #[test]
```

---

### Incident Patch 10: `0e427288` (2026-09-03)
**Commit Message**: Fix integration test for cookie value on curl 8.22 due to <https://github.com/curl/curl/pull/22730>

curl 8.22 changes cookie managment for PSL. A cookie that set Domain=localhost for request on localhost becomes host only. So in curl 8.22, such a request changes a cookie from subdomain to host only.

**File**: `integration/hurl/tests_ok/captures/captures_to_json.out.pattern` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"cookies":[{"domain":".localhost","expires":<<<\d+>>>,"https":false,"include_subdomain":true,"name":"foo","path":"/bar","value":"value1"}],"entries":[{"asserts":[{"line":2,"success":true},{"line":2,"success":true},{"line":12,"success":true},{"line":13,"success":true},{"line":14,"success":true},{"line":15,"success":true},{"line":16,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?>>>"}],"method":"GET","query_string":[],"url":"http://localhost:8000/captures"},"response":{"cookies":[],"headers":[{"name":"Content-Length","value":"12"},{"name":"Content-Type","value":"text/html; charset=utf-8"},{"name":"Date","value":"<<<.*?>>>"},{"name":"Header1","value":"value1"},{"name":"Header2","value":"Hello Bob!"},{"name":"Server","value":"Flask Server"},{"name":"Via","value":"waitress"}],"http_version":"HTTP/1.1","status":200},"timings":{"app_connect":<<<\d+>>>,"begin_call":"<<<.*?>>>","connect":<<<\d+>>>,"end_call":"<<<.*?>>>","name_lookup":<<<\d+>>>,"pre_transfer":<<<\d+>>>,"start_transfer":<<<\d+>>>,"total":<<<\d+>>>}}],"captures":[{"name":"param1","value":"value1"},{"name":"param2","value":"Bob"},{"name":"param3","value":"Bob"},{"name":"data1","value":"Hello world!"},{"name":"data2","value":"Hello world!"}],"curl_cmd":"curl 'http://localhost:8000/captures'","index":1,"line":1,"time":<<<\d+>>>},{"asserts":[{"line":23,"success":true},{"line":23,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?>>>"}],"method":"GET","query_string":[{"name":"param1","value":"value1"},{"name":"param2","value":"Bob"}],"url":"http://localhost:8000/captures-check?param1=value1&param2=Bob"},"response":{"cookies":[],"headers":[{"name":"Content-Length","value":"0"},{"name":"Content-Type","value":"text/html; charset=utf-8"},{"name":"Date","value":"<<<.*?>>>"},{"name":"Server","value":"Flask Server"},{"name":"Via","value":"waitress"}],"http_version":"HTTP/1.1","status":200},"timings":{"app_connect":<<<\d+>>>,"begin_call":"<<<.*?>>>","connect":<<<\d+>>>,"end_call":"<<<.*?>>>","name_lookup":<<<\d+>>>,"pre_transfer":<<<\d+>>>,"start_transfer":<<<\d+>>>,"total":<<<\d+>>>}}],"captures":[],"curl_cmd":"curl 'http://localhost:8000/captures-check?param1=value1&param2=Bob'","index":2,"line":19,"time":<<<\d+>>>},{"asserts":[{"line":30,"success":true},{"line":30,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?>>>"}],"method":"GET","query_string":[{"name":"param1","value":"value1"},{"name":"param2","value":"Bob"}],"url":"http://localhost:8000/captures-check?param1=value1&param2=Bob"},"response":{"cookies":[],"headers":[{"name":"Content-Length","value":"0"},{"name":"Content-Type","value":"text/html; charset=utf-8"},{"name":"Date","value":"<<<.*?>>>"},{"name":"Server","value":"Flask Server"},{"name":"Via","value":"waitress"}],"http_version":"HTTP/1.1","status":200},"timings":{"app_connect":<<<\d+>>>,"begin_call":"<<<.*?>>>","connect":<<<\d+>>>,"end_call":"<<<.*?>>>","name_lookup":<<<\d+>>>,"pre_transfer":<<<\d+>>>,"start_transfer":<<<\d+>>>,"total":<<<\d+>>>}}],"captures":[],"curl_cmd":"curl 'http://localhost:8000/captures-check?param1=value1&param2=Bob'","index":3,"line":26,"time":<<<\d+>>>},{"asserts":[{"line":34,"success":true},{"line":34,"success":true},{"line":38,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?>>>"}],"method":"GET","query_string":[],"url":"http://localhost:8000/captures-xml"},"response":{"cookies":[],"headers":[{"name":"Content-Length","value":"166"},{"name":"Content-Type","value":"text/html; charset=utf-8"},{"name":"Date","value":"<<<.*?>>>"},{"name":"Server","value":"Flask Server"},{"name":"Via","value":"waitress"}],"http_version":"HTTP/1.1","status":200},"timings":{"app_connect":<<<\d+>>>,"begin_call":"<<<.*?>>>","connect":<<<\d+>>>,"end_call":"<<<.*?>>>","name_lookup":<<<\d+>>>,"pre_transfer":<<<\d+>>>,"start_transfer":<<<\d+>>>,"total":<<<\d+>>>}}],"captures":[{"name":"a_node_set","value":{"size":2,"type":"nodeset"}}],"curl_cmd":"curl 'http://localhost:8000/captures-xml'","index":4,"line":33,"time":<<<\d+>>>},{"asserts":[{"line":42,"success":true},{"line":42,"success":true},{"line":51,"success":true},{"line":52,"success":true},{"line":53,"success":true},{"line":54,"success":true},{"line":55,"success":true},{"line":56,"success":true},{"line":57,"success":true},{"line":58,"success":true},{"line":59,"success":true},{"line":60,"success":true},{"line":61,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?
```

**File**: `integration/hurl/tests_ok/captures/captures_verbose.err.pattern` (modified, +2/-2)
```diff
@@ -92,7 +92,7 @@
 [1;34m*[0m [1mExecuting entry 4[0m
 [1;34m*[0m
 [1;34m*[0m [1mCookie store:[0m
-[1;34m*[0m #HttpOnly_.localhost	TRUE	/bar	FALSE	<<<\d+>>>	foo	value1
+[1;34m*[0m #HttpOnly_<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/bar	FALSE	<<<\d+>>>	foo	value1
 [1;34m*[0m
 [1;34m*[0m [1mRequest:[0m
 [1;34m*[0m GET http://localhost:8000/captures-json
@@ -136,7 +136,7 @@
 [1;34m*[0m location: true
 [1;34m*[0m
 [1;34m*[0m [1mCookie store:[0m
-[1;34m*[0m #HttpOnly_.localhost	TRUE	/bar	FALSE	<<<\d+>>>	foo	value1
+[1;34m*[0m #HttpOnly_<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/bar	FALSE	<<<\d+>>>	foo	value1
 [1;34m*[0m
 [1;34m*[0m [1mRequest:[0m
 [1;34m*[0m GET http://localhost:8000/redirect-to-captures-json
```

**File**: `integration/hurl/tests_ok/cookie/cookie_jar.out.pattern` (modified, +3/-3)
```diff
@@ -3,6 +3,6 @@
 
 # Cookies for file <tests_ok/cookie/cookie_jar.hurl>
 #HttpOnly_localhost	FALSE	/accounts	FALSE	<<<(18\d{8}|3409338181)>>>	LSID	DQAAAKEaem_vYg
-#HttpOnly_.localhost	TRUE	/	FALSE	<<<(18\d{8}|3409338181)>>>	HSID	AYQEVnDKrdst
-#HttpOnly_.localhost	TRUE	/	FALSE	<<<(18\d{8}|3409338181)>>>	SSID	Ap4PGTEq
-.localhost	TRUE	/	FALSE	<<<(18\d{8}|3093675001)>>>	foo	"a b c"
+#HttpOnly_<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/	FALSE	<<<(18\d{8}|3409338181)>>>	HSID	AYQEVnDKrdst
+#HttpOnly_<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/	FALSE	<<<(18\d{8}|3409338181)>>>	SSID	Ap4PGTEq
+<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/	FALSE	<<<(18\d{8}|3093675001)>>>	foo	"a b c"
```

---

### Incident Patch 11: `9572cc7c` (2026-09-02)
**Commit Message**: Fix CodeQL access on invalid pointer warnings.

**File**: `packages/hurl/src/http/easy_ext.rs` (modified, +10/-9)
```diff
@@ -65,10 +65,14 @@ pub fn cert_info(easy: &Easy) -> Result<Option<CertInfo>, Error> {
         let Some(certinfo) = certinfo.as_ref() else {
             return Ok(None);
         };
-        if certinfo.num_of_certs <= 0 || certinfo.certinfo.is_null() {
+        if certinfo.num_of_certs <= 0 {
             return Ok(None);
         }
-        let slist = *certinfo.certinfo;
+        // `certinfo.certinfo` is a list of `num_of_certs` certificates, we read the first one,
+        // `as_ref` returning `None` when the array is null.
+        let Some(&slist) = certinfo.certinfo.as_ref() else {
+            return Ok(None);
+        };
         let data = to_list(slist);
         let value = extract_pem_from_certinfo(&data);
 
@@ -221,15 +225,12 @@ pub fn netrc_file(easy: &mut Easy, filename: &str) -> Result<(), Error> {
 fn to_list(slist: *mut curl_slist) -> Vec<String> {
     let mut data = vec![];
     let mut cur = slist;
-    loop {
-        if cur.is_null() {
-            break;
-        }
-        unsafe {
-            let ret = CStr::from_ptr((*cur).data).to_bytes();
+    unsafe {
+        while let Some(node) = cur.as_ref() {
+            let ret = CStr::from_ptr(node.data).to_bytes();
             let value = String::from_utf8_lossy(ret);
             data.push(value.to_string());
-            cur = (*cur).next;
+            cur = node.next;
         }
     }
     data
```

---

### Incident Patch 12: `6ed01cf9` (2026-08-31)
**Commit Message**: Minor typo fix to test the CodeQL config file.

**File**: `art/branding.md` (modified, +1/-1)
```diff
@@ -11,4 +11,4 @@
 
 - pink: #ff0288
 - logo text (light mode): #333333
-- logo text (dark mode): #dedede
\ No newline at end of file
+- logo text (dark mode): #dedede
```

---

### Incident Patch 13: `3a8f3750` (2026-08-31)
**Commit Message**: Disable autobuild in CodeQL analysis.

**File**: `.github/workflows/codeql.yml` (modified, +1/-11)
```diff
@@ -19,15 +19,7 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        include:
-          - language: c-cpp
-            build-mode: none
-          - language: actions
-            build-mode: none
-          - language: python
-            build-mode: none
-          - language: rust
-            build-mode: none
+        language: [ "c-cpp", "actions", "python", "rust" ]
     steps:
       - name: Checkout repository
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 #v7.0.1
@@ -40,7 +32,5 @@ jobs:
         uses: github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938 #v4.37.9
         with:
           languages: ${{ matrix.language }}
-      - name: Autobuild
-        uses: github/codeql-action/autobuild@cdf488f595d80d6e07e03d4674febd5ab45fa938 #v4.37.9
       - name: Perform CodeQL Analysis
         uses: github/codeql-action/analyze@cdf488f595d80d6e07e03d4674febd5ab45fa938 #v4.37.9
```

---

### Incident Patch 14: `9909a312` (2026-08-31)
**Commit Message**: Run CodeQL on pull requests and disable autobuild (that's the usual default).

**File**: `.github/workflows/codeql.yml` (modified, +12/-1)
```diff
@@ -4,6 +4,9 @@ on:
   push:
     branches:
       - master
+  pull_request:
+    branches:
+      - master
 
 jobs:
   analyze:
@@ -16,7 +19,15 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        language: [ "c-cpp", "actions", "python", "rust" ]
+        include:
+          - language: c-cpp
+            build-mode: none
+          - language: actions
+            build-mode: none
+          - language: python
+            build-mode: none
+          - language: rust
+            build-mode: none
     steps:
       - name: Checkout repository
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 #v7.0.1
```

---

### Incident Patch 15: `3c5af004` (2026-08-31)
**Commit Message**: Clean build instructions in all docs.

**File**: `README.md` (modified, +7/-6)
```diff
@@ -254,6 +254,7 @@ HTTP 200
             * [Alpine](#alpine)
             * [Arch Linux / Manjaro](#arch-linux--manjaro)
             * [NixOS / Nix](#nixos--nix)
+            * [Guix](#guix)
         * [macOS](#macos)
             * [Homebrew](#homebrew)
             * [MacPorts](#macports)
@@ -1527,7 +1528,7 @@ to configure Hurl, there are three sources from the lowest priority (most easily
 | <a href="#from-entry" id="from-entry"><code>--from-entry &lt;ENTRY_NUMBER&gt;</code></a>             | Execute Hurl file from ENTRY_NUMBER (starting at 1).<br><br>This is a cli-only option.<br>                                                                                                                                                                                                                                                                                                                                                                                             |
 | <a href="#jobs" id="jobs"><code>--jobs &lt;NUM&gt;</code></a>                                        | Maximum number of parallel jobs in parallel mode. Default value corresponds (in most cases) to the current amount of CPUs. Set to 1 to disable parallel execution of files.<br><br>See also [`--parallel`](#parallel).<br><br>Environment variables: HURL_JOBS<br><br>This is a cli-only option.<br>                                                                                                                                                                                   |
 | <a href="#no-assert" id="no-assert"><code>--no-assert</code></a>                                     | Ignore all asserts defined in the Hurl file.<br><br>Environment variables: HURL_NO_ASSERT<br><br>This is a cli-only option.<br>                                                                                                                                                                                                                                                                                                                                                        |
-| <a href="#no-jsonpath-coercion" id="no-jsonpath-coercion"><code>--no-jsonpath-coercion</code></a>    | Disable JSONPath result coercion.<br><br>By default, when JSONPath coercion is enabled, empty JSONPath results are returned as no value and single JSONPath results are returned as a scalar value. With this option, JSONPath results are always returned as arrays.<br><br>Environment variables: HURL_NO_JSONPATH_COERCION<br><br>This is a cli-only option.<br>                                                                                                                    |
+| <a href="#no-jsonpath-coercion" id="no-jsonpath-coercion"><code>--no-jsonpath-coercion</code></a>    | Disable JSONPath result coercion.<br><br>By default, when JSONPath coercion is enabled, empty JSONPath results are returned as no value and single JSONPath results are returned as a scalar value. With this option, JSONPath results are always returned as arrays.<br><br>Environment variables: HURL_NO_JSONPATH_COERCION<br>                                                                                                                                                      |
 | <a href="#parallel" id="parallel"><code>--parallel</code></a>                                        | Run files in parallel.<br><br>Each Hurl file is executed in its own worker thread, without sharing anything with the other workers. The default run mode is sequential. Parallel execution is by default in [`--test`](#test) mode.<br><br>See also [`--jobs`](#jobs).<br><br>This is a cli-only option.<br>                                                                                                                                                                           |
 | <a href="#repeat" id="repeat"><code>--repeat &lt;NUM&gt;</code></a>                                  | Repeat the input files sequence NUM times, -1 for infinite loop. Given a.hurl, b.hurl, c.hurl as input, repeat two<br>times will run a.hurl, b.hurl, c.hurl, a.hurl, b.hurl, c.hurl.<br>                                                                                                                                                                                                                                                                                               |
 | <a href="#retry" id="retry"><code>--retry &lt;NUM&gt;</code></a>                                     | Maximum number of retries, 0 for no retries, -1 for unlimited retries. Retry happens if any error occurs (asserts, captures, runtimes etc...).<br><br>Environment variables: HURL_RETRY<br>                                                                                                                                                                                                                                                                 
```

**File**: `docs/installation.md` (modified, +6/-0)
```diff
@@ -51,6 +51,12 @@ $ pacman -Sy hurl
 
 [NixOS / Nix package] is available on stable channel.
 
+#### Guix
+
+```shell
+$ guix install hurl
+```
+
 ### macOS
 
 Precompiled binaries for Intel and ARM CPUs are available at [Hurl latest GitHub release].
```

**File**: `docs/manual.md` (modified, +1/-1)
```diff
@@ -227,7 +227,7 @@ to configure Hurl, there are three sources from the lowest priority (most easily
 | <a href="#from-entry" id="from-entry"><code>--from-entry &lt;ENTRY_NUMBER&gt;</code></a>             | Execute Hurl file from ENTRY_NUMBER (starting at 1).<br><br>This is a cli-only option.<br>                                                                                                                                                                                                                                                                                                                                                                                             |
 | <a href="#jobs" id="jobs"><code>--jobs &lt;NUM&gt;</code></a>                                        | Maximum number of parallel jobs in parallel mode. Default value corresponds (in most cases) to the current amount of CPUs. Set to 1 to disable parallel execution of files.<br><br>See also [`--parallel`](#parallel).<br><br>Environment variables: HURL_JOBS<br><br>This is a cli-only option.<br>                                                                                                                                                                                   |
 | <a href="#no-assert" id="no-assert"><code>--no-assert</code></a>                                     | Ignore all asserts defined in the Hurl file.<br><br>Environment variables: HURL_NO_ASSERT<br><br>This is a cli-only option.<br>                                                                                                                                                                                                                                                                                                                                                        |
-| <a href="#no-jsonpath-coercion" id="no-jsonpath-coercion"><code>--no-jsonpath-coercion</code></a>    | Disable JSONPath result coercion.<br><br>By default, when JSONPath coercion is enabled, empty JSONPath results are returned as no value and single JSONPath results are returned as a scalar value. With this option, JSONPath results are always returned as arrays.<br><br>Environment variables: HURL_NO_JSONPATH_COERCION<br><br>This is a cli-only option.<br>                                                                                                                    |
+| <a href="#no-jsonpath-coercion" id="no-jsonpath-coercion"><code>--no-jsonpath-coercion</code></a>    | Disable JSONPath result coercion.<br><br>By default, when JSONPath coercion is enabled, empty JSONPath results are returned as no value and single JSONPath results are returned as a scalar value. With this option, JSONPath results are always returned as arrays.<br><br>Environment variables: HURL_NO_JSONPATH_COERCION<br>                                                                                                                                                      |
 | <a href="#parallel" id="parallel"><code>--parallel</code></a>                                        | Run files in parallel.<br><br>Each Hurl file is executed in its own worker thread, without sharing anything with the other workers. The default run mode is sequential. Parallel execution is by default in [`--test`](#test) mode.<br><br>See also [`--jobs`](#jobs).<br><br>This is a cli-only option.<br>                                                                                                                                                                           |
 | <a href="#repeat" id="repeat"><code>--repeat &lt;NUM&gt;</code></a>                                  | Repeat the input files sequence NUM times, -1 for infinite loop. Given a.hurl, b.hurl, c.hurl as input, repeat two<br>times will run a.hurl, b.hurl, c.hurl, a.hurl, b.hurl, c.hurl.<br>                                                                                                                                                                                                                                                                                               |
 | <a href="#retry" id="retry"><code>--retry &lt;NUM&gt;</code></a>                                     | Maximum number of retries, 0 for no retries, -1 for unlimited retries. Retry happens if any error occurs (asserts, captures, runtimes etc...).<br><br>Environment variables: HURL_RETRY<br>                                                                                                                                                                                                                                                                                            |
```

**File**: `docs/manual/hurl.1` (modified, +1/-3)
```diff
@@ -1,4 +1,4 @@
-.TH hurl 1 "03 Jul 2026" "hurl 8.1.0" " Hurl Manual"
+.TH hurl 1 "31 Aug 2026" "hurl 8.1.0" " Hurl Manual"
 .SH NAME
 
 hurl - run and test HTTP requests.
@@ -544,8 +544,6 @@ By default, when JSONPath coercion is enabled, empty JSONPath results are return
 
 Environment variables: HURL_NO_JSONPATH_COERCION
 
-This is a cli-only option.
-
 .IP "--parallel "
 
 Run files in parallel.
```

**File**: `docs/manual/hurlfmt.1` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-.TH hurl 1 "03 Jul 2026" "hurl 8.1.0" " Hurl Manual"
+.TH hurl 1 "31 Aug 2026" "hurl 8.1.0" " Hurl Manual"
 .SH NAME
 
 hurlfmt - format Hurl files
```

**File**: `packages/hurl/README.md` (modified, +13/-6)
```diff
@@ -254,6 +254,7 @@ HTTP 200
             * [Alpine](#alpine)
             * [Arch Linux / Manjaro](#arch-linux--manjaro)
             * [NixOS / Nix](#nixos--nix)
+            * [Guix](#guix)
         * [macOS](#macos)
             * [Homebrew](#homebrew)
             * [MacPorts](#macports)
@@ -1527,7 +1528,7 @@ to configure Hurl, there are three sources from the lowest priority (most easily
 | <a href="#from-entry" id="from-entry"><code>--from-entry &lt;ENTRY_NUMBER&gt;</code></a>             | Execute Hurl file from ENTRY_NUMBER (starting at 1).<br><br>This is a cli-only option.<br>                                                                                                                                                                                                                                                                                                                                                                                             |
 | <a href="#jobs" id="jobs"><code>--jobs &lt;NUM&gt;</code></a>                                        | Maximum number of parallel jobs in parallel mode. Default value corresponds (in most cases) to the current amount of CPUs. Set to 1 to disable parallel execution of files.<br><br>See also [`--parallel`](#parallel).<br><br>Environment variables: HURL_JOBS<br><br>This is a cli-only option.<br>                                                                                                                                                                                   |
 | <a href="#no-assert" id="no-assert"><code>--no-assert</code></a>                                     | Ignore all asserts defined in the Hurl file.<br><br>Environment variables: HURL_NO_ASSERT<br><br>This is a cli-only option.<br>                                                                                                                                                                                                                                                                                                                                                        |
-| <a href="#no-jsonpath-coercion" id="no-jsonpath-coercion"><code>--no-jsonpath-coercion</code></a>    | Disable JSONPath result coercion.<br><br>By default, when JSONPath coercion is enabled, empty JSONPath results are returned as no value and single JSONPath results are returned as a scalar value. With this option, JSONPath results are always returned as arrays.<br><br>Environment variables: HURL_NO_JSONPATH_COERCION<br><br>This is a cli-only option.<br>                                                                                                                    |
+| <a href="#no-jsonpath-coercion" id="no-jsonpath-coercion"><code>--no-jsonpath-coercion</code></a>    | Disable JSONPath result coercion.<br><br>By default, when JSONPath coercion is enabled, empty JSONPath results are returned as no value and single JSONPath results are returned as a scalar value. With this option, JSONPath results are always returned as arrays.<br><br>Environment variables: HURL_NO_JSONPATH_COERCION<br>                                                                                                                                                      |
 | <a href="#parallel" id="parallel"><code>--parallel</code></a>                                        | Run files in parallel.<br><br>Each Hurl file is executed in its own worker thread, without sharing anything with the other workers. The default run mode is sequential. Parallel execution is by default in [`--test`](#test) mode.<br><br>See also [`--jobs`](#jobs).<br><br>This is a cli-only option.<br>                                                                                                                                                                           |
 | <a href="#repeat" id="repeat"><code>--repeat &lt;NUM&gt;</code></a>                                  | Repeat the input files sequence NUM times, -1 for infinite loop. Given a.hurl, b.hurl, c.hurl as input, repeat two<br>times will run a.hurl, b.hurl, c.hurl, a.hurl, b.hurl, c.hurl.<br>                                                                                                                                                                                                                                                                                               |
 | <a href="#retry" id="retry"><code>--retry &lt;NUM&gt;</code></a>                                     | Maximum number of retries, 0 for no retries, -1 for unlimited retries. Retry happens if any error occurs (asserts, captures, runtimes etc...).<br><br>Environment variables: HURL_RETRY<br>                                                                                                                                                                                                                                                                 
```

#### Recent Merged Pull Requests:
- **PR #5321** (2026-10-05): Update to Rust 1.99.0 (@fabricereix)
- **PR #5320** (2026-10-03): Update crates (@hurl-bot)
- **PR #5319** (2026-10-03): Remove per request variables file option, postponing feature to user … (@jcamiel)
- **PR #5318** (2026-10-03): Update doc with Hurl config file info (@jcamiel)
- **PR #5316** (2026-10-02): Update Python dev requirements (@jcamiel)
- **PR #5314** (2026-10-02): Add explicit nesting limit to JSON Body parsing (@fabricereix)
- **PR #5313** (2026-10-01): Update crates (@hurl-bot)
- **PR #5312** (2026-09-26): Update crates (@hurl-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
