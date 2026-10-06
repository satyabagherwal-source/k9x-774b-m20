# Forensic Learning Record (Deep Inspection): code-yeongyu/oh-my-openagent

> **Canonical Artifact**: `07_PROJECT_LEARNING/code-yeongyu-oh-my-openagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:50:51.495Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `code-yeongyu/oh-my-openagent`
- **Description**: OmO: Just type "mass ulw" keyword with your prompt. Now you are the master of graph engineering.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 69835 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/senpi-desktop-backend-wayland/src/input/lifecycle.rs`
```
use std::os::fd::AsFd;
use std::time::Duration;

use futures::StreamExt;
use reis::ei;
use reis::event::{DeviceCapability, EiEvent, Keymap};
use senpi_desktop_core::error::{CoreResult, DesktopError};

use super::{EiDevice, Granted, KeyboardLayout, Libei};

const DEVICE_DISCOVERY_DRAIN_TIMEOUT: Duration = Duration::from_millis(500);
const DEVICE_REFRESH_TIMEOUT: Duration = Duration::from_millis(1);
const DEVICE_REFRESH_LIMIT: usize = 256;

impl Libei {
    pub(super) fn discover_devices(&mut self, targets: Granted) -> CoreResult<()> {
        let mut events = self
            .events
            .take()
            .ok_or_else(|| DesktopError::input_failed("libei event stream is unavailable"))?;
        let runtime = self.runtime;
        let result = runtime.block_on(async {
            let mut drain_deadline = None;
            for _ in 0..128 {
                let next = match drain_deadline {
                    Some(deadline) => {
                        match tokio::time::timeout_at(deadline, events.next()).await {
                            Ok(event) => event,
                            Err(_) => break,
                        }
                    }
                    None => events.next().await,
                };
                let event = next
                    .ok_or_else(|| {
                        DesktopError::input_failed("libei disconnected during device discovery")
                    })?
                    .map_err(|error| {
                        DesktopError::input_failed(format!("libei device discovery: {error}"))
                    })?;
                self.handle_event(event)?;
                if discovery_complete(
                    targets,
                    self.has_capability(DeviceCapability::PointerAbsolute),
                    self.has_capability(DeviceCapability::Keyboard),
                ) {
                    break;
                }
                if drain_deadline.is_none() && self.devices.iter().any(|device| device.resumed) {
                    drain_deadline =
                        Some(tokio::time::Instant::now() + DEVICE_DISCOVERY_DRAIN_TIMEOUT);
                }
            }
            Ok(())
        });
        self.events = Some(events);
        result
    }

    pub(super) fn refresh_devices(&mut self) -> CoreResult<()> {
        let mut events = self
            .events
            .take()
            .ok_or_else(|| DesktopError::input_failed("libei event stream is unavailable"))?;
        let runtime = self.runtime;
        let result = runtime.block_on(async {
            for _ in 0..DEVICE_REFRESH_LIMIT {
                match tokio::time::timeout(DEVICE_REFRESH_TIMEOUT, events.next()).await {
                    Ok(Some(event)) => self.handle_event(event.map_err(|error| {
                        DesktopError::input_failed(format!("libei device state: {error}"))
                    })?)?,
                    Ok(None) => {
                        return Err(DesktopError::input_failed(
                            "libei disconnected while refreshing device state",
                        ))
                    }
                    Err(_) => return Ok(()),
                }
            }
            Err(DesktopError::input_failed(
                "libei device state did not settle; no input was sent",
            ))
        });
        self.events = Some(events);
        result
    }

    fn handle_event(&mut self, event: EiEvent) -> CoreResult<()> {
        match event {
            EiEvent::SeatAdded(event) => {
                event.seat.bind_capabilities(&[
                    DeviceCapability::PointerAbsolute,
                    DeviceCapability::Pointer,
                    DeviceCapability::Button,
                    DeviceCapability::Scroll,
                    DeviceCapability::Keyboard,
                ]);
                self.context.flush().map_err(|error| {
                    DesktopError::input_failed(format!("libei bind seat: {error}"))
                })?;
            }
            EiEvent::DeviceAdded(event) => {
                self.devices.push(EiDevice {
                    layout: event.device.keymap().and_then(read_keymap),
                    device: event.device,
                    serial: 0,
                    resumed: false,
                });
            }
            EiEvent::DeviceResumed(event) => {
                if let Some(device) = self
                    .devices
                    .iter_mut()
                    .find(|device| device.device == event.device)
                {
                    device.serial = event.serial;
                    device.resumed = true;
                }
            }
            EiEvent::DevicePaused(event) => {
                if let Some(device) = self
                    .devices
                    .iter_mut()
                    .find(|device| device.device == event.device)
                {
                    device.resumed = false;
                }
            }
            EiEvent::DeviceRemoved(event) => {
                self.devices.retain(|device| device.device != event.device);
            }
            EiEvent::SeatRemoved(event) => {
                self.devices
                    .retain(|device| device.device.seat() != &event.seat);
            }
            EiEvent::KeyboardModifiers(event) => {
                if let Some(layout) = self
                    .devices
                    .iter_mut()
                    .find(|device| device.device == event.device)
                    .and_then(|device| device.layout.as_mut())
                {
                    layout.update_modifiers(
                        event.depressed,
                        event.latched,
                        event.locked,
                        event.group,
                    );
                }
            }
            EiEvent::Disconnected(event) => {
                self.devices.clear();
                return Err(DesktopError::input_failed(format!(
                    "libei disconnected: {}",
                    event.explanation
                )));
            }
            _ => {}
        }
        Ok(())
    }

    fn has_capability(&self, capability: DeviceCapability) -> bool {
        self.devices
            .iter()
            .any(|device| device.resumed && device.device.has_capability(capability))
    }
}

pub(super) const fn discovery_complete(targets: Granted, pointer: bool, keyboard: bool) -> bool {
    (!targets.pointer || pointer) && (!targets.keyboard || keyboard)
}

fn read_keymap(keymap: &Keymap) -> Option<KeyboardLayout> {
    if keymap.type_ != ei::keyboard::KeymapType::Xkb || keymap.size == 0 {
        return None;
    }
    let fd = keymap.fd.as_fd().try_clone_to_owned().ok()?;
    KeyboardLayout::from_fd(fd, usize::try_from(keymap.size).ok()?)
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/ax/mod.rs`
```
//! Accessibility tree walking, snapshot rendering, and the `eN` ref registry.

use std::any::Any;
use std::rc::Rc;

pub use crate::backend::{AxBackend, AxOwner};

mod ops;
mod registry;
mod render;
mod roles;
mod walk;

pub use ops::{ax_press, element_at_node, query, register_node};
pub use registry::AxRegistry;
pub use render::snapshot;
pub use roles::{normalize_role_atspi, normalize_role_macos, normalize_role_uia};

/// One accessibility element as the backend that produced it addresses it.
///
/// Handles live on the session thread only (`Rc`): platform elements such as
/// `AXUIElement` carry no cross-thread guarantee.
#[derive(Clone)]
pub enum AxHandle {
    /// Numeric element id, for backends that address elements by id.
    Id(u64),
    /// Platform element (AXUIElement, UIElement, AT-SPI object ref) owned by
    /// the backend that created it; that backend downcasts it back.
    Native(Rc<dyn Any>),
}

impl AxHandle {
    pub fn native<T: Any>(element: T) -> Self {
        Self::Native(Rc::new(element))
    }

    /// The platform element when this handle wraps a `T`.
    pub fn downcast_native<T: Any>(&self) -> Option<&T> {
        match self {
            Self::Native(element) => element.downcast_ref(),
            Self::Id(_) => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct AxProps {
    pub role: String,
    pub native_role: String,
    pub title: Option<String>,
    pub value: Option<String>,
    pub description: Option<String>,
    pub enabled: bool,
    pub focused: bool,
    pub bounds: Option<AxBounds>,
    pub actions: Vec<String>,
    pub child_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AxBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[cfg(test)]
mod tests;

```

