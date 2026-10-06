# Forensic Learning Record (Deep Inspection): skytable/skytable

> **Canonical Artifact**: `07_PROJECT_LEARNING/skytable-skytable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skytable/skytable](https://github.com/skytable/skytable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:51:47.418Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skytable/skytable`
- **Description**: Skytable is a modern scalable NoSQL database with BlueQL, designed for performance, scalability and flexibility. Skytable gives you spaces, models, data types, complex collections and more to build powerful experiences
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2663 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `harness/src/util.rs`
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
        build::BuildMode,
        {HarnessError, HarnessResult},
    },
    std::{
        env,
        ffi::OsStr,
        path::{Path, PathBuf},
        process::{Child, Command, Output},
    },
};

pub type ExitCode = Option<i32>;

#[cfg(not(test))]
pub const VAR_TARGET: &str = "TARGET";
#[cfg(test)]
pub const VAR_TARGET: &str = "TARGET_TESTSUITE";
#[cfg(not(test))]
pub const VAR_ARTIFACT: &str = "ARTIFACT";
#[cfg(test)]
pub const VAR_ARTIFACT: &str = "ARTIFACT_TESTSUITE";
pub const WORKSPACE_ROOT: &str = env!("ROOT_DIR");

pub fn get_var(var: &str) -> Option<String> {
    env::var_os(var).map(|v| v.to_string_lossy().to_string())
}

pub fn get_child(desc: impl ToString, mut input: Command) -> HarnessResult<Child> {
    let desc = desc.to_string();
    match input.spawn() {
        Ok(child) => Ok(child),
        Err(e) => Err(HarnessError::Other(format!(
            "Failed to spawn process for `{desc}` with error: {e}"
        ))),
    }
}

pub fn assemble_command_from_slice<T: AsRef<OsStr>>(commands: impl AsRef<[T]>) -> Command {
    let mut commands = commands.as_ref().iter();
    let mut c = Command::new(commands.next().unwrap());
    c.args(commands);
    c
}

fn check_child_err(desc: impl ToString, output: Output) -> HarnessResult<()> {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    error!("The child failed with stderr: `{stderr}` and stdout: `{stdout}`");
    Err(HarnessError::ChildError(
        desc.to_string(),
        output.status.code(),
    ))
}

pub fn ensure_child_success(id: &str, child: Child) -> HarnessResult<()> {
    let r = child
        .wait_with_output()
        .map_err(|e| HarnessError::Other(format!("Failed to get child output with error: {e}")))?;
    if r.status.success() {
        Ok(())
    } else {
        check_child_err(id, r)
    }
}

pub fn handle_child(desc: &str, input: Command) -> HarnessResult<()> {
    let child = self::get_child(desc, input)?;
    ensure_child_success(desc, child)
}

pub fn sleep_sec(secs: u64) {
    std::thread::sleep(std::time::Duration::from_secs(secs))
}

pub fn get_target_folder(mode: BuildMode) -> PathBuf {
    match env::var_os(VAR_TARGET).map(|v| v.to_string_lossy().to_string()) {
        Some(target) => format!("{WORKSPACE_ROOT}target/{target}/{}", mode.to_string()).into(),
        None => format!("{WORKSPACE_ROOT}target/{}", mode.to_string()).into(),
    }
}

/// Get the extension
pub fn add_extension(binary_name: &str) -> String {
    if cfg!(windows) {
        format!("{binary_name}.exe")
    } else {
        binary_name.to_owned()
    }
}

/// Returns `{body}/{binary_name}`
pub fn concat_path(binary_name: &str, body: impl AsRef<Path>) -> PathBuf {
    let mut pb = PathBuf::from(body.as_ref());
    pb.push(binary_name);
    pb
}

#[macro_export]
macro_rules! cmd {
    ($base:expr, $($cmd:expr),*) => {{
        let mut cmd = ::std::process::Command::new($base);
        $(
            cmd.arg($cmd);
        )*
        cmd
    }};
}

```

### Core Architecture Module: `libsky/src/cli_utils.rs`
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
use std::{
    collections::{hash_map::Entry, HashMap, HashSet},
    error::Error,
    fmt,
    str::FromStr,
};

/*
    cli args traits & types
*/

pub type CliResult<T> = Result<T, CliArgsError>;
pub type SingleOption = HashMap<String, String>;
pub type MultipleOptions = HashMap<String, Vec<String>>;

#[derive(Debug)]
pub enum CliArgsError {
    ArgFmtError(String),
    DuplicateFlag(String),
    DuplicateOption(String),
    SubcommandDisallowed,
    ArgParseError(String),
    Other(String),
}

impl fmt::Display for CliArgsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ArgFmtError(arg) => write!(f, "the argument `--{arg}` is formatted incorrectly"),
            Self::DuplicateFlag(flag) => {
                write!(f, "found duplicate flag `--{flag}` which is not allowed")
            }
            Self::DuplicateOption(opt) => {
                write!(f, "found duplicate option `--{opt}` which is not allowed")
            }
            Self::SubcommandDisallowed => write!(f, "subcommands are disallowed in this context"),
            Self::ArgParseError(arg) => write!(f, "failed to parse value assigned to `--{arg}`"),
            Self::Other(e) => write!(f, "{e}"),
        }
    }
}

impl Error for CliArgsError {}

pub trait CliArgsDecode: Sized {
    type Data;
    fn initialize<const SWITCH: bool>(iter: &mut impl Iterator<Item = impl ArgItem>) -> Self::Data;
    fn push_flag(data: &mut Self::Data, flag: String) -> CliResult<()>;
    fn push_option(
        data: &mut Self::Data,
        option_name: String,
        option_value: String,
    ) -> CliResult<()>;
    fn yield_subcommand(
        data: Self::Data,
        subcommand: String,
        args: impl IntoIterator<Item = impl ArgItem>,
    ) -> CliResult<Self>;
    fn yield_command(data: Self::Data) -> CliResult<Self>;
    fn yield_help(data: Self::Data) -> CliResult<Self>;
    fn yield_version(data: Self::Data) -> CliResult<Self>;
}

pub trait CommandLineArgs: Sized + CliArgsDecode {
    fn parse(src: impl IntoIterator<Item = impl ArgItem>) -> CliResult<Self> {
        decode_args::<Self, true>(src)
    }
    fn from_cli() -> CliResult<Self> {
        Self::parse(std::env::args())
    }
}

impl<T: Sized + CliArgsDecode> CommandLineArgs for T {}

/*
    helper traits
*/

pub trait ArgItem {
    fn as_str(&self) -> &str;
    fn boxed_str(self) -> String;
}

impl<'a> ArgItem for &'a str {
    fn as_str(&self) -> &str {
        self
    }
    fn boxed_str(self) -> String {
        self.to_owned()
    }
}

impl ArgItem for String {
    fn as_str(&self) -> &str {
        self
    }
    fn boxed_str(self) -> String {
        self
    }
}

pub trait CliArgsOptions: Default {
    type Value;
    fn is_unset(&self) -> bool;
    fn push_option(&mut self, option: String, value: String) -> CliResult<()>;
    fn take_option(&mut self, option: &str) -> Option<Self::Value>;
    fn contains(&self, option: &str) -> bool;
}

impl CliArgsOptions for SingleOption {
    type Value = String;
    fn is_unset(&self) -> bool {
        self.is_empty()
    }
    fn contains(&self, option: &str) -> bool {
        self.contains_key(option)
    }
    fn push_option(&mut self, option: String, value: String) -> CliResult<()> {
        match self.entry(option) {
            Entry::Vacant(ve) => {
                ve.insert(value);
                Ok(())
            }
            Entry::Occupied(oe) => return Err(CliArgsError::DuplicateOption(oe.key().to_string())),
        }
    }
    fn take_option(&mut self, option: &str) -> Option<Self::Value> {
        self.remove(option)
    }
}

impl CliArgsOptions for MultipleOptions {
    type Value = Vec<String>;
    fn is_unset(&self) -> bool {
        self.is_empty()
    }
    fn contains(&self, option: &str) -> bool {
        self.contains_key(option)
    }
    fn push_option(&mut self, option: String, value: String) -> CliResult<()> {
        match self.entry(option) {
            Entry::Occupied(mut oe) => oe.get_mut().push(value),
            Entry::Vacant(ve) => {
                ve.insert(vec![value]);
            }
        }
        Ok(())
    }
    fn take_option(&mut self, option: &str) -> Option<Self::Value> {
        self.remove(option)
    }
}

/*
    args decoder
*/

fn decode_args<C: CliArgsDecode, const HAS_BINARY_NAME: bool>(
    src: impl IntoIterator<Item = impl ArgItem>,
) -> CliResult<C> {
    let mut args = src.into_iter().peekable();
    if HAS_BINARY_NAME {
        // must not be empty
        if args.peek().is_none() {
            return Err(CliArgsError::Other(
                "expected arguments but found none".to_owned(),
            ));
        }
    }
    let mut cli_data = C::initialize::<HAS_BINARY_NAME>(&mut args);
    while let Some(arg) = args.next() {
        let arg = arg.as_str();
        let arg = if arg == "-h" || arg == "--help" {
            return C::yield_help(cli_data);
        } else if arg == "-v" || arg == "--version" {
            return C::yield_version(cli_data);
        } else {
            if arg.starts_with("--") {
                // option or flag
                &arg[2..]
            } else if arg.starts_with("-") {
                if arg.len() != 2 {
                    // invalid shorthand
                    return Err(CliArgsError::Other(format!(
                        "the argument `{arg}` is formatted incorrectly"
                    )));
                }
                // option or flag
                &arg[1..]
            } else {
                // this is subcommand
                return C::yield_subcommand(cli_data, arg.boxed_str(), args);
            }
        };
        if arg.is_empty() {
            return Err(CliArgsError::ArgFmtError(format!("invalid argument")));
        }
        // is this arg in the --x=y format?
        let mut arg_split = arg.split("=");
        let (arg_split_name_, arg_split_value_) = (arg_split.next(), arg_split.next());
        match (arg_split_name_, arg_split_value_) {
            (Some(name_), Some(value_)) => {
                if name_.is_empty() || value_.is_empty() {
                    return Err(CliArgsError::ArgFmtError(arg.to_string()));
                }
                // yes, it was formatted this way
                C::push_option(&mut cli_data, name_.boxed_str(), value_.boxed_str())?;
                continue;
            }
            (Some(_), None) => {}
            _ => unreachable!(),
        }
        // no, probably in the --x y format
        match args.peek() {
            Some(arg_) => {
                if arg_.as_str().starts_with("--") || arg_.as_str().starts_with("-") {
                    // flag
                    C::push_flag(&mut cli_data, arg.boxed_str())?;
                } else {
                    // option
                    C::push_option(
                        &mut cli_data,
                        arg.boxed_str(),
                        args.next().unwrap().boxed_str(),
                    )?;
                }
            }
            None => {
                // flag
                C::push_flag(&mut cli_data, arg.boxed_str())?;
            }
        }
    }
    C::yield_command(cli_data)
}

/*
    cli arg impl: CliCommand (simple, subcommand-less)
*/

#[derive(Debug, PartialEq)]
pub enum CliCommand<Opt: CliArgsOptions> {
    Help(CliCommandData<Opt>),
    Run(CliCommandData<Opt>),
    Version(CliCommandData<Opt>),
}

#[derive(Debug, PartialEq, Clone)]
pub struct CliCommandData<Opt: CliArgsOptions> {
    options: Opt,
    flags: HashSet<String>,
}

impl<Opt: CliArgsOptions> CliCommandData<Opt> {
    pub fn take_flag(&mut self, flag: &str) -> CliResult<bool> {
        if self.flags.remove(flag) {
            Ok(true)
        } else {
            if self.options.contains(flag) {
                Err(CliArgsError::Other(format!(
                    "expected `--{flag}` to be a flag but found an option"
                )))
            } else {
                Ok(false)
            }
        }
    }
    pub fn into_options_only(self) -> CliResult<Opt> {
        if self.flags.is_empty() {
            Ok(self.options)
        } else {
            Err(CliArgsError::Other(format!(
                "no flags were expected in this context"
            )))
        }
    }
    pub fn is_empty(&self) -> bool {
        self.options.is_unset() && self.flags.is_empty()
    }
    pub fn ensure_empty(&self) -> CliResult<()> {
        if self.is_empty() {
            Ok(())
        } else {
            Err(CliArgsError::Other(format!(
                "found unknown flags or options",
            )))
        }
    }
    pub fn take_option(&mut self, option: &str) -> CliResult<Option<Opt::Value>> {
        match self.options.take_option(option) {
            Some(opt) => Ok(Some(opt)),
            None => {
                if self.flags.contains(option) {
                    Err(CliArgsError::Other(format!(
                 
```

### Core Architecture Module: `libsky/src/utils.rs`
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
    super::variables,
    std::{collections::HashMap, env, path::PathBuf},
};

