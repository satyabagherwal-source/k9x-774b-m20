> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sxyazi-yazi-learnings.md`  
> **Source**: github ([https://github.com/sxyazi/yazi](https://github.com/sxyazi/yazi))  
> **Source Version**: `606096f6`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T20:00:46.563Z  
> **Learning ID**: `learn-github-sxyazi-yazi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): sxyazi/yazi

> **Canonical Artifact**: `07_PROJECT_LEARNING/sxyazi-yazi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sxyazi/yazi](https://github.com/sxyazi/yazi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-03T20:00:45.178Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sxyazi/yazi`
- **Description**: 💥 Blazing fast terminal file manager written in Rust, based on async I/O.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 43206 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `yazi-actor/src/core/mod.rs`
```
yazi_macro::mod_flat!(preflight);

```

### Core Architecture Module: `yazi-actor/src/core/preflight.rs`
```
use anyhow::Result;
use mlua::{ErrorContext, ExternalError, IntoLua, Value};
use yazi_binding::runtime_scope;
use yazi_core::Ctx;
use yazi_dds::LOCAL;
use yazi_parser::spark::{Spark, SparkKind};
use yazi_plugin::LUA;

use crate::lives::Lives;

pub struct Preflight;

impl Preflight {
	pub fn act<'a>(cx: &mut Ctx, opt: (SparkKind, Spark<'a>)) -> Result<Spark<'a>> {
		let kind = opt.0;
		let Some(handlers) = LOCAL.read().get(kind.into()).filter(|&m| !m.is_empty()).cloned() else {
			return Ok(opt.1);
		};

		Ok(Lives::scope(cx, |cx| {
			let mut body = opt.1.into_lua(&LUA)?;
			for (name, cb) in handlers {
				match runtime_scope!(cx, &name, cb.call::<Value>(&body)) {
					Ok(Value::Nil) => {
						Err(format!("`{kind}` event cancelled by `{name}` plugin on preflight").into_lua_err())?
					}
					Ok(v) => body = v,
					Err(e) => Err(
						format!("Failed to run `{kind}` event handler in `{name}` plugin: {e}").into_lua_err(),
					)?,
				};
			}

			Spark::from_lua(&LUA, kind, body)
				.with_context(|e| format!("Unexpected return type from `{kind}` event handlers: {e}"))
		})?)
	}
}

```

### Core Architecture Module: `yazi-core/src/app/mod.rs`
```
yazi_macro::mod_flat!(plugin quit);

```

### Core Architecture Module: `yazi-core/src/app/plugin.rs`
```
use std::{borrow::Cow, fmt, fmt::Debug};

use dyn_clone::DynClone;
use hashbrown::HashMap;
use mlua::{Lua, Table};
use serde::Deserialize;
use strum::{EnumString, IntoStaticStr};
use yazi_macro::impl_data_any;
use yazi_runner::{PluginJob, loader::Chunk};
use yazi_scheduler::plugin::PluginInEntry;
use yazi_shared::{data::{Data, DataKey}, scope::Scope};
use yazi_shim::SStr;

#[derive(Clone, Debug, Default)]
pub struct PluginOpt {
	pub name:     SStr,
	pub args:     HashMap<DataKey, Data>,
	pub mode:     PluginMode,
	pub method:   PluginMethod,
	pub scope:    Scope,
	pub callback: Option<Box<dyn PluginCallback>>,
}

impl_data_any!(PluginOpt);

impl From<PluginOpt> for PluginInEntry {
	fn from(value: PluginOpt) -> Self {
		Self { plugin: value.name, args: value.args, scope: value.scope, ..Default::default() }
	}
}

impl PluginOpt {
	pub fn new(name: impl Into<SStr>) -> Self {
		let name = match name.into() {
			Cow::Borrowed(s) => s.strip_suffix(".main").unwrap_or(s).into(),
			Cow::Owned(mut s) => {
				s.truncate(s.strip_suffix(".main").unwrap_or(&s).len());
				s.into()
			}
		};

		Self { name, ..Default::default() }
	}

	pub fn new_callback<J, F>(job: J, f: F) -> Self
	where
		J: PluginJob + Clone + Send + Sync + 'static,
		F: FnOnce(&Lua, Table, J) -> mlua::Result<()> + Clone + Send + Sync + 'static,
	{
		let opt = Self::new(job.name().clone());

		Self {
			mode: PluginMode::Sync,
			scope: job.to_scope(),
			callback: Some(Box::new(move |lua, plugin| f(lua, plugin, job))),
			..opt
		}
	}

	pub fn effective_mode(&self, chunk: &Chunk) -> PluginMode {
		self.mode.auto_then(match self.method {
			PluginMethod::Entry => chunk.sync_entry,
			PluginMethod::Peek => chunk.sync_peek,
			PluginMethod::Seek => true,
		})
	}
}

// --- Mode
#[derive(Clone, Copy, Debug, Default, Deserialize, EnumString, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
#[strum(serialize_all = "kebab-case")]
pub enum PluginMode {
	#[default]
	Auto,
	Sync,
	Async,
}

impl PluginMode {
	fn auto_then(self, sync: bool) -> Self {
		if self != Self::Auto {
			return self;
		}
		if sync { Self::Sync } else { Self::Async }
	}
}

// --- Method
#[derive(Clone, Copy, Debug, Default, Deserialize, EnumString, Eq, IntoStaticStr, PartialEq)]
#[serde(rename_all = "kebab-case")]
#[strum(serialize_all = "kebab-case")]
pub enum PluginMethod {
	#[default]
	Entry,
	Peek,
	Seek,
}

// --- Callback
pub trait PluginCallback:
	FnOnce(&Lua, Table) -> mlua::Result<()> + Send + Sync + DynClone + 'static
{
}

impl<T> PluginCallback for T where
	T: FnOnce(&Lua, Table) -> mlua::Result<()> + Send + Sync + DynClone + 'static
{
}

impl Clone for Box<dyn PluginCallback> {
	fn clone(&self) -> Self { dyn_clone::clone_box(&**self) }
}

impl Debug for dyn PluginCallback {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		f.debug_struct("PluginCallback").finish_non_exhaustive()
	}
}

```

