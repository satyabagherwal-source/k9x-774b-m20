# Forensic Learning Record (Deep Inspection): skytable/skytable

> **Canonical Artifact**: `07_PROJECT_LEARNING/skytable-skytable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skytable/skytable](https://github.com/skytable/skytable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:15:31.238Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skytable/skytable`
- **Description**: Skytable is a modern scalable NoSQL database with BlueQL, designed for performance, scalability and flexibility. Skytable gives you spaces, models, data types, complex collections and more to build powerful experiences
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2660 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/args.rs`
```
/*
 * Created on Wed Nov 15 2023
 *
 * This file is a part of Skytable
 * Skytable (formerly known as TerrabaseDB or Skybase) is a free and open-source
 * NoSQL database written by Sayan Nandan ("the Author") with the
 * vision to provide flexibility in data modelling without compromising
 * on performance, queryability or scalability.
 *
 * Copyright (c) 2023, Sayan Nandan <ohsayan@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
*/

use {
    crate::error::{CliError, CliResult},
    crossterm::{
        event::{self, Event, KeyCode, KeyEventKind, KeyModifiers},
        terminal,
    },
    libsky::{
        cli_utils::{CliCommand, CliCommandData, CommandLineArgs, SingleOption},
        variables::env_vars,
    },
    std::{
        env, fs,
        io::{self, Write},
        process::exit,
    },
};

const TXT_HELP: &str = include_str!(concat!(env!("OUT_DIR"), "/skysh"));

#[derive(Debug)]
pub struct ClientConfig {
    pub kind: EndpointConfig,
    pub username: String,
    pub password: String,
}

impl ClientConfig {
    pub fn new(kind: EndpointConfig, username: String, password: String) -> Self {
        Self {
            kind,
            username,
            password,
        }
    }
}

#[derive(Debug)]
pub enum EndpointConfig {
    Tcp(String, u16),
    Tls(String, u16, String),
}

#[derive(Debug)]
pub enum Task {
    HelpMessage(String),
    OpenShell(ClientConfig),
    ExecOnce(ClientConfig, String),
}

enum TaskInner {
    HelpMsg(String),
    OpenShell(CliCommandData<SingleOption>),
}

fn load_env() -> CliResult<TaskInner> {
    let action = CliCommand::<SingleOption>::from_cli()?;
    match action {
        CliCommand::Help(_) => Ok(TaskInner::HelpMsg(TXT_HELP.to_string())),
        CliCommand::Version(_) => Ok(TaskInner::HelpMsg(libsky::version_msg("skysh"))),
        CliCommand::Run(a) => Ok(TaskInner::OpenShell(a)),
    }
}

pub fn parse() -> CliResult<Task> {
    let mut args = match load_env()? {
        TaskInner::HelpMsg(msg) => return Ok(Task::HelpMessage(msg)),
        TaskInner::OpenShell(args) => args,
    };
    let (endpoint, tls_cert, user, password, eval, e) =
        libsky::take_many_options!(args => "endpoint", "tls-cert", "user", "password", "eval", "e");
    let endpoint = match endpoint? {
        None => EndpointConfig::Tcp("127.0.0.1".to_string(), 2003),
        Some(ep) => {
            // should be in the format protocol@host:port
            let proto_host_port: Vec<&str> = ep.split("@").collect();
            if proto_host_port.len() != 2 {
                return Err(CliError::ArgsErr(
                    "invalid value for --endpoint".to_string(),
                ));
            }
            let (protocol, host_port) = (proto_host_port[0], proto_host_port[1]);
            let host_port: Vec<&str> = host_port.split(":").collect();
            if host_port.len() != 2 {
                return Err(CliError::ArgsErr(
                    "invalid value for --endpoint".to_string(),
                ));
            }
            let (host, port) = (host_port[0], host_port[1]);
            let port = match port.parse::<u16>() {
                Ok(port) => port,
                Err(e) => {
                    return Err(CliError::ArgsErr(format!(
                        "invalid value for endpoint port. {e}"
                    )))
                }
            };
            match protocol {
                "tcp" => {
                    // TODO(@ohsayan): warn!
                    EndpointConfig::Tcp(host.to_string(), port)
                }
                "tls" => {
                    let tls_cert = tls_cert?;
                    // we need a TLS cert
                    match tls_cert {
                        Some(path) => {
                            let cert = fs::read_to_string(path)?;
                            EndpointConfig::Tls(host.to_string(), port, cert)
                        }
                        None => {
                            return Err(CliError::ArgsErr(format!(
                                "must provide TLS cert when using TLS endpoint"
                            )))
                        }
                    }
                }
                _ => {
                    return Err(CliError::ArgsErr(format!(
                        "unknown protocol scheme `{protocol}`"
                    )))
                }
            }
        }
    };
    let username = match user? {
        Some(u) => u,
        None => {
            // default
            "root".to_string()
        }
    };
    let password = match password? {
        Some(p) => check_password(p, "cli arguments")?,
        None => {
            // let us check the environment variable to see if anything was set
            match env::var(env_vars::SKYDB_PASSWORD) {
                Ok(v) => check_password(v, "env")?,
                Err(_) => check_password(read_password("Enter password: ")?, "env")?,
            }
        }
    };
    let eval = match eval? {
        Some(v) => Some(v),
        None => e?,
    };
    args.ensure_empty()?;
    let client = ClientConfig::new(endpoint, username, password);
    match eval {
        Some(query) => Ok(Task::ExecOnce(client, query)),
        None => Ok(Task::OpenShell(client)),
    }
}

fn check_password(p: String, source: &str) -> CliResult<String> {
    if p.is_empty() {
        return Err(CliError::ArgsErr(format!(
            "password value cannot be empty (currently set via {source})"
        )));
    } else {
        Ok(p)
    }
}

pub fn read_password(prompt: &str) -> Result<String, io::Error> {
    print!("{prompt}");
    io::stdout().flush()?;
    terminal::enable_raw_mode()?;
    let mut password = String::new();
    let result = (|| {
        loop {
            if let Event::Key(key_event) = event::read()? {
                if key_event.kind != KeyEventKind::Press {
                    continue;
                }
                if key_event.code == KeyCode::Char('c')
                    && key_event.modifiers.contains(KeyModifiers::CONTROL)
                {
                    terminal::disable_raw_mode()?;
                    println!();
                    exit(0x00)
                }
                match key_event.code {
                    KeyCode::Enter => break,
                    KeyCode::Backspace => {
                        password.pop();
                    }
                    KeyCode::Char(c) => {
                        password.push(c);
                    }
                    _ => {}
                }
            }
        }
        Ok(password)
    })();
    terminal::disable_raw_mode()?;
    println!();
    result
}

```

### Core Architecture Module: `cli/src/error.rs`
```
/*
 * Created on Wed Nov 15 2023
 *
 * This file is a part of Skytable
 * Skytable (formerly known as TerrabaseDB or Skybase) is a free and open-source
 * NoSQL database written by Sayan Nandan ("the Author") with the
 * vision to provide flexibility in data modelling without compromising
 * on performance, queryability or scalability.
 *
 * Copyright (c) 2023, Sayan Nandan <ohsayan@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
*/

use core::fmt;

pub type CliResult<T> = Result<T, CliError>;

#[derive(Debug)]
pub enum CliError {
    QueryError(String),
    ArgsErr(String),
    ClientError(skytable::error::Error),
    IoError(std::io::Error),
    OtherError(&'static str),
}

impl From<libsky::cli_utils::CliArgsError> for CliError {
    fn from(value: libsky::cli_utils::CliArgsError) -> Self {
        Self::ArgsErr(value.to_string())
    }
}

impl From<skytable::error::Error> for CliError {
    fn from(cle: skytable::error::Error) -> Self {
        Self::ClientError(cle)
    }
}

impl From<std::io::Error> for CliError {
    fn from(ioe: std::io::Error) -> Self {
        Self::IoError(ioe)
    }
}

impl fmt::Display for CliError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ArgsErr(e) => write!(f, "incorrect arguments. {e}"),
            Self::ClientError(e) => write!(f, "client error. {e}"),
            Self::IoError(e) => write!(f, "i/o error. {e}"),
            Self::QueryError(e) => write!(f, "invalid query. {e}"),
            Self::OtherError(e) => write!(f, "{e}"),
        }
    }
}

```

### Core Architecture Module: `cli/src/main.rs`
```
/*
 * Created on Wed Nov 15 2023
 *
 * This file is a part of Skytable
 * Skytable (formerly known as TerrabaseDB or Skybase) is a free and open-source
 * NoSQL database written by Sayan Nandan ("the Author") with the
 * vision to provide flexibility in data modelling without compromising
 * on performance, queryability or scalability.
 *
 * Copyright (c) 2023, Sayan Nandan <ohsayan@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
*/

macro_rules! fatal {
    ($($arg:tt)*) => {{
        eprintln!($($arg)*);
        std::process::exit(0x01);
    }}
}

mod args;
mod error;
mod query;
mod repl;
mod resp;

use {args::Task, query::Parameterizer};

fn main() {
    match run() {
        Ok(()) => {}
        Err(e) => fatal!("cli error: {e}"),
    }
}

fn run() -> error::CliResult<()> {
    match args::parse()? {
        Task::HelpMessage(msg) => println!("{msg}"),
        Task::OpenShell(cfg) => repl::start(cfg)?,
        Task::ExecOnce(cfg, query) => {
            let query = Parameterizer::new(query).parameterize()?.into_query();
            let resp = query::connect(
                cfg,
                false,
                |mut c| Ok(c.query(&query)),
                |mut c| Ok(c.query(&query)),
            )??;
            resp::format_response(resp, false, false);
        }
    }
    Ok(())
}

```

### Core Architecture Module: `cli/src/query.rs`
```
/*
 * Created on Thu Nov 16 2023
 *
 * This file is a part of Skytable
 * Skytable (formerly known as TerrabaseDB or Skybase) is a free and open-source
 * NoSQL database written by Sayan Nandan ("the Author") with the
 * vision to provide flexibility in data modelling without compromising
 * on performance, queryability or scalability.
 *
 * Copyright (c) 2023, Sayan Nandan <ohsayan@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
*/

use {
    crate::{
        args::{ClientConfig, EndpointConfig},
        error::{CliError, CliResult},
    },
    skytable::{
        error::ClientResult, query::SQParam, response::Response, Config, Connection, ConnectionTls,
        Query,
    },
};