pub fn format(body: &str, arguments: &HashMap<&str, &str>, auto: bool) -> String {
    use regex::Regex;
    let pattern = r"\{[a-zA-Z_][a-zA-Z_0-9]*\}|\{\}";
    let re = Regex::new(pattern).unwrap();
    re.replace_all(body.as_ref(), |caps: &regex::Captures| {
        let capture: &str = &caps[0];
        let capture = &capture[1..capture.len() - 1];
        match capture {
            "" => {
                panic!("found an empty format")
            }
            "default_tcp_endpoint" if auto => "tcp@127.0.0.1:2003".to_owned(),
            "default_tls_endpoint" if auto => "tls@127.0.0.1:2004".to_owned(),
            "password_env_var" if auto => variables::env_vars::SKYDB_PASSWORD.into(),
            "version" if auto => format!("v{}", variables::VERSION),
            "further_assistance" if auto => "For further assistance, refer to the official documentation here: https://docs.skytable.org".to_owned(),
            arbitrary => arguments
                .get(arbitrary)
                .expect(&format!("could not find value for argument {}", arbitrary))
                .to_string(),
        }
    })
    .to_string()
}

pub fn get_home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        env::var("USERPROFILE").map(PathBuf::from).ok()
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        env::var("HOME").map(PathBuf::from).ok()
    }
}

```

### Core Architecture Module: `server/src/engine/config.rs`
```
/*
 * Created on Fri Sep 22 2023
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
    crate::engine::{error::RuntimeResult, fractal},
    core::fmt,
    libsky::cli_utils::{ArgItem, CliMultiCommand, CommandLineArgs, MultipleOptions, SingleOption},
    serde::Deserialize,
    std::{collections::HashMap, fs},
};

/*
    misc
*/

pub type ParsedRawArgs = std::collections::HashMap<String, Vec<String>>;
pub const ROOT_PASSWORD_MIN_LEN: usize = 16;

#[derive(Debug, PartialEq)]
pub struct ModifyGuard<T> {
    val: T,
    modified: bool,
}

impl<T> ModifyGuard<T> {
    pub const fn new(val: T) -> Self {
        Self {
            val,
            modified: false,
        }
    }
}

impl<T> core::ops::Deref for ModifyGuard<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.val
    }
}

impl<T> core::ops::DerefMut for ModifyGuard<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.modified = true;
        &mut self.val
    }
}

/*
    configuration
*/

#[derive(Debug, PartialEq)]
/// The final configuration that can be used to start up all services
pub struct Configuration {
    pub endpoints: ConfigEndpoint,
    pub mode: ConfigMode,
    pub system: ConfigSystem,
    pub auth: ConfigAuth,
}

impl Configuration {
    #[cfg(test)]
    pub fn new(
        endpoints: ConfigEndpoint,
        mode: ConfigMode,
        system: ConfigSystem,
        auth: ConfigAuth,
    ) -> Self {
        Self {
            endpoints,
            mode,
            system,
            auth,
        }
    }
    const DEFAULT_HOST: &'static str = "127.0.0.1";
    const DEFAULT_PORT_TCP: u16 = 2003;
    pub fn default_dev_mode(auth: DecodedAuth) -> Self {
        Self {
            endpoints: ConfigEndpoint::Insecure(ConfigEndpointTcp {
                host: Self::DEFAULT_HOST.to_owned(),
                port: Self::DEFAULT_PORT_TCP,
            }),
            mode: ConfigMode::Dev,
            system: ConfigSystem::new(fractal::GENERAL_EXECUTOR_WINDOW),
            auth: ConfigAuth::new(auth.plugin, auth.root_pass),
        }
    }
}

// endpoint config

#[derive(Debug, PartialEq)]
/// Endpoint configuration (TCP/TLS/TCP+TLS)
pub enum ConfigEndpoint {
    Insecure(ConfigEndpointTcp),
    Secure(ConfigEndpointTls),
    Multi(ConfigEndpointTcp, ConfigEndpointTls),
}

#[derive(Debug, PartialEq, Clone)]
/// TCP endpoint configuration
pub struct ConfigEndpointTcp {
    host: String,
    port: u16,
}

impl ConfigEndpointTcp {
    #[cfg(test)]
    pub fn new(host: String, port: u16) -> Self {
        Self { host, port }
    }
    pub fn host(&self) -> &str {
        self.host.as_ref()
    }
    pub fn port(&self) -> u16 {
        self.port
    }
}

#[derive(Debug, PartialEq)]
/// TLS endpoint configuration
pub struct ConfigEndpointTls {
    pub tcp: ConfigEndpointTcp,
    cert: String,
    private_key: String,
    pkey_pass: String,
}

impl ConfigEndpointTls {
    #[cfg(test)]
    pub fn new(
        tcp: ConfigEndpointTcp,
        cert: String,
        private_key: String,
        pkey_pass: String,
    ) -> Self {
        Self {
            tcp,
            cert,
            private_key,
            pkey_pass,
        }
    }
    pub fn tcp(&self) -> &ConfigEndpointTcp {
        &self.tcp
    }
    pub fn cert(&self) -> &str {
        self.cert.as_ref()
    }
    pub fn private_key(&self) -> &str {
        self.private_key.as_ref()
    }
    pub fn pkey_pass(&self) -> &str {
        self.pkey_pass.as_ref()
    }
}

/*
    config mode
*/