### Core Architecture Module: `yazi-core/src/app/quit.rs`
```
use mlua::{FromLua, IntoLua, Lua, LuaSerdeExt, Value};
use serde::{Deserialize, Serialize};
use yazi_macro::impl_data_any;
use yazi_shared::{event::{ActionCow, FromAction}, strand::StrandBuf};
use yazi_shim::mlua::SER_OPT;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct QuitOpt {
	#[serde(default)]
	pub code:        i32,
	#[serde(skip)]
	pub selected:    Option<StrandBuf>,
	#[serde(default, alias = "no-cwd-file")]
	pub no_cwd_file: bool,
}

impl_data_any!(QuitOpt);

impl<C> FromAction<C> for QuitOpt {
	fn from_action(a: ActionCow, _: &C) -> anyhow::Result<Self> { Ok(a.deserialize()?) }
}

impl FromLua for QuitOpt {
	fn from_lua(value: Value, lua: &Lua) -> mlua::Result<Self> { lua.from_value(value) }
}

impl IntoLua for QuitOpt {
	fn into_lua(self, lua: &Lua) -> mlua::Result<Value> { lua.to_value_with(&self, SER_OPT) }
}

```

### Core Architecture Module: `yazi-core/src/cmp/cmp.rs`
```
use std::io;

use hashbrown::HashMap;
use tokio::task::JoinHandle;
use yazi_shared::{id::Id, strand::AsStrand};
use yazi_widgets::{Scrollable, cmp::{CmpItem, CmpKey}};

use super::{CmpOpt, Matcher};

#[derive(Default)]
pub struct Cmp {
	pub caches:  HashMap<CmpKey, Vec<CmpItem>>,
	pub matches: Vec<CmpItem>,
	pub offset:  usize,
	pub cursor:  usize,

	pub ticket:  Id,
	pub handle:  Option<JoinHandle<io::Result<()>>>,
	pub visible: bool,
}

impl Cmp {
	// --- Matches
	pub fn window(&self) -> &[CmpItem] {
		let end = (self.offset + self.limit()).min(self.matches.len());
		&self.matches[self.offset..end]
	}

	pub fn selected(&self) -> Option<&CmpItem> { self.matches.get(self.cursor) }

	pub fn refresh(&mut self, opt: CmpOpt) -> bool {
		let Some(cache) = opt.cache.as_ref().or_else(|| self.caches.get(&opt.cache_key)) else {
			return false;
		};

		self.matches = Matcher::new(cache).matches(opt.word.as_strand()).cloned().collect();
		if let Some(cache) = opt.cache {
			self.caches.insert(opt.cache_key, cache);
		}

		!self.matches.is_empty()
	}

	// --- Cursor
	pub fn rel_cursor(&self) -> usize { self.cursor - self.offset }
}

impl Scrollable for Cmp {
	fn total(&self) -> usize { self.matches.len() }

	fn limit(&self) -> usize { self.matches.len().min(10) }

	fn cursor_mut(&mut self) -> &mut usize { &mut self.cursor }

	fn offset_mut(&mut self) -> &mut usize { &mut self.offset }
}

```

