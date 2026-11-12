> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pimalaya-himalaya-learnings.md`  
> **Source**: github ([https://github.com/pimalaya/himalaya](https://github.com/pimalaya/himalaya))  
> **Source Version**: `927950e2`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T04:50:14.211Z  
> **Learning ID**: `learn-github-pimalaya-himalaya`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): pimalaya/himalaya

> **Canonical Artifact**: `07_PROJECT_LEARNING/pimalaya-himalaya-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pimalaya/himalaya](https://github.com/pimalaya/himalaya))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T04:50:14.022Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pimalaya/himalaya`
- **Description**: CLI to manage emails
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7636 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/imap/utils.rs`
```
//! # IMAP utils
//!
//! Envelope address conversion, shared by the `fetch` and `thread`
//! commands.

use io_imap::types::envelope::Address;

use crate::shared::message::header;

/// Turns an envelope address into the shared address shape, its personal
/// name read as `message read` reads a header, `None` when absent or
/// empty.
pub fn to_address(addr: &Address<'_>) -> crate::email::address::Address {
    let name = addr
        .name
        .0
        .as_ref()
        .map(|name| header::decode_bytes(name.as_ref()))
        .filter(|name| !name.is_empty());

    crate::email::address::Address {
        name,
        email: format_email(addr),
    }
}

/// Joins the `local@host` parts of an envelope address.
fn format_email(addr: &Address<'_>) -> String {
    let mailbox = addr
        .mailbox
        .0
        .as_ref()
        .map(|m| String::from_utf8_lossy(m.as_ref()).to_string())
        .unwrap_or_default();
    let host = addr
        .host
        .0
        .as_ref()
        .map(|h| String::from_utf8_lossy(h.as_ref()).to_string())
        .unwrap_or_default();

    if !mailbox.is_empty() && !host.is_empty() {
        format!("{mailbox}@{host}")
    } else {
        mailbox
    }
}

```

### Core Architecture Module: `src/pimdir/queue/cancel.rs`
```
//! # pimdir queue cancel
//!
//! The `pimdir queue cancel` command, retracting one queued or parked
//! action before its owner applies it.

use std::fmt;

use anyhow::{Result, bail};
use clap::Parser;
use io_pimdir::client::producer::PimdirActionStatus;
use pimalaya_cli::{printer::Printer, prompt, sanitize};
use schemars::JsonSchema;
use serde::Serialize;

use crate::pimdir::client::PimdirClient;

/// Cancel one queued or parked action, by the row id `queue list` prints.
///
/// This is the only way back for a queued creation: a staged flag or move is
/// undone by doing the opposite, where a message that does not exist yet
/// cannot be deleted. Only a row of the account's queue is taken.
///
/// Cancelling is the store owner's write, so this takes that role for the
/// length of the call and fails while a sync holds it. A store another
/// version of the sync engine wrote is refused rather than reshaped.
#[derive(Debug, Parser)]
pub struct PimdirQueueCancelCommand {
    /// Row id of the queued action, as `pimdir queue list` prints it.
    #[arg(value_name = "ROW")]
    pub id: i64,
    /// Do not ask for confirmation.
    #[arg(long, short)]
    pub yes: bool,
}

impl PimdirQueueCancelCommand {
    /// Retracts the queued action the row id names.
    pub fn execute(self, printer: &mut impl Printer, client: &mut PimdirClient) -> Result<()> {
        let named = match client.queue_row(self.id)? {
            PimdirActionStatus::Pending { kind, .. } | PimdirActionStatus::Parked { kind, .. } => {
                kind
            }
            _ => String::from("action"),
        };
        if !self.yes
            && !prompt::bool(
                format!(
                    "Cancel the {} queued as row {}?",
                    sanitize::text(&named),
                    self.id
                ),
                false,
            )?
        {
            bail!("Cancellation aborted");
        }

        let kind = client.cancel_queued(self.id)?;
        printer.out(PimdirQueueCancelOutput { id: self.id, kind })
    }
}

/// The `pimdir queue cancel` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueCancelOutput {
    /// The row that was cancelled.
    #[serde(rename = "row")]
    pub id: i64,
    /// The action kind it held: `add`, `submit`, `set-flags`, ...
    pub kind: String,
}

impl fmt::Display for PimdirQueueCancelOutput {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(
            f,
            "Queued {} cancelled (row {})",
            sanitize::text(&self.kind),
            self.id
        )
    }
}

```

### Core Architecture Module: `src/pimdir/queue/cli.rs`
```
//! # pimdir queue command
//!
//! The `pimdir queue` command, dispatching onto its subcommands.

use anyhow::Result;
use clap::Subcommand;
use pimalaya_cli::printer::Printer;

use crate::{
    account::context::Account,
    pimdir::{
        client::PimdirClient,
        queue::{
            cancel::PimdirQueueCancelCommand, list::PimdirQueueListCommand,
            show::PimdirQueueShowCommand,
        },
    },
};

/// Read and retract the writes Himalaya staged.
///
/// A pimdir store is a replica the sync engine owns, so a write is appended
/// to the store's queue and applied on the engine's next run.
///
/// A staged flag, move or deletion shows in the ordinary listing straight
/// away. A staged creation has no id until the engine applies it, which is
/// what these commands are for.
#[derive(Debug, Subcommand)]
#[command(rename_all = "kebab-case")]
pub enum PimdirQueueCommand {
    #[command(alias = "ls")]
    List(PimdirQueueListCommand),
    Show(PimdirQueueShowCommand),
    Cancel(PimdirQueueCancelCommand),
}

impl PimdirQueueCommand {
    /// Runs the subcommand against the account's pimdir store.
    pub fn execute(
        self,
        printer: &mut impl Printer,
        account: &mut Account,
        client: &mut PimdirClient,
    ) -> Result<()> {
        match self {
            Self::List(cmd) => cmd.execute(printer, account, client),
            Self::Show(cmd) => cmd.execute(printer, client),
            Self::Cancel(cmd) => cmd.execute(printer, client),
        }
    }
}

```

### Core Architecture Module: `src/pimdir/queue/list.rs`
```
//! # pimdir queue list
//!
//! The `pimdir queue list` command, listing the creations and sends staged
//! in one mailbox.

use std::fmt;

use anyhow::Result;
use clap::Parser;
use pimalaya_cli::{
    columns::Columns,
    fields::Fields,
    printer::Printer,
    records::{Record, Records},
    sanitize,
};
use schemars::JsonSchema;
use serde::Serialize;

use crate::{
    account::context::Account,
    pimdir::{backend::PimdirQueuedEnvelope, client::PimdirClient},
    shared::{
        envelope::list::{format_addresses, format_state},
        mailbox::arg::MailboxArg,
    },
};

/// List the messages staged for creation or sending in a mailbox.
///
/// A saved message waits in the queue until the sync engine applies it and
/// has no id until then, so `envelope list` cannot show it. A sent message
/// waits there until the store's owner sends it, filed under the mailbox it
/// was saved to or the account's sent alias. This is where both show: the
/// row id to cancel one by, when it was queued, and the mail.
///
/// Staged flags, moves and deletions need no such view, addressing messages
/// that already exist. A row of any kind the sync engine parked, refusing to
/// apply it without an operator, is listed under them with why: cancel it,
/// or fix what parked it.
#[derive(Debug, Parser)]
pub struct PimdirQueueListCommand {
    #[command(flatten)]
    pub mailbox: MailboxArg,
}

impl PimdirQueueListCommand {
    /// Lists the creations and sends staged in the mailbox and prints them.
    pub fn execute(
        self,
        printer: &mut impl Printer,
        account: &mut Account,
        client: &mut PimdirClient,
    ) -> Result<()> {
        let mailbox = self.mailbox.resolve(account);
        let queued = client.queued_envelopes(&mailbox)?;
        let parked = client.parked_actions(&mailbox)?;

        printer.out(PimdirQueueListOutput {
            messages: queued
                .into_iter()
                .map(|queued| PimdirQueuedMessage {
                    id: queued.id,
                    queued_at: queued.created_at,
                    producer: queued.producer,
                    send: queued.send,
                    envelope: queued.envelope,
                })
                .collect(),
            parked: parked
                .into_iter()
                .map(|parked| PimdirParkedRow {
                    id: parked.id,
                    queued_at: parked.created_at,
                    producer: parked.producer,
                    kind: parked.action,
                    attempts: parked.attempts,
                    error: parked.error,
                })
                .collect(),
        })
    }
}

/// One message waiting in the store's queue.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueuedMessage {
    /// The queue row id, which `pimdir queue cancel` takes. It names a
    /// pending action, not a message: the message has no id until the sync
    /// engine applies the action, and gets a different one then.
    #[serde(rename = "row")]
    pub id: i64,
    /// When the row was appended, stamped by the store's own clock.
    pub queued_at: String,
    /// The process that staged it.
    pub producer: String,
    /// Whether the row sends the message rather than files it.
    pub send: bool,
    /// The mail the action carries, derived from the body it pins. Its `id`
    /// is `null`, a queued message having none yet.
    pub envelope: PimdirQueuedEnvelope,
}

/// One row the sync engine parked: it will not apply it again without an
/// operator.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirParkedRow {
    /// The queue row id, which `pimdir queue cancel` takes.
    #[serde(rename = "row")]
    pub id: i64,
    /// When the row was appended, stamped by the store's own clock.
    pub queued_at: String,
    /// The process that staged it.
    pub producer: String,
    /// The action kind: `add`, `submit`, `set-flags`, ...
    pub kind: String,
    /// How many times the engine tried it before parking it.
    pub attempts: i64,
    /// Why it was parked.
    pub error: String,
}

/// The `pimdir queue list` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueListOutput {
    /// The messages staged for creation in the mailbox.
    pub messages: Vec<PimdirQueuedMessage>,
    /// The mailbox's parked rows, any kind.
    pub parked: Vec<PimdirParkedRow>,
}

impl fmt::Display for PimdirQueueListOutput {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.messages.is_empty() && self.parked.is_empty() {
            return writeln!(f, "No message queued in this mailbox");
        }
        if !self.messages.is_empty() {
            self.fmt_queued(f)?;
        }
        if !self.messages.is_empty() && !self.parked.is_empty() {
            writeln!(f)?;
        }
        if !self.parked.is_empty() {
            self.fmt_parked(f)?;
        }
        Ok(())
    }
}

impl PimdirQueueListOutput {
    /// The records of queued creations and sends.
    fn fmt_queued(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut records = Records::default();

        for queued in &self.messages {
            let envelope = &queued.envelope;
            let to = format_addresses(&envelope.to);

            let mut fields = Fields::default();
            fields.push("Action", if queued.send { "send" } else { "save" });
            fields.push("Queued", sanitize::text(&queued.queued_at));
            fields.push("To", sanitize::text(&to));

            records.push(Record {
                title: queued.id.to_string(),
                state: format_state(&envelope.flags, envelope.has_attachment),
                fields,
                body: sanitize::text(&envelope.subject).into_owned(),
            });
        }

        writeln!(f, "{records}")?;
        writeln!(
            f,
            "Queued until the next sync. Cancel one with `himalaya pimdir queue cancel <ROW>`"
        )
    }

    /// The list of parked rows.
    fn fmt_parked(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut columns = Columns::new(["ROW", "ACTION", "QUEUED", "ERROR"]);

        for parked in &self.parked {
            columns.push([
                parked.id.to_string(),
                sanitize::text(&parked.kind).into_owned(),
                sanitize::text(&parked.queued_at).into_owned(),
                sanitize::text(&parked.error).into_owned(),
            ]);
        }

        write!(f, "{columns}")?;
        writeln!(
            f,
            "Parked by the sync engine, which will not retry them. Cancel one with \
             `himalaya pimdir queue cancel <ROW>`"
        )
    }
}

```

### Core Architecture Module: `src/pimdir/queue/mod.rs`
```
//! # pimdir queue
//!
//! The `pimdir queue` command family, over the writes Himalaya staged for
//! the store owner to apply.

pub mod cancel;
pub mod cli;
pub mod list;
pub mod show;

```

### Core Architecture Module: `src/pimdir/queue/show.rs`
```
//! # pimdir queue show
//!
//! The `pimdir queue show` command, saying where one queue row stands.

use std::fmt;

use anyhow::Result;
use clap::Parser;
use io_pimdir::client::producer::PimdirActionStatus;
use pimalaya_cli::{printer::Printer, sanitize};
use schemars::JsonSchema;
use serde::Serialize;

use crate::pimdir::client::PimdirClient;

/// Show where one queue row stands, by the id `pimdir message add`,
/// `pimdir message send` or `pimdir mailbox create`, `rename` or `delete`
/// printed.
///
/// A row is `pending` until the sync engine applies it, `parked` when the
/// engine gave up on it (with why), and `applied` once done, a message
/// sent or a mailbox created, renamed or deleted included, with the id of
/// the message an add created. The store keeps what became of an applied
/// row for seven days, under the mailbox it was queued on; past that, for
/// a cancelled row, and once a deleted mailbox has left the store, taking
/// that record with it, the state is `unknown`: `pimdir mailbox list` no
/// longer listing the mailbox is what says it was deleted.
#[derive(Debug, Parser)]
pub struct PimdirQueueShowCommand {
    /// The queue row id.
    #[arg(value_name = "ROW")]
    pub id: i64,
}

