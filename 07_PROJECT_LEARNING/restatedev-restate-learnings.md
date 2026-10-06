# Forensic Learning Record (Deep Inspection): restatedev/restate

> **Canonical Artifact**: `07_PROJECT_LEARNING/restatedev-restate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/restatedev/restate](https://github.com/restatedev/restate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:45:29.538Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `restatedev/restate`
- **Description**: Restate is the platform for building resilient applications that tolerate all infrastructure faults w/o the need for a PhD.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4523 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/commands/cloud/environments/tunnel/renderer.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use std::hash::Hasher;
use std::sync::atomic::{AtomicU8, AtomicU64, Ordering};
use std::{io::Write, sync::Arc};

use arc_swap::ArcSwapOption;
use comfy_table::{Cell, Table};
use crossterm::cursor::MoveTo;
use crossterm::execute;
use crossterm::{
    queue,
    terminal::{BeginSynchronizedUpdate, Clear, ClearType},
};

use restate_cli_util::ui::console::StyledTable;
use restate_cli_util::ui::output::Console;
use restate_cli_util::ui::stylesheet;
use restate_cli_util::{CliContext, c_indent_table, c_println, c_tip, c_warn};

use super::remote::RemotePort;

pub(crate) struct TunnelRenderer {
    last_hash: AtomicU64,
    pub local: LocalRenderer,
    pub remote: Vec<RemoteRenderer>,
    last_error: ArcSwapOption<String>,
}

impl TunnelRenderer {
    pub(crate) fn new(
        tunnel_name: String,
        environment_name: String,
        remote_ports: &[RemotePort],
    ) -> std::io::Result<Self> {
        // Redirect console output to in-memory buffer
        let console = Console::in_memory();
        restate_cli_util::ui::output::set_stdout(console.clone());
        restate_cli_util::ui::output::set_stderr(console);

        queue!(
            std::io::stdout(),
            crossterm::cursor::SavePosition,
            crossterm::terminal::EnterAlternateScreen,
            crossterm::terminal::DisableLineWrap,
            crossterm::cursor::Hide
        )?;
        Ok(Self {
            last_hash: AtomicU64::default(),
            local: LocalRenderer::new(tunnel_name, environment_name),
            remote: remote_ports
                .iter()
                .map(|p| RemoteRenderer::new(*p))
                .collect(),
            last_error: ArcSwapOption::empty(),
        })
    }

    pub(crate) fn store_error<E: ToString>(&self, error: E) {
        self.last_error.store(Some(Arc::new(error.to_string())));
        self.render()
    }

    pub(crate) fn clear_error(&self) {
        self.last_error.store(None);
        self.render()
    }

    pub(crate) fn render(&self) {
        let mut stdout = std::io::stdout();

        let (_, rows) = if let Ok(size) = crossterm::terminal::size() {
            size
        } else {
            return;
        };
        let rows = rows as usize;

        let mut tunnel_table = Table::new_styled();

        tunnel_table.set_header(vec![
            comfy_table::Cell::new(format!(" {} ", stylesheet::TIP_ICON))
                .set_alignment(comfy_table::CellAlignment::Center),
            Cell::new("Source").add_attribute(comfy_table::Attribute::Bold),
            Cell::new(" → ").add_attribute(comfy_table::Attribute::Bold),
            comfy_table::Cell::new(format!(" {} ", stylesheet::TIP_ICON))
                .set_alignment(comfy_table::CellAlignment::Center),
            Cell::new("Destination").add_attribute(comfy_table::Attribute::Bold),
        ]);

        let (connected_count, target_connected_count) = self.local.connected_count();
        if target_connected_count > 0 {
            let tunnel_color = if connected_count == target_connected_count {
                comfy_table::Color::Green
            } else if connected_count == 0 {
                comfy_table::Color::Red
            } else {
                comfy_table::Color::Yellow
            };
            tunnel_table.add_row(vec![
                comfy_table::Cell::new(format!(" {} ", stylesheet::HANDSHAKE_ICON))
                    .set_alignment(comfy_table::CellAlignment::Center),
                Cell::new(format!(
                    "tunnel://{} ({connected_count}/{target_connected_count} connected)",
                    self.local.tunnel_name,
                ))
                .fg(tunnel_color),
                " → ".into(),
                comfy_table::Cell::new(format!(" {} ", stylesheet::HOME_ICON))
                    .set_alignment(comfy_table::CellAlignment::Center),
                "your machine".into(),
            ]);
        }

        for remote in self.remote.iter() {
            tunnel_table.add_row(vec![
                comfy_table::Cell::new(format!(" {} ", stylesheet::HOME_ICON))
                    .set_alignment(comfy_table::CellAlignment::Center),
                format!("http://localhost:{}", u16::from(remote.port))
                    .as_str()
                    .into(),
                " → ".into(),
                comfy_table::Cell::new(format!(
                    " {} ",
                    match remote.port {
                        RemotePort::Admin => stylesheet::LOCK_ICON,
                        RemotePort::Ingress => stylesheet::GLOBE_ICON,
                    }
                ))
                .set_alignment(comfy_table::CellAlignment::Center),
                match remote.port {
                    RemotePort::Admin => "admin API",
                    RemotePort::Ingress => "public ingress",
                }
                .into(),
            ]);
        }

        c_indent_table!(0, tunnel_table);
        c_println!();

        if let Some(last_error) = self.last_error.load().as_deref() {
            c_warn!("Error: {last_error}")
        }

        if self.local.target_connected.load(Ordering::Relaxed) > 0 {
            c_tip!(
                "To discover a local service:\nrestate deployments register --tunnel-name {} http://localhost:9080\nThe deployment is only reachable from this Restate Cloud environment ({}).",
                self.local.tunnel_name,
                self.local.environment_name,
            );
        }

        let b = if let Some(b) = restate_cli_util::ui::output::stdout().take_buffer() {
            b
        } else {
            return;
        };

        let mut output = "restate cloud environment tunnel - Press Ctrl-C to exit".to_string();
        let line_count = b.lines().count();

        let logo = restate_types::art::render_restate_logo(CliContext::get().colors_enabled());
        let logo_line_count = logo.lines().count();

        if line_count + logo_line_count + 3 < rows {
            output.reserve_exact(1 + logo.len() + 1 + b.len());
            output.push('\n');
            output.push_str(&logo);
            output.push('\n');
            output.push_str(&b);
        } else {
            output.reserve_exact(2 + b.len());
            output.push('\n');
            output.push('\n');
            output.push_str(&b);
        };

        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        hasher.write(output.as_bytes());
        hasher.write_u8(0xFF);
        let hash = hasher.finish();

        if self.last_hash.swap(hash, Ordering::Relaxed) == hash {
            // no change; avoid rewriting everything
            return;
        }

        let mut lock = std::io::stdout().lock();

        let _ = execute!(
            lock,
            BeginSynchronizedUpdate,
            MoveTo(0, 0),
            Clear(ClearType::All)
        );

        for line in output.lines() {
            let _ = writeln!(lock, "{line}");
        }

        let _ = execute!(stdout, crossterm::terminal::EndSynchronizedUpdate,);
    }
}

pub(crate) struct LocalRenderer {
    pub tunnel_name: String,
    pub environment_name: String,
    pub connected: AtomicU64,
    pub target_connected: AtomicU8,
}

impl LocalRenderer {
    pub(crate) fn new(tunnel_name: String, environment_name: String) -> Self {
        Self {
            tunnel_name,
            environment_name,
            connected: AtomicU64::new(0),
            target_connected: AtomicU8::new(0),
        }
    }

    pub(crate) fn set_connected(&self, tunnel_index: usize, set: bool) {
        if tunnel_index >= 64 {
            return;
        }

        if set {
            self.connected
                .fetch_or(1 << tunnel_index, Ordering::Relaxed);
        } else {
            self.connected
                .fetch_and(!(1 << tunnel_index), Ordering::Relaxed);
        }
    }

    fn connected_count(&self) -> (u8, u8) {
        let target_connected_count = self.target_connected.load(Ordering::Relaxed);
        if target_connected_count == 0 {
            return (0, 0);
        }

        let connected_bitmap = self.connected.load(Ordering::Relaxed);
        let connected_count = connected_bitmap.count_ones() as u8;
        (connected_count, target_connected_count)
    }
}

impl Drop for TunnelRenderer {
    fn drop(&mut self) {
        execute!(
            std::io::stdout(),
            crossterm::terminal::LeaveAlternateScreen,
            crossterm::cursor::Show,
            crossterm::terminal::EnableLineWrap,
            crossterm::cursor::RestorePosition,
            crossterm::cursor::MoveToPreviousLine(1),
        )
        .unwrap();
        restate_cli_util::ui::output::set_stdout(Console::stdout());
        restate_cli_util::ui::output::set_stderr(Console::stderr());
        println!();
    }
}

pub(crate) struct RemoteRenderer {
    port: RemotePort,
}

impl RemoteRenderer {
    pub(crate) fn new(port: RemotePort) -> Self {
        Self { port }
    }
}

```

### Core Architecture Module: `cli/src/commands/kafkaclusters/utils.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

//! Helpers shared between the Kafka cluster subcommands.

use std::collections::{BTreeSet, HashMap};

use comfy_table::{Cell, Table};

use restate_cli_util::ui::console::{Styled, StyledTable};
use restate_cli_util::ui::stylesheet::Style;

use crate::util::properties::REDACTION_PLACEHOLDER;

/// Returns `bootstrap.servers`, falling back to `metadata.broker.list`. Returns
/// `None` if neither is set or if the value is the redaction placeholder.
pub fn brokers_property(properties: &HashMap<String, String>) -> Option<&str> {
    for key in ["bootstrap.servers", "metadata.broker.list"] {
        if let Some(v) = properties.get(key)
            && v != REDACTION_PLACEHOLDER
            && !v.is_empty()
        {
            return Some(v.as_str());
        }
    }
    None
}

/// Renders a properties map for `describe`-style output. Sensitive properties
/// (those whose value is the redaction placeholder) are styled in `Warn` so
/// they're visually distinguishable from regular values.
pub fn render_properties_table(properties: &HashMap<String, String>) -> Table {
    let mut table = Table::new_styled();
    table.set_styled_header(vec!["KEY", "VALUE"]);

    let mut keys: Vec<&String> = properties.keys().collect();
    keys.sort();
    for k in keys {
        let v = &properties[k];
        let cell = if v == REDACTION_PLACEHOLDER {
            Cell::new(format!("{}", Styled(Style::Warn, REDACTION_PLACEHOLDER)))
        } else {
            Cell::new(v)
        };
        table.add_row(vec![Cell::new(k), cell]);
    }
    table
}

/// Renders a property diff between two maps, with rows sorted by key. Values
/// equal to [`REDACTION_PLACEHOLDER`] are rendered as `***` so the user can
/// see that a server-redacted field is being preserved or replaced.
pub fn render_diff_table(old: &HashMap<String, String>, new: &HashMap<String, String>) -> Table {
    let mut keys: BTreeSet<&String> = BTreeSet::new();
    keys.extend(old.keys());
    keys.extend(new.keys());

    let mut table = Table::new_styled();
    table.set_styled_header(vec!["PROPERTY", "OLD", "NEW"]);

    for k in keys {
        let old_v = old.get(k);
        let new_v = new.get(k);
        if old_v == new_v {
            continue;
        }
        let (old_cell, new_cell) = match (old_v, new_v) {
            (None, Some(v)) => (
                Cell::new(format!("{}", Styled(Style::Notice, "(unset)"))),
                Cell::new(format!("{}", Styled(Style::Success, v))),
            ),
            (Some(v), None) => (
                Cell::new(format!("{}", Styled(Style::Danger, v))),
                Cell::new(format!("{}", Styled(Style::Notice, "(removed)"))),
            ),
            (Some(o), Some(n)) => (
                Cell::new(format!("{}", Styled(Style::Danger, o))),
                Cell::new(format!("{}", Styled(Style::Success, n))),
            ),
            (None, None) => unreachable!(),
        };
        table.add_row(vec![Cell::new(k), old_cell, new_cell]);
    }

    table
}

```

### Core Architecture Module: `cli/src/commands/state/clear.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use std::collections::HashMap;

use anyhow::Result;
use cling::prelude::*;
use itertools::Itertools;
use serde_json::Value;

use restate_cli_util::ui::console::Styled;
use restate_cli_util::ui::stylesheet::Style;
use restate_cli_util::{CliContext, c_println};
use restate_types::Scope;

use crate::cli_env::CliEnv;
use crate::clients::datafusion_helpers::get_state_keys;
use crate::commands::state::util::{compute_version, state_get_command, update_state};
use crate::ui::fmt::{DryRun, Field, Formatter, IfEmpty, IncludeFormatting, OutputFormatter};

/// Delete all the K/V state of a virtual object or workflow, or of one of its keys.
///
/// Shows the state keys that will be deleted, then deletes them after confirmation
/// (preview with --dry-run, apply with --yes). To delete a single state key, use
/// `restate state patch` with a `remove` operation.
/// The change is queued behind the invocations running on that key: the command returns once
/// it's submitted, before it's applied.
#[derive(Run, Parser, Collect, Clone)]
#[cling(run = "run_clear")]
#[command(after_help = after_help!(
    examples: [
        "restate state clear Cart/u1 --dry-run",
        "restate state clear Cart --yes     # all Cart objects, whatever their key",
        "restate state clear Cart/u1 --scope tenant-a --yes",
    ],
    learn_more: "https://docs.restate.dev/foundations/key-concepts#consistent-state",
))]
pub struct Clear {
    /// Whose state to clear: `Name/key` for one virtual object or workflow key, or `Name` for
    /// all of its keys at once
    query: String,

    /// Apply even if the state changed since it was read, overwriting those changes
    #[clap(long, short)]
    force: bool,

    /// Scope of the virtual object or workflow, as set by the scoped ingress endpoint
    /// (`/restate/scope/<scope>/...`). Omit to target the unscoped instance
    #[clap(long)]
    scope: Option<String>,

    #[clap(flatten)]
    dry_run: DryRun,
}

pub async fn run_clear(State(env): State<CliEnv>, opts: &Clear) -> Result<()> {
    clear(&env, opts).await
}

/// Columns of the `changes` plan table (one row per service key to clear).
const CHANGE_HEADERS: [&str; 4] = ["service", "key", "state_keys", "operation"];

async fn clear(env: &CliEnv, opts: &Clear) -> Result<()> {
    let sql_client = crate::clients::DataFusionHttpClient::new(env).await?;

    let (svc, key) = match opts.query.split_once('/') {
        None => (opts.query.as_str(), None),
        Some((svc, key)) => (svc, Some(key)),
    };

    #[allow(clippy::mutable_key_type)]
    let services_state = get_state_keys(&sql_client, svc, key, opts.scope.as_deref()).await?;
    let json = CliContext::get().json_output();
    if services_state.is_empty() {
        let mut f = Formatter::new();
        f.nothing_to_do(format!("No state found for {}", opts.query));
        return f.finish();
    }

    let mut f = Formatter::new();
    let rows: Vec<Vec<Field>> = services_state
        .iter()
        .sorted_by(|(a, _), (b, _)| (&a.service_name, &a.key).cmp(&(&b.service_name, &b.key)))
        .map(|(svc_id, svc_state)| {
            let state_keys: Vec<&String> = svc_state.keys().sorted().collect();
            vec![
                Field::styled(svc_id.service_name.to_string(), Style::Info),
                Field::styled(svc_id.key.to_string(), Style::Info),
                Field::with_display(
                    Value::from_iter(state_keys.iter().map(|k| Value::from(k.as_str()))),
                    format!("[{}]", state_keys.iter().join(", ")),
                ),
                Field::new("clear"),
            ]
        })
        .collect();
    f.table("changes", &CHANGE_HEADERS, &rows, IfEmpty::Nothing);

    if !json {
        c_println!();
        c_println!(
            "Going to {} all the aforementioned state entries.",
            Styled(Style::Danger, "remove")
        );
        c_println!("About to submit the new state mutation to the system for processing.");
        c_println!(
            "If there are currently active invocations, then this mutation will be enqueued to be processed after them."
        );
        c_println!();
    }
    f.confirm(&opts.dry_run, "Are you sure?")?;

    if !json {
        c_println!();
    }

    let single_key = services_state.len() == 1;
    for (svc_id, svc_state) in services_state {
        let version = if opts.force {
            None
        } else {
            Some(compute_version(&svc_state))
        };
        update_state(
            env,
            version,
            &svc_id.service_name,
            &svc_id.key,
            svc_id.scope.as_ref().map(Scope::as_str),
            HashMap::default(),
        )
        .await?;
        if single_key {
            f.next_step(
                &state_get_command(
                    &svc_id.service_name,
                    &svc_id.key,
                    svc_id.scope.as_ref().map(Scope::as_str),
                ),
                "check the state once the mutation is processed",
                IncludeFormatting::Yes,
            );
        }
    }

    if !json {
        c_println!();
        c_println!("Enqueued successfully for processing");
    }
    f.finish()
}

```

### Core Architecture Module: `cli/src/commands/state/edit.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use anyhow::{Context, Result};
use cling::prelude::*;
use comfy_table::{Cell, Table};
use tempfile::tempdir;

use restate_cli_util::ui::console::{StyledTable, confirm, confirm_or_exit};
use restate_cli_util::{CliContext, c_eprintln, c_println, c_title};

use crate::cli_env::CliEnv;
use crate::commands::state::util::{
    as_json, compute_version, from_json, get_current_state, pretty_print_json, read_json_file,
    update_state, write_json_file,
};

/// Edit the K/V state of a virtual object or workflow key in an editor
///
/// Needs a terminal: scripts and agents should use `restate state patch` instead.
/// The change is queued behind the invocations running on that key: the command returns once
/// it's submitted, before it's applied.
#[derive(Run, Parser, Collect, Clone)]
#[cling(run = "run_edit")]
#[command(after_help = after_help!(
    examples: [
        "restate state edit Cart u1",
    ],
    learn_more: "https://docs.restate.dev/foundations/key-concepts#consistent-state",
))]
pub struct Edit {
    /// Treat values as base64-encoded bytes instead of JSON, in the output and in the input
    #[clap(long, alias = "bin")]
    binary: bool,

    /// Apply even if the state changed since it was read, overwriting those changes
    #[clap(long, short)]
    force: bool,

    /// Virtual object or workflow name
    service: String,

    /// Virtual object or workflow key
    key: String,

    /// Scope of the virtual object or workflow, as set by the scoped ingress endpoint
    /// (`/restate/scope/<scope>/...`). Omit to target the unscoped instance
    #[clap(long)]
    scope: Option<String>,
}

pub async fn run_edit(State(env): State<CliEnv>, opts: &Edit) -> Result<()> {
    edit(&env, opts).await
}

