# Forensic Learning Record (Deep Inspection): herdrdev/herdr

> **Canonical Artifact**: `07_PROJECT_LEARNING/herdrdev-herdr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/herdrdev/herdr](https://github.com/herdrdev/herdr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:11:54.876Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `herdrdev/herdr`
- **Description**: the runtime your coding agents live on
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 42461 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app/state.rs`
```
use crate::config::{Keybinds, NewTerminalCwdConfig, SoundConfig, ToastConfig};
use crossterm::event::{KeyCode, KeyModifiers};
use ratatui::layout::Rect;
use ratatui::style::Color;

use crate::detect::AgentState;
use crate::layout::{PaneId, PaneInfo};

pub(crate) type InstalledPluginRegistry =
    std::collections::HashMap<String, crate::api::schema::InstalledPluginInfo>;
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PluginPaneRecord {
    pub plugin_id: String,
    pub entrypoint: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PopupPaneState {
    pub pane_id: PaneId,
    pub terminal_id: crate::terminal::TerminalId,
    pub width: Option<crate::popup_size::PopupSize>,
    pub height: Option<crate::popup_size::PopupSize>,
}

use crate::terminal_theme::{HostAppearance, TerminalTheme};
use crate::workspace::Workspace;

// ---------------------------------------------------------------------------
// Theme palette — all UI colors in one place, ready for theming
// ---------------------------------------------------------------------------

/// All colors used by the UI. Derived from a base accent color for now,
/// but structured so a full theme system can replace it later.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Palette {
    /// Primary accent (highlight, active borders).
    pub accent: Color,
    /// Background for the tab bar, floating panels, overlays, and modals.
    pub panel_bg: Color,
    /// Optional desktop sidebar background. Reset preserves the terminal background.
    pub sidebar_bg: Color,
    /// Background for the active workspace and focused agent rows.
    pub active_row_bg: Color,
    /// Background for the Navigate-mode cursor row in the sidebar.
    pub selection_bg: Color,
    /// Subtle surface background for selected/focused items.
    pub surface0: Color,
    /// Slightly lighter surface for hover/active states.
    pub surface1: Color,
    /// Very dim surface for separators.
    pub surface_dim: Color,
    /// Muted text (secondary info, numbers).
    pub overlay0: Color,
    /// Slightly brighter overlay text.
    pub overlay1: Color,
    /// Main text color — soft white.
    pub text: Color,
    /// Subdued text (workspace numbers, dim labels).
    pub subtext0: Color,
    /// Branch name / special label color.
    pub mauve: Color,
    /// Done / idle states.
    pub green: Color,
    /// Working / running states.
    pub yellow: Color,
    /// Needs attention / blocked states.
    pub red: Color,
    /// Unseen / done notification accent.
    pub blue: Color,
    /// Notification accent / unseen markers.
    pub teal: Color,
    /// Interrupted / warning states.
    pub peach: Color,
}

impl Palette {
    /// Catppuccin Mocha — the default.
    pub fn catppuccin() -> Self {
        Self {
            accent: Color::Rgb(137, 180, 250), // blue
            panel_bg: Color::Rgb(24, 24, 37),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(30, 30, 46),
            selection_bg: Color::Rgb(49, 50, 68),
            surface0: Color::Rgb(49, 50, 68),
            surface1: Color::Rgb(69, 71, 90),
            surface_dim: Color::Rgb(30, 30, 46),
            overlay0: Color::Rgb(108, 112, 134),
            overlay1: Color::Rgb(127, 132, 156),
            text: Color::Rgb(205, 214, 244),
            subtext0: Color::Rgb(166, 173, 200),
            mauve: Color::Rgb(203, 166, 247),
            green: Color::Rgb(166, 227, 161),
            yellow: Color::Rgb(249, 226, 175),
            red: Color::Rgb(243, 139, 168),
            blue: Color::Rgb(137, 180, 250),
            teal: Color::Rgb(148, 226, 213),
            peach: Color::Rgb(250, 179, 135),
        }
    }

    /// Catppuccin Latte — the light Catppuccin flavor.
    pub fn catppuccin_latte() -> Self {
        Self {
            accent: Color::Rgb(30, 102, 245),
            panel_bg: Color::Rgb(239, 241, 245),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(230, 233, 239),
            selection_bg: Color::Rgb(189, 208, 245),
            surface0: Color::Rgb(204, 208, 218),
            surface1: Color::Rgb(188, 192, 204),
            surface_dim: Color::Rgb(230, 233, 239),
            overlay0: Color::Rgb(156, 160, 176),
            overlay1: Color::Rgb(140, 143, 161),
            text: Color::Rgb(76, 79, 105),
            subtext0: Color::Rgb(108, 111, 133),
            mauve: Color::Rgb(136, 57, 239),
            green: Color::Rgb(64, 160, 43),
            yellow: Color::Rgb(223, 142, 29),
            red: Color::Rgb(210, 15, 57),
            blue: Color::Rgb(30, 102, 245),
            teal: Color::Rgb(23, 146, 153),
            peach: Color::Rgb(254, 100, 11),
        }
    }

    /// Terminal 16-color theme.
    pub fn terminal() -> Self {
        Self {
            accent: Color::Blue,
            panel_bg: Color::Reset,
            sidebar_bg: Color::Reset,
            active_row_bg: Color::DarkGray,
            selection_bg: Color::Reset,
            surface0: Color::Reset,
            surface1: Color::DarkGray,
            surface_dim: Color::DarkGray,
            overlay0: Color::Gray,
            overlay1: Color::White,
            text: Color::Reset,
            subtext0: Color::Gray,
            mauve: Color::Gray,
            green: Color::Green,
            yellow: Color::Yellow,
            red: Color::LightRed,
            blue: Color::Blue,
            teal: Color::Cyan,
            peach: Color::Yellow,
        }
    }

    /// Tokyo Night — blue-purple aesthetic.
    pub fn tokyo_night() -> Self {
        Self {
            accent: Color::Rgb(122, 162, 247), // blue
            panel_bg: Color::Rgb(26, 27, 38),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(35, 38, 54),
            selection_bg: Color::Rgb(45, 54, 80),
            surface0: Color::Rgb(36, 40, 59),
            surface1: Color::Rgb(65, 72, 104),
            surface_dim: Color::Rgb(26, 27, 38),
            overlay0: Color::Rgb(86, 95, 137),
            overlay1: Color::Rgb(105, 113, 150),
            text: Color::Rgb(192, 202, 245),
            subtext0: Color::Rgb(169, 177, 214),
            mauve: Color::Rgb(187, 154, 247),
            green: Color::Rgb(158, 206, 106),
            yellow: Color::Rgb(224, 175, 104),
            red: Color::Rgb(247, 118, 142),
            blue: Color::Rgb(122, 162, 247),
            teal: Color::Rgb(125, 207, 255),
            peach: Color::Rgb(255, 158, 100),
        }
    }

    /// Tokyo Night Day — the light Tokyo Night style.
    pub fn tokyo_night_day() -> Self {
        Self {
            accent: Color::Rgb(46, 125, 233),
            panel_bg: Color::Rgb(225, 226, 231),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(210, 211, 218),
            selection_bg: Color::Rgb(182, 202, 231),
            surface0: Color::Rgb(196, 200, 218),
            surface1: Color::Rgb(168, 174, 203),
            surface_dim: Color::Rgb(210, 211, 218),
            overlay0: Color::Rgb(137, 144, 179),
            overlay1: Color::Rgb(104, 112, 154),
            text: Color::Rgb(55, 96, 191),
            subtext0: Color::Rgb(97, 114, 176),
            mauve: Color::Rgb(120, 71, 189),
            green: Color::Rgb(88, 117, 57),
            yellow: Color::Rgb(140, 108, 62),
            red: Color::Rgb(245, 42, 101),
            blue: Color::Rgb(46, 125, 233),
            teal: Color::Rgb(17, 140, 116),
            peach: Color::Rgb(177, 92, 0),
        }
    }

    /// Dracula — purple/pink/green.
    pub fn dracula() -> Self {
        Self {
            accent: Color::Rgb(189, 147, 249), // purple
            panel_bg: Color::Rgb(40, 42, 54),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(55, 60, 82),
            selection_bg: Color::Rgb(70, 63, 93),
            surface0: Color::Rgb(68, 71, 90),
            surface1: Color::Rgb(98, 114, 164),
            surface_dim: Color::Rgb(40, 42, 54),
            overlay0: Color::Rgb(98, 114, 164),
            overlay1: Color::Rgb(130, 140, 180),
            text: Color::Rgb(248, 248, 242),
            subtext0: Color::Rgb(210, 210, 220),
            mauve: Color::Rgb(255, 121, 198), // pink
            green: Color::Rgb(80, 250, 123),
            yellow: Color::Rgb(241, 250, 140),
            red: Color::Rgb(255, 85, 85),
            blue: Color::Rgb(139, 233, 253), // cyan-ish
            teal: Color::Rgb(139, 233, 253),
            peach: Color::Rgb(255, 184, 108),
        }
    }

    /// Nord — frosty blue palette.
    pub fn nord() -> Self {
        Self {
            accent: Color::Rgb(136, 192, 208), // frost
            panel_bg: Color::Rgb(46, 52, 64),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(67, 76, 94),
            selection_bg: Color::Rgb(64, 80, 93),
            surface0: Color::Rgb(59, 66, 82),
            surface1: Color::Rgb(67, 76, 94),
            surface_dim: Color::Rgb(46, 52, 64),
            overlay0: Color::Rgb(76, 86, 106),
            overlay1: Color::Rgb(100, 110, 130),
            text: Color::Rgb(236, 239, 244),
            subtext0: Color::Rgb(216, 222, 233),
            mauve: Color::Rgb(180, 142, 173),
            green: Color::Rgb(163, 190, 140),
            yellow: Color::Rgb(235, 203, 139),
            red: Color::Rgb(191, 97, 106),
            blue: Color::Rgb(129, 161, 193),
            teal: Color::Rgb(143, 188, 187),
            peach: Color::Rgb(208, 135, 112),
        }
    }

    /// Gruvbox Dark — warm retro palette.
    pub fn gruvbox() -> Self {
        Self {
            accent: Color::Rgb(215, 153, 33), // yellow
            panel_bg: Color::Rgb(40, 40, 40),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(50, 49, 48),
            selection_bg: Color::Rgb(75, 63, 39),
            surface0: Color::Rgb(60, 56, 54),
            surface1: Color::Rgb(80, 73, 69),
            surface_dim: Color::Rgb(40, 40, 40),
    
```

### Core Architecture Module: `src/client/loop_config.rs`
```
use super::*;

pub(super) struct ClientLoopConfig {
    pub(super) sound_config: crate::config::SoundConfig,
    pub(super) mouse_scroll_lines: usize,
    pub(super) redraw_on_focus_gained: bool,
    pub(super) host_cursor: crate::config::HostCursorModeConfig,
    pub(super) kitty_graphics_enabled: bool,
    pub(super) pixel_geometry_enabled: bool,
    pub(super) pixel_geometry_fallback: bool,
    pub(super) mouse_capture_active: bool,
    pub(super) host_escape_disambiguation_active: bool,
    pub(super) initial_host_input: Vec<u8>,
    pub(super) endpoint_keybindings: bool,
    pub(super) remote_image_paste_key:
        Option<(crossterm::event::KeyCode, crossterm::event::KeyModifiers)>,
    pub(super) shell_config: Option<shell::ClientShellConfig>,
}

```

### Core Architecture Module: `src/client/shell/endpoint_agent_state.rs`
```
use std::collections::{HashMap, HashSet};

use crate::api::schema::AgentStatus;
use crate::protocol::{ClientShellAgent, ClientShellSnapshot, PaneSurfaceFrame};

#[derive(Clone, Debug, Default)]
pub(super) struct EndpointAgentPresentation {
    boot_id: Option<String>,
    acknowledged: HashMap<String, u64>,
    completed: HashMap<String, u64>,
    working: HashSet<String>,
    pending_completions: Option<(
        Option<u64>,
        crate::protocol::endpoint::EndpointAgentCompletions,
    )>,
}

impl EndpointAgentPresentation {
    pub(super) fn receive_completions(
        &mut self,
        generation: Option<u64>,
        completions: crate::protocol::endpoint::EndpointAgentCompletions,
    ) {
        if self
            .pending_completions
            .as_ref()
            .is_some_and(|(current_generation, current)| {
                *current_generation == generation
                    && current.boot_id == completions.boot_id
                    && current.revision >= completions.revision
            })
        {
            return;
        }
        self.pending_completions = Some((generation, completions));
    }

    #[cfg(test)]
    pub(super) fn project_snapshot(&mut self, snapshot: &mut ClientShellSnapshot) {
        self.project_snapshot_for_generation(snapshot, None);
    }

    pub(super) fn project_snapshot_for_generation(
        &mut self,
        snapshot: &mut ClientShellSnapshot,
        generation: Option<u64>,
    ) {
        if self.boot_id.as_deref() != Some(snapshot.boot_id.as_str()) {
            self.boot_id = Some(snapshot.boot_id.clone());
            self.acknowledged.clear();
            self.completed.clear();
            self.working.clear();
            self.acknowledged.extend(
                snapshot
                    .agents
                    .iter()
                    .map(|agent| (agent.pane_id.clone(), agent.state_change_seq)),
            );
        }
        let pane_ids: HashSet<&str> = snapshot
            .agents
            .iter()
            .map(|agent| agent.pane_id.as_str())
            .collect();
        self.acknowledged
            .retain(|pane_id, _| pane_ids.contains(pane_id.as_str()));
        self.completed
            .retain(|pane_id, _| pane_ids.contains(pane_id.as_str()));
        self.working
            .retain(|pane_id| pane_ids.contains(pane_id.as_str()));
        let completions = self
            .pending_completions
            .take()
            .filter(|(received_generation, projection)| {
                *received_generation == generation
                    && projection.boot_id == snapshot.boot_id
                    && projection.revision == snapshot.revision
            })
            .map(|(_, projection)| projection.completions);
        for agent in &mut snapshot.agents {
            match agent.agent_status {
                AgentStatus::Working => {
                    self.working.insert(agent.pane_id.clone());
                    self.completed.remove(&agent.pane_id);
                }
                AgentStatus::Blocked => {
                    self.completed.remove(&agent.pane_id);
                }
                AgentStatus::Idle | AgentStatus::Done => {
                    let observed_work = self.working.remove(&agent.pane_id);
                    let completed = completions.as_ref().map_or_else(
                        || {
                            observed_work
                                || self.completed.get(&agent.pane_id)
                                    == Some(&agent.state_change_seq)
                        },
                        |completions| {
                            completions.get(&agent.pane_id) == Some(&agent.state_change_seq)
                        },
                    );
                    if completed {
                        self.completed
                            .insert(agent.pane_id.clone(), agent.state_change_seq);
                    } else {
                        self.completed.remove(&agent.pane_id);
                    }
                }
                _ => {
                    self.working.remove(&agent.pane_id);
                    self.completed.remove(&agent.pane_id);
                }
            }
            agent.agent_status = self.projected_status(agent);
        }
        project_aggregate_status(snapshot);
    }

    pub(super) fn acknowledge_surface(
        &mut self,
        snapshot: &mut ClientShellSnapshot,
        surface: &PaneSurfaceFrame,
        outer_focused: Option<bool>,
    ) -> bool {
        if outer_focused == Some(false)
            || self.boot_id.as_deref() != Some(surface.boot_id.as_str())
            || snapshot.boot_id != surface.boot_id
            || snapshot.revision != surface.projection_revision
        {
            return false;
        }

        let mut changed = false;
        for pane in &surface.panes {
            let Some(agent) = snapshot
                .agents
                .iter()
                .find(|agent| agent.pane_id == pane.pane_id)
            else {
                continue;
            };
            let acknowledged = self.acknowledged.entry(agent.pane_id.clone()).or_default();
            if *acknowledged < agent.state_change_seq {
                *acknowledged = agent.state_change_seq;
                changed = true;
            }
        }
        if changed {
            for agent in &mut snapshot.agents {
                agent.agent_status = self.projected_status(agent);
            }
            project_aggregate_status(snapshot);
        }
        changed
    }

    pub(super) fn seen(&self, agent: &ClientShellAgent) -> bool {
        self.completed.get(&agent.pane_id).is_none_or(|completion| {
            self.acknowledged
                .get(&agent.pane_id)
                .is_some_and(|sequence| sequence >= completion)
        })
    }

    fn projected_status(&self, agent: &ClientShellAgent) -> AgentStatus {
        match agent.agent_status {
            AgentStatus::Idle | AgentStatus::Done => {
                if self.seen(agent) {
                    AgentStatus::Idle
                } else {
                    AgentStatus::Done
                }
            }
            status => status,
        }
    }
}

fn project_aggregate_status(snapshot: &mut ClientShellSnapshot) {
    for tab in &mut snapshot.tabs {
        if let Some(status) = snapshot
            .agents
            .iter()
            .filter(|agent| agent.tab_id == tab.tab_id)
            .map(|agent| agent.agent_status)
            .max_by_key(|status| super::status_priority(*status))
        {
            tab.agent_status = status;
        }
    }
    for workspace in &mut snapshot.workspaces {
        if let Some(status) = snapshot
            .agents
            .iter()
            .filter(|agent| agent.workspace_id == workspace.workspace_id)
            .map(|agent| agent.agent_status)
            .max_by_key(|status| super::status_priority(*status))
        {
            workspace.agent_status = status;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{
        endpoint::EndpointAgentCompletions, FrameData, PaneSurfacePane, SurfaceRect,
    };

    fn agent(status: AgentStatus, sequence: u64) -> ClientShellAgent {
        ClientShellAgent {
            pane_id: "agent-pane".into(),
            workspace_id: "workspace".into(),
            tab_id: "tab".into(),
            name: None,
            display_agent: None,
            agent: None,
            title: None,
            terminal_title: None,
            terminal_title_stripped: None,
            agent_status: status,
            state_change_seq: sequence,
            state_labels: Vec::new(),
            tokens: Vec::new(),
            focused: true,
        }
    }

    fn snapshot(status: AgentStatus, sequence: u64, revision: u64) -> ClientShellSnapshot {
        let mut snapshot = crate::client::shell::tests::snapshot();
        snapshot.boot_id = "endpoint-boot".into();
        snapshot.revision = revision;
        snapshot.agents = vec![agent(status, sequence)];
        snapshot
    }

    fn surface(revision: u64) -> PaneSurfaceFrame {
        let rect = SurfaceRect {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
        };
        PaneSurfaceFrame {
            boot_id: "endpoint-boot".into(),
            projection_revision: revision,
            surface_revision: 1,
            frame: FrameData {
                cells: Vec::new(),
                width: 0,
                height: 0,
                cursor: None,
                hyperlinks: Vec::new(),
                graphics: Vec::new(),
            },
            panes: vec![PaneSurfacePane {
                pane_id: "agent-pane".into(),
                content_revision: 1,
                rect,
                inner_rect: rect,
                scrollbar_rect: None,
                scroll: None,
                focused: true,
                mouse_reporting: false,
                sgr_pixel_mouse: false,
                alternate_screen_active: false,
                pixel_width: 0,
                pixel_height: 0,
            }],
            splits: Vec::new(),
            popup: None,
            graphics: Default::default(),
        }
    }

    #[test]
    fn first_snapshot_establishes_an_idle_baseline_without_server_seen_authority() {
        let mut presentation = EndpointAgentPresentation::default();
        let mut snapshot = snapshot(AgentStatus::Done, 4, 1);

        presentation.project_snapshot(&mut snapshot);

        assert_eq!(snapshot.agents[0].agent_status, AgentStatus::Idle);
    }

    fn assert_idle_sequence(states: &[(AgentStatus, u64)]) {
        let mut presentation = EndpointAgentPresentation::default();
        let mut projected = AgentStatus::Unknown;
        for (revision, &(status, seq)) in states.iter().enumerate() {
            let mut snapshot = snapshot(status, seq, revision
```

### Core Architecture Module: `src/client/shell/render.rs`
```
use super::*;

#[path = "../shell/overlays.rs"]
mod overlays;
#[path = "../shell/sidebar.rs"]
pub(in crate::client::shell) mod sidebar;
#[path = "../shell/tabs.rs"]
mod tabs;

pub(super) use super::agent_sidebar::{ordered_agent_pane_ids, render_agent_panel};
pub(super) use super::aggregate_navigation::navigator_rows as client_navigator_rows;
pub(super) use overlays::{render_client_overlay, render_context_menu, render_global_menu};
pub(super) use sidebar::{render_collapsed_sidebar, render_sidebar, workspace_entries};
pub(super) use tabs::{render_tab_bar, tab_bar_status_width};

pub(in crate::client::shell) fn render_sidebar_background(
    buffer: &mut Buffer,
    area: Rect,
    palette: &Palette,
) {
    buffer.set_style(area, Style::default().bg(palette.sidebar_bg));
    let separator_x = area.right().saturating_sub(1);
    for y in area.y..area.bottom() {
        if let Some(cell) = buffer.cell_mut((separator_x, y)) {
            cell.set_symbol("│");
            cell.set_style(Style::default().fg(palette.surface_dim));
        }
    }
}

pub(super) fn render_mode_bar(
    buffer: &mut Buffer,
    pane_area: Rect,
    mode: ClientShellMode,
    copy_mode: Option<&ClientCopyModeState>,
    endpoint_error: Option<&str>,
    update_available: bool,
    keybinds: &LiveKeybindConfig,
    palette: &Palette,
) -> Option<Rect> {
    if (mode == ClientShellMode::Terminal && endpoint_error.is_none()) || pane_area.is_empty() {
        return None;
    }

    let bar = Rect::new(
        pane_area.x,
        pane_area.y + pane_area.height.saturating_sub(1),
        pane_area.width,
        1,
    );
    let base = Style::default().fg(palette.overlay0).bg(palette.panel_bg);
    for x in bar.x..bar.x + bar.width {
        buffer[(x, bar.y)].set_symbol(" ").set_style(base);
    }

    let key = Style::default()
        .fg(palette.accent)
        .bg(palette.panel_bg)
        .add_modifier(Modifier::BOLD);
    let mode_style = Style::default()
        .fg(match palette.panel_bg {
            ratatui::style::Color::Reset => palette.surface_dim,
            color => color,
        })
        .bg(if mode == ClientShellMode::Resize {
            palette.mauve
        } else {
            palette.accent
        })
        .add_modifier(Modifier::BOLD);
    let prefix = keybinds.primary_prefix_label();
    let prefix_rhs = |bindings: &crate::config::ActionKeybinds| {
        bindings
            .prefix_rhs_label()
            .unwrap_or_else(|| "unset".to_owned())
    };

    let mut segments = Vec::<(String, Style)>::new();
    if let Some(error) = endpoint_error {
        segments.extend([
            (" ERROR ".to_owned(), mode_style),
            (format!(" {error}"), base),
        ]);
    } else {
        match mode {
            ClientShellMode::Prefix => {
                segments.extend([
                    (" PREFIX ".to_owned(), mode_style),
                    (" ".to_owned(), base),
                    ("esc".to_owned(), key),
                    (" cancel  ".to_owned(), base),
                    (prefix, key),
                    (" send prefix  ".to_owned(), base),
                    (prefix_rhs(&keybinds.keybinds.workspace_picker), key),
                    (" workspace nav  ".to_owned(), base),
                    (prefix_rhs(&keybinds.keybinds.help), key),
                    (" keybinds".to_owned(), base),
                ]);
            }
            ClientShellMode::Navigate => {
                segments.extend([
                    (" NAVIGATE ".to_owned(), mode_style),
                    (" esc back  ".to_owned(), base),
                    ("↑/↓".to_owned(), key),
                    (" workspace  ".to_owned(), base),
                    ("tab".to_owned(), key),
                    (" pane  ".to_owned(), base),
                    (prefix_rhs(&keybinds.keybinds.help), key),
                    (" keybinds".to_owned(), base),
                ]);
            }
            ClientShellMode::Resize => {
                segments.extend([
                    (" RESIZE ".to_owned(), mode_style),
                    ("  ".to_owned(), base),
                    ("h/l".to_owned(), key),
                    (" width  ".to_owned(), base),
                    ("j/k".to_owned(), key),
                    (" height  ".to_owned(), base),
                    ("esc".to_owned(), key),
                    (" done".to_owned(), base),
                ]);
            }
            ClientShellMode::Copy => {
                let copy_mode = copy_mode?;
                if let Some(prompt) = copy_mode.search_prompt.as_ref() {
                    let marker = match prompt.direction {
                        crate::api::schema::PaneCopySearchDirection::Forward => "/",
                        crate::api::schema::PaneCopySearchDirection::Backward => "?",
                    };
                    buffer.set_stringn(bar.x, bar.y, " COPY ", usize::from(bar.width), mode_style);
                    let prefix = 8.min(bar.width);
                    if bar.width >= 8 {
                        buffer.set_string(bar.x + 7, bar.y, marker, key);
                    }
                    let footer = "  enter search  esc cancel";
                    let footer_width = if bar.width >= 50 {
                        footer.len() as u16
                    } else {
                        0
                    };
                    let field = Rect::new(
                        bar.x + prefix,
                        bar.y,
                        bar.width.saturating_sub(prefix + footer_width),
                        1,
                    );
                    if let Some(cursor) = text_editor::render(
                        buffer,
                        field,
                        &prompt.query,
                        Style::default().fg(palette.text).bg(palette.panel_bg),
                    ) {
                        buffer[(cursor.x, cursor.y)]
                            .set_style(Style::default().fg(palette.panel_bg).bg(palette.text));
                    }
                    if footer_width > 0 {
                        buffer.set_string(bar.right() - footer_width, bar.y, footer, base);
                    }
                    return Some(bar);
                } else {
                    let select = if copy_mode.selection.is_some() {
                        "selecting"
                    } else {
                        "select"
                    };
                    let match_status = copy_mode
                        .search_current_global
                        .map(|current| format!(" {}/{}", current + 1, copy_mode.search_total))
                        .or_else(|| (!copy_mode.search_query.is_empty()).then(|| " 0/0".to_owned()))
                        .unwrap_or_default();
                    let (exit_keys, exit_label) =
                        if copy_mode.search_query.is_empty() && copy_mode.selection.is_none() {
                            ("q/esc", " exit")
                        } else {
                            ("esc", " clear  q exit")
                        };
                    segments.extend([
                        (" COPY ".to_owned(), mode_style),
                        (" ".to_owned(), base),
                        ("h/j/k/l w/b/e { }".to_owned(), key),
                        (" move  ".to_owned(), base),
                        ("/ ?".to_owned(), key),
                        (" search  ".to_owned(), base),
                        ("n/N".to_owned(), key),
                        (format!(" repeat{match_status}  "), base),
                        ("v/space".to_owned(), key),
                        (format!(" {select}  "), base),
                        ("y/enter".to_owned(), key),
                        (" copy  ".to_owned(), base),
                        (exit_keys.to_owned(), key),
                        (exit_label.to_owned(), base),
                    ]);
                }
            }
            ClientShellMode::Terminal => unreachable!(),
        }
    }

    let mut x = bar.x;
    let end = bar.x + bar.width;
    for (text, style) in segments {
        if x >= end {
            break;
        }
        let remaining = end - x;
        buffer.set_stringn(x, bar.y, &text, usize::from(remaining), style);
        x = x.saturating_add(
            u16::try_from(UnicodeWidthStr::width(text.as_str()))
                .unwrap_or(u16::MAX)
                .min(remaining),
        );
    }
    if update_available && mode == ClientShellMode::Navigate {
        let width = 13.min(bar.width);
        let area = Rect::new(bar.right().saturating_sub(width), bar.y, width, 1);
        buffer.set_style(area, Style::default().bg(palette.panel_bg));
        put_right_text(
            buffer,
            area,
            area.y,
            " update ready",
            Style::default()
                .fg(palette.accent)
                .bg(palette.panel_bg)
                .add_modifier(Modifier::BOLD),
        );
    }
    Some(bar)
}

pub(super) struct ShellRenderState<'a> {
    pub(super) machine_diagnostics: &'a super::machine_diagnostics::MachineDiagnostics,
    pub(super) endpoints: &'a [ClientShellEndpoint],
    pub(super) active_endpoint_id: &'a ClientEndpointId,
    pub(super) collapsed_endpoints: &'a HashSet<ClientEndpointId>,
    pub(super) collapsed_groups: &'a HashSet<String>,
    pub(super) remote_collapsed_groups: &'a HashMap<ClientEndpointId, HashSet<String>>,
    pub(super) workspace_scroll: &'a mut usize,
    pub(super) agent_scroll: &'a mut usize,
    pub(super) tab_scroll: &'a mut usize,
    pub(super) reveal_focused_workspace: &'a mut bool,
    pub(super) reveal_focused_tab: &'a mut bool,
    pub(super) sidebar_collapsed: bool,
    pub(super) sidebar_section_split: f32,
    pub(super) tab_drag_insert_index: Option<usize>,
    pub(super) selected_workspace_id: Option<&'a WorkspaceNavigationTarget>,
    pub(super) reveal_navigation_workspace: &'a mut bool,
    pub(supe
```