pub fn connect<T>(
    cfg: ClientConfig,
    print_con_info: bool,
    tcp_f: impl Fn(Connection) -> CliResult<T>,
    tls_f: impl Fn(ConnectionTls) -> CliResult<T>,
) -> CliResult<T> {
    match cfg.kind {
        EndpointConfig::Tcp(host, port) => {
            let c = Config::new(&host, port, &cfg.username, &cfg.password).connect()?;
            if print_con_info {
                println!(
                    "Authenticated as '{}' on {}:{} over Skyhash/TCP\n---",
                    &cfg.username, &host, &port
                );
            }
            tcp_f(c)
        }
        EndpointConfig::Tls(host, port, cert) => {
            let c = Config::new(&host, port, &cfg.username, &cfg.password).connect_tls(&cert)?;
            if print_con_info {
                println!(
                    "Authenticated as '{}' on {}:{} over Skyhash/TLS\n---",
                    &cfg.username, &host, &port
                );
            }
            tls_f(c)
        }
    }
}

pub trait IsConnection {
    fn execute_query(&mut self, q: Query) -> ClientResult<Response>;
}

impl IsConnection for Connection {
    fn execute_query(&mut self, q: Query) -> ClientResult<Response> {
        self.query(&q)
    }
}

impl IsConnection for ConnectionTls {
    fn execute_query(&mut self, q: Query) -> ClientResult<Response> {
        self.query(&q)
    }
}

#[derive(Debug, PartialEq)]
enum Item {
    UInt(u64),
    SInt(i64),
    Float(f64),
    String(String),
    Bin(Vec<u8>),
}

impl SQParam for Item {
    fn append_param(&self, buf: &mut Vec<u8>) -> usize {
        match self {
            Item::UInt(u) => u.append_param(buf),
            Item::SInt(s) => s.append_param(buf),
            Item::Float(f) => f.append_param(buf),
            Item::String(s) => s.append_param(buf),
            Item::Bin(b) => SQParam::append_param(&*b, buf),
        }
    }
}

pub struct Parameterizer {
    buf: Vec<u8>,
    i: usize,
    params: Vec<Item>,
    query: Vec<u8>,
}

#[derive(Debug, PartialEq)]
pub enum ExecKind {
    Standard(Query),
    UseSpace(Query, String),
    UseNull(Query),
    PrintSpecial(Query),
}

impl ExecKind {
    pub fn into_query(self) -> Query {
        match self {
            Self::Standard(q) | Self::UseSpace(q, _) | Self::UseNull(q) | Self::PrintSpecial(q) => {
                q
            }
        }
    }
}