async fn edit(env: &CliEnv, opts: &Edit) -> Result<()> {
    let current_state =
        get_current_state(env, &opts.service, &opts.key, opts.scope.as_deref(), false).await?;
    let current_version = compute_version(&current_state);

    let tempdir = tempdir().context("unable to create a temporary directory")?;
    let edit_file = tempdir.path().join(".restate_edit");
    let current_state_json = as_json(current_state, opts.binary)?;
    write_json_file(&edit_file, current_state_json)?;
    let modified_state_json = loop {
        env.open_default_editor(&edit_file, "use `restate state patch` instead")?;
        match read_json_file(&edit_file) {
            Ok(json) => break json,
            Err(err) => {
                c_eprintln!("{:#}", err);
                // In non-interactive mode (--yes / CI), retrying would loop forever
                // since the editor can't fix the file without human input.
                if CliContext::get().auto_confirm() || !confirm("Re-open editor to fix?") {
                    return Err(err);
                }
            }
        }
    };

    //
    // confirm change
    //

    let mut table = Table::new_styled();
    table.set_styled_header(vec!["", ""]);
    if let Some(scope) = &opts.scope {
        table.add_row(vec![Cell::new("Scope"), Cell::new(scope)]);
    }
    table.add_row(vec![Cell::new("Service"), Cell::new(&opts.service)]);
    table.add_row(vec![Cell::new("Key"), Cell::new(&opts.key)]);
    table.add_row(vec![Cell::new("Force?"), Cell::new(opts.force)]);
    table.add_row(vec![Cell::new("Binary?"), Cell::new(opts.binary)]);

    c_title!("ℹ️ ", "State Update");
    c_println!("{table}");
    c_println!();

    c_title!("ℹ️ ", "New State");
    c_println!("{}", pretty_print_json(&modified_state_json)?);
    c_println!();

    c_println!("About to submit the new state mutation to the system for processing.");
    c_println!(
        "If there are ongoing invocations for this key this mutation will be enqueued to be processed after them."
    );
    c_println!();
    confirm_or_exit("Are you sure?")?;

    c_println!();

    //
    // back to binary
    //
    let modified_state = from_json(modified_state_json, opts.binary)?;
    //
    // attach the current version
    //
    let version = if opts.force {
        None
    } else {
        Some(current_version)
    };
    update_state(
        env,
        version,
        &opts.service,
        &opts.key,
        opts.scope.as_deref(),
        modified_state,
    )
    .await?;

    //
    // done
    //

    c_println!();
    c_println!("Successfully submitted state update.");

    Ok(())
}

```

### Core Architecture Module: `cli/src/commands/state/get.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use anyhow::Result;
use cling::prelude::*;

use restate_cli_util::CliContext;
use restate_cli_util::c_println;
use restate_cli_util::ui::watcher::Watch;

use crate::cli_env::CliEnv;
use crate::commands::state::util::{as_json, get_current_state, pretty_print_json_object};
use crate::error::RestateCliError;
use crate::ui::fmt::{Field, Formatter, IfEmpty, OutputFormatter};

/// Show the K/V state of a virtual object or workflow key
///
/// Values are shown as JSON; pass --binary for values that are not JSON.
#[derive(Run, Parser, Collect, Clone)]
#[cling(run = "run_get")]
#[command(after_help = after_help!(
    examples: [
        "restate state get Cart u1",
        "restate state get Cart u1 --plain | jq .items",
        "restate state get Cart u1 --scope tenant-a",
    ],
    learn_more: "https://docs.restate.dev/foundations/key-concepts#consistent-state",
))]
pub struct Get {
    /// Treat values as base64-encoded bytes instead of JSON, in the output and in the input
    #[clap(long, alias = "bin")]
    binary: bool,

    /// Print only the state, as a JSON object of state key to value (ignores --json)
    #[clap(long, short)]
    plain: bool,

    /// Virtual object or workflow name
    service: String,

    /// Virtual object or workflow key
    key: String,

    /// Scope of the virtual object or workflow, as set by the scoped ingress endpoint
    /// (`/restate/scope/<scope>/...`). Omit to target the unscoped instance
    #[clap(long)]
    scope: Option<String>,

    #[clap(flatten)]
    watch: Watch,
}

pub async fn run_get(State(env): State<CliEnv>, opts: &Get) -> Result<()> {
    opts.watch.run(|| get(&env, opts)).await
}

async fn get(env: &CliEnv, opts: &Get) -> Result<()> {
    let current_state =
        get_current_state(env, &opts.service, &opts.key, opts.scope.as_deref(), true).await?;
    if current_state.is_empty() {
        return Err(RestateCliError::not_found(format!(
            "State not found for {}/{}",
            opts.service, opts.key
        ))
        .into());
    }
    let current_state_json = as_json(current_state, opts.binary)?;

    // `--plain` prints the raw JSON document as-is, regardless of `--json`.
    if opts.plain {
        c_println!("{current_state_json}");
        return Ok(());
    }

    let mut f = Formatter::new();
    f.title("🤖", "State");

    if CliContext::get().json_output() {
        // Humans typed the service and key; scripts get them echoed back.
        f.detail(
            "info",
            &[
                ("scope", Field::new(opts.scope.as_deref())),
                ("service", Field::new(opts.service.as_str())),
                ("key", Field::new(opts.key.as_str())),
            ],
        );
        // Emit the real, structured state value so scripts get native JSON.
        f.value("state", Field::new(current_state_json));
    } else {
        // Human output keeps the familiar KEY / VALUE table with pretty-printed values.
        let pretty_json = pretty_print_json_object(&current_state_json)?;
        let rows: Vec<Vec<Field>> = pretty_json
            .into_iter()
            .map(|(k, v)| vec![Field::new(k), Field::new(v)])
            .collect();
        f.table("state", &["key", "value"], &rows, IfEmpty::Nothing);
    }

    f.finish()
}

```

### Core Architecture Module: `cli/src/commands/state/mod.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

mod clear;
mod edit;
mod get;
mod patch;
mod util;

use cling::prelude::*;

#[derive(Run, Subcommand, Clone)]
pub enum ServiceState {
    // Commands are documented on their own struct.
    Get(get::Get),
    Edit(edit::Edit),
    Patch(patch::Patch),
    Clear(clear::Clear),
}

```

### Core Architecture Module: `cli/src/commands/state/patch.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use anyhow::{Context, Result};
use cling::prelude::*;
use serde_json::Value;

use restate_cli_util::ui::stylesheet::Style;
use restate_cli_util::{CliContext, c_println, c_title};

use crate::cli_env::CliEnv;
use crate::commands::state::util::{
    as_json, compute_version, from_json, get_current_state, pretty_print_json, state_get_command,
    update_state,
};
use crate::ui::fmt::{DryRun, Field, Formatter, IfEmpty, IncludeFormatting, OutputFormatter};

/// Change the K/V state of a virtual object or workflow key with a JSON Patch
///
/// The state is a JSON object of state key to value: an `add`/`replace` operation on `/<key>`
/// sets a state key, `remove` deletes it. Shows the changes, then applies them after
/// confirmation (preview with --dry-run, apply with --yes).
/// The change is queued behind the invocations running on that key: the command returns once
/// it's submitted, before it's applied.
#[derive(Run, Parser, Collect, Clone)]
#[cling(run = "patch")]
#[command(after_help = after_help!(
    examples: [
        "restate state patch Cart u1 --patch '[{\"op\": \"add\", \"path\": \"/items\", \"value\": []}]' --dry-run",
        "restate state patch Cart u1 --patch '[{\"op\": \"remove\", \"path\": \"/items\"}]' --yes",
    ],
    learn_more: "https://docs.restate.dev/foundations/key-concepts#consistent-state",
))]
pub struct Patch {
    /// Treat values as base64-encoded bytes instead of JSON, in the output and in the input
    #[clap(long, alias = "bin")]
    binary: bool,

    /// Apply even if the state changed since it was read, overwriting those changes
    #[clap(long, short)]
    force: bool,

    /// Virtual object or workflow name
    service: String,

    /// Virtual object or workflow key
    key: String,

    /// Scope of the virtual object or workflow, as set by the scoped ingress endpoint
    /// (`/restate/scope/<scope>/...`). Omit to target the unscoped instance
    #[clap(long)]
    scope: Option<String>,

    /// RFC 6902 JSON Patch, applied to the JSON object of state key to value, e.g.
    /// `[{"op": "add", "path": "/items", "value": []}]` sets the state key `items`
    #[arg(short, long)]
    patch: String,

    #[clap(flatten)]
    dry_run: DryRun,
}

pub async fn patch(State(env): State<CliEnv>, opts: &Patch) -> Result<()> {
    let patch = serde_json::from_str::<json_patch::Patch>(&opts.patch)
        .map_err(|e| anyhow::anyhow!("Parsing JSON patch: {}", e))?;

    let current_state =
        get_current_state(&env, &opts.service, &opts.key, opts.scope.as_deref(), false).await?;
    let current_version = compute_version(&current_state);

    let old_state = as_json(current_state, opts.binary)?;
    let mut state = old_state.clone();

    json_patch::patch(&mut state, &patch).context("Patch failed")?;

    let json = CliContext::get().json_output();
    let mut f = Formatter::new();
    f.title("", "Patch State");
    f.detail(
        "state",
        &[
            ("scope", Field::new(opts.scope.as_deref())),
            ("service", Field::new(opts.service.clone())),
            ("key", Field::new(opts.key.clone())),
            ("force", Field::new(opts.force)),
            ("binary", Field::new(opts.binary)),
        ],
    );
    if !json {
        c_title!("", "New State");
        c_println!("{}", pretty_print_json(&state)?);
        c_println!();
    }
    f.title("", "Changes");
    f.table(
        "changes",
        &["state_key", "operation", "value"],
        &state_changes(&old_state, &state)?,
        IfEmpty::Nothing,
    );

    if !json {
        c_println!();
        c_println!("About to submit the new state mutation to the system for processing.");
        c_println!(
            "If there are ongoing invocations for this key this mutation will be enqueued to be processed after them."
        );
        c_println!();
    }
    f.confirm(&opts.dry_run, "Are you sure?")?;

    let modified_state = from_json(state, opts.binary)?;
    let version = if opts.force {
        None
    } else {
        Some(current_version)
    };
    update_state(
        &env,
        version,
        &opts.service,
        &opts.key,
        opts.scope.as_deref(),
        modified_state,
    )
    .await?;

    if !json {
        c_println!();
        c_println!("Successfully submitted state update.");
    }
    f.next_step(
        &state_get_command(&opts.service, &opts.key, opts.scope.as_deref()),
        "check the state once the mutation is processed",
        IncludeFormatting::Yes,
    );
    f.finish()
}

/// The state keys a patch sets (with their new value) or removes, sorted by key.
fn state_changes(old: &Value, new: &Value) -> Result<Vec<Vec<Field>>> {
    let (Some(old), Some(new)) = (old.as_object(), new.as_object()) else {
        anyhow::bail!("The patched state must be a JSON object");
    };
    let mut changes: Vec<(&String, Option<&Value>)> = new
        .iter()
        .filter(|(k, v)| old.get(*k) != Some(*v))
        .map(|(k, v)| (k, Some(v)))
        .chain(
            old.keys()
                .filter(|k| !new.contains_key(*k))
                .map(|k| (k, None)),
        )
        .collect();
    changes.sort_by_key(|(k, _)| *k);
    changes
        .into_iter()
        .map(|(key, value)| {
            let row = match value {
                Some(value) => vec![
                    Field::styled(key.clone(), Style::Info),
                    Field::styled("set", Style::Success),
                    Field::with_display(
                        value.clone(),
                        serde_json::to_string_pretty(value)
                            .context("unable convert a value to JSON")?,
                    ),
                ],
                None => vec![
                    Field::styled(key.clone(), Style::Info),
                    Field::styled("remove", Style::Danger),
                    Field::new(Value::Null),
                ],
            };
            Ok(row)
        })
        .collect()
}

```

### Core Architecture Module: `cli/src/commands/state/util.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use anyhow::{Context, anyhow};
use base64::alphabet::URL_SAFE;
use base64::engine::{Engine, GeneralPurpose, GeneralPurposeConfig};
use bytes::Bytes;
use comfy_table::{Cell, Table};
use itertools::Itertools;
use serde_json::Value;

use restate_admin_rest_model::services::ModifyServiceStateRequest;
use restate_cli_util::c_warn;
use restate_cli_util::ui::console::StyledTable;
use restate_types::invocation::ServiceType;
use restate_types::state_mut::StateMutationVersion;

use crate::cli_env::CliEnv;
use crate::clients::datafusion_helpers::get_state_keys;
use crate::clients::{AdminClient, AdminClientInterface, ClientError, DataFusionHttpClient};
use crate::error::RestateCliError;

pub(crate) async fn get_current_state(
    env: &CliEnv,
    service: &str,
    key: &str,
    scope: Option<&str>,
    allow_missing_service: bool,
) -> anyhow::Result<HashMap<String, Bytes>> {
    //
    // 0. require that this is a keyed service
    //
    let client = AdminClient::new(env).await?;
    let missing_service = match client.get_service(service).await?.into_body().await {
        Ok(service_meta) => match service_meta.ty {
            ServiceType::VirtualObject | ServiceType::Workflow => None,
            ServiceType::Service => {
                return Err(RestateCliError::bad_input(format!(
                    "{service} is a service: only virtual objects and workflows have state"
                ))
                .into());
            }
        },
        // continue as it is reasonable to get state for a deleted service
        Err(ClientError::Api(err)) if allow_missing_service && err.http_status_code == 404 => {
            Some(err)
        }
        Err(err) => return Err(err.into()),
    };

    //
    // 1. get the key-value pairs
    //
    let sql_client = DataFusionHttpClient::from(client);
    let user_state = get_state_keys(&sql_client, service, Some(key), scope)
        .await?
        .into_values()
        .next()
        .unwrap_or_default();

    if let Some(err) = missing_service {
        // Without any leftover state, the unknown service is the actual failure.
        if user_state.is_empty() {
            return Err(ClientError::Api(err).into());
        }
        c_warn!(
            "This service does not exist in the registry; it may have been deleted, or never existed"
        )
    }

    Ok(user_state)
}

pub(crate) async fn update_state(
    env: &CliEnv,
    expected_version: Option<String>,
    service: &str,
    service_key: &str,
    scope: Option<&str>,
    new_state: HashMap<String, Bytes>,
) -> anyhow::Result<()> {
    let req = ModifyServiceStateRequest {
        version: expected_version,
        new_state,
        object_key: service_key.to_string(),
        scope: scope.map(str::to_owned),
    };

    let client = AdminClient::new(env).await?;
    let _ = client.patch_state(service, req).await?.success_or_error()?;

    Ok(())
}

/// The `restate state get` command that shows the state of the given key.
pub(crate) fn state_get_command(service: &str, key: &str, scope: Option<&str>) -> String {
    match scope {
        Some(scope) => format!("restate state get {service} {key} --scope {scope}"),
        None => format!("restate state get {service} {key}"),
    }
}

pub(crate) fn compute_version(user_state: &HashMap<String, Bytes>) -> String {
    let kvs: Vec<(Bytes, Bytes)> = user_state
        .iter()
        .map(|(k, v)| (Bytes::from(k.clone()), v.clone()))
        .collect();
    StateMutationVersion::from_user_state(&kvs).into_inner()
}

pub(crate) fn as_json(state: HashMap<String, Bytes>, binary_values: bool) -> anyhow::Result<Value> {
    let current_state_json: HashMap<String, Value> = state
        .into_iter()
        .map(|(k, v)| {
            bytes_as_json(v, binary_values)
                .context(format!("unable to convert the value of state key \"{k}\" to JSON. Pass --binary to render it as a base64 string instead"))
                .map(|v| (k, v))
        })
        .try_collect()?;

    serde_json::to_value(current_state_json).context("unable to create a JSON object.")
}

pub(crate) fn from_json(json: Value, binary_value: bool) -> anyhow::Result<HashMap<String, Bytes>> {
    let modified_state: HashMap<String, Bytes> = json
        .as_object()
        .expect("cli bug this must be an object")
        .into_iter()
        .map(|(k, v)| {
            let binary = json_value_as_bytes(v, binary_value);

            binary.map(|v| (k.clone(), v))
        })
        .try_collect()?;

    Ok(modified_state)
}

fn bytes_as_json(value: Bytes, binary_values: bool) -> anyhow::Result<Value> {
    let json: Value = if binary_values {
        let b64 = GeneralPurpose::new(&URL_SAFE, GeneralPurposeConfig::default()).encode(value);
        serde_json::to_value(b64).context("unable to convert bytes to string")?
    } else {
        serde_json::from_slice(&value).context("unable to convert a value to json")?
    };

    Ok(json)
}

/// convert a JSON value to bytes. If the original value was base64 encoded (binary_value = true)
/// then, the value will be a json string of the form " ... base64 encoded ... ", and it would be converted
/// to bytes by decoding the string.
/// if binary_value = false, we use serde json to decode this value.
fn json_value_as_bytes(value: &Value, binary_value: bool) -> anyhow::Result<Bytes> {
    let raw = if binary_value {
        base64_json_value_str_as_bytes(value)?
    } else {
        serde_json::to_vec(&value).context("unable to convert a JSON value back to bytes")?
    };

    Ok(Bytes::from(raw))
}

/// convert a JSON string value i.e. "abcde121==" that represents a base64 string
/// into a raw bytes (base64 decoded)
fn base64_json_value_str_as_bytes(value: &Value) -> anyhow::Result<Vec<u8>> {
    let str = value
        .as_str()
        .ok_or_else(|| anyhow!("unexpected non string value with binary mode"))?;

    GeneralPurpose::new(&URL_SAFE, GeneralPurposeConfig::default())
        .decode(str)
        .context("unable to decode a base64 value")
}

pub(crate) fn write_json_file(path: &Path, json: Value) -> anyhow::Result<()> {
    let current_json =
        serde_json::to_string_pretty(&json).context("Failed to serialize to JSON")?;

    let mut file = File::create(path).context("Failed to create a temp file")?;
    file.write_all(current_json.as_bytes())
        .context("Failed to write to file")?;
    file.sync_all()
        .context("unable to flush the file to disk")?;

    Ok(())
}

pub(crate) fn read_json_file(path: &Path) -> anyhow::Result<Value> {
    let mut file = File::open(path).context("Unable to open the file for reading")?;
    let mut json_str = String::new();
    file.read_to_string(&mut json_str)
        .context("Unable to read back the content of the file")?;

    let value: Value = serde_json::from_str(&json_str).context("Failed parsing JSON")?;

    if value.is_object() {
        Ok(value)
    } else {
        Err(anyhow!("expected to read back a JSON object"))
    }
}

pub(crate) fn pretty_print_json(value: &Value) -> anyhow::Result<Table> {
    let mut table = Table::new_styled();
    table.set_styled_header(vec!["KEY", "VALUE"]);

    let object = pretty_print_json_object(value)?;

    for (k, v) in object {
        table.add_row(vec![Cell::new(k), Cell::new(v)]);
    }

    Ok(table)
}

pub(crate) fn pretty_print_json_object(value: &Value) -> anyhow::Result<HashMap<String, String>> {
    assert!(value.is_object());

    let value = value
        .as_object()
        .expect("cli bug, this needs to be an object");

    value
        .into_iter()
        .map(|(k, v)| {
            let pretty_val =
                serde_json::to_string_pretty(v).context("unable convert a value to JSON")?;
            Ok((k.clone(), pretty_val))
        })
        .try_collect()
}

```

### Core Architecture Module: `cli/src/commands/vqueues/describe.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use anyhow::Result;
use chrono::{DateTime, Local};
use cling::prelude::*;
use serde::Deserialize;

use restate_cli_util::c_eprintln;
use restate_cli_util::ui::watcher::Watch;
use restate_types::vqueues::VQueueId;

use super::{optional_str, optional_time, time};
use crate::cli_env::CliEnv;
use crate::clients::DataFusionHttpClient;
use crate::ui::fmt::{Field, Formatter, IfEmpty, IncludeFormatting, OutputFormatter};

/// Show a virtual queue and the invocations in it
///
/// Shows the queue's service, scope, limit key and lock (the `Object/key` a virtual object
/// queue is for), its counters, and one row per entry with its status, attempts and stage:
/// inbox (waiting to run), running, suspended, paused or finished.
#[derive(Run, Parser, Collect, Clone)]
#[cling(run = "run_describe")]
#[command(after_help = after_help!(
    examples: [
        "restate vqueues describe vq_11FXYJ7NW9jx5RWxXgKQR3GcJu7ASG3XB1 --newest-first",
    ],
    learn_more: "https://docs.restate.dev/services/flow-control",
))]
#[clap(visible_alias = "get")]
pub struct Describe {
    /// Virtual queue id (`vq_...`), as shown by `restate vqueues list`
    vqueue_id: VQueueId,

    /// Show at most this many entries
    #[clap(long, default_value = "100")]
    limit: usize,