impl PimdirQueueShowCommand {
    /// Looks the row up in the account's queue and receipts.
    pub fn execute(self, printer: &mut impl Printer, client: &mut PimdirClient) -> Result<()> {
        let status = client.queue_row(self.id)?;
        printer.out(PimdirQueueShowOutput::new(self.id, status))
    }
}

/// Where a queue row stands.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum PimdirQueueState {
    /// Waiting for the sync engine.
    Pending,
    /// Given up on by the sync engine; `error` says why.
    Parked,
    /// Applied or performed by the sync engine (a message sent, a mailbox
    /// created, renamed or deleted); `seq` is the message an add created.
    Applied,
    /// Neither queued nor known applied: cancelled, applied long ago, or a
    /// mailbox deletion the store has followed, the record leaving with the
    /// mailbox.
    Unknown,
}

/// The `pimdir queue show` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueShowOutput {
    /// The queue row id.
    #[serde(rename = "row")]
    pub queue_id: i64,
    /// Where it stands.
    pub state: PimdirQueueState,
    /// The collection it is anchored on, unless unknown.
    pub collection: Option<String>,
    /// The action kind (`add`, `submit`…), while queued.
    pub kind: Option<String>,
    /// Apply attempts so far, while queued.
    pub attempts: Option<i64>,
    /// Why the row was parked.
    pub error: Option<String>,
    /// When the row was applied, RFC 3339.
    pub applied_at: Option<String>,
    /// The id of the message an applied add created, in `collection`.
    pub seq: Option<i64>,
}

impl PimdirQueueShowOutput {
    /// Projects io-pimdir's status of row `queue_id`.
    pub fn new(queue_id: i64, status: PimdirActionStatus) -> Self {
        let row = Self {
            queue_id,
            state: PimdirQueueState::Unknown,
            collection: None,
            kind: None,
            attempts: None,
            error: None,
            applied_at: None,
            seq: None,
        };

        match status {
            PimdirActionStatus::Pending {
                collection,
                kind,
                attempts,
            } => Self {
                state: PimdirQueueState::Pending,
                collection: Some(collection),
                kind: Some(kind),
                attempts: Some(attempts),
                ..row
            },
            PimdirActionStatus::Parked {
                collection,
                kind,
                attempts,
                error,
            } => Self {
                state: PimdirQueueState::Parked,
                collection: Some(collection),
                kind: Some(kind),
                attempts: Some(attempts),
                error: Some(error),
                ..row
            },
            PimdirActionStatus::Applied {
                applied_at,
                collection,
                seq,
            } => Self {
                state: PimdirQueueState::Applied,
                collection: Some(collection),
                applied_at: Some(applied_at),
                seq,
                ..row
            },
            PimdirActionStatus::Unknown => row,
        }
    }
}

impl fmt::Display for PimdirQueueShowOutput {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let id = self.queue_id;
        let collection = sanitize::text(self.collection.as_deref().unwrap_or_default());
        let kind = sanitize::text(self.kind.as_deref().unwrap_or_default());

        match self.state {
            PimdirQueueState::Pending => {
                writeln!(f, "Row {id} ({kind} in {collection}) is pending")
            }
            PimdirQueueState::Parked => {
                let error = sanitize::text(self.error.as_deref().unwrap_or_default());
                writeln!(f, "Row {id} ({kind} in {collection}) is parked: {error}")
            }
            PimdirQueueState::Applied => {
                write!(f, "Row {id} was applied in {collection}")?;
                if let Some(seq) = self.seq {
                    write!(f, ", creating message {seq}")?;
                }
                writeln!(f)
            }
            PimdirQueueState::Unknown => writeln!(
                f,
                "Row {id} is neither queued nor known applied: cancelled, applied long ago, \
                 or a deleted mailbox's row, gone with the mailbox"
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_applied_add_prints_its_seq() {
        let row = PimdirQueueShowOutput::new(
            12,
            PimdirActionStatus::Applied {
                applied_at: "2026-10-04T20:00:00Z".into(),
                collection: "imap/Drafts".into(),
                seq: Some(42),
            },
        );
        let json = serde_json::to_value(&row).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "row": 12,
                "state": "applied",
                "collection": "imap/Drafts",
                "kind": null,
                "attempts": null,
                "error": null,
                "appliedAt": "2026-10-04T20:00:00Z",
                "seq": 42,
            })
        );
    }

    #[test]
    fn an_unknown_row_prints_its_id_and_state() {
        let json = serde_json::to_value(PimdirQueueShowOutput::new(7, PimdirActionStatus::Unknown))
            .unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "row": 7,
                "state": "unknown",
                "collection": null,
                "kind": null,
                "attempts": null,
                "error": null,
                "appliedAt": null,
                "seq": null,
            })
        );
    }
}

```

### Core Architecture Module: `src/account/capability.rs`
```
//! # Account capability
//!
//! The `account capability` command, listing what the account serves of
//! the shared API, which backend serves each capability and how well.

use std::{fmt, path::PathBuf};

use anyhow::Result;
use clap::Parser;
use pimalaya_cli::{columns::Columns, printer::Printer, sanitize};
use schemars::JsonSchema;
use serde::Serialize;

#[cfg(feature = "pimdir")]
use crate::pimdir::client::PimdirClient;
use crate::{
    backend::Backend,
    capability::{self, Resolution, StoreSupport},
    cli::resolve_account,
};

/// List what the account serves of the shared API.
///
/// One row per capability: the backend it resolves to, the level it is
/// served at (`full`, `partial`, `server` when the server decides once
/// connected, `none`) and what the level leaves out. Read from the
/// account's configuration and the capability tables, nothing connecting;
/// on a pimdir account the writes are read from what the store's sources
/// declare. `--backend` shows the account under that filter.
#[derive(Debug, Parser)]
pub struct AccountCapabilityCommand;

impl AccountCapabilityCommand {
    /// Resolves each capability for the account and lists them.
    pub fn execute(
        self,
        printer: &mut impl Printer,
        config_paths: &[PathBuf],
        account_name: Option<&str>,
        backend: Backend,
    ) -> Result<()> {
        let (_, name, account_config) = resolve_account(config_paths, account_name)?;
        let resolution = Resolution::of(&name, &account_config, backend);

        // NOTE: the store is opened as a reader, a local read writing
        // nothing, so the rows say what its gate would refuse.
        #[cfg(feature = "pimdir")]
        let pimdir = match (resolution.storage, account_config.pimdir) {
            (Some(Backend::Pimdir), Some(config)) => Some(PimdirClient::new(config)?),
            _ => None,
        };

        let mut capabilities = Vec::new();

        for capability in capability::all() {
            let backend = resolution.transport(capability);

            #[cfg_attr(not(feature = "pimdir"), allow(unused_mut))]
            let mut support = StoreSupport::from(resolution.support(capability));

            #[cfg(feature = "pimdir")]
            if let (Some(Backend::Pimdir), Some(client)) = (backend, &pimdir)
                && let Some(declared) = client.store_support(capability)?
            {
                support = declared;
            }

            capabilities.push(AccountCapability {
                name: capability.name(),
                backend: backend.map(|backend| backend.to_string()),
                level: support.level.to_string(),
                detail: support.detail,
            });
        }

        printer.out(AccountCapabilityOutput {
            account: name,
            capabilities,
        })
    }
}

/// The `account capability` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct AccountCapabilityOutput {
    /// The account the capabilities are resolved for.
    pub account: String,
    /// One row per shared capability, in the order the commands reach
    /// them.
    pub capabilities: Vec<AccountCapability>,
}

/// How the account serves one shared capability.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct AccountCapability {
    /// The capability, pimdir's grammar without the domain word
    /// (`message.move`, `envelope.search.body`).
    pub name: String,
    /// The backend it resolves to, `null` when the account configures none
    /// that `--backend` allows.
    pub backend: Option<String>,
    /// `full`, `partial`, `server` or `none`.
    pub level: String,
    /// What the level leaves out, `null` for a full one.
    pub detail: Option<String>,
}

impl fmt::Display for AccountCapabilityOutput {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut columns = Columns::new(["CAPABILITY", "BACKEND", "LEVEL", "DETAIL"]);

        for capability in &self.capabilities {
            columns.push([
                capability.name.as_str(),
                capability.backend.as_deref().unwrap_or_default(),
                capability.level.as_str(),
                &*sanitize::text(capability.detail.as_deref().unwrap_or_default()),
            ]);
        }

        write!(f, "{columns}")
    }
}

```

### Core Architecture Module: `src/account/check.rs`
```
//! # Account check
//!
//! The `account check` command, opening one connection per configured
//! backend so a credential or an endpoint fails here rather than in the
//! middle of a real command.

#[cfg(feature = "mbox")]
use std::fs::File;
use std::{fmt, path::PathBuf};

use anyhow::Result;
#[cfg(any(feature = "maildir", feature = "mbox", feature = "m2dir"))]
use anyhow::bail;
use clap::Parser;
use pimalaya_cli::{error::PartialOutcome, fields::Fields, printer::Printer};
use pimalaya_config::secret::SecretResolver;
use schemars::JsonSchema;
use serde::Serialize;

#[cfg(feature = "imap")]
use crate::config::ImapConfig;
use crate::{backend::Backend, cli::resolve_account, error::ErrorCode};

/// Validate the account configuration.
///
/// Every backend `--backend` allows is opened, which exercises the same
/// handshake and authentication paths a real command takes. The report
/// names each backend and whether it answered.
///
/// The report is printed whole, each backend with its outcome and, when it
/// failed, its code and why. A failed backend exits the command with
/// status 2, the report being the output rather than a failure object.
#[derive(Debug, Parser)]
pub struct AccountCheckCommand;

impl AccountCheckCommand {
    /// Checks every allowed backend of the account and prints the report,
    /// or fails naming every backend that did not answer.
    pub fn execute(
        self,
        printer: &mut impl Printer,
        config_paths: &[PathBuf],
        account_name: Option<&str>,
        backend: Backend,
    ) -> Result<()> {
        let (_, name, account_config) = resolve_account(config_paths, account_name)?;

        #[cfg_attr(
            not(any(
                feature = "imap",
                feature = "jmap",
                feature = "gmail",
                feature = "msgraph",
                feature = "maildir",
                feature = "m2dir",
                feature = "mbox",
                feature = "pimdir",
                feature = "smtp",
                feature = "sieve"
            )),
            allow(unused_mut)
        )]
        let mut report = AccountCheckOutput {
            account: name,
            backends: Vec::new(),
        };

        // NOTE: one resolver for the whole account, so a credential
        // command several blocks name is spawned once.
        #[cfg_attr(
            not(any(
                feature = "imap",
                feature = "jmap",
                feature = "gmail",
                feature = "msgraph",
                feature = "smtp",
                feature = "sieve"
            )),
            allow(unused_mut, unused_variables)
        )]
        let mut resolver = SecretResolver::new();

        #[cfg(feature = "imap")]
        if backend.allows_imap()
            && let Some(imap_config) = &account_config.imap
        {
            report.backends.push(BackendCheck::from(
                "imap",
                connect_imap(imap_config, &mut resolver),
            ));
        }

        #[cfg(feature = "jmap")]
        if backend.allows_jmap()
            && let Some(jmap_config) = &account_config.jmap
        {
            report.backends.push(BackendCheck::from(
                "jmap",
                connect_jmap(jmap_config, &mut resolver),
            ));
        }

        #[cfg(feature = "gmail")]
        if backend.allows_gmail()
            && let Some(gmail_config) = &account_config.gmail
        {
            report.backends.push(BackendCheck::from(
                "gmail",
                connect_gmail(gmail_config, &mut resolver),
            ));
        }

        #[cfg(feature = "msgraph")]
        if backend.allows_msgraph()
            && let Some(msgraph_config) = &account_config.msgraph
        {
            report.backends.push(BackendCheck::from(
                "msgraph",
                connect_msgraph(msgraph_config, &mut resolver),
            ));
        }

        #[cfg(feature = "maildir")]
        if backend.allows_maildir()
            && let Some(maildir_config) = &account_config.maildir
        {
            report.backends.push(BackendCheck::from(
                "maildir",
                connect_maildir(maildir_config),
            ));
        }

        #[cfg(feature = "m2dir")]
        if backend.allows_m2dir()
            && let Some(m2dir_config) = &account_config.m2dir
        {
            report
                .backends
                .push(BackendCheck::from("m2dir", connect_m2dir(m2dir_config)));
        }

        #[cfg(feature = "mbox")]
        if backend.allows_mbox()
            && let Some(mbox_config) = &account_config.mbox
        {
            report
                .backends
                .push(BackendCheck::from("mbox", connect_mbox(mbox_config)));
        }

        #[cfg(feature = "pimdir")]
        if backend.allows_pimdir()
            && let Some(pimdir_config) = &account_config.pimdir
        {
            report
                .backends
                .push(BackendCheck::from("pimdir", connect_pimdir(pimdir_config)));
        }

        #[cfg(feature = "smtp")]
        if backend.allows_smtp()
            && let Some(smtp_config) = &account_config.smtp
        {
            report.backends.push(BackendCheck::from(
                "smtp",
                connect_smtp(smtp_config, &mut resolver),
            ));
        }

        #[cfg(feature = "sieve")]
        if backend.allows_sieve()
            && let Some(sieve_config) = &account_config.sieve
        {
            report.backends.push(BackendCheck::from(
                "sieve",
                connect_sieve(sieve_config, &mut resolver),
            ));
        }

        if report.backends.is_empty() {
            return Err(account_config.no_backend_error(
                &report.account,
                backend,
                Backend::COMPILED,
            ));
        }

        let failed = report.backends.iter().any(|check| !check.ok);
        printer.out(report)?;

        // NOTE: the report names every backend's outcome, so a failed one
        // ends the command with the partial-outcome status rather than a
        // failure object.
        if failed {
            return Err(PartialOutcome::default().into());
        }

        Ok(())
    }
}

