# Forensic Learning Record (Deep Inspection): typedb/typedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/typedb-typedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/typedb/typedb](https://github.com/typedb/typedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:16:45.788Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `typedb/typedb`
- **Description**: TypeDB: Built for systems, not records
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4475 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.circleci/windows/replace_git_overrides.py`
```
#!/usr/bin/env python3

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Replace git_override() blocks in MODULE.bazel with local_path_override()."""

import re
import sys

OVERRIDES = {
    "typedb_dependencies": "../dependencies",
    "typedb_bazel_distribution": "../bazel-distribution",
    "typeql": "../typeql",
    "typedb_protocol": "../typedb-protocol",
    "typedb_behaviour": "../typedb-behaviour",
}

module_bazel = sys.argv[1] if len(sys.argv) > 1 else "MODULE.bazel"

with open(module_bazel, "r") as f:
    content = f.read()

for module, path in OVERRIDES.items():
    pattern = r'git_override\(\s*\n\s*module_name\s*=\s*"' + re.escape(module) + r'"[^)]*\)'
    replacement = (
        'local_path_override(\n'
        '    module_name = "' + module + '",\n'
        '    path = "' + path + '",\n'
        ')'
    )
    content, count = re.subn(pattern, replacement, content)
    if count == 0:
        print("WARNING: no git_override found for " + module, file=sys.stderr)
    else:
        print("Replaced git_override -> local_path_override for " + module)

with open(module_bazel, "w") as f:
    f.write(content)

```

### Core Architecture Module: `admin/client/command.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::{future::Future, pin::Pin};

use crate::{AdminClient, error::AdminError};

pub type Result<T> = std::result::Result<T, AdminError>;
pub type CommandResult = Result<()>;

pub struct CommandContext<'a> {
    pub client: &'a mut AdminClient,
    pub args: &'a [String],
}

pub struct CommandDefinition {
    pub tokens: &'static [&'static str],
    pub description: &'static str,
    pub args: &'static [&'static str],
    pub executor: for<'a> fn(CommandContext<'a>) -> Pin<Box<dyn Future<Output = CommandResult> + Send + 'a>>,
}

pub struct CommandRegistry {
    commands: Vec<CommandDefinition>,
}

impl CommandRegistry {
    pub fn new() -> Self {
        Self { commands: Vec::new() }
    }

    pub fn register(mut self, command: CommandDefinition) -> Self {
        self.commands.push(command);
        self
    }

    pub fn commands(&self) -> &[CommandDefinition] {
        &self.commands
    }

    pub fn find(&self, input_tokens: &[&str]) -> Option<(&CommandDefinition, Vec<String>)> {
        self.commands
            .iter()
            .filter(|cmd| input_tokens.len() >= cmd.tokens.len())
            .filter(|cmd| cmd.tokens.iter().zip(input_tokens).all(|(a, b)| *a == *b))
            .max_by_key(|cmd| cmd.tokens.len())
            .map(|cmd| {
                let args: Vec<String> = input_tokens[cmd.tokens.len()..].iter().map(|s| s.to_string()).collect();
                (cmd, args)
            })
    }

    pub fn completions(&self, partial: &str) -> Vec<String> {
        let tokens: Vec<&str> = partial.split_whitespace().collect();
        self.commands
            .iter()
            .filter(|cmd| {
                if tokens.is_empty() {
                    return true;
                }
                cmd.tokens.iter().zip(&tokens).all(|(a, b)| a.starts_with(b) || a == b)
            })
            .map(|cmd| cmd.tokens.join(" "))
            .collect()
    }

    pub fn help_text(&self) -> String {
        let max_usage_width = self
            .commands
            .iter()
            .map(|cmd| {
                let usage = format_usage(cmd);
                usage.len()
            })
            .max()
            .unwrap_or(0);
        let width = max_usage_width + 4;

        self.commands
            .iter()
            .map(|cmd| {
                let usage = format_usage(cmd);
                format!("  {:<width$}{}", usage, cmd.description, width = width)
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

fn format_usage(cmd: &CommandDefinition) -> String {
    let mut usage = cmd.tokens.join(" ");
    for arg in cmd.args {
        usage.push(' ');
        usage.push('<');
        usage.push_str(arg);
        usage.push('>');
    }
    usage
}

```

### Core Architecture Module: `admin/client/commands/mod.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

pub mod server;
pub mod users;

use crate::command::CommandRegistry;

pub fn base_commands() -> CommandRegistry {
    let registry = CommandRegistry::new();
    let registry = server::register(registry);
    users::register(registry)
}

```

### Core Architecture Module: `admin/client/commands/server.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use resource::server_info::{EndpointInfo, ServingInfo};
use server_admin_proto as admin_proto;

use crate::{
    AdminClient,
    command::{CommandDefinition, CommandRegistry, CommandResult, Result},
};

pub fn register(registry: CommandRegistry) -> CommandRegistry {
    registry
        .register(CommandDefinition {
            tokens: &["server", "version"],
            description: "Show server version",
            args: &[],
            executor: |ctx| Box::pin(server_version(ctx.client)),
        })
        .register(CommandDefinition {
            tokens: &["server", "status"],
            description: "Show server endpoint addresses",
            args: &[],
            executor: |ctx| Box::pin(server_status(ctx.client)),
        })
}

pub async fn execute_server_version(client: &mut AdminClient) -> Result<server_admin_proto::server_version::Res> {
    let response = client.server_version(admin_proto::server_version::Req {}).await?;
    Ok(response.into_inner())
}

pub async fn execute_server_status(client: &mut AdminClient) -> Result<server_admin_proto::server_status::Res> {
    let response = client.server_status(admin_proto::server_status::Req {}).await?;
    Ok(response.into_inner())
}

async fn server_version(client: &mut AdminClient) -> CommandResult {
    let res = execute_server_version(client).await?;
    println!("{} {}", res.distribution, res.version);
    Ok(())
}

async fn server_status(client: &mut AdminClient) -> CommandResult {
    let res = execute_server_status(client).await?;
    let info = ServingInfo {
        grpc: res.grpc.as_ref().map(endpoint_from_proto).unwrap_or_default(),
        http: res.http.as_ref().map(endpoint_from_proto),
        admin: res.admin_address,
        monitoring: res.monitoring_address,
    };
    println!("Status: running");
    println!("{info}");
    Ok(())
}

fn endpoint_from_proto(e: &admin_proto::EndpointStatus) -> resource::server_info::EndpointInfo {
    EndpointInfo { listen: Some(e.listen_address.clone()), advertise: e.advertise_address.clone() }
}

```

### Core Architecture Module: `admin/client/commands/users.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use server_admin_proto as admin_proto;

use crate::{
    AdminClient,
    command::{CommandDefinition, CommandRegistry, CommandResult},
    error::AdminError,
};

pub fn register(registry: CommandRegistry) -> CommandRegistry {
    registry.register(CommandDefinition {
        tokens: &["user", "reset-password"],
        description: "Reset a user's password. Prompts for the new password if not supplied.",
        args: &["username", "[new-password]"],
        executor: |ctx| {
            let args = ctx.args.to_vec();
            Box::pin(async move { reset_password(ctx.client, &args).await })
        },
    })
}

async fn reset_password(client: &mut AdminClient, args: &[String]) -> CommandResult {
    let (username, password) = match args {
        [username] => (username.clone(), prompt_password()?),
        [username, password] => (username.clone(), password.clone()),
        _ => {
            return Err(AdminError::InvalidArgCount {
                usage: "user reset-password <username> [<new-password>]".to_string(),
            });
        }
    };

    if password.is_empty() {
        return Err(AdminError::InvalidArgument {
            name: "password".to_string(),
            reason: "must not be empty".to_string(),
        });
    }

    client.user_reset_password(admin_proto::user_reset_password::Req { username: username.clone(), password }).await?;
    println!("Password updated for user '{username}'.");
    Ok(())
}

fn prompt_password() -> Result<String, AdminError> {
    use std::io::{BufRead, IsTerminal};
    if std::io::stdin().is_terminal() {
        rpassword::prompt_password("New password: ").map_err(|err| AdminError::InvalidArgument {
            name: "password".to_string(),
            reason: format!("could not read password: {err}"),
        })
    } else {
        let mut buf = String::new();
        std::io::stdin().lock().read_line(&mut buf).map_err(|err| AdminError::InvalidArgument {
            name: "password".to_string(),
            reason: format!("could not read password from stdin: {err}"),
        })?;
        Ok(buf.trim_end_matches(['\r', '\n']).to_string())
    }
}

```

### Core Architecture Module: `admin/client/error.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::sync::Arc;

use error::typedb_error;
use tonic_types::StatusExt;

typedb_error! {
    pub AdminError(component = "Admin", prefix = "ADM") {
        ConnectionFailed(1, "Failed to connect to '{address}'.", address: String, source: Arc<tonic::transport::Error>),
        RpcFailed(2, "Request failed.\n{cause}", cause: String),
        InvalidArgCount(3, "Invalid number of arguments. Usage: {usage}", usage: String),
        InvalidArgument(4, "Invalid argument '{name}': {reason}", name: String, reason: String),
        UnknownCommand(5, "Unknown command: '{input}'. Type 'help' for available commands.", input: String),
        ScriptReadFailed(6, "Failed to read script '{path}'.", path: String, source: Arc<std::io::Error>),
        SocketPathInaccessible(7, "Admin socket '{path}' could not be inspected.", path: String, source: Arc<std::io::Error>),
        SocketNotASocket(8, "Admin endpoint at '{path}' is not a Unix socket; refusing to connect.", path: String),
        SocketPermissionsUnexpected(
            9,
            "Admin socket '{path}' has mode {mode:#o}; expected {expected:#o}. Restart the server to recreate the socket with the correct mode.",
            path: String,
            mode: u32,
            expected: u32,
        ),
    }
}

impl From<tonic::Status> for AdminError {
    fn from(status: tonic::Status) -> Self {
        if let Ok(details) = status.check_error_details() {
            if let Some(error_info) = details.error_info() {
                let cause = match details.debug_info() {
                    Some(debug_info) if !debug_info.stack_entries.is_empty() => debug_info.stack_entries.join("\n"),
                    _ => format!("[{}] {}", error_info.reason, error_info.domain),
                };
                return Self::RpcFailed { cause };
            }
        }
        let code = status.code();
        let message = status.message();
        let cause = if message.is_empty() { format!("{code}") } else { format!("{code}: {message}") };
        Self::RpcFailed { cause }
    }
}

```

### Core Architecture Module: `admin/client/lib.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

pub mod command;
pub mod commands;
pub mod error;
pub mod repl;
pub mod transport;

use std::path::Path;

use server_admin_proto::type_db_admin_client::TypeDbAdminClient;
use tonic::transport::Channel;

use crate::error::AdminError;
pub use crate::transport::connect_channel;

pub type AdminClient = TypeDbAdminClient<Channel>;

pub async fn connect(endpoint: &Path) -> Result<AdminClient, AdminError> {
    let channel = connect_channel(endpoint).await?;
    Ok(TypeDbAdminClient::new(channel))
}

```

### Core Architecture Module: `admin/client/repl.rs`
```
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

use std::path::PathBuf;

use rustyline::{Config, Editor, error::ReadlineError, history::FileHistory};

use crate::{
    AdminClient,
    command::{CommandContext, CommandRegistry},
    commands::server::{execute_server_status, execute_server_version},
    error::AdminError,
};

const PROMPT: &str = "admin> ";
const HISTORY_FILE: &str = ".typedb_admin_history";

fn history_path() -> PathBuf {
    home::home_dir().unwrap_or_else(std::env::temp_dir).join(HISTORY_FILE)
}

pub async fn print_server_info(client: &mut AdminClient) {
    let server_version = match execute_server_version(client).await {
        Ok(version) => version,
        Err(err) => {
            eprintln!("WARNING: could not retrieve server version: {err:?}");
            return;
        }
    };
    let server_status = match execute_server_status(client).await {
        Ok(status) => status,
        Err(err) => {
            eprintln!("WARNING: could not retrieve server status: {err:?}");
            return;
        }
    };
    let admin_address = server_status.admin_address.unwrap_or_default();
    println!("Connected to {} {} ({}).", server_version.distribution, server_version.version, admin_address);
}

pub async fn run_interactive(client: &mut AdminClient, registry: &CommandRegistry) {
    println!("Type 'help' for available commands, 'exit' to quit.\n");

    let config = Config::builder().auto_add_history(true).build();
    let mut editor: Editor<(), FileHistory> = Editor::with_history(config, FileHistory::new()).unwrap();
    let _ = editor.load_history(&history_path());

    loop {
        match editor.readline(PROMPT) {
            Ok(input) => {
                let input = input.trim();
                if input.is_empty() {
                    continue;
                }
                if let Err(err) = execute_input(client, registry, input).await {
                    eprintln!("[Error] {err:?}");
                }
            }
            Err(ReadlineError::Interrupted) | Err(ReadlineError::Eof) => break,
            Err(err) => {
                eprintln!("Error reading input: {err}");
                break;
            }
        }
    }

    let _ = editor.save_history(&history_path());
}

pub async fn run_commands(client: &mut AdminClient, registry: &CommandRegistry, commands: &[String]) -> i32 {
    for command in commands {
        if let Err(err) = execute_input(client, registry, command.trim()).await {
            eprintln!("[Error] {err:?}");
            return 1;
        }
    }
    0
}

pub async fn run_script(client: &mut AdminClient, registry: &CommandRegistry, path: &str) -> Result<(), AdminError> {
    let content = std::fs::read_to_string(path).map_err(|source| AdminError::ScriptReadFailed {
        path: path.to_string(),
        source: std::sync::Arc::new(source),
    })?;
    for (line_num, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Err(err) = execute_input(client, registry, line).await {
            eprintln!("[Error] Line {}: {err:?}", line_num + 1);
            return Err(err);
        }
    }
    Ok(())
}

async fn execute_input(client: &mut AdminClient, registry: &CommandRegistry, input: &str) -> Result<(), AdminError> {
    match input {
        "exit" | "quit" => std::process::exit(0),
        "help" => {
            println!("Available commands:\n{}\n  help\n  exit", registry.help_text());
            Ok(())
        }
        _ => {
            let tokens: Vec<&str> = input.split_whitespace().collect();
            match registry.find(&tokens) {
                Some((cmd, args)) => {
                    let ctx = CommandContext { client, args: &args };
                    (cmd.executor)(ctx).await
                }
                None => Err(AdminError::UnknownCommand { input: input.to_string() }),
            }
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7998** (2026-09-30): **Reduce storage lookups and heap allocations for @card validations**
  *Symptoms*: ## Product change and motivation  Optimize the throughput of commit operations with new objects and changed types (operations affecting multiple interface instances) by reducing the number of type and constraint reads and collections.   ## Implementation  Before, for each new object, we used to get all its capabilities by interface types and collect their constraints. Over and over again. Now, we cache these checked constraints in method-local caches, using the object type as the key. This way, 100 objects of the same type collect the capabilities only once. Same for inf objects.

- **Issue #7997** (2026-09-28): **Don't clean up new, independent relations without players**
  *Symptoms*: ## Product change and motivation  Relations marked internally as 'independent' should survive at commit even without any linked players. The existing check at commit only looks at relations that lost a player in this transaction, not for newly written relations that never had one. A newly inserted relation may still get cleaned up at commit time. However, these relations' existence may be relied on, specifically by the database importer, in some cases.  ## Implementation  Check for relation independence for newly inserted relations as well. 

- **Issue #7996** (2026-09-29): **Introduce BTreeMapIntersectionIterator to use in isolation validation**
  *Symptoms*: ## Product change and motivation Introduce `BTreeMapIntersectionIterator`, which iterates through the shared keys of two BTreeMaps, and their corresponding values. Replaces the iterate-and-check approach to checking dependency between two commits. 

- **Issue #7994** (2026-09-30): **Upgrade Write::Put known_to_exist to 3 values, use when putting edges**
  *Symptoms*: ## Product change and motivation We extend the `known_to_exist` field in `Write::Put` to be a three-value enum `KnownToExist` (`Exists`, `NonExistent`, `Unknown`). By setting the edges connected of newly inserted vertices as `KnownToExist::NonExistent`, we can optimise the commit-time `set_initial_put_status` step to avoid hitting RocksDB. This step could be a significant chunk of the commit (20%-40%).

- **Issue #7993** (2026-09-28): **Fix max and min object type prefixes**
  *Symptoms*: ## Product change and motivation  Fix `max_object_type_prefix` and `min_object_type_prefix` results, used for building `has` iterators in `ThingManager`. This was a latent bug in the usage paths with no current callers (for unbounded searches).  ## Implementation  Swap the values and convert the functions into constant members with a const assert to reduce the room for logical errors.  Found accidentally, didn't verify with extra tests.

- **Issue #7992** (2026-09-25): **Optimize commit locking for capabilities**
  *Symptoms*: ## Product change and motivation  Let concurrent writes get faster by not creating cardinality and ordering locks for freshly inserted objects, which used to be purely excessive work, since freshly made objects cannot be referenced from multiple parallel transactions.  This change showed a **+5.3% with 4 writers, +6.8% with 8 writers** speedup on parallel benchmarks. No behaviour changes introduced.  ## Implementation  - **Skip the owns/plays/relates cardinality lock, and the ordered-list lock, when the object keying it was inserted by this snapshot.** - **The unique lock is never skipped** since it is keyed on the attribute value, shared across owners by construction. - **`get_checked_constraints` is replaced by `get_checked_cardinality_constraints`**, borrowing the cached constraint set instead of collecting it twice to introduce a slight local speedup for a hot path. 

- **Issue #7990** (2026-09-28): **Check disjointness to skip loops in during isolation checks**
  *Symptoms*: ## Product change and motivation  In some cases, such as bulk loading, many keyspaces have completely disjoint ranges but could be large volumes. In these cases we can skip looping over the ranges for those keyspaces. This change does a quick overlap check on the BTreeMaps ahead of time before executing the full looping intersections.  ## Implementation  - Add `disjoint` function, which is used to avoid looping over key ranges if possible 
  **Post-Mortem & Fix Analysis**:
  > closing in favor of #7996 

- **Issue #7987** (2026-09-22): **Remove circleci synchronization to benchmark repo**
  *Symptoms*: ## Product change and motivation  Remove a synchronization job that relies on a bot that has direct push access to a master branch.  ## Implementation  - Drop a CI job that pushes directly to github master branch 

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

### Incident Patch 1: `27aade0c` (2026-09-28)
**Commit Message**: fix: correct "occured" to "occurred" in error messages (#7979)

## Product change and motivation

Fixes a misspelling in five user-facing error messages: `occured` ->
`occurred`.

## Implementation

Pure string literals; no control flow, types, or error codes change.

| File | Lines | Message |
| --- | --- | --- |
| `encoding/value/decimal_value.rs` | 390, 393 | integer / fractional
decimal parse failure |
| `query/error.rs` | 44 | `ErrorDecodingGivenRowEntry` |
| `query/given_rows.rs` | 102, 103 | `ParsingValueFailedForGivenEntry`,
`TranslatingValueFailedForGivenEntry` |

Verification performed locally on `78d7124`:

- `cargo check -p encoding -p query` — passes, no new warnings.
- `rustfmt --edition 2024 --config-path rustfmt.toml --check` on all
three files — clean.
- `git grep occured` — no remaining occurrences.
- `git grep` over `tests/` — nothing asserts on these strings, so no
test expectation
  is coupled to the old spelling.

No tests were added because the change is a literal-only correction with
no behaviour
change to cover.

**File**: `encoding/value/decimal_value.rs` (modified, +2/-2)
```diff
@@ -387,10 +387,10 @@ impl fmt::Debug for DecimalParseError {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         match self {
             Self::ParseIntegerPart { value, .. } => {
-                write!(f, "An error occured while parsing the integer part of the decimal '{value}'")
+                write!(f, "An error occurred while parsing the integer part of the decimal '{value}'")
             }
             Self::ParseFractionalPart { value, .. } => {
-                write!(f, "An error occured while parsing the fractional part of the decimal '{value}'")
+                write!(f, "An error occurred while parsing the fractional part of the decimal '{value}'")
             }
             Self::PrecisionExceeded { value, .. } => {
                 write!(f, "The provided decimal '{value}' cannot be parsed without a loss of precision ")
```

**File**: `query/error.rs` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ typedb_error! {
         GivenRowsMissingRequiredVariable(23, "The given rows are missing the required variable '{variable}'.", variable: String),
         ErrorDecodingGivenRowEntry(
             24,
-            "An error occured while decoding the given rows.",
+            "An error occurred while decoding the given rows.",
             typedb_source: Box<GivenRowDecodeError>,
         ),
     }
```

**File**: `query/given_rows.rs` (modified, +2/-2)
```diff
@@ -99,8 +99,8 @@ typedb_error! {
     pub GivenRowDecodeError(component = "Decoding given rows", prefix = "GVN") {
         ConceptDecode(1, "An error occurred while decoding the provided concept.", typedb_source: Box<ConceptDecodeError>),
         InvalidIIDFormatForGivenEntry(2, "The provided iid string '{iid}' was invalid.", iid: String),
-        ParsingValueFailedForGivenEntry(3, "An error occured while parsing the provided value '{value}'.", value: String, typedb_source: typeql::Error),
-        TranslatingValueFailedForGivenEntry(4, "An error occured while translating the provided value '{value}'.", value: String, typedb_source: LiteralParseError),
+        ParsingValueFailedForGivenEntry(3, "An error occurred while parsing the provided value '{value}'.", value: String, typedb_source: typeql::Error),
+        TranslatingValueFailedForGivenEntry(4, "An error occurred while translating the provided value '{value}'.", value: String, typedb_source: LiteralParseError),
         GivenRowsVariableWasNotDeclared(5, "The variable '{variable}' was not declared in the query.", variable: String),
         ExpectedInstanceReceivedValue(6, "A value was provided where a concept instance was expected."),
         ValueTypeMismatch(7, "The provided value '{value}' has type '{actual_type}' and could not be decoded as the value type '{expected_type}'.", expected_type: ValueType, actual_type: String, value: String),
```

---

### Incident Patch 2: `88f02dbc` (2026-09-28)
**Commit Message**: Fix max and min object type prefixes (#7993)

## Product change and motivation

Fix `max_object_type_prefix` and `min_object_type_prefix` results, used
for building `has` iterators in `ThingManager`. This was a latent bug in
the usage paths with no current callers (for unbounded searches).

## Implementation

Swap the values and convert the functions into constant members with a
const assert to reduce the room for logical errors.

Found accidentally, didn't verify with extra tests.

**File**: `concept/thing/thing_manager.rs` (modified, +2/-2)
```diff
@@ -1269,7 +1269,7 @@ impl ThingManager {
             ),
             Bound::Unbounded => RangeStart::Inclusive(ThingEdgeHasReverse::prefix_from_attribute_to_type_parts(
                 attribute.vertex(),
-                Prefix::min_object_type_prefix(),
+                Prefix::MIN_OBJECT_TYPE_PREFIX,
                 TypeID::MIN,
             )),
         };
@@ -1282,7 +1282,7 @@ impl ThingManager {
             ),
             Bound::Unbounded => RangeEnd::EndPrefixInclusive(ThingEdgeHasReverse::prefix_from_attribute_to_type_parts(
                 attribute.vertex(),
-                Prefix::max_object_type_prefix(),
+                Prefix::MAX_OBJECT_TYPE_PREFIX,
                 TypeID::MAX,
             )),
         };
```

**File**: `encoding/layout/prefix.rs` (modified, +5/-15)
```diff
@@ -88,22 +88,12 @@ enum Domain {
     Data,
 }
 
-impl Prefix {
-    pub fn max_object_type_prefix() -> Prefix {
-        if Prefix::VertexEntityType.prefix_id().byte < Prefix::VertexRelationType.prefix_id().byte {
-            Prefix::VertexEntityType
-        } else {
-            Prefix::VertexRelationType
-        }
-    }
+const _: () =
+    assert!(Prefix::MIN_OBJECT_TYPE_PREFIX.prefix_id().byte < Prefix::MAX_OBJECT_TYPE_PREFIX.prefix_id().byte);
 
-    pub fn min_object_type_prefix() -> Prefix {
-        if Prefix::VertexEntityType.prefix_id().byte < Prefix::VertexRelationType.prefix_id().byte {
-            Prefix::VertexRelationType
-        } else {
-            Prefix::VertexEntityType
-        }
-    }
+impl Prefix {
+    pub const MIN_OBJECT_TYPE_PREFIX: Prefix = Prefix::VertexEntityType;
+    pub const MAX_OBJECT_TYPE_PREFIX: Prefix = Prefix::VertexRelationType;
 
     pub fn schema_byte_ranges() -> Vec<RangeInclusive<u8>> {
         let mut ranges: Vec<RangeInclusive<u8>> = Vec::new();
```

---

### Incident Patch 3: `4ec90214` (2026-09-23)
**Commit Message**: Remove excessive memory consumption and fix bugs of uniqueness constraint checks (#7982)

## Product change and motivation

Optimise memory usage of schema transactions' operation-time validation
for `@unique` annotations, triggered by type hierarchy, annotations, and
ownership changes. While the previous algorithm stored all affected
objects in RAM, uncontrolled (potentially gigabytes of data for huge
datasets), the new approach uses the same pattern as write transactions'
checks, depending only on a set of `has` edges for a single attribute at
a time.

Additionally, resolve a discovered bug in the shared operation-time
suitability check: when an attribute (or role) type is moved under a new
supertype, constraints declared above the new supertype were not applied
to the moved subtree's existing instances, so any constraint violation
could be committed through a set supertype. Covered by
https://github.com/typedb/typedb-behaviour/pull/455.

Solves #7138 

## Implementation

### Optimisation 

Reuse `ThingManager`'s validation for unique constraints in
operation-time validation for `TypeManager`.

Before, the algorithm was:
1. Iterate over objects
2. For each `has` in this object, i

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ bazel_dep(name = "typedb_behaviour", version = "0.0.0")
 git_override(
     module_name = "typedb_behaviour",
     remote = "https://github.com/typedb/typedb-behaviour",
-    commit = "25bac4ce17fcd7d4a1ff7cf2e58d95722de7cbbf",
+    commit = "5af278ec4585f1efc73d2dddf01aed3dadbdea12",
 )
 
 http_file = use_repo_rule("@bazel_tools//tools/build_defs/repo:http.bzl", "http_file")
```

**File**: `concept/thing/thing_manager/validation/operation_time_validation.rs` (modified, +11/-39)
```diff
@@ -4,11 +4,10 @@
  * file, You can obtain one at https://mozilla.org/MPL/2.0/.
  */
 
-use std::collections::{BTreeMap, Bound, HashMap, HashSet};
+use std::collections::{BTreeMap, HashMap, HashSet};
 
 use bytes::util::HexBytesFormatter;
 use encoding::value::{value::Value, value_type::ValueType};
-use iterator::minmax_or;
 use resource::profile::StorageCounters;
 use storage::snapshot::ReadableSnapshot;
 
@@ -421,19 +420,13 @@ impl OperationTimeValidation {
             .get_owned_attribute_type_constraint_unique(snapshot, thing_manager.type_manager(), attribute_type)
             .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?
         {
-            let owner = owner.into_object();
             let root_owner_type = constraint.source().owner();
             let root_owner_subtypes =
                 root_owner_type
                     .get_subtypes_transitive(snapshot, thing_manager.type_manager())
                     .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?;
             let owner_and_subtypes: HashSet<ObjectType> =
                 TypeAPI::chain_types(root_owner_type, root_owner_subtypes.into_iter().cloned()).collect();
-            let (owner_type_min, owner_type_max) = minmax_or!(
-                TypeAPI::chain_types(root_owner_type, root_owner_subtypes.into_iter().cloned()),
-                unreachable!("Expected at least one object type")
-            );
-            let owner_type_range = (Bound::Included(owner_type_min), Bound::Included(owner_type_max));
 
             let root_attribute_type = constraint.source().attribute();
             let root_attribute_subtypes = root_attribute_type
@@ -442,37 +435,16 @@ impl OperationTimeValidation {
             let attribute_and_subtypes =
                 TypeAPI::chain_types(root_attribute_type, root_attribute_subtypes.into_iter().cloned());
 
-            for attribute_type in attribute_and_subtypes {
-                if let Some(attribute) = thing_manager
-                    .get_attribute_with_value(snapshot, attribute_type, value.clone(), storage_counters.clone())
-                    .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?
-                {
-                    let mut has_iterator = thing_manager.get_has_reverse_by_attribute_and_owner_type_range(
-                        snapshot,
-                        &attribute,
-                        &owner_type_range,
-                        storage_counters.clone(),
-                    );
-
-                    while let Some((has, _)) = has_iterator
-                        .next()
-                        .transpose()
-                        .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?
-                    {
-                        // Iterator can return types outside the list based on the storage specifics
-                        if has.owner() != owner && owner_and_subtypes.contains(&has.owner().type_()) {
-                            return Err(DataValidation::create_data_validation_uniqueness_error(
-                                snapshot,
-                                thing_manager.type_manager(),
-                                &constraint,
-                                owner.into_object(),
-                                attribute_type,
-                                value,
-                            ));
-                        }
-                    }
-                }
-            }
+            DataValidation::validate_owns_unique_constraint(
+                snapshot,
+                thing_manager,
+                &constraint,
+                owner.into_object(),
+                &owner_and_subtypes,
+                attribute_and_subtypes,
+                value,
+                storage_counters,
+            )?;
         }
 
         Ok(())
```

**File**: `concept/thing/thing_manager/validation/validation.rs` (modified, +60/-3)
```diff
@@ -4,20 +4,28 @@
  * file, You can obtain one at https://mozilla.org/MPL/2.0/.
  */
 
+use std::collections::{Bound, HashSet};
+
 use bytes::util::HexBytesFormatter;
 use encoding::value::{label::Label, value::Value};
+use iterator::minmax_or;
+use resource::profile::StorageCounters;
 use storage::snapshot::ReadableSnapshot;
 
 use crate::{
     thing::{
-        ThingAPI, attribute::Attribute, object::Object, relation::Relation,
-        thing_manager::validation::DataValidationError,
+        ThingAPI,
+        attribute::Attribute,
+        object::Object,
+        relation::Relation,
+        thing_manager::{ThingManager, validation::DataValidationError},
     },
     type_::{
         Capability, TypeAPI,
         attribute_type::AttributeType,
         constraint::{CapabilityConstraint, Constraint, ConstraintError, TypeConstraint},
         entity_type::EntityType,
+        object_type::ObjectType,
         owns::Owns,
         plays::Plays,
         relates::Relates,
@@ -35,7 +43,7 @@ pub(crate) fn get_label_or_data_err(
     type_
         .get_label(snapshot, type_manager)
         .map(|label| label.clone())
-        .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))
+        .map_err(|typedb_source| Box::new(DataValidationError::ConceptRead { typedb_source }))
 }
 
 macro_rules! create_data_validation_type_abstractness_error_methods {
@@ -321,6 +329,55 @@ impl DataValidation {
         fn create_data_validation_relates_abstractness_error(Relates, Relation) -> RelatesConstraintViolated = relation_iid + relation_type + role_type;
     }
 
+    pub(crate) fn validate_owns_unique_constraint(
+        snapshot: &impl ReadableSnapshot,
+        thing_manager: &ThingManager,
+        constraint: &CapabilityConstraint<Owns>,
+        owner: Object,
+        owner_types: &HashSet<ObjectType>,
+        attribute_types: impl IntoIterator<Item = AttributeType>,
+        value: Value<'_>,
+        storage_counters: StorageCounters,
+    ) -> Result<(), Box<DataValidationError>> {
+        let (owner_type_min, owner_type_max) =
+            minmax_or!(owner_types.iter().copied(), unreachable!("Expected at least one object type"));
+        let owner_type_range = (Bound::Included(owner_type_min), Bound::Included(owner_type_max));
+        for attribute_type in attribute_types {
+            let Some(attribute) = thing_manager
+                .get_attribute_with_value(snapshot, attribute_type, value.clone(), storage_counters.clone())
+                .map_err(|typedb_source| Box::new(DataValidationError::ConceptRead { typedb_source }))?
+            else {
+                continue;
+            };
+
+            let mut has_iterator = thing_manager.get_has_reverse_by_attribute_and_owner_type_range(
+                snapshot,
+                &attribute,
+                &owner_type_range,
+                storage_counters.clone(),
+            );
+
+            while let Some((has, _)) = has_iterator
+                .next()
+                .transpose()
+                .map_err(|typedb_source| Box::new(DataValidationError::ConceptRead { typedb_source }))?
+            {
+                // The type range can hold owner types outside the hierarchy -> check owner_types
+                if has.owner() != owner && owner_types.contains(&has.owner().type_()) {
+                    return Err(Self::create_data_validation_uniqueness_error(
+                        snapshot,
+                        thing_manager.type_manager(),
+                        constraint,
+                        owner,
+                        attribute_type,
+                        value,
+                    ));
+                }
+            }
+        }
+        Ok(())
+    }
+
     pub(crate) fn create_data_validation_uniqueness_error(
         snapshot: &impl ReadableSnapshot,
         type_manager: &TypeManager,
```

**File**: `concept/type_/type_manager/validation/operation_time_validation.rs` (modified, +70/-44)
```diff
@@ -3085,25 +3085,38 @@ impl OperationTimeValidation {
             | ConstraintScope::AllInstancesOfTypeOrSubtypes => (),
         }
 
-        let source_interface_type = constraint.source().interface();
-
-        if source_interface_type == interface_type {
-            return Ok(true);
-        }
+        Self::is_interface_type_under_constraint_source(
+            snapshot,
+            type_manager,
+            constraint,
+            interface_type,
+            new_interface_supertypes,
+        )
+    }
 
-        for (subtype, supertype) in new_interface_supertypes {
-            if interface_type.is_subtype_transitive_of_or_same(snapshot, type_manager, *subtype)? {
-                return Ok(match supertype {
-                    None => false,
-                    Some(supertype) => {
-                        source_interface_type.is_subtype_transitive_of_or_same(snapshot, type_manager, *supertype)?
-                    }
-                });
+    fn is_interface_type_under_constraint_source<CAP: Capability>(
+        snapshot: &impl ReadableSnapshot,
+        type_manager: &TypeManager,
+        constraint: &CapabilityConstraint<CAP>,
+        interface_type: CAP::InterfaceType,
+        new_interface_supertypes: &HashMap<CAP::InterfaceType, Option<CAP::InterfaceType>>,
+    ) -> Result<bool, Box<ConceptReadError>> {
+        let source_interface_type = constraint.source().interface();
+        let mut visited = HashSet::new();
+        let mut current = Some(interface_type);
+        while let Some(type_) = current {
+            if type_ == source_interface_type {
+                return Ok(true);
             }
+            if !visited.insert(type_) {
+                return Ok(false);
+            }
+            current = match new_interface_supertypes.get(&type_) {
+                Some(new_supertype) => *new_supertype,
+                None => type_.get_supertype(snapshot, type_manager)?,
+            };
         }
-
-        // Not affected by new_interface_supertypes, can use storage
-        interface_type.is_subtype_transitive_of_or_same(snapshot, type_manager, source_interface_type)
+        Ok(false)
     }
 
     fn validate_owns_instances_against_constraints(
@@ -3164,8 +3177,36 @@ impl OperationTimeValidation {
             "At least one constraint should exist otherwise we don't need to iterate"
         );
 
-        // TODO #7138: It is EXCEPTIONALLY memory-greedy and should be optimized / removed from RAM!
-        let mut unique_values = HashMap::new();
+        let mut unique_attribute_types: HashSet<AttributeType> = HashSet::new();
+        let mut unique_owner_types: HashSet<ObjectType> = HashSet::new();
+        if let Some(unique_constraint) = &unique_constraint {
+            debug_assert_eq!(
+                unique_constraint.scope(),
+                ConstraintScope::AllInstancesOfTypeOrSubtypes,
+                "Reconsider the algorithm if constraint scope is changed!"
+            );
+            for attribute_type in attribute_types {
+                if Self::is_interface_type_under_constraint_source(
+                    snapshot,
+                    type_manager,
+                    unique_constraint,
+                    *attribute_type,
+                    new_attribute_supertypes,
+                )
+                .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?
+                {
+                    unique_attribute_types.insert(*attribute_type);
+                }
+            }
+
+            let root_owner_type = unique_constraint.source().owner();
+            let root_owner_subtypes = root_owner_type
+                .get_subtypes_transitive(snapshot, type_manager)
+                .map_err(|source| Box::new(DataValidationError::ConceptRead { typedb_source: source }))?;
+            unique_owner_types = TypeAPI::chain_types(root_owner_type, root_owner_subtypes.into_iter().cloned())
+                .chain(object_types.it
```

---

### Incident Patch 4: `78d71246` (2026-09-18)
**Commit Message**: Fix function calls copying row where input row is narrower output row (#7952)

## Product change and motivation
This can happen when a function call is the first instruction after a stage that may narrow a row, such as select or delete. fixes #7930

**File**: `compiler/executable/match_/planner/mod.rs` (modified, +9/-14)
```diff
@@ -161,7 +161,6 @@ struct FunctionCallBuilder {
     function_id: FunctionID,
     arguments: Vec<VariablePosition>,
     assigned: Vec<Option<VariablePosition>>,
-    output_width: u32,
 }
 
 #[derive(Debug)]
@@ -283,19 +282,15 @@ impl StepBuilder {
                 ))
             }
 
-            StepInstructionsBuilder::FunctionCall(FunctionCallBuilder {
-                function_id,
-                arguments,
-                assigned,
-                output_width,
-                ..
-            }) => ExecutionStep::FunctionCall(FunctionCallStep {
-                function_id,
-                arguments,
-                assigned,
-                selected_variables,
-                output_width,
-            }),
+            StepInstructionsBuilder::FunctionCall(FunctionCallBuilder { function_id, arguments, assigned, .. }) => {
+                ExecutionStep::FunctionCall(FunctionCallStep {
+                    function_id,
+                    arguments,
+                    assigned,
+                    selected_variables,
+                    output_width,
+                })
+            }
         }
     }
 }
```

**File**: `compiler/executable/match_/planner/plan.rs` (modified, +0/-2)
```diff
@@ -1472,7 +1472,6 @@ impl ConjunctionPlan<'_> {
                         function_id: call_binding.function_call().function_id(),
                         arguments,
                         assigned,
-                        output_width: conjunction_builder.next_output.position,
                     });
                     conjunction_builder.push_step(&HashMap::new(), step_builder.into())
                 }
@@ -1510,7 +1509,6 @@ impl ConjunctionPlan<'_> {
                     function_id: call_binding.function_call().function_id(),
                     arguments,
                     assigned,
-                    output_width: conjunction_builder.next_output.position,
                 });
                 conjunction_builder.push_step(&HashMap::new(), step_builder.into());
             }
```

**File**: `executor/read/immediate_executor.rs` (modified, +20/-3)
```diff
@@ -941,7 +941,7 @@ impl CheckExecutor {
                 .map_err(|err| ReadExecutionError::ConceptRead { typedb_source: err })?
             {
                 output.append(|mut row| {
-                    row.copy_mapped(input_row, self.selected_variables.iter().map(|pos| (*pos, *pos)));
+                    row.merge_selected(&self.selected_variables, input_row, [], 1);
                 })
             }
         }
@@ -954,6 +954,7 @@ pub(crate) struct BuiltinCallExecutor {
     builtin_id: BuiltinConceptFunctionID,
     argument_positions: Vec<VariablePosition>,
     assignment_positions: Vec<Option<VariablePosition>>,
+    selected_variables: Vec<VariablePosition>,
     output_width: u32,
     input: Option<FixedBatch>,
     profile: Arc<StepProfile>,
@@ -970,10 +971,19 @@ impl BuiltinCallExecutor {
         builtin_id: BuiltinConceptFunctionID,
         argument_positions: Vec<VariablePosition>,
         assignment_positions: Vec<Option<VariablePosition>>,
+        selected_variables: Vec<VariablePosition>,
         output_width: u32,
         profile: Arc<StepProfile>,
     ) -> Self {
-        Self { builtin_id, argument_positions, assignment_positions, output_width, input: None, profile }
+        Self {
+            builtin_id,
+            argument_positions,
+            assignment_positions,
+            selected_variables,
+            output_width,
+            input: None,
+            profile,
+        }
     }
 
     pub(crate) fn output_width(&self) -> u32 {
@@ -1024,7 +1034,14 @@ impl BuiltinCallExecutor {
     ) -> Result<(), Box<ConceptReadError>> {
         macro_rules! execute {
             ($id:ident) => {
-                builtin_function::$id(&self.assignment_positions, &self.argument_positions, context, input_row, output)
+                builtin_function::$id(
+                    &self.assignment_positions,
+                    &self.argument_positions,
+                    &self.selected_variables,
+                    context,
+                    input_row,
+                    output,
+                )
             };
         }
 
```

**File**: `executor/read/immediate_executor/builtin_function.rs` (modified, +174/-146)
```diff
@@ -27,309 +27,322 @@ use ir::translation::function::FunctionAnnotation;
 use itertools::Itertools;
 use storage::snapshot::ReadableSnapshot;
 
-use crate::{Provenance, batch::FixedBatch, pipeline::stage::ExecutionContext, row::MaybeOwnedRow};
+use crate::{batch::FixedBatch, pipeline::stage::ExecutionContext, row::MaybeOwnedRow};
 
 pub(crate) fn iid(
     assignment_positions: &[Option<VariablePosition>],
     argument_positions: &[VariablePosition],
+    selected_variables: &[VariablePosition],
     _context: &ExecutionContext<impl ReadableSnapshot>,
     input_row: &MaybeOwnedRow<'_>,
     output: &mut FixedBatch,
 ) -> Result<(), Box<ConceptReadError>> {
     let Some(return_position) = assignment_positions[0] else {
-        output.append(|mut row| row.copy_from_row(input_row.as_reference()));
+        output.append(|mut row| row.merge_selected(selected_variables, input_row.as_reference(), [], 1));
         return Ok(()); // all concepts have IIDs
     };
-    let (mut row, multiplicity, provenance) = row_into_parts_widened(input_row, return_position);
     let iid = input_row[argument_positions[0].as_usize()].as_thing().iid();
-    row[return_position.as_usize()] = VariableValue::Value(Value::String(Cow::Owned(format!("{iid:x}"))));
-    let output_row = MaybeOwnedRow::new_owned(row, multiplicity, provenance);
-    output.append(|mut row| row.copy_from_row(output_row));
+    let iid_value = VariableValue::Value(Value::String(Cow::Owned(format!("{iid:x}"))));
+    output.append(|mut row| {
+        row.merge_selected(selected_variables, input_row.as_reference(), [(return_position, iid_value)], 1);
+    });
     Ok(())
 }
 
 pub(crate) fn label(
     assignment_positions: &[Option<VariablePosition>],
     argument_positions: &[VariablePosition],
+    selected_variables: &[VariablePosition],
     context: &ExecutionContext<impl ReadableSnapshot>,
     input_row: &MaybeOwnedRow<'_>,
     output: &mut FixedBatch,
 ) -> Result<(), Box<ConceptReadError>> {
     let Some(return_position) = assignment_positions[0] else {
-        output.append(|mut row| row.copy_from_row(input_row.as_reference()));
+        output.append(|mut row| row.merge_selected(selected_variables, input_row.as_reference(), [], 1));
         return Ok(()); // all types have labels
     };
-    let (mut row, multiplicity, provenance) = row_into_parts_widened(input_row, return_position);
     let ty = input_row[argument_positions[0].as_usize()].as_type();
     let label = ty.get_label(&**context.snapshot(), context.type_manager())?;
-    row[return_position.as_usize()] = VariableValue::Value(Value::String(Cow::Owned(label.to_string())));
-    let output_row = MaybeOwnedRow::new_owned(row, multiplicity, provenance);
-    output.append(|mut row| row.copy_from_row(output_row));
+    let label_value = VariableValue::Value(Value::String(Cow::Owned(label.to_string())));
+    output.append(|mut row| {
+        row.merge_selected(selected_variables, input_row.as_reference(), [(return_position, label_value)], 1);
+    });
     Ok(())
 }
 
 pub(crate) fn get_doc(
     assignment_positions: &[Option<VariablePosition>],
     argument_positions: &[VariablePosition],
+    selected_variables: &[VariablePosition],
     context: &ExecutionContext<impl ReadableSnapshot>,
     input_row: &MaybeOwnedRow<'_>,
     output: &mut FixedBatch,
 ) -> Result<(), Box<ConceptReadError>> {
     let Some(return_position) = assignment_positions[0] else {
-        output.append(|mut row| row.copy_from_row(input_row.as_reference()));
+        output.append(|mut row| row.merge_selected(selected_variables, input_row.as_reference(), [], 1));
         return Ok(()); // a missing doc is equivalent to @doc("")
     };
-    let (mut row, multiplicity, provenance) = row_into_parts_widened(input_row, return_position);
-    row[return_position.as_usize()] = get_type_doc(context, &input_row[argument_positions[0].as_usize()])?;
-    let output_row = MaybeOwnedRow::new_owned(row, multiplicity, provenance);
-
```

**File**: `executor/read/nested_pattern_executor.rs` (modified, +14/-13)
```diff
@@ -47,7 +47,7 @@ impl DisjunctionExecutor {
         let mut uniform_batch = FixedBatch::new(self.output_width);
         unmapped.into_iter().for_each(|row| {
             uniform_batch.append(|mut output_row| {
-                output_row.copy_mapped(row, self.selected_variables.iter().map(|&pos| (pos, pos)));
+                output_row.merge_selected(&self.selected_variables, row, [], 1);
                 output_row.set_branch_id_in_provenance(self.branch_ids[*source_branch_index]);
             })
         });
@@ -95,9 +95,7 @@ impl OptionalExecutor {
     pub(crate) fn map_as_failed_output(&self, unmapped_input: MaybeOwnedRow<'_>) -> FixedBatch {
         let mut output = FixedBatch::new(self.output_width);
         output.append(|mut output_row| {
-            output_row
-                .copy_mapped(unmapped_input.as_reference(), self.selected_variables.iter().map(|&pos| (pos, pos)));
-            output_row.set_provenance(unmapped_input.provenance()); // Pass through old provenance
+            output_row.merge_selected(&self.selected_variables, unmapped_input.as_reference(), [], 1);
         });
         output
     }
@@ -127,6 +125,7 @@ pub struct InlinedCallExecutor {
     pub inner: PatternExecutor,
     pub arg_mapping: Vec<VariablePosition>,
     pub assignment_positions: Vec<Option<VariablePosition>>,
+    pub selected_variables: Vec<VariablePosition>,
     pub output_width: u32,
     pub parameter_registry: Arc<ParameterRegistry>,
 }
@@ -141,6 +140,7 @@ impl InlinedCallExecutor {
             inner,
             arg_mapping: function_call.arguments.clone(),
             assignment_positions: function_call.assigned.clone(),
+            selected_variables: function_call.selected_variables.clone(),
             output_width: function_call.output_width,
             parameter_registry,
         }
@@ -167,16 +167,17 @@ impl InlinedCallExecutor {
             let returned_row = batch.get_row(return_index);
             if check_indices.iter().all(|(src, dst)| returned_row.get(*src) == input.get(*dst)) {
                 output_batch.append(|mut output_row| {
-                    output_row.copy_from_row(input.as_reference());
-                    output_row.copy_mapped(
-                        returned_row.as_reference(),
-                        self.assignment_positions
-                            .iter()
-                            .enumerate()
-                            .filter_map(|(src, &dst)| Some((VariablePosition::new(src as u32), dst?))),
+                    let extension = self
+                        .assignment_positions
+                        .iter()
+                        .enumerate()
+                        .filter_map(|(index, &dst)| Some((dst?, returned_row[index].clone())));
+                    output_row.merge_selected(
+                        &self.selected_variables,
+                        input.as_reference(),
+                        extension,
+                        returned_row.multiplicity(),
                     );
-                    // Fix provenance:
-                    output_row.set_provenance(input.provenance());
                 });
             }
         }
```

---

### Incident Patch 5: `f5e1d028` (2026-09-17)
**Commit Message**: Lower commit validation memory consumption (#7973)

## Product change and motivation

Introduce a series of changes to lower the RAM consumption of a TypeDB
server during different schema validation operations.

### Database import excessive relaxation
Relaxation of cardinality constraints only affects annotations that are
set to non-zero lower bounds. Previously, the rule was to relax any
non-`0..` cardinality, which is too wide. Now, all capabilities with
default cardinalities and many other user-defined cases are untouched,
which makes the finalisation step much faster in many cases (it skips
the whole data cardinality verification -- one of the heaviest
operations in the process).

### Cardinality validation
Cardinality validation is used to collect all the affected instances in
RAM to combine changes from different sources: various schema changes
and instance inserts and deletions. This is too greedy for small
machines or huge datasets, so the algorithm was refactored.

Now, only types (a logically limited number) and a small portion of
instances are kept in memory at a time, processed in batches. With this,
the uncapped memory consumption (up to tens of GB) went to about a
hu

**File**: `Cargo.lock` (modified, +27/-27)
```diff
@@ -952,7 +952,7 @@ dependencies = [
  "paste",
  "pprof",
  "primitive",
- "rand 0.8.7",
+ "rand 0.8.8",
  "regex",
  "resource",
  "sentry",
@@ -1432,7 +1432,7 @@ dependencies = [
  "itertools 0.14.0",
  "logger",
  "lz4",
- "rand 0.8.7",
+ "rand 0.8.8",
  "resource",
  "serde",
  "tempdir",
@@ -1482,7 +1482,7 @@ dependencies = [
  "lending_iterator",
  "logger",
  "primitive",
- "rand 0.8.7",
+ "rand 0.8.8",
  "resource",
  "rocksdb",
  "seahash",
@@ -1630,7 +1630,7 @@ name = "fail_point"
 version = "0.0.0"
 dependencies = [
  "itertools 0.14.0",
- "rand 0.8.7",
+ "rand 0.8.8",
  "tracing",
 ]
 
@@ -1737,7 +1737,7 @@ dependencies = [
  "itertools 0.14.0",
  "logger",
  "primitive",
- "rand 0.8.7",
+ "rand 0.8.8",
  "resource",
  "storage",
  "test_utils",
@@ -3606,7 +3606,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3c80231409c20246a13fddb31776fb942c38553c51e871f8cbd687a4cfb5843d"
 dependencies = [
  "phf_shared",
- "rand 0.8.7",
+ "rand 0.8.8",
 ]
 
 [[package]]
@@ -3879,7 +3879,7 @@ dependencies = [
  "byteorder",
  "hmac",
  "md-5",
- "rand 0.8.7",
+ "rand 0.8.8",
  "sha-1",
  "sha2",
 ]
@@ -3904,7 +3904,7 @@ dependencies = [
  "moka",
  "paste",
  "pprof",
- "rand 0.8.7",
+ "rand 0.8.8",
  "resource",
  "serde",
  "storage",
@@ -4021,16 +4021,16 @@ checksum = "552840b97013b1a26992c11eac34bdd778e464601a4c2054b5f0bff7c6761293"
 dependencies = [
  "fuchsia-cprng",
  "libc",
- "rand_core 0.3.1",
+ "rand_core 0.3.2",
  "rdrand",
  "winapi",
 ]
 
 [[package]]
 name = "rand"
-version = "0.8.7"
+version = "0.8.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "22f6172bdec972074665ed81ed53b71da00bfc44b65a753cfde883ec4c702a1a"
+checksum = "e058c7de0b26af77780c769414d6257830bb240f3c38477dbc2c16e5f54d6d4c"
 dependencies = [
  "libc",
  "rand_chacha",
@@ -4060,9 +4060,9 @@ dependencies = [
 
 [[package]]
 name = "rand_core"
-version = "0.3.1"
+version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7a6fdeb83b075e8266dcc8762c22776f6877a63111121f5f8c7411e5be7eed4b"
+checksum = "96f815e01bbd9678b50d927f79aa1cf3ffdfdb1b9787317c1284dadb894ad0e8"
 dependencies = [
  "rand_core 0.4.2",
 ]
@@ -4123,7 +4123,7 @@ version = "0.4.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "678054eb77286b51581ba43620cc911abf02758c91f93f479767aed0f90458b2"
 dependencies = [
- "rand_core 0.3.1",
+ "rand_core 0.3.2",
 ]
 
 [[package]]
@@ -4670,7 +4670,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "653942e6141f16651273159f4b8b1eaeedf37a7554c00cd798953e64b8a9bf72"
 dependencies = [
  "once_cell",
- "rand 0.8.7",
+ "rand 0.8.8",
  "sentry-types",
  "serde",
  "serde_json",
@@ -4706,7 +4706,7 @@ checksum = "2d4203359e60724aa05cf2385aaf5d4f147e837185d7dd2b9ccf1ee77f4420c8"
 dependencies = [
  "debugid",
  "hex",
- "rand 0.8.7",
+ "rand 0.8.8",
  "serde",
  "serde_json",
  "thiserror 1.0.69",
@@ -4862,7 +4862,7 @@ dependencies = [
  "prost",
  "pwhash",
  "query",
- "rand 0.8.7",
+ "rand 0.8.8",
  "regex",
  "resource",
  "rustls-pemfile",
@@ -4995,9 +4995,9 @@ checksum = "0c790de23124f9ab44544d7ac05d60440adc586479ce501c1d6d7da3cd8c9cf5"
 
 [[package]]
 name = "smallvec"
-version = "1.15.2"
+version = "1.16.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8ed6a63f02c8539c91a8685a86f4099661ba3da017932f6ebbea6de3f0fa7c90"
+checksum = "ba467056f1b547ed52077911161fc86985becbc60e8e1857c8a144dab0def891"
 
 [[package]]
 name = "smart-default"
@@ -5129,8 +5129,8 @@ dependencies = [
  "options",
  "pprof",
  "primitive",
- "rand 0.8.7",
- "rand_core 0.3.1",
+ "rand 0.8.8",
+ "rand_core 0.3.2",
  "resource",
  "rocksdb",
  "same-file",
@@ -5373,7 +5373,7 @@ name = "test_utils"
 version = "0.0.0"
 dependencies = [
  "logger",
- "rand 0.8.7",
+ "rand 0.8.8",
  "tracing",
 ]
 
@@ -5705,7 +5705,7 @@ dependencies = [
  "indexmap 1.9.3",
  "pin-project",
  "pin-project-lite
```

**File**: `Cargo.toml` (modified, +20/-20)
```diff
@@ -177,12 +177,12 @@ features = {}
 
 		[workspace.dependencies.rpassword]
 			features = []
-			version = "7.5.3"
+			version = "7.5.4"
 			default-features = false
 
 		[workspace.dependencies.rand]
 			features = ["alloc", "default", "getrandom", "libc", "rand_chacha", "small_rng", "std", "std_rng"]
-			version = "0.8.6"
+			version = "0.8.8"
 			default-features = false
 
 		[workspace.dependencies.tokio-test]
@@ -212,7 +212,7 @@ features = {}
 
 		[workspace.dependencies.xxhash-rust]
 			features = ["xxh3"]
-			version = "0.8.15"
+			version = "0.8.18"
 			default-features = false
 
 		[workspace.dependencies.options]
@@ -248,7 +248,7 @@ features = {}
 
 		[workspace.dependencies.regex]
 			features = ["default", "perf", "perf-backtrack", "perf-cache", "perf-dfa", "perf-inline", "perf-literal", "perf-onepass", "std", "unicode", "unicode-age", "unicode-bool", "unicode-case", "unicode-gencat", "unicode-perl", "unicode-script", "unicode-segment"]
-			version = "1.12.3"
+			version = "1.13.1"
 			default-features = false
 
 		[workspace.dependencies.system]
@@ -308,7 +308,7 @@ features = {}
 
 		[workspace.dependencies.moka]
 			features = ["default", "sync"]
-			version = "0.12.15"
+			version = "0.12.16"
 			default-features = false
 
 		[workspace.dependencies.server_admin_proto]
@@ -318,7 +318,7 @@ features = {}
 
 		[workspace.dependencies.async-trait]
 			features = []
-			version = "0.1.89"
+			version = "0.1.92"
 			default-features = false
 
 		[workspace.dependencies.typedb-admin]
@@ -337,8 +337,8 @@ features = {}
 			default-features = false
 
 		[workspace.dependencies.tokio-util]
-			features = ["codec", "default", "futures-util", "io", "rt"]
-			version = "0.7.18"
+			features = ["codec", "default", "futures-util", "io", "libc", "rt"]
+			version = "0.7.19"
 			default-features = false
 
 		[workspace.dependencies.tower-http]
@@ -348,7 +348,7 @@ features = {}
 
 		[workspace.dependencies.serde]
 			features = ["alloc", "default", "derive", "rc", "serde_derive", "std"]
-			version = "1.0.228"
+			version = "1.0.229"
 			default-features = false
 
 		[workspace.dependencies.lz4]
@@ -383,7 +383,7 @@ features = {}
 
 		[workspace.dependencies.clap]
 			features = ["color", "default", "derive", "error-context", "help", "std", "suggestions", "usage", "wrap_help"]
-			version = "4.6.1"
+			version = "4.6.6"
 			default-features = false
 
 		[workspace.dependencies.async-std]
@@ -398,12 +398,12 @@ features = {}
 
 		[workspace.dependencies.chrono]
 			features = ["alloc", "clock", "default", "iana-time-zone", "js-sys", "now", "oldtime", "std", "wasm-bindgen", "wasmbind", "winapi", "windows-link"]
-			version = "0.4.44"
+			version = "0.4.45"
 			default-features = false
 
 		[workspace.dependencies.serde_json]
 			features = ["default", "raw_value", "std"]
-			version = "1.0.150"
+			version = "1.0.151"
 			default-features = false
 
 		[workspace.dependencies.xoshiro]
@@ -473,7 +473,7 @@ features = {}
 
 		[workspace.dependencies.serde_with]
 			features = ["alloc", "default", "macros", "std"]
-			version = "3.20.0"
+			version = "3.22.0"
 			default-features = false
 
 		[workspace.dependencies.hyper]
@@ -514,7 +514,7 @@ features = {}
 
 		[workspace.dependencies.macro_rules_attribute]
 			features = ["default"]
-			version = "0.2.2"
+			version = "0.2.3"
 			default-features = false
 
 		[workspace.dependencies.encoding]
@@ -534,7 +534,7 @@ features = {}
 
 		[workspace.dependencies.http]
 			features = ["default", "std"]
-			version = "1.4.1"
+			version = "1.5.0"
 			default-features = false
 
 		[workspace.dependencies.hyper-rustls]
@@ -544,7 +544,7 @@ features = {}
 
 		[workspace.dependencies.rand_core]
 			features = ["default", "std"]
-			version = "0.3.1"
+			version = "0.3.2"
 			default-features = false
 
 		[workspace.dependencies.lending_iterator]
@@ -624,7 +624,7 @@ features = {}
 
 		[workspace.dependencies.tokio]
 			features = ["bytes", "default", "fs", "io-std", "io-util", "libc", "macros", "mio", "
```

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ bazel_dep(name = "typedb_behaviour", version = "0.0.0")
 git_override(
     module_name = "typedb_behaviour",
     remote = "https://github.com/typedb/typedb-behaviour",
-    commit = "7d35851bffeabd642b7288dea82eb63852f3c191",
+    commit = "25bac4ce17fcd7d4a1ff7cf2e58d95722de7cbbf",
 )
 
 http_file = use_repo_rule("@bazel_tools//tools/build_defs/repo:http.bzl", "http_file")
```

**File**: `concept/thing/thing_manager.rs` (modified, +336/-91)
```diff
@@ -87,7 +87,7 @@ use crate::{
         r#struct::StructIndexForAttributeTypeIterator,
         thing_manager::validation::{
             DataValidationError,
-            cardinality_validation::{CardinalityChangeTracker, CardinalityValidation, collect_errors},
+            cardinality_validation::{CardinalityValidation, ModifiedCapabilityTypes},
             operation_time_validation::OperationTimeValidation,
         },
     },
@@ -106,6 +106,31 @@ use crate::{
 
 pub mod validation;
 
+pub(crate) struct ModifiedOwnerHas {
+    pub owner: Object,
+    pub status: ConceptStatus,
+    pub modified_attribute_types: HashSet<AttributeType>,
+}
+
+pub(crate) struct ModifiedRelationLinks {
+    pub relation: Relation,
+    pub status: ConceptStatus,
+    pub modified_role_types: HashSet<RoleType>,
+    pub removed_role_players: HashSet<(Object, RoleType)>,
+}
+
+pub(crate) struct ModifiedPlayerLinks {
+    pub player: Object,
+    pub status: ConceptStatus,
+    pub modified_role_types: HashSet<RoleType>,
+}
+
+#[derive(Clone, Copy)]
+struct RelationIndexQualification {
+    qualified_before: bool,
+    qualified_now: bool,
+}
+
 #[derive(Debug)]
 pub struct ThingManager {
     vertex_generator: Arc<ThingVertexGenerator>,
@@ -1651,6 +1676,127 @@ impl ThingManager {
             })
     }
 
+    pub(crate) fn for_each_new_object<Snapshot: ReadableSnapshot, E>(
+        &self,
+        snapshot: &mut Snapshot,
+        mut visit: impl FnMut(&mut Snapshot, Object) -> Result<(), E>,
+    ) -> Result<(), E> {
+        let objects = KeyRange::new(
+            RangeStart::Inclusive(ObjectVertex::MIN.into_storage_key()),
+            RangeEnd::EndPrefixInclusive(ObjectVertex::MAX.into_storage_key()),
+            ObjectVertex::FIXED_WIDTH_ENCODING,
+        );
+        snapshot.visit_writes_in_range(&objects, |snapshot, key, write| match write {
+            Write::Insert { .. } => visit(snapshot, Object::new(ObjectVertex::decode(key.bytes()))),
+            Write::Delete => Ok(()),
+            Write::Put { .. } => unreachable!("Encountered a Put for an object"),
+        })
+    }
+
+    pub(crate) fn for_each_owner_with_modified_has<Snapshot: ReadableSnapshot, E>(
+        &self,
+        snapshot: &mut Snapshot,
+        storage_counters: StorageCounters,
+        read_error: impl Fn(Box<ConceptReadError>) -> E,
+        mut visit: impl FnMut(&mut Snapshot, ModifiedOwnerHas) -> Result<(), E>,
+    ) -> Result<(), E> {
+        let mut group: Option<ModifiedOwnerHas> = None;
+        let mut flush = |snapshot: &mut Snapshot, group: Option<ModifiedOwnerHas>| match group {
+            Some(modified) => visit(snapshot, modified),
+            None => Ok(()),
+        };
+        snapshot.visit_writes_in_range(
+            &KeyRange::new_within(ThingEdgeHas::prefix(), ThingEdgeHas::FIXED_WIDTH_ENCODING),
+            |snapshot, key, _| {
+                let edge = ThingEdgeHas::decode(Bytes::Reference(key.byte_array()));
+                let owner = Object::new(edge.from());
+                if !group.as_ref().is_some_and(|modified| modified.owner == owner) {
+                    flush(snapshot, group.take())?;
+                    let status = self
+                        .get_status(snapshot, owner.vertex().into_storage_key(), storage_counters.clone())
+                        .map_err(&read_error)?;
+                    group = Some(ModifiedOwnerHas { owner, status, modified_attribute_types: HashSet::new() });
+                }
+                group.as_mut().unwrap().modified_attribute_types.insert(Attribute::new(edge.to()).type_());
+                Ok(())
+            },
+        )?;
+        flush(snapshot, group.take())
+    }
+
+    pub(crate) fn for_each_relation_with_modified_links<Snapshot: ReadableSnapshot, E>(
+        &self,
+        snapshot: &mut Snapshot,
+        storage_counters: StorageCounters,
+        read_error: impl Fn(Box<ConceptReadError>) -> E,
+        mut visit: impl FnMut(&mut Snapshot, ModifiedRelatio
```

**File**: `concept/thing/thing_manager/validation/cardinality_validation.rs` (modified, +291/-373)
```diff
@@ -4,7 +4,7 @@
  * file, You can obtain one at https://mozilla.org/MPL/2.0/.
  */
 
-use std::collections::{Bound, HashMap, HashSet};
+use std::collections::{HashMap, HashSet};
 
 use bytes::Bytes;
 use resource::profile::StorageCounters;
@@ -45,28 +45,15 @@ macro_rules! collect_errors {
     };
 }
 
-pub(crate) use collect_errors;
 use encoding::{
     Prefixed,
-    graph::{
-        thing::{
-            ThingVertex,
-            edge::{ThingEdgeHas, ThingEdgeLinks},
-            vertex_object::ObjectVertex,
-        },
-        type_::{edge::TypeEdge, property::TypeEdgeProperty, vertex::PrefixedTypeVertexEncoding},
-    },
+    graph::type_::{edge::TypeEdge, property::TypeEdgeProperty},
     layout::{infix::Infix, prefix::Prefix},
 };
-use iterator::minmax_or;
-use storage::{
-    key_range::{KeyRange, RangeEnd, RangeStart},
-    key_value::StorageKey,
-    snapshot::write::Write,
-};
+use storage::{key_range::KeyRange, snapshot::write::Write};
 
 use crate::{
-    thing::{ThingAPI, attribute::Attribute},
+    ConceptStatus,
     type_::{object_type::ObjectType, relation_type::RelationType, type_manager::TypeManager},
 };
 
@@ -128,10 +115,10 @@ macro_rules! validate_capability_cardinality_constraint {
 
 /*
 The cardinalities validation flow is the following:
-1. Collect instances affected by cardinalities changes (separately for 3 capabilities: owns, plays, relates)
+1. Find instances affected by cardinalities changes (separately for 3 capabilities: owns, plays, relates): instance writes are visited straight from the write buffer, grouped by its key order; a capability cardinality change is recorded per type and every instance of the type is visited.
 2. Validate only the affected instances to avoid rescanning the whole system (see validate_capability_cardinality_constraint). For each object,
-  2a. Count every capability instance it has (every has, every played role, every roleplayer)
-  2b. Collect cardinality constraints (declared and inherited) of all marked capabilities without duplications (if a subtype and its supertype are affected, the supertype's constraint is checked once)
+  2a. Count every capability instance it has (every has, every played role, every roleplayer).
+  2b. Collect cardinality constraints (declared and inherited) of all marked capabilities without duplications (if a subtype and its supertype are affected, the supertype's constraint is checked once).
   2c. Validate each constraint separately using the counts prepared in 2a. To validate a constraint, take its source type (where this constraint is declared), and count all instances of the source type and its subtypes.
 
 Let's consider the following example:
@@ -144,7 +131,7 @@ A query is being run:
   define person owns surname @card(1..10);
 
 It will be processed like:
-1. All instances of persons will be collected, the only surname attribute type saved as modified.
+1. person is recorded with surname as the only modified attribute type, and every instance of person is visited.
 2. For each instance of persons:
   2a. All names, surnames, and changed-surnames are counted (based on instances' explicit types).
   2b. surname's constraints will be taken: @card(1..) from name and @card(1..10) from surname.
@@ -163,315 +150,334 @@ We could potentially use the old version of storage (ignoring the snapshot), but
 Please keep these complexities in mind when modifying the collection stage in the following methods.
 */
 
-pub(crate) struct CardinalityChangeTracker {
-    // TODO #7138: It is EXCEPTIONALLY memory-greedy and should be optimized / removed from RAM!
-    modified_objects_attribute_types: HashMap<Object, HashSet<AttributeType>>,
-    has_modified_owns: bool,
-    modified_objects_role_types: HashMap<Object, HashSet<RoleType>>,
-    has_modified_plays: bool,
-    modified_relations_role_types: HashMap<Relation, HashSet<RoleType>>,
-    has_modified_relates: bool,
-    players_in_deleted_relations: HashMap<Relation, HashSet<Object>>,
-}
+pub
```

---

### Incident Patch 6: `7cb72682` (2026-09-09)
**Commit Message**: Reduce memory pressure and accelerate database import  (#7955)

## Product change and motivation
  
Importing or migrating a large database no longer grows memory without
bound. Previously, the importer held every reference to a
not-yet-imported instance in memory and, when a heavily shared concept
finally arrived, wrote all of its capabilities in a single commit. On a
multi-GB database, that was tens of millions of parked references plus a
hundreds-of-MB commit, so the server's memory climbed with the dataset.

Import memory is now flat regardless of dataset size (max a few GB), and
a single hot attribute no longer produces an oversized commit.
  
## Implementation
  
- Export attributes first. `DatabaseExporter` now streams attributes,
then entities, then relations (was entities -> relations -> attributes).
Because an owner arrives after its attributes and a relation after its
entity players, an import in stream order defers nothing except role
players that are relations themselves.
- Deferred references spill to disk and drain after the stream. The
remaining "awaiters" are saved to `SpilloverCache`-backed logs instead
of in-memory maps, and applied once the stream ends via a new

**File**: `common/cache/cache.rs` (modified, +120/-2)
```diff
@@ -33,6 +33,17 @@ impl<T: Serialize + DeserializeOwned + Clone> SpilloverCache<T> {
         SpilloverCache { memory_storage: HashMap::new(), disk_storage_path, disk_storage: None, memory_size_limit }
     }
 
+    pub fn into_chunks(mut self, chunk_size: usize) -> SpilloverCacheChunks<T> {
+        assert!(chunk_size > 0, "SpilloverCache chunks must be non-empty");
+        SpilloverCacheChunks {
+            memory: std::mem::take(&mut self.memory_storage).into_iter(),
+            disk_storage: self.disk_storage.take(),
+            disk_storage_path: std::mem::take(&mut self.disk_storage_path),
+            disk_cursor: None,
+            chunk_size,
+        }
+    }
+
     pub fn insert(&mut self, key: String, value: T) -> Result<(), CacheError> {
         self.remove(&key)?;
         match self.memory_storage.len() < self.memory_size_limit {
@@ -68,10 +79,16 @@ impl<T: Serialize + DeserializeOwned + Clone> SpilloverCache<T> {
         self.disk_storage
             .as_mut()
             .unwrap()
-            .put(key, serialized)
+            .put_opt(key, serialized, &Self::write_options())
             .map_err(|source| CacheError::DiskStorageAccess { source })
     }
 
+    fn write_options() -> rocksdb::WriteOptions {
+        let mut options = rocksdb::WriteOptions::default();
+        options.disable_wal(true);
+        options
+    }
+
     fn disk_storage_get(&self, key: &str) -> Result<Option<T>, CacheError> {
         if let Some(disk_storage) = &self.disk_storage {
             if let Some(bytes) = disk_storage.get(key).map_err(|source| CacheError::DiskStorageAccess { source })? {
@@ -99,7 +116,71 @@ impl<T: Serialize + DeserializeOwned + Clone> SpilloverCache<T> {
 
 impl<T: Serialize + DeserializeOwned + Clone> Drop for SpilloverCache<T> {
     fn drop(&mut self) {
-        drop(std::mem::take(&mut self.disk_storage)); // release its files
+        if self.disk_storage_path.as_os_str().is_empty() {
+            return; // consumed by into_chunks: the chunks iterator owns the cleanup
+        }
+        self.disk_storage = None; // release its files before removing the directory
+        if let Err(e) = std::fs::remove_dir_all(&self.disk_storage_path) {
+            // Can be cleaned up by the cache's user
+            event!(Level::TRACE, "Failed to delete a temporary DB directory {:?}: {e}", self.disk_storage_path);
+        }
+    }
+}
+
+pub struct SpilloverCacheChunks<T: Serialize + DeserializeOwned + Clone> {
+    memory: std::collections::hash_map::IntoIter<String, T>,
+    disk_storage: Option<rocksdb::DB>,
+    disk_storage_path: PathBuf,
+    disk_cursor: Option<Vec<u8>>,
+    chunk_size: usize,
+}
+
+impl<T: Serialize + DeserializeOwned + Clone> Iterator for SpilloverCacheChunks<T> {
+    type Item = Result<Vec<(String, T)>, CacheError>;
+
+    fn next(&mut self) -> Option<Self::Item> {
+        let mut chunk = Vec::new();
+
+        while chunk.len() < self.chunk_size {
+            match self.memory.next() {
+                Some(entry) => chunk.push(entry),
+                None => break,
+            }
+        }
+
+        if let Some(disk_storage) = self.disk_storage.as_ref().filter(|_| chunk.len() < self.chunk_size) {
+            let mut iterator = disk_storage.raw_iterator();
+            match &self.disk_cursor {
+                None => iterator.seek_to_first(),
+                Some(cursor) => {
+                    iterator.seek(cursor);
+                    if iterator.valid() && iterator.key() == Some(cursor.as_slice()) {
+                        iterator.next();
+                    }
+                }
+            }
+            while chunk.len() < self.chunk_size && iterator.valid() {
+                let (key, bytes) = (iterator.key().unwrap(), iterator.value().unwrap());
+                let value = match bincode::deserialize(bytes) {
+                    Ok(value) => value,
+                    Err(_) => return Some(Err(CacheError::DiskStorageDeserialization {})),
+       
```

**File**: `compiler/annotation/inference/type_seeder.rs` (modified, +1/-1)
```diff
@@ -532,7 +532,7 @@ impl<'this, Snapshot: ReadableSnapshot> TypeGraphSeedingContext<'this, Snapshot>
                 Constraint::Owns(owns) => edges.push(self.seed_edge(constraint, owns, vertices)?),
                 Constraint::Relates(relates) => edges.push(self.seed_edge(constraint, relates, vertices)?),
                 Constraint::Plays(plays) => edges.push(self.seed_edge(constraint, plays, vertices)?),
-                | Constraint::Iid(_)
+                Constraint::Iid(_)
                 | Constraint::RoleName(_)
                 | Constraint::Label(_)
                 | Constraint::Kind(_)
```

**File**: `compiler/executable/function/executable.rs` (modified, +2/-2)
```diff
@@ -133,8 +133,8 @@ fn compile_return_operation(
         AnnotatedFunctionReturn::Single { selector, variables, .. } => {
             Ok(ExecutableReturn::Single(selector, variables.iter().map(|var| variable_positions[var]).collect()))
         }
-        | AnnotatedFunctionReturn::ReduceCheck {} => Ok(ExecutableReturn::Check),
-        | AnnotatedFunctionReturn::ReduceReducer { instructions } => {
+        AnnotatedFunctionReturn::ReduceCheck {} => Ok(ExecutableReturn::Check),
+        AnnotatedFunctionReturn::ReduceReducer { instructions } => {
             let reductions = instructions.into_iter().map(|reducer| reducer.map(&variable_positions)).collect();
             Ok(ExecutableReturn::Reduce(Arc::new(ReduceRowsExecutable {
                 reductions,
```

**File**: `compiler/executable/match_/instructions/mod.rs` (modified, +2/-2)
```diff
@@ -256,7 +256,7 @@ impl<ID: IrID> ConstraintInstruction<ID> {
         match self {
             Self::Iid(_) => (),
             Self::TypeList(_) => (),
-            | Self::Is(IsInstruction { inputs, .. })
+            Self::Is(IsInstruction { inputs, .. })
             | Self::Sub(type_::SubInstruction { inputs, .. })
             | Self::SubReverse(type_::SubReverseInstruction { inputs, .. })
             | Self::Owns(type_::OwnsInstruction { inputs, .. })
@@ -273,7 +273,7 @@ impl<ID: IrID> ConstraintInstruction<ID> {
             | Self::LinksReverse(thing::LinksReverseInstruction { inputs, .. }) => {
                 inputs.iter().cloned().for_each(apply)
             }
-            | Self::IndexedRelation(thing::IndexedRelationInstruction { inputs, .. }) => {
+            Self::IndexedRelation(thing::IndexedRelationInstruction { inputs, .. }) => {
                 inputs.iter().cloned().for_each(apply)
             }
         }
```

**File**: `compiler/executable/match_/planner/plan.rs` (modified, +1/-1)
```diff
@@ -321,7 +321,7 @@ impl<'a> ConjunctionPlanBuilder<'a> {
             }
             let category = variable_registry.get_variable_category(variable).unwrap();
             match category {
-                | VariableCategory::Type
+                VariableCategory::Type
                 | VariableCategory::ThingType
                 | VariableCategory::AttributeType
                 | VariableCategory::RoleType => self.register_type_var(variable),
```

---

### Incident Patch 7: `df38617c` (2026-08-21)
**Commit Message**: Fix build-breaking formatting (#7925)

## Product change and motivation


## Implementation

**File**: `resource/constants.rs` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ pub mod server {
     pub const GRPC_MAX_MESSAGE_SIZE: usize = GB as usize;
 
     pub const HTTP_MAX_MESSAGE_SIZE: usize = GB as usize;
-  
+
     pub const MAX_CONCURRENT_IMPORTS: usize = 8;
 
     // TODO: Maybe we start moving these options to separate crates?
```

---

### Incident Patch 8: `d3c2c6d7` (2026-08-13)
**Commit Message**: Fix database import blockers on inherited constraints (#7912)

## Product change and motivation

In specific situations, database import could be incorrectly rejected
while relaxing or recovering the schema due to coincidental combinations
of inherited constraints. We fix these cases completely.

### Independent sub attributes

Independent sub attributes could lead to rejects on schema relaxation.
At this stage, every attribute type must become independent so as not to
lose data. However, double redeclarations of such annotations are
prohibited, and an incorrectly working algorithm could produce a schema
like `define attribute name @independent, value string; attribute
surname @independent, sub name;`.

### Ownerships and roleplaying specializations

A similar problem with `owns` and `plays` specializations using the same
interface types (e.g., `define superperson owns name @card(0..); define
person sub superperson, owns name @card(1..);`.

While the algorithm correctly avoided conflicts in declared
cardinalities, it could still have rare conflicts with other
annotations, which, with the change of cardinality-based constraints,
could lead to identical `owns`/`plays` declarations (w

**File**: `database/migration/database_importer.rs` (modified, +38/-36)
```diff
@@ -25,10 +25,8 @@ use concept::{
         thing_manager::ThingManager,
     },
     type_::{
-        Capability, Ordering, OwnerAPI, PlayerAPI,
-        annotation::{
-            AnnotationCardinality, AnnotationCategory, AnnotationIndependent, AnnotationKey, HasAnnotationCategory,
-        },
+        Capability, KindAPI, Ordering, OwnerAPI, PlayerAPI, TypeAPI,
+        annotation::{AnnotationCardinality, AnnotationCategory, AnnotationIndependent, AnnotationKey},
         attribute_type::{AttributeType, AttributeTypeAnnotation},
         constraint::Constraint,
         object_type::ObjectType,
@@ -68,7 +66,7 @@ use crate::{
     with_transaction_parts,
 };
 
-macro_rules! is_specializing_with_only_cardinality_specializations_fn {
+macro_rules! is_specializing_fn {
     (
         $fn_name:ident,
         $capability_ty:ty,
@@ -84,24 +82,13 @@ macro_rules! is_specializing_with_only_cardinality_specializations_fn {
             let cardinalities = object_type
                 .$get_cardinality_method(snapshot, type_manager, interface_type)
                 .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?;
+            // If this capability is affected by multiple cardinality constraints from the same interface type, then
+            // the object type has multiple ownerships of this interface type: some inherited and one declared (specializing)
             let same_interface_type_count = cardinalities
                 .into_iter()
                 .filter(|constraint| constraint.source().interface() == interface_type)
                 .count();
-
-            // If this capability is affected by multiple cardinality constraints from the same interface type, then
-            // the object type has multiple ownerships of this interface type: some inherited and one declared (specializing)
-            if same_interface_type_count > 1 {
-                let non_cardinality_count = capability
-                    .get_annotations_declared(snapshot, type_manager)
-                    .map_err(|typedb_source| DatabaseImportError::ConceptRead { typedb_source })?
-                    .into_iter()
-                    .filter(|annotation| !annotation.has_category(&AnnotationCategory::Cardinality))
-                    .count();
-                Ok(non_cardinality_count == 0)
-            } else {
-                Ok(false)
-            }
+            Ok(same_interface_type_count > 1)
         }
     };
 }
@@ -131,6 +118,7 @@ macro_rules! for_item_in_write_transaction {
 #[derive(Debug)]
 struct SchemaInfo {
     temporarily_independent_attribute_types: HashSet<AttributeType>,
+    temporarily_non_independent_attribute_types: HashSet<AttributeType>,
     temporarily_independent_relation_types: HashSet<RelationType>,
     original_keys: HashSet<Owns>,
     original_cardinalities_owns: HashMap<Owns, Option<AnnotationCardinality>>,
@@ -144,6 +132,7 @@ impl SchemaInfo {
     fn new() -> Self {
         Self {
             temporarily_independent_attribute_types: HashSet::new(),
+            temporarily_non_independent_attribute_types: HashSet::new(),
             temporarily_independent_relation_types: HashSet::new(),
             original_keys: HashSet::new(),
             original_cardinalities_owns: HashMap::new(),
@@ -599,7 +588,7 @@ impl DatabaseImporter {
             TransactionSchema,
             transaction,
             |inner_snapshot, type_manager, thing_manager, _fm, _qm| {
-                self.restore_independent_attribute_types(&mut inner_snapshot, &type_manager)?;
+                self.restore_independent_attribute_types(&mut inner_snapshot, &type_manager, &thing_manager)?;
                 self.restore_independent_relation_types(&mut inner_snapshot, &type_manager)?;
                 self.restore_capabilities_and_cardinalities(&mut inner_snapshot, &type_manager, &thing_manager)?;
             }
@@ -610,6 +599,10 @@ impl DatabaseImporter {
             .map_err(|typedb_source| DatabaseImpor
```

---

### Incident Patch 9: `fb8a70c0` (2026-08-12)
**Commit Message**: Fix add_or_intersect change condition (#7910)

## Product change and motivation
Fixes the condition that determines whether add_or_intersect changed the type annotations of the vertex

**File**: `compiler/annotation/inference/match_inference.rs` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ impl VertexAnnotations {
         if let Some(existing_annotations) = self.get_mut(vertex) {
             let size_before = existing_annotations.len();
             existing_annotations.retain(|x| new_annotations.contains(x));
-            existing_annotations.len() == size_before
+            existing_annotations.len() != size_before
         } else {
             self.insert(vertex.clone(), new_annotations.into_owned());
             true
```

---

### Incident Patch 10: `378983cc` (2026-08-05)
**Commit Message**: DefinitionKey holds Prefix & DefinitionID instead of raw bytes (#7896)

## Implementation
Refactor `DefinitionKey` struct to hold Prefix & DefinitionID instead of raw bytes, in line with other stored objects.

**File**: `compiler/annotation/type_inference.rs` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ pub mod tests {
         let (with_no_cache, with_local_cache, _with_schema_cache) = [
             FunctionID::Preamble(0),
             FunctionID::Preamble(0),
-            FunctionID::Schema(DefinitionKey::build(Prefix::DefinitionFunction, DefinitionID::build(0))),
+            FunctionID::Schema(DefinitionKey::new(Prefix::DefinitionFunction, DefinitionID::new(0))),
         ]
         .iter()
         .map(|function_id| {
```

**File**: `concept/type_/type_manager/type_reader.rs` (modified, +2/-2)
```diff
@@ -109,7 +109,7 @@ impl TypeReader {
         let bytes = snapshot
             .get(index_key.into_storage_key().as_reference(), StorageCounters::DISABLED)
             .map_err(|source| Box::new(ConceptReadError::SnapshotGet { source }))?;
-        Ok(bytes.map(|value| DefinitionKey::new(Bytes::Array(value))))
+        Ok(bytes.map(|value| DefinitionKey::decode(Bytes::Array(value))))
     }
 
     pub(crate) fn get_struct_definition(
@@ -137,7 +137,7 @@ impl TypeReader {
                 StorageCounters::DISABLED,
             )
             .collect_cloned_hashmap(|key, value| {
-                (DefinitionKey::new(Bytes::Array(key.bytes().into())), StructDefinition::from_bytes(value))
+                (DefinitionKey::decode(Bytes::Array(key.bytes().into())), StructDefinition::from_bytes(value))
             })
             .map_err(|source| Box::new(ConceptReadError::SnapshotIterate { source }))
     }
```

**File**: `concept/type_/type_manager/type_writer.rs` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ impl<Snapshot: WritableSnapshot> TypeWriter<Snapshot> {
         struct_definition: StructDefinition,
     ) {
         let index_key = NameToStructDefinitionIndex::build(struct_definition.name.as_str());
-        snapshot.put_val(index_key.into_storage_key().into_owned_array(), ByteArray::copy(definition_key.bytes()));
+        snapshot.put_val(index_key.into_storage_key().into_owned_array(), ByteArray::copy(&definition_key.bytes()));
         snapshot.insert_val(
             definition_key.into_storage_key().into_owned_array(),
             struct_definition.into_bytes().unwrap().into_array(),
```

**File**: `encoding/graph/common/schema_id_allocator.rs` (modified, +2/-2)
```diff
@@ -140,11 +140,11 @@ impl SchemaID for DefinitionKey {
 
     fn object_from_id(prefix: Prefix, id: u64) -> Self {
         debug_assert!((Self::MIN_ID..=Self::MAX_ID).contains(&id));
-        DefinitionKey::build(prefix, DefinitionID::build(id as DefinitionIDUInt))
+        DefinitionKey::new(prefix, DefinitionID::new(id as DefinitionIDUInt))
     }
 
     fn id_from_key(key: StorageKey<'_, BUFFER_KEY_INLINE>) -> u64 {
-        DefinitionKey::new(Bytes::reference(key.bytes())).definition_id().as_uint() as u64
+        DefinitionKey::decode(Bytes::reference(key.bytes())).definition_id().as_uint() as u64
     }
 
     fn ids_exhausted_error(prefix: Prefix) -> EncodingError {
```

**File**: `encoding/graph/definition/definition_key.rs` (modified, +30/-31)
```diff
@@ -6,7 +6,7 @@
 
 use std::{fmt, ops::Range};
 
-use bytes::{Bytes, byte_array::ByteArray};
+use bytes::{Bytes, byte_array::ByteArray, util::HexBytesFormatter};
 use resource::constants::{encoding::DefinitionIDUInt, snapshot::BUFFER_KEY_INLINE};
 use serde::{
     Deserialize, Deserializer, Serialize, Serializer,
@@ -21,7 +21,8 @@ use crate::{
 
 #[derive(Clone, Debug, PartialEq, Eq, Hash, Ord, PartialOrd)]
 pub struct DefinitionKey {
-    bytes: ByteArray<BUFFER_KEY_INLINE>,
+    prefix: Prefix,
+    definition_id: DefinitionID,
 }
 
 impl DefinitionKey {
@@ -33,20 +34,20 @@ impl DefinitionKey {
     pub(crate) const RANGE_DEFINITION_ID: Range<usize> =
         Self::INDEX_PREFIX + 1..Self::INDEX_PREFIX + 1 + DefinitionID::LENGTH;
 
-    pub fn new(bytes: Bytes<'_, BUFFER_KEY_INLINE>) -> Self {
-        debug_assert_eq!(bytes.length(), Self::LENGTH);
-        Self { bytes: ByteArray::copy(&bytes) }
+    pub fn new(prefix: Prefix, definition_id: DefinitionID) -> Self {
+        Self { prefix, definition_id }
     }
 
-    pub fn definition_id(&self) -> DefinitionID {
-        DefinitionID::new(self.bytes[Self::RANGE_DEFINITION_ID].try_into().unwrap())
+    pub fn decode(bytes: Bytes<'_, BUFFER_KEY_INLINE>) -> Self {
+        debug_assert_eq!(bytes.length(), Self::LENGTH);
+        Self {
+            prefix: Prefix::from_prefix_id(PrefixID::new(bytes[Self::INDEX_PREFIX])).unwrap(),
+            definition_id: DefinitionID::decode(bytes[Self::RANGE_DEFINITION_ID].try_into().unwrap()),
+        }
     }
 
-    pub fn build(prefix: Prefix, definition_id: DefinitionID) -> Self {
-        let mut array = ByteArray::zeros(Self::LENGTH);
-        array[Self::INDEX_PREFIX] = prefix.prefix_id().byte;
-        array[Self::RANGE_DEFINITION_ID].copy_from_slice(&definition_id.bytes());
-        Self { bytes: array }
+    pub fn definition_id(&self) -> DefinitionID {
+        self.definition_id
     }
 
     pub fn build_prefix(prefix: Prefix) -> StorageKey<'static, { DefinitionKey::LENGTH_PREFIX }> {
@@ -57,14 +58,17 @@ impl DefinitionKey {
         )
     }
 
-    pub fn bytes(&self) -> &[u8] {
-        &self.bytes
+    pub fn bytes(&self) -> [u8; Self::LENGTH] {
+        let mut array = [0; 3];
+        array[Self::INDEX_PREFIX] = self.prefix.prefix_id().byte;
+        array[Self::RANGE_DEFINITION_ID].copy_from_slice(&self.definition_id.bytes());
+        array
     }
 }
 
 impl AsBytes<BUFFER_KEY_INLINE> for DefinitionKey {
     fn to_bytes(self) -> Bytes<'static, BUFFER_KEY_INLINE> {
-        Bytes::Array(self.bytes)
+        Bytes::Array(ByteArray::copy(&self.bytes()))
     }
 }
 
@@ -78,38 +82,33 @@ impl Prefixed<BUFFER_KEY_INLINE> for DefinitionKey {}
 
 impl fmt::Display for DefinitionKey {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
-        // we'll just arbitrarily write it out as an u64 in Big Endian
-        debug_assert!(self.bytes.len() < (u64::BITS / 8) as usize);
-        let mut bytes = [0u8; (u64::BITS / 8) as usize];
-        bytes[0..self.bytes.len()].copy_from_slice(&self.bytes);
-        let as_u64 = u64::from_be_bytes(bytes);
-        write!(f, "{}", as_u64)
+        write!(f, "{:?}", &HexBytesFormatter::borrowed(&self.bytes()))
     }
 }
 
-#[derive(Debug, Copy, Clone, PartialEq, Eq)]
+#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Ord, PartialOrd)]
 pub struct DefinitionID {
-    bytes: [u8; DefinitionID::LENGTH],
+    id: u16,
 }
 
 impl DefinitionID {
     pub(crate) const LENGTH: usize = std::mem::size_of::<DefinitionIDUInt>();
 
-    pub fn new(bytes: [u8; DefinitionID::LENGTH]) -> DefinitionID {
-        DefinitionID { bytes }
+    pub fn decode(bytes: [u8; Self::LENGTH]) -> DefinitionID {
+        DefinitionID { id: DefinitionIDUInt::from_be_bytes(bytes) }
     }
 
-    pub fn build(id: DefinitionIDUInt) -> Self {
+    pub fn new(id: DefinitionIDUInt) -> Self {
         debug_assert_eq!(std::mem::size_of_val(&id), DefinitionID::LENGTH);
-        DefinitionID { bytes: id.to_be_bytes() 
```

#### Recent Merged Pull Requests:
- **PR #7998** (2026-09-30): Reduce storage lookups and heap allocations for @card validations (@farost)
- **PR #7997** (2026-09-28): Don't clean up new, independent relations without players (@flyingsilverfin)
- **PR #7996** (2026-09-29): Introduce BTreeMapIntersectionIterator to use in isolation validation (@krishnangovindraj)
- **PR #7994** (2026-09-30): Upgrade Write::Put known_to_exist to 3 values, use when putting edges (@krishnangovindraj)
- **PR #7993** (2026-09-28): Fix max and min object type prefixes (@farost)
- **PR #7992** (2026-09-25): Optimize commit locking for capabilities (@farost)
- **PR #7990** (closed): Check disjointness to skip loops in during isolation checks (@flyingsilverfin)
- **PR #7987** (2026-09-22): Remove circleci synchronization to benchmark repo (@flyingsilverfin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