    /// Order entries by queue sequence number, highest (most recently enqueued) first
    #[clap(long, default_value = "false")]
    newest_first: bool,

    #[clap(flatten)]
    watch: Watch,
}

#[derive(Debug, Deserialize)]
struct VQueueEntryRow {
    entry_id: String,
    entry_kind: String,
    stage: String,
    status: String,
    has_lock: bool,
    created_at: DateTime<Local>,
    num_attempts: u32,
    deployment: Option<String>,
}

pub async fn run_describe(State(env): State<CliEnv>, opts: &Describe) -> Result<()> {
    opts.watch.run(|| describe(&env, opts)).await
}

async fn describe(env: &CliEnv, opts: &Describe) -> Result<()> {
    let client = DataFusionHttpClient::new(env).await?;
    let queue = super::get_vqueue(&client, &opts.vqueue_id).await?;

    let order_clause = if opts.newest_first {
        "ORDER BY sequence_number DESC"
    } else {
        ""
    };

    let entries: Vec<VQueueEntryRow> = client
        .run_json_query(format!(
            "SELECT entry_id, entry_kind, stage, status, has_lock, created_at, num_attempts, \
             deployment FROM sys_vqueues WHERE id = '{}' \
            {order_clause} LIMIT {}",
            opts.vqueue_id, opts.limit
        ))
        .await?;

    let mut f = Formatter::new();
    f.title("📜", "Virtual Queue Information");
    f.detail(
        "vqueue",
        [
            ("id", Field::new(queue.id.as_str())),
            ("service", optional_str(queue.service_name.as_deref())),
            ("scope", optional_str(queue.scope.as_deref())),
            ("limit_key", optional_str(queue.limit_key.as_deref())),
            ("lock", optional_str(queue.lock_name.as_deref())),
            ("active", Field::new(queue.is_active)),
            ("paused", Field::new(queue.queue_is_paused)),
            ("created_at", time(queue.created_at)),
            ("last_enqueued_at", optional_time(queue.last_enqueued_at)),
            ("last_started_at", optional_time(queue.last_start_at)),
            ("last_attempted_at", optional_time(queue.last_attempt_at)),
            ("last_finished_at", optional_time(queue.last_finish_at)),
        ],
    );

    f.title("📊", "Entry Counts");
    f.table(
        "entry_counts",
        &["inbox", "running", "suspended", "paused", "finished"],
        [[
            Field::new(queue.num_inbox),
            Field::new(queue.num_running),
            Field::new(queue.num_suspended),
            Field::new(queue.num_paused),
            Field::new(queue.num_finished),
        ]],
        IfEmpty::Nothing,
    );

    f.title("📥", "Entries");
    let rows = entries.iter().map(|entry| {
        [
            Field::new(entry.entry_id.as_str()),
            Field::new(entry.entry_kind.as_str()),
            Field::new(entry.stage.as_str()),
            Field::new(entry.status.as_str()),
            Field::new(entry.has_lock),
            Field::new(entry.num_attempts),
            time(entry.created_at),
            optional_str(entry.deployment.as_deref()),
        ]
    });
    f.table(
        "entries",
        &[
            "entry_id",
            "kind",
            "stage",
            "status",
            "has_lock",
            "attempts",
            "created_at",
            "deployment",
        ],
        rows,
        IfEmpty::Say("No entries found."),
    );
    if let Some(entry) = entries.iter().find(|e| e.entry_kind == "invocation") {
        f.next_step(
            &format!("restate invocations describe {}", entry.entry_id),
            "inspect the invocation's status, progress, and journal",
            IncludeFormatting::Yes,
        );
    }

    let total_entries = queue.num_inbox
        + queue.num_running
        + queue.num_suspended
        + queue.num_paused
        + queue.num_finished;
    c_eprintln!("Showing {}/{} entries.", entries.len(), total_entries);
    f.finish()
}

```

### Core Architecture Module: `cli/src/commands/vqueues/list.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use anyhow::Result;
use cling::prelude::*;

use restate_cli_util::ui::watcher::Watch;

use super::{VQUEUE_COLUMNS, VQueueRow, optional_str};
use crate::cli_env::CliEnv;
use crate::clients::DataFusionHttpClient;
use crate::ui::fmt::{Field, Formatter, IfEmpty, IncludeFormatting, OutputFormatter};

/// List virtual queues, with how many invocations each has waiting, running, suspended, ...
#[derive(Run, Parser, Collect, Clone)]
#[cling(run = "run_list")]
#[command(after_help = after_help!(
    examples: [
        "restate vqueues list --json",
    ],
    learn_more: "https://docs.restate.dev/services/flow-control",
))]
#[clap(visible_alias = "ls")]
pub struct List {
    /// Show at most this many virtual queues; the others are left out
    #[clap(long, default_value = "100")]
    limit: usize,

    #[clap(flatten)]
    watch: Watch,
}

pub async fn run_list(State(env): State<CliEnv>, opts: &List) -> Result<()> {
    opts.watch.run(|| list(&env, opts)).await
}

async fn list(env: &CliEnv, opts: &List) -> Result<()> {
    let client = DataFusionHttpClient::new(env).await?;
    let rows: Vec<VQueueRow> = client
        .run_json_query(format!(
            "SELECT {VQUEUE_COLUMNS} FROM sys_vqueue_meta LIMIT {}",
            opts.limit
        ))
        .await?;

    let table_rows: Vec<Vec<Field>> = rows
        .iter()
        .map(|row| {
            vec![
                Field::new(row.id.as_str()),
                optional_str(row.service_name.as_deref()),
                optional_str(row.scope.as_deref()),
                optional_str(row.limit_key.as_deref()),
                optional_str(row.lock_name.as_deref()),
                Field::new(row.queue_is_paused),
                Field::new(row.num_inbox),
                Field::new(row.num_running),
                Field::new(row.num_suspended),
                Field::new(row.num_paused),
                Field::new(row.num_finished),
            ]
        })
        .collect();

    let mut f = Formatter::new();
    f.table(
        "vqueues",
        &[
            "id",
            "service",
            "scope",
            "limit_key",
            "lock",
            "queue_paused",
            "inbox",
            "running",
            "suspended",
            "paused_entries",
            "finished",
        ],
        &table_rows,
        IfEmpty::Say("No virtual queues found."),
    );
    if let Some(row) = rows.first() {
        f.next_step(
            &format!("restate vqueues describe {}", row.id),
            "see the queue's entries",
            IncludeFormatting::Yes,
        );
    }
    f.finish()
}

```

### Core Architecture Module: `cli/src/commands/vqueues/mod.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

mod describe;
mod list;
mod pause;
mod resume;

use chrono::{DateTime, Local};
use cling::prelude::*;
use serde::Deserialize;
use serde_json::Value;

use restate_types::vqueues::VQueueId;

use crate::clients::DataFusionHttpClient;
use crate::error::RestateCliError;
use crate::ui::datetime::DateTimeExt;
use crate::ui::fmt::{Field, Formatter, IncludeFormatting, Outcome, OutputFormatter};

const VQUEUE_COLUMNS: &str = "id, is_active, queue_is_paused, service_name, scope, limit_key, \
    lock_name, created_at, last_enqueued_at, last_start_at, last_attempt_at, last_finish_at, \
    num_inbox, num_running, num_suspended, num_paused, num_finished";

#[derive(Run, Subcommand, Clone)]
pub enum VQueues {
    // Commands are documented on their own struct.
    List(list::List),
    Describe(describe::Describe),
    /// Pause a virtual queue
    #[command(hide = true)]
    Pause(pause::Pause),
    /// Resume a virtual queue
    #[command(hide = true)]
    Resume(resume::Resume),
}

#[derive(Debug, Clone, Deserialize)]
struct VQueueRow {
    id: String,
    is_active: bool,
    queue_is_paused: bool,
    service_name: Option<String>,
    scope: Option<String>,
    limit_key: Option<String>,
    lock_name: Option<String>,
    created_at: DateTime<Local>,
    last_enqueued_at: Option<DateTime<Local>>,
    last_start_at: Option<DateTime<Local>>,
    last_attempt_at: Option<DateTime<Local>>,
    last_finish_at: Option<DateTime<Local>>,
    num_inbox: u64,
    num_running: u64,
    num_suspended: u64,
    num_paused: u64,
    num_finished: u64,
}

async fn get_vqueue(
    client: &DataFusionHttpClient,
    vqueue_id: &VQueueId,
) -> anyhow::Result<VQueueRow> {
    let mut rows: Vec<VQueueRow> = client
        .run_json_query(format!(
            "SELECT {VQUEUE_COLUMNS} FROM sys_vqueue_meta WHERE id = '{vqueue_id}'"
        ))
        .await?;
    rows.pop().ok_or_else(|| {
        RestateCliError::not_found(format!("Virtual queue {vqueue_id} not found")).into()
    })
}

/// Reports a pause/resume: `[OK]: <verb> virtual queue <id>` for humans, the id and
/// `result` in JSON.
fn report_outcome(vqueue_id: &VQueueId, result: &str, verb: &str) -> anyhow::Result<()> {
    let mut f = Formatter::new();
    f.value("vqueue_id", Field::with_display(vqueue_id.to_string(), ""));
    f.outcome(
        "result",
        Field::with_display(result, format!("{verb} virtual queue {vqueue_id}")),
        Outcome::Success,
    );
    f.next_step(
        &format!("restate vqueues describe {vqueue_id}"),
        "check the queue's state and entries",
        IncludeFormatting::Yes,
    );
    f.finish()
}

/// `-` for humans, `null` in JSON.
fn missing() -> Field {
    Field::with_display(Value::Null, "-")
}

fn optional_str(value: Option<&str>) -> Field {
    value.map_or_else(missing, Field::new)
}

fn time(value: DateTime<Local>) -> Field {
    Field::with_display(value.iso(), value.display())
}

fn optional_time(value: Option<DateTime<Local>>) -> Field {
    value.map_or_else(missing, time)
}

```

### Core Architecture Module: `cli/src/commands/vqueues/pause.rs`
```
// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
// All rights reserved.
//
// Use of this software is governed by the Business Source License
// included in the LICENSE file.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0.

use anyhow::Result;
use cling::prelude::*;

use restate_types::vqueues::VQueueId;

use crate::cli_env::CliEnv;
use crate::clients::{AdminClient, AdminClientInterface, DataFusionHttpClient};

#[derive(Run, Parser, Collect, Clone)]
#[cling(run = "run_pause")]
pub struct Pause {
    /// Virtual queue ID
    vqueue_id: VQueueId,
}

pub async fn run_pause(State(env): State<CliEnv>, opts: &Pause) -> Result<()> {
    // Validate that the vqueue exists
    let client = DataFusionHttpClient::new(&env).await?;
    super::get_vqueue(&client, &opts.vqueue_id).await?;

    let client = AdminClient::new(&env).await?;
    client
        .pause_vqueue(&opts.vqueue_id.to_string())
        .await?
        .success_or_error()?;

    super::report_outcome(&opts.vqueue_id, "paused", "Paused")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5496** (2026-10-05): **1.7.x: ingress-http `invalid input parameter` crashes the whole node on workflow ctx.run completion (after upgrade from 1.6)**
  *Symptoms*: # Server 1.7.x: `ingress-http` task fails with `invalid input parameter` and shuts the whole node down on a workflow `ctx.run` completion — avoided only by `RUST_BACKTRACE=full` (appears to be a race)  Firstly, thanks for an incredible product, and Congrats on the raise!  I've just attempted an upgrade from server 1.6.2 to 1.7.13 and had issues, so then attempted a brand new install on a new data source, to rule out any issues with existing data, but the same thing happened.  ## Summary  On single-node restate-server 1.7.13, a TypeScript SDK (1.17.2) **workflow** invoked over the HTTP ingress reliably crashes the entire node when one of its `ctx.run` steps completes after making a real outbound HTTPS call (a payment-gateway charge in our case). The internal `ingress-http` task (`HttpIngressRole`) fails with `invalid input parameter` and the node performs a graceful full shutdown (exit code 1). The in-flight invocation completes normally on replay after restart.  The identical code and request run fine on server 1.6.2.  Decisive detail: the crash is deterministic at normal runtime speed, and **disappears only when the server is launched with `RUST_BACKTRACE=full`**. Trace-level logging alone does not avoid it; `RUST_BACKTRACE=1` (short backtrace) does not avoid it. This points to a race on the ingress/invoker completion-notification path, which the extra error-construction time under full-backtrace capture reliably loses.  ## Environment  - restate-server: 1.7.13 (behaviour al
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, the minimal repro for this issue is starting a restate server 1.7.13 on macos that listens on both ipv4 and ipv6 stacks (the default in 1.7) and then sending a bun kiss of death with `bun -e 'await fetch("http://localhost:8080/")'`.  Bun apparently when sending a request to localhost, connects to both the ipv4 and ipv6 and then sends a `reset` to the other address when it gets a successful connection. This results into an `accept` failure that shutsdown the entire node.  The full stacktrace is:  ``` 2026-10-05T11:30:38.043307Z ERROR restate_core::task_center   Shutting down: task 38 failed with: invalid input parameter      Stack backtrace:        0: <std::backtrace::Backtrace>::create        1: anyhow::error::<impl core::convert::From<E> for anyhow::Error>::from        2: restate_ingress_http::server::HyperServerIngress<Schemas,Dispatcher>::run::{{closure}}::{{closure}}        3: <tracing::instrument::Instrumented<T> as core::future::future::Future>::poll       
  > @MohamedBassem - amazing! I'll wait for the 1.8 official release, and do the upgrade again. Thank you

- **Issue #5416** (2026-09-28): **StateMutation EntryId is not consistent across replicas**
  *Symptoms*: `ExternalStateMutations` don't have an id associated with them. That's why we are generating one when enqueuing them in a vqueue (https://github.com/restatedev/restate/blob/092b2e06306b2392b194d142a8dce1de1bc1997e/crates/worker/src/partition/state_machine/mod.rs#L5309). The problem is that every replica does this independently and therefore might end up with the same state mutation being stored under different ids. If now the leader makes a decision to apply a given state mutation, the other replicas might not find it under the specified id. The result is that the replicas' state diverges.
  **Post-Mortem & Fix Analysis**:
  > ## Proposed course of action  ### Background  When vqueues are enabled, every replica generates its own random `StateMutationId` when enqueuing an `ExternalStateMutation`. Scheduler decisions reference entries by the leader's id, so a follower may not find the entry, skips the decision and never applies the mutation. This only affects partitions with more than one replica on which the state API (`POST /services/{service}/state`, e.g. via `restate state edit|patch|clear`) was used while vqueues were enabled.  All other parts of the vqueue entry key (`has_lock`, `run_at` and `seq`, which is the LSN of the command) are identical across replicas. Only the entry id differs.  We propose to split the work into two steps.  ### Step 1: Make the state mutation id consistent (the fix)  1. **Deterministic id.** Derive the id from the command's position in the log, e.g. `StateMutationId::from_parts(partition_key, record_created_at, lsn)`, instead of generating a random one. 2. **Id set by the admin

- **Issue #5401** (2026-09-24): **[UI][Virtual Objects] No instances are shown for my service.**
  *Symptoms*: I am sure I have a VO instance under my service (Counter) but navigating to the VO page doesn't show it initially.   <img width="3608" height="2932" alt="Image" src="https://github.com/user-attachments/assets/9df44af5-5c26-4371-882b-2827aee9ea43" />  Running the query `select * from sys_vqueue_meta where service_name='Counter' limit 10;` shows one row with my key.  The page however runs this query ``` SELECT DISTINCT       CAST(partition_key AS VARCHAR) AS partition_key,       lock_name,       scope     FROM sys_vqueue_meta     WHERE service_name = 'Counter'       AND lock_name IS NOT NULL       AND (         num_inbox > 0         OR num_running > 0         OR num_suspended > 0         OR num_paused > 0       )     LIMIT 51 ```  The query shows that we only shows VOs with "active" entries (invocation is inboxed, running, suspended or paused) which is fine.   But this is not clear when I clicked the page. Is this intentionally ?  What makes this even weirder, is that when I searched for my key, and it found the object, now going to the `Counter` VO page lists the instance.  <img width="3612" height="1790" alt="Image" src="https://github.com/user-attachments/assets/2df48994-9809-4caa-8cb0-ced92f35b6a0" />  I assume it's now cached in local storage.  Suggestions: - Make it clear in the page that this is showing only "active" instances. - Or drop the `where` clause that filters out "inactive" instances.
  **Post-Mortem & Fix Analysis**:
  > cc @nikrooz 
  > This was intentional as querying the `state` or completed invocations made the page quite slow. This is being addressed with the addition of `sys_virtual_object_stats` table I have already updated the text to make sure it's clear you are only looking at the VOs with active invocations. 

- **Issue #5375** (2026-09-21): **Race: a notification appended while an attempt is starting can be delivered twice (replay + forward)**
  *Symptoms*: ## Summary  A journal notification can be sent to the SDK **twice** — once as part of the journal replay, and once as a live forwarded notification — if it is appended to the journal in the short window while an attempt is starting up.  The SDK then sees the same notification two times. For a cancel signal this means a `cancellation()` promise that should still be pending resolves immediately.  ## The race  There are two independent paths that carry a journal entry to the SDK:  * **Replay** — the invocation task reads the journal itself and streams entries `0..journal_size` to the deployment. * **Forward** — the partition processor pushes `Action::ForwardNotification { entry_index }` whenever it appends a notification, and the invoker writes that entry to the wire.  Nothing correlates the two. The problem is the ordering in [`start_invocation_task`](https://github.com/restatedev/restate/blob/1f6d9c63dba12cc1cc9fcaae05e3495d2c924124/crates/invoker-impl/src/lib.rs#L1513-L1532):  ```rust // crates/invoker-impl/src/lib.rs let abort_handle = self.invocation_task_runner.start_invocation_task(/* … */);  // L1515 — task spawned // … ism.start(abort_handle, completions_tx);                                        // L1532 — ISM -> InFlight ```  `ism.start()` puts the state machine into `InFlight`, which is what makes it start forwarding notifications. But the spawned task has **not read the journal yet** — it does that later, asynchronously, from its own transaction:  ```rust // crates
  **Post-Mortem & Fix Analysis**:
  > @slinkydeveloper I would appreciate your input on this one. I am thinking the InvocationTask can filter out notifications that has already been replayed. But would help to understand how double delivery like this is handled in the sdk or the shared-core.
  > @muhamadazmy the runtime must definitely make sure it doesnt send the same notification twice. This one sounds like an important correctness bug to address.

- **Issue #5274** (2026-09-14): **[vqueue] Bug repro: vqueues re-ingesting stale entries from inbox after entry confirmation **
  *Symptoms*: A bug that is causing vqueue invocations to go orphaned and ignored by the scheduler. I put out two (AI generated) repros, one is minimal and one shows how the bug can cause an invocation to get stuck in Yielded state.   Rough explanation is as below.  It happens during an async refill of the vqueue. 1. There is an unconfirmed invocation (scheduler proposed, pending state machine) when async refill starts. 2. The invocation gets confirmed, hence scheduler removes the invocation from its memory. 3. The async refill finishes, and because it was started when the call was unconfirmed, it puts the invocation back in memory. [This step is the bug; rest is the repro on how this causes stuck invocations.] 4. The invocation that was sent then legitimately yields and goes back into the durable inbox. 5. During the next refill when the scheduler encounters this (legitimately re-yielded invocation), it ignores it, because it thinks that the call is still unconfirmed.  I didn't add the solution, but maybe one of the below could solve this? - During async refill, if you get a confirmation, put in a corresponding Tombstone into your overlay. - Have some sort of a feedback mechanism if the scheduler's proposed invocation is rejected.
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA  ✍️ ✅<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>
  > Can you confirm which version you are testing against?
  > This was tested against both 1.7.7 and on today's main.

- **Issue #5238** (2026-08-31): **Run orphaned jc cleanup synchronously behind an opt-in**
  *Symptoms*: ## Context  The orphaned `jc` cleanup currently runs in the background while the partition processor can apply new work. Its orphan decision and subsequent point deletions are not atomic.  Idempotent invocations and workflows can reuse deterministic invocation IDs. If an old invocation has been classified as orphaned while the partition processor creates a new journal for the same invocation ID, cleanup can delete newly legitimate `jc` entries.  The cleanup must therefore not overlap partition processing. Because it scans the complete `jc` table and may delay partition availability, operators need to opt in until its cost has been measured on representative databases.  Depends on #5237.  ## Scope  - Add a false-by-default experimental opt-in for the one-time orphaned `jc` cleanup. - When disabled, do not run cleanup and leave its completion marker unset so it can be enabled later. - Continue marking fresh stores complete without scanning because they cannot contain historical orphaned entries. - When enabled, run cleanup after storage migrations and before the partition processor starts reading or applying Bifrost records. - Execute the blocking RocksDB scan off the async runtime but await its completion before processing work. - On cancellation or failure, leave the marker unset and retry on the next opted-in startup. - On cleanup failure, fail partition startup rather than processing work concurrently. - Instrument cleanup so its startup cost can be measured on real stores.
  **Post-Mortem & Fix Analysis**:
  > One of the underlying problems is that we are reusing invocations ids across different invocations (e.g. in case of idempotent invocations). With the canonical id which includes the sequence number, this problem wouldn't exist. Unfortunately, we don't have that yet.

- **Issue #5237** (2026-08-27): **Make orphaned jc cleanup fail closed**
  *Symptoms*: ## Context  The one-time cleanup of orphaned `JournalCompletionIdToCommandIndex` (`jc`) entries currently determines whether an invocation still owns a journal through a RocksDB iterator. There are two unsafe failure modes:  - The journal-existence check treats `iterator.item() == None` as absence without checking `iterator.status()`. A read failure can therefore classify a live journal as absent and delete `jc` entries that are still in use. - The outer `jc` iterator also treats iterator failure as normal exhaustion. Cleanup can stop part-way, return success, and persist its completion marker even though part of the table was not inspected.  A V2 journal entry at index `0` is the ownership sentinel: while it exists, the invocation owns the journal and is responsible for cleaning up the journal together with its indexes.  ## Scope  - Replace the per-invocation journal prefix iterator with one point lookup of `j2[0]`. - Cache that ownership decision for all contiguous `jc` entries belonging to the invocation, preserving one lookup per invocation rather than one lookup per `jc` entry. - Propagate point-read errors instead of interpreting them as absence. - Make the outer `jc` scan distinguish verified exhaustion from iterator failure. - Persist the cleanup completion marker only after an uncancelled scan reaches verified exhaustion. - Report how many `jc` entries and invocations were scanned, in addition to the existing deletion counts.  Concurrent changes by a running partitio

- **Issue #5235** (2026-08-27): **SIGUSR2 task dump can abort a server on `current_thread` runtimes**
  *Symptoms*: Sending `SIGUSR2` to `restate-server` caused an unplanned node restart while it was serving invocation traffic.  The panic occurred on `rt:pp-0`, a partition-processor `current_thread` runtime. Tokio task dumping re-polls live task futures to collect backtraces. In this case, re-polling an in-flight `h2` connection woke a task while the `current_thread` scheduler's `RefCell` was already borrowed, causing the initial panic. A subsequent `h2` panic while unwinding turned that panic into a process abort.  `SIGUSR2` is a documented diagnostic mechanism, so it should degrade to a partial dump rather than terminate the server.  ## Observed sequence  The initial panic occurred within roughly 7 ms of receiving the signal, thread `rt:pp-0`.  1. `Received SIGUSR2, dumping tokio task backtraces` 2. Initial panic in Tokio's `current_thread` scheduler: `tokio-1.53.1/src/runtime/scheduler/current_thread/mod.rs:723`, `RefCell already borrowed`, via `trace::Root::poll` → `pool::conn::Connection::drive_handshake` → `h2 Connection::poll` → `h2 Stream::send_data` → `wake_by_val` → `current_thread::schedule` 3. Panic while unwinding in `h2`: `h2-0.4.18/src/proto/streams/streams.rs:1571`, `unwrap()` on `PoisonError`, via `trace::Root::poll` → `InvocationTask::run` → `ServiceProtocolRunner::run` 4. Fatal destructor panic during cleanup, again at the same `h2` site: `drop_in_place<h2::share::RecvStream>` → `drop_in_place<restate_service_client::http::ResponseBody>` → `DecoderStream` / `ThrottledStr
  **Post-Mortem & Fix Analysis**:
  > We might be looking at a problem in Tokio here. Based on some superficial investigation it seems that dumping the tasks follows a slightly different path then normal task polling. One difference is that a borrow to the `context.core` is kept across polling tasks which can lead to the described problem if the tasks wants to synchronously schedule another task. Note that Tokio's task dump feature is still unstable so this might not be unexpected.  If it is indeed a Tokio problem, then I'd suggest to disable this feature until it gets properly fixed upstream and we can rely on it again.
  > As a temporary solution to prevent us from shooting ourselves in the foot, I'll disable the task dump feature.
  > I've created https://github.com/tokio-rs/tokio/issues/8391 for tracking the problem on Tokio's side. Once it's resolved and we update our Tokio dependency, we can re-enable the task dump feature.

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

### Incident Patch 1: `ad765ea2` (2026-10-05)
**Commit Message**: [CLI] Render config list-environments through the Formatter (#5485)

**File**: `cli/src/commands/config/list_environments.rs` (modified, +37/-36)
```diff
@@ -10,17 +10,14 @@
 
 use anyhow::Result;
 use cling::prelude::*;
-use comfy_table::{Cell, Table};
 use figment::{
     Figment, Profile,
     providers::{Format, Serialized, Toml},
 };
 
-use restate_cli_util::c_println;
-
 use crate::{
     cli_env::{CliConfig, CliEnv, LOCAL_PROFILE},
-    console::StyledTable,
+    ui::fmt::{Field, Formatter, IfEmpty, OutputFormatter},
 };
 
 /// List the environments of the CLI config file, marking the current one
@@ -47,36 +44,40 @@ pub async fn run_list_environments(
         figment = figment.merge(Toml::file_exact(env.config_file).nested());
     }
 
-    let mut table = Table::new_styled();
-    let header = vec!["CURRENT", "NAME", "ADMIN_BASE_URL"];
-    table.set_styled_header(header);
-
-    for profile in figment.profiles() {
-        if profile == Profile::Global || profile == Profile::Default {
-            continue;
-        }
-
-        let figment = figment.clone().select(profile.clone());
-
-        let admin_base_url = figment.find_value("admin_base_url").ok();
-
-        let current = if profile == env.environment { "*" } else { "" };
-
-        let row = vec![
-            Cell::new(current),
-            Cell::new(profile.as_str()),
-            Cell::new(
-                admin_base_url
-                    .as_ref()
-                    .and_then(|u| u.as_str())
-                    .unwrap_or("(NONE)"),
-            ),
-        ];
-
-        table.add_row(row);
-    }
-
-    c_println!("{}", table);
-
-    Ok(())
+    let profiles: Vec<Profile> = figment
+        .profiles()
+        .filter(|profile| *profile != Profile::Global && *profile != Profile::Default)
+        .cloned()
+        .collect();
+
+    let rows: Vec<[Field; 3]> = profiles
+        .into_iter()
+        .map(|profile| {
+            let admin_base_url = figment
+                .clone()
+                .select(profile.clone())
+                .find_value("admin_base_url")
+                .ok()
+                .and_then(|url| url.as_str().map(str::to_owned));
+            let current = profile == env.environment;
+
+            [
+                Field::with_display(current, if current { "*" } else { "" }),
+                Field::new(profile.as_str().as_str()),
+                Field::with_display(
+                    &admin_base_url,
+                    admin_base_url.as_deref().unwrap_or("(NONE)"),
+                ),
+            ]
+        })
+        .collect();
+
+    let mut f = Formatter::new();
+    f.table(
+        "environments",
+        &["current", "name", "admin_base_url"],
+        rows,
+        IfEmpty::Nothing,
+    );
+    f.finish()
 }