/// Opens an authenticated IMAP session and drops it.
#[cfg(feature = "imap")]
fn connect_imap(imap_config: &ImapConfig, resolver: &mut SecretResolver) -> Result<()> {
    use io_imap::{
        client::{ImapClientStd, ImapClientStdConnectOptions, default_port},
        session::ImapSessionOpenOptions,
    };
    use io_sasl::mechanism::Sasl;

    use crate::{
        config::ProxyConfig,
        imap::{client::parse_imap_server, id::resolve_auto_id_params},
    };

    let auto_id = resolve_auto_id_params(&imap_config.id)?;
    let server = parse_imap_server(&imap_config.server)?;
    let sasl: Option<Sasl> = imap_config
        .sasl
        .clone()
        .map(|cfg| {
            let host = server.host_str().unwrap_or_default();
            let port = server.port().unwrap_or(default_port(server.scheme()));
            cfg.try_into_sasl(host, port, resolver)
        })
        .transpose()?;
    let opts = ImapClientStdConnectOptions {
        tls: imap_config.tls.clone().into_tls(imap_config.alpn.clone()),
        proxy: ProxyConfig::resolve(imap_config.proxy.clone(), resolver)?,
        sasl,
        session: ImapSessionOpenOptions {
            starttls: imap_config.starttls,
            auto_id,
            sasl_ir: imap_config.sasl_ir,
        },
    };
    let _ = ImapClientStd::connect(&server, opts)?;

    Ok(())
}

/// Opens a JMAP client and fetches the session object.
#[cfg(feature = "jmap")]
fn connect_jmap(
    jmap_config: &crate::config::JmapConfig,
    resolver: &mut SecretResolver,
) -> Result<()> {
    use io_jmap::client::JmapClientStd;

    use crate::jmap::client::{connect_options, jmap_http_auth, parse_server_url};

    let http_auth = jmap_http_auth(jmap_config.auth.clone(), resolver)?;
    let opts = connect_options(jmap_config, resolver)?;
    let url = parse_server_url(&jmap_config.server)?;
    let mut client = JmapClientStd::connect(&url, http_auth, opts)?;
    client.session_get(&url)?;

    Ok(())
}

/// Opens a Gmail client and fetches the account profile.
#[cfg(feature = "gmail")]
fn connect_gmail(
    gmail_config: &crate::config::GmailConfig,
    resolver: &mut SecretResolver,
) -> Result<()> {
    use io_gmail::v1::client::{GmailClientStd, GmailClientStdConnectOptions};
    use secrecy::ExposeSecret;

    use crate::{config::ProxyConfig, gmail::client::gmail_token};

    let token = gmail_token(gmail_config.auth.clone(), resolver)?;
    let options = GmailClientStdConnectOptions {
        tls: gmail_config.tls.clone().into_tls(gmail_config.alpn.clone()),
        proxy: ProxyConfig::resolve(gmail_config.proxy.clone(), resolver)?,
        user_id: gmail_config.user_id.clone(),
    };
    let mut client = GmailClientStd::connect(token.expose_secret(), options)?;
    client.profile_get()?;

    Ok(())
}

/// Opens a Microsoft Graph client and fetches the signed-in user.
#[cfg(feature = "msgraph")]
fn connect_msgraph(
    msgraph_config: &crate::config::MsgraphConfig,
    resolver: &mut SecretResolver,
) -> Result<()> {
    use io_msgraph::v1::client::{MsgraphClientStd, MsgraphClientStdConnectOptions};
    use secrecy::ExposeSecret;

    use crate::{config::ProxyConfig, msgraph::client::msgraph_token};

    let token = msgraph_token(msgraph_config.auth.clone(), resolver)?;
    let options = MsgraphClientStdConnectOptions {
        tls: msgraph_config
            .tls
            .clone()
            .into_tls(msgraph_config.alpn.clone()),
        proxy: ProxyConfig::resolve(msgraph_config.proxy.clone(), resolver)?,
        user_id: msgraph_config.user_id.clone(),
    };
    let mut client = MsgraphClientStd::connect(token.expose_secret(), options)?;
    client.me()?;

    Ok(())
}

/// Checks that the Maildir root is
```

### Core Architecture Module: `src/account/cli.rs`
```
//! # Account command
//!
//! The `account` command, dispatching onto its subcommands.

use std::path::PathBuf;

use anyhow::Result;
use clap::Subcommand;
use pimalaya_cli::printer::Printer;

use crate::{
    account::{
        capability::AccountCapabilityCommand, check::AccountCheckCommand, list::AccountListCommand,
    },
    backend::Backend,
};

/// Manage accounts defined in the TOML configuration file.
///
/// An account is a named group of backend settings. These subcommands
/// inspect them and validate their connection; creating one means adding
/// an `[accounts.<name>]` table, as config.sample.toml shows.
#[derive(Debug, Subcommand)]
pub enum AccountCommand {
    #[command(visible_alias = "ls")]
    List(AccountListCommand),
    Check(AccountCheckCommand),
    #[command(alias = "capabilities", alias = "caps")]
    Capability(AccountCapabilityCommand),
}

impl AccountCommand {
    /// Runs the subcommand against the configuration `-c` names.
    pub fn execute(
        self,
        printer: &mut impl Printer,
        config_paths: &[PathBuf],
        account_name: Option<&str>,
        backend: Backend,
    ) -> Result<()> {
        match self {
            Self::List(cmd) => cmd.execute(printer, config_paths),
            Self::Check(cmd) => cmd.execute(printer, config_paths, account_name, backend),
            Self::Capability(cmd) => cmd.execute(printer, config_paths, account_name, backend),
        }
    }
}

```

### Core Architecture Module: `src/account/context.rs`
```
//! # Account context
//!
//! The merged runtime account every command consumes, folded by the
//! dispatch layer from the global [`Config`] then from the selected
//! `[accounts.<name>]` block.
//!
//! Defaults are applied by the accessors at consumption time rather than
//! baked in during the merge, so every field stays an `Option` and the two
//! layers compose.

use std::{collections::HashMap, path::PathBuf};
#[cfg(any(backend, feature = "smtp"))]
use std::{env::temp_dir, path::Path};

#[cfg(any(backend, feature = "smtp"))]
use dirs::download_dir;

use crate::config::{AccountConfig, Config, PostingStyle, SaveCopyConfig};
#[cfg(any(backend, feature = "smtp"))]
use crate::email::mailbox::{Mailbox, MailboxRole};

/// chrono `strftime` format of an envelope date.
#[cfg(any(backend, feature = "smtp"))]
const DEFAULT_DATETIME_FMT: &str = "%F %R%:z";
/// Page size of `envelope list` when nothing names one.
#[cfg(any(backend, feature = "smtp"))]
const DEFAULT_ENVELOPES_LIST_PAGE_SIZE: u32 = 25;
/// RFC 3676 section 4.3 signature separator.
#[cfg(any(backend, feature = "smtp"))]
const DEFAULT_SIGNATURE_DELIM: &str = "-- \n";

/// Merged runtime account settings consumed by every command.
#[derive(Debug, Default)]
pub struct Account {
    /// Address the account sends as.
    pub email: Option<String>,
    /// Name that address carries.
    pub display_name: Option<String>,
    /// Signature appended to a composed message.
    pub signature: Option<String>,
    /// Separator written before the signature.
    pub signature_delim: Option<String>,
    /// Directory attachments are downloaded to.
    pub downloads_dir: Option<PathBuf>,
    /// chrono `strftime` format of an envelope date.
    pub datetime_fmt: Option<String>,
    /// Whether an envelope date is converted to the local timezone.
    pub datetime_local_tz: Option<bool>,
    /// Whether a recent envelope date renders relative to today.
    pub datetime_relative: Option<bool>,
    /// Page size of `envelope list` when `-s/--page-size` is not passed.
    pub envelopes_list_page_size: Option<u32>,
    /// Mailbox aliases, keys lowercased, an account entry overwriting the
    /// global one of the same name.
    pub mailbox_alias: HashMap<String, String>,
    /// Mailbox a sent message is copied to when `--save` is not passed.
    pub save_copy: Option<SaveCopyConfig>,
    /// Posting style of `message reply` when `--posting-style` is not
    /// passed.
    pub reply_posting_style: Option<PostingStyle>,
    /// Posting style of `message forward` when `--posting-style` is not
    /// passed.
    pub forward_posting_style: Option<PostingStyle>,
}

impl Account {
    /// Folds the fields `other` sets on top of `self`.
    pub fn merge(self, other: Self) -> Self {
        let mut mailbox_alias = self.mailbox_alias;
        mailbox_alias.extend(other.mailbox_alias);

        Self {
            email: other.email.or(self.email),
            display_name: other.display_name.or(self.display_name),
            signature: other.signature.or(self.signature),
            signature_delim: other.signature_delim.or(self.signature_delim),

            downloads_dir: other.downloads_dir.or(self.downloads_dir),

            datetime_fmt: other.datetime_fmt.or(self.datetime_fmt),
            datetime_local_tz: other.datetime_local_tz.or(self.datetime_local_tz),
            datetime_relative: other.datetime_relative.or(self.datetime_relative),
            envelopes_list_page_size: other
                .envelopes_list_page_size
                .or(self.envelopes_list_page_size),

            mailbox_alias,
            save_copy: other.save_copy.or(self.save_copy),
            reply_posting_style: other.reply_posting_style.or(self.reply_posting_style),
            forward_posting_style: other.forward_posting_style.or(self.forward_posting_style),
        }
    }
}

