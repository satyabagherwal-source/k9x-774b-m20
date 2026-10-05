# Forensic Learning Record (Deep Inspection): pimalaya/himalaya

> **Canonical Artifact**: `07_PROJECT_LEARNING/pimalaya-himalaya-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pimalaya/himalaya](https://github.com/pimalaya/himalaya))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:44:11.627Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pimalaya/himalaya`
- **Description**: CLI to manage emails
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7362 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/account/check.rs`
```
//! # Account check
//!
//! The `account check` command, opening one connection per configured
//! backend so a credential or an endpoint fails here rather than in the
//! middle of a real command.

use std::{fmt, path::PathBuf};

use anyhow::{Result, bail};
use clap::Parser;
#[cfg(feature = "imap")]
use io_sasl::mechanism::SaslMechanism;
use pimalaya_cli::printer::Printer;
use pimalaya_config::{secret::SecretResolver, toml::TomlConfig};
use schemars::JsonSchema;
use serde::Serialize;

#[cfg(feature = "imap")]
use crate::config::ImapConfig;
use crate::{
    backend::Backend,
    config::{AccountConfig, Config},
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
            None => bail!(
                "No configuration found. Run bare `himalaya` to launch the wizard \
                 and generate one."
            ),
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
            aut
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
use crate::email::mailbox::{Mailbox, MailboxRole};
use crate::{
    config::{
        AccountConfig, AttachmentListTableConfig, Config, EnvelopeListTableConfig,
        MailboxListTableConfig, TableArrangementConfig,
    },
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
    /// An unmatched name comes back verbatim, so a caller passes either an
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
    config::{AccountConfig, Config, TableArrangementConfig},
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
        None => anyhow::bail!(
            "No configuration found. Run bare `himalaya` to launch the wizard \
             and generate one."
        ),
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
            Self::Pimdir => write!(f, "pimdir"),
            Self::Smtp => write!(f, "smtp"),
            Self::Sieve => write!(f, "sieve"),
        }
    }
}

```

### Core Architecture Module: `src/cli.rs`
```
//! # Parser
//!
//! Top-level clap parser and subcommand dispatcher, resolving the account
//! a command runs against before handing it a ready client.

use std::{
    io::{IsTerminal, stdin},
    path::{Path, PathBuf},
};

use anyhow::{Result, bail};
use clap::{CommandFactory, Parser, Subcommand};
use pimalaya_cli::{
    clap::{
        args::{AccountFlag, JsonFlag, LogFlags},
        commands::{CompletionCommand, JsonSchemaCommand, ManualCommand},
        parsers::path_parser,
    },
    footer, long_version,
    printer::Printer,
    prompt,
};
use pimalaya_config::toml::TomlConfig;

#[cfg(feature = "gmail")]
use crate::gmail::{cli::GmailCommand, client::build_gmail_client};
#[cfg(feature = "imap")]
use crate::imap::{cli::ImapCommand, client::build_imap_client};
#[cfg(feature = "jmap")]
use crate::jmap::{cli::JmapCommand, client::build_jmap_client};
#[cfg(feature = "m2dir")]
use crate::m2dir::{cli::M2dirCommand, client::build_m2dir_client};
#[cfg(feature = "maildir")]
use crate::maildir::{cli::MaildirCommand, client::build_maildir_client};
#[cfg(feature = "msgraph")]
use crate::msgraph::{cli::MsgraphCommand, client::build_msgraph_client};
#[cfg(feature = "pimdir")]
use crate::pimdir::{cli::PimdirCommand, client::build_pimdir_client};
#[cfg(backend)]
use crate::shared::{
    attachment::cli::AttachmentCommand, envelope::cli::EnvelopeCommand, flag::cli::FlagCommand,
    mailbox::cli::MailboxCommand,
};
// NOTE: `EmailClient` and the `message` command host the send path, so
// they exist for any backend rather than for storage ones alone.
#[cfg(any(backend, feature = "smtp"))]
use crate::shared::{client::EmailClient, message::cli::MessageCommand};
#[cfg(feature = "sieve")]
use crate::sieve::{cli::SieveCommand, client::build_sieve_client};
#[cfg(feature = "smtp")]
use crate::smtp::{cli::SmtpCommand, client::build_smtp_client};
use crate::{
    account::cli::AccountCommand,
    backend::Backend,
    config::{AccountConfig, Config},
    json_schema,
    wizard::{self, configure::ConfigureCommand, discover::CONFIG_SAMPLE_URL},
};

/// Top-level command-line interface parser.
#[derive(Parser, Debug)]
#[command(name = env!("CARGO_PKG_NAME"))]
#[command(author, version, about)]
#[command(long_about = concat!(
    "CLI to manage emails.\n\n",
    "First time here? Run `himalaya` with no command: it offers to generate an ",
    "account discovered from your email address, which `himalaya configure` does ",
    "again later. Everything discovery does not cover is written by hand.",
))]
#[command(long_version = long_version!())]
#[command(after_help = footer!())]
#[command(propagate_version = true, infer_subcommands = true)]
pub struct Cli {
    /// The subcommand to run.
    ///
    /// Omitted, a bare `himalaya` offers to generate a configuration when
    /// it finds none, and shows this help otherwise.
    #[command(subcommand)]
    pub cmd: Option<Command>,
    #[command(flatten)]
    pub config: ConfigPathsArg,
    #[command(flatten)]
    pub account: AccountFlag,
    /// Force a specific backend for cross-protocol commands.
    ///
    /// Only the shared commands read it, the protocol-specific ones always
    /// using their own backend. `auto`, the default, picks the first
    /// configured backend the command supports; an explicit value bails when
    /// the account has no such block, or the command no such implementation.
    #[arg(short, long, global = true, default_value_t)]
    pub backend: Backend,
    #[command(flatten)]
    pub json: JsonFlag,
    #[command(flatten)]
    pub log: LogFlags,
}

/// Top-level subcommands.
#[derive(Debug, Subcommand)]
pub enum Command {
    #[cfg(backend)]
    #[command(subcommand, visible_alias = "mbox", alias = "mailboxes")]
    Mailbox(MailboxCommand),
    #[cfg(backend)]
    #[command(subcommand, alias = "envelopes")]
    Envelope(EnvelopeCommand),
    #[cfg(backend)]
    #[command(subcommand, alias = "flags")]
    Flag(FlagCommand),
    #[cfg(any(backend, feature = "smtp"))]
    #[command(subcommand, visible_alias = "msg", alias = "messages")]
    Message(MessageCommand),
    #[cfg(backend)]
    #[command(subcommand, alias = "attachments")]
    Attachment(AttachmentCommand),
    #[cfg(feature = "imap")]
    #[command(subcommand)]
    Imap(ImapCommand),
    #[cfg(feature = "jmap")]
    #[command(subcommand)]
    Jmap(JmapCommand),
    #[cfg(feature = "gmail")]
    #[command(subcommand)]
    Gmail(GmailCommand),
    #[cfg(feature = "msgraph")]
    #[command(subcommand)]
    Msgraph(MsgraphCommand),
    #[cfg(feature = "maildir")]
    #[command(subcommand)]
    Maildir(MaildirCommand),
    #[cfg(feature = "m2dir")]
    #[command(subcommand)]
    M2dir(M2dirCommand),
    #[cfg(feature = "pimdir")]
    #[command(subcommand)]
    Pimdir(PimdirCommand),
    #[cfg(feature = "smtp")]
    #[command(subcommand)]
    Smtp(SmtpCommand),
    #[cfg(feature = "sieve")]
    #[command(subcommand)]
    Sieve(SieveCommand),
    /// Configure an account interactively.
    #[command(visible_alias = "wizard")]
    Configure(ConfigureCommand),
    #[command(subcommand)]
    Account(AccountCommand),
    #[command(alias = "completions")]
    Completion(CompletionCommand),
    #[command(alias = "manuals")]
    Manual(ManualCommand),
    #[command(alias = "json-schemas")]
    JsonSchema(JsonSchemaCommand),
}