```

---

### Incident Patch 2: `4c2731fe` (2026-10-02)
**Commit Message**: [RocksDB] Fix stats level misalignment

**File**: `crates/types/src/config/rocksdb.rs` (modified, +1/-1)
```diff
@@ -231,7 +231,7 @@ impl RocksDbOptions {
 
     pub fn rocksdb_statistics_level(&self) -> StatisticsLevel {
         self.rocksdb_statistics_level
-            .unwrap_or(StatisticsLevel::ExceptTimers)
+            .unwrap_or(StatisticsLevel::ExceptDetailedTimers)
     }
 
     pub fn rocksdb_log_level(&self) -> RocksDbLogLevel {
```

---

### Incident Patch 3: `04575a99` (2026-10-02)
**Commit Message**: Update guidelines for release branch naming

This commits updates the release documentation to uniformly create
release branches of the form release/X.Y. It also includes instructions
for how to stage pending documentation changes before the release is
created.

**File**: `.github/workflows/ci.yml` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ on:
   push:
     branches:
       - main
+      - release/*
+      # Keep CI on existing maintenance branches during the naming transition.
       - release-*
 
 jobs:
```

**File**: `docs/dev/build-and-ci.md` (modified, +3/-1)
```diff
@@ -111,7 +111,9 @@ The dev-tools image is versioned and pinned in consuming workflows. When updatin
 
 ### Main CI Pipeline (`ci.yml`)
 
-Triggered on: PRs, pushes to `main` and `release-*` branches, and as part of releases.
+Triggered on: PRs, pushes to `main` and `release/*` branches, and as part of releases. Existing `release-*` maintenance branches remain supported during the naming transition.
+
+`ci.yml` is maintained directly. Cargo-dist generates `release.yml`, which calls `ci.yml` through the `local-artifacts-jobs = ["./ci", ...]` configuration in `dist-workspace.toml`.
 
 **Jobs:**
 
```

**File**: `docs/dev/release-testing.md` (modified, +5/-0)
```diff
@@ -43,6 +43,11 @@ Use automated results where they cover the scenario; test the remaining gaps. Ex
 
 - Test new or changed features, promoted experimental features, configuration, UI, and CLI/restatectl workflows.
 - Follow the documentation while testing; fix missing or confusing steps. Check upgrade guidance, configuration changes, and breaking-change notices.
+- Collect documentation gaps in a separate release documentation umbrella issue and stage fixes on the docs `release/X.Y` branch, following the [documentation staging process](release.md#staging-release-documentation).
+
+### Public APIs
+
+- Validate newly introduced or promoted non-experimental public APIs, including new request/response fields. Exercise successful requests and representative invalid inputs; check response bodies, status codes, and compatibility.
 
 ### Cloud and Kubernetes
 
```

**File**: `docs/dev/release.md` (modified, +13/-2)
```diff
@@ -22,6 +22,8 @@ We follow [SemVer](https://semver.org/):
 
 Runtime and SDKs follow independent artifact versioning. Restate server and SDK compatibility is defined by the intersection of supported service protocol versions.
 
+Use `release/X.Y` for release branches across repositories (for example, `release/1.8`). Keep patch and release-candidate versions in tags.
+
 ## Pre-release
 
 Before releasing, make sure all the issues tagged with release-blocker have either been solved, or PRs are ready to solve them:
@@ -35,6 +37,15 @@ Check that the e2e tests are passing:
 * [E2e verification runner](https://github.com/restatedev/e2e-verification-runner/actions)
 * [E2e tests](https://github.com/restatedev/e2e/actions/workflows/ci.yml)
 
+### Staging release documentation
+
+Prepare documentation alongside release testing in [docs-restate](https://github.com/restatedev/docs-restate):
+
+1. Create `release/X.Y` from docs `main` when release preparation starts.
+2. Target release-specific documentation PRs at `release/X.Y`. Keep changes individually reviewable.
+3. When refreshing generated references with the docs [pre-release workflow](https://github.com/restatedev/docs-restate/blob/main/.github/workflows/pre-release.yml), select the staging branch and a tagged runtime version. Check that the resulting PR targets the staging branch.
+4. Once the runtime release is available and the documentation is ready, merge a final PR from `release/X.Y` into docs `main` and delete the release branch.
+
 ## Releasing the Restate runtime
 
 Prepare the release first, optionally cut release candidates for testing, then create the final release. Release candidates must be built from the prepared state so that they test what the final release ships.
@@ -64,8 +75,8 @@ Repeat with an incremented `N` for every fix that needs validation. Update the r
 
 **Note:**
 Don't immediately create a release branch after a MAJOR/MINOR release.
-A release branch `release-MAJOR.MINOR` should only be created once a change to the storage formats, APIs or a new feature gets merged that should be shipped with the next MAJOR/MINOR release.
+A runtime maintenance branch `release/X.Y` should only be created once a change to the storage formats, APIs or a new feature gets merged that should be shipped with the next MAJOR/MINOR release.
 
 ## Post-release
 
-If you are releasing a new major/minor version of the runtime, please also create a new release of the [documentation](https://github.com/restatedev/docs-restate).
+If you are releasing a new major/minor version of the runtime, publish the staged [documentation](#staging-release-documentation) after the runtime release is available.
```

---

### Incident Patch 4: `90a4b4c2` (2026-10-01)
**Commit Message**: [Networking] Use fixed, symmetric HTTP/2 windows on fabric connections

The two ends of a node-to-node connection accidentally used different flow control. We found
this while testing fabric throughput between nodes.

The cause is how hyper's HTTP/2 builder works: `adaptive_window(true)` resets both initial
windows to 64 KiB, and setting a window size afterwards turns adaptive mode off again, so the
order of the calls decides the outcome.
- The accepting node called `adaptive_window` before the window sizes, so it ran with fixed
  windows and `http2-adaptive-window` had no effect.
- The connecting node's tonic endpoint applies the window sizes before adaptive mode, so it ran
  adaptive from 64 KiB and ignored `data-stream-window-size`.

Fixed windows were the intent behind `data-stream-window-size`.

## Change
- Both ends use fixed windows: `GrpcConnector` and the listener set `adaptive_window(false)`.
- The connection window equals the stream window.
- `data-stream-window-size` defaults to 4 MiB (was 2 MiB). Its docs explain sizing from the
  bandwidth-delay product and the kernel TCP buffer limits above 4 MiB.
- `networking.http2-adaptive-window` is deprecated and has no effect; 

**File**: `crates/cli-util/src/opts.rs` (modified, +3/-3)
```diff
@@ -17,7 +17,7 @@ use cling::Collect;
 
 use restate_types::config::DEFAULT_MESSAGE_SIZE_LIMIT;
 use restate_types::net::connect_opts::{
-    CommonClientConnectionOptions, GrpcConnectionOptions, MESSAGE_SIZE_OVERHEAD,
+    CommonClientConnectionOptions, GrpcConnectionOptions, Http2FlowControl, MESSAGE_SIZE_OVERHEAD,
 };
 
 const DEFAULT_CONNECT_TIMEOUT: u64 = 3_000;
@@ -165,8 +165,8 @@ impl CommonClientConnectionOptions for NetworkOpts {
         Duration::from_millis(self.connect_timeout)
     }
 
-    fn http2_adaptive_window(&self) -> bool {
-        true
+    fn http2_flow_control(&self) -> Http2FlowControl {
+        Http2FlowControl::Adaptive
     }
 }
 
```

**File**: `crates/core/src/network/grpc/connector.rs` (modified, +5/-11)
```diff
@@ -24,7 +24,7 @@ use restate_types::net::address::{AdvertisedAddress, GrpcPort, ListenerPort, Pee
 use restate_types::net::connect_opts::GrpcConnectionOptions;
 
 use crate::network::grpc::DEFAULT_GRPC_COMPRESSION;
-use crate::network::net_util::{DNSResolution, connect_tonic_endpoint};
+use crate::network::net_util::{DNSResolution, apply_options, connect_tonic_endpoint};
 use crate::network::protobuf::core_node_svc::core_node_svc_client::CoreNodeSvcClient;
 use crate::network::protobuf::network::Message;
 use crate::network::tls::TlsClientConfig;
@@ -98,21 +98,15 @@ fn create_channel<P: ListenerPort + GrpcPort>(
         PeerNetAddress::Http(uri) => Channel::builder(uri.clone()).executor(TaskCenterExecutor),
     };
 
-    let endpoint = endpoint
+    // Shared with `create_tonic_channel`, so both fabric client paths use the same timeouts and
+    // flow control.
+    let endpoint = apply_options(endpoint, options)
         .user_agent(format!(
             "restate/{}",
             option_env!("CARGO_PKG_VERSION").unwrap_or("dev")
         ))
         .unwrap()
-        .connect_timeout(*options.connect_timeout)
-        .http2_keep_alive_interval(*options.http2_keep_alive_interval)
-        .keep_alive_timeout(*options.http2_keep_alive_timeout)
-        .http2_adaptive_window(options.http2_adaptive_window)
-        .initial_stream_window_size(options.stream_window_size())
-        .initial_connection_window_size(options.connection_window_size())
-        .keep_alive_while_idle(true)
-        // this true by default, but this is to guard against any change in defaults
-        .tcp_nodelay(true);
+        .keep_alive_while_idle(true);
 
     // If TLS is in required mode, we'll just reject to connect to a non TLS address.
     // Note: TLS settings are only supported for HTTP addresses.
```

**File**: `crates/core/src/network/net_util.rs` (modified, +20/-6)
```diff
@@ -33,7 +33,7 @@ use restate_types::config::{Configuration, TlsMode};
 use restate_types::errors::GenericError;
 use restate_types::net::address::{AdvertisedAddress, GrpcPort};
 use restate_types::net::address::{ListenerPort, PeerNetAddress};
-use restate_types::net::connect_opts::CommonClientConnectionOptions;
+use restate_types::net::connect_opts::{CommonClientConnectionOptions, Http2FlowControl};
 use restate_types::net::listener::Listeners;
 
 use crate::network::tls::{TlsClientConfig, TlsServerConfig};
@@ -232,21 +232,34 @@ pub fn create_tonic_channel<
     }
 }
 
-fn apply_options<T: CommonClientConnectionOptions + Send + Sync + ?Sized>(
+/// Applies the common client options, including HTTP/2 flow control, to a tonic endpoint.
+pub(crate) fn apply_options<T: CommonClientConnectionOptions + Send + Sync + ?Sized>(
     endpoint: Endpoint,
     options: &T,
 ) -> Endpoint {
-    if let Some(request_timeout) = options.request_timeout() {
+    let endpoint = if let Some(request_timeout) = options.request_timeout() {
         endpoint.timeout(request_timeout)
     } else {
         endpoint
     }
     .connect_timeout(options.connect_timeout())
     .http2_keep_alive_interval(options.keep_alive_interval())
     .keep_alive_timeout(options.keep_alive_timeout())
-    .http2_adaptive_window(options.http2_adaptive_window())
     // this true by default, but this is to guard against any change in defaults
-    .tcp_nodelay(true)
+    .tcp_nodelay(true);
+
+    // tonic applies the window sizes before adaptive mode, and enabling adaptive mode resets both
+    // windows to 64 KiB, so each mode sets only its own knobs.
+    match options.http2_flow_control() {
+        Http2FlowControl::Adaptive => endpoint.http2_adaptive_window(true),
+        Http2FlowControl::Fixed {
+            stream_window,
+            connection_window,
+        } => endpoint
+            .http2_adaptive_window(false)
+            .initial_stream_window_size(stream_window)
+            .initial_connection_window_size(connection_window),
+    }
 }
 
 #[derive(Debug, thiserror::Error)]
@@ -351,7 +364,8 @@ where
                 builder
                     .http2()
                     .timer(hyper_util::rt::TokioTimer::default())
-                    .adaptive_window(network_options.http2_adaptive_window)
+                    // Fixed windows, as on the client end (`GrpcConnector`).
+                    .adaptive_window(false)
                     .initial_connection_window_size(network_options.connection_window_size())
                     .initial_stream_window_size(network_options.stream_window_size())
                     .keep_alive_interval(Some(network_options.http2_keep_alive_interval.into()))
```

**File**: `crates/types/src/config/networking.rs` (modified, +32/-14)
```diff
@@ -67,7 +67,14 @@ pub struct NetworkingOptions {
     pub http2_keep_alive_timeout: NonZeroFriendlyDuration,
 
     /// # HTTP/2 Adaptive Window
-    pub http2_adaptive_window: bool,
+    ///
+    /// Deprecated and has no effect. Node-to-node connections use fixed HTTP/2 flow-control
+    /// windows sized by `data-stream-window-size`.
+    ///
+    /// Since v1.8.0 (deprecated)
+    #[deprecated(since = "1.8.0", note = "Has no effect; use `data-stream-window-size`")]
+    #[serde(skip_serializing_if = "Option::is_none")]
+    http2_adaptive_window: Option<bool>,
 
     /// # Disable Compression
     ///
@@ -76,17 +83,27 @@ pub struct NetworkingOptions {
 
     /// # Data Stream Window Size
     ///
-    /// Controls the number of bytes the can be sent on every data stream before inducing
-    /// back pressure. Data streams are used for sending messages between nodes.
+    /// Controls how many bytes a node can send to another node before the receiving node has
+    /// processed them. Beyond that, the sender waits, which applies back pressure.
+    ///
+    /// The value is best derived from the bandwidth-delay product (BDP) of the network. For
+    /// instance, if the network has a bandwidth of 10 Gbps and a round-trip time of 5 ms, the BDP
+    /// is 10 Gbps * 0.005 s = 6.25 MB. The window should be at least the BDP to fully utilize the
+    /// bandwidth, assuming the latency is constant. We recommend twice the BDP to account for
+    /// variations in latency.
+    ///
+    /// At 10 Gbps, the default of 4 MiB is twice the BDP of a round trip of about 1.7 ms, which
+    /// covers typical networks within a data center. On high-latency links, the window limits
+    /// throughput to about one window per round trip, for example about 40 MiB/s at 100 ms, so
+    /// raise it there. Each connection can buffer up to one window of data that the receiving
+    /// node has not processed yet.
     ///
-    /// The value should is often derived from BDP (Bandwidth Delay Product) of the network. For
-    /// instance, if the network has a bandwidth of 10 Gbps with a round-trip time of 5 ms, the BDP
-    /// is 10 Gbps * 0.005 s = 6.25 MB. This means that the window size should be at least 6.25 MB
-    /// to fully utilize the network bandwidth assuming the latency is constant. Our recommendation
-    /// is to set the window size to 2x the BDP to account for any variations in latency.
+    /// Windows above 4 MiB also need larger TCP buffers on every node, because the kernel limits
+    /// each connection's buffers independently of this setting. On Linux, raise the maximum
+    /// (third) values of `net.ipv4.tcp_wmem` and `net.ipv4.tcp_rmem`.
     ///
-    /// If network latency is high, it's recommended to set this to a higher value.
-    /// Maximum theoretical value is 2^31-1 (2 GiB - 1), but we will sanitize this value to 500 MiB.
+    /// The maximum theoretical value is 2^31-1 (2 GiB - 1), but values above 500 MiB are reduced
+    /// to 500 MiB. Since v1.8.0, the default is 4 MiB (previously 2 MiB).
     data_stream_window_size: NonZeroByteCount,
 
     /// # Networking Message Size Limit
@@ -141,7 +158,7 @@ impl NetworkingOptions {
     }
 
     pub fn connection_window_size(&self) -> u32 {
-        self.stream_window_size() * 3
+        self.stream_window_size()
     }
 
     pub fn fabric_memory_limit(&self) -> NonZeroByteCount {
@@ -151,6 +168,7 @@ impl NetworkingOptions {
 
 impl Default for NetworkingOptions {
     fn default() -> Self {
+        #[allow(deprecated)]
         Self {
             connect_timeout: NonZeroFriendlyDuration::from_secs_unchecked(3),
             connect_retry_policy: RetryPolicy::exponential(
@@ -162,11 +180,11 @@ impl Default for NetworkingOptions {
             handshake_timeout: NonZeroFriendlyDuration::from_secs_unchecked(3),
             http2_keep_alive_interval: NonZeroFriendlyDuration::from_secs_unchecked(1),
             http2_keep_alive_timeout: NonZeroFriendlyDuration::from_secs_unchecked(3),
-            http2_adaptive_window: true,
+            http2_adaptive_window: None,
             disable_compression: false,
-            // 2MiB
+            // 4MiB
             data_stream_window_size: NonZeroByteCount::new(
-                NonZeroUsize::new(2 * 1024 * 1024).expect("Non zero number"),
+                NonZeroUsize::new(4 * 1024 * 1024).expect("Non zero number"),
             ),
             message_size_limit: default_message_size_limit(),
             fabric_memory_limit: default_fabric_memory_limit(),
```

**File**: `crates/types/src/net/connect_opts.rs` (modified, +29/-9)
```diff
@@ -26,13 +26,29 @@ pub trait GrpcConnectionOptions {
     /// wrapping when transmitted over the internal network.
     fn message_size_limit(&self) -> NonZeroUsize;
 }
+
+/// HTTP/2 flow control of a client connection.
+///
+/// hyper treats the two modes as mutually exclusive: enabling adaptive mode resets both windows
+/// to 64 KiB, and setting a window size turns adaptive mode off.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub enum Http2FlowControl {
+    /// Windows start at 64 KiB and grow with the measured bandwidth-delay product.
+    Adaptive,
+    /// Fixed windows, in bytes.
+    Fixed {
+        stream_window: u32,
+        connection_window: u32,
+    },
+}
+
 /// Helper trait to extract common client connection options from different configuration types.
 pub trait CommonClientConnectionOptions: GrpcConnectionOptions {
     fn connect_timeout(&self) -> Duration;
     fn request_timeout(&self) -> Option<Duration>;
     fn keep_alive_interval(&self) -> Duration;
     fn keep_alive_timeout(&self) -> Duration;
-    fn http2_adaptive_window(&self) -> bool;
+    fn http2_flow_control(&self) -> Http2FlowControl;
 }
 
 impl<T: GrpcConnectionOptions> GrpcConnectionOptions for &T {
@@ -61,8 +77,8 @@ where
         (*self).keep_alive_timeout()
     }
 
-    fn http2_adaptive_window(&self) -> bool {
-        (*self).http2_adaptive_window()
+    fn http2_flow_control(&self) -> Http2FlowControl {
+        (*self).http2_flow_control()
     }
 }
 
@@ -95,8 +111,8 @@ where
         (**self).keep_alive_timeout()
     }
 
-    fn http2_adaptive_window(&self) -> bool {
-        (**self).http2_adaptive_window()
+    fn http2_flow_control(&self) -> Http2FlowControl {
+        (**self).http2_flow_control()
     }
 }
 
@@ -126,8 +142,12 @@ impl CommonClientConnectionOptions for NetworkingOptions {
         self.http2_keep_alive_timeout.into()
     }
 
-    fn http2_adaptive_window(&self) -> bool {
-        self.http2_adaptive_window
+    fn http2_flow_control(&self) -> Http2FlowControl {
+        // Matches the fabric listener (`net_util::run_listener_loop`), which uses fixed windows.
+        Http2FlowControl::Fixed {
+            stream_window: self.stream_window_size(),
+            connection_window: self.connection_window_size(),
+        }
     }
 }
 
@@ -154,7 +174,7 @@ impl CommonClientConnectionOptions for MetadataClientOptions {
         self.keep_alive_timeout.into()
     }
 
-    fn http2_adaptive_window(&self) -> bool {
-        true
+    fn http2_flow_control(&self) -> Http2FlowControl {
+        Http2FlowControl::Adaptive
     }
 }
```

**File**: `release-notes/unreleased/fabric-fixed-http2-windows.md` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# Release Notes: Fixed, symmetric HTTP/2 flow-control windows between nodes
+
+## Behavioral Change
+
+### What Changed
+
+Node-to-node connections now use one fixed HTTP/2 flow-control window, set by
+`networking.data-stream-window-size`, on both ends of every connection.
+
+- The default rises from 2 MiB to 4 MiB.
+- `networking.http2-adaptive-window` is deprecated and has no effect.
+
+Previously, `data-stream-window-size` and `http2-adaptive-window` each took effect on only one end
+of a connection, so neither setting behaved as documented.
+
+### Why This Matters
+
+`data-stream-window-size` now means the same thing in both directions, and it bounds how much
+received but unprocessed data each connection can hold.
+
+### Impact on Users
+
+- **Nodes in the same data center:** no change in throughput.
+- **High-latency links:** a connection carries at most about one window per round trip. With the
+  new 4 MiB default, responses from a remote node can be slower than before on links with long
+  round trips. In our tests at a 100 ms round trip, remote SQL scans reached about 27 MiB/s
+  instead of 33 MiB/s. Raise `data-stream-window-size` for such links; 8 MiB matched the
+  previous throughput.
+- **Windows above 4 MiB** also need larger TCP buffers in the operating system on every node. On
+  Linux, raise the maximum (third) values of `net.ipv4.tcp_wmem` and `net.ipv4.tcp_rmem`, because
+  the kernel limits each connection's buffers independently of `networking.data-stream-window-size`.
+- **Memory:** each node-to-node connection can hold up to one window of received data that the
+  node has not processed yet.
+
+### Migration Guidance
+
+No action is required for nodes in one data center. If you set `networking.http2-adaptive-window`,
+remove it. For long-distance links, size `networking.data-stream-window-size` to about twice the
+bandwidth-delay product, and raise the operating system's TCP buffer limits if you go above 4 MiB:
+
+```toml
+[networking]
+data-stream-window-size = "8MiB"
+```
```

---

### Incident Patch 5: `0d7a7c91` (2026-10-01)
**Commit Message**: [ingress] Fix some status codes and headers (#5456)

- Returning HandlerError::Body was retunring 500 (because we failed to read the body), so added a new variant for when the deserialization fails which returns 400.
- Added missing content type header to `/restate/invocation/{id}/status`

**File**: `crates/admin/src/rest_api/error.rs` (modified, +3/-3)
```diff
@@ -309,9 +309,9 @@ impl IntoResponse for MetaApiError {
             | MetaApiError::DeploymentNotFound(_)
             | MetaApiError::SubscriptionNotFound(_)
             | MetaApiError::KafkaClusterNotFound(_) => StatusCode::NOT_FOUND,
-            MetaApiError::InvalidField(_, _) | MetaApiError::UnsupportedOperation(_, _) => {
-                StatusCode::BAD_REQUEST
-            }
+            MetaApiError::InvalidField(_, _)
+            | MetaApiError::UnsupportedOperation(_, _)
+            | MetaApiError::BadScope(_) => StatusCode::BAD_REQUEST,
             MetaApiError::Schema(error) => error.status_code(),
             MetaApiError::Conflict(_) => StatusCode::CONFLICT,
             MetaApiError::DeprecatedPutDeployment => StatusCode::METHOD_NOT_ALLOWED,
```

**File**: `crates/ingress-http/src/handler/error.rs` (modified, +3/-0)
```diff
@@ -74,6 +74,8 @@ pub(crate) enum HandlerError {
     PrivateService,
     #[error("cannot read body: {0:?}")]
     Body(GenericError),
+    #[error("invalid request body: {0}")]
+    BadRequestBody(serde_json::Error),
     #[error("too many requests, the ingress is overloaded. Retry later.")]
     TooManyRequests,
     #[error("the invocation exists but has not completed yet")]
@@ -192,6 +194,7 @@ impl HandlerError {
             | HandlerError::LimitKeyWithoutScope
             | HandlerError::InvalidLimitKey(_)
             | HandlerError::BadScopeValue(_)
+            | HandlerError::BadRequestBody(_)
             | HandlerError::BadPath(_) => StatusCode::BAD_REQUEST,
             HandlerError::MethodNotAllowed => StatusCode::METHOD_NOT_ALLOWED,
             HandlerError::NotReady => StatusCode::from_u16(470).unwrap(),
```

**File**: `crates/ingress-http/src/handler/invocation.rs` (modified, +5/-4)
```diff
@@ -9,14 +9,14 @@
 // by the Apache License, Version 2.0.
 
 use bytes::Bytes;
-use http::{Method, Request, Response};
+use http::{Method, Request, Response, header};
 use http_body_util::{BodyExt, Full};
 use serde::Serialize;
 use tracing::warn;
 
 use super::HandlerError;
 use super::path_parsing::{InvocationRequestType, InvocationTargetType, TargetType};
-use super::{Handler, InvocationTargetRequest};
+use super::{APPLICATION_JSON, Handler, InvocationTargetRequest};
 use crate::RequestDispatcher;
 use crate::handler::responses::X_RESTATE_ID;
 use restate_types::errors::{GenericError, InvocationError};
@@ -202,8 +202,8 @@ where
             .map_err(|e| HandlerError::Body(e.into()))?
             .to_bytes();
 
-        let target_request: InvocationTargetRequest = serde_json::from_slice(&body_bytes)
-            .map_err(|e| HandlerError::Body(anyhow::anyhow!("invalid request body: {e}").into()))?;
+        let target_request: InvocationTargetRequest =
+            serde_json::from_slice(&body_bytes).map_err(HandlerError::BadRequestBody)?;
 
         target_request.into_invocation_query()
     }
@@ -314,6 +314,7 @@ where
         .unwrap();
 
         Ok(Response::builder()
+            .header(header::CONTENT_TYPE, APPLICATION_JSON)
             .header(X_RESTATE_ID, invocation_id.to_string())
             .body(Full::new(body.into()))
             .unwrap())
```

**File**: `crates/ingress-http/src/handler/lookup.rs` (modified, +2/-2)
```diff
@@ -43,8 +43,8 @@ impl<Schemas, Dispatcher> Handler<Schemas, Dispatcher> {
             .map_err(|e| HandlerError::Body(e.into()))?
             .to_bytes();
 
-        let target_request: InvocationTargetRequest = serde_json::from_slice(&body_bytes)
-            .map_err(|e| HandlerError::Body(anyhow::anyhow!("invalid lookup body: {e}").into()))?;
+        let target_request: InvocationTargetRequest =
+            serde_json::from_slice(&body_bytes).map_err(HandlerError::BadRequestBody)?;
 
         let invocation_query = target_request.into_invocation_query()?;
         let invocation_id = invocation_query.to_invocation_id();
```

---

### Incident Patch 6: `d477c43e` (2026-10-01)
**Commit Message**: [PartitionStore] Use capped 20-byte prefix filters in partition stores

Switch the partition-store prefix extractor from a fixed 10-byte prefix
(key kind and partition key) to a capped 20-byte one, so filters tell
apart the invocations and vqueues sharing a partition key. Prefix seeks
and within-prefix range scans now need 20-byte prefixes; shorter ones
use total-order seeks.

Whole-key filtering stays on by default: without it, files written with
the fixed 10-byte extractor give point lookups no filter. The temporary
`rocksdb-disable-whole-key-filtering` option turns it off. v1.9 is meant
to make that the default together with L6 filters, and remove the
option.

Bump rust-rocksdb to 0.53.1 for `Options::set_capped_prefix_extractor`.

The balance
-----------
Filters trade block-cache memory for skipped reads. Whole-key filters
hold every key; prefix filters hold one entry per distinct prefix. L6
holds most keys, which is why L6 filters with whole keys are expensive:
8.1x the v1.7 filter memory. A 20-byte prefix is selective enough to
drop whole keys, and dropping them pays for L6 filters: 1.9x the v1.7
filter memory buys ~100x faster lookups of missing invocations.

Whole keys cann

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -9578,7 +9578,7 @@ dependencies = [
 [[package]]
 name = "rust-librocksdb-sys"
 version = "0.48.1+11.8.1"
-source = "git+https://github.com/restatedev/rust-rocksdb?tag=v0.53.0-restate.1#34cc28f1d18b0f300c8e1458d303a1f940f1c9ab"
+source = "git+https://github.com/restatedev/rust-rocksdb?tag=v0.53.0-restate.2#fd48cdc81008507ac9216ca40c79e84c1ec452a4"
 dependencies = [
  "bindgen",
  "bzip2-sys",
@@ -9596,7 +9596,7 @@ dependencies = [
 [[package]]
 name = "rust-rocksdb"
 version = "0.53.0"
-source = "git+https://github.com/restatedev/rust-rocksdb?tag=v0.53.0-restate.1#34cc28f1d18b0f300c8e1458d303a1f940f1c9ab"
+source = "git+https://github.com/restatedev/rust-rocksdb?tag=v0.53.0-restate.2#fd48cdc81008507ac9216ca40c79e84c1ec452a4"
 dependencies = [
  "libc",
  "parking_lot",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -236,7 +236,7 @@ rlimit = { version = "0.11.0" }
 rocksdb = { version = "0.53.0", package = "rust-rocksdb", features = [
     "multi-threaded-cf",
     "jemalloc",
-], git = "https://github.com/restatedev/rust-rocksdb", tag = "v0.53.0-restate.1" }
+], git = "https://github.com/restatedev/rust-rocksdb", tag = "v0.53.0-restate.2" }
 rstest = "0.27.0"
 rustls = { version = "0.23.35", default-features = false, features = ["ring"] }
 rustyline = { version = "18.0.1" }
```

**File**: `crates/partition-store/src/lib.rs` (modified, +4/-3)
```diff
@@ -50,11 +50,12 @@ pub use restate_rocksdb::Priority;
 
 use crate::scan::TableScan;
 
-// FixedPrefixTransform requires seek keys to be at least as long as its configured prefix.
-// Shorter prefixes must bypass prefix seeking and its bloom filters.
+// The capped prefix extractor maps a seek key shorter than its cap to the key itself, so a prefix
+// seek would stop at the first longer key. Shorter prefixes must bypass prefix seeking and its
+// bloom filters.
 fn configure_prefix_iterator_opts<B: Into<Vec<u8>>>(opts: &mut rocksdb::ReadOptions, prefix: B) {
     let prefix = prefix.into();
-    if prefix.len() >= DB_PREFIX_LENGTH {
+    if prefix.len() >= PREFIX_EXTRACTOR_LENGTH {
         opts.set_prefix_same_as_start(true);
         opts.set_total_order_seek(false);
     } else {
```

**File**: `crates/partition-store/src/partition_db.rs` (modified, +16/-6)
```diff
@@ -652,6 +652,19 @@ impl CfConfigurator for RocksConfigurator<AllDataCf> {
             // for L6 240.4M entries, Ribbon=237.8MiB vs. Bloom=334.3MiB.
             block_options.set_hybrid_ribbon_filter(10.0, 6);
         }
+        // Without whole keys, point lookups check the prefix filter (see the prefix extractor
+        // below), which already tells apart the invocations and vqueues sharing a partition key.
+        // On an 18.7M-invocation partition store (330.7M keys), the filters in the SST files added
+        // up to 39.4 MiB with whole keys and no L6 filters, 320.2 MiB with whole keys and L6
+        // filters, and 74.8 MiB with L6 filters and no whole keys. These are sizes on disk and an
+        // upper bound for the block cache, which only holds the filters of L0 files (pinned) and
+        // the ones that reads, flushes and compactions loaded. L6 filters without whole keys make
+        // cold lookups of missing invocations 100x faster than the v1.7 layout (2.7 vs 268 µs),
+        // but only once files written with the fixed 10-byte extractor are gone: they give point
+        // lookups no filter at all without whole keys (512 vs 268 µs).
+        // TODO(v1.9): always disable whole-key filtering and enable L6 filters by default.
+        let whole_key_filtering = !config.rocksdb_disable_whole_key_filtering;
+        block_options.set_whole_key_filtering(whole_key_filtering);
 
         cf_options.set_block_based_table_factory(&block_options);
         cf_options.set_merge_operator(
@@ -677,13 +690,10 @@ impl CfConfigurator for RocksConfigurator<AllDataCf> {
             );
         }
 
-        // Actually, we would love to use CappedPrefixExtractor but unfortunately it's neither exposed
-        // in the C API nor the rust binding. That's okay and we can change it later.
-        cf_options.set_prefix_extractor(rocksdb::SliceTransform::create_fixed_prefix(
-            crate::DB_PREFIX_LENGTH,
-        ));
+        // Keys shorter than the cap are their own prefix, so every key is in the extractor's domain.
+        cf_options.set_capped_prefix_extractor(crate::PREFIX_EXTRACTOR_LENGTH);
         cf_options.set_memtable_prefix_bloom_ratio(0.2);
-        cf_options.set_memtable_whole_key_filtering(true);
+        cf_options.set_memtable_whole_key_filtering(whole_key_filtering);
 
         cf_options.set_num_levels(7);
         let l0_l1 = if config.rocksdb.rocksdb_disable_l0_l1_compression() {
```

**File**: `crates/partition-store/src/partition_store.rs` (modified, +16/-3)
```diff
@@ -67,13 +67,26 @@ use crate::{configure_prefix_iterator_opts, configure_range_iterator_opts};
 
 pub type DB = rocksdb::DB;
 
-// Key prefix is 10 bytes (KeyKind(2) + PartitionKey/Id(8))
+// Key kind and partition key are 10 bytes (KeyKind(2) + PartitionKey/Id(8))
 pub(crate) const DB_PREFIX_LENGTH: usize =
     KeyKind::SERIALIZED_LENGTH + std::mem::size_of::<PartitionKey>();
 
 // If this changes, we need to know.
 const_assert_eq!(DB_PREFIX_LENGTH, 10);
 
+/// Length of the capped prefix extractor of partition-store column families: the key kind, the
+/// partition key and up to 10 more bytes, which tell apart the invocations and vqueues sharing a
+/// partition key. Keys shorter than this are their own prefix, so prefix seeks need prefixes of at
+/// least this length.
+///
+/// 20 bytes also cover the timestamp and 4 random bytes of ULID-based ids, and the sequence number
+/// of canonical entry ids. On an 18.7M-invocation partition store, it halved the block reads of
+/// cold journal scans on busy partition keys compared to 10 bytes (1.41 vs 2.72), for filters as
+/// large as with 13 bytes and 7% smaller than with 26 bytes. Shorter scans lose their filter:
+/// whole partition keys (2.39 vs 1.70 block reads) and the state of objects whose service name and
+/// key add up to less than 7 bytes (510 vs 13 µs).
+pub(crate) const PREFIX_EXTRACTOR_LENGTH: usize = 20;
+
 /// An internal representation of PartitionId that pads the underlying u16 into u64 to align with
 /// partition-key length. This should only be used as a replacement to PartitionId when
 /// compatibility with old u64-sized PartitionId is needed. Additionally. This must be aligned with
@@ -949,8 +962,8 @@ impl ScanMode {
         S: AsRef<[u8]>,
         E: AsRef<[u8]>,
     {
-        let start_prefix = start.as_ref().first_chunk::<DB_PREFIX_LENGTH>();
-        let end_prefix = end.as_ref().first_chunk::<DB_PREFIX_LENGTH>();
+        let start_prefix = start.as_ref().first_chunk::<PREFIX_EXTRACTOR_LENGTH>();
+        let end_prefix = end.as_ref().first_chunk::<PREFIX_EXTRACTOR_LENGTH>();
 
         if start_prefix.is_some() && start_prefix == end_prefix {
             ScanMode::WithinPrefix
```

**File**: `crates/partition-store/src/scan.rs` (modified, +14/-5)
```diff
@@ -114,7 +114,8 @@ mod tests {
     use crate::scan::{PhysicalScan, TableScan};
     use crate::{DB_PREFIX_LENGTH, ScanMode, TableKind, convert_to_upper_bound};
 
-    struct TestKey(u64, u64);
+    /// Same layout as invocation status keys: partition key and a 16 bytes id
+    struct TestKey(u64, u128);
 
     impl EncodeTableKey for TestKey {
         const TABLE: TableKind = TableKind::InvocationStatus;
@@ -123,11 +124,11 @@ mod tests {
         fn serialize_to<B: BufMut>(&self, bytes: &mut B) {
             Self::KEY_KIND.serialize(bytes);
             bytes.put_u64(self.0);
-            bytes.put_u64(self.1);
+            bytes.put_u128(self.1);
         }
 
         fn serialized_length(&self) -> usize {
-            KeyKind::SERIALIZED_LENGTH + std::mem::size_of::<u64>() * 2
+            KeyKind::SERIALIZED_LENGTH + std::mem::size_of::<u64>() + std::mem::size_of::<u128>()
         }
     }
 
@@ -220,14 +221,22 @@ mod tests {
         assert_eq!(
             scan_mode(TableScan::RangeInclusive(
                 TestKey(1, 0),
-                TestKey(1, u64::MAX),
+                TestKey(1, u128::MAX),
+            )),
+            ScanMode::TotalOrder
+        );
+        // Same partition key, but the ids differ within the prefix extractor length
+        assert_eq!(
+            scan_mode(TableScan::RangeInclusive(
+                TestKey(1, 0),
+                TestKey(1, 1 << 64)
             )),
             ScanMode::TotalOrder
         );
     }
 
     #[test]
-    fn single_partition_inclusive_key_range_stays_within_prefix() {
+    fn inclusive_key_range_sharing_extractor_prefix_stays_within_prefix() {
         assert_eq!(
             scan_mode(TableScan::RangeInclusive(TestKey(1, 0), TestKey(1, 9))),
             ScanMode::WithinPrefix
```

**File**: `crates/types/src/config/worker.rs` (modified, +21/-0)
```diff
@@ -835,13 +835,33 @@ pub struct StorageOptions {
     /// Build Ribbon filters for L6 SST files to avoid unnecessary reads for missing keys.
     /// Other levels continue to use Bloom filters. Disabled by default.
     ///
+    /// L6 holds most of the keys, so these filters are about 4x smaller with
+    /// `rocksdb-disable-whole-key-filtering` set.
+    ///
     /// Takes effect when partition stores are opened and applies to newly generated SST files.
     ///
     /// Since v1.8.0
     #[cfg_attr(feature = "schemars", schemars(skip))]
     #[serde(skip_serializing_if = "std::ops::Not::not", default)]
     pub rocksdb_enable_l6_filters: bool,
 
+    /// # Disable whole-key filtering
+    ///
+    /// Build partition-store filters from key prefixes only, instead of prefixes and whole keys.
+    /// Filters get much smaller and point lookups still use the prefix filters. Files written
+    /// before v1.8 have no usable prefix filters for point lookups, so only set this once
+    /// compaction has rewritten them.
+    ///
+    /// Takes effect when partition stores are opened and applies to newly generated SST files.
+    ///
+    /// Temporary: this option will be removed in v1.9.0 (or earlier), when disabling whole-key
+    /// filtering becomes the default.
+    ///
+    /// Since v1.8.0
+    #[cfg_attr(feature = "schemars", schemars(skip))]
+    #[serde(skip_serializing_if = "std::ops::Not::not", default)]
+    pub rocksdb_disable_whole_key_filtering: bool,
+
     /// # Disable compact-on-deletion collector
     ///
     /// When set to `true`, disables RocksDB's CompactOnDeletionCollector for partition stores.
@@ -1117,6 +1137,7 @@ impl Default for StorageOptions {
             rocksdb_memory_ratio: 0.49,
             always_commit_in_background: false,
             rocksdb_enable_l6_filters: false,
+            rocksdb_disable_whole_key_filtering: false,
             rocksdb_disable_compact_on_deletion: false,
             rocksdb_compact_on_deletions_window: serde_helpers::default_compact_on_deletions_window(
             ),
```

**File**: `release-notes/unreleased/partition-store-prefix-filters.md` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+# Release Notes: More selective partition-store filters
+
+## Behavioral Change
+
+### What Changed
+
+Partition stores now build their filters per invocation and per queue instead of per partition
+key. Two new options in `worker.storage` let you shrink the filters and extend them to the
+largest (last) storage level:
+
+- `rocksdb-disable-whole-key-filtering`: build filters from key prefixes only. Defaults to
+  `false`.
+- `rocksdb-enable-l6-filters`: also build filters for the largest level. Defaults to `false`.
+
+Restate v1.9 is planned to enable both by default and to remove
+`rocksdb-disable-whole-key-filtering`.
+
+### Why This Matters
+
+Reading an invocation's journal or a queue's contents now skips more files that cannot contain
+the requested data.
+
+With both options enabled, lookups of data that does not exist, such as invocation ids that were
+never created or are already purged, usually no longer read from disk. The filters also take far
+less memory than whole-key filters on every level would.
+
+### Impact on Users
+
+- No configuration changes are needed. Point lookups keep their current performance and filter
+  memory stays about the same.
+- `rocksdb-enable-l6-filters` alone increases filter memory considerably. Combine it with
+  `rocksdb-disable-whole-key-filtering` to keep filters small.
+- Setting `rocksdb-disable-whole-key-filtering` right after upgrading makes lookups of missing
+  data slower, and it stays that way until background compaction has rewritten the files
+  written before the upgrade.
+
+### Migration Guidance
+
+No action is required. To opt into the planned v1.9 defaults, wait until the node has run this
+version for a while, then set:
+
+```toml
+[worker.storage]
+rocksdb-disable-whole-key-filtering = true
+rocksdb-enable-l6-filters = true
+```
+
+These options are applied when a partition store is opened, so a change takes effect after a node
+restart and applies to newly written files.
```

---

### Incident Patch 7: `fab053bb` (2026-09-30)
**Commit Message**: [UI] Updating Restate UI to v1.0.32 published at https://github.com/restatedev/restate-web-ui/releases/download/v1.0.32/ui-v1.0.32.zip (#5451)

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -9127,8 +9127,8 @@ dependencies = [
 
 [[package]]
 name = "restate-web-ui"
-version = "1.0.31"
-source = "git+https://github.com/restatedev/restate-web-ui-crate?tag=v1.0.31#6afd67d81b257be50cd504ff1cbf31248e434187"
+version = "1.0.32"
+source = "git+https://github.com/restatedev/restate-web-ui-crate?tag=v1.0.32#e9a1d8bba5daa16edf828c86011d53a1daae6d65"
 dependencies = [
  "anyhow",
  "include_dir",
```

**File**: `crates/admin/Cargo.toml` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ restate-util-time = { workspace = true }
 restate-types = { workspace = true }
 restate-util-string = { workspace = true }
 restate-wal-protocol = { workspace = true }
-restate-web-ui = { git = "https://github.com/restatedev/restate-web-ui-crate", optional = true, version = "1.0.31", tag = "v1.0.31" }
+restate-web-ui = { git = "https://github.com/restatedev/restate-web-ui-crate", optional = true, version = "1.0.32", tag = "v1.0.32" }
 
 ahash = { workspace = true }
 anyhow = { workspace = true }
```

---

### Incident Patch 8: `bcb140f8` (2026-09-28)
**Commit Message**: [CLI] Check in the SQL tables reference instead of generating it in build.rs (#5435)

The CLI build script depended on restate-storage-query-datafusion to embed
the SQL introspection reference. That pulled restate-core (and RocksDB,
DataFusion, ...) into the host build, where restate-core enables
tokio/taskdump but, when cross-compiling with --target, the per-target
rustflags (`--cfg tokio_unstable`) don't apply to host artifacts. This broke
the cross-compiled arm64 Docker build.

The reference is now generated with `cargo xtask generate-cli-sql-tables`
into cli/src/commands/sql_tables.rs and checked in; a dedicated CI job
verifies it is up-to-date.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +22/-0)
```diff
@@ -31,6 +31,28 @@ jobs:
         run: cargo hakari generate --diff
       - name: Check all crates depend on workspace-hack
         run: cargo hakari manage-deps --dry-run
+  cli-sql-tables-check:
+    name: Check CLI SQL tables reference
+    runs-on: warp-ubuntu-latest-x64-4x
+    steps:
+      - uses: actions/checkout@v4
+      - name: Install Rust toolchain
+        uses: actions-rust-lang/setup-rust-toolchain@v1
+        with:
+          rustflags: ""
+          cache: false
+      - name: Setup Rust Caching
+        uses: WarpBuilds/rust-cache@v2 # a fork of Swatinem/rust-cache@v2 that uses warpbuild cache
+        with:
+          prefix-key: "v1-rust-xtask"
+          cache-on-failure: "true"
+      - name: Install protoc
+        uses: ./.github/actions/install-protoc
+      - name: Check cli/src/commands/sql_tables.rs is up-to-date
+        run: |
+          cargo xtask generate-cli-sql-tables > cli/src/commands/sql_tables.rs
+          git diff --exit-code cli/src/commands/sql_tables.rs || \
+            (echo "::error::cli/src/commands/sql_tables.rs is stale, run: cargo xtask generate-cli-sql-tables > cli/src/commands/sql_tables.rs" && exit 1)
   build-and-test:
     name: Build and test (${{ matrix.os }})
     runs-on: ${{ matrix.os }}
```

**File**: `Cargo.lock` (modified, +0/-1)
```diff
@@ -7629,7 +7629,6 @@ dependencies = [
  "restate-limiter",
  "restate-lite",
  "restate-serde-util",
- "restate-storage-query-datafusion",
  "restate-types",
  "restate-util-string",
  "restate-util-time",
```

**File**: `cli/Cargo.toml` (modified, +0/-1)
```diff
@@ -95,7 +95,6 @@ zip = { version = "8.0" }
 restate-cli-util = { workspace = true, features = ["test-util"] }
 
 [build-dependencies]
-restate-storage-query-datafusion = { workspace = true, features = ["table_docs"] }
 vergen-gitcl = { workspace = true }
 
 [lib]
```

**File**: `cli/build.rs` (modified, +0/-59)
```diff
@@ -9,66 +9,9 @@
 // by the Apache License, Version 2.0.
 
 use std::error::Error;
-use std::fmt::Write as _;
-use std::path::Path;
-use std::{env, fs};
 
 use vergen_gitcl::{Build, Cargo, Emitter, Gitcl};
 
-use restate_storage_query_datafusion::table_docs::all_table_docs;
-
-/// Generates `$OUT_DIR/sql_tables.rs`, an embedded reference of the SQL
-/// introspection tables consumed by the `restate sql` command. The reference is
-/// built from the same source of truth that produces the online SQL docs.
-fn generate_sql_tables_reference() -> Result<(), Box<dyn Error>> {
-    let out_dir = env::var("OUT_DIR")?;
-    let dest = Path::new(&out_dir).join("sql_tables.rs");
-
-    let tables = all_table_docs();
-
-    let mut out = String::new();
-    out.push_str(
-        "pub struct SqlColumnDoc { pub name: &'static str, pub ty: &'static str, pub description: &'static str }\n\
-         pub struct SqlTableDoc { pub name: &'static str, pub description: &'static str, pub columns: &'static [SqlColumnDoc] }\n\n",
-    );
-
-    out.push_str("pub static SQL_TABLES: &[SqlTableDoc] = &[\n");
-    for table in &tables {
-        writeln!(
-            out,
-            "    SqlTableDoc {{ name: {:?}, description: {:?}, columns: &[",
-            table.name.as_ref(),
-            table.description.as_ref().trim(),
-        )?;
-        for column in &table.columns {
-            writeln!(
-                out,
-                "        SqlColumnDoc {{ name: {:?}, ty: {:?}, description: {:?} }},",
-                column.name,
-                column.column_type,
-                column.description.trim(),
-            )?;
-        }
-        out.push_str("    ] },\n");
-    }
-    out.push_str("];\n\n");
-
-    // Condensed table list shown in `restate sql --help`.
-    let names = tables
-        .iter()
-        .map(|t| t.name.as_ref())
-        .collect::<Vec<_>>()
-        .join(", ");
-    let help = format!(
-        "Queryable introspection tables:\n  {names}\n\nRun `restate sql describe <table>` for a \
-         table's columns."
-    );
-    writeln!(out, "pub static SQL_TABLES_HELP: &str = {help:?};")?;
-
-    fs::write(&dest, out)?;
-    Ok(())
-}
-
 fn main() -> Result<(), Box<dyn Error>> {
     let cargo = Cargo::builder()
         .features(true)
@@ -88,7 +31,5 @@ fn main() -> Result<(), Box<dyn Error>> {
         .add_instructions(&git)?
         .emit()?;
 
-    generate_sql_tables_reference()?;
-
     Ok(())
 }
```

**File**: `cli/src/commands/sql.rs` (modified, +6/-2)
```diff
@@ -32,9 +32,13 @@ use restate_cli_util::ui::watcher::Watch;
 use crate::cli_env::CliEnv;
 use crate::ui::fmt::{Field, Formatter, OutputFormatter};
 
-// Embedded SQL introspection reference generated by `build.rs`.
+// Embedded SQL introspection reference, generated by `cargo xtask generate-cli-sql-tables`.
 // Defines `SqlColumnDoc`, `SqlTableDoc`, `SQL_TABLES` and `SQL_TABLES_HELP`.
-include!(concat!(env!("OUT_DIR"), "/sql_tables.rs"));
+// TODO: checking in a generated file is a stopgap. Generating it in `build.rs` would need
+//  restate-storage-query-datafusion as a build-dependency, which drags restate-core into the host
+//  build (breaks cross-compilation, see restate-core's tokio/taskdump). Consider splitting the
+//  table schemas/docs into a lightweight crate the CLI can depend on directly.
+include!("sql_tables.rs");
 
 #[derive(Parser, Collect, Clone)]
 #[command(args_conflicts_with_subcommands = true)]
```

**File**: `cli/src/commands/sql_tables.rs` (added, +271/-0)
```diff
@@ -0,0 +1,271 @@
+// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.
+// All rights reserved.
+//
+// Use of this software is governed by the Business Source License
+// included in the LICENSE file.
+//
+// As of the Change Date specified in that file, in accordance with
+// the Business Source License, use of this software will be governed
+// by the Apache License, Version 2.0.
+
+// @generated by `cargo xtask generate-cli-sql-tables`. Do not edit manually.
+
+pub struct SqlColumnDoc { pub name: &'static str, pub ty: &'static str, pub description: &'static str }
+pub struct SqlTableDoc { pub name: &'static str, pub description: &'static str, pub columns: &'static [SqlColumnDoc] }
+
+pub static SQL_TABLES: &[SqlTableDoc] = &[
+    SqlTableDoc { name: "sys_deployment", description: "", columns: &[
+        SqlColumnDoc { name: "id", ty: "Utf8", description: "The ID of the service deployment." },
+        SqlColumnDoc { name: "ty", ty: "Utf8", description: "The type of the endpoint. Either `http` or `lambda`." },
+        SqlColumnDoc { name: "endpoint", ty: "Utf8", description: "The address of the endpoint. Either HTTP URL or Lambda ARN." },
+        SqlColumnDoc { name: "created_at", ty: "TimestampMillisecond", description: "Timestamp indicating the deployment registration time." },
+        SqlColumnDoc { name: "min_service_protocol_version", ty: "UInt32", description: "Minimum supported protocol version." },
+        SqlColumnDoc { name: "max_service_protocol_version", ty: "UInt32", description: "Maximum supported protocol version." },
+        SqlColumnDoc { name: "services", ty: "Utf8 List", description: "List of service names registered by this deployment." },
+    ] },
+    SqlTableDoc { name: "sys_inbox", description: "", columns: &[
+        SqlColumnDoc { name: "partition_key", ty: "UInt64", description: "Internal column that is used for partitioning the services invocations. Can be ignored." },
+        SqlColumnDoc { name: "service_name", ty: "Utf8", description: "The name of the invoked virtual object/workflow." },
+        SqlColumnDoc { name: "service_key", ty: "Utf8", description: "The key of the virtual object/workflow." },
+        SqlColumnDoc { name: "id", ty: "Utf8", description: "[Invocation ID](/services/invocation/managing-invocations#invocation-id)." },
+        SqlColumnDoc { name: "sequence_number", ty: "UInt64", description: "Sequence number in the inbox." },
+        SqlColumnDoc { name: "created_at", ty: "TimestampMillisecond", description: "Timestamp indicating the start of this invocation. DEPRECATED: you should not use this field anymore, but join with the sys_invocation table" },
+    ] },
+    SqlTableDoc { name: "sys_journal", description: "", columns: &[
+        SqlColumnDoc { name: "partition_key", ty: "UInt64", description: "Internal column that is used for partitioning the services invocations. Can be ignored." },
+        SqlColumnDoc { name: "id", ty: "Utf8", description: "[Invocation ID](/services/invocation/managing-invocations#invocation-id)." },
+        SqlColumnDoc { name: "index", ty: "UInt32", description: "The index of this journal entry." },
+        SqlColumnDoc { name: "entry_type", ty: "Utf8", description: "The entry type. You can check all the available entry types in [`entries.rs`](https://github.com/restatedev/restate/blob/main/crates/types/src/journal/entries.rs)." },
+        SqlColumnDoc { name: "name", ty: "Utf8", description: "The name of the entry supplied by the user, if any." },
+        SqlColumnDoc { name: "completed", ty: "Boolean", description: "Indicates whether this journal entry has been completed; this is only valid for some entry types." },
+        SqlColumnDoc { name: "invoked_id", ty: "Utf8", description: "If this entry represents an outbound invocation, indicates the ID of that invocation." },
+        SqlColumnDoc { name: "invoked_target", ty: "Utf8", description: "If this entry represents an outbound invocation, indicates the invocation Target. Format for plain services: `ServiceName/HandlerName`, e.g. `Greeter/greet`. Format for virtual objects/workflows: `VirtualObjectName/Key/HandlerName`, e.g. `Greeter/Francesco/greet`." },
+        SqlColumnDoc { name: "sleep_wakeup_at", ty: "TimestampMillisecond", description: "If this entry represents a sleep, indicates wakeup time." },
+        SqlColumnDoc { name: "promise_name", ty: "Utf8", description: "If this entry is a promise related entry (GetPromise, PeekPromise, CompletePromise), indicates the promise name." },
+        SqlColumnDoc { name: "raw", ty: "Binary", description: "Raw binary representation of the entry. Check the [service protocol](https://github.com/restatedev/service-protocol) for more details to decode it." },
+        SqlColumnDoc { name: "raw_length", ty: "UInt64", description: "The byte length of the raw entry. If you are writing a query that only needs to know the length, reading this field will be much more efficient than reading length(ra
```

**File**: `crates/storage-query-datafusion/src/table_docs.rs` (modified, +58/-1)
```diff
@@ -8,12 +8,14 @@
 // the Business Source License, use of this software will be governed
 // by the Apache License, Version 2.0.
 
+use std::borrow::Cow;
+use std::fmt::Write as _;
+
 use crate::{
     deployment, inbox, invocation_state, invocation_status, journal, journal_events, promise,
     rules, scheduler_status, service, state, user_limits, vqueue_entry_status, vqueue_meta,
     vqueues,
 };
-use std::borrow::Cow;
 
 /// List of available table docs. Whenever you add a new table, add its table docs to
 /// this array. This will ensure that the table docs will be included in the automatic
@@ -290,3 +292,58 @@ pub fn sys_invocation_table_docs() -> OwnedTableDocs {
         columns,
     }
 }
+
+/// Renders the SQL introspection reference embedded in the CLI
+/// (`cli/src/commands/sql_tables.rs`), regenerated with
+/// `cargo xtask generate-cli-sql-tables > cli/src/commands/sql_tables.rs`.
+pub fn render_cli_sql_tables() -> String {
+    let tables = all_table_docs();
+
+    let mut out = String::from(
+        "// Copyright (c) 2023 - 2026 Restate Software, Inc., Restate GmbH.\n\
+         // All rights reserved.\n\
+         //\n\
+         // Use of this software is governed by the Business Source License\n\
+         // included in the LICENSE file.\n\
+         //\n\
+         // As of the Change Date specified in that file, in accordance with\n\
+         // the Business Source License, use of this software will be governed\n\
+         // by the Apache License, Version 2.0.\n\n\
+         // @generated by `cargo xtask generate-cli-sql-tables`. Do not edit manually.\n\n\
+         pub struct SqlColumnDoc { pub name: &'static str, pub ty: &'static str, pub description: &'static str }\n\
+         pub struct SqlTableDoc { pub name: &'static str, pub description: &'static str, pub columns: &'static [SqlColumnDoc] }\n\n\
+         pub static SQL_TABLES: &[SqlTableDoc] = &[\n",
+    );
+    for table in &tables {
+        let _ = writeln!(
+            out,
+            "    SqlTableDoc {{ name: {:?}, description: {:?}, columns: &[",
+            table.name.as_ref(),
+            table.description.as_ref().trim(),
+        );
+        for column in &table.columns {
+            let _ = writeln!(
+                out,
+                "        SqlColumnDoc {{ name: {:?}, ty: {:?}, description: {:?} }},",
+                column.name,
+                column.column_type,
+                column.description.trim(),
+            );
+        }
+        out.push_str("    ] },\n");
+    }
+    out.push_str("];\n\n");
+
+    // Condensed table list shown in `restate sql --help`.
+    let names = tables
+        .iter()
+        .map(|t| t.name.as_ref())
+        .collect::<Vec<_>>()
+        .join(", ");
+    let help = format!(
+        "Queryable introspection tables:\n  {names}\n\nRun `restate sql describe <table>` for a \
+         table's columns."
+    );
+    let _ = writeln!(out, "pub static SQL_TABLES_HELP: &str = {help:?};");
+    out
+}
```

**File**: `tools/xtask/src/main.rs` (modified, +2/-0)
```diff
@@ -209,6 +209,7 @@ Tasks:
     generate-default-config: Generate default configuration.
     generate-rest-api-doc: Generate Rest API documentation. Make sure to have the port 8081 open.
     generate-table-docs: Generate default configuration.
+    generate-cli-sql-tables: Generate the SQL introspection reference embedded in the CLI.
 "
     );
 }
@@ -232,6 +233,7 @@ async fn main() -> anyhow::Result<()> {
                     .await?
             }
             "generate-table-docs" => generate_table_docs()?,
+            "generate-cli-sql-tables" => print!("{}", table_docs::render_cli_sql_tables()),
             invalid => {
                 print_help();
                 bail!("Invalid task name: {}", invalid)
```

---

### Incident Patch 9: `b35b1faa` (2026-09-24)
**Commit Message**: [UI] Updating Restate UI to v1.0.31 published at https://github.com/restatedev/restate-web-ui/releases/download/v1.0.31/ui-v1.0.31.zip (#5415)

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -9158,8 +9158,8 @@ dependencies = [
 
 [[package]]
 name = "restate-web-ui"
-version = "1.0.29"
-source = "git+https://github.com/restatedev/restate-web-ui-crate?tag=v1.0.29#46695a0e3829488afafbf200f26e416fdbcd5836"
+version = "1.0.31"
+source = "git+https://github.com/restatedev/restate-web-ui-crate?tag=v1.0.31#6afd67d81b257be50cd504ff1cbf31248e434187"
 dependencies = [
  "anyhow",
  "include_dir",
```

**File**: `crates/admin/Cargo.toml` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ restate-util-time = { workspace = true }
 restate-types = { workspace = true }
 restate-util-string = { workspace = true }
 restate-wal-protocol = { workspace = true }
-restate-web-ui = { git = "https://github.com/restatedev/restate-web-ui-crate", optional = true, version = "1.0.29", tag = "v1.0.29" }
+restate-web-ui = { git = "https://github.com/restatedev/restate-web-ui-crate", optional = true, version = "1.0.31", tag = "v1.0.31" }
 
 ahash = { workspace = true }
 anyhow = { workspace = true }
```

---

### Incident Patch 10: `8091e07f` (2026-09-24)
**Commit Message**: [ci] Use release-lite for docker builds on pull requests (#5412)

For faster feedbacks on PR, the docker image that runs the tests will use `release-lite` instead of the release profile. CI runs on main will still use `release` though.

**File**: `.github/workflows/ci.yml` (modified, +2/-0)
```diff
@@ -129,6 +129,8 @@ jobs:
       platforms: linux/amd64
       # additional features added for CI validation builds only
       features: metadata-api
+      # faster-linking profile for PRs; main and release builds keep `release` (and its image tags)
+      profile: ${{ github.event_name == 'pull_request' && 'release-lite' || 'release' }}
 
   sdk-java:
     name: Run SDK-Java integration tests
```

---

### Incident Patch 11: `3ac6a87a` (2026-09-24)
**Commit Message**: Tolerate missing git metadata in vergen build scripts

vergen-gitcl 10 no longer emits placeholder `VERGEN_GIT_*` values when the
source tree has no git repository, which broke `env!()` in the `build_info`
modules for Sapling checkouts and tarballs. Set `VERGEN_DEFAULT_ON_ERROR` in
`.cargo/config.toml` to restore the vergen 8 fallback. Builds with git
metadata available are unaffected.

**File**: `.cargo/config.toml` (modified, +3/-0)
```diff
@@ -1,5 +1,8 @@
 [env]
 RUST_TEST_THREADS = "1"
+# Fall back to placeholder VERGEN_GIT_* values when the source tree has no git
+# metadata (e.g. Sapling checkouts, tarballs) instead of failing the build.
+VERGEN_DEFAULT_ON_ERROR = "1"
 
 [alias]
 xtask = "run --package xtask --"
```

---

### Incident Patch 12: `3b8d213c` (2026-09-18)
**Commit Message**: Upgrade build metadata generation to vergen-gitcl 10

**File**: `Cargo.lock` (modified, +60/-34)
```diff
@@ -1351,6 +1351,29 @@ dependencies = [
  "objc2",
 ]
 
+[[package]]
+name = "bon"
+version = "3.10.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "60eafe0d77c3a2fc292c1d1346c3041b33c0a108085a2afabf672b70f69dbbc9"
+dependencies = [
+ "bon-macros",
+]
+
+[[package]]
+name = "bon-macros"
+version = "3.10.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "bd0f9631d8aaaee112c41985d675ef269e02acbd4f33122836af4f0c5f699ff6"
+dependencies = [
+ "darling 0.24.1",
+ "ident_case",
+ "prettyplease 0.3.0",
+ "proc-macro2",
+ "quote",
+ "syn 3.0.6",
+]
+
 [[package]]
 name = "borrow-or-share"
 version = "0.2.4"
@@ -1484,15 +1507,6 @@ dependencies = [
  "serde_core",
 ]
 
-[[package]]
-name = "cargo-platform"
-version = "0.1.9"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e35af189006b9c0f00a064685c727031e3ed2d8020f7ba284d78cc2671bd36ea"
-dependencies = [
- "serde",
-]
-
 [[package]]
 name = "cargo-platform"
 version = "0.3.3"
@@ -1503,28 +1517,14 @@ dependencies = [
  "serde_core",
 ]
 
-[[package]]
-name = "cargo_metadata"
-version = "0.18.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2d886547e41f740c616ae73108f6eb70afe6d940c7bc697cb30f13daec073037"
-dependencies = [
- "camino",
- "cargo-platform 0.1.9",
- "semver",
- "serde",
- "serde_json",
- "thiserror 1.0.69",
-]
-
 [[package]]
 name = "cargo_metadata"
 version = "0.23.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ef987d17b0a113becdd19d3d0022d04d7ef41f9efe4f3fb63ac44ba61df3ade9"
 dependencies = [
  "camino",
- "cargo-platform 0.3.3",
+ "cargo-platform",
  "semver",
  "serde",
  "serde_json",
@@ -6035,7 +6035,7 @@ dependencies = [
  "arc-swap",
  "base64 0.22.1",
  "bytes",
- "cargo_metadata 0.23.1",
+ "cargo_metadata",
  "cfg-if",
  "chrono",
  "futures",
@@ -7680,7 +7680,7 @@ dependencies = [
  "tower",
  "tracing",
  "url",
- "vergen",
+ "vergen-gitcl",
  "zip",
 ]
 
@@ -7877,7 +7877,7 @@ dependencies = [
  "tracing-subscriber",
  "ulid",
  "url",
- "vergen",
+ "vergen-gitcl",
 ]
 
 [[package]]
@@ -8157,7 +8157,7 @@ dependencies = [
  "tokio",
  "tracing",
  "tracing-subscriber",
- "vergen",
+ "vergen-gitcl",
 ]
 
 [[package]]
@@ -8642,7 +8642,7 @@ dependencies = [
  "tracing-subscriber",
  "ulid",
  "url",
- "vergen",
+ "vergen-gitcl",
 ]
 
 [[package]]
@@ -9474,7 +9474,7 @@ dependencies = [
  "toml 1.1.6+spec-1.1.0",
  "tonic",
  "tracing",
- "vergen",
+ "vergen-gitcl",
 ]
 
 [[package]]
@@ -11570,16 +11570,42 @@ checksum = "accd4ea62f7bb7a82fe23066fb0957d48ef677f6eeb8215f372f52e48bb32426"
 
 [[package]]
 name = "vergen"
-version = "8.3.2"
+version = "10.0.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2990d9ea5967266ea0ccf413a4aa5c42a93dbcfda9cb49a97de6931726b12566"
+checksum = "d7081a999aada4e01c8ee04d32254e021e317dd051a250169305fbf2acf21824"
 dependencies = [
  "anyhow",
- "cargo_metadata 0.18.1",
- "cfg-if",
+ "bon",
+ "cargo_metadata",
  "regex",
  "rustversion",
  "time",
+ "vergen-lib",
+]
+
+[[package]]
+name = "vergen-gitcl"
+version = "10.0.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "55d813ef078c9e739ebe9a121b8319964e1a03cc9e3d2fe30c6cf812d4c57289"
+dependencies = [
+ "anyhow",
+ "bon",
+ "rustversion",
+ "time",
+ "vergen",
+ "vergen-lib",
+]
+
+[[package]]
+name = "vergen-lib"
+version = "10.0.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1343066736be577e40cf72914ecd68b369f7033ce0f7db6b25a6d6f7fbb3ed70"
+dependencies = [
+ "anyhow",
+ "bon",
+ "rustversion",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -294,7 +294,7 @@ urlencoding = { version = "2.1" }
 utoipa = { version = "5.4" }
 utoipa-axum = "0.2"
 uuid = { version = "1.19.0", features = ["v7", "serde"] }
-vergen = { version = "8.0.0", default-features = false }
+vergen-gitcl = { version = "10.0.3", default-features = false, features = ["build", "cargo", "cargo_metadata"] }
 wildmatch = "2.6.1"
 x509-parser = "0.18.1"
 xxhash-rust = { version = "0.8", features = ["xxh3"] }
```

**File**: `cli/Cargo.toml` (modified, +1/-6)
```diff
@@ -95,12 +95,7 @@ zip = { version = "8.0" }
 restate-cli-util = { workspace = true, features = ["test-util"] }
 
 [build-dependencies]
-vergen = { workspace = true, default-features = false, features = [
-    "build",
-    "git",
-    "gitcl",
-    "cargo",
-] }
+vergen-gitcl = { workspace = true }
 
 [lib]
 bench = false
```

**File**: `cli/build.rs` (modified, +18/-13)
```diff
@@ -9,21 +9,26 @@
 // by the Apache License, Version 2.0.
 
 use std::error::Error;
-use vergen::EmitBuilder;
+
+use vergen_gitcl::{Build, Cargo, Emitter, Gitcl};
 
 fn main() -> Result<(), Box<dyn Error>> {
-    // Emit the instructions
-    EmitBuilder::builder()
-        .build_date()
-        .build_timestamp()
-        .cargo_features()
-        .cargo_opt_level()
-        .cargo_target_triple()
-        .cargo_debug()
-        .git_branch()
-        .git_commit_date()
-        .git_commit_timestamp()
-        .git_sha(true)
+    let cargo = Cargo::builder()
+        .features(true)
+        .opt_level(true)
+        .target_triple(true)
+        .debug(true)
+        .build();
+    let git = Gitcl::builder()
+        .branch(true)
+        .commit_date(true)
+        .commit_timestamp(true)
+        .sha(true)
+        .build();
+    Emitter::default()
+        .add_instructions(&Build::all_build())?
+        .add_instructions(&cargo)?
+        .add_instructions(&git)?
         .emit()?;
     Ok(())
 }
```

**File**: `lite/Cargo.toml` (modified, +1/-6)
```diff
@@ -49,12 +49,7 @@ tempfile = { workspace = true }
 tikv-jemallocator = { workspace = true }
 
 [build-dependencies]
-vergen = { workspace = true, default-features = false, features = [
-    "build",
-    "git",
-    "gitcl",
-    "cargo",
-] }
+vergen-gitcl = { workspace = true }
 
 [lints]
 workspace = true
```

**File**: `lite/build.rs` (modified, +18/-13)
```diff
@@ -9,21 +9,26 @@
 // by the Apache License, Version 2.0.
 
 use std::error::Error;
-use vergen::EmitBuilder;
+
+use vergen_gitcl::{Build, Cargo, Emitter, Gitcl};
 
 fn main() -> Result<(), Box<dyn Error>> {
-    // Emit the instructions
-    EmitBuilder::builder()
-        .build_date()
-        .build_timestamp()
-        .cargo_features()
-        .cargo_opt_level()
-        .cargo_target_triple()
-        .cargo_debug()
-        .git_branch()
-        .git_commit_date()
-        .git_commit_timestamp()
-        .git_sha(true)
+    let cargo = Cargo::builder()
+        .features(true)
+        .opt_level(true)
+        .target_triple(true)
+        .debug(true)
+        .build();
+    let git = Gitcl::builder()
+        .branch(true)
+        .commit_date(true)
+        .commit_timestamp(true)
+        .sha(true)
+        .build();
+    Emitter::default()
+        .add_instructions(&Build::all_build())?
+        .add_instructions(&cargo)?
+        .add_instructions(&git)?
         .emit()?;
     Ok(())
 }
```

**File**: `server/Cargo.toml` (modified, +1/-6)
```diff
@@ -94,12 +94,7 @@ url = { workspace = true }
 tikv-jemallocator = { workspace = true }
 
 [build-dependencies]
-vergen = { workspace = true, default-features = false, features = [
-    "build",
-    "git",
-    "gitcl",
-    "cargo",
-] }
+vergen-gitcl = { workspace = true }
 
 [lints]
 workspace = true
```

**File**: `server/build.rs` (modified, +18/-13)
```diff
@@ -9,21 +9,26 @@
 // by the Apache License, Version 2.0.
 
 use std::error::Error;
-use vergen::EmitBuilder;
+
+use vergen_gitcl::{Build, Cargo, Emitter, Gitcl};
 
 fn main() -> Result<(), Box<dyn Error>> {
-    // Emit the instructions
-    EmitBuilder::builder()
-        .build_date()
-        .build_timestamp()
-        .cargo_features()
-        .cargo_opt_level()
-        .cargo_target_triple()
-        .cargo_debug()
-        .git_branch()
-        .git_commit_date()
-        .git_commit_timestamp()
-        .git_sha(true)
+    let cargo = Cargo::builder()
+        .features(true)
+        .opt_level(true)
+        .target_triple(true)
+        .debug(true)
+        .build();
+    let git = Gitcl::builder()
+        .branch(true)
+        .commit_date(true)
+        .commit_timestamp(true)
+        .sha(true)
+        .build();
+    Emitter::default()
+        .add_instructions(&Build::all_build())?
+        .add_instructions(&cargo)?
+        .add_instructions(&git)?
         .emit()?;
     Ok(())
 }
```

---

### Incident Patch 13: `23f49a04` (2026-09-18)
**Commit Message**: Upgrade CLI table rendering and line editing dependencies

**File**: `Cargo.lock` (modified, +37/-65)
```diff
@@ -272,7 +272,7 @@ dependencies = [
  "atoi",
  "base64 0.23.1",
  "chrono",
- "comfy-table",
+ "comfy-table 7.2.2",
  "half",
  "lexical-core",
  "num-traits",
@@ -463,7 +463,7 @@ dependencies = [
  "assert2-macros",
  "diff",
  "terminal_size",
- "unicode-width 0.2.2",
+ "unicode-width",
  "yansi",
 ]
 
@@ -1564,12 +1564,6 @@ version = "1.0.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4e7648175b45a9a48536d676f68d918270699102aa8dab5496df06904c914600"
 
-[[package]]
-name = "cfg_aliases"
-version = "0.1.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fd16c4719339c4530435d38e511904438d07cce7950afa3718a84ac36c10e89e"
-
 [[package]]
 name = "cfg_aliases"
 version = "0.2.2"
@@ -1832,10 +1826,20 @@ name = "comfy-table"
 version = "7.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "958c5d6ecf1f214b4c2bbbbf6ab9523a864bd136dcf71a7e8904799acfe1ad47"
+dependencies = [
+ "unicode-segmentation",
+ "unicode-width",
+]
+
+[[package]]
+name = "comfy-table"
+version = "8.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "136c8c4c3823846e8ba6d4bda011b4e5d5827b8bb0ac26c31f9ab31abe9f54f2"
 dependencies = [
  "crossterm",
  "unicode-segmentation",
- "unicode-width 0.2.2",
+ "unicode-width",
 ]
 
 [[package]]
@@ -1890,7 +1894,7 @@ checksum = "e96a4956774c13c126a8b5af4daa79384f4d826534c95a02d76afb39e2ab64e3"
 dependencies = [
  "encode_unicode",
  "libc",
- "unicode-width 0.2.2",
+ "unicode-width",
  "windows-sys 0.61.2",
 ]
 
@@ -2243,7 +2247,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "e0b1fab2ae45819af2d0731d60f2afe17227ebb1a1538a236da84c93e9a60162"
 dependencies = [
  "dispatch2",
- "nix 0.31.3",
+ "nix",
  "windows-sys 0.61.2",
 ]
 
@@ -3365,9 +3369,9 @@ checksum = "34aa73646ffb006b8f5147f3dc182bd4bcb190227ce861fc4a4844bf8e3cb2c0"
 
 [[package]]
 name = "endian-type"
-version = "0.1.2"
+version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c34f04666d835ff5d62e058c3995147c06f42fe86ff053337632bca83e42702d"
+checksum = "869b0adbda23651a9c5c0c3d270aac9fcb52e8622a8f2b17e57802d7791962f2"
 
 [[package]]
 name = "enum-map"
@@ -3552,17 +3556,6 @@ version = "2.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "da7c62ceae207dd37ea5b845da6a0696c799f85e97da1ab5b7910be3c1c80223"
 
-[[package]]
-name = "fd-lock"
-version = "4.0.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0ce92ff622d6dadf7349484f42c93271a0d49b7cc4d466a936405bacbe10aa78"
-dependencies = [
- "cfg-if",
- "rustix",
- "windows-sys 0.52.0",
-]
-
 [[package]]
 name = "figment"
 version = "0.10.19"
@@ -4595,7 +4588,7 @@ checksum = "9433806cd6b4ec1aba79c021c7e4c58fb4c3b9977c085062e611ac929998fb0c"
 dependencies = [
  "console",
  "portable-atomic",
- "unicode-width 0.2.2",
+ "unicode-width",
  "unit-prefix",
  "web-time",
 ]
@@ -5307,7 +5300,7 @@ dependencies = [
  "bytes",
  "clap",
  "codederror",
- "comfy-table",
+ "comfy-table 8.0.0",
  "hdrhistogram",
  "indexmap 2.14.2",
  "libc",
@@ -5668,18 +5661,6 @@ dependencies = [
  "smallvec",
 ]
 
-[[package]]
-name = "nix"
-version = "0.28.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ab2156c4fce2f8df6c499cc1c763e4394b7482525bf2a9701c9d79d215f519e4"
-dependencies = [
- "bitflags 2.13.2",
- "cfg-if",
- "cfg_aliases 0.1.1",
- "libc",
-]
-
 [[package]]
 name = "nix"
 version = "0.31.3"
@@ -5688,7 +5669,7 @@ checksum = "cf20d2fde8ff38632c426f1165ed7436270b44f199fc55284c38276f9db47c3d"
 dependencies = [
  "bitflags 2.13.2",
  "cfg-if",
- "cfg_aliases 0.2.2",
+ "cfg_aliases",
  "libc",
 ]
 
@@ -6009,7 +5990,7 @@ dependencies = [
  "hyper",
  "itertools 0.15.0",
  "md-5",
- "nix 0.31.3",
+ "nix",
  "parking_lot",
  "percent-encoding",
  "quick-xml",
@@ -6500,7 +6481,7 @@ dependencies = [
  "bytes",
  "clap",
  "codederror",
- "comfy-table",
+ "comfy-table 8.0.0",
  "hdrhistogram",
  "indexmap 2.14.2",
  "libc",
@@ -6968,7 +6949,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4051e23e9185c255a7e33ef59cdbca87a22d359052eecd22fc6b901fb37d9d11"
 dependencies = [
  "bytes",
- "cfg_aliases 0.2.2",
+ "cfg_aliases",
  "pin-project-lite",
  "quinn-proto",
  "quinn-udp",
@@ -7010,7 +6991,7 @@ version = "0.5.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "35a133f956daabe89a61a685c2649f13d82d5aa4bd5d12d1277e1072a21c0694"
 dependencies = [
- "cfg_aliases 0.2.2",
+ "cfg_aliases",
  "libc",
  "once_cell",
  "socket2",
@@ -7047,9 +7028,9 @@ checksum = "dc33ff2d4973d518d823d61aa239014831e521c75da58e3df4840d3f47749d09"
 
 [[package]]
 name = "radix_trie"
-version = "0.2.1"
+version = "0.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c069c179fcdc6a2fe24d8d18305cf085fdbd4f922c041943e203685d6a1c58fd"
+checksum = "3b4431027dcd37fc2a73ef
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -140,7 +140,7 @@ clap = { version = "4", default-features = false }
 clap-verbosity-flag = { version = "3.0.4" }
 clap_complete = { version = "4.5" }
 cling = { version = "0.1.3", default-features = false, features = ["derive"] }
-comfy-table = { version = "7.2.1" }
+comfy-table = { version = "8.0.0" }
 compact_str = { version = "0.10.0", default-features = false }
 const_format = "0.2.35"
 criterion = "0.8.2"
@@ -239,7 +239,7 @@ rocksdb = { version = "0.51.1", package = "rust-rocksdb", features = [
 ], git = "https://github.com/restatedev/rust-rocksdb", rev = "5df796cd539c15cec10f5c3c0d9dff1b4fbc6e42" }
 rstest = "0.27.0"
 rustls = { version = "0.23.35", default-features = false, features = ["ring"] }
-rustyline = { version = "14.0.0" }
+rustyline = { version = "18.0.1" }
 schemars = { version = "1.2", features = ["bytes1"] }
 semver = { version = "1.0", features = ["serde"] }
 serde = { version = "1.0", features = ["derive"] }
```

**File**: `cli/src/commands/whoami.rs` (modified, +5/-5)
```diff
@@ -36,7 +36,7 @@ pub async fn run(State(env): State<CliEnv>) {
     c_println!("       https://restate.dev/");
     c_println!();
     let mut table = Table::new();
-    table.load_preset(comfy_table::presets::NOTHING);
+    table.load_style(comfy_table::presets::NOTHING);
     table.add_row(vec![
         "Ingress base URL",
         env.ingress_base_url()
@@ -62,7 +62,7 @@ pub async fn run(State(env): State<CliEnv>) {
     c_println!();
     c_println!("Local Environment");
     let mut table = Table::new();
-    table.load_preset(comfy_table::presets::NOTHING);
+    table.load_style(comfy_table::presets::NOTHING);
     table.add_row(vec![
         "Config Dir",
         &format!(
@@ -123,7 +123,7 @@ pub async fn run(State(env): State<CliEnv>) {
     c_println!();
     c_println!("Restate CLI Build Information");
     let mut table = Table::new();
-    table.load_preset(comfy_table::presets::NOTHING);
+    table.load_style(comfy_table::presets::NOTHING);
     table.add_row(vec!["Version", build_info::RESTATE_CLI_VERSION]);
     table.add_row(vec!["Target", build_info::RESTATE_CLI_TARGET_TRIPLE]);
     table.add_row(vec!["Debug Build?", &format!("{}", build_info::is_debug())]);
@@ -167,7 +167,7 @@ pub async fn run(State(env): State<CliEnv>) {
                 None => ("(NONE)", "(NONE)"),
             };
 
-            table.load_preset(comfy_table::presets::NOTHING);
+            table.load_style(comfy_table::presets::NOTHING);
             table.add_row(vec!["Account ID", account_id]);
             table.add_row(vec!["Environment ID", environment_id]);
 
@@ -205,7 +205,7 @@ pub async fn run(State(env): State<CliEnv>) {
                 c_success!("Admin Service '{}' is healthy!", client.base_url);
                 if let Some(advertised_ingress_address) = client.advertised_ingress_address {
                     let mut table = Table::new();
-                    table.load_preset(comfy_table::presets::NOTHING);
+                    table.load_style(comfy_table::presets::NOTHING);
                     table.add_row(vec![
                         "Advertised ingress address",
                         &advertised_ingress_address,
```

**File**: `crates/cli-util/src/ui/console.rs` (modified, +2/-2)
```diff
@@ -452,7 +452,7 @@ macro_rules! c_warn {
     ($($arg:tt)*) => {
         {
             let mut table = $crate::_comfy_table::Table::new();
-            table.load_preset($crate::_comfy_table::presets::UTF8_BORDERS_ONLY);
+            table.load_style($crate::_comfy_table::presets::UTF8_BORDERS_ONLY);
             table.set_content_arrangement($crate::_comfy_table::ContentArrangement::Dynamic);
             table.set_width(120);
             let formatted = format!($($arg)*);
@@ -472,7 +472,7 @@ macro_rules! c_tip {
     ($($arg:tt)*) => {
         {
             let mut table = $crate::_comfy_table::Table::new();
-            table.load_preset($crate::_comfy_table::presets::NOTHING);
+            table.load_style($crate::_comfy_table::presets::NOTHING);
             table.set_content_arrangement($crate::_comfy_table::ContentArrangement::Dynamic);
             table.set_width(120);
             let formatted = format!($($arg)*);
```

**File**: `crates/cli-util/src/ui/stylesheet.rs` (modified, +2/-3)
```diff
@@ -116,11 +116,10 @@ impl StyledTable for comfy_table::Table {
         table.set_content_arrangement(comfy_table::ContentArrangement::Dynamic);
         match ctx.table_style() {
             TableStyle::Compact => {
-                table.load_preset(comfy_table::presets::NOTHING);
+                table.load_style(comfy_table::presets::NOTHING);
             }
             TableStyle::Borders => {
-                table.load_preset(comfy_table::presets::UTF8_FULL);
-                table.apply_modifier(comfy_table::modifiers::UTF8_ROUND_CORNERS);
+                table.load_style(comfy_table::presets::UTF8_FULL.with_rounded_corners());
             }
         }
         if !ctx.colors_enabled() {
```

**File**: `workspace-hack/Cargo.toml` (modified, +4/-10)
```diff
@@ -41,7 +41,6 @@ bytestring = { version = "1", default-features = false, features = ["serde"] }
 chrono = { version = "0.4", features = ["serde"] }
 clap = { version = "4", default-features = false, features = ["color", "derive", "env", "error-context", "help", "std", "suggestions", "usage", "wrap_help"] }
 clap_builder = { version = "4", default-features = false, features = ["color", "env", "std", "suggestions", "usage", "wrap_help"] }
-comfy-table = { version = "7" }
 compact_str = { version = "0.10", default-features = false, features = ["bytes", "serde", "std"] }
 constant_time_eq = { version = "0.4" }
 crc32fast = { version = "1" }
@@ -176,7 +175,6 @@ bytestring = { version = "1", default-features = false, features = ["serde"] }
 chrono = { version = "0.4", features = ["serde"] }
 clap = { version = "4", default-features = false, features = ["color", "derive", "env", "error-context", "help", "std", "suggestions", "usage", "wrap_help"] }
 clap_builder = { version = "4", default-features = false, features = ["color", "env", "std", "suggestions", "usage", "wrap_help"] }
-comfy-table = { version = "7" }
 compact_str = { version = "0.10", default-features = false, features = ["bytes", "serde", "std"] }
 constant_time_eq = { version = "0.4" }
 crc32fast = { version = "1" }
@@ -294,13 +292,12 @@ zstd-sys = { version = "2", features = ["experimental", "std"] }
 [target.x86_64-unknown-linux-gnu.dependencies]
 bitflags = { version = "2", default-features = false, features = ["std"] }
 clap = { version = "4" }
-crossterm = { version = "0.29" }
 getrandom-9fbad63c4bcf4a8f = { package = "getrandom", version = "0.4", default-features = false, features = ["std", "sys_rng"] }
 hyper-rustls = { version = "0.27", default-features = false, features = ["aws-lc-rs", "webpki-tokio"] }
 jemalloc_pprof = { version = "0.9", default-features = false, features = ["flamegraph", "symbolize"] }
 libc = { version = "0.2", default-features = false, features = ["use_std"] }
 mio = { version = "1", features = ["net", "os-ext"] }
-nix = { version = "0.31", features = ["signal"] }
+nix = { version = "0.31", features = ["fs", "ioctl", "poll", "signal", "term"] }
 num = { version = "0.4" }
 pprof_util = { version = "0.8", default-features = false, features = ["flamegraph"] }
 prost = { version = "0.14", default-features = false, features = ["no-recursion-limit"] }
@@ -315,13 +312,12 @@ tower-http-3b31131e45eafb45 = { package = "tower-http", version = "0.6", feature
 bitflags = { version = "2", default-features = false, features = ["std"] }
 cc = { version = "1", default-features = false, features = ["parallel"] }
 clap = { version = "4" }
-crossterm = { version = "0.29" }
 getrandom-9fbad63c4bcf4a8f = { package = "getrandom", version = "0.4", default-features = false, features = ["std", "sys_rng"] }
 hyper-rustls = { version = "0.27", default-features = false, features = ["aws-lc-rs", "webpki-tokio"] }
 jemalloc_pprof = { version = "0.9", default-features = false, features = ["flamegraph", "symbolize"] }
 libc = { version = "0.2", default-features = false, features = ["use_std"] }
 mio = { version = "1", features = ["net", "os-ext"] }
-nix = { version = "0.31", features = ["signal"] }
+nix = { version = "0.31", features = ["fs", "ioctl", "poll", "signal", "term"] }
 num = { version = "0.4" }
 pprof_util = { version = "0.8", default-features = false, features = ["flamegraph"] }
 prost = { version = "0.14", default-features = false, features = ["no-recursion-limit"] }
@@ -335,13 +331,12 @@ tower-http-3b31131e45eafb45 = { package = "tower-http", version = "0.6", feature
 [target.aarch64-apple-darwin.dependencies]
 bitflags = { version = "2", default-features = false, features = ["std"] }
 clap = { version = "4" }
-crossterm = { version = "0.29" }
 errno = { version = "0.3" }
 getrandom-9fbad63c4bcf4a8f = { package = "getrandom", version = "0.4", default-features = false, features = ["std", "sys_rng"] }
 hyper-rustls = { version = "0.27", default-features = false, features = ["aws-lc-rs", "webpki-tokio"] }
 jemalloc_pprof = { version = "0.9", default-features = false, features = ["flamegraph", "symbolize"] }
 libc = { version = "0.2", default-features = false, features = ["use_std"] }
-nix = { version = "0.31", features = ["signal"] }
+nix = { version = "0.31", features = ["fs", "ioctl", "poll", "signal", "term"] }
 num = { version = "0.4" }
 pprof_util = { version = "0.8", default-features = false, features = ["flamegraph"] }
 prost = { version = "0.14", default-features = false, features = ["no-recursion-limit"] }
@@ -357,13 +352,12 @@ tower-http-3b31131e45eafb45 = { package = "tower-http", version = "0.6", feature
 bitflags = { version = "2", default-features = false, features = ["std"] }
 cc = { version = "1", default-features = false, features = ["parallel"] }
 clap = { version = "4" }
-crossterm = { version = "0.29" }
 errno = { version = "0.3" }
 getrandom-9fbad63c4bcf4a8f = { package = "getrandom", version = "0.4", default-features = 
```

---

### Incident Patch 14: `54e1e0a2` (2026-09-23)
**Commit Message**: [UI] Updating Restate UI to v1.0.29 published at https://github.com/restatedev/restate-web-ui/releases/download/v1.0.29/ui-v1.0.29.zip (#5406)

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -9143,8 +9143,8 @@ dependencies = [
 
 [[package]]
 name = "restate-web-ui"
-version = "1.0.28"
-source = "git+https://github.com/restatedev/restate-web-ui-crate?tag=v1.0.28#ba47848b1a61449902d5fbc2e8f27edb145374ac"
+version = "1.0.29"
+source = "git+https://github.com/restatedev/restate-web-ui-crate?tag=v1.0.29#46695a0e3829488afafbf200f26e416fdbcd5836"
 dependencies = [
  "anyhow",
  "include_dir",
```

**File**: `crates/admin/Cargo.toml` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ restate-util-time = { workspace = true }
 restate-types = { workspace = true }
 restate-util-string = { workspace = true }
 restate-wal-protocol = { workspace = true }
-restate-web-ui = { git = "https://github.com/restatedev/restate-web-ui-crate", optional = true, version = "1.0.28", tag = "v1.0.28" }
+restate-web-ui = { git = "https://github.com/restatedev/restate-web-ui-crate", optional = true, version = "1.0.29", tag = "v1.0.29" }
 
 ahash = { workspace = true }
 anyhow = { workspace = true }
```

---

### Incident Patch 15: `14d5539a` (2026-09-18)
**Commit Message**: Require Tokio 1.53.1

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -258,7 +258,7 @@ tikv-jemallocator = { version = "0.7", features = [
 tikv-jemalloc-ctl = { version = "0.7", features = ["stats"] }
 tikv-jemalloc-sys = { version = "0.7", features = ["profiling"] }
 thiserror = "2.0"
-tokio = { version = "1.48.0", default-features = false, features = [
+tokio = { version = "1.53.1", default-features = false, features = [
     "rt-multi-thread",
     "signal",
     "macros",
```

#### Recent Merged Pull Requests:
- **PR #5501** (2026-10-05): [PartitionStore] Remove dead iterator code from PartitionStore (@AhmedSoliman)
- **PR #5500** (2026-10-05): [network] Don't shut down the node when accepting a connection fails (@MohamedBassem)
- **PR #5499** (2026-10-05): Improve error message (@slinkydeveloper)
- **PR #5497** (2026-10-05): [restate-doctor] Allow SET statements, add CLI arg for memory limit (@slinkydeveloper)
- **PR #5495** (2026-10-02): [df] Snake-case the display string of DetailedRunMode (@MohamedBassem)
- **PR #5494** (2026-10-02): [ci] bump download-artifact@v4 to v8 (@MohamedBassem)
- **PR #5493** (2026-10-05): [cli] add support for scopes in state mutation CLI commands (@MohamedBassem)
- **PR #5490** (2026-10-02): [RocksDB] Fix stats level misalignment (@AhmedSoliman)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