### Core Architecture Module: `src/client/shell/state.rs`
```
use super::*;

pub(super) const MIN_TAB_WIDTH: u16 = 8;
pub(super) const NEW_TAB_WIDTH: u16 = 3;
pub(super) const WORKSPACE_HEADER_ROWS: u16 = 2;
const ENDPOINT_ERROR_TIMEOUT_SECS: u64 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ClientShellKeybindingSource {
    Local,
    RemoteLocal,
    Endpoint,
}

pub(crate) struct ClientShellConfig {
    pub(super) sidebar_width: u16,
    pub(super) sidebar_min_width: u16,
    pub(super) sidebar_max_width: u16,
    pub(super) sidebar_start_collapsed: bool,
    pub(super) sidebar_collapsed_mode: SidebarCollapsedModeConfig,
    pub(super) mobile_width_threshold: u16,
    pub(super) tab_bar_position: TabBarPositionConfig,
    pub(super) hide_tab_bar_when_single_tab: bool,
    pub(super) spaces: SpacesSidebarConfig,
    pub(super) agents: crate::config::AgentsSidebarConfig,
    pub(super) agent_panel_sort: crate::config::AgentPanelSortConfig,
    pub(super) status_indicators: crate::config::StatusIndicatorStyle,
    pub(super) sound_enabled: bool,
    pub(super) toast_delivery: crate::config::ToastDelivery,
    pub(super) toast_delay_seconds: u64,
    pub(super) toast_position: crate::config::ToastHerdrPosition,
    pub(super) copy_on_select: bool,
    pub(super) clipboard_toast_enabled: bool,
    pub(super) clipboard_toast_position: crate::config::ToastClipboardPosition,
    pub(super) theme_name: String,
    pub(super) theme_runtime: crate::app::state::ThemeRuntimeConfig,
    pub(super) palette: Palette,
    pub(super) keybinds: LiveKeybindConfig,
    pub(super) local_keys: crate::config::KeysConfig,
    pub(super) keybinding_source: ClientShellKeybindingSource,
    pub(super) prompt_new_tab_name: bool,
    pub(super) prompt_new_workspace_name: bool,
    pub(super) confirm_close: bool,
    pub(super) mouse_capture: bool,
    pub(super) mouse_scroll_lines: usize,
    pub(super) right_click_passthrough_modifiers: Option<crossterm::event::KeyModifiers>,
    pub(super) redraw_on_focus_gained: bool,
    pub(super) switch_ascii_input_source_in_prefix: bool,
    pub(super) local_config_path: std::path::PathBuf,
    pub(super) preferences_path: Option<std::path::PathBuf>,
    pub(super) preferences: preferences::ClientChromePreferences,
    pub(super) startup_config_diagnostic: Option<String>,
    pub(super) startup_onboarding: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ClientShellLayout {
    pub sidebar: Rect,
    pub tab_bar: Rect,
    pub mobile_header: Rect,
    pub pane_surface: Rect,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum ClientMobileTarget {
    Machine(ClientEndpointId),
    NewWorkspace,
    Workspace {
        endpoint_id: ClientEndpointId,
        workspace_id: String,
    },
    NewTab,
    Tab {
        endpoint_id: ClientEndpointId,
        tab_id: String,
    },
    Agent {
        endpoint_id: ClientEndpointId,
        pane_id: String,
    },
    Menu(usize),
}

#[derive(Default)]
pub(super) struct ShellHitMap {
    pub(super) machines: Vec<MachineHit>,
    pub(super) workspaces: Vec<WorkspaceHit>,
    pub(super) workspace_body: Rect,
    pub(super) workspace_scrollbar: Rect,
    pub(super) workspace_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) workspace_max_scroll: usize,
    pub(super) tabs: Vec<(Rect, String)>,
    pub(super) panes: Vec<PaneHit>,
    pub(super) popup: Option<PaneHit>,
    pub(super) pane_splits: Vec<PaneSplitHit>,
    pub(super) agents: Vec<(Rect, String)>,
    pub(super) endpoint_agents: Vec<(Rect, ClientEndpointId, String)>,
    pub(super) agent_body: Rect,
    pub(super) agent_scrollbar: Rect,
    pub(super) agent_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) agent_max_scroll: usize,
    pub(super) agent_sort_toggle: Rect,
    pub(super) sidebar_divider: Rect,
    pub(super) sidebar_section_divider: Rect,
    pub(super) sidebar_toggle: Rect,
    pub(super) new_workspace: Rect,
    pub(super) new_tab: Rect,
    pub(super) tab_scroll_left: Rect,
    pub(super) tab_scroll_right: Rect,
    pub(super) mobile_switch: Rect,
    pub(super) mobile_close: Rect,
    pub(super) mobile_targets: Vec<(Rect, ClientMobileTarget)>,
    pub(super) mobile_max_scroll: usize,
    pub(super) global_launcher: Rect,
    pub(super) notification_toast: Rect,
    pub(super) global_menu_rows: Vec<(Rect, usize)>,
    pub(super) context_menu_rows: Vec<(Rect, usize)>,
    pub(super) overlay_primary: Rect,
    pub(super) overlay_clear: Rect,
    pub(super) overlay_cancel: Rect,
    pub(super) navigator_popup: Rect,
    pub(super) navigator_search: Rect,
    pub(super) navigator_rows: Vec<(Rect, ClientNavigatorTarget)>,
    pub(super) navigator_scrollbar: Rect,
    pub(super) navigator_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) worktree_search: Rect,
    pub(super) worktree_rows: Vec<(Rect, usize)>,
    pub(super) help_popup: Rect,
    pub(super) help_scrollbar: Rect,
    pub(super) help_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) help_max_scroll: usize,
    pub(super) settings_popup: Rect,
    pub(super) settings_tabs: Vec<(Rect, ClientSettingsSection)>,
    pub(super) settings_choices: Vec<(Rect, usize)>,
    pub(super) product_announcement_scrollbar: Rect,
    pub(super) product_announcement_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) product_announcement_max_scroll: usize,
    pub(super) release_notes_scrollbar: Rect,
    pub(super) release_notes_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) release_notes_max_scroll: usize,
}

#[derive(Clone)]
pub(super) struct PaneHit {
    pub(super) rect: Rect,
    pub(super) inner_rect: Rect,
    pub(super) scrollbar_rect: Option<Rect>,
    pub(super) scroll: Option<crate::pane::ScrollMetrics>,
    pub(super) pane_id: String,
    pub(super) popup: bool,
    pub(super) mouse_reporting: bool,
    pub(super) sgr_pixel_mouse: bool,
    pub(super) pixel_width: u32,
    pub(super) pixel_height: u32,
}

#[derive(Clone)]
pub(super) struct PaneSplitHit {
    pub(super) direction: crate::protocol::PaneSurfaceSplitDirection,
    pub(super) pos: u16,
    pub(super) area: Rect,
    pub(super) hit_rect: Rect,
    pub(super) path: Vec<bool>,
    pub(super) topology_signature: u64,
}

pub(super) struct ClientPaneMouseGesture {
    pub(super) hit: PaneHit,
    pub(super) button: crossterm::event::MouseButton,
    pub(super) stripped_modifiers: crossterm::event::KeyModifiers,
    pub(super) last_event: crossterm::event::MouseEvent,
    pub(super) last_position: crate::protocol::ClientMousePosition,
}

pub(super) struct ClientWorkspacePress {
    pub(super) endpoint_id: ClientEndpointId,
    pub(super) workspace_id: String,
    pub(super) start_column: u16,
    pub(super) start_row: u16,
}

pub(super) struct ClientTabPress {
    pub(super) tab_id: String,
    pub(super) workspace_id: String,
    pub(super) start_column: u16,
    pub(super) start_row: u16,
}

pub(super) enum ClientChromeDrag {
    SidebarWidth,
    SidebarSection,
    WorkspaceScrollbar {
        grab_row_offset: u16,
    },
    AgentScrollbar {
        grab_row_offset: u16,
    },
    HelpScrollbar {
        grab_row_offset: u16,
    },
    NavigatorScrollbar {
        grab_row_offset: u16,
    },
    ProductAnnouncementScrollbar {
        grab_row_offset: u16,
    },
    ReleaseNotesScrollbar {
        grab_row_offset: u16,
    },
    Tab {
        tab_id: String,
        workspace_id: String,
        insert_index: Option<usize>,
    },
    Workspace {
        source_workspace_id: String,
        target: Option<(Option<String>, u16)>,
    },
    PaneSplit {
        hit: PaneSplitHit,
        tab_id: String,
        grab_offset: i32,
        last_sent_ratio: Option<f32>,
        last_sent_at: Option<std::time::Instant>,
    },
    PaneScrollbar {
        hit: PaneHit,
        grab_row_offset: u16,
        last_sent_offset: Option<usize>,
        last_sent_at: Option<std::time::Instant>,
    },
}

pub(super) struct WorkspaceHit {
    pub(super) rect: Rect,
    pub(super) endpoint_id: ClientEndpointId,
    pub(super) workspace_id: String,
    pub(super) indented: bool,
    pub(super) group_toggle: Option<(Rect, String)>,
}

#[derive(Debug)]
pub(crate) enum ClientShellAction {
    Endpoint {
        endpoint_id: ClientEndpointId,
        boot_id: String,
        request: Box<crate::api::schema::Request>,
    },
    ClipboardWrite(Vec<u8>),
    OpenSafeWebUrl(String),
    ActivateEndpoint {
        endpoint_id: ClientEndpointId,
        target: Option<ClientEndpointFocusTarget>,
    },
    ReplayMouse(Vec<crossterm::event::MouseEvent>),
    Keybind(crate::input::KeybindAction),
}

#[derive(Default)]
pub(crate) struct ClientShellInput {
    pub detach: bool,
    pub repaint: bool,
    pub resize: bool,
    pub query_host_appearance: bool,
    pub query_host_theme: bool,
    pub requests: Vec<ClientMessage>,
    pub actions: Vec<ClientShellAction>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ClientShellMode {
    Terminal,
    Prefix,
    Navigate,
    Resize,
    Copy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ClientShellOverlayKind {
    Onboarding,
    ProductAnnouncement,
    ReleaseNotes,
    Rename,
    ConfirmClose,
    Help,
    Navigator,
    WorktreeCreate,
    WorktreeOpen,
    WorktreeRemove,
    ContextMenu,
    GlobalMenu,
    Settings,
}

#[derive(Debug)]
pub(super) enum ClientRenameTarget {
    NewWorkspace {
        source_workspace_id: Option<String>,
        cwd: Option<String>,
        suggested_name: String,
    },
    Workspace {
        workspace_id: String,
    },
    NewTab {
        workspace_id: String,
        default_name: String,
    },
    Tab {
        tab_id: String,
        auto_name: bool,
        original_name: String,
    },
    Pane {
        pane_id: String,
    },
}

#[derive(Debug)]
pub(super) struct ClientRenameOverlay {
    pub(super) title: &'static str,
    pub(super) input: TextEditor,
    pub(super) ta
```

### Core Architecture Module: `src/client/state.rs`
```
use super::*;

#[cfg(unix)]
const MAX_RETIRED_DIRECT_GRAPHICS: usize = 64;

#[cfg(unix)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum RetiredDirectGraphicsMatch {
    None,
    Exact,
    Saturated,
}

#[cfg(unix)]
pub(super) struct RetiredDirectGraphics {
    generation: u64,
    transfers: Vec<(u64, u32)>,
    saturated: bool,
}

#[cfg(unix)]
impl RetiredDirectGraphics {
    fn new(generation: u64) -> Self {
        Self {
            generation,
            transfers: Vec::new(),
            saturated: false,
        }
    }
}

/// State tracking for the thin client.
pub(super) struct ClientState {
    /// Stateful semantic-frame encoder used when the server sends FrameData.
    pub(super) blit_encoder: render_ansi::BlitEncoder,
    pub(super) image_files: image_files::FileTransport,
    pub(super) mouse_capture_active: bool,
    pub(super) endpoint_mouse_capture_requested: bool,
    pub(super) endpoint_sgr_pixels_requested: bool,
    /// Latest physical host theme observations, retained so an endpoint selected after the
    /// observation receives the same client-owned baseline.
    pub(super) host_theme_updates: Vec<crate::protocol::ClientHostThemeUpdate>,
    pub(super) direct_mouse_capture_preference: bool,
    pub(super) shell_mouse_capture_preference: bool,
    pub(super) direct_keyboard_protocol: crate::terminal_modes::DirectHostKeyboardState,
    pub(super) pane_keyboard_report_all: bool,
    pub(super) keyboard_report_all_active: bool,
    pub(super) reported_size: (u16, u16),
    pub(super) reported_cell_size: (u32, u32),
    pub(super) sound_config: crate::config::SoundConfig,
    pub(super) kitty_graphics_enabled: bool,
    pub(super) pixel_geometry_enabled: bool,
    pub(super) pixel_geometry_exact: bool,
    #[cfg(unix)]
    pub(super) direct_graphics_response: Arc<Mutex<direct_graphics::ResponseMatcher>>,
    #[cfg(unix)]
    pub(super) retired_direct_graphics: HashMap<endpoint::ClientEndpointId, RetiredDirectGraphics>,
    #[cfg(unix)]
    pub(super) disabled_native_graphics: HashMap<endpoint::ClientEndpointId, u64>,
    pub(super) pending_native_cleanup: Vec<u8>,
    #[cfg(unix)]
    pub(super) pending_surface_graphics: HashMap<
        (endpoint::ClientEndpointId, u64, u64, u32),
        crate::protocol::SurfaceGraphicsAssetKey,
    >,
    pub(super) attach_escape: Option<AttachEscapeState>,
    #[cfg(unix)]
    pub(super) mouse_scroll_lines: usize,
    pub(super) remote_image_paste_key:
        Option<(crossterm::event::KeyCode, crossterm::event::KeyModifiers)>,
    pub(super) redraw_on_focus_gained: bool,
    pub(super) repaint_pending: bool,
    /// During a source-off-first handoff the currently blitted frame remains authoritative until
    /// an acknowledged target snapshot/surface pair commits.
    pub(super) presentation_frozen: bool,
    /// Latest explicit Local selection awaiting this client's replacement Local connection.
    pub(super) deferred_local_activation: Option<endpoint::EndpointActivationIntent>,
    pub(super) draw_host_cursor: bool,
    pub(super) detached_process_children: Vec<std::process::Child>,
    pub(super) shell: Option<shell::ClientShellState>,
}

impl Drop for ClientState {
    fn drop(&mut self) {
        if self.attach_escape.is_some() {
            let _ = crate::terminal_modes::set_direct_host_keyboard_protocol(
                &mut io::stdout(),
                &mut self.direct_keyboard_protocol,
                0,
                0,
            );
        }
    }
}

impl ClientState {
    #[cfg(test)]
    pub(super) fn test_new() -> Self {
        Self {
            blit_encoder: render_ansi::BlitEncoder::new(),
            image_files: image_files::FileTransport::default(),
            mouse_capture_active: false,
            endpoint_mouse_capture_requested: false,
            endpoint_sgr_pixels_requested: false,
            host_theme_updates: Vec::new(),
            direct_mouse_capture_preference: false,
            shell_mouse_capture_preference: false,
            direct_keyboard_protocol: Default::default(),
            pane_keyboard_report_all: false,
            keyboard_report_all_active: false,
            reported_size: (100, 30),
            reported_cell_size: (0, 0),
            sound_config: Default::default(),
            kitty_graphics_enabled: false,
            pixel_geometry_enabled: false,
            pixel_geometry_exact: false,
            #[cfg(unix)]
            direct_graphics_response: Default::default(),
            #[cfg(unix)]
            retired_direct_graphics: HashMap::new(),
            #[cfg(unix)]
            disabled_native_graphics: Default::default(),
            pending_native_cleanup: Vec::new(),
            #[cfg(unix)]
            pending_surface_graphics: HashMap::new(),
            attach_escape: None,
            #[cfg(unix)]
            mouse_scroll_lines: 3,
            remote_image_paste_key: None,
            redraw_on_focus_gained: false,
            repaint_pending: false,
            presentation_frozen: false,
            deferred_local_activation: None,
            draw_host_cursor: false,
            detached_process_children: Vec::new(),
            shell: Some(shell::ClientShellState::new(
                shell::ClientShellConfig::from_config(&crate::config::Config::default()),
            )),
        }
    }

    pub(super) fn request_repaint(&mut self) {
        self.repaint_pending = true;
    }

    pub(super) fn freeze_presentation(&mut self) {
        self.presentation_frozen = true;
    }

    pub(super) fn record_host_theme_update(
        &mut self,
        update: &crate::protocol::ClientHostThemeUpdate,
    ) {
        use crate::protocol::ClientHostThemeUpdate;

        match update {
            ClientHostThemeUpdate::DefaultColor { kind, .. } => {
                self.host_theme_updates.retain(|current| {
                    !matches!(
                        current,
                        ClientHostThemeUpdate::DefaultColor {
                            kind: current_kind,
                            ..
                        } if current_kind == kind
                    )
                });
            }
            ClientHostThemeUpdate::PaletteColors(_) => self
                .host_theme_updates
                .retain(|current| !matches!(current, ClientHostThemeUpdate::PaletteColors(_))),
            ClientHostThemeUpdate::Appearance(_) => self
                .host_theme_updates
                .retain(|current| !matches!(current, ClientHostThemeUpdate::Appearance(_))),
        }
        self.host_theme_updates.push(update.clone());
    }

    /// Replay the retained physical-host baseline only after an endpoint owns the committed
    /// presentation. The endpoint transport preserves this order ahead of the resync control.
    pub(super) fn replay_host_theme(
        &self,
        endpoints: &mut endpoint::EndpointRegistry,
        endpoint_id: &endpoint::ClientEndpointId,
    ) {
        for update in &self.host_theme_updates {
            let _ = endpoints.send_to(
                endpoint_id,
                &crate::protocol::ClientMessage::ClientShellHostTheme {
                    update: update.clone(),
                },
            );
        }
    }

    pub(super) fn unfreeze_presentation(&mut self) {
        self.presentation_frozen = false;
        // A resize or metadata event may have happened while frozen. Force a full frame rather
        // than attempting to patch the old source frame.
        self.request_repaint();
    }

    /// Present a composed error/chrome frame while retaining the handoff input freeze. The pane
    /// cells are still the last coherent surface; only client chrome (including the error) moves.
    pub(super) fn present_frozen_chrome(
        &mut self,
        frame_data: impl Into<frame_output::ComposedFrame>,
    ) {
        let frozen = self.presentation_frozen;
        // Chrome can repaint the frozen source, but cannot retire its staged images.
        let deferred_cleanup = frozen.then(|| std::mem::take(&mut self.pending_native_cleanup));
        self.presentation_frozen = false;
        self.present_frame(frame_data);
        self.presentation_frozen = frozen;
        if let Some(cleanup) = deferred_cleanup {
            self.pending_native_cleanup = cleanup;
        }
    }

    #[cfg(unix)]
    pub(super) fn queue_native_image_cleanup(&mut self, image_id: u32) {
        crate::kitty_graphics::encode_delete_image(&mut self.pending_native_cleanup, image_id);
    }

    /// Retirement is lifecycle bookkeeping, not a presentation effect. The caller has
    /// already checked the endpoint generation, even for inactive/frozen owners.
    #[cfg(unix)]
    pub(super) fn receive_graphics_retirement(
        &mut self,
        endpoint_id: &endpoint::ClientEndpointId,
        generation: u64,
        transfer_id: u64,
        image_id: u32,
        owner_active: bool,
    ) {
        if transfer_id & crate::kitty_graphics::surface::NATIVE_TRANSFER_BIT != 0 {
            self.disabled_native_graphics
                .insert(endpoint_id.clone(), generation);
        }
        self.record_retired_direct_graphics(endpoint_id.clone(), generation, transfer_id, image_id);
        let upload_pending = self
            .pending_surface_graphics
            .remove(&(endpoint_id.clone(), generation, transfer_id, image_id))
            .is_some();
        // Retirement cleanup is terminal-owned. A native retirement owns the
        // ID only while its exact upload is pending: collision rejection and a
        // late post-ACK retirement must not delete the currently visible bank.
        // API/non-native retirement retains its prior ownership behavior.
        let owns_image = self.queue_retired_graphics_cleanup(
            transfer_id,
            image_id,
            upload_pending,
            owner_active,
        );
        let frame = if owns_image && owner_active {
            let frozen = self.presentatio
```

### Core Architecture Module: `src/integration/assets/kilo/herdr-agent-state.js`
```
// installed by herdr
// managed by herdr; reinstalling or updating the integration overwrites this file.
// add custom hooks/plugins beside this file instead of editing it.
// HERDR_INTEGRATION_ID=kilo
// HERDR_INTEGRATION_VERSION=4

import net from "node:net";

const SOURCE = "herdr:kilo";
const AGENT = "kilo";
let reportSeq = Date.now() * 1000;

function nextReportSeq() {
  reportSeq += 1;
  return reportSeq;
}

function sessionIDFromProperties(properties) {
  return typeof properties?.sessionID === "string" && properties.sessionID
    ? properties.sessionID
    : undefined;
}

function stateFromSessionStatus(status) {
  if (typeof status !== "string") {
    return undefined;
  }
  switch (status.toLowerCase()) {
    case "idle":
      return "idle";
    case "active":
    case "busy":
    case "pending":
    case "running":
    case "streaming":
    case "working":
      return "working";
    default:
      return undefined;
  }
}

function request(method, params) {
  const paneId = process.env.HERDR_PANE_ID;
  const socketPath = process.env.HERDR_SOCKET_PATH;

  if (!paneId || !socketPath) {
    return Promise.resolve();
  }

  const socketEndpoint =
    process.platform === "win32" ? `\\\\.\\pipe\\${socketPath}` : socketPath;

  const requestId = `${SOURCE}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")}`;
  const request = {
    id: requestId,
    method,
    params: {
      pane_id: paneId,
      source: SOURCE,
      agent: AGENT,
      seq: nextReportSeq(),
      ...params,
    },
  };

  return new Promise((resolve) => {
    const client = net.createConnection(socketEndpoint, () => {
      client.write(`${JSON.stringify(request)}\n`);
    });

    const finish = () => {
      client.destroy();
      resolve();
    };

    client.setTimeout(500, finish);
    client.on("data", finish);
    client.on("error", finish);
    client.on("end", finish);
    client.on("close", resolve);
  });
}

function reportSession(sessionID) {
  if (!sessionID) {
    return Promise.resolve();
  }
  return request("pane.report_agent_session", {
    agent_session_id: sessionID,
    session_start_source: "startup",
  });
}

function reportState(state, sessionID) {
  const params = { state };
  if (sessionID) {
    params.agent_session_id = sessionID;
  }
  return request("pane.report_agent", params);
}

export const HerdrAgentStatePlugin = async () => {
  if (
    process.env.HERDR_ENV !== "1" ||
    !process.env.HERDR_SOCKET_PATH ||
    !process.env.HERDR_PANE_ID
  ) {
    return {};
  }

  return {
    "chat.message": async ({ sessionID }) => {
      await reportState("working", sessionID);
    },
    event: async ({ event }) => {
      const type = event?.type;
      const properties = event?.properties ?? {};
      const sessionID = sessionIDFromProperties(properties);

      switch (type) {
        case "session.created":
        case "session.updated":
          await reportSession(sessionID);
          break;
        case "session.status": {
          const state = stateFromSessionStatus(properties.status);
          if (state) {
            await reportState(state, sessionID);
          } else {
            await reportSession(sessionID);
          }
          break;
        }
        case "tool.execute.before":
        case "tool.execute.after":
        case "permission.replied":
        case "question.replied":
        case "question.rejected":
        case "session.compacted":
          await reportState("working", sessionID);
          break;
        case "permission.asked":
        case "question.asked":
        case "session.error":
          await reportState("blocked", sessionID);
          break;
        case "session.idle":
          await reportState("idle", sessionID);
          break;
        case "session.deleted":
          break;
        default:
          break;
      }
    },
  };
};

```

### Core Architecture Module: `src/integration/assets/omp/herdr-agent-state.ts`
```
// installed by herdr
// managed by herdr; reinstalling or updating the integration overwrites this file.
// add custom hooks/plugins beside this file instead of editing it.
// HERDR_INTEGRATION_ID=omp
// HERDR_INTEGRATION_VERSION=10
// @ts-nocheck

import net from "node:net";
import path from "node:path";

const HERDR_ENV = process.env.HERDR_ENV;
const socketPath = process.env.HERDR_SOCKET_PATH;
const socketEndpoint =
  process.platform === "win32" && socketPath ? `\\\\.\\pipe\\${socketPath}` : socketPath;
const paneId = process.env.HERDR_PANE_ID;
const source = "herdr:omp";
// OMP marks every shell it spawns with OMPCODE=1. A nested `omp` launched from
// a parent session's shell inherits it, so that process is not the pane's root
// agent and must not report its short-lived session over the parent's.
const nestedOmpSession = process.env.OMPCODE === "1";

function enabled() {
  return HERDR_ENV === "1" && !!socketPath && !!paneId && !nestedOmpSession;
}

let requestQueue = Promise.resolve();

function sendRequestAttempt(request: unknown, timeoutMs: number): Promise<boolean> {
  if (!enabled()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let done = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (delivered: boolean) => {
      if (done) return;
      done = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      socket.destroy();
      resolve(delivered);
    };

    const socket = net.createConnection(socketEndpoint!);
    socket.on("error", () => finish(false));
    socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on("data", () => finish(true));
    socket.on("end", () => finish(false));
    timeout = setTimeout(() => finish(false), timeoutMs);
    timeout.unref?.();
  });
}

async function sendRequestNow(request: unknown): Promise<void> {
  if (await sendRequestAttempt(request, 500)) {
    return;
  }
  await sendRequestAttempt(request, 1500);
}

function sendRequest(request: unknown): Promise<void> {
  requestQueue = requestQueue.then(
    () => sendRequestNow(request),
    () => sendRequestNow(request),
  );
  return requestQueue;
}

type AgentState = "working" | "blocked" | "idle";

type QueuedState = {
  state: AgentState;
  message?: string;
  seq: number;
};

const idleDebounceMs = parseDurationEnv("HERDR_OMP_IDLE_DEBOUNCE_MS", 250);
const retryGraceMs = parseDurationEnv("HERDR_OMP_RETRY_GRACE_MS", 2500);
const retryableErrorPattern =
  /overloaded|provider.?returned.?error|rate.?limit|too many requests|429|500|502|503|504|service.?unavailable|server.?error|internal.?error|network.?error|connection.?error|connection.?refused|connection.?lost|websocket.?closed|websocket.?error|other side closed|fetch failed|upstream.?connect|reset before headers|socket hang up|ended without|http2 request did not get a response|timed? out|timeout|terminated|retry delay/i;
let reportSeq = Date.now() * 1000;
let currentAgentSessionId: string | undefined;
let currentAgentSessionPath: string | undefined;

function nextReportSeq(): number {
  reportSeq += 1;
  return reportSeq;
}

export function isAbsoluteSessionPath(file: unknown): file is string {
  return (
    typeof file === "string" &&
    (path.posix.isAbsolute(file) || path.win32.isAbsolute(file))
  );
}

function updateSessionRef(ctx: any): void {
  try {
    const file = ctx?.sessionManager?.getSessionFile?.();
    currentAgentSessionPath = isAbsoluteSessionPath(file) ? file : undefined;
  } catch {
    currentAgentSessionPath = undefined;
  }

  try {
    const id = ctx?.sessionManager?.getSessionId?.();
    currentAgentSessionId = typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    currentAgentSessionId = undefined;
  }
}

function withSessionRef(params: Record<string, unknown>): Record<string, unknown> {
  if (currentAgentSessionPath) {
    return { ...params, agent_session_path: currentAgentSessionPath };
  }
  if (currentAgentSessionId) {
    return { ...params, agent_session_id: currentAgentSessionId };
  }
  return params;
}

function parseDurationEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function currentSessionRef(): Record<string, unknown> | undefined {
  if (currentAgentSessionPath) {
    return { agent_session_path: currentAgentSessionPath };
  }
  if (currentAgentSessionId) {
    return { agent_session_id: currentAgentSessionId };
  }
  return undefined;
}

function reportSession(sessionStartSource = "startup"): Promise<void> {
  const sessionRef = currentSessionRef();
  if (!sessionRef) {
    return Promise.resolve();
  }

  return sendRequest({
    id: `${source}:session:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    method: "pane.report_agent_session",
    params: {
      pane_id: paneId,
      source,
      agent: "omp",
      seq: nextReportSeq(),
      session_start_source: sessionStartSource,
      ...sessionRef,
    },
  });
}

function sendState(state: AgentState, message?: string, seq = nextReportSeq()): Promise<void> {
  return sendRequest({
    id: `${source}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    method: "pane.report_agent",
    params: withSessionRef({
      pane_id: paneId,
      source,
      agent: "omp",
      state,
      message,
      seq,
    }),
  });
}

let sendInFlight = false;
let queuedState: QueuedState | undefined;

function queueState(state: AgentState, message?: string): void {
  queuedState = { state, message, seq: nextReportSeq() };
  if (!sendInFlight) {
    void drainStateQueue();
  }
}

async function drainStateQueue(): Promise<void> {
  if (sendInFlight) {
    return;
  }

  sendInFlight = true;
  try {
    while (queuedState) {
      const next = queuedState;
      queuedState = undefined;
      await sendState(next.state, next.message, next.seq);
    }
  } finally {
    sendInFlight = false;
    if (queuedState) {
      void drainStateQueue();
    }
  }
}

function lastAssistantMessage(messages: unknown[]): any | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i] as any;
    if (message?.role === "assistant") {
      return message;
    }
  }
  return undefined;
}

function retryableErrorMessage(event: any): string | undefined {
  const messages = Array.isArray(event?.messages) ? event.messages : [];
  const assistant = lastAssistantMessage(messages);
  if (assistant?.stopReason !== "error") {
    return undefined;
  }

  const errorMessage = String(assistant.errorMessage ?? "");
  if (!retryableErrorPattern.test(errorMessage)) {
    return undefined;
  }
  return errorMessage || "retryable provider error";
}

function askBlockedMessage(args: any): string {
  const questions = Array.isArray(args?.questions) ? args.questions : [];
  const firstQuestion = questions.find((question: any) => typeof question?.question === "string");
  if (firstQuestion?.question) {
    return firstQuestion.question;
  }
  return "waiting for user input";
}

export default function (pi) {
  if (!enabled()) {
    return;
  }

  let agentActive = false;
  let retryHoldActive = false;
  let failureBlocked = false;
  let failureMessage: string | undefined;
  let blockedCount = 0;
  let blockedMessage: string | undefined;
  let lastState: AgentState | undefined;
  let lastMessage: string | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let rootSession = false;

  function clearTimer(timer: ReturnType<typeof setTimeout> | undefined) {
    if (timer) {
      clearTimeout(timer);
    }
  }

  function clearPendingTimers() {
    clearTimer(idleTimer);
    clearTimer(retryTimer);
    idleTimer = undefined;
    retryTimer = undefined;
  }

  function clearFailureState() {
    retryHoldActive = false;
    failureBlocked = false;
    failureMessage = undefined;
  }

  function desiredState() {
    if (blockedCount > 0) {
      return { state: "blocked" as const, message: blockedMessage };
    }
    if (failureBlocked) {
      return { state: "blocked" as const, message: failureMessage };
    }
    if (agentActive || retryHoldActive) {
      return { state: "working" as const, message: undefined };
    }
    return { state: "idle" as const, message: undefined };
  }

  function publishState(force = false) {
    const next = desiredState();
    if (!force && next.state === lastState && next.message === lastMessage) {
      return;
    }
    lastState = next.state;
    lastMessage = next.message;
    queueState(next.state, next.message);
  }

  function scheduleIdle() {
    clearPendingTimers();
    clearFailureState();
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      publishState();
    }, idleDebounceMs);
    idleTimer.unref?.();
  }

  function holdForRetry(message: string) {
    clearPendingTimers();
    retryHoldActive = true;
    failureBlocked = false;
    failureMessage = message;
    publishState();

    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      retryHoldActive = false;
      failureBlocked = true;
      publishState();
    }, retryGraceMs);
    retryTimer.unref?.();
  }

  function activateRootSession(ctx: any, sessionStartSource = "startup"): boolean {
    if (ctx?.hasUI !== true) {
      return false;
    }
    rootSession = true;
    updateSessionRef(ctx);
    void reportSession(sessionStartSource);
    return true;
  }

  function resetSessionState() {
    clearPendingTimers();
    clearFailureState();
    agentActive = false;
    blockedCount = 0;
    blockedMessage = undefined;
  }

  function activateBlocked(message: string | undefined) {
    clearPendingTimers();
    blockedCount += 1;
    blockedMessage = message;
    publishState();
  }

  function deactivateBlocked() 
