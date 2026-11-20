> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pimalaya-himalaya-learnings.md`  
> **Source**: github ([https://github.com/pimalaya/himalaya](https://github.com/pimalaya/himalaya))  
> **Source Version**: `a5623dca`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T07:35:55.453Z  
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
> **Harvest Timestamp**: 2026-11-20T07:35:55.260Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pimalaya/himalaya`
- **Description**: CLI to manage emails
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7683 stars

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
//! commands, the sequence set argument the message commands take, and
//! the reading of a command's output.

use anyhow::{Result, anyhow};
use io_imap::{
    send::ImapOutput,
    types::{envelope::Address, sequence::SequenceSet},
};
use log::warn;
use pimalaya_cli::sanitize;

use crate::shared::message::header;

/// Takes the result out of the output of `command`, warning of the
/// server's alerts and of the response lines that did not decode whole.
pub fn output_data<T>(command: &str, output: ImapOutput<T>) -> T {
    for alert in &output.alerts {
        warn!("server sent an alert: {}", sanitize::text(alert));
    }

    if !output.skipped.is_empty() {
        let count = output.skipped.len();
        warn!(
            "skipped {count} unreadable line(s) of the {command} response, the result may be incomplete"
        );
    }

    if !output.partial.is_empty() {
        let count = output.partial.len();
        warn!(
            "decoded {count} line(s) of the {command} response in part, the result may be incomplete"
        );
    }

    output.data
}

/// Turns an ENVELOPE address list into shared addresses, the markers of
/// a group (RFC 3501 §7.4.2, a NIL host) left out and its members kept.
pub fn to_addresses(list: &[Address<'_>]) -> Vec<crate::email::address::Address> {
    list.iter()
        .filter(|addr| addr.host.0.is_some())
        .map(to_address)
        .collect()
}

/// Turns an envelope address into the shared address shape, its personal
/// name read as `message read` reads a header, `None` when absent or
/// empty.
fn to_address(addr: &Address<'_>) -> crate::email::address::Address {
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

/// Checks a sequence set argument as clap takes it, so a value that is
/// none is refused with the command line, before the session opens.
pub fn sequence_set_parser(raw: &str) -> Result<String, String> {
    match parse_sequence_set(raw) {
        Ok(_) => Ok(raw.to_owned()),
        Err(err) => Err(err.to_string()),
    }
}

/// Parses a sequence set argument, naming it when it is not one.
pub fn parse_sequence_set(raw: &str) -> Result<SequenceSet> {
    SequenceSet::try_from(raw).map_err(|_| {
        anyhow!("Invalid sequence set `{raw}`: expected numbers as in `1`, `1,3` or `2:*`")
    })
}

#[cfg(test)]
mod tests {
    use crate::imap::utils::parse_sequence_set;

    #[test]
    fn a_bad_sequence_set_is_named() {
        assert!(parse_sequence_set("1,3:*").is_ok());

        let err = parse_sequence_set("abc").unwrap_err().to_string();
        assert!(err.starts_with("Invalid sequence set `abc`"), "{err}");
    }
}

#[cfg(test)]
mod parser_tests {
    use clap::Parser;

    use crate::cli::Cli;

    /// A sequence set that is none is refused with the command line, so
    /// it exits 2 before the secret command runs and the session opens.
    #[test]
    fn a_bad_sequence_set_is_refused_by_the_grammar() {
        for args in [
            &["imap", "fetch", "abc"][..],
            &["imap", "store", "abc", "-f", "\\Seen"],
            &["imap", "copy", "abc", "Archive"],
            &["imap", "move", "abc", "Archive"],
        ] {
            let argv = [&["himalaya"][..], args].concat();
            let err = Cli::try_parse_from(&argv).err();
            let err = err.unwrap_or_else(|| panic!("{args:?} parsed"));
            assert_eq!(err.kind(), clap::error::ErrorKind::ValueValidation, "{err}");

            let argv = [&["himalaya"][..], args].concat();
            let argv: Vec<String> = argv.iter().map(|arg| arg.replace("abc", "1:*")).collect();
            assert!(Cli::try_parse_from(&argv).is_ok(), "{argv:?}");
        }
    }
}

```

### Core Architecture Module: `src/pimdir/queue/cancel.rs`
```
//! # pimdir queue cancel
//!
//! The `pimdir queue cancel` command, retracting one queued or parked
//! action before its owner applies it.

use std::{
    fmt,
    io::{IsTerminal, stdin},
};

use anyhow::{Result, bail};
use clap::Parser;
use io_pimdir::{client::producer::PimdirActionStatus, codec::PimdirActionHandle};
use pimalaya_cli::{error::CodedError, printer::Printer, prompt, sanitize};
use schemars::JsonSchema;
use serde::Serialize;

use crate::{
    error::ErrorCode,
    pimdir::client::{PimdirClient, uncancellable},
};

/// Cancel one queued or parked action, by the handle a receipt prints or
/// the row id `queue list` prints.
///
/// This is the only way back for a queued creation: a staged flag or move is
/// undone by doing the opposite, where a message that does not exist yet
/// cannot be deleted. Only a row of the account's queue is taken.
///
/// An unconfirmed row, a send or a mailbox change the sync engine sent
/// without learning its outcome, is cancelled the same way, which undoes
/// nothing: the message may have been sent, and both the question and the
/// answer say so.
///
/// Cancelling is the store owner's write, so this takes that role for the
/// length of the call and fails while a sync holds it. A store another
/// version of the sync engine wrote is refused rather than reshaped.
#[derive(Debug, Parser)]
pub struct PimdirQueueCancelCommand {
    /// The handle of the queued action, as a receipt prints it, or its bare
    /// row id, as `pimdir queue list` prints it.
    #[arg(value_name = "ROW")]
    pub id: PimdirActionHandle,
    /// Do not ask for confirmation.
    #[arg(long, short)]
    pub yes: bool,
}

impl PimdirQueueCancelCommand {
    /// Retracts the queued action the row id names.
    pub fn execute(self, printer: &mut impl Printer, client: &mut PimdirClient) -> Result<()> {
        let (named, unconfirmed) = match client.queue_row(&self.id)? {
            PimdirActionStatus::Pending { kind, .. } | PimdirActionStatus::Parked { kind, .. } => {
                (kind, false)
            }
            PimdirActionStatus::Unconfirmed { kind, .. } => (kind, true),
            status => return Err(uncancellable(&self.id, &status)),
        };
        let question = match unconfirmed {
            true => format!(
                "The {} queued as row {} was sent and may have taken effect, which \
                 cancelling does not undo. Cancel it?",
                sanitize::text(&named),
                self.id
            ),
            false => format!(
                "Cancel the {} queued as row {}?",
                sanitize::text(&named),
                self.id
            ),
        };
        if !self.yes && !stdin().is_terminal() {
            let message = format!(
                "Cannot ask to cancel row {} with no terminal: pass --yes",
                self.id
            );
            return Err(CodedError::new(ErrorCode::ConfirmationRequired, message).into());
        }

        if !self.yes && !prompt::bool(question, false)? {
            bail!("Cancellation aborted");
        }

        let handle = client.named(&self.id)?;
        let kind = client.cancel_queued(&self.id)?;
        printer.out(PimdirQueueCancelOutput {
            row: handle.id,
            handle: handle.to_string(),
            kind,
            unconfirmed,
        })
    }
}

/// The `pimdir queue cancel` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueCancelOutput {
    /// The queue row id cancelled.
    pub row: i64,
    /// The row's handle, its id under the store's identity (pimdir STORAGE
    /// §4.5): the handle given, or the bare id given named under this
    /// store's identity.
    pub handle: String,
    /// The action kind it held: `add`, `submit`, `set-flags`, ...
    pub kind: String,
    /// Whether the row was unconfirmed, its request sent and its outcome
    /// unknown: the action may have taken effect all the same.
    pub unconfirmed: bool,
}

impl fmt::Display for PimdirQueueCancelOutput {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let kind = sanitize::text(&self.kind);
        let id = &self.handle;
        match self.unconfirmed {
            true => writeln!(
                f,
                "Unconfirmed {kind} cancelled (row {id}); it was sent and may have taken effect"
            ),
            false => writeln!(f, "Queued {kind} cancelled (row {id})"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Cancelling an unconfirmed row drops it from the queue and undoes
    /// nothing its performer sent (pimdir STORAGE §15.2), so the output
    /// never reads as a plain cancellation.
    #[test]
    fn cancelling_an_unconfirmed_row_says_it_may_have_taken_effect() {
        let cancelled = PimdirQueueCancelOutput {
            row: 9,
            handle: "e2646df031cd876334410c4df14ebd86.1.9".into(),
            kind: "submit".into(),
            unconfirmed: true,
        };

        let json = serde_json::to_value(&cancelled).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "row": 9,
                "handle": "e2646df031cd876334410c4df14ebd86.1.9",
                "kind": "submit",
                "unconfirmed": true,
            })
        );
        let line = cancelled.to_string();
        assert!(line.contains("may have taken effect"), "{line}");
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
//! in the account, the rows parked there and the refusals standing, or
//! those of one mailbox.

use std::fmt;

use anyhow::Result;
use clap::Parser;
use pimalaya_cli::{listing::Listing, printer::Printer, sanitize};
use schemars::JsonSchema;
use serde::Serialize;

use crate::{account::context::Account, backend::Backend, pimdir::client::PimdirClient};

/// List the messages staged for creation or sending in the account.
///
/// A saved message waits in the queue until the sync engine applies it and
/// has no id until then, so `envelope list` cannot show it. A sent message
/// waits there until the store's owner sends it, filed under the mailbox it
/// was saved to or the account's sent alias. This is where both show: the
/// row handle to cancel one by, when it was queued, its kind (`add` or
/// `submit`) and its subject. The whole account is listed, mailbox by
/// mailbox, unless `--mailbox` names one.
///
/// Staged flags, moves and deletions need no such view, addressing messages
/// that already exist. A row of any kind the sync engine parked, refusing to
/// apply it without an operator, is listed `parked` with why: cancel it, or
/// fix what parked it. A move or a deletion of a message a sync left in
/// conflict parks so, listed in the mailbox the message stays in. One the
/// engine sent without learning its outcome is listed `unconfirmed`
/// instead: it may have taken effect. A message a server refused for good
/// the change it was synced with is listed `refused` last, with its source
/// and reason: the store applied the change, and the sync engine holds it
/// until the message changes again or is removed (pimdir STORAGE §15.4).
///
/// JSON output: `{"messages": [<row>], "parked": [<row>], "refused":
/// [{"collection", "itemId", "source", "reason", "refusedAt"}]}`, each row,
/// pending or parked, `{"row", "handle", "kind", "collection", "linkId",
/// "itemId", "producer", "queuedAt", "attempts", "unconfirmed", "error",
/// "subject"}`, as every Pimalaya program prints a queue row, plus the
/// row's handle.
#[derive(Debug, Parser)]
pub struct PimdirQueueListCommand {
    /// The one mailbox to list, a name, alias, role or id; the whole
    /// account when omitted.
    #[arg(short = 'm', long = "mailbox", value_name = "NAME")]
    pub mailbox: Option<String>,
}

impl PimdirQueueListCommand {
    /// Lists the creations and sends staged in the account, or in the one
    /// mailbox named, the rows parked there and the refusals standing,
    /// and prints them.
    pub fn execute(
        self,
        printer: &mut impl Printer,
        account: &mut Account,
        client: &mut PimdirClient,
    ) -> Result<()> {
        let mailboxes = match &self.mailbox {
            Some(mailbox) => vec![account.resolve_mailbox(mailbox).to_string()],
            None => client.mail_collection_ids()?,
        };

        let mut output = PimdirQueueListOutput {
            account: account.name().to_string(),
            mailbox: self.mailbox.as_ref().and(mailboxes.first().cloned()),
            messages: Vec::new(),
            parked: Vec::new(),
            refused: Vec::new(),
        };

        for mailbox in &mailboxes {
            output.messages.extend(client.queued_rows(mailbox)?);
            output.parked.extend(client.parked_rows(mailbox)?);
            output.refused.extend(client.refused_rows(mailbox)?);
        }

        printer.out(output)
    }
}

/// One row of the store's queue, pending or parked, in the one shape
/// every Pimalaya program prints it (pimalaya-cli's output contract, "A
/// queue row keeps one shape"), every key printed.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueRow {
    /// The queue row id, which `pimdir queue show` and `cancel` take. It
    /// names a queued action, not a message: a creation has no id until
    /// the sync engine applies it, and gets a different one then.
    pub row: i64,
    /// The row's handle, its id under the store's identity (pimdir STORAGE
    /// §4.5), which `pimdir queue show` and `cancel` take and check, a
    /// restored copy of the store refusing it rather than another row.
    pub handle: String,
    /// The row's action as the store holds it, never re-spelled: `add`,
    /// `submit`, `set-flags`, `move`, `remove`, `collection-create`, ...
    pub kind: String,
    /// The mailbox the row is queued on, as `mailbox list` prints its id.
    pub collection: String,
    /// The link id of the message the row creates, the bare `Message-ID`
    /// `message add` printed, `null` when the row creates none.
    pub link_id: Option<String>,
    /// The id of the stored message the row addresses (a flag change, a
    /// move, a copy, a removal), as `envelope list` prints it, `null` when
    /// it addresses none, a creation among them.
    pub item_id: Option<String>,
    /// The process that staged the row.
    pub producer: String,
    /// When the row was appended, stamped by the store's own clock.
    pub queued_at: String,
    /// How many times the sync engine tried the row.
    pub attempts: u64,
    /// Whether the row's outcome is unknown: the engine sent its request
    /// and cannot tell whether it took effect, so it may have.
    pub unconfirmed: bool,
    /// Why the row was parked, as the store records it, an unconfirmed
    /// row's beginning `unconfirmed: `; `null` while the row is pending.
    pub error: Option<String>,
    /// The subject of the body the row pins, else of the message it
    /// addresses, `null` when there is none to read.
    pub subject: Option<String>,
}

/// The `pimdir queue list` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueListOutput {
    /// The name of the account listed.
    #[serde(skip)]
    pub account: String,
    /// The one mailbox listed, its alias resolved, `None` for the whole
    /// account.
    #[serde(skip)]
    pub mailbox: Option<String>,
    /// The creations and sends staged, mailbox by mailbox.
    pub messages: Vec<PimdirQueueRow>,
    /// The parked rows, any kind, mailbox by mailbox.
    pub parked: Vec<PimdirQueueRow>,
    /// The refusals standing, per message and source.
    pub refused: Vec<PimdirQueueRefused>,
}