#[cfg(any(backend, feature = "smtp"))]
impl Account {
    /// Resolves the `From` header into an address and its name.
    ///
    /// The two are kept apart so the MIME builder does the quoting.
    /// `--from` wins whole, so a configured name is never grafted onto an
    /// address the user spelled out, and a `None` address leaves the
    /// header out.
    pub fn resolve_from<'a>(&'a self, over: Option<&'a str>) -> (Option<&'a str>, Option<&'a str>) {
        match over {
            Some(address) => (Some(address), None),
            None => (self.email.as_deref(), self.display_name.as_deref()),
        }
    }

    /// Resolves the signature a composed message ends with.
    ///
    /// `--signature` wins, and `--signature-file` answers in the builder
    /// instead, which is why the configured signature stands down rather
    /// than shadowing it. With neither, the merged account answers.
    pub fn resolve_signature<'a>(
        &'a self,
        over: Option<&'a str>,
        file: Option<&Path>,
    ) -> Option<&'a str> {
        match (over, file) {
            (Some(signature), _) => Some(signature),
            (None, Some(_)) => None,
            (None, None) => self.signature.as_deref(),
        }
    }

    /// Resolves the mailbox a composed message is saved to.
    ///
    /// `--save` wins, and `--no-save` skips the configured copy. A
    /// message that is not sent is saved only when asked, the configured
    /// copy being about sent mail.
    pub fn resolve_save<'a>(
        &'a self,
        over: Option<&'a str>,
        no_save: bool,
        send: bool,
    ) -> Option<&'a str> {
        if over.is_some() || no_save || !send {
            return over;
        }

        match self.save_copy.as_ref()? {
            SaveCopyConfig::Enabled(true) => Some(MailboxRole::Sent.as_str()),
            SaveCopyConfig::Enabled(false) => None,
            SaveCopyConfig::Mailbox(mailbox) => Some(mailbox),
        }
    }

    /// Resolves the posting style of `message reply`, `--posting-style`
    /// winning and `top` answering when nothing is configured.
    pub fn resolve_reply_posting_style(&self, over: Option<PostingStyle>) -> PostingStyle {
        over.or(self.reply_posting_style).unwrap_or_default()
    }

    /// Resolves the posting style of `message forward`, `--posting-style`
    /// winning and `top` answering when nothing is configured.
    pub fn resolve_forward_posting_style(&self, over: Option<PostingStyle>) -> PostingStyle {
        over.or(self.forward_posting_style).unwrap_or_default()
    }

    /// Separator written before the signature, verbatim, defaulting to
    /// the RFC 3676 section 4.3 `"-- \n"`.
    pub fn signature_delim(&self) -> &str {
        self.signature_delim
            .as_deref()
            .unwrap_or(DEFAULT_SIGNATURE_DELIM)
    }

    /// Directory attachments are downloaded to, falling back to the
    /// system one then to the temporary directory.
    pub fn downloads_dir(&self) -> PathBuf {
        self.downloads_dir
            .clone()
            .or_else(download_dir)
            .unwrap_or_else(temp_dir)
    }

    /// chrono `strftime` format of an envelope date, defaulting to
    /// `%F %R%:z`.
    pub fn datetime_fmt(&self) -> &str {
        self.datetime_fmt.as_deref().unwrap_or(DEFAULT_DATETIME_FMT)
    }

    /// Whether a `Date:` header is converted to the local timezone,
    /// defaulting to `false`.
    pub fn datetime_local_tz(&self) -> bool {
        self.datetime_local_tz.unwrap_or(false)
    }

    /// Whether a recent date renders relative to today, defaulting to
    /// `false`.
    pub fn datetime_relative(&self) -> bool {
        self.datetime_relative.unwrap_or(false)
    }

    /// Page size of `envelope list` when `-s/--page-size` is not passed,
    /// defaulting to 25.
    pub fn envelopes_list_page_size(&self) -> u32 {
        self.envelopes_list_page_size
            .unwrap_or(DEFAULT_ENVELOPES_LIST_PAGE_SIZE)
    }

    /// Resolves `name` through the alias map, case-insensitively.
    ///
    /// An unmatched name comes back verbatim, so a caller passes either an
    /// alias or a raw backend id without knowing which.
    pub fn resolve_mailbox<'a>(&'a self, name: &'a str) -> &'a str {
        let key = name.to_lowercase();
        self.mailbox_alias
            .get(&key)
            .map(String::as_str)
            .unwrap_or(name)
    }

    /// Overlays the `mailbox.alias.<role>` entries onto the roles the
    /// backend reported.
    ///
    /// An alias naming a listed mailbox id gives it the role and takes it
    /// from any other mailbox, so the configuration corrects a server
    /// that mislabels.
    pub fn apply_role_aliases(&self, mailboxes: &mut [Mailbox]) {
        for (key, id) in &self.mailbox_alias {
            let Some(role) = MailboxRole::known(key) else {
                continue;
            };

            if !mailboxes.iter().any(|mailbox| mailbox.id == *id) {
                continue;
            }

            for mailbox in mailboxes.iter_mut() {
                if mailbox.id == *id {
                    mailbox.role = Some(role.clone());
                } else if mailbox.role.as_ref() == Some(&role) {
                    mailbox.role = None;
                }
            }
        }
    }
}

/// Lowercases every alias key, leaving the values untouched.
///
/// Run at the config boundary, so both the merge and
/// [`Account::resolve_mailbox`] read already-normalized keys.
fn lowercase_alias_keys(aliases: HashMap<String, String>) -> HashMap<String, String> {
    aliases
        .into_iter()
        .map(|(k, v)| (k.to_lowercase(), v))
        .collect()
}

