# Forensic Learning Record (Deep Inspection): gluesql/gluesql

> **Canonical Artifact**: `07_PROJECT_LEARNING/gluesql-gluesql-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gluesql/gluesql](https://github.com/gluesql/gluesql))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:15:06.794Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gluesql/gluesql`
- **Description**: GlueSQL is quite sticky. It sticks to anything.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3131 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/cli.rs`
```
use {
    crate::{
        command::{Command, CommandError},
        helper::CliHelper,
        print::{Print, PrintOption},
    },
    edit::{Builder, edit_file, edit_with_builder},
    gluesql_core::{
        prelude::Glue,
        store::{GStore, GStoreMut, Planner},
    },
    rustyline::{Editor, error::ReadlineError},
    std::{
        error::Error,
        fs::File,
        io::{Read, Result, Write},
        path::Path,
    },
};

pub struct Cli<T, W>
where
    T: GStore + GStoreMut + Planner,
    W: Write,
{
    glue: Glue<T>,
    print: Print<W>,
}

impl<T, W> Cli<T, W>
where
    T: GStore + GStoreMut + Planner,
    W: Write,
{
    pub fn new(storage: T, output: W) -> Self {
        let glue = Glue::new(storage);
        let print = Print::new(output, None, PrintOption::default());

        Self { glue, print }
    }

    pub fn run(&mut self) -> std::result::Result<(), Box<dyn Error>> {
        macro_rules! println {
            ($($p:tt),*) => ( writeln!(&mut self.print.output, $($p),*)?; )
        }

        self.print.help()?;

        let mut rl = Editor::<CliHelper>::new();
        rl.set_helper(Some(CliHelper));

        loop {
            let line = match rl.readline("gluesql> ") {
                Ok(line) => line,
                Err(ReadlineError::Interrupted) => {
                    println!("^C");
                    continue;
                }
                Err(ReadlineError::Eof) => {
                    println!("bye\n");
                    break;
                }
                Err(e) => {
                    println!("[unknown error] {:?}", e);
                    break;
                }
            };

            let line = line.trim();
            if !(line.starts_with(".edit") || line.starts_with(".run")) {
                rl.add_history_entry(line);
            }

            let command = match Command::parse(line, &self.print.option) {
                Ok(command) => command,
                Err(CommandError::LackOfTable) => {
                    println!("[error] should specify table. eg: .columns TableName\n");
                    continue;
                }
                Err(CommandError::LackOfFile) => {
                    println!("[error] should specify file path.\n");
                    continue;
                }
                Err(CommandError::NotSupported) => {
                    println!("[error] command not supported: {}", line);
                    println!("\n  type .help to list all available commands.\n");
                    continue;
                }
                Err(CommandError::LackOfOption) => {
                    println!("[error] should specify option.\n");
                    continue;
                }
                Err(CommandError::LackOfValue(usage)) => {
                    println!("[error] should specify value.\n{usage}\n");
                    continue;
                }
                Err(CommandError::WrongOption(e)) => {
                    println!("[error] cannot support option: {e}\n");
                    continue;
                }
                Err(CommandError::LackOfSQLHistory) => {
                    println!("[error] Nothing in SQL history to run.\n");
                    continue;
                }
            };

            match command {
                Command::Help => {
                    self.print.help()?;
                }
                Command::Quit => {
                    println!("bye\n");
                    break;
                }
                Command::Execute(sql) => self.execute(sql)?,
                Command::ExecuteFromFile(filename) => {
                    if let Err(e) = self.load(&filename) {
                        println!("[error] {}\n", e);
                    }
                }
                Command::SpoolOn(path) => {
                    self.print.spool_on(path)?;
                }
                Command::SpoolOff => {
                    self.print.spool_off();
                }
                Command::Set(option) => self.print.set_option(option),
                Command::Show(option) => self.print.show_option(option)?,
                Command::Edit(file_name) => {
                    if let Some(file_name) = file_name {
                        let file = Path::new(&file_name);
                        edit_file(file)?;
                    } else {
                        let mut builder = Builder::new();
                        builder.prefix("Glue_").suffix(".sql");
                        let last = rl.history().last().map_or_else(|| "", String::as_str);
                        let edited = edit_with_builder(last, &builder)?;
                        rl.add_history_entry(edited);
                    }
                }
                Command::Run => {
                    let sql = rl.history().last().ok_or(CommandError::LackOfSQLHistory);

                    match sql {
                        Ok(sql) => {
                            self.execute(sql)?;
                        }
                        Err(e) => {
                            println!("[error] {}\n", e);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn execute(&mut self, sql: impl AsRef<str>) -> Result<()> {
        match self.glue.execute(sql) {
            Ok(payloads) => self.print.payloads(&payloads)?,
            Err(e) => {
                println!("[error] {e}\n");
            }
        }

        Ok(())
    }

    pub fn load<P: AsRef<Path>>(&mut self, filename: P) -> Result<()> {
        let mut sqls = String::new();
        File::open(filename)?.read_to_string(&mut sqls)?;
        for sql in sqls.split(';').filter(|sql| !sql.trim().is_empty()) {
            match self.glue.execute(sql) {
                Ok(payloads) => self.print.payloads(&payloads)?,
                Err(e) => {
                    println!("[error] {e}\n");
                    break;
                }
            }
        }

        Ok(())
    }
}

```

### Core Architecture Module: `cli/src/command.rs`
```
use {crate::print::PrintOption, std::fmt::Debug, thiserror::Error as ThisError};

#[derive(Debug, PartialEq, Eq)]
pub enum Command {
    Help,
    Quit,
    Execute(String),
    ExecuteFromFile(String),
    SpoolOn(String),
    SpoolOff,
    Set(SetOption),
    Show(ShowOption),
    Edit(Option<String>),
    Run,
}

#[derive(ThisError, Debug, PartialEq, Eq)]
pub enum CommandError {
    #[error("should specify table")]
    LackOfTable,
    #[error("should specify file path")]
    LackOfFile,
    #[error("should specify value for option")]
    LackOfValue(String),
    #[error("should specify option")]
    LackOfOption,
    #[error("cannot support option: {0}")]
    WrongOption(String),
    #[error("command not supported")]
    NotSupported,
    #[error("Nothing in SQL history to run.")]
    LackOfSQLHistory,
}

#[derive(Eq, Debug, PartialEq)]
pub enum SetOption {
    Tabular(bool),
    Colsep(String),
    Colwrap(String),
    Heading(bool),
}

impl SetOption {
    fn parse(key: &str, value: Option<&&str>, option: &PrintOption) -> Result<Self, CommandError> {
        fn bool_from(value: String) -> Result<bool, CommandError> {
            match value.to_uppercase().as_str() {
                "ON" => Ok(true),
                "OFF" => Ok(false),
                _ => Err(CommandError::WrongOption(value)),
            }
        }

        if let Some(value) = value {
            let value = match *value {
                "\"\"" => "",
                _ => value,
            }
            .to_owned();

            let set_option = match (key.to_lowercase().as_str(), &option.tabular) {
                ("tabular", _) => Self::Tabular(bool_from(value)?),
                ("colsep", false) => Self::Colsep(value),
                ("colwrap", false) => Self::Colwrap(value),
                ("heading", false) => Self::Heading(bool_from(value)?),
                (_, true) => return Err(CommandError::WrongOption("run .set tabular OFF".into())),

                _ => return Err(CommandError::WrongOption(key.into())),
            };

            Ok(set_option)
        } else {
            let payload = match key.to_lowercase().as_str() {
                "tabular" => "Usage: .set tabular {ON|OFF}",
                "colsep" => "Usage: .set colsep {\"\"|TEXT}",
                "colwrap" => "Usage: .set colwrap {\"\"|TEXT}",
                "heading" => "Usage: .set heading {ON|OFF}",

                _ => return Err(CommandError::WrongOption(key.into())),
            };

            Err(CommandError::LackOfValue(payload.into()))
        }
    }
}

#[derive(Eq, Debug, PartialEq, Copy, Clone)]
pub enum ShowOption {
    Tabular,
    Colsep,
    Colwrap,
    Heading,
    All,
}

impl ShowOption {
    fn parse(key: &str) -> Result<Self, CommandError> {
        let show_option = match key.to_lowercase().as_str() {
            "tabular" => Self::Tabular,
            "colsep" => Self::Colsep,
            "colwrap" => Self::Colwrap,
            "heading" => Self::Heading,
            "all" => Self::All,
            _ => return Err(CommandError::WrongOption(key.into())),
        };

        Ok(show_option)
    }
}

impl Command {
    pub fn parse(line: &str, option: &PrintOption) -> Result<Self, CommandError> {
        let line = line.trim_start().trim_end_matches([' ', ';']);
        // We detect if the line is a command or not
        if line.starts_with('.') {
            let params: Vec<&str> = line.split_whitespace().collect();
            match params[0] {
                ".help" => Ok(Self::Help),
                ".quit" => Ok(Self::Quit),
                ".tables" => Ok(Self::Execute("SHOW TABLES".to_owned())),
                ".functions" => Ok(Self::Execute("SHOW FUNCTIONS".to_owned())),
                ".columns" => match params.get(1) {
                    Some(table_name) => {
                        Ok(Self::Execute(format!("SHOW COLUMNS FROM {table_name}")))
                    }
                    None => Err(CommandError::LackOfTable),
                },
                ".version" => Ok(Self::Execute("SHOW VERSION".to_owned())),
                ".execute" if params.len() == 2 => Ok(Self::ExecuteFromFile(params[1].to_owned())),
                ".spool" => match params.get(1) {
                    Some(&"off") => Ok(Self::SpoolOff),
                    Some(path) => Ok(Self::SpoolOn((*path).to_owned())),
                    None => Err(CommandError::LackOfFile),
                },
                ".set" => match (params.get(1), params.get(2)) {
                    (Some(key), value) => Ok(Self::Set(SetOption::parse(key, value, option)?)),
                    (None, _) => Err(CommandError::LackOfOption),
                },
                ".show" => match params.get(1) {
                    Some(key) => Ok(Self::Show(ShowOption::parse(key)?)),
                    None => Err(CommandError::LackOfOption),
                },
                ".edit" => Ok(Self::Edit(params.get(1).map(|&v| v.to_owned()))),
                ".run" => Ok(Self::Run),

                _ => Err(CommandError::NotSupported),
            }
        } else {
            Ok(Self::Execute(line.to_owned()))
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{command::CommandError, print::PrintOption};

    #[test]
    fn parse_command() {
        use super::{Command, SetOption, ShowOption};
        let option = PrintOption::default();
        let parse = |command| Command::parse(command, &option);

        assert_eq!(parse(".help"), Ok(Command::Help));
        assert_eq!(parse("   .help;"), Ok(Command::Help));
        assert_eq!(parse(".quit"), Ok(Command::Quit));
        assert_eq!(parse(".quit;"), Ok(Command::Quit));
        assert_eq!(parse(" .quit; "), Ok(Command::Quit));
        assert_eq!(parse(".run"), Ok(Command::Run));
        assert_eq!(parse(".edit"), Ok(Command::Edit(None)));
        assert_eq!(
            parse(".edit foo.sql"),
            Ok(Command::Edit(Some("foo.sql".into())))
        );
        assert_eq!(
            parse(".tables"),
            Ok(Command::Execute("SHOW TABLES".to_owned())),
        );
        assert_eq!(
            parse(".functions"),
            Ok(Command::Execute("SHOW FUNCTIONS".to_owned())),
        );
        assert_eq!(
            parse(".columns Foo"),
            Ok(Command::Execute("SHOW COLUMNS FROM Foo".to_owned())),
        );
        assert_eq!(parse(".columns"), Err(CommandError::LackOfTable));
        assert_eq!(
            parse(".version"),
            Ok(Command::Execute("SHOW VERSION".to_owned()))
        );
        assert_eq!(parse(".foo"), Err(CommandError::NotSupported));
        assert_eq!(
            parse("SELECT * FROM Foo;"),
            Ok(Command::Execute("SELECT * FROM Foo".to_owned())),
        );
        assert_eq!(
            parse(".spool query.log"),
            Ok(Command::SpoolOn("query.log".into()))
        );
        assert_eq!(parse(".spool off"), Ok(Command::SpoolOff));
        assert_eq!(parse(".spool"), Err(CommandError::LackOfFile));
        assert_eq!(
            parse(".set colsep ,"),
            Err(CommandError::WrongOption("run .set tabular OFF".into()))
        );
        assert_eq!(
            parse(".set colwrap '"),
            Err(CommandError::WrongOption("run .set tabular OFF".into()))
        );
        assert_eq!(
            parse(".set heading off"),
            Err(CommandError::WrongOption("run .set tabular OFF".into()))
        );
        assert_eq!(parse(".abc"), Err(CommandError::NotSupported));
        assert_eq!(
            parse(".set abc"),
            Err(CommandError::WrongOption("abc".to_owned()))
        );
        assert_eq!(
            parse(".set tabular abc"),
            Err(CommandError::WrongOption("abc".to_owned()))
        );
        assert_eq!(
            parse(".set tabular off"),
            Ok(Command::Set(SetOption::Tabular(false)))
        );
        assert_eq!(
            parse(".set tabular on"),
            Ok(Command::Set(SetOption::Tabular(true)))

```

### Core Architecture Module: `cli/src/helper.rs`
```
use {
    rustyline::{
        Result,
        validate::{ValidationContext, ValidationResult, Validator},
    },
    rustyline_derive::{Completer, Helper, Highlighter, Hinter},
};

#[derive(Completer, Helper, Highlighter, Hinter)]
pub struct CliHelper;

impl Validator for CliHelper {
    fn validate(&self, ctx: &mut ValidationContext<'_>) -> Result<ValidationResult> {
        let input = ctx.input().trim();

        if input.ends_with(';') || input.starts_with('.') {
            Ok(ValidationResult::Valid(None))
        } else {
            Ok(ValidationResult::Incomplete)
        }
    }
}

```

### Core Architecture Module: `cli/src/lib.rs`
```
#![deny(clippy::str_to_string)]
#![allow(deprecated)]

mod cli;
mod command;
mod helper;
mod print;
mod upgrade;

use {
    crate::cli::Cli,
    anyhow::Result,
    clap::Parser,
    gluesql_core::{
        ast::{Expr, ToSql},
        store::{GStore, GStoreMut, Planner, Store, Transaction},
    },
    gluesql_csv_storage::CsvStorage,
    gluesql_file_storage::FileStorage,
    gluesql_json_storage::JsonStorage,
    gluesql_memory_storage::MemoryStorage,
    gluesql_parquet_storage::ParquetStorage,
    gluesql_redb_storage::RedbStorage,
    gluesql_sled_storage::SledStorage,
    std::{fmt::Debug, fs::File, io::Write, path::PathBuf},
};

const SLED_STORAGE_DEPRECATION_WARNING: &str = "[warning] sled-storage is deprecated and will be removed in v0.21.0; use redb-storage for new persistent-storage deployments";

fn warn_sled_storage_deprecated() {
    eprintln!("{SLED_STORAGE_DEPRECATION_WARNING}");
}

#[derive(Parser, Debug)]
#[clap(name = "gluesql", about, version)]
struct Args {
    /// SQL file to execute
    #[clap(short, long, value_parser)]
    execute: Option<PathBuf>,

    /// PATH to dump a Sled database as SQL; deprecated and removed in v0.21.0
    #[clap(short, long, value_parser)]
    dump: Option<PathBuf>,

    /// Storage type to store data; defaults to memory.
    /// sled is deprecated and will be removed in v0.21.0; use redb for new deployments.
    #[clap(short, long, value_parser)]
    storage: Option<Storage>,

    /// Storage path to load
    #[clap(short, long, value_parser)]
    path: Option<PathBuf>,

    /// Upgrade storage data format to the latest version
    #[clap(
        long,
        requires_all = &["storage", "path"],
        conflicts_with_all = &["execute", "dump"]
    )]
    upgrade: bool,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
enum Storage {
    Memory,
    Sled,
    Redb,
    Json,
    Csv,
    Parquet,
    File,
}

pub fn run() -> Result<()> {
    fn run<T: GStore + GStoreMut + Planner>(storage: T, input: Option<PathBuf>) {
        let output = std::io::stdout();
        let mut cli = Cli::new(storage, output);

        if let Some(path) = input
            && let Err(e) = cli.load(path.as_path())
        {
            println!("[error] {e}\n");
        }

        if let Err(e) = cli.run() {
            eprintln!("{e}");
        }
    }

    let Args {
        execute,
        dump,
        storage,
        path,
        upgrade,
    } = Args::parse();

    if upgrade {
        return upgrade::run_upgrade(path.as_deref(), storage, execute.is_some(), dump.is_some());
    }

    let path = path.as_deref();

    match (path, storage, dump) {
        (Some(path), None, Some(dump_path)) => {
            warn_sled_storage_deprecated();
            let mut storage = SledStorage::new(path).expect("failed to load sled-storage");

            dump_database(&mut storage, dump_path)?;
        }
        (None, None | Some(Storage::Memory), _) => {
            println!("[memory-storage] initialized");

            run(MemoryStorage::default(), execute);
        }
        (Some(_), Some(Storage::Memory), _) => {
            panic!("failed to load memory-storage: it should be without path");
        }
        (Some(path), Some(Storage::Sled), _) => {
            warn_sled_storage_deprecated();
            println!("[sled-storage] connected to {}", path.display());

            run(
                SledStorage::new(path).expect("failed to load sled-storage"),
                execute,
            );
        }
        (Some(path), Some(Storage::Redb), _) => {
            println!("[redb-storage] connected to {}", path.display());

            run(
                RedbStorage::new(path).expect("failed to load redb-storage"),
                execute,
            );
        }
        (Some(path), Some(Storage::Json), _) => {
            println!("[json-storage] connected to {}", path.display());

            run(
                JsonStorage::new(path).expect("failed to load json-storage"),
                execute,
            );
        }
        (Some(path), Some(Storage::Csv), _) => {
            println!("[csv-storage] connected to {}", path.display());

            run(
                CsvStorage::new(path).expect("failed to load csv-storage"),
                execute,
            );
        }
        (Some(path), Some(Storage::Parquet), _) => {
            println!("[parquet-storage] connected to {}", path.display());

            run(
                ParquetStorage::new(path).expect("failed to load parquet-storage"),
                execute,
            );
        }
        (Some(path), Some(Storage::File), _) => {
            println!("[file-storage] connected to {}", path.display());

            run(
                FileStorage::new(path).expect("failed to load file-storage"),
                execute,
            );
        }
        (None, Some(_), _) | (Some(_), None, None) => {
            panic!("both path and storage should be specified");
        }
    }

    Ok(())
}

pub fn dump_database(storage: &mut SledStorage, dump_path: PathBuf) -> Result<()> {
    let file = File::create(dump_path)?;

    storage.begin(true)?;
    let schemas = storage.fetch_all_schemas()?;
    for schema in schemas {
        writeln!(&file, "{}", schema.to_ddl())?;

        let mut rows = storage
            .scan_data(&schema.table_name)?
            .map(|result| result.map(|(_, row)| row));

        loop {
            let exprs_list = rows
                .by_ref()
                .take(100)
                .map(|result| {
                    result.map(|row| row.into_iter().map(Expr::Value).collect::<Vec<_>>())
                })
                .collect::<std::result::Result<Vec<_>, _>>()?;

            if exprs_list.is_empty() {
                break;
            }

            let values = exprs_list
                .into_iter()
                .map(|exprs| {
                    let row = exprs
                        .into_iter()
                        .map(|expr| expr.to_sql())
                        .collect::<Vec<_>>()
                        .join(", ");
                    format!("({row})")
                })
                .collect::<Vec<_>>()
                .join(", ");

            let insert_statement =
                format!(r#"INSERT INTO "{}" VALUES {values};"#, schema.table_name);

            writeln!(&file, "{insert_statement}")?;
        }

        writeln!(&file)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use {super::Args, clap::Parser};

    #[test]
    fn parse_upgrade_requires_storage_and_path() {
        let args = Args::try_parse_from(["gluesql", "--upgrade"]);
        assert!(args.is_err());
    }

    #[test]
    fn parse_upgrade_rejects_execute() {
        let args = Args::try_parse_from([
            "gluesql",
            "--upgrade",
            "--storage",
            "sled",
            "--path",
            "./tmp",
            "--execute",
            "query.sql",
        ]);
        assert!(args.is_err());
    }

    #[test]
    fn parse_upgrade_rejects_dump() {
        let args = Args::try_parse_from([
            "gluesql",
            "--upgrade",
            "--storage",
            "file",
            "--path",
            "./tmp",
            "--dump",
            "dump.sql",
        ]);
        assert!(args.is_err());
    }
}

```

### Core Architecture Module: `cli/src/main.rs`
```
fn main() {
    gluesql_cli::run().unwrap();
}

```

### Core Architecture Module: `cli/src/print.rs`
```
use {
    crate::command::{SetOption, ShowOption},
    gluesql_core::prelude::{Payload, PayloadVariable},
    std::{
        collections::{BTreeMap, HashSet},
        fmt::Display,
        fs::File,
        io::{Result as IOResult, Write},
        path::Path,
    },
    strum_macros::Display,
    tabled::{Style, Table, builder::Builder},
};

pub struct Print<W: Write> {
    pub output: W,
    spool_file: Option<File>,
    pub option: PrintOption,
}

pub struct PrintOption {
    pub tabular: bool,
    colsep: String,
    colwrap: String,
    heading: bool,
}

impl PrintOption {
    pub fn tabular(&mut self, tabular: bool) {
        if tabular {
            self.tabular = tabular;
            self.colsep("|".into());
            self.colwrap(String::new());
            self.heading(true);
        } else {
            self.tabular = tabular;
        }
    }

    fn colsep(&mut self, colsep: String) {
        self.colsep = colsep;
    }

    fn colwrap(&mut self, colwrap: String) {
        self.colwrap = colwrap;
    }

    fn heading(&mut self, heading: bool) {
        self.heading = heading;
    }

    fn format(&self, option: ShowOption) -> String {
        fn string_from(value: bool) -> String {
            if value { "ON".into() } else { "OFF".into() }
        }
        match option {
            ShowOption::Tabular => format!("tabular {}", string_from(self.tabular)),
            ShowOption::Colsep => format!("colsep \"{}\"", self.colsep),
            ShowOption::Colwrap => format!("colwrap \"{}\"", self.colwrap),
            ShowOption::Heading => format!("heading {}", string_from(self.heading)),
            ShowOption::All => format!(
                "{}\n{}\n{}\n{}",
                self.format(ShowOption::Tabular),
                self.format(ShowOption::Colsep),
                self.format(ShowOption::Colwrap),
                self.format(ShowOption::Heading),
            ),
        }
    }
}

impl Default for PrintOption {
    fn default() -> Self {
        Self {
            tabular: true,
            colsep: "|".into(),
            colwrap: String::new(),
            heading: true,
        }
    }
}

impl<'a, W: Write> Print<W> {
    pub fn new(output: W, spool_file: Option<File>, option: PrintOption) -> Self {
        Print {
            output,
            spool_file,
            option,
        }
    }

    pub fn payloads(&mut self, payloads: &[Payload]) -> IOResult<()> {
        payloads.iter().try_for_each(|p| self.payload(p))
    }

    pub fn payload(&mut self, payload: &Payload) -> IOResult<()> {
        #[derive(Display)]
        #[strum(serialize_all = "snake_case")]
        enum Target {
            Table,
            Row,
        }
        use Target::*;

        let mut affected = |n: usize, target: Target, msg: &str| -> IOResult<()> {
            let payload = format!("{n} {target}{} {msg}", if n > 1 { "s" } else { "" });
            self.writeln(payload)
        };
        match payload {
            Payload::Create => self.writeln("Table created")?,
            Payload::DropTable(n) => affected(*n, Table, "dropped")?,
            Payload::DropFunction => self.writeln("Function dropped")?,
            Payload::AlterTable => self.writeln("Table altered")?,
            Payload::CreateIndex => self.writeln("Index created")?,
            Payload::DropIndex => self.writeln("Index dropped")?,
            Payload::Commit => self.writeln("Commit completed")?,
            Payload::Rollback => self.writeln("Rollback completed")?,
            Payload::StartTransaction => self.writeln("Transaction started")?,
            Payload::Insert(n) => affected(*n, Row, "inserted")?,
            Payload::Delete(n) => affected(*n, Row, "deleted")?,
            Payload::Update(n) => affected(*n, Row, "updated")?,
            Payload::ShowVariable(PayloadVariable::Version(v)) => self.writeln(format!("v{v}"))?,
            Payload::ShowVariable(PayloadVariable::Tables(names)) => {
                let mut table = Self::get_table(["tables"]);
                for name in names {
                    table.add_record([name]);
                }
                let table = Self::build_table(table);
                self.writeln(table)?;
            }
            Payload::ShowVariable(PayloadVariable::Functions(names)) => {
                let mut table = Self::get_table(["functions"]);
                for name in names {
                    table.add_record([name]);
                }
                let table = Self::build_table(table);
                self.writeln(table)?;
            }
            Payload::ShowColumns(columns) => {
                let mut table = Self::get_table(vec!["Field", "Type"]);
                for (field, field_type) in columns {
                    table.add_record([field, &field_type.to_string()]);
                }
                let table = Self::build_table(table);
                self.writeln(table)?;
            }
            Payload::Select { labels, rows } => match &self.option.tabular {
                true => {
                    let labels = labels.iter().map(AsRef::as_ref);
                    let mut table = Self::get_table(labels);
                    for row in rows {
                        let row: Vec<String> = row.iter().map(Into::into).collect();

                        table.add_record(row);
                    }
                    let table = Self::build_table(table);
                    self.writeln(table)?;
                }
                false => {
                    self.write_header(labels.iter().map(String::as_str))?;
                    let rows = rows.iter().map(|row| row.iter().map(String::from));
                    self.write_rows(rows)?;
                }
            },
            Payload::SelectMap(rows) => {
                let mut labels = rows
                    .iter()
                    .flat_map(BTreeMap::keys)
                    .map(AsRef::as_ref)
                    .collect::<HashSet<&str>>()
                    .into_iter()
                    .collect::<Vec<_>>();
                labels.sort_unstable();

                match &self.option.tabular {
                    true => {
                        let mut table = Self::get_table(labels.clone());
                        for row in rows {
                            let row = labels
                                .iter()
                                .map(|label| row.get(*label).map(Into::into).unwrap_or_default())
                                .collect::<Vec<String>>();

                            table.add_record(row);
                        }
                        let table = Self::build_table(table);
                        self.writeln(table)?;
                    }
                    false => {
                        self.write_header(labels.iter().map(AsRef::as_ref))?;

                        let rows = rows.iter().map(|row| {
                            labels
                                .iter()
                                .map(|label| row.get(*label).map(String::from).unwrap_or_default())
                        });
                        self.write_rows(rows)?;
                    }
                }
            }
        }

        Ok(())
    }

    fn write_rows(
        &mut self,
        rows: impl Iterator<Item = impl Iterator<Item = String>>,
    ) -> IOResult<()> {
        for row in rows {
            let row = row
                .map(|v| format!("{c}{v}{c}", c = self.option.colwrap))
                .collect::<Vec<_>>()
                .join(self.option.colsep.as_str());

            self.write(row)?;
        }

        Ok(())
    }

    fn write_lf(&mut self, payload: impl Display, lf: &str) -> IOResult<()> {
        if let Some(file) = &self.spool_file {
            writeln!(file.to_owned(), "{payload}{lf}")?;
        }

        writeln!(self.output, "{payload}{lf}")
    }

    fn write(&mut self, payload: impl Display) -> IOResult<()> {
        self.write_lf(payload, "")
    }

```

### Core Architecture Module: `cli/src/upgrade.rs`
```
use {
    crate::{Storage, warn_sled_storage_deprecated},
    anyhow::{Result, bail},
    gluesql_file_storage::migrate_to_latest as migrate_file_storage_to_latest,
    gluesql_redb_storage::migrate_to_latest as migrate_redb_storage_to_latest,
    gluesql_sled_storage::migrate_to_latest as migrate_sled_storage_to_latest,
    std::path::Path,
};

pub(super) fn run_upgrade(
    path: Option<&Path>,
    storage: Option<Storage>,
    has_execute: bool,
    has_dump: bool,
) -> Result<()> {
    if has_execute || has_dump {
        bail!("--upgrade cannot be used with --execute or --dump");
    }

    let (Some(path), Some(storage)) = (path, storage) else {
        bail!("both --path and --storage should be specified with --upgrade");
    };

    match storage {
        Storage::Sled => {
            warn_sled_storage_deprecated();
            let report = migrate_sled_storage_to_latest(path)?;
            print_upgrade_report(
                "sled",
                path,
                report.migrated_tables,
                report.unchanged_tables,
                report.rewritten_rows,
            );
        }
        Storage::Redb => {
            let report = migrate_redb_storage_to_latest(path)?;
            print_upgrade_report(
                "redb",
                path,
                report.migrated_tables,
                report.unchanged_tables,
                report.rewritten_rows,
            );
        }
        Storage::File => {
            let report = migrate_file_storage_to_latest(path)?;
            print_upgrade_report(
                "file",
                path,
                report.migrated_tables,
                report.unchanged_tables,
                report.rewritten_rows,
            );
        }
        _ => {
            bail!("--upgrade is supported only for storage types: sled, redb, file");
        }
    }

    Ok(())
}

fn print_upgrade_report(
    storage_name: &str,
    path: &Path,
    migrated_tables: usize,
    unchanged_tables: usize,
    rewritten_rows: usize,
) {
    println!("[{storage_name}-storage] upgraded {}", path.display());
    println!(
        "[{storage_name}-storage] migration report: migrated_tables={migrated_tables}, unchanged_tables={unchanged_tables}, rewritten_rows={rewritten_rows}",
    );
}

#[cfg(test)]
mod tests {
    use {
        super::run_upgrade,
        crate::Storage,
        gluesql_file_storage::FileStorage,
        gluesql_redb_storage::RedbStorage,
        gluesql_sled_storage::SledStorage,
        std::{
            fs,
            path::{Path, PathBuf},
            time::{SystemTime, UNIX_EPOCH},
        },
    };

    fn test_path(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();

        std::env::temp_dir().join(format!("gluesql-cli-upgrade-{name}-{suffix}"))
    }

    #[test]
    fn upgrade_rejects_unsupported_storage() {
        let actual = run_upgrade(Some(Path::new("./tmp")), Some(Storage::Json), false, false);
        let expected = "--upgrade is supported only for storage types: sled, redb, file";

        assert_eq!(
            actual
                .expect_err("unsupported storage should fail")
                .to_string(),
            expected
        );
    }

    #[test]
    fn upgrade_rejects_execute_or_dump() {
        let actual = run_upgrade(Some(Path::new("./tmp")), Some(Storage::Sled), true, false);
        let expected = "--upgrade cannot be used with --execute or --dump";

        assert_eq!(
            actual.expect_err("execute should conflict").to_string(),
            expected
        );
    }

    #[test]
    fn upgrade_requires_path_and_storage() {
        let actual = run_upgrade(None, Some(Storage::Sled), false, false);
        let expected = "both --path and --storage should be specified with --upgrade";

        assert_eq!(
            actual.expect_err("missing path should fail").to_string(),
            expected
        );
    }

    #[test]
    fn upgrade_accepts_sled_storage() {
        let path = test_path("sled");
        SledStorage::new(&path).expect("failed to initialize sled storage for upgrade test");

        let actual = run_upgrade(Some(path.as_path()), Some(Storage::Sled), false, false);

        assert!(actual.is_ok(), "sled upgrade should succeed: {actual:?}");
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn upgrade_accepts_redb_storage() {
        let path = test_path("redb.db");
        RedbStorage::new(&path).expect("failed to initialize redb storage for upgrade test");

        let actual = run_upgrade(Some(path.as_path()), Some(Storage::Redb), false, false);

        assert!(actual.is_ok(), "redb upgrade should succeed: {actual:?}");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn upgrade_accepts_file_storage() {
        let path = test_path("file");
        FileStorage::new(&path).expect("failed to initialize file storage for upgrade test");

        let actual = run_upgrade(Some(path.as_path()), Some(Storage::File), false, false);

        assert!(actual.is_ok(), "file upgrade should succeed: {actual:?}");
        let _ = fs::remove_dir_all(path);
    }
}

```

### Core Architecture Module: `core/src/ast.rs`
```
mod data_type;
mod ddl;
mod expr;
mod function;
mod literal;
mod operator;
mod query;

pub use {
    data_type::DataType,
    ddl::*,
    expr::Expr,
    function::{Aggregate, AggregateFunction, CountArgExpr, Function},
    literal::{DateTimeField, Literal, TrimWhereField},
    operator::*,
    query::*,
};

use {
    serde::{Deserialize, Serialize},
    strum_macros::Display,
};

pub trait ToSql {
    fn to_sql(&self) -> String;
}

pub trait ToSqlUnquoted {
    fn to_sql_unquoted(&self) -> String;
}

#[derive(PartialEq, Debug, Clone, Eq, Hash, Serialize, Deserialize)]
pub struct ForeignKey {
    pub name: String,
    pub referencing_column_name: String,
    pub referenced_table_name: String,
    pub referenced_column_name: String,
    pub on_delete: ReferentialAction,
    pub on_update: ReferentialAction,
}

#[derive(PartialEq, Debug, Clone, Eq, Hash, Serialize, Deserialize, Display)]
pub enum ReferentialAction {
    #[strum(to_string = "NO ACTION")]
    NoAction,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Statement {
    ShowColumns {
        table_name: String,
    },
    /// SELECT, VALUES
    Query(Query),
    /// INSERT
    Insert {
        /// TABLE
        table_name: String,
        /// COLUMNS
        columns: Vec<String>,
        /// A SQL query that specifies what to insert
        source: Query,
    },
    /// UPDATE
    Update {
        /// TABLE
        table_name: String,
        /// Column assignments
        assignments: Vec<Assignment>,
        /// WHERE
        selection: Option<Expr>,
    },
    /// DELETE
    Delete {
        /// FROM
        table_name: String,
        /// WHERE
        selection: Option<Expr>,
    },
    /// CREATE TABLE
    CreateTable {
        if_not_exists: bool,
        /// Table name
        name: String,
        /// Optional schema
        columns: Option<Vec<ColumnDef>>,
        source: Option<Box<Query>>,
        engine: Option<String>,
        foreign_keys: Vec<ForeignKey>,
        comment: Option<String>,
    },
    /// CREATE FUNCTION
    CreateFunction {
        or_replace: bool,
        name: String,
        /// Optional schema
        args: Vec<OperateFunctionArg>,
        return_: Expr,
    },
    /// ALTER TABLE
    AlterTable {
        /// Table name
        name: String,
        operation: AlterTableOperation,
    },
    /// DROP TABLE
    DropTable {
        /// An optional `IF EXISTS` clause. (Non-standard.)
        if_exists: bool,
        /// One or more objects to drop. (ANSI SQL requires exactly one.)
        names: Vec<String>,
        /// An optional `CASCADE` clause for dropping dependent constructs.
        cascade: bool,
    },
    /// DROP FUNCTION
    DropFunction {
        /// An optional `IF EXISTS` clause. (Non-standard.)
        if_exists: bool,
        /// One or more objects to drop. (ANSI SQL requires exactly one.)
        names: Vec<String>,
    },
    /// CREATE INDEX
    CreateIndex {
        name: String,
        table_name: String,
        column: OrderByExpr,
    },
    /// DROP INDEX
    DropIndex {
        name: String,
        table_name: String,
    },
    /// START TRANSACTION, BEGIN
    StartTransaction,
    /// COMMIT
    Commit,
    /// ROLLBACK
    Rollback,
    /// SHOW VARIABLE
    ShowVariable(Variable),
    ShowIndexes(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Assignment {
    pub id: String,
    pub value: Expr,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Variable {
    Tables,
    Functions,
    Version,
}

impl ToSql for ForeignKey {
    fn to_sql(&self) -> String {
        let ForeignKey {
            referencing_column_name,
            referenced_table_name,
            referenced_column_name,
            name,
            on_delete,
            on_update,
        } = self;

        format!(
            r#"CONSTRAINT "{name}" FOREIGN KEY ("{referencing_column_name}") REFERENCES "{referenced_table_name}" ("{referenced_column_name}") ON DELETE {on_delete} ON UPDATE {on_update}"#
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Array {
    pub elem: Vec<Expr>,
    pub named: bool,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2011** (2026-09-28): **DELETE with multiple tables in FROM deletes from the first table only and reports success**
  *Symptoms*: ## Summary  `DELETE FROM T1, T2 WHERE ...` is accepted, but translation keeps only the first table and discards the rest. The statement reports a successful delete while the remaining tables are untouched.  This is a silent wrong result — nothing in the output indicates that part of the statement was ignored.  ## Reproduction  ```sql CREATE TABLE T1 (a INTEGER); CREATE TABLE T2 (a INTEGER); INSERT INTO T1 VALUES (1); INSERT INTO T2 VALUES (1);  DELETE FROM T1, T2 WHERE a = 1; -- "1 row deleted"  SELECT * FROM T1; -- | a | --            <- deleted  SELECT * FROM T2; -- | a | -- |---| -- | 1 |      <- still there ```  ## Expected behavior  | Statement | Expected | Today | |---|---|---| | `DELETE FROM T1, T2 WHERE a = 1` | `Translate.UnsupportedDeleteOption` | deletes from `T1` only, reports `1 row deleted` | | `DELETE FROM T1, T1 WHERE a = 1` | `Translate.UnsupportedDeleteOption` | deletes from `T1`, reports `1 row deleted` | | `DELETE FROM T1 WHERE a = 1` | deletes from `T1` | unchanged |  ## Root cause  `core/src/translate.rs:178-182`:  ```rust let table_name = from     .iter()     .map(translate_table_with_join)     .next()                                    // first entry only, rest discarded     .ok_or(TranslateError::UnreachableEmptyTable)??; ```  `from` is a `Vec<TableWithJoins>`. `.next()` takes the head and drops the tail without inspecting it.  This is the same failure shape as #2002, where `columns.first()` silently narrowed a composite `FOREIGN KEY` to its first col

- **Issue #2009** (2026-09-27): **Statements in a batched `execute` are planned against the schema from before the batch**
  *Symptoms*: ## Summary  `Glue::execute` plans every statement before executing any of them, so a statement is planned against the schema as it was before the batch started. Any DDL earlier in the same call is invisible to the planner.  Schema-dependent planner passes then silently no-op, and the executor receives a plan whose invariants were never established.  ## Reproduction  Each case is issued twice: once as a single `Glue::execute` call, once as one call per statement.  | SQL | One statement per call | Batched in one call | |---|---|---| | `CREATE TABLE S; INSERT INTO S VALUES ('{"a": 1}'); SELECT a FROM S;` | returns `a = 1` | ❌ `evaluate: identifier not found: a` | | `CREATE TABLE X (id INTEGER); CREATE TABLE Y (id INTEGER); INSERT INTO X VALUES (1); INSERT INTO Y VALUES (1); SELECT id FROM X JOIN Y ON X.id = Y.id;` | ❌ `planner: column reference id is ambiguous, please specify the table name` | returns `id = 1` | | `CREATE TABLE T (a INTEGER PRIMARY KEY); INSERT INTO T VALUES (1); SELECT a FROM T;` | returns `a = 1` | returns `a = 1` |  Case 1 rejects valid SQL. Case 2 accepts invalid SQL and returns a result. Case 3 is unaffected — no schema-dependent pass is load-bearing for it.  ## Root cause  `core/src/glue.rs:70-77`:  ```rust pub fn execute_with_params(...) -> Result<Vec<Payload>> {     let statements = self.plan_with_params(sql, params)?;   // every statement planned here     let mut payloads = Vec::<Payload>::new();     for statement in &statements {         let payload = 

- **Issue #1942** (2026-07-14): **Qualified primary-key predicate on joined relation is applied to the first FROM relation**
  *Symptoms*: Hello! First of all, thank you for building and maintaining GlueSQL :)  I believe I found a query correctness bug in primary-key planning. If the issue and proposed direction below make sense, would you be open to me submitting a PR to address it?  My plan would be to add regression tests and implement a correctness-first fix that skips PK optimization when a qualified predicate targets a joined relation, preserving the original WHERE condition.  ## Reproduction  Tested with GlueSQL `0.19.0` and `SledStorage`.  ```sql CREATE TABLE projects (     id INTEGER PRIMARY KEY,     name TEXT NOT NULL );  CREATE TABLE tasks (     id INTEGER PRIMARY KEY,     project_id INTEGER,     done BOOLEAN NOT NULL );  INSERT INTO projects VALUES (1, 'P1'); INSERT INTO tasks VALUES     (1, 1, FALSE),     (2, 1, FALSE);  SELECT t.id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.id = 1   AND t.done = FALSE; ```  Expected:  ```text id 1 2 ```  Actual:  ```text id 1 ```  Reversing the relation order returns both rows.  ## Cause  The PK planner drops the qualifier from `p.id`, finds an `id` primary key in the combined JOIN context, and attaches `PrimaryKey(1)` to the first relation (`tasks`).  The resulting plan incorrectly contains:  ```text Primary Key Lookup [tasks, key=1] ```  As a result, only `tasks.id = 1` is fetched, and the row with `tasks.id = 2` never reaches the JOIN.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. I confirmed the original reproduction on the current `main`, including with `MemoryStorage`, so this is not specific to `SledStorage`.  I also found several related cases caused by the same planner behavior.  ### 1. Different primary-key names  ```sql CREATE TABLE projects (     id INTEGER PRIMARY KEY,     name TEXT NOT NULL );  CREATE TABLE tasks (     task_id INTEGER PRIMARY KEY,     project_id INTEGER,     done BOOLEAN NOT NULL );  INSERT INTO projects VALUES (1, 'P1'); INSERT INTO tasks VALUES     (101, 1, FALSE),     (102, 1, FALSE);  SELECT t.task_id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.id = 1   AND t.done = FALSE; ```  Expected:  ```text 101 102 ```  Actual:  ```text No rows returned ```  This shows that the problem is not limited to both relations having a primary key named `id`.  The planner recognizes `projects.id = 1` as a primary-key predicate, but then applies the lookup to the first relation as if it were `tasks.task_

- **Issue #1919** (2026-05-30): **Keep primary key access path in index planner**
  *Symptoms*: ## Problem  When a query combines a **primary key equality predicate** with a **secondary index equality predicate** via `AND`, the primary key predicate is silently dropped, returning extra rows:  ```sql CREATE TABLE T (id INTEGER PRIMARY KEY, name TEXT); CREATE INDEX idx_name ON T (name); INSERT INTO T VALUES (1, 'x'), (2, 'x'), (3, 'y');  SELECT id FROM T WHERE id = 1 AND name = 'x'; -- expected: [1] -- actual:   [1, 2]   ← the `id = 1` condition is ignored ```  This affects the **sled** storage (the only storage that runs `plan_index`). It is not a regression — `main` reproduces it as well.  ## Cause  The planner pipeline runs `plan_primary_key` before `plan_index` (`storages/sled-storage/src/planner.rs`):  1. `plan_primary_key` moves `id = 1` out of the selection into a `PrimaryKey` access path, leaving `name = 'x'` as the selection. 2. `plan_index`'s **selection** branch (`core/src/plan/index.rs`) lacked the `index.is_none()` guard that its **order-by** branch already has. It therefore matched the remaining `name = 'x'`, overwrote the `PrimaryKey` access path with the `idx_name` `NonClustered` index, and dropped the leftover selection — losing the `id = 1` predicate entirely.  Two passes were writing to the same `index` slot, and only the first pass guarded against an already-chosen access path.  ## Fix  Add the `index: None` guard to the selection branch so an access path chosen by an earlier pass is preserved, mirroring the existing order-by branch. When an access pat
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro  **Run ID**: `5b5ec26a-9b3b-4f84-b4d1-9ad5a4aa6df1`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between a7d9c3bb4c53075fc26efbe7bb0fe4fd04ddb7ce and befb7cd37867588abc3965e8eecfed0fae26f6e7.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `core/src/plan/index.rs`  </details>  <details> <summary>🚧 Files skipped from review as they are similar to previous changes (1)</summary>  * core/src/plan/index.rs  </details>  </details>  --- <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The index planner now only applies a secondary index when the t
  > ## [Codecov](https://app.codecov.io/gh/gluesql/gluesql/pull/1919?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql) Report :x: Patch coverage is `95.00000%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 98.18%. Comparing base ([`6058f70`](https://app.codecov.io/gh/gluesql/gluesql/commit/6058f70fb4e2fb14350c231da00d5a8e6c7ae498?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)) to head ([`8981d4e`](https://app.codecov.io/gh/gluesql/gluesql/commit/8981d4e8cf2ce8edc8550ea3c9defad9bf355e83?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)). :warning: Report is 2 commits behind head on main.  | [Files with missing lines](https://app.codecov.io/gh/gluesql/gluesql/pull/1919?dropdown=coverage&src=pr&el=tree&
  > ### GlueSQL Coverage Report  - **Commit:** `8981d4e8cf2ce8edc8550ea3c9defad9bf355e83` - **Timestamp:** `2026-05-30T091042Z` - **Report:** [View report](https://gluesql.org/coverage/?path=pr/1919/2026-05-30T091042Z.8981d4e8cf2ce8edc8550ea3c9defad9bf355e83.lcov.info.xz)

- **Issue #1798** (2025-09-24): **Fix macros dev dependency cycle**
  *Symptoms*: ## Summary - replace the macro crate's dev-dependency on gluesql with gluesql-core + gluesql_memory_storage to remove the publish blocker - add dynamic crate path resolution via proc-macro-crate so the derive works in all consumers - update macro integration and compile-fail tests to use the new imports  ## Testing - cargo clippy --all-targets -- -D warnings - cargo fmt --all - cargo test -p gluesql-macros   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - New Features   - Derive macros now auto-detect the GlueSQL core path, working seamlessly with either gluesql or gluesql-core setups.   - Improved compatibility with the memory storage backend.   - Clearer compile-time errors when the GlueSQL crate cannot be located.  - Tests   - Expanded compile-time coverage and updated test imports to reflect the new crate layout.  - Chores   - Aligned dev-dependencies with workspace resolution and added a compile-time testing tool.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough The macros crate now dynamically resolves the gluesql crate path during macro expansion, replacing hard-coded paths. Dependencies and dev-dependencies were adjusted to use workspace crates and add trybuild. Tests were updated to import macros from gluesql_macros and core types from gluesql_core, with minor path/type alias adjustments.  ## Changes | Cohort / File(s) | Summary | | --- | --- | | **Build & deps**<br>`macros/Cargo.toml` | Added `proc-macro-crate` dependency; switched dev-deps to `gluesql_core.workspace = true` and `gluesql_memory_storage.workspace = true`; added `trybuild = "1"`. | | **Macro implementation**<br>`macros/src/lib.rs` | Added dynamic crate resolver `resolve_gluesql_crate()` using `proc-macro-crate`; propagated resolved path through codegen; changed impl and references from `::gluesql::core::...` to `#gluesql_crate::...`; updated `match_expected(...)
  > ## [Codecov](https://app.codecov.io/gh/gluesql/gluesql/pull/1798?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql) Report :x: Patch coverage is `70.58824%` with `10 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 97.95%. Comparing base ([`723b064`](https://app.codecov.io/gh/gluesql/gluesql/commit/723b06463e005cb44e8760468b9d3f7d17621410?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)) to head ([`a50a86d`](https://app.codecov.io/gh/gluesql/gluesql/commit/a50a86d45f0f8e9f361b92406a851adf0a53ef85?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)). :warning: Report is 1 commits behind head on main.  | [Files with missing lines](https://app.codecov.io/gh/gluesql/gluesql/pull/1798?dropdown=coverage&src=pr&el=tre
  > ### GlueSQL Coverage Report  - **Commit:** `a50a86d45f0f8e9f361b92406a851adf0a53ef85` - **Timestamp:** `2025-09-24T142726Z` - **Report:** [View report](https://gluesql.org/coverage/?path=pr/1798/2025-09-24T142726Z.a50a86d45f0f8e9f361b92406a851adf0a53ef85.lcov.info.xz)

- **Issue #1773** (2025-09-07): **Fix publish-coverage action - artifact download & PR comment**
  *Symptoms*: Summary - Download coverage artifact by run-id with explicit github-token (v4 requirement across runs) - Extract to path=coverage so file is at ./coverage/lcov.info.xz deterministically - Use PAT (secrets.GLUESQL_ORG) for commenting on PR to avoid GITHUB_TOKEN write limitations in some contexts - Keep workflow_dispatch for manual testing (run_id/pr_number/commit_sha/artifact_name)  Why - Fixes intermittent/consistent failures where artifact existed but actions/download-artifact@v4 could not fetch by name without token - Removes path ambiguity that caused cp to fail - Ensures comment step works reliably regardless of workflow permission settings  Notes - No code changes to Rust; CI-only update - Manual verification done on a dedicated branch; this PR contains the minimal, cleaned changes  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Chores**   * Improved the code coverage publishing workflow by tightening permissions and adding proper authentication.   * Corrected artifact handling so coverage reports are reliably retrieved and linked in pull requests. <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough Adjusts the publish-coverage GitHub Actions workflow: changes the artifact download path to `coverage/`, supplies `github-token` inputs for the artifact download and PR comment steps, and documents the expected artifact location `./coverage/lcov.info.xz`.  ## Changes | Cohort / File(s) | Summary | | --- | --- | | **GitHub Actions: Publish Coverage**<br>`.github/workflows/publish-coverage.yml` | Removed `issues: write` permission; set download path to `coverage/`; added `github-token: ${{ secrets.GITHUB_TOKEN }}` to the Download coverage artifact step and `github-token: ${{ secrets.GLUESQL_ORG }}` to the PR comment step; added comment noting artifact at `./coverage/lcov.info.xz`. |  ## Sequence Diagram(s) ```mermaid sequenceDiagram   autonumber   actor Dev as Developer (PR)   participant GH as GitHub Actions   participant Art as Artifacts   participant PR as PR Comment Actio
  > ## Pull Request Test Coverage Report for [Build 17528152533](https://coveralls.io/builds/75424209)   ### Details  * **0** of **0**   changed or added relevant lines in **0** files are covered. * No unchanged relevant lines lost coverage. * Overall coverage remained the same at **97.843%**  ---    |  Totals | [![Coverage Status](https://coveralls.io/builds/75424209/badge)](https://coveralls.io/builds/75424209) | | :-- | --: | | Change from base [Build 17526152671](https://coveralls.io/builds/75423486): |  0.0% | | Covered Lines: | 36515 | | Relevant Lines: | 37320 |  --- ##### 💛  - [Coveralls](https://coveralls.io) 
  > ### Coverage Report  - **Commit:** `60fcd41acd65bba746310e7b1b9dda7941beba32` - **Timestamp:** `2025-09-07T120040Z` - **Report:** [View report](https://gluesql.org/coverage/?path=pr/1773/2025-09-07T120040Z.60fcd41acd65bba746310e7b1b9dda7941beba32.lcov.info.xz)

- **Issue #1761** (2025-09-03): **Fix coverage workflow artifact name**
  *Symptoms*: ## Summary - fix coverage workflow branch name sanitization for artifact upload  ## Testing - `cargo clippy --all-targets -- -D warnings` - `cargo fmt --all` - `cargo test -p gluesql-core --lib`   ------ https://chatgpt.com/codex/tasks/task_e_68b7e704f8b4832abf5bf8ab5f0b215d  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Chores**   * Updated coverage workflow to standardize branch-name formatting during CI.   * Switched coverage artifact naming to use the standardized branch name.   * Result: more consistent, predictable artifact names across branches.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough Adds a new “Sanitize branch name” step to the coverage workflow to compute and export SANITIZED_BRANCH_NAME from BRANCH_NAME by replacing '/' with '-'. Updates the coverage artifact name to reference env.SANITIZED_BRANCH_NAME instead of using an inline replace() expression.  ## Changes | Cohort / File(s) | Summary | |---|---| | **Coverage workflow updates**<br>`.github/workflows/coverage.yml` | Introduces a step that writes SANITIZED_BRANCH_NAME to GITHUB_ENV; replaces inline replace(env.BRANCH_NAME, '/', '-') in artifact naming with env.SANITIZED_BRANCH_NAME. |  ## Sequence Diagram(s) ```mermaid sequenceDiagram     participant Dev as Developer     participant GH as GitHub Actions     participant WF as Coverage Workflow     participant Steps as Steps      Dev->>GH: Push / PR triggers     GH->>WF: Start workflow     WF->>Steps: Set BRANCH_NAME env     Note over Steps: New st
  > ## [Codecov](https://app.codecov.io/gh/gluesql/gluesql/pull/1761?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 97.85%. Comparing base ([`8ea90be`](https://app.codecov.io/gh/gluesql/gluesql/commit/8ea90be80e08712372a5ce1b2018755bffc49243?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)) to head ([`b0e52b6`](https://app.codecov.io/gh/gluesql/gluesql/commit/b0e52b62d1a4803f56e64de340c0c0f7149be384?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)). :warning: Report is 2 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main 

- **Issue #1718** (2025-08-08): **fix(storage-idb): "Arc::try_unwrap failed" on multiple connections**
  *Symptoms*: The `on_upgrade_needed` callback for IndexedDB open requests was holding a reference to an `Arc`, which was not being released when the `IdbStorage` instance was dropped. This caused `Arc::try_unwrap` to fail when a new `IdbStorage` instance was created with the same namespace.  This commit fixes the issue by replacing the `Arc::try_unwrap` logic with a safer approach that locks the mutex and takes the error value. This avoids the panic while still correctly handling errors from the callback.  A test case has been added to reproduce the issue and verify the fix.  Fixes #1717  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Improved error handling for IndexedDB operations to ensure more reliable error extraction and messaging.  * **Tests**   * Added a new test to verify that multiple storage instances can be created with the same namespace.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough  The error extraction logic in the IndexedDB storage implementation was refactored to avoid using `Arc::try_unwrap` and instead directly lock and access the error via `Mutex`. Additionally, a new asynchronous test was added to verify that multiple storage instances with the same namespace can be created sequentially.  ## Changes  | Cohort / File(s)                                            | Change Summary                                                                                   | |-------------------------------------------------------------|--------------------------------------------------------------------------------------------------| | **Error Handling Refactor**<br> `storages/idb-storage/src/lib.rs`      | Refactored error extraction after awaiting IndexedDB open request: replaced `Arc::try_unwrap` with direct `Mutex` locking and `take()`, updated error mes
  > ## [Codecov](https://app.codecov.io/gh/gluesql/gluesql/pull/1718?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 97.94%. Comparing base ([`df18e72`](https://app.codecov.io/gh/gluesql/gluesql/commit/df18e7224e4ffac8d3453ef071990d46d964b943?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)) to head ([`d885dbb`](https://app.codecov.io/gh/gluesql/gluesql/commit/d885dbb10d5f140d76d777957da2e0b6026affed?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)). :warning: Report is 1 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main 
  > ## Pull Request Test Coverage Report for [Build 16802841146](https://coveralls.io/builds/74990826)   ### Details  * **0** of **0**   changed or added relevant lines in **0** files are covered. * No unchanged relevant lines lost coverage. * Overall coverage remained the same at **97.889%**  ---    |  Totals | [![Coverage Status](https://coveralls.io/builds/74990826/badge)](https://coveralls.io/builds/74990826) | | :-- | --: | | Change from base [Build 16793946915](https://coveralls.io/builds/74984952): |  0.0% | | Covered Lines: | 39748 | | Relevant Lines: | 40605 |  --- ##### 💛  - [Coveralls](https://coveralls.io) 

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

### Incident Patch 1: `b95f7691` (2026-09-28)
**Commit Message**: Fix repeated IF NOT EXISTS CTAS inserts (#2044)

When the target table already exists, return before executing the CTAS
source query so rerunning the statement does not append duplicate rows.

**File**: `core/src/executor/alter/table.rs` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ pub fn create_table<T: GStore + GStoreMut>(
         comment,
     }: CreateTableOptions<'_>,
 ) -> Result<()> {
+    if if_not_exists && source.is_some() && storage.fetch_schema(target_table_name)?.is_some() {
+        return Ok(());
+    }
+
     let mut selected_source_rows = None;
     let target_columns_defs = match source.as_deref() {
         Some(source_query) => match query::output_body(source_query) {
```

**File**: `test-suite/fixtures/alter/create_table.sql` (modified, +21/-0)
```diff
@@ -198,6 +198,27 @@ CREATE TABLE TargetTableWithData AS SELECT * FROM CreateTable2
 -- @expect: error Alter.TableAlreadyExists
 -- @json: "TargetTableWithData"
 
+CREATE TABLE IfNotExistsSource (snack TEXT)
+-- @expect: payload Create
+
+INSERT INTO IfNotExistsSource VALUES ('cookie'), ('chips')
+-- @expect: payload Insert
+-- @json: 2
+
+CREATE TABLE IF NOT EXISTS TargetTableIfNotExists AS SELECT * FROM IfNotExistsSource
+-- @expect: payload Create
+
+-- @name: CTAS IF NOT EXISTS leaves an existing table unchanged
+CREATE TABLE IF NOT EXISTS TargetTableIfNotExists AS SELECT * FROM IfNotExistsSource
+-- @expect: payload Create
+
+SELECT * FROM TargetTableIfNotExists
+-- @expect:
+-- | snack: Str |
+-- | ---------- |
+-- | "cookie"   |
+-- | "chips"    |
+
 CREATE TABLE TargetTableWithData2 AS SELECT * FROM NonExistentTable
 -- @expect: error Alter.CtasSourceTableNotFound
 -- @json: "NonExistentTable"
```

---

### Incident Patch 2: `bc185d81` (2026-08-04)
**Commit Message**: Fix schema dependency scanning for ORDER BY expressions (#1982)

Scan every ORDER BY expression when collecting query schema dependencies.

This ensures tables referenced only by scalar subqueries in ORDER BY are included in the schema map. Add regression coverage for single and multiple ordering expressions.

**File**: `core/src/plan/schema.rs` (modified, +27/-2)
```diff
@@ -97,27 +97,36 @@ fn scan_query<T: Store + ?Sized>(
 ) -> Result<HashMap<String, Schema>> {
     let QueryPlan {
         body,
+        order_by,
         limit,
         offset,
-        ..
     } = query;
 
     let schema_list = match body {
         SetExprPlan::Select(select) => scan_select(storage, select)?,
         SetExprPlan::Values(_) => HashMap::new(),
     };
 
+    let order_by = order_by
+        .iter()
+        .map(|order_by| scan_expr(storage, &order_by.expr))
+        .collect::<Result<Vec<HashMap<String, Schema>>>>()?
+        .into_iter()
+        .flatten();
+
     let schema_list = match (limit, offset) {
         (Some(limit), Some(offset)) => schema_list
             .into_iter()
+            .chain(order_by)
             .chain(scan_expr(storage, limit)?)
             .chain(scan_expr(storage, offset)?)
             .collect(),
         (Some(expr), None) | (None, Some(expr)) => schema_list
             .into_iter()
+            .chain(order_by)
             .chain(scan_expr(storage, expr)?)
             .collect(),
-        (None, None) => schema_list,
+        (None, None) => schema_list.into_iter().chain(order_by).collect(),
     };
 
     Ok(schema_list)
@@ -351,6 +360,22 @@ mod tests {
         ",
             &["Bar", "Foo"],
         );
+        test(
+            "
+            SELECT *
+            FROM Foo
+            ORDER BY (SELECT id FROM Bar LIMIT 1);
+        ",
+            &["Bar", "Foo"],
+        );
+        test(
+            "
+            SELECT *
+            FROM Foo
+            ORDER BY id + 1, (SELECT id FROM Bar LIMIT 1);
+        ",
+            &["Bar", "Foo"],
+        );
 
         // PlanExpr::QueryAndExpr
         test(
```

---

### Incident Patch 3: `a155abde` (2026-07-25)
**Commit Message**: Fix CompositeStorage rollback delegation (#1963)

Delegate CompositeStorage::rollback() to rollback() on each inner storage instead of commit(), preventing failed operations from being committed.

**File**: `storages/composite-storage/src/transaction.rs` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ impl Transaction for CompositeStorage {
 
     fn rollback(&mut self) -> Result<()> {
         for storage in self.storages.values_mut() {
-            storage.commit()?;
+            storage.rollback()?;
         }
 
         Ok(())
```

---

### Incident Patch 4: `1a7118d2` (2026-07-19)
**Commit Message**: Migrate SQL test cases to file fixtures (#1941)

Migrate SQL-driven test-suite cases from Rust test bodies to embedded .sql fixture files.

The fixture runner executes each file sequentially against the same storage and compares results through readable SQL comments.
Query builder tests and direct storage API tests remain in Rust, while ordinary SQL, index, transaction, alter table, dictionary, and metadata cases now use a consistent fixture path.

**File**: `Cargo.lock` (modified, +22/-0)
```diff
@@ -1589,8 +1589,11 @@ dependencies = [
  "chrono",
  "gluesql-core",
  "hex",
+ "include_dir",
+ "paste",
  "pretty_assertions",
  "rust_decimal",
+ "serde",
  "serde_json",
  "uuid",
 ]
@@ -1782,6 +1785,25 @@ dependencies = [
  "version_check",
 ]
 
+[[package]]
+name = "include_dir"
+version = "0.7.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "923d117408f1e49d914f1a379a309cffe4f18c05cf4e3d12e613a15fc81bd0dd"
+dependencies = [
+ "include_dir_macros",
+]
+
+[[package]]
+name = "include_dir_macros"
+version = "0.7.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7cab85a7ed0bd5f0e76d93846e0147172bed2e2d3f859bcc33a8d9699cad1a75"
+dependencies = [
+ "proc-macro2",
+ "quote",
+]
+
 [[package]]
 name = "indexmap"
 version = "1.9.3"
```

**File**: `core/src/executor/evaluate/function.rs` (modified, +1/-1)
```diff
@@ -387,7 +387,7 @@ pub fn ifnull<'a>(expr: Evaluated<'a>, then: Evaluated<'a>) -> ControlFlow<Evalu
 }
 
 pub fn nullif<'a>(expr1: Evaluated<'a>, expr2: &Evaluated<'a>) -> ControlFlow<Evaluated<'a>> {
-    Continue(if &expr1 == expr2 {
+    Continue(if expr1.evaluate_eq(expr2).is_true() {
         Evaluated::Value(Cow::Owned(Value::Null))
     } else {
         expr1
```

**File**: `test-suite/Cargo.toml` (modified, +3/-0)
```diff
@@ -14,8 +14,11 @@ bigdecimal = "0.4.10"
 chrono = "0.4.31"
 rust_decimal = "1"
 hex = "0.4"
+include_dir = "0.7"
+paste = "1"
 serde_json = "1.0.91"
 pretty_assertions = "1"
+serde = "1"
 
 [target.'cfg(target_arch = "wasm32")'.dependencies.uuid]
 version = "1"
```

**File**: `test-suite/fixtures/aggregate/avg.sql` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+CREATE TABLE Item (
+    id INTEGER,
+    quantity INTEGER,
+    age INTEGER NULL,
+    total INTEGER
+);
+-- @expect: ok
+
+INSERT INTO Item (id, quantity, age, total) VALUES
+    (1, 10,   11, 1),
+    (2,  0,   90, 2),
+    (3,  9, NULL, 3),
+    (4,  3,    3, 1),
+    (5, 25, NULL, 1);
+-- @expect: ok
+
+SELECT AVG(age) FROM Item
+-- @expect:
+-- | AVG(age) |
+-- | -------- |
+-- | NULL     |
+
+SELECT AVG(id), AVG(quantity) FROM Item
+-- @expect:
+-- | AVG(id): F64 | AVG(quantity): F64 |
+-- | ------------ | ------------------ |
+-- | 3.0          | 9.4                |
+
+SELECT AVG(DISTINCT id) FROM Item
+-- @expect:
+-- | AVG(DISTINCT id): F64 |
+-- | --------------------- |
+-- | 3.0                   |
+
+SELECT AVG(DISTINCT age) FROM Item
+-- @expect:
+-- | AVG(DISTINCT age) |
+-- | ----------------- |
+-- | NULL              |
```

**File**: `test-suite/fixtures/aggregate/count.sql` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+CREATE TABLE Item (
+    id INTEGER,
+    quantity INTEGER NULL,
+    age INTEGER NULL,
+    total INTEGER
+);
+-- @expect: ok
+
+INSERT INTO Item (id, quantity, age, total) VALUES
+    (1, NULL,   11, 1),
+    (2,  0,   90, 2),
+    (3,  9, NULL, 3),
+    (4,  3,    3, 1),
+    (5, 25, NULL, 1),
+    (6, 15,   11, 2),
+    (7, 20,   90, 1),
+    (1, NULL, 11, 1);
+-- @expect: ok
+
+SELECT COUNT(*) FROM Item;
+-- @expect:
+-- | COUNT(*): I64 |
+-- | ------------- |
+-- | 8             |
+
+SELECT COUNT(age), COUNT(quantity) FROM Item;
+-- @expect:
+-- | COUNT(age): I64 | COUNT(quantity): I64 |
+-- | --------------- | -------------------- |
+-- | 6               | 6                    |
+
+SELECT COUNT(NULL);
+-- @expect:
+-- | COUNT(NULL): I64 |
+-- | ---------------- |
+-- | 0                |
+
+SELECT COUNT(DISTINCT id) FROM Item
+-- @expect:
+-- | COUNT(DISTINCT id): I64 |
+-- | ----------------------- |
+-- | 7                       |
+
+SELECT COUNT(DISTINCT age) FROM Item
+-- @expect:
+-- | COUNT(DISTINCT age): I64 |
+-- | ------------------------ |
+-- | 3                        |
+
+SELECT COUNT(age), COUNT(DISTINCT age) FROM Item
+-- @expect:
+-- | COUNT(age): I64 | COUNT(DISTINCT age): I64 |
+-- | --------------- | ------------------------ |
+-- | 6               | 3                        |
+
+SELECT COUNT(DISTINCT *) FROM Item
+-- @expect:
+-- | COUNT(DISTINCT *): I64 |
+-- | ---------------------- |
+-- | 7                      |
+
+CREATE TABLE EmptyItem (id INTEGER NULL);
+-- @expect: ok
+
+SELECT COUNT(*) FROM EmptyItem;
+-- @expect:
+-- | COUNT(*): I64 |
+-- | ------------- |
+-- | 0             |
+
+SELECT COUNT(id) FROM EmptyItem;
+-- @expect:
+-- | COUNT(id): I64 |
+-- | -------------- |
+-- | 0              |
```

---

### Incident Patch 5: `75eeef42` (2026-07-14)
**Commit Message**: Fix primary key predicate planning for joins (#1943)

Restrict primary key lookup optimization to predicates that can be safely bound to the first FROM relation.

Move lookup eligibility out of the shared planner context into a planner-local candidate.
Resolve relation and positional column aliases, reject ambiguous joined-column matches,
and preserve the original WHERE predicate when a primary key access path cannot be installed safely.

Add planner unit coverage for qualified and unqualified predicates, different primary key names,
missing primary keys, alias conflicts, multiple joins, and left outer joins.

**File**: `core/src/plan/context.rs` (modified, +1/-24)
```diff
@@ -4,7 +4,6 @@ pub enum Context<'a> {
     Data {
         alias: String,
         columns: Vec<&'a str>,
-        primary_key: Option<&'a str>,
         next: Option<Rc<Context<'a>>>,
     },
     Bridge {
@@ -14,16 +13,10 @@ pub enum Context<'a> {
 }
 
 impl<'a> Context<'a> {
-    pub fn new(
-        alias: String,
-        columns: Vec<&'a str>,
-        primary_key: Option<&'a str>,
-        next: Option<Rc<Context<'a>>>,
-    ) -> Self {
+    pub fn new(alias: String, columns: Vec<&'a str>, next: Option<Rc<Context<'a>>>) -> Self {
         Context::Data {
             alias,
             columns,
-            primary_key,
             next,
         }
     }
@@ -77,20 +70,4 @@ impl<'a> Context<'a> {
             }
         }
     }
-
-    pub fn contains_primary_key(&self, target_column: &str) -> bool {
-        match self {
-            Self::Data {
-                primary_key: Some(primary_key),
-                ..
-            } if primary_key == &target_column => true,
-            Self::Data { next, .. } => next
-                .as_ref()
-                .is_some_and(|next| next.contains_primary_key(target_column)),
-            Self::Bridge { left, right } => {
-                left.contains_primary_key(target_column)
-                    || right.contains_primary_key(target_column)
-            }
-        }
-    }
 }
```

**File**: `core/src/plan/expr/evaluable.rs` (modified, +2/-4)
```diff
@@ -172,18 +172,16 @@ mod tests {
     #[test]
     fn evaluable() {
         let context = {
-            let left_child = Context::new("Empty".to_owned(), Vec::new(), None, None);
+            let left_child = Context::new("Empty".to_owned(), Vec::new(), None);
             let left = Context::new(
                 "Foo".to_owned(),
                 vec!["id", "name"],
-                None,
                 Some(Rc::new(left_child)),
             );
-            let right_child = Context::new("Src".to_owned(), Vec::new(), None, None);
+            let right_child = Context::new("Src".to_owned(), Vec::new(), None);
             let right = Context::new(
                 "Bar".to_owned(),
                 vec!["id", "rate"],
-                None,
                 Some(Rc::new(right_child)),
             );
 
```

**File**: `core/src/plan/planner.rs` (modified, +2/-13)
```diff
@@ -1,7 +1,7 @@
 use {
     super::context::Context,
     crate::{
-        ast::{ColumnDef, ColumnUniqueOption},
+        ast::ColumnDef,
         data::Schema,
         plan::{ExprPlan, FunctionPlan, QueryPlan, TableAliasPlan, TableFactorPlan},
     },
@@ -227,18 +227,7 @@ pub trait Planner<'a> {
             .map(|ColumnDef { name, .. }| name.as_str())
             .collect::<Vec<_>>();
 
-        let primary_key = column_defs
-            .iter()
-            .find_map(|ColumnDef { name, unique, .. }| {
-                (unique == &Some(ColumnUniqueOption { is_primary: true })).then_some(name.as_str())
-            });
-
-        let context = Context::new(
-            alias.unwrap_or_else(|| name.to_owned()),
-            columns,
-            primary_key,
-            next,
-        );
+        let context = Context::new(alias.unwrap_or_else(|| name.to_owned()), columns, next);
         Some(Rc::new(context))
     }
 }
```

**File**: `core/src/plan/primary_key.rs` (modified, +256/-28)
```diff
@@ -1,4 +1,5 @@
 use {
+    self::lookup::PrimaryKeyLookupCandidate,
     super::{context::Context, planner::Planner},
     crate::{
         ast::BinaryOperator,
@@ -11,6 +12,8 @@ use {
     std::{collections::HashMap, hash::BuildHasher, rc::Rc},
 };
 
+mod lookup;
+
 pub fn plan<S: BuildHasher>(
     schema_map: &HashMap<String, Schema, S>,
     statement: StatementPlan,
@@ -60,18 +63,26 @@ enum PrimaryKey {
 
 impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
     fn select(&self, outer_context: Option<Rc<Context<'a>>>, select: SelectPlan) -> SelectPlan {
-        let current_context = self.update_context(None, &select.from.relation);
+        let first_relation_context = self.update_context(None, &select.from.relation);
+        let lookup_candidate = PrimaryKeyLookupCandidate::new(self.schema_map, &select.from);
         let current_context = select
             .from
             .joins
             .iter()
-            .fold(current_context, |context, join| {
+            .fold(first_relation_context, |context, join| {
                 self.update_context(context, &join.relation)
             });
 
         let (index, selection) = select
             .selection
-            .map(|expr| self.expr(outer_context, current_context, expr))
+            .map(|expr| {
+                self.expr(
+                    outer_context,
+                    current_context,
+                    lookup_candidate.as_ref(),
+                    expr,
+                )
+            })
             .map_or((None, None), |primary_key| match primary_key {
                 PrimaryKey::Found { index_item, expr } => (Some(index_item), expr),
                 PrimaryKey::NotFound(expr) => (None, Some(expr)),
@@ -105,19 +116,9 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
         &self,
         outer_context: Option<Rc<Context<'a>>>,
         current_context: Option<Rc<Context<'a>>>,
+        lookup_candidate: Option<&PrimaryKeyLookupCandidate>,
         expr: ExprPlan,
     ) -> PrimaryKey {
-        let check_primary_key = |key: &ExprPlan| {
-            let (ExprPlan::Identifier(key) | ExprPlan::CompoundIdentifier { ident: key, .. }) = key
-            else {
-                return false;
-            };
-
-            current_context
-                .as_ref()
-                .is_some_and(|context| context.contains_primary_key(key))
-        };
-
         match expr {
             ExprPlan::BinaryOp {
                 left: key,
@@ -128,8 +129,7 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
                 left: value,
                 op: BinaryOperator::Eq,
                 right: key,
-            } if check_primary_key(key.as_ref())
-                && check_evaluable(current_context.as_ref().map(Rc::clone), &key)
+            } if lookup_candidate.is_some_and(|candidate| candidate.contains(key.as_ref()))
                 && check_evaluable(None, &value) =>
             {
                 let index_item = IndexItemPlan::PrimaryKey(*value);
@@ -147,6 +147,7 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
                 let primary_key = self.expr(
                     outer_context.as_ref().map(Rc::clone),
                     current_context.as_ref().map(Rc::clone),
+                    lookup_candidate,
                     *left,
                 );
 
@@ -169,7 +170,7 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
                     PrimaryKey::NotFound(expr) => expr,
                 };
 
-                match self.expr(outer_context, current_context, *right) {
+                match self.expr(outer_context, current_context, lookup_candidate, *right) {
                     PrimaryKey::Found { index_item, expr } => {
                         let expr = match expr {
                             Some(right) => ExprPlan::BinaryOp {
@@ -196,16 +197,18 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
                     }
                 }
             }
-            ExprPlan::Nested(ex
```

**File**: `core/src/plan/primary_key/lookup.rs` (added, +407/-0)
```diff
@@ -0,0 +1,407 @@
+use {
+    crate::{
+        ast::{ColumnDef, ColumnUniqueOption},
+        data::Schema,
+        plan::{ExprPlan, JoinOperatorPlan, TableAliasPlan, TableFactorPlan, TableWithJoinsPlan},
+    },
+    std::{collections::HashMap, hash::BuildHasher},
+};
+
+pub(super) struct PrimaryKeyLookupCandidate {
+    target: PrimaryKeyLookupTarget,
+    joined_relations: Vec<JoinedRelation>,
+}
+
+impl PrimaryKeyLookupCandidate {
+    pub(super) fn new<S: BuildHasher>(
+        schema_map: &HashMap<String, Schema, S>,
+        from: &TableWithJoinsPlan,
+    ) -> Option<Self> {
+        from.joins
+            .iter()
+            .for_each(|join| validate_join_operator(&join.join_operator));
+
+        let target = PrimaryKeyLookupTarget::new(schema_map, &from.relation)?;
+        let joined_relations = from
+            .joins
+            .iter()
+            .map(|join| JoinedRelation::new(schema_map, &join.relation))
+            .collect();
+
+        Some(Self {
+            target,
+            joined_relations,
+        })
+    }
+
+    pub(super) fn contains(&self, key: &ExprPlan) -> bool {
+        match key {
+            ExprPlan::Identifier(column) => {
+                self.target.primary_key_column == *column
+                    && self
+                        .joined_relations
+                        .iter()
+                        .all(|relation| !relation.contains_column(column))
+            }
+            ExprPlan::CompoundIdentifier { alias, ident } => {
+                self.target.matches(alias, ident)
+                    && self
+                        .joined_relations
+                        .iter()
+                        .all(|relation| !relation.contains_aliased_column(alias, ident))
+            }
+            _ => false,
+        }
+    }
+}
+
+fn validate_join_operator(join_operator: &JoinOperatorPlan) {
+    // Keep this exhaustive so new join types require an explicit lookup-safety decision.
+    match join_operator {
+        JoinOperatorPlan::Inner(_) | JoinOperatorPlan::LeftOuter(_) => {}
+    }
+}
+
+struct PrimaryKeyLookupTarget {
+    alias: String,
+    primary_key_column: String,
+}
+
+impl PrimaryKeyLookupTarget {
+    fn new<S: BuildHasher>(
+        schema_map: &HashMap<String, Schema, S>,
+        relation: &TableFactorPlan,
+    ) -> Option<Self> {
+        let TableFactorPlan::Table {
+            name,
+            alias,
+            index: None,
+        } = relation
+        else {
+            return None;
+        };
+        let column_defs = schema_map.get(name)?.column_defs.as_ref()?;
+        let primary_key_index = column_defs.iter().position(|ColumnDef { unique, .. }| {
+            unique == &Some(ColumnUniqueOption { is_primary: true })
+        })?;
+        let columns = effective_columns(column_defs, alias.as_ref())?;
+        let primary_key_column = columns.get(primary_key_index)?;
+        if columns
+            .iter()
+            .position(|column| column == primary_key_column)
+            != Some(primary_key_index)
+        {
+            return None;
+        }
+
+        Some(Self {
+            alias: relation.alias_name().to_owned(),
+            primary_key_column: primary_key_column.clone(),
+        })
+    }
+
+    fn matches(&self, alias: &str, column: &str) -> bool {
+        self.alias == alias && self.primary_key_column == column
+    }
+}
+
+struct JoinedRelation {
+    alias: String,
+    columns: RelationColumns,
+}
+
+impl JoinedRelation {
+    fn new<S: BuildHasher>(
+        schema_map: &HashMap<String, Schema, S>,
+        relation: &TableFactorPlan,
+    ) -> Self {
+        let columns = match relation {
+            TableFactorPlan::Table { name, alias, .. } => schema_map
+                .get(name)
+                .and_then(|schema| schema.column_defs.as_deref())
+                .and_then(|column_defs| effective_columns(column_defs, alias.as_ref()))
+                .map_or(RelationColumns::Unknown, RelationColumn
```

---

### Incident Patch 6: `ad0f9c35` (2026-06-23)
**Commit Message**: Fix outdated Rust docs examples for sync execution (#1934)

This updates README, Query Builder, custom storage, and supported storage examples to use the current sync Rust APIs while keeping JavaScript and Web async examples unchanged.

**File**: `README.md` (modified, +1/-3)
```diff
@@ -41,7 +41,6 @@ let mut glue = Glue::new(storage);
 
 let rows = glue
     .execute("SELECT id, name FROM Foo;")
-    .await
     .rows_as::<Row>()
     .unwrap();
 ```
@@ -62,8 +61,7 @@ table("Foo")
     // Filter by price using Query Builder methods
     .filter(col("price").gt(100))
     .project("id, name")
-    .execute(&mut glue)
-    .await;
+    .execute(&mut glue);
 ```
 
 ## Supporting Structured and Unstructured Data with Schema Flexibility
```

**File**: `docs/docs/articles/breaking-the-boundary-between-sql-and-nosql.md` (modified, +4/-7)
```diff
@@ -41,22 +41,20 @@ table("Glue")
     .create_table()
     .add_column("id INTEGER")
     .add_column("name TEXT")
-    .execute(glue)
+    .execute(glue);
 
 table("Glue")
     .insert()
     .values(vec![
         vec![num(1), text("hello")],
         vec![num(2), text("gluesql")],
     ])
-    .execute(glue)
-    .await;
+    .execute(glue);
 
 table("Glue")
     .select()
     .filter(col("id").eq(1))
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 Let's reconsider the implicit distinction between SQL and NoSQL. GlueSQL indeed supports SQL, but it also officially develops and offers its own query builder. This query builder is not a secondary tool for SQL. While most SQL query builder libraries ultimately generate SQL strings, GlueSQL's builder directly creates execution-facing statement plans, with explicit AST outputs still available where needed. Hence, we call it the Query Builder. This means SQL and the Query Builder are two equally supported interfaces in GlueSQL.
@@ -70,8 +68,7 @@ table("Glue")
     .filter(col("id").eq(1))
     // 2.
     .filter("id = 1")
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 Because GlueSQL already supports SQL, not only can you use the custom interface in the Query Builder, but you can also use familiar SQL syntax in part. Whether you use `col("id").eq(1)` or `"id = 1"`, you can use it in the way you prefer. The Query Builder interface, although initially unfamiliar, allows a gradual migration similar to writing SQL for your convenience.
```

**File**: `docs/docs/index.md` (modified, +1/-2)
```diff
@@ -39,8 +39,7 @@ table("Foo")
     // Filter by price using Query Builder methods
     .filter(col("price").gt(100))
     .project("id, name")
-    .execute(glue)
-    .await;
+    .execute(&mut glue);
 ```
 
 ## Supporting Structured and Unstructured Data with Schema Flexibility
```

**File**: `docs/docs/query-builder/expressions/pattern-matching.md` (modified, +4/-8)
```diff
@@ -21,8 +21,7 @@ let actual = table("Category")
             .like(text("D%"))
             .or(col("name").like(text("M___"))),
     )
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In this example, the query will return all rows from the `Category` table where the `name` column starts with "D" or where the `name` is exactly four characters long and starts with "M".
@@ -41,8 +40,7 @@ let actual = table("Category")
             .ilike(text("D%"))
             .or(col("name").ilike(text("M___"))),
     )
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In this example, the query will return all rows from the `Category` table where the `name` column starts with "D" or "d", or where the `name` is exactly four characters long and starts with "M" or "m".
@@ -61,8 +59,7 @@ let actual = table("Category")
             .not_like(text("D%"))
             .and(col("name").not_like(text("M___"))),
     )
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In this example, the query will return all rows from the `Category` table where the `name` column does not start with "D" and the `name` is not exactly four characters long and does not start with "M".
@@ -81,8 +78,7 @@ let actual = table("Category")
             .not_ilike(text("D%"))
             .and(col("name").not_ilike(text("M___"))),
     )
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In this example, the query will return all rows from the `Category` table where the `name` column does not start with "D" or "d", and the `name` is not exactly four characters long and does not start with "M" or "m".
```

**File**: `docs/docs/query-builder/functions/date-&-time/conversion.md` (modified, +3/-6)
```diff
@@ -17,8 +17,7 @@ let actual = table("Visitor")
     .project("name")
     .project(col("visit_date").to_date("'%Y-%m-%d'"))  // Method 1: Calling the to_date method on a column
     .project(to_date("visit_date", "'%Y-%m-%d'"))  // Method 2: Using the to_date function directly
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Time Conversion - to_time
@@ -34,8 +33,7 @@ let actual = table("Visitor")
     .project("name")
     .project(col("visit_time").to_time("'%H:%M:%S'"))  // Method 1: Calling the to_time method on a column
     .project(to_time("visit_time", "'%H:%M:%S'"))  // Method 2: Using the to_time function directly
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Timestamp Conversion - to_timestamp
@@ -51,6 +49,5 @@ let actual = table("Visitor")
     .project("name")
     .project(col("visit_time_stamp").to_timestamp("'%Y-%m-%d %H:%M:%S'"))  // Method 1: Calling the to_timestamp method on a column
     .project(to_timestamp("visit_time_stamp", "'%Y-%m-%d %H:%M:%S'"))  // Method 2: Using the to_timestamp function directly
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
```

---

### Incident Patch 7: `a6a4cd0f` (2026-06-15)
**Commit Message**: Fix coverage publish metadata trust (#1923)

Stop reading the PR number from the coverage artifact in Publish Coverage.
Resolve PR metadata from the triggering coverage run instead.
Update coverage publishing actions to Node 24-compatible versions.
Remove deprecated/invalid GitHub App token inputs.

**File**: `.github/workflows/publish-coverage.yml` (modified, +101/-50)
```diff
@@ -10,22 +10,14 @@ on:
         description: "Run ID of the triggering Coverage workflow"
         required: true
         type: string
-      pr_number:
-        description: "Pull Request number"
-        required: true
-        type: string
-      commit_sha:
-        description: "Head commit SHA for the PR run"
-        required: true
-        type: string
       artifact_name:
         description: "Artifact name to download (default: coverage)"
         required: false
         default: coverage
         type: string
 
 jobs:
-  publish:
+  resolve:
     if: >-
       (github.event_name == 'workflow_dispatch') ||
       (
@@ -37,57 +29,116 @@ jobs:
     permissions:
       actions: read
       contents: read
+      pull-requests: read
+    outputs:
+      publish_coverage: ${{ steps.metadata.outputs.publish_coverage }}
+      run_id: ${{ steps.metadata.outputs.run_id }}
+      commit_sha: ${{ steps.metadata.outputs.commit_sha }}
+      pr_number: ${{ steps.metadata.outputs.pr_number }}
+      artifact_name: ${{ steps.metadata.outputs.artifact_name }}
     steps:
-      - name: Configure git user
-        run: |
-          git config --global user.email "ci@example.com"
-          git config --global user.name "CI"
-      - name: Create GitHub App token
-        id: app-token
-        uses: actions/create-github-app-token@v1
+      - name: Resolve coverage run metadata
+        id: metadata
+        uses: actions/github-script@v8
         with:
-          app-id: ${{ secrets.COVERAGE_APP_ID }}
-          installation-id: ${{ secrets.COVERAGE_APP_INSTALLATION_ID }}
-          private-key: ${{ secrets.COVERAGE_APP_PRIVATE_KEY }}
-          owner: gluesql
-          repositories: gluesql, gluesql.github.io
-      - name: Set variables for workflow_dispatch
-        if: github.event_name == 'workflow_dispatch'
-        run: |
-          echo "RUN_ID=${{ inputs.run_id }}" >> $GITHUB_ENV
-          echo "COMMIT_SHA=${{ inputs.commit_sha }}" >> $GITHUB_ENV
-          echo "PR_NUMBER=${{ inputs.pr_number }}" >> $GITHUB_ENV
-          echo "ARTIFACT_NAME=${{ inputs.artifact_name }}" >> $GITHUB_ENV
-      - name: Set variables for workflow_run
-        if: github.event_name == 'workflow_run'
-        run: |
-          echo "RUN_ID=${{ github.event.workflow_run.id }}" >> $GITHUB_ENV
-          echo "COMMIT_SHA=${{ github.event.workflow_run.head_sha }}" >> $GITHUB_ENV
-          echo "ARTIFACT_NAME=coverage" >> $GITHUB_ENV
+          script: |
+            const owner = context.repo.owner;
+            const repo = context.repo.repo;
+            const isDispatch = context.eventName === 'workflow_dispatch';
+
+            let run;
+            let artifactName = 'coverage';
+
+            if (isDispatch) {
+              const inputs = context.payload.inputs || {};
+              const runId = inputs.run_id;
+              artifactName = inputs.artifact_name || artifactName;
+
+              const response = await github.rest.actions.getWorkflowRun({
+                owner,
+                repo,
+                run_id: runId,
+              });
+              run = response.data;
+            } else {
+              run = context.payload.workflow_run;
+            }
+
+            const headSha = run.head_sha;
+            const headBranch = run.head_branch;
+            const headRepository = run.head_repository?.full_name;
+
+            if (!headRepository || !headBranch) {
+              throw new Error(`Missing head repository or branch for coverage run ${run.id}`);
+            }
+
+            const [headOwner] = headRepository.split('/');
+            const response = await github.rest.pulls.list({
+              owner,
+              repo,
+              base: 'main',
+              head: `${headOwner}:${headBranch}`,
+              state: 'open',
+            });
+
+            if (response.data.length !== 1) {
+              throw new Error(`Expected one pull request for coverage run ${run.id}, found ${response.data.le
```

#### Recent Merged Pull Requests:
- **PR #2045** (2026-09-30): Update JavaScript getting started guide for OPFS entry points (@juhee200)
- **PR #2044** (2026-09-28): Make IF NOT EXISTS CTAS a no-op for existing tables (@zmrdltl)
- **PR #2043** (2026-09-28): Avoid planning defaults during foreign key validation (@zmrdltl)
- **PR #2042** (2026-09-27): Remove unused sqlparser serde feature (@zmrdltl)
- **PR #2039** (2026-09-28): Reject DELETE with multiple tables in FROM (@chiliec)
- **PR #2038** (2026-09-27): Plan column defaults before execution (@panarch)
- **PR #2036** (2026-09-27): Make `GLUE_OBJECTS` metadata columns dynamic (@zmrdltl)
- **PR #2031** (2026-09-27): Test batched `Glue::execute` planning against earlier DDL (@sweetpark)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