```

### Core Architecture Module: `src/integration/assets/opencode/herdr-agent-state.js`
```
// installed by herdr
// managed by herdr; reinstalling or updating the integration overwrites this file.
// add custom hooks/plugins beside this file instead of editing it.
// HERDR_INTEGRATION_ID=opencode
// HERDR_INTEGRATION_VERSION=13

import net from "node:net";

const SOURCE = "herdr:opencode";
const AGENT = "opencode";
let reportSeq = Date.now() * 1000;
let requestChain = Promise.resolve();
let reportedRootSessionID;

// Track child sessions so their events cannot replace the pane's root session.
// User prompts carry the root id to preserve its identity and cross-talk guard.
const childSessions = new Map();
const CHILD_EVENT_STATES = new Map([
  ["permission.asked", "blocked"],
  ["question.asked", "blocked"],
  ["permission.replied", "working"],
  ["question.replied", "working"],
  ["question.rejected", "working"],
]);

function nextReportSeq() {
  reportSeq += 1;
  return reportSeq;
}

function sessionIDFromProperties(properties) {
  return typeof properties?.sessionID === "string" && properties.sessionID
    ? properties.sessionID
    : undefined;
}

const SESSION_STATE_BY_STATUS = new Map([
  ["idle", "idle"],
  ["active", "working"],
  ["busy", "working"],
  ["pending", "working"],
  ["retry", "working"],
  ["running", "working"],
  ["streaming", "working"],
  ["working", "working"],
]);

function stateFromSessionStatus(status) {
  const kind = typeof status === "string" ? status : status?.type;
  return typeof kind === "string"
    ? SESSION_STATE_BY_STATUS.get(kind.toLowerCase())
    : undefined;
}

function request(method, params) {
  const pending = requestChain.then(() => requestOnce(method, params));
  requestChain = pending.catch(() => {});
  return pending;
}

function requestOnce(method, params) {
  const paneId = process.env.HERDR_PANE_ID;
  const socketPath = process.env.HERDR_SOCKET_PATH;

  if (!paneId || !socketPath) {
    return Promise.resolve();
  }

  const socketEndpoint =
    process.platform === "win32" ? `\\\\.\\pipe\\${socketPath}` : socketPath;

  const requestId = `${SOURCE}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")}`;
  const request = {
    id: requestId,
    method,
    params: {
      pane_id: paneId,
      source: SOURCE,
      agent: AGENT,
      seq: nextReportSeq(),
      ...params,
    },
  };

  return new Promise((resolve) => {
    const client = net.createConnection(socketEndpoint, () => {
      client.write(`${JSON.stringify(request)}\n`);
    });

    const finish = () => {
      client.destroy();
      resolve();
    };

    client.setTimeout(500, finish);
    client.on("data", finish);
    client.on("error", finish);
    client.on("end", finish);
    client.on("close", resolve);
  });
}

function reportSession(sessionID) {
  if (!sessionID) {
    return Promise.resolve();
  }
  return request("pane.report_agent_session", { agent_session_id: sessionID });
}

function reportState(state, sessionID) {
  const params = { state };
  if (sessionID) {
    reportedRootSessionID = sessionID;
    params.agent_session_id = sessionID;
  }
  return request("pane.report_agent", params);
}

function ownsLocalLifecycle() {
  const args = process.argv.slice(2);
  const separator = args.indexOf("--");
  if (separator !== -1) args.splice(separator);
  if (args.some((arg) => arg === "--attach" || arg.startsWith("--attach="))) return false;
  while (args[0] === "--print-logs" || args[0] === "--log-level" || args[0]?.startsWith("--log-level=")) {
    args.splice(0, args[0] === "--log-level" ? 2 : 1);
  }
  // These local clients have no TUI plugin. Shared servers and the TUI worker
  // cannot identify their attached panes; their lifecycle belongs to each TUI.
  return args[0] === "run" ||
    (!["serve", "web", "attach"].includes(args[0]) && args.includes("--mini"));
}

export const HerdrAgentStatePlugin = async () => {
  if (
    !ownsLocalLifecycle() ||
    process.env.HERDR_ENV !== "1" ||
    !process.env.HERDR_SOCKET_PATH ||
    !process.env.HERDR_PANE_ID
  ) {
    return {};
  }

  return {
    "chat.message": async ({ sessionID }) => {
      if (sessionID && childSessions.has(sessionID)) {
        return;
      }
      await reportState("working", sessionID);
    },
    event: async ({ event }) => {
      const type = event?.type;
      const properties = event?.properties ?? {};
      const sessionID = sessionIDFromProperties(properties);

      const info = properties.info;
      if (info?.id && info.parentID) {
        childSessions.set(info.id, info.parentID);
      }
      if (sessionID && childSessions.has(sessionID)) {
        const state = CHILD_EVENT_STATES.get(type);
        if (state) {
          let rootSessionID = sessionID;
          while (childSessions.has(rootSessionID)) {
            rootSessionID = childSessions.get(rootSessionID);
          }
          await reportState(state, rootSessionID);
        }
        return;
      }

      switch (type) {
        case "session.created":
          // Creation is server-global, so an attached client may own it. The
          // TUI plugin separately reports the root selected in this pane.
          reportedRootSessionID = sessionID;
          break;
        case "session.updated":
          if (sessionID && sessionID !== reportedRootSessionID) {
            await reportSession(sessionID);
          }
          break;
        case "session.status": {
          const state = stateFromSessionStatus(properties.status);
          if (state) {
            await reportState(state, sessionID);
          } else {
            await reportSession(sessionID);
          }
          break;
        }
        case "tool.execute.before":
        case "tool.execute.after":
        case "permission.replied":
        case "question.replied":
        case "question.rejected":
        case "session.compacted":
          await reportState("working", sessionID);
          break;
        case "permission.asked":
        case "question.asked":
        case "session.error":
          await reportState("blocked", sessionID);
          break;
        case "session.idle":
          await reportState("idle", sessionID);
          break;
        case "session.deleted":
          break;
        default:
          break;
      }
    },
  };
};

// V1 local run/Mini retain their server hooks. V1/V2 full TUIs own both
// selection and lifecycle, including when attached to a shared remote server.
export default {
  id: "herdr.opencode",
  server: HerdrAgentStatePlugin,
  setup() {},
};

```

### Core Architecture Module: `src/integration/assets/pi/herdr-agent-state.ts`
```
// installed by herdr
// managed by herdr; reinstalling or updating the integration overwrites this file.
// add custom hooks/plugins beside this file instead of editing it.
// HERDR_INTEGRATION_ID=pi
// HERDR_INTEGRATION_VERSION=9
// @ts-nocheck

import net from "node:net";
import path from "node:path";

const HERDR_ENV = process.env.HERDR_ENV;
const socketPath = process.env.HERDR_SOCKET_PATH;
const socketEndpoint =
  process.platform === "win32" && socketPath ? `\\\\.\\pipe\\${socketPath}` : socketPath;
const paneId = process.env.HERDR_PANE_ID;
const source = "herdr:pi";

function enabled() {
  return HERDR_ENV === "1" && !!socketPath && !!paneId;
}

function sendRequestAttempt(request: unknown, timeoutMs: number): Promise<boolean> {
  if (!enabled()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let done = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (delivered: boolean) => {
      if (done) return;
      done = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      socket.destroy();
      resolve(delivered);
    };

    const socket = net.createConnection(socketEndpoint!);
    socket.on("error", () => finish(false));
    socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on("data", () => finish(true));
    socket.on("end", () => finish(false));
    timeout = setTimeout(() => finish(false), timeoutMs);
    timeout.unref?.();
  });
}

async function sendRequest(request: unknown): Promise<void> {
  if (await sendRequestAttempt(request, 500)) {
    return;
  }
  await sendRequestAttempt(request, 1500);
}

type AgentState = "working" | "blocked" | "idle";

type QueuedState = {
  state: AgentState;
  message?: string;
  seq: number;
};

let reportSeq = Date.now() * 1000;
let currentAgentSessionId: string | undefined;
let currentAgentSessionPath: string | undefined;

function nextReportSeq(): number {
  reportSeq += 1;
  return reportSeq;
}

function updateSessionRef(ctx: any): void {
  try {
    const file = ctx?.sessionManager?.getSessionFile?.();
    currentAgentSessionPath =
      typeof file === "string" &&
      (path.posix.isAbsolute(file) || path.win32.isAbsolute(file))
        ? file
        : undefined;
  } catch {
    currentAgentSessionPath = undefined;
  }

  try {
    const id = ctx?.sessionManager?.getSessionId?.();
    currentAgentSessionId = typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    currentAgentSessionId = undefined;
  }
}

function withSessionRef(params: Record<string, unknown>): Record<string, unknown> {
  if (currentAgentSessionPath) {
    return { ...params, agent_session_path: currentAgentSessionPath };
  }
  if (currentAgentSessionId) {
    return { ...params, agent_session_id: currentAgentSessionId };
  }
  return params;
}

function currentSessionRef(): Record<string, unknown> | undefined {
  if (currentAgentSessionPath) {
    return { agent_session_path: currentAgentSessionPath };
  }
  if (currentAgentSessionId) {
    return { agent_session_id: currentAgentSessionId };
  }
  return undefined;
}

function reportSession(sessionStartSource?: string): Promise<void> {
  const sessionRef = currentSessionRef();
  if (!sessionRef) {
    return Promise.resolve();
  }

  return sendRequest({
    id: `${source}:session:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    method: "pane.report_agent_session",
    params: {
      pane_id: paneId,
      source,
      agent: "pi",
      seq: nextReportSeq(),
      session_start_source: sessionStartSource,
      ...sessionRef,
    },
  });
}

function sendState(state: AgentState, message?: string, seq = nextReportSeq()): Promise<void> {
  return sendRequest({
    id: `${source}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    method: "pane.report_agent",
    params: withSessionRef({
      pane_id: paneId,
      source,
      agent: "pi",
      state,
      message,
      seq,
    }),
  });
}

let sendInFlight = false;
let queuedState: QueuedState | undefined;

function queueState(state: AgentState, message?: string): void {
  queuedState = { state, message, seq: nextReportSeq() };
  if (!sendInFlight) {
    void drainStateQueue();
  }
}

async function drainStateQueue(): Promise<void> {
  if (sendInFlight) {
    return;
  }

  sendInFlight = true;
  try {
    while (queuedState) {
      const next = queuedState;
      queuedState = undefined;
      await sendState(next.state, next.message, next.seq);
    }
  } finally {
    sendInFlight = false;
    if (queuedState) {
      void drainStateQueue();
    }
  }
}

export default function (pi) {
  if (!enabled()) {
    return;
  }

  let agentActive = false;
  let blockedCount = 0;
  let blockedMessage: string | undefined;
  let lastState: AgentState | undefined;
  let lastMessage: string | undefined;
  let rootSession = false;

  function desiredState() {
    if (blockedCount > 0) {
      return { state: "blocked" as const, message: blockedMessage };
    }
    if (agentActive) {
      return { state: "working" as const, message: undefined };
    }
    return { state: "idle" as const, message: undefined };
  }

  function publishState(force = false) {
    const next = desiredState();
    if (!force && next.state === lastState && next.message === lastMessage) {
      return;
    }
    lastState = next.state;
    lastMessage = next.message;
    queueState(next.state, next.message);
  }

  pi.events.on("herdr:blocked", (data) => {
    if (!rootSession) {
      return;
    }
    if (!data?.active) {
      blockedCount = Math.max(0, blockedCount - 1);
      if (blockedCount === 0) {
        blockedMessage = undefined;
      }
      publishState();
      return;
    }

    blockedCount += 1;
    blockedMessage = data.label;
    publishState();
  });

  pi.on("session_start", async (event, ctx) => {
    // TUI only: RPC/JSON/print modes are headless (no PTY herdr can display),
    // and RPC still reports hasUI=true, so mode is the reliable gate.
    if (ctx?.mode !== "tui") {
      return;
    }
    rootSession = true;
    updateSessionRef(ctx);
    await reportSession(event?.reason);
    // A reload can replace this extension mid-run without emitting another agent_start.
    agentActive = ctx?.isIdle?.() === false;
    publishState(true);
  });

  pi.on("agent_start", (_event, ctx) => {
    if (!rootSession) {
      return;
    }
    updateSessionRef(ctx);
    void reportSession();
    agentActive = true;
    publishState();
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (!rootSession || ctx?.isIdle?.() !== true) {
      return;
    }

    agentActive = false;
    publishState();
  });
}

```

### Core Architecture Module: `src/pane/state.rs`
```
use crate::terminal::TerminalId;

/// Viewport state for a pane.
///
/// Terminal identity, cwd, labels, and agent metadata live in TerminalState.
pub struct PaneState {
    pub attached_terminal_id: TerminalId,
    /// Whether the user has seen this pane since its last state change to Idle.
    /// False = "Done" (agent finished while user was in another workspace).
    pub seen: bool,
    /// Whether unmodified right-click gestures should be forwarded to the pane application.
    pub right_click_passthrough: bool,
}

impl PaneState {
    pub fn new(attached_terminal_id: TerminalId) -> Self {
        Self {
            attached_terminal_id,
            seen: true,
            right_click_passthrough: false,
        }
    }
}

```

### Core Architecture Module: `src/platform/client_state.rs`
```
use std::path::Path;

#[cfg(not(windows))]
pub(crate) fn create_private_state_file(path: &Path) -> std::io::Result<std::fs::File> {
    super::create_remote_ssh_config_file(path)
}

#[cfg(windows)]
pub(crate) fn create_private_state_file(path: &Path) -> std::io::Result<std::fs::File> {
    super::windows::create_remote_ssh_config_file(path)
}

#[cfg(not(windows))]
pub(crate) fn replace_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    std::fs::rename(source, destination)
}

#[cfg(windows)]
pub(crate) fn replace_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    super::windows::replace_file(source, destination)
}

#[cfg(not(windows))]
pub(crate) fn sync_parent_directory(path: &Path) -> std::io::Result<()> {
    std::fs::File::open(path)?.sync_all()
}