### Core Architecture Module: `crates/senpi-desktop-core/src/ax/ops.rs`
```
//! `ax.query` / `ax.elementAt` / ref registration and the press action.

use super::walk::{label, walk_raw, WalkState};
use super::{AxBackend, AxHandle, AxProps, AxRegistry};
use crate::error::CoreResult;
use crate::types::{AxNode, AxQuery, DesktopWindow};

const QUERY_MAX_NODES: u32 = 5_000;
const QUERY_MAX_DEPTH: u32 = 24;

fn node_to_wire(reference: String, props: AxProps) -> AxNode {
    let (x, y, width, height) = props.bounds.map_or((None, None, None, None), |b| {
        (Some(b.x), Some(b.y), Some(b.width), Some(b.height))
    });
    AxNode {
        ref_: reference,
        role: props.role,
        native_role: props.native_role,
        title: props.title,
        value: props.value,
        description: props.description,
        enabled: props.enabled,
        focused: props.focused,
        x,
        y,
        width,
        height,
        actions: (!props.actions.is_empty()).then_some(props.actions),
        child_count: props.child_count,
    }
}

/// Case-insensitive substring match on role, label, and value over the
/// unfiltered tree, in document order.
pub fn query(
    backend: &mut dyn AxBackend,
    registry: &mut AxRegistry,
    window: &DesktopWindow,
    query: &AxQuery,
) -> CoreResult<Vec<AxNode>> {
    let target = &window.id;
    let generation = registry.current_generation(target);
    let root = backend.window_root(window)?;
    let mut state = WalkState::new(QUERY_MAX_NODES, QUERY_MAX_DEPTH);
    let Some(root) = walk_raw(backend, root, 0, &mut state)? else {
        return Ok(Vec::new());
    };
    let role = query.role.as_deref().map(str::to_lowercase);
    let title = query.title.as_deref().map(str::to_lowercase);
    let value = query.value.as_deref().map(str::to_lowercase);
    let limit = usize::try_from(query.limit.unwrap_or(100).min(QUERY_MAX_NODES)).unwrap_or(usize::MAX);
    let contains = |actual: Option<&str>, expected: Option<&String>| {
        expected.is_none_or(|needle| actual.is_some_and(|text| text.to_lowercase().contains(needle)))
    };
    let mut result = Vec::new();
    let mut stack = vec![root];
    while let Some(node) = stack.pop() {
        stack.extend(node.children.iter().rev().cloned());
        if contains(Some(&node.props.role), role.as_ref())
            && contains(label(&node.props), title.as_ref())
            && contains(node.props.value.as_deref(), value.as_ref())
        {
            let reference = registry.register(target, generation, node.handle);
            result.push(node_to_wire(reference, node.props));
            if result.len() >= limit {
                break;
            }
        }
    }
    Ok(result)
}

pub fn register_node(
    backend: &mut dyn AxBackend,
    registry: &mut AxRegistry,
    target: &str,
    handle: AxHandle,
) -> CoreResult<AxNode> {
    let props = backend.props(&handle)?;
    let generation = registry.current_generation(target);
    let reference = registry.register(target, generation, handle);
    Ok(node_to_wire(reference, props))
}

/// Hit-test at global logical desktop coordinates; needs no prior capture.
pub fn element_at_node(
    backend: &mut dyn AxBackend,
    registry: &mut AxRegistry,
    target: &str,
    x: f64,
    y: f64,
) -> CoreResult<Option<AxNode>> {
    let Some(handle) = backend.element_at(x, y)? else {
        return Ok(None);
    };
    register_node(backend, registry, target, handle).map(Some)
}

pub fn ax_press(backend: &mut dyn AxBackend, handle: &AxHandle) -> CoreResult<()> {
    backend.perform(handle, "press")
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/ax/registry.rs`
```
use std::collections::HashMap;

use super::AxHandle;
use crate::error::{CoreResult, DesktopError};

/// Hard ceiling on live refs across all targets.
const MAX_ENTRIES: usize = 5_000;

struct Registered {
    handle: AxHandle,
    target_key: String,
    generation: u64,
}

/// Maps `eN` refs to handles. Each target keeps its current and previous
/// snapshot generation alive; anything older resolves to `StaleRef`.
pub struct AxRegistry {
    next_ref: u64,
    generations: HashMap<String, u64>,
    entries: HashMap<u64, Registered>,
}

impl Default for AxRegistry {
    fn default() -> Self {
        Self {
            next_ref: 1,
            generations: HashMap::new(),
            entries: HashMap::new(),
        }
    }
}

impl AxRegistry {
    /// Starts a new generation for `target`, dropping refs two generations old.
    pub fn begin_snapshot(&mut self, target: &str) -> u64 {
        let generation = self.generations.entry(target.to_string()).or_default();
        *generation = generation.saturating_add(1);
        let current = *generation;
        self.entries
            .retain(|_, entry| entry.target_key != target || entry.generation.saturating_add(1) >= current);
        current
    }

    pub fn current_generation(&mut self, target: &str) -> u64 {
        *self.generations.entry(target.to_string()).or_insert(1)
    }

    pub fn register(&mut self, target: &str, generation: u64, handle: AxHandle) -> String {
        let id = self.next_ref;
        self.next_ref = self.next_ref.saturating_add(1);
        self.entries.insert(
            id,
            Registered {
                handle,
                target_key: target.to_string(),
                generation,
            },
        );
        self.enforce_cap();
        format!("e{id}")
    }

    pub fn resolve(&self, reference: &str) -> CoreResult<AxHandle> {
        self.entry(reference).map(|entry| entry.handle.clone())
    }

    pub fn target(&self, reference: &str) -> CoreResult<String> {
        self.entry(reference).map(|entry| entry.target_key.clone())
    }

    fn entry(&self, reference: &str) -> CoreResult<&Registered> {
        reference
            .strip_prefix('e')
            .and_then(|id| id.parse::<u64>().ok())
            .and_then(|id| self.entries.get(&id))
            .ok_or_else(|| DesktopError::stale_ref(format!("{reference} expired; re-run ax()/find()")))
    }

    fn enforce_cap(&mut self) {
        while self.entries.len() > MAX_ENTRIES {
            let mut target_sizes: HashMap<&str, usize> = HashMap::new();
            for entry in self.entries.values() {
                *target_sizes.entry(&entry.target_key).or_default() += 1;
            }
            let Some(target) = target_sizes
                .into_iter()
                .max_by_key(|(_, count)| *count)
                .map(|(target, _)| target.to_string())
            else {
                break;
            };
            let Some(oldest) = self
                .entries
                .values()
                .filter(|entry| entry.target_key == target)
                .map(|entry| entry.generation)
                .min()
            else {
                break;
            };
            self.entries
                .retain(|_, entry| entry.target_key != target || entry.generation != oldest);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;

    #[test]
    fn generations_keep_current_and_previous() {
        let mut r = AxRegistry::default();
        for g in 1..=3 {
            let generation = r.begin_snapshot("x");
            r.register("x", generation, AxHandle::Id(g));
        }
        assert!(r.resolve("e1").is_err());
        assert!(r.resolve("e2").is_ok());
        assert!(r.resolve("e3").is_ok());
    }
    #[test]
    fn hard_cap_evicts_oldest_generation_of_largest_target() {
        let mut r = AxRegistry::default();
        let g = r.current_generation("x");
        for n in 0..5_001 {
            r.register("x", g, AxHandle::Id(n));
        }
        assert!(r.entries.len() <= 5_000);
        assert!(r.resolve("e1").is_err());
    }
    #[test]
    fn ref_from_generation_n_minus_two_is_stale_ref() {
        // Given: e1..e5 registered in generation N-2, then two newer snapshots.
        let mut r = AxRegistry::default();
        let old = r.begin_snapshot("x");
        for n in 1..=5 {
            r.register("x", old, AxHandle::Id(n));
        }
        r.begin_snapshot("x");
        r.begin_snapshot("x");
        // When
        let error = r.resolve("e5").err().map(|error| error.code);
        // Then
        assert_eq!(error, Some(ErrorCode::StaleRef));
    }
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/ax/render.rs`
```
//! `ax.snapshot`: the filtered tree rendered as an indented ref'd outline.

use super::walk::{filter_node, label, walk_raw, WalkNode, WalkState};
use super::{AxBackend, AxRegistry};
use crate::error::CoreResult;
use crate::types::{AxSnapshot, AxSnapshotOptions, DesktopWindow};

fn escaped_truncated(value: &str, max: usize) -> String {
    let mut out: String = value.chars().take(max).collect();
    if value.chars().count() > max {
        out.push('…');
    }
    out.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', " ")
}

fn push_line(text: &mut String, line: &str) {
    if !text.is_empty() {
        text.push('\n');
    }
    text.push_str(line);
}

struct TreeWriter<'a> {
    window: &'a DesktopWindow,
    registry: &'a mut AxRegistry,
    generation: u64,
    text: String,
    nodes: u32,
}

impl TreeWriter<'_> {
    fn write(&mut self, node: WalkNode, depth: usize) {
        let reference = self
            .registry
            .register(&self.window.id, self.generation, node.handle);
        let mut line = format!("{}- {}", "  ".repeat(depth), node.props.role);
        if let Some(label) = label(&node.props) {
            line.push_str(&format!(" \"{}\"", escaped_truncated(label, 80)));
        }
        line.push_str(&format!(" [ref={reference}]"));
        if depth == 0 {
            line.push_str(&format!(" app={}", self.window.app));
        }
        if let Some(value) = node.props.value.as_deref().filter(|value| !value.is_empty()) {
            line.push_str(&format!(": \"{}\"", escaped_truncated(value, 80)));
        }
        if !node.props.enabled {
            line.push_str(" (disabled)");
        }
        // The root's own AXFocused only reflects app-local focus; report the
        // global roster flag instead.
        let focused = if depth == 0 {
            self.window.focused
        } else {
            node.props.focused
        };
        if focused {
            line.push_str(" (focused)");
        }
        push_line(&mut self.text, &line);
        self.nodes += 1;
        for child in node.children {
            self.write(child, depth + 1);
        }
    }
}

pub fn snapshot(
    backend: &mut dyn AxBackend,
    registry: &mut AxRegistry,
    window: &DesktopWindow,
    options: &AxSnapshotOptions,
) -> CoreResult<AxSnapshot> {
    let generation = registry.begin_snapshot(&window.id);
    let root = backend.window_root(window)?;
    let mut state = WalkState::new(
        options.max_nodes.unwrap_or(800).max(1),
        options.max_depth.unwrap_or(24),
    );
    let root = walk_raw(backend, root, 0, &mut state)?
        .and_then(|node| filter_node(node, options.all.unwrap_or(false)));
    let mut writer = TreeWriter {
        window,
        registry,
        generation,
        text: String::new(),
        nodes: 0,
    };
    if let Some(root) = root {
        writer.write(root, 0);
    }
    let TreeWriter {
        mut text,
        nodes: node_count,
        ..
    } = writer;
    if state.truncated {
        push_line(&mut text, &format!("… truncated ({} nodes)", state.visited));
    }
    if state.skipped > 0 {
        push_line(
            &mut text,
            &format!("… skipped {} unreadable nodes", state.skipped),
        );
    }
    Ok(AxSnapshot {
        text,
        node_count,
        truncated: state.truncated,
    })
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/ax/roles.rs`
```
//! Native accessibility roles -> the cross-platform role vocabulary.

/// Maps a raw `AX*` macOS accessibility role.
pub fn normalize_role_macos(native: &str) -> String {
    match native {
        "AXTextArea" => "textarea",
        "AXTextField" => "textfield",
        "AXPopUpButton" => "popupbutton",
        "AXRadioButton" => "radio",
        "AXCheckBox" => "checkbox",
        "AXStaticText" => "statictext",
        "AXScrollArea" => "scrollarea",
        "AXTabGroup" => "tabgroup",
        "AXWebArea" => "webarea",
        "AXRow" => "row",
        "AXCell" => "cell",
        "AXOutline" => "outline",
        _ => native.strip_prefix("AX").unwrap_or(native),
    }
    .to_ascii_lowercase()
}

/// Maps a Windows UI Automation control type name.
pub fn normalize_role_uia(native: &str) -> String {
    match native {
        "Edit" => "textfield",
        "Document" => "textarea",
        "Text" => "statictext",
        "Hyperlink" => "link",
        "Pane" => "group",
        "TabItem" => "tab",
        "Tab" => "tabgroup",
        "DataItem" => "listitem",
        "DataGrid" => "table",
        "SplitButton" => "popupbutton",
        other => return other.to_ascii_lowercase(),
    }
    .to_string()
}

/// Maps an AT-SPI role name; `multiline` splits text entries into textarea.
pub fn normalize_role_atspi(native: &str, multiline: bool) -> String {
    match native.to_ascii_lowercase().as_str() {
        "push button" | "toggle button" => "button".into(),
        "entry" | "text" if multiline => "textarea".into(),
        "entry" | "text" => "textfield".into(),
        "label" => "statictext".into(),
        "page tab" => "tab".into(),
        "page tab list" => "tabgroup".into(),
        "table cell" => "cell".into(),
        "tree" => "outline".into(),
        "tree item" => "outlineitem".into(),
        "frame" | "dialog" => "window".into(),
        other => other.replace(' ', ""),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalization_tables() {
        for (native, role) in [
            ("AXTextArea", "textarea"),
            ("AXTextField", "textfield"),
            ("AXPopUpButton", "popupbutton"),
            ("AXRadioButton", "radio"),
            ("AXCheckBox", "checkbox"),
            ("AXStaticText", "statictext"),
            ("AXScrollArea", "scrollarea"),
            ("AXTabGroup", "tabgroup"),
            ("AXWebArea", "webarea"),
            ("AXRow", "row"),
            ("AXCell", "cell"),
            ("AXOutline", "outline"),
            ("AXButton", "button"),
        ] {
            assert_eq!(normalize_role_macos(native), role);
        }
        for (native, role) in [
            ("Edit", "textfield"),
            ("Document", "textarea"),
            ("Text", "statictext"),
            ("Hyperlink", "link"),
            ("Pane", "group"),
            ("TabItem", "tab"),
            ("Tab", "tabgroup"),
            ("DataItem", "listitem"),
            ("DataGrid", "table"),
            ("SplitButton", "popupbutton"),
            ("Button", "button"),
        ] {
            assert_eq!(normalize_role_uia(native), role);
        }
        for (native, multiline, role) in [
            ("push button", false, "button"),
            ("toggle button", false, "button"),
            ("entry", false, "textfield"),
            ("text", true, "textarea"),
            ("label", false, "statictext"),
            ("page tab", false, "tab"),
            ("page tab list", false, "tabgroup"),
            ("table cell", false, "cell"),
            ("tree", false, "outline"),
            ("tree item", false, "outlineitem"),
            ("frame", false, "window"),
            ("dialog", false, "window"),
            ("list item", false, "listitem"),
        ] {
            assert_eq!(normalize_role_atspi(native, multiline), role);
        }
    }
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/ax/walk.rs`
```
//! Raw tree walk with depth/node budgets, and the default noise filter.

use super::{AxBackend, AxHandle, AxProps};
use crate::error::CoreResult;

#[derive(Clone)]
pub(super) struct WalkNode {
    pub(super) handle: AxHandle,
    pub(super) props: AxProps,
    pub(super) children: Vec<Self>,
}

pub(super) struct WalkState {
    pub(super) visited: u32,
    pub(super) skipped: u32,
    max_nodes: u32,
    max_depth: u32,
    pub(super) truncated: bool,
}

impl WalkState {
    pub(super) const fn new(max_nodes: u32, max_depth: u32) -> Self {
        Self {
            visited: 0,
            skipped: 0,
            max_nodes,
            max_depth,
            truncated: false,
        }
    }
}

/// Walks from `handle`; unreadable non-root nodes are skipped and counted.
pub(super) fn walk_raw(
    backend: &mut dyn AxBackend,
    handle: AxHandle,
    depth: u32,
    state: &mut WalkState,
) -> CoreResult<Option<WalkNode>> {
    if depth > state.max_depth || state.visited >= state.max_nodes {
        state.truncated = true;
        return Ok(None);
    }
    state.visited += 1;
    let props = match backend.props(&handle) {
        Ok(props) => props,
        Err(_) if depth > 0 => {
            state.skipped = state.skipped.saturating_add(1);
            return Ok(None);
        }
        Err(error) => return Err(error),
    };
    let child_handles = match backend.children(&handle) {
        Ok(children) => children,
        Err(_) if depth > 0 => {
            state.skipped = state.skipped.saturating_add(1);
            return Ok(None);
        }
        Err(error) => return Err(error),
    };
    let mut children = Vec::new();
    for child in child_handles {
        if let Some(child) = walk_raw(backend, child, depth + 1, state)? {
            children.push(child);
        }
        if state.truncated && state.visited >= state.max_nodes {
            break;
        }
    }
    Ok(Some(WalkNode {
        handle,
        props,
        children,
    }))
}

fn named(props: &AxProps) -> bool {
    [&props.title, &props.value, &props.description]
        .into_iter()
        .flatten()
        .any(|value| !value.trim().is_empty())
}

/// Display and match name for a node. Many toolbar controls — Chrome's
/// Back/Forward/Reload among them — carry no `AXTitle` and name themselves
/// through `AXDescription` alone.
pub(super) fn label(props: &AxProps) -> Option<&str> {
    [props.title.as_deref(), props.description.as_deref()]
        .into_iter()
        .flatten()
        .map(str::trim)
        .find(|label| !label.is_empty())
}

fn interactable(props: &AxProps) -> bool {
    !props.actions.is_empty()
        || matches!(
            props.role.as_str(),
            "button"
                | "checkbox"
                | "radio"
                | "textfield"
                | "textarea"
                | "link"
                | "menuitem"
                | "tab"
                | "slider"
                | "combobox"
                | "popupbutton"
                | "listitem"
                | "outlineitem"
                | "cell"
        )
}

fn structural(role: &str) -> bool {
    matches!(
        role,
        "window"
            | "group"
            | "webarea"
            | "list"
            | "table"
            | "row"
            | "menu"
            | "menubar"
            | "tabgroup"
            | "toolbar"
            | "scrollarea"
            | "outline"
    )
}

/// Keeps interactable/named nodes and non-empty structure; collapses
/// anonymous single-child groups. `all` keeps everything.
pub(super) fn filter_node(mut node: WalkNode, all: bool) -> Option<WalkNode> {
    node.children = node
        .children
        .into_iter()
        .filter_map(|child| filter_node(child, all))
        .collect();
    if all {
        return Some(node);
    }
    let keep_self = interactable(&node.props) || named(&node.props);
    if !keep_self && node.props.role == "group" && node.children.len() == 1 {
        return node.children.pop();
    }
    if keep_self || (structural(&node.props.role) && !node.children.is_empty()) {
        Some(node)
    } else {
        None
    }
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/backend.rs`
```
//! The shared `Backend`/`AxBackend` traits every platform backend implements.
//!
//! FROZEN after the core port: the focus-guard, cursor, release, and
//! lock-screen hooks have no-op defaults so a backend without the capability
//! compiles unchanged and reports `focus_guard: false`.

use image::RgbaImage;

use crate::ax::{AxHandle, AxProps};
use crate::error::{CoreResult, DesktopError, TccPermission};
use crate::frame::FrameGeometry;
use crate::keys::KeyName;
use crate::types::{
    CaptureCaps, DesktopCapabilities, DesktopDisplay, DesktopPoint, DesktopWindow, FrontWindow, Target,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DeliveryMode {
    #[default]
    Background,
    Foreground,
}

impl DeliveryMode {
    pub fn parse(value: Option<&str>) -> Self {
        if value.is_some_and(|value| value.trim().eq_ignore_ascii_case("foreground")) {
            Self::Foreground
        } else {
            Self::Background
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MouseButton {
    #[default]
    Left,
    Right,
    Middle,
}

impl MouseButton {
    pub fn parse(value: Option<&str>) -> CoreResult<Self> {
        match value.map(str::trim) {
            None => Ok(Self::Left),
            Some(value) if value.eq_ignore_ascii_case("left") => Ok(Self::Left),
            Some(value) if value.eq_ignore_ascii_case("right") => Ok(Self::Right),
            Some(value) if value.eq_ignore_ascii_case("middle") => Ok(Self::Middle),
            Some(value) => Err(DesktopError::input_failed(format!("unknown button '{value}'"))),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Modifiers {
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool,
}

#[derive(Debug, Clone)]
pub enum PointerEvent {
    Click {
        x: f64,
        y: f64,
        button: MouseButton,
        count: u32,
        modifiers: Modifiers,
    },
    Move {
        x: f64,
        y: f64,
    },
    Drag {
        path: Vec<(f64, f64)>,
        button: MouseButton,
        modifiers: Modifiers,
    },
    Scroll {
        x: f64,
        y: f64,
        dx: f64,
        dy: f64,
    },
}

pub trait Backend: Send {
    fn permission_denied(&mut self, _permission: TccPermission) -> DesktopError {
        DesktopError::permission_denied("input permission is not granted")
    }

    fn capabilities(&mut self) -> DesktopCapabilities;
    fn displays(&mut self) -> CoreResult<Vec<DesktopDisplay>>;
    fn windows(&mut self) -> CoreResult<Vec<DesktopWindow>>;
    fn capture(&mut self, target: &Target, caps: &CaptureCaps) -> CoreResult<(RgbaImage, FrameGeometry)>;
    fn pointer(
        &mut self,
        target: &Target,
        ev: PointerEvent,
        frame: &FrameGeometry,
        mode: DeliveryMode,
    ) -> CoreResult<()>;
    fn type_text(&mut self, target: &Target, text: &str, mode: DeliveryMode) -> CoreResult<()>;
    /// The system clipboard's text. Backends without clipboard access keep
    /// this default and refuse instead of pretending.
    fn clipboard_read(&mut self) -> CoreResult<String> {
        Err(DesktopError::internal("this desktop backend has no clipboard access"))
    }

    /// Replaces the system clipboard's text.
    fn clipboard_write(&mut self, _text: &str) -> CoreResult<()> {
        Err(DesktopError::internal("this desktop backend has no clipboard access"))
    }
    /// Backends with incremental text delivery check between Unicode scalars
    /// and report each fully delivered scalar. The default preserves the
    /// existing one-call behavior for backends without incremental input.
    fn type_text_interruptible(
        &mut self,
        target: &Target,
        text: &str,
        mode: DeliveryMode,
        check_stop: &dyn Fn() -> CoreResult<()>,
        delivered: &mut dyn FnMut(),
    ) -> CoreResult<()> {
        check_stop()?;
        self.type_text(target, text, mode)?;
        for _ in text.chars() {
            delivered();
        }
        Ok(())
    }
    fn key_chord(&mut self, target: &Target, keys: &[KeyName], mode: DeliveryMode) -> CoreResult<()>;
    fn raise_window(&mut self, id: &str) -> CoreResult<()>;
    fn ax(&mut self) -> Option<&mut dyn AxBackend>;

    /// Releases every button and key this backend may still hold down.
    fn release_all(&mut self) -> CoreResult<()> {
        Ok(())
    }

    /// Current global logical cursor position, when the platform exposes it.
    fn cursor_position(&mut self) -> CoreResult<Option<DesktopPoint>> {
        Ok(None)
    }

    /// Moves the cursor to a global logical point without clicking.
    fn warp_cursor(&mut self, _point: DesktopPoint) -> CoreResult<()> {
        Ok(())
    }

    /// The window that currently owns the foreground, for the focus guard.
    fn front_window(&mut self) -> CoreResult<Option<FrontWindow>> {
        Ok(None)
    }

    /// Brings a previously captured front window back to the foreground.
    fn restore_front_window(&mut self, _front: &FrontWindow) -> CoreResult<()> {
        Ok(())
    }

    /// Hands key focus back to `front` (macOS after `activate_without_raise`).
    fn restore_key_focus(&mut self, _front: &FrontWindow) -> CoreResult<()> {
        Ok(())
    }

    /// Whether the interactive session is behind the lock screen.
    fn screen_locked(&mut self) -> CoreResult<bool> {
        Ok(false)
    }
}

/// The native window that owns an accessibility element.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AxOwner {
    /// The owner's id, in the form [`Backend::windows`] lists it.
    Window(String),
    /// The backend cannot name the owner; callers must not guess it.
    Unknown,
}

pub trait AxBackend {
    fn window_root(&mut self, win: &DesktopWindow) -> CoreResult<AxHandle>;
    fn props(&mut self, h: &AxHandle) -> CoreResult<AxProps>;
    fn children(&mut self, h: &AxHandle) -> CoreResult<Vec<AxHandle>>;
    fn parent(&mut self, h: &AxHandle) -> CoreResult<Option<AxHandle>>;
    fn perform(&mut self, h: &AxHandle, action: &str) -> CoreResult<()>;
    fn set_value(&mut self, h: &AxHandle, value: &str) -> CoreResult<()>;
    fn focus(&mut self, h: &AxHandle) -> CoreResult<()>;
    fn element_at(&mut self, x: f64, y: f64) -> CoreResult<Option<AxHandle>>;
    fn focused_element(&mut self) -> CoreResult<Option<AxHandle>>;
    fn attributes(&mut self, h: &AxHandle) -> CoreResult<Vec<(String, String)>>;

    /// The window that owns `h`, read live from the platform and named as
    /// `windows` (the live [`Backend::windows`]) lists it. Backends that
    /// cannot name it keep this default.
    fn owner(&mut self, _h: &AxHandle, _windows: &[DesktopWindow]) -> CoreResult<AxOwner> {
        Ok(AxOwner::Unknown)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delivery_only_escalates_explicit_foreground() {
        assert_eq!(DeliveryMode::parse(None), DeliveryMode::Background);
        assert_eq!(DeliveryMode::parse(Some("garbage")), DeliveryMode::Background);
        assert_eq!(
            DeliveryMode::parse(Some(" FoReGrOuNd ")),
            DeliveryMode::Foreground
        );
    }
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/clipboard.rs`
```
//! The system text clipboard, shared by the native backends.
//!
//! Only UTF-8 text is read and written. A clipboard holding no text reads as
//! the empty string.

use arboard::{Clipboard, Error as ClipboardError};

use crate::error::{CoreResult, DesktopError};

/// The clipboard's current text; empty when it holds no text.
///
/// # Errors
/// `Internal` when the platform clipboard cannot be opened or read.
pub fn read_text() -> CoreResult<String> {
    with_clipboard(|clipboard| match clipboard.get_text() {
        Ok(text) => Ok(text),
        Err(ClipboardError::ContentNotAvailable) => Ok(String::new()),
        Err(error) => Err(DesktopError::internal(format!("reading the clipboard failed: {error}"))),
    })
}

/// Replaces the clipboard's contents with `text`.
///
/// # Errors
/// `Internal` when the platform clipboard cannot be opened or written.
pub fn write_text(text: &str) -> CoreResult<()> {
    with_clipboard(|clipboard| {
        clipboard
            .set_text(text)
            .map_err(|error| DesktopError::internal(format!("writing the clipboard failed: {error}")))
    })
}

fn open() -> CoreResult<Clipboard> {
    Clipboard::new().map_err(|error| DesktopError::internal(format!("opening the clipboard failed: {error}")))
}

/// X11 selections are owner-based: the text a process set is served only while
/// its `Clipboard` lives, so Linux keeps one for the whole process instead of
/// dropping it after each write (oh-my-pi `set_clipboard_text`).
#[cfg(target_os = "linux")]
fn with_clipboard<T>(act: impl FnOnce(&mut Clipboard) -> CoreResult<T>) -> CoreResult<T> {
    use std::sync::{Mutex, PoisonError};

    static CLIPBOARD: Mutex<Option<Clipboard>> = Mutex::new(None);
    let mut slot = CLIPBOARD.lock().unwrap_or_else(PoisonError::into_inner);
    if slot.is_none() {
        *slot = Some(open()?);
    }
    slot.as_mut()
        .map_or_else(|| Err(DesktopError::internal("the clipboard could not be opened")), act)
}

/// macOS and Windows keep clipboard contents after the writer is gone, so a
/// short-lived handle per call is enough.
#[cfg(not(target_os = "linux"))]
fn with_clipboard<T>(act: impl FnOnce(&mut Clipboard) -> CoreResult<T>) -> CoreResult<T> {
    act(&mut open()?)
}

#[cfg(test)]
mod live_tests {
    use super::{read_text, write_text};

    /// Touches the real system clipboard, so it runs only where the CI
    /// workflow asks for it on a disposable runner; it restores what was there.
    #[test]
    #[ignore = "live: writes the real system clipboard (hosted CI runners only)"]
    fn a_written_text_reads_back_from_the_system_clipboard() {
        let previous = read_text().expect("the clipboard reads");
        let probe = "senpi-clipboard-roundtrip-\u{1F4CB}";
        write_text(probe).expect("the clipboard writes");
        let read = read_text();
        write_text(&previous).expect("the previous text is restored");
        println!("clipboard_roundtrip={:?}", read.as_deref() == Ok(probe));
        assert_eq!(read.as_deref(), Ok(probe));
    }
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/error.rs`
```
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Desktop error vocabulary shared by the engine, the wire, and the host.
///
/// FROZEN: oh-my-pi's codes plus the stop-path, suspension, lock-screen,
/// cancellation, and restore-transaction codes. Adding a code needs a plan
/// amendment because the TS protocol and numeric JSON-RPC codes derive from it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
pub enum ErrorCode {
    PermissionDenied,
    CaptureFailed,
    InputFailed,
    BackgroundUnavailable,
    WindowNotFound,
    InvalidTarget,
    InvalidKey,
    InvalidCoordinateFrame,
    StaleRef,
    AxUnsupported,
    AxFailed,
    Timeout,
    Closed,
    Internal,
    StopPathUnavailable,
    Suspended,
    ScreenLocked,
    /// A request aborted by `$/cancel` or a host abort.
    Cancelled,
    CursorRestoreFailed,
    FocusRestoreFailed,
    TransactionFailed,
}

impl ErrorCode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::PermissionDenied => "PermissionDenied",
            Self::CaptureFailed => "CaptureFailed",
            Self::InputFailed => "InputFailed",
            Self::BackgroundUnavailable => "BackgroundUnavailable",
            Self::WindowNotFound => "WindowNotFound",
            Self::InvalidTarget => "InvalidTarget",
            Self::InvalidKey => "InvalidKey",
            Self::InvalidCoordinateFrame => "InvalidCoordinateFrame",
            Self::StaleRef => "StaleRef",
            Self::AxUnsupported => "AxUnsupported",
            Self::AxFailed => "AxFailed",
            Self::Timeout => "Timeout",
            Self::Closed => "Closed",
            Self::Internal => "Internal",
            Self::StopPathUnavailable => "StopPathUnavailable",
            Self::Suspended => "Suspended",
            Self::ScreenLocked => "ScreenLocked",
            Self::Cancelled => "Cancelled",
            Self::CursorRestoreFailed => "CursorRestoreFailed",
            Self::FocusRestoreFailed => "FocusRestoreFailed",
            Self::TransactionFailed => "TransactionFailed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum TccPermission {
    ScreenRecording,
    Accessibility,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PermissionDeniedData {
    pub permission: TccPermission,
    pub settings_url: String,
    pub app: String,
    pub relaunch_required: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[error("{}: {}", .code.as_str(), .message)]
pub struct DesktopError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permission: Option<PermissionDeniedData>,
}

impl DesktopError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            permission: None,
        }
    }

    pub fn permission_denied(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::PermissionDenied, message)
    }

    pub fn permission_denied_with(data: PermissionDeniedData, message: impl Into<String>) -> Self {
        Self {
            permission: Some(data),
            ..Self::permission_denied(message)
        }
    }

    pub fn capture_failed(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::CaptureFailed, message)
    }

    pub fn input_failed(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InputFailed, message)
    }

    pub fn background_unavailable(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::BackgroundUnavailable, message)
    }

    pub fn window_not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::WindowNotFound, message)
    }

    pub fn invalid_target(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidTarget, message)
    }

    pub fn invalid_key(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidKey, message)
    }

    pub fn invalid_coordinate_frame(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidCoordinateFrame, message)
    }

    pub fn stale_ref(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::StaleRef, message)
    }

    pub fn ax_unsupported() -> Self {
        Self::new(
            ErrorCode::AxUnsupported,
            "accessibility is unavailable on this backend",
        )
    }

    pub fn ax_failed(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::AxFailed, message)
    }

    pub fn timeout(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Timeout, message)
    }

    pub fn closed() -> Self {
        Self::new(ErrorCode::Closed, "desktop session is closed")
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Internal, message)
    }
}

pub type CoreResult<T> = Result<T, DesktopError>;

```

### Core Architecture Module: `crates/senpi-desktop-core/src/frame/caps.rs`
```
use image::imageops::FilterType;
use image::RgbaImage;

use super::{round_to_u32, FrameGeometry};
use crate::error::{CoreResult, DesktopError};
use crate::types::CaptureCaps;

pub const MAX_COMPOSITE_PIXELS: u64 = 268_435_456;

/// Downscales `image` to fit `caps` (aspect preserved) and rescales the frame
/// so later pointer coordinates still map back to the right logical points.
pub fn apply_capture_caps(
    image: RgbaImage,
    geometry: &mut FrameGeometry,
    caps: &CaptureCaps,
) -> CoreResult<RgbaImage> {
    if image.width() == 0 || image.height() == 0 {
        return Err(DesktopError::capture_failed("capture returned an empty image"));
    }
    if caps.max_width == Some(0) || caps.max_height == Some(0) {
        return Err(DesktopError::invalid_target(
            "capture caps must be greater than zero",
        ));
    }
    let mut ratio = 1.0f64;
    if let Some(max_width) = caps.max_width {
        ratio = ratio.min(f64::from(max_width) / f64::from(image.width()));
    }
    if let Some(max_height) = caps.max_height {
        ratio = ratio.min(f64::from(max_height) / f64::from(image.height()));
    }
    let width = round_to_u32(f64::from(image.width()) * ratio).max(1);
    let height = round_to_u32(f64::from(image.height()) * ratio).max(1);
    if u64::from(width) * u64::from(height) > MAX_COMPOSITE_PIXELS {
        return Err(DesktopError::capture_failed(format!(
            "composite {width}x{height} exceeds the native safety limit"
        )));
    }
    if width == image.width() && height == image.height() {
        return Ok(image);
    }
    let ratio_x = f64::from(width) / f64::from(image.width());
    let ratio_y = f64::from(height) / f64::from(image.height());
    geometry.scaled(ratio_x, ratio_y, width, height);
    Ok(image::imageops::resize(
        &image,
        width,
        height,
        FilterType::Triangle,
    ))
}

```