/// A refusal standing on a message of the mailbox (pimdir STORAGE §15.4):
/// the server of `source` refused for good a change the store applied, and
/// the sync engine holds it until the message changes again or is removed.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueRefused {
    /// The mailbox holding the message, as `mailbox list` prints its id.
    pub collection: String,
    /// The message, as `envelope list` prints its id.
    pub item_id: String,
    /// The source whose server refused the change.
    pub source: String,
    /// The text the server gave.
    pub reason: String,
    /// When the refusal was recorded, RFC 3339.
    pub refused_at: String,
}

impl fmt::Display for PimdirQueueListOutput {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut listing = Listing::new(&self.account, Some(Backend::Pimdir.as_str()));
        if let Some(mailbox) = &self.mailbox {
            listing.head("Mailbox", mailbox);
        }

        for queued in &self.messages {
            let what = queued.subject.as_deref().or(queued.item_id.as_deref());
            listing.items.push(cells(queued, "queued", what));
        }

        for parked in &self.parked {
            let state = match parked.unconfirmed {
                true => "unconfirmed",
                false => "parked",
            };
            listing
                .items
                .push(cells(parked, state, parked.error.as_deref()));
        }

        for refused in &self.refused {
            let reason = format!("{}: {}", refused.source, refused.reason);
            listing.items.push([
                String::new(),
                String::from("refused"),
                sanitize::text(&refused.refused_at).into_owned(),
                sanitize::text(&refused.item_id).into_owned(),
                sanitize::text(&reason).into_owned(),
            ]);
        }

        if !self.messages.is_empty() || !self.parked.is_empty() {
            let cancel = String::from("himalaya pimdir queue cancel <ROW>");
            listing.header.push(("Cancel", cancel));
        }

        write!(f, "{listing}")
    }
}

/// The text cells of `row`: its handle, its `state`, when it was queued, its
/// kind, then `last`.
fn cells(row: &PimdirQueueRow, state: &str, last: Option<&str>) -> [String; 5] {
    [
        sanitize::text(&row.handle).into_owned(),
        String::from(state),
        sanitize::text(&row.queued_at).into_owned(),
        sanitize::text(&row.kind).into_owned(),
        sanitize::text(last.unwrap_or_default()).into_owned(),
    ]
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{PimdirQueueListOutput, PimdirQueueRefused, PimdirQueueRow};

    const STORE: &str = "e2646df031cd876334410c4df14ebd86";

    /// A pending row of `kind` in `imap/Sent`.
    fn row(row: i64, kind: &str) -> PimdirQueueRow {
        PimdirQueueRow {
            row,
            handle: format!("{STORE}.1.{row}"),
            kind: kind.into(),
            collection: "imap/Sent".into(),
            link_id: None,
            item_id: None,
            producer: "himalaya".into(),
            queued_at: "2026-11-15T09:00:00Z".into(),
            attempts: 0,
            unconfirmed: false,
            error: None,
            subject: None,
        }
    }

    /// A pending and a parked row print in one shape, every key present,
    /// as every Pimalaya program prints them, and one line each under the
    /// way to cancel one.
    #[test]
    fn a_pending_and_a_pa
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
use io_pimdir::{
    client::producer::{PimdirActionStatus, PimdirReceiptRefusal},
    codec::PimdirActionHandle,
};
use pimalaya_cli::{printer::Printer, sanitize};
use schemars::JsonSchema;
use serde::Serialize;

use crate::pimdir::client::PimdirClient;

/// Show where one queue row stands, by the id `pimdir message add`,
/// `pimdir message send` or `pimdir mailbox create`, `rename` or `delete`
/// printed.
///
/// A row is `pending` until the sync engine applies it, `parked` when the
/// engine gave up on it (with why), `unconfirmed` when the engine sent its
/// request and cannot tell whether it took effect (a send or a mailbox
/// change that may have happened: it waits for the engine to confirm it,
/// or for a cancellation), and `applied` once done, a message sent or a
/// mailbox created, renamed or deleted included, with the id of the
/// message it acted on (the one an add created). An applied row lists the
/// refusals standing on that message: a server that refused for good the
/// change the row led to, with its reason, held until the message is
/// changed again or removed. The store keeps what became of an applied row
/// for seven days, and while a refusal stands on its message, under the
/// mailbox it was queued on, or under none once that mailbox is gone; past
/// that, and for a cancelled row, the state is `unknown`.
///
/// JSON output: `{"row", "handle", "state", "collection", "kind",
/// "attempts", "error", "appliedAt", "seq", "refusals": [{"collection",
/// "source", "reason", "refusedAt"}]}`.
#[derive(Debug, Parser)]
pub struct PimdirQueueShowCommand {
    /// The handle of the queue row, as a receipt prints it, or its bare
    /// id, as `pimdir queue list` prints it.
    #[arg(value_name = "ROW")]
    pub id: PimdirActionHandle,
}

impl PimdirQueueShowCommand {
    /// Looks the row up in the account's queue and receipts.
    pub fn execute(self, printer: &mut impl Printer, client: &mut PimdirClient) -> Result<()> {
        let status = client.queue_row(&self.id)?;
        let handle = client.named(&self.id)?;
        printer.out(PimdirQueueShowOutput::new(&handle, status))
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
    /// Sent by the sync engine, which cannot tell whether it took effect:
    /// it may have, and waits for the engine to confirm it or for a
    /// cancellation; `error` holds what the engine recorded.
    Unconfirmed,
    /// Applied or performed by the sync engine (a message sent, a mailbox
    /// created, renamed or deleted); `seq` is the message it acted on, and
    /// `refusals` the servers that refused the change it led to.
    Applied,
    /// Neither queued nor known applied: cancelled, or applied long ago.
    Unknown,
    /// The store is not the one the row was queued in, a copy restored
    /// since, where the id may name another row: nothing is read of it.
    Reset,
}

/// The `pimdir queue show` output.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueShowOutput {
    /// The queue row id.
    pub row: i64,
    /// The row's handle, its id under the store's identity (pimdir STORAGE
    /// §4.5): the handle given, or the bare id given named under this
    /// store's identity.
    pub handle: String,
    /// Where it stands.
    pub state: PimdirQueueState,
    /// The collection it is anchored on: `null` when unknown, and for an
    /// applied row whose mailbox is gone since.
    pub collection: Option<String>,
    /// The action kind (`add`, `submit`…), while queued.
    pub kind: Option<String>,
    /// Apply attempts so far, while queued.
    pub attempts: Option<i64>,
    /// Why the row was parked, or what the sync engine recorded of an
    /// unconfirmed one.
    pub error: Option<String>,
    /// When the row was applied, RFC 3339.
    pub applied_at: Option<String>,
    /// The id of the message an applied row acted on (the one an add
    /// created), as `envelope list` prints it.
    pub seq: Option<i64>,
    /// The refusals standing on that message, empty but for an applied
    /// row.
    pub refusals: Vec<PimdirQueueRefusal>,
}

/// A refusal standing on the message an applied row acted on (pimdir
/// STORAGE §15.4): the server of `source` refused for good the change the
/// row led to, and the sync engine holds it until the message changes
/// again.
#[derive(Clone, Debug, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PimdirQueueRefusal {
    /// The mailbox filing the message, the target of a move.
    pub collection: String,
    /// The source whose server refused the change.
    pub source: String,
    /// The text the server gave.
    pub reason: String,
    /// When the refusal was recorded, RFC 3339.
    pub refused_at: String,
}