impl Parameterizer {
    pub fn new(q: String) -> Self {
        Self {
            buf: q.into_bytes(),
            i: 0,
            params: vec![],
            query: vec![],
        }
    }
    pub fn parameterize(mut self) -> CliResult<ExecKind> {
        while self.not_eof() {
            match self.buf[self.i] {
                b if b.is_ascii_alphabetic() || b == b'_' => self.read_ident(),
                b if b.is_ascii_digit() => self.read_unsigned_integer(),
                b'-' => self.read_signed_integer(),
                quote_style @ (b'"' | b'\'') => {
                    self.i += 1;
                    self.read_string(quote_style)
                }
                b'`' => {
                    self.i += 1;
                    self.read_binary()
                }
                sym => {
                    self.i += 1;
                    Vec::push(&mut self.query, sym);
                    Ok(())
                }
            }?
        }
        match String::from_utf8(self.query) {
            Ok(qstr) => {
                let mut q = Query::new(&qstr);
                self.params.into_iter().for_each(|p| {
                    q.push_param(p);
                });
                Ok(if qstr.eq_ignore_ascii_case("use null") {
                    ExecKind::UseNull(q)
                } else {
                    if qstr.len() > 8 {
                        let qstr = &qstr[..8];
                        if qstr.eq_ignore_ascii_case("inspect ") {
                            return Ok(ExecKind::PrintSpecial(q));
                        }
                    }
                    let mut splits = qstr.split_ascii_whitespace();
                    let tok_use = splits.next();
                    let tok_name = splits.next();
                    match (tok_use, tok_name) {
                        (Some(tok_use), Some(tok_name))
                            if tok_use.eq_ignore_ascii_case("use")
                                && !tok_name.eq_ignore_ascii_case("$current") =>
                        {
                            ExecKind::UseSpace(q, tok_name.into())
                        }
                        _ => ExecKind::Standard(q),
                    }
                })
            }
            Err(_) => Err(CliError::QueryError("query is not valid UTF-8".into())),
        }
    }
    fn read_string(&mut self, quote_style: u8) -> CliResult<()> {
        self.query.push(b'?');
        let mut string = Vec::new();
        let mut terminated = false;
        while self.not_eof() && !terminated {
            let b = self.buf[self.i];
            if b == b'\\' {
                self.i += 1;
                // escape sequence
                if self.i == self.buf.len() {
                    // string was not terminated
                    return Err(CliError::QueryError("string not terminated".into()));
                }
                match self.buf[self.i] {
                    b'\\' => {
                        // escaped \
                        string.push(b'\\');
                    }
                    b if b == quote_style => {
                        // escape quote
                        string.push(quote_style);
                    }
                    _ => return Err(CliError::QueryError("unknown escape sequence".into())),
                }
            }
            if b == quote_style {
                terminated = true;
            } else {
                string.push(b);
            }
            self.i += 1;
        }
        if terminated {
            match String::from_utf8(string) {
                Ok(s) => self.params.push(Item::String(s)),
                Err(_) => return Err(CliError::QueryError("invalid UTF-8 string".into())),
            }
            Ok(())
        } else {
            return Err(CliError::QueryError("string not terminated".into()));
        }
    }
    fn read_ident(&mut self) -> CliResult<()> {
        // we're looking at an ident
        let start = self.i;
        self.i += 1;
        while self.not_eof() {
            if self.buf[self.i].is_ascii_alphanumeric() || self.buf[self.i] == b'_' {
                self.i += 1;
            } else {
                break;
            }
        }
        let stop = self.i;
        self.query.extend(&self.buf[start..stop]);
        
```

### Core Architecture Module: `cli/src/repl.rs`
```
/*
 * Created on Thu Nov 16 2023
 *
 * This file is a part of Skytable
 * Skytable (formerly known as TerrabaseDB or Skybase) is a free and open-source
 * NoSQL database written by Sayan Nandan ("the Author") with the
 * vision to provide flexibility in data modelling without compromising
 * on performance, queryability or scalability.
 *
 * Copyright (c) 2023, Sayan Nandan <ohsayan@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
*/

use {
    crate::{
        args::ClientConfig,
        error::{CliError, CliResult},
        query::{self, ExecKind, IsConnection},
        resp,
    },
    crossterm::{cursor, execute, terminal},
    rustyline::{config::Configurer, error::ReadlineError, DefaultEditor},
    std::{
        env,
        io::{stdout, ErrorKind},
        path::PathBuf,
    },
};

const SKYSH_HISTORY_FILE: &str = ".sky_history";
const VAR_SKYSH_HISTORY_FILE_PATH: &str = "SKYSH_HISTORY_FILE";
const TXT_WELCOME: &str = include_str!("../help_text/welcome");

pub fn start(cfg: ClientConfig) -> CliResult<()> {
    query::connect(cfg, true, repl, repl)
}

fn repl<C: IsConnection>(mut con: C) -> CliResult<()> {
    let history_file_path = {
        match env::var_os(VAR_SKYSH_HISTORY_FILE_PATH).map(PathBuf::from) {
            Some(path) => path,
            None => {
                let mut home_directory = libsky::utils::get_home_dir()
                    .ok_or(CliError::OtherError("could not find home directory"))?;
                home_directory.push(SKYSH_HISTORY_FILE);
                home_directory
            }
        }
    };
    let init_editor = || {
        let mut editor = DefaultEditor::new()?;
        editor.set_auto_add_history(true);
        editor.set_history_ignore_dups(true)?;
        editor.bind_sequence(
            rustyline::KeyEvent(
                rustyline::KeyCode::BracketedPasteStart,
                rustyline::Modifiers::NONE,
            ),
            rustyline::Cmd::Noop,
        );
        match editor.load_history(&history_file_path) {
            Ok(()) => {}
            Err(e) => match e {
                ReadlineError::Io(ref ioe) => match ioe.kind() {
                    ErrorKind::NotFound => {
                        println!("{TXT_WELCOME}");
                    }
                    _ => return Err(e),
                },
                e => return Err(e),
            },
        }
        rustyline::Result::Ok(editor)
    };
    let mut editor = match init_editor() {
        Ok(e) => e,
        Err(e) => fatal!("error: failed to init REPL. {e}"),
    };
    let mut prompt = "> ".to_owned();
    loop {
        match editor.readline(&prompt) {
            Ok(line) => match line.as_str() {
                "!help" => println!("{TXT_WELCOME}"),
                "exit" => break,
                "clear" => clear_screen()?,
                _ => {
                    if line.is_empty() {
                        continue;
                    }
                    match query::Parameterizer::new(line).parameterize() {
                        Ok(q) => {
                            let mut new_prompt = None;
                            let mut special = false;
                            let q = match q {
                                ExecKind::Standard(q) => q,
                                ExecKind::UseNull(q) => {
                                    new_prompt = Some("> ".into());
                                    q
                                }
                                ExecKind::UseSpace(q, space) => {
                                    new_prompt = Some(format!("{space}> "));
                                    q
                                }
                                ExecKind::PrintSpecial(q) => {
                                    special = true;
                                    q
                                }
                            };
                            if resp::format_response(con.execute_query(q)?, special, true) {
                                if let Some(pr) = new_prompt {
                                    prompt = pr;
                                }
                            }
                        }
                        Err(e) => match e {
                            CliError::QueryError(e) => {
                                eprintln!("[skysh error]: bad query. {e}");
                                continue;
                            }
                            _ => return Err(e),
                        },
                    };
                }
            },
            Err(e) => match e {
                ReadlineError::Interrupted | ReadlineError::Eof => {
                    // done
                    break;
                }
                e => fatal!("error: failed to read line REPL. {e}"),
            },
        }
    }
    editor
        .save_history(&history_file_path)
        .expect("failed to save history");
    println!("Goodbye!");
    Ok(())
}

fn clear_screen() -> std::io::Result<()> {
    let mut stdout = stdout();
    execute!(stdout, terminal::Clear(terminal::ClearType::All))?;
    execute!(stdout, cursor::MoveTo(0, 0))
}

```

### Core Architecture Module: `cli/src/resp.rs`
```
/*
 * Created on Thu Nov 16 2023
 *
 * This file is a part of Skytable
 * Skytable (formerly known as TerrabaseDB or Skybase) is a free and open-source
 * NoSQL database written by Sayan Nandan ("the Author") with the
 * vision to provide flexibility in data modelling without compromising
 * on performance, queryability or scalability.
 *
 * Copyright (c) 2023, Sayan Nandan <ohsayan@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
*/

use {
    crossterm::style::Stylize,
    skytable::response::{Response, Row, Value},
};

macro_rules! pprint {
    ($pretty:expr, $base:literal$(.$f:ident())*) => {
        if $pretty {
            let pretty = $base$(.$f())*;
            println!("{}", pretty);
        } else {
            println!("{}", $base);
        }
    }
}

pub fn format_response(resp: Response, print_special: bool, in_repl: bool) -> bool {
    match resp {
        Response::Empty => {
            if in_repl {
                println!("{}", "(Okay)".cyan())
            }
            // for empty responses outside the repl, it's equivalent to an exit 0, so we don't output anything to stdout or stderr
        }
        Response::Error(e) => {
            if in_repl {
                println!("{}", format!("(server error code: {e})").red());
            } else {
                // outside the repl, just write the error code to stderr. note, the query was technically "successful" because the server received it
                // and responded to it. but on the application end, it was not. so, no need for a nonzero exit code
                eprintln!("{e}");
            }
            return false;
        }
        Response::Value(v) => {
            print_value(v, print_special, in_repl);
            println!();
        }
        Response::Row(r) => {
            print_row(r, in_repl);
            println!();
        }
        Response::Rows(rows) => {
            if rows.is_empty() {
                pprint!(in_repl, "[0 rows returned]".grey().italic());
            } else {
                for (i, row) in rows.into_iter().enumerate().map(|(i, r)| (i + 1, r)) {
                    if in_repl {
                        let fmt = format!("({i}) ").grey().italic();
                        print!("{fmt}")
                    }
                    print_row(row, in_repl);
                    println!();
                }
            }
        }
    };
    true
}

fn print_row(r: Row, pretty_format: bool) {
    if pretty_format {
        print!("(");
    }
    let mut columns = r.into_values().into_iter().peekable();
    while let Some(cell) = columns.next() {
        print_value(cell, false, pretty_format);
        if columns.peek().is_some() {
            if pretty_format {
                print!(", ");
            } else {
                print!(",");
            }
        }
    }
    if pretty_format {
        print!(")");
    }
}

fn print_value(v: Value, print_special: bool, in_repl: bool) {
    match v {
        Value::Null => pprint!(in_repl, "null".grey().italic()),
        Value::String(s) => print_string(&s, print_special, in_repl),
        Value::Binary(b) => print_binary(&b, !in_repl),
        Value::Bool(b) => print!("{b}"),
        Value::UInt8(i) => print!("{i}"),
        Value::UInt16(i) => print!("{i}"),
        Value::UInt32(i) => print!("{i}"),
        Value::UInt64(i) => print!("{i}"),
        Value::SInt8(i) => print!("{i}"),
        Value::SInt16(i) => print!("{i}"),
        Value::SInt32(i) => print!("{i}"),
        Value::SInt64(i) => print!("{i}"),
        Value::Float32(f) => print!("{f}"),
        Value::Float64(f) => print!("{f}"),
        Value::List(items) => {
            print!("[");
            let mut items = items.into_iter().peekable();
            while let Some(item) = items.next() {
                print_value(item, print_special, in_repl);
                if items.peek().is_some() {
                    print!(", ");
                }
            }
            print!("]");
        }
    }
}

fn print_binary(b: &[u8], escape: bool) {
    let mut it = b.into_iter().peekable();
    if escape {
        print!("\"[");
    } else {
        print!("[");
    }
    while let Some(byte) = it.next() {
        print!("{byte}");
        if it.peek().is_some() {
            if escape {
                print!(",");
            } else {
                print!(", ");
            }
        }
    }
    if escape {
        print!("]\"");
    } else {
        print!("]");
    }
}

fn print_string(s: &str, print_special: bool, pretty_format: bool) {
    if print_special {
        if pretty_format {
            print!("{}", s.italic().grey());
        }
    } else {
        print!("\"");
        for ch in s.chars() {
            if ch == '"' {
                print!("\\{ch}");
            } else if ch == '\t' {
                print!("\\t");
            } else if ch == '\n' {
                print!("\\n");
            } else {
                print!("{ch}");
            }
        }
        print!("\"");
    }
}

```

### Core Architecture Module: `harness/src/audit.rs`
```
/*
 * This file is a part of Skytable
 *
 * Skytable (formerly known as TerrabaseDB or Skybase) is a free and open-source
 * NoSQL database written by Sayan Nandan ("the Author") with the
 * vision to provide flexibility in data modelling without compromising
 * on performance, queryability or scalability.
 *
 * Copyright (c) 2024, Sayan Nandan <nandansayan@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
*/

use {
    crate::{error::HarnessResult, util},
    std::process::Command,
};

pub fn audit() -> HarnessResult<()> {
    const ENVS_LEAK_STRICT: [(&'static str, &'static str); 2] = [
        ("MIRIFLAGS", "-Zmiri-tree-borrows -Zmiri-disable-isolation"),
        (
            "RUSTFLAGS",
            "-A dead_code -A unused_imports -A unused_macros",
        ),
    ];
    const ENVS_LEAK_PERMISSIVE: [(&'static str, &'static str); 2] = [
        (
            "MIRIFLAGS",
            "-Zmiri-tree-borrows -Zmiri-disable-isolation -Zmiri-ignore-leaks",
        ),
        (
            "RUSTFLAGS",
            "-A dead_code -A unused_imports -A unused_macros",
        ),
    ];
    let mut miri_args = vec!["miri".to_owned(), "test".to_owned()];
    if let Some(t) = util::get_var(util::VAR_TARGET) {
        miri_args.push("--target".to_owned());
        miri_args.push(t);
    }
    miri_args.push("-p".to_owned());
    miri_args.push("skyd".to_owned());
    {
        // non-leaky test
        let mut cmd = Command::new("cargo");
        cmd.args(&miri_args).envs(ENVS_LEAK_STRICT);
        util::handle_child(&format!("audit skyd using miri (leak-strict)"), cmd)?;
    }
    {
        // leaky test
        let mut cmd = Command::new("cargo");
        cmd.args(&miri_args)
            .arg("--features=miri-leaks")
            .envs(ENVS_LEAK_PERMISSIVE);
        util::handle_child(&format!("audit skyd using miri (leak-permissive)"), cmd)?;
    }
    info!("successfully completed audit of skyd (miri)");
    Ok(())
}

```

### Core Architecture Module: `harness/src/bundle.rs`
```
/*
 * Created on Thu Mar 17 2022
 *
 * This file is a part of Skytable
 * Skytable (formerly known as TerrabaseDB or Skybase) is a free and open-source
 * NoSQL database written by Sayan Nandan ("the Author") with the
 * vision to provide flexibility in data modelling without compromising
 * on performance, queryability or scalability.
 *
 * Copyright (c) 2022, Sayan Nandan <ohsayan@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
*/

use {
    crate::{
        build::{self, BuildMode},
        util, HarnessError, HarnessResult,
    },
    libsky::variables::VERSION,
    std::{
        fs,
        io::{Read, Write},
        path::{Path, PathBuf},
    },
    zip::{write::SimpleFileOptions, ZipWriter},
};

/// Returns the bundle name
pub fn get_bundle_name() -> String {
    let mut filename = format!("sky-bundle-v{VERSION}");
    if let Some(artifact) = util::get_var(util::VAR_ARTIFACT) {
        filename.push('-');
        filename.push_str(&artifact);
    }
    filename.push_str(".zip");
    filename
}

/// Create a bundle using the provided mode
pub fn bundle(mode: BuildMode) -> HarnessResult<()> {
    let target_folder = build::build(mode)?;
    // now package
    package_binaries(target_folder, mode)?;
    Ok(())
}

/// Package the binaries into a ZIP file
fn package_binaries(target_folder: PathBuf, mode: BuildMode) -> HarnessResult<()> {
    // get the file index
    let file_index = build::get_files_index(&target_folder);
    // get the bundle file name
    let bundle_file_name = get_bundle_name();
    // create the bundle file
    let bundle_file = fs::File::create(&bundle_file_name)
        .map_err(|e| HarnessError::Other(format!("Failed to create ZIP file with error: {e}")))?;
    // init zip writer
    let mut zip = ZipWriter::new(bundle_file);
    // create a temp buffer
    let mut buffer = Vec::new();
    // ZIP settings
    let options = SimpleFileOptions::default()
        .unix_permissions(0o755)
        .compression_method(mode.get_compression_method());
    for file in file_index {
        let path = file.as_path();
        let name = path.strip_prefix(Path::new(&target_folder)).unwrap();
        #[allow(deprecated)]
        zip.start_file_from_path(name, options).unwrap();
        let mut f = fs::File::open(path).map_err(|e| {
            HarnessError::Other(format!(
                "Failed to add file `{}` to ZIP with error: {e}",
                path.to_string_lossy()
            ))
        })?;
        f.read_to_end(&mut buffer).unwrap();
        zip.write_all(&buffer).unwrap();
        buffer.clear();
    }
    zip.finish().unwrap();
    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #393** (2026-09-28): **ci: avoid installs on self-hosted**
  *Symptoms*: --- ✔️ By submitting this pull request, I agree to the CLA at: [https://cla.skytable.io/skytable/skytable](https://cla.skytable.io/skytable/skytable) 

- **Issue #392** (2026-09-26): **maintenance patch: 0.8.x patch1**
  *Symptoms*: We're about to close the 0.8.x branch and put it into maintenance only mode. This PR adds some final patches before the freeze.  Closes #352. Fixes #376.  --- ✔️ By submitting this pull request, I agree to the CLA at: [https://cla.skytable.io/skytable/skytable](https://cla.skytable.io/skytable/skytable) 
  **Post-Mortem & Fix Analysis**:
  > Waiting on msvc check
  > No need to wait for CI. 

- **Issue #391** (2026-09-26): **build(deps): bump openssl from 0.10.68 to 0.10.78**
  *Symptoms*: Bumps [openssl](https://github.com/rust-openssl/rust-openssl) from 0.10.68 to 0.10.78. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/rust-openssl/rust-openssl/releases">openssl's releases</a>.</em></p> <blockquote> <h2>openssl-v0.10.78</h2> <h2>What's Changed</h2> <ul> <li>Fix Suite B flag assignments in verify.rs by <a href="https://github.com/alex"><code>@​alex</code></a> in <a href="https://redirect.github.com/rust-openssl/rust-openssl/pull/2592">rust-openssl/rust-openssl#2592</a></li> <li>Use cvt_p for OPENSSL_malloc error handling by <a href="https://github.com/alex"><code>@​alex</code></a> in <a href="https://redirect.github.com/rust-openssl/rust-openssl/pull/2593">rust-openssl/rust-openssl#2593</a></li> <li>Mark BIO_get_mem_data on AWS-LC to be unsafe by <a href="https://github.com/alex"><code>@​alex</code></a> in <a href="https://redirect.github.com/rust-openssl/rust-openssl/pull/2594">rust-openssl/rust-openssl#2594</a></li> <li>Set timeout for package installation step by <a href="https://github.com/alex"><code>@​alex</code></a> in <a href="https://redirect.github.com/rust-openssl/rust-openssl/pull/2595">rust-openssl/rust-openssl#2595</a></li> <li>Panic in Crypter::new when IV is required but not provided by <a href="https://github.com/alex"><code>@​alex</code></a> in <a href="https://redirect.github.com/rust-openssl/rust-openssl/pull/2596">rust-openssl/rust-openssl#2596</a></li> <li>openssl 4 support by <a href="https://g
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #390** (2026-09-26): **build(deps): bump rand from 0.8.5 to 0.8.6**
  *Symptoms*: Bumps [rand](https://github.com/rust-random/rand) from 0.8.5 to 0.8.6. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/rust-random/rand/blob/0.8.6/CHANGELOG.md">rand's changelog</a>.</em></p> <blockquote> <h2>[0.8.6] - 2026-04-14</h2> <p>This release back-ports a fix from v0.10. See also <a href="https://redirect.github.com/rust-random/rand/issues/1763">#1763</a>.</p> <h3>Changes</h3> <ul> <li>Deprecate feature <code>log</code> (<a href="https://redirect.github.com/rust-random/rand/issues/1772">#1772</a>)</li> </ul> <p><a href="https://redirect.github.com/rust-random/rand/issues/1763">#1763</a>: <a href="https://redirect.github.com/rust-random/rand/pull/1763">rust-random/rand#1763</a> <a href="https://redirect.github.com/rust-random/rand/issues/1772">#1772</a>: <a href="https://redirect.github.com/rust-random/rand/pull/1772">rust-random/rand#1772</a></p> <ul> <li>Drop the experimental <code>simd_support</code> feature.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/rust-random/rand/commit/5309f25bb5e7d21ac01c5b6f476badd06f9cdc3f"><code>5309f25</code></a> 0.8.6 (<a href="https://redirect.github.com/rust-random/rand/issues/1772">#1772</a>): update for recent nightly rustc and backport <a href="https://redirect.github.com/rust-random/rand/issues/1764">#1764</a></li> <li><a href="https://github.com/rust-random/rand/commit/1126d03a5cbd725aad239efb0d537c9130a76b26"><code>1126d03</c
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #389** (2026-04-22): **build(deps): bump rand from 0.8.5 to 0.9.3**
  *Symptoms*: Bumps [rand](https://github.com/rust-random/rand) from 0.8.5 to 0.9.3. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/rust-random/rand/blob/0.9.3/CHANGELOG.md">rand's changelog</a>.</em></p> <blockquote> <h2>[0.9.3] — 2026-02-11</h2> <p>This release back-ports a fix from v0.10. See also <a href="https://redirect.github.com/rust-random/rand/issues/1763">#1763</a>.</p> <h3>Changes</h3> <ul> <li>Deprecate feature <code>log</code> (<a href="https://redirect.github.com/rust-random/rand/issues/1764">#1764</a>)</li> <li>Replace usages of <code>doc_auto_cfg</code> (<a href="https://redirect.github.com/rust-random/rand/issues/1764">#1764</a>)</li> </ul> <p><a href="https://redirect.github.com/rust-random/rand/issues/1763">#1763</a>: <a href="https://redirect.github.com/rust-random/rand/pull/1763">rust-random/rand#1763</a></p> <h2>[0.9.2] — 2025-07-20</h2> <h3>Deprecated</h3> <ul> <li>Deprecate <code>rand::rngs::mock</code> module and <code>StepRng</code> generator (<a href="https://redirect.github.com/rust-random/rand/issues/1634">#1634</a>)</li> </ul> <h3>Additions</h3> <ul> <li>Enable <code>WeightedIndex&lt;usize&gt;</code> (de)serialization (<a href="https://redirect.github.com/rust-random/rand/issues/1646">#1646</a>)</li> </ul> <h2>[0.9.1] - 2025-04-17</h2> <h3>Security and unsafe</h3> <ul> <li>Revise &quot;not a crypto library&quot; policy again (<a href="https://redirect.github.com/rust-random/rand/issues/1565">#1565</a>)</li> <li>Remove <
  **Post-Mortem & Fix Analysis**:
  > Superseded by #390.

- **Issue #387** (2026-09-26): **build(deps): bump time from 0.3.37 to 0.3.47**
  *Symptoms*: Bumps [time](https://github.com/time-rs/time) from 0.3.37 to 0.3.47. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/time-rs/time/releases">time's releases</a>.</em></p> <blockquote> <h2>v0.3.47</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.46</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.45</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.44</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.43</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.42</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.41</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.40</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.39</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> <h2>v0.3.38</h2> <p>See the <a href="https://github.com/time-rs/time/blob/main/CHANGELOG.md">changelog</a> for details.</p> </blockquote> </details> <details>
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #386** (2026-09-26): **build(deps): bump bytes from 1.9.0 to 1.11.1**
  *Symptoms*: Bumps [bytes](https://github.com/tokio-rs/bytes) from 1.9.0 to 1.11.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/tokio-rs/bytes/releases">bytes's releases</a>.</em></p> <blockquote> <h2>Bytes v1.11.1</h2> <h1>1.11.1 (February 3rd, 2026)</h1> <ul> <li>Fix integer overflow in <code>BytesMut::reserve</code></li> </ul> <h2>Bytes v1.11.0</h2> <h1>1.11.0 (November 14th, 2025)</h1> <ul> <li>Bump MSRV to 1.57 (<a href="https://redirect.github.com/tokio-rs/bytes/issues/788">#788</a>)</li> </ul> <h3>Fixed</h3> <ul> <li>fix: <code>BytesMut</code> only reuse if src has remaining (<a href="https://redirect.github.com/tokio-rs/bytes/issues/803">#803</a>)</li> <li>Specialize <code>BytesMut::put::&lt;Bytes&gt;</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/793">#793</a>)</li> <li>Reserve capacity in <code>BytesMut::put</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/794">#794</a>)</li> <li>Change <code>BytesMut::remaining_mut</code> to use <code>isize::MAX</code> instead of <code>usize::MAX</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/795">#795</a>)</li> </ul> <h3>Internal changes</h3> <ul> <li>Guarantee address in <code>slice()</code> for empty slices. (<a href="https://redirect.github.com/tokio-rs/bytes/issues/780">#780</a>)</li> <li>Rename <code>Vtable::to_*</code> -&gt; <code>Vtable::into_*</code> (<a href="https://redirect.github.com/tokio-rs/bytes/issues/776">#776</a>)</li> <li
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #385** (2026-01-02): **⭐ VOLUNTEER! VOLUNTEER! VOLUNTEER! ⭐ Skytable Not Suitable for Production Authentication Systems - Technical Analysis**
  *Symptoms*: # ⭐ VOLUNTEER! VOLUNTEER! VOLUNTEER! ⭐  ## 🚀 HELP WANTED: Fix Skytable Reliability Issues 🚀   ### Summary  We've completed a comprehensive code review of Skytable for production authentication systems. **Verdict: Not suitable without significant architectural modifications.**  This analysis is based on direct examination of 51,659 lines of code across 194 files in the Skytable source. All findings reference specific code locations.  ---  ### TL;DR - Five Critical Issues  | # | Issue | Impact | Evidence | |---|-------|--------|----------| | 1 | **Delayed Durability** | Up to 5 minutes of data loss on crash | [fractal/mgr.rs:490-520](https://github.com/skytable/skytable/blob/main/server/src/engine/fractal/mgr.rs#L490-L520) | | 2 | **No DML Transactions** | No ACID guarantees, corruption risk | [txn/mod.rs](https://github.com/skytable/skytable/blob/main/server/src/engine/txn/mod.rs) | | 3 | **GNS Single-Point-Failure** | Entire database offline if metadata corrupts | [gns_log.rs:70-82](https://github.com/skytable/skytable/blob/main/server/src/engine/storage/v2/impls/gns_log.rs#L70-L82) | | 4 | **No Isolation** | Dirty reads, race conditions possible | [row.rs:41](https://github.com/skytable/skytable/blob/main/server/src/engine/core/index/row.rs#L41) | | 5 | **Destructive Recovery** | Repair discards "uncertain" data | [journal/raw/mod.rs](https://github.com/skytable/skytable/blob/main/server/src/engine/storage/v2/raw/journal/raw/mod.rs) |  ---  ### Supporting Documentation  Th

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

### Incident Patch 1: `2d15ffb5` (2026-09-26)
**Commit Message**: server (misc): fix compile errors due to winapi bump

**File**: `server/src/util/os.rs` (modified, +1/-1)
```diff
@@ -445,7 +445,7 @@ mod hostname_impl {
             // UNSAFE(@ohsayan): correct call to the windows API
             GetComputerNameExA(
                 ComputerNamePhysicalDnsHostname,
-                PSTR(buf.as_mut_ptr()),
+                Some(PSTR(buf.as_mut_ptr())),
                 &mut size as *mut u32,
             )
             .unwrap();
```

**File**: `server/src/util/os/flock.rs` (modified, +2/-2)
```diff
@@ -63,7 +63,7 @@ impl FileLock {
                 LockFileEx(
                     HANDLE(handle),
                     LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY,
-                    0,
+                    Some(0),
                     u32::MAX as u32,
                     u32::MAX as u32,
                     &mut overlapped,
@@ -97,7 +97,7 @@ impl FileLock {
             unsafe {
                 UnlockFileEx(
                     self.handle,
-                    0,
+                    Some(0),
                     u32::MAX as u32,
                     u32::MAX as u32,
                     &mut overlapped,
```

---

### Incident Patch 2: `dacecc03` (2026-09-26)
**Commit Message**: cli: fix password input

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ All changes in this project will be noted in this file.
 - CLI:
   - Fix args handling
   - Fix backtick issue in binary input
+  - Fix password handling
 
 ## Version 0.8.4
 
```

**File**: `cli/src/args.rs` (modified, +29/-30)
```diff
@@ -27,7 +27,7 @@
 use {
     crate::error::{CliError, CliResult},
     crossterm::{
-        event::{self, Event, KeyCode, KeyEvent},
+        event::{self, Event, KeyCode, KeyEventKind, KeyModifiers},
         terminal,
     },
     libsky::{
@@ -187,40 +187,39 @@ fn check_password(p: String, source: &str) -> CliResult<String> {
     }
 }
 
-fn read_password(prompt: &str) -> Result<String, std::io::Error> {
+pub fn read_password(prompt: &str) -> Result<String, io::Error> {
     print!("{prompt}");
     io::stdout().flush()?;
-    let mut password = String::new();
     terminal::enable_raw_mode()?;
-    loop {
-        match event::read()? {
-            Event::Key(KeyEvent {
-                code: KeyCode::Char('c'),
-                modifiers: event::KeyModifiers::CONTROL,
-                kind: event::KeyEventKind::Press,
-                ..
-            }) => {
-                terminal::disable_raw_mode()?;
-                println!();
-                exit(0x00)
-            }
-            Event::Key(KeyEvent {
-                code,
-                modifiers: event::KeyModifiers::NONE,
-                kind: event::KeyEventKind::Press,
-                ..
-            }) => match code {
-                KeyCode::Backspace => {
-                    let _ = password.pop();
+    let mut password = String::new();
+    let result = (|| {
+        loop {
+            if let Event::Key(key_event) = event::read()? {
+                if key_event.kind != KeyEventKind::Press {
+                    continue;
                 }
-                KeyCode::Char(c) => password.push(c),
-                KeyCode::Enter => break,
-                _ => {}
-            },
-            _ => {}
+                if key_event.code == KeyCode::Char('c')
+                    && key_event.modifiers.contains(KeyModifiers::CONTROL)
+                {
+                    terminal::disable_raw_mode()?;
+                    println!();
+                    exit(0x00)
+                }
+                match key_event.code {
+                    KeyCode::Enter => break,
+                    KeyCode::Backspace => {
+                        password.pop();
+                    }
+                    KeyCode::Char(c) => {
+                        password.push(c);
+                    }
+                    _ => {}
+                }
+            }
         }
-    }
+        Ok(password)
+    })();
     terminal::disable_raw_mode()?;
     println!();
-    Ok(password)
+    result
 }
```

---

### Incident Patch 3: `d8fdb143` (2026-09-26)
**Commit Message**: cli, libsky: fix CLI arg handling

**File**: `cli/src/args.rs` (modified, +8/-6)
```diff
@@ -92,7 +92,9 @@ pub fn parse() -> CliResult<Task> {
         TaskInner::HelpMsg(msg) => return Ok(Task::HelpMessage(msg)),
         TaskInner::OpenShell(args) => args,
     };
-    let endpoint = match args.take_option("endpoint")? {
+    let (endpoint, tls_cert, user, password, eval, e) =
+        libsky::take_many_options!(args => "endpoint", "tls-cert", "user", "password", "eval", "e");
+    let endpoint = match endpoint? {
         None => EndpointConfig::Tcp("127.0.0.1".to_string(), 2003),
         Some(ep) => {
             // should be in the format protocol@host:port
@@ -118,13 +120,13 @@ pub fn parse() -> CliResult<Task> {
                     )))
                 }
             };
-            let tls_cert = args.take_option("tls-cert")?;
             match protocol {
                 "tcp" => {
                     // TODO(@ohsayan): warn!
                     EndpointConfig::Tcp(host.to_string(), port)
                 }
                 "tls" => {
+                    let tls_cert = tls_cert?;
                     // we need a TLS cert
                     match tls_cert {
                         Some(path) => {
@@ -146,14 +148,14 @@ pub fn parse() -> CliResult<Task> {
             }
         }
     };
-    let username = match args.take_option("user")? {
+    let username = match user? {
         Some(u) => u,
         None => {
             // default
             "root".to_string()
         }
     };
-    let password = match args.take_option("password")? {
+    let password = match password? {
         Some(p) => check_password(p, "cli arguments")?,
         None => {
             // let us check the environment variable to see if anything was set
@@ -163,9 +165,9 @@ pub fn parse() -> CliResult<Task> {
             }
         }
     };
-    let eval = match args.take_option("eval")? {
+    let eval = match eval? {
         Some(v) => Some(v),
-        None => args.take_option("e")?,
+        None => e?,
     };
     args.ensure_empty()?;
     let client = ClientConfig::new(endpoint, username, password);
```

**File**: `libsky/src/lib.rs` (modified, +7/-0)
```diff
@@ -40,3 +40,10 @@ pub mod variables;
 pub fn version_msg(binary: &str) -> String {
     format!("{binary} v{}", variables::VERSION)
 }
+
+#[macro_export]
+macro_rules! take_many_options {
+    ($from:expr => $($name:expr),* $(,)?) => {
+        ($($crate::cli_utils::CliCommandData::take_option(&mut $from, $name)),*)
+    }
+}
```

---

### Incident Patch 4: `2314f3ee` (2025-04-08)
**Commit Message**: ci: Fix stray `v` in docker image tags

**File**: `.github/workflows/docker-image.yml` (modified, +10/-10)
```diff
@@ -54,12 +54,11 @@ jobs:
         uses: docker/build-push-action@v5
         with:
           context: .
-          platforms: linux/amd64
-          push: ${{ github.event_name != 'pull_request' }}
+          push: true
           tags: |
             ${{ env.IMAGE_NAME }}:latest-amd64
             ${{ env.IMAGE_NAME }}:${{ github.sha }}-amd64
-            ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }}-amd64
+            ${{ github.ref_name != 'next' && format('{0}:{1}-amd64', env.IMAGE_NAME, steps.version.outputs.version) || '' }}
 
   build-arm64:
     runs-on: [self-hosted, ARM64]
@@ -102,12 +101,11 @@ jobs:
         uses: docker/build-push-action@v5
         with:
           context: .
-          platforms: linux/arm64
-          push: ${{ github.event_name != 'pull_request' }}
+          push: true
           tags: |
             ${{ env.IMAGE_NAME }}:latest-arm64
             ${{ env.IMAGE_NAME }}:${{ github.sha }}-arm64
-            ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }}-arm64
+            ${{ github.ref_name != 'next' && format('{0}:{1}-arm64', env.IMAGE_NAME, steps.version.outputs.version) || '' }}
 
   manifest:
     needs: [build-x86, build-arm64]
@@ -136,9 +134,11 @@ jobs:
           docker manifest create ${{ env.IMAGE_NAME }}:${{ github.sha }} \
             --amend ${{ env.IMAGE_NAME }}:${{ github.sha }}-amd64 \
             --amend ${{ env.IMAGE_NAME }}:${{ github.sha }}-arm64
-          docker manifest create ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }} \
-            --amend ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }}-amd64 \
-            --amend ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }}-arm64
+          if [[ "${{ steps.version.outputs.version }}" != "latest" ]]; then
+            docker manifest create ${{ env.IMAGE_NAME }}:${{ steps.version.outputs.version }} \
+              --amend ${{ env.IMAGE_NAME }}:${{ steps.version.outputs.version }}-amd64 \
+              --amend ${{ env.IMAGE_NAME }}:${{ steps.version.outputs.version }}-arm64
+            docker manifest push ${{ env.IMAGE_NAME }}:${{ steps.version.outputs.version }}
+          fi
           docker manifest push ${{ env.IMAGE_NAME }}:latest
           docker manifest push ${{ env.IMAGE_NAME }}:${{ github.sha }}
-          docker manifest push ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }}
```

---

### Incident Patch 5: `c0efcdd2` (2024-08-03)
**Commit Message**: server unsafe code audit: fixed memory leaks and other violations (#364)

* test: Run miri for non I/O tests

* server [safety]: Fix multiple possible safety violations

Multiple fixes were applied:
- Memory leak in `FixedVec` due to zero length free
- Possible unsoundess in use of moved boxed slice pointers
- Fixed user-after-free (UAF) in ordered idx impl

I'm further working on finding and fixing other
sources of safety violations; even though they may not be "major" but we must
steer clear of them (such as miri SB violations).

* server [safety]: Fix memory leak in ordered idx iterator

Also note that we now properly classify tests based on leak
severity for the generic audit routine.

* ci: Do not run miri on every commit

Due to the amount of single core burn miri needs, it is almost
impractical to run it on every commit with our currently allocated
CI resources.

We may revisit this in the future.

* server [test]: Further classify tests based on leak severity

**File**: `.github/workflows/miri.yml` (removed, +0/-49)
```diff
@@ -1,49 +0,0 @@
-name: Miri
-
-on: [push, pull_request]
-
-jobs:
-  build:
-    runs-on: ${{ matrix.os }}
-    strategy:
-      matrix:
-        os: [ubuntu-latest, windows-latest, macos-latest]
-
-    steps:
-    - name: Checkout repository
-      uses: actions/checkout@v3
-
-    - name: Install rustup and nightly rust
-      uses: actions-rs/toolchain@v1
-      with:
-        toolchain: nightly
-        profile: minimal
-        override: true
-        components: miri
-
-    - name: Cache cargo registry
-      uses: actions/cache@v3
-      with:
-        path: ~/.cargo/registry
-        key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}
-        restore-keys: |
-          ${{ runner.os }}-cargo-registry-
-    
-    - name: Cache cargo index
-      uses: actions/cache@v3
-      with:
-        path: ~/.cargo/git
-        key: ${{ runner.os }}-cargo-index-${{ hashFiles('**/Cargo.lock') }}
-        restore-keys: |
-          ${{ runner.os }}-cargo-index-
-    
-    - name: Cache cargo build
-      uses: actions/cache@v3
-      with:
-        path: target
-        key: ${{ runner.os }}-cargo-build-${{ hashFiles('**/Cargo.lock') }}
-        restore-keys: |
-          ${{ runner.os }}-cargo-build-
-
-    - name: Run miri audit
-      run: make audit
```

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -16,6 +16,9 @@ All changes in this project will be noted in this file.
 
 - Server:
   - Improved diagnostic messages (and output formatting)
+  - Fixed memory leaks across multiple routines (oarticularly startup routines)
+  - Fixed potential segfaults (note: these are *potential segfaults* as we were not able to actually reproduce it anywhere despite heavy permutation
+  testing, but the fixes were made out of an abundance of caution)
 - CLI:
   - Upgraded client driver to fix loading of large blob/string fetches from the database
 
```

**File**: `harness/src/audit.rs` (modified, +31/-8)
```diff
@@ -29,21 +29,44 @@ use {
 };
 
 pub fn audit() -> HarnessResult<()> {
+    const ENVS_LEAK_STRICT: [(&'static str, &'static str); 2] = [
+        ("MIRIFLAGS", "-Zmiri-tree-borrows -Zmiri-disable-isolation"),
+        (
+            "RUSTFLAGS",
+            "-A dead_code -A unused_imports -A unused_macros",
+        ),
+    ];
+    const ENVS_LEAK_PERMISSIVE: [(&'static str, &'static str); 2] = [
+        (
+            "MIRIFLAGS",
+            "-Zmiri-tree-borrows -Zmiri-disable-isolation -Zmiri-ignore-leaks",
+        ),
+        (
+            "RUSTFLAGS",
+            "-A dead_code -A unused_imports -A unused_macros",
+        ),
+    ];
     let mut miri_args = vec!["miri".to_owned(), "test".to_owned()];
     if let Some(t) = util::get_var(util::VAR_TARGET) {
         miri_args.push("--target".to_owned());
         miri_args.push(t);
     }
     miri_args.push("-p".to_owned());
     miri_args.push("skyd".to_owned());
-    let mut cmd = Command::new("cargo");
-    cmd.args(&miri_args)
-        .env(
-            "RUSTFLAGS",
-            "-A dead_code -A unused_imports -A unused_macros",
-        )
-        .env("MIRIFLAGS", "-Zmiri-permissive-provenance");
-    util::handle_child(&format!("audit skyd using miri"), cmd)?;
+    {
+        // non-leaky test
+        let mut cmd = Command::new("cargo");
+        cmd.args(&miri_args).envs(ENVS_LEAK_STRICT);
+        util::handle_child(&format!("audit skyd using miri (leak-strict)"), cmd)?;
+    }
+    {
+        // leaky test
+        let mut cmd = Command::new("cargo");
+        cmd.args(&miri_args)
+            .arg("--features=miri-leaks")
+            .envs(ENVS_LEAK_PERMISSIVE);
+        util::handle_child(&format!("audit skyd using miri (leak-permissive)"), cmd)?;
+    }
     info!("successfully completed audit of skyd (miri)");
     Ok(())
 }
```

**File**: `server/Cargo.toml` (modified, +1/-0)
```diff
@@ -54,6 +54,7 @@ skytable = { git = "https://github.com/skytable/client-rust.git", branch = "deve
 
 [features]
 nightly = []
+miri-leaks = []
 
 [package.metadata.deb]
 name = "skytable"
```

**File**: `server/src/engine/core/dcl.rs` (modified, +4/-4)
```diff
@@ -29,6 +29,7 @@ use crate::engine::{
     data::{tag::TagClass, DictEntryGeneric},
     error::{QueryError, QueryResult},
     fractal::GlobalInstanceLike,
+    mem::unsafe_apis::BoxStr,
     net::protocol::ClientLocalState,
     ql::dcl::{SysctlCommand, UserDecl, UserDel},
 };
@@ -73,7 +74,7 @@ fn guard_root_or_self(me: &ClientLocalState, target_username: &str) -> QueryResu
     Ok(())
 }
 
-fn get_user_data<'a>(mut user: UserDecl<'a>) -> Result<(String, String), QueryError> {
+fn get_user_data<'a>(mut user: UserDecl<'a>) -> Result<(BoxStr, String), QueryError> {
     let password = match user.options_mut().remove(KEY_PASSWORD) {
         Some(DictEntryGeneric::Data(d))
             if d.kind() == TagClass::Str && user.options().is_empty() =>
@@ -83,8 +84,7 @@ fn get_user_data<'a>(mut user: UserDecl<'a>) -> Result<(String, String), QueryEr
             return Err(QueryError::QExecDdlInvalidProperties);
         }
     };
-    let username = user.username().to_owned();
-    Ok((username, password))
+    Ok((BoxStr::new(user.username()), password))
 }
 
 fn create_user(global: &impl GlobalInstanceLike, user: UserDecl) -> QueryResult<()> {
@@ -93,7 +93,7 @@ fn create_user(global: &impl GlobalInstanceLike, user: UserDecl) -> QueryResult<
         .state()
         .namespace()
         .sys_db()
-        .create_user(global, username.into_boxed_str(), &password)
+        .create_user(global, username, &password)
 }
 
 fn alter_user(
```

---

### Incident Patch 6: `c369361c` (2024-07-23)
**Commit Message**: server: Fix Windows `HANDLE` cast

**File**: `server/src/util/os/flock.rs` (modified, +2/-2)
```diff
@@ -61,7 +61,7 @@ impl FileLock {
             let mut overlapped = OVERLAPPED::default();
             unsafe {
                 LockFileEx(
-                    HANDLE(handle as isize),
+                    HANDLE(handle),
                     LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY,
                     0,
                     u32::MAX as u32,
@@ -71,7 +71,7 @@ impl FileLock {
             }?;
             return Ok(Self {
                 _file: file,
-                handle: HANDLE(handle as isize),
+                handle: HANDLE(handle),
             });
         }
         #[cfg(unix)]
```

---

### Incident Patch 7: `26db3785` (2024-07-23)
**Commit Message**: server [ql]: Fix segfault resulting from double-free in `Token`

I've clearly been irresponsible and did a DF here. `UnsafeCell`s
DO run the dtor (and doing the opposite introduced this bug)!

Also: misc changes in the rust client upstream were made and the
test code was adjusted for the same.

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -1388,7 +1388,7 @@ dependencies = [
 [[package]]
 name = "skytable"
 version = "0.8.10"
-source = "git+https://github.com/skytable/client-rust.git?branch=devel#c2337cbbd0a50775bd345d987b747c1e4eb7d6f6"
+source = "git+https://github.com/skytable/client-rust.git?branch=devel#64aa9a9a9028183fecd88f6853c1c33b21158ba9"
 dependencies = [
  "async-trait",
  "bb8",
```

**File**: `server/src/engine/ql/lex/raw.rs` (modified, +0/-12)
```diff
@@ -130,18 +130,6 @@ pub enum Token<'a> {
     DCList(UnsafeCell<Vec<Datacell>>),
 }
 
-impl<'a> Drop for Token<'a> {
-    fn drop(&mut self) {
-        match self {
-            Self::DCList(dcl) => unsafe {
-                // UNSAFE(@ohsayan): we're cleaning up the value. so all good!
-                core::ptr::drop_in_place(dcl)
-            },
-            _ => {}
-        }
-    }
-}
-
 impl<'a> PartialEq for Token<'a> {
     fn eq(&self, other: &Self) -> bool {
         match (self, other) {
```

**File**: `server/src/engine/tests/client/mod.rs` (modified, +1/-1)
```diff
@@ -181,5 +181,5 @@ fn insert_list() {
         ))
         .unwrap();
     assert_eq!(username, "sayan");
-    assert_eq!(bookmarks, data);
+    assert_eq!(&bookmarks[..], data);
 }
```

---

### Incident Patch 8: `6d4fb94d` (2024-07-23)
**Commit Message**: misc: Fix `cargo check` warnings

**File**: `server/src/engine/fractal/error.rs` (modified, +12/-0)
```diff
@@ -154,39 +154,51 @@ impl IntoError for Error {
 
 pub trait ErrorContext<T> {
     // no inherit
+    #[allow(dead_code)]
     /// set the origin (do not inherit parent or local)
     fn set_origin(self, origin: Subsystem) -> Result<T, Error>;
     /// set the dmsg (do not inherit parent or local)
     fn set_dmsg(self, dmsg: impl Into<Dmsg>) -> Result<T, Error>;
+    #[allow(dead_code)]
     fn set_dmsg_fn<F, M>(self, d: F) -> Result<T, Error>
     where
         F: Fn() -> M,
         M: Into<Dmsg>,
         Self: Sized;
+    #[allow(dead_code)]
     /// set the origin and dmsg (do not inherit)
     fn set_ctx(self, origin: Subsystem, dmsg: impl Into<Dmsg>) -> Result<T, Error>;
     // inherit parent
+    #[allow(dead_code)]
     /// set the origin (inherit rest from parent)
     fn ip_set_origin(self, origin: Subsystem) -> Result<T, Error>;
+    #[allow(dead_code)]
     /// set the dmsg (inherit rest from origin)
     fn ip_set_dmsg(self, dmsg: impl Into<Dmsg>) -> Result<T, Error>;
     // inherit local
+    #[allow(dead_code)]
     /// set the origin (inherit rest from local)
     fn il_set_origin(self, origin: Subsystem) -> Result<T, Error>;
+    #[allow(dead_code)]
     /// set the dmsg (inherit rest from local)
     fn il_set_dmsg(self, dmsg: impl Into<Dmsg>) -> Result<T, Error>;
+    #[allow(dead_code)]
     /// inherit everything from local (assuming this has no context)
     fn inherit_local(self) -> Result<T, Error>;
     // inherit any
+    #[allow(dead_code)]
     /// set the origin (inherit rest from either parent, then local)
     fn inherit_set_origin(self, origin: Subsystem) -> Result<T, Error>;
     /// set the dmsg (inherit rest from either parent, then local)
     fn inherit_set_dmsg(self, dmsg: impl Into<Dmsg>) -> Result<T, Error>;
     // orphan
+    #[allow(dead_code)]
     /// orphan the entire context (if any)
     fn orphan(self) -> Result<T, Error>;
+    #[allow(dead_code)]
     /// orphan the origin (if any)
     fn orphan_origin(self) -> Result<T, Error>;
+    #[allow(dead_code)]
     /// orphan the dmsg (if any)
     fn orphan_dmsg(self) -> Result<T, Error>;
 }
```

**File**: `server/src/engine/idx/meta/mod.rs` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@ pub trait Comparable<K: ?Sized>: Hash {
 }
 
 pub trait ComparableUpgradeable<K>: Comparable<K> {
+    #[allow(dead_code)]
     fn upgrade(&self) -> K;
 }
 
```

**File**: `server/src/engine/idx/mod.rs` (modified, +24/-0)
```diff
@@ -53,6 +53,7 @@ pub type IndexST<K, V, S = std::collections::hash_map::RandomState> =
 
 /// Any type implementing this trait can be used as a key inside memory engine structures
 pub trait AsKey: Hash + Eq + 'static {
+    #[allow(dead_code)]
     /// Read the key
     fn read_key(&self) -> &Self;
 }
@@ -65,6 +66,7 @@ impl<T: Hash + Eq + ?Sized + 'static> AsKey for T {
 
 /// If your T can be cloned/copied and implements [`AsKey`], then this trait will automatically be implemented
 pub trait AsKeyClone: AsKey + Clone {
+    #[allow(dead_code)]
     /// Read the key and return a clone
     fn read_key_clone(&self) -> Self;
 }
@@ -87,6 +89,7 @@ impl<T: ?Sized + 'static> AsValue for T {
 
 /// Any type implementing this trait can be used as a value inside memory engine structures
 pub trait AsValueClone: AsValue + Clone {
+    #[allow(dead_code)]
     /// Read the value and return a clone
     fn read_value_clone(&self) -> Self;
 }
@@ -114,6 +117,7 @@ pub trait IndexBaseSpec: Sized {
     /// Initialize an empty instance of the index
     fn idx_init() -> Self;
     /// Initialize a pre-loaded instance of the index
+    #[allow(dead_code)]
     fn idx_init_with(s: Self) -> Self;
     /// Init the idx with the given cap
     ///
@@ -126,6 +130,7 @@ pub trait IndexBaseSpec: Sized {
     }
     #[cfg(debug_assertions)]
     /// Returns a reference to the index metrics
+    #[allow(dead_code)]
     fn idx_metrics(&self) -> &Self::Metrics;
 }
 
@@ -151,11 +156,14 @@ pub trait MTIndex<E, K, V>: IndexBaseSpec {
         V: 'v,
         Self: 't;
     fn mt_iter_kv<'t, 'g, 'v>(&'t self, g: &'g Guard) -> Self::IterKV<'t, 'g, 'v>;
+    #[allow(dead_code)]
     fn mt_iter_key<'t, 'g, 'v>(&'t self, g: &'g Guard) -> Self::IterKey<'t, 'g, 'v>;
+    #[allow(dead_code)]
     fn mt_iter_val<'t, 'g, 'v>(&'t self, g: &'g Guard) -> Self::IterVal<'t, 'g, 'v>;
     /// Returns the length of the index
     fn mt_len(&self) -> usize;
     /// Attempts to compact the backing storage
+    #[allow(dead_code)]
     fn mt_compact(&self) {}
     /// Clears all the entries in the MTIndex
     fn mt_clear(&self, g: &Guard);
@@ -169,6 +177,7 @@ pub trait MTIndex<E, K, V>: IndexBaseSpec {
     fn mt_upsert(&self, e: E, g: &Guard) -> bool
     where
         V: AsValue;
+    #[allow(dead_code)]
     // read
     fn mt_contains<Q>(&self, key: &Q, g: &Guard) -> bool
     where
@@ -184,17 +193,20 @@ pub trait MTIndex<E, K, V>: IndexBaseSpec {
         Q: ?Sized + Comparable<K>,
         't: 'v,
         'g: 't + 'v;
+    #[allow(dead_code)]
     /// Returns a clone of the value corresponding to the key, if it exists
     fn mt_get_cloned<Q>(&self, key: &Q, g: &Guard) -> Option<V>
     where
         Q: ?Sized + Comparable<K>,
         V: AsValueClone;
     // update
+    #[allow(dead_code)]
     /// Returns true if the entry is updated
     fn mt_update(&self, e: E, g: &Guard) -> bool
     where
         K: AsKeyClone,
         V: AsValue;
+    #[allow(dead_code)]
     /// Updates the entry and returns the old value, if it exists
     fn mt_update_return<'t, 'g, 'v>(&'t self, e: E, g: &'g Guard) -> Option<&'v V>
     where
@@ -207,6 +219,7 @@ pub trait MTIndex<E, K, V>: IndexBaseSpec {
     fn mt_delete<Q>(&self, key: &Q, g: &Guard) -> bool
     where
         Q: ?Sized + Comparable<K>;
+    #[allow(dead_code)]
     /// Removes the entry and returns it, if it exists
     fn mt_delete_return<'t, 'g, 'v, Q>(&'t self, key: &Q, g: &'g Guard) -> Option<&'v V>
     where
@@ -252,8 +265,10 @@ pub trait STIndex<K: ?Sized, V>: IndexBaseSpec {
         V: 'a;
     /// returns the length of the idx
     fn st_len(&self) -> usize;
+    #[allow(dead_code)]
     /// Attempts to compact the backing storage
     fn st_compact(&mut self) {}
+    #[allow(dead_code)]
     /// Clears all the entries in the STIndex
     fn st_clear(&mut self);
     // write
@@ -278,6 +293,7 @@ pub trait STIndex<K: ?Sized, V>: IndexBaseSpec {
     where
         K: AsKey + Borrow<Q>,
         Q: ?Sized
```

**File**: `server/src/engine/idx/mtchm/meta.rs` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@ pub trait TreeElement: Clone + 'static {
     type VEx2;
     fn key(&self) -> &Self::Key;
     fn val(&self) -> &Self::Value;
+    #[allow(dead_code)]
     fn new(k: Self::IKey, v: Self::IValue, vex1: Self::VEx1, vex2: Self::VEx2) -> Self;
 }
 
```

**File**: `server/src/engine/mem/word.rs` (modified, +5/-0)
```diff
@@ -167,6 +167,7 @@ pub trait TwordNNN: Sized {
     fn twordnnn_store_native_full(a: usize, b: usize, c: usize) -> Self;
     fn twordnnn_load_native_full(&self) -> [usize; 3];
     // promotions
+    #[allow(dead_code)]
     fn tword_promote<W: TwordNNN>(&self) -> W {
         let [a, b, c] = self.twordnnn_load_native_full();
         <W as TwordNNN>::twordnnn_store_native_full(a, b, c)
@@ -226,6 +227,7 @@ impl TwordNNN for NativeTword {
 pub trait QwordNNNN: Sized {
     const QWORDNNNN_FROM_UPPER: bool = size_of::<Self>() > size_of::<[usize; 4]>();
     fn qwordnnnn_store_native_full(a: usize, b: usize, c: usize, d: usize) -> Self;
+    #[allow(dead_code)]
     fn qwordnnnn_store_qw_qw(a: u64, b: u64) -> Self {
         #[cfg(target_pointer_width = "32")]
         {
@@ -238,6 +240,7 @@ pub trait QwordNNNN: Sized {
             Self::qwordnnnn_store_native_full(a as usize, b as usize, 0, 0)
         }
     }
+    #[allow(dead_code)]
     fn qwordnnnn_store_qw_nw_nw(a: u64, b: usize, c: usize) -> Self {
         #[cfg(target_pointer_width = "32")]
         {
@@ -250,6 +253,7 @@ pub trait QwordNNNN: Sized {
         }
     }
     fn qwordnnnn_load_native_full(&self) -> [usize; 4];
+    #[allow(dead_code)]
     fn qwordnnnn_load_qw_qw(&self) -> [u64; 2] {
         let [a, b, c, d] = self.qwordnnnn_load_native_full();
         #[cfg(target_pointer_width = "32")]
@@ -262,6 +266,7 @@ pub trait QwordNNNN: Sized {
             [a as u64, b as u64]
         }
     }
+    #[allow(dead_code)]
     fn qwordnnnn_load_qw_nw_nw(&self) -> (u64, usize, usize) {
         let [a, b, c, d] = self.qwordnnnn_load_native_full();
         #[cfg(target_pointer_width = "32")]
```

---

### Incident Patch 9: `11b65ced` (2024-06-23)
**Commit Message**: server, cli: Improve diagnostic messages and fix loading of large blob/string in CLI (#356)

* server: Improve diagnostic messages

* deps: Upgrade deps and fix skysh bug due to upstream driver

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -2,6 +2,15 @@
 
 All changes in this project will be noted in this file.
 
+## Version 0.8.4
+
+### Fixes
+
+- Server:
+  - Improved diagnostic messages (and output formatting)
+- CLI:
+  - Upgraded client driver to fix loading of large blob/string fetches from the database
+
 ## Version 0.8.3
 
 ### Additions
```

**File**: `Cargo.lock` (modified, +345/-249)
```diff
@@ -4,9 +4,9 @@ version = 3
 
 [[package]]
 name = "addr2line"
-version = "0.21.0"
+version = "0.22.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8a30b2e23b9e17a9f90641c7ab1549cd9b44f296d3ccbf309d2863cfe398a0cb"
+checksum = "6e4503c46a5c0c7844e948c9a4d6acd9f50cccb4de1c48eb9e291ea17470c678"
 dependencies = [
  "gimli",
 ]
@@ -54,74 +54,84 @@ dependencies = [
 
 [[package]]
 name = "anstream"
-version = "0.6.13"
+version = "0.6.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d96bd03f33fe50a863e394ee9718a706f988b9079b20c3784fb726e7678b62fb"
+checksum = "418c75fa768af9c03be99d17643f93f79bbba589895012a80e3452a19ddda15b"
 dependencies = [
  "anstyle",
  "anstyle-parse",
  "anstyle-query",
  "anstyle-wincon",
  "colorchoice",
+ "is_terminal_polyfill",
  "utf8parse",
 ]
 
 [[package]]
 name = "anstyle"
-version = "1.0.6"
+version = "1.0.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8901269c6307e8d93993578286ac0edf7f195079ffff5ebdeea6a59ffb7e36bc"
+checksum = "038dfcf04a5feb68e9c60b21c9625a54c2c0616e79b72b0fd87075a056ae1d1b"
 
 [[package]]
 name = "anstyle-parse"
-version = "0.2.3"
+version = "0.2.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c75ac65da39e5fe5ab759307499ddad880d724eed2f6ce5b5e8a26f4f387928c"
+checksum = "c03a11a9034d92058ceb6ee011ce58af4a9bf61491aa7e1e59ecd24bd40d22d4"
 dependencies = [
  "utf8parse",
 ]
 
 [[package]]
 name = "anstyle-query"
-version = "1.0.2"
+version = "1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e28923312444cdd728e4738b3f9c9cac739500909bb3d3c94b43551b16517648"
+checksum = "ad186efb764318d35165f1758e7dcef3b10628e26d41a44bc5550652e6804391"
 dependencies = [
  "windows-sys 0.52.0",
 ]
 
 [[package]]
 name = "anstyle-wincon"
-version = "3.0.2"
+version = "3.0.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1cd54b81ec8d6180e24654d0b371ad22fc3dd083b6ff8ba325b72e00c87660a7"
+checksum = "61a38449feb7068f52bb06c12759005cf459ee52bb4adc1d5a7c4322d716fb19"
 dependencies = [
  "anstyle",
  "windows-sys 0.52.0",
 ]
 
+[[package]]
+name = "arbitrary"
+version = "1.3.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7d5a26814d8dcb93b0e5a0ff3c6d80a8843bafb21b39e8e18a6f05471870e110"
+dependencies = [
+ "derive_arbitrary",
+]
+
 [[package]]
 name = "async-trait"
-version = "0.1.79"
+version = "0.1.80"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a507401cad91ec6a857ed5513a2073c82a9b9048762b885bb98655b306964681"
+checksum = "c6fa2087f2753a7da8cc1c0dbfcf89579dd57458e36769de5ac750b4671737ca"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 2.0.58",
+ "syn 2.0.67",
 ]
 
 [[package]]
 name = "autocfg"
-version = "1.2.0"
+version = "1.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f1fdabc7756949593fe60f30ec81974b613357de856987752631dea1e3394c80"
+checksum = "0c4b4d0bd25bd0b74681c0ad21497610ce1b7c91b1022cd21c80c6fbdd9476b0"
 
 [[package]]
 name = "backtrace"
-version = "0.3.71"
+version = "0.3.73"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "26b05800d2e817c8b3b4b54abd461726265fa9789ae34330622f2db9ee696f9d"
+checksum = "5cc23269a4f8976d0a4d2e7109211a419fe30e8d88d677cd60b6bc79c5732e0a"
 dependencies = [
  "addr2line",
  "cc",
@@ -138,31 +148,18 @@ version = "0.13.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9e1b586273c5702936fe7b7d6896644d8be71e6314cfe09d3167c95f712589e8"
 
-[[package]]
-name = "base64ct"
-version = "1.6.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8c3c1a368f70d6cf7302d78f8f7093da241fb8e8807c05cc9e51a125895a6d5b"
-
 [[package]]
 name = "bb8"
-version = "0.8.3"
+version = "0.8.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "df7c2093d15d6a1d33b1f972e1c5e
```

**File**: `harness/Cargo.toml` (modified, +1/-1)
```diff
@@ -11,6 +11,6 @@ libsky = { path = "../libsky" }
 # external deps
 env_logger = "0.11.3"
 log = "0.4.21"
-zip = { version = "0.6.6", features = ["deflate"] }
+zip = { version = "2.1.3", features = ["deflate"] }
 powershell_script = "1.1.0"
 openssl = { version = "0.10.64", features = ["vendored"] }
```

**File**: `harness/src/bundle.rs` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ use {
         io::{Read, Write},
         path::{Path, PathBuf},
     },
-    zip::{write::FileOptions, ZipWriter},
+    zip::{write::SimpleFileOptions, ZipWriter},
 };
 
 /// Returns the bundle name
@@ -71,7 +71,7 @@ fn package_binaries(target_folder: PathBuf, mode: BuildMode) -> HarnessResult<()
     // create a temp buffer
     let mut buffer = Vec::new();
     // ZIP settings
-    let options = FileOptions::default()
+    let options = SimpleFileOptions::default()
         .unix_permissions(0o755)
         .compression_method(mode.get_compression_method());
     for file in file_index {
```

**File**: `server/Cargo.toml` (modified, +8/-8)
```diff
@@ -21,21 +21,21 @@ env_logger = "0.11.3"
 log = "0.4.21"
 openssl = { version = "0.10.64", features = ["vendored"] }
 crossbeam-epoch = { version = "0.9.18" }
-parking_lot = "0.12.1"
-serde = { version = "1.0.197", features = ["derive"] }
-tokio = { version = "1.37.0", features = ["full"] }
+parking_lot = "0.12.3"
+serde = { version = "1.0.203", features = ["derive"] }
+tokio = { version = "1.38.0", features = ["full"] }
 tokio-openssl = "0.6.4"
 uuid = { version = "1.8.0", features = ["v4", "fast-rng", "macro-diagnostics"] }
-crc = "3.0.1"
+crc = "3.2.1"
 serde_yaml = "0.9.33"
-chrono = "0.4.37"
+chrono = "0.4.38"
 
 [target.'cfg(all(not(target_env = "msvc"), not(miri)))'.dependencies]
 # external deps
 jemallocator = "0.5.4"
 [target.'cfg(target_os = "windows")'.dependencies]
 # external deps
-windows = { version = "0.54.0", features = [
+windows = { version = "0.57.0", features = [
   "Win32_Foundation",
   "Win32_System_IO",
   "Win32_Storage_FileSystem",
@@ -44,12 +44,12 @@ windows = { version = "0.54.0", features = [
 
 [target.'cfg(unix)'.dependencies]
 # external deps
-libc = "0.2.153"
+libc = "0.2.155"
 
 [dev-dependencies]
 # external deps
 rand = "0.8.5"
-tokio = { version = "1.37.0", features = ["test-util"] }
+tokio = { version = "1.38.0", features = ["test-util"] }
 skytable = { git = "https://github.com/skytable/client-rust.git", branch = "devel" }
 
 [features]
```

---

### Incident Patch 10: `86d7d0f5` (2024-05-04)
**Commit Message**: bench: Fix uniform_std_v1 workload to use uint64 values

**File**: `sky-bench/src/workload/workloads/mod.rs` (modified, +2/-2)
```diff
@@ -24,5 +24,5 @@
  *
 */
 
-mod uniform_v1_std;
-pub use uniform_v1_std::UniformV1Std;
+mod uniform_std_v1;
+pub use uniform_std_v1::UniformV1Std;
```

**File**: `sky-bench/src/workload/workloads/uniform_std_v1.rs` (renamed, +7/-7)
```diff
@@ -25,7 +25,7 @@
 */
 
 /*!
- * # `uniform_v1_std` workload
+ * # `uniform_std_v1` workload
  *
  * This workload is a very real-world workload where we first create multiple unique rows using an `INSERT`, then mutate these rows using an `UPDATE`,
  * select a column using a `SELECT` and finally remove the row using `DELETE`.
@@ -87,7 +87,7 @@ impl UniformV1Task {
 }
 
 impl Workload for UniformV1Std {
-    const ID: &'static str = "uniform_v1_std";
+    const ID: &'static str = "uniform_std_v1";
     type ControlPort = ConnectionAsync;
     type WorkloadContext = UniformV1Task;
     type WorkloadPayload = &'static Query;
@@ -105,7 +105,7 @@ impl Workload for UniformV1Std {
                 &Pipeline::new()
                     .add(&query!(format!("create space {DEFAULT_SPACE}")))
                     .add(&query!(format!(
-                        "create model {DEFAULT_SPACE}.{DEFAULT_MODEL}(k: binary, v: uint8)"
+                        "create model {DEFAULT_SPACE}.{DEFAULT_MODEL}(k: binary, v: uint64)"
                     ))),
             )
             .await?;
@@ -133,7 +133,7 @@ impl Workload for UniformV1Std {
             UniformV1Task::new(
                 "INSERT",
                 format!(
-                    "Query='INS INTO db.db(?, ?)'; Params={}B binary key, 0 UInt8 value",
+                    "Query='INS INTO {DEFAULT_MODEL}(?, ?)'; Params={}B binary key, 0 uint64 value",
                     setup.object_size()
                 ),
                 |unique_id| {
@@ -147,7 +147,7 @@ impl Workload for UniformV1Std {
             UniformV1Task::new(
                 "UPDATE",
                 format!(
-                    "Query='UPD db.db SET v += ? WHERE k = ?'; Params={}B binary key, 1 UInt8 value",
+                    "Query='UPD {DEFAULT_MODEL} SET v += ? WHERE k = ?'; Params={}B binary key, 1 uint64 value",
                     setup.object_size()
                 ),
                 |unique_id| {
@@ -161,7 +161,7 @@ impl Workload for UniformV1Std {
             UniformV1Task::new(
                 "SELECT",
                 format!(
-                    "Query='SEL v FROM db.db WHERE k = ?'; Params={}B binary key",
+                    "Query='SEL v FROM {DEFAULT_MODEL} WHERE k = ?'; Params={}B binary key",
                     setup.object_size()
                 ),
                 |unique_id| {
@@ -174,7 +174,7 @@ impl Workload for UniformV1Std {
             UniformV1Task::new(
                 "DELETE",
                 format!(
-                    "Query='DEL FROM db.db WHERE k = ?'; Params={}B binary key",
+                    "Query='DEL FROM {DEFAULT_MODEL} WHERE k = ?'; Params={}B binary key",
                     setup.object_size()
                 ),
                 |unique_id| {
```

#### Recent Merged Pull Requests:
- **PR #393** (2026-09-28): ci: avoid installs on self-hosted (@ohsayan)
- **PR #392** (2026-09-26): maintenance patch: 0.8.x patch1 (@ohsayan)
- **PR #391** (closed): build(deps): bump openssl from 0.10.68 to 0.10.78 (@dependabot[bot])
- **PR #390** (closed): build(deps): bump rand from 0.8.5 to 0.8.6 (@dependabot[bot])
- **PR #389** (closed): build(deps): bump rand from 0.8.5 to 0.9.3 (@dependabot[bot])
- **PR #387** (closed): build(deps): bump time from 0.3.37 to 0.3.47 (@dependabot[bot])
- **PR #386** (closed): build(deps): bump bytes from 1.9.0 to 1.11.1 (@dependabot[bot])
- **PR #381** (closed): Patch 1 (@findmaster969)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