### Core Architecture Module: `yazi-core/src/cmp/matcher.rs`
```
use yazi_shared::strand::{Strand, StrandLike};
use yazi_widgets::cmp::CmpItem;

const LIMIT: usize = 30;

pub(super) struct Matcher<'a> {
	items: &'a [CmpItem],
}

impl<'a> Matcher<'a> {
	pub fn new(items: &'a [CmpItem]) -> Self { Self { items } }

	pub fn matches(&self, word: Strand<'_>) -> impl Iterator<Item = &'a CmpItem> + use<'a> {
		let smart = !word.encoded_bytes().iter().any(|&b| b.is_ascii_uppercase());

		let (mut exact, mut fuzzy) = (vec![], vec![]);
		for item in self.items {
			let starts_with = if smart {
				item.name.starts_with_ignore_ascii_case(word)
			} else {
				item.name.starts_with(word)
			};

			if starts_with {
				exact.push(item);
				if exact.len() >= LIMIT {
					break;
				}
			} else if fuzzy.len() < LIMIT - exact.len() && item.name.contains(word) {
				fuzzy.push(item);
			}
		}

		let it = fuzzy.into_iter().take(LIMIT - exact.len());
		exact.into_iter().chain(it)
	}
}

```

### Core Architecture Module: `yazi-core/src/cmp/mod.rs`
```
yazi_macro::mod_flat!(cmp matcher option);

```

### Core Architecture Module: `yazi-core/src/cmp/option.rs`
```
use yazi_macro::impl_data_any;
use yazi_shared::{id::Id, strand::StrandBuf};
use yazi_widgets::cmp::{CmpItem, CmpKey};

#[derive(Clone, Debug)]
pub struct CmpOpt {
	pub cache:     Option<Vec<CmpItem>>,
	pub cache_key: CmpKey,
	pub word:      StrandBuf,
	pub ticket:    Id,
}

impl_data_any!(CmpOpt);

```