### Core Architecture Module: `crates/senpi-desktop-core/src/frame/encode.rs`
```
use std::io::Cursor;

use image::{DynamicImage, ImageFormat, RgbaImage};

use crate::error::{CoreResult, DesktopError};

pub fn encode_png(image: RgbaImage) -> CoreResult<Vec<u8>> {
    let mut png = Vec::with_capacity(image.len() / 2);
    DynamicImage::ImageRgba8(image)
        .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
        .map_err(|error| DesktopError::capture_failed(format!("PNG encoding failed: {error}")))?;
    Ok(png)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9365** (2026-10-04): **computer tool is dead after any extension hot-reload: every call fails "stale extension generation after reload" until the app relaunches**
  *Symptoms*: ## Summary After any extension hot-reload in a live session, the `computer` tool can no longer be used in that session. Every call fails with **"stale extension generation after reload"** until the whole app is relaunched.  Observed on omo 5.1.7 / senpi 2026.9.30, the bundled engine of desktop nightly 0.0.34-nightly.20261001.679: 1. A session ran normally; then a file was added under `~/.omo/agent/extensions/`, and the next turn showed "Hot-reloading ... / Hot-reloaded ...". 2. Same session: `await tool.computer({ action: "capabilities" })` -> `stale extension generation after reload`. Retrying after an eval kernel reset gives the same error, `computer` is undefined as a global, and `tool_search` still lists the `computer` tool. 3. Quit and relaunch the app, then run the same call in a new thread: it returns the real capabilities object (capture granted, input/AX denied, stopPath host-relay).  ## Expected A hot-reload re-registers the computer tool with the new generation, so the next call works. At minimum the error says "relaunch the session to use computer use", and the tool is withdrawn from the catalog instead of being offered and then refusing.  ## Actual The tool is offered and fails on every call, and the model has to guess that a full app relaunch is needed.  Related: #7932 (another stale-generation crash after reload, closed).
  **Post-Mortem & Fix Analysis**:
  > I found a likely host-side reload path worth checking. This is static source analysis, not a reproduction of the reported desktop session.  In the reported Senpi v2026.9.30 source, `AgentSession` initializes `_lazyToolActivators` once, appends each runner's activator registrations, and checks the retained callbacks in registration order ([field](https://github.com/code-yeongyu/senpi/blob/245b6ef75064b143c4a8184487f152bc519bff95/packages/coding-agent/src/core/agent-session.ts#L1142), [registration](https://github.com/code-yeongyu/senpi/blob/245b6ef75064b143c4a8184487f152bc519bff95/packages/coding-agent/src/core/agent-session.ts#L7985-L7987), [activation](https://github.com/code-yeongyu/senpi/blob/245b6ef75064b143c4a8184487f152bc519bff95/packages/coding-agent/src/core/agent-session.ts#L3498-L3507)). The builtin tool-search extension binds its service to that generation's `pi` and registers an activator over the service ([registration](https://github.com/code-yeongyu/senpi/blob/245b6ef750
  > Screenshots from the QA run (isolated profile, names and paths sanitized):  <img width="900" alt="screenshot" src="https://github.com/user-attachments/assets/d4884e10-87ef-4ec2-9858-60b041886f16" />
  > Engine implementation is in [senpi PR #2506](https://github.com/code-yeongyu/senpi/pull/2506), intentionally unmerged.  The host rebuilt the extension runner and tool registry but retained old lazy-tool activators. A deferred computer call could consult the retired tool-search API before reaching its replacement implementation. The fix discards those activators before rebinding the runtime; the stale-generation guard remains intact.  Confirmed release baseline: **senpi tag v2026.9.30** (`245b6ef75064b143c4a8184487f152bc519bff95`), with the native engine from **OmO v5.1.7**. A persistent in-process RPC session returned real computer capabilities, returned the tool to deferred exposure, changed an extension file, observed `reload_completed`, and then returned `stale extension generation after reload`.  The fixed source and compiled binary passed the same sequence. A restart-required extension veto emitted `reload_deferred` with its reason, and capabilities still worked in the retained ge

- **Issue #9363** (2026-10-04): **senpi-task state lands in the user repository again: <project>/.omo/senpi-task is created on the first turn, so later subagent records go into the project (regression of #9201)**
  *Symptoms*: ## Summary #9201 moved senpi-task and thread-tools state out of the user's repository: `resolveProjectStateDirectory` uses `~/.omo/agent/projects/<folder>-<hash>/` unless `<project>/.omo/<name>` **already exists**. On omo 5.1.7 (desktop nightly 0.0.34-nightly.20261001.679, bundled engine), something creates `<project>/.omo/senpi-task` during the **first turn of a fresh session**, before any task runs. The legacy "pre-existing in-project dir" branch then wins, and every later subagent writes its task record, logs and child sessions into the user's repository again.  ## Reproduction 1. Fresh isolated HOME; `git init` a small project with no `.omo/` folder. 2. Desktop app (or omo) session in that project. Turn 1: read-only (reads + one eval cell). No tasks. 3. `stat` shows `<project>/.omo` and `<project>/.omo/senpi-task` both created at the time of turn 1. The agent dir also has `~/.omo/agent/projects/<folder>-<hash>/senpi-task/locks` (empty) and `thread-tools/mailbox`. 4. Turn 2: spawn one background subagent (category quick).  Observed after turn 2: ``` $ git status --short ?? .omo/ $ find .omo -type f .omo/senpi-task/tasks/st_<id>.json .omo/senpi-task/logs/st_<id>.jsonl .omo/senpi-task/children/st_<id>/sessions/st_<id>/<ts>.jsonl .omo/senpi-task/children/st_<id>/sessions/st_<id>/session-holders/<id>/<pid>.json ``` The desktop then shows "2 changed files: .omo/senpi-task" in that turn's changed-files card, as if the user's code had changed.  ## Expected - Nothing under `<proje
  **Post-Mortem & Fix Analysis**:
  > Screenshots from the QA run (isolated profile, names and paths sanitized):  <img width="900" alt="screenshot" src="https://github.com/user-attachments/assets/56bff76a-b3ce-4ef9-807e-e3dc5047b60d" />
  > Closing: fixed and released.  - **The creator side.** The desktop no longer creates `<project>/.omo/senpi-task` on its own: it observes runtime state without making project directories (omo-desktop-app#1463, merge 37894e9). The task plugin ignores empty legacy state scaffolding (#9395, merge f7eb995, released in v5.1.12). - **The reload side.** Creating a non-config directory no longer counts as a config change, so it doesn't trigger an extension reload (senpi#2522, merge 2d971e9, released in senpi v2026.10.2).  A packaged proof on builds carrying all three showed it: the first message in a fresh project caused 0 extension reloads, `git status --porcelain` stayed empty (no `.omo` created), and todo / read / tool_search / eval all ran for real afterwards. Current desktop builds pin omo 5.1.15 / senpi 2026.10.6, which include all of these. 

- **Issue #9362** (2026-10-01): **Compiled runtime: Bun.$`bun ...` in the eval kernel runs the engine binary instead of bun (phantom agent turn returned as exit-0 stdout)**
  *Symptoms*: ## Summary In the compiled runtime (the standalone `omo-<platform>` binary and the desktop app's bundled engine), a shell call to `bun` from the JS eval kernel (`Bun.$\`bun ...\``) runs **the omo engine binary itself** instead of Bun whenever no `bun` is on `PATH`. That is the normal case for a Finder/Dock-launched desktop app and for a get.omo.dev install on a machine without Bun.  The engine treats the leftover arguments as a prompt, so the agent's `bun test` turns into a **nested agent turn**. Its chat reply comes back as the command's stdout with **exit code 0**. The agent and the user see a plausible-looking "success" that never ran any test.  ## Reproduction  ### A. Standalone compiled omo v5.1.7 (darwin-arm64 release asset) ```sh mkdir -p /tmp/repro/home/.omo/agent /tmp/repro/proj && cd /tmp/repro/proj # any working provider key in home/.omo/agent/auth.json (a Z.AI API key was used) env -i HOME=/tmp/repro/home PATH=/usr/bin:/bin:/usr/sbin:/sbin \   /tmp/repro/omo-darwin-arm64 -p --provider zai --model zai/glm-5.3 \   'Run exactly one js eval cell: const r = await Bun.$`bun --version`.nothrow().quiet(); ({exit: r.exitCode, out: r.stdout.toString(), execPath: process.execPath})' ``` Eval tool result, verbatim from the session file: ```json {"exit":0,"out":"omo 5.1.7 (engine: senpi 2026.9.30; scheme nodef)\n","execPath":"/private/tmp/repro/home/.omo/binary-runtime/5.1.7/omo"} ``` `bun --version` printed **omo's** version: `bun` resolved to the engine binary.  ### B. Deskt
  **Post-Mortem & Fix Analysis**:
  > Desktop tracking issue: https://github.com/code-yeongyu/omo-desktop-app/issues/1417. Standalone check (case A in the body) was run on the v5.1.7 darwin-arm64 release asset: affected.
  > Root cause confirmed and fix in review: code-yeongyu/senpi#2494.  **Mechanism (measured with a minimal compiled probe).** Bun Shell runs `bun` as `process.execPath` when `PATH` has no Bun. The child gets the same argv and argv0 as a normal launch of the compiled app, so the engine cannot detect it from the inside. `Bun.spawn(["bun"])` does not fall back; it fails with ENOENT. A real `/bin/sh` (the bash tool) reports `bun: command not found`. With `BUN_BE_BUN=1`, the same binary behaves as Bun 1.4.2.  **Owner: senpi.** The desktop app compiles its own entry, not omo's `compile-entry.ts`, so the shared fix belongs in the engine. `getShellEnv()` (bash tool, terminal) and the eval kernels' session env get a directory appended to `PATH` holding `bun`/`bunx` scripts that run the executable with `BUN_BE_BUN=1`. A user's own Bun stays first, and the engine's own environment never carries `BUN_BE_BUN`.  **RED on the released v5.1.7 binary.** A mock OpenAI-compatible model drives one real agent 
  > Screenshots from the QA run (isolated profile, names and paths sanitized):  <img width="900" alt="screenshot" src="https://github.com/user-attachments/assets/9936207c-2980-47e3-8fb8-06867cdf8a5d" />

- **Issue #9198** (2026-09-29): **omo update can exit 0 and leave the previous version installed on a Bun-global install**
  *Symptoms*: ## Summary  On a Bun-global install, `omo update` can finish without moving to the release that is already live on npm, and nothing tells the user it didn't update. Right after 5.1.2 shipped, `omo update` on a machine running 5.1.1 ran for about 7 minutes and left 5.1.1 installed. `bun add -g omo-ai@5.1.2` on the same machine then installed 5.1.2 in 3.4 s.  ## Reproduction (observed)  1. npm `omo-ai` dist-tag `latest` = 5.1.2. The registry document is `last-modified: 2026-09-29T14:01:47Z`, the tarball returns 200, and GitHub release v5.1.2 is Latest. 2. At about 14:10Z, on macOS arm64 with Bun 1.4.2 and a Bun-global install of `omo-ai@5.1.1` (28 global packages, host load average 40-60), run `omo update`. 3. `omo update` spawns `bun add -g omo-ai`. After about 7 minutes it exits, and `omo --version` still prints `omo 5.1.1 (engine: senpi 2026.9.29)`. 4. On the same machine, `bun add -g omo-ai@5.1.2` finishes in 3.4 s, and `omo --version` then prints `omo 5.1.2 (engine: senpi 2026.9.29-3)`.  A clean control does not reproduce it. With a temporary `BUN_INSTALL` and cache, installing `omo-ai@5.1.1` and then running the bare `bun add -g omo-ai` moves to 5.1.2 in 6.6 s. So the bare spec works in a small tree. What fails is the update path on a real install.  ## Expected  `omo update` ends on the version the channel's dist-tag names, or it fails loudly. It must not exit with the old version still installed and nothing to warn the user.  ## Actual  - `packages/omo-native/bin/lib/pac
  **Post-Mortem & Fix Analysis**:
  > Fix is up in #9200.  - Root cause confirmed on dev 79ab21eb77: `updateTarget()` spawned the unpinned spec, and `runSelfUpdate()` counted any manager exit 0 as success. - RED on dev: 11 new tests, `0 pass / 11 fail`. This includes the unchanged-after-exit-0 case, which returned 0. - GREEN: `bun test packages/omo-native/test` -> 564 pass, 0 fail; `bun run typecheck` -> exit 0. - Real update in an isolated `BUN_INSTALL`: `omo-ai@5.1.1` -> `omo update` runs `bun add -g omo-ai@5.1.2` -> `omo --version` prints `omo 5.1.2 (engine: senpi 2026.9.29-3)`. A second run says up to date and installs nothing. A package manager that exits 0 without installing now ends with `omo is still 5.1.1; 5.1.2 is published` plus the retry command, exit 1. 
  > Fixed by #9200, merged into `dev` as merge commit 1153254903c77e4f9007f5ec49021d24cbd1d883 (parents 9aaae4d221, ba73450297). It ships in the next omo patch.  Evidence on the merged head: - CI: 23 pass, 7 skipping, 0 fail. - `bun test packages/omo-native/test`: 564 pass, 0 fail. - The 11 new tests went from 0/11 on dev to 11/11 with the fix. - `bun run typecheck`: exit 0. - Real update in an isolated `BUN_INSTALL`: `omo-ai@5.1.1` -> `omo update` -> `bun add -g omo-ai@5.1.2` -> `omo --version` prints `omo 5.1.2 (engine: senpi 2026.9.29-3)`. - A package manager that exits 0 without installing now ends with `omo is still 5.1.1; 5.1.2 is published` and the retry command, exit 1. 

- **Issue #9149** (2026-10-03): **[Bug]: omo-native doctor.test.ts reads the host process table and an inherited OMO_CODING_AGENT_DIR**
  *Symptoms*: ## Summary  Four `packages/omo-native/test/doctor.test.ts` cases fail when the suite runs on a machine that is itself running omo, or inside an omo session. The doctor child they spawn is not isolated from the host:  1. It reads the **real host process table**. `bin/lib/doctor.js` `staleEngineReport` defaults `options.list` to `listProcesses` (`ps`), so every live engine on the host becomes a `WARN engine pid ... started before this payload was installed` line in the fixture's doctor output. 2. It can read the **real agent dir**. `run()` in the test sets only `SENPI_CODING_AGENT_DIR` (`env: { ...process.env, SENPI_CODING_AGENT_DIR: fixture.agentDir }`). An inherited `OMO_CODING_AGENT_DIR` outranks that variable, so a run launched from an omo session points doctor at the developer's real agent dir, not at the fixture's `settings.json`. This is the same class as #8967.  ## Failing cases (reproduced on untouched `dev` 1b3bb502b)  - `settings contain the legacy package entry` > string shape / object shape: expected `WARN duplicate @code-yeongyu/omo-senpi`, which is absent. - `settings JSON is malformed` > diagnostics warn and continue. - `SENPI_CODING_AGENT_DIR points to an alternate agent directory` > reads settings from that directory first.  The captured doctor stdout contains the host's `WARN engine pid <n> (age ..., tty ...)` lines, and the fixture's settings warnings are missing.  ## Expected  The doctor tests never observe the host: the process list is injected (or the spa

- **Issue #9147** (2026-09-29): **[Bug]: OpenCode -> Native migration drops metis/momus agent models silently; Native plan agents fall back to builtin chains**
  *Symptoms*: ## Summary  A user moving from the OpenCode edition to OmO Native can lose their per-agent model settings without any notice. Native's builtin agents then fall back to their builtin chains, which is how a Native `plan-consultant` ended up on a gateway model in #9146. #9146 fixes the routing itself; this issue covers the migration gap that let it happen.  ## What happens today  - `omo setup` (since #8846, fixing #8816) reads the OpenCode edition's `agents.*` and carries over only the agents whose names Native also uses. For every other name it prints `omo has no agent of that name ...; route that work through a category instead` (`packages/omo-native/bin/lib/setup-opencode-models.js:206-214`). - The OpenCode edition's plan agents have different names from their Native counterparts: `metis` (pre-planning consultant) and `momus` (plan reviewer) versus Native's `plan-consultant` and `plan-reviewer`. Setup does not map them, so a model the user chose for `metis`/`momus` is reported as unmappable instead of carried to the Native agent that does the same job. - The startup config migration (`runSenpiStartupMigration`, group `2026-07-opencode-config-unification`) moves legacy OpenCode-edition files into the `[opencode]` harness block. A user who never runs `omo setup` gets no message at all: their `[opencode]` `agents.*` exist, Native ignores them, and the Native builtin agents silently run their builtin chains.  ## Expected (ideal state)  - Setup maps OpenCode-edition agent names to
  **Post-Mortem & Fix Analysis**:
  > Fixed by #9171 (merge commit de133a361ec1804470ff59f2802a4298e3686915), together with #9167. Thanks @MoerAI for #9167, which maps `metis` -> `plan-consultant` and `momus` -> `plan-reviewer` in `omo setup`; this PR reuses that mapping.  **What landed** - `omo setup` offers `agents.metis` / `agents.momus` models as `plan-consultant` / `plan-reviewer` (#9167). - Native's first start reports every OpenCode-edition agent/category model setting that Native does not use. It shows **one** warning with "run omo setup to carry them over" and, for each setting, the exact `"[native]": { ... }` member to add. Only the `2026-09-opencode-routing-notice` marker is written, so later starts are quiet (#9171). - `omo doctor` prints the same line as `INFO` for as long as the gap exists.  Why a notice instead of an automatic copy: #7270 deliberately stopped the automatic legacy migration from importing agent and category registries. `omo setup` carries them after checking each model against the engine and 

- **Issue #9146** (2026-09-29): **[Bug]: Builtin category/agent chains silently route to OpenRouter (and other gateways) the user never configured**
  *Symptoms*: ## Summary  Built-in delegation chains (categories and agents) silently route to a provider they do not list. On a machine whose only connected provider is OpenRouter, the builtin categories and agents resolve to `openrouter/anthropic/claude-opus-5.5` and `openrouter/openai/gpt-6-astra`, and the user is billed on OpenRouter for models they never configured. This was reported in the community Discord: the user had no Anthropic provider configured anywhere, yet their OpenRouter key was charged for Claude models until they restricted it to an allowlist.  ## Reproduction  Call the real resolvers on `dev` (1b3bb502b) with a registry that holds only OpenRouter's catalog. No network is involved.  ```ts resolveCategory("visual-engineering", {}, openRouterOnlyRegistry)   // -> openrouter/anthropic/claude-opus-5.5 (max) resolveCategory("ultrabrain", {}, openRouterOnlyRegistry)           // -> openrouter/openai/gpt-6-astra (max) resolveAgent("plan-consultant", agents, openRouterOnlyRegistry)     // -> openrouter/anthropic/claude-opus-5.5 ```  | builtin | resolved to | |---|---| | visual-engineering, artistry, unspecified-high, writing | `openrouter/anthropic/claude-opus-5.5` | | ultrabrain, deep-high | `openrouter/openai/gpt-6-astra` | | deep-low | `openrouter/openai/gpt-5.6-sol` | | quick, explore, librarian | `openrouter/~deepseek/deepseek-flash-latest` | | unspecified-low | `openrouter/xiaomi/mimo-v2.6-pro` | | plan-consultant, omo-native-code-reviewer | `openrouter/anthropic/claude-
  **Post-Mortem & Fix Analysis**:
  > Root cause confirmed and fix up in #9148.  - Root cause: `delegate-core` `resolveModelForDelegateTask` fell through to an unfiltered cross-provider fuzzy match after a rung's listed providers missed (shared by both editions), and `senpi-task` gates unwrapped `<gateway>/<vendor>/<id>` ids. The reported `plan-consultant` shape resolved Opus 5.5 through the first path. - RED on dev sources: 54 new cases fail (3 delegate-core, 43 senpi-task, 8 OpenCode delegate-task); GREEN on the branch. - Live run (real engine + plugin, real `openrouter` provider with a fake key pointed at a local request logger, all other egress to a dead proxy): dev plugin sent **8** unrequested OpenRouter requests (Opus 5.5, GPT-6 Astra, deepseek); the fix sends **0**, only the explicitly pinned control model reaches OpenRouter, and each hidden category shows the exact `categories.<name>.model = "openrouter/..."` opt-in line.
  > Closed by #9148, merged as d69d696ac (merge commit) on `dev`.  **What users get:** builtin categories, builtin agents and `model_profile` lanes resolve only on the providers their chains list. A gateway (OpenRouter, opengateway, a Vercel gateway, a custom proxy) is used only when the user pins it; a hidden category names the exact opt-in line (`categories.<name>.model = "<gateway>/<model>"`) in the task notice and in `omo doctor`.  **Evidence** - CI on merged head 9544f8e4f: all required checks green. - RED on dev sources: 54 new cases fail (delegate-core 3, senpi-task 43, OpenCode delegate-task 8); all pass on the branch. - Suites: senpi-task 3005/0, delegate-core 13/0, OpenCode delegate-task 512/0, omo-senpi model-profile 111/0, omo-native coverage 12/0; `tsgo` clean on delegate-core, senpi-task, omo-senpi, omo-native. - Live run (real engine + built plugin, real `openrouter` provider with a fake key pointed at a local request logger, other egress to a dead proxy): dev plugin 8 unreq

- **Issue #9069** (2026-09-28): **Task record diverges from the live child: settled on the first non-retrying agent_end (TTSR nudge, monitor wake) and a start without a session stays running**
  *Symptoms*: ## Summary Split out of #9061 (item "task record status diverges from the live child session"). A process-mode child's task record can say `error` or `completed` while its session keeps running, and a spawn can say "Started" and stay `running` for minutes without ever opening a session.  ## A. `error` while the session keeps working (root cause found) - senpi's builtin TTSR stream rule aborts a bad generation with `ctx.abort("system")`; the aborted run ends with `agent_end` `{ willRetry: false }` (`stopReason: "aborted"`). TTSR then sends its corrective nudge from its `agent_settled` handler with `triggerTurn: true` (`packages/coding-agent/src/core/extensions/builtin/ttsr/index.ts`), so the SAME session starts a new run. - omo settles the child's turn on the first `agent_end` with `willRetry === false` (`packages/senpi-task/src/runners/rpc-host/handle.ts` `onSessionEvent` -> `settleTurn`; `turn-outcome.ts` `agentEndOutcome` maps `aborted` to `error`). The record becomes `error: This operation was aborted`, the parent is told the child failed, and the continuation that follows (20 minutes and ~70 KB of edits in the report) is never attributed. - senpi already emits the right signal: `agent_idle` fires only after the run settled AND no deferred continuation started AND no session work is pending (`agent-session.ts` `_emitAgentIdleAfterDeferredTurns`), and it is broadcast to RPC clients (`session-event-fanout.ts`) since v2026.8.22-2. omo does not use it. The same gap applies to 
  **Post-Mortem & Fix Analysis**:
  > Progress on this issue:  - **A (error while the session keeps working) and B (completed while parked on its own monitor):** fixed by #9085 (merge `ba5a3f1d9`).   - Both process runners now settle a turn on senpi's `agent_idle` rather than the first non-retrying `agent_end`.   - A run the child starts on its own after settling reopens the record under the next run epoch. Its end is delivered as a second completion labelled `task completion (resumed turn)`.   - Live check against a real senpi 2026.9.27-4 host, with a scripted provider whose first reply trips the builtin `fabricated-unavailable-tool-call` rule: before the fix the task ended `error: The operation was aborted.` while the host stream showed `agent_start, agent_end, agent_settled, agent_start, agent_end, agent_settled, agent_idle` and two provider calls. After the fix it ends `completed: "CONTINUED: finished after the nudge"`. - **C ("Started" with no session):** #9086.   - Root cause: a start-time model fallback whose next m
  > All four cases in this issue are fixed and merged:  - **A: error while the session keeps working** and **B: completed while parked on its own monitor** - #9085 (`ba5a3f1d9`).   - The process runners settle a turn on senpi's `agent_idle`, not the first non-retrying `agent_end`.   - A run the child starts on its own after settling reopens the record under the next run epoch. That run ends with a second completion labelled `task completion (resumed turn)`.   - Live check: a scripted provider trips the builtin `fabricated-unavailable-tool-call` rule. Before the fix: `error: The operation was aborted.` while the host kept streaming. After: `completed: "CONTINUED: finished after the nudge"`. - **C: "Started" with no session** - #9086 (`41bde3ed6`).   - A start-time model fallback whose lane is full is reported `pending` with its queue position.   - `task_output` shows `start_queued` until the slot is granted. - **D: handoff or reload leaves a live or finished child "suspended" forever** - #9

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

### Incident Patch 1: `c9a60396` (2026-10-06)
**Commit Message**: Merge pull request #9641 from code-yeongyu/fix/cancel-host-settlement-9484

test(task): synchronize cancellation cleanup witnesses

**File**: `packages/senpi-task/src/runners/rpc-host-cancel-during-recovery.test.ts` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+import { afterEach, describe, expect, spyOn, test } from "bun:test"
+
+import { runTaskCancel } from "../tools/control/cancel"
+import { bounded, hostHolds, recordAt, sessionOf, startCancelLane } from "./rpc-host/__fixtures__/cancel-lane"
+import type { FakeHostSession } from "./rpc-host/__fixtures__/fake-host"
+import type { HostWorld } from "./rpc-host/__fixtures__/host-world"
+import { HostSessionClient, type OpenedHostSession } from "./rpc-host/session-client"
+
+const worlds: HostWorld[] = []
+
+afterEach(async () => {
+  for (const world of worlds.splice(0)) await world.cleanup()
+})
+
+describe("cancellation while transport recovery reads state", () => {
+  test("#given a held recovery state read #when cancellation closes the original process before a late reopen #then the late process also ends without continuing the turn", async () => {
+    const { world, parent } = await startCancelLane(worlds, 1)
+    await parent.startChildren(1)
+    const child = recordAt(parent, 0)
+    const original = sessionOf(world, child)
+    if (original.processExit === undefined) throw new Error("the fixture did not start a session process")
+    world.host.withholdReply("get_state")
+    const stateAsked = world.host.waitForCommand("get_state")
+    const promptsBefore = world.commandsOfType("prompt")
+    world.host.cutConnections()
+    await bounded(stateAsked, "the reattach's state read")
+
+    const cancelled = await bounded(runTaskCancel(parent.manager, { task_id: child.task_id }), "task_cancel")
+    const resumeOpen = Promise.withResolvers<void>()
+    const openStarted = Promise.withResolvers<void>()
+    const lateSession = Promise.withResolvers<{ readonly session: FakeHostSession; readonly attached: boolean }>()
+    const pendingOpens: Promise<OpenedHostSession>[] = []
+    const open = HostSessionClient.prototype.open
+    let gated = false
+    const openSpy = spyOn(HostSessionClient.prototype, "open").mockImplementation(function (this: HostSessionClient, input) {
+      // Hold only this child's recovery; the non-retained cancellation channel still closes it.
+      if (gated || this.socketPath !== world.host.socketPath || input.sessionPath !== original.sessionPath || !input.retainOnDisconnect) return open.call(this, input)
+      gated = true
+      const pending = (async () => {
+        await resumeOpen.promise
+        const opened = await open.call(this, input)
+        lateSession.resolve({ session: sessionOf(world, child), attached: opened.attached })
+        return opened
+      })()
+      pendingOpens.push(pending)
+      void pending.catch(lateSession.reject)
+      openStarted.resolve()
+      return pending
+    })
+
+    try {
+      world.host.allowReply("get_state")
+      world.host.cutConnections()
+      await bounded(openStarted.promise, "the late recovery open")
+      const stopped = await bounded(parent.manager.waitFor(child.task_id), "the cancelled record")
+      await bounded(original.processExit, "the original process exit")
+      expect(hostHolds(world, child)).toBe(false)
+
+      resumeOpen.resolve()
+      const reopened = await bounded(lateSession.promise, "the reopened session")
+      expect(reopened.attached).toBe(false)
+      if (reopened.session.processPid === undefined || reopened.session.processExit === undefined) throw new Error("the late reopen did not start a session process")
+      await bounded(reopened.session.processExit, "the late reopened process exit")
+
+      expect(["cancel_pending", "cancelled"]).toContain(cancelled.details.kind)
+      expect(stopped.status).toBe("cancelled")
+      expect(parent.store.load(child.task_id)?.status).toBe("cancelled")
+      expect(world.commandsOfType("prompt")).toBe(promptsBefore)
+      expect(hostHolds(world, child)).toBe(false)
+    } finally {
+      resumeOpen.resolve()
+      await Promise.allSettled(pendingOpens)
+      openSpy.mockRestore()
+    }
+  })
+})
```

**File**: `packages/senpi-task/src/runners/rpc-host-cancel-pending.test.ts` (modified, +2/-30)
```diff
@@ -225,7 +225,7 @@ describe("a pending cancel always ends the run", () => {
     // when - the host answers its protocol probe but refuses list_sessions, as an overloaded shard does
     world.host.allowReply("open_session")
     world.host.failReply("list_sessions", "host busy")
-    const restarted = world.connect(parent.sessionId, { ...lane.options, productionProbe: true, hostCloseTimeoutMs: 50 })
+    const restarted = world.connect(parent.sessionId, { ...lane.options, productionProbe: true })
     await restarted.lifecycle.reconcileOnSessionStart(parent.sessionId)
 
     // then - "could not ask" is not "nothing is live": the cancel is still pending and the session still held
@@ -235,7 +235,7 @@ describe("a pending cancel always ends the run", () => {
 
     // when - the next session start, with the host listing again
     world.host.failReply("list_sessions", undefined)
-    const again = world.connect(parent.sessionId, { ...lane.options, productionProbe: true, hostCloseTimeoutMs: 50 })
+    const again = world.connect(parent.sessionId, { ...lane.options, productionProbe: true })
     await again.lifecycle.reconcileOnSessionStart(parent.sessionId)
 
     // then
@@ -244,32 +244,4 @@ describe("a pending cancel always ends the run", () => {
     await bounded(session.processExit ?? Promise.resolve(), "the cancelled child's process exit")
   })
 
-  test("#given a child whose transport recovery is reading the reattached session's state #when task_cancel lands during that read #then the turn is never continued and the session ends on the host", async () => {
-    // given - a reattach that gets the connection back but holds its state read
-    const lane = await startCancelLane(worlds, 1)
-    const { world, parent } = lane
-    await parent.startChildren(1)
-    const child = recordAt(parent, 0)
-    const session = sessionOf(world, child)
-    world.host.withholdReply("get_state")
-    const stateAsked = world.host.waitForCommand("get_state")
-    const promptsBefore = world.commandsOfType("prompt")
-    world.host.cutConnections()
-    await bounded(stateAsked, "the reattach's state read")
-
-    // when - the cancel lands during the read, then the host answers state reads again
-    const cancelled = await bounded(runTaskCancel(parent.manager, { task_id: child.task_id }), "task_cancel")
-    world.host.allowReply("get_state")
-    world.host.cutConnections()
-    const stopped = await bounded(parent.manager.waitFor(child.task_id), "the cancelled record")
-
-    // then
-    expect(["cancel_pending", "cancelled"]).toContain(cancelled.details.kind)
-    expect(stopped.status).toBe("cancelled")
-    expect(world.commandsOfType("prompt")).toBe(promptsBefore)
-    // The record turns cancelled as the stop lands; the host drops the session as its close completes.
-    // Wait for that end on the host instead of racing it.
-    await bounded(session.processExit ?? Promise.resolve(), "the cancelled child's process exit")
-    expect(hostHolds(world, child)).toBe(false)
-  })
 })
```

---

### Incident Patch 2: `a61cdc6b` (2026-10-06)
**Commit Message**: Merge pull request #9640 from code-yeongyu/fix/release-stamp-source-2782

fix(publish): preserve the verified release stamping commit

**File**: `.github/workflows/publish.yml` (modified, +17/-12)
```diff
@@ -437,29 +437,27 @@ jobs:
             exit 1
           fi
 
-          # A release commit may only be REUSED when it is the current base head. A stamp that
-          # sits behind the head belongs to an earlier, abandoned attempt: its tree predates every
-          # merge since, so publishing it would ship a version whose contents nobody reviewed under
-          # that number (2026-09-04: a beta.41 retry re-selected the first attempt's stamp, whose
-          # tree lacked the senpi engine bump; only gate-reuse's CI check kept it off npm). Fail
-          # closed and ask for a fresh version number instead of restamping over a live one.
+          # A merged stamping commit remains reusable only while its tree equals the current
+          # base. The merge wrapper must not replace its maintainer attribution, and later
+          # content must never be silently omitted by reusing an abandoned stamp (#7779).
           reuse_or_refuse() {
             local candidate="$1" origin_desc="$2"
-            if [ "$candidate" = "$BASE_HEAD" ]; then
+            if git merge-base --is-ancestor "$candidate" "$BASE_HEAD" &&
+              [ "$(git rev-parse "${candidate}^{tree}")" = "$(git rev-parse "${BASE_HEAD}^{tree}")" ]; then
               echo "release_sha=${candidate}" >> "$GITHUB_OUTPUT"
               echo "needs_push=false" >> "$GITHUB_OUTPUT"
-              echo "${origin_desc} is the current origin/${BASE_REF} head: ${candidate}"
+              echo "${origin_desc} matches the current origin/${BASE_REF} tree: ${candidate}"
               exit 0
             fi
-            echo "::error::${origin_desc} (${candidate}) is stale: origin/${BASE_REF} has moved to ${BASE_HEAD}. Refusing to publish a tree that predates the base head. Bump to an unused version so a fresh release commit is stamped on the current head."
+            echo "::error::${origin_desc} (${candidate}) is stale or unrelated to origin/${BASE_REF} (${BASE_HEAD}). Bump to an unused version so a fresh release commit is stamped on the current head."
             exit 1
           }
 
           if git rev-parse -q --verify "refs/tags/v${VERSION}" >/dev/null; then
             reuse_or_refuse "$(git rev-list --max-count=1 "refs/tags/v${VERSION}")" "Release tag v${VERSION}"
           fi
 
-          RELEASE_SHA="$(git rev-list --max-count=1 --grep="^release: v${VERSION}$" "origin/${BASE_REF}" 2>/dev/null || true)"
+          RELEASE_SHA="$(git rev-list --no-merges --max-count=1 --grep="^release: v${VERSION}$" "origin/${BASE_REF}" 2>/dev/null || true)"
           if [ -n "$RELEASE_SHA" ]; then
             reuse_or_refuse "$RELEASE_SHA" "Release commit for v${VERSION}"
           fi
@@ -609,9 +607,16 @@ jobs:
           for attempt in $(seq 1 120); do
             PR_STATE="$(retry_gh "Read release-state PR state" gh pr view "$PR_NUMBER" --json state --jq '.state')"
             if [ "$PR_STATE" = "MERGED" ]; then
-              RELEASE_SHA="$(retry_gh "Read release-state PR merge SHA" gh pr view "$PR_NUMBER" --json mergeCommit --jq '.mergeCommit.oid')"
+              MERGE_SHA="$(retry_gh "Read release-state PR merge SHA" gh pr view "$PR_NUMBER" --json mergeCommit --jq '.mergeCommit.oid')"
+              RELEASE_SHA="$(retry_gh "Read release-state PR source SHA" gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid')"
+              git fetch origin "$MERGE_SHA" "$RELEASE_SHA"
+              if ! git merge-base --is-ancestor "$RELEASE_SHA" "$MERGE_SHA" ||
+                [ "$(git rev-parse "${RELEASE_SHA}^{tree}")" != "$(git rev-parse "${MERGE_SHA}^{tree}")" ]; then
+                echo "::error::Merged release tree differs from its prepared source; refusing publication."
+                exit 1
+              fi
               echo "release_sha=${RELEASE_SHA}" >> "$GITHUB_OUTPUT"
-              echo "Release-state PR #${PR_NUMBER} merged at ${RELEASE_SHA}"
+              echo "Release-state PR #${PR_NUMBER} merged at ${MERGE_SHA}; publishing stamped source ${RELEASE_SHA}"
               exit 0
             fi
 
```

**File**: `script/publish-stale-stamp-reuse.test.ts` (modified, +111/-1)
```diff
@@ -5,6 +5,7 @@ import { spawnSync } from "node:child_process"
 import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
 import { tmpdir } from "node:os"
 import { join } from "node:path"
+import { z } from "zod"
 
 /**
  * Executes the release-state reuse decision of publish.yml's "prepare" step against a real git
@@ -19,7 +20,11 @@ import { join } from "node:path"
 
 const workflowPath = new URL("../.github/workflows/publish.yml", import.meta.url)
 const workflowText = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n")
-const workflow = Bun.YAML.parse(workflowText) as { jobs: Record<string, { steps: Array<{ id?: string; run?: string }> }> }
+const workflow = z.object({ jobs: z.object({
+  "prepare-release-state": z.object({
+    steps: z.array(z.object({ id: z.string().optional(), run: z.string().optional() })),
+  }),
+}) }).parse(Bun.YAML.parse(workflowText))
 
 function prepareRunBlock(): string {
   const job = workflow.jobs["prepare-release-state"]
@@ -63,6 +68,49 @@ function createFixture(): Fixture {
 
 function pushDev(seed: string): void { git(seed, ["push", "-q", "origin", "dev"]) }
 
+function mergedRelease(fixture: Fixture, version: string, extraContent = false): { readonly stamp: string; readonly merge: string } {
+  const seed = join(fixture.root, "seed")
+  git(seed, ["checkout", "-q", "-b", "release"])
+  const stamp = commit(seed, `release: v${version}`)
+  git(seed, ["checkout", "-q", "dev"])
+  if (extraContent) {
+    writeFileSync(join(seed, "later.txt"), "merged after preparation\n")
+    git(seed, ["add", "later.txt"])
+    git(seed, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "later change"])
+  }
+  git(seed, ["-c", "user.email=noreply@github.com", "-c", "user.name=GitHub", "merge", "--no-ff", "-q", "release", "-m", `Merge release\n\nrelease: v${version}`])
+  pushDev(seed)
+  return { stamp, merge: git(seed, ["rev-parse", "HEAD"]) }
+}
+
+function runMergedSelection(fixture: Fixture, stamp: string, merge: string): { readonly status: number; readonly output: string } {
+  const step = workflow.jobs["prepare-release-state"].steps.find((candidate) => candidate.id === "publish_state")
+  if (!step?.run) throw new Error("missing publish_state shell")
+  const start = step.run.indexOf('if [ "$PR_STATE" = "MERGED" ]; then')
+  const end = step.run.indexOf("FAILURES=", start)
+  if (start < 0 || end < 0) throw new Error("missing merged-PR selection block")
+  const outputFile = join(fixture.root, "merged_output")
+  writeFileSync(outputFile, "")
+  const script = join(fixture.root, "merged.sh")
+  writeFileSync(script, `set -euo pipefail
+retry_gh() { shift; "$@"; }
+gh() {
+  case "\${*: -1}" in
+    .mergeCommit.oid) printf '%s\\n' "$FIXTURE_MERGE" ;;
+    .headRefOid) printf '%s\\n' "$FIXTURE_STAMP" ;;
+    *) return 99 ;;
+  esac
+}
+PR_STATE=MERGED
+PR_NUMBER=1
+${step.run.slice(start, end)}`)
+  const result = spawnSync("bash", [script], {
+    cwd: fixture.work, encoding: "utf8", timeout: 20_000,
+    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", FIXTURE_STAMP: stamp, FIXTURE_MERGE: merge, GITHUB_OUTPUT: outputFile },
+  })
+  return { status: result.status ?? -1, output: readFileSync(outputFile, "utf8") }
+}
+
 function runPrepare(fixture: Fixture, version: string): { status: number; stdout: string; stderr: string; outputs: Record<string, string> } {
   const outputFile = join(fixture.root, "github_output")
   writeFileSync(outputFile, "")
@@ -109,4 +157,66 @@ describe("publish.yml prepare-release-state reuse decision", () => {
       expect(result.outputs.needs_push).toBe("false")
     } finally { rmSync(fixture.root, { recursive: true, force: true }) }
   })
+
+  for (const tagged of [false, true]) {
+    test(`#given a merged stamping commit${tagged ? " with a tag" : ""} #when preparation resumes #then the original source is reused`, () => {
+      const fixture = createFixture()
+      try {
+        const version = "9.9.9-beta.3"
+        const { stamp, merge } = mergedRelease(fixture, version)
+        if (tagged) {
+          const seed = join(fixture.root, "seed")
+          git(seed, ["tag", `v${version}`, stamp])
+          git(seed, ["push", "-q", "origin", `v${version}`])
+        }
+
+        const result = runPrepare(fixture, version)
+
+        expect(result.status).toBe(0)
+        expect(result.outputs.release_sha).toBe(stamp)
+        expect(result.outputs.release_sha).not.toBe(merge)
+        expect(result.outputs.needs_push).toBe("false")
+      } finally { rmSync(fixture.root, { recursive: true, force: true }) }
+    })
+  }
+
+  test("#given an unrelated tagged commit with an identical tree #when preparation resumes #then it refuses that source", () => {
+    const fixture = createFixture()
+    try {
+      const version = "9.9.9-beta.4"
+      const { stamp, merge } = mergedRelease(fixture, version)
+      const seed = join(fixture.root, "seed")
+      git(seed, ["ch
```

---

### Incident Patch 3: `417ea53c` (2026-10-06)
**Commit Message**: fix(publish): preserve the verified release stamping commit

Keep the maintainer-created source commit when a merge adds no content.
Require ancestry and identical trees before selecting it, preserve stale
release refusal, and exclude merge-message matches from retry discovery.

Refs code-yeongyu/senpi#2782

**File**: `.github/workflows/publish.yml` (modified, +17/-12)
```diff
@@ -437,29 +437,27 @@ jobs:
             exit 1
           fi
 
-          # A release commit may only be REUSED when it is the current base head. A stamp that
-          # sits behind the head belongs to an earlier, abandoned attempt: its tree predates every
-          # merge since, so publishing it would ship a version whose contents nobody reviewed under
-          # that number (2026-09-04: a beta.41 retry re-selected the first attempt's stamp, whose
-          # tree lacked the senpi engine bump; only gate-reuse's CI check kept it off npm). Fail
-          # closed and ask for a fresh version number instead of restamping over a live one.
+          # A merged stamping commit remains reusable only while its tree equals the current
+          # base. The merge wrapper must not replace its maintainer attribution, and later
+          # content must never be silently omitted by reusing an abandoned stamp (#7779).
           reuse_or_refuse() {
             local candidate="$1" origin_desc="$2"
-            if [ "$candidate" = "$BASE_HEAD" ]; then
+            if git merge-base --is-ancestor "$candidate" "$BASE_HEAD" &&
+              [ "$(git rev-parse "${candidate}^{tree}")" = "$(git rev-parse "${BASE_HEAD}^{tree}")" ]; then
               echo "release_sha=${candidate}" >> "$GITHUB_OUTPUT"
               echo "needs_push=false" >> "$GITHUB_OUTPUT"
-              echo "${origin_desc} is the current origin/${BASE_REF} head: ${candidate}"
+              echo "${origin_desc} matches the current origin/${BASE_REF} tree: ${candidate}"
               exit 0
             fi
-            echo "::error::${origin_desc} (${candidate}) is stale: origin/${BASE_REF} has moved to ${BASE_HEAD}. Refusing to publish a tree that predates the base head. Bump to an unused version so a fresh release commit is stamped on the current head."
+            echo "::error::${origin_desc} (${candidate}) is stale or unrelated to origin/${BASE_REF} (${BASE_HEAD}). Bump to an unused version so a fresh release commit is stamped on the current head."
             exit 1
           }
 
           if git rev-parse -q --verify "refs/tags/v${VERSION}" >/dev/null; then
             reuse_or_refuse "$(git rev-list --max-count=1 "refs/tags/v${VERSION}")" "Release tag v${VERSION}"
           fi
 
-          RELEASE_SHA="$(git rev-list --max-count=1 --grep="^release: v${VERSION}$" "origin/${BASE_REF}" 2>/dev/null || true)"
+          RELEASE_SHA="$(git rev-list --no-merges --max-count=1 --grep="^release: v${VERSION}$" "origin/${BASE_REF}" 2>/dev/null || true)"
           if [ -n "$RELEASE_SHA" ]; then
             reuse_or_refuse "$RELEASE_SHA" "Release commit for v${VERSION}"
           fi
@@ -609,9 +607,16 @@ jobs:
           for attempt in $(seq 1 120); do
             PR_STATE="$(retry_gh "Read release-state PR state" gh pr view "$PR_NUMBER" --json state --jq '.state')"
             if [ "$PR_STATE" = "MERGED" ]; then
-              RELEASE_SHA="$(retry_gh "Read release-state PR merge SHA" gh pr view "$PR_NUMBER" --json mergeCommit --jq '.mergeCommit.oid')"
+              MERGE_SHA="$(retry_gh "Read release-state PR merge SHA" gh pr view "$PR_NUMBER" --json mergeCommit --jq '.mergeCommit.oid')"
+              RELEASE_SHA="$(retry_gh "Read release-state PR source SHA" gh pr view "$PR_NUMBER" --json headRefOid --jq '.headRefOid')"
+              git fetch origin "$MERGE_SHA" "$RELEASE_SHA"
+              if ! git merge-base --is-ancestor "$RELEASE_SHA" "$MERGE_SHA" ||
+                [ "$(git rev-parse "${RELEASE_SHA}^{tree}")" != "$(git rev-parse "${MERGE_SHA}^{tree}")" ]; then
+                echo "::error::Merged release tree differs from its prepared source; refusing publication."
+                exit 1
+              fi
               echo "release_sha=${RELEASE_SHA}" >> "$GITHUB_OUTPUT"
-              echo "Release-state PR #${PR_NUMBER} merged at ${RELEASE_SHA}"
+              echo "Release-state PR #${PR_NUMBER} merged at ${MERGE_SHA}; publishing stamped source ${RELEASE_SHA}"
               exit 0
             fi
 
```

**File**: `script/publish-stale-stamp-reuse.test.ts` (modified, +111/-1)
```diff
@@ -5,6 +5,7 @@ import { spawnSync } from "node:child_process"
 import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
 import { tmpdir } from "node:os"
 import { join } from "node:path"
+import { z } from "zod"
 
 /**
  * Executes the release-state reuse decision of publish.yml's "prepare" step against a real git
@@ -19,7 +20,11 @@ import { join } from "node:path"
 
 const workflowPath = new URL("../.github/workflows/publish.yml", import.meta.url)
 const workflowText = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n")
-const workflow = Bun.YAML.parse(workflowText) as { jobs: Record<string, { steps: Array<{ id?: string; run?: string }> }> }
+const workflow = z.object({ jobs: z.object({
+  "prepare-release-state": z.object({
+    steps: z.array(z.object({ id: z.string().optional(), run: z.string().optional() })),
+  }),
+}) }).parse(Bun.YAML.parse(workflowText))
 
 function prepareRunBlock(): string {
   const job = workflow.jobs["prepare-release-state"]
@@ -63,6 +68,49 @@ function createFixture(): Fixture {
 
 function pushDev(seed: string): void { git(seed, ["push", "-q", "origin", "dev"]) }
 
+function mergedRelease(fixture: Fixture, version: string, extraContent = false): { readonly stamp: string; readonly merge: string } {
+  const seed = join(fixture.root, "seed")
+  git(seed, ["checkout", "-q", "-b", "release"])
+  const stamp = commit(seed, `release: v${version}`)
+  git(seed, ["checkout", "-q", "dev"])
+  if (extraContent) {
+    writeFileSync(join(seed, "later.txt"), "merged after preparation\n")
+    git(seed, ["add", "later.txt"])
+    git(seed, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "later change"])
+  }
+  git(seed, ["-c", "user.email=noreply@github.com", "-c", "user.name=GitHub", "merge", "--no-ff", "-q", "release", "-m", `Merge release\n\nrelease: v${version}`])
+  pushDev(seed)
+  return { stamp, merge: git(seed, ["rev-parse", "HEAD"]) }
+}
+
+function runMergedSelection(fixture: Fixture, stamp: string, merge: string): { readonly status: number; readonly output: string } {
+  const step = workflow.jobs["prepare-release-state"].steps.find((candidate) => candidate.id === "publish_state")
+  if (!step?.run) throw new Error("missing publish_state shell")
+  const start = step.run.indexOf('if [ "$PR_STATE" = "MERGED" ]; then')
+  const end = step.run.indexOf("FAILURES=", start)
+  if (start < 0 || end < 0) throw new Error("missing merged-PR selection block")
+  const outputFile = join(fixture.root, "merged_output")
+  writeFileSync(outputFile, "")
+  const script = join(fixture.root, "merged.sh")
+  writeFileSync(script, `set -euo pipefail
+retry_gh() { shift; "$@"; }
+gh() {
+  case "\${*: -1}" in
+    .mergeCommit.oid) printf '%s\\n' "$FIXTURE_MERGE" ;;
+    .headRefOid) printf '%s\\n' "$FIXTURE_STAMP" ;;
+    *) return 99 ;;
+  esac
+}
+PR_STATE=MERGED
+PR_NUMBER=1
+${step.run.slice(start, end)}`)
+  const result = spawnSync("bash", [script], {
+    cwd: fixture.work, encoding: "utf8", timeout: 20_000,
+    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", FIXTURE_STAMP: stamp, FIXTURE_MERGE: merge, GITHUB_OUTPUT: outputFile },
+  })
+  return { status: result.status ?? -1, output: readFileSync(outputFile, "utf8") }
+}
+
 function runPrepare(fixture: Fixture, version: string): { status: number; stdout: string; stderr: string; outputs: Record<string, string> } {
   const outputFile = join(fixture.root, "github_output")
   writeFileSync(outputFile, "")
@@ -109,4 +157,66 @@ describe("publish.yml prepare-release-state reuse decision", () => {
       expect(result.outputs.needs_push).toBe("false")
     } finally { rmSync(fixture.root, { recursive: true, force: true }) }
   })
+
+  for (const tagged of [false, true]) {
+    test(`#given a merged stamping commit${tagged ? " with a tag" : ""} #when preparation resumes #then the original source is reused`, () => {
+      const fixture = createFixture()
+      try {
+        const version = "9.9.9-beta.3"
+        const { stamp, merge } = mergedRelease(fixture, version)
+        if (tagged) {
+          const seed = join(fixture.root, "seed")
+          git(seed, ["tag", `v${version}`, stamp])
+          git(seed, ["push", "-q", "origin", `v${version}`])
+        }
+
+        const result = runPrepare(fixture, version)
+
+        expect(result.status).toBe(0)
+        expect(result.outputs.release_sha).toBe(stamp)
+        expect(result.outputs.release_sha).not.toBe(merge)
+        expect(result.outputs.needs_push).toBe("false")
+      } finally { rmSync(fixture.root, { recursive: true, force: true }) }
+    })
+  }
+
+  test("#given an unrelated tagged commit with an identical tree #when preparation resumes #then it refuses that source", () => {
+    const fixture = createFixture()
+    try {
+      const version = "9.9.9-beta.4"
+      const { stamp, merge } = mergedRelease(fixture, version)
+      const seed = join(fixture.root, "seed")
+      git(seed, ["ch
```

---

### Incident Patch 4: `d790c26f` (2026-10-05)
**Commit Message**: test(memory): count concurrent sandbox probe invocations

Replace the elapsed-time assumption with a counter written by the real
executable. Both concurrent requests must share one spawn, independent of
host scheduling speed, and the fixture directory is removed afterward.

Fixes #9636

**File**: `packages/omo-senpi/src/components/memory/sandbox-bwrap-probe.test.ts` (modified, +18/-18)
```diff
@@ -1,5 +1,5 @@
 import { describe, expect, test } from "bun:test"
-import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
+import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
 import { tmpdir } from "node:os"
 import { join } from "node:path"
 
@@ -120,25 +120,25 @@ describe.skipIf(process.platform === "win32")("probeBwrapUsability", () => {
     expect(usability.usable).toBe(false)
   }, 30_000)
 
-  test("#given a probed executable #when probed again concurrently #then the second call returns immediately from the memoized promise without spawning again", async () => {
-    // given: a stand-in executable that we can time
-    const binDir = mkdtempSync(join(tmpdir(), "omo-bwrap-probe-timing-"))
+  test("#given concurrent probes #when both complete #then they share one executable invocation", async () => {
+    // given
+    const binDir = mkdtempSync(join(tmpdir(), "omo-bwrap-probe-concurrent-"))
     const executable = join(binDir, "bwrap")
-    writeFileSync(executable, "#!/bin/sh\nexit 0\n")
+    writeFileSync(executable, "#!/bin/sh\nprintf 'spawn\\n' >> \"$0.spawns\"\nexit 0\n")
     chmodSync(executable, 0o755)
 
-    // when: start the first probe and immediately start the second while the first is pending
-    const start = Date.now()
-    const firstPromise = probeBwrapUsability(executable)
-    const secondPromise = probeBwrapUsability(executable)
-    const [first, second] = await Promise.all([firstPromise, secondPromise])
-    const elapsed = Date.now() - start
-
-    // then: both completed with the same verdict from a single spawn
-    // The second probe should return almost instantly (< 5ms) from the pending promise cache,
-    // not spawn a new child. Total elapsed should be roughly one spawn time, not two.
-    expect(first).toEqual({ usable: true })
-    expect(second).toEqual({ usable: true })
-    expect(elapsed).toBeLessThan(500) // One spawn should be much faster than two
+    try {
+      // when: both requests start before the event loop can deliver the first child close.
+      const firstPromise = probeBwrapUsability(executable)
+      const secondPromise = probeBwrapUsability(executable)
+      const [first, second] = await Promise.all([firstPromise, secondPromise])
+
+      // then
+      expect(first).toEqual({ usable: true })
+      expect(second).toEqual({ usable: true })
+      expect(readFileSync(`${executable}.spawns`, "utf8")).toBe("spawn\n")
+    } finally {
+      rmSync(binDir, { recursive: true, force: true })
+    }
   }, 30_000)
 })
```

---

### Incident Patch 5: `becbd1dc` (2026-10-05)
**Commit Message**: Merge pull request #9632 from code-yeongyu/fix/codex-hook-version-01a10d17

fix(codex): activate the newly installed plugin cache

**File**: `changes.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## 2026-10-05 - LazyCodex activates the version it just installed (#9631)
+
+The installer left previous plugin versions beside a new cache entry. Codex gives `local` priority over versioned entries, so an old local plugin could keep displaying old hook names while the installer recorded trust for the new payload. Installing now removes obsolete version directories only after the replacement payload validates and is promoted. Other plugins, plugin data, symlinks, and hidden staging directories stay in place; a failed preparation leaves the previous cache intact. Actual Codex app-server checks cover restart and reinstall stability and confirm that genuinely changed hooks still require review.
+
 ## 2026-10-05 - Adopt senpi 2026.10.10
 
 Every `@code-yeongyu/senpi` pin moves from 2026.10.9 to 2026.10.10: the root devDependency, `omo-native` and its provider map, the `omo-senpi` and `senpi-task` peer and dev pins (with their `senpi-tui` and `senpi-ai` aliases), the pin tests and the engine named in `senpi-task`'s coverage test. The engine adds code mode's `%bun add` / `%npm add` and opt-in isolated cells and the fixes listed in its release; omo's codemode prompt surface is unchanged (the default eval description renders from the same senpi source in both versions, and omo sets neither `prompt.advertiseHelpers` nor `sandbox.enabled`). The generated plugin bundles are regenerated for it on Linux.
```

**File**: `packages/omo-codex/scripts/install-dist/install-local.mjs` (modified, +9/-1)
```diff
@@ -1,5 +1,5 @@
 #!/usr/bin/env node
-// omo-codex-install:c74ea2b7fbcdb5dac9e731cf2271d1a1510cbf83cba61136c3693fdcbaed3667:649167bb96dc93437998cf74759bc8f043182c2f2c532ae37cd91e30ab204141
+// omo-codex-install:dcaa849500c5bee142f63492cf470ac1830de7e8864b2ea0c8cf544a588dc261:535eafcbca0e9ae9339cf9044f35cc11b1a57e8a569a112765bd170620a0a262
 var __esm = (fn, res, err) => () => {
   if (fn)
     try {
@@ -11449,6 +11449,14 @@ async function installCachedPlugin(input) {
     await rewriteCachedManifestRoot(tempPath, tempPath, targetPath);
     await assertHookCommandTargets(tempPath);
     await promoteDirectory(tempPath, targetPath, input.renameDirectory ?? rename);
+    const versions = await readdir4(dirname4(targetPath), { withFileTypes: true });
+    for (const entry of versions) {
+      if (!entry.isDirectory() || entry.name === input.version || entry.name.startsWith("."))
+        continue;
+      if (!/^[a-zA-Z0-9_+-][a-zA-Z0-9._+-]*$/.test(entry.name))
+        continue;
+      await rm4(join10(dirname4(targetPath), entry.name), { recursive: true, force: true });
+    }
   } catch (error) {
     await rm4(tempPath, { recursive: true, force: true });
     throw error;
```

**File**: `packages/omo-codex/src/install/codex-cache-install.test.ts` (modified, +51/-2)
```diff
@@ -2,12 +2,57 @@
 /// <reference types="bun-types" />
 
 import { describe, expect, test } from "bun:test"
-import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises"
+import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
 import { tmpdir } from "node:os"
 import { join } from "node:path"
 import { installCachedPlugin } from "./codex-cache"
 
 describe("codex-cache install", () => {
+  test.each(["local", "dev", "99.0.0", "0.0.9"])(
+    "#given cached version %s #when installing another version #then only the installed payload remains selectable",
+    async (previousVersion) => {
+      // given
+      const root = await mkdtemp(join(tmpdir(), "omo-codex-cache-activation-"))
+      const codexHome = join(root, "codex-home")
+      const sourceRoot = join(root, "plugin")
+      const pluginCache = join(codexHome, "plugins", "cache", "debug", "omo")
+      const preservedPaths = [
+        join(codexHome, "plugins", "cache", "debug", "other", "local"),
+        join(codexHome, "plugins", "data", "omo-debug"),
+        join(pluginCache, ".tmp-in-flight"),
+      ]
+      try {
+        await mkdir(sourceRoot, { recursive: true })
+        await writeFile(join(sourceRoot, "payload.txt"), "installed payload\n")
+        await mkdir(join(pluginCache, previousVersion), { recursive: true })
+        await writeFile(join(pluginCache, previousVersion, "payload.txt"), "previous payload\n")
+        for (const path of preservedPaths) {
+          await mkdir(path, { recursive: true })
+          await writeFile(join(path, "keep.txt"), "unrelated data\n")
+        }
+
+        // when
+        const installed = await installCachedPlugin({
+          codexHome,
+          marketplaceName: "debug",
+          name: "omo",
+          sourcePath: sourceRoot,
+          version: "0.1.0",
+          runCommand: async () => undefined,
+        })
+
+        // then
+        expect(await readFile(join(installed.path, "payload.txt"), "utf8")).toBe("installed payload\n")
+        await expect(stat(join(pluginCache, previousVersion))).rejects.toThrow()
+        for (const path of preservedPaths) {
+          expect(await readFile(join(path, "keep.txt"), "utf8")).toBe("unrelated data\n")
+        }
+      } finally {
+        await rm(root, { recursive: true, force: true })
+      }
+    },
+  )
+
   test(
     "#given source plugin has development-only directories #when caching plugin #then writes only the plugin payload under the versioned cache",
     async () => {
@@ -201,9 +246,12 @@ describe("codex-cache install", () => {
     const codexHome = join(root, "codex-home")
     const sourceRoot = join(root, "plugin")
     const cacheRoot = join(codexHome, "plugins", "cache", "debug", "omo", "0.1.0")
+    const localCacheRoot = join(codexHome, "plugins", "cache", "debug", "omo", "local")
     await mkdir(join(sourceRoot, ".codex-plugin"), { recursive: true })
     await mkdir(join(sourceRoot, "hooks"), { recursive: true })
     await mkdir(cacheRoot, { recursive: true })
+    await mkdir(localCacheRoot, { recursive: true })
+    await writeFile(join(localCacheRoot, "payload.txt"), "previous local payload\n")
     await writeFile(join(sourceRoot, "package.json"), JSON.stringify({ name: "@scope/omo", version: "0.1.0" }))
     await writeFile(join(sourceRoot, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "omo", hooks: "hooks/hooks.json" }))
     await writeFile(
@@ -230,7 +278,8 @@ describe("codex-cache install", () => {
 
     // then
     expect(await readFile(join(cacheRoot, "package.json"), "utf8")).toBe(JSON.stringify({ name: "@scope/omo-old", version: "0.0.9" }))
-    expect(await readdir(join(codexHome, "plugins", "cache", "debug", "omo"))).toEqual(["0.1.0"])
+    expect(await readFile(join(localCacheRoot, "payload.txt"), "utf8")).toBe("previous local payload\n")
+    expect((await readdir(join(codexHome, "plugins", "cache", "debug", "omo"))).sort()).toEqual(["0.1.0", "local"])
   })
 
   test("#given npm creates workspace bin shims in the cache #when caching plugin #then plugin-owned shims are removed", async () => {
```

**File**: `packages/omo-codex/src/install/codex-cache-install.ts` (modified, +7/-0)
```diff
@@ -52,6 +52,13 @@ export async function installCachedPlugin(input: {
     await rewriteCachedManifestRoot(tempPath, tempPath, targetPath)
     await assertHookCommandTargets(tempPath)
     await promoteDirectory(tempPath, targetPath, input.renameDirectory ?? rename)
+    // Codex prefers a leftover "local" cache over every versioned install.
+    const versions = await readdir(dirname(targetPath), { withFileTypes: true })
+    for (const entry of versions) {
+      if (!entry.isDirectory() || entry.name === input.version || entry.name.startsWith(".")) continue
+      if (!/^[a-zA-Z0-9_+-][a-zA-Z0-9._+-]*$/.test(entry.name)) continue
+      await rm(join(dirname(targetPath), entry.name), { recursive: true, force: true })
+    }
   } catch (error) {
     await rm(tempPath, { recursive: true, force: true })
     throw error
```

---

### Incident Patch 6: `2fae8a63` (2026-10-05)
**Commit Message**: fix(codex): activate the newly installed plugin cache

**File**: `changes.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## 2026-10-05 - LazyCodex activates the version it just installed (#9631)
+
+The installer left previous plugin versions beside a new cache entry. Codex gives `local` priority over versioned entries, so an old local plugin could keep displaying old hook names while the installer recorded trust for the new payload. Installing now removes obsolete version directories only after the replacement payload validates and is promoted. Other plugins, plugin data, symlinks, and hidden staging directories stay in place; a failed preparation leaves the previous cache intact. Actual Codex app-server checks cover restart and reinstall stability and confirm that genuinely changed hooks still require review.
+
 ## 2026-10-05 - Adopt senpi 2026.10.10
 
 Every `@code-yeongyu/senpi` pin moves from 2026.10.9 to 2026.10.10: the root devDependency, `omo-native` and its provider map, the `omo-senpi` and `senpi-task` peer and dev pins (with their `senpi-tui` and `senpi-ai` aliases), the pin tests and the engine named in `senpi-task`'s coverage test. The engine adds code mode's `%bun add` / `%npm add` and opt-in isolated cells and the fixes listed in its release; omo's codemode prompt surface is unchanged (the default eval description renders from the same senpi source in both versions, and omo sets neither `prompt.advertiseHelpers` nor `sandbox.enabled`). The generated plugin bundles are regenerated for it on Linux.
```

**File**: `packages/omo-codex/scripts/install-dist/install-local.mjs` (modified, +9/-1)
```diff
@@ -1,5 +1,5 @@
 #!/usr/bin/env node
-// omo-codex-install:c74ea2b7fbcdb5dac9e731cf2271d1a1510cbf83cba61136c3693fdcbaed3667:649167bb96dc93437998cf74759bc8f043182c2f2c532ae37cd91e30ab204141
+// omo-codex-install:dcaa849500c5bee142f63492cf470ac1830de7e8864b2ea0c8cf544a588dc261:535eafcbca0e9ae9339cf9044f35cc11b1a57e8a569a112765bd170620a0a262
 var __esm = (fn, res, err) => () => {
   if (fn)
     try {
@@ -11449,6 +11449,14 @@ async function installCachedPlugin(input) {
     await rewriteCachedManifestRoot(tempPath, tempPath, targetPath);
     await assertHookCommandTargets(tempPath);
     await promoteDirectory(tempPath, targetPath, input.renameDirectory ?? rename);
+    const versions = await readdir4(dirname4(targetPath), { withFileTypes: true });
+    for (const entry of versions) {
+      if (!entry.isDirectory() || entry.name === input.version || entry.name.startsWith("."))
+        continue;
+      if (!/^[a-zA-Z0-9_+-][a-zA-Z0-9._+-]*$/.test(entry.name))
+        continue;
+      await rm4(join10(dirname4(targetPath), entry.name), { recursive: true, force: true });
+    }
   } catch (error) {
     await rm4(tempPath, { recursive: true, force: true });
     throw error;
```

**File**: `packages/omo-codex/src/install/codex-cache-install.test.ts` (modified, +51/-2)
```diff
@@ -2,12 +2,57 @@
 /// <reference types="bun-types" />
 
 import { describe, expect, test } from "bun:test"
-import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises"
+import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
 import { tmpdir } from "node:os"
 import { join } from "node:path"
 import { installCachedPlugin } from "./codex-cache"
 
 describe("codex-cache install", () => {
+  test.each(["local", "dev", "99.0.0", "0.0.9"])(
+    "#given cached version %s #when installing another version #then only the installed payload remains selectable",
+    async (previousVersion) => {
+      // given
+      const root = await mkdtemp(join(tmpdir(), "omo-codex-cache-activation-"))
+      const codexHome = join(root, "codex-home")
+      const sourceRoot = join(root, "plugin")
+      const pluginCache = join(codexHome, "plugins", "cache", "debug", "omo")
+      const preservedPaths = [
+        join(codexHome, "plugins", "cache", "debug", "other", "local"),
+        join(codexHome, "plugins", "data", "omo-debug"),
+        join(pluginCache, ".tmp-in-flight"),
+      ]
+      try {
+        await mkdir(sourceRoot, { recursive: true })
+        await writeFile(join(sourceRoot, "payload.txt"), "installed payload\n")
+        await mkdir(join(pluginCache, previousVersion), { recursive: true })
+        await writeFile(join(pluginCache, previousVersion, "payload.txt"), "previous payload\n")
+        for (const path of preservedPaths) {
+          await mkdir(path, { recursive: true })
+          await writeFile(join(path, "keep.txt"), "unrelated data\n")
+        }
+
+        // when
+        const installed = await installCachedPlugin({
+          codexHome,
+          marketplaceName: "debug",
+          name: "omo",
+          sourcePath: sourceRoot,
+          version: "0.1.0",
+          runCommand: async () => undefined,
+        })
+
+        // then
+        expect(await readFile(join(installed.path, "payload.txt"), "utf8")).toBe("installed payload\n")
+        await expect(stat(join(pluginCache, previousVersion))).rejects.toThrow()
+        for (const path of preservedPaths) {
+          expect(await readFile(join(path, "keep.txt"), "utf8")).toBe("unrelated data\n")
+        }
+      } finally {
+        await rm(root, { recursive: true, force: true })
+      }
+    },
+  )
+
   test(
     "#given source plugin has development-only directories #when caching plugin #then writes only the plugin payload under the versioned cache",
     async () => {
@@ -201,9 +246,12 @@ describe("codex-cache install", () => {
     const codexHome = join(root, "codex-home")
     const sourceRoot = join(root, "plugin")
     const cacheRoot = join(codexHome, "plugins", "cache", "debug", "omo", "0.1.0")
+    const localCacheRoot = join(codexHome, "plugins", "cache", "debug", "omo", "local")
     await mkdir(join(sourceRoot, ".codex-plugin"), { recursive: true })
     await mkdir(join(sourceRoot, "hooks"), { recursive: true })
     await mkdir(cacheRoot, { recursive: true })
+    await mkdir(localCacheRoot, { recursive: true })
+    await writeFile(join(localCacheRoot, "payload.txt"), "previous local payload\n")
     await writeFile(join(sourceRoot, "package.json"), JSON.stringify({ name: "@scope/omo", version: "0.1.0" }))
     await writeFile(join(sourceRoot, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "omo", hooks: "hooks/hooks.json" }))
     await writeFile(
@@ -230,7 +278,8 @@ describe("codex-cache install", () => {
 
     // then
     expect(await readFile(join(cacheRoot, "package.json"), "utf8")).toBe(JSON.stringify({ name: "@scope/omo-old", version: "0.0.9" }))
-    expect(await readdir(join(codexHome, "plugins", "cache", "debug", "omo"))).toEqual(["0.1.0"])
+    expect(await readFile(join(localCacheRoot, "payload.txt"), "utf8")).toBe("previous local payload\n")
+    expect((await readdir(join(codexHome, "plugins", "cache", "debug", "omo"))).sort()).toEqual(["0.1.0", "local"])
   })
 
   test("#given npm creates workspace bin shims in the cache #when caching plugin #then plugin-owned shims are removed", async () => {
```

**File**: `packages/omo-codex/src/install/codex-cache-install.ts` (modified, +7/-0)
```diff
@@ -52,6 +52,13 @@ export async function installCachedPlugin(input: {
     await rewriteCachedManifestRoot(tempPath, tempPath, targetPath)
     await assertHookCommandTargets(tempPath)
     await promoteDirectory(tempPath, targetPath, input.renameDirectory ?? rename)
+    // Codex prefers a leftover "local" cache over every versioned install.
+    const versions = await readdir(dirname(targetPath), { withFileTypes: true })
+    for (const entry of versions) {
+      if (!entry.isDirectory() || entry.name === input.version || entry.name.startsWith(".")) continue
+      if (!/^[a-zA-Z0-9_+-][a-zA-Z0-9._+-]*$/.test(entry.name)) continue
+      await rm(join(dirname(targetPath), entry.name), { recursive: true, force: true })
+    }
   } catch (error) {
     await rm(tempPath, { recursive: true, force: true })
     throw error
```

---

### Incident Patch 7: `69ad5f9b` (2026-10-05)
**Commit Message**: Merge pull request #9608 from code-yeongyu/fix/openclaw-ready-test-budget

test(openclaw-core): reply-listener success test no longer races a 500 ms budget

**File**: `changes.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## 2026-10-05 - The reply-listener success test no longer races a 500 ms budget on a slow runner (#9607)
+
+`reply-listener-startup.test.ts` ran its success-path test under the production 500 ms startup budget. When a starved Windows runner delayed the fake child's ready write past that deadline, the test failed with `result.success` false. The success path returns as soon as the child reports ready, so the test now sets a 30 s budget. The never-ready test keeps the short budget.
+
 ## 2026-10-05 - The manifesto keeps the top three quarters of the screen fully lit (#9591)
 
 On omo.dev's manifesto the reveal fully lit text only down to about two thirds of the viewport (median ~0.66, as low as ~0.61, measured at word tops at 390 / 1440 / 1920 in en and ko), against the 75-80% the reading design asked for (#9537). A word is fully lit once its bottom, plus its in-line stagger, is above `--lit-line - --lit-band`. That line was 78vh - 8vh = 70vh, so the tops of the last fully lit words sat near 66%. `--lit-line` moves to 91vh (`packages/web/app/styles/design-system.css`), putting the full line at 83vh. Measured the same way after the change, the depth is 0.805-0.819 at the median and 0.760-0.772 at worst in every one of those configurations, identical on the scroll-timeline and the fallback path. The reveal order, the reduced-motion path and the lit-at-the-bottom guarantee are unchanged.
```

**File**: `packages/openclaw-core/src/__tests__/reply-listener-startup.test.ts` (modified, +3/-0)
```diff
@@ -131,6 +131,9 @@ afterAll(() => {
 
 describe("startReplyListener", () => {
   test("returns the child's ready state only after detached startup reaches the poll loop", async () => {
+    // The success path returns as soon as the child reports ready, so the budget is only an upper
+    // bound here. A loaded runner can delay the fake child's ready write past the 500 ms default.
+    process.env.OMO_OPENCLAW_REPLY_LISTENER_STARTUP_TIMEOUT_MS = "30000"
     const killSpy = spyOn(process, "kill").mockImplementation((pid: number | string) => {
       if (pid === 4321) {
         return true
```

---

### Incident Patch 8: `760c40b3` (2026-10-05)
**Commit Message**: build(omo-senpi): regenerate the plugin bundle after merging dev

Regenerated in a Linux container (node 24, bun 1.4.2) with both build --check steps passing.



---

### Incident Patch 9: `ba2eed3a` (2026-10-04)
**Commit Message**: Merge pull request #9599 from Dante-dan/fix/9596-process-tree-ready

test: establish process-tree TERM readiness before termination

**File**: `packages/senpi-task/src/runners/rpc/__fixtures__/process-tree.mjs` (modified, +10/-3)
```diff
@@ -1,20 +1,27 @@
 import { spawn } from "node:child_process"
+import { once } from "node:events"
 import { fileURLToPath } from "node:url"
 
 const SELF_PATH = fileURLToPath(import.meta.url)
+process.on("SIGTERM", () => {})
 
 if (process.argv[2] === "descendant") {
-  process.on("SIGTERM", () => {})
   process.stdout.write("ready\n")
   setInterval(() => {}, 60_000)
 } else {
   const descendant = spawn(process.execPath, [SELF_PATH, "descendant"], {
-    stdio: "ignore",
+    stdio: ["ignore", "pipe", "ignore"],
   })
   if (descendant.pid === undefined) {
     throw new Error("process-tree descendant did not receive a pid")
   }
+  // Announce the tree only after both processes can ignore SIGTERM.
+  try {
+    await once(descendant.stdout, "data", { signal: AbortSignal.timeout(2_000) })
+  } catch (error) {
+    descendant.kill("SIGKILL")
+    throw error
+  }
   process.stdout.write(`${descendant.pid}\n`)
-  process.on("SIGTERM", () => {})
   setInterval(() => {}, 60_000)
 }
```

**File**: `packages/senpi-task/src/runners/rpc/terminate.test.ts` (modified, +3/-0)
```diff
@@ -87,12 +87,15 @@ describe("terminateRpcChild", () => {
     const [chunk] = await once(child.stdout!, "data")
     const descendantPid = Number.parseInt(String(chunk).trim(), 10)
     expect(Number.isSafeInteger(descendantPid)).toBe(true)
+    const exited = onExit(child)
 
     try {
       // when
       await terminateRpcChild(child, { sigkillDelayMs: 150 })
 
       // then
+      const { signal } = await exited
+      if (!isWin32) expect(signal).toBe("SIGKILL")
       await waitUntilStopped(descendantPid)
       expect(isRunning(descendantPid)).toBe(false)
     } finally {
```

---

### Incident Patch 10: `c0209210` (2026-10-04)
**Commit Message**: Merge pull request #9593 from code-yeongyu/fix/9591-manifesto-lit-depth

fix(web): keep the top three quarters of the manifesto fully lit (#9591)

**File**: `changes.md` (modified, +6/-0)
```diff
@@ -1,3 +1,9 @@
+## 2026-10-05 - The manifesto keeps the top three quarters of the screen fully lit (#9591)
+
+On omo.dev's manifesto the reveal fully lit text only down to about two thirds of the viewport (median ~0.66, as low as ~0.61, measured at word tops at 390 / 1440 / 1920 in en and ko), against the 75-80% the reading design asked for (#9537). A word is fully lit once its bottom, plus its in-line stagger, is above `--lit-line - --lit-band`. That line was 78vh - 8vh = 70vh, so the tops of the last fully lit words sat near 66%. `--lit-line` moves to 91vh (`packages/web/app/styles/design-system.css`), putting the full line at 83vh. Measured the same way after the change, the depth is 0.805-0.819 at the median and 0.760-0.772 at worst in every one of those configurations, identical on the scroll-timeline and the fallback path. The reveal order, the reduced-motion path and the lit-at-the-bottom guarantee are unchanged.
+
+The readable-screenful e2e test pinned the old 70% from the CSS, so it could not catch this. It now measures the depth from word geometry on every scroll step (the top of the first visible word that is not fully lit), requires at least 0.72 on every frame and at least 0.75 at the median, and moves into its own file, `packages/web/e2e/manifesto-lit-depth.spec.ts`, with the shared page helpers in `e2e/manifesto-page.ts`.
+
 ## 2026-10-04 - Adopt senpi 2026.10.9
 
 Every `@code-yeongyu/senpi` pin moves from 2026.10.8 to 2026.10.9: the root devDependency, `omo-native` and its provider map, the `omo-senpi` and `senpi-task` peer and dev pins (with their `senpi-tui` and `senpi-ai` aliases), the pin tests and the engine named in `senpi-task`'s coverage test. The engine names the tool call a permission prompt approves (senpi#2710), stops requiring a status block on a reply that only answers and drops quote-line reply templates (senpi#2723, senpi#2714), and carries 2026.10.9's code mode work; the generated plugin bundles are regenerated for it on Linux.
```

**File**: `packages/web/app/styles/design-system.css` (modified, +4/-1)
```diff
@@ -209,7 +209,10 @@
     --lit-follow-fade: 22vh;
     --lit-follow-gap: 1.25em;
     --lit-follow-rise: var(--space-6);
-    --lit-line: 78vh;
+    /* The manifesto reveal fully lights a word once its bottom (plus its in-line stagger) is above
+       --lit-line - --lit-band (83vh). Measured at word tops, the fully lit depth is 0.81 of the
+       viewport at the median and 0.76 at worst across 390/1440/1920, en and ko (#9591: the top 75-80%). */
+    --lit-line: 91vh;
     --lit-band: 8vh;
     --dur-swap-out: 80ms;
     --dur-swap-in: 220ms;
```

**File**: `packages/web/e2e/manifesto-lit-depth.spec.ts` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+import { expect, test } from "@playwright/test"
+
+import { firstProgress, waitForReadingBlocks } from "./manifesto-page"
+import { scrollSecret } from "./secret-reading-state"
+
+for (const locale of ["en", "ko"]) {
+  for (const viewport of [
+    { width: 375, height: 812 },
+    { width: 1280, height: 900 },
+  ]) {
+    test.describe(`${locale} ${viewport.width}`, () => {
+      test.use({ viewport })
+
+      for (const variant of ["timeline", "fallback"]) {
+        test(`a readable screenful stays lit while the edge sweeps (${variant})`, async ({
+          page,
+        }) => {
+          test.setTimeout(90000)
+          await page.emulateMedia({ reducedMotion: "no-preference" })
+          if (variant === "fallback") {
+            await page.addInitScript(() => {
+              const supports = CSS.supports.bind(CSS)
+              CSS.supports = ((...args: [string] | [string, string]) =>
+                args.some((arg) => arg.includes("animation-timeline"))
+                  ? false
+                  : args.length === 1
+                    ? supports(args[0])
+                    : supports(args[0], args[1])) as typeof CSS.supports
+            })
+          }
+          await page.goto(`/${locale}/manifesto`)
+          await page.evaluate(waitForReadingBlocks)
+          // The reveal is driven by the JS per-word geometry in both paths (single authoritative
+          // driver); it does not opt into the CSS scroll timeline, so the mode is always observer.
+          expect(await page.evaluate(firstProgress)).toBe("observer")
+          const blockCount = await page.evaluate(
+            () => document.querySelectorAll(".lit-read").length,
+          )
+          expect(blockCount).toBeGreaterThan(4)
+
+          const maxY = await page.evaluate(
+            () => document.documentElement.scrollHeight - innerHeight,
+          )
+          let sawMid = false
+          // Measured fully lit depth per frame: the top of the first visible word that is not yet
+          // fully lit, as a fraction of the viewport (#9591). Read from word geometry, not the CSS.
+          const depths: number[] = []
+          // Let the view() timeline catch up to an instant scroll before reading.
+          const settle = () =>
+            page.evaluate(
+              () =>
+                new Promise((r) =>
+                  requestAnimationFrame(() =>
+                    requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
+                  ),
+                ),
+            )
+          for (let y = 200; y < maxY; y += 120) {
+            await page.evaluate(scrollSecret, y)
+            await settle()
+            // Q's contract, asserted directly: everything already revealed stays lit and the top
+            // 75-80% of the screen is fully readable; the reveal never gates reading on scroll.
+            const state = await page.evaluate(() => {
+              const viewport = innerHeight
+              let firstDimTop = Number.POSITIVE_INFINITY
+              let litAbove = 0
+              let litBelowMid = 0
+              let aboveMid = 0
+              for (const word of Array.from(
+                document.querySelectorAll<HTMLElement>(".lit-read .lit-word"),
+              )) {
+                const rect = word.getBoundingClientRect()
+                if (rect.bottom < 0 || rect.top > viewport) continue
+                const lit =
+                  Number.parseFloat(getComputedStyle(word).getPropertyValue("--lit-local")) >= 1
+                if (lit) litAbove += 1
+                else firstDimTop = Math.min(firstDimTop, rect.top)
+                if (rect.top < viewport * 0.4) {
+                  aboveMid += 1
+                  if (lit) litBelowMid += 1
+                }
+              }
+              return {
+                depth: Number.isFinite(firstDimTop) && litAbove > 0 ? firstDimTop / viewport : null,
+                litBelowMid,
+                aboveMid,
+              }
+            })
+            // While the reveal is mid-screen, every frame keeps at least the top 72% fully lit.
+            if (state.depth !== null) {
+              depths.push(state.depth)
+              expect(state.depth, `scrollY ${y} fully lit depth`).toBeGreaterThanOrEqual(0.72)
+            }
+            // Once scrolled a screen and content still fills the upper reading area, that area has
+            // lit words (readable screenful). Near the bottom the upper area can be whitespace.
+            if (y > viewport.height && state.aboveMid > 0) {
+              sawMid = true
+              expect(state.litBelowMid, `scrollY ${y} readable screenful`).toBeGreaterThan(0)
+            }
+          }
+          expect(sawMid).toBe(true)
+          // ...and typically the top 75%: the median frame clears it.
+          expect(depths.length, "frames with the reveal on screen").toBeGreaterThan(3)
+          const sorted = [...depths].sort((a, b) => a - b)
+ 
```

**File**: `packages/web/e2e/manifesto-page.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+// In-page helpers shared by the manifesto e2e specs; each runs inside page.evaluate.
+
+export async function waitForReadingBlocks(): Promise<void> {
+  await document.fonts.ready
+  const blocks = Array.from(document.querySelectorAll<HTMLElement>(".lit-read"))
+  await Promise.all(
+    blocks.map(
+      (block) =>
+        new Promise<void>((resolve, reject) => {
+          if (block.dataset.litMode !== "pending") return resolve()
+          const observer = new MutationObserver(() => {
+            if (block.dataset.litMode === "pending") return
+            clearTimeout(timeout)
+            observer.disconnect()
+            resolve()
+          })
+          const timeout = setTimeout(() => {
+            observer.disconnect()
+            reject(new Error("Manifesto did not hydrate"))
+          }, 5000)
+          observer.observe(block, { attributes: true })
+        }),
+    ),
+  )
+}
+
+export function firstProgress(): string {
+  const first = document.querySelector<HTMLElement>(".lit-read")
+  return first?.dataset.litMode ?? "missing"
+}
```

**File**: `packages/web/e2e/manifesto-reading.spec.ts` (modified, +1/-179)
```diff
@@ -1,37 +1,9 @@
 import { expect, test } from "@playwright/test"
 
 import { expectUniformWordGlyphs } from "./manifesto-glyphs"
+import { firstProgress, waitForReadingBlocks } from "./manifesto-page"
 import { scrollSecret } from "./secret-reading-state"
 
-async function waitForReadingBlocks(): Promise<void> {
-  await document.fonts.ready
-  const blocks = Array.from(document.querySelectorAll<HTMLElement>(".lit-read"))
-  await Promise.all(
-    blocks.map(
-      (block) =>
-        new Promise<void>((resolve, reject) => {
-          if (block.dataset.litMode !== "pending") return resolve()
-          const observer = new MutationObserver(() => {
-            if (block.dataset.litMode === "pending") return
-            clearTimeout(timeout)
-            observer.disconnect()
-            resolve()
-          })
-          const timeout = setTimeout(() => {
-            observer.disconnect()
-            reject(new Error("Manifesto did not hydrate"))
-          }, 5000)
-          observer.observe(block, { attributes: true })
-        }),
-    ),
-  )
-}
-
-function firstProgress(): string {
-  const first = document.querySelector<HTMLElement>(".lit-read")
-  return first?.dataset.litMode ?? "missing"
-}
-
 for (const locale of ["en", "ko"]) {
   for (const viewport of [
     { width: 375, height: 812 },
@@ -40,156 +12,6 @@ for (const locale of ["en", "ko"]) {
     test.describe(`${locale} ${viewport.width}`, () => {
       test.use({ viewport })
 
-      for (const variant of ["timeline", "fallback"]) {
-        test(`a readable screenful stays lit while the edge sweeps (${variant})`, async ({
-          page,
-        }) => {
-          test.setTimeout(90000)
-          await page.emulateMedia({ reducedMotion: "no-preference" })
-          if (variant === "fallback") {
-            await page.addInitScript(() => {
-              const supports = CSS.supports.bind(CSS)
-              CSS.supports = ((...args: [string] | [string, string]) =>
-                args.some((arg) => arg.includes("animation-timeline"))
-                  ? false
-                  : args.length === 1
-                    ? supports(args[0])
-                    : supports(args[0], args[1])) as typeof CSS.supports
-            })
-          }
-          await page.goto(`/${locale}/manifesto`)
-          await page.evaluate(waitForReadingBlocks)
-          // The reveal is driven by the JS per-word geometry in both paths (single authoritative
-          // driver); it does not opt into the CSS scroll timeline, so the mode is always observer.
-          expect(await page.evaluate(firstProgress)).toBe("observer")
-          const blockCount = await page.evaluate(
-            () => document.querySelectorAll(".lit-read").length,
-          )
-          expect(blockCount).toBeGreaterThan(4)
-
-          const maxY = await page.evaluate(
-            () => document.documentElement.scrollHeight - innerHeight,
-          )
-          let sawMid = false
-          // Let the view() timeline catch up to an instant scroll before reading.
-          const settle = () =>
-            page.evaluate(
-              () =>
-                new Promise((r) =>
-                  requestAnimationFrame(() =>
-                    requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
-                  ),
-                ),
-            )
-          for (let y = 200; y < maxY; y += 120) {
-            await page.evaluate(scrollSecret, y)
-            await settle()
-            // Q's contract, asserted directly: everything already revealed stays lit and the top of
-            // the screen is fully readable. A word at or above the full line (--lit-line -
-            // --lit-band = 70vh) is fully lit; the reveal never gates reading on scroll.
-            const state = await page.evaluate(() => {
-              const viewport = innerHeight
-              const fullLine = viewport * 0.7
-              let dimAboveLine = 0
-              let litBelowMid = 0
-              let aboveMid = 0
-              for (const word of Array.from(
-                document.querySelectorAll<HTMLElement>(".lit-read .lit-word"),
-              )) {
-                const rect = word.getBoundingClientRect()
-                if (rect.bottom < 0 || rect.top > viewport) continue
-                const lit =
-                  Number.parseFloat(getComputedStyle(word).getPropertyValue("--lit-local")) >= 1
-                // A word is due to be lit once its bottom is clearly above the reveal edge (past
-                // its within-line stagger window); words right at the edge may still be staggering
-                // in left-to-right. The stagger spans up to two line-heights, so allow that window.
-                if (rect.bottom <= fullLine - 60 && !lit) dimAboveLine += 1
-                if (rect.top < viewport * 0.4) {
-                  aboveMid += 1
-                  if (lit) litBelowMid += 1
-                }
-              }
-              retur
```

---

### Incident Patch 11: `6f554f39` (2026-10-04)
**Commit Message**: fix(web): keep the top three quarters of the manifesto fully lit (#9591)

The reveal fully lit a word once its bottom (plus its in-line stagger) was above
--lit-line - --lit-band = 70vh, so at word tops the fully lit region ended near two
thirds of the viewport (median ~0.66). --lit-line moves to 91vh (full line 83vh):
measured at word tops the depth is 0.805-0.819 at the median and 0.760-0.772 at worst
at 390/1440/1920 in en and ko, identical on the timeline and fallback paths.

The readable-screenful e2e test now measures that depth from word geometry each
scroll step (>= 0.72 per frame, >= 0.75 at the median) instead of pinning the CSS
70%, and moves to e2e/manifesto-lit-depth.spec.ts with the shared page helpers in
e2e/manifesto-page.ts. On the old 78vh line all 8 of its cases fail.

**File**: `changes.md` (modified, +6/-0)
```diff
@@ -1,3 +1,9 @@
+## 2026-10-05 - The manifesto keeps the top three quarters of the screen fully lit (#9591)
+
+On omo.dev's manifesto the reveal fully lit text only down to about two thirds of the viewport (median ~0.66, as low as ~0.61, measured at word tops at 390 / 1440 / 1920 in en and ko), against the 75-80% the reading design asked for (#9537). A word is fully lit once its bottom, plus its in-line stagger, is above `--lit-line - --lit-band`. That line was 78vh - 8vh = 70vh, so the tops of the last fully lit words sat near 66%. `--lit-line` moves to 91vh (`packages/web/app/styles/design-system.css`), putting the full line at 83vh. Measured the same way after the change, the depth is 0.805-0.819 at the median and 0.760-0.772 at worst in every one of those configurations, identical on the scroll-timeline and the fallback path. The reveal order, the reduced-motion path and the lit-at-the-bottom guarantee are unchanged.
+
+The readable-screenful e2e test pinned the old 70% from the CSS, so it could not catch this. It now measures the depth from word geometry on every scroll step (the top of the first visible word that is not fully lit), requires at least 0.72 on every frame and at least 0.75 at the median, and moves into its own file, `packages/web/e2e/manifesto-lit-depth.spec.ts`, with the shared page helpers in `e2e/manifesto-page.ts`.
+
 ## 2026-10-04 - Adopt senpi 2026.10.9
 
 Every `@code-yeongyu/senpi` pin moves from 2026.10.8 to 2026.10.9: the root devDependency, `omo-native` and its provider map, the `omo-senpi` and `senpi-task` peer and dev pins (with their `senpi-tui` and `senpi-ai` aliases), the pin tests and the engine named in `senpi-task`'s coverage test. The engine names the tool call a permission prompt approves (senpi#2710), stops requiring a status block on a reply that only answers and drops quote-line reply templates (senpi#2723, senpi#2714), and carries 2026.10.9's code mode work; the generated plugin bundles are regenerated for it on Linux.
```

**File**: `packages/web/app/styles/design-system.css` (modified, +4/-1)
```diff
@@ -209,7 +209,10 @@
     --lit-follow-fade: 22vh;
     --lit-follow-gap: 1.25em;
     --lit-follow-rise: var(--space-6);
-    --lit-line: 78vh;
+    /* The manifesto reveal fully lights a word once its bottom (plus its in-line stagger) is above
+       --lit-line - --lit-band (83vh). Measured at word tops, the fully lit depth is 0.81 of the
+       viewport at the median and 0.76 at worst across 390/1440/1920, en and ko (#9591: the top 75-80%). */
+    --lit-line: 91vh;
     --lit-band: 8vh;
     --dur-swap-out: 80ms;
     --dur-swap-in: 220ms;
```

**File**: `packages/web/e2e/manifesto-lit-depth.spec.ts` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+import { expect, test } from "@playwright/test"
+
+import { firstProgress, waitForReadingBlocks } from "./manifesto-page"
+import { scrollSecret } from "./secret-reading-state"
+
+for (const locale of ["en", "ko"]) {
+  for (const viewport of [
+    { width: 375, height: 812 },
+    { width: 1280, height: 900 },
+  ]) {
+    test.describe(`${locale} ${viewport.width}`, () => {
+      test.use({ viewport })
+
+      for (const variant of ["timeline", "fallback"]) {
+        test(`a readable screenful stays lit while the edge sweeps (${variant})`, async ({
+          page,
+        }) => {
+          test.setTimeout(90000)
+          await page.emulateMedia({ reducedMotion: "no-preference" })
+          if (variant === "fallback") {
+            await page.addInitScript(() => {
+              const supports = CSS.supports.bind(CSS)
+              CSS.supports = ((...args: [string] | [string, string]) =>
+                args.some((arg) => arg.includes("animation-timeline"))
+                  ? false
+                  : args.length === 1
+                    ? supports(args[0])
+                    : supports(args[0], args[1])) as typeof CSS.supports
+            })
+          }
+          await page.goto(`/${locale}/manifesto`)
+          await page.evaluate(waitForReadingBlocks)
+          // The reveal is driven by the JS per-word geometry in both paths (single authoritative
+          // driver); it does not opt into the CSS scroll timeline, so the mode is always observer.
+          expect(await page.evaluate(firstProgress)).toBe("observer")
+          const blockCount = await page.evaluate(
+            () => document.querySelectorAll(".lit-read").length,
+          )
+          expect(blockCount).toBeGreaterThan(4)
+
+          const maxY = await page.evaluate(
+            () => document.documentElement.scrollHeight - innerHeight,
+          )
+          let sawMid = false
+          // Measured fully lit depth per frame: the top of the first visible word that is not yet
+          // fully lit, as a fraction of the viewport (#9591). Read from word geometry, not the CSS.
+          const depths: number[] = []
+          // Let the view() timeline catch up to an instant scroll before reading.
+          const settle = () =>
+            page.evaluate(
+              () =>
+                new Promise((r) =>
+                  requestAnimationFrame(() =>
+                    requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
+                  ),
+                ),
+            )
+          for (let y = 200; y < maxY; y += 120) {
+            await page.evaluate(scrollSecret, y)
+            await settle()
+            // Q's contract, asserted directly: everything already revealed stays lit and the top
+            // 75-80% of the screen is fully readable; the reveal never gates reading on scroll.
+            const state = await page.evaluate(() => {
+              const viewport = innerHeight
+              let firstDimTop = Number.POSITIVE_INFINITY
+              let litAbove = 0
+              let litBelowMid = 0
+              let aboveMid = 0
+              for (const word of Array.from(
+                document.querySelectorAll<HTMLElement>(".lit-read .lit-word"),
+              )) {
+                const rect = word.getBoundingClientRect()
+                if (rect.bottom < 0 || rect.top > viewport) continue
+                const lit =
+                  Number.parseFloat(getComputedStyle(word).getPropertyValue("--lit-local")) >= 1
+                if (lit) litAbove += 1
+                else firstDimTop = Math.min(firstDimTop, rect.top)
+                if (rect.top < viewport * 0.4) {
+                  aboveMid += 1
+                  if (lit) litBelowMid += 1
+                }
+              }
+              return {
+                depth: Number.isFinite(firstDimTop) && litAbove > 0 ? firstDimTop / viewport : null,
+                litBelowMid,
+                aboveMid,
+              }
+            })
+            // While the reveal is mid-screen, every frame keeps at least the top 72% fully lit.
+            if (state.depth !== null) {
+              depths.push(state.depth)
+              expect(state.depth, `scrollY ${y} fully lit depth`).toBeGreaterThanOrEqual(0.72)
+            }
+            // Once scrolled a screen and content still fills the upper reading area, that area has
+            // lit words (readable screenful). Near the bottom the upper area can be whitespace.
+            if (y > viewport.height && state.aboveMid > 0) {
+              sawMid = true
+              expect(state.litBelowMid, `scrollY ${y} readable screenful`).toBeGreaterThan(0)
+            }
+          }
+          expect(sawMid).toBe(true)
+          // ...and typically the top 75%: the median frame clears it.
+          expect(depths.length, "frames with the reveal on screen").toBeGreaterThan(3)
+          const sorted = [...depths].sort((a, b) => a - b)
+ 
```

**File**: `packages/web/e2e/manifesto-page.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+// In-page helpers shared by the manifesto e2e specs; each runs inside page.evaluate.
+
+export async function waitForReadingBlocks(): Promise<void> {
+  await document.fonts.ready
+  const blocks = Array.from(document.querySelectorAll<HTMLElement>(".lit-read"))
+  await Promise.all(
+    blocks.map(
+      (block) =>
+        new Promise<void>((resolve, reject) => {
+          if (block.dataset.litMode !== "pending") return resolve()
+          const observer = new MutationObserver(() => {
+            if (block.dataset.litMode === "pending") return
+            clearTimeout(timeout)
+            observer.disconnect()
+            resolve()
+          })
+          const timeout = setTimeout(() => {
+            observer.disconnect()
+            reject(new Error("Manifesto did not hydrate"))
+          }, 5000)
+          observer.observe(block, { attributes: true })
+        }),
+    ),
+  )
+}
+
+export function firstProgress(): string {
+  const first = document.querySelector<HTMLElement>(".lit-read")
+  return first?.dataset.litMode ?? "missing"
+}
```

**File**: `packages/web/e2e/manifesto-reading.spec.ts` (modified, +1/-179)
```diff
@@ -1,37 +1,9 @@
 import { expect, test } from "@playwright/test"
 
 import { expectUniformWordGlyphs } from "./manifesto-glyphs"
+import { firstProgress, waitForReadingBlocks } from "./manifesto-page"
 import { scrollSecret } from "./secret-reading-state"
 
-async function waitForReadingBlocks(): Promise<void> {
-  await document.fonts.ready
-  const blocks = Array.from(document.querySelectorAll<HTMLElement>(".lit-read"))
-  await Promise.all(
-    blocks.map(
-      (block) =>
-        new Promise<void>((resolve, reject) => {
-          if (block.dataset.litMode !== "pending") return resolve()
-          const observer = new MutationObserver(() => {
-            if (block.dataset.litMode === "pending") return
-            clearTimeout(timeout)
-            observer.disconnect()
-            resolve()
-          })
-          const timeout = setTimeout(() => {
-            observer.disconnect()
-            reject(new Error("Manifesto did not hydrate"))
-          }, 5000)
-          observer.observe(block, { attributes: true })
-        }),
-    ),
-  )
-}
-
-function firstProgress(): string {
-  const first = document.querySelector<HTMLElement>(".lit-read")
-  return first?.dataset.litMode ?? "missing"
-}
-
 for (const locale of ["en", "ko"]) {
   for (const viewport of [
     { width: 375, height: 812 },
@@ -40,156 +12,6 @@ for (const locale of ["en", "ko"]) {
     test.describe(`${locale} ${viewport.width}`, () => {
       test.use({ viewport })
 
-      for (const variant of ["timeline", "fallback"]) {
-        test(`a readable screenful stays lit while the edge sweeps (${variant})`, async ({
-          page,
-        }) => {
-          test.setTimeout(90000)
-          await page.emulateMedia({ reducedMotion: "no-preference" })
-          if (variant === "fallback") {
-            await page.addInitScript(() => {
-              const supports = CSS.supports.bind(CSS)
-              CSS.supports = ((...args: [string] | [string, string]) =>
-                args.some((arg) => arg.includes("animation-timeline"))
-                  ? false
-                  : args.length === 1
-                    ? supports(args[0])
-                    : supports(args[0], args[1])) as typeof CSS.supports
-            })
-          }
-          await page.goto(`/${locale}/manifesto`)
-          await page.evaluate(waitForReadingBlocks)
-          // The reveal is driven by the JS per-word geometry in both paths (single authoritative
-          // driver); it does not opt into the CSS scroll timeline, so the mode is always observer.
-          expect(await page.evaluate(firstProgress)).toBe("observer")
-          const blockCount = await page.evaluate(
-            () => document.querySelectorAll(".lit-read").length,
-          )
-          expect(blockCount).toBeGreaterThan(4)
-
-          const maxY = await page.evaluate(
-            () => document.documentElement.scrollHeight - innerHeight,
-          )
-          let sawMid = false
-          // Let the view() timeline catch up to an instant scroll before reading.
-          const settle = () =>
-            page.evaluate(
-              () =>
-                new Promise((r) =>
-                  requestAnimationFrame(() =>
-                    requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
-                  ),
-                ),
-            )
-          for (let y = 200; y < maxY; y += 120) {
-            await page.evaluate(scrollSecret, y)
-            await settle()
-            // Q's contract, asserted directly: everything already revealed stays lit and the top of
-            // the screen is fully readable. A word at or above the full line (--lit-line -
-            // --lit-band = 70vh) is fully lit; the reveal never gates reading on scroll.
-            const state = await page.evaluate(() => {
-              const viewport = innerHeight
-              const fullLine = viewport * 0.7
-              let dimAboveLine = 0
-              let litBelowMid = 0
-              let aboveMid = 0
-              for (const word of Array.from(
-                document.querySelectorAll<HTMLElement>(".lit-read .lit-word"),
-              )) {
-                const rect = word.getBoundingClientRect()
-                if (rect.bottom < 0 || rect.top > viewport) continue
-                const lit =
-                  Number.parseFloat(getComputedStyle(word).getPropertyValue("--lit-local")) >= 1
-                // A word is due to be lit once its bottom is clearly above the reveal edge (past
-                // its within-line stagger window); words right at the edge may still be staggering
-                // in left-to-right. The stagger spans up to two line-heights, so allow that window.
-                if (rect.bottom <= fullLine - 60 && !lit) dimAboveLine += 1
-                if (rect.top < viewport * 0.4) {
-                  aboveMid += 1
-                  if (lit) litBelowMid += 1
-                }
-              }
-              retur
```

---

### Incident Patch 12: `92ae283c` (2026-10-04)
**Commit Message**: Merge pull request #9586 from Dante-dan/fix/9558-manifesto-order-rendering

fix(web): preserve manifesto reveal order across wrapped lines

**File**: `.github/workflows/web-ci.yml` (modified, +9/-0)
```diff
@@ -105,6 +105,15 @@ jobs:
         env:
           NEXT_TELEMETRY_DISABLED: "1"
 
+      - name: Upload glyph failure evidence
+        if: failure()
+        uses: actions/upload-artifact@v7
+        with:
+          name: manifesto-glyph-failures
+          path: packages/web/test-results/*/glyph-*
+          if-no-files-found: ignore
+          retention-days: 7
+
       - name: Write job summary
         if: always()
         shell: bash
```

**File**: `packages/web/components/landing/lit-progress.ts` (modified, +40/-6)
```diff
@@ -71,12 +71,46 @@ function armRevealDriver(): void {
       // viewport), so reading order holds at any width.
       const bodyRect = body.getBoundingClientRect()
       const lineWidth = Math.max(1, bodyRect.width)
-      for (const { node, bottom, height, left } of words) {
-        const withinLine = (((left - bodyRect.left) % lineWidth) / lineWidth) * height * 2
-        node.style.setProperty(
-          "--lit-local",
-          String(clamp01((endTop - bottom - withinLine) / (height * 1.6) + 1)),
-        )
+      // Mixed-script glyph metrics can differ by subpixels on the same visual line.
+      // Cluster within half a line-height instead of treating every distinct bottom as a wrap.
+      const lineHeight =
+        Number.parseFloat(getComputedStyle(body).lineHeight) ||
+        Math.max(1, ...words.map(({ height }) => height)) * 1.5
+      const lines: { bottom: number; height: number; words: typeof words }[] = []
+      for (const word of [...words].sort((a, b) => a.bottom - b.bottom)) {
+        const line = lines.at(-1)
+        if (line && word.bottom - line.bottom < lineHeight / 2) {
+          line.bottom = Math.max(line.bottom, word.bottom)
+          line.height = Math.max(line.height, word.height)
+          line.words.push(word)
+        } else {
+          lines.push({ bottom: word.bottom, height: word.height, words: [word] })
+        }
+      }
+      const brightness = new Map<HTMLElement, number>()
+      for (const [index, line] of lines.entries()) {
+        const next = lines[index + 1]
+        const previous = lines[index - 1]
+        const spacing = next
+          ? next.bottom - line.bottom
+          : previous
+            ? line.bottom - previous.bottom
+            : line.height * 2
+        const stagger = Math.min(line.height * 2, spacing)
+        for (const { node, left } of line.words) {
+          const withinLine = clamp01((left - bodyRect.left) / lineWidth) * stagger
+          brightness.set(
+            node,
+            clamp01((endTop - line.bottom - withinLine) / (line.height * 1.6) + 1),
+          )
+        }
+      }
+      // Font fallback can change line boxes and fade heights. Preserve DOM reading order even
+      // when those metrics split one visual line: no later word may overtake an earlier word.
+      let preceding = 1
+      for (const { node } of words) {
+        preceding = Math.min(preceding, brightness.get(node) ?? 1)
+        node.style.setProperty("--lit-local", String(preceding))
       }
     }
   }
```

**File**: `packages/web/e2e/manifesto-glyph-oracle.spec.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import { expect, test } from "@playwright/test"
+
+import { expectUniformWordGlyphs } from "./manifesto-glyphs"
+
+for (const locale of ["en", "ko"]) {
+  test(`glyph oracle rejects a real half-dim word (${locale})`, async ({ page }) => {
+    await page.goto(`/${locale}/manifesto`)
+    await page.evaluate(async () => {
+      await document.fonts.ready
+      const block = document.querySelector<HTMLElement>(".lit-read")!
+      block.scrollIntoView({ block: "center" })
+    })
+    await page.waitForFunction(() => {
+      const block = document.querySelector<HTMLElement>(".lit-read")
+      return block?.dataset.litMode === "observer"
+    })
+    // Freeze the reveal and paint real page words uniformly before injecting a split.
+    const uniform = await page.addStyleTag({
+      content: `.lit-word { background: none !important; color: var(--text-hi) !important;
+        -webkit-text-fill-color: var(--text-hi) !important; }`,
+    })
+    await expectUniformWordGlyphs(page)
+    await uniform.evaluate((style) => style.parentNode?.removeChild(style))
+    await page.addStyleTag({
+      content: `.lit-word { color: transparent !important;
+        -webkit-text-fill-color: transparent !important;
+        background: linear-gradient(to right, var(--text-hi) 50%, var(--text-lo) 50%) !important;
+        background-clip: text !important; -webkit-background-clip: text !important; }`,
+    })
+    await expect(expectUniformWordGlyphs(page)).rejects.toThrow(
+      "a word must not contain both lit and unlit glyph regions",
+    )
+  })
+}
```

**File**: `packages/web/e2e/manifesto-glyphs.ts` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+import { writeFile } from "node:fs/promises"
+
+import { expect, test, type Page } from "@playwright/test"
+
+async function attachGlyphEvidence(
+  name: string,
+  body: string | Buffer,
+  contentType: string,
+): Promise<void> {
+  const extension = contentType === "application/json" ? ".json" : ".png"
+  const path = test.info().outputPath(`${name}${extension}`)
+  // Body-only attachments remain in reporter memory; list/GitHub reporters do not save them.
+  // Persist public-page glyph evidence explicitly so CI can upload it after assertion failure.
+  await writeFile(path, body)
+  await test.info().attach(name, { path, contentType })
+}
+
+export async function expectUniformWordGlyphs(page: Page): Promise<number> {
+  // Match rasterization across the gradient actual frame and flat endpoint references.
+  // LCD text can give their thin vertical stems different colored fringes.
+  const smoothing = await page.addStyleTag({
+    content: ".lit-read, .lit-read * { -webkit-font-smoothing: antialiased !important; }",
+  })
+  const actual = await page.screenshot({ animations: "disabled", scale: "css" })
+  const words = await page.evaluate(() => {
+    const visible = Array.from(
+      document.querySelectorAll<HTMLElement>(".lit-read .lit-word"),
+    ).filter((word) => {
+      const rect = word.getBoundingClientRect()
+      return (
+        rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth
+      )
+    })
+    const words = visible.map((word) => {
+      const rect = word.getBoundingClientRect()
+      const saved = word.getAttribute("style")
+      const computed = getComputedStyle(word)
+      const actualColor = computed.color
+      const actualProgress = computed.getPropertyValue("--lit-local")
+      word.dataset.uniformSavedStyle = saved ?? ""
+      // Capture the same glyph geometry at both brightness endpoints.
+      word.style.setProperty("background", "none", "important")
+      word.style.setProperty("color", "var(--text-lo)", "important")
+      word.style.setProperty("-webkit-text-fill-color", "var(--text-lo)", "important")
+      word.style.setProperty("filter", "none", "important")
+      word.style.setProperty("mask-image", "none", "important")
+      word.style.setProperty("text-shadow", "none", "important")
+      word.dataset.uniformReference = "true"
+      return {
+        text: word.textContent,
+        actualColor,
+        actualProgress,
+        clientRects: Array.from(word.getClientRects(), (rect) => ({
+          x: rect.x,
+          y: rect.y,
+          width: rect.width,
+          height: rect.height,
+        })),
+        x: rect.left,
+        y: rect.top,
+        width: rect.width,
+        height: rect.height,
+      }
+    })
+    const style = document.createElement("style")
+    style.id = "uniform-word-reference"
+    style.textContent = `
+      [data-uniform-reference] * { color: inherit !important; -webkit-text-fill-color: inherit !important;
+        background: none !important; opacity: 1 !important; filter: none !important;
+        mask-image: none !important; text-shadow: none !important; }
+      [data-uniform-reference]::before, [data-uniform-reference]::after { display: none !important; }
+    `
+    document.head.append(style)
+    return words
+  })
+  const low = await page.screenshot({ animations: "disabled", scale: "css" })
+  await page.evaluate(() => {
+    for (const word of document.querySelectorAll<HTMLElement>("[data-uniform-reference]")) {
+      word.style.setProperty("color", "var(--text-hi)", "important")
+      word.style.setProperty("-webkit-text-fill-color", "var(--text-hi)", "important")
+    }
+  })
+  const high = await page.screenshot({ animations: "disabled", scale: "css" })
+  await page.evaluate(() => {
+    document.getElementById("uniform-word-reference")?.remove()
+    for (const word of document.querySelectorAll<HTMLElement>("[data-uniform-reference]")) {
+      if (word.dataset.uniformSavedStyle) word.setAttribute("style", word.dataset.uniformSavedStyle)
+      else word.removeAttribute("style")
+      delete word.dataset.uniformSavedStyle
+      delete word.dataset.uniformReference
+    }
+  })
+  await smoothing.evaluate((style) => style.parentNode?.removeChild(style))
+  const measurement = await page.evaluate(
+    async ({ actual, low, high, words }) => {
+      async function pixels(base64: string): Promise<ImageData> {
+        const image = new Image()
+        image.src = `data:image/png;base64,${base64}`
+        await image.decode()
+        const canvas = document.createElement("canvas")
+        canvas.width = image.width
+        canvas.height = image.height
+        const context = canvas.getContext("2d")!
+        context.drawImage(image, 0, 0)
+        return context.getImageData(0, 0, image.width, image.height)
+      }
+      const [a, lo, hi] = await Promise.all([pixels(actual), pixels(low), pixels(high)])
+      let sampledGlyphPi
```

**File**: `packages/web/e2e/manifesto-reading.spec.ts` (modified, +66/-58)
```diff
@@ -1,5 +1,6 @@
 import { expect, test } from "@playwright/test"
 
+import { expectUniformWordGlyphs } from "./manifesto-glyphs"
 import { scrollSecret } from "./secret-reading-state"
 
 async function waitForReadingBlocks(): Promise<void> {
@@ -260,79 +261,86 @@ for (const locale of ["en", "ko"]) {
         }
       })
 
-      // Per-word, never split: at any frame, every word's glyphs share ONE brightness — the reveal
-      // steps BETWEEN words, so no word is cut in half by a line-wide gradient. Assert no word
-      // renders a clipped text gradient (which is what split words before).
+      // Measure actual glyph brightness against lit/unlit references, tolerating AA fringes.
+      // A split word has significant regions near both endpoints, unlike a uniform mid-fade.
       test("no word is ever split in half", async ({ page }) => {
         await page.emulateMedia({ reducedMotion: "no-preference" })
         await page.goto(`/${locale}/manifesto`)
         await page.evaluate(waitForReadingBlocks)
         const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
+        let checkedWords = 0
         for (const frac of [0.2, 0.4, 0.6, 0.8]) {
           await page.evaluate(scrollSecret, Math.round(maxY * frac))
           await page.evaluate(
             () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
           )
-          const split = await page.evaluate(() => {
-            for (const word of Array.from(
-              document.querySelectorAll<HTMLElement>(".lit-read .lit-word"),
-            )) {
-              const css = getComputedStyle(word)
-              // A word rendered as a clipped text gradient can be split; a per-word opacity/colour
-              // fade cannot. The reveal must NOT use background-clip: text.
-              const clip = css.webkitBackgroundClip || css.backgroundClip
-              const hasGradient = css.backgroundImage.includes("gradient")
-              if (hasGradient && (clip === "text" || css.color === "rgba(0, 0, 0, 0)")) {
-                return (word.textContent ?? "").slice(0, 12)
-              }
-            }
-            return null
-          })
-          expect(split, `scrollY frac ${frac}`).toBeNull()
+          checkedWords += await expectUniformWordGlyphs(page)
         }
+        expect(checkedWords).toBeGreaterThan(0)
       })
 
-      // Reading order: on any line, a word is never lit before the word to its left (the stagger
-      // runs left-to-right from the text column's left edge, not the viewport).
-      test("the reveal respects left-to-right reading order", async ({ page }) => {
-        await page.emulateMedia({ reducedMotion: "no-preference" })
-        await page.goto(`/${locale}/manifesto`)
-        await page.evaluate(waitForReadingBlocks)
-        const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
-        for (const frac of [0.25, 0.45, 0.65]) {
-          await page.evaluate(scrollSecret, Math.round(maxY * frac))
-          await page.evaluate(
-            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
+      // Continuous brightness follows reading order, including the last word before a wrap.
+      for (const mixedScript of [false, true]) {
+        test(`the reveal respects reading order across wrapped lines${mixedScript ? " (mixed script)" : ""}`, async ({
+          page,
+        }) => {
+          await page.emulateMedia({ reducedMotion: "no-preference" })
+          await page.goto(`/${locale}/manifesto`)
+          await page.evaluate(waitForReadingBlocks)
+          if (mixedScript) {
+            await page.evaluate(() => {
+              const body = document.querySelector<HTMLElement>(".lit-read .lit-text")!
+              const template = body.querySelector<HTMLElement>(".lit-word")!
+              body.replaceChildren(
+                ...Array.from({ length: 48 }, (_, index) => {
+                  const word = template.cloneNode(false) as HTMLElement
+                  word.textContent = index % 2 ? "한글" : "Latin"
+                  // Reproduce fractional glyph bounds within the same visual line, independent of
+                  // the host's installed font fallback metrics.
+                  word.style.position = "relative"
+                  word.style.top = `${index % 2 ? 0.25 : 0}px`
+                  return [word, document.createTextNode(" ")]
+                }).flat(),
+              )
+              window.dispatchEvent(new Event("resize"))
+            })
+          }
+          const maxY = await page.evaluate(
+            () => document.documentElement.scrollHeight - innerHeight,
           )
-          const violations = await page.evaluate(() => {
-            const words = Array.from(document.querySelectorAll<HTMLElement>(".lit-read .lit-word"))
-            const byLine = new Map<number, { left: number; lit: boolean }[]>()
-            fo
```

**File**: `packages/web/playwright.config.ts` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@ export default defineConfig({
       args: [
         "--use-mock-keychain",
         "--password-store=basic",
+        // Keep glyph screenshot references and actual text on grayscale AA in Linux CI.
+        "--disable-lcd-text",
         "--js-flags=--max-old-space-size=2048",
       ],
     },
```

---

### Incident Patch 13: `7a508a8c` (2026-10-04)
**Commit Message**: fix(web): preserve reading order across font metrics and persist glyph evidence

**File**: `.github/workflows/web-ci.yml` (modified, +1/-2)
```diff
@@ -110,8 +110,7 @@ jobs:
         uses: actions/upload-artifact@v7
         with:
           name: manifesto-glyph-failures
-          path: packages/web/test-results/**/.attachments/glyph-*
-          include-hidden-files: true
+          path: packages/web/test-results/*/glyph-*
           if-no-files-found: ignore
           retention-days: 7
 
```

**File**: `packages/web/components/landing/lit-progress.ts` (modified, +11/-3)
```diff
@@ -87,6 +87,7 @@ function armRevealDriver(): void {
           lines.push({ bottom: word.bottom, height: word.height, words: [word] })
         }
       }
+      const brightness = new Map<HTMLElement, number>()
       for (const [index, line] of lines.entries()) {
         const next = lines[index + 1]
         const previous = lines[index - 1]
@@ -98,12 +99,19 @@ function armRevealDriver(): void {
         const stagger = Math.min(line.height * 2, spacing)
         for (const { node, left } of line.words) {
           const withinLine = clamp01((left - bodyRect.left) / lineWidth) * stagger
-          node.style.setProperty(
-            "--lit-local",
-            String(clamp01((endTop - line.bottom - withinLine) / (line.height * 1.6) + 1)),
+          brightness.set(
+            node,
+            clamp01((endTop - line.bottom - withinLine) / (line.height * 1.6) + 1),
           )
         }
       }
+      // Font fallback can change line boxes and fade heights. Preserve DOM reading order even
+      // when those metrics split one visual line: no later word may overtake an earlier word.
+      let preceding = 1
+      for (const { node } of words) {
+        preceding = Math.min(preceding, brightness.get(node) ?? 1)
+        node.style.setProperty("--lit-local", String(preceding))
+      }
     }
   }
   const schedule = () => {
```

**File**: `packages/web/e2e/manifesto-glyphs.ts` (added, +223/-0)
```diff
@@ -0,0 +1,223 @@
+import { writeFile } from "node:fs/promises"
+
+import { expect, test, type Page } from "@playwright/test"
+
+async function attachGlyphEvidence(
+  name: string,
+  body: string | Buffer,
+  contentType: string,
+): Promise<void> {
+  const extension = contentType === "application/json" ? ".json" : ".png"
+  const path = test.info().outputPath(`${name}${extension}`)
+  // Body-only attachments remain in reporter memory; list/GitHub reporters do not save them.
+  // Persist public-page glyph evidence explicitly so CI can upload it after assertion failure.
+  await writeFile(path, body)
+  await test.info().attach(name, { path, contentType })
+}
+
+export async function expectUniformWordGlyphs(page: Page): Promise<number> {
+  const actual = await page.screenshot({ animations: "disabled", scale: "css" })
+  const words = await page.evaluate(() => {
+    const visible = Array.from(
+      document.querySelectorAll<HTMLElement>(".lit-read .lit-word"),
+    ).filter((word) => {
+      const rect = word.getBoundingClientRect()
+      return (
+        rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth
+      )
+    })
+    const words = visible.map((word) => {
+      const rect = word.getBoundingClientRect()
+      const saved = word.getAttribute("style")
+      const computed = getComputedStyle(word)
+      const actualColor = computed.color
+      const actualProgress = computed.getPropertyValue("--lit-local")
+      word.dataset.uniformSavedStyle = saved ?? ""
+      // Capture the same glyph geometry at both brightness endpoints.
+      word.style.setProperty("background", "none", "important")
+      word.style.setProperty("color", "var(--text-lo)", "important")
+      word.style.setProperty("-webkit-text-fill-color", "var(--text-lo)", "important")
+      word.style.setProperty("filter", "none", "important")
+      word.style.setProperty("mask-image", "none", "important")
+      word.style.setProperty("text-shadow", "none", "important")
+      word.dataset.uniformReference = "true"
+      return {
+        text: word.textContent,
+        actualColor,
+        actualProgress,
+        clientRects: Array.from(word.getClientRects(), (rect) => ({
+          x: rect.x,
+          y: rect.y,
+          width: rect.width,
+          height: rect.height,
+        })),
+        x: rect.left,
+        y: rect.top,
+        width: rect.width,
+        height: rect.height,
+      }
+    })
+    const style = document.createElement("style")
+    style.id = "uniform-word-reference"
+    style.textContent = `
+      [data-uniform-reference] * { color: inherit !important; -webkit-text-fill-color: inherit !important;
+        background: none !important; opacity: 1 !important; filter: none !important;
+        mask-image: none !important; text-shadow: none !important; }
+      [data-uniform-reference]::before, [data-uniform-reference]::after { display: none !important; }
+    `
+    document.head.append(style)
+    return words
+  })
+  const low = await page.screenshot({ animations: "disabled", scale: "css" })
+  await page.evaluate(() => {
+    for (const word of document.querySelectorAll<HTMLElement>("[data-uniform-reference]")) {
+      word.style.setProperty("color", "var(--text-hi)", "important")
+      word.style.setProperty("-webkit-text-fill-color", "var(--text-hi)", "important")
+    }
+  })
+  const high = await page.screenshot({ animations: "disabled", scale: "css" })
+  await page.evaluate(() => {
+    document.getElementById("uniform-word-reference")?.remove()
+    for (const word of document.querySelectorAll<HTMLElement>("[data-uniform-reference]")) {
+      if (word.dataset.uniformSavedStyle) word.setAttribute("style", word.dataset.uniformSavedStyle)
+      else word.removeAttribute("style")
+      delete word.dataset.uniformSavedStyle
+      delete word.dataset.uniformReference
+    }
+  })
+  const measurement = await page.evaluate(
+    async ({ actual, low, high, words }) => {
+      async function pixels(base64: string): Promise<ImageData> {
+        const image = new Image()
+        image.src = `data:image/png;base64,${base64}`
+        await image.decode()
+        const canvas = document.createElement("canvas")
+        canvas.width = image.width
+        canvas.height = image.height
+        const context = canvas.getContext("2d")!
+        context.drawImage(image, 0, 0)
+        return context.getImageData(0, 0, image.width, image.height)
+      }
+      const [a, lo, hi] = await Promise.all([pixels(actual), pixels(low), pixels(high)])
+      let sampledGlyphPixels = 0
+      const differences = words.flatMap((word) => {
+        let glyphPixels = 0
+        let litPixels = 0
+        let unlitPixels = 0
+        const columns = Array.from(
+          { length: Math.ceil(word.x + word.width) - Math.floor(word.x) },
+          () => ({ lit: 0, unlit: 0, intermediate: 0 }),
+        )
+        const classes = document.createElement("canvas")

```

**File**: `packages/web/e2e/manifesto-reading.spec.ts` (modified, +2/-210)
```diff
@@ -1,5 +1,6 @@
-import { expect, test, type Page } from "@playwright/test"
+import { expect, test } from "@playwright/test"
 
+import { expectUniformWordGlyphs } from "./manifesto-glyphs"
 import { scrollSecret } from "./secret-reading-state"
 
 async function waitForReadingBlocks(): Promise<void> {
@@ -31,215 +32,6 @@ function firstProgress(): string {
   return first?.dataset.litMode ?? "missing"
 }
 
-async function expectUniformWordGlyphs(page: Page): Promise<number> {
-  const actual = await page.screenshot({ animations: "disabled", scale: "css" })
-  const words = await page.evaluate(() => {
-    const visible = Array.from(
-      document.querySelectorAll<HTMLElement>(".lit-read .lit-word"),
-    ).filter((word) => {
-      const rect = word.getBoundingClientRect()
-      return (
-        rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth
-      )
-    })
-    const words = visible.map((word) => {
-      const rect = word.getBoundingClientRect()
-      const saved = word.getAttribute("style")
-      const computed = getComputedStyle(word)
-      const actualColor = computed.color
-      const actualProgress = computed.getPropertyValue("--lit-local")
-      word.dataset.uniformSavedStyle = saved ?? ""
-      // Capture the same glyph geometry at both brightness endpoints.
-      word.style.setProperty("background", "none", "important")
-      word.style.setProperty("color", "var(--text-lo)", "important")
-      word.style.setProperty("-webkit-text-fill-color", "var(--text-lo)", "important")
-      word.style.setProperty("filter", "none", "important")
-      word.style.setProperty("mask-image", "none", "important")
-      word.style.setProperty("text-shadow", "none", "important")
-      word.dataset.uniformReference = "true"
-      return {
-        text: word.textContent,
-        actualColor,
-        actualProgress,
-        clientRects: Array.from(word.getClientRects(), (rect) => ({
-          x: rect.x,
-          y: rect.y,
-          width: rect.width,
-          height: rect.height,
-        })),
-        x: rect.left,
-        y: rect.top,
-        width: rect.width,
-        height: rect.height,
-      }
-    })
-    const style = document.createElement("style")
-    style.id = "uniform-word-reference"
-    style.textContent = `
-      [data-uniform-reference] * { color: inherit !important; -webkit-text-fill-color: inherit !important;
-        background: none !important; opacity: 1 !important; filter: none !important;
-        mask-image: none !important; text-shadow: none !important; }
-      [data-uniform-reference]::before, [data-uniform-reference]::after { display: none !important; }
-    `
-    document.head.append(style)
-    return words
-  })
-  const low = await page.screenshot({ animations: "disabled", scale: "css" })
-  await page.evaluate(() => {
-    for (const word of document.querySelectorAll<HTMLElement>("[data-uniform-reference]")) {
-      word.style.setProperty("color", "var(--text-hi)", "important")
-      word.style.setProperty("-webkit-text-fill-color", "var(--text-hi)", "important")
-    }
-  })
-  const high = await page.screenshot({ animations: "disabled", scale: "css" })
-  await page.evaluate(() => {
-    document.getElementById("uniform-word-reference")?.remove()
-    for (const word of document.querySelectorAll<HTMLElement>("[data-uniform-reference]")) {
-      if (word.dataset.uniformSavedStyle) word.setAttribute("style", word.dataset.uniformSavedStyle)
-      else word.removeAttribute("style")
-      delete word.dataset.uniformSavedStyle
-      delete word.dataset.uniformReference
-    }
-  })
-  const measurement = await page.evaluate(
-    async ({ actual, low, high, words }) => {
-      async function pixels(base64: string): Promise<ImageData> {
-        const image = new Image()
-        image.src = `data:image/png;base64,${base64}`
-        await image.decode()
-        const canvas = document.createElement("canvas")
-        canvas.width = image.width
-        canvas.height = image.height
-        const context = canvas.getContext("2d")!
-        context.drawImage(image, 0, 0)
-        return context.getImageData(0, 0, image.width, image.height)
-      }
-      const [a, lo, hi] = await Promise.all([pixels(actual), pixels(low), pixels(high)])
-      let sampledGlyphPixels = 0
-      const differences = words.flatMap((word) => {
-        let glyphPixels = 0
-        let litPixels = 0
-        let unlitPixels = 0
-        const columns = Array.from(
-          { length: Math.ceil(word.x + word.width) - Math.floor(word.x) },
-          () => ({ lit: 0, unlit: 0, intermediate: 0 }),
-        )
-        const classes = document.createElement("canvas")
-        classes.width = columns.length
-        classes.height = Math.ceil(word.y + word.height) - Math.floor(word.y)
-        const classContext = classes.getContext("2d")!
-        for (let y = Math.ceil(word.y); y < Math.floor(word.y + word.height); y += 1) {
-        
```

---

### Incident Patch 14: `7d10ebda` (2026-10-04)
**Commit Message**: fix(gateway): dispose waits for a retiring store worker; report an unreadable legacy mailbox once

Review follow-ups for the idle store worker retire:
- dispose() returned at once while a retired worker was still closing its
  database, so a caller removing the agent directory next could race an
  open handle. The retire's close is kept and dispose() waits for it.
- an unreadable legacy mailbox is retried at every store open, and the
  store now reopens after each idle minute, so its warning repeated. It is
  logged once per session, and the wording says when it is retried.

**File**: `packages/omo-senpi/changes.md` (modified, +4/-2)
```diff
@@ -4,10 +4,12 @@ Every session that touches the gateway store (each terminal with a control endpo
 
 `store.ts` now retires the worker after `GATEWAY_STORE_IDLE_RETIRE_MS` (60 s) with no store call in flight. The worker is detached first, so a call made from that moment starts a fresh worker instead of posting to the closing one. Only then is its database closed and the thread terminated. A call holds the worker from its entry to its settle, the open included, so a worker with a request in flight never retires and no request is failed or replayed by a retire. The next call pays one open, about 12 ms, and the fresh worker gets the extension registrations restored as after a crash.
 
-Tests (`store-idle-retire.test.ts`):
+Tests (`store-idle-retire.test.ts`; the last one in `component.test.ts`):
 - after the idle interval the worker thread exits, and the next write lands on a fresh worker that keeps the registrations;
 - writes made before, during and after a retire each commit exactly once, in the order they were made. A retire that terminates without detaching first fails this;
-- a peer's send to a session whose worker retired is `started` and applied.
+- a peer's send to a session whose worker retired is `started` and applied;
+- `dispose()` called while a worker is retiring resolves only after that worker has exited, so a caller that removes the agent directory next never races an open database handle;
+- an unreadable legacy mailbox is retried at every store open, and now that the store reopens after each idle minute, its warning is logged once per session rather than at each reopen.
 
 ## 2026-10-04 - Package-local test runs get the hermetic home (#9578)
 
```

**File**: `packages/omo-senpi/src/components/thread/component.test.ts` (modified, +27/-0)
```diff
@@ -335,6 +335,33 @@ describe("thread component legacy mailbox import", () => {
       rmSync(agentDir, { recursive: true, force: true })
     }
   })
+
+  test("#given an unreadable legacy mailbox #when the store reopens after its idle worker retired #then the failure is reported once, not at every reopen", async () => {
+    const agentDir = mkdtempSync(join(tmpdir(), "thr-component-legacy-invalid-"))
+    try {
+      const stateDirectory = join(agentDir, "state")
+      // mailbox.jsonl as a directory: the legacy import cannot read it at any open.
+      mkdirSync(join(stateDirectory, "mailbox", "mailbox.jsonl"), { recursive: true })
+      const warnings: string[] = []
+      let retired!: () => void
+      const firstRetire = new Promise<void>((resolve) => { retired = resolve })
+      const store = createGatewayStore({ agentDir, legacyMailboxDirectories: [join(stateDirectory, "mailbox")], _test: { idleRetireMs: 1, onWorkerRetired: () => retired() } })
+      let invalidSeen = 0
+      let secondInvalid!: () => void
+      const reopened = new Promise<void>((resolve) => { secondInvalid = resolve })
+      store.onEvent((event) => { if (event.kind === "legacy_mailbox_invalid" && ++invalidSeen === 2) secondInvalid() })
+      const f = eventApi()
+      createThreadComponent({ host: host(), stateDirectory, agentDir: () => agentDir, store }).register(f.pi as never, context(warnings) as never)
+      await store.stats()
+      await within(firstRetire, 10_000, "the idle store worker to retire")
+      await store.stats()
+      await within(reopened, 10_000, "the reopened store to retry the unreadable mailbox")
+      expect(warnings.filter((message) => message.includes("legacy thread mailbox"))).toHaveLength(1)
+      await store.dispose()
+    } finally {
+      rmSync(agentDir, { recursive: true, force: true })
+    }
+  })
 })
 
 describe("thread component startup and shutdown touch no store they do not need", () => {
```

**File**: `packages/omo-senpi/src/components/thread/component.ts` (modified, +7/-1)
```diff
@@ -191,8 +191,14 @@ export function createThreadComponent(options: ThreadComponentOptions = {}): Omo
       // into the store once, when this session starts and the mailbox still exists on disk.
       const legacyMailbox = join(stateDirectory, "mailbox")
       const store = options.store ?? createGatewayStore({ agentDir: agentDir(), legacyMailboxDirectories: [legacyMailbox], ...(runtimeInstance === undefined ? {} : { runtimeInstance }) })
+      // Every store open retries an unreadable legacy mailbox, and an idle store reopens its worker on
+      // the next call, so the same failure would repeat each time: it is reported once per session.
+      const reportedInvalidMailboxes = new Set<string>()
       store.onEvent((event) => {
-        if (event.kind === "legacy_mailbox_invalid") ctx.logger.warn(`thread gateway: the legacy thread mailbox ${event.directory} could not be read and was not imported (retried at the next start): ${event.error}`)
+        if (event.kind === "legacy_mailbox_invalid" && !reportedInvalidMailboxes.has(event.directory)) {
+          reportedInvalidMailboxes.add(event.directory)
+          ctx.logger.warn(`thread gateway: the legacy thread mailbox ${event.directory} could not be read and was not imported (it is retried each time the store opens): ${event.error}`)
+        }
         if (event.kind === "legacy_mailbox_skipped") ctx.logger.warn(`thread gateway: ${event.items.length} legacy thread mailbox item(s) in ${event.directory} name no session id and were not imported: ${event.items.map((item) => `#${item.message_seq} -> ${JSON.stringify(item.target)}`).join(", ")}`)
       })
       const run: RunContext = { turn: 0, cause: undefined, consumed: [], local: false, answered: true }
```

**File**: `packages/omo-senpi/src/components/thread/gateway/store-idle-retire.test.ts` (modified, +19/-0)
```diff
@@ -77,6 +77,25 @@ test("#given writes before, during and after an idle retire #when the retire fir
   expect(await insertionOrder(store)).toEqual({ kind: "ok", value: [{ id: 1, value: "before" }, { id: 2, value: "during" }, { id: 3, value: "after" }] })
 })
 
+// Contract: after dispose() no worker holds the database, even one that was still retiring (a caller may remove the agent dir next).
+test("#given a worker that is retiring #when the store is disposed #then dispose resolves only after that worker exited", async () => {
+  const h = (harness = createGatewayHarness())
+  let exited = false
+  const disposal = signal<{ readonly done: Promise<void> }>()
+  let store!: GatewayStore
+  store = h.store({
+    _test: {
+      idleRetireMs: 1,
+      onWorkerStarted: (worker) => { worker.once("exit", () => { exited = true }) },
+      onWorkerRetiring: () => disposal.fire({ done: store.dispose() }),
+    },
+  })
+  await store.stats()
+  const { done } = await within(disposal.promise, 5_000, "the idle retire to start")
+  await within(done, 5_000, "dispose to resolve")
+  expect(exited).toBe(true)
+})
+
 // Reachability: a terminal whose store worker retired while it sat idle still takes a message at once.
 test("#given a target session whose store worker retired #when a peer sends to it #then the message is started and applied", async () => {
   const h = (harness = createGatewayHarness())
```

**File**: `packages/omo-senpi/src/components/thread/gateway/store.ts` (modified, +12/-3)
```diff
@@ -59,7 +59,7 @@ export type GatewayStoreOptions = {
     readonly onWorkerStarted?: (worker: Worker) => void
     /** A shorter idle interval than `GATEWAY_STORE_IDLE_RETIRE_MS`. */
     readonly idleRetireMs?: number
-    /** Runs right after an idle worker is detached, before it is closed: a call made here lands on a fresh worker. */
+    /** Runs right after an idle worker is detached and its close requested, before the close settles: a call made here lands on a fresh worker. */
     readonly onWorkerRetiring?: (worker: Worker) => void
     /** Runs once a retired worker has closed its database and exited. */
     readonly onWorkerRetired?: (worker: Worker) => void
@@ -183,6 +183,8 @@ export function createGatewayStore(options: GatewayStoreOptions): GatewayStore {
   /** Store calls between their entry and their settle, the worker's open included. */
   let callsInFlight = 0
   let idleTimer: ReturnType<typeof setTimeout> | undefined
+  /** The close-and-terminate of a retired worker, until it settles: `dispose` waits for it. */
+  let retiring: Promise<void> | undefined
   const idleRetireMs = options._test?.idleRetireMs ?? GATEWAY_STORE_IDLE_RETIRE_MS
   let resolveTarget = options.resolveTarget
   /** The registrations the current worker holds, restored on the next worker after one exits. */
@@ -312,11 +314,15 @@ export function createGatewayStore(options: GatewayStoreOptions): GatewayStore {
     if (disposed || idle === undefined || opened === undefined || callsInFlight > 0 || currentWorkerBusy()) return
     worker = undefined
     opened = undefined
-    options._test?.onWorkerRetiring?.(idle)
-    void post("close", null, idle)
+    const closing: Promise<void> = post("close", null, idle)
       .catch(() => undefined)
       .then(() => idle.terminate())
       .then(() => options._test?.onWorkerRetired?.(idle), () => options._test?.onWorkerRetired?.(idle))
+      .finally(() => {
+        if (retiring === closing) retiring = undefined
+      })
+    retiring = closing
+    options._test?.onWorkerRetiring?.(idle)
   }
 
   /** Holds the worker from retiring for the whole call, its open included, then re-arms the idle timer. */
@@ -424,6 +430,9 @@ export function createGatewayStore(options: GatewayStoreOptions): GatewayStore {
       if (disposed) return
       disposed = true
       cancelIdleRetire()
+      // A worker retired just before still holds its database until its close settles; a caller that
+      // removes the agent directory after `dispose` must find it closed.
+      await retiring
       const active = worker
       if (active === undefined) return
       await post("close", null).catch(() => undefined)
```

---

### Incident Patch 15: `6dc063db` (2026-10-04)
**Commit Message**: Merge pull request #9588 from cynkai/fix/9569-tasks-empty-state-names-all

fix(senpi-task): name /tasks --all in the empty /tasks answer

**File**: `packages/omo-senpi/src/components/task/commands.test.ts` (modified, +41/-0)
```diff
@@ -132,6 +132,47 @@ describe("registerTaskCommands", () => {
     expect(printed).toContain("st_other")
   })
 
+  it("#given tasks only in other sessions #when /tasks runs #then the empty answer names /tasks --all and the count elsewhere", async () => {
+    // given
+    const otherB = record({ task_id: "st_b", status: "running", parent_session_id: "session-b", root_session_id: "session-b" })
+    const otherC = record({ task_id: "st_c", status: "completed", parent_session_id: "session-c", root_session_id: "session-c" })
+    const pi = new FakeExtensionAPI()
+    registerTaskCommands(pi, fakeManager([otherB, otherC]))
+    const { ctx, ui } = commandCtx("session-a", "tui")
+
+    // when
+    await invoke(pi, "tasks", "", ctx)
+
+    // then
+    expect(ui.notifications).toEqual(["No tasks in this session. /tasks --all lists every session's tasks (2 in other sessions)."])
+  })
+
+  it("#given no tasks anywhere #when /tasks runs #then the empty answer still names /tasks --all without a count", async () => {
+    // given
+    const pi = new FakeExtensionAPI()
+    registerTaskCommands(pi, fakeManager([]))
+    const { ctx, ui } = commandCtx("session-a", "tui")
+
+    // when
+    await invoke(pi, "tasks", "", ctx)
+
+    // then
+    expect(ui.notifications).toEqual(["No tasks in this session. /tasks --all lists every session's tasks."])
+  })
+
+  it("#given no tasks anywhere #when /tasks --all runs #then it reports the empty store without a hint", async () => {
+    // given
+    const pi = new FakeExtensionAPI()
+    registerTaskCommands(pi, fakeManager([]))
+    const { ctx, ui } = commandCtx("session-a", "tui")
+
+    // when
+    await invoke(pi, "tasks", "--all", ctx)
+
+    // then
+    expect(ui.notifications).toEqual(["No tasks in all sessions."])
+  })
+
   it("#given a cancellable task #when /task-kill selects it and confirms #then cancelTask runs for that id", async () => {
     // given
     const running = record({ task_id: "st_kill", status: "running" })
```

**File**: `packages/omo-senpi/src/components/task/commands.ts` (modified, +12/-2)
```diff
@@ -54,11 +54,21 @@ function collect(manager: CommandManager, scope: ListScope | undefined): readonl
 async function runTasksCommand(manager: CommandManager, args: string, ctx: CommandContext): Promise<void> {
   const allScope = args.trim().split(/\s+/).includes("--all")
   const records = collect(manager, scopeFor(ctx, allScope))
-  const scopeLabel = allScope ? "all sessions" : "this session"
-  const text = records.length === 0 ? `No tasks in ${scopeLabel}.` : records.map(formatTaskRow).join("\n")
+  let text: string
+  if (records.length > 0) text = records.map(formatTaskRow).join("\n")
+  else if (allScope) text = "No tasks in all sessions."
+  else text = emptySessionTasksText(collect(manager, scopeFor(ctx, true)).length)
   ctx.ui?.notify(text, "info")
 }
 
+// An empty session scope is not an empty store: a restart, a second pane, or a run started
+// elsewhere all land here, so name the --all escape hatch and how many tasks it would show.
+function emptySessionTasksText(otherSessionCount: number): string {
+  const hint = "/tasks --all lists every session's tasks"
+  if (otherSessionCount === 0) return `No tasks in this session. ${hint}.`
+  return `No tasks in this session. ${hint} (${otherSessionCount} in other sessions).`
+}
+
 async function runTaskKillCommand(manager: CommandManager, ctx: CommandContext): Promise<void> {
   const ui = ctx.ui
   if (ui === undefined) return
```

#### Recent Merged Pull Requests:
- **PR #9641** (2026-10-06): test(task): synchronize cancellation cleanup witnesses (@code-yeongyu)
- **PR #9640** (2026-10-06): fix(publish): preserve the verified release stamping commit (@code-yeongyu)
- **PR #9639** (2026-10-06): release: v5.1.20 (@sisyphus-dev-ai)
- **PR #9638** (2026-10-06): chore(senpi): adopt 2026.10.10-2 with verified goal recovery (@code-yeongyu)
- **PR #9632** (2026-10-05): fix(codex): activate the newly installed plugin cache (@code-yeongyu)
- **PR #9615** (2026-10-05): release: v5.1.19 (@sisyphus-dev-ai)
- **PR #9609** (2026-10-05): chore(deps): adopt senpi 2026.10.10 (@code-yeongyu)
- **PR #9608** (2026-10-05): test(openclaw-core): reply-listener success test no longer races a 500 ms budget (@code-yeongyu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