#[derive(Debug, PartialEq, Deserialize, Clone, Copy)]
/// The configuration mode
pub enum ConfigMode {
    /// In [`ConfigMode::Dev`] we're allowed to be more relaxed with settings
    #[serde(rename = "dev")]
    Dev,
    /// In [`ConfigMode::Prod`] we're more stringent with settings
    #[serde(rename = "prod")]
    Prod,
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum BackupType {
    Direct,
}

#[derive(Debug, PartialEq)]
pub struct BackupSettings {
    pub to: String,
    pub from: Option<String>,
    pub kind: BackupType,
    pub description: Option<String>,
    pub allow_dirty: bool,
}

impl BackupSettings {
    fn new(
        to: String,
        from: Option<String>,
        kind: BackupType,
        description: Option<String>,
        allow_dirty: bool,
    ) -> Self {
        Self {
            to,
            from,
            kind,
            description,
            allow_dirty,
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct RestoreSettings {
    pub from: String,
    pub to: Option<String>,
    pub flag_allow_incompatible: bool,
    pub flag_allow_different_host: bool,
    pub flag_allow_invalid_date: bool,
    pub flag_delete_on_restore_completion: bool,
    pub flag_skip_compatibility_check: bool,
}

impl RestoreSettings {
    fn new(
        from: String,
        to: Option<String>,
        flag_allow_incompatible: bool,
        flag_allow_different_host: bool,
        flag_allow_invalid_date: bool,
        flag_delete_on_restore_completion: bool,
        flag_skip_compatibility_check: bool,
    ) -> Self {
        Self {
            from,
            to,
            flag_allow_incompatible,
            flag_allow_different_host,
            flag_allow_invalid_date,
            flag_delete_on_restore_completion,
            flag_skip_compatibility_check,
        }
    }
}

/*
    config system
*/

#[derive(Debug, PartialEq)]
/// System configuration settings
pub struct ConfigSystem {
    /// time window in seconds for the reliability system to kick-in automatically
    pub reliability_system_window: u64,
}

impl ConfigSystem {
    pub fn new(reliability_system_window: u64) -> Self {
        Self {
            reliability_system_window,
        }
    }
}

/*
    config auth
*/

#[derive(Debug, PartialEq, Deserialize, Clone, Copy)]
pub enum AuthDriver {
    #[serde(rename = "pwd")]
    Pwd,
}

#[derive(Debug, PartialEq, Deserialize, Clone)]
pub struct ConfigAuth {
    pub plugin: AuthDriver,
    pub root_key: String,
}

impl ConfigAuth {
    pub fn new(plugin: AuthDriver, root_key: String) -> Self {
        Self { plugin, root_key }
    }
}

/**
    decoded configuration
    ---
    the "raw" configuration that we got from the user. not validated
*/
#[derive(Debug, PartialEq, Deserialize)]
pub struct DecodedConfiguration {
    system: Option<DecodedSystemConfig>,
    endpoints: Option<DecodedEPConfig>,
    auth: Option<DecodedAuth>,
}

impl Default for DecodedConfiguration {
    fn default() -> Self {
        Self {
            system: Default::default(),
            endpoints: Default::default(),
            auth: None,
        }
    }
}

#[derive(Debug, PartialEq, Deserialize)]
pub struct DecodedAuth {
    plugin: AuthDriver,
    root_pass: String,
}

#[derive(Debug, PartialEq, Deserialize)]
/// Decoded system configuration
pub struct DecodedSystemConfig {
    mode: Option<ConfigMode>,
    rs_window: Option<u64>,
}

#[derive(Debug, PartialEq, Deserialize)]
/// Decoded endpoint configuration
pub struct DecodedEPConfig {
    secure: Option<DecodedEPSecureConfig>,
    insecure: Option<DecodedEPInsecureConfig>,
}

#[derive(Debug, PartialEq, Deserialize)]
/// Decoded secure port configuration
pub struct DecodedEPSecureConfig {
    host: String,
    port: u16,
    cert: String,
    private_key: String,
    pkey_passphrase: String,
}

#[derive(Debug, PartialEq, Deserialize)]
/// Decoded insecure port configuration
pub struct DecodedEPInsecureConfig {
    host: String,
    port: u16,
}

impl DecodedEPInsecureConfig {
    pub fn new(host: &str, port: u16) -> Self {
        Self {
            host: host.to_owned(),
            port,
        }
    }
}

/*
    errors and misc
*/

#[derive(Debug)]
#[cfg_attr(test, derive(PartialEq))]
/// A configuration error (with an optional error origin source)
pub struct ConfigError {
    source: Option<ConfigSource>,
    kind: ConfigErrorKind,
}

impl From<libsky::cli_utils::CliArgsError> for ConfigError {
    fn from(err: libsky::cli_utils::CliArgsError) -> Self {
        Self::with_src(
            ConfigSource::Cli,
            ConfigErrorKind::ErrorString(err.to_string()),
        )
    }
}

impl ConfigError {
    /// Init config error
    fn _new(source: Option<ConfigSource>, kind: ConfigErrorKind) -> Self {
        Self { kind, source }
    }
    /// New config error with no source
    fn new(kind: ConfigErrorKind) -> Self {
        Self::_new(None, kind)
    }
    /// New config error with the given source
    fn with_src(source: ConfigSource, kind: ConfigErrorKind) -> Self {
        Self::_new(Some(source), kind)
    }
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.source {
            Some(src) => write!(f, "config error in {}: ", src.as_str())?,
            None => {}
        }
        match &self.kind {
            ConfigErrorKind::Conflict => write!(
                f,
                "conflicting settings. please choose either CLI or ENV or co
```

### Core Architecture Module: `server/src/engine/core/dcl.rs`
```
/*
 * Created on Fri Nov 10 2023
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

use crate::engine::{
    core::system_db::SystemDatabase,
    data::{tag::TagClass, DictEntryGeneric},
    error::{QueryError, QueryResult},
    fractal::GlobalInstanceLike,
    mem::unsafe_apis::BoxStr,
    net::protocol::ClientLocalState,
    ql::dcl::{SysctlCommand, UserDecl, UserDel},
};

const KEY_PASSWORD: &str = "password";

pub fn exec<G: GlobalInstanceLike>(
    g: G,
    current_user: &ClientLocalState,
    cmd: SysctlCommand,
) -> QueryResult<()> {
    exec_ref(&g, current_user, cmd)
}

pub fn exec_ref<G: GlobalInstanceLike>(
    g: &G,
    current_user: &ClientLocalState,
    cmd: SysctlCommand,
) -> QueryResult<()> {
    if cmd.needs_root() && !current_user.is_root() {
        return Err(QueryError::SysPermissionDenied);
    }
    match cmd {
        SysctlCommand::CreateUser(new) => create_user(g, new),
        SysctlCommand::DropUser(drop) => drop_user(g, current_user, drop),
        SysctlCommand::AlterUser(usermod) => alter_user(g, current_user, usermod),
        SysctlCommand::ReportStatus => {
            if g.health().status_okay() {
                Ok(())
            } else {
                Err(QueryError::SysServerError)
            }
        }
    }
}

fn guard_root_or_self(me: &ClientLocalState, target_username: &str) -> QueryResult<()> {
    if me.username() == target_username || target_username == SystemDatabase::ROOT_ACCOUNT {
        // you can't delete or change your own account (log out first) or the root account
        return Err(QueryError::SysAuthError);
    }
    Ok(())
}

fn get_user_data<'a>(mut user: UserDecl<'a>) -> Result<(BoxStr, String), QueryError> {
    let password = match user.options_mut().remove(KEY_PASSWORD) {
        Some(DictEntryGeneric::Data(d))
            if d.kind() == TagClass::Str && user.options().is_empty() =>
        unsafe { d.into_str().unwrap_unchecked() },
        None | Some(_) => {
            // invalid properties
            return Err(QueryError::QExecDdlInvalidProperties);
        }
    };
    Ok((BoxStr::new(user.username()), password))
}

fn create_user(global: &impl GlobalInstanceLike, user: UserDecl) -> QueryResult<()> {
    let (username, password) = get_user_data(user)?;
    global
        .state()
        .namespace()
        .sys_db()
        .create_user(global, username, &password)
}

fn alter_user(
    global: &impl GlobalInstanceLike,
    me: &ClientLocalState,
    user: UserDecl,
) -> QueryResult<()> {
    guard_root_or_self(me, user.username())?;
    let (username, password) = get_user_data(user)?;
    global
        .state()
        .namespace()
        .sys_db()
        .alter_user(global, &username, &password)
}

fn drop_user(
    global: &impl GlobalInstanceLike,
    me: &ClientLocalState,
    user_del: UserDel<'_>,
) -> QueryResult<()> {
    guard_root_or_self(me, user_del.username())?;
    global
        .state()
        .namespace()
        .sys_db()
        .drop_user(global, user_del.username())
}

```

### Core Architecture Module: `server/src/engine/core/ddl_misc.rs`
```
/*
 * Created on Thu Nov 30 2023
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

use crate::engine::{
    error::{QueryError, QueryResult},
    fractal::GlobalInstanceLike,
    net::protocol::{ClientLocalState, Response, ResponseType},
    ql::ddl::Inspect,
};

pub fn inspect(
    g: &impl GlobalInstanceLike,
    c: &ClientLocalState,
    stmt: Inspect,
) -> QueryResult<Response> {
    let ret = match stmt {
        Inspect::Global => {
            // collect spaces
            let spaces = g.state().namespace().idx().read();
            let mut spaces_iter = spaces.iter().peekable();
            let mut ret = format!("{{\"spaces\":[");
            while let Some((space, _)) = spaces_iter.next() {
                ret.push('"');
                ret.push_str(&space);
                ret.push('"');
                if spaces_iter.peek().is_some() {
                    ret.push(',');
                }
            }
            if c.is_root() {
                // iff the user is root, show information about other users. if not, just show models and settings
                ret.push_str("],\"users\":[");
                drop(spaces_iter);
                drop(spaces);
                // collect users
                let users = g.state().namespace().sys_db().users().read();
                let mut users_iter = users.iter().peekable();
                while let Some((user, _)) = users_iter.next() {
                    ret.push('"');
                    ret.push_str(&user);
                    ret.push('"');
                    if users_iter.peek().is_some() {
                        ret.push(',');
                    }
                }
            }
            ret.push_str("],\"settings\":{}}");
            ret
        }
        Inspect::Model(m) => match g.state().namespace().idx_models().read().get(&m) {
            Some(m) => {
                let m = m.data();
                format!(
                    "{{\"decl\":\"{}\",\"rows\":{},\"properties\":{{}}}}",
                    m.describe(),
                    m.primary_index().count()
                )
            }
            None => return Err(QueryError::QExecObjectNotFound),
        },
        Inspect::Space(s) => match g.state().namespace().idx().read().get(s.as_str()) {
            Some(s) => {
                let mut ret = format!("{{\"models\":[");
                let mut models_iter = s.models().iter().peekable();
                while let Some(mdl) = models_iter.next() {
                    ret.push('\"');
                    ret.push_str(&mdl);
                    ret.push('\"');
                    if models_iter.peek().is_some() {
                        ret.push(',');
                    }
                }
                ret.push_str("]}}");
                ret
            }
            None => return Err(QueryError::QExecObjectNotFound),
        },
    };
    Ok(Response::Serialized {
        ty: ResponseType::String,
        size: ret.len(),
        data: ret.into_bytes(),
    })
}

```

### Core Architecture Module: `server/src/engine/core/dml/del.rs`
```
/*
 * Created on Sat May 06 2023
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

use crate::engine::{
    core::{self, dml::QueryExecMeta, model::delta::DataDeltaKind},
    error::{QueryError, QueryResult},
    fractal::GlobalInstanceLike,
    idx::MTIndex,
    net::protocol::Response,
    ql::dml::del::DeleteStatement,
    sync,
};

pub fn delete_resp(
    global: &impl GlobalInstanceLike,
    delete: DeleteStatement,
) -> QueryResult<Response> {
    self::delete(global, delete).map(|_| Response::Empty)
}

pub fn delete(global: &impl GlobalInstanceLike, mut delete: DeleteStatement) -> QueryResult<()> {
    core::with_model_for_data_update(global, delete.entity(), |model| {
        let g = sync::atm::cpin();
        let delta_state = model.delta_state();
        let _idx_latch = model.primary_index().acquire_shared();
        // create new version
        let new_version = delta_state.create_new_data_delta_version();
        match model
            .primary_index()
            .__raw_index()
            .mt_delete_return_entry(&model.resolve_where(delete.clauses_mut())?, &g)
        {
            Some(row) => {
                row.d_data().write().set_txn_revised(new_version);
                let dp = delta_state.append_new_data_delta_with(
                    DataDeltaKind::Delete,
                    row.clone(),
                    new_version,
                    &g,
                );
                Ok(QueryExecMeta::new(dp))
            }
            None => Err(QueryError::QExecDmlRowNotFound),
        }
    })
}

```

### Core Architecture Module: `server/src/engine/core/dml/ins.rs`
```
/*
 * Created on Mon May 01 2023
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

use crate::engine::{
    core::{
        self,
        dml::QueryExecMeta,
        index::{DcFieldIndex, PrimaryIndexKey, Row},
        model::{delta::DataDeltaKind, ModelData},
    },
    error::{QueryError, QueryResult},
    fractal::GlobalInstanceLike,
    idx::{IndexBaseSpec, MTIndex, STIndex, STIndexExt, STIndexSeq},
    net::protocol::Response,
    ql::dml::ins::{InsertData, InsertStatement},
    sync::atm::cpin,
};

pub fn insert_resp(
    global: &impl GlobalInstanceLike,
    insert: InsertStatement,
) -> QueryResult<Response> {
    self::insert(global, insert).map(|_| Response::Empty)
}

pub fn insert(global: &impl GlobalInstanceLike, insert: InsertStatement) -> QueryResult<()> {
    core::with_model_for_data_update(global, insert.entity(), |mdl| {
        let (pk, data) = prepare_insert(mdl, insert.data())?;
        let _idx_latch = mdl.primary_index().acquire_shared();
        let g = cpin();
        let ds = mdl.delta_state();
        // create new version
        let new_version = ds.create_new_data_delta_version();
        let row = Row::new(pk, data, ds.schema_current_version(), new_version);
        if mdl.primary_index().__raw_index().mt_insert(row.clone(), &g) {
            // append delta for new version
            let dp = ds.append_new_data_delta_with(DataDeltaKind::Insert, row, new_version, &g);
            Ok(QueryExecMeta::new(dp))
        } else {
            Err(QueryError::QExecDmlDuplicate)
        }
    })
}

pub fn upsert(global: &impl GlobalInstanceLike, insert: InsertStatement) -> QueryResult<bool> {
    let mut ret = false;
    core::with_model_for_data_update(global, insert.entity(), |mdl| {
        let (pk, data) = prepare_insert(mdl, insert.data())?;
        let _idx_latch = mdl.primary_index().acquire_shared();
        let g = cpin();
        let ds = mdl.delta_state();
        // create new version
        let new_version = ds.create_new_data_delta_version();
        let row = Row::new(pk, data, ds.schema_current_version(), new_version);
        ret = mdl.primary_index().__raw_index().mt_upsert(row.clone(), &g);
        // append delta for new version
        let dp = ds.append_new_data_delta_with(DataDeltaKind::Upsert, row, new_version, &g);
        Ok(QueryExecMeta::new(dp))
    })
    .map(|_| ret)
}

pub fn upsert_resp(
    global: &impl GlobalInstanceLike,
    insert: InsertStatement,
) -> QueryResult<Response> {
    self::upsert(global, insert).map(Response::Bool)
}

// TODO(@ohsayan): optimize null case
fn prepare_insert(
    model: &ModelData,
    insert: InsertData,
) -> QueryResult<(PrimaryIndexKey, DcFieldIndex)> {
    let fields = model.fields();
    let mut okay = fields.len() == insert.column_count();
    let mut prepared_data = DcFieldIndex::idx_init_cap(fields.len());
    match insert {
        InsertData::Ordered(tuple) => {
            let mut fields = fields.stseq_ord_kv();
            let mut tuple = tuple.into_iter();
            while (tuple.len() != 0) & okay {
                let mut data;
                let field;
                unsafe {
                    // UNSAFE(@ohsayan): safe because of invariant
                    data = tuple.next().unwrap_unchecked();
                    // UNSAFE(@ohsayan): safe because of flag
                    field = fields.next().unwrap_unchecked();
                }
                let (field_id, field) = field;
                okay &= field.vt_data_fpath(&mut data);
                okay &= prepared_data.st_insert(
                    unsafe {
                        // UNSAFE(@ohsayan): the model is right here, so we're good
                        field_id.clone()
                    },
                    data,
                );
            }
        }
        InsertData::Map(map) => {
            let mut inserted = 0;
            let mut map = map.into_iter();
            while (map.len() != 0) & okay {
                let (field_id, mut data) = unsafe {
                    // UNSAFE(@ohsayan): loop precondition
                    map.next().unwrap_unchecked()
                };
                let (spec_field_name, spec_field) =
                    match fields.stext_get_key_value(field_id.as_str()) {
                        Some(f) => f,
                        None => {
                            okay = false;
                            break;
                        }
                    };
                okay &= spec_field.vt_data_fpath(&mut data);
                prepared_data.st_insert(
                    unsafe {
                        // UNSAFE(@ohsayan): as long as model lives, we're good
                        spec_field_name.clone()
                    },
                    data,
                );
                inserted += 1;
            }
            okay &= inserted == fields.len();
        }
    }
    let primary_key = prepared_data.remove(model.p_key());
    okay &= primary_key.is_some();
    if okay {
        let primary_key = unsafe {
            // UNSAFE(@ohsayan): okay check above
            PrimaryIndexKey::new_from_dc(primary_key.unwrap_unchecked())
        };
        Ok((primary_key, prepared_data))
    } else {
        Err(QueryError::QExecDmlValidationError)
    }
}

```

### Core Architecture Module: `server/src/engine/core/dml/mod.rs`
```
/*
 * Created on Mon May 01 2023
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

mod del;
mod ins;
mod sel;
mod upd;

use crate::{
    engine::{
        core::model::ModelData,
        data::{lit::Lit, tag::DataTag},
        error::{QueryError, QueryResult},
        fractal::GlobalInstanceLike,
        idx::MTIndex,
        ql::dml::{trunc::TruncateStmt, WhereClause},
        storage::{BatchStats, Truncate},
    },
    util::compiler,
};

#[cfg(test)]
pub use {
    del::delete,
    ins::insert,
    sel::{select_all, select_custom},
    upd::{collect_trace_path as update_flow_trace, update},
};
pub use {
    del::delete_resp,
    ins::{insert_resp, upsert_resp},
    sel::{select_all_resp, select_resp},
    upd::update_resp,
};

impl ModelData {
    pub(self) fn resolve_where<'a>(
        &self,
        where_clause: &mut WhereClause<'a>,
    ) -> QueryResult<Lit<'a>> {
        match where_clause.clauses_mut().remove(self.p_key().as_bytes()) {
            Some(clause)
                if clause.filter_hint_none()
                    & (clause.rhs().kind().tag_unique() == self.p_tag().tag_unique()) =>
            {
                Ok(clause.rhs())
            }
            _ => compiler::cold_rerr(QueryError::QExecDmlWhereHasUnindexedColumn),
        }
    }
}

#[derive(Debug)]
pub struct QueryExecMeta {
    delta_hint: usize,
}

impl QueryExecMeta {
    pub fn new(delta_hint: usize) -> Self {
        Self { delta_hint }
    }
    pub fn zero() -> Self {
        Self::new(0)
    }
    pub fn delta_hint(&self) -> usize {
        self.delta_hint
    }
}

pub fn truncate(g: &impl GlobalInstanceLike, stmt: TruncateStmt) -> QueryResult<()> {
    match stmt {
        TruncateStmt::Model(mdl_id) => {
            g.state()
                .namespace()
                .with_full_model_for_ddl(mdl_id, |_, mdl| {
                    // commit truncate
                    {
                        let mut drv = mdl.driver().batch_driver().lock();
                        drv.as_mut()
                            .unwrap()
                            .commit_with_ctx(Truncate, BatchStats::new())?;
                        // good now clear delta state
                    }
                    // wipe the index
                    mdl.data()
                        .primary_index()
                        .__raw_index()
                        .mt_clear(&crossbeam_epoch::pin());
                    // reset delta state
                    mdl.data_mut().delta_state_mut().__reset();
                    // increment runtime ID to invalidate previously queued tasks
                    mdl.data_mut().increment_runtime_id();
                    // done
                    Ok(())
                })
        }
    }
}

```

### Core Architecture Module: `server/src/engine/core/dml/sel.rs`
```
/*
 * Created on Thu May 11 2023
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

use crate::engine::{
    core::{
        index::{
            DcFieldIndex, IndexLatchHandleExclusive, PrimaryIndexKey, Row, RowData, RowDataLck,
        },
        model::ModelData,
    },
    data::{
        cell::{Datacell, VirtualDatacell},
        tag::{DataTag, TagClass},
    },
    error::{QueryError, QueryResult},
    fractal::GlobalInstanceLike,
    idx::{IndexMTRaw, MTIndexExt, STIndex, STIndexSeq},
    mem::IntegerRepr,
    net::protocol::{Response, ResponseType},
    ql::dml::sel::{SelectAllStatement, SelectStatement},
    sync,
};

pub fn select_resp(
    global: &impl GlobalInstanceLike,
    select: SelectStatement,
) -> QueryResult<Response> {
    let mut data = vec![];
    let mut i = 0usize;
    self::select_custom(global, select, |item| {
        encode_cell(&mut data, item);
        i += 1;
    })?;
    Ok(Response::Serialized {
        ty: ResponseType::Row,
        size: i,
        data,
    })
}

pub fn select_all_resp(
    global: &impl GlobalInstanceLike,
    select: SelectAllStatement,
) -> QueryResult<Response> {
    let mut ret_buf = Vec::new();
    let i = self::select_all(
        global,
        select,
        &mut ret_buf,
        |buf, _, col_c| {
            IntegerRepr::scoped(col_c as u64, |repr| buf.extend(repr));
            buf.push(b'\n');
        },
        |buf, data, _| encode_cell(buf, data),
    )?;
    Ok(Response::Serialized {
        ty: ResponseType::MultiRow,
        size: i,
        data: ret_buf,
    })
}

pub fn select_all<Fm, F, T>(
    global: &impl GlobalInstanceLike,
    select: SelectAllStatement,
    serialize_target: &mut T,
    mut f_mdl: Fm,
    mut f: F,
) -> QueryResult<usize>
where
    Fm: FnMut(&mut T, &ModelData, usize),
    F: FnMut(&mut T, &Datacell, usize),
{
    global.state().namespace().with_model(select.entity, |mdl| {
        let g = sync::atm::cpin();
        let mut i = 0;
        if select.wildcard {
            f_mdl(serialize_target, mdl, mdl.fields().len());
            for (key, data) in RowIteratorAll::new(&g, mdl, select.limit as usize) {
                let vdc = VirtualDatacell::new_pk(key, mdl.p_tag());
                for key in mdl.fields().stseq_ord_key() {
                    let r = if key.as_str() == mdl.p_key() {
                        &*vdc
                    } else {
                        data.fields().get(key).unwrap()
                    };
                    f(serialize_target, r, mdl.fields().len());
                }
                i += 1;
            }
        } else {
            // schema check
            if select.fields.len() > mdl.fields().len()
                || select
                    .fields
                    .iter()
                    .any(|f| !mdl.fields().st_contains(f.as_str()))
            {
                return Err(QueryError::QExecUnknownField);
            }
            f_mdl(serialize_target, mdl, select.fields.len());
            for (key, data) in RowIteratorAll::new(&g, mdl, select.limit as usize) {
                let vdc = VirtualDatacell::new_pk(key, mdl.p_tag());
                for key in select.fields.iter() {
                    let r = if key.as_str() == mdl.p_key() {
                        &*vdc
                    } else {
                        data.fields().st_get(key.as_str()).unwrap()
                    };
                    f(serialize_target, r, select.fields.len());
                }
                i += 1;
            }
        }
        Ok(i)
    })
}

fn encode_cell(resp: &mut Vec<u8>, item: &Datacell) {
    resp.push((item.tag().tag_selector().value_u8() + 1) * (item.is_init() as u8));
    if item.is_null() {
        return;
    }
    unsafe {
        // UNSAFE(@ohsayan): +tagck
        match item.tag().tag_class() {
            TagClass::Bool => return resp.push(item.read_bool() as _),
            TagClass::UnsignedInt => IntegerRepr::scoped(item.read_uint(), |b| resp.extend(b)),
            TagClass::SignedInt => IntegerRepr::scoped(item.read_sint(), |b| resp.extend(b)),
            TagClass::Float => resp.extend(item.read_float().to_string().as_bytes()),
            TagClass::Bin | TagClass::Str => {
                let slc = item.read_bin();
                IntegerRepr::scoped(slc.len() as u64, |b| resp.extend(b));
                resp.push(b'\n');
                resp.extend(slc);
                return;
            }
            TagClass::List => {
                let list = item.read_list();
                let ls = list.read();
                IntegerRepr::scoped(ls.len() as u64, |b| resp.extend(b));
                resp.push(b'\n');
                for item in ls.iter() {
                    encode_cell(resp, item);
                }
                return;
            }
        }
    }
    resp.push(b'\n');
}

pub fn select_custom<F>(
    global: &impl GlobalInstanceLike,
    mut select: SelectStatement,
    mut cellfn: F,
) -> QueryResult<()>
where
    F: FnMut(&Datacell),
{
    global
        .state()
        .namespace()
        .with_model(select.entity(), |mdl| {
            let target_key = mdl.resolve_where(select.clauses_mut())?;
            let pkdc = VirtualDatacell::new(target_key.clone(), mdl.p_tag().tag_unique());
            let g = sync::atm::cpin();
            let mut read_field = |key, fields: &DcFieldIndex| {
                match fields.st_get(key) {
                    Some(dc) => cellfn(dc),
                    None if key == mdl.p_key() => cellfn(&pkdc),
                    None => return Err(QueryError::QExecUnknownField),
                }
                Ok(())
            };
            match mdl.primary_index().select(target_key.clone(), &g) {
                Some(row) => {
                    let r = row.resolve_schema_deltas_and_freeze(mdl.delta_state());
                    if select.is_wildcard() {
                        for key in mdl.fields().stseq_ord_key() {
                            read_field(key.as_ref(), r.fields())?;
                        }
                    } else {
                        for key in select.into_fields() {
                            read_field(key.as_str(), r.fields())?;
                        }
                    }
                }
                None => return Err(QueryError::QExecDmlRowNotFound),
            }
            Ok(())
        })
}

struct RowIteratorAll<'g> {
    _g: &'g sync::atm::Guard,
    mdl: &'g ModelData,
    iter: <IndexMTRaw<Row> as MTIndexExt<Row, PrimaryIndexKey, RowDataLck>>::IterEntry<'g, 'g, 'g>,
    _latch: IndexLatchHandleExclusive<'g>,
    limit: usize,
}

impl<'g> RowIteratorAll<'g> {
    fn new(g: &'g sync::atm::Guard, mdl: &'g ModelData, limit: usize) -> Self {
        let idx = mdl.primary_index();
        let latch = idx.acquire_exclusive();
        Self {
            _g: g,
            mdl,
            iter: idx.__raw_index().mt_iter_entry(g),
            _latch: latch,
            limit,
        }
    }
    fn _next(
        &mut self,
    ) -> Option<(
        &'g PrimaryIndexKey,
        parking_lot::RwLockReadGuard<'g, RowData>,
    )> {
        if self.limit == 0 {
            return None;
        }
        self.limit -= 1;
        self.iter.next().map(|row| {
            (
                row.d_key(),
                row.resolve_schema_deltas_and_freeze(self.mdl.delta_state()),
            )
        })
    }
}

impl<'g> Iterator for RowIteratorAll<'g> {
    type Item = (
        &'g PrimaryIndexKey,
        parking_lot::RwLockReadGuard<'g, RowData>,
    );
    fn next(&mut self) -> Option<Self::Item> {
        self._next()
    }
}

```

### Core Architecture Module: `server/src/engine/core/dml/upd.rs`
```
/*
 * Created on Thu May 11 2023
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
        engine::{
            core::{
                self, dml::QueryExecMeta, model::delta::DataDeltaKind,
                query_meta::AssignmentOperator,
            },
            data::{
                cell::Datacell,
                lit::Lit,
                tag::{DataTag, FloatSpec, SIntSpec, TagClass, UIntSpec},
            },
            error::{QueryError, QueryResult},
            fractal::GlobalInstanceLike,
            idx::STIndex,
            net::protocol::Response,
            ql::dml::upd::{AssignmentExpression, UpdateStatement},
            sync,
        },
        util::compiler::{self, TaggedEnum},
    },
    std::mem,
};

#[inline(always)]
unsafe fn dc_op_fail(_: &Datacell, _: Lit) -> (bool, Datacell) {
    (false, Datacell::null())
}
// bool
unsafe fn dc_op_bool_ass(_: &Datacell, rhs: Lit) -> (bool, Datacell) {
    (true, Datacell::new_bool(rhs.bool()))
}
// uint
unsafe fn dc_op_uint_ass(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let uint = rhs.uint();
    let kind = UIntSpec::from_full(dc.tag());
    (kind.check(uint), Datacell::new_uint(uint, kind))
}
unsafe fn dc_op_uint_add(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let kind = UIntSpec::from_full(dc.tag());
    let (uint, did_of) = dc.uint().overflowing_add(rhs.uint());
    (kind.check(uint) & !did_of, Datacell::new_uint(uint, kind))
}
unsafe fn dc_op_uint_sub(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let kind = UIntSpec::from_full(dc.tag());
    let (uint, did_of) = dc.uint().overflowing_sub(rhs.uint());
    (kind.check(uint) & !did_of, Datacell::new_uint(uint, kind))
}
unsafe fn dc_op_uint_mul(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let kind = UIntSpec::from_full(dc.tag());
    let (uint, did_of) = dc.uint().overflowing_mul(rhs.uint());
    (kind.check(uint) & !did_of, Datacell::new_uint(uint, kind))
}
unsafe fn dc_op_uint_div(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let kind = UIntSpec::from_full(dc.tag());
    let (uint, did_of) = dc.uint().overflowing_div(rhs.uint());
    (kind.check(uint) & !did_of, Datacell::new_uint(uint, kind))
}
// sint
unsafe fn dc_op_sint_ass(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let sint = rhs.sint();
    let kind = SIntSpec::from_full(dc.tag());
    (kind.check(sint), Datacell::new_sint(sint, kind))
}
unsafe fn dc_op_sint_add(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let kind = SIntSpec::from_full(dc.tag());
    let (sint, did_of) = dc.sint().overflowing_add(rhs.sint());
    (kind.check(sint) & !did_of, Datacell::new_sint(sint, kind))
}
unsafe fn dc_op_sint_sub(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let kind = SIntSpec::from_full(dc.tag());
    let (sint, did_of) = dc.sint().overflowing_sub(rhs.sint());
    (kind.check(sint) & !did_of, Datacell::new_sint(sint, kind))
}
unsafe fn dc_op_sint_mul(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let kind = SIntSpec::from_full(dc.tag());
    let (sint, did_of) = dc.sint().overflowing_mul(rhs.sint());
    (kind.check(sint) & !did_of, Datacell::new_sint(sint, kind))
}
unsafe fn dc_op_sint_div(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let kind = SIntSpec::from_full(dc.tag());
    let (sint, did_of) = dc.sint().overflowing_div(rhs.sint());
    (kind.check(sint) & !did_of, Datacell::new_sint(sint, kind))
}
/*
    float
    ---
    FIXME(@ohsayan): floating point always upsets me now and then, this time its
    the silent overflow boom and I think I should implement a strict mode (no MySQL,
    not `STRICT_ALL_TABLES` unless we do actually end up going down that route. In
    that case, oops)
    --
    TODO(@ohsayan): account for float32 overflow
*/
unsafe fn dc_op_float_ass(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let float = rhs.float();
    let kind = FloatSpec::from_full(dc.tag());
    (kind.check(float), Datacell::new_float(float, kind))
}
unsafe fn dc_op_float_add(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let result = dc.read_float() + rhs.float();
    let kind = FloatSpec::from_full(dc.tag());
    (kind.check(result), Datacell::new_float(result, kind))
}
unsafe fn dc_op_float_sub(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let result = dc.read_float() - rhs.float();
    let kind = FloatSpec::from_full(dc.tag());
    (kind.check(result), Datacell::new_float(result, kind))
}
unsafe fn dc_op_float_mul(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let result = dc.read_float() * rhs.float();
    let kind = FloatSpec::from_full(dc.tag());
    (kind.check(result), Datacell::new_float(result, kind))
}
unsafe fn dc_op_float_div(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let result = dc.read_float() / rhs.float();
    let kind = FloatSpec::from_full(dc.tag());
    (kind.check(result), Datacell::new_float(result, kind))
}
// binary
unsafe fn dc_op_bin_ass(_dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let new_bin = rhs.bin();
    let mut v = Vec::new();
    if v.try_reserve_exact(new_bin.len()).is_err() {
        return dc_op_fail(_dc, rhs);
    }
    v.extend_from_slice(new_bin);
    (true, Datacell::new_bin(v.into_boxed_slice()))
}
unsafe fn dc_op_bin_add(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let push_into_bin = rhs.bin();
    let mut bin = Vec::new();
    if compiler::unlikely(bin.try_reserve_exact(push_into_bin.len()).is_err()) {
        return dc_op_fail(dc, rhs);
    }
    bin.extend_from_slice(dc.read_bin());
    bin.extend_from_slice(push_into_bin);
    (true, Datacell::new_bin(bin.into_boxed_slice()))
}
// string
unsafe fn dc_op_str_ass(_dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let new_str = rhs.str();
    let mut v = String::new();
    if v.try_reserve_exact(new_str.len()).is_err() {
        return dc_op_fail(_dc, rhs);
    }
    v.push_str(new_str);
    (true, Datacell::new_str(v.into_boxed_str()))
}
unsafe fn dc_op_str_add(dc: &Datacell, rhs: Lit) -> (bool, Datacell) {
    let push_into_str = rhs.str();
    let mut str = String::new();
    if compiler::unlikely(str.try_reserve_exact(push_into_str.len()).is_err()) {
        return dc_op_fail(dc, rhs);
    }
    str.push_str(dc.read_str());
    str.push_str(push_into_str);
    (true, Datacell::new_str(str.into_boxed_str()))
}

static OPERATOR: [unsafe fn(&Datacell, Lit) -> (bool, Datacell); {
    TagClass::MAX_DSCR as usize * AssignmentOperator::VARIANT_COUNT
}] = [
    // bool
    dc_op_bool_ass,
    // -- pad: 4
    dc_op_fail,
    dc_op_fail,
    dc_op_fail,
    dc_op_fail,
    // uint
    dc_op_uint_ass,
    dc_op_uint_add,
    dc_op_uint_sub,
    dc_op_uint_mul,
    dc_op_uint_div,
    // sint
    dc_op_sint_ass,
    dc_op_sint_add,
    dc_op_sint_sub,
    dc_op_sint_mul,
    dc_op_sint_div,
    // float
    dc_op_float_ass,
    dc_op_float_add,
    dc_op_float_sub,
    dc_op_float_mul,
    dc_op_float_div,
    // bin
    dc_op_bin_ass,
    dc_op_bin_add,
    // -- pad: 3
    dc_op_fail,
    dc_op_fail,
    dc_op_fail,
    // str
    dc_op_str_ass,
    dc_op_str_add,
    // -- pad: 3
    dc_op_fail,
    dc_op_fail,
    dc_op_fail,
];

#[inline(always)]
const fn opc(opr: TagClass, ope: AssignmentOperator) -> usize {
    (AssignmentOperator::VARIANT_COUNT * opr.value_word()) + ope.value_word()
}

#[cfg(test)]
local! {
    pub(super) static ROUTE_TRACE: Vec<&'static str> = Vec::new();
}

#[inline(always)]
fn input_trace(v: &'static str) {
    #[cfg(test)]
    {
        local_mut!(ROUTE_TRACE, |rtrace| rtrace.push(v))
    }
    let _ = v;
}
#[cfg(test)]
pub fn collect_trace_path() -> Vec<&'static str> {
    local_ref!(ROUTE_TRACE, |rtrace| rtrace.iter().cloned().collect())
}
pub fn update_resp(
    global: &impl GlobalInstanceLike,
    update: UpdateStatement,
) -> QueryResult<Response> {
    self::update(global, update).map(|_| Response::Empty)
}

pub fn update(global: &impl GlobalInstanceLike, mut update: UpdateStatement) -> QueryResult<()> {
    core::with_model_for_data_update(global, update.entity(), |mdl| {
        let mut ret = Ok(QueryExecMeta::zero());
        // prepare row fetch
        let key = mdl.resolve_where(update.clauses_mut())?;
        // fetch row
        let g = sync::atm::cpin();
        let Some(row) = mdl.primary_index().select(key, &g) else {
            return Err(QueryError::QExecDmlRowNotFound);
        };
        // lock row
        let mut row_data_wl = row.d_data().write();
        // create new version
        let ds = mdl.delta_state();
        let new_version = ds.create_new_data_delta_version();
        // process changes
        let mut rollback_now = false;
        let mut rollback_data = Vec::with_capacity(update.expressions().len());
        let mut assn_expressions = update.into_expressions().into_iter();
        /*
            FIXME(@ohsayan): where's my usual magic? I'll do it once we have the SE stabilized
        */
        // apply changes
        while (assn_expressions.len() != 0) & (!rollback_now) {
            let AssignmentEx
```

### Core Architecture Module: `server/src/engine/core/exec.rs`
```
/*
 * Created on Thu Oct 05 2023
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

use crate::engine::{
    core::{ddl_misc, dml, model::ModelData, space::Space},
    error::{QueryError, QueryResult},
    fractal::{Global, GlobalInstanceLike},
    net::protocol::{ClientLocalState, Response, ResponseType, SQuery},
    ql::{
        ast::{traits::ASTNode, InplaceData, State},
        ddl::Use,
        lex::KeywordStmt,
    },
};

/*
    ---
    trigger warning: disgusting hacks below owing to token lifetimes
*/

pub async fn dispatch_to_executor<'a>(
    global: &Global,
    cstate: &mut ClientLocalState,
    query: SQuery<'a>,
) -> QueryResult<Response> {
    let tokens =
        crate::engine::ql::lex::SecureLexer::new_with_segments(query.query(), query.params())
            .lex()?;
    let mut state = State::new_inplace(&tokens);
    state.set_space_maybe(unsafe {
        // UNSAFE(@ohsayan): exclusively used within this scope
        core::mem::transmute(cstate.get_cs())
    });
    let stmt = state.try_statement()?;
    if stmt.is_blocking() {
        run_blocking_stmt(global, cstate, state, stmt).await
    } else {
        run_nb(global, cstate, state, stmt)
    }
}

fn _callgs_map<A: ASTNode<'static> + core::fmt::Debug, T>(
    g: &Global,
    state: &mut State<'static, InplaceData>,
    f: impl FnOnce(&Global, A) -> Result<T, QueryError>,
    map: impl FnOnce(T) -> Response,
) -> QueryResult<Response> {
    let cs = ASTNode::parse_from_state_hardened(state)?;
    Ok(map(f(&g, cs)?))
}

#[inline(always)]
fn _callgs<A: ASTNode<'static> + core::fmt::Debug, T>(
    g: &Global,
    state: &mut State<'static, InplaceData>,
    f: impl FnOnce(&Global, A) -> Result<T, QueryError>,
) -> QueryResult<T> {
    let cs = ASTNode::parse_from_state_hardened(state)?;
    f(&g, cs)
}

#[inline(always)]
fn _callgcs<A: ASTNode<'static> + core::fmt::Debug, T>(
    g: &Global,
    cstate: &ClientLocalState,
    state: &mut State<'static, InplaceData>,
    f: impl FnOnce(&Global, &ClientLocalState, A) -> Result<T, QueryError>,
) -> QueryResult<T> {
    let a = ASTNode::parse_from_state_hardened(state)?;
    f(&g, cstate, a)
}

#[inline(always)]
fn translate_ddl_result(x: Option<bool>) -> Response {
    match x {
        Some(b) => Response::Bool(b),
        None => Response::Empty,
    }
}

async fn run_blocking_stmt(
    global: &Global,
    cstate: &mut ClientLocalState,
    mut state: State<'_, InplaceData>,
    stmt: KeywordStmt,
) -> Result<Response, QueryError> {
    if !(cstate.is_root() | (stmt == KeywordStmt::Sysctl)) {
        // all the actions here need root permission (but we do an exception for sysctl which allows status to be called by anyone)
        return Err(QueryError::SysPermissionDenied);
    }
    state.ensure_minimum_for_blocking_stmt()?;
    /*
        IMPORTANT: DDL queries will NOT pick up the currently set space. instead EVERY DDL query must manually fully specify the entity that
        they want to manipulate. this prevents a whole set of exciting errors like dropping a model with the same model name from another space
    */
    state.unset_space();
    let (a, b) = (&state.current()[0], &state.current()[1]);
    let sysctl = stmt == KeywordStmt::Sysctl;
    let create = stmt == KeywordStmt::Create;
    let alter = stmt == KeywordStmt::Alter;
    let drop = stmt == KeywordStmt::Drop;
    let last_id = b.is_ident();
    let last_allow = Token![allow].eq(b);
    let last_if = Token![if].eq(b);
    let c_s = (create & Token![space].eq(a) & (last_id | last_if)) as u8 * 2;
    let c_m = (create & Token![model].eq(a) & (last_id | last_if)) as u8 * 3;
    let a_s = (alter & Token![space].eq(a) & last_id) as u8 * 4;
    let a_m = (alter & Token![model].eq(a) & last_id) as u8 * 5;
    let d_s = (drop & Token![space].eq(a) & (last_id | last_allow | last_if)) as u8 * 6;
    let d_m = (drop & Token![model].eq(a) & (last_id | last_allow | last_if)) as u8 * 7;
    let t_a = (stmt == KeywordStmt::Truncate) as u8 * 8;
    let fc = sysctl as u8 | c_s | c_m | a_s | a_m | d_s | d_m | t_a;
    state.cursor_ahead_if(!(sysctl | (stmt == KeywordStmt::Truncate)));
    static BLK_EXEC: [fn(
        Global,
        &ClientLocalState,
        &mut State<'static, InplaceData>,
    ) -> QueryResult<Response>; 9] = [
        |_, _, _| Err(QueryError::QLUnknownStatement),
        blocking_exec_sysctl,
        |g, _, t| {
            _callgs_map(
                &g,
                t,
                Space::transactional_exec_create,
                translate_ddl_result,
            )
        },
        |g, _, t| {
            _callgs_map(
                &g,
                t,
                ModelData::transactional_exec_create,
                translate_ddl_result,
            )
        },
        |g, _, t| _callgs_map(&g, t, Space::transactional_exec_alter, |_| Response::Empty),
        |g, _, t| {
            _callgs_map(&g, t, ModelData::transactional_exec_alter, |_| {
                Response::Empty
            })
        },
        |g, _, t| _callgs_map(&g, t, Space::transactional_exec_drop, translate_ddl_result),
        |g, _, t| {
            _callgs_map(
                &g,
                t,
                ModelData::transactional_exec_drop,
                translate_ddl_result,
            )
        },
        |g, _, t| _callgs_map(&g, t, dml::truncate, |_| Response::Empty),
    ];
    let r = unsafe {
        // UNSAFE(@ohsayan): the only await is within this block
        let c_glob = global.clone();
        let static_cstate: &'static ClientLocalState = core::mem::transmute(cstate);
        let static_state: &'static mut State<'static, InplaceData> =
            core::mem::transmute(&mut state);
        tokio::task::spawn_blocking(move || {
            BLK_EXEC[fc as usize](c_glob, static_cstate, static_state)
        })
        .await
    };
    r.unwrap()
}

fn blocking_exec_sysctl(
    g: Global,
    cstate: &ClientLocalState,
    state: &mut State<'static, InplaceData>,
) -> QueryResult<Response> {
    let r = ASTNode::parse_from_state_hardened(state)?;
    super::dcl::exec(g, cstate, r).map(|_| Response::Empty)
}

/*
    nb exec
*/

fn cstate_use(
    global: &Global,
    cstate: &mut ClientLocalState,
    state: &mut State<'static, InplaceData>,
) -> QueryResult<Response> {
    let use_c = Use::parse_from_state_hardened(state)?;
    match use_c {
        Use::Null => cstate.unset_cs(),
        Use::Space(new_space) => {
            /*
                NB: just like SQL, we don't really care about what this is set to as it's basically a shorthand.
                so we do a simple vanity check
            */
            if !global
                .state()
                .namespace()
                .contains_space(new_space.as_str())
            {
                return Err(QueryError::QExecObjectNotFound);
            }
            cstate.set_cs(new_space.boxed_str());
        }
        Use::RefreshCurrent => match cstate.get_cs() {
            None => return Ok(Response::Null),
            Some(space) => {
                if !global.state().namespace().contains_space(space) {
                    cstate.unset_cs();
                    return Err(QueryError::QExecObjectNotFound);
                }
                return Ok(Response::Serialized {
                    ty: ResponseType::String,
                    size: space.len(),
                    data: space.to_owned().into_bytes(),
                });
            }
        },
    }
    Ok(Response::Empty)
}

fn run_nb(
    global: &Global,
    cstate: &mut ClientLocalState,
    mut state: State<'_, InplaceData>,
    stmt: KeywordStmt,
) -> QueryResult<Response> {
    let stmt_c = stmt.raw_code() - KeywordStmt::Use.raw_code();
    static F: [fn(
        &Global,
        &mut ClientLocalState,
        &mut State<'static, InplaceData>,
    ) -> QueryResult<Response>; {
        // +SELECT ALL
        KeywordStmt::NONBLOCKING_COUNT + 1
    }] = [
        cstate_use, // use
        |g, c, s| _callgcs(g, c, s, ddl_misc::inspect),
        |_, _, _| Err(QueryError::QLUnknownStatement), // describe
        |g, _, s| _callgs(g, s, dml::insert_resp),
        |g, _, s| _callgs(g, s, dml::select_resp),
        |g, _, s| _callgs(g, s, dml::update_resp),
        |g, _, s| _callgs(g, s, dml::delete_resp),
        |g, _, s| _callgs(g, s, dml::upsert_resp),
        |_, _, _| Err(QueryError::QLUnknownStatement), // exists
        |g, _, s| _callgs(g, s, dml::select_all_resp),
    ];
    {
        let n_offset_adjust = (stmt == KeywordStmt::Select) & state.cursor_rounded_eq(Token![all]);
        state.cursor_ahead_if(n_offset_adjust);
        let corrected_offset =
            (n_offset_adjust as u8 * (F.len() - 1) as u8) | (stmt_c * (!n_offset_adjust as u8));
        let mut state = unsafe {
            // UNSAFE(@ohsayan): this is a lifetime issue with the token handle
            core::mem::transmute(state)
        };
        F[corrected_offset as usize](global, cstate, &mut state)
    }
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

### Incident Patch 1: `8b530e44` (2026-09-26)
**Commit Message**: ci: use lld on windows for faster builds

**File**: `.cargo/config.toml` (modified, +3/-0)
```diff
@@ -1,2 +1,5 @@
 [env]
 ROOT_DIR = { value = "", relative = true }
+
+[target.x86_64-pc-windows-msvc]
+linker = "rust-lld.exe"
```

---

### Incident Patch 2: `2d15ffb5` (2026-09-26)
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

### Incident Patch 3: `dacecc03` (2026-09-26)
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

### Incident Patch 4: `d8fdb143` (2026-09-26)
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

### Incident Patch 5: `2314f3ee` (2025-04-08)
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

### Incident Patch 6: `4f59af90` (2025-04-08)
**Commit Message**: ci: create full build before trying to build docker image

**File**: `.github/workflows/docker-image.yml` (modified, +55/-24)
```diff
@@ -7,21 +7,39 @@ on:
     tags:
       - "v*.*.*"
 
+env:
+  IMAGE_NAME: skytable/skytable
+  DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
+  DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
+
 jobs:
   build-x86:
     runs-on: ubuntu-latest
     steps:
       - name: Checkout repository
         uses: actions/checkout@v4
 
+      - name: Install Rust toolchain
+        uses: dtolnay/rust-toolchain@stable
+        with:
+          toolchain: stable
+
+      - name: Install dependencies
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y libssl-dev pkg-config
+
+      - name: Build Rust binaries
+        run: cargo build --release
+
       - name: Set up Docker Buildx
         uses: docker/setup-buildx-action@v3
 
       - name: Login to Docker Hub
         uses: docker/login-action@v3
         with:
-          username: ${{ secrets.DOCKER_USERNAME }}
-          password: ${{ secrets.DOCKER_PASSWORD }}
+          username: ${{ env.DOCKER_USERNAME }}
+          password: ${{ env.DOCKER_PASSWORD }}
 
       - name: Extract version from tag
         id: version
@@ -39,24 +57,37 @@ jobs:
           platforms: linux/amd64
           push: ${{ github.event_name != 'pull_request' }}
           tags: |
-            skytable/skytable:latest-amd64
-            skytable/skytable:${{ github.sha }}-amd64
-            skytable/skytable:v${{ steps.version.outputs.version }}-amd64
+            ${{ env.IMAGE_NAME }}:latest-amd64
+            ${{ env.IMAGE_NAME }}:${{ github.sha }}-amd64
+            ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }}-amd64
 
   build-arm64:
     runs-on: [self-hosted, ARM64]
     steps:
       - name: Checkout repository
         uses: actions/checkout@v4
 
+      - name: Install Rust toolchain
+        uses: dtolnay/rust-toolchain@stable
+        with:
+          toolchain: stable
+
+      - name: Install dependencies
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y libssl-dev pkg-config
+
+      - name: Build Rust binaries
+        run: cargo build --release
+
       - name: Set up Docker Buildx
         uses: docker/setup-buildx-action@v3
 
       - name: Login to Docker Hub
         uses: docker/login-action@v3
         with:
-          username: ${{ secrets.DOCKER_USERNAME }}
-          password: ${{ secrets.DOCKER_PASSWORD }}
+          username: ${{ env.DOCKER_USERNAME }}
+          password: ${{ env.DOCKER_PASSWORD }}
 
       - name: Extract version from tag
         id: version
@@ -74,9 +105,9 @@ jobs:
           platforms: linux/arm64
           push: ${{ github.event_name != 'pull_request' }}
           tags: |
-            skytable/skytable:latest-arm64
-            skytable/skytable:${{ github.sha }}-arm64
-            skytable/skytable:v${{ steps.version.outputs.version }}-arm64
+            ${{ env.IMAGE_NAME }}:latest-arm64
+            ${{ env.IMAGE_NAME }}:${{ github.sha }}-arm64
+            ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }}-arm64
 
   manifest:
     needs: [build-x86, build-arm64]
@@ -85,8 +116,8 @@ jobs:
       - name: Login to Docker Hub
         uses: docker/login-action@v3
         with:
-          username: ${{ secrets.DOCKER_USERNAME }}
-          password: ${{ secrets.DOCKER_PASSWORD }}
+          username: ${{ env.DOCKER_USERNAME }}
+          password: ${{ env.DOCKER_PASSWORD }}
 
       - name: Extract version from tag
         id: version
@@ -99,15 +130,15 @@ jobs:
 
       - name: Create and push manifest
         run: |
-          docker manifest create skytable/skytable:latest \
-            --amend skytable/skytable:latest-amd64 \
-            --amend skytable/skytable:latest-arm64
-          docker manifest create skytable/skytable:${{ github.sha }} \
-            --amend skytable/skytable:${{ github.sha }}-amd64 \
-            --amend skytable/skytable:${{ github.sha }}-arm64
-          docker manifest create skytable/skytable:v${{ steps.version.outputs.version }} \
-            --amend skytable/skytable:v${{ steps.version.outputs.version }}-amd64 \
-            --amend skytable/skytable:v${{ steps.version.outputs.version }}-arm64
-          docker manifest push skytable/skytable:latest
-          docker manifest push skytable/skytable:${{ github.sha }}
-          docker manifest push skytable/skytable:v${{ steps.version.outputs.version }}
+          docker manifest create ${{ env.IMAGE_NAME }}:latest \
+            --amend ${{ env.IMAGE_NAME }}:latest-amd64 \
+            --amend ${{ env.IMAGE_NAME }}:latest-arm64
+          docker manifest create ${{ env.IMAGE_NAME }}:${{ github.sha }} \
+            --amend ${{ env.IMAGE_NAME }}:${{ github.sha }}-amd64 \
+            --amend ${{ env.IMAGE_NAME }}:${{ github.sha }}-arm64
+          docker manifest create ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }} \
+            --amend ${{ env.IMAGE_NAME }}:v${{ steps.version.outputs.version }}-amd64 \
+            --amend ${{ env.IMAGE_NAME }}:v${{ step
```

---

### Incident Patch 7: `ac802e30` (2025-04-08)
**Commit Message**: ci: build and publish multi-arch images (#379)

**File**: `.github/workflows/docker-image.yml` (modified, +94/-35)
```diff
@@ -5,50 +5,109 @@ on:
     branches:
       - next
     tags:
-      - v*
-
-env:
-  IMAGE_NAME: skytable
-  BUILD: "false"
+      - "v*.*.*"
 
 jobs:
-  test:
+  build-x86:
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/checkout@v2
+      - name: Checkout repository
+        uses: actions/checkout@v4
+
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@v3
+
+      - name: Login to Docker Hub
+        uses: docker/login-action@v3
         with:
-          fetch-depth: 2
-      - name: Setup environment
+          username: ${{ secrets.DOCKER_USERNAME }}
+          password: ${{ secrets.DOCKER_PASSWORD }}
+
+      - name: Extract version from tag
+        id: version
         run: |
-          chmod +x ci/buildvars.sh
-          ci/buildvars.sh
-      - name: Install Rust
-        uses: dtolnay/rust-toolchain@stable
-      - name: build
-        uses: actions-rs/cargo@v1
+          if [[ ${{ github.ref }} =~ ^refs/tags/v([0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?)$ ]]; then
+            echo "version=${BASH_REMATCH[1]}" >> $GITHUB_OUTPUT
+          else
+            echo "version=latest" >> $GITHUB_OUTPUT
+          fi
+
+      - name: Build and push x86 Docker image
+        uses: docker/build-push-action@v5
         with:
-          command: build
-          args: --release
-      - name: Build image
-        run: docker build . --file Dockerfile --tag $IMAGE_NAME:${{ github.ref == 'refs/heads/next' && 'next' || github.ref_name }}
-        if: github.ref == 'refs/heads/next' || startsWith(github.ref, 'refs/tags/v')
-      - name: Set Tags
-        id: set_tags
+          context: .
+          platforms: linux/amd64
+          push: ${{ github.event_name != 'pull_request' }}
+          tags: |
+            skytable/skytable:latest-amd64
+            skytable/skytable:${{ github.sha }}-amd64
+            skytable/skytable:v${{ steps.version.outputs.version }}-amd64
+
+  build-arm64:
+    runs-on: [self-hosted, ARM64]
+    steps:
+      - name: Checkout repository
+        uses: actions/checkout@v4
+
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@v3
+
+      - name: Login to Docker Hub
+        uses: docker/login-action@v3
+        with:
+          username: ${{ secrets.DOCKER_USERNAME }}
+          password: ${{ secrets.DOCKER_PASSWORD }}
+
+      - name: Extract version from tag
+        id: version
         run: |
-          TAGS=""
-          if [ "${{ github.ref }}" == "refs/heads/next" ]; then
-            TAGS="next"
+          if [[ ${{ github.ref }} =~ ^refs/tags/v([0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?)$ ]]; then
+            echo "version=${BASH_REMATCH[1]}" >> $GITHUB_OUTPUT
+          else
+            echo "version=latest" >> $GITHUB_OUTPUT
           fi
-          if [[ "${{ github.ref }}" == refs/tags/v* ]]; then
-            TAGS="${TAGS:+$TAGS,}${GITHUB_REF#refs/tags/}"
-            TAGS="${TAGS:+$TAGS,}latest"
-          fi
-          echo "::set-output name=tags::$TAGS"
-      - name: Push to Docker Hub
-        uses: docker/build-push-action@v1
+
+      - name: Build and push ARM64 Docker image
+        uses: docker/build-push-action@v5
+        with:
+          context: .
+          platforms: linux/arm64
+          push: ${{ github.event_name != 'pull_request' }}
+          tags: |
+            skytable/skytable:latest-arm64
+            skytable/skytable:${{ github.sha }}-arm64
+            skytable/skytable:v${{ steps.version.outputs.version }}-arm64
+
+  manifest:
+    needs: [build-x86, build-arm64]
+    runs-on: ubuntu-latest
+    steps:
+      - name: Login to Docker Hub
+        uses: docker/login-action@v3
         with:
           username: ${{ secrets.DOCKER_USERNAME }}
           password: ${{ secrets.DOCKER_PASSWORD }}
-          repository: skytable/skytable
-          tags: ${{ steps.set_tags.outputs.tags }}
-        if: github.ref == 'refs/heads/next' || startsWith(github.ref, 'refs/tags/v')
+
+      - name: Extract version from tag
+        id: version
+        run: |
+          if [[ ${{ github.ref }} =~ ^refs/tags/v([0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?)$ ]]; then
+            echo "version=${BASH_REMATCH[1]}" >> $GITHUB_OUTPUT
+          else
+            echo "version=latest" >> $GITHUB_OUTPUT
+          fi
+
+      - name: Create and push manifest
+        run: |
+          docker manifest create skytable/skytable:latest \
+            --amend skytable/skytable:latest-amd64 \
+            --amend skytable/skytable:latest-arm64
+          docker manifest create skytable/skytable:${{ github.sha }} \
+            --amend skytable/skytable:${{ github.sha }}-amd64 \
+            --amend skytable/skytable:${{ github.sha }}-arm64
+          docker manifest create skytable/skytable:v${{ steps.version.outputs.version }} \
+            --amend skytable/skytable:v${{ steps.version.outputs.version }}-amd64 \
+            --amend skytable/skytable:v${{
```

---

### Incident Patch 8: `f83e6bf5` (2024-08-10)
**Commit Message**: misc: Upgrade deps and don't build dpkg on non-Linux

**File**: `Cargo.lock` (modified, +101/-144)
```diff
@@ -54,9 +54,9 @@ dependencies = [
 
 [[package]]
 name = "anstream"
-version = "0.6.14"
+version = "0.6.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "418c75fa768af9c03be99d17643f93f79bbba589895012a80e3452a19ddda15b"
+checksum = "64e15c1ab1f89faffbf04a634d5e1962e9074f2741eef6d97f3c4e322426d526"
 dependencies = [
  "anstyle",
  "anstyle-parse",
@@ -69,33 +69,33 @@ dependencies = [
 
 [[package]]
 name = "anstyle"
-version = "1.0.7"
+version = "1.0.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "038dfcf04a5feb68e9c60b21c9625a54c2c0616e79b72b0fd87075a056ae1d1b"
+checksum = "1bec1de6f59aedf83baf9ff929c98f2ad654b97c9510f4e70cf6f661d49fd5b1"
 
 [[package]]
 name = "anstyle-parse"
-version = "0.2.4"
+version = "0.2.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c03a11a9034d92058ceb6ee011ce58af4a9bf61491aa7e1e59ecd24bd40d22d4"
+checksum = "eb47de1e80c2b463c735db5b217a0ddc39d612e7ac9e2e96a5aed1f57616c1cb"
 dependencies = [
  "utf8parse",
 ]
 
 [[package]]
 name = "anstyle-query"
-version = "1.1.0"
+version = "1.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ad186efb764318d35165f1758e7dcef3b10628e26d41a44bc5550652e6804391"
+checksum = "6d36fc52c7f6c869915e99412912f22093507da8d9e942ceaf66fe4b7c14422a"
 dependencies = [
  "windows-sys 0.52.0",
 ]
 
 [[package]]
 name = "anstyle-wincon"
-version = "3.0.3"
+version = "3.0.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "61a38449feb7068f52bb06c12759005cf459ee52bb4adc1d5a7c4322d716fb19"
+checksum = "5bf74e1b6e971609db8ca7a9ce79fd5768ab6ae46441c572e46cf596f59e57f8"
 dependencies = [
  "anstyle",
  "windows-sys 0.52.0",
@@ -199,9 +199,9 @@ checksum = "1fd0f2584146f6f2ef48085050886acf353beff7305ebd1ae69500e27c67f64b"
 
 [[package]]
 name = "bytes"
-version = "1.6.1"
+version = "1.7.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a12916984aab3fa6e39d655a33e09c0071eb36d6ab3aea5c2d78551f1df6d952"
+checksum = "8318a53db07bb3f8dca91a600466bdb3f2eaadeedfdbcf02e1accbad9271ba50"
 
 [[package]]
 name = "bzip2"
@@ -226,9 +226,9 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.1.6"
+version = "1.1.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2aba8f4e9906c7ce3c73463f62a7f0c65183ada1a2d47e397cc8810827f9694f"
+checksum = "504bdec147f2cc13c8b57ed9401fd8a147cc66b67ad5cb241394244f2c947549"
 dependencies = [
  "jobserver",
  "libc",
@@ -257,7 +257,7 @@ dependencies = [
  "js-sys",
  "num-traits",
  "wasm-bindgen",
- "windows-targets 0.52.6",
+ "windows-targets",
 ]
 
 [[package]]
@@ -281,9 +281,9 @@ dependencies = [
 
 [[package]]
 name = "colorchoice"
-version = "1.0.1"
+version = "1.0.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0b6a852b24ab71dffc585bcb46eaf7959d175cb865a7152e35b348d1b2960422"
+checksum = "d3fd119d74b830634cea2a0f58bbd0d54540518a14397557951e79340abc28c0"
 
 [[package]]
 name = "constant_time_eq"
@@ -366,15 +366,15 @@ checksum = "22ec99545bb0ed0ea7bb9b8e1e9122ea386ff8a48c0922e43f36d45ab09e0e80"
 
 [[package]]
 name = "crossterm"
-version = "0.27.0"
+version = "0.28.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f476fe445d41c9e991fd07515a6f463074b782242ccf4a5b7b1d1012e70824df"
+checksum = "829d955a0bb380ef178a640b91779e3987da38c9aea133b20614cfed8cdea9c6"
 dependencies = [
  "bitflags",
  "crossterm_winapi",
- "libc",
- "mio 0.8.11",
+ "mio",
  "parking_lot",
+ "rustix",
  "signal-hook",
  "signal-hook-mio",
  "winapi",
@@ -455,19 +455,19 @@ checksum = "c34f04666d835ff5d62e058c3995147c06f42fe86ff053337632bca83e42702d"
 
 [[package]]
 name = "env_filter"
-version = "0.1.1"
+version = "0.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c6dc8c8ff84895b051f07a0e65f975cf225131742531338752abfb324e4449ff"
+checksum = "4f2c92ceda6ceec50f43169f9ee8424fe2db276791afde7b2cd8bc084cb376ab"
 dependencies = [
  "log",
  "regex",
 ]
 
 [[package]]
 name = "env_logger"
-version = "0.11.4"
+version = "0.11.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "06676b12debf7bba6903559720abca942d3a66b8acb88815fd2c7c6537e9ade1"
+checksum = "e13fa619b91fb2381732789fc5de83b45675e882f66623b7d8cb4f643017018d"
 dependencies = [
  "anstream",
  "anstyle",
@@ -517,9 +517,9 @@ dependencies = [
 
 [[package]]
 name = "flate2"
-version = "1.0.30"
+version = "1.0.31"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5f54427cfd1c7829e2a139fcefea601bf088ebca651d2bf53ebc600eac295dae"
+checksum = "7f211bbe8e69bbd0cfdea405084f128ae8b4aaa6b0b522fc8f2b009084797920"
 dependencies = [
  "crc32fast",
  "miniz_oxide",
@@ -664,9 +664,9 @@ dependencies = [
 
 [[package]]
 name = "indexmap"
-version = "2.2.6"
+version = "2.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "168
```

**File**: `cli/Cargo.toml` (modified, +2/-2)
```diff
@@ -16,5 +16,5 @@ libsky = { path = "../libsky" }
 libsky = { path = "../libsky" }
 skytable = { git = "https://github.com/skytable/client-rust.git", branch = "devel" }
 # external deps
-crossterm = "0.27.0"
-rustyline = "14.0.0"
+crossterm = "0.28"
+rustyline = "14"
```

**File**: `harness/Cargo.toml` (modified, +5/-5)
```diff
@@ -9,8 +9,8 @@ build = "build.rs"
 # internal deps
 libsky = { path = "../libsky" }
 # external deps
-env_logger = "0.11.4"
-log = "0.4.22"
-zip = { version = "2.1.5", features = ["deflate"] }
-powershell_script = "1.1.0"
-openssl = { version = "0.10.66", features = ["vendored"] }
+env_logger = "0.11"
+log = "0.4"
+zip = { version = "2", features = ["deflate"] }
+powershell_script = "1"
+openssl = { version = "0.10", features = ["vendored"] }
```

**File**: `harness/src/linuxpkg.rs` (modified, +7/-1)
```diff
@@ -27,7 +27,8 @@
 use {
     crate::{
         build::{self, BuildMode},
-        {util, HarnessResult},
+        error::HarnessError,
+        util, HarnessResult,
     },
     libsky::variables::VERSION,
 };
@@ -68,6 +69,11 @@ impl ToString for LinuxPackageType {
 
 /// Creates a Linux package for the provided Linux package type
 pub fn create_linuxpkg(package_type: LinuxPackageType) -> HarnessResult<()> {
+    if !cfg!(target_os = "linux") {
+        return Err(HarnessError::Other(format!(
+            "invalid target for building Debian package. Host OS must be Linux-based"
+        )));
+    }
     info!("Building binaries for Linux package");
     let _ = build::build(BuildMode::Release)?;
     info!("Creating Linux package");
```

**File**: `server/Cargo.toml` (modified, +19/-19)
```diff
@@ -14,28 +14,28 @@ libsky = { path = "../libsky" }
 # internal deps
 libsky = { path = "../libsky" }
 sky_macros = { path = "../sky-macros" }
-rcrypt = "0.4.0"
+rcrypt = "0.4"
 # external deps
-bytes = "1.6.1"
-env_logger = "0.11.4"
-log = "0.4.22"
-openssl = { version = "0.10.66", features = ["vendored"] }
-crossbeam-epoch = { version = "0.9.18" }
-parking_lot = "0.12.3"
-serde = { version = "1.0.204", features = ["derive"] }
-tokio = { version = "1.39.1", features = ["full"] }
-tokio-openssl = "0.6.4"
-uuid = { version = "1.10.0", features = ["v4", "fast-rng", "macro-diagnostics"] }
-crc = "3.2.1"
-serde_yaml = "0.9.33"
-chrono = "0.4.38"
+bytes = "1"
+env_logger = "0.11"
+log = "0.4"
+openssl = { version = "0.10", features = ["vendored"] }
+crossbeam-epoch = { version = "0.9" }
+parking_lot = "0.12"
+serde = { version = "1", features = ["derive"] }
+tokio = { version = "1", features = ["full"] }
+tokio-openssl = "0.6"
+uuid = { version = "1", features = ["v4", "fast-rng", "macro-diagnostics"] }
+crc = "3"
+serde_yaml = "0.9"
+chrono = "0.4"
 
 [target.'cfg(all(not(target_env = "msvc"), not(miri)))'.dependencies]
 # external deps
-jemallocator = "0.5.4"
+jemallocator = "0.5"
 [target.'cfg(target_os = "windows")'.dependencies]
 # external deps
-windows = { version = "0.58.0", features = [
+windows = { version = "0.58", features = [
   "Win32_Foundation",
   "Win32_System_IO",
   "Win32_Storage_FileSystem",
@@ -44,12 +44,12 @@ windows = { version = "0.58.0", features = [
 
 [target.'cfg(unix)'.dependencies]
 # external deps
-libc = "0.2.155"
+libc = "0.2"
 
 [dev-dependencies]
 # external deps
-rand = "0.8.5"
-tokio = { version = "1.39.1", features = ["test-util"] }
+rand = "0.8"
+tokio = { version = "1", features = ["test-util"] }
 skytable = { git = "https://github.com/skytable/client-rust.git", branch = "devel" }
 
 [features]
```

**File**: `sky-bench/Cargo.toml` (modified, +5/-5)
```diff
@@ -15,8 +15,8 @@ libsky = { path = "../libsky" }
 skytable = { git = "https://github.com/skytable/client-rust.git", branch = "devel" }
 libsky = { path = "../libsky" }
 # external deps
-crossbeam-channel = "0.5.13"
-num_cpus = "1.16.0"
-env_logger = "0.11.4"
-log = "0.4.22"
-tokio = { version = "1.39.1", features = ["full"] }
+crossbeam-channel = "0.5"
+num_cpus = "1"
+env_logger = "0.11"
+log = "0.4"
+tokio = { version = "1", features = ["full"] }
```

**File**: `sky-macros/Cargo.toml` (modified, +3/-3)
```diff
@@ -11,7 +11,7 @@ proc-macro = true
 
 [dependencies]
 # external deps
-proc-macro2 = "1.0.86"
-quote = "1.0.36"
-syn = { version = "1.0.109", features = ["full"] }
+proc-macro2 = "1"
+quote = "1"
+syn = { version = "1", features = ["full"] }
 libsky = { path = "../libsky" }
```

---

### Incident Patch 9: `c0efcdd2` (2024-08-03)
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

**File**: `server/src/engine/core/index/key.rs` (modified, +1/-1)
```diff
@@ -393,7 +393,7 @@ fn ensure_ptr_offsets() {
     );
 }
 
-#[sky_macros::test]
+#[sky_macros::miri_leaky_test] // FIXME(@ohsayan): leak due to EBR
 fn queue_ensure_offsets() {
     use crate::engine::sync::queue::Queue;
     let data: Vec<_> = (0..100)
```

**File**: `server/src/engine/core/mod.rs` (modified, +5/-7)
```diff
@@ -54,6 +54,7 @@ use {
             error::{QueryError, QueryResult},
             fractal::{FractalGNSDriver, GlobalInstanceLike},
             idx::IndexST,
+            mem::unsafe_apis::BoxStr,
         },
         util::compiler,
     },
@@ -90,7 +91,7 @@ impl GlobalNS {
 #[derive(Debug)]
 pub struct GNSData {
     idx_mdl: RWLIdx<EntityID, Model>,
-    idx: RWLIdx<Box<str>, Space>,
+    idx: RWLIdx<BoxStr, Space>,
     sys_db: system_db::SystemDatabase,
 }
 
@@ -104,16 +105,13 @@ impl GNSData {
     }
     pub fn ddl_with_all_mut<T>(
         &self,
-        f: impl FnOnce(&mut HashMap<Box<str>, Space>, &mut HashMap<EntityID, Model>) -> T,
+        f: impl FnOnce(&mut HashMap<BoxStr, Space>, &mut HashMap<EntityID, Model>) -> T,
     ) -> T {
         let mut spaces = self.idx.write();
         let mut models = self.idx_mdl.write();
         f(&mut spaces, &mut models)
     }
-    pub fn ddl_with_spaces_write<T>(
-        &self,
-        f: impl FnOnce(&mut HashMap<Box<str>, Space>) -> T,
-    ) -> T {
+    pub fn ddl_with_spaces_write<T>(&self, f: impl FnOnce(&mut HashMap<BoxStr, Space>) -> T) -> T {
         let mut spaces = self.idx.write();
         f(&mut spaces)
     }
@@ -163,7 +161,7 @@ impl GNSData {
     pub fn idx_models(&self) -> &RWLIdx<EntityID, Model> {
         &self.idx_mdl
     }
-    pub fn idx(&self) -> &RWLIdx<Box<str>, Space> {
+    pub fn idx(&self) -> &RWLIdx<BoxStr, Space> {
         &self.idx
     }
     #[cfg(test)]
```

**File**: `server/src/engine/core/model/alt.rs` (modified, +6/-5)
```diff
@@ -36,6 +36,7 @@ use {
             error::{QueryError, QueryResult},
             fractal::GlobalInstanceLike,
             idx::{IndexST, IndexSTSeqCns, STIndex, STIndexSeq},
+            mem::unsafe_apis::BoxStr,
             ql::{
                 ddl::{
                     alt::{AlterKind, AlterModel},
@@ -60,8 +61,8 @@ pub(in crate::engine::core) struct AlterPlan<'a> {
 #[derive(Debug, PartialEq)]
 pub(in crate::engine::core) enum AlterAction<'a> {
     Ignore,
-    Add(IndexSTSeqCns<Box<str>, Field>),
-    Update(IndexST<Box<str>, Field>),
+    Add(IndexSTSeqCns<BoxStr, Field>),
+    Update(IndexST<BoxStr, Field>),
     Remove(Box<[Ident<'a>]>),
 }
 
@@ -80,7 +81,7 @@ fn no_field(mr: &ModelData, new: &str) -> bool {
     !mr.fields().st_contains(new)
 }
 
-fn check_nullable(props: &mut HashMap<Box<str>, DictEntryGeneric>) -> QueryResult<bool> {
+fn check_nullable(props: &mut HashMap<BoxStr, DictEntryGeneric>) -> QueryResult<bool> {
     match props.remove("nullable") {
         Some(DictEntryGeneric::Data(b)) if b.kind() == TagClass::Bool => Ok(b.bool()),
         Some(_) => Err(QueryError::QExecDdlInvalidProperties),
@@ -127,7 +128,7 @@ impl<'a> AlterPlan<'a> {
                     okay &= no_field(mdl, &field_name) & mdl.not_pk(&field_name);
                     let is_nullable = check_nullable(&mut props)?;
                     let layers = Field::parse_layers(layers, is_nullable)?;
-                    okay &= add.st_insert(field_name.as_str().into(), layers);
+                    okay &= add.st_insert(BoxStr::new(field_name.as_str()), layers);
                 }
                 can_ignore!(AlterAction::Add(add))
             }
@@ -155,7 +156,7 @@ impl<'a> AlterPlan<'a> {
                     let (anydelta, new_field) =
                         Self::ldeltas(current_field, layers, is_nullable, &mut no_lock, &mut okay)?;
                     any_delta += anydelta as usize;
-                    okay &= new_fields.st_insert(field_name.as_str().into(), new_field);
+                    okay &= new_fields.st_insert(BoxStr::new(field_name.as_str()), new_field);
                 }
                 if any_delta == 0 {
                     AlterAction::Ignore
```

---

### Incident Patch 10: `c369361c` (2024-07-23)
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

### Incident Patch 11: `26db3785` (2024-07-23)
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

### Incident Patch 12: `6d4fb94d` (2024-07-23)
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
         Q: ?Sized + AsKey;
+    #[allow(dead_code)]
     /// Returns a clone of the value corresponding to the key, if it exists
     fn st_get_cloned<Q>(&self, key: &Q) -> Option<V>
     where
@@ -295,6 +311,7 @@ pub trait STIndex<K: ?Sized, V>: IndexBaseSpec {
         K: AsKey + Borrow<Q>,
         V: AsValue,
         Q: ?Sized + AsKey;
+    #[allow(dead_code)]
     /// Updates the entry and returns the old value, if it exists
     fn st_update_return<Q>(&mut self, key: &Q, val: V) -> Option<V>
     where
@@ -312,15 +329,19 @@ pub trait STIndex<K: ?Sized, V>: IndexBaseSpec {
     where
         K: AsKey + Borrow<Q>,
         Q: ?Sized + AsKey;
+    #[allow(dead_code)]
     fn st_delete_if<Q>(&mut self, key: &Q, iff: impl Fn(&V) -> bool) -> Option<bool>
     where
         K: AsKey + Borrow<Q>,
         Q: ?Sized + AsKey;
     // iter
+    #[allow(dead_code)]
     /// Returns an iterator over a tuple of keys and values
     fn st_iter_kv<'a>(&'a self) -> Self::IterKV<'a>;
+    #[allow(dead_code)]
  
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

**File**: `server/src/engine/ql/ast/mod.rs` (modified, +0/-6)
```diff
@@ -357,8 +357,6 @@ pub trait QueryData<'a> {
     /// ## Safety
     /// The current token must match the signature of a lit
     unsafe fn read_data_type(&mut self, tok: &'a Token) -> Datacell;
-    /// Returns true if the data source has enough data
-    fn nonzero(&self) -> bool;
 }
 
 #[derive(Debug)]
@@ -383,8 +381,4 @@ impl<'a> QueryData<'a> for InplaceData {
     unsafe fn read_data_type(&mut self, tok: &'a Token) -> Datacell {
         Datacell::from(<Self as QueryData>::read_lit(self, tok))
     }
-    #[inline(always)]
-    fn nonzero(&self) -> bool {
-        true
-    }
 }
```

**File**: `server/src/engine/storage/v1/raw/journal/raw.rs` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ pub trait JournalAdapter {
     type GlobalState;
     /// The transactional impl that makes use of this journal, should define it's error type
     type Error;
+    #[allow(dead_code)]
     /// Encode a journal event into a blob
     fn encode(event: Self::JournalEvent) -> Box<[u8]>;
     /// Decode a journal event and apply it to the global state
```

**File**: `server/src/engine/storage/v1/raw/sysdb.rs` (modified, +4/-4)
```diff
@@ -48,8 +48,8 @@ fn rkey<T>(
 
 pub struct RestoredSystemDatabase {
     pub users: HashMap<Box<str>, Box<[u8]>>,
-    pub startup_counter: u64,
-    pub settings_version: u64,
+    pub _startup_counter: u64,
+    pub _settings_version: u64,
 }
 
 impl RestoredSystemDatabase {
@@ -65,8 +65,8 @@ impl RestoredSystemDatabase {
     ) -> Self {
         Self {
             users,
-            startup_counter,
-            settings_version,
+            _startup_counter: startup_counter,
+            _settings_version: settings_version,
         }
     }
     pub fn restore(name: &str) -> RuntimeResult<Self> {
```

---

### Incident Patch 13: `11b65ced` (2024-06-23)
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
-checksum = "df7c2093d15d6a1d33b1f972e1c5ea3177748742b97a5f392aa83a65262c6780"
+checksum = "b10cf871f3ff2ce56432fddc2615ac7acc3aa22ca321f8fea800846fbb32f188"
 dependencies = [
  "async-trait",
- "futures-channel",
  "futures-util",
  "parking_lot",
  "tokio",
 ]
 
-[[package]]
-name = "bitflags"
-version = "1.3.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
-
 [[package]]
 name = "bitflags"
 version = "2.5.0"
@@ -190,9 +187,9 @@ dependencies = [
 
 [[package]]
 name = "bumpalo"
-version = "3.15.4"
+version = "3.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7ff69b9dd49fd426c69a0db9fc04dd934cdb6645ff000864d98f7e2af8830eaa"
+checksum = "79296716171880943b8470b5f8d03aa55eb2e645a4874bdbb28adb49162e012c"
 
 [[package]]
 name = "byteorder"
@@ -229,12 +226,13 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.0.90"
+version = "1.0.100"
 source = "registry+https://github.com/rust-lang/cr
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

**File**: `server/src/engine/fractal/mgr.rs` (modified, +8/-6)
```diff
@@ -322,23 +322,23 @@ impl FractalMgr {
         // TODO(@ohsayan): check threshold and update hooks
         match task {
             CriticalTask::CheckGNSDriver => {
-                info!("trying to autorecover GNS driver");
+                info!("fhp: trying to autorecover GNS driver");
                 match global.state().gns_driver().txn_driver.lock().__rollback() {
                     Ok(()) => {
-                        info!("GNS driver has been successfully auto-recovered");
+                        info!("fhp: GNS driver has been successfully auto-recovered");
                         global.state().gns_driver().status().set_okay();
                         global.health().report_recovery();
                     }
                     Err(e) => {
-                        error!("failed to autorecover GNS driver with error `{e}`. will try again");
+                        error!("fhp: failed to autorecover GNS driver with error `{e}`. will try again");
                         self.hp_dispatcher
                             .send(Task::new(CriticalTask::CheckGNSDriver))
                             .unwrap();
                     }
                 }
             }
             CriticalTask::TryModelAutorecover(mdl_id) => {
-                info!("trying to autorecover model {mdl_id}");
+                info!("fhp: trying to autorecover model {mdl_id}");
                 match global
                     .state()
                     .namespace()
@@ -353,10 +353,12 @@ impl FractalMgr {
                             Ok(()) => {
                                 mdl.driver().status().set_okay();
                                 global.health().report_recovery();
-                                info!("model driver for {mdl_id} has been successfully auto-recovered");
+                                info!("fhp: model driver for {mdl_id} has been successfully auto-recovered");
                             }
                             Err(e) => {
-                                error!("failed to autorecover {mdl_id} with {e}. will try again");
+                                error!(
+                                    "fhp: failed to autorecover {mdl_id} with {e}. will try again"
+                                );
                                 self.hp_dispatcher
                                     .send(Task::new(CriticalTask::TryModelAutorecover(mdl_id)))
                                     .unwrap()
```

**File**: `server/src/engine/mod.rs` (modified, +2/-2)
```diff
@@ -178,12 +178,12 @@ pub async fn start(
     tokio::select! {
         _ = endpoint_handles.listen() => {}
         _ = termsig => {
-            info!("received terminate signal. waiting for inflight tasks to complete ...");
+            info!("received terminate signal. waiting for inflight tasks to complete");
         }
     }
     drop(signal);
     endpoint_handles.finish().await;
-    info!("waiting for fractal engine to exit ...");
+    info!("waiting for fractal engine to exit");
     let (hp_handle, lp_handle) = tokio::join!(fractal_handle.hp_handle, fractal_handle.lp_handle);
     match (hp_handle, lp_handle) {
         (Err(e1), Err(e2)) => {
```

**File**: `server/src/engine/net/mod.rs` (modified, +8/-8)
```diff
@@ -132,10 +132,10 @@ impl<S: Socket> ConnectionHandler<S> {
                     socket.flush().await?;
                     match ret {
                         Ok(QueryLoopResult::Fin) => return Ok(()),
-                        Ok(QueryLoopResult::Rst) => error!("connection reset while talking to client"),
-                        Ok(QueryLoopResult::HSFailed) => error!("failed to handshake with client"),
+                        Ok(QueryLoopResult::Rst) => error!("client io: connection reset"),
+                        Ok(QueryLoopResult::HSFailed) => error!("client: client handshake failed"),
                         Err(e) => {
-                            error!("error while handling connection: {e}");
+                            error!("client io: error while handling connection: {e}");
                             return Err(e);
                         }
                     }
@@ -175,7 +175,7 @@ impl Listener {
         let (sig_inflight, sig_inflight_wait) = mpsc::channel(1);
         let listener = TcpListener::bind((host, port))
             .await
-            .set_dmsg(format!("failed to bind to port `{host}:{port}`"))?;
+            .set_dmsg(format!("failed to bind to port {host}:{port}"))?;
         Ok(Self {
             global,
             listener,
@@ -220,7 +220,7 @@ impl Listener {
                     /*
                         SECURITY: IGNORE THIS ERROR
                     */
-                    warn!("failed to accept connection on TCP socket: `{e}`");
+                    warn!("tcp: failed to accept connection: {e}");
                     continue;
                 }
             };
@@ -232,7 +232,7 @@ impl Listener {
             );
             tokio::spawn(async move {
                 if let Err(e) = handler.run().await {
-                    warn!("error handling client connection: `{e}`");
+                    warn!("tcp: error handling client connection: {e}");
                 }
             });
             // return the permit
@@ -274,7 +274,7 @@ impl Listener {
                     /*
                         SECURITY: Once again, ignore this error
                     */
-                    warn!("failed to accept connection on TLS socket: `{e}`");
+                    warn!("tls: failed to accept connection: {e}");
                     continue;
                 }
             };
@@ -286,7 +286,7 @@ impl Listener {
             );
             tokio::spawn(async move {
                 if let Err(e) = handler.run().await {
-                    warn!("error handling client TLS connection: `{e}`");
+                    warn!("tls: error handling client connection: {e}");
                 }
             });
         }
```

---

### Incident Patch 14: `86d7d0f5` (2024-05-04)
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

---

### Incident Patch 15: `d3faec9e` (2024-04-24)
**Commit Message**: bench: Fix main thread using legacy init for new workloads

**File**: `sky-bench/src/bench.rs` (modified, +7/-6)
```diff
@@ -124,16 +124,17 @@ pub fn run(bench: BenchConfig) -> error::BenchResult<()> {
         "root",
         &bench.root_pass,
     ));
-    info!("running preliminary checks and creating model `bench.bench` with definition: `{{un: binary, pw: uint8}}`");
-    let mut main_thread_db = bench_config.config.connect()?;
-    main_thread_db.query_parse::<()>(&query!("create space bench"))?;
-    main_thread_db.query_parse::<()>(&query!(format!(
-        "create model {BENCHMARK_SPACE_ID}.{BENCHMARK_MODEL_ID}(un: binary, pw: uint8)"
-    )))?;
+    let mut main_thread_db;
     let stats = match bench.workload {
         BenchType::Workload(BenchWorkload::UniformV1) => return workload::run_bench(&bench),
         BenchType::Legacy(l) => {
             warn!("using `--engine` is now deprecated. please consider switching to `--workload`");
+            info!("running preliminary checks and creating model `bench.bench` with definition: `{{un: binary, pw: uint8}}`");
+            main_thread_db = bench_config.config.connect()?;
+            main_thread_db.query_parse::<()>(&query!("create space bench"))?;
+            main_thread_db.query_parse::<()>(&query!(format!(
+                "create model {BENCHMARK_SPACE_ID}.{BENCHMARK_MODEL_ID}(un: binary, pw: uint8)"
+            )))?;
             match l {
                 BenchEngine::Rookie => bench_rookie(bench_config, bench),
                 BenchEngine::Fury => bench_fury(bench),
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