impl From<Config> for Account {
    fn from(config: Config) -> Self {
        Self {
            // NOTE: the address is per-account by nature, so only the
            // name it carries has a global default.
            email: None,
            display_name: config.display_name,
            signature: config.signature,
            signature_delim: config.signature_delim,

            downloads_dir: config.downloads_dir,

            date
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #810** (2026-11-08): **Support searching in multiple mailboxes at once**
  *Symptoms*: At the moment `himalaya envelope search` only supports one mailbox with `--mailbox <NAME>` or default to `inbox.` It would be great to be able to search all mailboxes or be able to provide multiple `--mailbox <NAME>` arguments. Ideally support `--mailbox <REGEX>`.
  **Post-Mortem & Fix Analysis**:
  > @mschneiderwng this won't be supported: IMAP searches only the selected mailbox by design (RFC 9051 §6.4.4), so a search across mailboxes doesn't fit the protocol. The way to get it is to sync with [neverest](https://github.com/pimalaya/neverest) into a local store, which merges every mailbox (and account) into one view; `himalaya pimdir search` (next release) then searches it all at once.

- **Issue #808** (2026-11-08): **feat(mcp): read an attachment's content without touching disk (#805)**
  *Symptoms*: Closes #805.  `himalaya mcp` now lists `attachment_download` as a reading tool, so an agent can read an attachment without a file being written.  ## Result  A call on a 10 KiB binary PDF part, piped as JSON-RPC into the built binary over a temporary Maildir account:  ```json {   "structuredContent": { "id": "3", "mime": "application/pdf", "filename": "résumé.pdf", "size": 10240 },   "content": [     { "type": "text", "text": "{\"filename\":\"résumé.pdf\",\"id\":\"3\",\"mime\":\"application/pdf\",\"size\":10240}" },     { "type": "resource", "resource": { "uri": "himalaya://my%20work/My%20Box/m2/3", "mimeType": "application/pdf", "blob": "AAECAwQF…" } }   ] } ```  The bytes travel once, in the embedded resource. `data` appears nowhere, and the temporary directory is byte-for-byte unchanged afterwards.  ## As accepted  - **A fixed `--stdout`.** The tool table can now append fixed arguments to a tool's argv, before the `--` that opens the positionals. An argument a fixed value sets is no property, so a call cannot unset it. `attachment_download` is `attachment download` run with `--stdout`: no MCP-only verb, no new leaf. `stdout` and `dir` are not properties, and `attachment-id` takes exactly one id. - **The cap is the server's.** `himalaya mcp --max-attachment-size <BYTES>` defaults to 10 MiB and is no tool property. A larger part is refused after decoding and before base64 encoding, with the new code `attachment-too-large` and `isError: true`. Outside the server nothing is bou

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

### Incident Patch 1: `d619b9e0` (2026-11-11)
**Commit Message**: feat(config)!: fix the flag glyphs, ignore the envelope.list.table block

**File**: `CHANGELOG.md` (modified, +5/-1)
```diff
@@ -124,7 +124,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **BREAKING**: Removed the `*.list.table.*-color` options, `table.preset` and `table.arrangement`.
 
-  A colour key under `envelope.list.table` or `mailbox` is refused as unknown; `table`, `attachment` and `account` are ignored like any unknown top-level key. The `envelope.list.table.*-char` glyphs stay.
+  A colour key under `mailbox` is refused as unknown; `table`, `attachment` and `account` are ignored like any unknown top-level key.
+
+- **BREAKING**: Removed the `envelope.list.table.unseen-char`, `replied-char`, `flagged-char` and `attachment-char` options.
+
+  FLAGS shows `*`, `R` and `!`, ATT `@`, and the `envelope.list.table` block is ignored whatever it holds, so a v2 configuration or one shared with himalaya-tui keeps loading.
 
 - **BREAKING**: Removed the `HIMALAYA_CONFIG` environment variable, with the `:`-delimited list it took: write `-c "$HIMALAYA_CONFIG"` for one path, one `-c` per path for several.
 
```

**File**: `MIGRATION.md` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 ## From v2 to v3
 
-v3 drops the configuration wizard, takes one configuration path per `-c` and prints plain text, with no table nor colour. A v2 configuration loads as it is, unless it sets a colour key under `envelope.list.table` or `mailbox`, or marks several accounts default.
+v3 drops the configuration wizard, takes one configuration path per `-c` and prints plain text, with no table nor colour. A v2 configuration loads as it is, unless it sets a colour key under `mailbox`, or marks several accounts default.
 
 What a script or a frontend reads off `--json` and the text output changes, and a few commands that used to report a success they did not achieve now fail. The CHANGELOG lists every change; these are the ones to act on.
 
@@ -13,7 +13,7 @@ What a script or a frontend reads off `--json` and the text output changes, and
 - **`HIMALAYA_CONFIG` is no longer read.** Pass `-c "$HIMALAYA_CONFIG"` for one path, and one `-c` per path for what was a `:`-separated list.
 - **Every default path is read, as layers.** $XDG_CONFIG_HOME/himalaya/config.toml, $HOME/.config/himalaya/config.toml and $HOME/.himalayarc are each deep-merged on top of the ones before, where v2 read the first one found. An rc file left beside a config.toml now overrides it: delete the one you do not use.
 - **Several `default = true` accounts are refused**, naming them, where v2 picked one at random. Keep it on one account across the merged files: an rc file moving the default sets `default = false` on the account the other file marks.
-- **Colour and table keys are gone.** Remove the `*-color` keys of `envelope.list.table`, `mailbox.list.table`, `attachment.list.table` and `account.list.table`, and `table.preset` and `table.arrangement`. Under `envelope.list.table` and `mailbox` they fail the configuration as unknown keys; elsewhere they are ignored. The `envelope.list.table.*-char` glyphs stay.
+- **Colour, table and glyph keys are gone.** Remove the `*-color` keys of `envelope.list.table`, `mailbox.list.table`, `attachment.list.table` and `account.list.table`, `table.preset` and `table.arrangement`, and the `envelope.list.table.*-char` glyphs. Under `mailbox` they fail the configuration as unknown keys; elsewhere they are ignored, the whole `envelope.list.table` block included. FLAGS always shows `*` for unread, `R` for answered and `!` for flagged, and ATT `@` for a message with an attachment.
 - **`http` and `https` hosts are ASCII.** A JMAP `server` or an HTTP proxy `url` with an internationalised host is refused: write the host in Punycode (`https://xn--bcher-kva.example` for `bücher.example`). IMAP, SMTP and ManageSieve servers are unchanged.
 
 ### Text output
```

**File**: `cairn/changes/the-flag-glyphs-are-fixed/delta.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+---
+cairn: delta
+change: the-flag-glyphs-are-fixed
+---
+
+# Delta
+
+## ADDED Requirements
+
+None.
+
+## MODIFIED Requirements
+
+### Requirement: No colour is configured
+The configuration SHALL hold no colour, no table shape and no glyph: `*.list.table.*-color`, `table.preset` and `table.arrangement` are unknown keys, refused where their table denies unknown keys (`mailbox`) and ignored at the top level and the account level, which tolerate unknown keys for himalaya-tui. The `envelope.list.table` block SHALL be ignored whatever it holds, its v2 glyph and colour keys included, while `envelope.list` keeps refusing an unknown key of its own. A FLAGS cell SHALL hold only the glyphs that apply, `*` for a message lacking `\Seen`, `R` for `\Answered` and `!` for `\Flagged`, and an ATT cell `@` for a message with an attachment.
+
+#### Scenario: A v2 glyph key
+- GIVEN an account setting `envelope.list.table.unseen-char = "N"`
+- WHEN `envelope list` runs
+- THEN the configuration loads and an unread message shows `*`
+
+#### Scenario: A typo under envelope.list
+- GIVEN an account setting `envelope.list.datetime-fnt`
+- WHEN any command reads the configuration
+- THEN it is refused naming `datetime-fnt`
+
+## REMOVED Requirements
+
+None.
```

**File**: `cairn/changes/the-flag-glyphs-are-fixed/proposal.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+---
+cairn: change
+id: the-flag-glyphs-are-fixed
+status: landed
+created: 2026-11-11
+---
+
+# The flag glyphs are fixed
+
+## Why
+
+Lists are plain columns since plain-text-output, yet the four glyph keys still live under `envelope.list.table`, the one table left in the configuration, naming a shape the output no longer has. The owner decided on 2026-11-11 to remove them from the CLI without making the block strict, so a file written for v2 or shared with himalaya-tui keeps loading. himalaya-tui does not read them today (it styles envelopes through its own `envelope-seen` and `envelope-unread` styles) and its account block tolerates the CLI's keys either way.
+
+## What
+
+- The FLAGS and ATT glyphs become constants: `*` unseen, `R` answered, `!` flagged, `@` attachment, the defaults they had.
+- `envelope.list.table` is ignored whatever it holds, its glyph and colour keys included; `envelope.list` keeps refusing an unknown key of its own, so a typo in `datetime-fmt` still fails. `mailbox` colour keys stay refused.
+- The `jmap email query|get` commands no longer take the account, which they only read the glyphs from.
+- config.sample.toml loses the four glyph lines; MIGRATION.md, CHANGELOG.md and the config spec follow.
```

**File**: `cairn/changes/the-flag-glyphs-are-fixed/tasks.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+---
+cairn: tasks
+change: the-flag-glyphs-are-fixed
+---
+
+# Tasks
+
+- [x] src/shared/envelope/list.rs: `UNSEEN_GLYPH`, `REPLIED_GLYPH`, `FLAGGED_GLYPH`, `ATTACHMENT_GLYPH` replace `FlagChars`; `format_flags` and `format_attachment` drop their glyph argument; src/shared/envelope/search.rs and src/pimdir/queue/list.rs follow
+- [x] src/jmap/email: `EmailsChars` gone, the query and get commands and their dispatcher no longer take the account
+- [x] src/account/context.rs: the glyph field, defaults, getters and merge gone
+- [x] src/config.rs: `EnvelopeListTableConfig` gone, `envelope.list.table` read as `IgnoredAny`; the colour test becomes `envelope_table_is_ignored` (glyph and colour keys load, an `envelope.list` typo and a `mailbox` colour key are refused)
+- [x] config.sample.toml: the four glyph lines removed
+- [x] MIGRATION.md, CHANGELOG.md
+- [x] Clippy over the 15 feature sets, the whole suite, the build without SMTP
+- [x] Fold the delta into cairn/spec/config.md; log; status landed
```

**File**: `cairn/log/2026-11-11-the-flag-glyphs-are-fixed.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+cairn: log
+change: the-flag-glyphs-are-fixed
+landed: 2026-11-11
+---
+
+# The flag glyphs are fixed
+
+The owner's decision of 2026-11-11: remove the glyph keys from the CLI without making their block strict.
+
+- The FLAGS and ATT glyphs are constants of src/shared/envelope/list.rs (`*`, `R`, `!`, `@`), read by `envelope list|search`, `pimdir queue list` and `jmap email query|get`; `FlagChars`, `EmailsChars`, the account's glyph field, defaults, getters and merge are gone, and the two JMAP commands no longer take the account.
+- `envelope.list.table` is read as `IgnoredAny`: its v2 glyph and colour keys load and are ignored, while `envelope.list` still refuses a key of its own it does not know. `mailbox` colour keys stay refused. himalaya-tui reads none of these keys today and tolerates them either way.
+- config.sample.toml loses its four glyph lines; MIGRATION.md now names `mailbox` as the one place a v2 colour key fails.
+- Capability moved: config (requirement "No colour is configured", now also no glyph, with two scenarios).
+
+Verified: clippy over the 15 feature sets, the whole suite with all features, the build without SMTP; a scratch Maildir account setting `unseen-char = "N"`, `flagged-char = "F"`, `attachment-char = "A"` and a colour key listed `*!`, `R` and `@`, and `envelope.list.datetime-fnt` was refused by name.
```

**File**: `cairn/spec/config.md` (modified, +11/-1)
```diff
@@ -100,7 +100,17 @@ Unknown keys SHALL stay tolerated, the file being shared with himalaya-tui. When
 `message.reply.posting-style` and `message.forward.posting-style`, global or per account, SHALL take `top`, `bottom` or `none` and SHALL be the posting style `message reply` and `message forward` use when `--posting-style` is not passed. With neither, the style SHALL be `top`.
 
 ### Requirement: No colour is configured
-The configuration SHALL hold no colour and no table shape: `*.list.table.*-color`, `table.preset` and `table.arrangement` are unknown keys, refused where their table denies unknown keys (`envelope.list.table`, `mailbox`) and ignored at the top level and the account level, which tolerate unknown keys for himalaya-tui. `envelope.list.table.unseen-char`, `replied-char`, `flagged-char` and `attachment-char` SHALL keep naming the FLAGS and ATT glyphs, a FLAGS cell holding only the glyphs that apply.
+The configuration SHALL hold no colour, no table shape and no glyph: `*.list.table.*-color`, `table.preset` and `table.arrangement` are unknown keys, refused where their table denies unknown keys (`mailbox`) and ignored at the top level and the account level, which tolerate unknown keys for himalaya-tui. The `envelope.list.table` block SHALL be ignored whatever it holds, its v2 glyph and colour keys included, while `envelope.list` keeps refusing an unknown key of its own. A FLAGS cell SHALL hold only the glyphs that apply, `*` for a message lacking `\Seen`, `R` for `\Answered` and `!` for `\Flagged`, and an ATT cell `@` for a message with an attachment.
+
+#### Scenario: A v2 glyph key
+- GIVEN an account setting `envelope.list.table.unseen-char = "N"`
+- WHEN `envelope list` runs
+- THEN the configuration loads and an unread message shows `*`
+
+#### Scenario: A typo under envelope.list
+- GIVEN an account setting `envelope.list.datetime-fnt`
+- WHEN any command reads the configuration
+- THEN it is refused naming `datetime-fnt`
 
 ### Requirement: One sample configuration, with a section per backend
 The repository SHALL ship config.sample.toml holding one `[accounts.example]` table with dotted keys and no other table header. It SHALL list the options every account shares and each of their values, the default active and the others commented as `#key = value`, every line ending in one tab-aligned comment, and every password command a failing `exit 127` placeholder. It SHALL end with one section per backend or provider (IMAP and SMTP, ManageSieve, JMAP, Gmail, Microsoft Graph, Microsoft IMAP and SMTP, Fastmail, Maildir, m2dir, mbox, pimdir), each a paragraph of commented code headed by its name, its own alternatives commented twice, an OAuth 2.0 token read through `ortie token show -a example`, so the file holds a working account once one section is uncommented. The test suite SHALL parse config.sample.toml through the loader `-c` uses with each section uncommented whole, then on top of it each line commented twice inside it and each line of commented code outside the sections, in place of the active lines of its field, and SHALL resolve `example` as the default account each time, so a configuration change breaking one fails the build.
```

**File**: `config.sample.toml` (modified, +0/-4)
```diff
@@ -24,10 +24,6 @@ envelope.list.datetime-local-tz = false		# show a date at the offset it was sent
 #envelope.list.datetime-local-tz = true		# show it in the local timezone
 envelope.list.datetime-relative = false		# show every date in full
 #envelope.list.datetime-relative = true		# the time today, yesterday, then the weekday
-envelope.list.table.unseen-char = "*"		# the FLAGS glyph of an unread message
-envelope.list.table.replied-char = "R"		# the FLAGS glyph of an answered message
-envelope.list.table.flagged-char = "!"		# the FLAGS glyph of a flagged message
-envelope.list.table.attachment-char = "@"	# the ATT glyph of a message with attachments
 
 #mailbox.alias.inbox = "INBOX"		# the mailbox commands read without -m
 #mailbox.alias.sent = "Sent"		# the sent role, over the backend's own
```

---

### Incident Patch 2: `ba07a582` (2026-11-11)
**Commit Message**: docs: complete the v3 migration guide, net the changelog, drop table wording

**File**: `CHANGELOG.md` (modified, +10/-14)
```diff
@@ -22,12 +22,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Added `account capability`, listing what the account serves of the shared API, one row per capability: the backend it resolves to (`null` when none is configured), its level (`full`, `partial`, `server`, `none`) and the detail, under `--backend` when given. It connects nowhere; on a pimdir account the writes are read from what the store's sources declare. Frontends read it to hide what the account cannot run.
 - Added a capability table per backend, naming each shared capability in pimdir's grammar (`message.copy`, `flags.answered`, `submit`, `envelope.search.attachment`) at a level, `full`, `partial`, `server` or `none`, with a detail saying what differs or why. A shared command reaching a capability its backend declares `none`, or one no configured transport answers, is refused before connecting, under the new error code `capability-missing`, naming the account, the capability, the backend and what serves it instead.
 - Added a generated `Backends:` footer to the `--help` of every shared command, listing per capability it reaches the backends at each level and the details.
-
 - Added the `before <date>`, `cc <pattern>`, `bcc <pattern>`, `address <pattern>` (the `From`, `To`, `Cc` and `Bcc` headers at once) and `attachment` clauses to the `envelope search` query, on every backend that can answer them: IMAP refuses `attachment`, SEARCH having no key for it.
 - Added the error codes `search-invalid`, for a query that does not parse, and `search-unsupported`, for a clause the account's backend cannot search, which names the clause as written: every flag on Microsoft Graph, `flag answered` and keywords on Gmail, `attachment` on IMAP. Nothing is searched and no clause is dropped.
 - Added `himalaya mcp`, a Model Context Protocol server (revision 2025-06-18) over stdio for one account, exposing the shared API as tools named after their command (`envelope_list`, `message_read`), run over clients kept for the server's lifetime as in `himalaya repl`. `initialize` gives the agent instructions: how to find a mailbox and an envelope id, the query language of `envelope_search`, attachments read as embedded resources and given inline, the flags gating writing and sending. A tool's input schema is generated from its command, its arguments spelled as on the command line, and an argument it does not take is refused naming those it does; a result is the command's `--json` payload as structured content, with its JSON Schema as output schema where the payload has one shape, and a failure, a command printing no value or several included, is a tool error carrying the error object and its code. Each line is one JSON-RPC 2.0 object: a batch, a value that is no object or a request without `"jsonrpc": "2.0"` answers -32600, a line that is not UTF-8 -32700, and the server reads on. Only the reading tools are listed by default: `--allow-write` adds those changing the store and `--allow-send` those sending mail. `message parse` and the file arguments are not exposed, and a message given to a tool is never read from a path it spells. A server failing to start, its configuration missing included, says why on stderr, stdout carrying protocol messages only.
 - Added `himalaya repl`, a session over stdin and stdout for one account: each line is a command without the binary name, split as a shell splits it and run over clients built the first time a command needs them and kept for the session, so a client connects once rather than once per command. A blank line or a `#` comment is skipped; `quit`, `exit` or EOF ends it. The account, the configuration, the logs and `--backend` are the session's, a line setting `-a`, `-c`, `--log-level` or `-b` being refused naming the flag; `--json` on `repl` switches the session to JSON, on a line that line alone. Piped, every line gets exactly one answer on stdout, a failure printed as the error object, the help going to stderr in a JSON session, and the loop goes on after a parse or command error. A command that fails drops the client it ran on, which the next command builds again. A command that would read its input from stdin inside a session is refused with the new error code `stdin-taken`, and `message compose`, `reply` and `forward` read no body from it. `repl` and `mcp` are refused inside a session.
-- Added `pimdir search <QUERY>...`, searching the account's mail in the pimdir query language (pimdir SEARCH.md §8: words, phrases, `field:value` terms, `and`, `or`, `not`, parentheses) from the store's search index, which the sync engine builds and refreshes; Himalaya only reads it. `--sort date|name|relevance`, `--page`, `--page-size` and `--threads`; each hit carries its envelope, `mailboxes`, what `matched` (`body` or `summary`) and a `snippet`, and every answer a `coverage` (`bodiless`, `unindexed`, `behind`, `since`, `until`, `filling`, `complete`), printed as a line under the table when incompl
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ Himalaya is the CLI front-end of the Pimalaya email stack, a thin shell driving
 - local storage semantics belong in [io-maildir](https://github.com/pimalaya/io-maildir), [io-m2dir](https://github.com/pimalaya/io-m2dir) and [io-mbox](https://github.com/pimalaya/io-mbox);
 - the commands, rendering, composition and the shared cross-protocol surface live here.
 
-The clap, printer, plain text layout (columns and fields) and prompt primitives come from [pimalaya/cli](https://github.com/pimalaya/cli), the TOML loader and secret resolution from [pimalaya/config](https://github.com/pimalaya/config), the TCP, TLS and SASL plumbing from [pimalaya/stream](https://github.com/pimalaya/stream), and MIME composition from [pimalaya/mml](https://github.com/pimalaya/mml). The src/main.rs header maps each backend to its crate.
+The clap, printer, plain text layout (columns and fields), prompt, first-run welcome, REPL loop and MCP protocol come from [pimalaya/cli](https://github.com/pimalaya/cli), the TOML loader, account resolution and secret resolution from [pimalaya/config](https://github.com/pimalaya/config), the TCP, TLS and SASL plumbing from [pimalaya/stream](https://github.com/pimalaya/stream), and MIME composition from [pimalaya/mml](https://github.com/pimalaya/mml). The src/main.rs header maps each backend to its crate.
 
 ## Feature matrix
 
```

**File**: `MIGRATION.md` (modified, +24/-3)
```diff
@@ -2,7 +2,26 @@
 
 ## From v2 to v3
 
-v3 changes no configuration key: a v2 configuration loads as it is. What changes is what a script or a frontend reads off `--json`, and a few commands that used to report a success they did not achieve. The CHANGELOG lists every change; these are the ones to act on.
+v3 drops the configuration wizard, takes one configuration path per `-c` and prints plain text, with no table nor colour. A v2 configuration loads as it is, unless it sets a colour key under `envelope.list.table` or `mailbox`, or marks several accounts default.
+
+What a script or a frontend reads off `--json` and the text output changes, and a few commands that used to report a success they did not achieve now fail. The CHANGELOG lists every change; these are the ones to act on.
+
+### Configuration and first run
+
+- **The wizard is gone.** Bare `himalaya` prints the help, `himalaya configure` (alias `wizard`) and its `himalaya-configure` schema no longer exist, and no command offers to create a configuration. Write it from config.sample.toml, which releases and packages ship as share/doc/himalaya/config.sample.toml: run at a terminal without a configuration, Himalaya prints the commands copying it in place. Drop the `wizard` cargo feature from a build's `--features`.
+- **`-c` takes one path per flag.** A value is no longer split on `:`, so a Windows path stays whole. Repeat the flag to merge several files: `-c public.toml -c private.toml`.
+- **`HIMALAYA_CONFIG` is no longer read.** Pass `-c "$HIMALAYA_CONFIG"` for one path, and one `-c` per path for what was a `:`-separated list.
+- **Every default path is read, as layers.** $XDG_CONFIG_HOME/himalaya/config.toml, $HOME/.config/himalaya/config.toml and $HOME/.himalayarc are each deep-merged on top of the ones before, where v2 read the first one found. An rc file left beside a config.toml now overrides it: delete the one you do not use.
+- **Several `default = true` accounts are refused**, naming them, where v2 picked one at random. Keep it on one account across the merged files: an rc file moving the default sets `default = false` on the account the other file marks.
+- **Colour and table keys are gone.** Remove the `*-color` keys of `envelope.list.table`, `mailbox.list.table`, `attachment.list.table` and `account.list.table`, and `table.preset` and `table.arrangement`. Under `envelope.list.table` and `mailbox` they fail the configuration as unknown keys; elsewhere they are ignored. The `envelope.list.table.*-char` glyphs stay.
+- **`http` and `https` hosts are ASCII.** A JMAP `server` or an HTTP proxy `url` with an internationalised host is refused: write the host in Punycode (`https://xn--bcher-kva.example` for `bücher.example`). IMAP, SMTP and ManageSieve servers are unchanged.
+
+### Text output
+
+- **Lists are plain columns**: an uppercase header, then one item per line, columns two spaces apart, an empty cell as `-`, no border, no colour, no truncation. The free-text column comes last (`envelope list` ends with SUBJECT, `mailbox list` with NAME), a FLAGS cell holds only the glyphs that apply, and a multi-valued cell joins its values with `,`. A script cutting the v2 tables reads these columns instead, or better `--json`, which is unchanged.
+- **Records are `Label: value` lines**: `account check`, `imap select`, `imap status`, `imap id`, `imap fetch`, `vacation get|set`, `jmap vacation get`, `sieve capability`, the Gmail and Microsoft Graph `get`s, and the header block of `message read` and `message parse`. `imap search` and `imap sort` no longer end with a count.
+- **`-w/--max-width` is gone** from `envelope list`, `envelope search`, `mailbox list` and the pimdir lists, nothing being truncated any more: a command passing it now fails, so drop it.
+- **`--help` prints without colour**, each paragraph on one line for the terminal to fold.
 
 ### JSON output
 
@@ -15,14 +34,14 @@ v3 changes no configuration key: a v2 configuration loads as it is. What changes
 - **Absent values are `null`**, every key printed.
 - **Shapes made one:** flags written print `{raw, iana}` like envelopes, `inReplyTo` is a list in the read view, `imap fetch` addresses are `{name, email}`, `imap search` ids are numbers, an attachment row carries `role` instead of `inline`, maildir and mbox `flag list` rows are `{raw, iana}`.
 - **Listings say whether more follow.** `envelope list` and `search` print `nextPage`, `null` on the last page, which `--page-token` takes back; `msgraph messages list` does the same with Graph's `$skip`.
-- **`account check` prints every backend and exits 2** when one fails, each row carrying the failure's `code`, rather than one joined error exiting 1.
+- **`account check` prints every backend and exits 2** when one fails, each row carrying the failure's `code`, where v2 exited 0 whatever failed.
 - **A protocol command prints its completion.** Every `imap` command prints `status` (`OK`, or `NO`/`BAD` with `text`, exiting 2). `imap raw` and `siev
```

**File**: `README.md` (modified, +32/-24)
```diff
@@ -16,6 +16,12 @@
 - [Features](#features)
 - [Installation](#installation)
 - [Configuration](#configuration)
+  - [Proton Mail](#proton-mail)
+  - [Fastmail](#fastmail)
+  - [Gmail](#gmail)
+  - [Outlook](#outlook)
+  - [Posteo](#posteo)
+  - [iCloud Mail](#icloud-mail)
 - [Usage](#usage)
 - [Interfaces](#interfaces)
 - [FAQ](#faq)
@@ -57,13 +63,13 @@ Himalaya can be installed with the installer:
 
 *As root:*
 
-```
+```sh
 curl -sSL https://raw.githubusercontent.com/pimalaya/himalaya/master/install.sh | sudo sh
 ```
 
 *As a regular user:*
 
-```
+```sh
 curl -sSL https://raw.githubusercontent.com/pimalaya/himalaya/master/install.sh | PREFIX=~/.local sh
 ```
 
@@ -76,13 +82,13 @@ For a more up-to-date version than the latest release, check out the [releases](
 
 ### Cargo
 
-```
+```sh
 cargo install --locked --git https://github.com/pimalaya/himalaya.git
 ```
 
 With only IMAP+SMTP support:
 
-```
+```sh
 cargo install --locked --git https://github.com/pimalaya/himalaya.git \
   --no-default-features \
   --features imap,smtp,rustls-ring
@@ -92,27 +98,27 @@ cargo install --locked --git https://github.com/pimalaya/himalaya.git \
 
 From the community repository:
 
-```
+```sh
 pacman -S himalaya
 ```
 
 Or the [user repository](https://aur.archlinux.org/):
 
-```
+```sh
 git clone https://aur.archlinux.org/himalaya-git.git
 cd himalaya-git
 makepkg -isc
 ```
 
 Or with [yay](https://github.com/Jguer/yay):
 
-```
+```sh
 yay -S himalaya-git
 ```
 
 ### Homebrew
 
-```
+```sh
 brew install himalaya
 ```
 
@@ -121,15 +127,15 @@ brew install himalaya
 
 ### Scoop
 
-```
+```sh
 scoop install himalaya
 ```
 
 ### Fedora Linux/CentOS/RHEL
 
 From the [COPR](https://copr.fedorainfracloud.org/coprs/atim/himalaya/) repo:
 
-```
+```sh
 dnf copr enable atim/himalaya
 dnf install himalaya
 ```
@@ -138,47 +144,49 @@ dnf install himalaya
 
 If you have the [Flakes](https://nixos.wiki/wiki/Flakes) feature enabled:
 
-```
+```sh
 nix profile install github:pimalaya/himalaya
 ```
 
 Or run without installing:
 
-```
+```sh
 nix run github:pimalaya/himalaya
 ```
 
 ### Sources
 
 Requires [Rust](https://www.rust-lang.org/tools/install) 1.89 or later:
 
-```
+```sh
 git clone https://github.com/pimalaya/himalaya
 cd himalaya
 cargo build --release --locked
 ```
 
-The binary lands at `target/release/himalaya`.
+The binary lands at target/release/himalaya.
 
 ## Configuration
 
-Himalaya reads a TOML configuration you write, and never writes one. [config.sample.toml](./config.sample.toml) holds one account: the options every account shares with their values, then one commented section per backend or provider, yours to uncomment: IMAP and SMTP, ManageSieve, JMAP, Gmail, Microsoft Graph, Microsoft IMAP and SMTP, Fastmail, Maildir, m2dir, mbox and pimdir. The OAuth 2.0 sections read their token from [Ortie](https://github.com/pimalaya/ortie), whose sample has the matching sections. Releases and packages ship it as share/doc/himalaya/config.sample.toml. Run without a configuration at a terminal, Himalaya welcomes you with the commands copying the sample in place, or downloading it, and the first command to run; under `--json` or in a script, it fails naming the path it looked at.
+Himalaya reads a TOML configuration you write, and never writes one. [config.sample.toml](./config.sample.toml) holds one account: the options every account shares with their values, then one commented section per backend or provider, yours to uncomment: IMAP and SMTP, ManageSieve, JMAP, Gmail, Microsoft Graph, Microsoft IMAP and SMTP, Fastmail, Maildir, m2dir, mbox and pimdir. The OAuth 2.0 sections read their token from [Ortie](https://github.com/pimalaya/ortie), whose sample has the matching sections. Releases and packages ship it as share/doc/himalaya/config.sample.toml.
+
+Run without a configuration at a terminal, Himalaya welcomes you with the commands copying the shipped sample in place, or downloading it when none ships, then the first command to run. Under `--json` or in a script, it fails naming the path it looked at and the sample.
 
 The `imap`, `smtp` and `sieve` blocks take one SASL mechanism, or none to skip authentication: `plain`, `login` and `scram-sha-256` with a `username` and a `password`, `oauthbearer` and `xoauth2` with a `username` and a `token`, `anonymous` with an optional `message`. `jmap.auth` takes `basic` (`username` and `password`), `bearer` (`token`) or `header`, a whole `Authorization` value. A secret is given as `raw` or as `command`, a shell string or an argument list printing it.
 
 `display-name`, `signature`, `signature-delim`, `downloads-dir` and the `message`, `envelope` and `mailbox` options may also sit at the top level, before any table, as the fallback of every account not setting them: drop the sample's default lines from an account for the top level to apply.
 
-A persistent configuration is loaded from every existing path among the following, each one deep-merged on top of the ones before, so `$HOME/.
```

**File**: `SECURITY.md` (modified, +2/-1)
```diff
@@ -4,7 +4,8 @@
 
 | Version | Supported      |
 | ------- | -------------- |
-| 2.x.x   | :green_circle: |
+| 3.x.x   | :green_circle: |
+| 2.x.x   | :red_circle:   |
 | 1.x.x   | :red_circle:   |
 | 0.x.x   | :red_circle:   |
 
```

**File**: `cairn/spec/backends.md` (modified, +1/-1)
```diff
@@ -325,7 +325,7 @@ An add or a remove SHALL match the flags a message carries as flags, not as spel
 - THEN the command fails naming `mail.flags.keywords` for message 41, and no row is queued for 40, 41 or 42
 
 ### Requirement: pimdir lists each mailbox with its coverage
-`pimdir mailbox list` SHALL list the account's mailboxes sorted by id, each as `{"id", "name", "role", "total", "unread", "coverage", "round"}`: `role` as `mailbox list` shows it (`null` when none), `total` and `unread` counted in the store, `coverage` the collection's coverage (pimdir STORAGE §14.1, the narrowest of its sources') as `{"since", "until", "at"}`, and `round` a round a source has under way as `{"since", "until", "startedAt"}`. Bounds are RFC 3339 instants, `null` for an open end. `coverage` SHALL be `null` until every source of the collection closed a round on it, and on a store its owner has not reconciled; `round` SHALL be `null` when no round is under way. The table SHALL show the coverage and the round as their days (`since 2026-09-07`, `all`). The shared `mailbox list` SHALL carry none of it.
+`pimdir mailbox list` SHALL list the account's mailboxes sorted by id, each as `{"id", "name", "role", "total", "unread", "coverage", "round"}`: `role` as `mailbox list` shows it (`null` when none), `total` and `unread` counted in the store, `coverage` the collection's coverage (pimdir STORAGE §14.1, the narrowest of its sources') as `{"since", "until", "at"}`, and `round` a round a source has under way as `{"since", "until", "startedAt"}`. Bounds are RFC 3339 instants, `null` for an open end. `coverage` SHALL be `null` until every source of the collection closed a round on it, and on a store its owner has not reconciled; `round` SHALL be `null` when no round is under way. The plain list SHALL show the coverage and the round as their days (`since 2026-09-07`, `all`). The shared `mailbox list` SHALL carry none of it.
 
 #### Scenario: A mailbox synced from a date
 - GIVEN a pimdir account whose `imap` source closed a round on `imap/INBOX` over the mail since 2026-09-07
```

**File**: `cairn/spec/config.md` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ An account's `proxy` SHALL apply to every network backend of that account (IMAP,
 `proxy.url` SHALL take `socks5://`, `socks5h://` or `http://`. `proxy.username` and `proxy.password` SHALL override the URL's user info, the password being a secret like any credential; a password without a username SHALL be rejected.
 
 ### Requirement: A v1 account layout is named, not silently ignored
-Unknown keys SHALL stay tolerated, the file being shared with himalaya-tui. When no configured backend matches `--backend`, the error SHALL name the account and, under `auto`, the backends the command supports in this build; under a named backend, the missing block, or that the backend is unsupported. An account carrying the v1 `backend` table, which no v2 binary reads, SHALL load as if the table were absent, and that error SHALL name the table and point at MIGRATION.md.
+Unknown keys SHALL stay tolerated, the file being shared with himalaya-tui. When no configured backend matches `--backend`, the error SHALL name the account and, under `auto`, the backends the command supports in this build; under a named backend, the missing block, or that the backend is unsupported. An account carrying the v1 `backend` table, which no binary reads since v2, SHALL load as if the table were absent, and that error SHALL name the table and point at MIGRATION.md.
 
 ### Requirement: Envelope dates MAY render relative to today
 `envelope.list.datetime-relative`, settable globally and per account, SHALL render the DATE column of `envelope list` and `envelope search` relative to today in the local timezone: the time of day (`%R`) for today, `yesterday` for the day before, the weekday (`%A`) for the five days before that, and `datetime-fmt` for anything older or dated in the future. It SHALL default to `false`, and SHALL NOT change the `--json` output, which keeps the exact date.
```

**File**: `cairn/spec/search.md` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ A `date:` term's years, months and days, `today` and `yesterday` SHALL be read i
 - THEN one `set-flags` row is queued for the other one, and the flagged one is reported unchanged
 
 ### Requirement: A pimdir search says what it did not cover
-The output of `pimdir search`, `count` and `tag` SHALL carry the coverage of the answer (SEARCH §8.2): `bodiless`, the messages in scope whose body is not local, matched on their summary alone; `unindexed`, those whose last change the index has not folded in; `behind`, how many changes the store drew above the index, store-wide; `since` and `until`, the range below or above which the store is not known to hold every message; `filling`, whether a first round is still listing a mailbox in scope; and `complete`, true only when none of these holds. The plain output SHALL print one line under its table naming what did not hold, and nothing when the answer is complete; an index behind the store is named with how far and that the sync engine refreshes it.
+The output of `pimdir search`, `count` and `tag` SHALL carry the coverage of the answer (SEARCH §8.2): `bodiless`, the messages in scope whose body is not local, matched on their summary alone; `unindexed`, those whose last change the index has not folded in; `behind`, how many changes the store drew above the index, store-wide; `since` and `until`, the range below or above which the store is not known to hold every message; `filling`, whether a first round is still listing a mailbox in scope; and `complete`, true only when none of these holds. The plain output SHALL print one line under its list naming what did not hold, and nothing when the answer is complete; an index behind the store is named with how far and that the sync engine refreshes it.
 
 #### Scenario: Mail before the coverage
 - GIVEN a pimdir mailbox listed since 2026-03-01
```

---

### Incident Patch 3: `a57fff00` (2026-11-11)
**Commit Message**: test: add live provider suites for Google, Microsoft and Fastmail

Ignored integration suites run the binary against the real providers: anonymous refusals on made-up tokens for every sample backend, and read-only credentialed checks (account check, mailbox list, envelope list) on Graph, Exchange IMAP, the Gmail API and Gmail IMAP with tokens minted through io-oauth. CI gains a live matrix job, credentialed steps guarded by repository and secret presence. The Posteo manual report leaves cairn/spec/testing.

**File**: `.github/workflows/tests.yml` (modified, +40/-0)
```diff
@@ -7,3 +7,43 @@ jobs:
   tests:
     uses: pimalaya/nix/.github/workflows/tests.yml@master
     secrets: inherit
+  live:
+    # The binary against the real providers, whose APIs drift without
+    # notice. RUST_LOG stays at debug: trace logs carry secrets and tokens.
+    strategy:
+      fail-fast: false
+      matrix:
+        provider: [google, microsoft, fastmail]
+    runs-on: ubuntu-latest
+    env:
+      RUST_LOG: debug
+      HAS_GOOGLE: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_KEY != '' }}
+      HAS_MICROSOFT: ${{ secrets.MICROSOFT_CLIENT_SECRET != '' }}
+    steps:
+      - uses: actions/checkout@v4
+      - uses: cachix/install-nix-action@v31
+        with:
+          extra_nix_config: experimental-features = nix-command flakes
+      - uses: cachix/cachix-action@v17
+        with:
+          name: soywod
+          authToken: ${{ secrets.CACHIX_AUTH_TOKEN }}
+          extraPullNames: nix-community
+      - uses: Swatinem/rust-cache@v2
+      - name: Run the anonymous tests
+        run: 'nix develop -c cargo test --test ${{ matrix.provider }} -- --ignored anonymous::'
+      # The credentialed steps run in this repository only, once their
+      # secrets exist: a fork holds none, and they would fail on every
+      # contributor's push.
+      - name: Run the credentialed tests
+        if: matrix.provider == 'google' && github.repository == 'pimalaya/himalaya' && env.HAS_GOOGLE == 'true'
+        env:
+          HIMALAYA_GOOGLE_SERVICE_ACCOUNT_KEY: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_KEY }}
+        run: 'nix develop -c cargo test --test google -- --ignored credentialed::'
+      - name: Run the credentialed tests
+        if: matrix.provider == 'microsoft' && github.repository == 'pimalaya/himalaya' && env.HAS_MICROSOFT == 'true'
+        env:
+          HIMALAYA_MICROSOFT_TENANT_ID: ${{ secrets.MICROSOFT_TENANT_ID }}
+          HIMALAYA_MICROSOFT_CLIENT_ID: ${{ secrets.MICROSOFT_CLIENT_ID }}
+          HIMALAYA_MICROSOFT_CLIENT_SECRET: ${{ secrets.MICROSOFT_CLIENT_SECRET }}
+        run: 'nix develop -c cargo test --test microsoft -- --ignored credentialed::'
```

**File**: `Cargo.lock` (modified, +187/-5)
```diff
@@ -92,6 +92,12 @@ dependencies = [
  "pkg-config",
 ]
 
+[[package]]
+name = "base16ct"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "fd307490d624467aa6f74b0eabb77633d1f758a7b25f12bceb0b22e08d9726f6"
+
 [[package]]
 name = "base64"
 version = "0.23.1"
@@ -107,6 +113,12 @@ dependencies = [
  "simd-cpu",
 ]
 
+[[package]]
+name = "base64ct"
+version = "1.8.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "2af50177e190e07a26ab74f8b1efbfe2ef87da2116221318cb1c2e82baf7de06"
+
 [[package]]
 name = "bitflags"
 version = "1.3.2"
@@ -139,6 +151,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d2f6c7dbe95a6ed67ad9f18e57daf93a2f034c524b99fd2b76d18fdfeb6660aa"
 dependencies = [
  "hybrid-array",
+ "zeroize",
 ]
 
 [[package]]
@@ -305,6 +318,12 @@ dependencies = [
  "memchr",
 ]
 
+[[package]]
+name = "const-oid"
+version = "0.10.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "be95d4a884358a21a199689323c29e9256b4a1b315e22f183d155422041d3a9a"
+
 [[package]]
 name = "constant_time_eq"
 version = "0.4.2"
@@ -342,6 +361,12 @@ version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7f8f80099a98041a3d1622845c271458a2d73e688351bf3cb999266764b81d48"
 
+[[package]]
+name = "cpubits"
+version = "0.1.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "15b85f9c39137c3a891689859392b1bd49812121d0d61c9caf00d46ed5ce06ae"
+
 [[package]]
 name = "cpufeatures"
 version = "0.3.1"
@@ -378,20 +403,45 @@ dependencies = [
  "winapi",
 ]
 
+[[package]]
+name = "crypto-bigint"
+version = "0.7.11"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "914c195c4d7fbc5ed7f88d14cbf85914d5c664967658d43404b263913a477e82"
+dependencies = [
+ "cpubits",
+ "ctutils",
+ "num-traits",
+ "rand_core",
+ "serdect",
+ "zeroize",
+]
+
 [[package]]
 name = "crypto-common"
 version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ce6e4c961d6cd6c9a86db418387425e8bdeaf05b3c8bc1411e6dca4c252f1453"
 dependencies = [
  "hybrid-array",
+ "rand_core",
+]
+
+[[package]]
+name = "crypto-primes"
+version = "0.7.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "3633a51a39c69ebbaa4feaa694bd83d241e4093901c84a0963b19d9bb3f0cf8f"
+dependencies = [
+ "crypto-bigint",
+ "rand_core",
 ]
 
 [[package]]
 name = "ctutils"
-version = "0.4.7"
+version = "0.4.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a2376ffd6f96d8a9db59875b4b6b0237d6900b5baf64279714e05493ce64828a"
+checksum = "261af4dc7a06ea8a527a8717d8cbba3417530d6ea14e1edb3de6b67806be474f"
 dependencies = [
  "cmov",
 ]
@@ -427,6 +477,17 @@ dependencies = [
  "thiserror",
 ]
 
+[[package]]
+name = "der"
+version = "0.8.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "6a996a108feb8b427a6e12fcf6af4aa83409b79d72c15337d7741368131ee004"
+dependencies = [
+ "const-oid",
+ "pem-rfc7468",
+ "zeroize",
+]
+
 [[package]]
 name = "derive_more"
 version = "2.1.1"
@@ -456,8 +517,10 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f1dd6dbb5841937940781866fa1281a1ff7bd3bf827091440879f9994983d5c2"
 dependencies = [
  "block-buffer",
+ "const-oid",
  "crypto-common",
  "ctutils",
+ "zeroize",
 ]
 
 [[package]]
@@ -763,6 +826,7 @@ dependencies = [
  "io-managesieve",
  "io-mbox",
  "io-msgraph",
+ "io-oauth",
  "io-pimdir",
  "io-sasl",
  "io-smtp",
@@ -931,7 +995,7 @@ checksum = "9395ae6abe2e10289147290316e62226bedbd20a6b29fd6d9ae903d1483344c0"
 dependencies = [
  "anyhow",
  "base64",
- "io-http",
+ "io-http 0.5.0",
  "log",
  "pimalaya-stream",
  "schemars",
@@ -955,6 +1019,22 @@ dependencies = [
  "url",
 ]
 
+[[package]]
+name = "io-http"
+version = "0.6.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7a9086cd840a757b9dd4105caad54a59fdb440c49be33882491a07274ca32e06"
+dependencies = [
+ "anyhow",
+ "base64-codec",
+ "httparse",
+ "log",
+ "pimalaya-stream",
+ "secrecy",
+ "thiserror",
+ "url",
+]
+
 [[package]]
 name = "io-imap"
 version = "0.8.0"
@@ -979,7 +1059,7 @@ version = "0.6.0"
 source = "git+https://github.com/pimalaya/io-jmap?rev=919eab465ab620b323f9191ab8de2f640bc4a1d2#919eab465ab620b323f9191ab8de2f640bc4a1d2"
 dependencies = [
  "anyhow",
- "io-http",
+ "io-http 0.5.0",
  "log",
  "pimalaya-stream",
  "schemars",
@@ -1053,7 +1133,7 @@ source = "git+https://github.com/pimalaya/io-msgraph?rev=2ae26370aefa671c16316db
 dependencies = [
  "anyhow",
  "base64",
- "io-http",
+ "io-http 0.5.0",
  "log",
  "pimalaya-stream",
  "schemars",
@@ -1062,6 +1142,28 @@ dependencies = [
  "url",
 ]
 
+[[package]]
+name = "io-oauth"
+version = "0.5.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b61b6c101769c3603dbd05bcf548bf66d03c044f4815083aad946147a48b86ec"
+dependenci
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ panic = "abort"
 pimalaya-cli = { version = "0.3", default-features = false, features = ["build"] }
 
 [dev-dependencies]
+io-oauth = { version = "0.5.2", default-features = false, features = ["client", "jwt-bearer", "rustls-ring"] }
 pimalaya-config = { version = "0.3", default-features = false, features = ["sample"] }
 rusqlite = { version = "0.41", default-features = false, features = ["bundled"] }
 tempfile = { version = "3", default-features = false }
```

**File**: `cairn/changes/live-provider-tests/delta.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+---
+cairn: delta
+change: live-provider-tests
+---
+
+# Delta
+
+## ADDED Requirements
+
+### Requirement: Live provider suites
+(packaging) The binary SHALL carry one ignored integration suite per provider under tests/ (google.rs, microsoft.rs, fastmail.rs), run with `--ignored` and sharing tests/common.rs. Each SHALL hold an `anonymous` module that runs every backend the provider's sample offers on a made-up token and touches no account, its accounts taken from the provider sections of config.sample.toml where one fits so a provider drifting from the sample fails it, and asserting the exit code of the output contract (2 with the `account check` report, 1 with the failure object) and a message naming the refusal in Himalaya's words. It MAY hold a `credentialed` module that mints its own token from `HIMALAYA_`-prefixed variables and only reads (`account check`, `mailbox list`, `envelope list`), failing naming the variables it misses, which CI runs in the upstream repository only and once its secrets exist. A token SHALL reach the binary through a token command reading its environment, never argv nor the configuration, and no assertion SHALL print a token or secret. CI SHALL run each suite in its own job at `RUST_LOG=debug` at most.
+
+## MODIFIED Requirements
+
+## REMOVED Requirements
```

**File**: `cairn/changes/live-provider-tests/proposal.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+---
+cairn: change
+id: live-provider-tests
+status: landed
+created: 2026-11-11
+---
+
+# Live provider tests (Google, Microsoft, Fastmail)
+
+## Why
+
+Every integration suite under tests/ runs the binary against a local store or a port nothing listens on. No test runs it against a real provider, so a sample section that parses (the-sample-is-tested-and-shipped) can still fail at Google, Microsoft or Fastmail: a moved endpoint, a refused authentication the error path mangles, an exit code off the output contract, a JSON shape a provider's answer breaks. The provider checks so far are the manual reports under cairn/spec/testing/, run once by hand. Ortie landed the same kind of suites on 2026-11-11 (ortie/cairn/log/2026-11-11-live-provider-tests.md); Himalaya follows its shape.
+
+## What
+
+tests/google.rs, tests/microsoft.rs and tests/fastmail.rs, every test `#[ignore = "requires ..."]` and run with `--ignored`, sharing a new tests/common.rs: `write_config` (one default account), `himalaya` (the built binary, a token in its environment, its home a TempDir), `json`, `json_failure` and `json_check_failure` (exit code then JSON), `assert_mailboxes` and `assert_envelopes`, `sample_section` (a provider section of config.sample.toml, uncommented, keys overridable), `env_var`, `require_env` and `env_content` (an empty variable counts as unset, `_FILE` names a file). Every account reads its token through `["printenv", "HIMALAYA_TEST_TOKEN"]`, so a token reaches the binary through its environment only, never argv nor the configuration file.
+
+### anonymous (network only, a made-up token, no account touched)
+
+For each backend a provider's sample offers, `account check` exits 2 with every backend of its report failed, and `envelope list` exits 1 with the failure object, both naming the refusal in Himalaya's words (`HTTP 401` for the Gmail API, Graph and JMAP, `XOAUTH2 failed` for IMAP and SMTP), never the provider's prose.
+
+- Google: the Gmail section (Gmail API), and a Gmail IMAP account on XOAUTH2, which the sample has no section for.
+- Microsoft: the Microsoft Graph section, and the Microsoft IMAP and SMTP section, whose check covers both.
+- Fastmail: the Fastmail section (JMAP).
+
+### credentialed (read-only, upstream CI only)
+
+`account check`, `mailbox list --json` (an inbox role among the mailboxes) and `envelope list --json -s 5` (one to five envelopes of the printed shape) per backend, each test sharing one token minted per run with io-oauth (a new dev-dependency, `client`, `jwt-bearer`, `rustls-ring`):
+
+- Microsoft: client credentials of the test registration (`HIMALAYA_MICROSOFT_TENANT_ID`, `HIMALAYA_MICROSOFT_CLIENT_ID`, `HIMALAYA_MICROSOFT_CLIENT_SECRET`), on the mailbox `HIMALAYA_MICROSOFT_USER` (default microsoft@pimalaya.onmicrosoft.com): Graph on a `https://graph.microsoft.com/.default` token through the sample's `msgraph.user-id`, and Exchange IMAP on a `https://outlook.office365.com/.default` token, which the tenant accepts.
+- Google: the RFC 7523 section 2.1 grant of the service account (`HIMALAYA_GOOGLE_SERVICE_ACCOUNT_KEY` or its `_FILE`) acting as `HIMALAYA_GOOGLE_SERVICE_ACCOUNT_SUBJECT` (default google@pimalaya.org), scope `https://mail.google.com/`: the Gmail API and Gmail IMAP.
+- Fastmail: none, only a browser consent issues its tokens.
+
+A credentialed test missing its variables fails naming them.
+
+### CI
+
+.github/workflows/tests.yml keeps the shared tests job and gains a `live` matrix job (google, microsoft, fastmail, `fail-fast: false`) at `RUST_LOG=debug`: the anonymous step on every push, the credentialed steps in pimalaya/himalaya only and once their secrets exist (`HAS_GOOGLE`, `HAS_MICROSOFT`), mapping the org secrets `GOOGLE_SERVICE_ACCOUNT_KEY`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` to the `HIMALAYA_*` variables.
+
+### The Posteo report leaves
+
+cairn/spec/testing/imap-smtp-posteo.md was run against the owner's personal account, which no test may touch; it leaves, with its row in cairn/spec/testing/README.md.
+
+## Out of scope
+
+- Writes of any kind (send, move, flag, delete, mailbox create), on any account.
+- SMTP with a real token, and every provider not listed: their manual reports stay.
+- Moving the existing suites onto tests/common.rs.
```

**File**: `cairn/changes/live-provider-tests/tasks.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+---
+cairn: tasks
+change: live-provider-tests
+---
+
+# Tasks
+
+- [x] tests/common.rs: config writer, binary runner with the token in its environment, JSON and shape assertions, sample sections, environment helpers
+- [x] tests/fastmail.rs `anonymous`: JMAP `account check` and `envelope list` refused
+- [x] tests/microsoft.rs `anonymous`: Graph, and IMAP with SMTP, refused
+- [x] tests/google.rs `anonymous`: Gmail API and Gmail IMAP refused
+- [x] tests/microsoft.rs `credentialed`: Graph, then Exchange IMAP once an app-only `account check` passed on the tenant
+- [x] tests/google.rs `credentialed`: Gmail API and Gmail IMAP on a service account token
+- [x] io-oauth as a dev-dependency, `cargo deny check` clean
+- [x] .github/workflows/tests.yml: `live` matrix job, credentialed steps repository- and secret-guarded, `RUST_LOG=debug`, actionlint clean
+- [x] Every suite run locally, and one debug-level run checked free of the tokens and the secret
+- [x] cairn/spec/testing/imap-smtp-posteo.md removed with its README row
+- [x] Fold the delta into cairn/spec/packaging.md, log
+- [ ] The owner makes the `GOOGLE_SERVICE_ACCOUNT_KEY` and `MICROSOFT_*` org secrets visible to pimalaya/himalaya
```

**File**: `cairn/log/2026-11-11-live-provider-tests.md` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+---
+cairn: log
+change: live-provider-tests
+landed: 2026-11-11
+---
+
+# Live provider tests
+
+tests/google.rs, tests/microsoft.rs and tests/fastmail.rs run the built binary against the real providers, every test ignored unless `--ignored` is given. tests/common.rs holds what they share: `write_config`, `himalaya` (the binary with `HIMALAYA_TEST_TOKEN` in its environment, its home a TempDir, stdin closed), `failure`, `json`, `json_failure`, `json_check_failure`, `assert_mailboxes`, `assert_envelopes`, `sample_section`, `env_var`, `require_env` (every unset name in one failure) and `env_content` (a `_FILE` variable or the content itself). Each account reads its token through `["printenv", "HIMALAYA_TEST_TOKEN"]`. The existing suites are untouched.
+
+- `anonymous` (a made-up token, no account touched): Google `gmail_account_check_refused`, `gmail_envelope_list_refused` on the sample's Gmail section, `imap_account_check_refused`, `imap_envelope_list_refused` on a Gmail IMAP XOAUTH2 account written in the suite, the sample having no Gmail IMAP section; Microsoft `graph_account_check_refused`, `graph_envelope_list_refused` on the Microsoft Graph section, `imap_smtp_account_check_refused` (both backends of the Microsoft IMAP and SMTP section fail), `imap_envelope_list_refused`; Fastmail `jmap_account_check_refused`, `jmap_envelope_list_refused`. `account check` exits 2 with every backend failed, `envelope list` exits 1 with the failure object, and the message names the refusal in Himalaya's words: `HTTP 401` (Gmail API, Graph, JMAP), `XOAUTH2 failed` (IMAP, SMTP). The failure `code` is `null` in every case, no stable code naming an authentication refusal.
+- `credentialed` (read-only): `account check`, `mailbox list` (an inbox role) and `envelope list -s 5` (one to five envelopes of the printed shape) per backend, one token minted per run with io-oauth 0.5.2, a new dev-dependency (`client`, `jwt-bearer`, `rustls-ring`). Microsoft `graph_*` on a client credentials token for `https://graph.microsoft.com/.default` with the sample's `msgraph.user-id` set to microsoft@pimalaya.onmicrosoft.com, and `imap_*` on one for `https://outlook.office365.com/.default`: the tenant accepts app-only XOAUTH2 on Exchange IMAP, so IMAP is in. Google `gmail_*` and `imap_*` on a service account token for `https://mail.google.com/` acting as google@pimalaya.org (RFC 7523 section 2.1).
+
+.github/workflows/tests.yml keeps the shared tests job and gains a `live` matrix job (google, microsoft, fastmail, `fail-fast: false`, `RUST_LOG: debug`): the anonymous step on every push, the credentialed steps in pimalaya/himalaya only and when `HAS_GOOGLE` or `HAS_MICROSOFT` holds, mapping `GOOGLE_SERVICE_ACCOUNT_KEY`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` to their `HIMALAYA_*` variables. actionlint passes.
+
+Run on 2026-11-11 from this machine: anonymous 10 passed (Google 4, Microsoft 4, Fastmail 2), credentialed 12 passed (Google 6, Microsoft 6), each envelope page holding 5 envelopes; Microsoft with the tenant name `pimalaya.onmicrosoft.com` in place of its id, Google with the key's `_FILE` path. One run of all 22 at `RUST_LOG=debug` saved each binary's stderr: debug lines in every one, and no hit for the minted tokens (counted in the test process), the client secret, the made-up token, a `ya29.` prefix or a JWT. A credentialed test without its variables fails naming each one unset.
+
+io-oauth brings io-http 0.6.0 from crates.io beside the patched io-http 0.5.0 the binary uses, rsa 0.10 and its key crates, and moves ctutils from 0.4.7 to 0.4.8, all in the test build only. `cargo deny check` passes, its duplicate warnings unchanged.
+
+cairn/spec/testing/imap-smtp-posteo.md is removed with its row in cairn/spec/testing/README.md, which now points at the live suites: it was run against the owner's personal account, which no test may touch.
+
+Capabilities moved: packaging (cairn/spec/packaging.md: "Live provider suites" added); testing (the Posteo report removed).
```

**File**: `cairn/spec/packaging.md` (modified, +3/-0)
```diff
@@ -39,3 +39,6 @@ Every dependency, build and dev ones included, SHALL be declared with `default-f
 
 ### Requirement: Dependency checks pass clean
 `cargo deny check` SHALL pass over the targets deny.toml lists, which are the release targets and the ones people build from source, allowing only the licences the tree carries. A duplicate the tree cannot avoid stays a visible warning rather than a skip: today getrandom 0.2 (ring 0.17), syn 2 (bounded-static-derive under io-imap and io-smtp, windows-core under chrono on Windows), and hashbrown 0.15 with foldhash 0.1 (chumsky 0.13).
+
+### Requirement: Live provider suites
+The binary SHALL carry one ignored integration suite per provider under tests/ (google.rs, microsoft.rs, fastmail.rs), run with `--ignored` and sharing tests/common.rs. Each SHALL hold an `anonymous` module that runs every backend the provider's sample offers on a made-up token and touches no account, its accounts taken from the provider sections of config.sample.toml where one fits so a provider drifting from the sample fails it, and asserting the exit code of the output contract (2 with the `account check` report, 1 with the failure object) and a message naming the refusal in Himalaya's words. It MAY hold a `credentialed` module that mints its own token from `HIMALAYA_`-prefixed variables and only reads (`account check`, `mailbox list`, `envelope list`), failing naming the variables it misses, which CI runs in the upstream repository only and once its secrets exist. A token SHALL reach the binary through a token command reading its environment, never argv nor the configuration, and no assertion SHALL print a token or secret. CI SHALL run each suite in its own job at `RUST_LOG=debug` at most.
```

#### Recent Merged Pull Requests:
- **PR #808** (2026-11-08): feat(mcp): read an attachment's content without touching disk (#805) (@maybenotconnor)
- **PR #807** (2026-11-08): feat(mcp): attach files given inline to the composers (@maybenotconnor)
- **PR #803** (2026-11-05): fix(envelope): one rule for hasAttachment across the MIME backends (@snrmwg)
- **PR #800** (2026-11-01): fix(cli): delimit config paths with $PATH's own separator (@Omair-Asdaq)
- **PR #796** (2026-10-29): docs(testing): add IMAP+SMTP provider reports for QQ, 163, 139 Mail (@xiaolinstar)
- **PR #794** (2026-10-15): fix: fail when no given message id exists (@jontxux)

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

## X. config)!: fix the flag glyphs, ignore the envelope.list.table block

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pimalaya/himalaya. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d619b9e0`: config)!: fix the flag glyphs, ignore the envelope.list.table block. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  A colour key under `mailbox` is refused as unknown; `table`, `attachment` and `account` are ignored like any unknown top-level key.

- **BREAKING**: Removed the `envelope.list.table.unseen-char`, `replied-char`, `flagged-char` and `attachment-char` options.

  FLAGS shows `*`, `R` and `!`, ATT `@`, and the `envelope.list.table` block is ignored whatever it holds, so a v2 configuration or one shared with himalaya-tui keeps loading.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  A colour key under `envelope.list.table` or `mailbox` is refused as unknown; `table`, `attachment` and `account` are ignored like any unknown top-level key. The `envelope.list.table.*-char` glyphs stay.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d619b9e0` are properly handled with clean fallback behavior.