impl From<PimdirReceiptRefusal> for PimdirQueueRefusal {
    fn from(refusal: PimdirReceiptRefusal) -> Self {
        Self {
            collection: refusal.collection,
            source: refusal.source,
            reason: refusal.reason,
            refused_at: refusal.refused_at,
        }
    }
}

impl PimdirQueueShowOutput {
    /// Projects io-pimdir's status of the row `handle` names.
    pub fn new(handle: &PimdirActionHandle, status: PimdirActionStatus) -> Self {
        let row = Self {
            row: handle.id,
            handle: handle.to_string(),
            state: PimdirQueueState::Unknown,
            collection: None,
            kind: None,
            attempts: None,
            error: None,
            applied_at: None,
            seq: None,
            refusals: Vec::new(),
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
            PimdirActionStatus::Unconfirmed {
                collection,
                kind,
                attempts,
                detail,
            } => Self {
                state: PimdirQueueState::Unconfirmed,
                collection: Some(collection),
                kind: Some(kind),
                attempts: Some(attempts),
                error: Some(detail),
                ..row
            },
            PimdirActionStatus::Applied {
                applied_at,
                collection,
                seq,
                refusals,
            } => Self {
                state: PimdirQueueState::Applied,
                collection,
                applied_at: Some(applied_at),
                seq,
                refusals: refusals.into_iter().map(Into::into).collect(),
                ..row
            },
            PimdirActionStatus::Unknown => row,
            PimdirActionStatus::Reset => Self {
                state: PimdirQueueState::Reset,
                ..row
            },
        }
    }
}

impl fmt::Display for PimdirQueueShowOutput {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let id = &self.handle;
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
            PimdirQueueState::Unconfirmed => {
                let detail = sanitize::text(self.error.as_deref().unwrap_or_default());
                writeln!(
                    f,
                    "Row {id} ({kind} in {collection}) is unconfirmed, sent and maybe \
                     performed: {detail}"
                )
            }
            PimdirQueueState::Applied => {
                match self.collection {
                    Some(_) => write!(f, "Row {id} was applied in {collection}")?,
                    None => write!(f, "Row {id} was applied in a mailbox deleted since")?,
                }
                if let Some(seq) = self.seq {
                    write!(f, ", on message {seq}")?;
                }
                writeln!(f)?;
                for refusal in &self.refusals {
                    writeln!(
                        f,
                        "Refused by {} in {} at {}: {}",
                        sanitize::text(&refusal.source),
                        sanitize::text(&refusal.collection),
                        sanitize::text(&refusal.refused_at),
                        sanitize::text(&refusal.reason),
                    )?;
                }
                Ok(())
            }
            PimdirQueueState::Unknown => writeln!(
                f,
                "Row {id} is neither queued nor known applied: cancelled, or applied long ago"
            ),
            PimdirQueueState::Reset => writel
```

### Core Architecture Module: `src/account/capability.rs`
```
//! # Account capability
//!
//! The `account capability` command, listing what the account serves of
//! the unified API, which backend serves each capability and how well.

use std::path::PathBuf;

use anyhow::Result;
use clap::Parser;
use pimalaya_cli::{
    capability::{AccountCapability, AccountCapabilityOutput},
    printer::Printer,
};

#[cfg(feature = "pimdir")]
use crate::pimdir::client::PimdirClient;
use crate::{
    backend::Backend,
    capability::{self, Resolution, StoreSupport},
    cli::resolve_account,
};

/// List what the account serves of the unified API.
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
                level: support.level,
                detail: support.detail,
            });
        }

        printer.out(AccountCapabilityOutput {
            account: name,
            capabilities,
        })
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
#[cfg(feature = "mbox")]
use anyhow::bail;
use clap::Parser;
use pimalaya_cli::{
    account::BackendCheck, error::PartialOutcome, fields::Fields, printer::Printer, sanitize,
};
use pimalaya_config::secret::SecretResolver;

#[cfg(feature = "imap")]
use crate::config::imap::ImapConfig;
use schemars::JsonSchema;
use serde::Serialize;

use crate::{
    backend::Backend,
    cli::resolve_account,
    config::tls::{RustlsCryptoConfig, TlsConfig, TlsProviderConfig},
    error::ErrorCode,
};

/// Validate the account configuration.
///
/// Every backend `--backend` allows is opened, which exercises the same
/// handshake and authentication paths a real command takes. The report
/// names each backend, whether it answered and, for a network one, the
/// TLS it connected with: its own `tls` block over the account's.
///
/// The report is printed whole, each backend with its outcome and, when it
/// failed, its code and why. A failed backend exits the command with
/// status 3, the report being the output rather than a failure object.
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
                feature = "mbox",
                feature = "pimdir",
                feature = "smtp",
                feature = "sieve"
            )),
            allow(unused_mut)
        )]
        let mut report = AccountCheckReport {
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
            report.backends.push(
                check("imap", connect_imap(imap_config, &mut resolver)).trusting(&imap_config.tls),
            );
        }

        #[cfg(feature = "jmap")]
        if backend.allows_jmap()
            && let Some(jmap_config) = &account_config.jmap
        {
            report.backends.push(
                check("jmap", connect_jmap(jmap_config, &mut resolver)).trusting(&jmap_config.tls),
            );
        }

        #[cfg(feature = "gmail")]
        if backend.allows_gmail()
            && let Some(gmail_config) = &account_config.gmail
        {
            report.backends.push(
                check("gmail", connect_gmail(gmail_config, &mut resolver))
                    .trusting(&gmail_config.tls),
            );
        }

        #[cfg(feature = "msgraph")]
        if backend.allows_msgraph()
            && let Some(msgraph_config) = &account_config.msgraph
        {
            report.backends.push(
                check("msgraph", connect_msgraph(msgraph_config, &mut resolver))
                    .trusting(&msgraph_config.tls),
            );
        }

        #[cfg(feature = "maildir")]
        if backend.allows_maildir()
            && let Some(maildir_config) = &account_config.maildir
        {
            report
                .backends
                .push(check("maildir", connect_maildir(maildir_config)));
        }

        #[cfg(feature = "mbox")]
        if backend.allows_mbox()
            && let Some(mbox_config) = &account_config.mbox
        {
            report
                .backends
                .push(check("mbox", connect_mbox(mbox_config)));
        }

        #[cfg(feature = "pimdir")]
        if backend.allows_pimdir()
            && let Some(pimdir_config) = &account_config.pimdir
        {
            report
                .backends
                .push(check("pimdir", connect_pimdir(pimdir_config)));
        }

        #[cfg(feature = "smtp")]
        if backend.allows_smtp()
            && let Some(smtp_config) = &account_config.smtp
        {
            report.backends.push(
                check("smtp", connect_smtp(smtp_config, &mut resolver)).trusting(&smtp_config.tls),
            );
        }

        #[cfg(feature = "sieve")]
        if backend.allows_sieve()
            && let Some(sieve_config) = &account_config.sieve
        {
            report.backends.push(
                check("sieve", connect_sieve(sieve_config, &mut resolver))
                    .trusting(&sieve_config.tls),
            );
        }

        if report.backends.is_empty() {
            return Err(account_config.no_backend_error(
                &report.account,
                backend,
                Backend::COMPILED,
            ));
        }

        let failed = report.backends.iter().any(|row| !row.check.ok);
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
        config::proxy::ProxyConfig,
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
        tls: imap_config.tls.clone().into_tls(imap_config.alpn.clone())?,
        proxy: ProxyConfig::resolve(imap_config.proxy.clone(), resolver)?,
        sasl,
        session: ImapSessionOpenOptions {
            starttls: imap_config.starttls,
            auto_id,
            sasl_ir: imap_config.sasl_ir,
            ..Default::default()
        },
    };
    let _ = ImapClientStd::connect(&server, opts)?;

    Ok(())
}

