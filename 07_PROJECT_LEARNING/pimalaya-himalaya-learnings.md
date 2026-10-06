# Forensic Learning Record (Deep Inspection): pimalaya/himalaya

> **Canonical Artifact**: `07_PROJECT_LEARNING/pimalaya-himalaya-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pimalaya/himalaya](https://github.com/pimalaya/himalaya))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:04:02.041Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pimalaya/himalaya`
- **Description**: CLI to manage emails
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7393 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/imap/utils.rs`
```
//! # IMAP utils
//!
//! RFC 2047 header decoding and envelope address formatting, shared by
//! the `fetch` and `thread` commands.

use io_imap::types::envelope::Address;
use log::debug;
use rfc2047_decoder::{Decoder, RecoverStrategy};

/// Decodes an RFC 2047 encoded string, falling back to the input on
/// error.
pub fn decode_mime(s: &str) -> String {
    let decoder = Decoder::new().too_long_encoded_word_strategy(RecoverStrategy::Decode);
    match decoder.decode(s.as_bytes()) {
        Ok(s) => s,
        Err(err) => {
            debug!("cannot decode rfc2047 string `{s}`: {err}");
            s.to_string()
        }
    }
}

/// Formats an envelope address as `Name <local@host>`, or bare when it
/// carries no personal name.
pub fn format_address(addr: &Address<'_>) -> String {
    let email = format_email(addr);

    if let Some(name) = &addr.name.0 {
        let name = decode_mime(&String::from_utf8_lossy(name.as_ref()));
        if !name.is_empty() {
            return format!("{name} <{email}>");
        }
    }

    email
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
//! The `pimdir queue cancel` command, retracting one staged creation
//! before its owner applies it.

use std::fmt;

use anyhow::{Result, bail};
use clap::Parser;
use pimalaya_cli::{printer::Printer, prompt};
use schemars::JsonSchema;
use serde::Serialize;

use crate::pimdir::client::PimdirClient;

/// Cancel one staged message, by the row id `queue list` prints.
///
/// This is the only way back for a queued creation: a staged flag or move is
/// undone by doing the opposite, where a message that does not exist yet
/// cannot be deleted.
///
/// Cancelling is the store owner's write, so this takes that role for the
/// length of the call and fails while a sync holds it.
#[derive(Debug, Parser)]
pub struct PimdirQueueCancelCommand {
    /// Row id of the staged message, as `pimdir queue list` prints it.
    #[arg(value_name = "ROW")]
    pub id: i64,
    /// Do not ask for confirmation.
    #[arg(long, short)]
    pub yes: bool,
}

impl PimdirQueueCancelCommand {
    /// Retracts the staged action the row id names.
    pub fn execute(self, printer: &mut impl Printer, client: &mut PimdirClient) -> Result<()> {
        if !self.yes
            && !prompt::bool(
                format!("Cancel the message queued as row {}?", self.id),
                false,
            )?
        {
            bail!("Cancellation aborted");
        }

        if !client.cancel_queued(self.id)? {
            bail!(
                "No queued action with row {}; it may have been synced already",
                self.id
            );
        }

        printer.out(PimdirQueueCancelled { id: self.id })
    }
}

/// The `pimdir queue cancel` output.
#[derive(Clone, Copy, Debug, Serialize, JsonSchema)]
pub struct PimdirQueueCancelled {
    /// The row that was cancelled.
    pub id: i64,
}

impl fmt::Display for PimdirQueueCancelled {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Queued message {} cancelled", self.id)
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
//! The `pimdir queue list` command, tabling the creations and sends staged
//! in one mailbox.

use std::fmt;

use anyhow::Result;
use clap::Parser;
use pimalaya_cli::printer::Printer;
use pimalaya_cli::table::{Cell, Color, Row, Table, sanitize};
use schemars::JsonSchema;
use serde::Serialize;

use crate::{
    account::context::Account,
    email::envelope::Envelope,
    pimdir::client::PimdirClient,
    shared::{
        envelope::list::{format_addresses, format_flags},
        mailbox::arg::MailboxArg,
        table::style_from_preset,
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
/// that already exist.
#[derive(Debug, Parser)]
pub struct PimdirQueueListCommand {
    #[command(flatten)]
    pub mailbox: MailboxArg,
}

impl PimdirQueueListCommand {
    /// Lists the creations and sends staged in the mailbox and tables them.
    pub fn execute(
        self,
        printer: &mut impl Printer,
        account: &mut Account,
        client: &mut PimdirClient,
    ) -> Result<()> {
        let mailbox = self.mailbox.resolve(account);
        let queued = client.queued_envelopes(&mailbox)?;

        printer.out(PimdirQueuedMessages {
            preset: account.table_preset().to_string(),
            id_color: account.envelopes_list_table_id_color(),
            subject_color: account.envelopes_list_table_subject_color(),
            from_color: account.envelopes_list_table_from_color(),
            date_color: account.envelopes_list_table_date_color(),
            unseen_char: account.envelopes_list_table_unseen_char(),
            replied_char: account.envelopes_list_table_replied_char(),
            flagged_char: account.envelopes_list_table_flagged_char(),
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
        })
    }
}

/// One message waiting in the store's queue.
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct PimdirQueuedMessage {
    /// The queue row id, which `pimdir queue cancel` takes. It names a
    /// pending action, not a message: the message has no id until the sync
    /// engine applies the action, and gets a different one then.
    pub id: i64,
    /// When the row was appended, stamped by the store's own clock.
    pub queued_at: String,
    /// The process that staged it.
    pub producer: String,
    /// Whether the row sends the message rather than files it.
    pub send: bool,
    /// The mail the action carries, read from its stored summary. Its `id` is
    /// empty, a queued message having none yet.
    pub envelope: Envelope,
}

/// The `pimdir queue list` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct PimdirQueuedMessages {
    /// The `comfy_table` preset string the table renders with.
    #[serde(skip)]
    pub preset: String,
    /// Color of the ID column.
    #[serde(skip)]
    pub id_color: Color,
    /// Color of the SUBJECT column.
    #[serde(skip)]
    pub subject_color: Color,
    /// Color of the FROM column.
    #[serde(skip)]
    pub from_color: Color,
    /// Color of the DATE column.
    #[serde(skip)]
    pub date_color: Color,
    /// FLAGS glyph of a message lacking `\Seen`.
    #[serde(skip)]
    pub unseen_char: char,
    /// FLAGS glyph of a message carrying `\Answered`.
    #[serde(skip)]
    pub replied_char: char,
    /// FLAGS glyph of a message carrying `\Flagged`.
    #[serde(skip)]
    pub flagged_char: char,
    /// The messages staged for creation in the mailbox.
    pub messages: Vec<PimdirQueuedMessage>,
}

impl fmt::Display for PimdirQueuedMessages {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.messages.is_empty() {
            return writeln!(f, "No message queued in this mailbox");
        }

        let chars = crate::shared::envelope::list::FlagChars {
            unseen: self.unseen_char,
            replied: self.replied_char,
            flagged: self.flagged_char,
            attachment: ' ',
        };

        let mut table = Table::new();
        table
            .load_style(style_from_preset(&self.preset))
            .set_header(Row::from([
                Cell::new("ROW"),
                Cell::new("ACTION"),
                Cell::new("FLAGS"),
                Cell::new("SUBJECT"),
                Cell::new("TO"),
                Cell::new("QUEUED"),
            ]))
            .add_rows(self.messages.iter().map(|queued| {
                let mut row = Row::new();
                row.max_height(1);
                row.add_cell(Cell::new(queued.id).fg(self.id_color));
                row.add_cell(Cell::new(if queued.send { "send" } else { "save" }));
                row.add_cell(Cell::new(format_flags(&queued.envelope.flags, &chars)));
                row.add_cell(Cell::new(sanitize(&queued.envelope.subject)).fg(self.subject_color));
                row.add_cell(
                    Cell::new(sanitize(&format_addresses(&queued.envelope.to))).fg(self.from_color),
                );
                row.add_cell(Cell::new(&queued.queued_at).fg(self.date_color));
                row
            }));

        writeln!(f)?;
        writeln!(f, "{table}")?;
        writeln!(
            f,
            "Queued until the next sync. Cancel one with `himalaya pimdir queue cancel <ROW>`"
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
use pimalaya_cli::{printer::Printer, table::sanitize};
use schemars::JsonSchema;
use serde::Serialize;

use crate::pimdir::client::PimdirClient;

/// Show where one queue row stands, by the id `pimdir message add`,
/// `pimdir message send` or `pimdir mailbox create` printed.
///
/// A row is `pending` until the sync engine applies it, `parked` when the
/// engine gave up on it (with why), and `applied` once done, a message
/// sent or a mailbox created included, with the id of the message an add
/// created. The store keeps what became of an applied row for seven days;
/// past that, and for a cancelled row, the state is `unknown`.
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
        printer.out(PimdirQueueRow::new(self.id, status))
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
    /// created); `seq` is the message an add created.
    Applied,
    /// Neither queued nor known applied: cancelled, or applied long ago.
    Unknown,
}

/// The `pimdir queue show` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueRow {
    /// The queue row id.
    pub queue_id: i64,
    /// Where it stands.
    pub state: PimdirQueueState,
    /// The collection it is anchored on, unless unknown.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection: Option<String>,
    /// The action kind (`add`, `submit`…), while queued.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    /// Apply attempts so far, while queued.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempts: Option<i64>,
    /// Why the row was parked.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// When the row was applied, RFC 3339.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applied_at: Option<String>,
    /// The id of the message an applied add created, in `collection`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seq: Option<i64>,
}

impl PimdirQueueRow {
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

impl fmt::Display for PimdirQueueRow {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let id = self.queue_id;
        let collection = sanitize(self.collection.as_deref().unwrap_or_default());
        let kind = sanitize(self.kind.as_deref().unwrap_or_default());

        match self.state {
            PimdirQueueState::Pending => write!(f, "Row {id} ({kind} in {collection}) is pending"),
            PimdirQueueState::Parked => {
                let error = sanitize(self.error.as_deref().unwrap_or_default());
                write!(f, "Row {id} ({kind} in {collection}) is parked: {error}")
            }
            PimdirQueueState::Applied => {
                write!(f, "Row {id} was applied in {collection}")?;
                match self.seq {
                    Some(seq) => write!(f, ", creating message {seq}"),
                    None => Ok(()),
                }
            }
            PimdirQueueState::Unknown => write!(
                f,
                "Row {id} is neither queued nor known applied: cancelled, or applied long ago"
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_applied_add_prints_its_seq() {
        let row = PimdirQueueRow::new(
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
                "queueId": 12,
                "state": "applied",
                "collection": "imap/Drafts",
                "appliedAt": "2026-10-04T20:00:00Z",
                "seq": 42,
            })
        );
    }

    #[test]
    fn an_unknown_row_prints_its_id_and_state_only() {
        let json =
            serde_json::to_value(PimdirQueueRow::new(7, PimdirActionStatus::Unknown)).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "queueId": 7, "state": "unknown" })
        );
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

use anyhow::{Result, bail};
use clap::Parser;
#[cfg(all(feature = "imap", feature = "wizard"))]
use io_sasl::mechanism::SaslMechanism;
use pimalaya_cli::printer::Printer;
use pimalaya_config::{secret::SecretResolver, toml::TomlConfig};
use schemars::JsonSchema;
use serde::Serialize;

#[cfg(feature = "wizard")]
use crate::config::AccountConfig;
#[cfg(feature = "imap")]
use crate::config::ImapConfig;
use crate::{
    backend::Backend,
    config::{Config, NO_CONFIG_HINT},
};

/// Validate the account configuration.
///
/// Every backend `--backend` allows is opened, which exercises the same
/// handshake and authentication paths a real command takes. The report
/// names each backend and whether it answered.
#[derive(Debug, Parser)]
pub struct AccountCheckCommand;

impl AccountCheckCommand {
    /// Checks every allowed backend of the account and prints the report.
    pub fn execute(
        self,
        printer: &mut impl Printer,
        config_paths: &[PathBuf],
        account_name: Option<&str>,
        backend: Backend,
    ) -> Result<()> {
        let mut config = match Config::from_paths_or_default(config_paths)? {
            Some(config) => config,
            None => bail!("No configuration found, {NO_CONFIG_HINT}"),
        };

        let (name, account_config) = config
            .take_account(account_name)?
            .ok_or_else(|| anyhow::anyhow!("Cannot find account"))?;

        let mut report = CheckReport {
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

        printer.out(report)
    }
}

/// Tests every configured backend, failing on the first error.
///
/// The wizard runs it over a freshly built account, so a bad credential
/// or endpoint stops it rather than yielding a configuration that cannot
/// connect.
#[cfg(feature = "wizard")]
pub fn test_account(account_config: &AccountConfig) -> Result<()> {
    // NOTE: one resolver for the whole account, as in `account check`.
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
    if let Some(imap_config) = &account_config.imap {
        connect_imap(imap_config, &mut resolver)?;
    }

    #[cfg(feature = "jmap")]
    if let Some(jmap_config) = &account_config.jmap {
        connect_jmap(jmap_config, &mut resolver)?;
    }

    #[cfg(feature = "gmail")]
    if let Some(gmail_config) = &account_config.gmail {
        connect_gmail(gmail_config, &mut resolver)?;
    }

    #[cfg(feature = "msgraph")]
    if let Some(msgraph_config) = &account_config.msgraph {
        connect_msgraph(msgraph_config, &mut resolver)?;
    }

    #[cfg(feature = "maildir")]
    if let Some(maildir_config) = &account_config.maildir {
        connect_maildir(maildir_config)?;
    }

    #[cfg(feature = "m2dir")]
    if let Some(m2dir_config) = &account_config.m2dir {
        connect_m2dir(m2dir_config)?;
    }

    #[cfg(feature = "mbox")]
    if let Some(mbox_config) = &account_config.mbox {
        connect_mbox(mbox_config)?;
    }

    #[cfg(feature = "smtp")]
    if let Some(smtp_config) = &account_config.smtp {
        connect_smtp(smtp_config, &mut resolver)?;
    }

    #[cfg(feature = "sieve")]
    if let Some(sieve_config) = &account_config.sieve {
        connect_sieve(sieve_config, &mut resolver)?;
    }

    Ok(())
}

/// Opens an authenticated IMAP session and drops it.
#[cfg(feature = "imap")]
pub(crate) fn connect_imap(imap_config: &ImapConfig, resolver: &mut SecretResolver) -> Result<()> {
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

/// Reads a server's CAPABILITY over an unauthenticated connection and
/// returns the mechanisms it advertises, most preferred first.
///
/// The wizard offers what comes back rather than the whole list, and the
/// connection is dropped without ever authenticating.
#[cfg(all(feature = "imap", feature = "wizard"))]
pub(crate) fn probe_imap_mechanisms(server: &str, starttls: bool) -> Result<Vec<SaslMechanism>> {
    use io_imap::{
        client::{ImapClientStd, ImapClientStdConnectOptions, default_alpn},
        rfc3501::capability::available_auth_mechanisms,
        session::ImapSessionOpenOptions,
    };

    use crate::{config::TlsConfig, imap::client::parse_imap_server};

    let server = parse_imap_server(server)?;
    let opts = ImapClientStdConnectOptions {
        tls: TlsConfig::default().into_tls(default_alpn()),
        session: ImapSessionOpenOptions {
            starttls,
            ..Default::default()
        },
        ..Default::default()
    };
    let (_client, capabilities) = ImapClientStd::connect(&server, opts)?;

    Ok(available_auth_mechanisms(&capabilities))
}

/// Opens a JMAP client and fetches the session object.
#[cfg(feature = "jmap")]
fn connect_jmap(
    jmap_config: &crate::config::JmapConfig,
    resolver: &mut SecretResolver,
) -> Result<()> {
    use io_jmap::client::JmapClientStd;

    use crate::jmap::client::{connect_options, jmap_http_aut
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
    account::{check::AccountCheckCommand, list::AccountListCommand},
    backend::Backend,
};

/// Manage accounts defined in the TOML configuration file.
///
/// An account is a named group of backend settings. These subcommands
/// inspect them and validate their connection; creating one is bare
/// `himalaya`.
#[derive(Debug, Subcommand)]
pub enum AccountCommand {
    #[command(visible_alias = "ls")]
    List(AccountListCommand),
    Check(AccountCheckCommand),
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

use std::{
    collections::HashMap,
    env::temp_dir,
    path::{Path, PathBuf},
};

use crossterm::style::Color;
use dirs::download_dir;
use pimalaya_cli::table::{Color as TableColor, ContentArrangement};

#[cfg(backend)]
use crate::email::mailbox::Mailbox;
use crate::{
    config::{
        AccountConfig, AttachmentListTableConfig, Config, EnvelopeListTableConfig,
        MailboxListTableConfig, PostingStyle, SaveCopyConfig, TableArrangementConfig,
    },
    email::mailbox::MailboxRole,
    shared::table::DEFAULT_PRESET,
};

/// chrono `strftime` format of the envelope DATE column.
const DEFAULT_DATETIME_FMT: &str = "%F %R%:z";
/// Page size of `envelope list` when nothing names one.
const DEFAULT_ENVELOPES_LIST_PAGE_SIZE: u32 = 25;
/// RFC 3676 section 4.3 signature separator.
const DEFAULT_SIGNATURE_DELIM: &str = "-- \n";
/// FLAGS glyph of a message lacking `\Seen`.
const DEFAULT_UNSEEN_CHAR: char = '*';
/// FLAGS glyph of a message carrying `\Answered`.
const DEFAULT_REPLIED_CHAR: char = 'R';
/// FLAGS glyph of a message carrying `\Flagged`.
const DEFAULT_FLAGGED_CHAR: char = '!';
/// ATT glyph of a message carrying an attachment.
const DEFAULT_ATTACHMENT_CHAR: char = '@';

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
    /// `comfy_table` preset string every listing renders with.
    pub table_preset: Option<String>,
    /// `comfy_table` column arrangement every listing renders with.
    pub table_arrangement: Option<TableArrangementConfig>,
    /// chrono `strftime` format of the envelope DATE column.
    pub datetime_fmt: Option<String>,
    /// Whether an envelope date is converted to the local timezone.
    pub datetime_local_tz: Option<bool>,
    /// Whether a recent envelope date renders relative to today.
    pub datetime_relative: Option<bool>,
    /// Page size of `envelope list` when `-s/--page-size` is not passed.
    pub envelopes_list_page_size: Option<u32>,
    /// Per-column colors and flag glyphs of `envelope list`.
    pub envelopes_list_table: EnvelopeListTableConfig,
    /// Per-column colors of `mailbox list`.
    pub mailboxes_list_table: MailboxListTableConfig,
    /// Per-column colors of `attachment list`.
    pub attachments_list_table: AttachmentListTableConfig,
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
            table_preset: other.table_preset.or(self.table_preset),
            table_arrangement: other.table_arrangement.or(self.table_arrangement),

            datetime_fmt: other.datetime_fmt.or(self.datetime_fmt),
            datetime_local_tz: other.datetime_local_tz.or(self.datetime_local_tz),
            datetime_relative: other.datetime_relative.or(self.datetime_relative),
            envelopes_list_page_size: other
                .envelopes_list_page_size
                .or(self.envelopes_list_page_size),

            envelopes_list_table: merge_envelope_table(
                self.envelopes_list_table,
                other.envelopes_list_table,
            ),
            mailboxes_list_table: merge_mailbox_table(
                self.mailboxes_list_table,
                other.mailboxes_list_table,
            ),
            attachments_list_table: merge_attachment_table(
                self.attachments_list_table,
                other.attachments_list_table,
            ),

            mailbox_alias,
            save_copy: other.save_copy.or(self.save_copy),
            reply_posting_style: other.reply_posting_style.or(self.reply_posting_style),
            forward_posting_style: other.forward_posting_style.or(self.forward_posting_style),
        }
    }

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

    /// `comfy_table` preset string, defaulting to `UTF8_FULL_CONDENSED`.
    pub fn table_preset(&self) -> &str {
        self.table_preset.as_deref().unwrap_or(DEFAULT_PRESET)
    }

    /// `comfy_table` content arrangement, defaulting to `Dynamic`.
    pub fn table_arrangement(&self) -> ContentArrangement {
        self.table_arrangement
            .clone()
            .unwrap_or(TableArrangementConfig::Dynamic)
            .into()
    }

    /// chrono `strftime` format of the DATE column, defaulting to
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
    /// An unmatched name comes back verbatim, so a cal
```

### Core Architecture Module: `src/account/list.rs`
```
//! # Account list
//!
//! The `account list` command, tabling every account a configuration
//! declares.

use std::{fmt, path::PathBuf};

use anyhow::Result;
use clap::Parser;
use crossterm::style::Color as CrosstermColor;
use pimalaya_cli::printer::Printer;
use pimalaya_cli::table::{Cell, Color, ContentArrangement, Row, Table};
use pimalaya_config::toml::TomlConfig;
use schemars::JsonSchema;
use serde::Serialize;

use crate::{
    account::context::map_color_or,
    config::{AccountConfig, Config, NO_CONFIG_HINT, TableArrangementConfig},
    shared::table::style_from_preset,
};

/// List all accounts declared in the configuration.
///
/// Each row shows the account name, the backends with a config block,
/// and whether it is the default account.
#[derive(Debug, Parser)]
pub struct AccountListCommand;

impl AccountListCommand {
    /// Loads the configuration and prints its accounts as a table.
    pub fn execute(self, printer: &mut impl Printer, config_paths: &[PathBuf]) -> Result<()> {
        let config = load_config(config_paths)?;

        let preset = config
            .table
            .preset
            .clone()
            .unwrap_or_else(|| crate::shared::table::DEFAULT_PRESET.to_string());
        let arrangement = config
            .table
            .arrangement
            .clone()
            .unwrap_or(TableArrangementConfig::Dynamic)
            .into();

        let table_cfg = &config.account.list.table;
        let colors = AccountColors {
            // NOTE: the fallbacks are the v1.2.0 column colors.
            name: map_color_or(table_cfg.name_color, CrosstermColor::Green),
            backends: map_color_or(table_cfg.backends_color, CrosstermColor::Blue),
            default: map_color_or(table_cfg.default_color, CrosstermColor::Reset),
        };

        let mut accounts: Vec<AccountRow> = config
            .accounts
            .iter()
            .map(|(name, account)| AccountRow::from_account(name, account))
            .collect();
        accounts.sort_by(|a, b| a.name.cmp(&b.name));

        let table = AccountsTable {
            preset,
            arrangement,
            colors,
            accounts,
        };

        printer.out(table)
    }
}

/// Per-column colors of the accounts table.
#[derive(Clone, Copy, Debug)]
struct AccountColors {
    name: Color,
    backends: Color,
    default: Color,
}

/// Loads the merged configuration, pointing at the wizard when there is
/// none to load.
fn load_config(paths: &[PathBuf]) -> Result<Config> {
    match Config::from_paths_or_default(paths)? {
        Some(config) => Ok(config),
        None => anyhow::bail!("No configuration found, {NO_CONFIG_HINT}"),
    }
}

/// One row of the accounts table.
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct AccountRow {
    /// The name of the `[accounts.<name>]` block.
    pub name: String,
    /// Whether a command with no `-a/--account` runs against it.
    pub default: bool,
    /// The backends it declares a block for.
    pub backends: Vec<&'static str>,
}

impl AccountRow {
    /// Reads the row off one account block.
    fn from_account(name: &str, account: &AccountConfig) -> Self {
        let mut backends = Vec::new();
        if account.imap.is_some() {
            backends.push("imap");
        }
        if account.jmap.is_some() {
            backends.push("jmap");
        }
        if account.gmail.is_some() {
            backends.push("gmail");
        }
        if account.msgraph.is_some() {
            backends.push("msgraph");
        }
        if account.maildir.is_some() {
            backends.push("maildir");
        }
        if account.m2dir.is_some() {
            backends.push("m2dir");
        }
        if account.mbox.is_some() {
            backends.push("mbox");
        }
        if account.smtp.is_some() {
            backends.push("smtp");
        }
        if account.sieve.is_some() {
            backends.push("sieve");
        }

        Self {
            name: name.to_owned(),
            default: account.default,
            backends,
        }
    }
}

/// The `account list` output, a table of accounts.
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct AccountsTable {
    /// The `comfy_table` preset string the table renders with.
    #[serde(skip)]
    pub preset: String,
    /// The column arrangement the table renders with.
    #[serde(skip)]
    pub arrangement: ContentArrangement,
    #[serde(skip)]
    colors: AccountColors,
    /// The accounts, sorted by name.
    pub accounts: Vec<AccountRow>,
}

impl fmt::Display for AccountsTable {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut table = Table::new();

        table
            .load_style(style_from_preset(&self.preset))
            .set_content_arrangement(self.arrangement.clone())
            .set_header(Row::from(vec![
                Cell::new("NAME"),
                Cell::new("BACKENDS"),
                Cell::new("DEFAULT"),
            ]))
            .add_rows(self.accounts.iter().map(|account| {
                let mut row = Row::new();
                row.max_height(1);
                row.add_cell(Cell::new(&account.name).fg(self.colors.name));
                row.add_cell(Cell::new(account.backends.join(", ")).fg(self.colors.backends));
                row.add_cell(
                    Cell::new(if account.default { "yes" } else { "" }).fg(self.colors.default),
                );
                row
            }));

        writeln!(f)?;
        writeln!(f, "{table}")
    }
}

```

### Core Architecture Module: `src/account/mod.rs`
```
//! # Account
//!
//! The `account` command family: inspecting the accounts a configuration
//! declares, and the merged runtime account every other command consumes.

pub mod check;
pub mod cli;
pub mod context;
pub mod list;

```

### Core Architecture Module: `src/backend.rs`
```
//! # Backend
//!
//! The `--backend` global flag: which backend the shared, cross-protocol
//! commands target.

use std::fmt;

use clap::ValueEnum;

/// Selects which backend a cross-protocol command targets.
///
/// `auto` picks the first configured backend the command supports, and a
/// named one pins it, which then bails when the account has no such block
/// or the operation no such arm. The protocol-specific subcommands ignore
/// it entirely.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, ValueEnum)]
pub enum Backend {
    /// Let the command pick the first backend it is configured for.
    #[default]
    Auto,
    /// Pin the command to the account's IMAP backend.
    Imap,
    /// Pin the command to the account's JMAP backend.
    Jmap,
    /// Pin the command to the account's Gmail backend.
    Gmail,
    /// Pin the command to the account's Microsoft Graph backend.
    Msgraph,
    /// Pin the command to the account's Maildir backend.
    Maildir,
    /// Pin the command to the account's m2dir backend.
    M2dir,
    /// Pin the command to the account's mbox backend.
    Mbox,
    /// Pin the command to the account's pimdir backend.
    Pimdir,
    /// Pin the command to the account's SMTP backend.
    Smtp,
    /// Pin the command to the account's ManageSieve backend.
    Sieve,
}

#[allow(unused)]
impl Backend {
    /// Every backend this build compiles in, `auto` aside.
    pub const COMPILED: &[Self] = &[
        #[cfg(feature = "imap")]
        Self::Imap,
        #[cfg(feature = "jmap")]
        Self::Jmap,
        #[cfg(feature = "gmail")]
        Self::Gmail,
        #[cfg(feature = "msgraph")]
        Self::Msgraph,
        #[cfg(feature = "maildir")]
        Self::Maildir,
        #[cfg(feature = "m2dir")]
        Self::M2dir,
        #[cfg(feature = "mbox")]
        Self::Mbox,
        #[cfg(feature = "pimdir")]
        Self::Pimdir,
        #[cfg(feature = "smtp")]
        Self::Smtp,
        #[cfg(feature = "sieve")]
        Self::Sieve,
    ];

    /// Whether the IMAP arm of a shared command may run.
    pub fn allows_imap(self) -> bool {
        matches!(self, Self::Auto | Self::Imap)
    }

    /// Whether the JMAP arm of a shared command may run.
    pub fn allows_jmap(self) -> bool {
        matches!(self, Self::Auto | Self::Jmap)
    }

    /// Whether the Gmail arm of a shared command may run.
    pub fn allows_gmail(self) -> bool {
        matches!(self, Self::Auto | Self::Gmail)
    }

    /// Whether the Microsoft Graph arm of a shared command may run.
    pub fn allows_msgraph(self) -> bool {
        matches!(self, Self::Auto | Self::Msgraph)
    }

    /// Whether the Maildir arm of a shared command may run.
    pub fn allows_maildir(self) -> bool {
        matches!(self, Self::Auto | Self::Maildir)
    }

    /// Whether the m2dir arm of a shared command may run.
    pub fn allows_m2dir(self) -> bool {
        matches!(self, Self::Auto | Self::M2dir)
    }

    /// Whether the mbox arm of a shared command may run.
    pub fn allows_mbox(self) -> bool {
        matches!(self, Self::Auto | Self::Mbox)
    }

    /// Whether the pimdir arm of a shared command may run.
    pub fn allows_pimdir(self) -> bool {
        matches!(self, Self::Auto | Self::Pimdir)
    }

    /// Whether the SMTP arm of a shared command may run.
    pub fn allows_smtp(self) -> bool {
        matches!(self, Self::Auto | Self::Smtp)
    }

    /// Whether the ManageSieve account-check arm may run.
    pub fn allows_sieve(self) -> bool {
        matches!(self, Self::Auto | Self::Sieve)
    }
}

impl fmt::Display for Backend {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Auto => write!(f, "auto"),
            Self::Imap => write!(f, "imap"),
            Self::Jmap => write!(f, "jmap"),
            Self::Gmail => write!(f, "gmail"),
            Self::Msgraph => write!(f, "msgraph"),
            Self::Maildir => write!(f, "maildir"),
            Self::M2dir => write!(f, "m2dir"),
            Self::Mbox => write!(f, "mbox"),
            Self::Pimdir => write!(f, "pimdir"),
            Self::Smtp => write!(f, "smtp"),
            Self::Sieve => write!(f, "sieve"),
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #772** (2026-10-05): **config option for posting style**
  *Symptoms*: When replying with `himalaya message reply`, `--posting-style [top|bottom]` sets posting style, defaulting to `top`.  Would be nice to have a config file option for this to avoid having to set `--posting-style bottom` on each reply, while still having the CLI argument take priority if set.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the suggestion! It landed on master in ac97df2 and will ship with the next release.  You can now set the posting style in your config, globally or per account:  ```toml message.reply.posting-style = "bottom" message.forward.posting-style = "top"  [accounts.example] message.reply.posting-style = "none" ```  It takes `top`, `bottom` or `none`, and `--posting-style` still wins over it when passed. With nothing set, the default stays `top`.  If you're coming from v1, this replaces `template.reply.posting-style` (see MIGRATION.md).
  > Thank you for the quick response here and an excellent tool!

- **Issue #771** (2026-10-03): **fix: keep control characters out of envelope and attachment tables**
  *Symptoms*: Subjects, display names, filenames, mailbox names and ids were printed exactly as the message or the server supplied them, so a sender could put terminal escape sequences in front of the reader (an OSC 52 clipboard write, hidden text, a cleared screen) or disguise a filename with bidi overrides.  - The single-line fields of the envelope, attachment, mailbox, ID, pimdir queue, JMAP, Gmail and Graph outputs go through `pimalaya_cli::table::sanitize` (pimalaya-cli 0.2.6). JMAP set errors are sanitized once, in `format_set_error`. Multi-line fields (vacation bodies, the send-as signature) are left as they are. - `write_bytes_or_save` also refuses DEL and C1 on a terminal. Bytes that are not UTF-8 are read as Latin-1, so UTF-8 continuation bytes in 0x80..=0x9f are not taken for C1. - The Cairn change `plain-output-is-printable` is narrowed to single-line fields, folded into `cairn/spec/commands.md` and logged.  Testing:  - Tests rendering the envelope and attachment tables from strings holding OSC 52, SGR and screen-clearing sequences, and tests of the binary check (C0, DEL, UTF-8 and raw C1, UTF-8 text with continuation bytes in that range). - `cargo test`, `cargo clippy --all-targets` (also with `pimdir,m2dir,mbox`) and `cargo fmt --check` are clean; the reduced builds from CONTRIBUTING.md pass.  LLM tools were used. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report and the clear write-up, the problem is real.  Since cardamum and calendula share the same tables, I moved the function into pimalaya-cli and credited you as co-author. It's released in 0.2.6 as `pimalaya_cli::table::sanitize`. It's your `printable()`, with one addition: it also replaces bidi controls (U+202A–202E, U+2066–2069). Without that, a filename like `invoice\u{202e}fdp.exe` displays as `invoiceexe.pdf`.  The approach is approved, so please finish it in this PR:  - Bump `pimalaya-cli` to 0.2.6, remove `printable()` from `src/shared/table.rs`, and use `sanitize` in its place. - Convert the other renderings listed in your tasks (IMAP fetch, ID and mailbox list, pimdir queue, JMAP, Gmail, Graph). - In `src/shared/output.rs`, have the binary check also catch DEL and C1. - Narrow the Cairn delta to single-line fields from a message or a server (subjects, names, filenames, mailbox names, ids). Message bodies are guarded by the binary check, and they need to keep 
  > Thanks, and for moving it into pimalaya-cli. Done in 80a99a9, rebased on master:  - bumped pimalaya-cli to 0.2.6 and replaced `printable()` with `sanitize`; - converted the IMAP, pimdir, JMAP, Gmail and Graph outputs (JMAP set errors once, in `format_set_error`); multi-line fields such as vacation bodies and the send-as signature are left alone; - the binary check now refuses DEL and C1 too; - narrowed the Cairn delta to single-line fields, folded it into `commands.md` and added the log entry; - one-line CHANGELOG, and the BudgetScan line is gone.  One side effect of the binary check: bytes that are not UTF-8 are read as Latin-1 to catch raw C1, so an 8-bit Windows-1252 body with bytes in 0x80..=0x9f is now refused on a terminal as well. It still prints when stdout is redirected or with `--output`.
  > Thanks, all good. The Windows-1252 side effect is fine for now; we'll revisit if it turns out to bite. Merging.

- **Issue #770** (2026-10-02): **fix(search): compile eval with msgraph backend alone**
  *Symptoms*: ## Problem  `cargo install` with `msgraph` but without any local backend fails (v2.2.1):  ```text error[E0432]: unresolved import `crate::email::search::eval`   --> src/msgraph/backend.rs:36:18    | 36 |         search::{eval::sort_envelopes, query::SearchEmailsQuery},    |                  ^^^^ could not find `eval` in `search`  ```  `src/email/search/mod.rs` gates `eval` on `maildir`, `m2dir`, `mbox` and `pimdir` only. That was correct until 537bcf6 added Graph `search_envelopes`, which sorts each page locally via `eval::sort_envelopes` (Graph refuses `$skip`/`$orderby` beside `$search`) without extending the gate. Default features mask it since they always include the local backends.   ## Change   - Gate `eval` also on `feature = "msgraph"` (`msgraph` already pulls in `mail-parser`, which `eval` needs). One line, no behavior change.   ## Verification   - `cargo build --no-default-features --features msgraph,rustls-ring`: failed before, passes after.  - `cargo build --no-default-features --features imap,smtp,rustls-ring`: passes.  - `cargo build --no-default-features --features jmap,rustls-ring`: passes.  - `cargo test --no-default-features --features sieve,rustls-ring`: passes.
  **Post-Mortem & Fix Analysis**:
  > Nice catch, thanks for the contribution!

- **Issue #769** (2026-10-01): **UTF-8 shouldn't be hardcoded with every IMAP request**
  *Symptoms*: Recent commit c64bda8cc38cc4d347f717f6a187744004d83ffc (related to this commit on io-imap https://github.com/pimalaya/io-imap/commit/6cfb2a3a4d83be6009c17a5c83c96a3a3081a522) fixed an issue with Gmail not accepting queries with non-ascii chars. But this breaks outlook, which doesn't support UTF-8 searches over IMAP.  ```bash > himalaya -a "outlook" envelope --log-level debug search from "something" ... redacted ... [DEBUG io_sasl::xoauth2] xoauth2 exchange completed [DEBUG io_imap::sasl::auth_xoauth2] fetch capabilities Error: IMAP SEARCH failed: NO The specified charset is not supported. ```  It seems that change was a regression fix for an old issue #3 on io-imap. I think that the latest change to force it should be left in place but only as a default, and add a new `--charset` flag to `envelop search` or other similar commands that allow the user to override it.  So in gmail I could use `himalaya envelope <--json> search $filter` or `himalaya envelope <--json> --charset utf-8 search $filter` and it would be equivalent, but I could also use `himalaya envelope <--json> --chartset ascii search $filter` which would work on outlook (although it would fail in gmail but now the user can fix it).
  **Post-Mortem & Fix Analysis**:
  > Dear GAFAM, how annoying you are. You fix an issue on one, it breaks the other…  I agree with your proposition. I would just reverse the logic: utf-8 is widely used and supported and should remain the default. I don't understand why Microsoft does not support it. So Microsoft users will have to put a different charset either via argument or in the config file.  
  > I did not go for the `--charset` nor config option. Instead the search checks by itself is it requires or not the UTF-8 charset. In case there is an UTF-8 search string and it sends to Microsoft, it will fail and it is the "normal" behaviour: Microsoft does not support UTF-8 search. For all the rest it should work as expected, for both providers.
  > Just confirming that commit 763ecc1569105e1f0f9f07db27363d3af0d28c19 fixed the issue, IMAP searches are working on gmail and outlook without the need for the `--charset` flag.

- **Issue #768** (2026-09-28): **fix: strip surrounding quotes from quoted search patterns**
  *Symptoms*: The `quoted_pattern` parser used `.to_slice()`, which returned the raw input slice including the enclosing double-quote characters. A search like `from "alice smith"` stored the pattern as `"alice smith"` (with literal `"` chars), so every backend that consumes the parsed filter — client-side evaluation, IMAP `SEARCH`, JMAP `Email/query`, and Gmail `q` — looked for double-quote characters in the address or header, which never matched.  The concrete failure: `himalaya envelope search 'from "alice smith"'` against a maildir containing a message from `Alice Smith <alice.smith@example.org>` returns no results, because `addresses_contain` checks whether `alice.smith@example.org` contains `"alice smith"` (with quotes), and it does not. The same pattern reaches IMAP as `FROM "\"alice smith\""` and Gmail as `from:"\"alice smith\""`, both wrong.  The fix replaces `.to_slice()` with `.ignore_then()` / `.then_ignore()` / `.collect()`, so the quote characters are consumed as delimiters and only the inner characters — with escape sequences already handled by the existing `bslash().ignore_then(one_of(...))` combinator — are collected into the pattern string.  The existing tests are updated to expect the stripped values, and a new assertion covers an escaped quote inside the pattern (`"escaped \" quote"` producing `escaped " quote`).  ---  **AI disclosure** (per [AI_POLICY.md](https://github.com/pimalaya/.github/blob/master/AI_POLICY.md)): this defect was found by a defect-hunting pipeline 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the fix!

- **Issue #766** (2026-09-26): **fix: parse display names in To, Cc and Bcc the same way as From**
  *Symptoms*: `--to 'Alice <alice@example.org>'` composes `To: <Alice <alice@example.org>>`, which no SMTP server accepts. The same happens with `--cc` and `--bcc`, in `message compose`, `reply` and `forward`.  This is the recipient side of #727. That fix taught the builder to parse `--from` as a mailbox, but the `addresses()` helper behind the three recipient headers still hands each value over as a bare address. This change makes it go through `parse_mailbox` too, so the display name reaches the builder apart from the address. A value with no email address is now rejected with the same error as `--from`, instead of producing an invalid header.  The test `compose_to_keeps_a_spelled_out_display_name_apart` is added next to the existing `--from` test. It fails on master, where the header contains `<Alice <alice@example.org>>`, and passes with the change; the full `cargo test` run passes. The CHANGELOG entry and the Cairn log are included, spec unchanged.  Refs: #727  ## AI disclosure  Found and fixed by a defect-hunting pipeline built and run by [@Dev-next-gen](https://github.com/Dev-next-gen), using Claude Code for code analysis, patch generation, and test authoring. The human reviewed the diff, the test logic, and the proof output before approving submission.  Nothing this pipeline produces is submitted without human approval. The entire pull request — the code change, the tests, and this description — was reviewed by a human before the pipeline was allowed to submit it.  (@
  **Post-Mortem & Fix Analysis**:
  > Thanks! Merged. Display names containing commas ("Doe, Alice" <…>) are still split by the `,` delimiter before parsing, I'll handle that in a follow-up.

- **Issue #765** (2026-09-26): **fix(imap): terminate the last raw command with CRLF**
  *Symptoms*: Closes #764.  When the last command passed to `imap raw` had no terminator, it was appended as a bare LF. io-imap accepts that as a complete line, but Gmail never answers a bare-LF command, so the exchange hung until `stream stopped responding after 60s`. Commands piped through stdin always hit it: `RawCommandArg::resolve` joins stdin lines with CRLF and leaves the last one bare.  The terminator is now a full CRLF. It lives in a small `terminate` helper with unit tests. The spec (`cairn/spec/commands.md`) already requires a trailing CRLF, so only a log entry and a CHANGELOG line were added.  ## Verification  - `cargo test --locked imap::raw`: 3 new tests pass. - `cargo build --release --locked`. - Against Gmail (read-only), all of these previously hung for 60 s and now answer immediately:   - `himalaya imap raw -- 'a1 NOOP'` → `a1 OK Success`   - `printf 'a1 NOOP\r\n' | himalaya imap raw` → `a1 OK Success`   - `himalaya imap raw -- 'a1 EXAMINE "[Gmail]/All Mail"\r\na2 UID SEARCH X-GM-RAW "…"'` → `a2 OK SEARCH completed`  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01MiqyKJUdNzRBBMHQNGxLKn 
  **Post-Mortem & Fix Analysis**:
  > I pushed the changes directly on `master`, I left you as co-author. Thanks for the contribution!

- **Issue #764** (2026-09-26): **imap raw: last command terminated with bare LF instead of CRLF, hangs on Gmail**
  *Symptoms*: `himalaya imap raw` terminates the last command with a bare LF instead of CRLF. Gmail silently ignores LF-terminated command lines, so the command hangs until the stream timeout:  ``` $ himalaya imap raw -- 'a1 NOOP' Error: stream stopped responding after 60s ```  ## Environment  - himalaya v2.1.0 (Homebrew, macOS aarch64), IMAP backend, Gmail (`imap.gmail.com:993`, AUTH=PLAIN) - Other IMAP commands (`imap list`, `imap search`, `envelope search`) work fine against the same account.  ## Reproduction  All of these hang for 60 s, then fail with `stream stopped responding after 60s`:  ```sh himalaya imap raw -- 'a1 NOOP' himalaya imap raw -- 'a1 EXAMINE "[Gmail]/All Mail"\r\na2 UID SEARCH ALL'   # last command without trailing \r\n printf 'a1 NOOP\r\n' | himalaya imap raw                                    # stdin, even with a real CRLF ```  With `--log-level trace`, authentication succeeds and the batch is logged as:  ``` [TRACE io_imap::rfc3501::raw] build raw batch (1 command(s)): a1 NOOP\n [DEBUG pimalaya_stream::retry] give up on stream after 0 retries: Resource temporarily unavailable (os error 35) ```  The same log prints other lines with `\r\n` (e.g. the greeting), so the CR is really missing on the wire.  Gmail does not answer bare-LF commands. Checked with `openssl s_client -quiet -connect imap.gmail.com:993` before authentication: `a1 CAPABILITY\n` gets no reply at all, while `a1 CAPABILITY\r\n` is answered immediately.  ## Cause  - `src/imap/raw.rs`, `ImapRawCommand::

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

### Incident Patch 1: `3449355e` (2026-10-05)
**Commit Message**: fix(pimdir): name a performer for a collection only declared

A collection the sync engine declared without syncing has no source
syncing it, so the account's candidates count as a declaration: a
mailbox can be created in a store that holds no item yet.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Added
 
 - Added the role of a pimdir mailbox (pimdir draft-04, io-pimdir `ef8eae0`): `mailbox list` shows the role the sync engine recorded from the server (`collections.role`), and a role name (`inbox`, `sent`, `drafts`, `trash`, …) addresses its mailbox in every command, as on IMAP and JMAP.
+- Fixed `pimdir mailbox create` refusing a store whose collections the sync engine only declared (`neverest sync --declare-only`): the account's candidates count as a declaration, not only the sources syncing the anchor.
 - Added a stable `code` to the `--json` error output for failures a caller is expected to act on, found anywhere in the error chain. The first is `body-pending`: a pimdir message listed but whose body is not downloaded yet.
 - Added the `wizard` cargo feature, on by default, gating the interactive configuration: the `configure` command and the offer a first run makes. A build without it drops the prompts and the dependencies only they use, and a missing configuration points at the documented sample instead.
 - Added `pimdir message add` and `pimdir message send`, staging as the shared commands do and printing the queue row with the `Message-ID`, and `pimdir queue show <ROW>`, saying whether a row is pending, parked (with why), applied (with the id of the message an add created; a message sent or a mailbox created once the sync engine acknowledges it) or unknown.
```

**File**: `src/pimdir/client.rs` (modified, +5/-1)
```diff
@@ -144,11 +144,15 @@ impl PimdirClient {
         collection: &str,
         capability: &str,
     ) -> Result<Option<String>> {
+        // NOTE: a collection the sync engine only declared (`neverest sync
+        // --declare-only`) has no source syncing it yet, so the account's
+        // candidates count too.
         let declared = producer
             .capabilities(collection)
             .map_err(|err| anyhow!("Read the capabilities of `{collection}`: {err}"))?
             .iter()
-            .any(|source| source.declared.is_some());
+            .any(|source| source.declared.is_some())
+            || !self.performers(capability)?.0.is_empty();
         if !declared {
             return Ok(None);
         }
```

---

### Incident Patch 2: `cbfe9bb0` (2026-10-04)
**Commit Message**: fix: keep pimdir details out of the shared outputs

Drop the pimdir-only queued count from envelope list, the queueId from message send, message add --send and the composers, and the notes wrapping the shared writes. The pimdir backend logs a queued send's row id and a partially supported write instead; pimdir queue list shows what is queued.

**File**: `CHANGELOG.md` (modified, +2/-2)
```diff
@@ -11,16 +11,16 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - Added the `wizard` cargo feature, on by default, gating the interactive configuration: the `configure` command and the offer a first run makes. A build without it drops the prompts and the dependencies only they use, and a missing configuration points at the documented sample instead.
 - Added the `pimdir performer` command, showing which sources can perform a capability such as `mail.submit` for the account and recording the user's choice among them (pimdir draft-03, STORAGE §15.6).
-- Added notes to the pimdir writes: a write passing on a source that supports it only in part ends with a `Note:` line, and a `notes` array under `--json`.
 
 ### Changed
 
-- Changed the pimdir writes to be refused before they are queued when a source of the store does not support them, naming the capability, the source and why, and a send to be refused while several sources can send and none is chosen.
+- Changed the pimdir writes to be refused before they are queued when a source of the store does not support them, naming the capability, the source and why, and a send to be refused while several sources can send and none is chosen. A write a source supports only in part logs a warning.
 - Changed a pimdir send asking for a copy to carry it in the queued send, so the copy is filed only once the message is sent; a store whose owner declares no capabilities still gets the copy queued beside the send.
 
 ### Fixed
 
 - Fixed control and bidi characters from messages and servers reaching the terminal through the plain output.
+- Fixed pimdir queue details leaking into the shared outputs: `envelope list` no longer reports a `queued` count, and `message send`, `message add --send` and the composers no longer print a `queueId`. `himalaya pimdir queue list` shows what is queued, and a queued send logs its row id at info level.
 
 ## [2.2.1] - 2026-10-02
 
```

**File**: `cairn/changes/shared-output-free-of-pimdir/delta.md` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+---
+cairn: change
+change: shared-output-free-of-pimdir
+---
+
+# Delta
+
+## ADDED Requirements
+
+### Requirement: Shared outputs carry no backend details
+The output of a shared command SHALL NOT carry a field that only one backend fills. A backend detail worth showing SHALL be logged by that backend's adapter or shown by its own namespace.
+
+## MODIFIED Requirements
+
+### Requirement: A queued creation is reported, not listed
+A queued creation has no public id until the store's owner applies it, so the pimdir backend SHALL NOT project one as an envelope, and SHALL NOT put a placeholder in `Envelope.id`. `add_message` returns the link id it staged, which identifies the creation across the window. `himalaya pimdir queue list` is where queued creations show.
+
+### Requirement: pimdir sends by queueing a submit intent
+The command SHALL NOT report the queue row id in its output; the pimdir backend SHALL log it at info level.
+
+### Requirement: The queue view shows queued sends
+`himalaya pimdir queue list` SHALL render a queued `submit` as a message, derived from the body it pins as a create is, marked as a send, beside the queued creates of the same mailbox.
```

**File**: `cairn/changes/shared-output-free-of-pimdir/proposal.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+cairn: change
+id: shared-output-free-of-pimdir
+status: landed
+created: 2026-10-04
+---
+
+# Keep pimdir details out of the shared outputs
+
+## Why
+
+The shared commands are a protocol-agnostic API, and pimdir is one backend among several. Yet their outputs grew pimdir-only fields: a `queued` count on `envelope list`, a `queueId` on `message send`, `message add --send` and the composers, and a `notes` array wrapping every write. Each was empty or absent on every other backend, so they described one backend's store rather than the operation.
+
+## What
+
+The shared outputs drop `queued`, `queueId` and `notes`. A queued send logs its row id at info level, a write a source supports only in part logs a warning, and `himalaya pimdir queue list` remains the place to see what is queued. `EmailClient::send_message` returns only whether the backend filed the sent copy itself, documented without naming a backend.
```

**File**: `cairn/changes/shared-output-free-of-pimdir/tasks.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+cairn: tasks
+change: shared-output-free-of-pimdir
+---
+
+# Tasks
+
+- [x] Remove `Noted`, `take_notes` and the `notes` field from the shared write outputs and their JSON schemas; log partial support as a warning in the pimdir client.
+- [x] Remove `queueId` from `MessageRouteOutput` and `MessageAddOutput`, and the queue id from `Outcome`; log the row id in the pimdir backend.
+- [x] Remove `queued` from `Envelopes` and `EmailClient::queued_messages`.
+- [x] Fold the delta into [cairn/spec/backends.md](../../spec/backends.md); write the log entry.
```

**File**: `cairn/log/2026-10-04-shared-output-free-of-pimdir.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+cairn: log
+change: shared-output-free-of-pimdir
+landed: 2026-10-04
+---
+
+# Shared outputs drop the pimdir queue details
+
+`envelope list` no longer carries a `queued` count, `message send`, `message add --send` and the composers no longer print a `queueId`, and the shared writes no longer end with notes or carry a `notes` array. Each field was filled by pimdir alone. The pimdir backend logs a queued send's row id at info level and a capability its source supports only in part as a warning; `himalaya pimdir queue list` shows what is queued. `EmailClient::send_message` returns only whether the backend filed the sent copy itself.
+
+Capabilities moved: **backends** (shared outputs carry no backend details; queued creations and sends shown by `pimdir queue list` alone).
```

**File**: `cairn/spec/backends.md` (modified, +7/-6)
```diff
@@ -11,6 +11,9 @@ Each backend is a `<Proto>Client` wrapper that derefs onto the io-* `*Std` clien
 ### Requirement: Shared operation set
 The shared adapters SHALL cover, per backend: `list_mailboxes`, `list_envelopes`, `search_envelopes`, `store_flags`, `get_message`, `add_message`, `copy_messages`, `move_messages`, and `send_message`. A backend that cannot model an operation opts out of it rather than emulating it.
 
+### Requirement: Shared outputs carry no backend details
+The output of a shared command SHALL NOT carry a field that only one backend fills. A backend detail worth showing SHALL be logged by that backend's adapter or shown by its own namespace.
+
 ### Requirement: The envelope carries its threading pointers
 The shared `Envelope` SHALL carry `message_id` and `in_reply_to`, the RFC 5322 §3.6.4 identity of a message and of the message(s) it replies to, so a client can pair a reply with its parent from a listing rather than by reading bodies.
 
@@ -98,9 +101,7 @@ A write SHALL be staged as a queued `PimdirAction` through a producer handle (`s
 An added message SHALL derive its link id through io-pimdir's mail derivation (`summary::mail::derive`), the one implementation of SPEC Annex A.1, which is the bare `Message-ID` with nothing prepended, and SHALL name it on the queued `Add`. The action carries no summary: the owner derives the summary and the sort key from the body when it applies the action, through the same call, so the two never disagree. A staged `Add` whose link id the collection already holds SHALL park (pimdir SPEC §15.3): it neither deduplicates against the stored copy nor mints a second key. Minting is the store's answer to what a source hands over; parking is its answer to a producer authoring a message the collection already has.
 
 ### Requirement: A queued creation is reported, not listed
-A queued creation has no public id until the store's owner applies it, so the pimdir backend SHALL NOT project one as an envelope, and SHALL NOT put a placeholder in `Envelope.id`. `add_message` returns the link id it staged, which identifies the creation across the window.
-
-An envelope listing SHALL report how many creations the mailbox has queued and name the command that shows them, so a saved message that is not in the list reads as queued rather than as lost. A backend that stages nothing reports none, which every backend whose writes reach the server as they are made does. An envelope *search* SHALL report none whatever the backend: a queued creation is never matched against the query, so a count its filter never saw would be misleading.
+A queued creation has no public id until the store's owner applies it, so the pimdir backend SHALL NOT project one as an envelope, and SHALL NOT put a placeholder in `Envelope.id`. `add_message` returns the link id it staged, which identifies the creation across the window. `himalaya pimdir queue list` is where queued creations show.
 
 ### Requirement: The pimdir subcommand reads and retracts the queue
 Himalaya SHALL carry a `pimdir` subcommand for what the operator CLI cannot do without knowing mail. `queue list` SHALL render a queued creation as a message (flags, subject, recipient, and when it was queued, from the row's `created_at`) where the kind-agnostic `pimdir` binary can only print ids and hashes. The queued action carries no summary, so the row SHALL be derived from the body the action pins, through the same derivation the owner applies; an action pinning no body renders with its flags alone. `queue cancel` SHALL retract one row through io-pimdir's scoped owner operation, confirming first unless `--yes`.
@@ -119,12 +120,12 @@ The payload SHALL be `v: 1` JSON carrying `object` (the body hash), `from`, `rcp
 
 The row SHALL anchor on the `--save` mailbox when one is given, else on the mailbox `mailbox.alias.sent` names; with neither, the send SHALL be refused, naming the alias to set, rather than create a collection.
 
-The command SHALL report the queue row id, and its text SHALL say the message is queued for sending, not sent.
+The command SHALL NOT report the queue row id in its output; the pimdir backend SHALL log it at info level.
 
 #### Scenario: A send made offline waits in the queue
 - GIVEN a pimdir account with `mailbox.alias.sent` set and no network
 - WHEN a message is sent
-- THEN one `submit` row is queued on the sent mailbox with the message's envelope, and the command prints its row id
+- THEN one `submit` row is queued on the sent mailbox with the message's envelope
 
 #### Scenario: A Bcc recipient is in the envelope
 - GIVEN a message with `To: a@x.org` and `Bcc: b@x.org`
@@ -137,7 +138,7 @@ The command SHALL report the queue row id, and its text SHALL say the message is
 - THEN nothing is staged and the error names `mailbox.alias.sent`
 
 ### Requirement: The queue view shows queued sends
-`himalaya pimdir queue list` SHALL render a queued `submit` as a message, derived from the body it pins as a create is, marked as
```

**File**: `src/json_schema.rs` (modified, +6/-12)
```diff
@@ -47,34 +47,28 @@ pub fn schemas() -> BTreeMap<String, Value> {
             "himalaya-envelope-search",
             crate::shared::envelope::list::Envelopes
         );
-        insert!(
-            "himalaya-flag-add",
-            crate::shared::note::Noted<crate::shared::flag::add::AddedFlags>
-        );
-        insert!(
-            "himalaya-flag-set",
-            crate::shared::note::Noted<crate::shared::flag::set::SetFlags>
-        );
+        insert!("himalaya-flag-add", crate::shared::flag::add::AddedFlags);
+        insert!("himalaya-flag-set", crate::shared::flag::set::SetFlags);
         insert!(
             "himalaya-flag-remove",
-            crate::shared::note::Noted<crate::shared::flag::remove::RemovedFlags>
+            crate::shared::flag::remove::RemovedFlags
         );
         insert!(
             "himalaya-message-add",
-            crate::shared::note::Noted<crate::shared::message::add::MessageAddOutput>
+            crate::shared::message::add::MessageAddOutput
         );
         // NOTE: `message send` prints the confirmation line only.
         insert!(
             "himalaya-message-send",
-            crate::shared::note::Noted<crate::shared::message::handler::MessageRouteOutput>
+            crate::shared::message::handler::MessageRouteOutput
         );
         insert!(
             "himalaya-message-read",
             crate::shared::message::read::MessageView
         );
         insert!(
             "himalaya-message-delete",
-            crate::shared::note::Noted<crate::shared::message::delete::DeleteReport>
+            crate::shared::message::delete::DeleteReport
         );
         // NOTE: the composers print a `MessageTemplate` when neither
         // saving nor sending, and a confirmation line otherwise.
```

**File**: `src/pimdir/backend.rs` (modified, +9/-21)
```diff
@@ -37,7 +37,7 @@ use io_pimdir::{
         mail::{self, PimdirMailSummary},
     },
 };
-use log::warn;
+use log::{info, warn};
 use serde::Serialize;
 
 use crate::{
@@ -176,16 +176,6 @@ impl PimdirClient {
         Ok(paginate(hits, page, page_size))
     }
 
-    /// How many messages the mailbox has queued for creation or sending and
-    /// not synced yet.
-    ///
-    /// A queued create or send has no public id, so it is no envelope and
-    /// has no row. The count is what a listing reports instead, so a saved
-    /// or sent message reads as queued rather than as lost.
-    pub fn queued_messages(&mut self, mailbox: &str) -> Result<usize> {
-        Ok(self.queued_mail(mailbox)?.len())
-    }
-
     /// The mailbox's queued creations and sends, rendered as mail.
     ///
     /// The operator CLI is kind-agnostic and prints ids, hashes and flags.
@@ -309,8 +299,7 @@ impl PimdirClient {
         Ok(link_id.0)
     }
 
-    /// Queues a message for the store's owner to send, returning the queue
-    /// row id.
+    /// Queues a message for the store's owner to send.
     ///
     /// The body is stored as given, `Bcc:` included, and the row carries the
     /// envelope derived from its headers, the `submit` intent any owner of
@@ -327,13 +316,13 @@ impl PimdirClient {
     /// the field and would ignore it, so the copy is left to the caller
     /// there, as before.
     ///
-    /// Returns the queue row id, and whether the intent carries the copy.
+    /// Returns whether the intent carries the copy.
     pub fn send_message(
         &mut self,
         mailbox: Option<&str>,
         raw: Vec<u8>,
         copy: bool,
-    ) -> Result<(i64, bool)> {
+    ) -> Result<bool> {
         let Some(mailbox) = mailbox else {
             bail!(
                 "A pimdir account queues a sent message under a mailbox: \
@@ -373,7 +362,8 @@ impl PimdirClient {
         let id = self
             .enqueue(&mut producer, &collection, &action, Some(&object))
             .map_err(|err| anyhow!("Queue send in `{mailbox}`: {err}"))?;
-        Ok((id, carried))
+        info!("message queued for sending as action {id}, see `himalaya pimdir queue list`");
+        Ok(carried)
     }
 
     /// Copies each id from `from` to `to`, staged as `Copy` (a server-side copy
@@ -878,13 +868,12 @@ mod tests {
     fn a_sent_message_is_one_submit_row_with_its_envelope() {
         let (_dir, mut client) = sent_store();
 
-        let (row, _) = client
+        client
             .send_message(Some("imap/Sent"), RAW.to_vec(), false)
             .unwrap();
 
         let pending = client.store.pending_actions("imap/Sent").unwrap();
         assert_eq!(pending.len(), 1);
-        assert_eq!(pending[0].id, row);
         let PimdirAction::Unknown {
             kind,
             payload,
@@ -918,14 +907,13 @@ mod tests {
         assert_eq!(queued.len(), 1);
         assert!(queued[0].send);
         assert_eq!(queued[0].envelope.subject, "hi");
-        assert_eq!(client.queued_messages("imap/Sent").unwrap(), 1);
     }
 
     #[test]
     fn a_send_asking_for_a_copy_leaves_it_to_the_caller_on_an_undeclared_owner() {
         let (_dir, mut client) = sent_store();
 
-        let (_, carried) = client
+        let carried = client
             .send_message(Some("imap/Sent"), RAW.to_vec(), true)
             .unwrap();
 
@@ -963,7 +951,7 @@ mod tests {
         store.declare("imap", &declaration).unwrap();
         drop(store);
 
-        let (_, carried) = client
+        let carried = client
             .send_message(Some("imap/Sent"), RAW.to_vec(), true)
             .unwrap();
         assert!(carried);
```

---

### Incident Patch 3: `1dc3ad0f` (2026-10-03)
**Commit Message**: fix: keep control and bidi characters out of the plain output (#771)

* fix: keep control characters out of envelope and attachment tables

Subjects, sender names and attachment names were printed exactly as
the message carried them, so any sender could put escape sequences in
front of the reader: rewrite the clipboard (OSC 52), hide text, clear
the screen.

printable() replaces control characters with U+FFFD in the cells of
envelope list, envelope search and attachment list. The JSON output is
unchanged. The cairn change lists the other plain renderings of
server-supplied strings to convert next.

* fix: sanitize server strings in every plain output

Use pimalaya_cli::table::sanitize from pimalaya-cli 0.2.6, which also
replaces bidi controls, in place of the local printable(), and apply it
to the single-line fields of the IMAP, pimdir, JMAP, Gmail and Graph
outputs. JMAP set errors are sanitized once, in format_set_error().

The binary check of write_bytes_or_save() now also refuses DEL and C1,
reading bytes that are not UTF-8 as Latin-1, so that UTF-8 continuation
bytes are not mistaken for C1.

Narrow the cairn delta to single-line fields, fold it into the commands
spec and log 

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- Fixed control and bidi characters from messages and servers reaching the terminal through the plain output.
+
 ## [2.2.1] - 2026-10-02
 
 ### Added
```

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1942,9 +1942,9 @@ checksum = "9b4f627cb1b25917193a259e49bdad08f671f8d9708acfd5fe0a8c1455d87220"
 
 [[package]]
 name = "pimalaya-cli"
-version = "0.2.5"
+version = "0.2.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "df3482c0af710d2f95f8cdbe660a8d89eaa361ac07daed47cb28b00e0c5d6289"
+checksum = "1886248cd5b085601f5dc17d7a984972b854efad78ea59d0488fa158202e6a69"
 dependencies = [
  "anyhow",
  "clap",
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ strip = "symbols"
 panic = "abort"
 
 [build-dependencies]
-pimalaya-cli = { version = "0.2", default-features = false, features = ["build"] }
+pimalaya-cli = { version = "0.2.6", default-features = false, features = ["build"] }
 
 [dev-dependencies]
 tempfile = "3"
@@ -69,7 +69,7 @@ mail-parser = { version = "0.11", features = ["full_encoding", "serde"], optiona
 mime_guess = "2"
 open = "5"
 percent-encoding = "2"
-pimalaya-cli = { version = "0.2", default-features = false, features = ["terminal", "table", "prompt", "wizard", "imap", "smtp", "jmap", "spinner"] }
+pimalaya-cli = { version = "0.2.6", default-features = false, features = ["terminal", "table", "prompt", "wizard", "imap", "smtp", "jmap", "spinner"] }
 pimalaya-config = { version = "0.2.1", default-features = false, features = ["toml", "secret"] }
 pimalaya-stream = { version = "0.3", default-features = false, features = ["std"] }
 rfc2047-decoder = { version = "1", optional = true }
```

**File**: `cairn/changes/plain-output-is-printable/delta.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+cairn: change
+change: plain-output-is-printable
+---
+
+# Delta
+
+## ADDED Requirements
+
+### Requirement: Plain output is printable
+A single-line field taken from a message or a server (a subject, a name, a filename, a mailbox name, an id) SHALL have its control characters (C0, DEL and C1) and bidi controls (U+202A to U+202E, U+2066 to U+2069) replaced with U+FFFD before it is printed as plain output, so it can neither drive the terminal nor reorder what is displayed. Message bodies keep their tabs and newlines; on a terminal they SHALL be refused as binary when they hold any other control character, DEL and C1 included. The `--json` output SHALL keep the strings unchanged.
```

**File**: `cairn/changes/plain-output-is-printable/proposal.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+cairn: change
+id: plain-output-is-printable
+status: landed
+created: 2026-10-02
+---
+
+# Keep control characters out of the plain output
+
+## Why
+
+The tables print subjects, display names, filenames and other strings exactly as the message or the server supplied them, so anyone who can send a message can put terminal escape sequences in front of the reader. A subject ending in `ESC ] 52 ; c ; … BEL` rewrites the clipboard in terminals that honour OSC 52, `ESC [ 8 m` hides the rest of the line and `ESC [ 2 J` clears the screen. The `--json` output escapes the C0 characters, ESC included, and is left as it is.
+
+## What
+
+`pimalaya_cli::table::sanitize` (pimalaya-cli 0.2.6, shared with cardamum and calendula) replaces every control character (C0, DEL and C1) and the bidi controls with U+FFFD, and borrows the string when there is none. It is applied where a single-line field from a message or a server is rendered: the envelope, attachment, mailbox, ID, pimdir queue, JMAP, Gmail and Graph outputs. Message bodies keep their tabs and newlines; the binary check of `write_bytes_or_save` now also refuses DEL and C1 on a terminal. The data and the `--json` output keep the original strings.
```

**File**: `cairn/changes/plain-output-is-printable/tasks.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+---
+cairn: tasks
+change: plain-output-is-printable
+---
+
+# Tasks
+
+- [x] `sanitize` in pimalaya-cli 0.2.6, replacing the local `printable`.
+- [x] `envelope list` and `envelope search`: id, subject, and the FROM or TO names.
+- [x] `attachment list`: id, filename, type and path.
+- [x] IMAP: `imap fetch` headers and structure, `imap mailbox list`, `imap id`.
+- [x] `pimdir queue list`: subject and recipients.
+- [x] JMAP: set errors (`format_set_error`), `jmap identity delete`, `jmap vacation get`.
+- [x] Gmail: `threads get`, `threads list`, `settings sendas get`, `settings vacation get`, filter ids and summaries.
+- [x] Graph: `attachments list`, `mail-folders list`.
+- [x] The binary check of src/shared/output.rs also refuses DEL and C1.
+- [x] Fold the delta into [cairn/spec/commands.md](../../spec/commands.md); write [cairn/log/2026-10-03-plain-output-is-printable.md](../../log/2026-10-03-plain-output-is-printable.md).
```

**File**: `cairn/log/2026-10-03-plain-output-is-printable.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+---
+cairn: log
+change: plain-output-is-printable
+landed: 2026-10-03
+---
+
+# Plain output keeps control and bidi characters out of the terminal
+
+Subjects, names, filenames, mailbox names and ids reached the plain output as the message or the server supplied them, so a sender could drive the terminal with escape sequences (rewriting the clipboard with OSC 52, hiding text, clearing the screen) or disguise a filename with bidi overrides.
+
+The single-line fields of the envelope, attachment, mailbox, ID, pimdir queue, JMAP, Gmail and Graph outputs now go through `pimalaya_cli::table::sanitize` from pimalaya-cli 0.2.6, which replaces C0, DEL, C1 and the bidi controls with U+FFFD. JMAP set errors are sanitized once, in `format_set_error`. Message bodies keep their tabs and newlines; `write_bytes_or_save` now refuses DEL and C1 on a terminal as well, reading bytes that are not UTF-8 as Latin-1. The `--json` output is unchanged.
+
+Capabilities moved: **commands** (plain output is printable).
+
+Verified with unit tests rendering the envelope and attachment tables from strings holding OSC 52, SGR and screen-clearing sequences, and with tests of the binary check for C0, DEL, UTF-8 encoded and raw C1, and UTF-8 text whose continuation bytes fall in 0x80..=0x9f.
```

**File**: `cairn/spec/commands.md` (modified, +3/-0)
```diff
@@ -29,6 +29,9 @@ The active account context SHALL be threaded as a sibling argument through every
 ### Requirement: Output discipline
 Data and errors SHALL go to stdout through the printer; `--json` switches every command to JSON. stderr carries logs only. Each command's doc comment is its `--help` text, so `himalaya <command> --help` is the canonical per-command usage reference.
 
+### Requirement: Plain output is printable
+A single-line field taken from a message or a server (a subject, a name, a filename, a mailbox name, an id) SHALL have its control characters (C0, DEL and C1) and bidi controls (U+202A to U+202E, U+2066 to U+2069) replaced with U+FFFD before it is printed as plain output, so it can neither drive the terminal nor reorder what is displayed. Message bodies keep their tabs and newlines; on a terminal they SHALL be refused as binary when they hold any other control character, DEL and C1 included. The `--json` output SHALL keep the strings unchanged.
+
 ### Requirement: Generation commands print to the standard output
 The `completion`, `manual` and `json-schema` commands SHALL share one shape: a positional list selecting what to generate, defaulting to everything, and an optional `--dir` deciding where it lands. Without a directory they SHALL print the single selected item to the standard output, so a packaging helper can capture it and a shell can redirect it to a file, and SHALL fail when several items are selected rather than concatenating pieces valid for nothing. With a directory they SHALL write one file per selected item in it, creating the directory when missing, and report where each landed.
 
```

---

### Incident Patch 4: `09f171b1` (2026-10-02)
**Commit Message**: fix(search): compile eval with msgraph backend alone

Refs: #770

**File**: `src/email/search/mod.rs` (modified, +4/-3)
```diff
@@ -1,15 +1,16 @@
 //! # Search
 //!
 //! The shared search query: a filter, a sort, the grammar parsing both
-//! from one string, and the client-side evaluation the local backends
-//! run it with.
+//! from one string, and the client-side evaluation run locally
+//! (filter + sort for local backends, sort-after-search for Graph).
 
 pub mod error;
 #[cfg(any(
     feature = "maildir",
     feature = "m2dir",
     feature = "mbox",
-    feature = "pimdir"
+    feature = "pimdir",
+    feature = "msgraph"
 ))]
 pub mod eval;
 pub mod filter;
```

---

### Incident Patch 5: `5b12b2a8` (2026-10-02)
**Commit Message**: build: fix ci issue, prepare v2.2.1

**File**: `CHANGELOG.md` (modified, +7/-2)
```diff
@@ -7,7 +7,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
-## [2.2.0] - 2026-10-02
+## [2.2.1] - 2026-10-02
 
 ### Added
 
@@ -207,6 +207,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
   `message read --seen` and `flag add` reported success and left the message untouched, a Maildir name in `new` having nowhere to carry a flag. The message now moves to `cur` under the same id with its flags in the name, which is the transition every Maildir client performs.
 
+## [2.2.0] - 2026-10-02
+
+Tagged and released on GitHub, but never published to crates.io: the upload failed on `Cargo.toml` declaring six keywords, one over the limit. Its changes ship in [2.2.1].
+
 ## [2.1.0] - 2026-08-16
 
 ### Added
@@ -1388,7 +1392,8 @@ Few major concepts changed:
 [core#1]: https://github.com/pimalaya/core/issues/1
 [core#10]: https://github.com/pimalaya/core/issues/10
 
-[unreleased]: https://github.com/pimalaya/himalaya/compare/v2.2.0...HEAD
+[unreleased]: https://github.com/pimalaya/himalaya/compare/v2.2.1...HEAD
+[2.2.1]: https://github.com/pimalaya/himalaya/compare/v2.1.0...v2.2.1
 [2.2.0]: https://github.com/pimalaya/himalaya/compare/v2.1.0...v2.2.0
 [2.1.0]: https://github.com/pimalaya/himalaya/compare/v2.0.0...v2.1.0
 [2.0.0]: https://github.com/pimalaya/himalaya/compare/v1.2.0...v2.0.0
```

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -934,7 +934,7 @@ checksum = "2304e00983f87ffb38b55b444b5e3b60a884b5d30c0fca7d82fe33449bbe55ea"
 
 [[package]]
 name = "himalaya"
-version = "2.2.0"
+version = "2.2.1"
 dependencies = [
  "anyhow",
  "ariadne",
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -1,13 +1,13 @@
 [package]
 name = "himalaya"
 description = "CLI to manage emails"
-version = "2.2.0"
+version = "2.2.1"
 authors = ["Clément DOUIN (soywod) <pimalaya.org@posteo.net>"]
 rust-version = "1.89"
 edition = "2024"
 license = "MIT OR Apache-2.0"
 categories = ["command-line-utilities", "email"]
-keywords = ["cli", "email", "imap", "maildir", "sieve", "smtp"]
+keywords = ["cli", "mail", "imap", "smtp", "jmap"]
 homepage = "https://pimalaya.org"
 repository = "https://github.com/pimalaya/himalaya"
 
```

**File**: `default.nix` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ in
 pimalaya.mkDefault (
   {
     src = ./.;
-    version = "2.2.0";
+    version = "2.2.1";
     mkPackage = (
       {
         lib,
```

---

### Incident Patch 6: `86605b7f` (2026-10-02)
**Commit Message**: build: prepare v2.2.0

**File**: `CHANGELOG.md` (modified, +5/-2)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [2.2.0] - 2026-10-02
+
 ### Added
 
 - Added `message.send.save-copy`, the mailbox a sent message is copied to when `--save` is not passed, and `--no-save` on `message send`, `compose`, `reply` and `forward` to skip it.
@@ -115,7 +117,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
   The stripping was therefore a guess at the sync engine's convention, needing a config key wherever it could not decide. The id is now the only spelling, as it already is for JMAP's opaque ids, and `mailbox.alias.inbox = "imap/INBOX"` is how you stop typing it.
 
-- **BREAKING**: renamed the plural commands that name no vendor resource to their singular, the plural staying as a hidden alias.
+- Renamed the plural commands that name no vendor resource to their singular, the plural staying as a hidden alias.
 
   `imap flags`, `maildir messages`, `maildir flags`, `m2dir messages` and `m2dir flags` become `imap flag`, `maildir message`, `maildir flag`, `m2dir message` and `m2dir flag`. Every old spelling keeps working, hidden from `--help`.
 
@@ -1386,7 +1388,8 @@ Few major concepts changed:
 [core#1]: https://github.com/pimalaya/core/issues/1
 [core#10]: https://github.com/pimalaya/core/issues/10
 
-[unreleased]: https://github.com/pimalaya/himalaya/compare/v2.1.0...HEAD
+[unreleased]: https://github.com/pimalaya/himalaya/compare/v2.2.0...HEAD
+[2.2.0]: https://github.com/pimalaya/himalaya/compare/v2.1.0...v2.2.0
 [2.1.0]: https://github.com/pimalaya/himalaya/compare/v2.0.0...v2.1.0
 [2.0.0]: https://github.com/pimalaya/himalaya/compare/v1.2.0...v2.0.0
 [1.2.0]: https://github.com/pimalaya/himalaya/compare/v1.1.0...v1.2.0
```

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -934,7 +934,7 @@ checksum = "2304e00983f87ffb38b55b444b5e3b60a884b5d30c0fca7d82fe33449bbe55ea"
 
 [[package]]
 name = "himalaya"
-version = "2.1.0"
+version = "2.2.0"
 dependencies = [
  "anyhow",
  "ariadne",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [package]
 name = "himalaya"
 description = "CLI to manage emails"
-version = "2.1.0"
+version = "2.2.0"
 authors = ["Clément DOUIN (soywod) <pimalaya.org@posteo.net>"]
 rust-version = "1.89"
 edition = "2024"
```

**File**: `default.nix` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ in
 pimalaya.mkDefault (
   {
     src = ./.;
-    version = "2.1.0";
+    version = "2.2.0";
     mkPackage = (
       {
         lib,
```

---

### Incident Patch 7: `beac82e7` (2026-10-02)
**Commit Message**: build: bump io-msgraph

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1323,9 +1323,9 @@ dependencies = [
 
 [[package]]
 name = "io-msgraph"
-version = "0.4.2"
+version = "0.4.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b19bc84f171926f974f7cb49fd7d699e0b4c12ed83e83d862893c7ecb0a965de"
+checksum = "bf5b9c7de32943e38be0e1f99c03c9280aca59d9041f90073404b17e2c861fb9"
 dependencies = [
  "anyhow",
  "base64 0.23.1",
```

---

### Incident Patch 8: `88f1c382` (2026-10-01)
**Commit Message**: ci: fix cross builds

**File**: `default.nix` (modified, +0/-7)
```diff
@@ -62,13 +62,6 @@ pimalaya.mkDefault (
         (drv: {
           buildInputs = (drv.buildInputs or [ ]) ++ lib.optional systemSqlite sqlite';
 
-          # pkg-config hands the linker libsqlite3 but no rpath, leaving a
-          # binary that cannot find it: not in postInstall, which runs it, nor
-          # once installed.
-          env = (drv.env or { }) // {
-            NIX_LDFLAGS = lib.optionalString systemSqlite ("-rpath " + lib.getLib sqlite' + "/lib");
-          };
-
           postInstall =
             let
               inherit (pkgs) stdenv;
```

**File**: `flake.lock` (modified, +3/-3)
```diff
@@ -41,11 +41,11 @@
     "pimalaya": {
       "flake": false,
       "locked": {
-        "lastModified": 1790857452,
-        "narHash": "sha256-sJbXBLaJLmkH1W7fRmiy9aCrwjT8ypn3g/sjvoHQYPc=",
+        "lastModified": 1790888248,
+        "narHash": "sha256-KjU8CrD6bo77bHrsaXtaGxLhv34PYHULvldbbXRVgVE=",
         "owner": "pimalaya",
         "repo": "nix",
-        "rev": "c09ccff8d979c5311493ca1bf32739df0ee3e35e",
+        "rev": "82fb3477f7b5a21aa08d68eb9de4febb0632e099",
         "type": "github"
       },
       "original": {
```

---

### Incident Patch 9: `c23743f3` (2026-10-01)
**Commit Message**: build: bump deps

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1363,9 +1363,9 @@ dependencies = [
 
 [[package]]
 name = "io-pimdir"
-version = "0.5.0"
+version = "0.5.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1fe9a53f7f303ae84c20591e0a9c7f53880fd7495f4391c08c945c161882e52e"
+checksum = "731a6a53112d974335dfb31724b68434b7f72bb2232b503f3f95d6679f7509bc"
 dependencies = [
  "blake3",
  "fs4",
```

---

### Incident Patch 10: `0733b7fe` (2026-10-01)
**Commit Message**: ci: fix sqlite on windows

**File**: `default.nix` (modified, +13/-3)
```diff
@@ -29,7 +29,17 @@ pimalaya.mkDefault (
       }:
 
       let
-        inherit (pkgs) sqlite;
+        inherit (pkgs) sqlite stdenv windows;
+
+        # NOTE: nixpkgs' mingw sqlite fails its pthread probe and compiles
+        # single-threaded, defining no sqlite3_mutex_* rusqlite links against
+        sqlite' =
+          if stdenv.hostPlatform.isWindows then
+            sqlite.overrideAttrs (old: {
+              buildInputs = (old.buildInputs or [ ]) ++ [ windows.pthreads ];
+            })
+          else
+            sqlite;
 
         buildFeatures = lib.splitString "," features;
 
@@ -50,13 +60,13 @@ pimalaya.mkDefault (
       # HACK: needed until the v2.1.0 derivation lands on nixpkgs's master
       .overrideAttrs
         (drv: {
-          buildInputs = (drv.buildInputs or [ ]) ++ lib.optional systemSqlite sqlite;
+          buildInputs = (drv.buildInputs or [ ]) ++ lib.optional systemSqlite sqlite';
 
           # pkg-config hands the linker libsqlite3 but no rpath, leaving a
           # binary that cannot find it: not in postInstall, which runs it, nor
           # once installed.
           env = (drv.env or { }) // {
-            NIX_LDFLAGS = lib.optionalString systemSqlite ("-rpath " + lib.getLib sqlite + "/lib");
+            NIX_LDFLAGS = lib.optionalString systemSqlite ("-rpath " + lib.getLib sqlite' + "/lib");
           };
 
           postInstall =
```

---

### Incident Patch 11: `97eea351` (2026-10-01)
**Commit Message**: ci: fix nix build

**File**: `default.nix` (modified, +22/-6)
```diff
@@ -28,21 +28,37 @@ pimalaya.mkDefault (
         buildPackages,
       }:
 
+      let
+        inherit (pkgs) sqlite;
+
+        buildFeatures = lib.splitString "," features;
+
+        systemSqlite =
+          (defaultFeatures || builtins.elem "pimdir" buildFeatures)
+          && !builtins.elem "vendored" buildFeatures;
+
+      in
       (pkgs.callPackage "${nixpkgs}/pkgs/by-name/hi/himalaya/package.nix" {
-        inherit lib rustPlatform;
-        # the nixpkgs derivation runs the binary it just built, which needs
-        # a native one when cross compiling
+        inherit lib rustPlatform buildFeatures;
         buildPackages = buildPackages // {
           inherit himalaya;
         };
         installShellCompletions = false;
         installManPages = false;
         buildNoDefaultFeatures = !defaultFeatures;
-        buildFeatures = lib.splitString "," features;
       })
       # HACK: needed until the v2.1.0 derivation lands on nixpkgs's master
       .overrideAttrs
-        {
+        (drv: {
+          buildInputs = (drv.buildInputs or [ ]) ++ lib.optional systemSqlite sqlite;
+
+          # pkg-config hands the linker libsqlite3 but no rpath, leaving a
+          # binary that cannot find it: not in postInstall, which runs it, nor
+          # once installed.
+          env = (drv.env or { }) // {
+            NIX_LDFLAGS = lib.optionalString systemSqlite ("-rpath " + lib.getLib sqlite + "/lib");
+          };
+
           postInstall =
             let
               inherit (pkgs) stdenv;
@@ -58,7 +74,7 @@ pimalaya.mkDefault (
               ${exe} manual -d "$out"/share/man
               ${exe} json-schema -d "$out"/share/schemas
             '';
-        }
+        })
     );
   }
   // removeAttrs args [ "pimalaya" ]
```

---

### Incident Patch 12: `763ecc15` (2026-10-01)
**Commit Message**: fix: sending issues and search charset

Closes: #769

**File**: `CHANGELOG.md` (modified, +13/-2)
```diff
@@ -9,6 +9,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
+- Added `message.send.save-copy`, the mailbox a sent message is copied to when `--save` is not passed, and `--no-save` on `message send`, `compose`, `reply` and `forward` to skip it.
+
+  It takes a mailbox name, alias or role, and the v1 `true` still reads as the `sent` mailbox. Leave it unset on Gmail and Microsoft Graph, which file the sent message themselves.
+
 - Added `envelope.list.datetime-relative`, rendering recent dates relative to today: the time for today, `yesterday`, then the weekday for the past week, older dates falling back to `datetime-fmt` ([#510]).
 
 - Added `proxy`, a per-account SOCKS5 or HTTP proxy every network backend connects through, and `<backend>.proxy` to override it for one backend ([#742]).
@@ -67,6 +71,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
+- Saving and sending at once (`--save` with `--send`, `message send --save`, `message add --send`) now sends first, so a failed send leaves no copy behind. A save failing after the send reports that the message was sent.
+
 - A pimdir account sends through the store's queue and no longer uses its `smtp` section. **Behaviour change.**
 
 - `-m/--mailbox` resolves a role after the aliases, so `-m sent` reaches the sent mailbox without an alias. A role carried by several mailboxes is an error naming them.
@@ -125,9 +131,13 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Fixed a message sent over JMAP staying in the drafts mailbox as a draft.
+
+  The submission now asks the server to move it to the sent mailbox, unset `$draft` and set `$seen` once sent (RFC 8621 section 7.5 `onSuccessUpdateEmail`). The sent mailbox is the `sent`-role one, or the new `jmap.sent-mailbox-id`; without either, the message only loses `$draft`.
+
 - Fixed a successful IMAP append being reported as failed when its UID could not be recovered ([#759]).
 
-  A server may acknowledge `APPEND` without `APPENDUID`, even with UIDPLUS, and some (QQ Exmail) also rewrite the `Message-ID` the fallback search looks for. The save now succeeds with an unknown id, so `message send --save` goes on to send, and `message add --json` can return `"id": null`.
+  A server may acknowledge `APPEND` without `APPENDUID`, even with UIDPLUS, and some (QQ Exmail) also rewrite the `Message-ID` the fallback search looks for. The save now succeeds with an unknown id, and `message add --json` can return `"id": null`.
 
 - Fixed the "No backend matching `auto`" error saying nothing of the cause ([#740]). It now names the account and either the supported backends this build compiles in or the missing `<backend>` block, and points at MIGRATION.md when the account still carries the v1 `backend` table.
 
@@ -141,7 +151,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - Fixed IMAP searches with non-ASCII text being rejected by Gmail ([io-imap#3](https://github.com/pimalaya/io-imap/issues/3)).
 
-  Bumped io-imap to 0.6.1, which sends `CHARSET UTF-8` with every `SEARCH` again, a fix lost since v1.2.0 (#635).
+  Bumped io-imap to 0.7.1, whose `SEARCH` carries `CHARSET UTF-8` when its criteria hold non-ASCII text, a fix lost since v1.2.0 (#635). An ASCII search sends no charset, Outlook rejecting the UTF-8 one ([#769]).
 
 - Fixed the `Bcc:` field being transmitted over SMTP, disclosing blind recipients to everyone (#747).
 
@@ -1367,6 +1377,7 @@ Few major concepts changed:
 [#759]: https://github.com/pimalaya/himalaya/issues/759
 [#762]: https://github.com/pimalaya/himalaya/issues/762
 [#764]: https://github.com/pimalaya/himalaya/issues/764
+[#769]: https://github.com/pimalaya/himalaya/issues/769
 
 [core#1]: https://github.com/pimalaya/core/issues/1
 [core#10]: https://github.com/pimalaya/core/issues/10
```

**File**: `Cargo.lock` (modified, +10/-10)
```diff
@@ -1230,9 +1230,9 @@ dependencies = [
 
 [[package]]
 name = "io-imap"
-version = "0.7.0"
+version = "0.7.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5ae85f32a2430a3533ca168618b5058fcce00f8169f43e11759e1839d5ef7978"
+checksum = "df059b417ac8888b21787a4464a146260aba38d59f0d1945cd3b727777eb8297"
 dependencies = [
  "anyhow",
  "base64 0.23.1",
@@ -1248,9 +1248,9 @@ dependencies = [
 
 [[package]]
 name = "io-jmap"
-version = "0.4.0"
+version = "0.4.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "dfba5d15f9451ed373c5fbdb9280dc94da0ee9de313615bc05ee8d7068a61a16"
+checksum = "cac88102ac3621a7da2dc6a306c5251c293f2c5b0c16fbc08ccea1fad849188b"
 dependencies = [
  "anyhow",
  "io-http",
@@ -1340,9 +1340,9 @@ dependencies = [
 
 [[package]]
 name = "io-pim-discovery"
-version = "0.7.0"
+version = "0.8.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "da1a1cd982a92647cd760d2fa84f9695e496526bba22a95c69e3e8460681ba69"
+checksum = "091245d7c51eee2b93a613f95e3615b164377364819e7506f61f62bf1e5643cc"
 dependencies = [
  "anyhow",
  "base64 0.23.1",
@@ -1942,9 +1942,9 @@ checksum = "9b4f627cb1b25917193a259e49bdad08f671f8d9708acfd5fe0a8c1455d87220"
 
 [[package]]
 name = "pimalaya-cli"
-version = "0.2.4"
+version = "0.2.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d4db8af1fd7b9ffa9bed65ccc090f3cf3e06ef4e30d9138261081196f5271033"
+checksum = "df3482c0af710d2f95f8cdbe660a8d89eaa361ac07daed47cb28b00e0c5d6289"
 dependencies = [
  "anyhow",
  "clap",
@@ -3140,9 +3140,9 @@ dependencies = [
 
 [[package]]
 name = "yoke-derive"
-version = "0.8.3"
+version = "0.8.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "33811428bee40dbceb6d545e95754741d17a6aef9a4849f0fd62e2ba4f412a78"
+checksum = "ec8ebde2db3681e8c9980cc27822030e68752690ddfa9473e739aeb4dbde6d71"
 dependencies = [
  "proc-macro2",
  "quote",
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -52,14 +52,14 @@ crossterm = { version = "0.29", default-features = false, features = ["serde"] }
 dirs = "7"
 humansize = "2"
 io-gmail = { version = "0.4", default-features = false, optional = true }
-io-imap = { version = "0.7", default-features = false, optional = true }
-io-jmap = { version = "0.4", default-features = false, optional = true }
+io-imap = { version = "0.7.1", default-features = false, optional = true }
+io-jmap = { version = "0.4.1", default-features = false, optional = true }
 io-m2dir = { version = "0.2", default-features = false, optional = true }
 io-maildir = { version = "0.3", default-features = false, optional = true }
 io-mbox = { version = "0.1", default-features = false, optional = true }
 io-managesieve = { version = "0.2", default-features = false, optional = true }
 io-msgraph = { version = "0.4", default-features = false, optional = true }
-io-pim-discovery = { version = "0.7", default-features = false, features = ["autoconfig", "pacc", "rfc6186", "rfc8620"] }
+io-pim-discovery = { version = "0.8", default-features = false, features = ["autoconfig", "pacc", "rfc6186", "rfc8620"] }
 io-pimdir = { version = "0.5", default-features = false, features = ["client"], optional = true }
 io-sasl = { version = "0.1", default-features = false, features = ["scram"] }
 io-smtp = { version = "0.5", default-features = false, optional = true }
```

**File**: `cairn/changes/jmap-sent-leaves-drafts/delta.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+cairn: delta
+change: jmap-sent-leaves-drafts
+---
+
+## ADDED Requirements
+
+### Requirement: A JMAP send files the message as sent
+A JMAP send SHALL stage the message in the drafts mailbox with `$draft`, then submit it with an `onSuccessUpdateEmail` patch (RFC 8621 section 7.5) moving it to the sent mailbox, unsetting `$draft` and setting `$seen`. The drafts mailbox SHALL be `jmap.drafts-mailbox-id`, else the `drafts`-role one, the send failing without either; the sent mailbox SHALL be `jmap.sent-mailbox-id`, else the `sent`-role one, the message only losing `$draft` without either.
```

**File**: `cairn/changes/jmap-sent-leaves-drafts/proposal.md` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+---
+cairn: change
+id: jmap-sent-leaves-drafts
+status: landed
+created: 2026-10-01
+---
+
+# A message sent over JMAP leaves the drafts mailbox
+
+## Why
+
+JMAP send imports the message into the drafts mailbox with `$draft`, then submits it, and nothing moved it afterwards: every sent message stayed a draft and never reached the sent mailbox. io-jmap could not express RFC 8621 section 7.5 `onSuccessUpdateEmail`.
+
+## What
+
+- io-jmap gains `JmapEmailSubmissionSetArgs` with `onSuccessUpdateEmail` and `onSuccessDestroyEmail`, additive (0.4.1).
+- The submission patches the email once sent: out of the drafts mailbox, into the sent one, `$draft` unset, `$seen` set.
+- The sent mailbox is `jmap.sent-mailbox-id`, else the `sent`-role mailbox, read in the same `Mailbox/get` as the drafts one. Without either, the email only loses `$draft`.
```

**File**: `cairn/changes/jmap-sent-leaves-drafts/tasks.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+cairn: tasks
+change: jmap-sent-leaves-drafts
+---
+
+- [x] `onSuccessUpdateEmail` and `onSuccessDestroyEmail` in io-jmap `EmailSubmission/set`
+- [x] Patch the submitted email into the sent mailbox, `$draft` unset, `$seen` set
+- [x] `jmap.sent-mailbox-id`, else the `sent` role
+- [x] Verified against Stalwart 0.16
+- [x] CHANGELOG, config.sample.toml, spec, log
```

**File**: `cairn/changes/message-send-save-copy/delta.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+cairn: delta
+change: message-send-save-copy
+---
+
+## ADDED Requirements
+
+### Requirement: Sent copies are configured per account
+`message.send.save-copy`, global or per account, SHALL be the mailbox a sending command (`message send`, and `message compose`, `message reply` and `message forward` with `--send`) appends a copy to when `--save` is not passed. It takes a mailbox name, alias or role, resolved as `--save` is; `true` SHALL stand for `sent` and `false` for no copy. `--no-save` SHALL skip it for one call and conflict with `--save`. The `message` table SHALL accept unknown keys, so a v1 `[message]` table keeps loading.
+
+### Requirement: Saving a sent message follows the send
+A command both saving and sending (`--save` with `--send`, `message send --save`, `message add --send`) SHALL send first and save afterwards, so a failed send leaves no copy. A save failing after a successful send SHALL fail the command with an error stating that the message was sent.
```

**File**: `cairn/changes/message-send-save-copy/proposal.md` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+---
+cairn: change
+id: message-send-save-copy
+status: landed
+created: 2026-10-01
+---
+
+# `message.send.save-copy` names the mailbox a sent message is copied to
+
+## Why
+
+v2 dropped v1's `message.send.save-copy`, so a message sent over SMTP is kept nowhere unless every call passes `--save`. Each front-end (himalaya-emacs, himalaya-vim, himalaya-tui) would otherwise grow its own option, none of them knowing which backend an account sends through, while the need is per account: Gmail and Microsoft Graph file the sent message themselves, SMTP does not.
+
+`--save` also appends before sending, so a send that fails leaves a copy of a message that never left.
+
+## What
+
+- `message.send.save-copy`, global or per account, is the `--save` a sending command falls back on. A mailbox name, alias or role; `true` stands for `sent`, `false` for none, a v1 boolean thereby reading as it used to.
+- `message send`, `message compose`, `message reply` and `message forward` gain `--no-save`, conflicting with `--save`, to skip the configured copy for one send.
+- Saving and sending, `--save` or `message add --send` alike, send first and save afterwards. A save failing after the send reports that the message was sent.
+- The `message` table stays open to unknown keys, so the rest of a v1 `[message]` table keeps loading.
+
+Left out: the wizard does not write the option. IMAP resolves no `sent` role until LIST `RETURN (SPECIAL-USE)` lands (imap-special-use-aliases), and the wizard writes no `mailbox.alias.sent`, so a generated `save-copy = "sent"` would fail on every IMAP send.
```

---

### Incident Patch 13: `6da6ad6c` (2026-09-30)
**Commit Message**: fix(imap): accept append without recovered UID

Closes #759.

Co-authored-by: Liyuan Shang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -109,6 +109,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Fixed a successful IMAP append being reported as failed when its UID could not be recovered ([#759]).
+
+  A server may acknowledge `APPEND` without `APPENDUID`, even with UIDPLUS, and some (QQ Exmail) also rewrite the `Message-ID` the fallback search looks for. The save now succeeds with an unknown id, so `message send --save` goes on to send, and `message add --json` can return `"id": null`.
+
 - Fixed the "No backend matching `auto`" error saying nothing of the cause ([#740]). It now names the account and either the supported backends this build compiles in or the missing `<backend>` block, and points at MIGRATION.md when the account still carries the v1 `backend` table.
 
 - Fixed `envelope list` and `envelope search` truncating the ID column under `--max-width`.
@@ -1342,6 +1346,7 @@ Few major concepts changed:
 [#740]: https://github.com/pimalaya/himalaya/issues/740
 [#742]: https://github.com/pimalaya/himalaya/issues/742
 [#743]: https://github.com/pimalaya/himalaya/issues/743
+[#759]: https://github.com/pimalaya/himalaya/issues/759
 [#762]: https://github.com/pimalaya/himalaya/issues/762
 [#764]: https://github.com/pimalaya/himalaya/issues/764
 
```

**File**: `cairn/changes/imap-append-without-uid/delta.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+cairn: change
+change: imap-append-without-uid
+---
+
+# Delta
+
+## MODIFIED Requirements
+
+### Requirement: Append and search gaps
+Gmail and Graph SHALL NOT implement `add_message` (neither API has an append) and SHALL NOT implement shared `search_envelopes`. IMAP, JMAP, Maildir and m2dir implement search (see the search capability).
+
+The shared `add_message` result SHALL carry an optional id, absent only when an IMAP or JMAP server acknowledges the write without reporting one. An IMAP `APPEND` acknowledged by the server SHALL stay a success when neither `APPENDUID` (RFC 4315) nor the fallback `Message-ID` search yields a UID, and a requested send SHALL go on. An `APPEND` rejected by the server SHALL stay an error.
```

**File**: `cairn/changes/imap-append-without-uid/proposal.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+cairn: change
+id: imap-append-without-uid
+status: landed
+created: 2026-09-22
+---
+
+# Accept a successful IMAP append without a recoverable UID
+
+## Why
+
+RFC 4315 makes `APPENDUID` a SHOULD, so a server can acknowledge `APPEND` without it, even after advertising UIDPLUS. Himalaya then searches the submitted `Message-ID`, but QQ Exmail rewrites that header and the search finds nothing. The message is saved, yet Himalaya reports a failure and the send half of `message send --save` never runs.
+
+## What
+
+The shared `add_message` returns an optional id. IMAP returns none when an acknowledged append yields no UID, logging why at debug level; JMAP returns none when `Email/import` reports no id, instead of an empty string. Maildir, m2dir and pimdir keep returning an id. `message add` reports the save without an id, `null` in JSON, and save-then-send goes on.
```

**File**: `cairn/changes/imap-append-without-uid/tasks.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+cairn: tasks
+change: imap-append-without-uid
+---
+
+# Tasks
+
+- [x] IMAP and JMAP `add_message` return an optional id; Maildir, m2dir and pimdir keep a plain id, wrapped by `EmailClient::add_message`.
+- [x] Log at debug level why an appended UID is unknown.
+- [x] `message add` renders a missing id in text and as `null` in JSON.
+- [x] Manual provider test (contributor, QQ Exmail): save-then-send goes on when the UID cannot be recovered.
+- [x] The CHANGELOG entry.
+- [x] Fold the delta into [cairn/spec/backends.md](../../spec/backends.md); write [cairn/log/2026-09-30-imap-append-without-uid.md](../../log/2026-09-30-imap-append-without-uid.md).
```

**File**: `cairn/log/2026-09-30-imap-append-without-uid.md` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+---
+cairn: log
+change: imap-append-without-uid
+landed: 2026-09-30
+---
+
+# Accept a successful IMAP append without a recoverable UID
+
+`message send --save` saves before it sends. A server acknowledging the append without `APPENDUID` made Himalaya search the submitted `Message-ID` for the new UID; QQ Exmail rewrites that header, so the search found nothing, Himalaya failed, and SMTP never ran although the copy was saved. Contributed in [#759].
+
+## What landed
+
+**The shared `add_message` returns an optional id.** IMAP returns none when an acknowledged append has neither `APPENDUID` nor a search match, logging which at debug level; a rejected `APPEND` still fails before any send. JMAP returns none when `Email/import` reports no id, where it used to return an empty string. Maildir, m2dir and pimdir keep returning an id.
+
+**`message add` reports the save without an id**, `null` under `--json`, and save-then-send goes on.
+
+## Capabilities moved
+
+- backends: *Append and search gaps* gains the optional add id
+
+## Verification
+
+`cargo test --all-features` passes and clippy reports nothing. The contributor reproduced the failure and the fix against QQ Exmail. Whether QQ reports `UIDNOTSTICKY` or just omits `APPENDUID` is still unknown, no IMAP trace having been shared.
+
+[#759]: https://github.com/pimalaya/himalaya/pull/759
```

**File**: `cairn/spec/backends.md` (modified, +2/-0)
```diff
@@ -100,6 +100,8 @@ Taking the owner role briefly is what cancelling costs (pimdir SPEC §15.5); the
 ### Requirement: Append and search gaps
 Gmail and Graph SHALL NOT implement `add_message` (neither API has an append) and SHALL NOT implement shared `search_envelopes`. IMAP, JMAP, Maildir and m2dir implement search (see the search capability).
 
+The shared `add_message` result SHALL carry an optional id, absent only when an IMAP or JMAP server acknowledges the write without reporting one. An IMAP `APPEND` acknowledged by the server SHALL stay a success when neither `APPENDUID` (RFC 4315) nor the fallback `Message-ID` search yields a UID, and a requested send SHALL go on. An `APPEND` rejected by the server SHALL stay an error.
+
 ### Requirement: Sending transport
 Backends that self-send (JMAP, Gmail, Graph) SHALL route `send_message` through their own API. Storage backends that cannot send (IMAP, Maildir, m2dir) SHALL send through the account's SMTP transport, adapted in `src/smtp/backend.rs` over io-smtp, which parses the RFC 5321 envelope from the raw message headers. The transmitted message SHALL NOT carry the `Bcc:` field (RFC 5322 3.6.3), which io-smtp removes after the envelope is derived. The protocol-level `smtp send` SHALL transmit its message verbatim, its envelope being explicit.
 
```

**File**: `src/imap/backend.rs` (modified, +22/-12)
```diff
@@ -253,7 +253,15 @@ impl ImapClient {
 
     /// Appends a message and returns its UID, from the UIDPLUS
     /// `APPENDUID` or, failing that, a UID `SEARCH` on its `Message-ID`.
-    pub fn add_message(&mut self, mailbox: &str, flags: &[Flag], raw: Vec<u8>) -> Result<String> {
+    ///
+    /// RFC 4315 §3 makes `APPENDUID` a SHOULD, so an acknowledged append
+    /// whose UID cannot be recovered is still a success, with no UID.
+    pub fn add_message(
+        &mut self,
+        mailbox: &str,
+        flags: &[Flag],
+        raw: Vec<u8>,
+    ) -> Result<Option<String>> {
         let mbox = parse_mailbox(mailbox)?;
         let imap_flags: Vec<ImapFlag<'static>> = flags.iter().map(flag_from).collect();
 
@@ -268,34 +276,36 @@ impl ImapClient {
         )?;
 
         if let Some((_, uid)) = appenduid {
-            return Ok(uid.to_string());
+            return Ok(Some(uid.to_string()));
         }
 
-        // NOTE: without UIDPLUS the UID is recovered by searching the
-        // message's own `Message-ID`, which it therefore has to carry.
+        // NOTE: without `APPENDUID`, which a server may omit even with
+        // UIDPLUS, the UID is recovered by searching the message's own
+        // `Message-ID`, which it therefore has to carry.
         let message_id = MessageParser::default()
             .parse_headers(&raw)
             .and_then(|parsed| parsed.message_id().map(str::to_string))
             .filter(|id| !id.is_empty());
         let Some(message_id) = message_id else {
-            bail!(
-                "Cannot resolve appended UID: server lacks UIDPLUS and message has no Message-ID"
-            );
+            debug!("no APPENDUID and no Message-ID to search, appended UID unknown");
+            return Ok(None);
         };
 
         self.select(mbox, ImapMailboxSelectOptions::default())?;
 
         let field =
             AString::try_from("Message-ID").map_err(|_| anyhow!("Invalid IMAP search header"))?;
-        let value = AString::try_from(message_id)
+        let value = AString::try_from(message_id.clone())
             .map_err(|_| anyhow!("Invalid IMAP search Message-ID value"))?;
         let criteria = Vec1::from(SearchKey::Header(field, value));
         let uids = self.search(criteria, ImapMessageSearchOptions { uid: true })?;
 
-        uids.into_iter()
-            .max()
-            .map(|uid| uid.to_string())
-            .ok_or_else(|| anyhow!("Fallback UID search returned no match"))
+        let uid = uids.into_iter().max().map(|uid| uid.to_string());
+        if uid.is_none() {
+            debug!("no APPENDUID and no match for {message_id}, appended UID unknown");
+        }
+
+        Ok(uid)
     }
 
     /// Copies a UID set between two mailboxes.
```

**File**: `src/jmap/backend.rs` (modified, +9/-3)
```diff
@@ -216,8 +216,14 @@ impl JmapClient {
     }
 
     /// Uploads `raw` as a blob then imports it into `mailbox` with the
-    /// requested keywords. Returns the created email id.
-    pub fn add_message(&mut self, mailbox: &str, flags: &[Flag], raw: Vec<u8>) -> Result<String> {
+    /// requested keywords. Returns the created email id, when the server
+    /// reports one.
+    pub fn add_message(
+        &mut self,
+        mailbox: &str,
+        flags: &[Flag],
+        raw: Vec<u8>,
+    ) -> Result<Option<String>> {
         let blob_id = self.upload(raw)?;
 
         let mut mailbox_ids = BTreeMap::new();
@@ -246,7 +252,7 @@ impl JmapClient {
             .get("new")
             .ok_or_else(|| anyhow!("Email/import did not create the imported email"))?;
 
-        Ok(email.id.clone().unwrap_or_default())
+        Ok(email.id.clone())
     }
 
     /// Copies an email id set into `to` by adding `to`'s mailbox id.
```

---

### Incident Patch 14: `76884c1d` (2026-09-29)
**Commit Message**: fix: message composition args

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -9,6 +9,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
+- Added `--posting-style none` to `message reply` and `message forward`, sending the written body without quoting the source.
+
+- Added a decoded template to `message compose`, `message reply` and `message forward` under `--json` when neither saving nor sending.
+
+  It carries `from`, `to`, `cc`, `bcc`, `subject` and a `body` without the signature, so an editor can lay the message out and hand it back through the flags.
+
 - Added `messages-added-details` to `gmail history list --json`, preserving each arrival's message id, optional thread id and supplied label ids alongside the existing message-id arrays.
 
 - A pimdir write now shows on the next read instead of on the next sync.
@@ -83,6 +89,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Fixed `envelope list` and `envelope search` truncating the ID column under `--max-width`.
+
+  A long id, such as a Maildir file name, came out cut with an ellipsis and was unusable by any follow-up command. The ID column now keeps its content width, and the header, like the rows, stays on one line.
+
 - Fixed `--to`, `--cc` and `--bcc` carrying a display name composing a `To: <Alice <alice@example.org>>` no SMTP server accepts, as `--from` did before ([#727]). Each value is now parsed as an address list, so a comma inside a quoted display name (`"Doe, Alice" <alice@example.org>`) no longer splits it.
 
 - Fixed `imap raw` hanging until the stream timed out when the last command was not terminated by an explicit `\r\n` ([#764]).
```

**File**: `cairn/log/2026-09-28-composer-editor-template.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+---
+cairn: log
+change: composer-editor-template
+landed: 2026-09-28
+---
+
+# Composers serve editor integrations
+
+Needed by the himalaya-vim Vim9 rewrite, which composes through `message compose/reply/forward` flags since `message send` compiles no MML.
+
+The composers printed wire-format bytes, RFC 2047 encoded words and a quoted-printable body included, which an editor cannot show as editable text. Under `--json`, neither saving nor sending, they now print a `MessageTemplate` decoded by mail-parser, registered as the schema of all three. Its body leaves the signature out, since sending appends the configured one: the template call skips the signature resolution entirely.
+
+Reply and forward always quoted the source, so a body already holding an edited quote carried it twice. `PostingStyle::None` sends the written body alone, which also keeps interleaved replies possible.
+
+## Capabilities moved
+
+- [commands](../spec/commands.md): *Composers default the From header* gains the template and the `none` posting style.
+
+## Envelope ids stay whole
+
+Found driving the rewritten plugin against a Maildir: `--max-width` let comfy-table truncate the ID column, so a Maildir file name came out as `1790625978.#0M4188811…` and `message read` could not locate it. The ID column is now constrained to its content width in `Envelopes`, and the header row is capped to one line like the data rows, so a narrow width no longer stacks header names vertically.
```

**File**: `cairn/spec/commands.md` (modified, +2/-0)
```diff
@@ -57,6 +57,8 @@ The name SHALL be handed to the MIME builder apart from the address, so that a n
 
 The same composers SHALL end the body with the account's `signature`, introduced by its `signature-delim`, when neither `--signature` nor `--signature-file` is passed. `--signature` SHALL win, and `--signature-file` SHALL win too, the configured signature standing down rather than shadowing the file the flag names.
 
+With `--json` and neither `--save` nor `--send`, the same composers SHALL print the decoded `from`, `to`, `cc`, `bcc`, `subject` and `body` instead of the raw bytes, the body without any signature, so an editor can lay the message out and hand it back through the flags, sending appending the signature once. `--posting-style none` SHALL send the written body alone, the source left unquoted, for a writer who already laid the quote out.
+
 ### Requirement: Raw message input is shared
 A command taking a raw RFC 5322 message SHALL resolve it through the shared `MessageArg`: a file path, an inline value after `--`, or piped stdin. The resolved message is normalised to CRLF and rejected when empty, so no backend receives a zero-length message.
 
```

**File**: `src/json_schema.rs` (modified, +14/-0)
```diff
@@ -65,6 +65,20 @@ pub fn schemas() -> BTreeMap<String, Value> {
             "himalaya-message-delete",
             crate::shared::message::delete::DeleteReport
         );
+        // NOTE: the composers print a `MessageTemplate` when neither
+        // saving nor sending, and a confirmation line otherwise.
+        insert!(
+            "himalaya-message-compose",
+            crate::shared::message::handler::MessageTemplate
+        );
+        insert!(
+            "himalaya-message-reply",
+            crate::shared::message::handler::MessageTemplate
+        );
+        insert!(
+            "himalaya-message-forward",
+            crate::shared::message::handler::MessageTemplate
+        );
         insert!(
             "himalaya-attachment-list",
             crate::shared::attachment::list::Attachments
```

**File**: `src/shared/envelope/list.rs` (modified, +12/-2)
```diff
@@ -9,7 +9,9 @@ use chrono::{DateTime, FixedOffset, Local};
 use clap::Parser;
 use humansize::{BINARY, format_size};
 use pimalaya_cli::printer::Printer;
-use pimalaya_cli::table::{Cell, CellAlignment, Color, ContentArrangement, Row, Table};
+use pimalaya_cli::table::{
+    Cell, CellAlignment, Color, ColumnConstraint, ContentArrangement, Row, Table,
+};
 use schemars::JsonSchema;
 use serde::Serialize;
 
@@ -183,11 +185,13 @@ impl fmt::Display for Envelopes {
         header.push(Cell::new(if self.recipient { "TO" } else { "FROM" }));
         header.push(Cell::new("DATE"));
         header.push(Cell::new("SIZE").set_alignment(CellAlignment::Right));
+        let mut header = Row::from(header);
+        header.max_height(1);
 
         table
             .load_style(style_from_preset(&self.preset))
             .set_content_arrangement(self.arrangement.clone())
-            .set_header(Row::from(header))
+            .set_header(header)
             .add_rows(self.envelopes.iter().map(|env| {
                 let mut row = Row::new();
                 row.max_height(1);
@@ -227,6 +231,12 @@ impl fmt::Display for Envelopes {
                 row
             }));
 
+        // NOTE: an id is what a follow-up command takes, so squeezing
+        // the table into `--max-width` truncates any column but this one.
+        if let Some(column) = table.column_mut(0) {
+            column.set_constraint(ColumnConstraint::ContentWidth);
+        }
+
         if let Some(width) = self.max_width {
             table.set_width(width);
         }
```

**File**: `src/shared/message/builder.rs` (modified, +7/-1)
```diff
@@ -28,6 +28,9 @@ pub enum PostingStyle {
     Top,
     /// The quoted source body above the written body.
     Bottom,
+    /// The written body alone, the source left unquoted, for a writer
+    /// who already laid the quote out.
+    None,
 }
 
 /// Everything the MIME assembler needs, which each command fills in from
@@ -315,7 +318,7 @@ fn compose_body(
     };
 
     let mut body = match (style, quote.is_empty()) {
-        (_, true) => user_body.to_string(),
+        (PostingStyle::None, _) | (_, true) => user_body.to_string(),
         (PostingStyle::Top, false) => {
             if user_body.is_empty() {
                 quote
@@ -736,6 +739,9 @@ Original body line.\r\n";
         );
         assert_eq!(bottom, "wrote:\n> theirs\n\nmine");
 
+        let unquoted = compose_body("mine", "theirs", "wrote:", "", "-- \n", PostingStyle::None);
+        assert_eq!(unquoted, "mine");
+
         let signed = compose_body("mine", "", "", "Alice", "-- \n", PostingStyle::Top);
         assert_eq!(signed, "mine\n\n-- \nAlice");
     }
```

**File**: `src/shared/message/compose.rs` (modified, +10/-4)
```diff
@@ -22,7 +22,9 @@ use crate::{
 /// Compose a new message from flags.
 ///
 /// The RFC 5322 bytes go to stdout, unless `--save` appends a copy to a
-/// mailbox, `--send` pushes the message out, or both.
+/// mailbox, `--send` pushes the message out, or both. With `--json` and
+/// neither, the decoded fields come out instead, without the signature
+/// that sending appends.
 ///
 /// Multipart MIME, MML directives, signing and editor-driven workflows
 /// belong to a standalone composer such as mml, piped into `message send`
@@ -90,8 +92,12 @@ impl MessageComposeCommand {
         client: &mut EmailClient,
     ) -> Result<()> {
         let (from, from_name) = account.resolve_from(self.from.as_deref());
-        let signature =
-            account.resolve_signature(self.signature.as_deref(), self.signature_file.as_deref());
+        let template = printer.is_json() && !self.send && self.save.is_none();
+        let signature_file = self.signature_file.as_deref().filter(|_| !template);
+        let signature = match template {
+            true => None,
+            false => account.resolve_signature(self.signature.as_deref(), signature_file),
+        };
 
         let raw = builder::build(
             BuilderArgs {
@@ -105,7 +111,7 @@ impl MessageComposeCommand {
                 body_file: self.body_file.as_deref(),
                 attach: &self.attach,
                 signature,
-                signature_file: self.signature_file.as_deref(),
+                signature_file,
                 signature_delim: account.signature_delim(),
             },
             None,
```

**File**: `src/shared/message/forward.rs` (modified, +9/-4)
```diff
@@ -25,7 +25,8 @@ use crate::{
 ///
 /// The source is fetched to pre-fill the `Fwd:` subject and the
 /// `References` header, and to quote the body. The result goes to stdout,
-/// `--save` or `--send`.
+/// `--save` or `--send`. With `--json` and neither, the decoded fields
+/// come out instead, without the signature that sending appends.
 ///
 /// Richer composition is `message read <id>` piped into a standalone
 /// composer, whose output feeds `message send` or `message add`.
@@ -117,8 +118,12 @@ impl MessageForwardCommand {
         let source = client.get_message(&mailbox, &self.id, false)?;
 
         let (from, from_name) = account.resolve_from(self.from.as_deref());
-        let signature =
-            account.resolve_signature(self.signature.as_deref(), self.signature_file.as_deref());
+        let template = printer.is_json() && !self.send && self.save.is_none();
+        let signature_file = self.signature_file.as_deref().filter(|_| !template);
+        let signature = match template {
+            true => None,
+            false => account.resolve_signature(self.signature.as_deref(), signature_file),
+        };
 
         let raw = builder::build(
             BuilderArgs {
@@ -132,7 +137,7 @@ impl MessageForwardCommand {
                 body_file: self.body_file.as_deref(),
                 attach: &self.attach,
                 signature,
-                signature_file: self.signature_file.as_deref(),
+                signature_file,
                 signature_delim: account.signature_delim(),
             },
             Some(SourceArgs {
```

---

### Incident Patch 15: `ec59a66c` (2026-09-28)
**Commit Message**: fix: typos in prev commit

**File**: `CHANGELOG.md` (modified, +2/-4)
```diff
@@ -105,11 +105,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
   The client-side search evaluation the backend calls was gated on the `maildir` and `m2dir` features alone, so `--no-default-features --features pimdir` did not build. The default feature set was unaffected.
 
-- `message move` and `message delete` now work on IMAP servers without the MOVE extension.
+- Fixed `message move` and `message delete` on IMAP servers without the MOVE extension.
 
-  Moving always sent `UID MOVE` (RFC 6851), which servers that do not advertise MOVE reject, OVH's hosted Dovecot among them. Deleting failed with it, since outside the trash it moves to the trash.
-
-  Without MOVE, the move is now the sequence RFC 6851 describes for such servers: `UID COPY`, then `\Deleted` and, when UIDPLUS (RFC 4315) is advertised, a `UID EXPUNGE` of the source UIDs `COPYUID` reported. Without UIDPLUS the messages stay flagged `\Deleted` in the source, as `message delete` already does in the trash, so they stay recoverable and unrelated `\Deleted` messages are never touched.
+  Without MOVE, a move is now `UID COPY`, `\Deleted` and, with UIDPLUS, `UID EXPUNGE` of the copied UIDs. Without UIDPLUS the messages stay flagged `\Deleted` in the source.
 
 - Preserved message MIME payloads in `gmail threads get --json`, including full-format bodies and attachment metadata ([#750](https://github.com/pimalaya/himalaya/issues/750)).
 
```

**File**: `src/imap/backend.rs` (modified, +7/-16)
```diff
@@ -15,7 +15,6 @@ use std::{
 
 use anyhow::{Result, anyhow, bail};
 use chrono::{DateTime, FixedOffset};
-use log::debug;
 use io_imap::{
     rfc3501::{
         append::ImapMessageAppendOptions,
@@ -41,6 +40,7 @@ use io_imap::{
         status::{StatusDataItem, StatusDataItemName},
     },
 };
+use log::debug;
 use mail_parser::MessageParser;
 use rfc2047_decoder::{Decoder, RecoverStrategy};
 
@@ -343,10 +343,8 @@ impl ImapClient {
                     return Ok(0);
                 }
 
-                // NOTE: `COPYUID` names the source UIDs that were actually
-                // copied, which can be a subset of the requested set.
                 let to_remove = match copy_uid {
-                    Some((_, source_uids, _)) => sequence_set_from_uids(source_uids)?,
+                    Some((_, source_uids, _)) => uid_sequence_set(source_uids)?,
                     None => sequence_set,
                 };
 
@@ -661,23 +659,16 @@ fn parse_mailbox(name: &str) -> Result<ImapMailbox<'static>> {
 
 /// Parses stringified UIDs into an IMAP [`SequenceSet`].
 fn parse_uids(ids: &[&str]) -> Result<SequenceSet> {
-    if ids.is_empty() {
-        bail!("Empty UID set");
-    }
-
-    let uids: Vec<NonZeroU32> = ids
+    let uids = ids
         .iter()
-        .map(|s| {
-            s.parse::<NonZeroU32>()
-                .map_err(|_| anyhow!("Invalid message UID `{s}`"))
-        })
+        .map(|s| s.parse().map_err(|_| anyhow!("Invalid message UID `{s}`")))
         .collect::<Result<_>>()?;
 
-    SequenceSet::try_from(uids).map_err(|_| anyhow!("Invalid UID set"))
+    uid_sequence_set(uids)
 }
 
-/// Builds an IMAP [`SequenceSet`] from `COPYUID` source UIDs.
-fn sequence_set_from_uids(uids: Vec<u32>) -> Result<SequenceSet> {
+/// Builds an IMAP [`SequenceSet`] from numeric UIDs.
+fn uid_sequence_set(uids: Vec<u32>) -> Result<SequenceSet> {
     if uids.is_empty() {
         bail!("Empty UID set");
     }
```

#### Recent Merged Pull Requests:
- **PR #771** (2026-10-03): fix: keep control characters out of envelope and attachment tables (@Huge)
- **PR #770** (2026-10-02): fix(search): compile eval with msgraph backend alone (@posteego)
- **PR #768** (2026-09-28): fix: strip surrounding quotes from quoted search patterns (@Dev-next-gen)
- **PR #766** (2026-09-26): fix: parse display names in To, Cc and Bcc the same way as From (@Dev-next-gen)
- **PR #765** (closed): fix(imap): terminate the last raw command with CRLF (@rofrol)
- **PR #762** (closed): feat(imap): fetch whole messages with imap fetch --body (@AndreyVGo)
- **PR #761** (closed): fix(smtp): do not transmit the Bcc field (@gianlucamazza)
- **PR #760** (2026-09-28): fix(imap): move without the MOVE extension (@gianlucamazza)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