#[cfg(windows)]
pub(crate) fn sync_parent_directory(_path: &Path) -> std::io::Result<()> {
    // replace_file uses MOVEFILE_WRITE_THROUGH on Windows.
    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4928** (2026-10-04): **Integration tests fail from a shell inside a herdr pane and pass with HERDR_STARTUP_CWD and HERDR_SESSION unset**
  *Symptoms*: ### Is this a reproducible bug?  - [x] I confirm this is a reproducible bug, not a feature request, idea, question, contribution proposal, or direction check. - [x] I reproduced this bug on the version and environment reported below using the exact steps provided.  ### Current behavior  When I run the Rust integration tests from a shell inside a herdr pane, six tests fail on `master` (5da0a01e):  ``` tests/client_mode.rs   unavailable_restored_pane_keeps_saved_cwd_in_server     server should restore workspace with missing pane cwd tests/api_ping.rs      events_subscribe_streams_output_and_agent_status_events     timed out waiting for json line tests/multi_client.rs  same_tab_geometry_follows_meaningful_client_activity     pane did not report tty size tests/multi_client.rs  api_pane_output_is_fanned_out_as_pane_surface_updates     assertion failed: wait_for_message_variants(...) tests/live_handoff.rs  live_server_holds_one_pty_master_fd_per_pane     server pid N had 2 ptmx master fds; expected 1 tests/live_handoff.rs  live_handoff_carries_more_panes_than_one_scm_rights_message     server pid N had 71 ptmx master fds; expected 70 ```  The same checkout passes all six when two variables from the pane, `HERDR_STARTUP_CWD` and `HERDR_SESSION`, are unset. With only `HERDR_STARTUP_CWD` set, the last five fail; with only `HERDR_SESSION` set, the first one fails.  I first reported this as #3440. It still reproduces on 0.9.3.  ### Expected behavior  The six tests pass from a shell insi
  **Post-Mortem & Fix Analysis**:
  > <!-- herdr:pending-release --> Implemented on master and queued for the next release. This is not available in a published Herdr release yet.

- **Issue #4773** (2026-09-30): **Windows 11: delivery = "system" never shows a notification (failed to add Herdr notification-area icon)**
  *Symptoms*: **Is this a reproducible bug?** - [x] I confirm this is a reproducible bug, not a feature request, idea, question, contribution proposal, or direction check. - [x] I reproduced this bug on the version and environment reported below using the exact steps provided.  **Current behavior** With `[ui.toast] delivery = "system"` on Windows, no Windows notification is ever shown for agent done/attention events. The client log records:  `2026-09-25T21:34:39.301405Z  WARN herdr::client::notifications: failed to emit system notification err=failed to add Herdr notification-area icon` `2026-09-25T21:39:56.132645Z  WARN herdr::client::notifications: failed to emit system notification err=failed to add Herdr notification-area icon`  Switching back to `delivery = "herdr"` works: the in-app toast appears and clicking it focuses the originating pane.  Note: `herdr notification show "<title>"` returns `shown: true` and shows the in-app toast regardless of delivery, so it does not exercise this path.  **Expected behavior** With `delivery = "system"`, a Windows desktop notification should appear (and land in the Windows notification center), as the in-app toast does with `delivery = "herdr"`.  **Reproduction** 1. Set `[ui.toast] delivery = "system"` in `config.toml`, then run `herdr server reload-config`. 2. Let a background agent finish in a pane (a done event). 3. Observe: no Windows notification appears; a new log line as above appears in `%APPDATA%\herdr\herdr-client.log`. 4. Control: back t
  **Post-Mortem & Fix Analysis**:
  > Yep on it
  > I tried the official 0.9.2 Windows binary in an isolated Herdr session on Windows 11 25H2, build 26200.9550, with `delivery = "system"` and a background pane transitioning from working to blocked. The Windows notification registration succeeded: its notification window stayed alive and the client did not log the icon-add warning.  I also ran the unchanged Windows notification function in a small native Rust probe. Both icon registration and notification submission succeeded, including repeated overlapping calls. I haven't verified the visible banner, so this only establishes that I haven't reproduced the registration failure you reported.  How do you launch Herdr: which terminal and shell, and what exact command or shortcut do you use? Is that terminal running as administrator, and is this a local desktop session or a remote session such as RDP/SSH? Those details will help me match the context of the failing client. 
  > Thanks - here are the details from the failing machine.  Environment: - Windows 11 25H2 (build 26200.9550), local desktop session (no RDP/SSH). - Terminal: Windows Terminal; panes run PowerShell (pwsh 7 / Windows PowerShell). - Herdr 0.9.2 CLI (x86_64-pc-windows-msvc). Note: the running server here is still 0.9.1 (started before the update; session not restarted yet), and the client handshake reports `server_version=0.9.1`. - Everything runs elevated: Windows Terminal, the herdr client and the herdr server processes all have High integrity level (12288). This is a "Run as administrator" setup.  Data points: 1. The original failure, from the previous 0.9.1 session (client log): `WARN herdr::client::notifications: failed to emit system notification err=failed to add Herdr notification-area icon`. 2. I replicated the registration sequence in a small native probe on the same machine (hidden `STATIC` window, no message pump, `LoadIconW(NULL, IDI_APPLICATION)`, `NIM_ADD`, then a `NIF_INFO` b

- **Issue #4751** (2026-09-29): **0.9.2: ESC-prefixed Alacritty key bindings lose their ESC inside panes (Shift+Enter submits in Claude Code)**
  *Symptoms*: ### Is this a reproducible bug?  - [x] I confirm this is a reproducible bug, not a feature request, idea, question, contribution proposal, or direction check. - [x] I reproduced this bug on the version and environment reported below using the exact steps provided.  ### Current behavior  Since updating from 0.9.1 to 0.9.2, Alacritty key bindings that send an ESC-prefixed string lose the leading ESC inside herdr panes. Only the following byte arrives.  My Alacritty config maps Shift+Enter to `\u001B\r`, so in Claude Code, Shift+Enter now submits the prompt instead of inserting a newline. My Alt+Left binding (`\u001bb`) types a literal `b` instead of jumping back a word.  In Alacritty without herdr, the same keys arrive intact.  ### Expected behavior  The pane receives the bytes the host terminal sends (`ESC CR`, `ESC b`), as it did on 0.9.1 and as it does outside herdr.  ### Reproduction  1. Add to `~/.config/alacritty/alacritty.toml`:    ```toml    [[keyboard.bindings]]    key = "Return"    mods = "Shift"    chars = "\u001B\r"     [[keyboard.bindings]]    key = "Left"    mods = "Alt"    chars = "\u001bb"    ``` 2. In Alacritty without herdr, run `cat -v` and press Alt+Left. Output: `^[b`. 3. Start `herdr`, run `cat -v` in a pane, and press Alt+Left. Output: `b`. The `^[` is missing. 4. Run Claude Code in a herdr pane, type some text, and press Shift+Enter. The prompt is submitted instead of getting a newline.  ### Impact  I can't write multi-line prompts in Claude Code with Sh
  **Post-Mortem & Fix Analysis**:
  > Same on macOS with Ghostty's default config, with no custom key bindings.  Ghostty on macOS ships `alt+arrow_left=esc:b` and `alt+arrow_right=esc:f` as defaults (`ghostty +list-keybinds`). In herdr 0.9.2 panes, Alt+Left and Alt+Right type a literal `b` and `f` instead of jumping a word, and `cat -v` in a pane prints `b` for Alt+Left, with no `^[`. On 0.9.1 they worked.  So this isn't limited to Linux or hand-written bindings. Anyone on macOS with Ghostty's defaults loses Alt+Arrow word movement.  - Herdr 0.9.2 (stable, upgraded from 0.9.1) - macOS 27.0, Apple Silicon - Ghostty 1.3.1 - zsh 
  > reprod, working on a hotfix
  > Another data point: **iTerm2 on macOS, with no custom key bindings at all.**  iTerm2's stock "Natural Text Editing" preset maps exactly the affected keys to ESC-prefixed sequences, so this reproduces from a shipped preset rather than a hand-written config:  | Key | Preset sends | |---|---| | `⌥←` / `⌥→` | `ESC b` / `ESC f` (Send Escape Sequence `b` / `f`) | | `⌥⌫` | `0x1b 0x7f` (Send Hex Code) |  `cat -v` in a herdr 0.9.2 pane, pressing `⌥←` `⌥→` `⌥⌫` `Ctrl+W`:  ``` bf^?^W ```  Every leading `^[` is stripped and only the trailing byte arrives. `Ctrl+W` (no ESC) is unaffected. Practical effect: `⌥←`/`⌥→` type a literal `b`/`f`, and `⌥⌫` degrades to a single-character backspace.  Control test, same pane and session — CSI-form sequences survive intact. The same preset maps `Shift+Left`/`Shift+Right` to `^[[1;2D`/`^[[1;2C`:  ``` ^[[1;2D^[[1;2C ```  And `herdr pane send-keys <pane> alt+left alt+right alt+backspace ctrl+w alt+b alt+f` writes the correct bytes to the pty, including the ESC-pr

- **Issue #4749** (2026-09-29): **machine add rejects Windows ARM64 even though the x64 build runs fine under Prism**
  *Symptoms*: ## What happens  `herdr machine add --label <m> user@windows-arm64-host` fails with:  ``` error: unsupported remote platform: Windows ARM64; machine was not saved ```  The install itself succeeds on the same machine (`irm https://herdr.dev/install.ps1 | iex`, herdr 0.9.1-preview.2026-09-28-80c0c07250d2, x86_64 build) and the resulting `herdr server` runs and answers tabs fine — Windows ARM64 runs the x64 build under Prism emulation, which your own installer supports ("The Windows ARM64 installer now waits for x64 emulation...").  ## Where the gate is  `src/remote/attach.rs` — `windows_platform_probe_command()` prints `herdr-windows:$arch` from `PROCESSOR_ARCHITEW6432 ?? PROCESSOR_ARCHITECTURE`, and `parse_windows_platform_probe()` accepts only `AMD64`. A native ARM64 PowerShell prints `ARM64`, so every ARM64 machine is refused at attach even though the x64 binary it would install and run works.  ## Why the gate is over-conservative on ARM64  On Windows 11 ARM64, `PROCESSOR_ARCHITECTURE` is a per-process loader fact, not a machine fact: native ARM64 processes report ARM64, while the x64 processes running under Prism report AMD64. The probe therefore measures *which shell answered*, not whether the machine can run the x64 server. (We verified: the identical probe prints AMD64 when invoked from any x64 process on the same machine.)  ## Suggestion  Treat `ARM64` as `x86_64` in `parse_windows_platform_probe` (Windows 11 ARM64 + x64 emulation is a supported configuration for the x6
  **Post-Mortem & Fix Analysis**:
  > Good catch, gonna get that sorted
  > <!-- herdr:pending-release --> Implemented on master and queued for the next release. This is not available in a published Herdr release yet.
  > @EdMenace We have an [experimental native Windows ARM64 build in PR #4761](https://github.com/herdrdev/herdr/pull/4761). The hosted ARM64 runner built it and successfully smoke-tested a server and pane. Could you try the [CI artifact](https://github.com/herdrdev/herdr/actions/runs/36607817754/artifacts/11053276009) on your Surface Pro 11?  The ZIP contains `target/aarch64-pc-windows-msvc/release/herdr.exe` and `BUILD_INFO.txt`. It is a bare evaluation build, with no installer or automatic updates. In PowerShell, setting `$env:HERDR_SESSION = 'arm64-eval'` before launching it gives this test a separate session from your normal Herdr session.  If you have time, please report whether `--version`, TUI startup, pane creation/input, and your usual agent workflow work, along with your Windows build, CPU, and any errors or notable difference from the x64 build. This native-build experiment is separate from the remote-attach fix for this issue; that fix is on `master` and awaits a release. 

- **Issue #4745** (2026-09-29): **Welcome screen shows ctrl+b as the prefix key when keys.prefix is set to something else**
  *Symptoms*: ### Is this a reproducible bug?  - [x] I confirm this is a reproducible bug, not a feature request, idea, question, contribution proposal, or direction check. - [x] I reproduced this bug on the version and environment reported below using the exact steps provided.  ### Current behavior  With keys.prefix = "ctrl+a", the first-run welcome screen says "ctrl+b enters prefix mode". ctrl+b does nothing; ctrl+a is the working prefix.  ### Expected behavior  The welcome screen shows the configured prefix.  ### Reproduction  1. printf '[keys]\nprefix = "ctrl+a"\n' > /tmp/herdr-prefix.toml 2. With no Herdr server running: HERDR_CONFIG_PATH=/tmp/herdr-prefix.toml herdr 3. The welcome screen says "ctrl+b enters prefix mode".  ### Impact  New users with an existing config are told the wrong key on the first screen they see.  ### Environment  Ubuntu 26.04.1 LTS, KDE Plasma 6.6 (Wayland), Konsole, config [keys] prefix = "ctrl+a".
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #3202, which covers the same welcome-screen mismatch with a custom prefix. That report was closed as not planned because onboarding was intended to precede configuration; the proposed fix was not merged.  If a concrete missing detail changes that classification, please reply and tag @ogulcancelik.
  > <!-- herdr:pending-release --> Implemented on master and queued for the next release. This is not available in a published Herdr release yet.

- **Issue #4725** (2026-09-29): **Windows: pasting into a Linux machine pane inserts Win32 input records (WezTerm)**
  *Symptoms*: ### Is this a reproducible bug?  - [x] I confirm this is a reproducible bug, not a feature request, idea, question, contribution proposal, or direction check. - [x] I reproduced this bug on the version and environment reported below using the exact steps provided.  ### Current behavior  From a Windows Herdr client in WezTerm, pasting text with Ctrl+Shift+V into a pane that runs on a saved SSH machine (Linux) inserts Win32 input records instead of the text. Each character arrives as a key-down/key-up pair, for example:  ```text 1_73;23;105;1;0;1_73;23;105;0;0;1_79;24;111;1;0;1_78;49;110;1;0;1_78;49;110;0;0;1_... ```  This happens in a plain zsh shell pane and inside Claude Code on the remote machine. Pasting the same text into a local Windows pane in the same Herdr client works normally. Setting `config.allow_win32_input_mode = false` in WezTerm and restarting it does not change the result.  This looks like #3264 (closed, fixed in #3282), but it reproduces on the current preview with WezTerm instead of Windows Terminal.  ### Expected behavior  The pasted text should reach the remote pane as one bracketed paste, the same as it does in local Windows panes.  ### Reproduction  1. On Windows, run Herdr in WezTerm. 2. Add a Linux machine with `herdr machine add <user>@<host> --label vps`. 3. Open a shell pane on that machine. 4. Copy any text, then press Ctrl+Shift+V in that pane. 5. The shell shows numeric `...;1_` sequences instead of the copied text.  ### Impact  I can't paste pr
  **Post-Mortem & Fix Analysis**:
  > Could you capture one failed paste in WezTerm? The client trace will show whether the encoded key records are already inside the paste, allowing us to replay the exact input rather than guess from the displayed fragments.  In a **new WezTerm PowerShell tab outside Herdr**, run this with your installed preview:  ```powershell $since = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss') $env:HERDR_WINDOWS_INPUT_TRACE = '1' $env:HERDR_LOG = 'herdr=info' Set-Clipboard -Value "alpha`nbeta" $s = Read-Host 'Herdr session name (press Enter for default)' if ($s) { herdr --session $s } else { herdr } ```  Focus a plain zsh pane on your **saved Linux machine**, then press **Ctrl+Shift+V once**. Do not press Enter or submit the pasted text. Detach with your usual binding (default: **Ctrl+B, then Q**). Back in the same outer PowerShell tab, run:  ```powershell $base = Join-Path $env:APPDATA 'herdr' if ($env:XDG_CONFIG_HOME) { $base = Join-Path $env:XDG_CONFIG_HOME 'herdr' } $out = Join-Path $env:TEM
  > Captured with `HERDR_WINDOWS_INPUT_TRACE=1` on the installed preview (0.9.1-preview.2026-09-21-0ff0f27e2226), clipboard set to `alpha\nbeta`, one Ctrl+Shift+V in a plain zsh pane on the saved Linux machine.  The whole trace is ~1 MB, mostly mouse-motion batches, so here is the paste window only. There was nothing else in it besides mouse moves and focus in/out.  Decoded key-down `unicode` values of the raw batches, in order:  ```text 19:39:10.374  ESC[17;29;0;1;8;1_          (Ctrl down) 19:39:10.420  ESC[16;42;0;1;24;1_         (Shift down) 19:39:10.510  ESC[200~ ESC[65;30;97;1;0;1_ ESC[65;30;97;0;0;1_ ... ESC[65;30;97;0;0;1_ ESC[201~ 19:39:10.609  ESC[86;47;22;0;24;1_        (V up) 19:39:10.630  ESC[17;29;0;0;16;1_         (Ctrl up) 19:39:10.653  ESC[16;42;0;0;0;1_          (Shift up) ```  The complete trace line for the paste batch:  ```text 2026-09-28T19:39:10.511378Z  INFO herdr::client::input::windows_vti: windows input trace: input batch raw_keys=[WindowsKeyRecord { key_down: tru
  > Thanks—the `Paste` event confirms that the encoded records survive client decoding. The quoted `raw_keys` batch contains only the final `0;1_` and closing paste marker; the earlier batches are needed to replay how Herdr entered that paste.  Could you attach the **one-second window from the existing capture**, without decoding or shortening its lines? No new capture is needed. In PowerShell:  ```powershell $inputFile = Join-Path $env:TEMP 'herdr-4725-input.txt' $outputFile = Join-Path $env:TEMP 'herdr-4725-paste-window.txt' Select-String -LiteralPath $inputFile -Pattern '2026-09-28T19:39:10\.' |   ForEach-Object { $_.Line } | Set-Content $outputFile Write-Output $outputFile ```  Attach the file at the printed path. Please retain all raw-record fields and batch boundaries, including mouse/focus batches in that second. Review for private text or paths first. If the original file is no longer available, just say so. 

- **Issue #4692** (2026-10-05): **Sidebar collapse « is unresponsive when agent panel scrollbar is active (overlapping hit targets)**
  *Symptoms*: ### Is this a reproducible bug?  - [x] I confirm this is a reproducible bug, not a feature request, idea, question, contribution proposal, or direction check. - [x] I reproduced this bug on the version and environment reported below using the exact steps provided.  ### Current behavior  When the sidebar is expanded and multiple active agents cause the agent panel to display a vertical scrollbar, clicking the `«` collapse control at the bottom-right of the sidebar does nothing. The click appears to be consumed without collapsing the sidebar.  If the terminal window is resized taller so that all agents fit without needing a scrollbar, clicking `«` collapses the sidebar as expected.  ### Expected behavior  Clicking `«` should collapse the sidebar regardless of whether the agent list has an active scrollbar.  ### Reproduction  1. Launch Herdr with multiple workspaces and agents (or reduce the terminal window height) until the agent panel overflows and renders a vertical scrollbar. 2. Click the `«` collapse control at the bottom of the expanded sidebar. 3. Observe that the sidebar remains expanded.  ### Impact  I use mouse navigation to collapse and expand the sidebar. When enough agents are active to show a scrollbar, `«` stops responding, requiring keyboard shortcuts to toggle the sidebar.  ### Environment  - Herdr version: 0.9.1 - Update channel (stable or preview): stable - Operating system: macOS 15 (arm64) - Terminal: Ghostty / macOS Terminal - Shell, if relevant: zsh - Rele
  **Post-Mortem & Fix Analysis**:
  > <!-- herdr:pending-release --> Implemented on master and queued for the next release. This is not available in a published Herdr release yet.

- **Issue #4630** (2026-09-25): **SGR mouse tails become shell input after focus switch (Windows Terminal to SSH to Linux, v0.9.1)**
  *Symptoms*: ## Summary  SGR mouse-report tails appeared as ordinary characters at an empty shell prompt after focus/pointer movement into Herdr. This is a fresh raw-input capture on the Windows Terminal → OpenSSH → Linux Herdr path, as requested in #3911. It reproduces on Herdr 0.9.1, after the earlier fix. I did not type or paste into the diagnostic pane.  ## Environment and trigger  - Windows Terminal 1.24.11911.0; Windows OpenSSH 9.5p1; Windows 10 22H2 (build 19045.6466). - Linux Herdr 0.9.1; `TERM=xterm-256color`; util-linux `script` 2.39.3. - Fresh named diagnostic session at an empty shell prompt, captured with `script --log-in`, `--log-out`, and `--log-timing`, plus Herdr raw-input trace. - This time I launched Brave and moved the pointer over to the Windows Terminal/Herdr window. Similar leaks have occurred when switching from Vivaldi too; browser identity does not appear essential. - Visible symptom: usual stray digits, `:`, `<`, etc. at the prompt. I did not press Enter; detached with Ctrl+B, Q.  ## Correlation in captured logs  Capture ran 2026-09-25 19:26:37–19:27:13 UTC (2026-09-26 00:56:37–00:57:13 IST). Two clear leak bursts:  - 19:26:57.733052 UTC: `holding incomplete host CSI reply one flush`; at 19:26:57.755813–.756198 Herdr emitted ten `Key` events spelling `<35;64;37M`, between correctly parsed mouse reports. - 19:27:03.359693–.359884 UTC: Herdr emitted ten `Key` events spelling `<35;50;36M` after focus regained.  The `script` raw input contains complete `ESC[<35;64;3
  **Post-Mortem & Fix Analysis**:
  > <!-- herdr:pending-release --> Implemented on master and queued for the next release. This is not available in a published Herdr release yet.
  > <!-- herdr:preview-released:preview-2026-09-28-80c0c07250d2 --> Released on the preview channel in [2026-09-28-80c0c07250d2](https://github.com/herdrdev/herdr/releases/tag/preview-2026-09-28-80c0c07250d2). This is available to preview users, but is not in a stable Herdr release yet.
  > <!-- herdr:released:v0.9.2 --> Released in [v0.9.2](https://github.com/herdrdev/herdr/releases/tag/v0.9.2).

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

### Incident Patch 1: `c4653a4f` (2026-10-05)
**Commit Message**: fix: keep the server running on hangup and log why it stops (#4965)

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ serde_ignored = "0.1.14"
 serde_json = "1"
 sha2 = "0.10"
 time = { version = "0.3.47", features = ["formatting"] }
-tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time", "process", "io-util"] }
+tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time", "process", "io-util", "signal"] }
 toml = "0.8"
 tracing = "0.1.44"
 tracing-subscriber = { version = "0.3.23", features = ["env-filter"] }
```

**File**: `src/api/server.rs` (modified, +28/-10)
```diff
@@ -21,6 +21,7 @@ use crate::ipc::{
     poll_local_stream_read, remove_socket_file_if_owned, set_local_stream_polling,
     socket_file_identity, LocalStream, LocalStreamRead, SocketFileIdentity,
 };
+use crate::server::shutdown::{ServerStop, ShutdownReason};
 
 #[cfg(test)]
 mod subscription_socket_tests;
@@ -61,7 +62,7 @@ impl ServerHandle {
 pub(crate) fn start_server_with_stop_control(
     api_tx: ApiRequestSender,
     event_hub: EventHub,
-    server_stop: Arc<AtomicBool>,
+    server_stop: ServerStop,
 ) -> std::io::Result<ServerHandle> {
     start_server_inner(api_tx, event_hub, default_capabilities(), Some(server_stop))
 }
@@ -81,7 +82,7 @@ fn start_server_inner(
     api_tx: ApiRequestSender,
     event_hub: EventHub,
     mut capabilities: Option<ServerCapabilities>,
-    server_stop: Option<Arc<AtomicBool>>,
+    server_stop: Option<ServerStop>,
 ) -> std::io::Result<ServerHandle> {
     let path = socket_path();
     prepare_socket_path(&path)?;
@@ -299,7 +300,7 @@ fn handle_connection_with_stop(
     event_hub: &EventHub,
     running: &Arc<AtomicBool>,
     capabilities: Option<ServerCapabilities>,
-    server_stop: Option<&Arc<AtomicBool>>,
+    server_stop: Option<&ServerStop>,
     #[cfg(unix)] ssh_agents: Option<&crate::platform::ssh_agent::SshAgentRegistry>,
 ) -> std::io::Result<()> {
     if let Err(err) = stream.set_send_timeout(Some(STREAM_WRITE_TIMEOUT)) {
@@ -455,6 +456,9 @@ fn handle_connection_with_stop(
         }
         method_body => {
             let (response_write_tx, response_write_rx) = std::sync::mpsc::channel();
+            let stop_caller = matches!(method_body, Method::ServerStop(_))
+                .then(|| crate::platform::local_stream_peer_description(&stream))
+                .flatten();
             let response = handle_request(
                 Request {
                     id: request_id.clone(),
@@ -463,6 +467,7 @@ fn handle_connection_with_stop(
                 api_tx,
                 capabilities,
                 server_stop,
+                stop_caller,
                 Some(response_write_rx),
             );
             let result = write_text_line_allow_disconnect(&mut stream, &response);
@@ -516,7 +521,8 @@ fn handle_request(
     request: Request,
     api_tx: &ApiRequestSender,
     capabilities: Option<ServerCapabilities>,
-    server_stop: Option<&Arc<AtomicBool>>,
+    server_stop: Option<&ServerStop>,
+    stop_caller: Option<String>,
     response_write_complete: Option<std::sync::mpsc::Receiver<()>>,
 ) -> String {
     if matches!(&request.method, Method::Ping(_)) {
@@ -544,14 +550,16 @@ fn handle_request(
 
     if matches!(&request.method, Method::ServerStop(_)) {
         if let Some(server_stop) = server_stop {
-            server_stop.store(true, Ordering::Release);
+            server_stop.request(ShutdownReason::ApiStop {
+                caller: stop_caller,
+            });
             return serde_json::to_string(&SuccessResponse {
                 id: request.id,
                 result: ResponseResult::Ok {},
             })
             .unwrap_or_else(|_| "{}".to_string());
         }
-    } else if server_stop.is_some_and(|stop| stop.load(Ordering::Acquire)) {
+    } else if server_stop.is_some_and(ServerStop::is_requested) {
         return error_response_json(
             request.id,
             "server_unavailable",
@@ -1446,6 +1454,7 @@ mod tests {
             }),
             None,
             None,
+            None,
         );
 
         let parsed: SuccessResponse = serde_json::from_str(&response).unwrap();
@@ -1456,7 +1465,7 @@ mod tests {
     #[test]
     fn server_stop_control_bypasses_app_channel() {
         let (tx, mut rx) = mpsc::unbounded_channel();
-        let stop = Arc::new(AtomicBool::new(false));
+        let stop = ServerStop::default();
         let response = handle_request(
             Request {
                 id: "priority_stop".into(),
@@ -1465,13 +1474,20 @@ mod tests {
             &tx,
             None,
             Some(&stop),
+            Some("pid 42 (herdr)".into()),
             None,
         );
 
         let response: serde_json::Value = serde_json::from_str(&response).unwrap();
         assert_eq!(response["id"], "priority_stop");
         assert_eq!(response["result"]["type"], "ok");
-        assert!(stop.load(Ordering::Acquire));
+        assert!(stop.is_requested());
+        assert_eq!(
+            stop.take_reason(),
+            Some(ShutdownReason::ApiStop {
+                caller: Some("pid 42 (herdr)".into())
+            })
+        );
 
         let rejected = handle_request(
             Request {
@@ -1482,6 +1498,7 @@ mod tests {
             None,
             Some(&stop),
             None,
+            None,
         );
         let rejected: serde_json::Value = serde_json::from_str(&rejected).unwrap();
         assert_eq!(rejected["error"]["code"], "server_unavailable");
@@ -1497,8 +1514,9 @@ mod tests {
         };
 
         let request_for_
```

**File**: `src/platform/fallback.rs` (modified, +10/-0)
```diff
@@ -13,6 +13,16 @@ pub(crate) fn set_default_plugin_pane_pwd(
 ) {
 }
 
+#[cfg(unix)]
+pub(super) fn socket_peer_pid(_fd: std::os::fd::RawFd) -> Option<u32> {
+    None
+}
+
+#[cfg(unix)]
+pub(super) fn process_name_and_parent(_pid: u32) -> Option<(String, u32)> {
+    None
+}
+
 #[cfg(unix)]
 pub(super) const REMOTE_BRIDGE_CLOCK: libc::clockid_t = libc::CLOCK_MONOTONIC;
 
```

**File**: `src/platform/linux.rs` (modified, +39/-0)
```diff
@@ -664,6 +664,34 @@ pub fn foreground_process_group_id_for_tty_fd(fd: RawFd) -> Option<u32> {
     (pgid > 0).then_some(pgid as u32)
 }
 
+pub(super) fn socket_peer_pid(fd: RawFd) -> Option<u32> {
+    let mut cred: libc::ucred = unsafe { std::mem::zeroed() };
+    let mut len = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
+    let result = unsafe {
+        libc::getsockopt(
+            fd,
+            libc::SOL_SOCKET,
+            libc::SO_PEERCRED,
+            (&mut cred as *mut libc::ucred).cast(),
+            &mut len,
+        )
+    };
+    (result == 0 && cred.pid > 0).then_some(cred.pid as u32)
+}
+
+pub(super) fn process_name_and_parent(pid: u32) -> Option<(String, u32)> {
+    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
+    let close = stat.rfind(')')?;
+    let name = stat.get(1 + stat.find('(')?..close)?.to_string();
+    let parent = stat
+        .get(close + 2..)?
+        .split_whitespace()
+        .nth(1)?
+        .parse()
+        .ok()?;
+    Some((name, parent))
+}
+
 fn process_pgrp_comm_and_state(pid: u32) -> Option<(i32, String, char)> {
     let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
     process_pgrp_comm_and_state_from_stat(&stat)
@@ -1173,6 +1201,17 @@ mod tests {
         LOCK.get_or_init(|| Mutex::new(()))
     }
 
+    #[test]
+    fn socket_peer_resolves_to_the_connecting_process_and_its_parent() {
+        use std::os::fd::AsRawFd as _;
+
+        let (local, _peer) = std::os::unix::net::UnixStream::pair().unwrap();
+        let pid = std::process::id();
+        assert_eq!(socket_peer_pid(local.as_raw_fd()), Some(pid));
+        let (_, parent) = process_name_and_parent(pid).unwrap();
+        assert_eq!(parent, std::os::unix::process::parent_id());
+    }
+
     #[test]
     fn wsl_marker_detection_matches_kernel_release_text() {
         assert!(text_indicates_wsl("5.15.167.4-microsoft-standard-WSL2"));
```

**File**: `src/platform/macos.rs` (modified, +20/-0)
```diff
@@ -912,6 +912,26 @@ fn run_clipboard_command(command: &ClipboardCommand, bytes: &[u8]) -> bool {
     child.wait().map(|status| status.success()).unwrap_or(false)
 }
 
+pub(super) fn socket_peer_pid(fd: RawFd) -> Option<u32> {
+    let mut pid: libc::pid_t = 0;
+    let mut len = std::mem::size_of::<libc::pid_t>() as libc::socklen_t;
+    let result = unsafe {
+        libc::getsockopt(
+            fd,
+            libc::SOL_LOCAL,
+            libc::LOCAL_PEERPID,
+            (&mut pid as *mut libc::pid_t).cast(),
+            &mut len,
+        )
+    };
+    (result == 0 && pid > 0).then_some(pid as u32)
+}
+
+pub(super) fn process_name_and_parent(pid: u32) -> Option<(String, u32)> {
+    let info = process_bsdinfo(pid)?;
+    Some((comm_from_bsdinfo(&info)?, info.pbi_ppid))
+}
+
 fn process_bsdinfo(pid: u32) -> Option<libc::proc_bsdinfo> {
     let mut info: libc::proc_bsdinfo = unsafe { std::mem::zeroed() };
     let size = std::mem::size_of::<libc::proc_bsdinfo>() as libc::c_int;
```

**File**: `src/platform/mod.rs` (modified, +43/-1)
```diff
@@ -51,6 +51,47 @@ pub struct ForegroundJob {
     pub processes: Vec<ForegroundProcess>,
 }
 
+/// A request from outside the process to stop the server.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(crate) enum ServerQuitSignal {
+    #[cfg(unix)]
+    Interrupt,
+    #[cfg(unix)]
+    Terminate,
+    #[cfg(not(unix))]
+    ConsoleControl,
+}
+
+impl std::fmt::Display for ServerQuitSignal {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        f.write_str(match self {
+            #[cfg(unix)]
+            Self::Interrupt => "SIGINT",
+            #[cfg(unix)]
+            Self::Terminate => "SIGTERM",
+            #[cfg(not(unix))]
+            Self::ConsoleControl => "console control event",
+        })
+    }
+}
+
+#[cfg(not(unix))]
+pub(crate) fn spawn_server_signal_monitor(
+    on_quit: impl Fn(ServerQuitSignal) + Send + Sync + 'static,
+) {
+    if let Err(err) = ctrlc::set_handler(move || on_quit(ServerQuitSignal::ConsoleControl)) {
+        tracing::warn!(%err, "failed to install server stop handler");
+    }
+}
+
+#[cfg(not(unix))]
+pub(crate) fn ignore_server_hangup() {}
+
+#[cfg(not(unix))]
+pub(crate) fn local_stream_peer_description(_stream: &crate::ipc::LocalStream) -> Option<String> {
+    None
+}
+
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub enum Signal {
     Hangup,
@@ -331,7 +372,8 @@ mod unix_common;
 pub(crate) mod unix_image_files;
 #[cfg(unix)]
 pub(crate) use unix_common::{
-    begin_cli_output, end_cli_output, forward_remote_bridge_stdio, RemoteBridgeWake,
+    begin_cli_output, end_cli_output, forward_remote_bridge_stdio, ignore_server_hangup,
+    local_stream_peer_description, spawn_server_signal_monitor, RemoteBridgeWake,
 };
 
 mod client_state;
```

**File**: `src/platform/unix_common.rs` (modified, +96/-0)
```diff
@@ -253,6 +253,77 @@ fn set_sigpipe_disposition(handler: libc::sighandler_t) {
     }
 }
 
+extern "C" fn discard_signal(_signal: libc::c_int) {}
+
+/// The server must outlive the terminal or shell that launched it, like tmux.
+/// Installed at process start so SIGHUP cannot stop the server before its event
+/// loop runs. A handler, unlike SIG_IGN, resets to the default on exec, so
+/// child processes keep normal hangup behavior.
+pub(crate) fn ignore_server_hangup() {
+    let mut action: libc::sigaction = unsafe { std::mem::zeroed() };
+    action.sa_sigaction = discard_signal as extern "C" fn(libc::c_int) as libc::sighandler_t;
+    action.sa_flags = libc::SA_RESTART;
+    unsafe {
+        libc::sigemptyset(&mut action.sa_mask);
+        libc::sigaction(libc::SIGHUP, &action, std::ptr::null_mut());
+    }
+}
+
+/// Routes SIGINT and SIGTERM to `on_quit`, and logs SIGHUP without stopping.
+pub(crate) fn spawn_server_signal_monitor(
+    on_quit: impl Fn(super::ServerQuitSignal) + Send + Sync + 'static,
+) {
+    use tokio::signal::unix::{signal, SignalKind};
+    use tracing::{info, warn};
+
+    let on_quit = std::sync::Arc::new(on_quit);
+    for (kind, quit_signal) in [
+        (SignalKind::interrupt(), super::ServerQuitSignal::Interrupt),
+        (SignalKind::terminate(), super::ServerQuitSignal::Terminate),
+    ] {
+        match signal(kind) {
+            Ok(mut stream) => {
+                let on_quit = on_quit.clone();
+                tokio::spawn(async move {
+                    while stream.recv().await.is_some() {
+                        on_quit(quit_signal);
+                    }
+                });
+            }
+            Err(err) => warn!(%err, signal = %quit_signal, "failed to install server stop handler"),
+        }
+    }
+    match signal(SignalKind::hangup()) {
+        Ok(mut stream) => {
+            tokio::spawn(async move {
+                while stream.recv().await.is_some() {
+                    info!("ignoring SIGHUP; server keeps running");
+                }
+            });
+        }
+        Err(err) => warn!(%err, "failed to install SIGHUP handler"),
+    }
+}
+
+/// Describes the process on the other end of a local socket, for logs.
+pub(crate) fn local_stream_peer_description(stream: &crate::ipc::LocalStream) -> Option<String> {
+    use std::os::fd::{AsFd as _, AsRawFd as _};
+
+    let crate::ipc::LocalStream::UdSocket(socket) = stream;
+    let pid = super::socket_peer_pid(socket.as_fd().as_raw_fd())?;
+    let Some((name, parent)) = super::process_name_and_parent(pid) else {
+        return Some(format!("pid {pid}"));
+    };
+    let mut description = format!("pid {pid} ({name})");
+    if parent > 1 {
+        description.push_str(&format!(", parent pid {parent}"));
+        if let Some((parent_name, _)) = super::process_name_and_parent(parent) {
+            description.push_str(&format!(" ({parent_name})"));
+        }
+    }
+    Some(description)
+}
+
 pub(crate) fn begin_cli_output() {
     set_sigpipe_disposition(libc::SIG_DFL);
 }
@@ -480,6 +551,31 @@ pub(crate) fn set_default_plugin_pane_pwd(env: &mut Vec<(String, String)>, cwd:
 mod tests {
     use super::*;
 
+    #[test]
+    fn server_signal_monitor_survives_hangup_and_reports_terminate() {
+        let runtime = tokio::runtime::Builder::new_current_thread()
+            .enable_all()
+            .build()
+            .unwrap();
+        runtime.block_on(async {
+            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
+            spawn_server_signal_monitor(move |signal| {
+                let _ = tx.send(signal);
+            });
+
+            // An unhandled SIGHUP would end the test process here.
+            assert_eq!(unsafe { libc::kill(libc::getpid(), libc::SIGHUP) }, 0);
+            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
+            assert!(rx.try_recv().is_err());
+
+            assert_eq!(unsafe { libc::kill(libc::getpid(), libc::SIGTERM) }, 0);
+            let signal = tokio::time::timeout(std::time::Duration::from_secs(5), rx.recv())
+                .await
+                .unwrap();
+            assert_eq!(signal, Some(super::super::ServerQuitSignal::Terminate));
+        });
+    }
+
     #[test]
     fn plugin_pane_pwd_defaults_to_cwd_without_overriding_explicit_env() {
         let cwd = Path::new("/plugin-cwd");
```

**File**: `src/server/headless.rs` (modified, +11/-15)
```diff
@@ -67,6 +67,7 @@ use crate::server::pane_input::{
     apply_client_pane_input_events, apply_client_popup_input_events, apply_terminal_attach_input,
     apply_terminal_attach_scroll, terminal_attach_mouse_position,
 };
+use crate::server::shutdown::{ServerStop, ShutdownReason};
 use crate::server::socket_paths::{
     client_socket_path, prepare_socket_path, restrict_socket_permissions,
 };
@@ -240,8 +241,9 @@ pub struct HeadlessServer {
     /// Imported panes get one app-safe resize nudge after the first client attaches.
     #[cfg(unix)]
     pending_handoff_repaint_nudge: bool,
-    /// Flag set by Ctrl+C or `server stop` signal.
+    /// Flag set by a stop signal or `server stop`; shares `server_stop`'s flag.
     should_quit: Arc<AtomicBool>,
+    server_stop: ServerStop,
     host_shutdown_requested: Arc<AtomicBool>,
     /// Channel for receiving server events from client connection threads.
     server_event_rx: mpsc::Receiver<ServerEvent>,
@@ -306,8 +308,9 @@ impl HeadlessServer {
         config_diagnostics: &[String],
         api_tx: Option<api::ApiRequestSender>,
         api_server: Option<api::ServerHandle>,
-        should_quit: Arc<AtomicBool>,
+        server_stop: ServerStop,
     ) -> io::Result<Self> {
+        let should_quit = server_stop.flag().clone();
         let client_path = client_socket_path();
         prepare_socket_path(&client_path)?;
 
@@ -372,6 +375,7 @@ impl HeadlessServer {
             #[cfg(unix)]
             pending_handoff_repaint_nudge: false,
             should_quit,
+            server_stop,
             server_event_rx,
             server_event_tx,
         })
@@ -389,10 +393,12 @@ impl HeadlessServer {
     pub async fn run(&mut self) -> io::Result<()> {
         crate::logging::startup("server");
 
-        // Register SIGINT handler for graceful shutdown.
-        let should_quit = self.should_quit.clone();
+        let server_stop = self.server_stop.clone();
         let quit_notify = self.server_event_tx.clone();
-        ctrlc_handler(should_quit, quit_notify);
+        crate::platform::spawn_server_signal_monitor(move |signal| {
+            server_stop.request(ShutdownReason::Signal(signal));
+            let _ = quit_notify.try_send(ServerEvent::QuitSignal);
+        });
         let quit_notify = self.server_event_tx.clone();
         let _host_shutdown = crate::platform::HostShutdownMonitor::start(
             self.host_shutdown_requested.clone(),
@@ -3325,16 +3331,6 @@ impl Drop for HeadlessServer {
 // Helpers
 // ---------------------------------------------------------------------------
 
-/// Installs a Ctrl+C handler that sets the should_quit flag and wakes up
-/// the event loop by sending a QuitSignal on the server event channel.
-fn ctrlc_handler(should_quit: Arc<AtomicBool>, server_event_tx: mpsc::Sender<ServerEvent>) {
-    let _ = ctrlc::set_handler(move || {
-        should_quit.store(true, Ordering::Release);
-        // Wake up the event loop so the quit flag is checked promptly.
-        let _ = server_event_tx.try_send(ServerEvent::QuitSignal);
-    });
-}
-
 /// Sleep until a deadline, or return pending if none.
 async fn sleep_until_or_pending(deadline: Option<Instant>) {
     match deadline {
```

---

### Incident Patch 2: `6976ae37` (2026-10-05)
**Commit Message**: fix: stop probing the forwarded ssh agent every second (#4962)

**File**: `src/platform/ssh_agent.rs` (modified, +221/-29)
```diff
@@ -12,7 +12,11 @@ use interprocess::ConnectWaitMode;
 
 use crate::ipc::LocalStream;
 
-const PROBE_INTERVAL: Duration = Duration::from_secs(1);
+const CHECK_INTERVAL: Duration = Duration::from_secs(1);
+const UNAVAILABLE_RETRY_INTERVAL: Duration = Duration::from_secs(5);
+
+/// Device, inode, mode, and ctime of a usable agent socket file.
+type Fingerprint = (u64, u64, u32, i64, i64);
 
 #[derive(Clone)]
 pub(crate) struct SshAgentRegistry(Arc<Mutex<State>>);
@@ -23,6 +27,9 @@ struct State {
     agents: Vec<(u64, PathBuf)>,
     next_id: u64,
     identity: Option<(u64, u64)>,
+    observed: Vec<Option<Fingerprint>>,
+    selected: bool,
+    last_check: Option<Instant>,
     last_probe: Option<Instant>,
 }
 
@@ -42,10 +49,27 @@ fn agent_path_for(api_path: &Path) -> PathBuf {
 }
 
 fn usable_socket(path: &Path) -> bool {
-    fs::metadata(path).is_ok_and(|metadata| {
-        // The API is user-private; do not redirect that user's panes to another user's agent.
-        metadata.file_type().is_socket() && metadata.uid() == unsafe { libc::geteuid() }
-    })
+    fingerprint(path).is_some()
+}
+
+// A listener that dies in place, or an in-place change that keeps all of these fields, is
+// noticed only at the next selection; periodic connect probes would cost a forwarded channel.
+fn fingerprint(path: &Path) -> Option<Fingerprint> {
+    fs::metadata(path)
+        .ok()
+        .filter(|metadata| {
+            // The API is user-private; do not redirect that user's panes to another user's agent.
+            metadata.file_type().is_socket() && metadata.uid() == unsafe { libc::geteuid() }
+        })
+        .map(|metadata| {
+            (
+                metadata.dev(),
+                metadata.ino(),
+                metadata.mode(),
+                metadata.ctime(),
+                metadata.ctime_nsec(),
+            )
+        })
 }
 
 fn live_socket(path: &Path) -> bool {
@@ -84,10 +108,13 @@ impl SshAgentRegistry {
             agents: Vec::new(),
             next_id: 0,
             identity: None,
+            observed: Vec::new(),
+            selected: false,
+            last_check: None,
             last_probe: None,
         };
         if managed {
-            state.publish()?;
+            state.publish(Instant::now())?;
         }
         Ok(Self(Arc::new(Mutex::new(state))))
     }
@@ -107,7 +134,7 @@ impl SshAgentRegistry {
         let id = state.next_id;
         state.next_id += 1;
         state.agents.push((id, path));
-        if let Err(error) = state.publish() {
+        if let Err(error) = state.publish(Instant::now()) {
             state.agents.retain(|(candidate, _)| *candidate != id);
             return Err(error);
         }
@@ -119,7 +146,7 @@ impl SshAgentRegistry {
 }
 
 impl State {
-    fn publish(&mut self) -> io::Result<()> {
+    fn ensure_owned(&self) -> io::Result<()> {
         if let Some(identity) = self.identity {
             let metadata = fs::symlink_metadata(&self.path)?;
             if identity != (metadata.dev(), metadata.ino()) {
@@ -128,9 +155,23 @@ impl State {
                 ));
             }
         }
+        Ok(())
+    }
+
+    fn observe(&self) -> Vec<Option<Fingerprint>> {
+        self.fallback
+            .iter()
+            .chain(self.agents.iter().map(|(_, path)| path))
+            .map(|path| fingerprint(path))
+            .collect()
+    }
+
+    fn publish(&mut self, now: Instant) -> io::Result<()> {
+        self.ensure_owned()?;
         // Keep a working agent rather than letting probes or a second client replace it.
         let unavailable = self.path.with_extension("unavailable");
-        self.last_probe = Some(Instant::now());
+        let observed = self.observe();
+        self.last_probe = Some(now);
         let target = self
             .fallback
             .as_deref()
@@ -141,20 +182,25 @@ impl State {
                     .map(|(_, path)| path.as_path())
                     .find(|path| live_socket(path))
             })
-            .unwrap_or(&unavailable);
-        if self.identity.is_some() && fs::read_link(&self.path).ok().as_deref() == Some(target) {
-            return Ok(());
-        }
-        let temporary = self
-            .path
-            .with_extension(format!("{}.new", std::process::id()));
-        symlink(target, &temporary)?;
-        if let Err(error) = fs::rename(&temporary, &self.path) {
-            let _ = fs::remove_file(&temporary);
-            return Err(error);
+            .unwrap_or(&unavailable)
+            .to_path_buf();
+        if self.identity.is_none()
+            || fs::read_link(&self.path).ok().as_deref() != Some(target.as_path())
+        {
+            let temporary = self
+                .path
+                .with_extension(format!("{}.new", std::process::id()));
+            symlink(&target, &temporary)?;
+            if let Err(error) = fs::rename(&temporary, &self.path) {
+                let _ = fs::remove_file(&temporary);
+               
```

---

### Incident Patch 3: `fabcab10` (2026-10-05)
**Commit Message**: fix: detect agy dialogs and mid-turn work, treat background work as idle for agy and grok (#4959)

refs #3871
refs #3530
refs #4735
refs #3419

**File**: `distribution/agent-detection/antigravity.toml` (modified, +57/-10)
```diff
@@ -1,13 +1,60 @@
 id = "agy"
-version = "2026.06.24.1"
+version = "2026.10.05.1"
 min_engine_version = 1
-updated_at = "2026-06-24T00:00:00Z"
+updated_at = "2026-10-05T00:00:00Z"
 aliases = ["antigravity", "antigravity-cli"]
 
+# Evidence: Antigravity CLI 1.2.17 live pane reads, plus reporter captures
+# from 1.1.28 through 1.2.16.
+#
+# Dialogs replace the prompt box and end with a key-hint row directly above
+# the "esc to cancel" footer:
+#   permission: "↑/↓ Navigate · tab Amend · ctrl+g edit/expand command"
+#               "↑/↓ Navigate · tab Amend · f full diff"
+#   question:   "↑/↓ Navigate · enter Select · esc Skip"
+#   trust:      "↑/↓ Navigate · enter Confirm"
+#   slash menu: "↑/↓ Navigate · enter Select · tab Complete" (idle)
+# Some captures hold only the two footer rows, so dialog rules must not
+# require the question text.
+#
+# Working turns draw a braille spinner followed by either an -ing word or a
+# thought summary above the prompt box, and the footer reads "esc to cancel"
+# directly under the prompt box's bottom border. The idle footer reads
+# "? for shortcuts".
+#
+# Background tasks and subagents show "· N task(s)" in the footer and a task
+# panel under the prompt box. Once the agent is back at its prompt they do
+# not count as working.
+
 [[rules]]
 id = "permission_prompt"
 state = "blocked"
 priority = 300
+region = "bottom_non_empty_lines(2)"
+visible_blocker = true
+contains = ["navigate", "tab amend"]
+
+[[rules]]
+id = "question_prompt"
+state = "blocked"
+priority = 290
+region = "bottom_non_empty_lines(2)"
+visible_blocker = true
+contains = ["navigate", "esc skip"]
+
+[[rules]]
+id = "trust_prompt"
+state = "blocked"
+priority = 280
+region = "bottom_non_empty_lines(8)"
+visible_blocker = true
+contains = ["do you trust the contents of this project?", "yes, i trust this folder", "enter confirm"]
+
+# Pre-1.1.28 permission dialog.
+[[rules]]
+id = "legacy_permission_prompt"
+state = "blocked"
+priority = 270
 region = "whole_recent"
 visible_blocker = true
 contains = ["requesting permission for:"]
@@ -17,17 +64,17 @@ any = [
 ]
 
 [[rules]]
-id = "spinner_working"
+id = "esc_cancel_footer_working"
 state = "working"
-priority = 100
-region = "whole_recent"
+priority = 110
+region = "bottom_non_empty_lines(2)"
 visible_working = true
-line_regex = ['^\s*[\u2800-\u28FF]+\s+\p{Alphabetic}+\w*ing\b']
+regex = ['(?m)^\s*─{3,}\s*esc to cancel\b']
 
 [[rules]]
-id = "background_tasks_working"
+id = "spinner_working"
 state = "working"
-priority = 90
-region = "bottom_non_empty_lines(5)"
+priority = 100
+region = "bottom_non_empty_lines(12)"
 visible_working = true
-line_regex = ['(?i)·\s*[1-9][0-9]*\s+task']
+line_regex = ['^\s*[\u2801-\u28FF]+\s+\S']
```

**File**: `distribution/agent-detection/grok.toml` (modified, +5/-12)
```diff
@@ -1,7 +1,7 @@
 id = "grok"
-version = "2026.09.18.1"
-min_engine_version = 2
-updated_at = "2026-09-18T00:00:00Z"
+version = "2026.10.05.1"
+min_engine_version = 3
+updated_at = "2026-10-05T00:00:00Z"
 aliases = ["grok-build"]
 
 # Evidence: Grok Build 0.2.101 source and 1.0.34 live pane reads.
@@ -74,15 +74,8 @@ any = [
   { contains = ["←/→:scope"] },
 ]
 
-# Grok 1.0.34 moves background counts above the composer and clears OSC
-# progress between turns even while these commands are still running.
-[[rules]]
-id = "background_status_working"
-state = "working"
-priority = 1165
-region = "bottom_non_empty_lines(12)"
-visible_working = true
-line_regex = ['^\s*[○◎◉]\s+[1-9][0-9]*\s+(?:commands?|monitors?|loops?|subagents?)(?:\s+·\s+[1-9][0-9]*\s+(?:commands?|monitors?|loops?|subagents?))*\s+still running(?:\s+·\s+send a message to interrupt)?\s*$']
+# Background commands, monitors, and subagents left running after Grok returns
+# to its prompt do not count as working, matching Claude and agy (#1217, #4735).
 
 [[rules]]
 id = "osc_progress_working"
```

**File**: `scripts/agent_detection_manifest_check.py` (modified, +4/-10)
```diff
@@ -53,16 +53,10 @@
 MAX_TOTAL_MATCHERS = 1024
 MAX_MATCHER_CHARS = 512
 
-# Keep engine-2 clients on the OSC-capable manifest until an engine-3 release
-# can consume top_non_empty_lines. Remove this entry when the distribution
-# publishes the bundled Grok manifest.
-STAGED_PUBLISHED_MANIFESTS = {
-    "grok": (
-        "2026.09.18.2",
-        "2026.09.18.1",
-        "0f31b111144900b02f303577d27587f72d58d8c505185a682bd7887f822316ee",
-    ),
-}
+# Keep older-engine clients on a published manifest until a release with the
+# bundled manifest's engine ships. Maps agent id to (bundled version, published
+# version, published sha256). Remove an entry once the bundled manifest ships.
+STAGED_PUBLISHED_MANIFESTS: dict[str, tuple[str, str, str]] = {}
 
 UNPUBLISHED_BUNDLED_MANIFESTS: dict[str, tuple[str, str]] = {}
 
```

**File**: `scripts/test_agent_detection_manifest_check.py` (modified, +26/-15)
```diff
@@ -29,18 +29,27 @@ def catalog(agent_id: str = "codex", path: str = "codex.toml") -> str:
 '''
 
 
-def staged_grok_dirs(root: Path) -> tuple[Path, Path]:
+STAGED_BUNDLED_MANIFEST = manifest("codex", "2026.06.10.2").replace(
+    "min_engine_version = 1", "min_engine_version = 2"
+)
+STAGED_PUBLISHED_MANIFEST = manifest("codex", "2026.06.10.1")
+STAGED_TEST_EXCEPTION = {
+    "codex": (
+        "2026.06.10.2",
+        "2026.06.10.1",
+        hashlib.sha256(STAGED_PUBLISHED_MANIFEST.encode()).hexdigest(),
+    ),
+}
+
+
+def staged_manifest_dirs(root: Path) -> tuple[Path, Path]:
     bundled = root / "bundled"
     published = root / "published"
     bundled.mkdir()
     published.mkdir()
-    (bundled / "grok.toml").write_bytes(
-        (check.DEFAULT_BUNDLED_DIR / "grok.toml").read_bytes()
-    )
-    (published / "grok.toml").write_bytes(
-        (check.DEFAULT_PUBLISHED_DIR / "grok.toml").read_bytes()
-    )
-    (published / "index.toml").write_text(catalog("grok", "grok.toml"))
+    (bundled / "codex.toml").write_text(STAGED_BUNDLED_MANIFEST, encoding="utf-8", newline="\n")
+    (published / "codex.toml").write_text(STAGED_PUBLISHED_MANIFEST, encoding="utf-8", newline="\n")
+    (published / "index.toml").write_text(catalog())
     return bundled, published
 
 
@@ -94,22 +103,24 @@ def test_rejects_published_version_lower_than_bundled(self):
             with self.assertRaisesRegex(check.CheckError, "lower than bundled"):
                 check.validate_catalog(website, bundled_manifests, engine_version=1)
 
+    @patch.dict(check.STAGED_PUBLISHED_MANIFESTS, STAGED_TEST_EXCEPTION, clear=True)
     def test_allows_explicitly_staged_published_manifest(self):
         with tempfile.TemporaryDirectory() as tmp:
-            bundled, website = staged_grok_dirs(Path(tmp))
+            bundled, website = staged_manifest_dirs(Path(tmp))
 
-            bundled_manifests = check.load_manifest_dir(bundled, engine_version=3)
-            check.validate_catalog(website, bundled_manifests, engine_version=3)
+            bundled_manifests = check.load_manifest_dir(bundled, engine_version=2)
+            check.validate_catalog(website, bundled_manifests, engine_version=2)
 
+    @patch.dict(check.STAGED_PUBLISHED_MANIFESTS, STAGED_TEST_EXCEPTION, clear=True)
     def test_rejects_mutated_staged_published_manifest(self):
         with tempfile.TemporaryDirectory() as tmp:
-            bundled, website = staged_grok_dirs(Path(tmp))
-            with (website / "grok.toml").open("a") as manifest_file:
+            bundled, website = staged_manifest_dirs(Path(tmp))
+            with (website / "codex.toml").open("a") as manifest_file:
                 manifest_file.write("\n# unexpected mutation\n")
 
-            bundled_manifests = check.load_manifest_dir(bundled, engine_version=3)
+            bundled_manifests = check.load_manifest_dir(bundled, engine_version=2)
             with self.assertRaisesRegex(check.CheckError, "lower than bundled"):
-                check.validate_catalog(website, bundled_manifests, engine_version=3)
+                check.validate_catalog(website, bundled_manifests, engine_version=2)
 
     def test_rejects_unlisted_published_manifest_lag_for_new_engine(self):
         with tempfile.TemporaryDirectory() as tmp:
```

**File**: `src/detect/manifests/antigravity.toml` (modified, +57/-10)
```diff
@@ -1,13 +1,60 @@
 id = "agy"
-version = "2026.06.24.1"
+version = "2026.10.05.1"
 min_engine_version = 1
-updated_at = "2026-06-24T00:00:00Z"
+updated_at = "2026-10-05T00:00:00Z"
 aliases = ["antigravity", "antigravity-cli"]
 
+# Evidence: Antigravity CLI 1.2.17 live pane reads, plus reporter captures
+# from 1.1.28 through 1.2.16.
+#
+# Dialogs replace the prompt box and end with a key-hint row directly above
+# the "esc to cancel" footer:
+#   permission: "↑/↓ Navigate · tab Amend · ctrl+g edit/expand command"
+#               "↑/↓ Navigate · tab Amend · f full diff"
+#   question:   "↑/↓ Navigate · enter Select · esc Skip"
+#   trust:      "↑/↓ Navigate · enter Confirm"
+#   slash menu: "↑/↓ Navigate · enter Select · tab Complete" (idle)
+# Some captures hold only the two footer rows, so dialog rules must not
+# require the question text.
+#
+# Working turns draw a braille spinner followed by either an -ing word or a
+# thought summary above the prompt box, and the footer reads "esc to cancel"
+# directly under the prompt box's bottom border. The idle footer reads
+# "? for shortcuts".
+#
+# Background tasks and subagents show "· N task(s)" in the footer and a task
+# panel under the prompt box. Once the agent is back at its prompt they do
+# not count as working.
+
 [[rules]]
 id = "permission_prompt"
 state = "blocked"
 priority = 300
+region = "bottom_non_empty_lines(2)"
+visible_blocker = true
+contains = ["navigate", "tab amend"]
+
+[[rules]]
+id = "question_prompt"
+state = "blocked"
+priority = 290
+region = "bottom_non_empty_lines(2)"
+visible_blocker = true
+contains = ["navigate", "esc skip"]
+
+[[rules]]
+id = "trust_prompt"
+state = "blocked"
+priority = 280
+region = "bottom_non_empty_lines(8)"
+visible_blocker = true
+contains = ["do you trust the contents of this project?", "yes, i trust this folder", "enter confirm"]
+
+# Pre-1.1.28 permission dialog.
+[[rules]]
+id = "legacy_permission_prompt"
+state = "blocked"
+priority = 270
 region = "whole_recent"
 visible_blocker = true
 contains = ["requesting permission for:"]
@@ -17,17 +64,17 @@ any = [
 ]
 
 [[rules]]
-id = "spinner_working"
+id = "esc_cancel_footer_working"
 state = "working"
-priority = 100
-region = "whole_recent"
+priority = 110
+region = "bottom_non_empty_lines(2)"
 visible_working = true
-line_regex = ['^\s*[\u2800-\u28FF]+\s+\p{Alphabetic}+\w*ing\b']
+regex = ['(?m)^\s*─{3,}\s*esc to cancel\b']
 
 [[rules]]
-id = "background_tasks_working"
+id = "spinner_working"
 state = "working"
-priority = 90
-region = "bottom_non_empty_lines(5)"
+priority = 100
+region = "bottom_non_empty_lines(12)"
 visible_working = true
-line_regex = ['(?i)·\s*[1-9][0-9]*\s+task']
+line_regex = ['^\s*[\u2801-\u28FF]+\s+\S']
```

**File**: `src/detect/manifests/grok.toml` (modified, +4/-22)
```diff
@@ -1,7 +1,7 @@
 id = "grok"
-version = "2026.09.18.2"
+version = "2026.10.05.1"
 min_engine_version = 3
-updated_at = "2026-09-18T00:00:00Z"
+updated_at = "2026-10-05T00:00:00Z"
 aliases = ["grok-build"]
 
 # Evidence: Grok Build 0.2.101 source and 1.0.34 live pane reads.
@@ -74,26 +74,8 @@ any = [
   { contains = ["←/→:scope"] },
 ]
 
-# Grok clears its OSC busy signals while background work runs. The first
-# non-empty row is pinned application chrome, where this animated chip shows
-# the number of running background tasks and disappears when the count is zero.
-[[rules]]
-id = "background_work_chip_working"
-state = "working"
-priority = 1170
-region = "top_non_empty_lines(1)"
-visible_working = true
-line_regex = ['[⋅:⸬⁙.·]\s+[1-9][0-9]*\s+│']
-
-# Grok 1.0.34 moves background counts above the composer and clears OSC
-# progress between turns even while these commands are still running.
-[[rules]]
-id = "background_status_working"
-state = "working"
-priority = 1165
-region = "bottom_non_empty_lines(12)"
-visible_working = true
-line_regex = ['^\s*[○◎◉]\s+[1-9][0-9]*\s+(?:commands?|monitors?|loops?|subagents?)(?:\s+·\s+[1-9][0-9]*\s+(?:commands?|monitors?|loops?|subagents?))*\s+still running(?:\s+·\s+send a message to interrupt)?\s*$']
+# Background commands, monitors, and subagents left running after Grok returns
+# to its prompt do not count as working, matching Claude and agy (#1217, #4735).
 
 [[rules]]
 id = "osc_progress_working"
```

---

### Incident Patch 4: `b0648067` (2026-10-05)
**Commit Message**: chore: hold ratatui updates until kana rendering is fixed (#4953)

**File**: `.github/dependabot.yml` (modified, +5/-0)
```diff
@@ -5,6 +5,11 @@ updates:
     schedule:
       interval: monthly
     open-pull-requests-limit: 1
+    ignore:
+      # 0.30.1+ diffs halfwidth kana + voiced mark as two columns, so the server's
+      # backend replay blanks the voiced mark. Lift once the render path handles it.
+      - dependency-name: ratatui
+        versions: [">0.30.0"]
     groups:
       cargo-dependencies:
         patterns:
```

---

### Incident Patch 5: `e5443f07` (2026-10-05)
**Commit Message**: fix: keep session restore responsive during git discovery (#4945)

refs #4926

**File**: `src/app/actions.rs` (modified, +56/-0)
```diff
@@ -1648,6 +1648,22 @@ impl AppState {
                 let _ = cache_updates;
                 Vec::new()
             }
+            AppEvent::RestoredWorktreeSpaceChecked {
+                workspace_id,
+                expected,
+                valid,
+            } => {
+                if !valid {
+                    if let Some(workspace) = self.workspaces.iter_mut().find(|workspace| {
+                        workspace.id == workspace_id
+                            && workspace.worktree_space.as_ref() == Some(&expected)
+                    }) {
+                        workspace.worktree_space = None;
+                        self.session_dirty = true;
+                    }
+                }
+                Vec::new()
+            }
             AppEvent::WorktreeAddFinished(_) => Vec::new(),
             AppEvent::WorktreeRemoveFinished(_) => Vec::new(),
             AppEvent::WorktreeReadFinished(_) => Vec::new(),
@@ -2580,6 +2596,46 @@ mod tests {
         assert_eq!(state.workspaces[1].git_ahead_behind(), None);
     }
 
+    #[test]
+    fn restored_worktree_rejection_preserves_changed_and_missing_workspaces() {
+        let mut state = AppState::test_with_adversarial_identity_state();
+        let workspace_id = state.workspaces[0].id.clone();
+        let expected = crate::workspace::WorktreeSpaceMembership {
+            key: "saved-repo".into(),
+            label: "saved".into(),
+            repo_root: "/repo".into(),
+            checkout_path: "/checkout".into(),
+            is_linked_worktree: true,
+        };
+        let current = crate::workspace::WorktreeSpaceMembership {
+            key: "new-repo".into(),
+            ..expected.clone()
+        };
+        state.workspaces[0].worktree_space = Some(current.clone());
+        state.session_dirty = false;
+        state.assert_invariants_for_test();
+
+        for id in [workspace_id.clone(), "closed-workspace".into()] {
+            state.handle_app_event(AppEvent::RestoredWorktreeSpaceChecked {
+                workspace_id: id,
+                expected: expected.clone(),
+                valid: false,
+            });
+        }
+        assert_eq!(state.workspaces[0].worktree_space, Some(current.clone()));
+        assert!(!state.session_dirty);
+        state.assert_invariants_for_test();
+
+        state.handle_app_event(AppEvent::RestoredWorktreeSpaceChecked {
+            workspace_id,
+            expected: current,
+            valid: false,
+        });
+        assert!(state.workspaces[0].worktree_space.is_none());
+        assert!(state.session_dirty);
+        state.assert_invariants_for_test();
+    }
+
     #[test]
     fn apply_workspace_git_statuses_ignores_stale_cwd() {
         let mut state = app_with_workspaces(&["one"]);
```

**File**: `src/app/api.rs` (modified, +28/-0)
```diff
@@ -123,6 +123,34 @@ impl App {
             return Vec::new();
         }
 
+        if let AppEvent::RestoredWorktreeSpaceChecked {
+            workspace_id,
+            expected,
+            valid,
+        } = ev
+        {
+            self.pending_restored_worktree_spaces
+                .retain(|(id, space)| id != &workspace_id || space != &expected);
+            let changed_workspace = (!valid)
+                .then(|| {
+                    self.state.workspaces.iter().position(|workspace| {
+                        workspace.id == workspace_id
+                            && workspace.worktree_space.as_ref() == Some(&expected)
+                    })
+                })
+                .flatten();
+            self.state
+                .handle_app_event(AppEvent::RestoredWorktreeSpaceChecked {
+                    workspace_id,
+                    expected,
+                    valid,
+                });
+            if let Some(ws_idx) = changed_workspace {
+                self.emit_workspace_updated(ws_idx);
+            }
+            return Vec::new();
+        }
+
         if let AppEvent::TabBarCommandFinished {
             generation,
             segment_index,
```

**File**: `src/app/api/panes.rs` (modified, +12/-8)
```diff
@@ -1970,14 +1970,18 @@ impl App {
         };
         let workspace_id = self.public_workspace_id(ws_idx);
         let layout_update_target = self.layout_update_target_after_pane_removal(ws_idx, pane_id);
-        if self.state.close_pane_would_close_workspace(ws_idx, pane_id)
-            && self.state.confirm_implicit_worktree_group_close(ws_idx)
-        {
-            return Err(encode_error(
-                id,
-                "confirmation_required",
-                "closing this pane would close a worktree group",
-            ));
+        if self.state.close_pane_would_close_workspace(ws_idx, pane_id) {
+            self.require_restored_group_close_ready(
+                &id,
+                &self.state.workspace_close_indices(ws_idx),
+            )?;
+            if self.state.confirm_implicit_worktree_group_close(ws_idx) {
+                return Err(encode_error(
+                    id,
+                    "confirmation_required",
+                    "closing this pane would close a worktree group",
+                ));
+            }
         }
         let workspace_snapshot = self.workspace_info(ws_idx);
         let terminal_id = self.state.terminal_id_for_pane(ws_idx, pane_id);
```

**File**: `src/app/api/tabs.rs` (modified, +6/-0)
```diff
@@ -233,6 +233,12 @@ impl App {
             .unwrap_or_default();
 
         if closes_workspace {
+            if let Err(response) = self.require_restored_group_close_ready(
+                &id,
+                &self.state.workspace_close_indices(ws_idx),
+            ) {
+                return response;
+            }
             if self.state.confirm_implicit_worktree_group_close(ws_idx) {
                 return encode_error(
                     id,
```

**File**: `src/app/api/workspaces.rs` (modified, +83/-0)
```diff
@@ -324,6 +324,9 @@ impl App {
         } else {
             self.state.workspace_close_indices(index)
         };
+        if let Err(response) = self.require_restored_group_close_ready(&id, &close_indices) {
+            return response;
+        }
         if close_indices.len() >= 2 && !params.close_group {
             return encode_error(
                 id,
@@ -591,6 +594,86 @@ mod tests {
         app
     }
 
+    #[test]
+    fn restored_group_close_waits_for_every_membership_before_mutating_state() {
+        for method in ["workspace.close", "pane.close", "tab.close", "group"] {
+            for pending_index in [0, 2] {
+                for valid in [false, true] {
+                    let mut app = app_with_worktree_group();
+                    let parent = app.state.workspaces.remove(0);
+                    let linked = app.state.workspaces.remove(0);
+                    app.state = crate::app::AppState::test_with_adversarial_identity_state();
+                    app.state.workspaces.insert(0, parent);
+                    app.state.workspaces.push(linked);
+                    app.state.confirm_close = false;
+                    app.state.ensure_test_terminals();
+                    app.state.assert_invariants_for_test();
+                    let expected = app.state.workspaces[pending_index]
+                        .worktree_space
+                        .clone()
+                        .unwrap();
+                    let pending_id = app.state.workspaces[pending_index].id.clone();
+                    app.pending_restored_worktree_spaces
+                        .push((pending_id.clone(), expected.clone()));
+                    let parent_pane = app.state.workspaces[0].tabs[0].root_pane;
+                    let request = serde_json::json!({
+                        "id": "req",
+                        "method": if method == "group" { "workspace.close" } else { method },
+                        "params": match method {
+                            "pane.close" => serde_json::json!({"pane_id": app.public_pane_id(0, parent_pane).unwrap()}),
+                            "tab.close" => serde_json::json!({"tab_id": app.public_tab_id(0, 0).unwrap()}),
+                            _ => serde_json::json!({"workspace_id": app.public_workspace_id(0), "close_group": method == "group"}),
+                        }
+                    });
+                    let before = app.workspace_list_info();
+                    let response =
+                        app.handle_api_request(serde_json::from_value(request.clone()).unwrap());
+                    let response: ErrorResponse = serde_json::from_str(&response).unwrap();
+                    assert_eq!(response.error.code, "worktree_operation_in_progress");
+                    assert_eq!(app.workspace_list_info(), before);
+                    assert!(app.state.terminal_runtime_shutdowns.is_empty());
+                    assert!(app.event_hub.events_after(0).is_empty());
+                    app.state.assert_invariants_for_test();
+
+                    app.handle_internal_event(
+                        crate::events::AppEvent::RestoredWorktreeSpaceChecked {
+                            workspace_id: pending_id,
+                            expected,
+                            valid,
+                        },
+                    );
+                    let response = app.handle_api_request(serde_json::from_value(request).unwrap());
+                    if valid && method == "workspace.close" {
+                        let response: ErrorResponse = serde_json::from_str(&response).unwrap();
+                        assert_eq!(response.error.code, "workspace_group_close_required");
+                    } else {
+                        let _: SuccessResponse = serde_json::from_str(&response).unwrap();
+                        assert_eq!(app.state.workspaces.len(), if valid { 1 } else { 2 });
+                    }
+                    app.state.assert_invariants_for_test();
+                }
+            }
+        }
+    }
+
+    #[test]
+    fn restored_linked_workspace_can_close_while_its_validation_is_pending() {
+        let mut app = app_with_worktree_group();
+        let linked = &app.state.workspaces[1];
+        app.pending_restored_worktree_spaces
+            .push((linked.id.clone(), linked.worktree_space.clone().unwrap()));
+        let response = app.handle_workspace_close(
+            "req".into(),
+            WorkspaceCloseParams {
+                workspace_id: app.public_workspace_id(1),
+                close_group: true,
+            },
+        );
+        let _: SuccessResponse = serde_json::from_str(&response).unwrap();
+        assert_eq!(app.state.workspaces.len(), 1);
+        assert_eq!(app.state.workspaces[0].display_name(), "parent");
+    }
+
     #[test]
     fn api_workspace_close_parent_group_requires_explicit_group_intent() {
         for confirm_close in [true, false] {
```

**File**: `src/app/api/worktrees.rs` (modified, +34/-1)
```diff
@@ -225,6 +225,7 @@ impl App {
     }
 
     fn worktree_source_from_workspace(&self, ws_idx: usize) -> Result<WorktreeSource, ApiFailure> {
+        self.require_restored_worktree_ready(ws_idx)?;
         let Some(ws) = self.state.workspaces.get(ws_idx) else {
             return Err(ApiFailure::new(
                 "workspace_not_found",
@@ -273,6 +274,38 @@ impl App {
         })
     }
 
+    fn require_restored_worktree_ready(&self, ws_idx: usize) -> Result<(), ApiFailure> {
+        if self.state.workspaces.get(ws_idx).is_some_and(|workspace| {
+            self.pending_restored_worktree_spaces
+                .iter()
+                .any(|(id, expected)| {
+                    id == &workspace.id && workspace.worktree_space.as_ref() == Some(expected)
+                })
+        }) {
+            return Err(ApiFailure::new(
+                "worktree_operation_in_progress",
+                "Restored worktree is still loading. Try again shortly.",
+            ));
+        }
+        Ok(())
+    }
+
+    pub(super) fn require_restored_group_close_ready(
+        &self,
+        request_id: &str,
+        close_indices: &[usize],
+    ) -> Result<(), String> {
+        // Closing one workspace does not trust saved group identity and must
+        // remain possible even when that checkout's metadata is unavailable.
+        if close_indices.len() >= 2 {
+            for &ws_idx in close_indices {
+                self.require_restored_worktree_ready(ws_idx)
+                    .map_err(|err| encode_error(request_id.to_owned(), err.code, err.message))?;
+            }
+        }
+        Ok(())
+    }
+
     fn ensure_source_parent_membership(
         &mut self,
         source: &mut WorktreeSource,
@@ -485,7 +518,7 @@ impl App {
         });
     }
 
-    fn emit_workspace_updated(&mut self, ws_idx: usize) {
+    pub(super) fn emit_workspace_updated(&mut self, ws_idx: usize) {
         self.emit_event(EventEnvelope {
             event: EventKind::WorkspaceUpdated,
             data: EventData::WorkspaceUpdated {
```

**File**: `src/app/api/worktrees/deferred.rs` (modified, +4/-0)
```diff
@@ -235,6 +235,10 @@ impl App {
             );
             return;
         };
+        if let Err(err) = self.require_restored_worktree_ready(ws_idx) {
+            Self::send_api_response(respond_to, encode_error(id, err.code, err.message));
+            return;
+        }
         let Some(space) = self
             .state
             .workspaces
```

**File**: `src/app/api/worktrees/reads.rs` (modified, +1/-0)
```diff
@@ -121,6 +121,7 @@ impl App {
                 })?
         };
         let ws = &self.state.workspaces[ws_idx];
+        self.require_restored_worktree_ready(ws_idx)?;
         Ok(SourceInput {
             workspace_id: Some(ws.id.clone()),
             membership: ws.worktree_space().cloned(),
```

---

### Incident Patch 6: `040d345d` (2026-10-05)
**Commit Message**: fix(input): leave navigate mode on ctrl+[ (#2340)

refs #1431

**File**: `src/client/shell/input.rs` (modified, +28/-3)
```diff
@@ -10,6 +10,19 @@ fn is_retained_selection_copy_key(key: &crate::input::TerminalKey) -> bool {
         && matches!(key.modifiers, KeyModifiers::CONTROL | KeyModifiers::SUPER)
 }
 
+/// True for Ctrl+[, the terminal-level equivalent of Esc.
+///
+/// A legacy terminal sends Ctrl+[ as 0x1b, the same byte as Esc, so it already
+/// arrives as `KeyCode::Esc`. Under the kitty keyboard protocol the modified key
+/// is reported on its own and reaches navigate mode as `Char('[')` with CONTROL.
+/// Ctrl+Shift+[ stays distinct because it carries SHIFT.
+///
+/// Navigate mode checks this only after keybinding dispatch, so a configured
+/// Ctrl+[ binding keeps working and this stays a fallback cancel.
+fn is_ctrl_bracket_key(key: &crate::input::TerminalKey) -> bool {
+    key.code == KeyCode::Char('[') && key.modifiers == KeyModifiers::CONTROL
+}
+
 pub(super) fn is_modal_paste_shortcut_for_platform(
     key: &crate::input::TerminalKey,
     macos: bool,
@@ -650,9 +663,7 @@ impl ClientShellState {
 
         self.pending_workspace_highlight = None;
         if key.code == KeyCode::Esc || self.config.keybinds.matches_prefix(key) {
-            self.mode = self.copy_or_terminal_mode();
-            self.navigate_workspace_id = None;
-            outcome.repaint = true;
+            self.cancel_navigate(outcome);
             return;
         }
 
@@ -687,6 +698,12 @@ impl ClientShellState {
             return;
         }
         if self.workspace_preview_action_blocked() {
+            // Bindings cannot run against a foreign preview, so Ctrl+[ has
+            // nothing to lose to and cancels here the same way Esc does.
+            if is_ctrl_bracket_key(key) {
+                self.cancel_navigate(outcome);
+                return;
+            }
             self.push_endpoint_notice(
                 ClientEndpointNoticeKind::Rejected,
                 "navigate_endpoint_inactive",
@@ -816,9 +833,17 @@ impl ClientShellState {
         });
         if let Some(binding) = binding {
             self.record_navigate_binding(binding, false, outcome);
+        } else if is_ctrl_bracket_key(key) {
+            self.cancel_navigate(outcome);
         }
     }
 
+    fn cancel_navigate(&mut self, outcome: &mut ClientShellInput) {
+        self.mode = self.copy_or_terminal_mode();
+        self.navigate_workspace_id = None;
+        outcome.repaint = true;
+    }
+
     fn record_navigate_binding(
         &mut self,
         binding: crate::input::KeybindMatch,
```

**File**: `src/client/shell/tests/workspace_navigation.rs` (modified, +58/-0)
```diff
@@ -968,3 +968,61 @@ fn navigation_highlight_ends_for_noop_focus_and_focused_creation() {
         }
     }
 }
+
+// Kitty keyboard protocol (CSI u) encodings of `[` (codepoint 91).
+const KITTY_CTRL_BRACKET: &[u8] = b"\x1b[91;5u";
+const KITTY_CTRL_SHIFT_BRACKET: &[u8] = b"\x1b[91;6u";
+
+#[test]
+fn kitty_ctrl_bracket_leaves_navigation_like_esc() {
+    let mut state = local_navigation_state(false);
+    enter_navigation(&mut state);
+    preview_key(&mut state, b"\x1b[B");
+
+    preview_key(&mut state, KITTY_CTRL_BRACKET);
+
+    assert_eq!(state.mode, ClientShellMode::Terminal);
+    assert!(state.navigate_workspace_id.is_none());
+}
+
+#[test]
+fn configured_ctrl_bracket_navigate_binding_wins_over_cancel() {
+    let config: Config = toml::from_str("[keys]\nnavigate_workspace_down = \"ctrl+[\"\n").unwrap();
+    let mut state = ClientShellState::new(ClientShellConfig::from_config(&config));
+    state.set_snapshot(Box::new(workspaces(3)));
+    state.set_pane_surface(surface());
+    state.compose(100, 28).unwrap();
+    enter_navigation(&mut state);
+    assert_selected(&state, &ClientEndpointId::Local, "ws_1");
+
+    preview_key(&mut state, KITTY_CTRL_BRACKET);
+
+    assert_eq!(state.mode, ClientShellMode::Navigate);
+    assert_selected(&state, &ClientEndpointId::Local, "ws_2");
+}
+
+#[test]
+fn kitty_ctrl_shift_bracket_keeps_navigation_open() {
+    let mut state = local_navigation_state(false);
+    enter_navigation(&mut state);
+
+    state.handle_input_bytes(KITTY_CTRL_SHIFT_BRACKET);
+
+    assert_eq!(state.mode, ClientShellMode::Navigate);
+    assert_selected(&state, &ClientEndpointId::Local, "ws_1");
+}
+
+#[test]
+fn kitty_ctrl_bracket_cancels_a_blocked_foreign_preview() {
+    let (mut state, remote) = state_with_remote();
+    state.compose(100, 28).unwrap();
+    enter_navigation(&mut state);
+    preview_key(&mut state, b"\x1b[B");
+    assert_selected(&state, &remote, "ws_1");
+    assert!(state.workspace_preview_action_blocked());
+
+    preview_key(&mut state, KITTY_CTRL_BRACKET);
+
+    assert_ne!(state.mode, ClientShellMode::Navigate);
+    assert!(state.navigate_workspace_id.is_none());
+}
```

---

### Incident Patch 7: `49848eff` (2026-10-05)
**Commit Message**: fix: require opt-in for cross-elevation Windows access (#4779)

refs #4717

**File**: `docs/next/website/src/content/docs/windows-beta.mdx` (modified, +12/-1)
```diff
@@ -49,7 +49,18 @@ For internal testing, `HERDR_MANIFEST_URL` can point the installer at a custom m
 
 Local persistent sessions continue running after the client detaches or its terminal window closes. Servers and pane processes launched through Windows OpenSSH also survive logout; run `herdr` again to reconnect.
 
-The same Windows account can attach to a session from ordinary and administrator terminals, including sessions started through SSH. The server's privileges stay as they were at startup: attaching from an ordinary terminal to an elevated server still controls administrator panes, and attaching from an administrator terminal does not elevate an ordinary server. This deliberately trusts ordinary local processes belonging to that account to control its elevated Herdr sessions; other accounts are excluded. Older elevated servers need to be stopped from an administrator terminal and restarted with the updated build before ordinary clients can attach; stopping closes their panes.
+Elevated Windows servers require an administrator client by default, including servers started through an elevated SSH login. Ordinary servers accept clients from ordinary and administrator terminals belonging to the same account; attaching never changes the server's privileges.
+
+To deliberately share elevated sessions with ordinary clients, set:
+
+```toml
+[server]
+allow_unelevated_clients = true
+```
+
+This Windows-only setting is off by default and applies when a new server starts, including automatic startup. Reloading config does not change a running server's access policy. You can instead enable sharing for one server process from an administrator terminal with `herdr server --allow-unelevated-clients` (or `herdr --session <name> server --allow-unelevated-clients` for a named session). The flag enables sharing even when the config setting is false.
+
+Either option allows ordinary local processes belonging to that account to control administrator panes; other accounts remain excluded. The flag must be supplied again after a restart unless sharing is enabled in config. Existing servers retain their previous access policy until stopped and restarted with the updated build; stopping closes their panes. Config and recovery files retain their account-based permissions.
 
 Windows agent process detection scans descendants of the pane shell and recognizes direct agents plus common command wrappers, including npm/Node and Git Bash process chains. It follows Git Bash-launched agents across emulated `exec` boundaries, but it is not the same as Unix foreground process-group detection.
 
```

**File**: `docs/next/website/src/data/config-reference.json` (modified, +6/-0)
```diff
@@ -16,6 +16,12 @@
       "id": "server",
       "title": "Server",
       "keys": [
+        {
+          "key": "server.allow_unelevated_clients",
+          "type": "boolean",
+          "default": "false",
+          "description": "Windows only: allow ordinary clients from the same account to control an elevated server and its administrator panes. Applies at server startup and requires a restart; config reload does not change access. The --allow-unelevated-clients startup flag enables sharing even when this setting is false."
+        },
         {
           "key": "server.headless_cols",
           "type": "integer",
```

**File**: `src/cli/server.rs` (modified, +7/-0)
```diff
@@ -1,6 +1,11 @@
 use crate::api::schema::{EmptyParams, Method, Request, ServerLiveHandoffParams};
 
 pub(super) fn run_server_command(args: &[String]) -> std::io::Result<Option<i32>> {
+    #[cfg(windows)]
+    if args == ["--allow-unelevated-clients"] {
+        crate::platform::allow_unelevated_clients();
+        return Ok(None);
+    }
     let Some(subcommand) = args.first().map(|arg| arg.as_str()) else {
         return Ok(None);
     };
@@ -259,6 +264,8 @@ fn parse_live_handoff_params(args: &[String]) -> Option<ServerLiveHandoffParams>
 fn print_server_help() {
     eprintln!("herdr server commands:");
     eprintln!("  herdr server                run as headless server");
+    #[cfg(windows)]
+    eprintln!("  herdr server --allow-unelevated-clients  allow ordinary same-account clients to control an elevated server");
     eprintln!("  herdr server stop           stop the running server via the API socket");
     eprintln!("  herdr server live-handoff   hand off live panes to a new local server");
     eprintln!("  herdr server reload-config  reload config.toml in the running server");
```

**File**: `src/cli/spec.rs` (modified, +8/-2)
```diff
@@ -157,7 +157,7 @@ fn channel_command() -> Command {
 }
 
 fn server_command() -> Command {
-    Command::new("server")
+    let command = Command::new("server")
         .about("Run or control the headless server")
         .subcommand(Command::new("stop").about("Stop the running server"))
         .subcommand(Command::new("reload-config").about("Reload config in the running server"))
@@ -174,7 +174,13 @@ fn server_command() -> Command {
         .subcommand(
             Command::new("reload-agent-manifests")
                 .about("Reload local agent detection manifest overrides"),
-        )
+        );
+    #[cfg(windows)]
+    let command = command.arg(
+        flag("allow-unelevated-clients")
+            .help("Allow ordinary same-account clients to control this elevated server"),
+    );
+    command
 }
 
 fn api_command() -> Command {
```

**File**: `src/config/model.rs` (modified, +5/-0)
```diff
@@ -1039,6 +1039,9 @@ impl ImeCursorShape {
 #[derive(Debug, Deserialize)]
 #[serde(default)]
 pub struct ServerConfig {
+    /// Windows: allow ordinary same-account clients to control an elevated server. Default: false.
+    #[cfg(windows)]
+    pub allow_unelevated_clients: bool,
     /// Virtual terminal width used when no client is attached. Default: 120.
     pub headless_cols: u16,
     /// Virtual terminal height used when no client is attached. Default: 40.
@@ -1311,6 +1314,8 @@ impl<'de> Deserialize<'de> for ToastConfig {
 impl Default for ServerConfig {
     fn default() -> Self {
         Self {
+            #[cfg(windows)]
+            allow_unelevated_clients: false,
             headless_cols: crate::config::DEFAULT_HEADLESS_COLS,
             headless_rows: crate::config::DEFAULT_HEADLESS_ROWS,
         }
```

**File**: `src/main.rs` (modified, +3/-0)
```diff
@@ -223,6 +223,9 @@ const DEFAULT_CONFIG: &str = r##"# herdr configuration
 # Size of the virtual terminal used when no client is attached.
 # Attached clients always use their own terminal size.
 [server]
+# Windows only: allow ordinary same-account clients to control an elevated server.
+# Requires a server restart.
+# allow_unelevated_clients = false
 # headless_cols = 120
 # headless_rows = 40
 
```

**File**: `src/platform/windows.rs` (modified, +49/-8)
```diff
@@ -21,6 +21,12 @@ pub(crate) use notifications::{
     show_actionable_desktop_notification, show_desktop_notification,
 };
 
+static ALLOW_UNELEVATED_CLIENTS: OnceLock<bool> = OnceLock::new();
+
+pub(crate) fn allow_unelevated_clients() {
+    let _ = ALLOW_UNELEVATED_CLIENTS.set(true);
+}
+
 pub(crate) fn probe_local_server(path: &std::path::Path) -> std::io::Result<()> {
     use interprocess::os::windows::named_pipe::{pipe_mode::Bytes, DuplexPipeStream};
     use interprocess::ConnectWaitMode;
@@ -38,11 +44,44 @@ pub(crate) fn probe_local_server(path: &std::path::Path) -> std::io::Result<()>
 
 pub(crate) fn local_server_security_descriptor(
 ) -> std::io::Result<interprocess::os::windows::security_descriptor::SecurityDescriptor> {
-    user_security_descriptor("GRGW")
+    use windows_sys::Win32::Security::{
+        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
+    };
+    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
+
+    let mut token = null_mut();
+    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
+        return Err(std::io::Error::last_os_error());
+    }
+    let token = unsafe { OwnedHandle::from_raw_handle(token) };
+    let mut elevation = TOKEN_ELEVATION::default();
+    let mut needed = 0;
+    if unsafe {
+        GetTokenInformation(
+            token.as_raw_handle(),
+            TokenElevation,
+            (&mut elevation as *mut TOKEN_ELEVATION).cast(),
+            size_of::<TOKEN_ELEVATION>() as u32,
+            &mut needed,
+        )
+    } == 0
+    {
+        return Err(std::io::Error::last_os_error());
+    }
+    let allow_unelevated = ALLOW_UNELEVATED_CLIENTS.get().copied().unwrap_or(false);
+    let integrity = if elevation.TokenIsElevated != 0 && !allow_unelevated {
+        "HI"
+    } else {
+        "ME"
+    };
+    // The account DACL alone cannot distinguish ordinary and elevated clients.
+    // The integrity label blocks both reading and writing from lower levels.
+    user_security_descriptor("GRGW", &format!("S:(ML;;NRNW;;;{integrity})"))
 }
 
 fn user_security_descriptor(
     access: &str,
+    integrity_label: &str,
 ) -> std::io::Result<interprocess::os::windows::security_descriptor::SecurityDescriptor> {
     use interprocess::os::windows::security_descriptor::SecurityDescriptor;
     use widestring::{U16CStr, U16CString};
@@ -84,10 +123,11 @@ fn user_security_descriptor(
     }
     let sid_text = unsafe { U16CStr::from_ptr_str(sid) }.to_string_lossy();
     unsafe { LocalFree(sid.cast()) };
-    // The elevated token's default owner can be Administrators. Authorize the
-    // account instead: its ordinary clients deliberately control elevated panes.
-    let sddl = U16CString::from_str(format!("D:P(A;;GA;;;SY)(A;;{access};;;{sid_text})"))
-        .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidInput, err))?;
+    // Use the account SID rather than the elevated token's Administrators owner.
+    let sddl = U16CString::from_str(format!(
+        "D:P(A;;GA;;;SY)(A;;{access};;;{sid_text}){integrity_label}"
+    ))
+    .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidInput, err))?;
     SecurityDescriptor::deserialize(&sddl)
 }
 
@@ -98,8 +138,9 @@ pub(crate) fn local_server_connection_error(error: std::io::Error) -> std::io::E
     std::io::Error::new(
         error.kind(),
         format!(
-            "For an older elevated server, stop it in an admin shell and \
-             reopen Herdr (closes panes). {error}"
+            "For an elevated server, use an administrator terminal. Sharing with ordinary \
+             clients requires stopping it there and restarting its `herdr server` command \
+             with --allow-unelevated-clients (closes panes). {error}"
         ),
     )
 }
@@ -273,7 +314,7 @@ pub(crate) fn create_config_temporary(
             FILE_SHARE_WRITE,
         },
     };
-    let descriptor = user_security_descriptor("GA")?;
+    let descriptor = user_security_descriptor("GA", "")?;
     let mut attributes = SECURITY_ATTRIBUTES {
         nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
         lpSecurityDescriptor: null_mut(),
```

**File**: `src/server/headless/bootstrap.rs` (modified, +4/-0)
```diff
@@ -27,6 +27,10 @@ pub fn run_server() -> io::Result<()> {
     }
 
     let loaded_config = config::Config::load();
+    #[cfg(windows)]
+    if loaded_config.config.server.allow_unelevated_clients {
+        crate::platform::allow_unelevated_clients();
+    }
     let (api_tx, api_rx) = tokio::sync::mpsc::unbounded_channel();
     let event_hub = api::EventHub::default();
     let should_quit = Arc::new(AtomicBool::new(false));
```

---

### Incident Patch 8: `b51c6abe` (2026-10-05)
**Commit Message**: fix: retain remote sidebar preferences across attaches (#4536)

* fix: retain remote sidebar preferences across attaches

refs #4364

* test: cover remote preference identity handoff

---------

Co-authored-by: JJ Liebig <[REDACTED_EMAIL]>

**File**: `docs/next/website/src/content/docs/ja/persistence-remote.mdx` (modified, +2/-0)
```diff
@@ -50,6 +50,8 @@ herdr --remote workbox
 herdr --remote ssh://you@server:2222
 ```
 
+サイドバーの幅、セクションの分割位置、折りたたんだグループ、エージェントの並び順は、接続先とセッションごとにローカルへ保存されます。同じ接続先とセッションに再接続すると復元されます。SSH エイリアスやセッションが異なる場合は別の設定になります。
+
 このモードでは、リモートサーバーがペインを動かし、ターミナル内容とセッション状態を SSH 越しに送信します。ローカルの Herdr がサイドバー、メニュー、テーマを含む UI を描画します。クライアントがローカルで動くため、Herdr は画像クリップボードの貼り付けのようなローカルデスクトップ機能をリモートセッションにブリッジできます。画像をリモートの一時ファイルにコピーし、そのパスを貼り付けます。
 
 デフォルトでは、`herdr --remote` はそのアタッチにローカルの Herdr キーバインドを使います。リモートサーバーの設定が異なっていても、ローカルの操作感覚を維持できます。ローカルキーバインドを編集したら、UI の `reload config` でデタッチせずに反映できます。リモートサーバーの設定を使いたい場合は `--remote-keybindings server` を使います。ローカルのカスタムコマンドキーバインドは送信されません。それらのコマンドはリモートホスト上で実行されてしまうからです。
```

**File**: `docs/next/website/src/content/docs/persistence-remote.mdx` (modified, +2/-0)
```diff
@@ -50,6 +50,8 @@ herdr --remote workbox
 herdr --remote ssh://you@server:2222
 ```
 
+Sidebar width, section split, collapsed groups, and agent sorting are saved locally for each remote target and session. Reattaching to the same target and session restores these preferences. Different SSH aliases or sessions have separate preferences.
+
 In this mode, the remote server owns the running panes and sends their terminal content and session state over SSH. Your local Herdr draws the UI, including its sidebar, menus, and theme. Because the client runs locally, Herdr can bridge local desktop features such as image clipboard paste into the remote session by copying the image to a remote temp file and pasting that path.
 
 By default, `herdr --remote` uses your local Herdr keybindings for that attach. This keeps local muscle memory even when the remote server has different config. After editing local keybindings, use the UI's `reload config` action to apply them without detaching. Use `--remote-keybindings server` when you want the remote server config instead. Local custom command keybindings are not sent, because those commands would run on the remote host.
```

**File**: `docs/next/website/src/content/docs/zh-cn/persistence-remote.mdx` (modified, +2/-0)
```diff
@@ -50,6 +50,8 @@ herdr --remote workbox
 herdr --remote ssh://you@server:2222
 ```
 
+侧栏宽度、分区比例、折叠分组和代理排序会按远程目标与会话保存在本地。重新连接同一目标和会话时会恢复这些偏好；不同 SSH 别名或会话的偏好相互独立。
+
 这种模式下，远程服务器保持窗格运行，并通过 SSH 发送终端内容和会话状态。本地 Herdr 负责绘制 UI，包括侧边栏、菜单和主题。因为客户端在本地运行,Herdr 可以把图像剪贴板粘贴等本地桌面功能桥接到远程会话: 把图像复制到远程临时文件,再粘贴该路径。
 
 默认情况下,`herdr --remote` 在这次连接中使用你本地的 Herdr 按键绑定。即使远程服务器的配置不同,也能保持本地的肌肉记忆。编辑本地按键绑定后，可通过 UI 中的 `reload config` 应用更改，无需分离重连。想改用远程服务器配置时,使用 `--remote-keybindings server`。本地的自定义命令按键绑定不会被发送,因为那些命令会在远程主机上执行。
```

**File**: `src/client/mod.rs` (modified, +1/-1)
```diff
@@ -182,7 +182,7 @@ fn run_client_with_mode(
             .with_startup_config_diagnostic(startup_config_diagnostic)
             .with_startup_onboarding(loaded_config.config.should_show_onboarding())
             .with_keybinding_source(keybinding_source)
-            .with_local_endpoint(&socket_path)
+            .with_process_endpoint_preferences(&socket_path)
     });
     let mouse_capture = loaded_config.config.ui.mouse_capture;
     let mouse_scroll_lines = loaded_config.config.ui.mouse_scroll_lines();
```

**File**: `src/client/shell/config.rs` (modified, +25/-0)
```diff
@@ -194,6 +194,31 @@ impl ClientShellConfig {
         self.with_preferences_path(preferences::path_for_local_endpoint(socket_path))
     }
 
+    pub(crate) fn with_process_endpoint_preferences(self, socket_path: &std::path::Path) -> Self {
+        self.with_endpoint_preferences(
+            socket_path,
+            std::env::var(crate::remote::REMOTE_PREFERENCES_ENV_VAR)
+                .ok()
+                .as_deref(),
+        )
+    }
+
+    pub(crate) fn with_endpoint_preferences(
+        self,
+        socket_path: &std::path::Path,
+        remote_identity: Option<&str>,
+    ) -> Self {
+        let identity = remote_identity
+            .and_then(|value| serde_json::from_str::<(String, String)>(value).ok())
+            .filter(|(target, session)| !target.is_empty() && !session.is_empty());
+        match identity {
+            Some((target, session)) => {
+                self.with_preferences_path(preferences::path_for_remote_endpoint(&target, &session))
+            }
+            None => self.with_local_endpoint(socket_path),
+        }
+    }
+
     pub(super) fn with_preferences_path(mut self, path: std::path::PathBuf) -> Self {
         self.preferences = preferences::load(&path).unwrap_or_default();
         self.preferences_path = Some(path);
```

**File**: `src/client/shell/preferences.rs` (modified, +30/-0)
```diff
@@ -41,6 +41,20 @@ pub(super) fn path_for_local_endpoint(socket_path: &Path) -> PathBuf {
         .join(format!("local-{hash:016x}.json"))
 }
 
+/// SSH preferences belong to the target/session, not its per-process bridge socket.
+pub(super) fn path_for_remote_endpoint(target: &str, session: &str) -> PathBuf {
+    use sha2::{Digest as _, Sha256};
+
+    let mut hash = Sha256::new();
+    for part in [target, session] {
+        hash.update((part.len() as u64).to_le_bytes());
+        hash.update(part.as_bytes());
+    }
+    crate::config::state_dir()
+        .join("client-shell")
+        .join(format!("remote-{:x}.json", hash.finalize()))
+}
+
 pub(super) fn load(path: &Path) -> Option<ClientChromePreferences> {
     let content = std::fs::read_to_string(path).ok()?;
     serde_json::from_str(&content).ok()
@@ -82,6 +96,22 @@ mod tests {
         assert_ne!(first, second);
     }
 
+    #[test]
+    fn remote_preferences_distinguish_targets_sessions_and_component_boundaries() {
+        let original = path_for_remote_endpoint("dev@build", "agents");
+        assert_eq!(original, path_for_remote_endpoint("dev@build", "agents"));
+        assert_ne!(original, path_for_remote_endpoint("other@build", "agents"));
+        assert_ne!(original, path_for_remote_endpoint("dev@build", "other"));
+        assert_ne!(
+            path_for_remote_endpoint("ab", "c"),
+            path_for_remote_endpoint("a", "bc")
+        );
+        assert_ne!(
+            original,
+            path_for_local_endpoint(Path::new("dev@build/agents"))
+        );
+    }
+
     #[test]
     fn legacy_preferences_default_remote_collapses() {
         let preferences: ClientChromePreferences =
```

**File**: `src/client/shell/tests/keybindings_settings.rs` (modified, +77/-0)
```diff
@@ -44,6 +44,83 @@ fn shell_new_controls_use_the_same_client_action_routes_as_keybinds() {
     ));
 }
 
+#[test]
+fn remote_client_preferences_keep_the_same_identity_across_bridge_processes() {
+    let first = ClientShellConfig::from_config(&Config::default()).with_endpoint_preferences(
+        std::path::Path::new("/tmp/herdr-remote-100-dev-agents.sock"),
+        Some(r#"["dev", "agents"]"#),
+    );
+    let next = ClientShellConfig::from_config(&Config::default()).with_endpoint_preferences(
+        std::path::Path::new("/tmp/herdr-remote-200-dev-agents.sock"),
+        Some(r#"["dev", "agents"]"#),
+    );
+    assert_eq!(first.preferences_path, next.preferences_path);
+    let root =
+        std::env::temp_dir().join(format!("herdr-remote-preferences-{}", std::process::id()));
+    let first_path = root.join(
+        first
+            .preferences_path
+            .as_ref()
+            .unwrap()
+            .file_name()
+            .unwrap(),
+    );
+    let next_path = root.join(next.preferences_path.as_ref().unwrap().file_name().unwrap());
+    let mut state = ClientShellState::new(first.with_preferences_path(first_path));
+    state.sidebar_width = 31;
+    state.sidebar_width_manual = true;
+    state.sidebar_collapsed = true;
+    state.sidebar_collapsed_manual = true;
+    state.persist_chrome_preferences(&mut ClientShellInput::default());
+    let restored = ClientShellState::new(next.with_preferences_path(next_path));
+    assert_eq!(restored.sidebar_width, 31);
+    assert!(restored.sidebar_collapsed);
+    std::fs::remove_dir_all(root).unwrap();
+
+    let local_socket = std::path::Path::new("/tmp/local.sock");
+    for identity in [
+        None,
+        Some("invalid"),
+        Some(r#"["dev", ""]"#),
+        Some(r#"["", "agents"]"#),
+    ] {
+        let config = ClientShellConfig::from_config(&Config::default())
+            .with_endpoint_preferences(local_socket, identity);
+        assert_eq!(
+            config.preferences_path,
+            Some(super::super::preferences::path_for_local_endpoint(
+                local_socket
+            ))
+        );
+    }
+}
+
+#[test]
+fn remote_client_preferences_process_child() {
+    if std::env::var("HERDR_TEST_PREFERENCES_CHILD").as_deref() != Ok("1") {
+        return;
+    }
+    let expected_path = super::super::preferences::path_for_remote_endpoint("dev", "agents");
+    if !expected_path.exists() {
+        super::super::preferences::store(
+            expected_path.as_path(),
+            super::super::preferences::ClientChromePreferences {
+                sidebar_width: Some(31),
+                sidebar_collapsed: Some(true),
+                ..Default::default()
+            },
+        )
+        .unwrap();
+    }
+    let socket = crate::server::socket_paths::client_socket_path();
+    let config = ClientShellConfig::from_config(&Config::default())
+        .with_process_endpoint_preferences(&socket);
+    assert_eq!(config.preferences_path, Some(expected_path));
+    let restored = ClientShellState::new(config);
+    assert_eq!(restored.sidebar_width, 31);
+    assert!(restored.sidebar_collapsed);
+}
+
 #[test]
 fn manual_client_chrome_preferences_round_trip_per_endpoint() {
     let path = std::env::temp_dir().join(format!(
```

**File**: `src/remote/args.rs` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+pub(crate) const REMOTE_PREFERENCES_ENV_VAR: &str = "HERDR_REMOTE_PREFERENCES_IDENTITY";
 pub(crate) const REATTACH_COMMAND_ENV_VAR: &str = "HERDR_REATTACH_COMMAND";
 pub(crate) const REMOTE_KEYBINDINGS_ENV_VAR: &str = "HERDR_REMOTE_KEYBINDINGS";
 
```

---

### Incident Patch 9: `2923ce87` (2026-10-05)
**Commit Message**: fix: keep sidebar collapse clickable with agent scrollbars (#4734)

* fix: keep sidebar collapse clickable with agent scrollbars

refs #4692

* docs: document sidebar mouse handling and regression coverage

refs #4692

**File**: `src/client/shell/mouse.rs` (modified, +15/-12)
```diff
@@ -676,6 +676,10 @@ impl ClientShellState {
         }
     }
 
+    /// Routes mouse input through overlays, shell controls, and pane interactions.
+    ///
+    /// Hit-test order determines which overlapping control receives the event;
+    /// the sidebar toggle takes precedence over the agent scrollbar beneath it.
     pub(super) fn handle_mouse(&mut self, mouse: MouseEvent, outcome: &mut ClientShellInput) {
         self.update_link_hover(mouse, outcome);
         let point = (mouse.column, mouse.row);
@@ -1935,9 +1939,17 @@ impl ClientShellState {
                 self.workspace_press = None;
                 self.tab_press = None;
                 self.chrome_drag = None;
-                if super::contains(self.hits.sidebar_divider, point)
-                    && !super::contains(self.hits.sidebar_toggle, point)
-                {
+                // The toggle is painted over the agent scrollbar's last cell.
+                if super::contains(self.hits.sidebar_toggle, point) {
+                    self.sidebar_collapsed = !self.sidebar_collapsed;
+                    self.sidebar_collapsed_manual = true;
+                    self.invalidate_pane_surface();
+                    outcome.repaint = true;
+                    outcome.resize = true;
+                    self.persist_chrome_preferences(outcome);
+                    return;
+                }
+                if super::contains(self.hits.sidebar_divider, point) {
                     let now = std::time::Instant::now();
                     let double_click = self.last_sidebar_divider_click.is_some_and(|last| {
                         now.duration_since(last) <= std::time::Duration::from_millis(350)
@@ -2075,15 +2087,6 @@ impl ClientShellState {
                     outcome.repaint = true;
                     return;
                 }
-                if super::contains(self.hits.sidebar_toggle, point) {
-                    self.sidebar_collapsed = !self.sidebar_collapsed;
-                    self.sidebar_collapsed_manual = true;
-                    self.invalidate_pane_surface();
-                    outcome.repaint = true;
-                    outcome.resize = true;
-                    self.persist_chrome_preferences(outcome);
-                    return;
-                }
                 let group_toggle = self.hits.workspaces.iter().find_map(|hit| {
                     let (rect, key) = hit.group_toggle.as_ref()?;
                     super::contains(*rect, point).then(|| (hit.endpoint_id.clone(), key.clone()))
```

**File**: `src/client/shell/tests/endpoints.rs` (modified, +48/-0)
```diff
@@ -247,6 +247,54 @@ fn state_with_scrollable_agents() -> (ClientShellState, ClientEndpointId) {
     (state, remote)
 }
 
+/// Checks that the visible toggle wins overlapping scrollbar clicks and can reopen
+/// the sidebar, for both endpoint layouts and both ends of the overflowing list.
+#[test]
+fn sidebar_toggle_remains_clickable_with_overflowing_agents() {
+    for saved_machine in [false, true] {
+        for scroll_to_bottom in [false, true] {
+            let (mut state, _) = state_with_scrollable_agents();
+            if !saved_machine {
+                state.set_endpoint_catalog(&[]);
+            }
+            state.agent_scroll = if scroll_to_bottom { usize::MAX } else { 0 };
+            let frame = state.compose(100, 28).expect("overflowing agent panel");
+            assert!(!state.hits.agent_scrollbar.is_empty());
+            let scroll = state.agent_scroll;
+
+            let toggle = state.hits.sidebar_toggle;
+            let buffer = frame.to_ratatui_buffer().expect("sidebar buffer");
+            assert_eq!(buffer[(toggle.x, toggle.y)].symbol(), "«");
+            let outcome = state.handle_raw_events(vec![RawInputEvent::Mouse(MouseEvent {
+                kind: MouseEventKind::Down(MouseButton::Left),
+                column: toggle.x,
+                row: toggle.y,
+                modifiers: KeyModifiers::NONE,
+            })]);
+            assert!(
+                state.sidebar_collapsed,
+                "collapse with saved_machine={saved_machine}, scroll_to_bottom={scroll_to_bottom}"
+            );
+            assert!(state.sidebar_collapsed_manual);
+            assert!(outcome.repaint && outcome.resize);
+            assert_eq!(state.agent_scroll, scroll);
+            assert!(state.chrome_drag.is_none());
+
+            state.compose(100, 28).expect("collapsed sidebar");
+            let toggle = state.hits.sidebar_toggle;
+            let outcome = state.handle_raw_events(vec![RawInputEvent::Mouse(MouseEvent {
+                kind: MouseEventKind::Down(MouseButton::Left),
+                column: toggle.x,
+                row: toggle.y,
+                modifiers: KeyModifiers::NONE,
+            })]);
+            assert!(!state.sidebar_collapsed);
+            assert!(outcome.repaint && outcome.resize);
+            assert!(state.chrome_drag.is_none());
+        }
+    }
+}
+
 #[test]
 fn agent_navigation_reveals_offscreen_targets() {
     use crate::input::KeybindAction;
```

---

### Incident Patch 10: `e35f3937` (2026-10-04)
**Commit Message**: fix: recognize Hermes launched through its Python wrapper (#4911)

refs #4910

Co-authored-by: akbash-bot <[REDACTED_EMAIL]>
Co-authored-by: JJ Liebig <[REDACTED_EMAIL]>

**File**: `src/detect/mod.rs` (modified, +158/-1)
```diff
@@ -420,7 +420,8 @@ fn wrapped_agent_name_from_runtime_argv(runtime: &str, argv: Option<&[String]>)
         "node" => cursor_agent_name_from_bundled_node_argv(argv)
             .or_else(|| script_arg_agent_name(argv, &["-e", "--eval", "-p", "--print"], &[])),
         "bun" => script_arg_agent_name(argv, &["-e", "--eval", "-p", "--print"], &[]),
-        name if is_python_runtime(name) => script_arg_agent_name(argv, &["-c"], &["-m"]),
+        name if is_python_runtime(name) => hermes_installer_agent_name(argv)
+            .or_else(|| script_arg_agent_name(argv, &["-c"], &["-m"])),
         "sh" | "bash" | "zsh" | "fish" => script_arg_agent_name(argv, &["-c"], &[]),
         "cmd" => windows_cmd_arg_agent_name(argv),
         "powershell" | "pwsh" => powershell_arg_agent_name(argv),
@@ -429,6 +430,61 @@ fn wrapped_agent_name_from_runtime_argv(runtime: &str, argv: Option<&[String]>)
     }
 }
 
+fn hermes_installer_agent_name(argv: &[String]) -> Option<String> {
+    let [_, isolation, command, code, args @ ..] = argv else {
+        return None;
+    };
+    if isolation != "-I"
+        || command != "-c"
+        || args
+            .first()
+            .is_some_and(|arg| matches!(arg.as_str(), "--run-module" | "--print-runtime-command"))
+    {
+        return None;
+    }
+
+    // Recognize the captured installer bootstrap, not arbitrary Python source.
+    // Both root literals must agree; reject escapes or quotes rather than parse Python.
+    let rest = code.strip_prefix(HERMES_INSTALLER_PREFIX)?;
+    let (root, rest) = rest.split_once("')\n")?;
+    if root.is_empty() || root.contains(['\'', '\\', '\n', '\r']) {
+        return None;
+    }
+    let rest = rest
+        .strip_prefix(HERMES_INSTALLER_MIDDLE)?
+        .strip_prefix(root)?;
+    (rest == HERMES_INSTALLER_SUFFIX).then(|| agent_label(Agent::Hermes).to_string())
+}
+
+// Installer source captured in #4910. Only the installation root varies. Unknown
+// bootstrap revisions deliberately fall back to ordinary process identification.
+const HERMES_INSTALLER_PREFIX: &str = "import os, re, sys
+os.environ.pop('PYTHONHOME', None)
+os.environ.pop('PYTHONPATH', None)
+sys.path.insert(0, '";
+const HERMES_INSTALLER_MIDDLE: &str =
+    "if sys.argv[1:2] == ['--print-runtime-command']: sys.dont_write_bytecode = True
+from hermes_constants import get_default_hermes_root
+os.environ['HERMES_HOME'] = os.environ.get('HERMES_HOME') or str(get_default_hermes_root())
+if sys.argv[1:2] == ['--print-runtime-command']:
+    from pathlib import Path
+    from hermes_cli._launchers import print_runtime_command
+    print_runtime_command(Path('";
+const HERMES_INSTALLER_SUFFIX: &str = r"'), sys.argv[2:])
+    sys.exit(0)
+import hermes_bootstrap
+if sys.argv[1:2] == ['--run-module']:
+    import runpy
+    if len(sys.argv) < 3: sys.exit('hermes: --run-module needs a module')
+    module = sys.argv.pop(2)
+    del sys.argv[1]
+    runpy.run_module(module, run_name='__main__', alter_sys=True)
+    sys.exit(0)
+from hermes_cli.main import main
+sys.argv[0] = re.sub(r'(-script\.pyw|\.exe)?$', '', sys.argv[0])
+sys.exit(main())
+";
+
 fn cursor_agent_name_from_bundled_node_argv(argv: &[String]) -> Option<String> {
     let (runtime_parent, runtime_name) = path_parent_and_basename(argv.first()?)?;
     let (script_parent, script_name) = path_parent_and_basename(argv.get(1)?)?;
@@ -1368,6 +1424,107 @@ mod tests {
         );
     }
 
+    fn hermes_installer_capture() -> crate::platform::ForegroundJob {
+        // Exact reporter capture from #4910; private path components were redacted.
+        let capture: serde_json::Value = serde_json::from_str(include_str!(
+            "../../tests/fixtures/hermes-installer-process-info-4910.json"
+        ))
+        .unwrap();
+        let info = &capture["result"]["process_info"];
+        crate::platform::ForegroundJob {
+            process_group_id: info["foreground_process_group_id"].as_u64().unwrap() as u32,
+            processes: info["foreground_processes"]
+                .as_array()
+                .unwrap()
+                .iter()
+                .map(|process| crate::platform::ForegroundProcess {
+                    pid: process["pid"].as_u64().unwrap() as u32,
+                    name: process["name"].as_str().unwrap().to_string(),
+                    argv0: Some(process["argv0"].as_str().unwrap().to_string()),
+                    argv: Some(serde_json::from_value(process["argv"].clone()).unwrap()),
+                    cmdline: Some(process["cmdline"].as_str().unwrap().to_string()),
+                })
+                .collect(),
+        }
+    }
+
+    #[test]
+    fn identify_agent_in_job_detects_hermes_installer_capture() {
+        let mut job = hermes_installer_capture();
+        assert_eq!(
+            identify_agent_in_job(&job),
+            Some((Agent::Hermes, "hermes".to_string()))
+        );
+        // Pane probing also uses a leader-only fast path.
+        job.processes
+     
```

**File**: `tests/fixtures/hermes-installer-process-info-4910.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"id":"cli:pane:process_info","result":{"process_info":{"foreground_process_group_id":30455,"foreground_processes":[{"argv":["/Users/REDACTED/.hermes/tools/python-3.14.7+20260901-darwin-arm64/bin/python3","-m","tui_gateway.entry"],"argv0":"python3","cmdline":"/Users/REDACTED/.hermes/tools/python-3.14.7+20260901-darwin-arm64/bin/python3 -m tui_gateway.entry","cwd":"/Users/REDACTED/work/repro","name":"python3.14","pid":30781},{"argv":["/Users/REDACTED/.hermes/tools/node-26.7.0-darwin-arm64/bin/node","--expose-gc","/Users/REDACTED/.hermes/hermes-agent/ui-tui/dist/entry.js"],"argv0":"node","cmdline":"/Users/REDACTED/.hermes/tools/node-26.7.0-darwin-arm64/bin/node --expose-gc /Users/REDACTED/.hermes/hermes-agent/ui-tui/dist/entry.js","cwd":"/Users/REDACTED/.hermes/hermes-agent/ui-tui","name":"node","pid":30778},{"argv":["/Users/REDACTED/.hermes/tools/python-3.14.7+20260901-darwin-arm64/bin/python3","-I","-c","import os, re, sys\nos.environ.pop('PYTHONHOME', None)\nos.environ.pop('PYTHONPATH', None)\nsys.path.insert(0, '/Users/REDACTED/.hermes/hermes-agent')\nif sys.argv[1:2] == ['--print-runtime-command']: sys.dont_write_bytecode = True\nfrom hermes_constants import get_default_hermes_root\nos.environ['HERMES_HOME'] = os.environ.get('HERMES_HOME') or str(get_default_hermes_root())\nif sys.argv[1:2] == ['--print-runtime-command']:\n    from pathlib import Path\n    from hermes_cli._launchers import print_runtime_command\n    print_runtime_command(Path('/Users/REDACTED/.hermes/hermes-agent'), sys.argv[2:])\n    sys.exit(0)\nimport hermes_bootstrap\nif sys.argv[1:2] == ['--run-module']:\n    import runpy\n    if len(sys.argv) < 3: sys.exit('hermes: --run-module needs a module')\n    module = sys.argv.pop(2)\n    del sys.argv[1]\n    runpy.run_module(module, run_name='__main__', alter_sys=True)\n    sys.exit(0)\nfrom hermes_cli.main import main\nsys.argv[0] = re.sub(r'(-script\\.pyw|\\.exe)?$', '', sys.argv[0])\nsys.exit(main())\n","--profile","sdlc-planner","--skills","grill-with-docs"],"argv0":"python3","cmdline":"/Users/REDACTED/.hermes/tools/python-3.14.7+20260901-darwin-arm64/bin/python3 -I -c import os, re, sys\nos.environ.pop('PYTHONHOME', None)\nos.environ.pop('PYTHONPATH', None)\nsys.path.insert(0, '/Users/REDACTED/.hermes/hermes-agent')\nif sys.argv[1:2] == ['--print-runtime-command']: sys.dont_write_bytecode = True\nfrom hermes_constants import get_default_hermes_root\nos.environ['HERMES_HOME'] = os.environ.get('HERMES_HOME') or str(get_default_hermes_root())\nif sys.argv[1:2] == ['--print-runtime-command']:\n    from pathlib import Path\n    from hermes_cli._launchers import print_runtime_command\n    print_runtime_command(Path('/Users/REDACTED/.hermes/hermes-agent'), sys.argv[2:])\n    sys.exit(0)\nimport hermes_bootstrap\nif sys.argv[1:2] == ['--run-module']:\n    import runpy\n    if len(sys.argv) < 3: sys.exit('hermes: --run-module needs a module')\n    module = sys.argv.pop(2)\n    del sys.argv[1]\n    runpy.run_module(module, run_name='__main__', alter_sys=True)\n    sys.exit(0)\nfrom hermes_cli.main import main\nsys.argv[0] = re.sub(r'(-script\\.pyw|\\.exe)?$', '', sys.argv[0])\nsys.exit(main())\n --profile sdlc-planner --skills grill-with-docs","cwd":"/Users/REDACTED/work/repro","name":"python3.14","pid":30455}],"pane_id":"w1N:p6","shell_pid":28709},"type":"pane_process_info"}}
```

---

### Incident Patch 11: `5da0a01e` (2026-10-02)
**Commit Message**: fix: hidden pane memory and new pane spawn size (#4873)

* fix: stop hidden panes keeping a full-size screen copy from creation

* fix: start new panes at their laid-out size

refs #4419

**File**: `src/app/api.rs` (modified, +7/-1)
```diff
@@ -566,7 +566,13 @@ impl App {
             .terminal_runtimes
             .get(&terminal_id)
             .map(|runtime| runtime.current_size())
-            .unwrap_or_else(|| self.state.estimate_pane_size());
+            .unwrap_or_else(|| {
+                self.state
+                    .new_pane_size(crate::ui::NewPanePlacement::Existing {
+                        ws_idx,
+                        pane: pane_id,
+                    })
+            });
         let Some(launch_env) = self.pane_launch_env(ws_idx, pane_id, Vec::new()) else {
             return false;
         };
```

**File**: `src/app/api/layouts.rs` (modified, +138/-11)
```diff
@@ -89,7 +89,13 @@ impl App {
         });
         let root_leaf = first_layout_leaf(&params.root);
         let first_cwd = self.layout_root_cwd(ws_idx, replace_target, root_leaf);
-        let (rows, cols) = self.state.estimate_pane_size();
+        let pane_sizes = self
+            .state
+            .new_layout_pane_sizes(&final_tile_layout(&params.root));
+        // Sizes come from the same tree the panes are built from, in pane order.
+        let Some(&(rows, cols)) = pane_sizes.first() else {
+            return encode_error(id, "invalid_layout", "layout has no panes");
+        };
         let default_shell = self.state.default_shell.clone();
         let scrollback_limit_bytes = self.state.pane_scrollback_limit_bytes;
         let host_terminal_theme = self.state.host_terminal_theme;
@@ -145,7 +151,9 @@ impl App {
         }
         self.apply_layout_pane_label(ws_idx, new_root_pane, root_leaf);
 
-        if let Err(message) = self.apply_layout_node_to_pane(ws_idx, new_root_pane, &params.root) {
+        if let Err(message) =
+            self.apply_layout_node_to_pane(ws_idx, new_root_pane, &params.root, &pane_sizes)
+        {
             self.rollback_layout_tab(ws_idx, new_root_pane);
             return encode_error(id, "layout_apply_failed", message);
         }
@@ -362,6 +370,7 @@ impl App {
         ws_idx: usize,
         pane_id: PaneId,
         node: &LayoutNode,
+        pane_sizes: &[(u16, u16)],
     ) -> Result<(), String> {
         match node {
             LayoutNode::Pane { pane } => {
@@ -374,16 +383,21 @@ impl App {
                 first,
                 second,
             } => {
-                let second_leaf = first_layout_leaf(second);
+                let (first_sizes, second_sizes) =
+                    pane_sizes.split_at(layout_leaf_count(first).min(pane_sizes.len()));
+                let Some(&size) = second_sizes.first() else {
+                    return Err("layout pane sizes do not match the layout".into());
+                };
                 let new_pane = self.layout_split_pane(
                     ws_idx,
                     pane_id,
                     direction.clone(),
                     *ratio,
-                    second_leaf,
+                    first_layout_leaf(second),
+                    size,
                 )?;
-                self.apply_layout_node_to_pane(ws_idx, pane_id, first)?;
-                self.apply_layout_node_to_pane(ws_idx, new_pane, second)
+                self.apply_layout_node_to_pane(ws_idx, pane_id, first, first_sizes)?;
+                self.apply_layout_node_to_pane(ws_idx, new_pane, second, second_sizes)
             }
         }
     }
@@ -395,8 +409,9 @@ impl App {
         direction: SplitDirection,
         ratio: f32,
         pane: &LayoutPane,
+        (rows, cols): (u16, u16),
     ) -> Result<PaneId, String> {
-        let (rows, cols) = self.state.estimate_pane_size();
+        let direction = layout_direction(&direction);
         let default_shell = self.state.default_shell.clone();
         let scrollback_limit_bytes = self.state.pane_scrollback_limit_bytes;
         let host_terminal_theme = self.state.host_terminal_theme;
@@ -408,10 +423,6 @@ impl App {
             .or_else(|| self.launch_cwd_for_pane_in_workspace(ws_idx, target_pane_id));
         let extra_env = super::env::normalize_launch_env(pane.env.clone())
             .map_err(|(_, message)| message.to_string())?;
-        let direction = match direction {
-            SplitDirection::Right => Direction::Horizontal,
-            SplitDirection::Down => Direction::Vertical,
-        };
         let command = layout_command(pane)?;
         let result = {
             let Some(ws) = self.state.workspaces.get_mut(ws_idx) else {
@@ -515,6 +526,47 @@ impl App {
     }
 }
 
+fn layout_direction(direction: &SplitDirection) -> Direction {
+    match direction {
+        SplitDirection::Right => Direction::Horizontal,
+        SplitDirection::Down => Direction::Vertical,
+    }
+}
+
+fn layout_leaf_count(node: &LayoutNode) -> usize {
+    match node {
+        LayoutNode::Pane { .. } => 1,
+        LayoutNode::Split { first, second, .. } => {
+            layout_leaf_count(first) + layout_leaf_count(second)
+        }
+    }
+}
+
+/// The tab layout `root` will produce, with placeholder pane ids in pane order.
+fn final_tile_layout(root: &LayoutNode) -> crate::layout::TileLayout {
+    fn build(node: &LayoutNode, next_id: &mut u32) -> Node {
+        match node {
+            LayoutNode::Pane { .. } => {
+                *next_id += 1;
+                Node::Pane(PaneId::from_raw(*next_id))
+            }
+            LayoutNode::Split {
+                direction,
+                ratio,
+                first,
+                second,
+            } => Node::Split {
+                direction: layout_direction(direction),
+                ratio: crate::layout::valid_split_ratio(*ratio),
+                first: Box::new(build(first, n
```

**File**: `src/app/api/panes.rs` (modified, +12/-5)
```diff
@@ -52,7 +52,18 @@ impl App {
             Ok(env) => env,
             Err((code, message)) => return encode_error(id, &code, message),
         };
-        let (rows, cols) = self.state.estimate_pane_size();
+        let direction = match params.direction {
+            crate::api::schema::SplitDirection::Right => ratatui::layout::Direction::Horizontal,
+            crate::api::schema::SplitDirection::Down => ratatui::layout::Direction::Vertical,
+        };
+        let (rows, cols) = self
+            .state
+            .new_pane_size(crate::ui::NewPanePlacement::Split {
+                ws_idx,
+                target: target_pane_id,
+                direction,
+                ratio: params.ratio.unwrap_or(0.5),
+            });
         let split_cwd = params.cwd.map(std::path::PathBuf::from).or_else(|| {
             let follow_cwd = self.launch_cwd_for_pane_in_workspace(ws_idx, target_pane_id);
             Some(self.resolve_new_terminal_cwd(follow_cwd))
@@ -65,10 +76,6 @@ impl App {
         let Some(ws) = self.state.workspaces.get_mut(ws_idx) else {
             return encode_error(id, "pane_not_found", "pane not found");
         };
-        let direction = match params.direction {
-            crate::api::schema::SplitDirection::Right => ratatui::layout::Direction::Horizontal,
-            crate::api::schema::SplitDirection::Down => ratatui::layout::Direction::Vertical,
-        };
         let shell_config = crate::pane::PaneShellConfig::new(&default_shell, self.state.shell_mode);
         let split_result = match params.ratio {
             Some(ratio) => ws.split_pane_with_ratio(
```

**File**: `src/app/api/plugins/mod.rs` (modified, +2/-1)
```diff
@@ -1694,7 +1694,8 @@ command = ["cmd.exe", "/d", "/c", "slot.cmd", "default"]
                 let expected = child_cwd.join(where_probe).canonicalize().unwrap();
                 let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
                 loop {
-                    let text = runtime.recent_unwrapped_text(20);
+                    // The pane is a narrow split, so the long path wraps across many rows.
+                    let text = runtime.recent_unwrapped_text(400);
                     if text.lines().any(|line| {
                         std::fs::canonicalize(line.trim()).is_ok_and(|path| path == expected)
                     }) {
```

**File**: `src/app/api/plugins/panes.rs` (modified, +16/-6)
```diff
@@ -115,16 +115,26 @@ impl App {
             crate::api::schema::SplitDirection::Right => Direction::Horizontal,
             crate::api::schema::SplitDirection::Down => Direction::Vertical,
         };
-        let (rows, cols) = self.state.estimate_pane_size();
+        let new_pane_placement = if placement == PluginPanePlacement::Zoomed {
+            crate::ui::NewPanePlacement::ZoomedOverlay
+        } else {
+            crate::ui::NewPanePlacement::Split {
+                ws_idx,
+                target: target_pane,
+                direction,
+                ratio: 0.5,
+            }
+        };
+        let (rows, cols) = self.state.new_pane_size(new_pane_placement);
         let previous_focus = self.state.current_pane_focus_target();
         let Some(ws) = self.state.workspaces.get_mut(ws_idx) else {
             return encode_error(id, "workspace_not_found", "workspace not found");
         };
         let result = ws.split_pane_argv_command(
             target_pane,
             direction,
-            rows.max(4),
-            cols.max(10),
+            rows,
+            cols,
             Some(cwd),
             &pane.command,
             extra_env,
@@ -195,13 +205,13 @@ impl App {
                 Ok(env) => env,
                 Err((code, message)) => return encode_error(id, &code, message),
             };
-        let (rows, cols) = self.state.estimate_pane_size();
+        let (rows, cols) = self.state.new_pane_size(crate::ui::NewPanePlacement::Alone);
         let Some(ws) = self.state.workspaces.get_mut(ws_idx) else {
             return encode_error(id, "workspace_not_found", "workspace not found");
         };
         let (tab_idx, terminal, runtime) = match ws.create_tab_argv_command(
-            rows.max(4),
-            cols.max(10),
+            rows,
+            cols,
             cwd,
             &pane.command,
             extra_env,
```

**File**: `src/app/api/tabs.rs` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ impl App {
         let cwd = cwd.map(PathBuf::from).unwrap_or_else(|| {
             self.resolve_new_terminal_cwd(self.focused_pane_cwd_in_workspace(ws_idx))
         });
-        let (rows, cols) = self.state.estimate_pane_size();
+        let (rows, cols) = self.state.new_pane_size(crate::ui::NewPanePlacement::Alone);
         let default_shell = self.state.default_shell.clone();
         let scrollback_limit_bytes = self.state.pane_scrollback_limit_bytes;
         let host_terminal_theme = self.state.host_terminal_theme;
```

**File**: `src/app/creation.rs` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ impl App {
         focus: bool,
         extra_env: Vec<(String, String)>,
     ) -> std::io::Result<usize> {
-        let (rows, cols) = self.state.estimate_pane_size();
+        let (rows, cols) = self.state.new_pane_size(crate::ui::NewPanePlacement::Alone);
         let (ws, terminal, runtime) = Workspace::new_with_extra_env(
             initial_cwd,
             rows,
```

**File**: `src/app/custom_commands.rs` (modified, +10/-10)
```diff
@@ -369,9 +369,9 @@ impl App {
             return Err(std::io::Error::other("no active workspace"));
         };
         let previous_focus_target = self.state.current_pane_focus_target();
-        let (rows, cols) = self.state.estimate_pane_size();
-        let new_rows = rows.max(4);
-        let new_cols = cols.max(10);
+        let (rows, cols) = self
+            .state
+            .new_pane_size(crate::ui::NewPanePlacement::ZoomedOverlay);
         let (env, _) = self.custom_command_env();
 
         let ws = self
@@ -393,8 +393,8 @@ impl App {
         });
         let new_pane = ws.split_focused_command(
             Direction::Horizontal,
-            new_rows,
-            new_cols,
+            rows,
+            cols,
             cwd,
             command,
             env,
@@ -448,9 +448,9 @@ impl App {
             return Err(std::io::Error::other("no active workspace"));
         };
         let previous_focus_target = self.state.current_pane_focus_target();
-        let (rows, cols) = self.state.estimate_pane_size();
-        let new_rows = rows.max(4);
-        let new_cols = cols.max(10);
+        let (rows, cols) = self
+            .state
+            .new_pane_size(crate::ui::NewPanePlacement::ZoomedOverlay);
 
         let ws = self
             .state
@@ -480,8 +480,8 @@ impl App {
             let result = ws.split_pane_argv_command(
                 previous_focus,
                 Direction::Horizontal,
-                new_rows,
-                new_cols,
+                rows,
+                cols,
                 cwd,
                 argv,
                 extra_env,
```

---

### Incident Patch 12: `ea8ed81b` (2026-10-02)
**Commit Message**: fix(windows): bound queued Enter waits during pane shutdown (#4872)

**File**: `src/pty/actor.rs` (modified, +20/-5)
```diff
@@ -188,10 +188,10 @@ mod windows {
                 .accepting
                 .lock()
                 .unwrap_or_else(|poisoned| poisoned.into_inner());
-            // Pane shutdown terminates the child immediately after this returns. An Enter
-            // already queued must finish flushing, even if the async task cannot run.
+            // Give a queued Enter the same grace as process termination. A blocked
+            // pipe writer must not prevent teardown from terminating the child.
             if let Some(completion) = accepting.enter_completion.take() {
-                let _ = completion.recv();
+                let _ = completion.recv_timeout(Duration::from_millis(250));
             }
             accepting.accepting = false;
             drop(accepting);
@@ -725,8 +725,8 @@ mod windows {
         }
 
         #[test]
-        fn shutdown_waits_for_queued_enter_and_releases_when_writer_finishes_or_disconnects() {
-            for outcome in ["flushed", "failed", "disconnected"] {
+        fn shutdown_gives_queued_enter_a_bounded_grace() {
+            for outcome in ["flushed", "failed", "disconnected", "stalled"] {
                 let runtime = test_runtime();
                 let accepting = input_acceptance(true);
                 let (data_tx, _data_rx) = mpsc::channel(1);
@@ -755,6 +755,21 @@ mod windows {
                     handle.shutdown();
                     shutdown_done_tx.send(()).unwrap();
                 });
+                if outcome == "stalled" {
+                    // Keep the queued Enter and its completion sender alive until
+                    // shutdown returns, as a blocked pipe writer would do.
+                    let result = shutdown_done_rx.recv_timeout(Duration::from_secs(2));
+                    drop(command);
+                    shutdown.join().unwrap();
+                    assert!(result.is_ok(), "stalled Enter cannot prevent teardown");
+                    assert!(matches!(
+                        control_rx.try_recv(),
+                        Ok(PtyIoControlCommand::Shutdown)
+                    ));
+                    assert!(!accepting.lock().unwrap().accepting);
+                    assert!(runtime.block_on(input_task).unwrap().is_err());
+                    continue;
+                }
                 let deadline = Instant::now() + Duration::from_secs(2);
                 while accepting.try_lock().is_ok() {
                     assert!(Instant::now() < deadline, "shutdown takes acceptance lock");
```

---

### Incident Patch 13: `65e35a38` (2026-10-02)
**Commit Message**: fix: avoid per-cell allocations in terminal text reads (#4845)

* fix: avoid per-cell allocations in terminal text reads

refs #4506

* fix: preserve tight allocations for owned grapheme reads

refs #4506

---------

Co-authored-by: akbash-bot <[REDACTED_EMAIL]>
Co-authored-by: JJ Liebig <[REDACTED_EMAIL]>

**File**: `crates/ghostty-vt/src/lib.rs` (modified, +120/-0)
```diff
@@ -1280,6 +1280,29 @@ impl Terminal {
         self.screen_text_rows_range(0, usize::MAX)
     }
 
+    /// Visit a screen row without allocating an owned grapheme vector for each cell.
+    /// The borrowed graphemes are valid only for the duration of each callback.
+    /// Like `screen_text_rows_range`, rows outside the active screen/history are empty.
+    pub fn for_each_screen_row_cell(
+        &self,
+        row: u32,
+        mut visit: impl FnMut(CellWide, &[u32]),
+    ) -> Result<(), Error> {
+        if row as usize >= self.total_rows()? {
+            return Ok(());
+        }
+        let cols = self.cols()?;
+        let mut grid_ref = self.grid_ref(ghostty_screen_point(0, row))?;
+        let mut graphemes = Vec::new();
+        for x in 0..cols {
+            grid_ref.x = x;
+            let wide = grid_ref_wide(&grid_ref)?;
+            grid_ref_graphemes_into(&grid_ref, &mut graphemes)?;
+            visit(wide, &graphemes);
+        }
+        Ok(())
+    }
+
     pub fn screen_text_rows_range(
         &self,
         start_row: usize,
@@ -2304,6 +2327,8 @@ fn grid_ref_graphemes(grid_ref: &ffi::GhosttyGridRef) -> Result<Vec<u32>, Error>
     if result != ffi::GhosttyResult_GHOSTTY_OUT_OF_SPACE {
         result.into_result()?;
     }
+    // Owned cells keep only this grapheme; unlike the row scratch buffer, they
+    // do not benefit from spare capacity for subsequent cells.
     let mut buffer = vec![0u32; required];
     if required == 0 {
         return Ok(buffer);
@@ -2316,6 +2341,28 @@ fn grid_ref_graphemes(grid_ref: &ffi::GhosttyGridRef) -> Result<Vec<u32>, Error>
     Ok(buffer)
 }
 
+fn grid_ref_graphemes_into(
+    grid_ref: &ffi::GhosttyGridRef,
+    buffer: &mut Vec<u32>,
+) -> Result<(), Error> {
+    let mut required = 0usize;
+    let result =
+        unsafe { ffi::ghostty_grid_ref_graphemes(grid_ref, ptr::null_mut(), 0, &mut required) };
+    if result != ffi::GhosttyResult_GHOSTTY_OUT_OF_SPACE {
+        result.into_result()?;
+    }
+    buffer.resize(required, 0);
+    if required == 0 {
+        return Ok(());
+    }
+    unsafe {
+        ffi::ghostty_grid_ref_graphemes(grid_ref, buffer.as_mut_ptr(), buffer.len(), &mut required)
+            .into_result()?;
+    }
+    buffer.truncate(required);
+    Ok(())
+}
+
 fn grid_ref_wide(grid_ref: &ffi::GhosttyGridRef) -> Result<CellWide, Error> {
     let mut raw = ffi::GhosttyCell::default();
     unsafe {
@@ -3673,6 +3720,9 @@ impl<'a> RowCellIter<'a> {
     }
 }
 
+#[cfg(test)]
+mod test_allocations;
+
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -4647,6 +4697,76 @@ mod tests {
         assert_eq!(rows[2].cells[2].graphemes, vec!['e' as u32, 0x301]);
     }
 
+    #[test]
+    fn owned_cell_graphemes_keep_tight_capacity() {
+        let mut terminal = Terminal::new(8, 1, 100).unwrap();
+        terminal.write("xe\u{301}".as_bytes());
+
+        let rows = terminal.screen_text_rows().unwrap();
+        assert_eq!(rows[0].cells[0].graphemes, vec!['x' as u32]);
+        assert_eq!(rows[0].cells[1].graphemes, vec!['e' as u32, 0x301]);
+        for cell in &rows[0].cells {
+            assert_eq!(cell.graphemes.capacity(), cell.graphemes.len());
+        }
+    }
+
+    #[test]
+    fn borrowed_screen_row_cells_match_owned_cells() {
+        let mut terminal = Terminal::new(12, 4, 100).unwrap();
+        let content = format!(
+            "abcdefghi界Z\r\ne{} X\r\n{}\r\n",
+            "\u{301}".repeat(40),
+            char::from_u32(KITTY_UNICODE_PLACEHOLDER).unwrap()
+        );
+        for screen in ["", "\x1b[?1049h"] {
+            terminal.write(screen.as_bytes());
+            terminal.write(content.as_bytes());
+            let expected = terminal.screen_text_rows().unwrap();
+            assert!(expected
+                .iter()
+                .flat_map(|row| &row.cells)
+                .any(|cell| cell.graphemes.len() > 4));
+            for (y, row) in expected.iter().enumerate() {
+                let mut actual = Vec::new();
+                terminal
+                    .for_each_screen_row_cell(y as u32, |wide, graphemes| {
+                        actual.push((wide, graphemes.to_vec()));
+                    })
+                    .unwrap();
+                let expected: Vec<_> = row
+                    .cells
+                    .iter()
+                    .map(|cell| (cell.wide, cell.graphemes.clone()))
+                    .collect();
+                assert_eq!(actual, expected);
+            }
+            terminal
+                .for_each_screen_row_cell(u32::MAX, |_, _| panic!("out-of-range row"))
+                .unwrap();
+        }
+    }
+
+    #[test]
+    fn borrowed_screen_row_allocations_do_not_scale_with_cell_count() {
+        for cols in [80, 330] {
+            let mut terminal = Terminal::new(cols, 1, 100).unwrap();
+            terminal.write("x".repeat(usize::from(cols)).as_bytes());
+            let mut cells = 0;
+            let (result, allocations) = crate::t
```

**File**: `crates/ghostty-vt/src/test_allocations.rs` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+//! Count Rust allocation requests on only the calling test thread.
+//! Native terminal allocations and concurrent tests are deliberately excluded.
+
+use std::alloc::{GlobalAlloc, Layout, System};
+use std::cell::Cell;
+
+thread_local! {
+    static ALLOCATIONS: Cell<Option<usize>> = const { Cell::new(None) };
+}
+
+struct CountingAllocator;
+
+fn record_allocation() {
+    // Thread-local storage may already be gone during thread teardown.
+    let _ = ALLOCATIONS.try_with(|count| {
+        if let Some(value) = count.get() {
+            count.set(Some(value + 1));
+        }
+    });
+}
+
+unsafe impl GlobalAlloc for CountingAllocator {
+    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
+        record_allocation();
+        unsafe { System.alloc(layout) }
+    }
+
+    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
+        record_allocation();
+        unsafe { System.alloc_zeroed(layout) }
+    }
+
+    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
+        record_allocation();
+        unsafe { System.realloc(ptr, layout, size) }
+    }
+
+    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
+        unsafe { System.dealloc(ptr, layout) }
+    }
+}
+
+#[global_allocator]
+static ALLOCATOR: CountingAllocator = CountingAllocator;
+
+pub fn count<T>(operation: impl FnOnce() -> T) -> (T, usize) {
+    struct Reset;
+    impl Drop for Reset {
+        fn drop(&mut self) {
+            ALLOCATIONS.set(None);
+        }
+    }
+
+    assert!(ALLOCATIONS.replace(Some(0)).is_none());
+    let _reset = Reset;
+    let result = operation();
+    let count = ALLOCATIONS.get().expect("allocation counting is active");
+    (result, count)
+}
```

**File**: `src/pane/terminal.rs` (modified, +5/-9)
```diff
@@ -3089,27 +3089,23 @@ fn ghostty_screen_row(
     y: u32,
 ) -> Result<String, crate::ghostty::Error> {
     let mut line = String::new();
-    // Resolve the scrollback page once per row rather than once per column.
-    for crate::ghostty::ScreenTextCell { wide, graphemes } in terminal
-        .screen_text_rows_range(y as usize, y as usize + 1)?
-        .into_iter()
-        .flat_map(|row| row.cells)
-    {
+    // Keep one page lookup per row and reuse grapheme storage across its cells.
+    terminal.for_each_screen_row_cell(y, |wide, graphemes| {
         if wide == crate::ghostty::CellWide::SpacerTail {
-            continue;
+            return;
         }
         if graphemes.is_empty()
             || graphemes.first().copied() == Some(crate::ghostty::KITTY_UNICODE_PLACEHOLDER)
         {
             line.push(' ');
         } else {
-            for codepoint in graphemes {
+            for &codepoint in graphemes {
                 if let Some(ch) = char::from_u32(codepoint) {
                     line.push(ch);
                 }
             }
         }
-    }
+    })?;
     Ok(line.trim_end().to_string())
 }
 
```

---

### Incident Patch 14: `07e3840b` (2026-10-01)
**Commit Message**: fix: restore codex idle detection and update codex and pi manifests

refs #4507

**File**: `distribution/agent-detection/codex.toml` (modified, +28/-4)
```diff
@@ -1,7 +1,7 @@
 id = "codex"
-version = "2026.09.23.1"
+version = "2026.10.01.1"
 min_engine_version = 3
-updated_at = "2026-09-23T22:12:00Z"
+updated_at = "2026-10-01T00:00:00Z"
 
 [[rules]]
 id = "osc_title_blocked"
@@ -38,8 +38,20 @@ priority = 950
 region = "top_non_empty_lines(20)"
 visible_blocker = true
 all = [
-  { regex = ['\A> You are in [^\r\n]+(?:\r?\n|$)'] },
-  { regex = ['(?s)Do\s+you\s+trust\s+the\s+contents\s+of\s+this\s+directory\?'] },
+  { any = [
+    { regex = ['\A> You are in [^\r\n]+(?:\r?\n|$)'] },
+    { contains = ["Folder access"] },
+  ] },
+  { any = [
+    { regex = ['(?s)Do\s+you\s+trust\s+the\s+contents\s+of\s+this\s+directory\?'] },
+    { all = [
+      { contains = ["Trust this folder?", "Codex can read, edit, and run files here"] },
+      { any = [
+        { contains = ["Trust and continue"] },
+        { contains = ["enter continue"] },
+      ] },
+    ] },
+  ] },
 ]
 
 [[rules]]
@@ -92,3 +104,15 @@ any = [{ contains = [" to interrupt)"] }, { contains = ["s)"] }]
 regex = ['(?m)^(?:[•◦][ \t]+)?[^\s›•◦■✗✓─][^\r\n]* \((?:[0-9]+[hm] )*[0-9]+s(?: • [^\r\n]+? to interrupt)?\)(?: · [^\r\n]*)?(?:\r?\n(?:[^•◦›■✗✓─\r\n][^\r\n]*|•[ \t]+(?:Queued\s+follow-up\s+inputs|Messages\s+to\s+be\s+submitted\s+after\s+next\s+tool\s+call(?:\s+\(press\s+[^\r\n]+?\s+to\s+interrupt\s+and\s+send\s+immediately\))?|Messages\s+to\s+be\s+submitted\s+at\s+end\s+of\s+turn)|›[⠁⠂⠄⠈⠐⠠⡀⢀][^\r\n]*)?)*\s*\z']
 # A failed reconnect keeps its final elapsed timer but is no longer working.
 not = [{ line_regex = ['^(?:[•◦][ \t]+)?Reconnect failed — check the endpoint, then relaunch \([0-9hms ]+\)$'] }]
+
+[[rules]]
+id = "osc_title_idle"
+state = "idle"
+priority = 100
+region = "osc_title"
+visible_idle = true
+regex = ['\S']
+not = [
+  { regex = ['(?:^| )[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏](?: |$)'] },
+  { contains = ["Action Required"] },
+]
```

**File**: `distribution/agent-detection/pi.toml` (modified, +10/-4)
```diff
@@ -1,7 +1,7 @@
 id = "pi"
-version = "2026.09.14.1"
+version = "2026.10.01.1"
 min_engine_version = 1
-updated_at = "2026-09-14T00:00:00Z"
+updated_at = "2026-10-01T00:00:00Z"
 aliases = ["herdr:pi"]
 
 [[rules]]
@@ -10,12 +10,18 @@ state = "working"
 priority = 100
 region = "whole_recent"
 visible_working = true
-contains = ["Working..."]
+any = [
+  { contains = ["Working..."] },
+  { line_regex = ['^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Working$'] },
+]
 
 [[rules]]
 id = "working_border"
 state = "working"
 priority = 100
 region = "bottom_non_empty_lines(12)"
 visible_working = true
-line_regex = ['^── [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Working ─+$']
+any = [
+  { line_regex = ['^── [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Working ─+$'] },
+  { line_regex = ['^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Working$'] },
+]
```

**File**: `docs/next/website/src/content/docs/agents.mdx` (modified, +2/-4)
```diff
@@ -73,11 +73,9 @@ Some restricted Linux runtimes do not expose a terminal foreground process group
 
 ## Blocked state
 
-Blocked detection is deliberately strict for screen-manifest agents. Herdr only marks `blocked` when the live bottom-buffer snapshot matches known visible approval, question, or permission UI. If no manifest rule matches for a known agent other than Codex, Herdr falls back to `idle` and labels that fallback as `default_known_agent_idle_fallback` in explain output. Codex falls back to `unknown` because its title and composer can look the same during an active turn and after a response.
+Blocked detection is deliberately strict for screen-manifest agents. Herdr only marks `blocked` when the live bottom-buffer snapshot matches known visible approval, question, or permission UI. If no manifest rule matches for a known agent, Herdr falls back to `idle` and labels that fallback as `default_known_agent_idle_fallback` in explain output.
 
-For those other agents, unusual new prompts may initially show as `idle` instead of `blocked` until Herdr learns that screen shape. The misclassification affects only the visible status and waits. It should not make Herdr send input or take destructive action.
-
-For Codex, a visible spinner or live activity timer can establish `working`, and a visible approval prompt can establish `blocked`. An ordinary title, composer, or missing spinner cannot establish that a turn ended. Codex may therefore stay `unknown` after a response, and waits for `idle` or completion may time out. Managed startup uses the initial composer only to determine when it can accept a prompt; that observation does not change turn status.
+This means unusual new agent prompts may initially show as `idle` instead of `blocked` until Herdr learns that screen shape. The misclassification affects only the visible status and waits. It should not make Herdr send input or take destructive action.
 
 ## Detection manifests
 
```

**File**: `src/detect/manifest.rs` (modified, +3/-7)
```diff
@@ -540,14 +540,14 @@ fn fallback_explain(
             )
         })
         .unwrap_or((None, Vec::new(), None, None, None, false));
-    let assume_idle = agent.is_some_and(|agent| agent != Agent::Codex);
+    let known_agent = agent.is_some();
     let remote_update_status = include_update_status
         .then(|| agent.and_then(remote_update_status))
         .flatten();
 
     DetectionExplain {
         agent: agent.map(|agent| agent_label(agent).to_string()),
-        state: if assume_idle {
+        state: if known_agent {
             AgentState::Idle
         } else {
             AgentState::Unknown
@@ -560,11 +560,7 @@ fn fallback_explain(
         visible_working: false,
         skip_state_update: false,
         skipped_update_reason: None,
-        fallback_reason: match agent {
-            Some(Agent::Codex) => Some("codex_state_ambiguous".to_string()),
-            Some(_) => Some(DEFAULT_KNOWN_AGENT_IDLE_FALLBACK.to_string()),
-            None => None,
-        },
+        fallback_reason: known_agent.then(|| DEFAULT_KNOWN_AGENT_IDLE_FALLBACK.to_string()),
         evaluated_rules,
         warning,
         manifest_version,
```

**File**: `src/detect/manifest/tests.rs` (modified, +6/-12)
```diff
@@ -89,21 +89,15 @@ fn write_local_codex(content: &str) {
 }
 
 #[test]
-fn codex_no_match_is_unknown_without_changing_other_agents() {
+fn known_agent_no_match_defaults_to_idle_fallback() {
     with_manifest_dirs("no-match", || {
         write_local_codex(&local_manifest("working", "active-marker"));
         let explain = explain(Agent::Codex, "unmatched-marker");
 
-        assert_eq!(explain.state, AgentState::Unknown);
+        assert_eq!(explain.state, AgentState::Idle);
         assert!(!explain.visible_idle);
         assert_eq!(
             explain.fallback_reason.as_deref(),
-            Some("codex_state_ambiguous")
-        );
-        let other = fallback_explain(Some(Agent::Pi), None, false);
-        assert_eq!(other.state, AgentState::Idle);
-        assert_eq!(
-            other.fallback_reason.as_deref(),
             Some(DEFAULT_KNOWN_AGENT_IDLE_FALLBACK)
         );
     });
@@ -190,10 +184,10 @@ fn fallback_explain_preserves_active_manifest_version() {
 
         let explain = explain(Agent::Codex, "ordinary prompt text");
 
-        assert_eq!(explain.state, AgentState::Unknown);
+        assert_eq!(explain.state, AgentState::Idle);
         assert_eq!(
             explain.fallback_reason.as_deref(),
-            Some("codex_state_ambiguous")
+            Some(DEFAULT_KNOWN_AGENT_IDLE_FALLBACK)
         );
         assert_eq!(explain.manifest_version.as_deref(), Some("9999.01.01.1"));
         assert!(matches!(
@@ -273,10 +267,10 @@ fn detection_uses_cached_manifest_until_explicit_reload() {
         write_remote_codex_without_reload(&remote_manifest("9999.01.01.2", "working", "new-ready"));
 
         let unchanged = explain(Agent::Codex, "new-ready");
-        assert_eq!(unchanged.state, AgentState::Unknown);
+        assert_eq!(unchanged.state, AgentState::Idle);
         assert_eq!(
             unchanged.fallback_reason.as_deref(),
-            Some("codex_state_ambiguous")
+            Some(DEFAULT_KNOWN_AGENT_IDLE_FALLBACK)
         );
         assert_eq!(
             unchanged.cached_remote_version.as_deref(),
```

**File**: `src/detect/manifests/codex.toml` (modified, +28/-4)
```diff
@@ -1,7 +1,7 @@
 id = "codex"
-version = "2026.09.23.1"
+version = "2026.10.01.1"
 min_engine_version = 3
-updated_at = "2026-09-23T22:12:00Z"
+updated_at = "2026-10-01T00:00:00Z"
 
 [[rules]]
 id = "osc_title_blocked"
@@ -38,8 +38,20 @@ priority = 950
 region = "top_non_empty_lines(20)"
 visible_blocker = true
 all = [
-  { regex = ['\A> You are in [^\r\n]+(?:\r?\n|$)'] },
-  { regex = ['(?s)Do\s+you\s+trust\s+the\s+contents\s+of\s+this\s+directory\?'] },
+  { any = [
+    { regex = ['\A> You are in [^\r\n]+(?:\r?\n|$)'] },
+    { contains = ["Folder access"] },
+  ] },
+  { any = [
+    { regex = ['(?s)Do\s+you\s+trust\s+the\s+contents\s+of\s+this\s+directory\?'] },
+    { all = [
+      { contains = ["Trust this folder?", "Codex can read, edit, and run files here"] },
+      { any = [
+        { contains = ["Trust and continue"] },
+        { contains = ["enter continue"] },
+      ] },
+    ] },
+  ] },
 ]
 
 [[rules]]
@@ -92,3 +104,15 @@ any = [{ contains = [" to interrupt)"] }, { contains = ["s)"] }]
 regex = ['(?m)^(?:[•◦][ \t]+)?[^\s›•◦■✗✓─][^\r\n]* \((?:[0-9]+[hm] )*[0-9]+s(?: • [^\r\n]+? to interrupt)?\)(?: · [^\r\n]*)?(?:\r?\n(?:[^•◦›■✗✓─\r\n][^\r\n]*|•[ \t]+(?:Queued\s+follow-up\s+inputs|Messages\s+to\s+be\s+submitted\s+after\s+next\s+tool\s+call(?:\s+\(press\s+[^\r\n]+?\s+to\s+interrupt\s+and\s+send\s+immediately\))?|Messages\s+to\s+be\s+submitted\s+at\s+end\s+of\s+turn)|›[⠁⠂⠄⠈⠐⠠⡀⢀][^\r\n]*)?)*\s*\z']
 # A failed reconnect keeps its final elapsed timer but is no longer working.
 not = [{ line_regex = ['^(?:[•◦][ \t]+)?Reconnect failed — check the endpoint, then relaunch \([0-9hms ]+\)$'] }]
+
+[[rules]]
+id = "osc_title_idle"
+state = "idle"
+priority = 100
+region = "osc_title"
+visible_idle = true
+regex = ['\S']
+not = [
+  { regex = ['(?:^| )[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏](?: |$)'] },
+  { contains = ["Action Required"] },
+]
```

**File**: `src/detect/manifests/pi.toml` (modified, +10/-4)
```diff
@@ -1,7 +1,7 @@
 id = "pi"
-version = "2026.09.14.1"
+version = "2026.10.01.1"
 min_engine_version = 1
-updated_at = "2026-09-14T00:00:00Z"
+updated_at = "2026-10-01T00:00:00Z"
 aliases = ["herdr:pi"]
 
 [[rules]]
@@ -10,12 +10,18 @@ state = "working"
 priority = 100
 region = "whole_recent"
 visible_working = true
-contains = ["Working..."]
+any = [
+  { contains = ["Working..."] },
+  { line_regex = ['^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Working$'] },
+]
 
 [[rules]]
 id = "working_border"
 state = "working"
 priority = 100
 region = "bottom_non_empty_lines(12)"
 visible_working = true
-line_regex = ['^── [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Working ─+$']
+any = [
+  { line_regex = ['^── [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Working ─+$'] },
+  { line_regex = ['^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Working$'] },
+]
```

---

### Incident Patch 15: `d4e335e7` (2026-09-30)
**Commit Message**: docs: drop external example link from agent support guide

**File**: `docs/next/website/src/content/docs/add-herdr-support.mdx` (modified, +2/-6)
```diff
@@ -48,6 +48,8 @@ Only report when `HERDR_ENV=1` and the other variables are set. Outside Herdr, y
 - `--source` identifies your integration. Keep it stable and unique. Don't start it with `herdr:`, because Herdr's own integrations use that prefix.
 - `--seq` is optional but recommended. It must increase with every report from your source, including across sessions and restarts of your agent. A timestamp works well. Herdr ignores reports whose number is not higher than the last one it accepted, so late or out-of-order reports can't overwrite newer state.
 
+To change how your agent appears without changing its state, such as a title or custom status text, see [Custom status labels](/docs/integrations/#custom-status-labels).
+
 ## Report the resume command
 
 Put the command that resumes the current session after `--`. Include the options that session needs, such as the model or permission mode, so the resumed session behaves the same:
@@ -110,9 +112,3 @@ To test restore without touching your normal session, use a separate named sessi
 1. Start `herdr --session my-agent-test`, then run your agent in a pane.
 2. Stop that session with `herdr session stop my-agent-test`.
 3. Start `herdr --session my-agent-test` again. The pane should run your resume command and your agent should report again.
-
-## Example
-
-[Prime Agent's built-in Herdr reporter](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/extensions/builtin/herdr-agent-state.ts) is a real-world integration. It activates only inside Herdr, maps agent events to `working`, `idle`, and `blocked`, keeps its report order across sessions, and releases the pane on exit.
-
-To change how your agent appears without changing its state, such as a title or custom status text, see [Custom status labels](/docs/integrations/#custom-status-labels).
```

**File**: `docs/next/website/src/content/docs/ja/add-herdr-support.mdx` (modified, +2/-6)
```diff
@@ -48,6 +48,8 @@ Herdr ペイン内のすべてのプロセスは、次の環境変数を継承
 - `--source` はインテグレーションを識別します。固定かつ一意にしてください。`herdr:` で始めないでください。この接頭辞は Herdr 自身のインテグレーションが使います。
 - `--seq` は省略できますが、付けることを推奨します。source からの報告ごとに増加する必要があり、エージェントのセッションや再起動をまたいでも増加し続ける必要があります。タイムスタンプが適しています。Herdr は最後に受け付けた番号より大きくない報告を無視するので、遅れて届いた報告や順不同の報告が新しい状態を上書きすることはありません。
 
+タイトルやカスタムのステータス文言など、状態を変えずにエージェントの見た目を変えるには、[カスタムステータスラベル](/ja/docs/integrations/#カスタムステータスラベル)を参照してください。
+
 ## resume コマンドを報告する
 
 現在のセッションを再開するコマンドを `--` の後に置きます。モデルや権限モードなど、そのセッションに必要なオプションも含めると、再開したセッションが同じように動きます:
@@ -110,9 +112,3 @@ herdr agent list
 1. `herdr --session my-agent-test` を起動し、ペインでエージェントを実行します。
 2. `herdr session stop my-agent-test` でそのセッションを停止します。
 3. `herdr --session my-agent-test` をもう一度起動します。ペインで resume コマンドが実行され、エージェントが再び報告するはずです。
-
-## 例
-
-[Prime Agent の組み込み Herdr レポーター](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/extensions/builtin/herdr-agent-state.ts)は実際のインテグレーションです。Herdr 内でのみ有効になり、エージェントイベントを `working`、`idle`、`blocked` に対応付け、セッションをまたいで報告順序を維持し、終了時にペインを解放します。
-
-タイトルやカスタムのステータス文言など、状態を変えずにエージェントの見た目を変えるには、[カスタムステータスラベル](/ja/docs/integrations/#カスタムステータスラベル)を参照してください。
```

**File**: `docs/next/website/src/content/docs/zh-cn/add-herdr-support.mdx` (modified, +2/-6)
```diff
@@ -48,6 +48,8 @@ Herdr 窗格中的每个进程都会继承这些环境变量:
 - `--source` 用于标识你的集成。保持稳定且唯一。不要以 `herdr:` 开头,这个前缀由 Herdr 自己的集成使用。
 - `--seq` 可以省略,但建议加上。它必须随来自你的来源的每次上报递增,跨会话和智能体重启也要继续递增。时间戳就很合适。Herdr 会忽略编号不大于上次已接受编号的上报,所以迟到或乱序的上报不会覆盖更新的状态。
 
+如果想在不改变状态的情况下改变智能体的显示方式,例如标题或自定义状态文字,请参阅[自定义状态标签](/zh-cn/docs/integrations/#自定义状态标签)。
+
 ## 上报恢复命令
 
 把恢复当前会话的命令放在 `--` 之后。带上该会话需要的选项,例如模型或权限模式,这样恢复后的会话行为一致:
@@ -110,9 +112,3 @@ herdr agent list
 1. 启动 `herdr --session my-agent-test`,然后在一个窗格中运行你的智能体。
 2. 用 `herdr session stop my-agent-test` 停止该会话。
 3. 再次启动 `herdr --session my-agent-test`。窗格应当运行你的恢复命令,智能体应当再次上报。
-
-## 示例
-
-[Prime Agent 内置的 Herdr 上报器](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/extensions/builtin/herdr-agent-state.ts)是一个真实的集成。它只在 Herdr 中启用,将智能体事件映射为 `working`、`idle` 和 `blocked`,跨会话保持上报顺序,并在退出时释放窗格。
-
-如果想在不改变状态的情况下改变智能体的显示方式,例如标题或自定义状态文字,请参阅[自定义状态标签](/zh-cn/docs/integrations/#自定义状态标签)。
```

**File**: `docs/versions/0.9.2/website/src/content/docs/add-herdr-support.mdx` (modified, +2/-6)
```diff
@@ -48,6 +48,8 @@ Only report when `HERDR_ENV=1` and the other variables are set. Outside Herdr, y
 - `--source` identifies your integration. Keep it stable and unique. Don't start it with `herdr:`, because Herdr's own integrations use that prefix.
 - `--seq` is optional but recommended. It must increase with every report from your source, including across sessions and restarts of your agent. A timestamp works well. Herdr ignores reports whose number is not higher than the last one it accepted, so late or out-of-order reports can't overwrite newer state.
 
+To change how your agent appears without changing its state, such as a title or custom status text, see [Custom status labels](/docs/integrations/#custom-status-labels).
+
 ## Report the resume command
 
 Put the command that resumes the current session after `--`. Include the options that session needs, such as the model or permission mode, so the resumed session behaves the same:
@@ -110,9 +112,3 @@ To test restore without touching your normal session, use a separate named sessi
 1. Start `herdr --session my-agent-test`, then run your agent in a pane.
 2. Stop that session with `herdr session stop my-agent-test`.
 3. Start `herdr --session my-agent-test` again. The pane should run your resume command and your agent should report again.
-
-## Example
-
-[Prime Agent's built-in Herdr reporter](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/extensions/builtin/herdr-agent-state.ts) is a real-world integration. It activates only inside Herdr, maps agent events to `working`, `idle`, and `blocked`, keeps its report order across sessions, and releases the pane on exit.
-
-To change how your agent appears without changing its state, such as a title or custom status text, see [Custom status labels](/docs/integrations/#custom-status-labels).
```

**File**: `docs/versions/0.9.2/website/src/content/docs/ja/add-herdr-support.mdx` (modified, +2/-6)
```diff
@@ -48,6 +48,8 @@ Herdr ペイン内のすべてのプロセスは、次の環境変数を継承
 - `--source` はインテグレーションを識別します。固定かつ一意にしてください。`herdr:` で始めないでください。この接頭辞は Herdr 自身のインテグレーションが使います。
 - `--seq` は省略できますが、付けることを推奨します。source からの報告ごとに増加する必要があり、エージェントのセッションや再起動をまたいでも増加し続ける必要があります。タイムスタンプが適しています。Herdr は最後に受け付けた番号より大きくない報告を無視するので、遅れて届いた報告や順不同の報告が新しい状態を上書きすることはありません。
 
+タイトルやカスタムのステータス文言など、状態を変えずにエージェントの見た目を変えるには、[カスタムステータスラベル](/ja/docs/integrations/#カスタムステータスラベル)を参照してください。
+
 ## resume コマンドを報告する
 
 現在のセッションを再開するコマンドを `--` の後に置きます。モデルや権限モードなど、そのセッションに必要なオプションも含めると、再開したセッションが同じように動きます:
@@ -110,9 +112,3 @@ herdr agent list
 1. `herdr --session my-agent-test` を起動し、ペインでエージェントを実行します。
 2. `herdr session stop my-agent-test` でそのセッションを停止します。
 3. `herdr --session my-agent-test` をもう一度起動します。ペインで resume コマンドが実行され、エージェントが再び報告するはずです。
-
-## 例
-
-[Prime Agent の組み込み Herdr レポーター](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/extensions/builtin/herdr-agent-state.ts)は実際のインテグレーションです。Herdr 内でのみ有効になり、エージェントイベントを `working`、`idle`、`blocked` に対応付け、セッションをまたいで報告順序を維持し、終了時にペインを解放します。
-
-タイトルやカスタムのステータス文言など、状態を変えずにエージェントの見た目を変えるには、[カスタムステータスラベル](/ja/docs/integrations/#カスタムステータスラベル)を参照してください。
```

**File**: `docs/versions/0.9.2/website/src/content/docs/zh-cn/add-herdr-support.mdx` (modified, +2/-6)
```diff
@@ -48,6 +48,8 @@ Herdr 窗格中的每个进程都会继承这些环境变量:
 - `--source` 用于标识你的集成。保持稳定且唯一。不要以 `herdr:` 开头,这个前缀由 Herdr 自己的集成使用。
 - `--seq` 可以省略,但建议加上。它必须随来自你的来源的每次上报递增,跨会话和智能体重启也要继续递增。时间戳就很合适。Herdr 会忽略编号不大于上次已接受编号的上报,所以迟到或乱序的上报不会覆盖更新的状态。
 
+如果想在不改变状态的情况下改变智能体的显示方式,例如标题或自定义状态文字,请参阅[自定义状态标签](/zh-cn/docs/integrations/#自定义状态标签)。
+
 ## 上报恢复命令
 
 把恢复当前会话的命令放在 `--` 之后。带上该会话需要的选项,例如模型或权限模式,这样恢复后的会话行为一致:
@@ -110,9 +112,3 @@ herdr agent list
 1. 启动 `herdr --session my-agent-test`,然后在一个窗格中运行你的智能体。
 2. 用 `herdr session stop my-agent-test` 停止该会话。
 3. 再次启动 `herdr --session my-agent-test`。窗格应当运行你的恢复命令,智能体应当再次上报。
-
-## 示例
-
-[Prime Agent 内置的 Herdr 上报器](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/extensions/builtin/herdr-agent-state.ts)是一个真实的集成。它只在 Herdr 中启用,将智能体事件映射为 `working`、`idle` 和 `blocked`,跨会话保持上报顺序,并在退出时释放窗格。
-
-如果想在不改变状态的情况下改变智能体的显示方式,例如标题或自定义状态文字,请参阅[自定义状态标签](/zh-cn/docs/integrations/#自定义状态标签)。
```

**File**: `docs/versions/0.9.3/website/src/content/docs/add-herdr-support.mdx` (modified, +2/-6)
```diff
@@ -48,6 +48,8 @@ Only report when `HERDR_ENV=1` and the other variables are set. Outside Herdr, y
 - `--source` identifies your integration. Keep it stable and unique. Don't start it with `herdr:`, because Herdr's own integrations use that prefix.
 - `--seq` is optional but recommended. It must increase with every report from your source, including across sessions and restarts of your agent. A timestamp works well. Herdr ignores reports whose number is not higher than the last one it accepted, so late or out-of-order reports can't overwrite newer state.
 
+To change how your agent appears without changing its state, such as a title or custom status text, see [Custom status labels](/docs/integrations/#custom-status-labels).
+
 ## Report the resume command
 
 Put the command that resumes the current session after `--`. Include the options that session needs, such as the model or permission mode, so the resumed session behaves the same:
@@ -110,9 +112,3 @@ To test restore without touching your normal session, use a separate named sessi
 1. Start `herdr --session my-agent-test`, then run your agent in a pane.
 2. Stop that session with `herdr session stop my-agent-test`.
 3. Start `herdr --session my-agent-test` again. The pane should run your resume command and your agent should report again.
-
-## Example
-
-[Prime Agent's built-in Herdr reporter](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/extensions/builtin/herdr-agent-state.ts) is a real-world integration. It activates only inside Herdr, maps agent events to `working`, `idle`, and `blocked`, keeps its report order across sessions, and releases the pane on exit.
-
-To change how your agent appears without changing its state, such as a title or custom status text, see [Custom status labels](/docs/integrations/#custom-status-labels).
```

**File**: `docs/versions/0.9.3/website/src/content/docs/ja/add-herdr-support.mdx` (modified, +2/-6)
```diff
@@ -48,6 +48,8 @@ Herdr ペイン内のすべてのプロセスは、次の環境変数を継承
 - `--source` はインテグレーションを識別します。固定かつ一意にしてください。`herdr:` で始めないでください。この接頭辞は Herdr 自身のインテグレーションが使います。
 - `--seq` は省略できますが、付けることを推奨します。source からの報告ごとに増加する必要があり、エージェントのセッションや再起動をまたいでも増加し続ける必要があります。タイムスタンプが適しています。Herdr は最後に受け付けた番号より大きくない報告を無視するので、遅れて届いた報告や順不同の報告が新しい状態を上書きすることはありません。
 
+タイトルやカスタムのステータス文言など、状態を変えずにエージェントの見た目を変えるには、[カスタムステータスラベル](/ja/docs/integrations/#カスタムステータスラベル)を参照してください。
+
 ## resume コマンドを報告する
 
 現在のセッションを再開するコマンドを `--` の後に置きます。モデルや権限モードなど、そのセッションに必要なオプションも含めると、再開したセッションが同じように動きます:
@@ -110,9 +112,3 @@ herdr agent list
 1. `herdr --session my-agent-test` を起動し、ペインでエージェントを実行します。
 2. `herdr session stop my-agent-test` でそのセッションを停止します。
 3. `herdr --session my-agent-test` をもう一度起動します。ペインで resume コマンドが実行され、エージェントが再び報告するはずです。
-
-## 例
-
-[Prime Agent の組み込み Herdr レポーター](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/extensions/builtin/herdr-agent-state.ts)は実際のインテグレーションです。Herdr 内でのみ有効になり、エージェントイベントを `working`、`idle`、`blocked` に対応付け、セッションをまたいで報告順序を維持し、終了時にペインを解放します。
-
-タイトルやカスタムのステータス文言など、状態を変えずにエージェントの見た目を変えるには、[カスタムステータスラベル](/ja/docs/integrations/#カスタムステータスラベル)を参照してください。
```

#### Recent Merged Pull Requests:
- **PR #4965** (2026-10-05): fix: keep the server running on hangup and log why it stops (@ogulcancelik)
- **PR #4962** (2026-10-05): fix: stop probing the forwarded ssh agent every second (@ogulcancelik)
- **PR #4959** (2026-10-05): fix: detect agy dialogs and mid-turn work, treat background work as idle for agy and grok (@ogulcancelik)
- **PR #4953** (2026-10-05): chore: hold ratatui updates until kana rendering is fixed (@ogulcancelik)
- **PR #4949** (2026-10-05): chore(deps): bump the github-actions group with 3 updates (@dependabot[bot])
- **PR #4948** (closed): chore(deps): bump the cargo-dependencies group with 4 updates (@dependabot[bot])
- **PR #4946** (2026-10-05): chore(deps): take compatible cargo updates and split major bumps (@ogulcancelik)
- **PR #4945** (2026-10-05): fix: keep session restore responsive during git discovery (@minatoaquaMK2)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