/// Opens a JMAP client and fetches the session object.
#[cfg(feature = "jmap")]
fn connect_jmap(
    jmap_config: &crate::config::jmap::JmapConfig,
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
    gmail_config: &crate::config::gmail::GmailConfig,
    resolver: &mut SecretResolver,
) -> Result<()> {
    use io_gmail::v1::client::{GmailClientStd, GmailClientStdConnectOptions};
    use secrecy::ExposeSecret;

    use crate::{config::proxy::ProxyConfig, gmail::client::gmail_token};

    let token = gmail_token(gmail_config.auth.clone(), resolver)?;
    let options = GmailClientStdConnectOptions {
        tls: gmail_config
            .tls
            .clone()
            .into_tls(gmail_config.alpn.clone())?,
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
    msgraph_config: &crate::config::msgraph::MsgraphConfig,
    resolver: &mut SecretResolver,
) -> Result<()> {
    use io_msgraph::v1::client::{MsgraphClientStd, MsgraphClientStdConnectOptions};
    use secrecy::ExposeSecret;

    use crate::{config::proxy::ProxyConfig, msgraph::client::msgraph_token};

    let token = msgraph_token(msgraph_config.auth.clone(), resolver)?;
    let options = MsgraphClientStdConnectOptions {
        tls: msgraph_config
            .tls
            .clone()
            .into_tls(msgraph_config.alpn.clone())?,
        proxy: ProxyConfig::resolve(msgraph_config.proxy.clone(), resolver)?,
        user_id: msgraph_config.user_id.clone(),
    };
    let mut client = MsgraphClientStd::connect(token.expose_secret(), options)?;
    client.me()?;

    Ok(())
}

/// Checks that the Maildir root is a director
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

use crate::config::{
    AccountConfig, Config,
    message::{PostingStyle, SaveCopyConfig},
};
#[cfg(any(backend, feature = "smtp"))]
use crate::email::mailbox::{Mailbox, MailboxRole};

/// chrono `strftime` format of an envelope date.
#[cfg(any(backend, feature = "smtp"))]
const DEFAULT_DATETIME_FMT: &str = "%F %R";
/// Page size of `envelope list` when nothing names one.
#[cfg(any(backend, feature = "smtp"))]
const DEFAULT_ENVELOPES_LIST_PAGE_SIZE: u32 = 25;
/// RFC 3676 section 4.3 signature separator.
#[cfg(any(backend, feature = "smtp"))]
const DEFAULT_SIGNATURE_DELIM: &str = "-- \n";

/// Merged runtime account settings consumed by every command.
#[derive(Debug, Default)]
pub struct Account {
    /// Name of the account, from its `[accounts.<name>]` block.
    pub name: Option<String>,
    /// Address the account sends as.
    pub email: Option<String>,
    /// Addresses the account logs in as (its IMAP and SMTP logins holding
    /// an `@`), which a reply to all leaves out beside `email`. Read from
    /// the account's blocks before its client takes them.
    pub logins: Vec<String>,
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
            name: other.name.or(self.name),

            email: other.email.or(self.email),
            logins: [self.logins, other.logins].concat(),
            display_name: other.display_name.or(self.display_name),
            signature: other.signature.or(self.signature),
            signature_delim: other.signature_delim.or(self.signature_delim),

            downloads_dir: other.downloads_dir.or(self.downloads_dir),

            datetime_fmt: other.datetime_fmt.or(self.datetime_fmt),
            datetime_local_tz: other.datetime_local_tz.or(self.datetime_local_tz),
            envelopes_list_page_size: other
                .envelopes_list_page_size
                .or(self.envelopes_list_page_size),

            mailbox_alias,
            save_copy: other.save_copy.or(self.save_copy),
            reply_posting_style: other.reply_posting_style.or(self.reply_posting_style),
            forward_posting_style: other.forward_posting_style.or(self.forward_posting_style),
        }
    }

    /// Name of the account, empty until the dispatch names it.
    #[cfg(any(backend, feature = "sieve"))]
    pub fn name(&self) -> &str {
        self.name.as_deref().unwrap_or_default()
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
    /// `%F %R`.
    pub fn datetime_fmt(&self) -> &str {
        self.datetime_fmt.as_deref().unwrap_or(DEFAULT_DATETIME_FMT)
    }

    /// Whether a `Date:` header is converted to the local timezone,
    /// defaulting to `true`.
    pub fn datetime_local_tz(&self) -> bool {
        self.datetime_local_tz.unwrap_or(true)
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
    /// An alias naming a listed mailbox gives it the role and takes it
    /// from any other mailbox, so the configuration corrects a server
    /// that mislabels. The alias names the mailbox by id, else by the
    /// name of exactly one listed mailbox. `resolve` maps an alias onto
    /// the id of a backend taking several spellings of one mailbox (a
    /// Maildir named with a trailing slash or `./`), else `None`.
    pub fn apply_role_aliases(
        &self,
        mailboxes: &mut [Mailbox],
        mut resolve: impl FnMut(&str) -> Option<String>,
    ) {
        for (key, alias) in &self.mailbox_alias {
            let Some(role) = MailboxRole::known(key) else {
                continue;
            };

            let resolved = resolve(alias);
            let by_id =
                |mailbox: &&Mailbox| mailbox.id == *alias || resolved.as_ref() == Some(&mailbox.id);

            let id = match mailboxes.iter().find(by_id) {
                Some(mailbox) => mailbox.id.clone(),
                None => {
                    let mut named = mailboxes.iter().filter(|mailbox| mailbox.name == *alias);
                    match (named.next(), named.next()) {
                        (Some(mailbox), None) => mailbox.id.clone(),
                        _ => continue,
                    }
                }
          
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #814** (2026-11-15): **message delete in the trash reports "flagged" and advises an expunge when no id was found**
  *Symptoms*: On master `a196cc7`, IMAP against Dovecot 2.4.5 (UIDPLUS), deleting only an unknown id in the trash:  ``` $ himalaya message delete -m Trash 999999 Flagged 0 message(s) as deleted; run an expunge on the trash to remove them  Error:  999999  message-not-found  Message not found in the mailbox $ echo $? 3 ```  `--json` gives `"action":"flagged","count":0`. Nothing was flagged, and the advice is the risky part: an expunge removes every `\Deleted` message in the trash, including ones another client flagged.  Cause, as far as I can see: the IMAP backend expunges only when `outcome.value > 0 && self.supports_uidplus()` ([src/imap/backend.rs](https://github.com/pimalaya/himalaya/blob/a196cc704fb32bf72724c16731e5e33423a33c19/src/imap/backend.rs#L732)), so with nothing found `removed` is false, and [src/shared/message/delete.rs](https://github.com/pimalaya/himalaya/blob/a196cc704fb32bf72724c16731e5e33423a33c19/src/shared/message/delete.rs#L66) maps that to `DeleteAction::Flagged`. With a known id beside the unknown one the output is `deleted`, `count: 1`, as expected.  A fix could print `deleted` with `count: 0` when nothing was found, or no sentence at all beside the errors. I can send a PR today; which output do you prefer? 

- **Issue #813** (2026-11-13): **message send with save-copy runs the password command twice**
  *Symptoms*: With himalaya 2.2.1 (built with `cargo install --locked`, default features) on Debian unstable, `message send` with `message.send.save-copy = true` runs the password command twice, although IMAP and SMTP name the same command.  Configuration (server names changed):  ```toml [accounts.example] default = true email = "alice@example.org" message.send.save-copy = true mailbox.alias.sent = "Sent"  imap.server = "mail.example.org" imap.sasl.plain.username = "alice" imap.sasl.plain.password.command = ["sh", "-c", "systemd-ask-password 'password:' < /dev/tty"]  smtp.server = "mail.example.org" smtp.sasl.plain.username = "alice" smtp.sasl.plain.password.command = ["sh", "-c", "systemd-ask-password 'password:' < /dev/tty"] ```  `himalaya message send -- ./message.eml` asks for the password once for SMTP and again for the IMAP append to the sent mailbox. The doc comment on `SaslConfig::try_into_sasl` says an account whose IMAP, SMTP and ManageSieve blocks name one command spawns it once, but `SmtpClient::new` (`src/smtp/client.rs`, line 42) and the IMAP client (`src/imap/client.rs`, line 44) each create their own `SecretResolver`, so the memoization does not cross the two connections.  Besides typing the password twice, a typo in the second prompt sends the message but loses the copy to the sent mailbox. That was easy to miss when sending several messages in a row. Sharing one resolver per invocation would fix both.  ``` himalaya v2.2.1, default features pimalaya-config 0.2.0 Debian uns

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

### Incident Patch 1: `a04ff103` (2026-11-18)
**Commit Message**: fix: the family analysis fix-now batch (HIM-1 to HIM-5, HIM-10, HIM-14, HIM-18, HIM-19, TRI-1)

- HIM-2: a Gmail or-group keeps each conjunction in parentheses.
- HIM-3: an unpaged Gmail listing reads every page.
- TRI-1: pimdir queue show and cancel keep to the account's mail rows.
- HIM-1: the MCP server refuses an mbox path outside mbox.root.
- HIM-18: imap raw stops framing at a literal that is no UTF-8 (no panic, no
  forged completion), exit 3.
- HIM-4: a message past the MIME parser caps is refused as
  message-too-complex.
- HIM-14: search query nesting and operator chains are bounded.
- HIM-5: a mistyped path holding a colon is no longer read as a message.
- HIM-10: the mbox envelope cache is private (0700 dir, 0600 files).
- HIM-19: sieve activate refuses an empty script name.

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -275,6 +275,16 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Fixed a Gmail search flattening an `and` under an `or`: `from alice and subject invoice or from bob` went out as `{from:alice subject:invoice from:bob}`, which Gmail reads as three alternatives, and a `date` clause beside an `or` matched the whole label. An alternative holding more than one term is now wrapped in parentheses, `{(from:alice subject:invoice) from:bob}`.
+- Fixed `envelope list` and `envelope search` with `--page-size 0` on Gmail reading the first 100 messages and saying the listing was complete: they follow every next page token, 500 messages a page, as Microsoft Graph and IMAP list the whole mailbox.
+- Fixed `pimdir queue show` and `pimdir queue cancel` reaching a row another app of the store queued on an address book or calendar of the same account: such a row reads `unknown` and is refused, as Cardamum and Calendula keep to their own kind.
+- Fixed `himalaya mcp` over an mbox account reading and appending to an mbox outside `mbox.root` given as an absolute mailbox path: the server refuses it, read or write. The command line still opens any mbox by its absolute path.
+- Fixed `imap raw` panicking (exit 101) on a literal holding a byte that is no UTF-8, and splitting such a literal's tail into responses, so a body line `A1 NO forged` read as a tagged completion: io-imap decodes the reply lossily, so the reply is framed up to the response announcing that literal, the rest printed as one `unparsed` event, and the command exits 3.
+- Fixed a message past the MIME parser's own caps (more than 10,000 parts) being read in part, one unsplit `multipart/mixed` part hiding what it held from `message read`, `attachment list|download` and the MCP tools: it is refused with `message-too-complex`.
+- Fixed a search query nesting thousands of parentheses, or chaining thousands of `and`, `or` or `not`, aborting the process with a stack overflow, a `repl` or `mcp` session with it: past 32 nested parentheses or 256 operators the query is refused with `search-invalid`, naming the bound.
+- Fixed a mistyped path holding a colon (a Maildir file name's `:2,S`, a Windows drive `C:\`) being stored as a message made of the path by `message add` and the other commands taking a message: a message must open on a header field named with letters, digits, `-`, `_` and `.`. A file under a path holding a backslash followed by `n` or `r` is now found, the path being looked up before the escapes of an inline message are decoded.
+- Fixed the mbox envelope cache being readable by every user of the host under the usual umask: `<XDG cache>/himalaya/mbox/` is created and kept at mode 0700, its files written at 0600.
+- Fixed `sieve activate ""` deactivating every script and reporting an activation (RFC 5804 reads `SETACTIVE ""` as a deactivation): an empty name is refused as a usage error before connecting; `sieve deactivate` deactivates.
 - Fixed `message reply --all` keeping the user's own address in `Cc` when the account sets no `email`: it leaves out the reply's `From` (`--from`, else `email`) and the account's logins, the user names its IMAP and SMTP SASL blocks hold when they read as an address.
 - Fixed `pimdir mailbox create --json` leaving `parent` out for a mailbox at the top: it prints `null`.
 - Fixed a move whose source and target are one mailbox writing anyway: on mbox, `message move -f A -t A` and `mbox message move -m A -t A` rewrote the file, the message at its end, then failed with "Cannot find the message appended"; on IMAP the server gave the messages new UIDs; on pimdir a move was queued. Each now changes nothing and counts the messages, as JMAP, Gmail, Microsoft Graph and Maildir did.
```

**File**: `cairn/changes/archive/the-capped-message-is-refused/delta.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+---
+cairn: delta
+change: the-capped-message-is-refused
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
+### Requirement: A message too complex is refused whole
+A message the MIME parser (mime-rs) stopped splitting at its own entity or nesting cap SHALL be refused the same way, a part it left unsplit hiding what it holds; the `message-too-complex` row of the error code table says so.
+
+## REMOVED Requirements
+
+None.
```

**File**: `cairn/changes/archive/the-capped-message-is-refused/proposal.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+cairn: change
+id: the-capped-message-is-refused
+status: landed
+created: 2026-11-18
+---
+
+# The capped message is refused
+
+## Why
+
+Finding HIM-4 of the family's cli-family-analysis-2026-11-15 plan, rechecked on the live head 2026-11-18. A message past mime-rs's own entity cap (`ENTITIES_MAX`, 10,000) was read in part: the parser leaves the multipart it stopped at unsplit, which src/shared/message/part.rs counted as one part, so 10,001 attachment parts exited 0 as one `multipart/mixed`, and a decoy text part beside such an inner multipart hid what it held from `message read`, `attachment list` and the MCP tools. cairn/spec/commands.md says such a message is refused rather than read in part. The finding asked mime-rs for a mark on a capped parse: mime-rs 0.2.0 already sets one, `MimeAnomaly::PartLimit` on the entity it stopped at (`NestingLimit` past its depth), so no library change is needed.
+
+## What
+
+- `measure` refuses, with `message-too-complex`, an entity carrying `PartLimit` or `NestingLimit`.
```

**File**: `cairn/changes/archive/the-capped-message-is-refused/tasks.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+cairn: tasks
+change: the-capped-message-is-refused
+---
+
+# Tasks
+
+- [x] Test `a_message_past_the_parser_cap_is_refused` (src/shared/message/part.rs), flat and behind a decoy, failing on the old code.
+- [x] The anomaly check in `measure`.
+- [x] Fold into cairn/spec/commands.md; CHANGELOG; the log entry.
```

**File**: `cairn/changes/archive/the-colon-path-is-no-message/delta.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+---
+cairn: delta
+change: the-colon-path-is-no-message
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
+### Requirement: Raw message input is shared
+A positional naming no file SHALL be the message only when it opens on a header field, a name of letters, digits, `-`, `_` and `.` then a colon, a one-letter name followed by `/` or `\` being a Windows drive, so a mistyped path, a Maildir file name holding `:2,` included, is refused rather than stored. The file SHALL be looked up under the positional as typed, before the `\n` and `\r` escapes of an inline message are decoded.
+
+## REMOVED Requirements
+
+None.
```

**File**: `cairn/changes/archive/the-colon-path-is-no-message/proposal.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+---
+cairn: change
+id: the-colon-path-is-no-message
+status: landed
+created: 2026-11-18
+---
+
+# The colon path is no message
+
+## Why
+
+Finding HIM-5 of the family's cli-family-analysis-2026-11-15 plan, rechecked on the live head 2026-11-18. `himalaya message add -m Sent '/nonexistent/Mail/cur/1700000000.host:2,S'` exited 0 with a receipt, the stored message being the path: `opens_on_a_field` accepted any printable run before the first colon, and every Maildir file name holds `:2,`, as a Windows path holds `C:`. The escapes of an inline message were also decoded before the file test, so an existing file under a path holding a backslash then `n` or `r` (`C:\Users\nick\...`) was not found. cairn/spec/commands.md says a mistyped path is refused.
+
+## What
+
+- `opens_on_a_field` (src/shared/message/arg.rs) holds the field name to letters, digits, `-`, `_` and `.`, and reads a one-letter name followed by `/` or `\` as a Windows drive.
+- `resolve` looks the file up under the positional as typed, then decodes the escapes of an inline message.
```

**File**: `cairn/changes/archive/the-colon-path-is-no-message/tasks.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+cairn: tasks
+change: the-colon-path-is-no-message
+---
+
+# Tasks
+
+- [x] Tests `a_missing_path_holding_a_colon_is_not_a_message` and `a_path_holding_a_backslash_is_read` (src/shared/message/arg.rs), both failing on the old code.
+- [x] The name rule and the lookup order.
+- [x] Fold into cairn/spec/commands.md; CHANGELOG; the log entry.
```

**File**: `cairn/changes/archive/the-empty-script-is-refused/delta.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+---
+cairn: delta
+change: the-empty-script-is-refused
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
+### Requirement: ManageSieve commands
+`activate` SHALL refuse an empty name as a usage error, exit 2, before connecting (RFC 5804 reads `SETACTIVE ""` as a deactivation).
+
+## REMOVED Requirements
+
+None.
```

---

### Incident Patch 2: `15ffe166` (2026-11-19)
**Commit Message**: fix(imap): print an undecoded raw response as base64 in text

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Changed the io-managesieve dependency to 0.5.
 - Changed the io-pimdir dependency to 0.18.
 - Changed the pimalaya-cli dependency to 0.7.
-- **BREAKING**: Changed `imap raw` to print each response from its exact octets, as io-imap 0.12 frames them: one that is UTF-8 prints as text, parsed as before, one that is not, such as a response carrying an 8-bit literal, prints under `--json` as an `undecoded` event `{base64}`, its octets in standard base64, where io-imap's lossy decoding replaced each such byte by U+FFFD. A tagged response that is not UTF-8, its status left unread, exits 3. The text form prints such a response lossily.
+- **BREAKING**: Changed `imap raw` to print each response from its exact octets, as io-imap 0.12 frames them: one that is UTF-8 prints as text, parsed as before, one that is not, such as a response carrying an 8-bit literal, prints under `--json` as an `undecoded` event `{base64}`, its octets in standard base64, where io-imap's lossy decoding replaced each such byte by U+FFFD. A tagged response that is not UTF-8, its status left unread, exits 3. The text form prints such a response as one line, `undecoded (base64): ` then the same base64, where it printed it with each such byte replaced by U+FFFD.
 - Changed `attachment download` to name a saved part through pimalaya-cli's `sanitize::path_component`, the family's path component rule, its trimming, leading dots and `attachment` fallback kept: a name of dots and spaces, such as `. .`, no longer comes out as `.`.
 - **BREAKING**: Changed a pimdir queue row to print `row`, the row id, an integer, with `handle` beside it, the row under the store's identity: a string naming the store id, the incarnation and the row id joined by periods (`"e2646df031cd876334410c4df14ebd86.1.42"`, pimdir STORAGE §4.5), as Calendula and Cardamum print them. The receipts of `pimdir message add|send` (`copyRow` with `copyHandle`), `pimdir mailbox create|rename|delete`, `pimdir flag add|set|remove` and `pimdir tag` carry both, `null` both where nothing was staged, as do the rows of `pimdir queue list`, whose text prints the handle in place of the bare id, and `pimdir queue show|cancel`, a bare id given there named under the store's identity. `queue show` and `queue cancel` take the handle, checked against the store, or the bare id, unchecked. A handle of a restored copy of the store reads `reset` in `queue show` and is refused `store-reset` by `queue cancel`, the row left queued.
 - **BREAKING**: Changed a mailbox the backend does not hold to fail coded `mailbox-not-found` on IMAP, JMAP, Gmail and Microsoft Graph, where it printed `code: null`: an IMAP `SELECT`, `APPEND`, `COPY`, `MOVE`, `RENAME` or `DELETE` refused `NO [NONEXISTENT]` or `NO [TRYCREATE]`, or refused with a plain `NO` (as Fastmail answers) for a mailbox the one `LIST` then sent does not show, the server's answer kept in `sources`; a JMAP, Gmail or Graph name, id or role no mailbox, label or folder carries. The copy a send saves to such a mailbox is an `errors` entry so coded.
```

**File**: `MIGRATION.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ What a script or a frontend reads off `--json` and the text output changes, and
 - **`account check` prints every backend and exits 3** when one fails, each row carrying the failure's `code`, where v2 exited 0 whatever failed.
 - **`account list` names only the built backends under `backends`.** A backend the account declares and the build leaves out moves to `notBuilt`, marked ` (not built)` in text, where v2 listed every declared block under `backends`: a script reading a reduced build's accounts reads both keys, `{"name":"a","default":true,"backends":["maildir"],"notBuilt":["mbox"]}` where v2 printed `"backends":["maildir","mbox"]`. A full build lists as before, beside `"notBuilt":[]`.
 - **A protocol command prints its completion.** Every `imap` command prints `status` (`OK`, or `NO`/`BAD` with `text`, exiting 3). `imap select` prints the mailbox state beside it, the number of the first unseen message as `firstUnseen`. `imap raw` and `sieve raw` print the server's untagged or data responses as events, one JSON line each, then the completion; `smtp raw` prints `{code, text}`. Exit 3 means the server refused; exit 1 still means no answer.
-- **`imap raw` prints the server's exact octets.** A response that is not UTF-8, such as a `FETCH` carrying an 8-bit body literal, prints under `--json` as `{"event":"undecoded","base64":"..."}`, the response's octets (its literals and final CRLF included) in standard base64, where v2 printed it as text with each such byte replaced by U+FFFD. Decode `base64` to read it; a UTF-8 response prints as text, as before.
+- **`imap raw` prints the server's exact octets.** A response that is not UTF-8, such as a `FETCH` carrying an 8-bit body literal, prints under `--json` as `{"event":"undecoded","base64":"..."}`, the response's octets (its literals and final CRLF included) in standard base64, where v2 printed it as text with each such byte replaced by U+FFFD. The text form prints it as one line, `undecoded (base64): ` then the same base64. Decode `base64` to read it; a UTF-8 response prints as text, as before.
 - **A server's refusal is a result in every protocol namespace, exit 3.** A Gmail, Graph or JMAP command the server refuses (an HTTP 4xx or 5xx, a JMAP request or method error, a refused write), the `request` commands included, prints `{"refusal":{"status","reason","message","code","retryAfter"}}` and exits 3, where it printed the failure object and exited 1; a typed `sieve` command answered `NO` prints `{status, code, text}` as `sieve raw` does; a refused `smtp send` prints `{"refusals":[{"rcptTo","code","text"}]}`. Exit 1 now means no answer at all (network, TLS, a local error). Read the result of exit 3: `refusal.code` keeps the code the failure carried (`permission-denied`, `rate-limited`).
 - **A JMAP set applied in part names both halves.** `jmap email delete|update|copy`, `jmap mailbox destroy`, `jmap identity delete` and `jmap submission cancel` print `{ids, errors}`, the objects done and one item error per object refused, exit 3, where they printed a failure naming only the refused ones and exited 1.
 - **A sent message is never a failure.** A copy the store refuses after the send (`--save`, `message.send.save-copy`, `message add --send`) and a reply's answered flag failing after the send are item errors of the receipt, which now carries `errors` (`message send`, the composers, `message add`), and the command exits 3, where it exited 1 with a failure object (two values on stdout for the reply). Do not send again on exit 3: `sent` says the message went out.
```

**File**: `cairn/log/2026-11-19-imap-raw-text-base64.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+---
+cairn: log
+change: imap-raw-text-base64
+landed: 2026-11-19
+---
+
+# imap raw prints an 8-bit response in base64 in text
+
+Owner ruling 2026-11-19: the text form of `imap raw` no longer decodes a response that is not UTF-8 lossily.
+
+## What landed
+
+- src/imap/raw.rs: `split_reply` pushes the line `undecoded (base64): <base64>` for a response that is not UTF-8, the base64 the one the `undecoded` event carries (its octets, literals and final CRLF included); `ImapRawEvent::Undecoded` displays the same line. No existing text convention for binary output was found (byte writers print raw bytes, `--json` base64), so the prefix is new; no well-formed IMAP response opens with it.
+- Test `the_text_form_prints_an_8bit_response_in_base64` failed against the lossy line (U+FFFD found) before the change.
+- CHANGELOG: the unreleased breaking `imap raw` line amended. MIGRATION: the v2 to v3 `imap raw` line amended.
+
+## Capabilities moved
+
+- [commands](../spec/commands.md): *Raw passthrough is byte-verbatim*, its text form, and the scenario *An 8-bit literal in the text form*.
```

**File**: `cairn/spec/commands.md` (modified, +6/-1)
```diff
@@ -53,13 +53,18 @@ The protocol SHALL live in io-managesieve, so this repository holds a `SieveClie
 ### Requirement: Raw passthrough is byte-verbatim
 The `imap raw` and `smtp raw` commands SHALL forward the command bytes to the server verbatim, resolving the argument through the shared `RawCommandArg` (positional or stdin read whole, refused when not valid UTF-8). It decodes literal `\r` / `\n` escapes into real CRLF so a shell-typed command survives intact. `imap raw` sends a batch of caller-tagged commands: it appends a trailing CRLF when missing and delegates tagging, framing and out-of-order completion tracking to io-imap. `smtp raw` stays a single command line: it strips the trailing CRLF (io-smtp appends its own) and rejects a multi-line batch, since the SMTP exchange reads exactly one reply. `sieve raw` sends one command line and reads the complete ManageSieve response; literal-bearing Sieve commands use their typed commands so the response reader remains synchronized.
 
-The reply SHALL be printed split into what himalaya understands of it. Under `--json`, `imap raw` SHALL print each untagged response as an `untagged` event `{kind, number, text}` (`* 3 EXISTS` being kind `EXISTS`, number 3), each continuation request as a `continuation` event `{text}`, a response it cannot parse as an `unparsed` event `{text}`, and a response that is not UTF-8 as an `undecoded` event `{base64}`, its exact octets in the RFC 4648 standard alphabet, padded, a literal kept in the response announcing it, as io-imap frames each response; then the result `{completions: [{tag, status, code, text}]}`, and `sieve raw` each data line as a `data` event `{text}`, then the completion `{status, code, text}`. The text form of `imap raw` and `sieve raw` SHALL print every response line as received, untagged and data lines included, as the result, the events being printed under `--json` only. `smtp raw` SHALL print `{code, text}`, the reply's lines joined, `code` `null` when the reply opens with none. A refused completion (an IMAP `NO` or `BAD`, a ManageSieve `NO` or `BYE`, an SMTP 4xx or 5xx) SHALL exit 3, its result printed. `imap raw` reads the whole reply before printing, so its events come before the result but not as they arrive. It SHALL print each response from the octets io-imap read, never decoding them lossily under `--json`: a UTF-8 one as text, parsed, and one that is not as `undecoded`, a line of a literal never read as a response. A response that is not UTF-8 and opens with neither `*` nor `+`, a tagged completion whose status is left unread, SHALL exit 3. The text form SHALL print a response that is not UTF-8 decoded lossily, a terminal showing no other.
+The reply SHALL be printed split into what himalaya understands of it. Under `--json`, `imap raw` SHALL print each untagged response as an `untagged` event `{kind, number, text}` (`* 3 EXISTS` being kind `EXISTS`, number 3), each continuation request as a `continuation` event `{text}`, a response it cannot parse as an `unparsed` event `{text}`, and a response that is not UTF-8 as an `undecoded` event `{base64}`, its exact octets in the RFC 4648 standard alphabet, padded, a literal kept in the response announcing it, as io-imap frames each response; then the result `{completions: [{tag, status, code, text}]}`, and `sieve raw` each data line as a `data` event `{text}`, then the completion `{status, code, text}`. The text form of `imap raw` and `sieve raw` SHALL print every response line as received, untagged and data lines included, as the result, the events being printed under `--json` only. `smtp raw` SHALL print `{code, text}`, the reply's lines joined, `code` `null` when the reply opens with none. A refused completion (an IMAP `NO` or `BAD`, a ManageSieve `NO` or `BYE`, an SMTP 4xx or 5xx) SHALL exit 3, its result printed. `imap raw` reads the whole reply before printing, so its events come before the result but not as they arrive. It SHALL print each response from the octets io-imap read, never decoding them lossily: a UTF-8 one as text, parsed, and one that is not as `undecoded`, a line of a literal never read as a response. A response that is not UTF-8 and opens with neither `*` nor `+`, a tagged completion whose status is left unread, SHALL exit 3. The text form SHALL print a response that is not UTF-8 as one line, `undecoded (base64): ` then its exact octets as the `undecoded` event carries them, never decoded lossily; no well-formed IMAP response opens that way, `undecoded` being no status a tag may precede.
 
 #### Scenario: An 8-bit literal
 - GIVEN an IMAP server answering `a1 FETCH 1 BODY[]` with a literal holding the octet 0xE9, then `a1 OK done`
 - WHEN `himalaya --json imap raw -- 'a1 FETCH 1 BODY[]'` runs
 - THEN it prints an `undecoded` event whose `base64` decodes to the `FETCH` response's exact octets, then `{"completions":[{"tag":"a1","status":"OK","code":null,"text":"done"}]}`, a line of the literal spelling `a1 NO` never read as a completion, 
```

**File**: `src/imap/raw.rs` (modified, +31/-9)
```diff
@@ -26,9 +26,11 @@ use crate::{
 /// trailing one is appended when missing. The response is read until
 /// every tagged completion has arrived, possibly out of order.
 ///
-/// The text form prints every response as received. Under `--json`,
-/// untagged and continuation responses print as events, then the tagged
-/// completions as the result, each split into its parts. A response that
+/// The text form prints every response as received, one that is not
+/// UTF-8 as a line `undecoded (base64): ` followed by its exact octets
+/// in base64, never decoded lossily. Under `--json`, untagged and
+/// continuation responses print as events, then the tagged completions
+/// as the result, each split into its parts. A response that
 /// is not UTF-8, such as one carrying an 8-bit literal, prints as an
 /// event holding its exact octets in base64. A tagged NO or BAD is part
 /// of the result and exits 3, the server having answered.
@@ -90,7 +92,8 @@ impl ImapRawCommand {
 pub(crate) struct ImapRawOutput {
     /// One per command sent.
     completions: Vec<ImapCompletion>,
-    /// Every response as received, for the text form.
+    /// Every response as received, for the text form, one that is not
+    /// UTF-8 as its line in base64.
     #[serde(skip)]
     lines: Vec<String>,
     /// Whether a response that is not UTF-8 opens with a tag, a completion
@@ -122,10 +125,9 @@ fn split_reply(responses: &[Vec<u8>]) -> (Vec<ImapRawEvent>, ImapRawOutput) {
 
         let Ok(text) = str::from_utf8(bytes) else {
             unread |= !matches!(bytes.first(), Some(b'*' | b'+'));
-            lines.push(String::from_utf8_lossy(bytes).into_owned());
-            events.push(ImapRawEvent::Undecoded {
-                base64: base64::encode(response),
-            });
+            let base64 = base64::encode(response);
+            lines.push(format!("undecoded (base64): {base64}"));
+            events.push(ImapRawEvent::Undecoded { base64 });
             continue;
         };
 
@@ -205,7 +207,7 @@ impl fmt::Display for ImapRawEvent {
         match self {
             Self::Untagged { line, .. } | Self::Continuation { line, .. } => writeln!(f, "{line}"),
             Self::Unparsed { text } => writeln!(f, "{text}"),
-            Self::Undecoded { base64 } => writeln!(f, "{base64}"),
+            Self::Undecoded { base64 } => writeln!(f, "undecoded (base64): {base64}"),
         }
     }
 }
@@ -400,6 +402,26 @@ mod tests {
         );
     }
 
+    /// The text form prints a response that is not UTF-8 as a line of its
+    /// own in base64, never decoded lossily.
+    #[test]
+    fn the_text_form_prints_an_8bit_response_in_base64() {
+        let fetch = b"* 1 FETCH (BODY[] {4}\r\nab\xe9c)\r\n";
+        let responses = framed(&[fetch, b"A1 OK done\r\n"]);
+        let (_, output) = split_reply(&responses);
+        let text = output.to_string();
+
+        assert!(!text.contains('\u{FFFD}'));
+
+        let mut lines = text.lines();
+        let line = lines.next().unwrap();
+        let data = line.strip_prefix("undecoded (base64): ").unwrap();
+
+        assert_eq!(base64::decode_strict(data).unwrap(), fetch);
+        assert_eq!(lines.next(), Some("A1 OK done"));
+        assert_eq!(lines.next(), None);
+    }
+
     /// A tagged response that is not UTF-8 prints in base64 and marks the
     /// outcome partial, its status left unread.
     #[test]
```

---

### Incident Patch 3: `a4a5f7d8` (2026-11-19)
**Commit Message**: fix(pimdir): name the mailbox mailboxId in pimdir status

**File**: `cairn/log/2026-11-19-pimdir-status-names-the-mailbox.md` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+---
+cairn: log
+change: pimdir-status-names-the-mailbox
+landed: 2026-11-19
+---
+
+# pimdir status names the mailbox
+
+The owner's ruling of 2026-11-19: `himalaya pimdir status` names a parked or refused row's mailbox `mailboxId`, as Calendula's and Cardamum's name theirs `calendarId` and `addressbookId`, where it printed `collection`, a pimdir word. The command is unreleased (it landed the same day under pimdir-status-reports-the-store), so no user is broken and no CHANGELOG entry moves.
+
+## What landed
+
+- src/pimdir/status.rs: `PimdirParkedStatus.mailbox_id`, and a status-own `PimdirRefusedStatus` (`mailboxId`, `itemId`, `source`, `reason`, `refusedAt`), so `pimdir queue list` keeps its `collection` key.
+- src/pimdir/backend.rs: `status` maps the queue's refused rows onto it.
+- cairn/spec/backends.md: *pimdir status reports the store*, its row shapes and scenario.
+
+## Checks
+
+The test `a_status_prints_mailboxes_parked_rows_and_refusals` asserts the new keys, and the store test with a parked move reads `mailbox_id`.
+
+## Left
+
+`pimdir queue list`, `queue show` and their refusals still print `collection`, as Calendula's and Cardamum's queue outputs do: aligning the queue outputs is a family question, not this change's.
```

**File**: `cairn/spec/backends.md` (modified, +2/-2)
```diff
@@ -317,12 +317,12 @@ Every pimdir output naming a queue row SHALL print `row`, the row id, an integer
 - THEN the row is listed as parked with its error, and `pimdir queue cancel` on its id removes it
 
 ### Requirement: pimdir status reports the store
-`himalaya pimdir status` SHALL report what the pimdir store holds of the account, as Calendula's and Cardamum's `pimdir status` report theirs, and print `{"account", "accounts", "mailboxes", "parked", "refused"}`: `account` the account the store groups this account's mail under (`pimdir.account`, configured or derived), `null` in a store grouping none; `accounts` every account the store groups collections under (`PimdirReader::list_accounts`); `mailboxes` one `{"id", "name", "total", "hydrated", "queued"}` per mailbox of the account, by id, `name` its id when it has none, `total` its live messages (`count_items`), `hydrated` those carrying a local body, read off the summaries with no body opened, `queued` its queued creations and sends, those `pimdir queue list` lists under `messages`; `parked` each row the sync engine parked in those mailboxes, in append order, `{"row", "handle", "collection", "kind", "error"}`, `kind` as the store holds it; `refused` each refusal standing in them (pimdir STORAGE §15.4) in the shape `pimdir queue list` prints under its `refused`, which it keeps. The text SHALL print `Account:` (the account and `(pimdir)`), `Store account:` and `Grouped accounts:` above one line per mailbox (its id, `<hydrated>/<total>`, `<queued> queued`, its name), then a blank line and one line per parked row (its handle, `parked` or `unconfirmed`, its kind, its mailbox, its error), then a blank line and one line per refusal (the message id, `refused`, the source, the mailbox, the reason), each block printed only when it holds a line.
+`himalaya pimdir status` SHALL report what the pimdir store holds of the account, as Calendula's and Cardamum's `pimdir status` report theirs, and print `{"account", "accounts", "mailboxes", "parked", "refused"}`: `account` the account the store groups this account's mail under (`pimdir.account`, configured or derived), `null` in a store grouping none; `accounts` every account the store groups collections under (`PimdirReader::list_accounts`); `mailboxes` one `{"id", "name", "total", "hydrated", "queued"}` per mailbox of the account, by id, `name` its id when it has none, `total` its live messages (`count_items`), `hydrated` those carrying a local body, read off the summaries with no body opened, `queued` its queued creations and sends, those `pimdir queue list` lists under `messages`; `parked` each row the sync engine parked in those mailboxes, in append order, `{"row", "handle", "mailboxId", "kind", "error"}`, `kind` as the store holds it; `refused` each refusal standing in them (pimdir STORAGE §15.4) `{"mailboxId", "itemId", "source", "reason", "refusedAt"}`, the row `pimdir queue list` prints under its `refused` with the mailbox named `mailboxId`, as Calendula and Cardamum name theirs by `calendarId` and `addressbookId`; `pimdir queue list` keeps its own keys. The text SHALL print `Account:` (the account and `(pimdir)`), `Store account:` and `Grouped accounts:` above one line per mailbox (its id, `<hydrated>/<total>`, `<queued> queued`, its name), then a blank line and one line per parked row (its handle, `parked` or `unconfirmed`, its kind, its mailbox, its error), then a blank line and one line per refusal (the message id, `refused`, the source, the mailbox, the reason), each block printed only when it holds a line.
 
 #### Scenario: A parked move in the report
 - GIVEN a pimdir account holding `imap/Drafts` and `imap/Trash`, and a move of a draft the sync engine parked
 - WHEN `himalaya --json pimdir status` runs
-- THEN it prints both mailboxes by id, `imap/Drafts` with its `hydrated` and `total`, and under `parked` the move's `row`, `handle`, `"collection":"imap/Drafts"`, `"kind":"move"` and its error
+- THEN it prints both mailboxes by id, `imap/Drafts` with its `hydrated` and `total`, and under `parked` the move's `row`, `handle`, `"mailboxId":"imap/Drafts"`, `"kind":"move"` and its error
 
 ### Requirement: pimdir creates a mailbox by queueing an intent
 `pimdir mailbox create <NAME> [--parent <MAILBOX>]` SHALL enqueue one `collection-create` intent (pimdir STORAGE Annex B.2) with the `v: 1` payload `{"v": 1, "source": id, "name": text, "parent": collection?}`, and print `{"row": integer, "handle": string, "name": text, "parent": collection | null, "source": id}`, `parent` `null` at the top, never left out. It SHALL NOT create a collection in the store: the mailbox arrives with the sync that performs the intent.
```

**File**: `src/pimdir/backend.rs` (modified, +16/-4)
```diff
@@ -69,7 +69,9 @@ use crate::{
     pimdir::{
         client::{PimdirClient, handle},
         queue::list::{PimdirQueueRefused, PimdirQueueRow},
-        status::{PimdirMailboxStatus, PimdirParkedStatus, PimdirStatusOutput},
+        status::{
+            PimdirMailboxStatus, PimdirParkedStatus, PimdirRefusedStatus, PimdirStatusOutput,
+        },
     },
 };
 
@@ -1527,7 +1529,17 @@ impl PimdirClient {
 
         for collection in &collections {
             let id = collection.id.as_str();
-            refused.extend(self.refused_rows(id)?);
+            refused.extend(
+                self.refused_rows(id)?
+                    .into_iter()
+                    .map(|row| PimdirRefusedStatus {
+                        mailbox_id: row.collection,
+                        item_id: row.item_id,
+                        source: row.source,
+                        reason: row.reason,
+                        refused_at: row.refused_at,
+                    }),
+            );
 
             let total = self
                 .store
@@ -1571,7 +1583,7 @@ impl PimdirClient {
             .map(|parked| PimdirParkedStatus {
                 row: parked.id,
                 handle: handle(&identity, parked.id),
-                collection: parked.collection,
+                mailbox_id: parked.collection,
                 kind: parked.action,
                 error: parked.error,
             })
@@ -5109,7 +5121,7 @@ mod tests {
         assert_eq!(status.parked[0].row, row);
         assert_eq!(status.parked[0].handle, named.to_string());
         assert_eq!(status.parked[0].kind, "move");
-        assert_eq!(status.parked[0].collection, "imap/Drafts");
+        assert_eq!(status.parked[0].mailbox_id, "imap/Drafts");
         let drafts_status = &status.mailboxes[0];
         assert_eq!(drafts_status.id, "imap/Drafts");
         assert_eq!((drafts_status.hydrated, drafts_status.total), (1, 1));
```

**File**: `src/pimdir/status.rs` (modified, +30/-19)
```diff
@@ -12,11 +12,7 @@ use pimalaya_cli::{columns::Columns, listing::Listing, printer::Printer, sanitiz
 use schemars::JsonSchema;
 use serde::Serialize;
 
-use crate::{
-    account::context::Account,
-    backend::Backend,
-    pimdir::{client::PimdirClient, queue::list::PimdirQueueRefused},
-};
+use crate::{account::context::Account, backend::Backend, pimdir::client::PimdirClient};
 
 /// Report what the local pimdir store holds of the account.
 ///
@@ -37,7 +33,7 @@ use crate::{
 ///
 /// JSON output: `{"account", "accounts", "mailboxes": [{"id", "name",
 /// "total", "hydrated", "queued"}], "parked": [{"row", "handle",
-/// "collection", "kind", "error"}], "refused": [{"collection", "itemId",
+/// "mailboxId", "kind", "error"}], "refused": [{"mailboxId", "itemId",
 /// "source", "reason", "refusedAt"}]}`, `kind` as the queue spells it.
 #[derive(Debug, Parser)]
 pub struct PimdirStatusCommand;
@@ -73,9 +69,8 @@ pub struct PimdirStatusOutput {
     /// Every action the sync engine parked in those mailboxes, in the
     /// order it was queued.
     pub parked: Vec<PimdirParkedStatus>,
-    /// Every refusal standing in those mailboxes, per message and source,
-    /// as `pimdir queue list` prints it.
-    pub refused: Vec<PimdirQueueRefused>,
+    /// Every refusal standing in those mailboxes, per message and source.
+    pub refused: Vec<PimdirRefusedStatus>,
 }
 
 /// One mailbox's row in a [`PimdirStatusOutput`].
@@ -106,7 +101,7 @@ pub struct PimdirParkedStatus {
     pub handle: String,
     /// The mailbox the action is queued on, as `mailbox list` prints its
     /// id.
-    pub collection: String,
+    pub mailbox_id: String,
     /// The action as the queue spells it: `add`, `submit`, `set-flags`,
     /// `move`, ...
     pub kind: String,
@@ -115,6 +110,22 @@ pub struct PimdirParkedStatus {
     pub error: String,
 }
 
+/// One refused message in a [`PimdirStatusOutput`] (pimdir STORAGE §15.4).
+#[derive(Clone, Debug, Serialize, JsonSchema)]
+#[serde(rename_all = "camelCase")]
+pub struct PimdirRefusedStatus {
+    /// The mailbox holding the message, as `mailbox list` prints its id.
+    pub mailbox_id: String,
+    /// The message, as `envelope list` prints its id.
+    pub item_id: String,
+    /// The source whose server refused the change.
+    pub source: String,
+    /// The text the server gave.
+    pub reason: String,
+    /// When the refusal was recorded, RFC 3339.
+    pub refused_at: String,
+}
+
 impl fmt::Display for PimdirStatusOutput {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         let mut listing = Listing::new(&self.name, Some(Backend::Pimdir.as_str()));
@@ -155,7 +166,7 @@ impl fmt::Display for PimdirStatusOutput {
                     sanitize::text(&row.handle).into_owned(),
                     String::from(state),
                     sanitize::text(&row.kind).into_owned(),
-                    sanitize::text(&row.collection).into_owned(),
+                    sanitize::text(&row.mailbox_id).into_owned(),
                     sanitize::text(&row.error).into_owned(),
                 ]);
             }
@@ -171,7 +182,7 @@ impl fmt::Display for PimdirStatusOutput {
                     sanitize::text(&row.item_id).into_owned(),
                     String::from("refused"),
                     sanitize::text(&row.source).into_owned(),
-                    sanitize::text(&row.collection).into_owned(),
+                    sanitize::text(&row.mailbox_id).into_owned(),
                     sanitize::text(&row.reason).into_owned(),
                 ]);
             }
@@ -192,8 +203,8 @@ mod tests {
     const STORE: &str = "e2646df031cd876334410c4df14ebd86";
 
     /// The report prints the twins' keys, a parked row by its row and
-    /// handle, and the refusals in the shape `pimdir queue list` prints
-    /// them; the text lists each block after the mailboxes.
+    /// handle, a mailbox under `mailboxId` in parked and refused rows; the
+    /// text lists each block after the mailboxes.
     #[test]
     fn a_status_prints_mailboxes_parked_rows_and_refusals() {
         let output = PimdirStatusOutput {
@@ -210,12 +221,12 @@ mod tests {
             parked: vec![PimdirParkedStatus {
                 row: 3,
                 handle: format!("{STORE}.1.3"),
-                collection: "imap/INBOX".into(),
+                mailbox_id: "imap/INBOX".into(),
                 kind: "move".into(),
                 error: "conflict".into(),
             }],
-            refused: vec![PimdirQueueRefused {
-                collection: "imap/INBOX".into(),
+            refused: vec![PimdirRefusedStatus {
+                mailbox_id: "imap/INBOX".into(),
                 item_id: "9".into(),
                 source: "imap".into(),
                 reason: "NO [CANNOT] refused".into(),
@@ -238,12 +249,12 @@ mod tests {
                 "parked": [{
                     "row": 3,
                     "handle": format!("{STORE}.1.3"),
-                    "coll
```

#### Recent Merged Pull Requests:
- **PR #811** (2026-11-14): feat(search): add generic header <name> <pattern> search clause (@ravi-arnan)
- **PR #809** (2026-11-14): feat(tls): add tls.client, a client certificate for mutual TLS (@toppk)
- **PR #808** (2026-11-08): feat(mcp): read an attachment's content without touching disk (#805) (@maybenotconnor)
- **PR #807** (2026-11-08): feat(mcp): attach files given inline to the composers (@maybenotconnor)
- **PR #803** (2026-11-05): fix(envelope): one rule for hasAttachment across the MIME backends (@snrmwg)
- **PR #800** (2026-11-01): fix(cli): delimit config paths with $PATH's own separator (@Omair-Asdaq)

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

## X. the family analysis fix-now batch (HIM-1 to HIM-5, HIM-10, HIM-14, HIM-18, HIM-1

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pimalaya/himalaya. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a04ff103`: the family analysis fix-now batch (HIM-1 to HIM-5, HIM-10, HIM-14, HIM-18, HIM-19, TRI-1). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Fixed a Gmail search flattening an `and` under an `or`: `from alice and subject invoice or from bob` went out as `{from:alice subject:invoice from:bob}`, which Gmail reads as three alternatives, and a `date` clause beside an `or` matched the whole label. An alternative holding more than one term is now wrapped in parentheses, `{(from:alice subject:invoice) from:bob}`.
- Fixed `envelope list` and `envelope search` with `--page-size 0` on Gmail reading the first 100 messages and saying the listing was complete: they follow every next page token, 500 messages a page, as Microsoft Graph and IMAP list the whole mailbox.
- Fixed `pimdir queue show` and `pimdir queue cancel` reaching a row another app of the store queued on an address book or calendar of the same account: such a row reads `unknown` and is refused, as Cardamum and Calendula keep to their own kind.
- Fixed `himalaya mcp` over an mbox account reading and appending to an mbox outside `mbox.root` given as an absolute mailbox path: the server refuses it, read or write. The command line still opens any mbox by its absolute path.
- Fixed `imap raw` panicking (exit 101) on a literal holding a byte that is no UTF-8, and splitting
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a04ff103` are properly handled with clean fallback behavior.