/// Path(s) to the TOML configuration file(s).
///
/// Declared here rather than taken from pimalaya-cli, so the environment
/// variable carries this product's name.
#[derive(Debug, Default, Parser)]
pub struct ConfigPathsArg {
    /// Override the default configuration file path.
    ///
    /// Paths are shell-expanded then canonicalized, and several may be given
    /// at once, delimited by `:` like `$PATH`. The first is the base and the
    /// rest are merged on top, which is how a public configuration stays
    /// separate from the private ones.
    #[arg(long = "config", short = 'c', global = true, env = "HIMALAYA_CONFIG")]
    #[arg(name = "config_paths", value_name = "PATH", value_parser = path_parser, value_delimiter = ':')]
    pub paths: Vec<PathBuf>,
}

/// Welcomes, then offers to generate a first configuration, returning
/// whether the wizard ran.
///
/// A hook rather than a gate: declining decides nothing, and what happens
/// next is the business of the caller, a bare invocation or a command
/// that needs an account.
pub fn offer_configuration(
    printer: &mut impl Printer,
    config_paths: &[PathBuf],
    path: &Path,
) -> Result<bool> {
    wizard::configure::print_welcome(path);

    if !prompt::bool("Create a configuration with a default account?", true)? {
        return Ok(false);
    }

    ConfigureCommand.execute(printer, config_paths)?;

    Ok(true)
}

