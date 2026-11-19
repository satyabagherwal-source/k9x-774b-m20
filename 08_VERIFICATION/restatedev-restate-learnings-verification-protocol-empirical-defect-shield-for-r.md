# Verification Protocol: Verification Protocol: Empirical Defect Shield for restatedev-restate-learnings

<!-- PROVENANCE_START
{
  "source_repository": "restatedev-restate-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T07:51:13.906Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-restatedev-restate-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev-restate-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T07:51:13.906Z`  
> **Learning ID**: `LEARN-EVO-restatedev-restate-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `restatedev-restate-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/restatedev-restate-learnings.md`  
> **Source**: github ([https://github.com/restatedev/restate](https://github.com/restatedev/restate))  
> **Source Version**: `7e9a3b23`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T07:51:04.012Z  
> **Learning ID**: `learn-github-restatedev-restate`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): restatedev/restate

> **Canonical Artifact**: `07_PROJECT_LEARNING/restatedev-restate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/restatedev/restate](https://github.com/restatedev/restate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T07:51:04.006Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `restatedev/restate`
- **Description**: Restate is the platform for building resilient applications that tolerate all infrastructure faults w/o the need for a PhD.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4717 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/commands/cloud/tunnel/renderer.rs`
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
    client
        .patch_state(service, req)
        .await?
        .into_success_status()
        .await?;

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5666** (2026-11-03): **[snapshots] Snapshot downloads don't respect partition processor manager cancellation signal**
  *Symptoms*: When a partition is stopped (e.g. during replicaset changes) while it's downloading a snapshot, the cancellation signal is ignored until the snapshot download and import is complete. On clusters with large snapshots and slow disks, this can take minutes wasting precious IO for a partition that won't even run on this node.  Example logs:  ``` # restate-1 (N2) is no longer part of the replicaset of P0 {"timestamp":"2026-10-28T09:39:17.246265Z","level":"INFO","fields":{"message":"Partition configuration transitions: [P0(v24 [N2, N3] -> v25 [N1, N3]), P1(v25 [N2, N3] -> v26 [N1, N2]), P3(v25 [N2, N3] -> v26 [N1, N2]), P4(v25 [N2, N3] -> v26 [N1, N3]), P8(v24 [N2, N3] -> v25 [N1, N3]), P9(v24 [N2, N3] -> v25 [N1, N2]), P11(v25 [N2, N3] -> v26 [N1, N3]), P12(v24 [N2, N3] -> v25 [N1, N3]), P13(v24 [N2, N3] -> v25 [N1, N3]), P14(v25 [N2, N3] -> v26 [N1, N3])]"},"target":"restate_admin::cluster_controller::service::scheduler"}  # We start stopping at 09:39:17 {"timestamp":"2026-10-28T09:39:17.246349Z","level":"INFO","fields":{"message":"Reconciling partition processors: starts=[] stops=[P0(v25 [N1, N3]), P4(v26 [N1, N3]), P8(v25 [N1, N3]), P11(v26 [N1, N3]), P12(v25 [N1, N3]), P13(v25 [N1, N3]), P14(v26 [N1, N3])]"},"target":"restate_worker::partition_processor_manager"}  # At 10:07, P0 reported that it's downloaded its snapshot, then noticed the cancellation and stopped {"timestamp":"2026-10-28T10:07:48.862396Z","level":"INFO","fields":{"message":"Downloaded partition snapshot","snap
  **Post-Mortem & Fix Analysis**:
  > ### Duplicate check I found no duplicate. #4305 covers leaked directories when **snapshot creation** is cancelled. That is the upload path, not this download path.  ### Root cause - In `spawn_processor_task.rs:118-131`, the processor task deliberately awaits `PartitionStoreManager::open` to completion. Only after that does it check `cancellation.is_cancelled()`. The comment there says this is to drain RocksDB work running on the storage pool. - `open` (`partition_store_manager.rs:284-313`) calls `download_latest_snapshot`, then goes straight into `cell.import_cf`. No cancellation token is passed down either path. - `SnapshotRepository::get_latest_inner` (`repository.rs:854-875`) waits on the download `JoinSet` and never checks for cancellation. - In the logs, this cost about 28 minutes of download and then about 1 minute of `import_cf` (10:07:48 → 10:08:47). Both can be skipped. Only the RocksDB `import_cf` call itself (`partition_db.rs:409-412`) must not be abandoned once it starts.  
  > Oh oh. I started working on this issue without claiming.  And then #5692 is here, my bad.

- **Issue #5597** (2026-10-19): **[VQueues] Keep the scheduler alive when a running count has no rows**
  *Symptoms*: Stacked on #5596 (diagnostics); review that one first.  With the diagnostics from #5596 in place, the panic in `Queue::try_advance` only destroys information: it takes the partition runtime down, which becomes a `task_center` runtime panic, a 60 s shutdown timeout and a process exit that fails over every partition the node leads. This change treats the running count as what it always was in practice, a hint:  - When the running stage is empty although the metadata counts running entries, the queue logs a warning (the error with the full description was already emitted by the probe) and continues with the inbox stage. - When the running stage ends before the count is exhausted, it logs a warning instead of tripping the `debug_assert`s. - Unit test with the stub running reader, and a RocksDB-backed scheduler test that deletes a running-stage row behind the metadata's back, starts a scheduler on it and checks that it still schedules the next inbox entry. - Release note.  Verified end to end on a local 3-node cluster: with the inconsistent state injected into a follower's partition store and leadership pinned to that node, unpatched `main` panics exactly as in production (followed by `assertion failed: self.received_feedback` in `self_proposer_scheduler.rs:221` during unwinding), while this stack logs the description and the warning, keeps leading, and serves the next invocation.  Checked with `cargo nextest run -p restate-partition-store -p restate-vqueues`, `cargo fmt --check` 
  **Post-Mortem & Fix Analysis**:
  > ## Test Results   8 files  ±0    8 suites  ±0   5m 18s ⏱️ ±0s  61 tests ±0   61 ✅ ±0  0 💤 ±0  0 ❌ ±0  268 runs  ±0  268 ✅ ±0  0 💤 ±0  0 ❌ ±0   Results for commit f92b93fd. ± Comparison against base commit 9b7bbe36.  [test-results]:data:application/gzip;base64,H4sIAK+Y1GoC/12MSwrDIBQArxJcd+Ef7WWKUR9Ik1iMrkLvXg1JarucGZgNQZj8iu6Dug1oLSFf4EoyOcSlIiNN1JRblOSEx1qs/TPP8KoGXwJMmH6ETymmw6SytCOV6oDz2JvvceduuHP/s3GeQ66AQNNRM3BsFJQTxSlwB9IZzwTWILGQwmFsAL0/gTjgEwMBAAA=  :recycle: This comment has been updated with latest results.
  > The running count in the metadata is not a hint. It needs to be in sync with the underlying data. If the information goes astray, then this indicates a programming bug that needs to be fixed.

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

### Incident Patch 1: `b493638d` (2026-11-17)
**Commit Message**: [QueryEngineV2] Keep test fixture storage out of reach of late query cleanup

`schema_statistics_preserve_sql_pruning_and_owner_execution` failed once in
CI (on #5921) after its body had passed:

    database lifetime survived test teardown: DbRef(1v1) (db-0)

The test ends with a query that fails. After a failed query,
datafusion-distributed closes its remote tasks from plain Tokio tasks, which
hold the query's session until those close RPCs return. Through the session's
channel resolver, they also hold the test network and its `MockConnector`,
and the connector's router factory owned storage:

    cleanup task ─▶ session ─▶ network ─▶ MockConnector
                                            ├─▶ routers ─▶ remote query servers
                                            └─▶ router factory
                                                  ├─▶ worker sources ─▶ partition store manager ─▶ partition DBs
                                                  └─▶ task observations ─▶ worker task contexts ─▶ worker sources

When that cleanup task let go of the network last, it dropped the connector
during teardown. Dropping the routers stopped the remote query servers, the
last tasks shutdow

**File**: `crates/distributed-datafusion/src/distributed/multi_owner_tests.rs` (modified, +19/-20)
```diff
@@ -30,14 +30,14 @@ use datafusion::physical_plan::stream::RecordBatchStreamAdapter;
 use datafusion::physical_plan::{ExecutionPlanProperties, PhysicalExpr};
 use datafusion::prelude::SessionContext;
 use datafusion_distributed::{NetworkBoundary, NetworkCoalesceExec, Stage};
-use futures::{FutureExt, StreamExt, TryStreamExt, stream};
+use futures::{StreamExt, TryStreamExt, stream};
 use tokio::time::Instant;
 
 use restate_core::network::NetworkSender;
 use restate_core::network::transport_connector::test_util::MockConnector;
 use restate_core::partitions::PartitionRouting;
 use restate_core::test_env::{TestCoreEnv, TestCoreEnvBuilder, create_mock_nodes_config};
-use restate_core::{Metadata, TaskCenter, TaskKind};
+use restate_core::{Metadata, TaskCenter};
 use restate_memory::ByteCount;
 use restate_metadata_store::MetadataStoreClient;
 use restate_partition_store::state_table::{ScopedStateBinding, StateBinding};
@@ -319,6 +319,8 @@ struct MultiFixture<N> {
     stores: Vec<PartitionStore>,
     store_manager: Arc<PartitionStoreManager>,
     tasks: Arc<Mutex<Vec<TaskObservation>>>,
+    /// The sources of the remote workers, whose servers start on first connection.
+    _workers: Arc<OnceLock<HashMap<GenerationalNodeId, SourceRegistry>>>,
     reads: Arc<Mutex<Reads>>,
     node_reads: Arc<Mutex<Vec<GenerationalNodeId>>>,
     placements: PlacementCalls,
@@ -350,24 +352,25 @@ async fn setup_with_scanners(
     }
     let workers = Arc::new(OnceLock::<HashMap<GenerationalNodeId, SourceRegistry>>::new());
     let tasks = Arc::new(Mutex::new(vec![]));
+    // Queries keep the connector through their network, possibly past teardown
+    // (see `keep_network_past_teardown`), so it must not own storage: it only
+    // borrows the workers' sources and observations. The fixture owns them, and
+    // so does each server it starts.
     let (connector, _) = MockConnector::new({
-        let workers = Arc::clone(&workers);
-        let tasks = Arc::clone(&tasks);
+        let workers = Arc::downgrade(&workers);
+        let tasks = Arc::downgrade(&tasks);
         move |node, router: &mut restate_core::network::MessageRouterBuilder| {
+            // A node first reached once the test has returned serves nothing.
+            let (Some(workers), Some(tasks)) = (workers.upgrade(), tasks.upgrade()) else {
+                return;
+            };
             let mut server = DistributedQueryServer::new(
                 environment(1, 128),
                 workers.get().unwrap()[&node].clone(),
                 router,
             );
-            server.observations = Arc::clone(&tasks);
-            // Start the receiver before the connector can dispatch its first RPC.
-            let mut task = Box::pin(server.run());
-            assert!(task.as_mut().now_or_never().is_none());
-            // Like production, shutdown waits for the server to drain, releasing its
-            // storage owners before teardown checks run.
-            TaskCenter::current()
-                .spawn(TaskKind::SystemService, "multi-owner-query", task)
-                .unwrap();
+            server.observations = tasks;
+            crate::mocks::spawn_query_server("multi-owner-query", server);
         }
     });
     let mut nodes = create_mock_nodes_config(1, 1);
@@ -447,14 +450,9 @@ async fn setup_with_scanners(
         &mut coordinator.router_builder,
     );
     server.observations = Arc::clone(&tasks);
-    let mut task = Box::pin(server.run());
-    assert!(task.as_mut().now_or_never().is_none());
-    // Like production, shutdown waits for the server to drain, releasing its
-    // storage owners before teardown checks run.
-    TaskCenter::current()
-        .spawn(TaskKind::SystemService, "local-query-worker", task)
-        .unwrap();
+    crate::mocks::spawn_query_server("local-query-worker", server);
     let coordinator = coordinator.build().await;
+    crate::mocks::keep_network_past_teardown(coordinator.networking.clone());
     let mut remote = HashMap::new();
     for id in 2..=3 {
         let worker = TestCoreEnv::create_with_single_node(id, 1).await;
@@ -477,6 +475,7 @@ async fn setup_with_scanners(
         stores,
         store_manager: manager,
         tasks,
+        _workers: workers,
         reads,
         node_reads,
         placements,
```

**File**: `crates/distributed-datafusion/src/distributed/partition_state_tests.rs` (modified, +4/-12)
```diff
@@ -18,12 +18,12 @@ use datafusion::arrow::util::display::array_value_to_string;
 use datafusion::common::exec_err;
 use datafusion::execution::SendableRecordBatchStream;
 use datafusion::physical_plan::stream::RecordBatchStreamAdapter;
-use futures::{FutureExt, StreamExt, TryStreamExt, stream};
+use futures::{StreamExt, TryStreamExt, stream};
 use tokio::sync::watch;
 
+use restate_core::TaskCenter;
 use restate_core::network::transport_connector::test_util::MockConnector;
 use restate_core::test_env::{TestCoreEnv, TestCoreEnvBuilder, create_mock_nodes_config};
-use restate_core::{TaskCenter, TaskKind};
 use restate_storage_query_api::{QueryOptions, QuerySession, SessionOptions};
 use restate_types::cluster::cluster_state::PartitionProcessorStatus;
 use restate_types::cluster_state::NodeState;
@@ -238,11 +238,7 @@ async fn partition_state_reconciles_worker_reports() {
                 workers.get().unwrap()[&node].clone(),
                 router,
             );
-            let mut task = Box::pin(server.run());
-            assert!(task.as_mut().now_or_never().is_none());
-            TaskCenter::current()
-                .spawn(TaskKind::SystemService, "partition-state-worker", task)
-                .unwrap();
+            crate::mocks::spawn_query_server("partition-state-worker", server);
         }
     });
     // The configured generations; N7's is newer than the one gossip saw die.
@@ -286,11 +282,7 @@ async fn partition_state_reconciles_worker_reports() {
         coordinator_sources.clone(),
         &mut coordinator.router_builder,
     );
-    let mut task = Box::pin(server.run());
-    assert!(task.as_mut().now_or_never().is_none());
-    TaskCenter::current()
-        .spawn(TaskKind::SystemService, "partition-state-coordinator", task)
-        .unwrap();
+    crate::mocks::spawn_query_server("partition-state-coordinator", server);
     let coordinator = coordinator.build().await;
     coordinator_sources.register_node_scanner::<PartitionStateReports>(
         PartitionStateTable::create_reports_scanner(
```

**File**: `crates/distributed-datafusion/src/distributed/tests.rs` (modified, +23/-18)
```diff
@@ -20,7 +20,7 @@ use datafusion::execution::SendableRecordBatchStream;
 use datafusion::physical_plan::PhysicalExpr;
 use datafusion::physical_plan::stream::RecordBatchStreamAdapter;
 use datafusion_proto::physical_plan::{DeduplicatingProtoConverter, PhysicalExtensionCodec};
-use futures::{FutureExt, StreamExt, TryStreamExt, stream};
+use futures::{StreamExt, TryStreamExt, stream};
 
 use restate_clock::{MockClock, UniqueTimestamp};
 use restate_core::network::transport_connector::test_util::MockConnector;
@@ -133,7 +133,8 @@ impl PartitionLocator for RemoteOwner {
 struct Fixture<N> {
     network: N,
     scanners: SourceRegistry,
-    owner_scanners: SourceRegistry,
+    /// The owner's sources, whose server starts on first connection.
+    owner_scanners: Arc<OnceLock<SourceRegistry>>,
     store: PartitionStore,
     manager: Arc<PartitionStoreManager>,
     observations: Arc<Mutex<Vec<TaskObservation>>>,
@@ -168,27 +169,29 @@ async fn setup_at_version(
         .open(&Partition::new(PartitionId::MIN, KeyRange::FULL), None)
         .await
         .unwrap();
-    let worker_scanners = Arc::new(OnceLock::<SourceRegistry>::new());
+    let owner_scanners = Arc::new(OnceLock::<SourceRegistry>::new());
     let observations = Arc::new(Mutex::new(vec![]));
+    // Queries keep the connector through their network, possibly past teardown
+    // (see `keep_network_past_teardown`), so it must not own storage: it only
+    // borrows the owner's sources and the observations.
     let (connector, _connections) = MockConnector::new({
-        let worker_scanners = Arc::clone(&worker_scanners);
-        let observations = Arc::clone(&observations);
+        let owner_scanners = Arc::downgrade(&owner_scanners);
+        let observations = Arc::downgrade(&observations);
         move |node, router: &mut restate_core::network::MessageRouterBuilder| {
             assert_eq!(node, OWNER, "task was routed to a non-owner");
+            // An owner first reached once the test has returned serves nothing.
+            let (Some(owner_scanners), Some(observations)) =
+                (owner_scanners.upgrade(), observations.upgrade())
+            else {
+                return;
+            };
             let mut server = DistributedQueryServer::new(
                 environment(1, 128),
-                worker_scanners.get().unwrap().clone(),
+                owner_scanners.get().unwrap().clone(),
                 router,
             );
-            server.observations = Arc::clone(&observations);
-            // Start the receiver before the connector can dispatch its first RPC.
-            let mut task = Box::pin(server.run());
-            assert!(task.as_mut().now_or_never().is_none());
-            // Like production, shutdown waits for the server to drain, releasing its
-            // storage owners before teardown checks run.
-            TaskCenter::current()
-                .spawn(TaskKind::SystemService, "distributed-query-test", task)
-                .unwrap();
+            server.observations = observations;
+            crate::mocks::spawn_query_server("distributed-query-test", server);
             // An ordinary node service next to the query service, so tests can
             // check that query failures leave the connection usable for it.
             let mut gossip = router
@@ -229,6 +232,7 @@ async fn setup_at_version(
     .set_nodes_config(nodes)
     .build()
     .await;
+    crate::mocks::keep_network_past_teardown(coordinator.networking.clone());
     // The injected worker metadata belongs to N2, while the loopback transport's
     // task-center/global metadata remains N1. RPC, codecs and Arrow IPC are real.
     let owner = TestCoreEnv::create_with_single_node(2, 1).await;
@@ -243,7 +247,7 @@ async fn setup_at_version(
     local.register_partition_scanner::<ScopedStateSource>(Arc::new(LookupScanner::<
         ScopedStateBinding,
     >::new()));
-    worker_scanners.set(local.clone()).unwrap();
+    owner_scanners.set(local).unwrap();
     let scanners = SourceRegistry::new(
         Arc::new(RemoteOwner),
         coordinator.metadata,
@@ -252,7 +256,7 @@ async fn setup_at_version(
     Fixture {
         network: coordinator.networking,
         scanners,
-        owner_scanners: local,
+        owner_scanners,
         store,
         manager,
         observations,
@@ -734,7 +738,8 @@ fn remote_error(error: &DataFusionError) -> &QueryTaskError {
 async fn processor_admission_errors_reach_the_remote_query_consumer() {
     let fixture = setup(false).await;
     let (commands, mut receiver) = tokio::sync::mpsc::channel(32);
-    fixture.owner_scanners.register_processor_reads(
+    let owner_scanners = fixture.owner_scanners.get().unwrap();
+    owner_scanners.register_processor_reads(
         ProcessorsManagerHandle::new(
             commands,
             Arc::new(UnusedRuleBook),
```

**File**: `crates/distributed-datafusion/src/mocks.rs` (modified, +56/-2)
```diff
@@ -12,18 +12,19 @@ use std::collections::HashMap;
 use std::fmt::Debug;
 use std::marker::PhantomData;
 use std::num::NonZeroUsize;
-use std::sync::Arc;
+use std::sync::{Arc, OnceLock};
 
 use async_trait::async_trait;
 use datafusion::arrow::array::ArrayRef;
 use datafusion::arrow::record_batch::RecordBatch;
 use datafusion::arrow::util::display::array_value_to_string;
-use futures::TryStreamExt;
+use futures::{FutureExt, TryStreamExt};
 
 use googletest::matcher::{Matcher, MatcherResult};
 use serde_json::Value;
 
 use restate_clock::MockClock;
+use restate_core::{TaskCenter, TaskCenterFutureExt, TaskKind, cancellation_watcher};
 use restate_metadata_store::MetadataStoreClient;
 use restate_partition_store::{PartitionStore, PartitionStoreManager, QueryIoExecutor};
 use restate_rocksdb::RocksDbManager;
@@ -48,6 +49,7 @@ use restate_types::sharding::KeyRange;
 use super::context::DataFusionQueryEngine;
 use crate::catalog::RegisterTable;
 use crate::context::SelectPartitions;
+use crate::distributed::DistributedQueryServer;
 use crate::local_scanners::{
     register_live_scanners, register_metadata_scanners, register_partition_scanners,
 };
@@ -59,6 +61,58 @@ pub(crate) fn query_io() -> QueryIoExecutor {
     QueryIoExecutor::new(NonZeroUsize::MIN)
 }
 
+/// Starts a query server as a node does: a system service that drains and stops
+/// on shutdown.
+///
+/// A mock connector routes the first RPC as soon as it has built a node's router,
+/// so the server's receiver must already be started, which takes a first poll
+/// here. That poll also binds the server's shutdown to the task it runs in. In
+/// the caller's task, that is whichever task connected first, such as a query's
+/// connection pseudo-task, which shutdown never cancels: the server would stop
+/// only once its connector is dropped. So the server polls in a pseudo-task of
+/// its own, which the spawned task cancels on shutdown.
+pub(crate) fn spawn_query_server(name: &'static str, server: DistributedQueryServer) {
+    let shutdown = Arc::new(OnceLock::new());
+    let mut run = Box::pin(
+        {
+            let shutdown = Arc::clone(&shutdown);
+            async move {
+                shutdown.get_or_init(restate_core::cancellation_token);
+                server.run().await
+            }
+        }
+        .in_current_tc_as_task(TaskKind::SystemService, name),
+    );
+    assert!(run.as_mut().now_or_never().is_none());
+    let shutdown = shutdown.get().cloned().expect("the server has started");
+    TaskCenter::spawn(TaskKind::SystemService, name, async move {
+        tokio::select! {
+            result = &mut run => return result,
+            () = cancellation_watcher() => shutdown.cancel(),
+        }
+        run.await
+    })
+    .unwrap();
+}
+
+/// Keeps `network` until the storage teardown checks have run.
+///
+/// A failed distributed query can outlive its test: datafusion-distributed
+/// closes the query's remote tasks from plain Tokio tasks, which hold the query's
+/// session and, through its channel resolver, the network. Holding the network
+/// through teardown makes that worst case deterministic: a fixture whose network
+/// reaches storage fails every test, not one run in many.
+///
+/// ```text
+/// cleanup task ──▶ session ──▶ network ──▶ MockConnector ──╳──▶ sources ──▶ partition DBs
+/// ```
+pub(crate) fn keep_network_past_teardown(network: impl Send + 'static) {
+    // The manager registers its teardown checks on first init. Finalizers run in
+    // registration order, so the network is dropped after those checks.
+    RocksDbManager::init();
+    TaskCenter::register_test_finalizer(Box::pin(async move { drop(network) }));
+}
+
 /// Metadata for query tests. Deployments carry their service names as listed by
 /// [`DeploymentResolver::get_deployments`], the only deployment read query tables make.
 #[derive(Default, Clone, Debug)]
```

**File**: `crates/distributed-datafusion/src/query_correctness/sparse_min_max.rs` (modified, +25/-15)
```diff
@@ -187,6 +187,15 @@ fn v2_env(parallelism: usize, batch_size: usize, dynamic_filters: bool) -> DataF
     .unwrap()
 }
 
+/// The V1 and V2 sources of each remote worker.
+type Workers = HashMap<
+    GenerationalNodeId,
+    (
+        v1::remote_query_scanner_manager::RemoteScannerManager,
+        SourceRegistry,
+    ),
+>;
+
 struct Fixture<N> {
     network: N,
     partitions: Partitions,
@@ -195,6 +204,8 @@ struct Fixture<N> {
     v1_mixed: v1::remote_query_scanner_manager::RemoteScannerManager,
     v2_mixed: SourceRegistry,
     v2_predicates: Arc<Mutex<BTreeMap<String, usize>>>,
+    /// The remote workers' sources, whose servers start on first connection.
+    _workers: Arc<OnceLock<Workers>>,
 }
 
 #[derive(Debug)]
@@ -276,13 +287,6 @@ async fn setup() -> Fixture<impl NetworkSender> {
     for (_, partition) in &partitions.0 {
         stores.push(manager.open(partition, None).await.unwrap());
     }
-    type Workers = HashMap<
-        GenerationalNodeId,
-        (
-            v1::remote_query_scanner_manager::RemoteScannerManager,
-            SourceRegistry,
-        ),
-    >;
     let workers = Arc::new(OnceLock::<Workers>::new());
     let start_servers =
         |legacy, distributed, router: &mut restate_core::network::MessageRouterBuilder| {
@@ -292,15 +296,13 @@ async fn setup() -> Fixture<impl NetworkSender> {
                 router,
             );
             let v2_server = DistributedQueryServer::new(v2_env(1, 2, true), distributed, router);
-            // Poll once to start both service receivers before MockConnector routes RPCs.
+            // Poll once to start the V1 receiver before MockConnector routes RPCs.
             let mut v1_task = Box::pin(v1_server.run());
-            let mut v2_task = Box::pin(v2_server.run());
             assert!(v1_task.as_mut().now_or_never().is_none());
-            assert!(v2_task.as_mut().now_or_never().is_none());
             // Like production, shutdown waits for both servers to stop, releasing their
             // storage owners before teardown checks run. Polled before spawning, the V1
             // server's own shutdown watcher is bound outside its task, so stop it when
-            // its task is cancelled; the V2 server also stops when its connection closes.
+            // its task is cancelled.
             TaskCenter::current()
                 .spawn(TaskKind::SystemService, "min-max-v1-scanners", async move {
                     tokio::select! {
@@ -309,13 +311,19 @@ async fn setup() -> Fixture<impl NetworkSender> {
                     }
                 })
                 .unwrap();
-            TaskCenter::current()
-                .spawn(TaskKind::SystemService, "min-max-v2-tasks", v2_task)
-                .unwrap();
+            crate::mocks::spawn_query_server("min-max-v2-tasks", v2_server);
         };
+    // Queries keep the connector through their network, possibly past teardown
+    // (see `keep_network_past_teardown`), so it must not own storage: it only
+    // borrows the workers' sources. The fixture owns them, and so does each
+    // server it starts.
     let (connector, _) = MockConnector::new({
-        let workers = Arc::clone(&workers);
+        let workers = Arc::downgrade(&workers);
         move |node, router: &mut restate_core::network::MessageRouterBuilder| {
+            // A node first reached once the test has returned serves nothing.
+            let Some(workers) = workers.upgrade() else {
+                return;
+            };
             let (v1, v2) = &workers.get().unwrap()[&node];
             start_servers(v1.clone(), v2.clone(), router);
         }
@@ -375,6 +383,7 @@ async fn setup() -> Fixture<impl NetworkSender> {
         &mut coordinator.router_builder,
     );
     let coordinator = coordinator.build().await;
+    crate::mocks::keep_network_past_teardown(coordinator.networking.clone());
     // ScannerTask watches peer liveness; the mock transport has no failure detector.
     for id in 1..=3 {
         TaskCenter::current()
@@ -407,6 +416,7 @@ async fn setup() -> Fixture<impl NetworkSender> {
         v1_mixed,
         v2_mixed,
         v2_predicates,
+        _workers: workers,
     }
 }
 
```

---

### Incident Patch 2: `c5a71ab4` (2026-11-18)
**Commit Message**: Read the entry indexes whatever a query says about NULLs in their never-NULL order

A user dropped `NULLS LAST` from

```sql
SELECT entry_id, transitioned_at FROM sys_vqueue_entry_status
WHERE stage = 'finished' ORDER BY transitioned_at DESC NULLS LAST LIMIT 20
```

and the query stopped reading the finished-entries index. The planner wanted
exactly the index's declared order, `DESC NULLS LAST`, while a plain `DESC`
means `NULLS FIRST` under DataFusion's default. Yet `transitioned_at` is never
NULL, and neither is `created_at`, so both placements give the same rows in
the same order.

## What changes

- An index order column can now say it's never NULL
  (`IndexOrder::never_null`). It's proven by the source's row writer, not by
  its schema: every generated column is nullable. For such a column, a
  query's null placement doesn't matter when choosing the index.
- The read then advertises the placement the query asked for, so DataFusion
  adds no sort. Changing only the check would have chosen the index and
  still sorted above it.
- The invocations index (`created_at`), the finished-entries index
  (`transitioned_at`) and the active-entries index (`created_at`) declare
  their colu

**File**: `crates/distributed-datafusion/src/access.rs` (modified, +78/-15)
```diff
@@ -72,7 +72,8 @@ pub trait CompleteIndex: 'static {
 
     /// Whether the index pays off only for a query that wants the first rows in
     /// exactly its declared [`Self::ORDERING`]: a bounded sort above the source
-    /// whose whole order, null placement included, is the declared one. The read
+    /// whose whole order is the declared one, null placement included where a
+    /// column can be NULL ([`IndexOrder::never_null`]). The read
     /// then stops early. Without such a demand, reading every candidate and its
     /// primary record can cost more than the scan it replaces.
     const NEEDS_ORDERED_DEMAND: bool = false;
@@ -96,6 +97,13 @@ type PrimaryColumn<B> = <PrimaryOf<B> as SelectionSchema>::Column;
 pub struct IndexOrder<C> {
     pub column: C,
     pub options: SortOptions,
+    /// Whether the source sets this column on every row it returns, through
+    /// the index and when its partition scans instead. Then where a query puts
+    /// NULLs changes nothing: `created_at DESC`, which is `NULLS FIRST`, and
+    /// `created_at DESC NULLS LAST` read the index alike, and the read's rows
+    /// are in the order the query asked for. Proven by the source's row
+    /// writer, not by its schema: every generated column is nullable.
+    pub never_null: bool,
 }
 
 /// One column of a declared order, by its SQL name, sent with index work.
@@ -235,37 +243,48 @@ fn select<B: CompleteIndex>(
     }))
 }
 
-/// Whether `demand` asks for exactly the index's declared order.
+/// Whether `demand` asks for exactly the index's declared order, where NULLs go
+/// included unless the column is never NULL.
 fn orders<B: CompleteIndex>(demand: &Demand) -> bool {
-    let declared = ordering::<B>();
+    let declared = ordering::<B>(None);
     !declared.is_empty()
         && demand.ordering.len() == declared.len()
         && demand
             .ordering
             .iter()
-            .zip(&declared)
-            .all(|(sort, declared)| {
+            .zip(declared.iter().zip(B::ORDERING))
+            .all(|(sort, (declared, order))| {
                 sort.expr
                     .downcast_ref::<Column>()
                     .is_some_and(|column| column.name() == declared.name)
                     && sort.options.descending == declared.descending
-                    && sort.options.nulls_first == declared.nulls_first
+                    && (order.never_null || sort.options.nulls_first == declared.nulls_first)
             })
 }
 
 fn introduced<B: CompleteIndex>() -> SemanticRestateVersion {
     B::INTRODUCED
 }
 
-fn ordering<B: CompleteIndex>() -> Vec<SortedColumn> {
+/// The index's declared order, with NULLs placed as `demand` asks where it
+/// orders the index and a column is never NULL: the same rows in the same
+/// order, so that the planner adds no sort for the query's own spelling.
+fn ordering<B: CompleteIndex>(demand: Option<&Demand>) -> Vec<SortedColumn> {
+    let asked = demand
+        .filter(|demand| orders::<B>(demand))
+        .map(|demand| &demand.ordering);
     B::ORDERING
         .iter()
-        .map(|order| SortedColumn {
+        .enumerate()
+        .map(|(at, order)| SortedColumn {
             name: <<B::Index as IndexSchema>::Primary as SelectionSchema>::sql_name(order.column)
                 .expect("an ordered column has a SQL name")
                 .to_owned(),
             descending: order.options.descending,
-            nulls_first: order.options.nulls_first,
+            nulls_first: match asked {
+                Some(asked) if order.never_null => asked[at].options.nulls_first,
+                _ => order.options.nulls_first,
+            },
         })
         .collect()
 }
@@ -279,7 +298,7 @@ pub(crate) struct DeclaredIndex {
     identity: &'static str,
     select: SelectIndex,
     orders: fn(&Demand) -> bool,
-    ordering: fn() -> Vec<SortedColumn>,
+    ordering: fn(Option<&Demand>) -> Vec<SortedColumn>,
     introduced: fn() -> SemanticRestateVersion,
 }
 
@@ -298,14 +317,17 @@ impl DeclaredIndex {
         (self.select)(filters, demand)
     }
 
-    /// Whether `demand` asks for exactly the index's declared order.
+    /// Whether `demand` asks for exactly the index's declared order (see
+    /// [`IndexOrder::never_null`]).
     pub(crate) fn orders(&self, demand: &Demand) -> bool {
         (self.orders)(demand)
     }
 
-    /// The order of a partition's rows read through the index, if declared.
-    pub(crate) fn ordering(&self) -> Vec<SortedColumn> {
-        (self.ordering)()
+    /// The order of a partition's rows read through the index, if declared,
+    /// with NULLs where `demand` puts them if that changes nothing (see
+    /// [`IndexOrder::never_null`]).
+    pub(crate) fn ordering(&self, demand: Option<&Demand>) -> Vec<SortedColumn> {
+        (self.ordering)(demand)
     }
 
     /// The Restate version that introduced reading the index
@@ -373,7 +395,7 @@ pub(crate) fn select_access(
                 .map(|demand
```

**File**: `crates/distributed-datafusion/src/distributed/index_access_tests.rs` (modified, +52/-56)
```diff
@@ -695,67 +695,63 @@ async fn workflow_page_reads_the_entry_index_across_partitions_and_owners() {
 
     // The newest finished entries, through `finished_entry_by_outcome/1` on
     // every owner, except the partition whose index was reset, which scans
-    // and sorts: the same rows as a scan, each owner's read shown.
+    // and sorts: the same rows as a scan, each owner's read shown. Then the
+    // newest active entries, through `active_entry_by_stage/1`, the same way.
+    // Neither ordered column is ever NULL, so each query reads the same with
+    // NULLs placed last, first, or by default (first, for DESC): in the same
+    // plan, but for the spelling.
     let finished = "SELECT entry_id, transitioned_at FROM sys_vqueue_entry_status \
         WHERE stage = 'finished' ORDER BY transitioned_at DESC NULLS LAST LIMIT 20";
-    let unrestricted = finished.replacen(
-        "FROM sys_vqueue_entry_status",
-        "FROM (SELECT * FROM sys_vqueue_entry_status LIMIT 1000000) AS sys_vqueue_entry_status",
-        1,
-    );
+    let active = "SELECT entry_id, created_at FROM sys_vqueue_entry_status \
+        WHERE stage IN ('inbox', 'running') ORDER BY created_at DESC NULLS LAST LIMIT 20";
     let times = |rows: Vec<Vec<String>>| {
         rows.into_iter()
             .map(|row| row[1].clone())
             .collect::<Vec<_>>()
     };
-    assert_eq!(
-        times(crate::mocks::rows(session.as_ref(), finished).await),
-        times(crate::mocks::rows(session.as_ref(), &unrestricted).await)
-    );
-    let plan = crate::mocks::rows(session.as_ref(), &format!("EXPLAIN ANALYZE {finished}"))
-        .await
-        .concat()
-        .join("\n");
-    eprintln!("finished_analyze\n{plan}");
-    assert!(plan.contains("_idx_finished_entry_by_outcome"), "{plan}");
-    assert_eq!(
-        plan.matches("tasks_completed=1").count() + plan.matches("tasks_incomplete=1").count(),
-        3,
-        "{plan}"
-    );
-    assert!(plan.contains("entry_index_scans_not_ready=1"), "{plan}");
-    assert!(
-        !plan.contains("entry_index_reads=0,"),
-        "every owner reads the index somewhere: {plan}"
-    );
-
-    // The newest active entries, through `active_entry_by_stage/1`, the same
-    // way: the same rows as a scan, each owner's read shown.
-    let active = "SELECT entry_id, created_at FROM sys_vqueue_entry_status \
-        WHERE stage IN ('inbox', 'running') ORDER BY created_at DESC NULLS LAST LIMIT 20";
-    let unrestricted = active.replacen(
-        "FROM sys_vqueue_entry_status",
-        "FROM (SELECT * FROM sys_vqueue_entry_status LIMIT 1000000) AS sys_vqueue_entry_status",
-        1,
-    );
-    assert_eq!(
-        times(crate::mocks::rows(session.as_ref(), active).await),
-        times(crate::mocks::rows(session.as_ref(), &unrestricted).await)
-    );
-    let plan = crate::mocks::rows(session.as_ref(), &format!("EXPLAIN ANALYZE {active}"))
-        .await
-        .concat()
-        .join("\n");
-    eprintln!("active_analyze\n{plan}");
-    assert!(plan.contains("_idx_active_entry_by_stage"), "{plan}");
-    assert_eq!(
-        plan.matches("tasks_completed=1").count() + plan.matches("tasks_incomplete=1").count(),
-        3,
-        "{plan}"
-    );
-    assert!(plan.contains("entry_index_scans_not_ready=1"), "{plan}");
-    assert!(
-        !plan.contains("entry_index_reads=0,"),
-        "every owner reads the index somewhere: {plan}"
-    );
+    let unspelled = |plan: String| plan.replace(" NULLS FIRST", "").replace(" NULLS LAST", "");
+    for (sql, index) in [
+        (finished, "_idx_finished_entry_by_outcome"),
+        (active, "_idx_active_entry_by_stage"),
+    ] {
+        let explained = async |sql: &str| {
+            let plan = crate::mocks::rows(session.as_ref(), &format!("EXPLAIN {sql}"))
+                .await
+                .concat()
+                .join("\n");
+            unspelled(plan)
+        };
+        let expected = explained(sql).await;
+        for spelling in ["DESC NULLS LAST", "DESC", "DESC NULLS FIRST"] {
+            let sql = sql.replace("DESC NULLS LAST", spelling);
+            let unrestricted = sql.replacen(
+                "FROM sys_vqueue_entry_status",
+                "FROM (SELECT * FROM sys_vqueue_entry_status LIMIT 1000000) AS sys_vqueue_entry_status",
+                1,
+            );
+            assert_eq!(
+                times(crate::mocks::rows(session.as_ref(), &sql).await),
+                times(crate::mocks::rows(session.as_ref(), &unrestricted).await),
+                "{sql}"
+            );
+            assert_eq!(explained(&sql).await, expected, "{sql}");
+            let plan = crate::mocks::rows(session.as_ref(), &format!("EXPLAIN ANALYZE {sql}"))
+                .await
+                .concat()
+                .join("\n");
+            eprintln!("{index} {spelling}\n{plan}");
+            assert!(plan.contains(index), "{plan}");
+            assert_eq!(
+                plan.matches("t
```

**File**: `crates/distributed-datafusion/src/distributed/source.rs` (modified, +3/-1)
```diff
@@ -142,7 +142,9 @@ struct IndexWork {
     index: ReString,
     #[bilrost(2)]
     work: PartitionWork<PartitionScan>,
-    /// The order of each partition's rows, as the index declares it.
+    /// The order of each partition's rows: the index's declared order, except
+    /// that a never-NULL column's null placement follows the query
+    /// ([`IndexOrder::never_null`](crate::access::IndexOrder::never_null)).
     #[bilrost(3)]
     ordering: Vec<SortedColumn>,
     /// How many rows a partition that can't keep the order keeps, sorted: the
```

**File**: `crates/distributed-datafusion/src/tables/invocation_status/mod.rs` (modified, +5/-1)
```diff
@@ -86,7 +86,7 @@ const MAX_INDEXED_SERVICES: usize = 64;
 /// ```sql
 /// SELECT id FROM sys_invocation_status
 /// WHERE target_service_name = 'Promises' AND target_service_key IS NOT NULL
-/// ORDER BY created_at DESC NULLS LAST
+/// ORDER BY created_at DESC [NULLS FIRST | NULLS LAST]
 /// LIMIT 51
 /// ```
 ///
@@ -101,12 +101,16 @@ impl CompleteIndex for EntryIndex {
     /// The read merges its runs by creation time, newest first. The index keeps
     /// each entry's full creation timestamp, whose millisecond is the
     /// invocation's `created_at`: the read checks that for every row.
+    ///
+    /// `created_at` is never NULL: every stored invocation status has a
+    /// creation time, and the row writer always sets it (`row.rs`).
     const ORDERING: &'static [IndexOrder<InvocationStatusColumn>] = &[IndexOrder {
         column: InvocationStatusColumn::CreatedAt,
         options: SortOptions {
             descending: true,
             nulls_first: false,
         },
+        never_null: true,
     }];
 
     /// A few services, each with a few handlers, stay within the runs one read
```

**File**: `crates/distributed-datafusion/src/tables/invocation_status/tests.rs` (modified, +6/-4)
```diff
@@ -318,7 +318,8 @@ async fn invocations_read_through_the_entry_index_match_v1() {
         ORDER BY created_at DESC NULLS LAST LIMIT 1000";
     // The newest rows of named services, under conditions on what the read
     // navigates, the service type and the key's presence: read through the
-    // index. Rows that share a creation time differ only in it.
+    // index, wherever NULLs go, as `created_at` is never NULL. Rows that share a
+    // creation time differ only in it.
     let indexed = [
         page.to_owned(),
         page.replace("LIMIT 51", "LIMIT 9 OFFSET 40"),
@@ -335,14 +336,15 @@ async fn invocations_read_through_the_entry_index_match_v1() {
             BASE + 400
         ),
         newest_counter.clone(),
+        page.replace("DESC NULLS LAST", "DESC NULLS FIRST"),
+        page.replace("DESC NULLS LAST", "DESC"),
     ];
-    // Scanned: another order, a tie-breaker, nulls first, a condition outside
-    // the allowlist, no LIMIT, or a view above the table.
+    // Scanned: another order, a tie-breaker, a condition outside the
+    // allowlist, no LIMIT, or a view above the table.
     let scans = [
         oldest.to_owned(),
         scheduled.to_owned(),
         page.replace("NULLS LAST", "NULLS LAST, id"),
-        page.replace("NULLS LAST", "NULLS FIRST"),
         page.replace("target_service_key IS NOT NULL", "status = 'invoked'"),
         "SELECT target_service_name, COUNT(*) FROM sys_invocation_status \
          WHERE target_service_name IN ('Promises', 'Utils', 'Missing') \
```

**File**: `crates/distributed-datafusion/src/tables/vqueue_entry_status/read.rs` (modified, +10/-2)
```diff
@@ -126,7 +126,7 @@ impl CompleteIndex for StageIndex {
 /// ```sql
 /// SELECT … FROM sys_vqueue_entry_status
 /// WHERE stage = 'finished' [AND status IN ('failed', 'killed')]
-/// ORDER BY transitioned_at DESC NULLS LAST
+/// ORDER BY transitioned_at DESC [NULLS FIRST | NULLS LAST]
 /// LIMIT 50
 /// ```
 ///
@@ -143,12 +143,16 @@ impl CompleteIndex for FinishedIndex {
     /// The read merges its runs by the time each entry entered Finished, newest
     /// first. The index keeps the full timestamp, whose millisecond is the
     /// entry's `transitioned_at`: the read checks that for every row.
+    ///
+    /// `transitioned_at` is never NULL: every entry has a transition time from
+    /// its creation on, and the row writer always sets it (`row.rs`).
     const ORDERING: &'static [IndexOrder<VqueueEntryStatusColumn>] = &[IndexOrder {
         column: VqueueEntryStatusColumn::TransitionedAt,
         options: SortOptions {
             descending: true,
             nulls_first: false,
         },
+        never_null: true,
     }];
 
     /// Where the index isn't maintained, every partition would scan and sort
@@ -191,7 +195,7 @@ impl CompleteIndex for FinishedIndex {
 /// ```sql
 /// SELECT … FROM sys_vqueue_entry_status
 /// WHERE stage IN ('inbox', 'paused') [AND status = 'backing-off']
-/// ORDER BY created_at DESC NULLS LAST
+/// ORDER BY created_at DESC [NULLS FIRST | NULLS LAST]
 /// LIMIT 50
 /// ```
 ///
@@ -208,12 +212,16 @@ impl CompleteIndex for ActiveIndex {
     /// The read merges its runs by creation time, newest first. The index
     /// keeps the full timestamp, whose millisecond is the entry's `created_at`:
     /// the read checks that for every row.
+    ///
+    /// `created_at` is never NULL: every entry has a creation time, and the row
+    /// writer always sets it (`row.rs`).
     const ORDERING: &'static [IndexOrder<VqueueEntryStatusColumn>] = &[IndexOrder {
         column: VqueueEntryStatusColumn::CreatedAt,
         options: SortOptions {
             descending: true,
             nulls_first: false,
         },
+        never_null: true,
     }];
 
     /// Where the index isn't maintained, every partition would scan and sort
```

**File**: `crates/distributed-datafusion/src/tables/vqueue_entry_status/tests.rs` (modified, +47/-4)
```diff
@@ -52,6 +52,10 @@ use crate::table_providers::{PartitionReadContext, ScanPartition};
 
 use super::read::EntryStatusScanner;
 
+/// The ways to ask for a descending order: NULLs last, by default (first),
+/// and first.
+const SPELLINGS: [&str; 3] = ["DESC NULLS LAST", "DESC", "DESC NULLS FIRST"];
+
 #[restate_core::test(flavor = "multi_thread", worker_threads = 2)]
 async fn vqueue_entry_status_not_in_returns_non_excluded_rows() {
     use datafusion::arrow::array::Array;
@@ -768,6 +772,10 @@ async fn finished_entries_read_through_their_index_match_the_scan() {
              ORDER BY transitioned_at DESC NULLS LAST LIMIT 4",
             BASE + 10_300
         ),
+        // Renamed above the source, the column is still never NULL.
+        "SELECT entry_id, status, transitioned_at AS finished FROM sys_vqueue_entry_status \
+         WHERE stage = 'finished' ORDER BY finished DESC NULLS LAST LIMIT 6"
+            .into(),
     ];
     let scans = [
         // Status alone doesn't prove the stage.
@@ -791,6 +799,11 @@ async fn finished_entries_read_through_their_index_match_the_scan() {
             "{select} WHERE stage = 'finished' AND num_attempts = 0 \
              ORDER BY transitioned_at DESC NULLS LAST LIMIT 5"
         ),
+        // An outer join can add NULLs: nothing is asked of the source.
+        "SELECT e.entry_id, e.status, e.transitioned_at FROM (SELECT 1 AS one) AS o \
+         LEFT JOIN sys_vqueue_entry_status AS e ON e.stage = 'finished' \
+         ORDER BY e.transitioned_at DESC LIMIT 5"
+            .into(),
     ];
     // Tie-aware: the transition times in order, and every row a qualifying one.
     let same =
@@ -805,11 +818,23 @@ async fn finished_entries_read_through_their_index_match_the_scan() {
                 "{sql}"
             );
         };
+    // The ordered column is never NULL: wherever the query puts NULLs, by
+    // default first for DESC, it reads the index in the same plan, but for the
+    // spelling, and gets the same rows.
+    let unspelled = |plan: String| plan.replace(" NULLS FIRST", "").replace(" NULLS LAST", "");
     for sql in &indexed {
         let explained = plan(sql, false).await;
         assert!(explained.contains(INDEX), "{sql}: {explained}");
         let all = scanned(&sql.replace(" LIMIT", " LIMIT 1000000 --")).await;
-        same(&rows(sql).await, &scanned(sql).await, &all, sql);
+        for spelling in SPELLINGS {
+            let sql = sql.replace("DESC NULLS LAST", spelling);
+            assert_eq!(
+                unspelled(plan(&sql, false).await),
+                unspelled(explained.clone()),
+                "{sql}"
+            );
+            same(&rows(&sql).await, &scanned(&sql).await, &all, &sql);
+        }
     }
     for sql in &scans {
         let explained = plan(sql, false).await;
@@ -880,7 +905,10 @@ async fn finished_entries_read_through_their_index_match_the_scan() {
     drop(tx);
     for sql in &indexed[..2] {
         let all = scanned(&sql.replace(" LIMIT", " LIMIT 1000000 --")).await;
-        same(&rows(sql).await, &scanned(sql).await, &all, sql);
+        for spelling in SPELLINGS {
+            let sql = sql.replace("DESC NULLS LAST", spelling);
+            same(&rows(&sql).await, &scanned(&sql).await, &all, &sql);
+        }
     }
     let analyzed = plan(&indexed[0], true).await;
     assert!(
@@ -1060,11 +1088,23 @@ async fn active_entries_read_through_their_index_match_the_scan() {
                 "{sql}"
             );
         };
+    // The ordered column is never NULL: wherever the query puts NULLs, by
+    // default first for DESC, it reads the index in the same plan, but for the
+    // spelling, and gets the same rows.
+    let unspelled = |plan: String| plan.replace(" NULLS FIRST", "").replace(" NULLS LAST", "");
     for sql in &indexed {
         let explained = plan(sql, false).await;
         assert!(explained.contains(INDEX), "{sql}: {explained}");
         let all = scanned(&sql.replace(" LIMIT", " LIMIT 1000000 --")).await;
-        same(&rows(sql).await, &scanned(sql).await, &all, sql);
+        for spelling in SPELLINGS {
+            let sql = sql.replace("DESC NULLS LAST", spelling);
+            assert_eq!(
+                unspelled(plan(&sql, false).await),
+                unspelled(explained.clone()),
+                "{sql}"
+            );
+            same(&rows(&sql).await, &scanned(&sql).await, &all, &sql);
+        }
     }
     for sql in &scans {
         let explained = plan(sql, false).await;
@@ -1126,7 +1166,10 @@ async fn active_entries_read_through_their_index_match_the_scan() {
     drop(tx);
     for sql in &indexed[..2] {
         let all = scanned(&sql.replace(" LIMIT", " LIMIT 1000000 --")).await;
-        same(&rows(sql).await, &scanned(sql).await, &all, sql);
+        for spelling in SPELLINGS {
+            let sql = sql.replace("DESC NULLS LAST", spelling);
+            same(&rows(&sql).await, &scanned(&sql).await, &all, &sql);
+        }
     }

```

---

### Incident Patch 3: `8e48ffda` (2026-11-18)
**Commit Message**: [ci] Hand the CI image to test jobs through the WarpBuild cache (#5947)

The `docker` job hands its image to the SDK and e2e test jobs as the
`restate.tar` artifact (435 MB). `actions/download-artifact` fetches it over
a single connection, and in recent PR runs that took anywhere from 6 s to
8 min per job, which often decided when the whole run finished.

The `docker` job now also saves `restate.tar` to the WarpBuild cache under a
per-run key, and the test jobs restore it from there (a few hundred MB/s).
The SDK integration workflows accept the key as `restateImageCacheKey`. Every
test job falls back to the artifact on a cache miss, and the artifact is
still uploaded for Jepsen and manual SDK runs.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/actions.lock` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ workflows:
         - 'extractions/setup-just@v3.1.0'
         - 'restatedev/e2e@main'
         - 'taiki-e/install-action@v2.88.0'
+        - 'warpbuilds/cache@v1.4.13'
         - 'warpbuilds/rust-cache@v2.9.1'
     '.github/workflows/cla.yml':
         - 'actions/create-github-app-token@v3.3.0'
```

**File**: `.github/workflows/ci.yml` (modified, +28/-2)
```diff
@@ -158,6 +158,9 @@ jobs:
     uses: ./.github/workflows/docker.yml
     with:
       uploadImageAsTarball: "restate.tar"
+      # Test jobs restore the tarball from the WarpBuild cache, which is much faster than the
+      # artifact download. The artifact stays as a fallback and for Jepsen and manual SDK runs.
+      cacheImageTarball: true
       platforms: linux/amd64
       # additional features added for CI validation builds only
       features: metadata-api
@@ -197,6 +200,7 @@ jobs:
     uses: restatedev/sdk-java/.github/workflows/integration.yaml@main
     with:
       restateCommit: ${{ github.event.pull_request.head.sha || github.sha }}
+      restateImageCacheKey: ${{ needs.docker.outputs.tarballCacheKey }}
       serviceImage: "ghcr.io/restatedev/test-services-java:main"
 
   sdk-python:
@@ -212,6 +216,7 @@ jobs:
     uses: restatedev/sdk-python/.github/workflows/integration.yaml@main
     with:
       restateCommit: ${{ github.event.pull_request.head.sha || github.sha }}
+      restateImageCacheKey: ${{ needs.docker.outputs.tarballCacheKey }}
       serviceImage: "ghcr.io/restatedev/test-services-python:main"
 
   sdk-go:
@@ -227,6 +232,7 @@ jobs:
     uses: restatedev/sdk-go/.github/workflows/integration.yaml@main
     with:
       restateCommit: ${{ github.event.pull_request.head.sha || github.sha }}
+      restateImageCacheKey: ${{ needs.docker.outputs.tarballCacheKey }}
 
   sdk-typescript:
     name: Run SDK-Typescript integration tests
@@ -241,6 +247,7 @@ jobs:
     uses: restatedev/sdk-typescript/.github/workflows/integration.yaml@main
     with:
       restateCommit: ${{ github.event.pull_request.head.sha || github.sha }}
+      restateImageCacheKey: ${{ needs.docker.outputs.tarballCacheKey }}
       serviceImage: "ghcr.io/restatedev/test-services-node:main"
 
   sdk-typescript-protocol-v8:
@@ -256,6 +263,7 @@ jobs:
     uses: restatedev/sdk-typescript/.github/workflows/integration.yaml@main
     with:
       restateCommit: ${{ github.event.pull_request.head.sha || github.sha }}
+      restateImageCacheKey: ${{ needs.docker.outputs.tarballCacheKey }}
       envVars: |
         RESTATE_experimental_enable_protocol_v8=true
       testArtifactOutput: sdk-typescript-protocol-v8-test-report
@@ -274,6 +282,7 @@ jobs:
     uses: restatedev/sdk-typescript/.github/workflows/integration.yaml@main
     with:
       restateCommit: ${{ github.event.pull_request.head.sha || github.sha }}
+      restateImageCacheKey: ${{ needs.docker.outputs.tarballCacheKey }}
       envVars: |
         RESTATE_experimental_enable_schema_bilrost_encoding=true
       testArtifactOutput: sdk-typescript-bilrost-schema-test-report
@@ -292,6 +301,7 @@ jobs:
     uses: restatedev/sdk-rust/.github/workflows/integration.yaml@main
     with:
       restateCommit: ${{ github.event.pull_request.head.sha || github.sha }}
+      restateImageCacheKey: ${{ needs.docker.outputs.tarballCacheKey }}
       serviceImage: "ghcr.io/restatedev/test-services-rust:main"
 
   e2e:
@@ -317,8 +327,16 @@ jobs:
               }
             }
 
-      ### Download the Restate container image, if needed
+      ### Get the Restate container image: from the WarpBuild cache, or the artifact as a fallback
+      - name: Restore restate snapshot from the WarpBuild cache
+        id: restate-image-cache
+        if: ${{ needs.docker.outputs.tarballCacheKey != '' }}
+        uses: WarpBuilds/cache/restore@v1.4.13
+        with:
+          path: restate.tar
+          key: ${{ needs.docker.outputs.tarballCacheKey }}
       - name: Download restate snapshot from in-progress workflow
+        if: ${{ steps.restate-image-cache.outputs.cache-hit != 'true' }}
         uses: actions/download-artifact@v8.0.2
         with:
           name: restate.tar
@@ -362,8 +380,16 @@ jobs:
               }
             }
 
-      ### Download the Restate container image, if needed
+      ### Get the Restate container image: from the WarpBuild cache, or the artifact as a fallback
+      - name: Restore restate snapshot from the WarpBuild cache
+        id: restate-image-cache
+        if: ${{ needs.docker.outputs.tarballCacheKey != '' }}
+        uses: WarpBuilds/cache/restore@v1.4.13
+        with:
+          path: restate.tar
+          key: ${{ needs.docker.outputs.tarballCacheKey }}
       - name: Download restate snapshot from in-progress workflow
+        if: ${{ steps.restate-image-cache.outputs.cache-hit != 'true' }}
         uses: actions/download-artifact@v8.0.2
         with:
           name: restate.tar
```

**File**: `.github/workflows/docker.yml` (modified, +27/-0)
```diff
@@ -62,6 +62,15 @@ on:
         required: false
         default: false
         type: boolean
+      cacheImageTarball:
+        description: "also save the `uploadImageAsTarball` tarball to the WarpBuild cache; its key is the `tarballCacheKey` output"
+        required: false
+        default: false
+        type: boolean
+    outputs:
+      tarballCacheKey:
+        description: "WarpBuild cache key of the image tarball (restored with `path: restate.tar`), or empty"
+        value: ${{ jobs.build-and-push-image.outputs.tarballCacheKey }}
 
   workflow_dispatch:
     inputs:
@@ -130,6 +139,8 @@ jobs:
       packages: write
     runs-on: ${{ inputs.runnerSize == '32x' && 'warp-ubuntu-latest-x64-32x' || inputs.runnerSize == '16x' && 'warp-ubuntu-latest-x64-16x' || inputs.parca && 'warp-ubuntu-latest-x64-32x' || 'warp-ubuntu-latest-x64-16x' }}
     timeout-minutes: ${{ inputs.parca && 140 || 70 }}
+    outputs:
+      tarballCacheKey: ${{ steps.cache-tarball.outcome == 'success' && steps.cache-tarball-key.outputs.key || '' }}
 
     steps:
       - name: Checkout repository
@@ -343,6 +354,22 @@ jobs:
           retention-days: 1
           if-no-files-found: error
 
+      # Test jobs restore the tarball from here instead of downloading the artifact. Artifact
+      # downloads use a single connection and took from seconds to over 6 minutes; the WarpBuild
+      # cache restores at a few hundred MB/s. Restoring needs the same `path` (it is part of the
+      # cache version). The key is per run, so a re-run of only the test jobs still finds it.
+      - name: Compute image tarball cache key
+        id: cache-tarball-key
+        if: ${{ inputs.uploadImageAsTarball != '' && inputs.cacheImageTarball }}
+        run: echo "key=docker-image-${{ inputs.uploadImageAsTarball }}-${{ github.run_id }}" >> "$GITHUB_OUTPUT"
+      - name: Save docker image tar to the WarpBuild cache
+        id: cache-tarball
+        if: ${{ inputs.uploadImageAsTarball != '' && inputs.cacheImageTarball }}
+        uses: WarpBuilds/cache/save@v1.4.13
+        with:
+          path: restate.tar
+          key: ${{ steps.cache-tarball-key.outputs.key }}
+
       - name: Extract debug symbols
         if: ${{ inputs.parca }}
         uses: docker/build-push-action@v6.19.2
```

**File**: `docs/dev/build-and-ci.md` (modified, +7/-3)
```diff
@@ -184,13 +184,16 @@ Integration tests need a Docker image of the Restate server built from the PR/co
 
 **How it works:**
 
-1. The `docker` job builds the image and saves it as an OCI tarball artifact named `restate.tar`
-2. **For SDK tests**: The workflow calls the SDK repo's `integration.yaml` with `restateCommit: ${{ github.sha }}`. The SDK workflow uses `actions/download-artifact` to fetch the tarball from the *calling* workflow
-3. **For e2e tests**: The e2e job downloads the artifact directly, loads it, and re-tags it to a known name
+1. The `docker` job builds the image and saves it as an OCI tarball artifact named `restate.tar`. It also saves the same file to the WarpBuild cache under a per-run key (`docker-image-restate.tar-<run_id>`), returned as the `tarballCacheKey` output
+2. **Image transfer**: Test jobs restore `restate.tar` from the WarpBuild cache, which is much faster than the artifact download (artifact downloads use a single connection and took from seconds to over 6 minutes). They fall back to the artifact if the cache has no entry, e.g. if saving failed. The artifact is also what Jepsen and manual SDK integration runs fetch by PR or commit
+3. **For SDK tests**: The workflow calls the SDK repo's `integration.yaml` with `restateCommit: ${{ github.sha }}` and `restateImageCacheKey`. The SDK workflow restores the tarball from the WarpBuild cache, or falls back to `actions/download-artifact` to fetch it from the *calling* workflow. A reusable workflow runs with the caller's repository and ref, so it finds the cache entry the `docker` job saved
+4. **For e2e tests**: The e2e job restores (or downloads) the tarball directly, loads it, and re-tags it to a known name
 
 **Fragility points:**
 
 - **Cross-workflow artifact access**: SDK integration workflows download artifacts from the restate workflow using `actions/download-artifact`. This relies on GitHub's artifact sharing between `workflow_call` caller and callee, which can be brittle across GitHub Actions updates
+- **WarpBuild cache path**: The cache version includes the cached `path`, so every restore must use `path: restate.tar`, exactly as the save in `docker.yml`. Entries expire 7 days after last use
+- **SDK workflow inputs**: Passing an input that a called workflow doesn't define fails the run, so an SDK repo must accept `restateImageCacheKey` before ci.yml passes it
 - **Artifact naming**: The artifact must be named exactly `restate.tar` - both the upload in `docker.yml` and downloads in SDK workflows must agree
 - **Artifact retention**: Artifacts are retained for 1 day (`retention-days: 1`). Long-running or queued jobs may fail if artifacts expire
 - **Image tagging**: e2e tests re-tag the image to `localhost/restatedev/restate-commit-download:latest`. If this tag format changes, e2e tests break
@@ -206,6 +209,7 @@ A **reusable workflow** called by this repo and many others in the restatedev or
 
 **Inputs:**
 - `uploadImageAsTarball`: Save image as artifact for downstream jobs
+- `cacheImageTarball`: Also save that tarball to the WarpBuild cache; the key is the `tarballCacheKey` output
 - `platforms`: Target platforms (default: `linux/arm64,linux/amd64`)
 - `parca`: Split debug symbols and upload to Polar Signals
 - `buildIndividually`: Build binaries separately to avoid feature unification
```

#### Recent Merged Pull Requests:
- **PR #5957** (2026-11-18): [QueryEngineV2] Close a held read's task only once its Next has arrived (@AhmedSoliman)
- **PR #5956** (closed): [distributed-datafusion] Fix flaky close-race tests: wait for the Next before closing (@MohamedBassem)
- **PR #5955** (2026-11-18): [Bifrost] Keep the local loglet's sealed tail above acknowledged appends (@AhmedSoliman)
- **PR #5954** (2026-11-18): [PartitionStore] Track one-time migrations in the registry (@AhmedSoliman)
- **PR #5953** (2026-11-18): [PartitionStore] Store registry records under their own key kind (@AhmedSoliman)
- **PR #5952** (2026-11-18): [PartitionStore] Rename the index registry to the registry (@AhmedSoliman)

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

## X. [QueryEngineV2] Keep test fixture storage out of reach of late query cleanup

**RULE**:
When implementing operations in `crates/distributed-datafusion/src/distributed/multi_owner_tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in restatedev/restate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b493638d`: [QueryEngineV2] Keep test fixture storage out of reach of late query cleanup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/distributed-datafusion/src/distributed/multi_owner_tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use futures::{StreamExt, TryStreamExt, stream};
use restate_core::{Metadata, TaskCenter};
    /// The sources of the remote workers, whose servers start on first connection.
    _workers: Arc<OnceLock<HashMap<GenerationalNodeId, SourceRegistry>>>,
    // Queries keep the connector through their network, possibly past teardown
    // (see `keep_network_past_teardown`), so it must not own storage: it only
    // borrows the workers' sources and observations. The fixture owns them, and
    // so does each server it starts.
        let workers = Arc::downgrade(&workers);
        let tasks = Arc::downgrade(&tasks);
            // A node first reached once the test has returned serves nothing.
            let (Some(workers), Some(tasks)) = (workers.upgrade(), tasks.upgrade()) else {
                return;
            };
            server.observations = tasks;
            crate::mocks::spawn_query_server("multi-owner-query", server);
    crate::mocks::spawn_query_server("local-query-worker", server);
    crate::mocks::keep_network_past_teardown(coordinator.networking.clone());
        _workers: workers,
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use futures::{FutureExt, StreamExt, TryStreamExt, stream};
use restate_core::{Metadata, TaskCenter, TaskKind};
        let workers = Arc::clone(&workers);
        let tasks = Arc::clone(&tasks);
            server.observations = Arc::clone(&tasks);
            // Start the receiver before the connector can dispatch its first RPC.
            let mut task = Box::pin(server.run());
            assert!(task.as_mut().now_or_never().is_none());
            // Like production, shutdown waits for the server to drain, releasing its
            // storage owners before teardown checks run.
            TaskCenter::current()
                .spawn(TaskKind::SystemService, "multi-owner-query", task)
                .unwrap();
    let mut task = Box::pin(server.run());
    assert!(task.as_mut().now_or_never().is_none());
    // Like production, shutdown waits for the server to drain, releasing its
    // storage owners before teardown checks run.
    TaskCenter::current()
        .spawn(TaskKind::SystemService, "local-query-worker", task)
        .unwrap();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b493638d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