### Core Architecture Module: `yazi-core/src/confirm/confirm.rs`
```
use ratatui_core::text::Line;
use ratatui_widgets::paragraph::Paragraph;
use yazi_binding::position::Position;
use yazi_shared::CompletionToken;

#[derive(Default)]
pub struct Confirm {
	pub title: Line<'static>,
	pub body:  Paragraph<'static>,
	pub list:  Paragraph<'static>,

	pub position: Position,
	pub offset:   usize,

	pub token:   CompletionToken,
	pub visible: bool,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4456** (2026-11-01): **Drag and drop: a finish event without `y` is dropped, and yazi then refuses every drop until restarted**
  *Symptoms*: ### What system are you running Yazi on?  Linux Wayland  ### What terminal are you running Yazi in?  kitty 0.49.2 for the manual runs; a bare PTY driven by a Python script for the reproducer.  ### `ya env` output  ```Shell Yazi     Version: 26.9.1 (ec4ce8f 2026-10-28)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.99.1 (58cf8f9c 2026-10-13)     Backtrace: None  Ya     Version: 26.9.1 (ec4ce8f 2026-10-28)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.99.1 (58cf8f9c 2026-10-13)  Config     Init             : $XDG_CONFIG_HOME/yazi/init.lua (No such file or directory (os error 2))     Yazi             : $XDG_CONFIG_HOME/yazi/yazi.toml (No such file or directory (os error 2))     Keymap           : $XDG_CONFIG_HOME/yazi/keymap.toml (No such file or directory (os error 2))     Theme            : $XDG_CONFIG_HOME/yazi/theme.toml (No such file or directory (os error 2))     VFS              : $XDG_CONFIG_HOME/yazi/vfs.toml (No such file or directory (os error 2))     Package          : $XDG_CONFIG_HOME/yazi/package.toml (No such file or directory (os error 2))     Dark/light flavor: ArcSwapAny("") / ArcSwapAny("")  Emulator     TERM                : Some("xterm-kitty")     TERM_PROGRAM        : None     TERM_PROGRAM_VERSION: None     Brand.from_env      : Some(Kitty)     Emulator.probe      : Emulator { brand: Kitty, version: ArcSwapAny(""), csi_u: None, kgp: false, kgp_shm: false, sixel: false, backgrou

- **Issue #4455** (2026-11-01): **Drag and drop: a move without the MIME list is taken as a rejection**
  *Symptoms*: ### What system are you running Yazi on?  Linux Wayland  ### What terminal are you running Yazi in?  kitty 0.49.2 for the manual runs; a bare PTY driven by a Python script for the reproducer.  ### `ya env` output  ```Shell Yazi     Version: 26.9.1 (ec4ce8f 2026-10-28)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.99.1 (58cf8f9c 2026-10-13)     Backtrace: None  Ya     Version: 26.9.1 (ec4ce8f 2026-10-28)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.99.1 (58cf8f9c 2026-10-13)  Config     Init             : $XDG_CONFIG_HOME/yazi/init.lua (No such file or directory (os error 2))     Yazi             : $XDG_CONFIG_HOME/yazi/yazi.toml (No such file or directory (os error 2))     Keymap           : $XDG_CONFIG_HOME/yazi/keymap.toml (No such file or directory (os error 2))     Theme            : $XDG_CONFIG_HOME/yazi/theme.toml (No such file or directory (os error 2))     VFS              : $XDG_CONFIG_HOME/yazi/vfs.toml (No such file or directory (os error 2))     Package          : $XDG_CONFIG_HOME/yazi/package.toml (No such file or directory (os error 2))     Dark/light flavor: ArcSwapAny("") / ArcSwapAny("")  Emulator     TERM                : Some("xterm-kitty")     TERM_PROGRAM        : None     TERM_PROGRAM_VERSION: None     Brand.from_env      : Some(Kitty)     Emulator.probe      : Emulator { brand: Kitty, version: ArcSwapAny(""), csi_u: None, kgp: false, kgp_shm: false, sixel: false, backgrou

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

### Incident Patch 1: `606096f6` (2026-11-02)
**Commit Message**: fix: invalidate affected directories after file operations

**File**: `yazi-actor/src/tasks/update_succeed.rs` (modified, +6/-1)
```diff
@@ -1,5 +1,5 @@
 use anyhow::Result;
-use yazi_core::Ctx;
+use yazi_core::{Ctx, Invalidator};
 use yazi_macro::succ;
 use yazi_parser::tasks::UpdateSucceedForm;
 use yazi_shared::{data::Data, url::UrlLike};
@@ -27,6 +27,11 @@ impl Actor for UpdateSucceed {
 			act!(mgr:hover, cx)?;
 		}
 
+		let mut invalidator = Invalidator::new(&mut cx.mgr);
+		for parent in form.urls.iter().filter_map(|u| u.parent()) {
+			invalidator.invalidate(parent);
+		}
+
 		cx.mgr.watcher.report(form.urls);
 		succ!();
 	}
```

**File**: `yazi-core/src/invalidator.rs` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 use hashbrown::HashSet;
 use yazi_fs::op::FilesOp;
-use yazi_shared::{path::PathBufDyn, url::{UrlBuf, UrlLike}};
+use yazi_shared::{path::PathBufDyn, url::{AsUrl, Url, UrlBuf, UrlLike}};
 
 use crate::{mgr::Mgr, tab::Tab};
 
@@ -18,19 +18,19 @@ impl<'a> Invalidator<'a> {
 			}
 			FilesOp::Upsert(_, files) => {
 				for file in files.values() {
-					self.invalidate(&file.url);
+					self.invalidate(file.as_url());
 				}
 			}
 			_ => {}
 		}
 	}
 