/// Resolves the account a command runs against, returning the leftover
/// global config, the account name and its config.
///
/// A missing configuration is met with the wizard rather than an error, and
/// the command carries on either way: accepting gives it a chance to work,
/// declining leaves it to fail on the configuration it still has not got.
fn resolve_account(
    printer: &mut impl Printer,
    config_paths: &[PathBuf],
    account_name: Option<&str>,
) -> Result<(Config, String, AccountConfig)> {
    let mut config = match Config::from_paths_or_default(config_paths)? {
        Some(config) => config,
        None => {
            // NOTE: the target path is where `-c` pointed, so a mistyped
            // path shows up as itself rather than as a generic first run.
            let path = Config::target_path(config_paths)?;

            // NOTE: a script and a JSON consumer cannot answer a prompt, so
            // both skip the offer and fail below.
            if !printer.is_json() && stdin().is_terminal() {
                offer_configuration(printer, config_paths, &path)?;
            }

            // NOTE: the wizard may print the account instead of writing it,
            // so having run it proves nothing and the lookup ru
```

### Core Architecture Module: `src/config.rs`
```
//! # Configuration
//!
//! The TOML schema: a global block plus named account blocks, each
//! carrying the optional per-backend sub-blocks its protocols need.
//!
//! Backend defaults are duplicated here rather than read from the io-*
//! crates, so the schema compiles under any feature subset, none included.

use std::{collections::HashMap, path::PathBuf};

use anyhow::{Error, Result, anyhow, bail};
use crossterm::style::Color;
use io_sasl::{
    login::SaslLoginCreds, mechanism::Sasl, rfc4505::anonymous::SaslAnonymousCreds,
    rfc4616::plain::SaslPlainCreds, rfc5801::SaslGs2ChannelBinding, rfc5802::SaslScramCreds,
    rfc7628::oauthbearer::SaslOauthbearerCreds, xoauth2::SaslXoauth2Creds,
};
use pimalaya_cli::table::ContentArrangement;
use pimalaya_config::{
    secret::{Secret, SecretResolver},
    toml::{TomlConfig, shell_expanded_path, shell_expanded_string},
};
use pimalaya_stream::{
    proxy::{Proxy, ProxyAuth},
    tls::{Rustls, RustlsCrypto, Tls, TlsProvider},
};
use secrecy::SecretString;
use serde::{Deserialize, Deserializer, Serialize, de::IgnoredAny};
use url::Url;

use crate::backend::Backend;

/// Skips a field equal to its type's default, so a wizard-generated
/// configuration omits defaulted scalars.
fn is_default<T: Default + PartialEq>(value: &T) -> bool {
    *value == T::default()
}

/// Expands a leading tilde and any shell variable in an optional path,
/// as [`shell_expanded_path`] does for a mandatory one.
///
/// TODO: drop this for `pimalaya_config::toml::opt_shell_expanded_path`
/// once pimalaya-config ships an optional variant.
fn opt_shell_expanded_path<'de, D: Deserializer<'de>>(de: D) -> Result<Option<PathBuf>, D::Error> {
    shell_expanded_path(de).map(Some)
}

fn is_default_imap_alpn(alpn: &[String]) -> bool {
    alpn == default_imap_alpn().as_slice()
}

fn is_default_smtp_alpn(alpn: &[String]) -> bool {
    alpn == default_smtp_alpn().as_slice()
}

fn is_default_sieve_alpn(alpn: &[String]) -> bool {
    alpn.is_empty()
}

fn is_default_jmap_alpn(alpn: &[String]) -> bool {
    alpn == default_jmap_alpn().as_slice()
}

// NOTE: these mirror the io-* crates' own `default_alpn()`, kept local so
// the schema depends on no backend crate.
pub(crate) fn default_imap_alpn() -> Vec<String> {
    vec![String::from("imap")]
}

pub(crate) fn default_smtp_alpn() -> Vec<String> {
    vec![String::from("smtp")]
}

pub(crate) fn default_sieve_alpn() -> Vec<String> {
    Vec::new()
}

pub(crate) fn default_jmap_alpn() -> Vec<String> {
    vec![String::from("http/1.1")]
}

fn is_default_gmail_alpn(alpn: &[String]) -> bool {
    alpn == default_gmail_alpn().as_slice()
}

fn is_default_msgraph_alpn(alpn: &[String]) -> bool {
    alpn == default_msgraph_alpn().as_slice()
}

/// The whole TOML configuration file.
///
/// `deny_unknown_fields` is omitted so one file can be shared with
/// himalaya-tui, whose own top-level fields are ignored here.
#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Config {
    /// Fallback for [`AccountConfig::display_name`].
    #[serde(alias = "from-name")]
    pub display_name: Option<String>,
    /// Fallback for [`AccountConfig::signature`].
    pub signature: Option<String>,
    /// Fallback for [`AccountConfig::signature_delim`].
    pub signature_delim: Option<String>,
    /// Directory attachments are downloaded to.
    #[serde(default, deserialize_with = "opt_shell_expanded_path")]
    pub downloads_dir: Option<PathBuf>,
    /// Table rendering quirks shared by every listing.
    #[serde(default)]
    pub table: TableConfig,
    /// `envelope list` rendering options.
    #[serde(default)]
    pub envelope: EnvelopeConfig,
    /// Mailbox aliases and `mailbox list` rendering options.
    #[serde(default)]
    pub mailbox: MailboxConfig,
    /// `attachment list` rendering options.
    #[serde(default)]
    pub attachment: AttachmentConfig,
    /// `account list` rendering options, global only: the listing of
    /// accounts belongs to no account, so nothing overrides it.
    #[serde(default)]
    pub account: AccountListingConfig,
    /// The named `[accounts.<name>]` blocks.
    pub accounts: HashMap<String, AccountConfig>,
}

impl TomlConfig for Config {
    type Account = AccountConfig;

    fn project_name() -> &'static str {
        env!("CARGO_PKG_NAME")
    }

    fn take_named_account(&mut self, name: &str) -> Option<(String, Self::Account)> {
        let (name, mut account) = self.accounts.remove_entry(name)?;
        account.inherit_proxy();
        Some((name, account))
    }

    fn take_default_account(&mut self) -> Option<(String, Self::Account)> {
        let name = self
            .accounts
            .iter()
            .find_map(|(name, account)| account.default.then(|| name.clone()))?;

        self.take_named_account(&name)
    }
}

/// The order a rendered account groups its keys in, most defining first.
///
/// A key outside this list still renders, after the listed ones, so a
/// field added to [`AccountConfig`] can never go missing from a generated
/// document just because nobody updated this table.
const RENDER_ORDER: [&str; 19] = [
    "default",
    "email",
    "display-name",
    "signature",
    "signature-delim",
    "proxy",
    "imap",
    "jmap",
    "gmail",
    "msgraph",
    "maildir",
    "m2dir",
    "pimdir",
    "smtp",
    "sieve",
    "mailbox",
    "envelope",
    "attachment",
    "table",
];

impl AccountConfig {
    /// Hands the account proxy to every network backend naming none of
    /// its own.
    fn inherit_proxy(&mut self) {
        let Some(proxy) = &self.proxy else {
            return;
        };

        let slots = [
            self.imap.as_mut().map(|c| &mut c.proxy),
            self.jmap.as_mut().map(|c| &mut c.proxy),
            self.gmail.as_mut().map(|c| &mut c.proxy),
            self.msgraph.as_mut().map(|c| &mut c.proxy),
            self.smtp.as_mut().map(|c| &mut c.proxy),
            self.sieve.as_mut().map(|c| &mut c.proxy),
        ];

        for slot in slots.into_iter().flatten() {
            slot.get_or_insert_with(|| proxy.clone());
        }
    }

    /// The error of account `name` where nothing matches `backend`, the
    /// caller being able to use `supported` alone.
    ///
    /// Names the v1 `backend` table when present, it being the likely
    /// cause.
    pub fn no_backend_error(&self, name: &str, backend: Backend, supported: &[Backend]) -> Error {
        let reason = match backend {
            Backend::Auto => {
                let supported: Vec<String> = supported.iter().map(|b| format!("`{b}`")).collect();
                let supported = supported.join(", ");
                format!("Account `{name}` configures no supported backend ({supported})")
            }
            backend if !supported.contains(&backend) => {
                format!("Backend `{backend}` is not supported by this command or build")
            }
            backend => format!("Account `{name}` has no `{backend}` block"),
        };

        if self.backend.is_some() {
            anyhow!("{reason}: its v1 `backend` table is ignored since v2, see MIGRATION.md")
        } else {
            anyhow!(reason)
        }
    }

    /// Renders this account as an `[accounts.<name>]` block.
    ///
    /// What this adds over the serializer is reading order: dotted keys
    /// come out alphabetically, burying `imap.server` under the
    /// credentials authenticating against it. Groups are reordered and
    /// each endpoint lifted to the top of its own.
    pub fn render(&self, name: &str) -> Result<String> {
        // NOTE: borrowed rather than built into a `Config`, which would
        // mean cloning the account, and so deriving `Clone` down every
        // backend config, to render it.
        #[derive(Serialize)]
        struct AccountDocument<'a> {
            accounts: HashMap<&'a str, &'a AccountConfig>,
        }

        let document = AccountDocument {
        
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #763** (2026-09-26): **Bump rustls to 0.23.45 and domain to 0.12.3 (RUSTSEC-2026-0285, RUSTSEC-2026-0310)**
  *Symptoms*: v2.1.0 and master lock rustls 0.23.43 and domain 0.12.2, and both have published RustSec advisories:  - [RUSTSEC-2026-0285](https://rustsec.org/advisories/RUSTSEC-2026-0285.html) (rustls, fixed in 0.23.45): TLS 1.3 handshake messages are accepted at the wrong encryption level. rustls is the default TLS stack. - [RUSTSEC-2026-0310](https://rustsec.org/advisories/RUSTSEC-2026-0310.html) (domain, fixed in 0.12.3): crafted DNS messages cause panics and CPU or memory exhaustion. Himalaya reaches it through io-pim-discovery in the wizard.  The fix is lock-only, since pimalaya-stream asks for `rustls ^0.23` and io-pim-discovery for `domain ^0.12`:  ```sh cargo update -p rustls --precise 0.23.45 cargo update -p domain --precise 0.12.3 ```  That moves rustls, domain and domain-macros and nothing else. On eaada0f with the new lock, `cargo check --all-features` is clean, `cargo test --all-features` passes 130 of 130, and an OSV scan of the lock finds no advisory.  The Audit workflow last ran on 8 September, before either advisory was published, so the next push to master fails `cargo-deny check`. The released v2.1.0 binaries keep both versions until a new tag. The ask is a v2.1.1 with this bump; the #747 fix (Bcc disclosed to every recipient) fits the same release.  mirador, cardamum, calendula, ortie and sirup lock the same two versions, and neverest locks rustls 0.23.44, which is affected as well. 
  **Post-Mortem & Fix Analysis**:
  > Nice catch, thanks for the report. I will patch soon.
  > Thanks, looking forward to the release.
  > let me know and I'll close #748 if redundant, thanks! @soywod 

- **Issue #762** (2026-09-30): **feat(imap): fetch whole messages with imap fetch --body**
  *Symptoms*: Downloading a mailbox takes one `message read --raw` per message today: one process, one TLS handshake and one `LOGIN` per message. Yandex (`imap.yandex.ru`) closes the TLS session (`close_notify`) after about sixteen logins in a row, so a first download breaks part way through unless the client sleeps between messages. `imap fetch` already covers a sequence set over one session, but cannot ask for the body; `imap raw` can, but decodes the literal lossily and corrupts 8-bit messages.  ## Change  `imap fetch --body` adds `BODY.PEEK[]` (RFC 3501 §6.4.5) to the requested items:  - **Peek, always.** `\Seen` is left unset: a bulk download reads the mailbox, not the messages. - **Bytes, not text.** The JSON `body` field is the standard Base64 of the octets, since a JSON string cannot hold arbitrary bytes. The plain rendering prints the size only. - **Composes.** `--body --flags` returns both from the same FETCH; `--body` alone does not imply `--envelope`.  `base64` joins the `imap` feature. It was already in the default build through `jmap`, so the dependency graph does not change.  Batching, retries and pacing stay with the caller: the command fetches exactly the sequence set it is given.  Cairn: proposal, delta and tasks under `cairn/changes/imap-fetch-body/`, requirement folded into `cairn/spec/commands.md`, log entry, and CHANGELOG under Unreleased/Added.  ## Testing  - Unit tests: the item list for `--body` alone, with `--flags` and with no flag; a Base64 round trip of non-UTF
  **Post-Mortem & Fix Analysis**:
  > Superseded by 9d7a57db2c7b14f8a83202a65cedc01d9f5cdadf.

- **Issue #761** (2026-09-26): **fix(smtp): do not transmit the Bcc field**
  *Symptoms*: The SMTP transport (`src/smtp/backend.rs::send_message`) derives the RFC 5321 envelope from `To:`, `Cc:` and `Bcc:`, which is correct. It then hands the raw message to `DATA` unchanged, so the `Bcc:` field reaches every recipient and discloses the addresses it exists to hide. RFC 5322 §3.6.3 describes the field as removed before transmission to the other recipients.  This affects every account that sends through SMTP (IMAP, Maildir, m2dir storage), for `message send` and for `compose`, `reply` and `forward` with `--send`.  ## Change  `strip_bcc` runs on the bytes passed to `DATA`, after the envelope is derived. It walks the header section only: - removes every `Bcc` field together with its folded continuation lines; - matches the name case-insensitively, including the obsolete `Bcc :` spelling; - copies the body verbatim from the first empty line.  The `--save` copy is unchanged, so the sender still sees who was blind-copied. Self-sending backends are not touched.  Cairn: `cairn/changes/smtp-strip-bcc/`, *Sending transport* requirement updated in `cairn/spec/backends.md`, log entry, and CHANGELOG under Unreleased/Fixed.  ## Testing  - Unit tests: field removed with the body untouched, folded continuation lines in any case, the obsolete spelling, and a message without `Bcc:` left byte-identical. - Manual test over SMTP (OVH): sent To one address and Bcc another. Both received it, the copy delivered to the blind recipient had no `Bcc:` header, and the `--save Sent` copy kept it
  **Post-Mortem & Fix Analysis**:
  > This is a huge bug, thanks a lot. I just superseded it via https://github.com/pimalaya/io-smtp/commit/3d0644e98c7c4db4e13aec47b11cd75d50ae508c, because I think the fix belonged to the lib rather than Himalaya. I left you as contributor. I will push soon the fix to Himalaya.
  > Pushed on `master`, should be fixed for the next release. Thanks again, much appreciated :pray: 

- **Issue #760** (2026-09-28): **fix(imap): move without the MOVE extension**
  *Symptoms*: `move_messages` always sent `UID MOVE` (RFC 6851). On a server that does not advertise `MOVE`, `message move` fails, and so does `message delete`, which moves to the trash outside it. OVH's hosted Dovecot (`ssl0.ovh.net`) is one such server: after login it advertises `UIDPLUS` but not `MOVE`, and answers `UID MOVE` with `BAD ... command not permitted with UID`.  ## Change  `move_messages` matches on the two capabilities `ImapClient` already caches (`supports_move()` next to `supports_uidplus()`):  - **MOVE**: `UID MOVE`, unchanged. - **no MOVE**: `UID COPY`, then `\Deleted`. When `COPYUID` is present, those *source* UIDs are the ones flagged and, with UIDPLUS, `UID EXPUNGE`d. This is the sequence RFC 6851 §1 describes for servers without the extension, and it reuses the `copy` / `store` / `uid_expunge` calls that `copy_messages` and `delete_messages` already make. The count comes from `COPYUID`, and nothing is flagged or expunged when the copy affected nothing. - **no MOVE, no UIDPLUS**: the same copy and flag; the expunge is skipped and logged at debug. Messages stay flagged in the source (recoverable). A plain `EXPUNGE` is never issued, so unrelated `\Deleted` messages are not touched.  The fallback is not atomic: between COPY and EXPUNGE another client can see the message in both mailboxes. That is why MOVE stays the first choice.  Addresses the CHANGES_REQUESTED review: no `MoveStrategy` enum, UIDs parsed once, no refusal without UIDPLUS, expunge `COPYUID` source UIDs, do
  **Post-Mortem & Fix Analysis**:
  > Addressed your review on `0114cac` (rebased onto current `master`; PR is mergeable again):  - Dropped `MoveStrategy` — `move_messages` now matches `(supports_move(), supports_uidplus())` directly; the three strategy-only unit tests are gone. - `parse_uids(ids)?` runs once; the `SequenceSet` is cloned where callers take it by value. - Without UIDPLUS: `UID COPY`, flag `\Deleted`, skip expunge and `debug!` (same recoverable path as `delete_messages`); no plain `EXPUNGE`. - When `COPYUID` is present, flag/expunge those *source* UIDs, not the requested set. Docs/CHANGELOG/cairn updated for the no-UIDPLUS behaviour.  Focused `imap::backend` tests and the full `imap,smtp,rustls-ring` suite pass locally (96). Ready for re-review when you have a moment — thanks again.

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

### Incident Patch 1: `6da6ad6c` (2026-09-30)
**Commit Message**: fix(imap): accept append without recovered UID

Closes #759.

Co-authored-by: Liyuan Shang <77632240+Shangliyuan@users.noreply.github.com>

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

---

### Incident Patch 2: `76884c1d` (2026-09-29)
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

---

### Incident Patch 3: `ec59a66c` (2026-09-28)
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

---

### Incident Patch 4: `eef95716` (2026-09-28)
**Commit Message**: fix(imap): move without the MOVE extension

* fix(imap): move without the MOVE extension

`move_messages` sent `UID MOVE` unconditionally. On a server that does not
advertise RFC 6851 MOVE, `message move` failed, and so did `message
delete`, which moves to the trash. OVH's hosted Dovecot is one such server:
it advertises UIDPLUS but not MOVE, and answers
`BAD ... command not permitted with UID`.

The strategy now follows the cached capabilities:
- with MOVE, `UID MOVE`;
- with only UIDPLUS, `UID COPY` then `\Deleted` and `UID EXPUNGE` of the
  same UIDs, which is the sequence RFC 6851 describes for such servers;
- with neither, a refusal, since a plain EXPUNGE would also remove
  unrelated `\Deleted` messages.

Checked against OVH: 49 messages moved across three mailboxes with the
counts matching, and a delete through the trash left no residue.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* fix(imap): address MOVE fallback review

Drop MoveStrategy and match the two capability booleans in
move_messages. Parse the UID set once. Without UIDPLUS, copy and flag
then skip expunge, matching delete_messages. When COPYUID is present,
flag and expunge its source UI

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -105,6 +105,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
   The client-side search evaluation the backend calls was gated on the `maildir` and `m2dir` features alone, so `--no-default-features --features pimdir` did not build. The default feature set was unaffected.
 
+- `message move` and `message delete` now work on IMAP servers without the MOVE extension.
+
+  Moving always sent `UID MOVE` (RFC 6851), which servers that do not advertise MOVE reject, OVH's hosted Dovecot among them. Deleting failed with it, since outside the trash it moves to the trash.
+
+  Without MOVE, the move is now the sequence RFC 6851 describes for such servers: `UID COPY`, then `\Deleted` and, when UIDPLUS (RFC 4315) is advertised, a `UID EXPUNGE` of the source UIDs `COPYUID` reported. Without UIDPLUS the messages stay flagged `\Deleted` in the source, as `message delete` already does in the trash, so they stay recoverable and unrelated `\Deleted` messages are never touched.
+
 - Preserved message MIME payloads in `gmail threads get --json`, including full-format bodies and attachment metadata ([#750](https://github.com/pimalaya/himalaya/issues/750)).
 
 - Fixed a duplicated message disappearing from the `pimdir` backend's listing.
```

**File**: `cairn/changes/imap-move-without-move/delta.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+cairn: delta
+change: imap-move-without-move
+---
+
+# Delta
+
+## ADDED Requirements
+
+### Requirement: IMAP move without the MOVE extension
+The IMAP adapter's `move_messages` SHALL use `UID MOVE` (RFC 6851) when the server advertises `MOVE`. Otherwise it SHALL `UID COPY` the set to the target, then flag `\Deleted` in the source. When the copy returns `COPYUID`, those source UIDs SHALL be the ones flagged and, when the server advertises `UIDPLUS` (RFC 4315), `UID EXPUNGE`d. Without `UIDPLUS` it SHALL skip the expunge, leave the messages flagged in the source, and log that at debug. Nothing is flagged or expunged when the copy affected nothing. A plain `EXPUNGE` SHALL NOT be issued, so unrelated `\Deleted` messages stay.
```

**File**: `cairn/changes/imap-move-without-move/proposal.md` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+---
+cairn: change
+id: imap-move-without-move
+status: landed
+created: 2026-09-24
+---
+
+# Move and delete on IMAP servers without MOVE
+
+## Why
+
+The IMAP adapter's `move_messages` always sends `UID MOVE`, which is RFC 6851 and only exists on servers that advertise `MOVE`. On a server that does not, the command is rejected (Dovecot answers `BAD ... command not permitted with UID`), so `message move` fails. `message delete` fails with it: outside the trash it moves to the trash.
+
+Such servers are still common in hosted mail. OVH's shared hosting (Dovecot, `ssl0.ovh.net`) is one: after authentication it advertises `UIDPLUS` but not `MOVE`. Moving and deleting mail are not optional there, and the only way to reach them is currently to leave Himalaya.
+
+## What
+
+`move_messages` matches on the two capabilities the session already caches:
+
+- **`MOVE`**: `UID MOVE`, unchanged.
+- **no `MOVE`**: the sequence RFC 6851 §1 describes as what clients do without the extension. It runs `UID COPY` to the target, then flags `\Deleted` in the source. When the copy returns `COPYUID`, those source UIDs are the ones flagged and, when the server advertises `UIDPLUS` (RFC 4315), `UID EXPUNGE`d. `delete_messages` already uses the same `\Deleted` plus `UID EXPUNGE` pair on the trash. The returned count comes from `COPYUID`, as it does for a copy. Nothing is flagged or expunged when the copy affected nothing.
+- **no `MOVE`, no `UIDPLUS`**: the same copy and flag, then the expunge is skipped and logged at debug. The messages stay flagged in the source, which is recoverable and never touches unrelated `\Deleted` messages. A plain `EXPUNGE` is not issued.
+
+This is not emulating an operation the backend cannot model: copy, flag and expunge are how IMAP expresses a move without the extension, and the adapter already owns all three. `ImapClient` gains `supports_move()` next to `supports_uidplus()`.
+
+## What this is not
+
+It does not make the fallback atomic. Between the copy and the expunge, a concurrent client sees the message in both mailboxes, which is what RFC 6851 exists to avoid and why `MOVE` stays the first choice.
```

**File**: `cairn/changes/imap-move-without-move/tasks.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+cairn: tasks
+change: imap-move-without-move
+---
+
+# Tasks
+
+- [x] src/imap/client.rs: `supports_move()`, alongside `supports_uidplus()`.
+- [x] src/imap/backend.rs: `move_messages` matches on `supports_move()` and `supports_uidplus()`; `UID MOVE`, or `UID COPY` + `\Deleted` + `UID EXPUNGE` of the `COPYUID` source UIDs, or the same copy and flag with the expunge skipped when UIDPLUS is missing.
+- [x] Parse the requested UIDs once and clone the set where needed.
+- [x] Manual check against a server without MOVE (OVH Dovecot): `message move` and `message delete` succeed, and no other `\Deleted` message in the source is expunged.
+- [x] CHANGELOG entry.
+- [x] Fold the delta into [cairn/spec/backends.md](../../spec/backends.md); write the log entry.
```

**File**: `cairn/log/2026-09-24-imap-move-without-move.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+---
+cairn: log
+date: 2026-09-24
+change: imap-move-without-move
+---
+
+# Move and delete on IMAP servers without MOVE
+
+`move_messages` sent `UID MOVE` unconditionally, so on a server that does not advertise RFC 6851 MOVE both `message move` and `message delete` (which moves to the trash) failed. OVH's hosted Dovecot is one such server: it advertises `UIDPLUS` but not `MOVE`, and answers `UID MOVE` with `BAD ... command not permitted with UID`.
+
+## What landed
+
+**The path follows the two capabilities the session already caches.** `ImapClient::supports_move()` joins `supports_uidplus()`, and `move_messages` matches on the pair: `UID MOVE` with MOVE; otherwise `UID COPY`, `\Deleted` and, when UIDPLUS is advertised, `UID EXPUNGE` of the source UIDs `COPYUID` reported. Without UIDPLUS the expunge is skipped and logged at debug: the messages stay flagged in the source, which is recoverable and never touches unrelated `\Deleted` messages.
+
+**The fallback reuses what the adapter already had.** `copy`, `store` and `uid_expunge` are the calls `copy_messages` and `delete_messages` make; the count comes from `COPYUID` as for a copy, and nothing is flagged or expunged when the copy affected nothing.
+
+**Checked against OVH:** 49 messages moved across three mailboxes with the target count matching, and `message delete` taking a message to the trash and out of it with the trash count back where it started.
+
+## Capabilities moved
+
+- [backends](../spec/backends.md): added *IMAP move without the MOVE extension*.
```

---

### Incident Patch 5: `79d5cd58` (2026-09-28)
**Commit Message**: fix: strip surrounding quotes from quoted search patterns

The `quoted_pattern` parser used `.to_slice()`, which returned the raw
input including the enclosing double-quote characters. A search like
`from "alice smith"` stored the pattern as `"alice smith"` (with
literal quote chars), so every backend — client-side eval, IMAP
SEARCH, JMAP filter, Gmail query — looked for the double-quote
characters in the address, which never matched.

Switch to `.ignore_then()` / `.then_ignore()` / `.collect()` so the
quotes are consumed as delimiters and the inner characters, with
escape sequences already processed, are collected into the pattern
string.

Refs: #768

**File**: `src/email/search/filter/parser.rs` (modified, +15/-9)
```diff
@@ -209,16 +209,15 @@ fn quoted_pattern<'a>() -> impl Parser<'a, &'a str, String, ParserError<'a>> + C
     let escapable_chars = ['\\', '"'];
 
     dquote()
-        .then(
+        .ignore_then(
             choice((
                 bslash().ignore_then(one_of(escapable_chars)),
                 none_of(escapable_chars),
             ))
-            .repeated(),
+            .repeated()
+            .collect(),
         )
-        .then(dquote())
-        .to_slice()
-        .map(String::from)
+        .then_ignore(dquote())
 }
 
 fn unquoted_pattern<'a>() -> impl Parser<'a, &'a str, String, ParserError<'a>> + Clone {
@@ -276,14 +275,21 @@ mod tests {
 
         assert_eq!(
             super::quoted_pattern().parse("\"\"").into_result(),
-            Ok("\"\"".into())
+            Ok("".into())
         );
 
         assert_eq!(
             super::quoted_pattern()
                 .parse("\"quoted pattern\"")
                 .into_result(),
-            Ok("\"quoted pattern\"".into()),
+            Ok("quoted pattern".into()),
+        );
+
+        assert_eq!(
+            super::quoted_pattern()
+                .parse("\"escaped \\\" quote\"")
+                .into_result(),
+            Ok("escaped \" quote".into()),
         );
     }
 
@@ -304,7 +310,7 @@ mod tests {
 
         assert_eq!(
             super::from().parse("from \"quoted val\"").into_result(),
-            Ok(From("\"quoted val\"".into())),
+            Ok(From("quoted val".into())),
         );
     }
 
@@ -371,7 +377,7 @@ mod tests {
                 Box::new(From("f".into())),
                 Box::new(Or(
                     Box::new(To("t".into())),
-                    Box::new(Subject("\"s with parens )\"".into()))
+                    Box::new(Subject("s with parens )".into()))
                 )),
             )),
         );
```

---

### Incident Patch 6: `94baf003` (2026-09-28)
**Commit Message**: fix(gmail): retain thread MIME payloads in JSON

Refs: #751

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -41,6 +41,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - Changed Gmail draft create/update JSON output to structured draft, message and thread IDs, with schemas for both commands. Text confirmations are unchanged.
 
+- Changed the default `--format` of `gmail messages get`, `gmail drafts get` and `gmail threads get` from `full` to `metadata`.
+
+  None of them prints more than `metadata` returns (id, labels, snippet, headers), so their output is unchanged, and Gmail no longer sends bodies that were thrown away. Pass `--format full` to get a thread's MIME payloads.
+
 - Forwarded `vendored` to io-pimdir, which now links the system SQLite by default: a build carrying `--features pimdir` needs sqlite3 on the machine, or `vendored` alongside it to build one from source.
 
 - **BREAKING**: a `pimdir` store written before io-pimdir 0.4 is refused, and Himalaya reads the store's typed summaries.
@@ -101,6 +105,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
   The client-side search evaluation the backend calls was gated on the `maildir` and `m2dir` features alone, so `--no-default-features --features pimdir` did not build. The default feature set was unaffected.
 
+- Preserved message MIME payloads in `gmail threads get --json`, including full-format bodies and attachment metadata ([#750](https://github.com/pimalaya/himalaya/issues/750)).
+
 - Fixed a duplicated message disappearing from the `pimdir` backend's listing.
 
   A mailbox holding one `Message-ID` twice, which a double delivery, a retried append, a restore or a copy of a sent message all produce, used to resolve to a single stored item. One copy was kept and the other recorded on it, mirrored nowhere, so it showed in no listing and could not be read.
```

**File**: `cairn/log/2026-09-16-gmail-thread-payload.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+---
+cairn: log
+change: gmail-thread-payload
+landed: 2026-09-16
+---
+
+# Gmail thread payload
+
+Fixed #750: thread JSON now retains the optional MIME payload already fetched from Gmail. Full-format reads expose nested bodies and attachment metadata; minimal reads omit the absent payload. Summary header selection and text rendering retain their existing behavior. The generated schema includes the optional recursive payload.
+
+This corrects the thread renderer's omission without changing io-gmail. Gmail's thread endpoint has no raw format, so preserving the parsed payload makes full thread bodies available without fetching each message separately.
+
+The shared `--format` default moves from `full` to `metadata`, which carries everything `messages get`, `drafts get` and `threads get` print, so a plain `threads get --json` no longer emits every body in the thread.
+
+Spec updated: commands (MODIFIED: Data commands serialize their data, carving out the `gmail threads get` payload).
```

**File**: `cairn/spec/commands.md` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ Data and errors SHALL go to stdout through the printer; `--json` switches every
 The `completion`, `manual` and `json-schema` commands SHALL share one shape: a positional list selecting what to generate, defaulting to everything, and an optional `--dir` deciding where it lands. Without a directory they SHALL print the single selected item to the standard output, so a packaging helper can capture it and a shell can redirect it to a file, and SHALL fail when several items are selected rather than concatenating pieces valid for nothing. With a directory they SHALL write one file per selected item in it, creating the directory when missing, and report where each landed.
 
 ### Requirement: Data commands serialize their data
-A command returning data SHALL hand the printer a dedicated output type implementing both `Display` and `Serialize`, and register its JSON Schema under the command's invocation key. `Message` is reserved for confirmations, since it serializes as a single `message` string and leaves `--json` unparseable. Where a sibling `list` already serializes a backend resource, the `get` output SHALL emit that resource verbatim through a transparent newtype, so one item read with `get` has the shape of one row of `list`. Where the wire type is unsuitable (a recursive MIME tree, a type carrying no schema), the output type SHALL name its fields instead.
+A command returning data SHALL hand the printer a dedicated output type implementing both `Display` and `Serialize`, and register its JSON Schema under the command's invocation key. `Message` is reserved for confirmations, since it serializes as a single `message` string and leaves `--json` unparseable. Where a sibling `list` already serializes a backend resource, the `get` output SHALL emit that resource verbatim through a transparent newtype, so one item read with `get` has the shape of one row of `list`. Where the wire type is unsuitable (a recursive MIME tree, a type carrying no schema), the output type SHALL name its fields instead. `gmail threads get` is the exception for the MIME tree: `users.threads.get` has no raw format, so each message's `payload` SHALL be serialized when the requested format carries one.
 
 ### Requirement: Serialized collections are always present
 An output field holding a collection SHALL be serialized even when empty, because the schema marks it required regardless and a skipped field would contradict the published schema.
```

**File**: `src/gmail/format.rs` (modified, +4/-1)
```diff
@@ -10,17 +10,20 @@ use clap::ValueEnum;
 use io_gmail::v1::rest::messages::GmailMessageFormat;
 
 /// Amount of Gmail message detail to return (`format` query parameter).
+///
+/// Defaults to `metadata`, which carries everything the commands print
+/// without fetching bodies. Ask for `full` to get the MIME payload.
 #[derive(Clone, Copy, Debug, Default, ValueEnum)]
 #[clap(rename_all = "kebab-case")]
 pub enum FormatArg {
     /// Identifiers and labels only, without headers or body.
     Minimal,
     /// The parsed payload: headers, MIME structure and bodies.
-    #[default]
     Full,
     /// The whole message as raw RFC 5322 bytes.
     Raw,
     /// Headers only, narrowed down by the `--header` option.
+    #[default]
     Metadata,
 }
 
```

**File**: `src/gmail/threads/get.rs` (modified, +25/-7)
```diff
@@ -6,7 +6,10 @@ use std::fmt;
 
 use anyhow::Result;
 use clap::Parser;
-use io_gmail::v1::rest::{messages::GmailMessageFormat, threads::get::GmailThreadGet};
+use io_gmail::v1::rest::{
+    messages::{GmailMessage, GmailMessageFormat, GmailMessagePayload},
+    threads::get::GmailThreadGet,
+};
 use pimalaya_cli::printer::Printer;
 use schemars::JsonSchema;
 use serde::Serialize;
@@ -19,6 +22,12 @@ use crate::gmail::{
 
 /// Get a single Gmail thread with all its messages
 /// (users.threads.get).
+///
+/// JSON includes each message's MIME payload when Gmail supplies one,
+/// including bodies and attachment metadata under `--format full`.
+/// `--header` filters the summary headers, not the retained MIME payload.
+/// Keys inside `payload` keep Gmail's camelCase, unlike their kebab-case
+/// siblings, until v3 aligns them.
 #[derive(Debug, Parser)]
 pub struct GmailThreadGetCommand {
     /// The id of the thread to get.
@@ -51,12 +60,7 @@ impl GmailThreadGetCommand {
         let messages = thread
             .messages
             .into_iter()
-            .map(|message| GmailThreadMessageOutput {
-                id: message.id,
-                label_ids: message.label_ids,
-                snippet: message.snippet,
-                headers: message_headers(message.payload, &hs),
-            })
+            .map(|message| GmailThreadMessageOutput::from_message(message, &hs))
             .collect();
 
         printer.out(GmailThreadGetOutput {
@@ -105,4 +109,18 @@ pub(crate) struct GmailThreadMessageOutput {
     #[serde(skip_serializing_if = "Option::is_none")]
     snippet: Option<String>,
     headers: Vec<GmailMessageHeaderOutput>,
+    #[serde(skip_serializing_if = "Option::is_none")]
+    payload: Option<GmailMessagePayload>,
+}
+
+impl GmailThreadMessageOutput {
+    fn from_message(message: GmailMessage, headers: &[&str]) -> Self {
+        Self {
+            id: message.id,
+            label_ids: message.label_ids,
+            snippet: message.snippet,
+            headers: message_headers(message.payload.clone(), headers),
+            payload: message.payload,
+        }
+    }
 }
```

---

### Incident Patch 7: `2220706b` (2026-09-27)
**Commit Message**: fix(gmail): retain added-message details in history output

Refs: #753

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -9,6 +9,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
+- Added `messages-added-details` to `gmail history list --json`, preserving each arrival's message id, optional thread id and supplied label ids alongside the existing message-id arrays.
+
 - A pimdir write now shows on the next read instead of on the next sync.
 
   A pimdir store is a replica the sync engine owns, so Himalaya appends its writes to the store's queue rather than apply them. A read used to project the committed index alone, so flagging a message lost the flag from the listing until Neverest ran.
```

**File**: `cairn/log/2026-09-16-gmail-history-message-details.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+cairn: log
+change: gmail-history-message-details
+landed: 2026-09-16
+---
+
+# Retain added-message details in Gmail history
+
+Added `messages-added-details` to the JSON history listing so incremental consumers retain Gmail's supplied thread ids and labels without extra message fetches. Kept the existing id arrays and text output. Missing labels stay empty and absent thread ids stay null; the CLI does not infer either from other history changes.
+
+Updated the commands capability with Gmail history retains added-message details. This is the additive output fix in issue #752.
```

**File**: `cairn/spec/commands.md` (modified, +3/-0)
```diff
@@ -62,3 +62,6 @@ A command taking a raw RFC 5322 message SHALL resolve it through the shared `Mes
 
 ### Requirement: Gmail draft writes return identities
 `gmail drafts create` and `gmail drafts update` SHALL serialize the returned draft `id`, and nullable `message-id` and `thread-id`, under `--json`, with schemas registered for both commands. Non-JSON output SHALL retain the existing success sentence. A response without a message SHALL still succeed, with `message-id` and `thread-id` null, since the draft was already written.
+
+### Requirement: Gmail history retains added-message details
+`gmail history list --json` SHALL retain each added message's `id`, nullable `thread-id`, and supplied `label-ids` in a `messages-added-details` array, preserving order and duplicate entries. Missing labels SHALL produce an empty array. The existing `messages-added` id array, other change arrays, pagination, and text counts SHALL remain unchanged. The registered JSON Schema SHALL describe the details array, which SHALL remain present when empty.
```

**File**: `src/gmail/history/list.rs` (modified, +40/-10)
```diff
@@ -7,7 +7,7 @@ use std::fmt;
 use anyhow::Result;
 use clap::{Parser, ValueEnum};
 use io_gmail::v1::rest::history::{
-    GmailHistoryLabel, GmailHistoryMessage, GmailHistoryType,
+    GmailHistory, GmailHistoryLabel, GmailHistoryMessage, GmailHistoryType,
     list::{GmailHistoryList, GmailHistoryListParams},
 };
 use pimalaya_cli::printer::Printer;
@@ -17,6 +17,11 @@ use serde::Serialize;
 use crate::{gmail::client::GmailClient, shared::output::Paginated};
 
 /// List the changes applied to the mailbox since a given history id.
+///
+/// JSON includes `history-id`, `history`, and an optional `next_page` cursor.
+/// Each record retains its message-id arrays and adds `messages-added-details`
+/// with each arrival's `id`, nullable `thread-id`, and `label-ids` supplied by
+/// Gmail. Missing labels become an empty array; text output shows counts.
 #[derive(Debug, Parser)]
 pub struct GmailHistoryListCommand {
     /// History id to start listing changes from.
@@ -59,13 +64,7 @@ impl GmailHistoryListCommand {
         let history = resp
             .history
             .into_iter()
-            .map(|record| GmailHistoryRecordOutput {
-                id: record.id,
-                messages_added: message_ids(record.messages_added),
-                messages_deleted: message_ids(record.messages_deleted),
-                labels_added: label_changes(record.labels_added),
-                labels_removed: label_changes(record.labels_removed),
-            })
+            .map(GmailHistoryRecordOutput::from)
             .collect();
 
         let output = GmailHistoryListOutput {
@@ -104,8 +103,8 @@ impl From<HistoryTypeArg> for GmailHistoryType {
 
 /// The `gmail history list` output, one summary line per record.
 ///
-/// The JSON carries the affected message ids where the text shows counts,
-/// driving an incremental sync being what a history listing is for.
+/// JSON carries affected message ids and added-message details; text shows
+/// counts for incremental sync summaries.
 #[derive(Serialize, JsonSchema)]
 #[serde(rename_all = "kebab-case")]
 pub(crate) struct GmailHistoryListOutput {
@@ -145,11 +144,42 @@ impl fmt::Display for GmailHistoryListOutput {
 pub(crate) struct GmailHistoryRecordOutput {
     id: String,
     messages_added: Vec<String>,
+    messages_added_details: Vec<GmailHistoryMessageOutput>,
     messages_deleted: Vec<String>,
     labels_added: Vec<GmailHistoryLabelOutput>,
     labels_removed: Vec<GmailHistoryLabelOutput>,
 }
 
+impl From<GmailHistory> for GmailHistoryRecordOutput {
+    fn from(record: GmailHistory) -> Self {
+        Self {
+            id: record.id,
+            messages_added_details: record
+                .messages_added
+                .iter()
+                .map(|entry| GmailHistoryMessageOutput {
+                    id: entry.message.id.clone(),
+                    thread_id: entry.message.thread_id.clone(),
+                    label_ids: entry.message.label_ids.clone(),
+                })
+                .collect(),
+            messages_added: message_ids(record.messages_added),
+            messages_deleted: message_ids(record.messages_deleted),
+            labels_added: label_changes(record.labels_added),
+            labels_removed: label_changes(record.labels_removed),
+        }
+    }
+}
+
+/// Identity and labels supplied by Gmail for an added message.
+#[derive(Serialize, JsonSchema)]
+#[serde(rename_all = "kebab-case")]
+pub(crate) struct GmailHistoryMessageOutput {
+    id: String,
+    thread_id: Option<String>,
+    label_ids: Vec<String>,
+}
+
 /// Labels added to or removed from one message in a history record.
 #[derive(Serialize, JsonSchema)]
 #[serde(rename_all = "kebab-case")]
```

---

### Incident Patch 8: `e6fe2546` (2026-09-27)
**Commit Message**: fix(gmail): return structured draft write identities

* fix(gmail): return structured draft write identities

Expose the draft, message and thread IDs for JSON consumers while retaining text confirmations. Register both schemas and test serialization, text output and schema shape.

* fix(gmail): address review on draft write output

Move GmailDraftWriteOutput into the drafts parent module, make
message-id optional so a message-less response still succeeds after
the write, and drop the serde/schemars shape tests.

* fix(gmail): correct draft write JSON output doc comment

---------

Co-authored-by: Clément DOUIN <soywod@users.noreply.github.com>
Refs: #757

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -37,6 +37,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
+- Changed Gmail draft create/update JSON output to structured draft, message and thread IDs, with schemas for both commands. Text confirmations are unchanged.
+
 - Forwarded `vendored` to io-pimdir, which now links the system SQLite by default: a build carrying `--features pimdir` needs sqlite3 on the machine, or `vendored` alongside it to build one from source.
 
 - **BREAKING**: a `pimdir` store written before io-pimdir 0.4 is refused, and Himalaya reads the store's typed summaries.
```

**File**: `cairn/log/2026-09-19-gmail-draft-write-identities.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+cairn: log
+change: gmail-draft-write-identities
+landed: 2026-09-19
+---
+
+# Gmail draft write identities
+
+Gmail draft create and update now return structured identities under `--json` instead of a confirmation wrapper, fixing #756. The shared output type retains the text confirmation and registers both command schemas. No request or draft lifecycle behavior changes.
+
+Spec updated: commands (ADDED: Gmail draft writes return identities).
```

**File**: `cairn/spec/commands.md` (modified, +3/-0)
```diff
@@ -59,3 +59,6 @@ The same composers SHALL end the body with the account's `signature`, introduced
 
 ### Requirement: Raw message input is shared
 A command taking a raw RFC 5322 message SHALL resolve it through the shared `MessageArg`: a file path, an inline value after `--`, or piped stdin. The resolved message is normalised to CRLF and rejected when empty, so no backend receives a zero-length message.
+
+### Requirement: Gmail draft writes return identities
+`gmail drafts create` and `gmail drafts update` SHALL serialize the returned draft `id`, and nullable `message-id` and `thread-id`, under `--json`, with schemas registered for both commands. Non-JSON output SHALL retain the existing success sentence. A response without a message SHALL still succeed, with `message-id` and `thread-id` null, since the draft was already written.
```

**File**: `src/gmail/drafts.rs` (modified, +25/-0)
```diff
@@ -9,9 +9,13 @@ pub mod list;
 pub mod send;
 pub mod update;
 
+use core::fmt;
+
 use anyhow::Result;
 use clap::Subcommand;
 use pimalaya_cli::printer::Printer;
+use schemars::JsonSchema;
+use serde::Serialize;
 
 use crate::{
     account::context::Account,
@@ -56,3 +60,24 @@ impl GmailDraftsCommand {
         }
     }
 }
+
+/// Identity of a created or replaced Gmail draft.
+#[derive(Serialize, JsonSchema)]
+#[serde(rename_all = "kebab-case")]
+pub(crate) struct GmailDraftWriteOutput {
+    /// The immutable draft id.
+    pub(crate) id: String,
+    /// The id of the message currently stored in the draft, when present.
+    pub(crate) message_id: Option<String>,
+    /// The thread id returned by Gmail, when present.
+    pub(crate) thread_id: Option<String>,
+    /// The verb used only in the text confirmation.
+    #[serde(skip)]
+    pub(crate) action: &'static str,
+}
+
+impl fmt::Display for GmailDraftWriteOutput {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        write!(f, "Gmail draft `{}` successfully {}", self.id, self.action)
+    }
+}
```

**File**: `src/gmail/drafts/create.rs` (modified, +17/-6)
```diff
@@ -8,11 +8,16 @@ use io_gmail::v1::rest::{
     drafts::{GmailDraft, create::GmailDraftCreate},
     messages::{GmailMessage, encode_raw},
 };
-use pimalaya_cli::printer::{Message, Printer};
+use pimalaya_cli::printer::Printer;
 
-use crate::{gmail::client::GmailClient, shared::message::arg::MessageArg};
+use crate::{
+    gmail::{client::GmailClient, drafts::GmailDraftWriteOutput},
+    shared::message::arg::MessageArg,
+};
 
 /// Create a Gmail draft (users.drafts.create).
+///
+/// JSON output contains `id`, and nullable `message-id` and `thread-id`.
 #[derive(Debug, Parser)]
 pub struct GmailDraftCreateCommand {
     /// Thread id to attach the draft to.
@@ -42,9 +47,15 @@ impl GmailDraftCreateCommand {
         }
         .response;
 
-        printer.out(Message::new(format!(
-            "Gmail draft `{}` successfully created",
-            draft.id
-        )))
+        let (message_id, thread_id) = match draft.message {
+            Some(message) => (Some(message.id), message.thread_id),
+            None => (None, None),
+        };
+        printer.out(GmailDraftWriteOutput {
+            id: draft.id,
+            message_id,
+            thread_id,
+            action: "created",
+        })
     }
 }
```

---

### Incident Patch 9: `594459f1` (2026-09-26)
**Commit Message**: docs(readme): fix wrong flag add command

Refs: #755

**File**: `README.md` (modified, +1/-1)
```diff
@@ -331,7 +331,7 @@ Backend-agnostic commands run on the account's first configured backend, or the
 himalaya mailbox list
 himalaya envelope list --page 2
 himalaya envelope search from alice and after 2026-01-01 order by date desc
-himalaya flag add --flag seen 1:3,5
+himalaya flag add --flag seen 1 2 3 5
 himalaya message read 42
 himalaya message copy --from INBOX --to Archives 42
 himalaya attachment download 42
```

---

### Incident Patch 10: `12e17b51` (2026-09-26)
**Commit Message**: fix: remove value delimiter for message composition

**File**: `CHANGELOG.md` (modified, +1/-3)
```diff
@@ -75,9 +75,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
-- Fixed `--to`, `--cc` and `--bcc` carrying a display name composing a `To: <Alice <alice@example.org>>` no SMTP server accepts, as `--from` did before ([#727]).
-
-  `message compose`, `reply` and `forward` handed each recipient to the MIME builder as a bare address. They are now parsed as mailboxes like the sender, the name reaching the builder apart from the address.
+- Fixed `--to`, `--cc` and `--bcc` carrying a display name composing a `To: <Alice <alice@example.org>>` no SMTP server accepts, as `--from` did before ([#727]). Each value is now parsed as an address list, so a comma inside a quoted display name (`"Doe, Alice" <alice@example.org>`) no longer splits it.
 
 - Fixed `imap raw` hanging until the stream timed out when the last command was not terminated by an explicit `\r\n` ([#764]).
 
```

**File**: `cairn/log/2026-09-26-compose-recipient-address-list.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+cairn: log
+change: compose-recipient-address-list
+landed: 2026-09-26
+---
+
+# Recipient flags take address lists
+
+Follow-up to compose-recipient-display-name. `--to`, `--cc` and `--bcc` of `message compose`, `reply` and `forward` were split on commas by the CLI before parsing, so `"Doe, Alice" <alice@example.org>` reached the parser in two broken halves. The flags no longer split values themselves: each value is parsed as an RFC 5322 address list and every mailbox it carries is kept, so both repeating the flag and `a@x, b@y` still work.
+
+Spec unchanged.
```

**File**: `src/shared/message/builder.rs` (modified, +75/-45)
```diff
@@ -12,7 +12,7 @@ use std::{
     path::{Path, PathBuf},
 };
 
-use anyhow::{Result, anyhow};
+use anyhow::{Result, anyhow, bail};
 use clap::ValueEnum;
 use mail_builder::{
     MessageBuilder,
@@ -91,7 +91,7 @@ pub fn build(args: BuilderArgs<'_>, source: Option<SourceArgs<'_>>) -> Result<Ve
     let mut builder = MessageBuilder::new();
 
     if let Some(from) = args.from {
-        let (parsed_name, address) = parse_mailbox(from)?;
+        let (parsed_name, address) = parse_mailboxes(from)?.remove(0);
         let name = args.from_name.map(str::to_owned).or(parsed_name);
         builder = builder.from(Address::new_address(name, address));
     }
@@ -185,13 +185,14 @@ pub fn build(args: BuilderArgs<'_>, source: Option<SourceArgs<'_>>) -> Result<Ve
         .map_err(|err| anyhow!("serialize composed message: {err}"))
 }
 
-/// Splits a mailbox into its display name, when it carries one, and its
-/// address.
+/// Splits an address list into its mailboxes, each with its display
+/// name, when it carries one, and its address.
 ///
 /// Handing mail-builder the whole `Alice <alice@example.org>` as an
-/// address would emit a `From: <Alice <alice@example.org>>` no SMTP
-/// server accepts.
-fn parse_mailbox(value: &str) -> Result<(Option<String>, String)> {
+/// address would emit a `To: <Alice <alice@example.org>>` no SMTP
+/// server accepts. A comma inside a quoted display name does not split
+/// the list. The returned list is never empty.
+fn parse_mailboxes(value: &str) -> Result<Vec<(Option<String>, String)>> {
     use mail_parser::Address as ParserAddress;
 
     // NOTE: the header parser flushes its last token on the
@@ -200,36 +201,44 @@ fn parse_mailbox(value: &str) -> Result<(Option<String>, String)> {
     let header = format!("{value}\n");
     let parsed = MessageStream::new(header.as_bytes()).parse_address();
 
-    let mailbox = match &parsed {
-        HeaderValue::Address(ParserAddress::List(list)) => list.first(),
-        HeaderValue::Address(ParserAddress::Group(groups)) => {
-            groups.first().and_then(|group| group.addresses.first())
-        }
-        _ => None,
+    let mailboxes: Vec<_> = match &parsed {
+        HeaderValue::Address(ParserAddress::List(list)) => list.iter().collect(),
+        HeaderValue::Address(ParserAddress::Group(groups)) => groups
+            .iter()
+            .flat_map(|group| group.addresses.iter())
+            .collect(),
+        _ => Vec::new(),
+    };
+
+    if mailboxes.is_empty() {
+        bail!("Could not parse address `{value}`");
     }
-    .ok_or_else(|| anyhow!("Could not parse address `{value}`"))?;
 
-    let address = mailbox
-        .address
-        .as_ref()
-        .ok_or_else(|| anyhow!("Address `{value}` has no email"))?
-        .to_string();
-    let name = mailbox.name.as_ref().map(|name| name.to_string());
+    mailboxes
+        .into_iter()
+        .map(|mailbox| {
+            let address = mailbox
+                .address
+                .as_ref()
+                .ok_or_else(|| anyhow!("Address `{value}` has no email"))?
+                .to_string();
+            let name = mailbox.name.as_ref().map(|name| name.to_string());
 
-    Ok((name, address))
+            Ok((name, address))
+        })
+        .collect()
 }
 
-/// Builds an address list, splitting any display name apart so
-/// `mail_builder` encodes it rather than stuffing it inside the angle
-/// brackets.
+/// Builds one address list out of every mailbox the values carry.
 fn addresses(values: &[String]) -> Result<Address<'static>> {
-    let list: Vec<Address<'static>> = values
-        .iter()
-        .map(|s| {
-            let (name, address) = parse_mailbox(s)?;
-            Ok(Address::new_address(name, address))
-        })
-        .collect::<Result<_>>()?;
+    let mut list = Vec::new();
+
+    for value in values {
+        for (name, address) in parse_mailboxes(value)? {
+            list.push(Address::new_address(name, address));
+        }
+ 
```

**File**: `src/shared/message/compose.rs` (modified, +3/-3)
```diff
@@ -35,13 +35,13 @@ pub struct MessageComposeCommand {
     pub from: Option<String>,
     /// Recipient addresses, the flag repeating or taking a
     /// comma-separated list.
-    #[arg(long, short = 't', value_name = "ADDR", value_delimiter = ',')]
+    #[arg(long, short = 't', value_name = "ADDR")]
     pub to: Vec<String>,
     /// Carbon-copy recipients.
-    #[arg(long, value_name = "ADDR", value_delimiter = ',')]
+    #[arg(long, value_name = "ADDR")]
     pub cc: Vec<String>,
     /// Blind carbon-copy recipients.
-    #[arg(long, value_name = "ADDR", value_delimiter = ',')]
+    #[arg(long, value_name = "ADDR")]
     pub bcc: Vec<String>,
     /// Subject line.
     #[arg(long, short = 's', value_name = "TEXT")]
```

**File**: `src/shared/message/forward.rs` (modified, +3/-3)
```diff
@@ -42,13 +42,13 @@ pub struct MessageForwardCommand {
     pub from: Option<String>,
     /// Recipient addresses, the flag repeating or taking a
     /// comma-separated list.
-    #[arg(long, short = 't', value_name = "ADDR", value_delimiter = ',')]
+    #[arg(long, short = 't', value_name = "ADDR")]
     pub to: Vec<String>,
     /// Carbon-copy recipients.
-    #[arg(long, value_name = "ADDR", value_delimiter = ',')]
+    #[arg(long, value_name = "ADDR")]
     pub cc: Vec<String>,
     /// Blind carbon-copy recipients.
-    #[arg(long, value_name = "ADDR", value_delimiter = ',')]
+    #[arg(long, value_name = "ADDR")]
     pub bcc: Vec<String>,
     /// Subject line.
     #[arg(long, short = 's', value_name = "TEXT")]
```

#### Recent Merged Pull Requests:
- **PR #768** (2026-09-28): fix: strip surrounding quotes from quoted search patterns (@Dev-next-gen)
- **PR #766** (2026-09-26): fix: parse display names in To, Cc and Bcc the same way as From (@Dev-next-gen)
- **PR #765** (closed): fix(imap): terminate the last raw command with CRLF (@rofrol)
- **PR #762** (closed): feat(imap): fetch whole messages with imap fetch --body (@AndreyVGo)
- **PR #761** (closed): fix(smtp): do not transmit the Bcc field (@gianlucamazza)
- **PR #760** (2026-09-28): fix(imap): move without the MOVE extension (@gianlucamazza)
- **PR #759** (closed): fix(imap): accept append without recovered UID (@Shangliyuan)
- **PR #757** (2026-09-27): fix(gmail): return structured draft write identities (@srid)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
