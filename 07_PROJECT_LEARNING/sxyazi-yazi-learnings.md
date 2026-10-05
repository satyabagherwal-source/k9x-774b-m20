# Forensic Learning Record (Deep Inspection): sxyazi/yazi

> **Canonical Artifact**: `07_PROJECT_LEARNING/sxyazi-yazi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sxyazi/yazi](https://github.com/sxyazi/yazi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:09:42.185Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sxyazi/yazi`
- **Description**: 💥 Blazing fast terminal file manager written in Rust, based on async I/O.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 42630 stars

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
use yazi_dds::LOCAL;
use yazi_parser::spark::{Spark, SparkKind};
use yazi_plugin::LUA;

use crate::{Ctx, lives::Lives};

pub struct Preflight;

impl Preflight {
	pub fn act<'a>(cx: &mut Ctx, opt: (SparkKind, Spark<'a>)) -> Result<Spark<'a>> {
		let kind = opt.0;
		let Some(handlers) = LOCAL.read().get(kind.into()).filter(|&m| !m.is_empty()).cloned() else {
			return Ok(opt.1);
		};

		Ok(Lives::scope(cx.core, |_| {
			let mut body = opt.1.into_lua(&LUA)?;
			for (name, cb) in handlers {
				match runtime_scope!(LUA, &name, cb.call::<Value>(&body)) {
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

### Core Architecture Module: `yazi-actor/src/lives/core.rs`
```
use std::ops::Deref;

use mlua::{AnyUserData, IntoLua, LuaString, MetaMethod, UserData, UserDataMethods, UserDataRef, Value};
use paste::paste;

use super::{Lives, PtrCell};

pub(super) type CoreRef = UserDataRef<Core>;

pub(super) struct Core {
	inner: PtrCell<yazi_core::Core>,

	c_active: Option<Value>,
	c_tabs:   Option<Value>,
	c_tasks:  Option<Value>,
	c_yanked: Option<Value>,
	c_input:  Option<Value>,
	c_which:  Option<Value>,
	c_layer:  Option<Value>,
}

impl Deref for Core {
	type Target = yazi_core::Core;

	fn deref(&self) -> &Self::Target { &self.inner }
}

impl Core {
	pub(super) fn make(inner: &yazi_core::Core) -> mlua::Result<AnyUserData> {
		Lives::scoped_userdata(Self {
			inner: inner.into(),

			c_active: None,
			c_tabs:   None,
			c_tasks:  None,
			c_yanked: None,
			c_input:  None,
			c_which:  None,
			c_layer:  None,
		})
	}
}

impl UserData for Core {
	fn add_methods<M: UserDataMethods<Self>>(methods: &mut M) {
		methods.add_meta_method_mut(MetaMethod::Index, |lua, me, key: LuaString| {
			macro_rules! reuse {
				($key:ident, $value:expr) => {
					match paste! { &me.[<c_ $key>] } {
						Some(v) => v.clone(),
						None => {
							let v = $value?.into_lua(lua)?;
							paste! { me.[<c_ $key>] = Some(v.clone()); };
							v
						}
					}
				};
			}
			Ok(match &*key.as_bytes() {
				b"active" => reuse!(active, super::Tab::make(me.active())),
				b"tabs" => reuse!(tabs, super::Tabs::make(&me.mgr.tabs)),
				b"tasks" => reuse!(tasks, super::Tasks::make(&me.tasks)),
				b"yanked" => reuse!(yanked, super::Yanked::make(&me.mgr.yanked)),
				b"input" => reuse!(input, super::Input::make(&me.input)),
				b"which" => reuse!(which, super::Which::make(&me.which)),
				b"layer" => reuse!(layer, Ok::<_, mlua::Error>(me.layer())),
				_ => Value::Nil,
			})
		});
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

use anyhow::bail;
use dyn_clone::DynClone;
use hashbrown::HashMap;
use mlua::{Lua, Table};
use serde::Deserialize;
use strum::{EnumString, IntoStaticStr};
use yazi_binding::Scope;
use yazi_macro::impl_data_any;
use yazi_runner::loader::Chunk;
use yazi_scheduler::plugin::PluginInEntry;
use yazi_shared::{data::{Data, DataKey}, event::{ActionCow, Cmd}};
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

impl TryFrom<ActionCow> for PluginOpt {
	type Error = anyhow::Error;

	fn try_from(mut a: ActionCow) -> Result<Self, Self::Error> {
		let Some(name) = a.take_first::<SStr>().ok().filter(|s| !s.is_empty()) else {
			bail!("plugin name cannot be empty");
		};

		let args = if let Ok(s) = a.second() {
			let (words, last) = yazi_shared::shell::unix::split(s, true)?;
			Cmd::parse_args(words, last)?
		} else {
			a.take_second().unwrap_or_default()
		};

		Ok(Self {
			name: Self::normalize_name(name),
			args,
			mode: a.str("mode").parse().unwrap_or_default(),
			method: a.str("method").parse().unwrap_or_default(),
			scope: a.take_any("scope").unwrap_or_default(),
			callback: a.take_any("callback"),
		})
	}
}

impl From<PluginOpt> for PluginInEntry {
	fn from(value: PluginOpt) -> Self {
		Self { plugin: value.name, args: value.args, ..Default::default() }
	}
}

impl PluginOpt {
	pub fn new_callback(name: impl Into<SStr>, f: impl PluginCallback) -> Self {
		Self {
			name: Self::normalize_name(name.into()),
			mode: PluginMode::Sync,
			callback: Some(Box::new(f)),
			..Default::default()
		}
	}

	pub fn effective_mode(&self, chunk: &Chunk) -> PluginMode {
		self.mode.auto_then(match self.method {
			PluginMethod::Entry => chunk.sync_entry,
			PluginMethod::Peek => chunk.sync_peek,
			PluginMethod::Seek => true,
		})
	}

	fn normalize_name(s: SStr) -> SStr {
		match s {
			Cow::Borrowed(s) => s.strip_suffix(".main").unwrap_or(s).into(),
			Cow::Owned(mut s) => {
				s.truncate(s.strip_suffix(".main").unwrap_or(&s).len());
				s.into()
			}
		}
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
use yazi_shared::{event::ActionCow, strand::StrandBuf};
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

impl TryFrom<ActionCow> for QuitOpt {
	type Error = anyhow::Error;

	fn try_from(a: ActionCow) -> Result<Self, Self::Error> { Ok(a.deserialize()?) }
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
use yazi_shared::{id::Id, url::UrlBuf};
use yazi_widgets::Scrollable;

use crate::cmp::CmpItem;

#[derive(Default)]
pub struct Cmp {
	pub caches:  HashMap<UrlBuf, Vec<CmpItem>>,
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

### Core Architecture Module: `yazi-core/src/cmp/item.rs`
```
use yazi_shared::strand::StrandBuf;

#[derive(Debug, Clone)]
pub struct CmpItem {
	pub name:   StrandBuf,
	pub is_dir: bool,
}

```

### Core Architecture Module: `yazi-core/src/cmp/mod.rs`
```
yazi_macro::mod_flat!(cmp item option);

```

### Core Architecture Module: `yazi-core/src/cmp/option.rs`
```
use yazi_macro::impl_data_any;
use yazi_shared::{id::Id, path::PathBufDyn, url::UrlBuf};

use crate::cmp::CmpItem;

#[derive(Clone, Debug)]
pub struct CmpOpt {
	pub cache:      Vec<CmpItem>,
	pub cache_name: UrlBuf,
	pub word:       PathBufDyn,
	pub ticket:     Id,
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

### Core Architecture Module: `yazi-core/src/confirm/mod.rs`
```
yazi_macro::mod_flat!(confirm);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4381** (2026-09-30): **Kitty Keyboard Protocol broken on Wezterm**
  *Symptoms*: ### What system are you running Yazi on?  Linux Wayland  ### What terminal are you running Yazi in?  wezterm 20260820-095106-770d8e1a  <details> <summary><h3><code>yazi env</code> output</h3></summary>  ```sh Yazi     Version: 26.9.1 (0ea4c5d 2026-09-21)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)     Backtrace: None  Ya     Version: 26.9.1 (0ea4c5d 2026-09-21)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)  Config     Init             : /home/nspc911/.config/yazi/init.lua (No such file or directory (os error 2))     Yazi             : /home/nspc911/.config/yazi/yazi.toml (No such file or directory (os error 2))     Keymap           : /home/nspc911/.config/yazi/keymap.toml (No such file or directory (os error 2))     Theme            : /home/nspc911/.config/yazi/theme.toml (No such file or directory (os error 2))     VFS              : /home/nspc911/.config/yazi/vfs.toml (No such file or directory (os error 2))     Package          : /home/nspc911/.config/yazi/package.toml (No such file or directory (os error 2))     Dark/light flavor: ArcSwapAny("") / ArcSwapAny("")  Emulator     TERM                : Some("xterm-256color")     TERM_PROGRAM        : Some("WezTerm")     TERM_PROGRAM_VERSION: Some("20260820-095106-770d8e1a")     Brand.from_env      : Some(WezTerm)     Emulator.probe      : Emulator { brand: WezTerm, version: ArcSwapAny("WezTe
  **Post-Mortem & Fix Analysis**:
  > Can't reproduce weirdly enough, not sure what happened
  > I can reproduce this on b8973fb (#4346), but not on the latest nightly. #4370 is what fixed it. Maybe the yazi you tested was started before you updated? `ya env` shows the yazi on your PATH, not the currently running instance.
  > I couldn't reproduce this issue on the latest nightly either - <kbd>Esc</kbd>, <kbd>Backspace</kbd> and <kbd>Enter</kbd> all work just fine for me with `enable_kitty_keyboard = true`.  As for the <kbd>Ctrl</kbd> key combination you mentioned, I can confirm this is a bug in WezTerm, and it can be reproduced with `kitten show-key -m kitty`:  ```sh $ kitten show-key -m kitty ctrl+a PRESS a CSI 97 ; 5 ; 97 u ```  Here WezTerm is attaching `"a"` as associated text for <kbd>Ctrl+a</kbd>, which it shouldn't since <kbd>Ctrl+a</kbd> (`\21`) is a non-printable key and should not produce any text on click.   Even if it were printable, it's a control sequence, and the kitty keyboard protocol explicitly prohibits associated text from carrying control sequences. Either way, this would need to be fixed on the WezTerm side.

- **Issue #4373** (2026-09-28): **filter --smart doesn't work with .* regex pattern**
  *Symptoms*: ### What system are you running Yazi on?  Windows  ### What terminal are you running Yazi in?  windows terminal 1.24.11911.0  ### `ya env` output  ```Shell Yazi     Version: 26.9.1 (0ea4c5d 2026-09-21)     Debug  : false     Triple : x86_64-pc-windows-msvc (windows-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)     Backtrace: None  Ya     Version: 26.9.1 (0ea4c5d 2026-09-21)     Debug  : false     Triple : x86_64-pc-windows-msvc (windows-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)  Config     Init             : C:\Users\user\AppData\Roaming\yazi\config\init.lua (1879 chars)     Yazi             : C:\Users\user\AppData\Roaming\yazi\config\yazi.toml (1505 chars)     Keymap           : C:\Users\user\AppData\Roaming\yazi\config\keymap.toml (3788 chars)     Theme            : C:\Users\user\AppData\Roaming\yazi\config\theme.toml (The system cannot find the file specified. (os error 2))     VFS              : C:\Users\user\AppData\Roaming\yazi\config\vfs.toml (134 chars)     Package          : C:\Users\user\AppData\Roaming\yazi\config\package.toml (1804 chars)     Dark/light flavor: ArcSwapAny("") / ArcSwapAny("")  Emulator     TERM                : Some("xterm-256color")     TERM_PROGRAM        : None     TERM_PROGRAM_VERSION: None     Brand.from_env      : Some(Microsoft)     Emulator.probe      : Emulator { brand: Microsoft, version: ArcSwapAny(""), csi_u: None, kgp: false, kgp_shm: false, sixel: true, background: Some([5140, 5140, 5140]), color_scheme: None, csi_16t: (1
  **Post-Mortem & Fix Analysis**:
  > I think I found the cause. Since #4177, `Filter::new` in `yazi-fs/src/filter.rs` normalizes the pattern first and then does the smart-case check on the normalized string. Any pattern containing `.` gets normalized, and `normalize_dot` rewrites each `.` as `(?:.\p{M}*)`. The `M` in `\p{M}` is uppercase, so `te.*` counts as mixed case and the filter becomes case-sensitive. That's why `te` matches `Test1` but `te.` doesn't. A fix could run the uppercase check on the raw pattern `s` (as before #4177) while still building the regex from the normalized one. Until then, `filter --insensitive` should work as a workaround. 

- **Issue #4366** (2026-09-21): **Image previews don't work in Konsole v26.08.1**
  *Symptoms*: ### What system are you running Yazi on?  Linux Wayland  ### What terminal are you running Yazi in?  Konsole v26.08.1  ### `ya env` output  ```Shell Yazi     Version: 26.9.1 (VERGEN_IDEMPOTENT_OUTPUT 2026-09-13)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)     Backtrace: None  Ya     Version: 26.9.1 (VERGEN_IDEMPOTENT_OUTPUT 2026-09-13)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)  Config     Init             : /home/./.config/yazi/init.lua (No such file or directory (os error 2))     Yazi             : /home/./.config/yazi/yazi.toml (No such file or directory (os error 2))     Keymap           : /home/./.config/yazi/keymap.toml (No such file or directory (os error 2))     Theme            : /home/./.config/yazi/theme.toml (31 chars)     VFS              : /home/./.config/yazi/vfs.toml (No such file or directory (os error 2))     Package          : /home/./.config/yazi/package.toml (124 chars)     Dark/light flavor: ArcSwapAny("flexoki-dark") / ArcSwapAny("")  Emulator     TERM                : Some("xterm-256color")     TERM_PROGRAM        : None     TERM_PROGRAM_VERSION: None     Brand.from_env      : Some(Konsole)     Emulator.probe      : Emulator { brand: Konsole, version: ArcSwapAny("Konsole 26.08.1"), csi_u: Some(0), kgp: true, kgp_shm: false, sixel: true, background: Some([8995, 9766, 10023]), color_scheme: None, csi_16t: (8, 18), f
  **Post-Mortem & Fix Analysis**:
  > Hey @gbbb144, thank you for opening the issue to help improve Yazi, appreciate it!  I noticed that you did not correctly follow the issue template. Please ensure that:  - The bug can still be reproduced on the [newest nightly build](https://yazi-rs.github.io/docs/installation/#binaries). - The environment info (`ya env`) is updated for the newest nightly. - The non-optional items in the checklist are checked.  Issues with `needs info` will be marked ready once edited with the proper content, or closed after 2 days of inactivity.  Our maintainers work on Yazi in their free time, this helps them work efficiently, understand your setup quickly, and find a more appropriate solution. Thanks for your understanding! 🙏 
  > Ran into the same thing here. In my case it comes from the flavor, `flexoki-dark` sets a background in `[app] overall`, and removing that line brings the preview back.  Looks like Konsole paints the cell background over a kitty placement with a negative z-index, so I opened a Konsole bug for it. https://bugs.kde.org/show_bug.cgi?id=526031  I tried `z=0` in `KgpOld` here and the preview shows up with the flavor, with the popups still erasing the image underneath. Might be useful as a workaround on the Yazi side

- **Issue #4364** (2026-09-21): **Clipboard plugin name deprecation warning**
  *Symptoms*: ### What system are you running Yazi on?  Linux Wayland  ### What terminal are you running Yazi in?  kitty 0.48.2  ### `ya env` output  ```Shell Yazi     Version: 26.9.1 (Nixpkgs 2026-09-1)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)     Backtrace: None  Ya     Version: 26.9.1 (Nixpkgs 2026-09-1)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)  Config     Init             : /home/maksym/.config/yazi/init.lua (748 chars)     Yazi             : /home/maksym/.config/yazi/yazi.toml (154 chars)     Keymap           : /home/maksym/.config/yazi/keymap.toml (1744 chars)     Theme            : /home/maksym/.config/yazi/theme.toml (5091 chars)     VFS              : /home/maksym/.config/yazi/vfs.toml (No such file or directory (os error 2))     Package          : /home/maksym/.config/yazi/package.toml (No such file or directory (os error 2))     Dark/light flavor: ArcSwapAny("") / ArcSwapAny("")  Emulator     TERM                : Some("xterm-kitty")     TERM_PROGRAM        : None     TERM_PROGRAM_VERSION: None     Brand.from_env      : Some(Kitty)     Emulator.probe      : Emulator { brand: Kitty, version: ArcSwapAny("kitty(0.48.2)"), csi_u: Some(0), kgp: true, kgp_shm: true, sixel: false, background: Some([6425, 8995, 12336]), color_scheme: Some(false), csi_16t: (10, 22), force_16t: false, osc_5522: true, cursor_blink: false, cursor_shape: Some(1), m
  **Post-Mortem & Fix Analysis**:
  > Hey @pavukach, thank you for opening the issue to help improve Yazi, appreciate it!  I noticed that you did not correctly follow the issue template. Please ensure that:  - The bug can still be reproduced on the [newest nightly build](https://yazi-rs.github.io/docs/installation/#binaries). - The environment info (`ya env`) is updated for the newest nightly. - The non-optional items in the checklist are checked.  Issues with `needs info` will be marked ready once edited with the proper content, or closed after 2 days of inactivity.  Our maintainers work on Yazi in their free time, this helps them work efficiently, understand your setup quickly, and find a more appropriate solution. Thanks for your understanding! 🙏 
  > I seem to have some recollection about this issue. Currently, OSC5522 protocol is built into yazi, but it has not been fully implemented yet. For details, please see #4035.  And I think this discussion can solve your problem, the link is as follows:https://github.com/sxyazi/yazi/discussions/4280   In Telegram, the author of this plugin and sxyazi discussed this issue.    This is the corresponding screenshot:  <img width="1372" height="2406" alt="Image" src="https://github.com/user-attachments/assets/bf461e3a-2408-477a-a389-c2c446d572c7" />
  > This issue has been automatically closed because it was marked as `needs info` for more than 2 days without updates. If the problem persists, please file a new issue and complete the issue template so we can capture all the details necessary to investigate further.

- **Issue #4362** (2026-09-19): **`ya.confirm()` hangs indefinitely once a valid `pos` is supplied (Lua plugin API)**
  *Symptoms*: ### What system are you running Yazi on?  macOS  ### What terminal are you running Yazi in?  Wezterm 20260823-230148-f93d9035  ### `ya env` output  ```Shell Yazi     Version: 26.8.15 (1f3588d 2026-08-15)     Debug  : false     Triple : x86_64-apple-darwin (macos-x86_64)     Rustc  : 1.97.1 (8bab26f4 2026-07-14)     Backtrace: None  Ya     Version: 26.8.15 (1f3588d 2026-08-15)     Debug  : false     Triple : x86_64-apple-darwin (macos-x86_64)     Rustc  : 1.97.1 (8bab26f4 2026-07-14)  Config     Init             : /Users/appleplay/.config/yazi/init.lua (373 chars)     Yazi             : /Users/appleplay/.config/yazi/yazi.toml (1260 chars)     Keymap           : /Users/appleplay/.config/yazi/keymap.toml (2398 chars)     Theme            : /Users/appleplay/.config/yazi/theme.toml (41327 chars)     VFS              : /Users/appleplay/.config/yazi/vfs.toml (No such file or directory (os error 2))     Package          : /Users/appleplay/.config/yazi/package.toml (337 chars)     Dark/light flavor: ArcSwapAny("") / ArcSwapAny("")  Emulator     TERM                : Some("xterm-256color")     TERM_PROGRAM        : Some("tmux")     TERM_PROGRAM_VERSION: Some("3.7c")     Brand.from_env      : Some(WezTerm)     Emulator.probe      : Emulator { brand: WezTerm, version: "WezTerm 20260823-230148-f93d9035", csi_u: None, kgp: true, sixel: true, background: Some([7710, 7710, 11822]), color_scheme: Some(false), csi_16t: (6, 14), force_16t: false, osc_5522: false, cursor_blink: true, cursor_shap
  **Post-Mortem & Fix Analysis**:
  > Hey @dominionthedev, thank you for opening the issue to help improve Yazi, appreciate it!  I noticed that you did not correctly follow the issue template. Please ensure that:  - The bug can still be reproduced on the [newest nightly build](https://yazi-rs.github.io/docs/installation/#binaries). - The environment info (`ya env`) is updated for the newest nightly. - The non-optional items in the checklist are checked.  Issues with `needs info` will be marked ready once edited with the proper content, or closed after 2 days of inactivity.  Our maintainers work on Yazi in their free time, this helps them work efficiently, understand your setup quickly, and find a more appropriate solution. Thanks for your understanding! 🙏 

- **Issue #4349** (2026-09-12): **ui.Line:truncate can return a partial grapheme**
  *Symptoms*: ### What system are you running Yazi on?  Linux X11  ### What terminal are you running Yazi in?  Not applicable to the binding-level reproducer: it calls the public Lua binding directly and does not require terminal rasterization.  ### `ya env` output  ```Shell ee [attachments/ya-env.txt](attachments/ya-env.txt). ```  ### Describe the bug  The public `ui.Line:truncate` binding walks individual Unicode code points while accumulating display width. If the limit falls inside an extended grapheme, it can return a suffix such as `👩‍…` or `…́`. Both strings contain a ZWJ or combining component without the rest of the user-visible character.  ### Minimal reproducer  From this report directory, run:  ```sh bash attachments/repro.sh ```  The script invokes the real `yazi-binding::elements::Line` Lua binding. The smallest cases are equivalent to:  ```lua ui.Line("👩‍💻XYZ"):truncate { max = 3 } ui.Line("XYZá"):truncate { max = 1, rtl = true } ```  The first returns `👩‍…`; the second returns `…́`. Three consecutive runs reported the same failing cases. The complete output and checksum are in [attachments/evidence.log](attachments/evidence.log).  ### Anything else?  Truncation may choose to keep less text when a whole cluster does not fit, but it should never return a partial extended grapheme. A result should end before the cluster or include the complete cluster according to the available width.  The audited revision is `b8973fb4c2b9b184aad03cfc717c1fefe4140c40`, the public Yazi `ma
  **Post-Mortem & Fix Analysis**:
  > Hey @N0zoM1z0, thank you for opening the issue to help improve Yazi, appreciate it!  I noticed that you did not correctly follow the issue template. Please ensure that:  - The bug can still be reproduced on the [newest nightly build](https://yazi-rs.github.io/docs/installation/#binaries). - The environment info (`ya env`) is updated for the newest nightly. - The non-optional items in the checklist are checked.  Issues with `needs info` will be marked ready once edited with the proper content, or closed after 2 days of inactivity.  Our maintainers work on Yazi in their free time, this helps them work efficiently, understand your setup quickly, and find a more appropriate solution. Thanks for your understanding! 🙏 
  > This issue has been closed because it violates our [AI Policy](https://github.com/sxyazi/yazi/blob/main/CONTRIBUTING.md#ai-policy).  The project requires human-authored issue descriptions and disclosure, review, and simplification of any AI-assisted work.

- **Issue #4345** (2026-09-12): **Polish (diacritic) characters don’t work correctly in input dialogs since v26.8.15**
  *Symptoms*: ### What system are you running Yazi on?  macOS  ### What terminal are you running Yazi in?  Ghostty  1.3.1  ### `ya env` output  ```Shell Yazi No such file or directory (os error 2)     Backtrace: None  Ya     Version: 26.9.1 (79c9d0a 2026-09-10)     Debug  : false     Triple : aarch64-apple-darwin (macos-aarch64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)  Config     Init             : /Users/maciek/.config/yazi/init.lua (empty)     Yazi             : /Users/maciek/.config/yazi/yazi.toml (71 chars)     Keymap           : /Users/maciek/.config/yazi/keymap.toml (263 chars)     Theme            : /Users/maciek/.config/yazi/theme.toml (No such file or directory (os error 2))     VFS              : /Users/maciek/.config/yazi/vfs.toml (No such file or directory (os error 2))     Package          : /Users/maciek/.config/yazi/package.toml (234 chars)     Dark/light flavor: ArcSwapAny("") / ArcSwapAny("")  Emulator     TERM                : Some("xterm-ghostty")     TERM_PROGRAM        : Some("ghostty")     TERM_PROGRAM_VERSION: Some("1.3.1")     Brand.from_env      : Some(Ghostty)     Emulator.probe      : Emulator { brand: Ghostty, version: ArcSwapAny("ghostty 1.3.1"), csi_u: Some(0), kgp: true, kgp_shm: true, sixel: false, background: Some([7453, 8224, 8481]), color_scheme: Some(false), csi_16t: (10, 20), force_16t: false, osc_5522: false, cursor_blink: true, cursor_shape: Some(1), mux: None, probe: Probe { id: Id(0), completed: false }, started: false }  Adapter     Drivers.match
  **Post-Mortem & Fix Analysis**:
  > Hey @iskeld, thank you for opening the issue to help improve Yazi, appreciate it!  I noticed that you did not correctly follow the issue template. Please ensure that:  - The bug can still be reproduced on the [newest nightly build](https://yazi-rs.github.io/docs/installation/#binaries). - The environment info (`ya env`) is updated for the newest nightly. - The non-optional items in the checklist are checked.  Issues with `needs info` will be marked ready once edited with the proper content, or closed after 2 days of inactivity.  Our maintainers work on Yazi in their free time, this helps them work efficiently, understand your setup quickly, and find a more appropriate solution. Thanks for your understanding! 🙏 
  > Please try https://github.com/sxyazi/yazi/pull/4346
  > It works! Thank you very much!

- **Issue #4333** (2026-09-09): **[ui] Misaligned icon when creating a new file or folder**
  *Symptoms*: ### What system are you running Yazi on?  Linux Wayland  ### What terminal are you running Yazi in?  kitty v0.48.2  ### `ya env` output  ```Shell Version: 26.9.1 (Arch Linux 2026-09-07)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01)     Backtrace: None  Ya     Version: 26.9.1 (Arch Linux 2026-09-07)     Debug  : false     Triple : x86_64-unknown-linux-gnu (linux-x86_64)     Rustc  : 1.98.1 (48a229ce 2026-09-01) ```  ### Describe the bug  When creating a new item we see an icon for its type. It doesn't look aligned properly.  <img width="105" height="67" alt="Image" src="https://github.com/user-attachments/assets/2aa1b269-587e-4054-b52b-458437ec950c" />  I would move it to the right and complete the lines around it.  Thanks  ### Minimal reproducer  - Open yazi - Create new item with 'a'  ### Anything else?  _No response_  ### Checklist  - [x] I tried the [latest nightly build](https://yazi-rs.github.io/docs/installation#binaries), and the issue is still reproducible - [x] I updated the environment information (`ya env`) field to the nightly that I tried - [x] I can reproduce it after disabling all custom configs/plugins (`mv ~/.config/yazi ~/.config/yazi-backup`)
  **Post-Mortem & Fix Analysis**:
  > Hey @stickyburn, thank you for opening the issue to help improve Yazi, appreciate it!  I noticed that you did not correctly follow the issue template. Please ensure that:  - The bug can still be reproduced on the [newest nightly build](https://yazi-rs.github.io/docs/installation/#binaries). - The environment info (`ya env`) is updated for the newest nightly. - The non-optional items in the checklist are checked.  Issues with `needs info` will be marked ready once edited with the proper content, or closed after 2 days of inactivity.  Our maintainers work on Yazi in their free time, this helps them work efficiently, understand your setup quickly, and find a more appropriate solution. Thanks for your understanding! 🙏 
  > This issue has been automatically closed because it was marked as `needs info` for more than 2 days without updates. If the problem persists, please file a new issue and complete the issue template so we can capture all the details necessary to investigate further.

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

### Incident Patch 1: `b95e12e6` (2026-10-03)
**Commit Message**: docs: fix a typo in input snaps comment (#4396)

**File**: `yazi-widgets/src/input/snaps.rs` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ impl InputSnaps {
 		}
 
 		// Sync *current* cursor position to the *last* version:
-		// 		Save offset/cursor/ect. of the *current* as the last version,
+		// 		Save offset/cursor/etc. of the *current* as the last version,
 		// 		while keeping the *last* value unchanged.
 		let value = mem::take(&mut self.versions[self.idx].value);
 		self.versions[self.idx] = self.current.clone();
```

---

### Incident Patch 2: `6b0c56b5` (2026-09-28)
**Commit Message**: fix: check smart case against raw filter input (#4379)

Signed-off-by: GhostCoder6969 <[REDACTED_EMAIL]>
Co-authored-by: 三咲雅 misaki masa <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (modified, +10/-3)
```diff
@@ -15,7 +15,7 @@
 - `key()` identifies a file-list entry; `urn()` is the raw URL path tail. Use `key()` for list state and `urn()` for filesystem-path semantics; do not substitute them mechanically.
 - Reuse established plugin and event names (`fetch`, `preload`, `peek`, `seek`, `spot`, `entry`, `setup`, `yank`, `hover`, and `select`) across Rust, Lua, and configuration.
 - Use Rust prefixes (`as_`, `to_`, `into_`, `try_`, `is_`, `has_`) according to their usual semantics; prefer descriptive names.
-- Name variables, modules, methods, and other symbols simply, elegantly, and expressively. Be creative while keeping names clear, consistent with established terminology, and idiomatic.
+- Name variables, modules, methods, and other symbols simply, elegantly, and expressively. Be creative while keeping names clear, consistent with established terminology, and idiomatic. When equivalent names are available, align the name's natural default with the type's default; for booleans, prefer a name whose `false` value represents the common state (for example, `seekless` when handles normally support seeking), so `Default` and `unwrap_or_default()` do not need special initialization.
 - When passing arguments, use the parameter's conversion traits directly (such as `Into<_>` or `AsRef<_>`); avoid eager conversions like `.to_string()`, `.to_owned()`, and `.as_ref()` unless ownership, type inference, or semantics require them. At Lua boundaries, prefer `LuaString` to `String`, use `BorrowedBytes` when string semantics are unnecessary, and return binding errors as `(nil, error)` alongside a value (or `(false, error)` for no-value operations); successful calls return `(value, nil)` or `(true, nil)`. Reserve direct `Err` returns for invalid API usage that violates the call contract and can be handled with `pcall`.
 - Let Rust infer types whenever the context is sufficient; when an annotation is needed, put it on the binding (`let value: Type = ...`) instead of turbofishing the expression.
 - Prefer methods provided by `UrlLike`, `PathLike`, or `StrandLike` directly on the original value (for example, `buf.parent()` over `buf.as_url().parent()`), rather than converting it first with `as_url()`, `dyn_path()`, or `to_strand()`.
@@ -27,15 +27,22 @@
 - Search and reuse first. Prefer established types, variants, helpers, and data structures over adding new wrappers or abstractions; introduce a new type only when it represents a genuinely distinct responsibility or invariant. For new features, extend existing infrastructure or data structures with general, reusable capabilities when that keeps the final code concise and the total type count small.
 - Use `gh` to read GitHub issues, pull requests, and their discussions.
 - For refactors, inspect the whole target module, its callers, and the surrounding lifecycle first. Understand the system's established assumptions before adding local safeguards; distinguish required invariants from acceptable compromises, and ask when that boundary materially affects the design. Look for duplicated work, redundant I/O, underpowered return values, one-use wrappers, and reusable cross-platform abstractions; implement high-confidence, behavior-preserving simplifications while preserving error, fallback, and platform semantics.
-- Prefer the simplest design that satisfies the requirements. Keep diffs minimal and avoid overengineering, unrelated refactors, speculative abstractions, and defensive handling for states the system already excludes. When conditions are mutually exclusive and have a clear priority, express them as flat, peer-level `if`/`else if`/`else` branches in that priority order; do not compress the state checks into compound predicates merely to deduplicate a small result body. Prefer clear, flat control flow, expressions, and positive predicates; use standard combinators, early returns, ordered branches, and match guards to avoid nested conditionals, compound negation, and unnecessary wrapper syntax. Treat small, deliberate repetition in branch results as a good trade-off when it makes the decision structure easier to understand. Prefer available convenience macros when they simplify the code. When idiomatic and equivalent, prefer visually parallel forms such as `true as usize` over `usize::from(true)`. Comment only behavior the code cannot explain.
-- Keep responsibility boundaries clear and cohesive. Prefer pure functions, explicit invariants, and idempotent operations when repeated calls are natural and idempotency removes coordination or state. Favor convention over configuration when invariants can eliminate state or coordination. Put reusable code in the lowest suitable shared layer; place business-independent adapters and wrappers that mainly compensate for a dependency's limitations in `yazi-shim`, and add that dependency there. Avoid unnecessary dependencies and allocations. Prefer borrowed values and existing wrappers.
+- Prefer the simplest design that satisfies the requirem
```

**File**: `Cargo.lock` (modified, +55/-60)
```diff
@@ -62,7 +62,7 @@ checksum = "bc537ff0e1c48739abe9c70a6208aa8805613be42fe540d67ea28860e9ce3fa3"
 dependencies = [
  "binrw",
  "strum 0.27.2",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "typed-builder",
 ]
 
@@ -91,7 +91,7 @@ dependencies = [
  "ratatui-core",
  "simdutf8",
  "smallvec",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -130,7 +130,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -141,7 +141,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -214,12 +214,6 @@ version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "fd307490d624467aa6f74b0eabb77633d1f758a7b25f12bceb0b22e08d9726f6"
 
-[[package]]
-name = "base64"
-version = "0.22.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
-
 [[package]]
 name = "base64"
 version = "0.23.1"
@@ -459,9 +453,9 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.4.7"
+version = "1.5.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "54413ede23c2daf518f35156dfde027feb2374004d63bd497f983c8db9c0e313"
+checksum = "f360145194ee8e21db5ee7f3fcd4fe52210864c75c985dae33218202c8bbe040"
 dependencies = [
  "find-msvc-tools",
  "shlex",
@@ -892,7 +886,7 @@ version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "10d60334b3b2e7c9d91ef8150abfb6fa4c1c39ebbcf4a81c2e346aad939fee3e"
 dependencies = [
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -965,7 +959,7 @@ dependencies = [
  "libc",
  "option-ext",
  "redox_users",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -989,7 +983,7 @@ dependencies = [
  "binrw",
  "plist",
  "strum 0.28.0",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "typed-builder",
 ]
 
@@ -1104,7 +1098,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "39cab71617ae0d63f51a36d69f866391735b51691dbda63cf6f96d042b63efeb"
 dependencies = [
  "libc",
- "windows-sys 0.61.2",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -1189,9 +1183,9 @@ checksum = "64cd1e32ddd350061ae6edb1b082d7c54915b5c672c389143b9a63403a109f24"
 
 [[package]]
 name = "find-msvc-tools"
-version = "0.1.13"
+version = "0.1.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ef25905e51abafe4dcea6c15fec58c57b601cdbd0ee53d22ea1d3016c587d39b"
+checksum = "aedcfb3409746eddb02b9e19ebda1c3394f759a152e48ee875a0844d1b955484"
 
 [[package]]
 name = "flate2"
@@ -1583,16 +1577,17 @@ dependencies = [
 
 [[package]]
 name = "hyper-util"
-version = "0.1.20"
+version = "0.1.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "96547c2556ec9d12fb1578c4eaf448b04993e7fb79cbaad930a656880a6bdfa0"
+checksum = "ddc03d96684f9226b8a787cdb71488417b53ab5ea8fdb1dac946cb9431cc8bff"
 dependencies = [
- "base64 0.22.1",
+ "base64",
  "bytes",
  "futures-channel",
  "futures-util",
  "http",
  "http-body",
+ "httparse",
  "hyper",
  "ipnet",
  "libc",
@@ -1955,7 +1950,7 @@ dependencies = [
  "jni-sys",
  "log",
  "simd_cesu8",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "walkdir",
  "windows-link",
 ]
@@ -2011,7 +2006,7 @@ checksum = "bde5057d6143cc94e861d90f591b9303d6716c6b9602309150bd068853c10899"
 dependencies = [
  "hashbrown 0.16.1",
  "portable-atomic",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -2125,9 +2120,9 @@ checksum = "f9f8bd3e56ce4dfc153cf470fffbfa98c7620958b312ca5c3a4b8d5181fd13c6"
 
 [[package]]
 name = "lru"
-version = "0.18.4"
+version = "0.18.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ff9840bcc50b71349309900da0ce7279aa336ae71d73250b07998932c7d97c25"
+checksum = "ef9ac18847474e638e3702b76c65d4eb93428471a74778ef0f1be711717f89b5"
 dependencies = [
  "hashbrown 0.17.1",
 ]
@@ -2359,7 +2354,7 @@ version = "0.50.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7957b9740744892f114936ab4a57b3f487491bbeafaf8083688b16841a4240e5"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -2570,7 +2565,7 @@ dependencies = [
  "log",
  "rand 0.10.3",
  "sha2",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "tokio",
  "windows",
  "windows-strings",
@@ -2746,7 +2741,7 @@ version = "1.10.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2896bade328c13f7042a297ea5ac5b0951f6cf989dea5f32c2fd98da398195cb"
 dependencies = [
- "base64 0.23.1",
+ "base64",
  "indexmap 2.14.2",
  "quick-xml",
  "serde",
@@ -3006,7 +3001,7 @@ dependencies = [
  "palette",
  "ser
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -59,7 +59,7 @@ indexmap              = { version = "2.14.2", features = [ "serde" ] }
 inventory             = "0.3.24"
 libc                  = "0.2.189"
 log                   = { version = "0.4.34", features = [ "release_max_level_off" ] }
-lru                   = "0.18.4"
+lru                   = "0.18.5"
 mlua                  = { version = "0.12.1", features = [ "anyhow", "async", "error-send", "lua55", "macros", "serde" ] }
 objc2                 = "0.6.4"
 ordered-float         = { version = "5.5.0", features = [ "serde" ] }
@@ -78,10 +78,10 @@ russh                 = { version = "0.63.3", default-features = false, features
 scopeguard            = "1.2.0"
 serde                 = { version = "1.0.229", features = [ "derive" ] }
 serde_json            = "1.0.151"
-serde_with            = "3.23.0"
+serde_with            = "3.24.0"
 strum                 = { version = "0.28.0", features = [ "derive" ] }
 syntect               = { version = "5.3.0", default-features = false, features = [ "parsing", "plist-load", "regex-onig" ] }
-thiserror             = "2.0.20"
+thiserror             = "2.0.21"
 tokio                 = { version = "1.53.1", features = [ "full" ] }
 tokio-stream          = "0.1.19"
 tokio-util            = "0.7.19"
```

**File**: `yazi-binding/Cargo.toml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ futures         = { workspace = true }
 hashbrown       = { workspace = true }
 http-body-util  = "0.1.5"
 hyper           = { version = "1.11.1", features = [ "client", "http1" ] }
-hyper-util      = { version = "0.1.20", features = [ "tokio" ] }
+hyper-util      = { version = "0.1.21", features = [ "tokio" ] }
 image           = { workspace = true }
 inventory       = { workspace = true }
 mlua            = { workspace = true }
```

**File**: `yazi-fs/src/filter.rs` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ impl Filter {
 		let pat = Normalizer::normalize(s)?;
 		let regex = match case {
 			FilterCase::Smart => {
-				let uppercase = pat.chars().any(|c| c.is_uppercase());
+				let uppercase = s.chars().any(|c| c.is_uppercase());
 				RegexBuilder::new(&pat).case_insensitive(!uppercase).build()?
 			}
 			FilterCase::Sensitive => Regex::new(&pat)?,
```

**File**: `yazi-sftp/src/requests/read.rs` (modified, +2/-1)
```diff
@@ -20,7 +20,8 @@ impl<'a> Read<'a> {
 
 	pub(crate) fn len(&self) -> usize {
 		size_of_val(&self.id)
-			+ 4 + self.handle.len()
+			+ 4
+			+ self.handle.len()
 			+ size_of_val(&self.offset)
 			+ size_of_val(&self.len)
 	}
```

**File**: `yazi-sftp/src/responses/status.rs` (modified, +4/-2)
```diff
@@ -20,8 +20,10 @@ impl Status {
 	pub(crate) fn len(&self) -> usize {
 		size_of_val(&self.id)
 			+ size_of_val(&(self.code as u32))
-			+ 4 + self.message.len()
-			+ 4 + self.language.len()
+			+ 4
+			+ self.message.len()
+			+ 4
+			+ self.language.len()
 	}
 
 	pub(crate) fn is_ok(&self) -> bool { self.code == StatusCode::Ok }
```

---

### Incident Patch 3: `0ea4c5d9` (2026-09-21)
**Commit Message**: fix: workaround Konsole kitty graphics and keyboard protocol bugs (#4370)

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -30,8 +30,9 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 
 ### Fixed
 
-- Compatibility with legacy Git symlinks in package cache ([#4319])
 - Tolerate non-conforming orphaned trash items on Linux ([#4343])
+- Compatibility with legacy Git symlinks in package cache ([#4319])
+- Workaround Konsole kitty graphics and keyboard protocol bugs ([#4370])
 - Correct diacritic input for <kbd>Option</kbd> key combos in kitty keyboard protocol ([#4346])
 
 ### Improved
@@ -1886,3 +1887,4 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 [#4359]: https://github.com/sxyazi/yazi/pull/4359
 [#4363]: https://github.com/sxyazi/yazi/pull/4363
 [#4365]: https://github.com/sxyazi/yazi/pull/4365
+[#4370]: https://github.com/sxyazi/yazi/pull/4370
```

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -1568,9 +1568,9 @@ dependencies = [
 
 [[package]]
 name = "hyper-rustls"
-version = "0.27.9"
+version = "0.27.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "33ca68d021ef39cf6463ab54c1d0f5daf03377b70561305bb89a8f83aab66e0f"
+checksum = "dfa8e654703247911e29c23fbeaa261834bd9bb74efba2f9acddc37bfb127f53"
 dependencies = [
  "http",
  "hyper",
@@ -2080,9 +2080,9 @@ checksum = "b6d2cec3eae94f9f509c767b45932f1ada8350c4bdb85af2fcab4a3c14807981"
 
 [[package]]
 name = "libredox"
-version = "0.1.24"
+version = "0.1.25"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6480ccc157a1389bb2e4891b24751b0f798ba640d22386f23143fbcc89da195a"
+checksum = "61ff90caf6077a803a240f62fdbe88645a890bbca49ef8174c3cb0404362171d"
 dependencies = [
  "libc",
 ]
```

**File**: `yazi-adapter/src/drivers/kgp_old.rs` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ impl KgpOld {
 				let p = y * cols + x + 1;
 				write!(
 					buf,
-					"{}{START}_Gq=2,a=p,i={},p={p},x={left},y={top},w={},h={},c=1,r=1,z=-1,C=1{ESCAPE}\\{CLOSE}",
+					"{}{START}_Gq=2,a=p,i={},p={p},x={left},y={top},w={},h={},c=1,r=1,C=1{ESCAPE}\\{CLOSE}",
 					MoveTo(area.x + x as u16, area.y + y as u16),
 					kgp_id(),
 					right - left,
```

**File**: `yazi-term/src/parser/csi.rs` (modified, +9/-9)
```diff
@@ -89,7 +89,7 @@ impl Parser {
 		let basis = parse_char(codepoints.next())?;
 
 		let (modifiers, kind, state_from_modifiers) = parse_mks(it.next().unwrap_or_default())?;
-		let text = parse_text(it.next().unwrap_or_default())?;
+		let text = parse_text(it.next().unwrap_or_default());
 
 		Ok(Event::Key(KeyEvent {
 			code,
@@ -274,14 +274,14 @@ fn parse_char(s: Option<&str>) -> Result<Option<char>> {
 	}
 }
 
-fn parse_text(s: &str) -> Result<CompactString> {
-	if s.is_empty() {
-		return Ok(CompactString::default());
-	}
-
+fn parse_text(s: &str) -> CompactString {
+	// Konsole v26.08.1 encodes Enter as `ESC[13;1;13u`.
+	// The final `13` is associated carriage-return text, a control character
+	// that the Kitty keyboard protocol explicitly forbids. But, whelp,
+	// we tolerate the bug here by ignoring invalid or control codepoints while
+	// preserving any valid text.
 	s.split(':')
-		.map(|codepoint| {
-			char::from_u32(codepoint.parse()?).filter(|c| !c.is_control()).ok_or(ParseError::Invalid)
-		})
+		.filter_map(|codepoint| codepoint.parse().ok().and_then(char::from_u32))
+		.filter(|c| !c.is_control())
 		.collect()
 }
```

---

### Incident Patch 4: `b8973fb4` (2026-09-12)
**Commit Message**: fix: correct diacritic input for `Option` key combos in kitty keyboard protocol (#4346)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -26,6 +26,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 
 - Compatibility with legacy Git symlinks in package cache ([#4319])
 - Tolerate non-conforming orphaned trash items on Linux ([#4343])
+- Correct diacritic input for <kbd>Option</kbd> key combos in kitty keyboard protocol ([#4346])
 
 ## [v26.9.1]
 
@@ -1870,3 +1871,4 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 [#4335]: https://github.com/sxyazi/yazi/pull/4335
 [#4338]: https://github.com/sxyazi/yazi/pull/4338
 [#4343]: https://github.com/sxyazi/yazi/pull/4343
+[#4346]: https://github.com/sxyazi/yazi/pull/4346
```

**File**: `Cargo.lock` (modified, +37/-39)
```diff
@@ -290,9 +290,9 @@ checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
 
 [[package]]
 name = "bitflags"
-version = "2.13.1"
+version = "2.13.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b588b76d00fde79687d7646a9b5bdf3cc0f655e0bbd080335a95d7e96f3587da"
+checksum = "3ded4057c258ba199e2d26386d3af3780957ecaee6c4ef4041c6b4b8b97c0b06"
 dependencies = [
  "serde_core",
 ]
@@ -412,9 +412,9 @@ dependencies = [
 
 [[package]]
 name = "bytemuck_derive"
-version = "1.12.0"
+version = "1.12.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fc0e56a716f1e132ff6bf4bdac1c944a3fcdc1cae65f70a4a2a1ac3b401d2d1f"
+checksum = "6a1f896587b6f2c069c73d2f0913e2d590c3990285cd2f0b6aa02b786b4c679c"
 dependencies = [
  "proc-macro2",
  "quote",
@@ -1807,7 +1807,7 @@ version = "0.11.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4cc00ea907cab49550b7da656f80ebb97be1b997d931fbcd28d39734e17ce592"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "inotify-sys",
  "libc",
 ]
@@ -2049,7 +2049,7 @@ version = "1.1.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "07293a4e297ac234359b510362495713f75ea345d5307140414f20c69ffeb087"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "libc",
 ]
 
@@ -2079,9 +2079,9 @@ checksum = "b6d2cec3eae94f9f509c767b45932f1ada8350c4bdb85af2fcab4a3c14807981"
 
 [[package]]
 name = "libredox"
-version = "0.1.23"
+version = "0.1.24"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8d8f1ea3f21fd3405dcaf6c9b5c1630af9afc422d9073ea39c5f6d6c772e08ed"
+checksum = "6480ccc157a1389bb2e4891b24751b0f798ba640d22386f23143fbcc89da195a"
 dependencies = [
  "libc",
 ]
@@ -2092,7 +2092,7 @@ version = "0.3.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "e752191d037c44ad111a8caa762921926658402f01cc1253f7bef2020ece4f5e"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -2310,7 +2310,7 @@ version = "0.31.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "cf20d2fde8ff38632c426f1165ed7436270b44f199fc55284c38276f9db47c3d"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "cfg-if",
  "cfg_aliases",
  "libc",
@@ -2331,7 +2331,7 @@ version = "8.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4d3d07927151ff8575b7087f245456e549fea62edf0ec4e565a5ee50c8402bc3"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "fsevent-sys",
  "inotify",
  "kqueue",
@@ -2349,7 +2349,7 @@ version = "2.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "42b8cfee0e339a0337359f3c88165702ac6e600dc01c0cc9579a92d62b08477a"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -2438,7 +2438,7 @@ version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "e3e0adef53c21f888deb4fa59fc59f7eb17404926ee8a6f59f5df0fd7f9f3272"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "objc2",
 ]
 
@@ -2460,7 +2460,7 @@ version = "6.5.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0cc3cbf698f9438986c11a880c90a6d04b9de27575afd28bbf45b154b6c709e2"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "libc",
  "once_cell",
  "onig_sys",
@@ -2758,7 +2758,7 @@ version = "0.18.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "60769b8b31b2a9f263dae2776c37b1b28ae246943cf719eb6946a1db05128a61"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "crc32fast",
  "fdeflate",
  "flate2",
@@ -2995,7 +2995,7 @@ name = "ratatui-core"
 version = "0.1.2"
 source = "git+https://github.com/yazi-rs/ratatui.git?branch=fix_buffer_diff_wide_cells#dde5e05eccfe5b7cb7712b4bdf76edd0c2cd1f25"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "compact_str",
  "critical-section",
  "hashbrown 0.17.1",
@@ -3017,7 +3017,7 @@ version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "66e3d19bcc9130ca376277d93b60767ff121ace3be06f5f95f81dd68956407d1"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "hashbrown 0.17.1",
  "indoc",
  "instability",
@@ -3037,7 +3037,7 @@ version = "11.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "498cd0dc59d73224351ee52a95fee0f1a617a2eae0e7d9d720cc622c73a54186"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -3052,7 +3052,7 @@ version = "0.5.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ed2bf2547551a7053d6fdfafda3f938979645c44812fbfcda098faae3f1a362d"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -3197,12 +3197,12 @@ dependencies = [
 
 [[package]]
 name = "russh"
-version = "0.63.2"
+version = "0.63.3"
 source = "registry+https://github.
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -41,7 +41,7 @@ ansi-to-tui           = "8.0.1"
 anyhow                = "1.0.104"
 arc-swap              = { version = "1.9.2", features = [ "serde" ] }
 base64                = "0.23.1"
-bitflags              = { version = "2.13.1", features = [ "serde" ] }
+bitflags              = { version = "2.13.2", features = [ "serde" ] }
 chrono                = "0.4.45"
 clap                  = { version = "4.6.6", features = [ "derive" ] }
 compact_str           = { version = "0.10.0", features = [ "serde" ] }
@@ -74,7 +74,7 @@ regex-syntax          = "0.8.11"
 reqwest               = { version = "0.13.5", default-features = false, features = [ "rustls-no-provider", "stream" ] }
 rustls                = { version = "0.23.44", default-features = false, features = [ "ring", "std" ] }
 rustix                = { version = "1.1.4", default-features = false, features = [ "std", "fs", "mm", "shm", "stdio", "termios", "event" ] }
-russh                 = { version = "0.63.2", default-features = false, features = [ "ring", "rsa" ] }
+russh                 = { version = "0.63.3", default-features = false, features = [ "ring", "rsa" ] }
 scopeguard            = "1.2.0"
 serde                 = { version = "1.0.229", features = [ "derive" ] }
 serde_json            = "1.0.151"
@@ -85,7 +85,7 @@ thiserror             = "2.0.20"
 tokio                 = { version = "1.53.1", features = [ "full" ] }
 tokio-stream          = "0.1.19"
 tokio-util            = "0.7.19"
-toml                  = { version = "1.1.5" }
+toml                  = { version = "1.1.6" }
 tracing               = { version = "0.1.44", features = [ "max_level_debug", "release_max_level_off" ] }
 tracing-core          = "0.1.36"
 twox-hash             = { version = "2.1.4", default-features = false, features = [ "std", "random", "xxhash3_128" ] }
```

**File**: `yazi-actor/src/cmp/trigger.rs` (modified, +2/-0)
```diff
@@ -107,6 +107,7 @@ mod tests {
 	#[cfg(unix)]
 	#[test]
 	fn test_split() {
+		yazi_shim::init_tests();
 		yazi_shared::init_tests();
 		yazi_config::init_tests();
 		yazi_fs::init();
@@ -138,6 +139,7 @@ mod tests {
 	#[cfg(windows)]
 	#[test]
 	fn test_split() {
+		yazi_shim::init_tests();
 		yazi_shared::init_tests();
 		yazi_config::init_tests();
 		yazi_fs::init();
```

**File**: `yazi-cli/src/cache/clear.rs` (modified, +6/-5)
```diff
@@ -6,13 +6,14 @@ use crate::cache::Cache;
 
 impl Cache {
 	pub(crate) fn clear() -> anyhow::Result<()> {
-		if YAZI.preview.cache_dir == *Xdg::temp_dir() {
-			outln!("Clearing cache directory: \n{:?}", YAZI.preview.cache_dir)?;
-			std::fs::remove_dir_all(&YAZI.preview.cache_dir)?;
+		let path = &YAZI.preview.cache_dir;
+
+		if path == Xdg::temp_dir() {
+			outln!("Clearing cache directory: \n{path:?}")?;
+			std::fs::remove_dir_all(path)?;
 		} else {
 			outln!(
-				"You've changed the default cache directory, for your data's safety, please clear it manually: \n{:?}",
-				YAZI.preview.cache_dir
+				"You've changed the default cache directory, for your data's safety, please clear it manually: \n{path:?}"
 			)?;
 		}
 
```

**File**: `yazi-cli/src/package/dependency.rs` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ pub(crate) struct Dependency {
 
 impl Dependency {
 	pub(super) fn local(&self) -> PathBuf {
-		Xdg::cache_dir()
+		Xdg::asset_dir()
 			.join("packages")
 			.join(format!("{:x}", XxHash3_128::oneshot(self.remote().as_bytes())))
 	}
```

**File**: `yazi-cli/src/package/mod.rs` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ use anyhow::Context;
 use yazi_fs::Xdg;
 
 pub(super) fn init() -> anyhow::Result<()> {
-	let packages_dir = Xdg::cache_dir().join("packages");
+	let packages_dir = Xdg::asset_dir().join("packages");
 	std::fs::create_dir_all(&packages_dir)
 		.with_context(|| format!("failed to create packages directory: {packages_dir:?}"))?;
 
```

**File**: `yazi-config/src/keymap/key.rs` (modified, +26/-8)
```diff
@@ -31,20 +31,38 @@ impl Key {
 	}
 }
 
-impl From<KeyEvent> for Key {
-	fn from(value: KeyEvent) -> Self {
-		let (code, shift) = match value.text(&mut [0; 4]).and_then(|s| s.parse().ok()) {
-			Some(c) => (KeyCode::Char(c), c.is_uppercase()),
-			None => (value.code, value.modifiers.contains(Modifiers::SHIFT)),
-		};
+impl TryFrom<KeyEvent> for Key {
+	type Error = ();
+
+	fn try_from(value: KeyEvent) -> Result<Self, Self::Error> {
+		if value.modifiers.intersects(Modifiers::HYPER | Modifiers::META) {
+			return Err(());
+		}
+
+		let mut code = value.shifted_code();
+		let mut shift = value.modifiers.contains(Modifiers::SHIFT);
+		if value.modifiers.is_literal() && !value.text.is_empty() {
+			// `a` -> `text = "a"`; `Shift+A` -> `text = "A"`.
+			// Kitty's associated text is the char actually produced, so prefer it over `code`.
+			code = KeyCode::Char(value.text.parse().map_err(|_| ())?);
+			shift = code.implies_shift();
+		} else if shift && value.shifted.is_some() {
+			// `Shift+1` -> `shifted = Some('!')`, so `shifted_code()` already returns `!`.
+			// Recompute `shift` from the resolved shifted code, otherwise `Shift+1` would become `<S-!>` instead of `!`.
+			shift = code.implies_shift();
+		}
+
+		if code == KeyCode::Null {
+			return Err(());
+		}
 
-		Self {
+		Ok(Self {
 			code,
 			shift,
 			ctrl: value.modifiers.contains(Modifiers::CONTROL),
 			alt: value.modifiers.contains(Modifiers::ALT),
 			super_: value.modifiers.contains(Modifiers::SUPER),
-		}
+		})
 	}
 }
 
```

---

### Incident Patch 5: `79c9d0a8` (2026-09-10)
**Commit Message**: fix: fallback to `std::io::copy()` when `std::fs::copy()` fails on macOS (#4342)

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -5619,6 +5619,7 @@ dependencies = [
  "uds_windows",
  "unicode-segmentation",
  "unicode-width",
+ "windows-sys 0.61.2",
  "yazi-codegen",
  "yazi-macro",
 ]
```

**File**: `yazi-fs/src/engine/attrs.rs` (modified, +3/-1)
```diff
@@ -68,7 +68,9 @@ impl Attrs {
 	pub fn mode(mode: ChaMode) -> Self { Self { mode: Some(mode), ..Default::default() } }
 
 	fn has_times(self) -> bool {
-		self.atime.is_some() || self.btime.is_some() || self.mtime.is_some()
+		self.atime.is_some()
+			|| self.mtime.is_some()
+			|| (self.btime.is_some() && cfg!(any(target_os = "macos", target_os = "windows")))
 	}
 
 	pub fn atime_dur(self) -> Option<Duration> { self.atime?.duration_since(UNIX_EPOCH).ok() }
```

**File**: `yazi-fs/src/engine/local/copier.rs` (modified, +75/-73)
```diff
@@ -1,96 +1,98 @@
-use std::{io, path::PathBuf};
+use std::{fs, io, path::{Path, PathBuf}, time::Duration};
 
-use tokio::{select, sync::{mpsc, oneshot}};
+use tokio::{select, sync::mpsc, task, time};
 
 use crate::engine::{Attrs, Transmit};
 
-pub(super) async fn copy_impl(from: PathBuf, to: PathBuf, attrs: Attrs) -> io::Result<u64> {
-	#[cfg(any(target_os = "linux", target_os = "android"))]
-	{
-		use std::os::unix::fs::OpenOptionsExt;
-
-		tokio::task::spawn_blocking(move || {
-			let mut opts = std::fs::OpenOptions::new();
-			if let Some(mode) = attrs.mode {
-				opts.mode(mode.bits() as _);
-			}
-
-			let mut reader = std::fs::File::open(from)?;
-			let mut writer = opts.write(true).create(true).truncate(true).open(to)?;
-			let written = std::io::copy(&mut reader, &mut writer)?;
-
-			if let Some(mode) = attrs.mode {
-				writer.set_permissions(mode.into()).ok();
-			}
-			if let Ok(times) = attrs.try_into() {
-				writer.set_times(times).ok();
-			}
-
-			Ok(written)
-		})
-		.await?
-	}
-
-	#[cfg(not(any(target_os = "linux", target_os = "android")))]
-	{
-		tokio::task::spawn_blocking(move || {
-			let written = std::fs::copy(from, &to)?;
-
-			if let Ok(times) = attrs.try_into()
-				&& let Ok(file) = std::fs::File::options().write(true).open(to)
-			{
-				file.set_times(times).ok();
-			}
-
-			Ok(written)
-		})
-		.await?
-	}
-}
-
-pub(super) fn copy_progressive_impl(from: PathBuf, to: PathBuf, attrs: Attrs) -> Transmit {
+pub(super) fn copy_progressive(from: PathBuf, to: PathBuf, attrs: Attrs) -> Transmit {
 	let (prog_tx, prog_rx) = mpsc::channel(20);
-	let (done_tx, mut done_rx) = oneshot::channel();
 
-	tokio::spawn({
-		let to = to.clone();
-		async move {
-			done_tx.send(copy_impl(from, to, attrs).await).ok();
+	tokio::spawn(async move {
+		let mut initial = tokio::fs::symlink_metadata(&to).await.ok().map(|m| m.len());
+		if prog_tx.is_closed() {
+			return;
 		}
-	});
 
-	tokio::spawn(async move {
 		let mut last = 0;
-		let mut done = None;
+		let mut done = imp(from, to.clone(), attrs);
 		loop {
 			select! {
-				res = &mut done_rx => done = Some(res.unwrap()),
-				_ = prog_tx.closed() => break,
-				_ = tokio::time::sleep(std::time::Duration::from_secs(3)) => {},
-			}
-
-			match done {
-				Some(Ok(len)) => {
-					if len > last {
-						prog_tx.send(Ok(len - last)).await.ok();
+				output = &mut done => {
+					match output {
+						Ok(Ok(len)) => {
+							if len > last {
+								prog_tx.send(Ok(len - last)).await.ok();
+							}
+							prog_tx.send(Ok(0)).await.ok();
+						}
+						Ok(Err(e)) => _ = prog_tx.send(Err(e)).await,
+						Err(e) => _ = prog_tx.send(Err(e.into())).await
 					}
-					prog_tx.send(Ok(0)).await.ok();
 					break;
 				}
-				Some(Err(e)) => {
-					prog_tx.send(Err(e)).await.ok();
+				_ = prog_tx.closed() => {
+					done.abort();
 					break;
 				}
-				None => {}
-			}
+				_ = time::sleep(Duration::from_secs(3)) => {
+					let Ok(len) = tokio::fs::symlink_metadata(&to).await.map(|m| m.len()) else { continue };
+					if initial == Some(len) {
+						continue;
+					}
 
-			let len = tokio::fs::symlink_metadata(&to).await.map(|m| m.len()).unwrap_or(0);
-			if len > last {
-				prog_tx.send(Ok(len - last)).await.ok();
-				last = len;
+					initial = None;
+					if len > last {
+						prog_tx.send(Ok(len - last)).await.ok();
+						last = len;
+					}
+				}
 			}
 		}
 	});
 
 	Transmit::new(prog_rx)
 }
+
+fn imp(from: PathBuf, to: PathBuf, attrs: Attrs) -> task::JoinHandle<io::Result<u64>> {
+	task::spawn_blocking(move || primary_imp(&from, &to, attrs))
+}
+
+fn primary_imp(from: &Path, to: &Path, attrs: Attrs) -> io::Result<u64> {
+	let written = match fs::copy(from, to) {
+		Ok(n) => n,
+		#[cfg(any(target_os = "linux", target_os = "android", target_os = "macos"))]
+		Err(e) if matches!(e.kind(), io::ErrorKind::PermissionDenied | io::ErrorKind::Unsupported) => {
+			return fallback_imp(from, to, attrs);
+		}
+		Err(e) => return Err(e),
+	};
+
+	if let Ok(times) = attrs.try_into() {
+		yazi_shim::fs::set_times(to, times).ok();
+	}
+	Ok(written)
+}
+
+#[cfg(any(target_os = "linux", target_os = "android", target_os = "macos"))]
+fn fallback_imp(from: &Path, to: &Path, attrs: Attrs) -> io::Result<u64> {
+	use std::os::unix::fs::OpenOptionsExt;
+
+	let mut opts = fs::OpenOptions::new();
+	if let Some(mode) = attrs.mode {
+		opts.mode(mode.bits() as _);
+	}
+
+	let mut reader = fs::File::open(from)?;
+	let mut writer = opts.write(true).create(true).truncate(true).open(to)?;
+	let written = io::copy(&mut reader, &mut writer)?;
+
+	if let Some(mode) = attrs.mode {
+		writer.set_permissions(mode.into()).ok();
+	} else if let Ok(perm) = reader.metadata().map(|m| m.permissions()) {
+		writer.set_permissions(perm).ok();
+	}
+	if let Ok(times) = attrs.try_into() {
+		writer.set_times(times).ok();
+	}
+	Ok(written)
+}
```

**File**: `yazi-fs/src/engine/local/local.rs` (modified, +4/-8)
```diff
@@ -1,4 +1,4 @@
-use std::{fs::FileTimes, io, path::Path};
+use std::{io, path::Path};
 
 use yazi_shared::{auth::AuthKind, path::{DynPath, PathBufDyn}, strand::AsStrand, url::{Url, UrlBuf, UrlCow}};
 
@@ -39,13 +39,13 @@ impl<'a> Engine for Local<'a> {
 	async fn copy_to(&self, to: Url<'_>, attrs: Attrs) -> io::Result<Transmit> {
 		let Some(to) = to.as_local() else { return Ok(Transmit::unsupported()) };
 
-		Ok(super::copy_progressive_impl(self.path.to_owned(), to.to_owned(), attrs))
+		Ok(super::copy_progressive(self.path.to_owned(), to.to_owned(), attrs))
 	}
 
 	async fn copy_from(&self, from: Url<'_>, attrs: Attrs) -> io::Result<Transmit> {
 		let Some(from) = from.as_local() else { return Ok(Transmit::unsupported()) };
 
-		Ok(super::copy_progressive_impl(from.to_owned(), self.path.to_owned(), attrs))
+		Ok(super::copy_progressive(from.to_owned(), self.path.to_owned(), attrs))
 	}
 
 	#[inline]
@@ -122,7 +122,7 @@ impl<'a> Engine for Local<'a> {
 		let path = self.path.to_owned();
 		tokio::task::spawn_blocking(move || {
 			let a = mode.map_or(Ok(()), |mode| Self::set_mode(&path, mode));
-			let b = times.map_or(Ok(()), |times| Self::set_times(&path, times));
+			let b = times.map_or(Ok(()), |times| yazi_shim::fs::set_times(&path, times));
 			a.and(b)
 		})
 		.await?
@@ -257,8 +257,4 @@ impl<'a> Local<'a> {
 			if result == 0 { Ok(()) } else { Err(io::Error::last_os_error()) }
 		}
 	}
-
-	fn set_times(path: &Path, times: FileTimes) -> io::Result<()> {
-		std::fs::File::open(path)?.set_times(times)
-	}
 }
```

**File**: `yazi-shim/Cargo.toml` (modified, +1/-0)
```diff
@@ -41,3 +41,4 @@ unicode-width        = { workspace = true }
 
 [target."cfg(windows)".dependencies]
 uds_windows = "1.2.1"
+windows-sys = { version = "0.61.2", features = [ "Win32_Storage_FileSystem" ] }
```

**File**: `yazi-shim/src/fs/mod.rs` (modified, +1/-1)
```diff
@@ -1 +1 @@
-yazi_macro::mod_flat!(error serde);
+yazi_macro::mod_flat!(error serde times);
```

**File**: `yazi-shim/src/fs/times.rs` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+use std::{fs::{self, FileTimes}, io, path::Path};
+
+pub fn set_times(path: &Path, times: FileTimes) -> io::Result<()> {
+	#[cfg(not(windows))]
+	let file = fs::File::open(path);
+	#[cfg(windows)]
+	let file = {
+		use std::os::windows::fs::OpenOptionsExt;
+		fs::File::options()
+			.access_mode(windows_sys::Win32::Storage::FileSystem::FILE_WRITE_ATTRIBUTES)
+			.open(path)
+	};
+
+	file?.set_times(times)
+}
```

---

### Incident Patch 6: `89e32b59` (2026-09-10)
**Commit Message**: fix: tolerate non-conforming orphaned trash items on Linux (#4343)

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -14,7 +14,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 
 ### Added
 
-- Dynamic virtual file system Lua API ([#4338])
+- Dynamic virtual filesystem Lua API ([#4338])
 
 ### Changed
 
@@ -25,6 +25,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 ### Fixed
 
 - Compatibility with legacy Git symlinks in package cache ([#4319])
+- Tolerate non-conforming orphaned trash items on Linux ([#4343])
 
 ## [v26.9.1]
 
@@ -1868,3 +1869,4 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 [#4319]: https://github.com/sxyazi/yazi/pull/4319
 [#4335]: https://github.com/sxyazi/yazi/pull/4335
 [#4338]: https://github.com/sxyazi/yazi/pull/4338
+[#4343]: https://github.com/sxyazi/yazi/pull/4343
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ We want you to succeed, and it can be discouraging to find that a lot of re-work
 
 ## AI Policy
 
-1. All issue, PR, and discussion descriptions must be written by humans, not AI.
+1. All issue, PR, discussion, and commit descriptions must be authored by humans, not AI.
 2. Any use of AI must be disclosed. You must declare which model you used and the extent of AI assistance.
 3. Any AI-generated code must be reviewed, tested, and simplified by a human before publishing. This requires you to fully understand how it interacts with the greater system without AI assistance.
 4. Any AI tools used must explicitly state they do not assert copyright over the work.
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -5506,6 +5506,7 @@ version = "26.9.1"
 dependencies = [
  "anyhow",
  "compact_str",
+ "futures",
  "hashbrown 0.17.1",
  "mlua",
  "parking_lot",
```

**File**: `yazi-fs/src/trash/freedesktop/trash.rs` (modified, +4/-2)
```diff
@@ -17,7 +17,6 @@ impl Trash {
 			return self.tops();
 		};
 
-		// TODO
 		if !entry.lcha.is_dir() {
 			return Err(io::Error::new(io::ErrorKind::InvalidInput, "trash item is not a directory"));
 		}
@@ -145,7 +144,10 @@ impl Trash {
 				let dent = dent?;
 				let info = dent.path();
 				if let Ok(parsed) = TrashInfo::parse(&info) {
-					tops.push(TrashEntry::top(info, parsed.backing, Some(parsed.original))?);
+					tops.push(ok_or_not_found!(
+						TrashEntry::top(info, parsed.backing, Some(parsed.original)),
+						continue
+					));
 				}
 			}
 		}
```

**File**: `yazi-plugin/preset/plugins/trash.lua` (modified, +3/-1)
```diff
@@ -271,7 +271,9 @@ end
 
 function M:provide(job)
 	local op = job.op
-	if op == "Absolute" or op == "Canonicalize" then
+	if op == "Capabilities" then
+		return {}
+	elseif op == "Absolute" or op == "Canonicalize" then
 		return absolute(job.url)
 	elseif op == "Casefold" then
 		return job.url
```

**File**: `yazi-plugin/src/utils/sync.rs` (modified, +2/-21)
```diff
@@ -4,33 +4,14 @@ use mlua::{ExternalError, ExternalResult, Function, IntoLuaMulti, Lua, LuaString
 use tokio::{select, sync::mpsc};
 use yazi_binding::{Handle, MpscRx, MpscTx, MpscUnboundedRx, MpscUnboundedTx, OneshotRx, OneshotTx, runtime, runtime_mut};
 use yazi_core::{AppProxy, app::PluginOpt};
-use yazi_runner::{RUNNER, loader::LOADER};
+use yazi_runner::{CoHandle, RUNNER, loader::LOADER};
 use yazi_shared::{LOCAL_SET, data::Data, sendable::Sendable};
 use yazi_shim::{ResultExt, fs::Error, log::LOG_LEVEL};
 
 use super::Utils;
 
 impl Utils {
-	pub(super) fn co(lua: &Lua) -> mlua::Result<Function> {
-		lua.create_function(|lua, f: Function| {
-			let thread = lua.create_thread(f)?;
-			lua.create_async_function(move |lua, mut args: MultiValue| {
-				let thread = thread.clone();
-				async move {
-					loop {
-						let values: MultiValue = thread.resume(args)?;
-						if let Some(Value::LightUserData(ud)) = values.front()
-							&& *ud == Lua::poll_pending()
-						{
-							args = lua.yield_with(values).await?;
-						} else {
-							return Ok(values);
-						}
-					}
-				}
-			})
-		})
-	}
+	pub(super) fn co(lua: &Lua) -> mlua::Result<Function> { lua.create_function(CoHandle::create) }
 
 	pub(super) fn sync(lua: &Lua) -> mlua::Result<Function> {
 		lua.create_function(|lua, f: Function| {
```

**File**: `yazi-runner/Cargo.toml` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ yazi-version = { path = "../yazi-version", version = "26.9.1" }
 # External dependencies
 anyhow      = { workspace = true }
 compact_str = { workspace = true }
+futures     = { workspace = true }
 hashbrown   = { workspace = true }
 mlua        = { workspace = true }
 parking_lot = { workspace = true }
```

**File**: `yazi-runner/src/coroutine.rs` (modified, +69/-11)
```diff
@@ -1,20 +1,39 @@
-use mlua::{ExternalError, FromLua, FromLuaMulti, Function, Lua, MultiValue, Value};
+use std::ops::Deref;
+
+use futures::TryStreamExt;
+use mlua::{AnyUserData, ExternalError, FromLua, FromLuaMulti, Function, IntoLuaMulti, Lua, MetaMethod, MultiValue, Thread, UserData, UserDataMethods, Value};
 use yazi_shim::fs::Error;
 
-pub(crate) struct LuaCoroutine {
-	next:   Function,
-	values: Option<MultiValue>,
+// --- CoIter
+pub struct CoIter {
+	handle:  CoHandle,
+	started: bool,
+}
+
+impl Deref for CoIter {
+	type Target = CoHandle;
+
+	fn deref(&self) -> &Self::Target { &self.handle }
 }
 
-impl LuaCoroutine {
-	pub(crate) async fn new(next: Function) -> mlua::Result<Self> {
-		Ok(Self { values: Some(next.call_async(()).await?), next })
+impl Drop for CoIter {
+	fn drop(&mut self) {
+		if !self.thread.is_finished() {
+			self.thread.reset(self.reset.clone()).ok();
+		}
 	}
+}
 
-	pub(crate) async fn next<T: FromLuaMulti>(&mut self, lua: &Lua) -> mlua::Result<Option<T>> {
-		let mut values = match self.values.take() {
-			Some(values) => values,
-			None => self.next.call_async(true).await?,
+impl CoIter {
+	pub(crate) async fn next<T>(&mut self, lua: &Lua) -> mlua::Result<Option<T>>
+	where
+		T: FromLuaMulti,
+	{
+		let mut values = if self.started {
+			self.resume(true).await?
+		} else {
+			self.started = true;
+			self.resume(()).await?
 		};
 
 		if !values.front().is_none_or(Value::is_nil) {
@@ -29,3 +48,42 @@ impl LuaCoroutine {
 		Ok(None)
 	}
 }
+
+impl FromLua for CoIter {
+	fn from_lua(value: Value, lua: &Lua) -> mlua::Result<Self> {
+		Ok(Self { handle: AnyUserData::from_lua(value, lua)?.take()?, started: false })
+	}
+}
+
+// --- CoHandle
+pub struct CoHandle {
+	thread: Thread,
+	reset:  Function,
+}
+
+impl CoHandle {
+	pub fn create(lua: &Lua, f: Function) -> mlua::Result<AnyUserData> {
+		lua.create_userdata(Self { thread: lua.create_thread(f.clone())?, reset: f })
+	}
+
+	async fn resume(&self, args: impl IntoLuaMulti) -> mlua::Result<MultiValue> {
+		let values: MultiValue = self.thread.resume(args)?;
+
+		if let Some(Value::LightUserData(ud)) = values.front()
+			&& *ud == Lua::poll_pending()
+		{
+			let mut thread = self.thread.clone().into_async(())?;
+			return Ok(thread.try_next().await?.unwrap_or_default());
+		}
+
+		Ok(values)
+	}
+}
+
+impl UserData for CoHandle {
+	fn add_methods<M: UserDataMethods<Self>>(methods: &mut M) {
+		methods.add_async_meta_method(MetaMethod::Call, |_, me, args: MultiValue| async move {
+			me.resume(args).await
+		});
+	}
+}
```

---

### Incident Patch 7: `5f901b88` (2026-09-01)
**Commit Message**: fix: clean entry URLs on boot (#4318)

Co-authored-by: 三咲雅 misaki masa <[REDACTED_EMAIL]>

**File**: `yazi-boot/src/boot.rs` (modified, +6/-12)
```diff
@@ -19,23 +19,17 @@ impl Boot {
 			return (vec![CWD.load().as_ref().clone()], vec![Default::default()]);
 		}
 
-		async fn go(entry: &UrlBuf) -> (UrlBuf, StrandBuf) {
-			let mut entry = clean_url(entry);
+		async fn go(ent: &UrlBuf) -> (UrlBuf, StrandBuf) {
+			let ent = clean_url(engine::absolute(ent).await.unwrap_or(ent.into()));
 
-			if let Ok(u) = engine::absolute(&entry).await
-				&& u.is_owned()
-			{
-				entry = u.into_owned();
-			}
-
-			let Some((trail, child)) = entry.pair() else {
-				return (entry, Default::default());
+			let Some((trail, child)) = ent.pair() else {
+				return (ent, Default::default());
 			};
 
-			if engine::metadata(&entry).await.is_ok_and(|m| m.is_file()) {
+			if engine::metadata(&ent).await.is_ok_and(|m| m.is_file()) {
 				(trail.into(), child.into())
 			} else {
-				(entry, Default::default())
+				(ent, Default::default())
 			}
 		}
 
```

---

### Incident Patch 8: `3cf9fb28` (2026-09-01)
**Commit Message**: fix: compatibility with legacy Git symlinks in package cache (#4319)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -12,6 +12,10 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 
 ## [Unreleased]
 
+### Fixed
+
+- Compatibility with legacy Git symlinks in package cache ([#4319])
+
 ## [v26.9.1]
 
 ### Fixed
@@ -1851,3 +1855,4 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 [#4294]: https://github.com/sxyazi/yazi/pull/4294
 [#4306]: https://github.com/sxyazi/yazi/pull/4306
 [#4309]: https://github.com/sxyazi/yazi/pull/4309
+[#4319]: https://github.com/sxyazi/yazi/pull/4319
```

**File**: `yazi-cli/src/package/git.rs` (modified, +9/-2)
```diff
@@ -67,14 +67,21 @@ impl Git {
 				Path::from_wtf8(&ent[tab + 1..]).context("Git path cannot be represented by the OS")?,
 			);
 
-			let original = PathBuf::from_wtf8_vec(fs::read(&link).await?)
-				.context("Git symlink origin cannot be represented by the OS")?;
+			let is_symlink = fs::symlink_metadata(&link).await?.file_type().is_symlink();
+			let original = if is_symlink {
+				fs::read_link(&link).await? // TODO: compat for old caches, remove in the future
+			} else {
+				PathBuf::from_wtf8_vec(fs::read(&link).await?)
+					.context("Git symlink origin cannot be represented by the OS")?
+			};
 			let original = fs::canonicalize(link.parent().unwrap_or(&path).join(original))
 				.await
 				.with_context(|| format!("failed to resolve Git symlink target `{}`", link.display()))?;
 
 			if !original.starts_with(&path) {
 				bail!("Git symlink target escapes repository: `{}`", link.display());
+			} else if is_symlink {
+				fs::remove_file(&link).await?;
 			}
 
 			fs::copy(original, &link)
```

---

### Incident Patch 9: `a73d2356` (2026-08-31)
**Commit Message**: fix: avoid caching MIME types for dummy files

**File**: `yazi-config/preset/yazi-default.toml` (modified, +1/-0)
```diff
@@ -133,6 +133,7 @@ spotters = [
 	{ mime = "null/*", run = "null" },
 	# Fallback
 	{ url = "*", run = "file" },
+	{ url = "*/", run = "file" },
 ]
 preloaders = [
 	# Image
```

**File**: `yazi-fs/src/trash/freedesktop/trash_info.rs` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ impl TrashInfo {
 		// cat.jpg
 		let stem = info
 			.file_stem()
+			.filter(|&stem| stem != OsStr::new(".") && stem != OsStr::new(".."))
 			.ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid trash info path"))?;
 
 		let original = Self::parse_original(info, root)?;
```

**File**: `yazi-plugin/preset/plugins/mime-local.lua` (modified, +7/-7)
```diff
@@ -22,7 +22,7 @@ function M:fetch(job)
 			return M.placeholder(err, job.files)
 		end
 
-		local i, match, ignore = 1, nil, nil
+		local i, f, match, ignore = 1, nil, nil, nil
 		repeat
 			local line, event = child:read_line_with { timeout = 300 }
 			if event == 3 then
@@ -32,16 +32,16 @@ function M:fetch(job)
 				break
 			end
 
-			match, ignore = M.match_mimetype(line)
+			f, match, ignore = job.files[i], M.match_mimetype(line)
 			if match then
-				if coroutine.yield(job.files[i], { match }) then
-					updates[job.files[i].url] = match
+				if coroutine.yield(f, { match }) and not f.cha.is_dummy then
+					updates[f.url] = match
 					flush()
 				end
 				i = i + 1
 			elseif not ignore then
-				coroutine.yield(job.files[i], {
-					error = Err("Failed to determine MIME type for `%s`", job.files[i].url),
+				coroutine.yield(f, {
+					error = Err("Failed to determine MIME type for `%s`", f.url),
 					retry = true,
 				})
 				i = i + 1
@@ -106,7 +106,7 @@ function M.placeholder(err, files)
 	for _, file in ipairs(files) do
 		if err.kind ~= "NotFound" then
 			coroutine.yield(file, { error = Error(err), retry = true })
-		elseif coroutine.yield(file, { mime }) then
+		elseif coroutine.yield(file, { mime }) and not file.cha.is_dummy then
 			updates[file.url] = mime
 		end
 	end
```

**File**: `yazi-plugin/preset/plugins/mime-trash.lua` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ function M:fetch(job)
 				result[1] = mime
 			end
 
-			if coroutine.yield(file, result) then
+			if coroutine.yield(file, result) and not file.cha.is_dummy then
 				updates[file.url] = mime
 				flush()
 			end
```

---

### Incident Patch 10: `6ea223be` (2026-08-31)
**Commit Message**: fix: workaround Ratatui wide-grapheme diffs in Neovim embedded terminal (#4311)

**File**: `Cargo.lock` (modified, +18/-31)
```diff
@@ -624,21 +624,6 @@ dependencies = [
  "memchr",
 ]
 
-[[package]]
-name = "compact_str"
-version = "0.9.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9dfdd1c2274d9aa354115b09dc9a901d6c5576818cdf70d14cae2bdb47df00ab"
-dependencies = [
- "castaway",
- "cfg-if",
- "itoa",
- "rustversion",
- "ryu",
- "serde",
- "static_assertions",
-]
-
 [[package]]
 name = "compact_str"
 version = "0.10.0"
@@ -1935,6 +1920,15 @@ dependencies = [
  "either",
 ]
 
+[[package]]
+name = "itertools"
+version = "0.15.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8b4baf93f58d4425749ca49a51c50ebab072c5df6994d08fed93541c331481dc"
+dependencies = [
+ "either",
+]
+
 [[package]]
 name = "itoa"
 version = "1.0.18"
@@ -3043,14 +3037,13 @@ checksum = "63b8176103e19a2643978565ca18b50549f6101881c443590420e4dc998a3c69"
 [[package]]
 name = "ratatui-core"
 version = "0.1.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cbb175c433c8e28a809d1f5773a2ae96e68c0ce40db865cbab1020bf33ae479c"
+source = "git+https://github.com/yazi-rs/ratatui.git?branch=fix_buffer_diff_wide_cells#dde5e05eccfe5b7cb7712b4bdf76edd0c2cd1f25"
 dependencies = [
  "bitflags 2.13.1",
- "compact_str 0.9.1",
+ "compact_str",
  "critical-section",
  "hashbrown 0.17.1",
- "itertools",
+ "itertools 0.15.0",
  "kasuari",
  "lru",
  "palette",
@@ -3072,7 +3065,7 @@ dependencies = [
  "hashbrown 0.17.1",
  "indoc",
  "instability",
- "itertools",
+ "itertools 0.14.0",
  "line-clipping",
  "ratatui-core",
  "serde",
@@ -3448,12 +3441,6 @@ version = "1.0.23"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "cf54715a573b99ac80df0bc206da022bcd442c974952c7b9720069370852e21f"
 
-[[package]]
-name = "ryu"
-version = "1.0.23"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9774ba4a74de5f7b1c1451ed6cd5285a32eddb5cccb8cc655a4e50009e06477f"
-
 [[package]]
 name = "safe_arch"
 version = "1.2.0"
@@ -4522,7 +4509,7 @@ version = "2.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "16b380a1238663e5f8a691f9039c73e1cdae598a30e9855f541d29b08b53e9a5"
 dependencies = [
- "itertools",
+ "itertools 0.14.0",
  "unicode-segmentation",
  "unicode-width",
 ]
@@ -5209,7 +5196,7 @@ version = "26.8.15"
 dependencies = [
  "ansi-to-tui",
  "anyhow",
- "compact_str 0.10.0",
+ "compact_str",
  "futures",
  "hashbrown 0.17.1",
  "http-body-util",
@@ -5614,7 +5601,7 @@ name = "yazi-runner"
 version = "26.8.15"
 dependencies = [
  "anyhow",
- "compact_str 0.10.0",
+ "compact_str",
  "hashbrown 0.17.1",
  "mlua",
  "parking_lot",
@@ -5676,7 +5663,7 @@ name = "yazi-shared"
 version = "26.8.15"
 dependencies = [
  "anyhow",
- "compact_str 0.10.0",
+ "compact_str",
  "dyn-clone",
  "foldhash",
  "futures",
@@ -5737,7 +5724,7 @@ dependencies = [
  "anyhow",
  "base64 0.23.1",
  "bitflags 2.13.1",
- "compact_str 0.10.0",
+ "compact_str",
  "futures",
  "mlua",
  "parking_lot",
```

**File**: `Cargo.toml` (modified, +3/-0)
```diff
@@ -102,3 +102,6 @@ module_inception     = "allow"
 option_map_unit_fn   = "allow"
 unit_arg             = "allow"
 use_self             = "warn"
+
+[patch.crates-io]
+ratatui-core = { git = "https://github.com/yazi-rs/ratatui.git", branch = "fix_buffer_diff_wide_cells" }
```

**File**: `nix/yazi-unwrapped.nix` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ rustPlatform.buildRustPackage (finalAttrs: {
 
   cargoLock = {
     lockFile = "${src}/Cargo.lock";
+    allowBuiltinFetchGit = true;
   };
 
   env = {
```

---

### Incident Patch 11: `5f31edff` (2026-08-31)
**Commit Message**: fix: prune stale backstack entries on file invalidation (#4309)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -19,6 +19,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 - Lock directories under timeless mounts on first peek ([#4306])
 - Honor associated text when matching character keybindings ([#4279])
 - Materialize Git symlinks for consistent hashes ([#4276])
+- Prune stale backstack entries on file invalidation ([#4309])
 - Wait for terminal probe echo back before stopping instance ([#4271])
 - Avoid flicker caused by screen clear on final response from terminal ([#4250])
 - Fall back when `vergen` cannot determine Git SHA ([#4252])
@@ -1846,3 +1847,4 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 [#4279]: https://github.com/sxyazi/yazi/pull/4279
 [#4294]: https://github.com/sxyazi/yazi/pull/4294
 [#4306]: https://github.com/sxyazi/yazi/pull/4306
+[#4309]: https://github.com/sxyazi/yazi/pull/4309
```

**File**: `yazi-core/src/invalidator.rs` (modified, +2/-0)
```diff
@@ -49,6 +49,8 @@ impl<'a> Invalidator<'a> {
 			if let Some(parent) = tab.parent.as_mut().filter(|f| matches(&f.url)) {
 				parent.invalidate();
 			}
+
+			tab.backstack.remove_keys(trail, keys);
 			tab.history.for_each_mut(trail, keys, |folder| folder.invalidate());
 		}
 	}
```

**File**: `yazi-core/src/tab/backstack.rs` (modified, +66/-1)
```diff
@@ -1,4 +1,5 @@
-use yazi_shared::url::{Url, UrlBuf};
+use hashbrown::HashSet;
+use yazi_shared::{path::PathBufDyn, url::{AsUrl, Url, UrlBuf}};
 
 #[derive(Default)]
 pub struct Backstack {
@@ -52,10 +53,44 @@ impl Backstack {
 			Some(&self.stack[self.cursor])
 		}
 	}
+
+	pub fn remove_keys(&mut self, trail: &UrlBuf, keys: &HashSet<PathBufDyn>) {
+		let mut old = self.cursor;
+
+		self.stack.retain(|entry| {
+			let rm = Self::matches_keys(entry.as_url(), trail, keys);
+			old -= (rm && self.cursor > 0) as usize;
+
+			self.cursor = self.cursor.saturating_sub(1);
+			!rm
+		});
+
+		self.cursor = old.min(self.stack.len().saturating_sub(1));
+		self.dedup();
+	}
+
+	fn matches_keys(mut url: Url, trail: &UrlBuf, keys: &HashSet<PathBufDyn>) -> bool {
+		loop {
+			if url.pair().is_some_and(|(t, k)| t == *trail && keys.contains(&k)) {
+				return true;
+			}
+
+			let Some(parent) = url.parent() else { return false };
+			url = parent;
+		}
+	}
+
+	fn dedup(&mut self) {
+		let Some(stack) = self.stack.get(..=self.cursor) else { return };
+		self.cursor -= stack.windows(2).filter(|w| w[0] == w[1]).count();
+		self.stack.dedup();
+	}
 }
 
 #[cfg(test)]
 mod tests {
+	use std::path::Path;
+
 	use super::*;
 
 	#[test]
@@ -86,4 +121,34 @@ mod tests {
 		assert_eq!(bs.shift_forward(), None);
 		assert_eq!(bs.shift_backward().unwrap(), Url::regular("2"));
 	}
+
+	#[test]
+	fn test_remove_keys() {
+		let a = Url::regular("/a");
+		let b = Url::regular("/b");
+
+		let mut bs = Backstack::default();
+		bs.push(a);
+		bs.push(b);
+		bs.push(a);
+
+		bs.remove_keys(&Url::regular("/").to_owned(), &HashSet::from([Path::new("b").into()]));
+		assert_eq!(bs.stack, vec![a.to_owned()]);
+		assert_eq!(bs.cursor, 0);
+	}
+
+	#[test]
+	fn test_remove_keys_keeps_cursor() {
+		let a = Url::regular("/a");
+		let b = Url::regular("/b");
+
+		let mut bs = Backstack::default();
+		bs.push(a);
+		bs.push(b);
+		bs.push(a);
+
+		bs.remove_keys(&Url::regular("/").to_owned(), &HashSet::from([Path::new("c").into()]));
+		assert_eq!(bs.stack, vec![a.to_owned(), b.to_owned(), a.to_owned()]);
+		assert_eq!(bs.cursor, 2);
+	}
 }
```

**File**: `yazi-shared/src/url/url.rs` (modified, +1/-1)
```diff
@@ -192,7 +192,7 @@ impl<'a> Url<'a> {
 	pub fn os_str(self) -> Cow<'a, OsStr> { self.components().os_str() }
 
 	#[inline]
-	pub(crate) fn pair(self) -> Option<(Self, PathDyn<'a>)> {
+	pub fn pair(self) -> Option<(Self, PathDyn<'a>)> {
 		let key = self.key();
 		(!key.is_empty()).then_some((self.trail(), key))
 	}
```

---

### Incident Patch 12: `af43f09a` (2026-08-30)
**Commit Message**: fix: scope Lua HTTP client initialization error (#4308)

**File**: `yazi-plugin/src/lib.rs` (modified, +0/-8)
```diff
@@ -2,15 +2,7 @@ yazi_macro::mod_pub!(external fs keymap pubsub runtime tasks theme ui utils);
 
 yazi_macro::mod_flat!(slim standard);
 
-pub(crate) static HTTP: yazi_shim::cell::RoCell<reqwest::Client> = yazi_shim::cell::RoCell::new();
-
 pub fn setup() -> anyhow::Result<()> {
-	HTTP.init(
-		reqwest::Client::builder()
-			.user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36")
-			.build()?,
-	);
-
 	LUA.init(crate::standard_lua()?);
 
 	Ok(())
```

**File**: `yazi-plugin/src/utils/http.rs` (modified, +22/-2)
```diff
@@ -1,8 +1,10 @@
+use std::sync::OnceLock;
+
 use mlua::{ExternalError, Function, IntoLuaMulti, Lua, Table, Value};
+use reqwest::Client;
 use yazi_binding::{HttpRequest, HttpTransport};
 
 use super::Utils;
-use crate::HTTP;
 
 impl Utils {
 	pub(super) fn http(lua: &Lua) -> mlua::Result<Table> {
@@ -11,10 +13,28 @@ impl Utils {
 
 	fn request(lua: &Lua) -> mlua::Result<Function> {
 		lua.create_async_function(|lua, request: HttpRequest| async move {
-			match HttpTransport::new(&HTTP).send(request).await {
+			let result = match Self::client() {
+				Ok(client) => HttpTransport::new(client).send(request).await,
+				Err(e) => return (Value::Nil, e).into_lua_multi(&lua),
+			};
+
+			match result {
 				Ok(response) => response.into_lua_multi(&lua),
 				Err(e) => (Value::Nil, e.into_lua_err()).into_lua_multi(&lua),
 			}
 		})
 	}
+
+	fn client() -> mlua::Result<&'static Client> {
+		static HTTP: OnceLock<Result<Client, reqwest::Error>> = OnceLock::new();
+
+		HTTP
+		.get_or_init(|| {
+			Client::builder()
+				.user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36")
+				.build()
+		})
+		.as_ref()
+		.map_err(|e| e.into_lua_err())
+	}
 }
```

---

### Incident Patch 13: `adf23e48` (2026-08-30)
**Commit Message**: fix: spawn shell processes outside blocking workers (#4307)

**File**: `yazi-scheduler/src/process/shell.rs` (modified, +35/-37)
```diff
@@ -1,7 +1,7 @@
 use std::{ffi::OsString, process::Stdio};
 
 use anyhow::Result;
-use tokio::process::{Child, Command};
+use tokio::{process::{Child, Command}, task};
 use yazi_fs::Cwd;
 use yazi_macro::impl_data_any;
 use yazi_shared::url::{AsUrl, UrlBuf};
@@ -30,42 +30,40 @@ impl ShellOpt {
 }
 
 pub(crate) async fn shell(opt: ShellOpt) -> Result<Child> {
-	tokio::task::spawn_blocking(move || {
-		let cwd = Cwd::ensure(opt.cwd.as_url());
+	let (cwd, opt) =
+		task::spawn_blocking(move || (Cwd::ensure(opt.cwd.as_url()).into_owned(), opt)).await?;
 
-		#[cfg(unix)]
-		return Ok(unsafe {
-			Command::new("sh")
-				.stdin(opt.stdio())
-				.stdout(opt.stdio())
-				.stderr(opt.stdio())
-				.arg("-c")
-				.arg(opt.cmd)
-				.current_dir(cwd)
-				.kill_on_drop(!opt.orphan)
-				.pre_exec(move || {
-					if !opt.block && libc::setsid() < 0 {
-						return Err(std::io::Error::last_os_error());
-					}
-					Ok(())
-				})
-				.spawn()?
-		});
+	#[cfg(unix)]
+	return Ok(unsafe {
+		Command::new("sh")
+			.stdin(opt.stdio())
+			.stdout(opt.stdio())
+			.stderr(opt.stdio())
+			.arg("-c")
+			.arg(opt.cmd)
+			.current_dir(cwd)
+			.kill_on_drop(!opt.orphan)
+			.pre_exec(move || {
+				if !opt.block && libc::setsid() < 0 {
+					return Err(std::io::Error::last_os_error());
+				}
+				Ok(())
+			})
+			.spawn()?
+	});
 
-		#[cfg(windows)]
-		return Ok(
-			Command::new("cmd.exe")
-				.stdin(opt.stdio())
-				.stdout(opt.stdio())
-				.stderr(opt.stdio())
-				.env("=", r#""^\n\n""#)
-				.raw_arg(r#"/Q /S /D /V:OFF /E:ON /C ""#)
-				.raw_arg(opt.cmd)
-				.raw_arg(r#"""#)
-				.current_dir(cwd)
-				.kill_on_drop(!opt.orphan)
-				.spawn()?,
-		);
-	})
-	.await?
+	#[cfg(windows)]
+	return Ok(
+		Command::new("cmd.exe")
+			.stdin(opt.stdio())
+			.stdout(opt.stdio())
+			.stderr(opt.stdio())
+			.env("=", r#""^\n\n""#)
+			.raw_arg(r#"/Q /S /D /V:OFF /E:ON /C ""#)
+			.raw_arg(opt.cmd)
+			.raw_arg(r#"""#)
+			.current_dir(cwd)
+			.kill_on_drop(!opt.orphan)
+			.spawn()?,
+	);
 }
```

---

### Incident Patch 14: `bebdc66c` (2026-08-30)
**Commit Message**: fix: lock directories under timeless mounts on first peek (#4306)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -16,6 +16,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 
 - Assertion failure on expanding URLs with variables containing absolute paths ([#4256])
 - Correct open rule matching for trashed directories ([#4268])
+- Lock directories under timeless mounts on first peek ([#4306])
 - Honor associated text when matching character keybindings ([#4279])
 - Materialize Git symlinks for consistent hashes ([#4276])
 - Wait for terminal probe echo back before stopping instance ([#4271])
@@ -1844,3 +1845,4 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 [#4276]: https://github.com/sxyazi/yazi/pull/4276
 [#4279]: https://github.com/sxyazi/yazi/pull/4279
 [#4294]: https://github.com/sxyazi/yazi/pull/4294
+[#4306]: https://github.com/sxyazi/yazi/pull/4306
```

**File**: `Cargo.lock` (modified, +136/-62)
```diff
@@ -20,9 +20,9 @@ dependencies = [
 
 [[package]]
 name = "aes"
-version = "0.9.2"
+version = "0.9.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f8eb277bec05f56a0e0591f155a484cbd0f4f07ff2905051a48c72f004f7ed58"
+checksum = "35f0f96ce78e38c3dc6d8948aa8163d06385be74000f3c7a95bf1eef35d3ea32"
 dependencies = [
  "cipher",
  "cpubits",
@@ -54,6 +54,18 @@ dependencies = [
  "memchr",
 ]
 
+[[package]]
+name = "alias_record"
+version = "0.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "bc537ff0e1c48739abe9c70a6208aa8805613be42fe540d67ea28860e9ce3fa3"
+dependencies = [
+ "binrw",
+ "strum 0.27.2",
+ "thiserror 2.0.20",
+ "typed-builder",
+]
+
 [[package]]
 name = "allocator-api2"
 version = "0.2.21"
@@ -159,9 +171,9 @@ dependencies = [
 
 [[package]]
 name = "argon2"
-version = "0.6.0-rc.8"
+version = "0.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7af50940b73bf4e16c15c448a2b121c63f2d68e3e54b6a8731673cb4aa0cdff5"
+checksum = "134c52ddac6d63c576bef8168db10c83c49c26444ecbc68060fef078925a901c"
 dependencies = [
  "base64ct",
  "blake2",
@@ -469,9 +481,9 @@ checksum = "f079e83a288787bcd14a6aea84cee5c87a67c5a3e660c30f557a3d24761b3527"
 
 [[package]]
 name = "chacha20"
-version = "0.10.1"
+version = "0.10.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d524456ba66e72eb8b115ff89e01e497f8e6d11d78b70b1aa13c0fbd97540a81"
+checksum = "65c35e4b699c7e15ccbe7ee35c005e4fc0a278d22238a2857e6ce2dadeda1b06"
 dependencies = [
  "cfg-if",
  "cipher",
@@ -680,9 +692,9 @@ checksum = "15b85f9c39137c3a891689859392b1bd49812121d0d61c9caf00d46ed5ce06ae"
 
 [[package]]
 name = "cpufeatures"
-version = "0.3.0"
+version = "0.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b2a41393f66f16b0823bb79094d54ac5fbd34ab292ddafb9a0456ac9f87d201"
+checksum = "5ca28b0ae3115b884660db4118d803791fd6756b6e88f39c0f3f7859060d7566"
 dependencies = [
  "libc",
 ]
@@ -1018,12 +1030,16 @@ dependencies = [
 
 [[package]]
 name = "ds_parser"
-version = "0.2.1"
+version = "0.4.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5d632a0239fbe380ec79e8f80f5d2643da25ecfd61cde10d8c9e927d1c035acb"
+checksum = "d395f6aa836c20543332038a90f7fbd71658b9480d4e7285f99f1e950752f1f8"
 dependencies = [
+ "alias_record",
  "binrw",
+ "plist",
+ "strum 0.28.0",
  "thiserror 2.0.20",
+ "typed-builder",
 ]
 
 [[package]]
@@ -1166,7 +1182,7 @@ dependencies = [
  "bit_field",
  "half",
  "lebe",
- "miniz_oxide",
+ "miniz_oxide 0.8.9",
  "num-complex",
  "pulp",
  "smallvec",
@@ -1228,12 +1244,13 @@ checksum = "d45db016d36b838f563236e9193d0ee6ce38f3f68b6c94e914b4929c96bbb890"
 
 [[package]]
 name = "flate2"
-version = "1.1.9"
+version = "1.1.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "843fba2746e448b37e26a819579957415c8cef339bf08564fe8b7ddbd959573c"
+checksum = "6e634e2e0ebac1ee034020da1ca582e17ffe4e0f5e985823721e168928136dcb"
 dependencies = [
  "crc32fast",
- "miniz_oxide",
+ "miniz_oxide 0.9.1",
+ "zlib-rs",
 ]
 
 [[package]]
@@ -1580,9 +1597,9 @@ dependencies = [
 
 [[package]]
 name = "hyper"
-version = "1.11.0"
+version = "1.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d22053281f852e11534f5198498373cbb59295120a20771d90f7ed1897490a72"
+checksum = "27b501faa50e7a26c3d3560ca625132f4078a17771f4810baf70475ae48cbe43"
 dependencies = [
  "atomic-waker",
  "bytes",
@@ -1814,9 +1831,9 @@ dependencies = [
 
 [[package]]
 name = "indexmap"
-version = "2.14.0"
+version = "2.14.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d466e9454f08e4a911e14806c24e16fba1b4c121d1ea474396f396069cf949d9"
+checksum = "07aa2048142242915a31d35844fb311e0e53fcca590c3a0a40dcf1b841fa09eb"
 dependencies = [
  "equivalent",
  "hashbrown 0.17.1",
@@ -2114,9 +2131,9 @@ checksum = "b6d2cec3eae94f9f509c767b45932f1ada8350c4bdb85af2fcab4a3c14807981"
 
 [[package]]
 name = "libredox"
-version = "0.1.20"
+version = "0.1.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "28d0a00925a9f930d679b6789b721e3a7f9ed110f41b86d2497caa780c3a070a"
+checksum = "d7955dfc218a8afb29dfeffd540e3a6e96baeb94fe7138228dd7cc6937fbbf96"
 dependencies = [
  "libc",
 ]
@@ -2159,27 +2176,27 @@ checksum = "f9f8bd3e56ce4dfc153cf470fffbfa98c7620958b312ca5c3a4b8d5181fd13c6"
 
 [[package]]
 name = "lru"
-version = "0.18.2"
+version = "0.18.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5d2f2f9b4ba7e6b24d95e7e899329d35be83bcded72c8540cdd5368932d1d90a"
+checksum = "0d317b4b9eb398e6acce275758ec6125535505e7a146fb1a9b8bda2451b0ff4c"
 dependencies = [
  "hashbrown 0.17.1",
 ]
 
 [[package]]
 name = "lua-src"
-version = "550.1.1"
+version = "551.0.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "75c110c2fa33f34e0de05448e1f3eb2e0631e7a69e2d8ae1586cffc9f
```

**File**: `Cargo.toml` (modified, +4/-4)
```diff
@@ -53,12 +53,12 @@ futures               = "0.3.34"
 globset               = "0.4.20"
 hashbrown             = { version = "0.17.1", features = [ "serde" ] }
 image                 = { version = "0.25.10", default-features = false, features = [ "bmp", "dds", "exr", "ff", "gif", "hdr", "ico", "jpeg", "png", "pnm", "qoi", "tga", "tiff", "webp" ] }
-indexmap              = { version = "2.14.0", features = [ "serde" ] }
+indexmap              = { version = "2.14.1", features = [ "serde" ] }
 inventory             = "0.3.24"
 libc                  = "0.2.189"
 log                   = { version = "0.4.34", features = [ "release_max_level_off" ] }
-lru                   = "0.18.2"
-mlua                  = { version = "0.12.0", features = [ "anyhow", "async", "error-send", "lua55", "macros", "serde" ] }
+lru                   = "0.18.3"
+mlua                  = { version = "0.12.1", features = [ "anyhow", "async", "error-send", "lua55", "macros", "serde" ] }
 objc2                 = "0.6.4"
 ordered-float         = { version = "5.5.0", features = [ "serde" ] }
 parking_lot           = "0.12.5"
@@ -86,7 +86,7 @@ tokio-util            = "0.7.19"
 toml                  = { version = "1.1.4" }
 tracing               = { version = "0.1.44", features = [ "max_level_debug", "release_max_level_off" ] }
 tracing-core          = "0.1.36"
-twox-hash             = { version = "2.1.3", default-features = false, features = [ "std", "random", "xxhash3_128" ] }
+twox-hash             = { version = "2.1.4", default-features = false, features = [ "std", "random", "xxhash3_128" ] }
 typed-path            = "0.12.3"
 unicode-normalization = "0.1.25"
 unicode-width         = { version = "0.2.2", default-features = false }
```

**File**: `rustfmt.toml` (modified, +1/-1)
```diff
@@ -28,4 +28,4 @@ use_field_init_shorthand     = true
 use_small_heuristics         = "Max"
 use_try_shorthand            = true
 style_edition                = "2024"
-wrap_comments                = true
+wrap_comments                = false
```

**File**: `yazi-actor/src/mgr/peek.rs` (modified, +9/-1)
```diff
@@ -29,6 +29,9 @@ impl Actor for Peek {
 		if !cx.tab().preview.same_file(&hovered, &mime) {
 			cx.tab_mut().preview.reset();
 		}
+		if !cx.tab().preview.same_folder(&hovered.url) {
+			cx.tab_mut().preview.folder_lock = None;
+		}
 		if matches!(form.only_if, Some(u) if u != hovered.url) {
 			succ!();
 		}
@@ -43,8 +46,13 @@ impl Actor for Peek {
 		}
 
 		if let Some(folder) = tab!(cx).hovered_folder_mut() {
-			cx.core.mgr.watcher.refresher.refresh([folder.take_request()]);
+			let req = folder.take_request();
+			if req.force || cx.tab().preview.folder_lock.is_none() {
+				cx.tab_mut().preview.folder_lock = Some(req.url.clone());
+				cx.core.mgr.watcher.refresher.refresh([req]);
+			}
 		} else if hovered.is_dir() {
+			cx.tab_mut().preview.folder_lock = Some(hovered.url.clone());
 			cx.core.mgr.watcher.refresher.refresh([RefreshRequest::force(&hovered)]);
 		}
 
```

**File**: `yazi-binding/Cargo.toml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ compact_str     = { workspace = true }
 futures         = { workspace = true }
 hashbrown       = { workspace = true }
 http-body-util  = "0.1.5"
-hyper           = { version = "1.11.0", features = [ "client", "http1" ] }
+hyper           = { version = "1.11.1", features = [ "client", "http1" ] }
 hyper-util      = { version = "0.1.20", features = [ "tokio" ] }
 image           = { workspace = true }
 inventory       = { workspace = true }
```

**File**: `yazi-core/src/tab/preview.rs` (modified, +5/-2)
```diff
@@ -11,8 +11,9 @@ use crate::{AppProxy, Highlighter, MgrProxy, tab::{PreviewLock, PreviewSig}};
 
 #[derive(Default)]
 pub struct Preview {
-	pub lock: Option<PreviewLock>,
-	pub skip: usize,
+	pub lock:        Option<PreviewLock>,
+	pub skip:        usize,
+	pub folder_lock: Option<UrlBuf>,
 
 	handle: Option<JoinHandle<()>>,
 	scope:  Scope,
@@ -68,6 +69,8 @@ impl Preview {
 
 	pub fn same_url(&self, url: &UrlBuf) -> bool { matches!(&self.lock, Some(l) if l.url == *url) }
 
+	pub fn same_folder(&self, url: &UrlBuf) -> bool { self.folder_lock.as_ref() == Some(url) }
+
 	pub fn same_file(&self, file: &File, mime: &str) -> bool {
 		self.same_url(&file.url)
 			&& matches!(&self.lock, Some(l) if l.sig == PreviewSig::new(file, mime).hash_id())
```

**File**: `yazi-fs/Cargo.toml` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ windows-sys = { version = "0.61.2", features = [ "Win32_Storage_FileSystem" ] }
 
 [target.'cfg(target_os = "macos")'.dependencies]
 core-foundation-sys = { workspace = true }
-ds_parser           = "0.2.1"
+ds_parser           = "0.4.0"
 objc2               = { workspace = true }
 
 [target.'cfg(not(target_os = "android"))'.dependencies]
```

---

### Incident Patch 15: `faa20dfb` (2026-08-26)
**Commit Message**: perf: kitty graphics over shared memory (#4294)

**File**: `AGENTS.md` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@
 
 ## Style
 
-- Follow nearby code and use idiomatic Rust and Lua. Rust uses `snake_case` for modules, functions, and fields and `PascalCase` for types, traits, and variants. Lua uses PascalCase component tables, `local M` plugin modules, `snake_case` methods/locals, and `_name` private fields.
+- Follow nearby code and use idiomatic Rust and Lua. In Rust, treat directories as modules and files as types: always prefer `mod_pub!` for directory exports and `mod_flat!` for file exports. Keep `mod.rs` and `lib.rs` limited to exports; put module-wide implementation in a same-named file (for example, `core/core.rs`). Rust uses `snake_case` for modules, functions, and fields and `PascalCase` for types, traits, and variants. Lua uses PascalCase component tables, `local M` plugin modules, `snake_case` methods/locals, and `_name` private fields.
 - Preserve established terms and type families: `Url`/`UrlBuf`/`UrlCow`, `PathDyn`/`PathBufDyn`/`PathCow`, `*Ref`, `*Arc`, `*Opt`, `*State`, `*Job`, `*Prog`, `File`, `Folder`, `Tab`, `Mgr`, and `Task`. Use `Url` for logical locations and `Path` for filesystem paths.
 - `key()` identifies a file-list entry; `urn()` is the raw URL path tail. Use `key()` for list state and `urn()` for filesystem-path semantics; do not substitute them mechanically.
 - Reuse established plugin and event names (`fetch`, `preload`, `peek`, `seek`, `spot`, `entry`, `setup`, `yank`, `hover`, and `select`) across Rust, Lua, and configuration.
@@ -27,7 +27,7 @@
 - Search and reuse first. For new features, extend existing infrastructure or data structures with general, reusable capabilities when that keeps the final code concise.
 - Use `gh` to read GitHub issues, pull requests, and their discussions.
 - For refactors, inspect the whole target module, its callers, and the surrounding lifecycle first. Understand the system's established assumptions before adding local safeguards; distinguish required invariants from acceptable compromises, and ask when that boundary materially affects the design. Look for duplicated work, redundant I/O, underpowered return values, one-use wrappers, and reusable cross-platform abstractions; implement high-confidence, behavior-preserving simplifications while preserving error, fallback, and platform semantics.
-- Keep diffs minimal and avoid unrelated refactors, speculative abstractions, and defensive handling for states the system already excludes. Prefer clear, flat control flow, expressions, and positive predicates; use standard combinators, early returns, ordered branches, and match guards to avoid nested conditionals, compound negation, and unnecessary wrapper syntax. When idiomatic and equivalent, prefer visually parallel forms such as `true as usize` over `usize::from(true)`. Comment only behavior the code cannot explain.
+- Prefer the simplest design that satisfies the requirements. Keep diffs minimal and avoid overengineering, unrelated refactors, speculative abstractions, and defensive handling for states the system already excludes. Prefer clear, flat control flow, expressions, and positive predicates; use standard combinators, early returns, ordered branches, and match guards to avoid nested conditionals, compound negation, and unnecessary wrapper syntax. When idiomatic and equivalent, prefer visually parallel forms such as `true as usize` over `usize::from(true)`. Comment only behavior the code cannot explain.
 - Keep responsibility boundaries clear and cohesive. Prefer pure functions, explicit invariants, and idempotent operations when repeated calls are natural and idempotency removes coordination or state. Favor convention over configuration when invariants can eliminate state or coordination. Put reusable code in the lowest suitable shared layer; avoid unnecessary dependencies and allocations. Prefer borrowed values and existing wrappers.
 - Initialize crates explicitly from the application entrypoint in dependency order; a module must not initialize another module as a side effect.
 - Use stable Rust APIs; nightly is formatting-only—apply Rust formatting directly with `rustfmt +nightly **/*.rs`. Use only `pub`, `pub(super)`, and `pub(crate)`—never `pub(in ...)`.
@@ -39,7 +39,7 @@
 ## Validation
 
 - Prefer targeted debug checks; use multiple `-p` flags for affected crates before the whole workspace.
-- When investigating bugs, add temporary diagnostics when useful (`tracing` in Rust and `ya.dbg` in Lua), reproduce in a simulated terminal with `YAZI_LOG=debug`, and inspect the log file to pinpoint the cause; remove diagnostics before handoff.
+- When investigating bugs, add temporary diagnostics when useful (`tracing` in Rust and `ya.dbg` in Lua), reproduce in a simulated terminal with `YAZI_LOG=debug`, and inspect the log file to pinpoint the cause. When debugging on a real terminal, use its IPC remote-control interface whenever supported. Remove temporary diagnostics before handoff.
 
 ```sh
 cargo check -p <package>
```

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -24,6 +24,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 
 ### Improved
 
+- Kitty graphics over shared memory ([#4294])
 - Send terminal probe requests immediately at startup ([#4260])
 - Tune light/dark theme detection ([#4265])
 
@@ -1842,3 +1843,4 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
 [#4271]: https://github.com/sxyazi/yazi/pull/4271
 [#4276]: https://github.com/sxyazi/yazi/pull/4276
 [#4279]: https://github.com/sxyazi/yazi/pull/4279
+[#4294]: https://github.com/sxyazi/yazi/pull/4294
```

**File**: `Cargo.lock` (modified, +26/-39)
```diff
@@ -299,9 +299,9 @@ dependencies = [
 
 [[package]]
 name = "blake2"
-version = "0.11.0-rc.6"
+version = "0.11.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "061f1a09225e328e1ffbb378d2d49923c0ca5fee19fb5ac1cc9c1e9d52b93690"
+checksum = "5b5d4d889834ee8ecfc0f8426ad30faf7cdcb10f741a8e6d7224d95325479f6f"
 dependencies = [
  "digest",
 ]
@@ -337,27 +337,25 @@ dependencies = [
 
 [[package]]
 name = "bon"
-version = "3.9.3"
+version = "3.10.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a602c73c7b0148ec6d12af6fd5cc7a46e2eacc8878271a999abac56eed12f561"
+checksum = "9e3fac94a66da67200398458a25412bcc3f9b6443b5119a6cad9cf3ccfcd8cc6"
 dependencies = [
  "bon-macros",
- "rustversion",
 ]
 
 [[package]]
 name = "bon-macros"
-version = "3.9.3"
+version = "3.10.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6dee98b0db6a962de883bf5d20362dee4d7ca0d12fe39a7c6c73c844e1cd7c1f"
+checksum = "d4654961ad0494e4774c5c60b4cb4cd0ae9b9d92d039d901638b1dba97ebebf5"
 dependencies = [
- "darling 0.23.0",
+ "darling 0.24.1",
  "ident_case",
  "prettyplease",
  "proc-macro2",
  "quote",
- "rustversion",
- "syn 2.0.119",
+ "syn 3.0.4",
 ]
 
 [[package]]
@@ -606,9 +604,9 @@ checksum = "1d07550c9036bf2ae0c684c4297d503f838287c83c53686d05370d0e139ae570"
 
 [[package]]
 name = "combine"
-version = "4.6.7"
+version = "4.6.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ba5a308b75df32fe02788e748662718f03fde005016435c444eea572398219fd"
+checksum = "cfc320937d09e6de266b31b9afb480f197d7a861be86be7cb2ea7e5d1bfffc5e"
 dependencies = [
  "bytes",
  "memchr",
@@ -886,12 +884,11 @@ checksum = "4583a4551df46e2792f82ceeac45e850d2e2d5debba0b91f102385cda5b11f06"
 
 [[package]]
 name = "deadpool"
-version = "0.13.0"
+version = "0.13.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "883466cb8db62725aee5f4a6011e8a5d42912b42632df32aad57fc91127c6e04"
+checksum = "3e98a7e119cd347f4201e1159b19831029e203e2d8b790547708e8157b4acf1e"
 dependencies = [
  "deadpool-runtime",
- "num_cpus",
  "tokio",
 ]
 
@@ -1500,12 +1497,6 @@ version = "0.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2304e00983f87ffb38b55b444b5e3b60a884b5d30c0fca7d82fe33449bbe55ea"
 
-[[package]]
-name = "hermit-abi"
-version = "0.5.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fc0fef456e4baa96da950455cd02c081ca953b141298e41db3fc7e36b1da849c"
-
 [[package]]
 name = "hex"
 version = "0.4.3"
@@ -2440,16 +2431,6 @@ dependencies = [
  "libm",
 ]
 
-[[package]]
-name = "num_cpus"
-version = "1.17.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "91df4bbde75afed763b708b7eee1e8e7651e02d97f6d5dd763e89367e957b23b"
-dependencies = [
- "hermit-abi",
- "libc",
-]
-
 [[package]]
 name = "num_threads"
 version = "0.1.7"
@@ -2546,7 +2527,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "8c7c9e0d9b23589f26070720bac724174bfec1083e82f7854cdd0267518343c0"
 dependencies = [
  "num-traits",
- "rand 0.8.7",
+ "rand 0.8.8",
  "serde",
 ]
 
@@ -2862,12 +2843,12 @@ checksum = "439ee305def115ba05938db6eb1644ff94165c5ab5e9420d1c1bcedbba909391"
 
 [[package]]
 name = "prettyplease"
-version = "0.2.37"
+version = "0.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "479ca8adacdd7ce8f1fb39ce9ecccbfe93a3f1344b3d0d97f20bc0196208f62b"
+checksum = "2bfe0f4c752e450fc2faf62654f1c134747922825d5b04ca717b8874f41a40c0"
 dependencies = [
  "proc-macro2",
- "syn 2.0.119",
+ "syn 3.0.4",
 ]
 
 [[package]]
@@ -2998,9 +2979,9 @@ checksum = "dc33ff2d4973d518d823d61aa239014831e521c75da58e3df4840d3f47749d09"
 
 [[package]]
 name = "rand"
-version = "0.8.7"
+version = "0.8.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "22f6172bdec972074665ed81ed53b71da00bfc44b65a753cfde883ec4c702a1a"
+checksum = "e058c7de0b26af77780c769414d6257830bb240f3c38477dbc2c16e5f54d6d4c"
 dependencies = [
  "rand_core 0.6.4",
  "serde",
@@ -4711,9 +4692,9 @@ checksum = "a28ac98ddc8b9274cb41bb4d9d4d5c425b6020c50c46f25559911905610b4a88"
 
 [[package]]
 name = "which"
-version = "8.0.5"
+version = "8.0.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8f3ef584124b911bcc3875c2f1472e80f24361ceb789bd1c62b3e9a3df9ff43c"
+checksum = "bae2f2b2b816647a1cab1acc91f5bd20812d53cb344382635ec2181940c8034f"
 dependencies = [
  "libc",
 ]
@@ -5145,6 +5126,7 @@ dependencies = [
  "tokio",
  "yazi-config",
  "yazi-emulator",
+ "yazi-ffi",
  "yazi-fs",
  "yazi-macro",
  "yazi-shared",
@@ -5359,9 +5341,13 @@ version = "26.8.15"
 dependencies = [
  "anyhow",
  "core-foundation-sys",
+ "data-encoding",
  "libc",
  "objc2",
+ "rand 0.10.2",
+ "rustix",
  "windows 0.62.2",
+ "windows-sys 0.61.2",
  "yazi-macro",
 ]
 
@@ -5710,6 +5696,7 @@ dependencies = [
  "parking_lot",
  "ratatui-core",
  "windows-sy
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -71,6 +71,7 @@ regex                 = "1.13.1"
 regex-syntax          = "0.8.11"
 reqwest               = { version = "0.13.4", default-features = false, features = [ "rustls-no-provider", "stream" ] }
 rustls                = { version = "0.23.43", default-features = false, features = [ "ring", "std" ] }
+rustix                = { version = "1.1.4", default-features = false, features = [ "std", "fs", "mm", "shm", "stdio", "termios", "event" ] }
 russh                 = { version = "0.63.1", default-features = false, features = [ "ring", "rsa" ] }
 scopeguard            = "1.2.0"
 serde                 = { version = "1.0.229", features = [ "derive" ] }
```

**File**: `yazi-adapter/Cargo.toml` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ workspace = true
 [dependencies]
 yazi-config   = { path = "../yazi-config", version = "26.8.15" }
 yazi-emulator = { path = "../yazi-emulator", version = "26.8.15" }
+yazi-ffi      = { path = "../yazi-ffi", version = "26.8.15" }
 yazi-fs       = { path = "../yazi-fs", version = "26.8.15" }
 yazi-macro    = { path = "../yazi-macro", version = "26.8.15" }
 yazi-shared   = { path = "../yazi-shared", version = "26.8.15" }
```

**File**: `yazi-adapter/src/drivers/drivers.rs` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ impl From<&Emulator> for Drivers {
 				(false, false) => vec![],
 			}),
 			Brand::Zellij => Self(match (value.kgp.get(), value.sixel.get()) {
-				(true, true) => vec![D::KgpOld, D::Sixel],
+				(true, true) => vec![D::Sixel, D::KgpOld],
 				(true, false) => vec![D::KgpOld],
 				(false, true) => vec![D::Sixel],
 				(false, false) => vec![],
```

**File**: `yazi-adapter/src/drivers/kgp.rs` (modified, +35/-29)
```diff
@@ -1,16 +1,17 @@
 use core::str;
 use std::{io::Write, path::PathBuf};
 
-use anyhow::Result;
+use anyhow::{Result, bail};
 use base64::{Engine, engine::general_purpose};
 use image::DynamicImage;
 use ratatui_core::{layout::Rect, style::Color};
 use yazi_config::THEME;
-use yazi_emulator::{CLOSE, ESCAPE, Emulator, START};
-use yazi_shim::cell::SyncCell;
+use yazi_emulator::{CLOSE, EMULATOR, ESCAPE, Emulator, START};
+use yazi_ffi::shm::NamedSharedMemory;
 use yazi_tty::sequence::{MoveTo, ResetAttrs, SetBg, SetFg};
 
-use crate::{ADAPTOR, image::Image};
+use super::KgpPayload;
+use crate::{ADAPTOR, drivers::kgp_id, image::Image};
 
 static DIACRITICS: [char; 297] = [
 	'\u{0305}',
@@ -348,32 +349,49 @@ impl Kgp {
 		})
 	}
 
-	async fn encode(img: DynamicImage) -> Result<Vec<u8>> {
-		fn output(raw: &[u8], format: u8, size: (u32, u32)) -> Result<Vec<u8>> {
-			let b64 = general_purpose::STANDARD.encode(raw).into_bytes();
+	async fn encode(img: DynamicImage) -> Result<KgpPayload> {
+		fn output(raw: &[u8], format: u8, size: (u32, u32)) -> Result<KgpPayload> {
+			output_shm(raw, format, size).or_else(|_| output_b64(raw, format, size))
+		}
+
+		fn output_shm(raw: &[u8], format: u8, (w, h): (u32, u32)) -> Result<KgpPayload> {
+			if !EMULATOR.kgp_shm.get() {
+				bail!("Shared memory is not supported by the terminal")
+			}
+
+			let mut pl = KgpPayload::with(200, NamedSharedMemory::new(raw)?);
+			write!(
+				pl,
+				"{START}_Gq=2,a=T,C=1,U=1,t=s,f={format},s={w},v={h},i={},S={};{}{ESCAPE}\\{CLOSE}",
+				kgp_id(),
+				raw.len(),
+				pl.name(),
+			)?;
+
+			Ok(pl)
+		}
 
+		fn output_b64(raw: &[u8], format: u8, (w, h): (u32, u32)) -> Result<KgpPayload> {
+			let b64 = general_purpose::STANDARD.encode(raw).into_bytes();
 			let mut it = b64.chunks(4096).peekable();
-			let mut buf = Vec::with_capacity(b64.len() + it.len() * 50);
+			let mut pl = KgpPayload::new(b64.len() + it.len() * 50);
 			if let Some(first) = it.next() {
 				write!(
-					buf,
-					"{START}_Gq=2,a=T,C=1,U=1,f={format},s={},v={},i={},m={};{}{ESCAPE}\\{CLOSE}",
-					size.0,
-					size.1,
-					Kgp::image_id(),
+					pl,
+					"{START}_Gq=2,a=T,C=1,U=1,f={format},s={w},v={h},i={},m={};{}{ESCAPE}\\{CLOSE}",
+					kgp_id(),
 					it.peek().is_some() as u8,
 					unsafe { str::from_utf8_unchecked(first) },
 				)?;
 			}
 
 			while let Some(chunk) = it.next() {
-				write!(buf, "{START}_Gm={};{}{ESCAPE}\\{CLOSE}", it.peek().is_some() as u8, unsafe {
+				write!(pl, "{START}_Gm={};{}{ESCAPE}\\{CLOSE}", it.peek().is_some() as u8, unsafe {
 					str::from_utf8_unchecked(chunk)
 				})?;
 			}
 
-			write!(buf, "{CLOSE}")?;
-			Ok(buf)
+			Ok(pl)
 		}
 
 		let size = (img.width(), img.height());
@@ -388,7 +406,7 @@ impl Kgp {
 	fn place(area: &Rect) -> Result<Vec<u8>> {
 		let mut buf = Vec::with_capacity(area.width as usize * area.height as usize * 3 + 500);
 
-		let id = Self::image_id();
+		let id = kgp_id();
 		let (r, g, b) = ((id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff);
 		write!(buf, "{}", SetFg(Color::Rgb(r as u8, g as u8, b as u8)))?;
 
@@ -408,16 +426,4 @@ impl Kgp {
 		write!(buf, "{ResetAttrs}")?;
 		Ok(buf)
 	}
-
-	pub(super) fn image_id() -> u32 {
-		static CACHE: SyncCell<Option<u32>> = SyncCell::new(None);
-		match CACHE.get() {
-			Some(n) => n,
-			None => {
-				let n = std::process::id() % (0xffffff + 1);
-				CACHE.set(Some(n));
-				n
-			}
-		}
-	}
 }
```

**File**: `yazi-adapter/src/drivers/kgp_common.rs` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+use std::{io::{self, Write}, ops::Deref};
+
+use base64::{Engine, engine::general_purpose};
+use yazi_ffi::shm::NamedSharedMemory;
+use yazi_shim::cell::SyncCell;
+
+pub(super) fn kgp_id() -> u32 {
+	static CACHE: SyncCell<Option<u32>> = SyncCell::new(None);
+	match CACHE.get() {
+		Some(n) => n,
+		None => {
+			let n = std::process::id() % (0xffffff + 1);
+			CACHE.set(Some(n));
+			n
+		}
+	}
+}
+
+// --- KgpPayload
+pub(super) struct KgpPayload {
+	bytes: Vec<u8>,
+	_shm:  Option<NamedSharedMemory>,
+}
+
+impl Deref for KgpPayload {
+	type Target = [u8];
+
+	fn deref(&self) -> &Self::Target { &self.bytes }
+}
+
+impl KgpPayload {
+	pub(super) fn new(cap: usize) -> Self { Self { bytes: Vec::with_capacity(cap), _shm: None } }
+
+	pub(super) fn with(cap: usize, shm: NamedSharedMemory) -> Self {
+		Self { bytes: Vec::with_capacity(cap), _shm: Some(shm) }
+	}
+
+	pub(super) fn name(&self) -> String {
+		let Some(shm) = &self._shm else { return String::new() };
+		general_purpose::STANDARD.encode(&shm.name)
+	}
+}
+
+impl Write for KgpPayload {
+	fn write(&mut self, buf: &[u8]) -> io::Result<usize> { self.bytes.write(buf) }
+
+	fn flush(&mut self) -> io::Result<()> { self.bytes.flush() }
+}
```

#### Recent Merged Pull Requests:
- **PR #4400** (closed): fix(adapter): use direct-placement KGP driver in Zellij (@Dronakurl)
- **PR #4398** (2026-10-03): feat: make time formatting with valid arguments infallible (@sxyazi)
- **PR #4397** (2026-10-03): perf: switch Lua to generational GC (@sxyazi)
- **PR #4396** (2026-10-03): docs: fix a typo in input snaps comment (@GhostCoder6969)
- **PR #4395** (2026-10-02): feat!: respect user locale date format (@sxyazi)
- **PR #4391** (2026-10-01): feat: expose `layer` in `cx.which` (@rokokol)
- **PR #4390** (closed): feat: sort deleted files by deletion timestamp (@venoosoo)
- **PR #4389** (2026-09-30): feat: new `update` methods to dynamic Lua plugin APIs (@sxyazi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