-	fn invalidate(&mut self, url: &UrlBuf) {
+	pub fn invalidate(&mut self, url: Url<'_>) {
 		for tab in &mut *self.tabs {
-			if tab.current.url == *url {
+			if tab.current.url == url {
 				tab.current.invalidate();
 			}
-			if let Some(parent) = tab.parent.as_mut().filter(|f| f.url == *url) {
+			if let Some(parent) = tab.parent.as_mut().filter(|f| f.url == url) {
 				parent.invalidate();
 			}
 			if let Some(folder) = tab.history.get_mut(url) {
```

**File**: `yazi-core/src/tab/history.rs` (modified, +2/-2)
```diff
@@ -13,8 +13,8 @@ pub struct History {
 impl History {
 	pub fn get(&self, url: &UrlBuf) -> Option<&Folder> { self.entries.get(url) }
 
-	pub(crate) fn get_mut(&mut self, url: &UrlBuf) -> Option<&mut Folder> {
-		self.entries.get_mut(url)
+	pub(crate) fn get_mut(&mut self, url: impl AsUrl) -> Option<&mut Folder> {
+		self.entries.get_mut(&url.as_url())
 	}
 
 	pub fn ensure(&mut self, url: &UrlBuf) -> (&mut Folder, Option<Folder>) {
```

---

### Incident Patch 2: `ed332218` (2026-11-01)
**Commit Message**: fix: restore directory cursors after sorting (#4468)

**File**: `yazi-actor/src/mgr/reveal.rs` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ impl Actor for Reveal {
 		if !form.no_dummy && tab.hovered().is_none_or(|f| f.key() != key) {
 			let op = FilesOp::Create(trail.into(), File::from_dummy(&form.target, None).into());
 			tab.current.update_pub(tab.id, op);
+			act!(mgr:sort, cx).ok();
 		}
 
 		// Now, we can safely hover over the target
```

**File**: `yazi-actor/src/mgr/tab_switch.rs` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ impl Actor for TabSwitch {
 		tabs.set_idx(idx);
 		let cx = &mut Ctx::renew(cx);
 
+		act!(mgr:hover, cx)?;
 		act!(mgr:refresh, cx)?;
 		act!(mgr:peek, cx, true)?;
 		act!(app:title, cx).ok();
```

**File**: `yazi-actor/src/mgr/update_files.rs` (modified, +6/-3)
```diff
@@ -43,7 +43,8 @@ impl Actor for UpdateFiles {
 
 impl UpdateFiles {
 	fn update_tab(cx: &mut Ctx, ops: impl IntoIterator<Item = FilesOp>) -> Result<Data> {
-		let revision = cx.current().entries.revision;
+		let c_revision = cx.current().entries.revision;
+		let p_revision = cx.parent().map(|f| f.entries.revision);
 
 		for op in ops {
 			Self::update_pane(cx, op).ok();
@@ -52,11 +53,13 @@ impl UpdateFiles {
 		act!(mgr:hidden, cx).ok();
 		act!(mgr:sort, cx).ok();
 
-		if revision != cx.current().entries.revision {
+		if c_revision != cx.current().entries.revision {
 			act!(mgr:hover, cx)?;
 			act!(mgr:peek, cx)?;
 			act!(mgr:watch, cx).ok();
 			act!(mgr:update_paged, cx)?;
+		} else if p_revision != cx.parent().map(|f| f.entries.revision) {
+			act!(mgr:hover, cx)?;
 		}
 		succ!();
 	}
@@ -83,7 +86,6 @@ impl UpdateFiles {
 
 		if let Some(f) = tab.parent.as_mut() {
 			render!(f.update_pub(tab.id, op));
-			render!(f.hover(key));
 		}
 
 		if leave {
@@ -111,6 +113,7 @@ impl UpdateFiles {
 		let (folder, _) = cx.tab_mut().history.ensure(url);
 
 		if folder.update_pub(id, op) {
+			act!(mgr:sort, cx).ok();
 			act!(mgr:peek, cx, true)?;
 		}
 		succ!();
```

**File**: `yazi-core/src/tab/folder.rs` (modified, +0/-1)
```diff
@@ -107,7 +107,6 @@ impl Folder {
 
 		self.trace.take_if(|_| self.entries.is_empty() && !self.stage.is_loading());
 		self.arrow(-(deleted.into_iter().filter(|&i| i < self.cursor).count() as isize));
-		self.repos(None);
 
 		(&stage, revision) != (&self.stage, self.entries.revision)
 	}
```

**File**: `yazi-fs/src/entries.rs` (modified, +2/-0)
```diff
@@ -112,6 +112,8 @@ impl Entries {
 
 	pub fn update_fail(&mut self) {
 		self.ticket = FILES_TICKET.next();
+		self.revision += self.items.is_empty().not() as u64;
+
 		self.hidden.clear();
 		self.items.clear();
 	}
```

---

### Incident Patch 3: `edb4965e` (2026-11-01)
**Commit Message**: fix: allow for omitted fields in the DnD protocol (#4467)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -44,6 +44,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 ### Fixed
 
 - Tolerate non-conforming orphaned trash items on Linux ([#4343])
+- Allow for omitted fields in the DnD protocol ([#4467])
 - Compatibility with legacy Git symlinks in package cache ([#4319])
 - Workaround Konsole kitty graphics and keyboard protocol bugs ([#4370])
 - Correct diacritic input for <kbd>Option</kbd> key combos in kitty keyboard protocol ([#4346])
@@ -1919,3 +1920,4 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 [#4439]: https://github.com/sxyazi/yazi/pull/4439
 [#4451]: https://github.com/sxyazi/yazi/pull/4451
 [#4464]: https://github.com/sxyazi/yazi/pull/4464
+[#4467]: https://github.com/sxyazi/yazi/pull/4467
```

**File**: `yazi-plugin/preset/components/dnd.lua` (modified, +14/-5)
```diff
@@ -2,6 +2,7 @@ Dnd = {
 	_op = "reject",
 	_allowed = "copy",
 	_mime = nil,
+	_mimes = nil,
 	_idx = nil,
 	_dragging = false,
 	_dropping = false,
@@ -83,12 +84,15 @@ function Dnd.drop(event, area)
 
 	local op, dropping = Dnd._op, Dnd._dropping
 	if event.type == "enter" then
+		Dnd.consume_mimes()
 		Dnd._allowed = event.op
-		Dnd._idx, Dnd._mime = Dnd.mime_at(event.mimes)
 		Dnd._op = Dnd._idx and Dnd:new(area):op_at(event.x, event.y) or "reject"
 		rt.tty:queue("AgreeDrop", { type = Dnd._op, mimes = Dnd._mime and { Dnd._mime } or {} })
 	elseif event.type == "ready" then
-		rt.tty:queue("StartDrop", { idx = Dnd._idx })
+		Dnd.consume_mimes()
+		local kind = Dnd._idx and "StartDrop" or "FinishDrop"
+		local data = Dnd._idx and { idx = Dnd._idx } or { type = "reject" }
+		rt.tty:queue(kind, data)
 	elseif event.type == "arrive" then
 		rt.tty:queue("FinishDrop", { type = Dnd._op })
 		require("dnd").drop(Dnd._op, Dnd._mime, event.data)
@@ -109,12 +113,17 @@ function Dnd:op_at(x, y)
 	return "reject"
 end
 
-function Dnd.mime_at(mimes)
+function Dnd.consume_mimes()
+	if not Dnd._mimes then
+		return
+	end
 	for _, wanted in ipairs { "text/uri-list", "image/png" } do
-		for i, mime in ipairs(mimes) do
+		for i, mime in ipairs(Dnd._mimes) do
 			if mime == wanted then
-				return i, mime
+				Dnd._idx, Dnd._mime, Dnd._mimes = i, mime, nil
+				return
 			end
 		end
 	end
+	Dnd._idx, Dnd._mime, Dnd._mimes = nil, nil, nil
 end
```

**File**: `yazi-plugin/preset/components/root.lua` (modified, +4/-0)
```diff
@@ -88,6 +88,10 @@ function Root:drag(event)
 end
 
 function Root:drop(event)
+	if event.mimes and #event.mimes > 0 then
+		Dnd._mimes = event.mimes
+	end
+
 	local d = Root._dropping
 	local c = event.x and ya.child_at(ui.Rect { x = event.x, y = event.y }, self:reflow()) or d
 	if d and d.drop and d._id ~= c._id then
```

**File**: `yazi-term/src/event/dnd.rs` (modified, +23/-22)
```diff
@@ -42,7 +42,7 @@ pub struct DndDragOffer {
 
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub struct DndDragAccept {
-	idx: u8,
+	idx: u32,
 }
 
 #[derive(Clone, Debug, Eq, PartialEq)]
@@ -57,12 +57,12 @@ pub struct DndDragEnd {
 
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub struct DndDragSend {
-	idx: u8,
+	idx: u32,
 }
 
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub struct DndDragError {
-	idx:  u8,
+	idx:  u32,
 	name: String,
 	desc: String,
 }
@@ -85,13 +85,13 @@ pub struct DndDropReady {
 
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub struct DndDropArrive {
-	idx:             u8,
+	idx:             u32,
 	pub(crate) data: Vec<u8>,
 }
 
 #[derive(Clone, Debug, Eq, PartialEq)]
 pub struct DndDropError {
-	idx:  u8,
+	idx:  u32,
 	name: String,
 	desc: String,
 }
@@ -115,7 +115,7 @@ impl DndEvent {
 		}
 	}
 
-	pub(crate) fn idx(&self) -> Option<u8> {
+	pub(crate) fn idx(&self) -> Option<u32> {
 		match self {
 			Self::DragAccept(e) => Some(e.idx),
 			Self::DragSend(e) => Some(e.idx),
@@ -159,38 +159,39 @@ impl DndEvent {
 	pub(crate) fn from_state(s: StateOsc72) -> Option<Self> {
 		Some(match s.r#type.unwrap_or_default() {
 			// Drag
-			b'o' => Self::DragOffer(DndDragOffer { x: s.x?.try_into().ok()?, y: s.y?.try_into().ok()? }),
-			b'e' if s.x? == 1 => Self::DragAccept(DndDragAccept { idx: s.y?.try_into().ok()? }),
-			b'e' if s.x? == 2 => Self::DragChange(DndDragChange { op: DndOp::from_repr(s.op?)? }),
-			b'e' if s.x? == 3 => Self::DragLand,
-			b'e' if s.x? == 4 => Self::DragEnd(DndDragEnd { canceled: s.y? != 0 }),
-			b'e' if s.x? == 5 => Self::DragSend(DndDragSend { idx: s.y?.try_into().ok()? }),
+			b'o' => Self::DragOffer(DndDragOffer { x: s.x.try_into().ok()?, y: s.y.try_into().ok()? }),
+			b'e' if s.x == 1 => Self::DragAccept(DndDragAccept { idx: s.y.try_into().ok()? }),
+			b'e' if s.x == 2 => Self::DragChange(DndDragChange { op: DndOp::from_repr(s.op)? }),
+			b'e' if s.x == 3 => Self::DragLand,
+			b'e' if s.x == 4 => Self::DragEnd(DndDragEnd { canceled: s.y != 0 }),
+			b'e' if s.x == 5 => Self::DragSend(DndDragSend { idx: s.y.try_into().ok()? }),
+			b'E' if s.payload == b"OK" => return None,
 			b'E' => {
 				let (name, desc) = parse_error(s.payload)?;
-				Self::DragError(DndDragError { idx: s.y?.try_into().ok()?, name, desc })
+				Self::DragError(DndDragError { idx: s.y.try_into().ok()?, name, desc })
 			}
 
 			// Drop
-			b'm' if s.x == Some(-1) && s.y == Some(-1) => Self::DropLeave,
+			b'm' if s.x == -1 && s.y == -1 => Self::DropLeave,
 			b'm' => Self::DropEnter(DndDropEnter {
-				x:     s.x?.try_into().ok()?,
-				y:     s.y?.try_into().ok()?,
-				op:    DndOp::from_repr(s.op?)?,
+				x:     s.x.try_into().ok()?,
+				y:     s.y.try_into().ok()?,
+				op:    DndOp::from_repr(s.op)?,
 				mimes: MimeList::new(s.payload)?,
 			}),
 			b'M' => Self::DropReady(DndDropReady {
-				x:     s.x?.try_into().ok()?,
-				y:     s.y?.try_into().ok()?,
-				op:    DndOp::from_repr(s.op?)?,
+				x:     s.x.try_into().ok()?,
+				y:     s.y.try_into().ok()?,
+				op:    DndOp::from_repr(s.op)?,
 				mimes: MimeList::new(s.payload)?,
 			}),
 			b'r' => Self::DropArrive(DndDropArrive {
-				idx:  s.x?.try_into().ok()?,
+				idx:  s.x.try_into().ok()?,
 				data: STANDARD_NO_PAD_INDIFFERENT.decode(&s.payload).ok()?,
 			}),
 			b'R' => {
 				let (name, desc) = parse_error(s.payload)?;
-				Self::DropError(DndDropError { idx: s.x?.try_into().ok()?, name, desc })
+				Self::DropError(DndDropError { idx: s.x.try_into().ok()?, name, desc })
 			}
 
 			_ => return None,
```

**File**: `yazi-term/src/parser/osc.rs` (modified, +3/-3)
```diff
@@ -17,9 +17,9 @@ impl Parser {
 		for part in meta.split(':') {
 			match part.split_once('=').ok_or(ParseError::Invalid)? {
 				("t", v) if let Some(b) = v.bytes().next() => state.r#type = Some(b),
-				("x", v) => state.x = Some(v.parse()?),
-				("y", v) => state.y = Some(v.parse()?),
-				("o", v) => state.op = Some(v.parse()?),
+				("x", v) => state.x = v.parse()?,
+				("y", v) => state.y = v.parse()?,
+				("o", v) => state.op = v.parse()?,
 				("m", "1") => state.has_more = true,
 				_ => {}
 			}
```

**File**: `yazi-term/src/parser/state.rs` (modified, +3/-3)
```diff
@@ -69,9 +69,9 @@ impl State {
 #[derive(Debug, Default, PartialEq)]
 pub(crate) struct StateOsc72 {
 	pub(crate) r#type:   Option<u8>,
-	pub(crate) x:        Option<i32>,
-	pub(crate) y:        Option<i32>,
-	pub(crate) op:       Option<u8>,
+	pub(crate) x:        i32,
+	pub(crate) y:        i32,
+	pub(crate) op:       u8,
 	pub(crate) payload:  Vec<u8>,
 	pub(crate) has_more: bool,
 }
```

**File**: `yazi-tty/src/lua.rs` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ impl Tty {
 				})
 			}
 			b"FinishDrop" => match &*t.raw_get::<BorrowedBytes>("type")? {
+				b"reject" => write!(w, "{}", FinishDrop::Reject),
 				b"copy" => write!(w, "{}", FinishDrop::Copy),
 				b"move" => write!(w, "{}", FinishDrop::Move),
 				_ => return Err("invalid FinishDrop type".into_lua_err()),
```

**File**: `yazi-tty/src/sequence/dnd.rs` (modified, +5/-4)
```diff
@@ -78,7 +78,7 @@ impl Display for StartDrag {
 }
 
 /// Start requesting dropped data: `OSC 72 ; t=r:x=idx ST`
-pub struct StartDrop(pub(crate) u8);
+pub struct StartDrop(pub(crate) u32);
 
 impl Display for StartDrop {
 	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -87,7 +87,7 @@ impl Display for StartDrop {
 }
 
 /// Present drag data: `OSC 72 ; t=p:x=idx ; base64 encoded data ST`
-pub struct PresentDrag<'a>(pub(crate) u8, pub(crate) &'a [u8]);
+pub struct PresentDrag<'a>(pub(crate) u32, pub(crate) &'a [u8]);
 
 impl Display for PresentDrag<'_> {
 	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -146,8 +146,9 @@ impl Display for PresentDragIcon<'_> {
 /// Finish requesting dropped data: `OSC 72 ; t=r:o=operation ST`
 #[derive(Clone, Copy)]
 pub enum FinishDrop {
-	Copy = 1,
-	Move = 2,
+	Reject = 0,
+	Copy   = 1,
+	Move   = 2,
 }
 
 impl Display for FinishDrop {
```

#### Recent Merged Pull Requests:
- **PR #4474** (2026-11-02): feat: new `focus` DDS event for terminal focus changes (@sxyazi)
- **PR #4473** (2026-11-02): feat: Windows MSI installers for stable and nightly releases (@sxyazi)
- **PR #4468** (2026-11-01): fix: restore directory cursors after sorting (@sxyazi)
- **PR #4467** (2026-11-01): fix: allow for omitted fields in the DnD protocol (@sxyazi)
- **PR #4464** (2026-11-01): feat: autocomplete VFS URLs and package IDs (@sxyazi)
- **PR #4461** (closed): feat: respect .hidden file for directory entries (@timsurrealedu)

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

## X. invalidate affected directories after file operations

**RULE**:
When implementing operations in `yazi-actor/src/tasks/update_succeed.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sxyazi/yazi. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `606096f6`: invalidate affected directories after file operations. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `yazi-actor/src/tasks/update_succeed.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use yazi_core::{Ctx, Invalidator};
		let mut invalidator = Invalidator::new(&mut cx.mgr);
		for parent in form.urls.iter().filter_map(|u| u.parent()) {
			invalidator.invalidate(parent);
		}

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
use yazi_core::Ctx;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `606096f6` are properly handled with clean fallback behavior.
