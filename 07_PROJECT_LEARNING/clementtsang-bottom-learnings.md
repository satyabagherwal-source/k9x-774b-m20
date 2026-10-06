# Forensic Learning Record (Deep Inspection): ClementTsang/bottom

> **Canonical Artifact**: `07_PROJECT_LEARNING/clementtsang-bottom-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ClementTsang/bottom](https://github.com/ClementTsang/bottom))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:37:28.717Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClementTsang/bottom`
- **Description**: Yet another cross-platform graphical process/system monitor.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 14086 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app/states.rs`
```
use rustc_hash::FxHashMap as HashMap;

use crate::{
    app::layout_manager::BottomWidgetType,
    constants,
    utils::input::InputFieldState,
    widgets::{
        BatteryWidgetState, CpuWidgetState, DiskIoGraphWidgetState, DiskTableWidget,
        MemWidgetState, NetWidgetState, ProcWidgetState, TempGraphWidgetState, TempWidgetState,
        query::ProcessQuery,
    },
};

pub struct AppWidgetStates {
    pub cpu_state: CpuState,
    pub mem_state: MemState,
    pub net_state: NetState,
    pub proc_state: ProcState,
    pub temp_state: TempState,
    pub temp_graph_state: TempGraphStates,
    pub disk_state: DiskState,
    pub disk_io_graph_state: DiskIoGraphStates,
    pub battery_state: AppBatteryState,
    pub basic_table_widget_state: Option<BasicTableWidgetState>,
}

#[derive(Debug)]
pub enum CursorDirection {
    Left,
    Right,
}

pub struct AppHelpDialogState {
    pub is_showing_help: bool,
    pub height: u16,
    pub scroll_state: ParagraphScrollState,
    pub index_shortcuts: Vec<u16>,
    is_searching: bool,
    pub search_input_state: InputFieldState,
}

impl Default for AppHelpDialogState {
    fn default() -> Self {
        AppHelpDialogState {
            is_showing_help: false,
            height: 0,
            scroll_state: ParagraphScrollState::default(),
            index_shortcuts: vec![0; constants::HELP_TEXT.len()],
            is_searching: false,
            search_input_state: InputFieldState::default(),
        }
    }
}

impl AppHelpDialogState {
    pub fn is_searching(&self) -> bool {
        self.is_searching
    }

    pub fn is_help_searching(&self) -> bool {
        self.is_showing_help && self.is_searching
    }

    pub fn open_search(&mut self) {
        self.is_searching = true;
    }

    pub fn close_search(&mut self) {
        self.is_searching = false;
    }
}

/// AppSearchState deals with generic searching (I might do this in the future).
#[derive(Default)]
pub struct AppSearchState {
    pub is_enabled: bool,
    pub is_invalid_search: bool,
    pub input_field_state: InputFieldState,

    /// The query. TODO: Merge this as one enum.
    pub query: Option<ProcessQuery>,
    pub error_message: Option<String>,
}

impl AppSearchState {
    /// Resets the [`AppSearchState`] to its default state, albeit still
    /// enabled.
    pub fn reset(&mut self) {
        *self = AppSearchState {
            is_enabled: self.is_enabled,
            ..AppSearchState::default()
        }
    }

    /// Returns whether the [`AppSearchState`] has an invalid or blank search.
    pub fn is_invalid_or_blank_search(&self) -> bool {
        self.input_field_state.current_query().is_empty() || self.is_invalid_search
    }
}

pub struct ProcState {
    pub widget_states: HashMap<u64, ProcWidgetState>,
}

impl ProcState {
    pub fn init(widget_states: HashMap<u64, ProcWidgetState>) -> Self {
        ProcState { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut ProcWidgetState> {
        self.widget_states.get_mut(&widget_id)
    }

    pub fn get_widget_state(&self, widget_id: u64) -> Option<&ProcWidgetState> {
        self.widget_states.get(&widget_id)
    }
}

pub struct NetState {
    pub widget_states: HashMap<u64, NetWidgetState>,
}

impl NetState {
    pub fn init(widget_states: HashMap<u64, NetWidgetState>) -> Self {
        NetState { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut NetWidgetState> {
        self.widget_states.get_mut(&widget_id)
    }
}

pub struct CpuState {
    pub widget_states: HashMap<u64, CpuWidgetState>,
}

impl CpuState {
    pub fn init(widget_states: HashMap<u64, CpuWidgetState>) -> Self {
        CpuState { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut CpuWidgetState> {
        self.widget_states.get_mut(&widget_id)
    }

    pub fn get_widget_state(&self, widget_id: u64) -> Option<&CpuWidgetState> {
        self.widget_states.get(&widget_id)
    }
}

pub struct MemState {
    pub widget_states: HashMap<u64, MemWidgetState>,
}

impl MemState {
    pub fn init(widget_states: HashMap<u64, MemWidgetState>) -> Self {
        MemState { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut MemWidgetState> {
        self.widget_states.get_mut(&widget_id)
    }
}

pub struct TempState {
    pub widget_states: HashMap<u64, TempWidgetState>,
}

impl TempState {
    pub fn init(widget_states: HashMap<u64, TempWidgetState>) -> Self {
        TempState { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut TempWidgetState> {
        self.widget_states.get_mut(&widget_id)
    }

    pub fn get_widget_state(&self, widget_id: u64) -> Option<&TempWidgetState> {
        self.widget_states.get(&widget_id)
    }
}

pub struct TempGraphStates {
    pub widget_states: HashMap<u64, TempGraphWidgetState>,
}

impl TempGraphStates {
    pub fn init(widget_states: HashMap<u64, TempGraphWidgetState>) -> Self {
        TempGraphStates { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut TempGraphWidgetState> {
        self.widget_states.get_mut(&widget_id)
    }
}

/// Holds per-widget state for all disk I/O graph instances in the layout.
pub struct DiskIoGraphStates {
    pub widget_states: HashMap<u64, DiskIoGraphWidgetState>,
}

impl DiskIoGraphStates {
    pub fn init(widget_states: HashMap<u64, DiskIoGraphWidgetState>) -> Self {
        DiskIoGraphStates { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut DiskIoGraphWidgetState> {
        self.widget_states.get_mut(&widget_id)
    }
}

pub struct DiskState {
    pub widget_states: HashMap<u64, DiskTableWidget>,
}

impl DiskState {
    pub fn init(widget_states: HashMap<u64, DiskTableWidget>) -> Self {
        DiskState { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut DiskTableWidget> {
        self.widget_states.get_mut(&widget_id)
    }

    pub fn get_widget_state(&self, widget_id: u64) -> Option<&DiskTableWidget> {
        self.widget_states.get(&widget_id)
    }
}
pub struct BasicTableWidgetState {
    // Since this is intended (currently) to only be used for ONE widget, that's
    // how it's going to be written.  If we want to allow for multiple of these,
    // then we can expand outwards with a normal BasicTableState and a hashmap
    pub currently_displayed_widget_type: BottomWidgetType,
    pub currently_displayed_widget_id: u64,
    pub left_tlc: Option<(u16, u16)>,
    pub left_brc: Option<(u16, u16)>,
    pub right_tlc: Option<(u16, u16)>,
    pub right_brc: Option<(u16, u16)>,
}

pub struct AppBatteryState {
    pub widget_states: HashMap<u64, BatteryWidgetState>,
}

impl AppBatteryState {
    pub fn init(widget_states: HashMap<u64, BatteryWidgetState>) -> Self {
        AppBatteryState { widget_states }
    }

    pub fn get_mut_widget_state(&mut self, widget_id: u64) -> Option<&mut BatteryWidgetState> {
        self.widget_states.get_mut(&widget_id)
    }
}

#[derive(Default)]
pub struct ParagraphScrollState {
    pub current_scroll_index: u16,
    pub max_scroll_index: u16,
}

```

### Core Architecture Module: `src/canvas/components/data_table/state.rs`
```
use std::num::NonZeroU16;

use ratatui::{layout::Rect, widgets::TableState};

#[derive(Debug, Copy, Clone, PartialEq, Eq, Default)]
pub enum ScrollDirection {
    // UP means scrolling up --- this usually DECREMENTS
    Up,

    // DOWN means scrolling down --- this usually INCREMENTS
    #[default]
    Down,
}

/// Internal state representation of a [`DataTable`](super::DataTable).
pub struct DataTableState {
    /// The index from where to start displaying the rows.
    pub display_start_index: usize,

    /// The current scroll position.
    pub current_index: usize,

    /// The direction of the last attempted scroll.
    pub scroll_direction: ScrollDirection,

    /// ratatui's internal table state.
    pub table_state: TableState,

    /// The calculated widths.
    pub calculated_widths: Vec<NonZeroU16>,

    /// The current inner [`Rect`].
    pub inner_rect: Rect,
}

impl Default for DataTableState {
    fn default() -> Self {
        Self {
            display_start_index: 0,
            current_index: 0,
            scroll_direction: ScrollDirection::Down,
            calculated_widths: vec![],
            table_state: TableState::default(),
            inner_rect: Rect::default(),
        }
    }
}

impl DataTableState {
    /// Gets the starting position of a table.
    pub fn get_start_position(&mut self, num_rows: usize, is_force_redraw: bool) {
        let start_index = if is_force_redraw {
            0
        } else {
            self.display_start_index
        };
        let current_scroll_position = self.current_index;
        let scroll_direction = self.scroll_direction;

        self.display_start_index = match scroll_direction {
            ScrollDirection::Down => {
                if current_scroll_position < start_index + num_rows {
                    // If, using the current scroll position, we can see the
                    // element (so within that and +
                    // num_rows) just reuse the current previously
                    // scrolled position.
                    start_index
                } else if current_scroll_position >= num_rows {
                    // If the current position past the last element visible in
                    // the list, then skip until we can see
                    // that element.
                    current_scroll_position - num_rows + 1
                } else {
                    // Else, if it is not past the last element visible, do not
                    // omit anything.
                    0
                }
            }
            ScrollDirection::Up => {
                if current_scroll_position <= start_index {
                    // If it's past the first element, then show from that
                    // element downwards
                    current_scroll_position
                } else if current_scroll_position >= start_index + num_rows {
                    current_scroll_position - num_rows + 1
                } else {
                    start_index
                }
            }
        };
    }
}

```

### Core Architecture Module: `src/canvas/drawing_utils.rs`
```
use std::time::Instant;

use ratatui::{
    layout::Rect,
    style::Style,
    widgets::{Block, BorderType, Borders},
};

pub const SIDE_BORDERS: Borders = Borders::LEFT.union(Borders::RIGHT);
pub const AUTOHIDE_TIMEOUT_MILLISECONDS: u64 = 5000; // 5 seconds to autohide

/// Determine whether a graph x-label should be hidden.
pub fn should_hide_x_label(
    always_hide_time: bool, autohide_time: bool, timer: &mut Option<Instant>, draw_loc: Rect,
) -> bool {
    const TIME_LABEL_HEIGHT_LIMIT: u16 = 7;

    if always_hide_time || (autohide_time && timer.is_none()) {
        true
    } else if let Some(time) = timer {
        if Instant::now().duration_since(*time).as_millis() < AUTOHIDE_TIMEOUT_MILLISECONDS.into() {
            false
        } else {
            *timer = None;
            true
        }
    } else {
        draw_loc.height < TIME_LABEL_HEIGHT_LIMIT
    }
}

/// Return a widget block.
pub fn widget_block(
    is_basic: bool, is_selected: bool, border_type: BorderType, widget_style: Style,
) -> Block<'static> {
    if is_basic {
        if is_selected {
            Block::default()
                .border_type(border_type)
                .style(widget_style)
                .borders(SIDE_BORDERS)
        } else {
            Block::default().style(widget_style)
        }
    } else {
        Block::default()
            .border_type(border_type)
            .style(widget_style)
            .borders(Borders::all())
    }
}

/// Return a dialog block.
pub fn dialog_block(border_type: BorderType, border_style: Style) -> Block<'static> {
    Block::default()
        .border_type(border_type)
        .border_style(border_style)
        .borders(Borders::all())
}

#[cfg(test)]
mod test {

    use super::*;

    #[test]
    fn test_should_hide_x_label() {
        use std::time::{Duration, Instant};

        use ratatui::layout::Rect;

        let rect = Rect::new(0, 0, 10, 10);
        let small_rect = Rect::new(0, 0, 10, 6);

        let mut under_timer = Some(Instant::now());
        let mut over_timer =
            Instant::now().checked_sub(Duration::from_millis(AUTOHIDE_TIMEOUT_MILLISECONDS + 100));

        assert!(should_hide_x_label(true, false, &mut None, rect));
        assert!(should_hide_x_label(false, true, &mut None, rect));
        assert!(should_hide_x_label(false, false, &mut None, small_rect));

        assert!(!should_hide_x_label(
            false,
            true,
            &mut under_timer,
            small_rect
        ));
        assert!(under_timer.is_some());

        assert!(should_hide_x_label(
            false,
            true,
            &mut over_timer,
            small_rect
        ));
        assert!(over_timer.is_none());
    }

    /// This test exists because previously, [`SIDE_BORDERS`] was set
    /// incorrectly after I moved from tui-rs to ratatui.
    #[test]
    fn assert_side_border_bits_match() {
        assert_eq!(
            SIDE_BORDERS,
            Borders::ALL.difference(Borders::TOP.union(Borders::BOTTOM))
        )
    }
}

```

### Core Architecture Module: `src/collection/linux/utils.rs`
```
use std::{fs, path::Path};

/// Whether the temperature should *actually* be read during enumeration.
/// Will return false if the state is not D0/unknown, or if it does not support
/// `device/power_state` (e.g. the path does not exist).
///
/// `path` is a path to the device itself (e.g.
/// `/sys/class/hwmon/hwmon1/device`).
#[inline]
pub fn is_device_awake(device: &Path) -> bool {
    // Whether the temperature should *actually* be read during enumeration.
    // Set to false if the device is in ACPI D3cold.
    // Documented at https://www.kernel.org/doc/Documentation/ABI/testing/sysfs-devices-power_state
    let power_state = device.join("power_state");
    if power_state.exists() {
        if let Ok(state) = fs::read_to_string(power_state) {
            let state = state.trim();
            // The zenpower3 kernel module (incorrectly?) reports "unknown",
            // causing this check to fail and temperatures to appear
            // as zero instead of having the file not exist.
            //
            // Their self-hosted git instance has disabled sign up, so this bug
            // can't be reported either.
            state == "D0" || state == "unknown"
        } else {
            true
        }
    } else {
        true
    }
}

```

### Core Architecture Module: `src/options/config/style/utils.rs`
```
use concat_string::concat_string;
use ratatui::style::Color;
use unicode_segmentation::UnicodeSegmentation;

/// Convert a hex string to a colour.
pub(super) fn try_hex_to_colour(hex: &str) -> Result<Color, String> {
    fn hex_component_to_int(hex: &str, first: &str, second: &str) -> Result<u8, String> {
        u8::from_str_radix(&concat_string!(first, second), 16)
            .map_err(|_| format!("'{hex}' is an invalid hex colour, could not decode."))
    }

    fn invalid_hex_format(hex: &str) -> String {
        format!(
            "'{hex}' is an invalid hex colour. It must be either a 7 character hex string of the form '#12ab3c' or a 3 character hex string of the form '#1a2'.",
        )
    }

    if !hex.starts_with('#') {
        return Err(invalid_hex_format(hex));
    }

    let components: Vec<&str> = hex.graphemes(true).collect();
    if components.len() == 7 {
        // A 6-long hex.
        let r = hex_component_to_int(hex, components[1], components[2])?;
        let g = hex_component_to_int(hex, components[3], components[4])?;
        let b = hex_component_to_int(hex, components[5], components[6])?;

        Ok(Color::Rgb(r, g, b))
    } else if components.len() == 4 {
        // A 3-long hex.
        let r = hex_component_to_int(hex, components[1], components[1])?;
        let g = hex_component_to_int(hex, components[2], components[2])?;
        let b = hex_component_to_int(hex, components[3], components[3])?;

        Ok(Color::Rgb(r, g, b))
    } else {
        Err(invalid_hex_format(hex))
    }
}

pub fn str_to_colour(input_val: &str) -> Result<Color, String> {
    if input_val.len() > 1 {
        if input_val.starts_with('#') {
            try_hex_to_colour(input_val)
        } else if input_val.contains(',') {
            convert_rgb_to_colour(input_val)
        } else {
            convert_name_to_colour(input_val)
        }
    } else {
        Err(format!("Value '{input_val}' is not valid.",))
    }
}

fn convert_rgb_to_colour(rgb_str: &str) -> Result<Color, String> {
    let rgb_list = rgb_str.split(',').collect::<Vec<&str>>();
    if rgb_list.len() != 3 {
        return Err(format!(
            "Value '{rgb_str}' is an invalid RGB colour. It must be a comma separated value with 3 integers from 0 to 255 (ie: '255, 0, 155').",
        ));
    }

    let rgb = rgb_list
        .iter()
        .filter_map(|val| (*(*val)).to_string().trim().parse::<u8>().ok())
        .collect::<Vec<_>>();

    if rgb.len() == 3 {
        Ok(Color::Rgb(rgb[0], rgb[1], rgb[2]))
    } else {
        Err(format!(
            "Value '{rgb_str}' contained invalid RGB values. It must be a comma separated value with 3 integers from 0 to 255 (ie: '255, 0, 155').",
        ))
    }
}

fn convert_name_to_colour(colour_name: &str) -> Result<Color, String> {
    match colour_name.to_lowercase().trim() {
        "reset" => Ok(Color::Reset),
        "black" => Ok(Color::Black),
        "red" => Ok(Color::Red),
        "green" => Ok(Color::Green),
        "yellow" => Ok(Color::Yellow),
        "blue" => Ok(Color::Blue),
        "magenta" => Ok(Color::Magenta),
        "cyan" => Ok(Color::Cyan),
        "gray" | "grey" => Ok(Color::Gray),
        "darkgray" | "darkgrey" | "dark gray" | "dark grey" => Ok(Color::DarkGray),
        "lightred" | "light red" => Ok(Color::LightRed),
        "lightgreen" | "light green" => Ok(Color::LightGreen),
        "lightyellow" | "light yellow" => Ok(Color::LightYellow),
        "lightblue" | "light blue" => Ok(Color::LightBlue),
        "lightmagenta" | "light magenta" => Ok(Color::LightMagenta),
        "lightcyan" | "light cyan" => Ok(Color::LightCyan),
        "white" => Ok(Color::White),
        _ => Err(format!(
            "'{colour_name}' is an invalid named colour.

The following are supported named colours:
+--------+-------------+---------------------+
|  Reset | Magenta     | Light Yellow        |
+--------+-------------+---------------------+
|  Black | Cyan        | Light Blue          |
+--------+-------------+---------------------+
|   Red  | Gray/Grey   | Light Magenta       |
+--------+-------------+---------------------+
|  Green | Light Cyan  | Dark Gray/Dark Grey |
+--------+-------------+---------------------+
| Yellow | Light Red   | White               |
+--------+-------------+---------------------+
|  Blue  | Light Green |                     |
+--------+-------------+---------------------+

Alternatively, hex colours or RGB colour codes are valid.\n"
        )),
    }
}

macro_rules! opt {
    ($($e: tt)+) => {
        (|| { $($e)+ })()
    }
}

macro_rules! set_style {
    ($palette_field:expr, $config_location:expr, $field:tt) => {
        if let Some(style) = &(opt!($config_location.as_ref()?.$field.as_ref())) {
            match &style {
                TextStyleConfig::Colour(colour) => {
                    $palette_field = $palette_field.fg(
                        crate::options::config::style::utils::str_to_colour(&colour.0).map_err(
                            |err| match stringify!($config_location).split_once(".") {
                                Some((_, loc)) => crate::options::OptionError::config(format!(
                                    "Please update 'styles.{loc}.{}' in your config file. {err}",
                                    stringify!($field)
                                )),
                                None => crate::options::OptionError::config(format!(
                                    "Please update 'styles.{}' in your config file. {err}",
                                    stringify!($field)
                                )),
                            },
                        )?,
                    );
                }
                TextStyleConfig::TextStyle {
                    colour,
                    bg_colour,
                    bold,
                    italics,
                } => {
                    if let Some(fg) = &colour {
                        $palette_field = $palette_field
                            .fg(crate::options::config::style::utils::str_to_colour(
                            &fg.0,
                        )
                        .map_err(|err| {
                            match stringify!($config_location).split_once(".") {
                                Some((_, loc)) => crate::options::OptionError::config(format!(
                                    "Please update 'styles.{loc}.{}' in your config file. {err}",
                                    stringify!($field)
                                )),
                                None => crate::options::OptionError::config(format!(
                                    "Please update 'styles.{}' in your config file. {err}",
                                    stringify!($field)
                                )),
                            }
                        })?);
                    }

                    if let Some(bg) = &bg_colour {
                        $palette_field = $palette_field
                            .bg(crate::options::config::style::utils::str_to_colour(
                            &bg.0,
                        )
                        .map_err(|err| {
                            match stringify!($config_location).split_once(".") {
                                Some((_, loc)) => crate::options::OptionError::config(format!(
                                    "Please update 'styles.{loc}.{}' in your config file. {err}",
                                    stringify!($field)
                                )),
                                None => crate::options::OptionError::config(format!(
                                    "Please update 'styles.{}' in your config file. {err}",
                                    stringify!($field)
                                )),
                            }
                        })?);
                    }

                    if let Some(bold) = &bold {
                        if *bold {
                            $palette_field =
                                $palette_field.add_modifier(ratatui::style::Modifier::BOLD);
                        } else {
                            $palette_field =
                                $palette_field.remove_modifier(ratatui::style::Modifier::BOLD);
                        }
                    }

                    if let Some(italics) = &italics {
                        if *italics {
                            $palette_field =
                                $palette_field.add_modifier(ratatui::style::Modifier::ITALIC);
                        } else {
                            $palette_field =
                                $palette_field.remove_modifier(ratatui::style::Modifier::ITALIC);
                        }
                    }
                }
            }
        }
    };
}

macro_rules! set_colour {
    ($palette_field:expr, $config_location:expr, $field:tt) => {
        if let Some(colour) = &(opt!($config_location.as_ref()?.$field.as_ref())) {
            $palette_field = $palette_field.fg(
                crate::options::config::style::utils::str_to_colour(&colour.0).map_err(|err| {
                    match stringify!($config_location).split_once(".") {
                        Some((_, loc)) => crate::options::OptionError::config(format!(
                            "Please update 'styles.{loc}.{}' in your config file. {err}",
                            stringify!($field)
                        )),
                        None => crate::options::OptionError::config(format!(
                            "Please update 'styles.{}' in your config file. {err}",
                            stringify!($field)
                        )),
                    }
                })?,
            );
        }
    };
}

macro_rules! set_bg_colour {
    ($palette_field:expr, $config_location:expr, $field:tt) => {
        if let Some(colour) = &(opt!($config_location.as_ref()?.$field.as
```

### Core Architecture Module: `src/utils/cancellation_token.rs`
```
use std::{
    sync::{Condvar, Mutex},
    time::Duration,
};

/// A cancellation token.
pub(crate) struct CancellationToken {
    // The "check" for the cancellation token. Setting this to true will mark the cancellation
    // token as "cancelled".
    mutex: Mutex<bool>,
    cvar: Condvar,
}

impl Default for CancellationToken {
    fn default() -> Self {
        Self {
            mutex: Mutex::new(false),
            cvar: Condvar::new(),
        }
    }
}

impl CancellationToken {
    /// Mark the [`CancellationToken`] as cancelled.
    ///
    /// This is idempotent, and once cancelled, will stay cancelled. Sending it
    /// again will not do anything.
    pub fn cancel(&self) {
        let mut guard = self
            .mutex
            .lock()
            .expect("cancellation token lock should not be poisoned");

        if !*guard {
            *guard = true;
            self.cvar.notify_all();
        }
    }

    /// Try and check the [`CancellationToken`]'s status. Note that
    /// this will not block.
    pub fn try_check(&self) -> Option<bool> {
        self.mutex.try_lock().ok().map(|guard| *guard)
    }

    /// Allows a thread to sleep while still being interruptible with by the
    /// token.
    ///
    /// Returns the condition state after either sleeping or being woken up.
    pub fn sleep_with_cancellation(&self, duration: Duration) -> bool {
        let guard = self
            .mutex
            .lock()
            .expect("cancellation token lock should not be poisoned");

        let (result, _) = self
            .cvar
            .wait_timeout(guard, duration)
            .expect("cancellation token lock should not be poisoned");

        *result
    }
}

```

### Core Architecture Module: `src/utils/conversion.rs`
```
//! This mainly concerns converting collected data into things that the canvas
//! can actually handle.

use crate::utils::data_units::*;

/// Returns the most appropriate binary prefix unit type (e.g. kibibyte) and
/// denominator for the given amount of bytes.
///
/// The expected usage is to divide out the given value with the returned
/// denominator in order to be able to use it with the returned binary unit
/// (e.g. divide 3000 bytes by 1024 to have a value in KiB).
#[inline]
pub(crate) fn get_binary_unit_and_denominator(bytes: u64) -> (&'static str, f64) {
    match bytes {
        b if b < KIBI_LIMIT => ("B", 1.0),
        b if b < MEBI_LIMIT => ("KiB", KIBI_LIMIT_F64),
        b if b < GIBI_LIMIT => ("MiB", MEBI_LIMIT_F64),
        b if b < TEBI_LIMIT => ("GiB", GIBI_LIMIT_F64),
        _ => ("TiB", TEBI_LIMIT_F64),
    }
}

/// Returns a decimal-prefixed string given a value that is converted to the
/// closest SI-variant, per second. If the value is greater than a giga-X,
/// then it will return a decimal place.
#[inline]
pub(crate) fn dec_bytes_per_second_string(value: u64) -> String {
    let converted_values = get_decimal_bytes(value);
    if value >= GIGA_LIMIT {
        format!("{:.1}{}/s", converted_values.0, converted_values.1)
    } else {
        format!("{:.0}{}/s", converted_values.0, converted_values.1)
    }
}

/// Returns a binary-prefixed string given a value that is converted to the
/// closest IEC-variant, per second. If the value is greater than a gibi-X,
/// then it will return a decimal place.
#[inline]
pub(crate) fn bin_bytes_per_second_string(value: u64) -> String {
    let converted_values = get_binary_bytes(value);
    if value >= GIBI_LIMIT {
        format!("{:.1}{}/s", converted_values.0, converted_values.1)
    } else {
        format!("{:.0}{}/s", converted_values.0, converted_values.1)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_dec_bytes_per_second_string() {
        assert_eq!(dec_bytes_per_second_string(0), "0B/s".to_string());
        assert_eq!(dec_bytes_per_second_string(1), "1B/s".to_string());
        assert_eq!(dec_bytes_per_second_string(900), "900B/s".to_string());
        assert_eq!(dec_bytes_per_second_string(999), "999B/s".to_string());
        assert_eq!(dec_bytes_per_second_string(KILO_LIMIT), "1KB/s".to_string());
        assert_eq!(
            dec_bytes_per_second_string(KILO_LIMIT + 1),
            "1KB/s".to_string()
        );
        assert_eq!(dec_bytes_per_second_string(KIBI_LIMIT), "1KB/s".to_string());
        assert_eq!(dec_bytes_per_second_string(MEGA_LIMIT), "1MB/s".to_string());
        assert_eq!(
            dec_bytes_per_second_string(GIGA_LIMIT),
            "1.0GB/s".to_string()
        );
        assert_eq!(
            dec_bytes_per_second_string(2 * GIGA_LIMIT),
            "2.0GB/s".to_string()
        );
        assert_eq!(
            dec_bytes_per_second_string((2.5 * GIGA_LIMIT as f64) as u64),
            "2.5GB/s".to_string()
        );
        assert_eq!(
            dec_bytes_per_second_string((10.34 * TERA_LIMIT as f64) as u64),
            "10.3TB/s".to_string()
        );
        assert_eq!(
            dec_bytes_per_second_string((10.36 * TERA_LIMIT as f64) as u64),
            "10.4TB/s".to_string()
        );
    }

    #[test]
    fn test_bin_bytes_per_second_string() {
        assert_eq!(bin_bytes_per_second_string(0), "0B/s".to_string());
        assert_eq!(bin_bytes_per_second_string(1), "1B/s".to_string());
        assert_eq!(bin_bytes_per_second_string(900), "900B/s".to_string());
        assert_eq!(
            bin_bytes_per_second_string(KILO_LIMIT),
            "1000B/s".to_string()
        );
        assert_eq!(bin_bytes_per_second_string(1023), "1023B/s".to_string());
        assert_eq!(
            bin_bytes_per_second_string(KIBI_LIMIT),
            "1KiB/s".to_string()
        );
        assert_eq!(
            bin_bytes_per_second_string(KIBI_LIMIT + 1),
            "1KiB/s".to_string()
        );
        assert_eq!(
            bin_bytes_per_second_string(MEBI_LIMIT),
            "1MiB/s".to_string()
        );

        // The decimal place is added past a gibibyte, not a gigabyte.
        assert_eq!(
            bin_bytes_per_second_string(GIGA_LIMIT),
            "954MiB/s".to_string()
        );
        assert_eq!(
            bin_bytes_per_second_string(GIBI_LIMIT - 1),
            "1024MiB/s".to_string()
        );

        assert_eq!(
            bin_bytes_per_second_string(GIBI_LIMIT),
            "1.0GiB/s".to_string()
        );
        assert_eq!(
            bin_bytes_per_second_string(2 * GIBI_LIMIT),
            "2.0GiB/s".to_string()
        );
        assert_eq!(
            bin_bytes_per_second_string((2.5 * GIBI_LIMIT as f64) as u64),
            "2.5GiB/s".to_string()
        );
        assert_eq!(
            bin_bytes_per_second_string((10.34 * TEBI_LIMIT as f64) as u64),
            "10.3TiB/s".to_string()
        );
        assert_eq!(
            bin_bytes_per_second_string((10.36 * TEBI_LIMIT as f64) as u64),
            "10.4TiB/s".to_string()
        );
    }
}

```

### Core Architecture Module: `src/utils/data_units.rs`
```
#[derive(Debug, Clone, Copy, Eq, PartialEq, Default)]
pub enum DataUnit {
    Byte,
    #[default]
    Bit,
}

pub const KILO_LIMIT: u64 = 1000;
pub const MEGA_LIMIT: u64 = 1_000_000;
pub const GIGA_LIMIT: u64 = 1_000_000_000;
pub const TERA_LIMIT: u64 = 1_000_000_000_000;
pub const KIBI_LIMIT: u64 = 1024;
pub const MEBI_LIMIT: u64 = 1024 * 1024;
pub const GIBI_LIMIT: u64 = 1024 * 1024 * 1024;
pub const TEBI_LIMIT: u64 = 1024 * 1024 * 1024 * 1024;

pub const KILO_LIMIT_F64: f64 = 1000.0;
pub const MEGA_LIMIT_F64: f64 = 1_000_000.0;
pub const GIGA_LIMIT_F64: f64 = 1_000_000_000.0;
pub const TERA_LIMIT_F64: f64 = 1_000_000_000_000.0;
pub const KIBI_LIMIT_F64: f64 = 1024.0;
pub const MEBI_LIMIT_F64: f64 = 1024.0 * 1024.0;
pub const GIBI_LIMIT_F64: f64 = 1024.0 * 1024.0 * 1024.0;
pub const TEBI_LIMIT_F64: f64 = 1024.0 * 1024.0 * 1024.0 * 1024.0;

pub const LOG_MEGA_LIMIT: f64 = 6.0;
pub const LOG_GIGA_LIMIT: f64 = 9.0;
pub const LOG_TERA_LIMIT: f64 = 12.0;
pub const LOG_PETA_LIMIT: f64 = 15.0;

pub const LOG_MEBI_LIMIT: f64 = 20.0;
pub const LOG_GIBI_LIMIT: f64 = 30.0;
pub const LOG_TEBI_LIMIT: f64 = 40.0;
pub const LOG_PEBI_LIMIT: f64 = 50.0;

/// Returns a tuple containing the value and the unit in bytes. In units of
/// 1024. This only supports up to a tebi.  Note the "single" unit will have a
/// space appended to match the others if `spacing` is true.
#[inline]
pub fn get_binary_bytes(bytes: u64) -> (f64, &'static str) {
    match bytes {
        b if b < KIBI_LIMIT => (bytes as f64, "B"),
        b if b < MEBI_LIMIT => (bytes as f64 / KIBI_LIMIT_F64, "KiB"),
        b if b < GIBI_LIMIT => (bytes as f64 / MEBI_LIMIT_F64, "MiB"),
        b if b < TEBI_LIMIT => (bytes as f64 / GIBI_LIMIT_F64, "GiB"),
        _ => (bytes as f64 / TEBI_LIMIT_F64, "TiB"),
    }
}

/// Returns a tuple containing the value and the unit in bytes. In units of
/// 1000. This only supports up to a tera.  Note the "single" unit will have a
/// space appended to match the others if `spacing` is true.
#[inline]
pub fn get_decimal_bytes(bytes: u64) -> (f64, &'static str) {
    match bytes {
        b if b < KILO_LIMIT => (bytes as f64, "B"),
        b if b < MEGA_LIMIT => (bytes as f64 / KILO_LIMIT_F64, "KB"),
        b if b < GIGA_LIMIT => (bytes as f64 / MEGA_LIMIT_F64, "MB"),
        b if b < TERA_LIMIT => (bytes as f64 / GIGA_LIMIT_F64, "GB"),
        _ => (bytes as f64 / TERA_LIMIT_F64, "TB"),
    }
}

/// Given a value in _bits_, turn a tuple containing the value and a unit.
#[inline]
pub fn convert_bits(bits: u64, base_two: bool) -> (f64, &'static str) {
    convert_bytes(bits / 8, base_two)
}

/// Given a value in _bytes_, turn a tuple containing the value and a unit.
#[inline]
pub fn convert_bytes(bytes: u64, base_two: bool) -> (f64, &'static str) {
    if base_two {
        get_binary_bytes(bytes)
    } else {
        get_decimal_bytes(bytes)
    }
}

/// Return a tuple containing the value and a unit string to be used as a
/// prefix.
#[inline]
pub fn get_unit_prefix(value: u64, base_two: bool) -> (f64, &'static str) {
    let float_value = value as f64;

    if base_two {
        match value {
            b if b < KIBI_LIMIT => (float_value, ""),
            b if b < MEBI_LIMIT => (float_value / KIBI_LIMIT_F64, "Ki"),
            b if b < GIBI_LIMIT => (float_value / MEBI_LIMIT_F64, "Mi"),
            b if b < TEBI_LIMIT => (float_value / GIBI_LIMIT_F64, "Gi"),
            _ => (float_value / TEBI_LIMIT_F64, "Ti"),
        }
    } else {
        match value {
            b if b < KILO_LIMIT => (float_value, ""),
            b if b < MEGA_LIMIT => (float_value / KILO_LIMIT_F64, "K"),
            b if b < GIGA_LIMIT => (float_value / MEGA_LIMIT_F64, "M"),
            b if b < TERA_LIMIT => (float_value / GIGA_LIMIT_F64, "G"),
            _ => (float_value / TERA_LIMIT_F64, "T"),
        }
    }
}

/// Format a float value to a string in a format showing a (hopefully) reasonable amount of decimal
/// places.
/// - If the value is < 100, then it will show at most two decimal places; if the decimals have
///   trailing 0s, they will be trimmed.
/// - Likewise, if it is < 1000, then it will show just 1 decimal place at most.
/// - If the value is >= 1000, then it will just omit decimals.
#[inline]
pub fn format_byte_decimal_values(value: f64) -> String {
    if value >= 1000.0 {
        // Don't show decimals for values with 4 or more digits anyway.
        format!("{value:.0}")
    } else if value >= 100.0 {
        // Note the trim is safe, as `value:.2` will always emit a decimal place.
        format!("{value:.1}")
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    } else {
        // Note the trim is safe, as `value:.2` will always emit a decimal place.
        format!("{value:.2}")
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes_value() {
        assert_eq!(format_byte_decimal_values(0.0), "0");
        assert_eq!(format_byte_decimal_values(5.0), "5");
        assert_eq!(format_byte_decimal_values(100.0), "100");
        assert_eq!(format_byte_decimal_values(101.0), "101");
        assert_eq!(format_byte_decimal_values(111.0), "111");
        assert_eq!(format_byte_decimal_values(111.04), "111");
        assert_eq!(format_byte_decimal_values(111.06), "111.1");
        assert_eq!(
            format_byte_decimal_values(111.05),
            "111",
            "note that this actually rounds down due to floating point BS :/"
        );
        assert_eq!(format_byte_decimal_values(111.6), "111.6");
        assert_eq!(format_byte_decimal_values(128.05), "128.1");
        assert_eq!(format_byte_decimal_values(1234.0), "1234");
        assert_eq!(format_byte_decimal_values(1234.05), "1234");
        assert_eq!(format_byte_decimal_values(1.25), "1.25");
        assert_eq!(format_byte_decimal_values(1.2), "1.2");
        assert_eq!(format_byte_decimal_values(10.4), "10.4");
        assert_eq!(format_byte_decimal_values(356.5), "356.5");
        assert_eq!(format_byte_decimal_values(536.870912), "536.9");
        assert_eq!(format_byte_decimal_values(36.870912), "36.87");
        assert_eq!(format_byte_decimal_values(1.048576), "1.05");
    }
}

```

### Core Architecture Module: `src/utils/general.rs`
```
use std::cmp::Ordering;

#[inline]
pub(crate) const fn sort_partial_fn<T: PartialOrd>(is_descending: bool) -> fn(T, T) -> Ordering {
    if is_descending {
        partial_ordering_desc
    } else {
        partial_ordering
    }
}

/// Returns an [`Ordering`] between two [`PartialOrd`]s.
#[inline]
pub(crate) fn partial_ordering<T: PartialOrd>(a: T, b: T) -> Ordering {
    a.partial_cmp(&b).unwrap_or(Ordering::Equal)
}

/// Returns a reversed [`Ordering`] between two [`PartialOrd`]s.
///
/// This is simply a wrapper function around [`partial_ordering`] that reverses
/// the result.
#[inline]
pub(crate) fn partial_ordering_desc<T: PartialOrd>(a: T, b: T) -> Ordering {
    partial_ordering(a, b).reverse()
}

/// A trait for additional clamping functions on numeric types.
pub(crate) trait ClampExt {
    /// Restrict a value by a lower bound. If the current value is _lower_ than
    /// `lower_bound`, it will be set to `_lower_bound`.
    #[cfg_attr(not(test), expect(dead_code))]
    fn clamp_lower(&self, lower_bound: Self) -> Self;

    /// Restrict a value by an upper bound. If the current value is _greater_
    /// than `upper_bound`, it will be set to `upper_bound`.
    fn clamp_upper(&self, upper_bound: Self) -> Self;
}

macro_rules! clamp_num_impl {
    ( $($NumType:ty),+ $(,)? ) => {
        $(
            impl ClampExt for $NumType {
                fn clamp_lower(&self, lower_bound: Self) -> Self {
                    if *self < lower_bound {
                        lower_bound
                    } else {
                        *self
                    }
                }

                fn clamp_upper(&self, upper_bound: Self) -> Self {
                    if *self > upper_bound {
                        upper_bound
                    } else {
                        *self
                    }
                }
            }
        )*
    };
}

clamp_num_impl!(u8, u16, u32, u64, usize);

/// Checked log2.
pub(crate) fn saturating_log2(value: f64) -> f64 {
    if value > 0.0 { value.log2() } else { 0.0 }
}

/// Checked log10.
pub(crate) fn saturating_log10(value: f64) -> f64 {
    if value > 0.0 { value.log10() } else { 0.0 }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_clamp_upper() {
        let val: usize = 100;
        assert_eq!(val.clamp_upper(150), 100);

        let val: usize = 100;
        assert_eq!(val.clamp_upper(100), 100);

        let val: usize = 100;
        assert_eq!(val.clamp_upper(50), 50);
    }

    #[test]
    fn test_clamp_lower() {
        let val: usize = 100;
        assert_eq!(val.clamp_lower(150), 150);

        let val: usize = 100;
        assert_eq!(val.clamp_lower(100), 100);

        let val: usize = 100;
        assert_eq!(val.clamp_lower(50), 100);
    }

    #[test]
    fn test_sort_partial_fn() {
        let mut x = vec![9, 5, 20, 15, 10, 5];
        let mut y = vec![1.0, 15.0, -1.0, -100.0, -100.1, 16.15, -100.0];

        x.sort_by(|a, b| sort_partial_fn(false)(a, b));
        assert_eq!(x, vec![5, 5, 9, 10, 15, 20]);

        x.sort_by(|a, b| sort_partial_fn(true)(a, b));
        assert_eq!(x, vec![20, 15, 10, 9, 5, 5]);

        y.sort_by(|a, b| sort_partial_fn(false)(a, b));
        assert_eq!(y, vec![-100.1, -100.0, -100.0, -1.0, 1.0, 15.0, 16.15]);

        y.sort_by(|a, b| sort_partial_fn(true)(a, b));
        assert_eq!(y, vec![16.15, 15.0, 1.0, -1.0, -100.0, -100.0, -100.1]);
    }
}

```

### Core Architecture Module: `src/utils/input.rs`
```
//! Generalized input logic, to make it easier to reuse logic like unicode
//! handling and cursor movement.

use std::ops::Range;

use concat_string::concat_string;
use unicode_ellipsis::grapheme_width;
use unicode_segmentation::{GraphemeCursor, GraphemeIncomplete, UnicodeSegmentation};

use crate::{app::CursorDirection, utils::int_hash::IntIndexMap};

/// An input field's state.
pub struct InputFieldState {
    /// The search query itself, what is shown.
    current_query: String,

    /// The internal grapheme cursor to track the current location.
    grapheme_cursor: GraphemeCursor,

    /// The direction the cursor is heading at the moment. Modified
    /// by user actions, e.g. adding text moves it right, deleting
    /// text moves it left, the user scrolling changes it based
    /// on where they scroll, etc.
    cursor_direction: CursorDirection,

    /// Determines where we start _displaying_ the search based on
    /// the user's scroll. For example, if they move the cursor 5
    /// units to the right from 0, the index should be 5.
    display_start_index: usize,

    /// Used for internal tracking of _byte_ indices to the widths
    /// of the graphemes they represent. This is mostly used to cache
    /// and avoid having to re-calculate widths each time it needs to
    /// be accessed.
    ///
    /// Should always be updated after the search query updates in any way.
    size_mappings: IntIndexMap<usize, Range<usize>>,
}

impl Default for InputFieldState {
    fn default() -> Self {
        Self {
            current_query: String::default(),
            grapheme_cursor: GraphemeCursor::new(0, 0, true),
            cursor_direction: CursorDirection::Right,
            display_start_index: 0,
            size_mappings: IntIndexMap::default(),
        }
    }
}

impl InputFieldState {
    /// Get a reference to the current query.
    #[inline]
    pub(crate) fn current_query(&self) -> &str {
        &self.current_query
    }

    /// Get the current cursor index.
    #[inline]
    pub(crate) fn cursor_index(&self) -> usize {
        self.grapheme_cursor.cur_cursor()
    }

    /// Get the display start index.
    #[inline]
    pub(crate) fn display_start_index(&self) -> usize {
        self.display_start_index
    }

    /// Sets the starting grapheme index to draw from.
    ///
    /// TODO: This is kinda weird, we might want to decouple this in some way
    /// such that this is clear this only matters for drawing... but it also
    /// changes states...
    pub(crate) fn get_start_position(&mut self, available_width: usize, is_force_redraw: bool) {
        // Remember - the number of columns != the number of grapheme
        // slots/sizes, you cannot use index to determine this reliably!

        let start_index = if is_force_redraw {
            0
        } else {
            self.display_start_index
        };
        let cursor_index = self.cursor_index();

        if let Some(start_range) = self.size_mappings.get(&start_index) {
            let cursor_range = self
                .size_mappings
                .get(&cursor_index)
                .cloned()
                .unwrap_or_else(|| {
                    self.size_mappings
                        .last()
                        .map(|(_, r)| r.end..(r.end + 1))
                        .unwrap_or(start_range.end..(start_range.end + 1))
                });

            // Cases to handle in both cases:
            // - The current start index can show the cursor's word.
            // - The current start index cannot show the cursor's word.
            //
            // What differs is how we "scroll" based on the cursor movement
            // direction.

            self.display_start_index = match self.cursor_direction {
                CursorDirection::Right => {
                    if start_range.start + available_width >= cursor_range.end {
                        // Use the current index.
                        start_index
                    } else if cursor_range.end >= available_width {
                        // If the current position is past the last visible
                        // element, skip until we
                        // see it.

                        let mut index = 0;
                        for i in 0..(cursor_index + 1) {
                            if let Some(r) = self.size_mappings.get(&i)
                                && r.start + available_width >= cursor_range.end
                            {
                                index = i;
                                break;
                            }
                        }

                        index
                    } else {
                        0
                    }
                }
                CursorDirection::Left => {
                    if cursor_range.start < start_range.end {
                        let mut index = 0;
                        for i in cursor_index..(self.current_query.len()) {
                            if let Some(r) = self.size_mappings.get(&i)
                                && r.start + available_width >= cursor_range.end
                            {
                                index = i;
                                break;
                            }
                        }
                        index
                    } else {
                        start_index
                    }
                }
            };
        } else {
            // If we fail here somehow, just reset to 0 index + scroll left.
            self.display_start_index = 0;
            self.cursor_direction = CursorDirection::Left;
        };
    }

    /// Move the cursor one _grapheme_ forward.
    fn walk_forward(&mut self) {
        let start_position = self.cursor_index();
        let chunk = &self.current_query[start_position..];

        match self.grapheme_cursor.next_boundary(chunk, start_position) {
            Ok(_) => {}
            Err(err) => match err {
                GraphemeIncomplete::PreContext(ctx) => {
                    // Provide the entire string as context. Not efficient but
                    // should resolve failures.
                    self.grapheme_cursor
                        .provide_context(&self.current_query[0..ctx], 0);

                    self.grapheme_cursor
                        .next_boundary(chunk, start_position)
                        .expect("another grapheme boundary should exist after the cursor with the provided context");
                }
                _ => panic!("{err:?}"),
            },
        }
    }

    /// Move the cursor one _grapheme_ backward.
    fn walk_backward(&mut self) {
        let start_position = self.cursor_index();
        let chunk = &self.current_query[..start_position];

        match self.grapheme_cursor.prev_boundary(chunk, 0) {
            Ok(_) => {}
            Err(err) => match err {
                GraphemeIncomplete::PreContext(ctx) => {
                    // Provide the entire string as context. Not efficient but
                    // should resolve failures.
                    self.grapheme_cursor
                        .provide_context(&self.current_query[0..ctx], 0);

                    self.grapheme_cursor
                        .prev_boundary(chunk, 0)
                        .expect("another grapheme boundary should exist before the cursor with the provided context");
                }
                _ => panic!("{err:?}"),
            },
        }
    }

    /// Update the size mappings (mapping of index to the display width range)
    /// after the query has been updated in any way. This should be called
    /// whenever the query is updated.
    ///
    /// TODO: This might be a bit expensive, maybe we could update this a bit
    /// more iteratively?
    fn update_sizes(&mut self) {
        self.size_mappings.clear();
        let mut curr_offset = 0;
        for (index, grapheme) in
            UnicodeSegmentation::grapheme_indices(self.current_query.as_str(), true)
        {
            let width = grapheme_width(grapheme);
            let end = curr_offset + width;

            self.size_mappings.insert(index, curr_offset..end);

            curr_offset = end;
        }
    }

    /// Delete whatever the cursor is currently highlighting, if anything. This
    /// is analogous to pressing `Delete`.
    pub(crate) fn delete_at_cursor(&mut self) {
        let current_cursor = self.cursor_index();
        if current_cursor < self.current_query.len() {
            self.walk_forward();
            let new_cursor = self.cursor_index();

            let _ = self.current_query.drain(current_cursor..new_cursor);

            self.grapheme_cursor =
                GraphemeCursor::new(current_cursor, self.current_query.len(), true);

            self.update_sizes();
        }
    }

    /// Delete what is _behind_ the cursor. This is analogous to pressing
    /// `Backspace`.
    pub(crate) fn delete_behind_cursor(&mut self) {
        let current_cursor = self.cursor_index();

        if current_cursor > 0 {
            self.walk_backward();
            let new_cursor = self.cursor_index();

            // Remove the indices in between.
            let _ = self.current_query.drain(new_cursor..current_cursor);

            self.grapheme_cursor = GraphemeCursor::new(new_cursor, self.current_query.len(), true);

            self.cursor_direction = CursorDirection::Left;

            self.update_sizes();
        }
    }

    /// Move the cursor left one unit if possible.
    pub(crate) fn move_left(&mut self) {
        let current_cursor = self.cursor_index();
        self.walk_backward();
        if self.cursor_index() < current_cursor {
            self.cursor_direction = CursorDirection::Left;
        }
    }

    /// Move the cursor right one unit if possible.
    pub(crate) fn move_right(&mut self) {
        let current_cursor = self.cursor_index();
        self.walk_forward();
        if self.curs
```

### Core Architecture Module: `src/utils/int_hash.rs`
```
//! A simple hasher that literally just maps an int to itself.
//!
//! Originally based on <https://github.com/tetcoin/nohash/blob/master/src/lib.rs>.

use std::{
    hash::{BuildHasherDefault, Hasher},
    marker::PhantomData,
};

use indexmap::IndexMap;

type IntHasherState<K> = BuildHasherDefault<IntHasher<K>>;

/// A hash map that directly maps from an integer key to a value.
pub type IntHashMap<K, V> = std::collections::HashMap<K, V, IntHasherState<K>>;

/// A hash set that directly uses integer keys.
#[allow(dead_code)]
pub type IntHashSet<K> = std::collections::HashSet<K, IntHasherState<K>>;

/// An [`IndexMap`] wrapper such that it tracks insertion order, but uses
/// integer keys.
pub type IntIndexMap<K, V> = IndexMap<K, V, IntHasherState<K>>;

pub trait SupportedInt {}

impl SupportedInt for u8 {}
impl SupportedInt for u16 {}
impl SupportedInt for u32 {}
impl SupportedInt for u64 {}
impl SupportedInt for usize {}
impl SupportedInt for i8 {}
impl SupportedInt for i16 {}
impl SupportedInt for i32 {}
impl SupportedInt for i64 {}
impl SupportedInt for isize {}

#[derive(Default)]
pub struct IntHasher<T: SupportedInt> {
    inner: u64,
    _marker: PhantomData<T>,
}

impl<T: SupportedInt> Hasher for IntHasher<T> {
    fn finish(&self) -> u64 {
        self.inner
    }

    fn write(&mut self, _bytes: &[u8]) {
        panic!("IntHasher does not support arbitrary writes")
    }

    fn write_u8(&mut self, i: u8) {
        self.inner = i as u64;
    }

    fn write_u16(&mut self, i: u16) {
        self.inner = i as u64;
    }

    fn write_u32(&mut self, i: u32) {
        self.inner = i as u64;
    }

    fn write_u64(&mut self, i: u64) {
        self.inner = i;
    }

    fn write_usize(&mut self, i: usize) {
        self.inner = i as u64;
    }

    fn write_i8(&mut self, i: i8) {
        self.inner = i as u64;
    }

    fn write_i16(&mut self, i: i16) {
        self.inner = i as u64;
    }

    fn write_i32(&mut self, i: i32) {
        self.inner = i as u64;
    }

    fn write_i64(&mut self, i: i64) {
        self.inner = i as u64;
    }

    fn write_isize(&mut self, i: isize) {
        self.inner = i as u64;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_u8() {
        let mut hasher = IntHasher::<u8>::default();
        hasher.write_u8(42);
        assert_eq!(hasher.finish(), 42);
    }

    #[test]
    fn test_u16() {
        let mut hasher = IntHasher::<u16>::default();
        hasher.write_u16(4242);
        assert_eq!(hasher.finish(), 4242);
    }

    #[test]
    fn test_u32() {
        let mut hasher = IntHasher::<u32>::default();
        hasher.write_u32(424242);
        assert_eq!(hasher.finish(), 424242);
    }

    #[test]
    fn test_u64() {
        let mut hasher = IntHasher::<u64>::default();
        hasher.write_u64(4242424242);
        assert_eq!(hasher.finish(), 4242424242);
    }

    #[test]
    fn test_usize() {
        let mut hasher = IntHasher::<usize>::default();
        hasher.write_usize(999999);
        assert_eq!(hasher.finish(), 999999);
    }

    #[test]
    fn test_i8() {
        let mut hasher = IntHasher::<i8>::default();
        hasher.write_i8(-42);
        assert_eq!(hasher.finish(), -42_i8 as u64);
    }

    #[test]
    fn test_i16() {
        let mut hasher = IntHasher::<i16>::default();
        hasher.write_i16(-4242);
        assert_eq!(hasher.finish(), -4242_i64 as u64);
    }

    #[test]
    fn test_i32() {
        let mut hasher = IntHasher::<i32>::default();
        hasher.write_i32(-424242);
        assert_eq!(hasher.finish(), -424242_i64 as u64);
    }

    #[test]
    fn test_i64() {
        let mut hasher = IntHasher::<i64>::default();
        hasher.write_i64(-4242424242);
        assert_eq!(hasher.finish(), -4242424242_i64 as u64);
    }

    #[test]
    fn test_isize() {
        let mut hasher = IntHasher::<isize>::default();
        hasher.write_isize(-424242);
        assert_eq!(hasher.finish(), -424242_isize as u64);
    }

    #[test]
    fn test_int_hash_map() {
        let mut map = IntHashMap::<u32, &str>::default();
        map.insert(1, "one");
        map.insert(2, "two");
        assert_eq!(map.get(&1), Some(&"one"));
        assert_eq!(map.get(&2), Some(&"two"));
        assert_eq!(map.get(&3), None);
    }

    #[test]
    fn test_int_hash_set() {
        let mut set = IntHashSet::<u32>::default();
        set.insert(1);
        set.insert(2);
        assert!(set.contains(&1));
        assert!(set.contains(&2));
        assert!(!set.contains(&3));
    }

    #[test]
    fn test_int_index_map() {
        let mut map = IntIndexMap::<u32, &str>::default();
        map.insert(1, "one");
        map.insert(3, "three");
        map.insert(2, "two");
        assert_eq!(map.get(&1), Some(&"one"));
        assert_eq!(map.get(&2), Some(&"two"));
        assert_eq!(map.get(&3), Some(&"three"));
        assert_eq!(map.get(&4), None);

        assert_eq!(map.keys().cloned().collect::<Vec<_>>(), vec![1, 3, 2]);
        assert_eq!(
            map.values().cloned().collect::<Vec<_>>(),
            vec!["one", "three", "two"]
        );
    }
}

```

### Core Architecture Module: `src/utils/logging.rs`
```
#[cfg(feature = "logging")]
pub fn init_logger(
    min_level: log::LevelFilter, debug_file_name: Option<&std::ffi::OsStr>,
) -> anyhow::Result<()> {
    let dispatch = fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "[{}][{}][{}] {}",
                humantime::format_rfc3339_nanos(std::time::SystemTime::now()),
                record.target(),
                record.level(),
                message
            ))
        })
        .level(min_level);

    if let Some(debug_file_name) = debug_file_name {
        dispatch.chain(fern::log_file(debug_file_name)?).apply()?;
    } else {
        dispatch.chain(std::io::stdout()).apply()?;
    }

    Ok(())
}

#[macro_export]
macro_rules! error {
    ($($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            log::error!($($x)*);
        }
    };
}

#[macro_export]
macro_rules! warn {
    ($($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            log::warn!($($x)*);
        }
    };
}

#[macro_export]
macro_rules! info {
    ($($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            log::info!($($x)*);
        }
    };
}

#[macro_export]
macro_rules! debug {
    ($($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            log::debug!($($x)*);
        }
    };
}

#[macro_export]
macro_rules! trace {
    ($($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            log::trace!($($x)*);
        }
    };
}

#[macro_export]
macro_rules! log {
    ($($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            log::log!(log::Level::Trace, $($x)*);
        }
    };
    ($level:expr, $($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            log::log!($level, $($x)*);
        }
    };
}

#[macro_export]
macro_rules! info_every_n_secs {
    ($n:expr, $($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            $crate::log_every_n_secs!(log::Level::Info, $n, $($x)*);
        }
    };
}

#[macro_export]
macro_rules! log_every_n_secs {
    ($level:expr, $n:expr, $($x:tt)*) => {
        #[cfg(feature = "logging")]
        {
            use std::sync::atomic::{AtomicU64, Ordering};
            static LAST_LOG: AtomicU64 = AtomicU64::new(0);
            let since_last_log = LAST_LOG.load(Ordering::Relaxed);
            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).expect("should be valid").as_secs();

            if now - since_last_log > $n {
                LAST_LOG.store(now, Ordering::Relaxed);
                log::log!($level, $($x)*);
            }
        }
    };
}

#[cfg(test)]
mod test {
    #[cfg(feature = "logging")]
    /// We do this to ensure that the test logger is only initialized _once_ for
    /// things like the default test runner that run tests in the same process.
    ///
    /// This doesn't do anything if you use something like nextest, which runs
    /// a test-per-process, but that's fine.
    fn init_test_logger() {
        use std::sync::Once;

        static INIT: Once = Once::new();

        INIT.call_once(|| {
            super::init_logger(log::LevelFilter::Trace, None)
                .expect("initializing the logger should succeed");
        });
    }

    #[cfg(feature = "logging")]
    #[test]
    fn test_logging_macros() {
        init_test_logger();

        error!("This is an error.");
        warn!("This is a warning.");
        info!("This is an info.");
        debug!("This is a debug.");
        info!("This is a trace.");
    }

    #[cfg(feature = "logging")]
    #[test]
    fn test_log_every_macros() {
        init_test_logger();

        info_every_n_secs!(10, "This is an info every 10 seconds.");
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2255** (2026-09-21): **Wrong CPU core count monitored**
  *Symptoms*: ### Checklist  - [x] I've looked through the [troubleshooting docs](https://bottom.pages.dev/nightly/troubleshooting), [the known problems list](https://bottom.pages.dev/nightly/support/official/#known-problems), and  [existing open issues](https://github.com/ClementTsang/bottom/issues?q=is%3Aopen+is%3Aissue) for similar issues.  - [x] I've read through the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md) and am following it when reporting this bug.   ### What operating system and version are you using?  7.2.6-arch2-1  ### What architecture are you using?  x86  ### What terminal(s) are you running bottom on that are experiencing the problem?  alacritty 0.17.0 kitty 0.48.2 created by Kovid Goyal  ### (Optional) What filesystem(s) are you using?  _No response_  ### What version of bottom are you running?  0.14.9  ### How did you install bottom?  Installed bottom through the official Arch extra repository using pacman extra/bottom 0.14.9-1 [installed  ### Describe the issue  bottom is showing only cpu0 to cpu5 in the cpu monitor. I have an 8 thread cpu (Intel® Core™ i7-1165G7 Processor) and bottom shows all 8 threads correctly in foot (foot version: 1.28.0).  ### What is the expected behaviour?  I expect to see all 8 cpu's monitored.  (see foot)  <img width="784" height="351" alt="Image" src="https://github.com/user-attachments/assets/8662b1e4-9ac2-4639-bb36-d36faaf8b2cc" />  ### What is the actual behaviour?  It only shows the first 6 cpus.  <img width
  **Post-Mortem & Fix Analysis**:
  > It appears i had a scaling issue, which pushed the cpu's out of the cpu monitoring frame.
  > Note that you can also scroll when the widget size is smaller than the options list length, there's a scrollbar option to make it more obvious but it's currently not enabled by default 😅 

- **Issue #2193** (2026-08-13): **Fix schema `$id` missing `v` prefix**
  *Symptoms*: ### Checklist  - [x] I've looked through the [troubleshooting docs](https://bottom.pages.dev/nightly/troubleshooting), [the known problems list](https://bottom.pages.dev/nightly/support/official/#known-problems), and  [existing open issues](https://github.com/ClementTsang/bottom/issues?q=is%3Aopen+is%3Aissue) for similar issues.  - [x] I've read through the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md) and am following it when reporting this bug.   ### What operating system and version are you using?  Arch Linux 6.18.33.2-microsoft-standard-WSL2  ### What architecture are you using?  x86_64/AMD64  ### What terminal(s) are you running bottom on that are experiencing the problem?  Windows Terminal v1.24.11911.0  ### (Optional) What filesystem(s) are you using?  _No response_  ### What version of bottom are you running?  0.14.7  ### How did you install bottom?  I installed bottom through the mise-en-place developer tool manager.  ### Describe the issue  The schema generator produces an incorrect `"$id"` URL: the version path is missing the leading `v` prefix (e.g., generated `/schema/0.14.7/...` instead of `/schema/v0.14.7/...`), causing the `$id` link to 404 when accessed. This is reflected in SchemaStore, where the published schema metadata points to a broken link. Fixing `"$id"` is necessary so SchemaStore serves the correct, resolvable schema and you can validate `bottom.toml` against the intended schema version.  ### What is the expected behavio
  **Post-Mortem & Fix Analysis**:
  > Gah, let me take a look at this. Thanks for reporting it.

- **Issue #2192** (2026-08-13): **Swap not shown**
  *Symptoms*: ### Checklist  - [x] I've looked through the [troubleshooting docs](https://bottom.pages.dev/nightly/troubleshooting), [the known problems list](https://bottom.pages.dev/nightly/support/official/#known-problems), and  [existing open issues](https://github.com/ClementTsang/bottom/issues?q=is%3Aopen+is%3Aissue) for similar issues.  - [x] I've read through the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md) and am following it when reporting this bug.   ### What operating system and version are you using?  NAS linux (i686)  ### What architecture are you using?  x86_64/AMD64  ### What terminal(s) are you running bottom on that are experiencing the problem?  N/A  ### (Optional) What filesystem(s) are you using?  _No response_  ### What version of bottom are you running?  nightly  ### How did you install bottom?  downloaded the binary (musl version)  ### Describe the issue  For some reason swap used to be shown before, but not anymore. If I type `free -h` or `cat /proc/swap` it is shown correctly in the command line, but not in bottom  ### What is the expected behaviour?  It used to work in a previous version no problem  ### What is the actual behaviour?  No swap data shown  ### How can we reproduce this?  Open bottom, and observe   ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > <img width="729" height="552" alt="Image" src="https://github.com/user-attachments/assets/37b2b779-920d-48f2-81c3-c0d0ee6eb61c" />  Hm, tried it just now and it works fine for me (tried both the musl and gnu versions) on Linux.
  > Could you show a screenshot or give any more details?
  > Hm, interesting, mine looks like this  <img width="296" height="309" alt="Image" src="https://github.com/user-attachments/assets/2f9d5ed6-2ee8-4d8c-b0b1-bb8171bc84d4" />  while `free -h` shows:  <img width="560" height="51" alt="Image" src="https://github.com/user-attachments/assets/cd217c15-d149-4bc1-a160-7d4243ed471b" />  and `cat /proc/swaps` this:  <img width="685" height="32" alt="Image" src="https://github.com/user-attachments/assets/d48a37a9-d75a-4e93-a5b2-0298bf42aa8a" />  

- **Issue #2190** (2026-08-13): **Focus stays on the Sort widget when selecting a Sort Type**
  *Symptoms*: ### Checklist  - [x] I've looked through the [troubleshooting docs](https://bottom.pages.dev/nightly/troubleshooting), [the known problems list](https://bottom.pages.dev/nightly/support/official/#known-problems), and  [existing open issues](https://github.com/ClementTsang/bottom/issues?q=is%3Aopen+is%3Aissue) for similar issues.  - [x] I've read through the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md) and am following it when reporting this bug.   ### What operating system and version are you using?  Arch Linux 7.1.8  ### What architecture are you using?  x86_64/AMD64  ### What terminal(s) are you running bottom on that are experiencing the problem?  foot 1.27.0-2  ### (Optional) What filesystem(s) are you using?  ext4  ### What version of bottom are you running?  0.14.7-1  ### How did you install bottom?  via pacman -Syu bottom  ### Describe the issue  After changing the sort type in the Sort By widget, focus remains within the widget after it closes.  ### What is the expected behaviour?  Focus moves to the process widget after the Sort By widget closes.  ### What is the actual behaviour?  Focus remains on the closed widget.  ### How can we reproduce this?  1. Open btm 2. Expand the process widget via E 3. Open the sort menu via S 4. Choose something and press Enter 5. The Sort widget closes, but focus remains within the closed widget  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hm, will take a look.
  > Yep, can reproduce, let me fix that rq.

- **Issue #2160** (2026-07-19): **Many kernel threads are missing in 0.14.5**
  *Symptoms*: ### Checklist  - [x] I've looked through the [troubleshooting docs](https://bottom.pages.dev/nightly/troubleshooting), [the known problems list](https://bottom.pages.dev/nightly/support/official/#known-problems), and  [existing open issues](https://github.com/ClementTsang/bottom/issues?q=is%3Aopen+is%3Aissue) for similar issues.  - [x] I've read through the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md) and am following it when reporting this bug.   ### What operating system and version are you using?  Arch Linux  ### What architecture are you using?  x86_64/AMD64  ### What terminal(s) are you running bottom on that are experiencing the problem?  ptyxis 50.1  ### (Optional) What filesystem(s) are you using?  Btrfs  ### What version of bottom are you running?  0.14.5  ### How did you install bottom?  Installed bottom through the Arch official repos.  ### Describe the issue  After upgrading from 0.12.3 to 0.14.5, many kernel threads no longer show up in the processes widget. Every tens of seconds or so, the accumulated CPU usage of these "missing" kernel threads shows up as a fake CPU usage spike in a random kernel thread in the widget.  <img width="2196" height="441" alt="Image" src="https://github.com/user-attachments/assets/5a1595ce-1b5d-4c69-b9b0-329aabf65318" />  Here's a side-by-side comparison of both versions. On the left, bottom 0.12.3 shows all kernel threads correctly. On the right, bottom 0.14.5 has many missing kernel threads. Both versi
  **Post-Mortem & Fix Analysis**:
  > Hmm... I can take a look, not sure what's going on here.
  > If it's not too much trouble, could you try 0.14.4? 0.14.5 had a fix that was supposed to fix a problem with parsing some comm fields, but it's possible that also introduced a regression.
  > Just tried 0.14.4 and can confirm that it does not have this bug.

- **Issue #2159** (2026-07-19): **Pid column in processes widget is now too narrow**
  *Symptoms*: ### Checklist  - [x] I've looked through the [troubleshooting docs](https://bottom.pages.dev/nightly/troubleshooting), [the known problems list](https://bottom.pages.dev/nightly/support/official/#known-problems), and  [existing open issues](https://github.com/ClementTsang/bottom/issues?q=is%3Aopen+is%3Aissue) for similar issues.  - [x] I've read through the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md) and am following it when reporting this bug.   ### What operating system and version are you using?  Arch Linux  ### What architecture are you using?  x86_64/AMD64  ### What terminal(s) are you running bottom on that are experiencing the problem?  ptyxis 50.1  ### (Optional) What filesystem(s) are you using?  Btrfs  ### What version of bottom are you running?  0.14.5  ### How did you install bottom?  Installed bottom through the Arch official repos.  ### Describe the issue  I use bottom in a 160x48 terminal window. Before upgrading bottom, at version 0.12.3, the pid column was 7 characters wide. This was a good default.  After upgrading to 0.14.5, the pid column is now only 4 characters wide. Most processes now show up as something like `272...`, which is basically useless. The new version appears to prioritize showing the full process name rather than the full pid.  ### What is the expected behaviour?  The pid column should be as wide as before.  ### What is the actual behaviour?  The pid column is now too narrow to be useful.  ### How can we repro
  **Post-Mortem & Fix Analysis**:
  > Thanks - this should be easy to fix.
  > Hmm, I think I just figured out the direct cause of this change in column width. The column headers used to be `PID(p)`, `Name(n)`, `CPU%(c)`, `Mem%(m)`. They are now `PID`, `Name`, `CPU%`, and `Mem%`. Somehow instead of showing the `header()` string, they are all `text()` now.  https://github.com/ClementTsang/bottom/blob/4023340c2b124b8960523181788e105d5b6a0ffe/src/widgets/process_table/process_columns.rs#L76-L121  All other widgets still use the `header()` names. Is this expected, or did some other change mess up the processes widget?
  > Nope, that looks like a bug - currently doing a bisect.

- **Issue #2147** (2026-07-15): **Incorrect unit in disk I/O graph on launch**
  *Symptoms*: ### Checklist  - [x] I've looked through the [troubleshooting docs](https://bottom.pages.dev/nightly/troubleshooting), [the known problems list](https://bottom.pages.dev/nightly/support/official/#known-problems), and  [existing open issues](https://github.com/ClementTsang/bottom/issues?q=is%3Aopen+is%3Aissue) for similar issues.  - [x] I've read through the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md) and am following it when reporting this bug.   ### What operating system and version are you using?  macOS 26.4.1  ### What architecture are you using?  arm64  ### What terminal(s) are you running bottom on that are experiencing the problem?  ghostty  ### (Optional) What filesystem(s) are you using?  _No response_  ### What version of bottom are you running?  0.14.4  ### How did you install bottom?  Homebrew.  ### Describe the issue  We're using the wrong unit type here:  <img width="1507" height="811" alt="Image" src="https://github.com/user-attachments/assets/663e1901-9a9e-45d0-ac8f-4fdf3d069bbb" />  This goes away after the start "ages out" of the visible period, so it's likely a bug in terms of showing a fake huge spike at the start. We can likely fix this by invalidating the first entry.  ### What is the expected behaviour?  Should be in MiB/s probably in this case.  ### What is the actual behaviour?  Showing TiB/s.  ### How can we reproduce this?  Run it with a config like:  ``` [[row]]   ratio=30   [[row.child]]   type="cpu" [[row]]     ratio

- **Issue #2108** (2026-06-27): **`cargo install` always reinstalls crates that have a binary gated behind `required-features`**
  *Symptoms*: ### Checklist  - [x] I've looked through the [troubleshooting docs](https://bottom.pages.dev/nightly/troubleshooting), [the known problems list](https://bottom.pages.dev/nightly/support/official/#known-problems), and  [existing open issues](https://github.com/ClementTsang/bottom/issues?q=is%3Aopen+is%3Aissue) for similar issues.   ### What operating system and version are you using?  Ubuntu 24.04  ### What architecture are you using?  x86  ### What terminal(s) are you running bottom on that are experiencing the problem?  ghostty  ### (Optional) What filesystem(s) are you using?  ext4  ### What version of bottom are you running?  0.14.1  ### How did you install bottom?  cargo install --locked bottom  ### Describe the issue   `cargo install` never recognizes an existing install as up-to-date — and so recompiles and reinstalls on every invocation — for any crate that declares a `[[bin]]` target gated behind `required-features` that isn't enabled. The "package `X` is already installed" short-circuit never triggers.  ### What is the expected behaviour?  No recompiling if last version is already installed  ### What is the actual behaviour?  It recompiles and reinstalls even if it is already the last version installed   ### How can we reproduce this?  Reproduces with `cargo install --locked bottom` (bottom 0.14.1), which has a `schema` binary gated behind `required-features = ["generate_schema"]`. `cargo install --locked bottom --bin btm` avoids it.   ### Additional information  Env
  **Post-Mortem & Fix Analysis**:
  > Hmm, interesting, I'll take a look. Thanks for the report.
  > Should be fixed now with 0.14.2, tested by doing `cargo install --locked bottom` twice and the second time gives the "already installed" warning.

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

### Incident Patch 1: `048deff9` (2026-09-29)
**Commit Message**: other: allow clippy lint for regex creation in loops (#2270)

https://github.com/rust-lang/rust-clippy/pull/17681 got merged a while ago - this makes it so the `regex_creation_in_loops` clippy `expect` "fails", since it is actually now not triggered.

Unfortunately, this is only in beta from the looks of it at the moment, so I can't just remove it entirely. This change just makes it an unconditional `allow` with a note to get rid of it at some point once it's stable.

Note this only affects macOS, where we use this. This was fine because it's only actually triggered once, and then cached via a `OnceLock`.

**File**: `.github/pull_request_template.md` (modified, +6/-4)
```diff
@@ -36,10 +36,12 @@ _Ensure **all** of these are met:_
 - [ ] _There are no merge conflicts_
 - [ ] _You have personally reviewed your changes already before creating the PR_
 - [ ] _The pull request passes the provided CI pipeline_
-- _If the changes were generated with AI tools:_
-  - [ ] _Ensure it **fully** follows the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md)._
-  - [ ] _Specify how it was used in the "Other" section._
-  - [ ] _Ensure that you, as a human, have personally reviewed the change_
+
+
+_If the changes were generated with AI tools:_
+- [ ] _Ensure it **fully** follows the [AI policy](https://github.com/ClementTsang/bottom/blob/main/AI_POLICY.md)._
+- [ ] _Specify how it was used in the "Other" section._
+- [ ] _Ensure that you, as a human, have personally reviewed the change_
 
 ## Other
 
```

**File**: `src/app/data/store.rs` (modified, +2/-1)
```diff
@@ -295,7 +295,8 @@ impl InnerData {
                     // Must trim one level further for macOS!
                     static DISK_REGEX: OnceLock<Regex> = OnceLock::new();
 
-                    #[expect(
+                    // FIXME: Can remove this later once https://github.com/rust-lang/rust-clippy/pull/17681 lands in stable?
+                    #[allow(
                         clippy::regex_creation_in_loops,
                         reason = "this is fine since it's done via a static OnceLock. In the future though, separate it out."
                     )]
```

---

### Incident Patch 2: `fdc29871` (2026-09-22)
**Commit Message**: bug: fix scrollbar not drawing if the height was 2 or less (#2261)

**File**: `.github/ci/release_notes.md` (modified, +2/-2)
```diff
@@ -2,12 +2,12 @@
 
 ---
 
-## Bug Fixes
-
 ## Features
 
 ## Changes
 
+## Bug Fixes
+
 ## Other
 
 ## Internal Changes
```

**File**: `CHANGELOG.md` (modified, +11/-4)
```diff
@@ -18,14 +18,12 @@ Versioning for this project is based on [Semantic Versioning](https://semver.org
 
 That said, these are more guidelines rather than hard rules, though the project will generally try to follow them.
 
+<!--TODO: Make the changelog order standardized with features, changes, bugs, other -->
+
 ---
 
 ## 0.15.0 - Unreleased
 
-### Bug Fixes
-
-- [#2225](https://github.com/ClementTsang/bottom/pull/2225): Fix waking up NVIDIA GPUs when getting stats on Linux.
-
 ### Features
 
 - [#2239](https://github.com/ClementTsang/bottom/pull/2239): Initial Intel GPU support for Linux to get process GPU usage.
@@ -34,6 +32,15 @@ That said, these are more guidelines rather than hard rules, though the project
 - [#2251](https://github.com/ClementTsang/bottom/pull/2251): Add configurable binary disk capacity units for disk widget I/O.
 - [#2224](https://github.com/ClementTsang/bottom/pull/2224): Add swap column for processes for Linux.
 
+### Changes
+
+- [#2260](https://github.com/ClementTsang/bottom/pull/2260): Enable scrollbars by default.
+
+### Bug Fixes
+
+- [#2225](https://github.com/ClementTsang/bottom/pull/2225): Fix waking up NVIDIA GPUs when getting stats on Linux.
+- [#2261](https://github.com/ClementTsang/bottom/pull/2261): Fix scrollbars not drawing when height of bar was 2 or less.
+
 ### Other
 
 - [#2227](https://github.com/ClementTsang/bottom/pull/2227): Add missing documentation around disk I/O graph.
```

**File**: `src/canvas/components/data_table.rs` (modified, +1/-1)
```diff
@@ -192,7 +192,7 @@ mod test {
             left_to_right: false,
             is_basic: false,
             show_table_scroll_position: true,
-            show_table_scroll_bar: false,
+            show_table_scroll_bar: true,
             show_current_entry_when_unfocused: false,
         };
         let styling = DataTableStyling::default();
```

**File**: `src/canvas/components/pipe_gauge.rs` (modified, +22/-13)
```diff
@@ -315,7 +315,7 @@ mod tests {
     }
 
     /// Create a [`PipeGauge`] and return what it would have rendered.
-    fn render_gauge(
+    fn render_test_gauge(
         ratio: f64, bar_type: BarType, start_label: Option<&str>, inner_label: Option<&str>,
     ) -> String {
         const WIDTH: u16 = 12;
@@ -339,51 +339,60 @@ mod tests {
 
     #[test]
     fn test_pipe_bars() {
-        assert_eq!(render_gauge(0.0, BarType::Pipe, None, None), "[          ]");
-        assert_eq!(render_gauge(0.5, BarType::Pipe, None, None), "[|||||     ]");
         assert_eq!(
-            render_gauge(0.95, BarType::Pipe, None, None),
+            render_test_gauge(0.0, BarType::Pipe, None, None),
+            "[          ]"
+        );
+        assert_eq!(
+            render_test_gauge(0.5, BarType::Pipe, None, None),
+            "[|||||     ]"
+        );
+        assert_eq!(
+            render_test_gauge(0.95, BarType::Pipe, None, None),
             "[||||||||| ]"
         );
-        assert_eq!(render_gauge(1.0, BarType::Pipe, None, None), "[||||||||||]");
+        assert_eq!(
+            render_test_gauge(1.0, BarType::Pipe, None, None),
+            "[||||||||||]"
+        );
     }
 
     #[test]
     fn test_solid_bars() {
         assert_eq!(
-            render_gauge(0.0, BarType::Block, None, None),
+            render_test_gauge(0.0, BarType::Block, None, None),
             "[          ]"
         );
         assert_eq!(
-            render_gauge(0.5, BarType::Block, None, None),
+            render_test_gauge(0.5, BarType::Block, None, None),
             "[█████     ]"
         );
         assert_eq!(
-            render_gauge(0.55, BarType::Block, None, None),
+            render_test_gauge(0.55, BarType::Block, None, None),
             "[█████▌    ]"
         );
         assert_eq!(
-            render_gauge(0.9, BarType::Block, None, None),
+            render_test_gauge(0.9, BarType::Block, None, None),
             "[█████████ ]"
         );
         assert_eq!(
-            render_gauge(1.0, BarType::Block, None, None),
+            render_test_gauge(1.0, BarType::Block, None, None),
             "[██████████]"
         );
     }
 
     #[test]
     fn test_labelled_bars() {
         assert_eq!(
-            render_gauge(0.5, BarType::Pipe, Some("CPU"), Some(" 50%")),
+            render_test_gauge(0.5, BarType::Pipe, Some("CPU"), Some(" 50%")),
             "CPU[||| 50%]"
         );
         assert_eq!(
-            render_gauge(0.5, BarType::Block, Some("CPU"), Some(" 50%")),
+            render_test_gauge(0.5, BarType::Block, Some("CPU"), Some(" 50%")),
             "CPU[███ 50%]"
         );
         assert_eq!(
-            render_gauge(1.0, BarType::Block, Some("CPU"), Some("100%")),
+            render_test_gauge(1.0, BarType::Block, Some("CPU"), Some("100%")),
             "CPU[███100%]"
         );
     }
```

**File**: `src/canvas/components/scroll_bar.rs` (modified, +64/-3)
```diff
@@ -44,13 +44,74 @@ pub fn draw_scroll_bar(f: &mut Frame<'_>, area: Rect, args: ScrollBarArgs) {
         end: "▼",
     };
 
-    let scrollbar = Scrollbar::new(ScrollbarOrientation::VerticalRight)
-        .style(args.style)
-        .symbols(SYMBOLS);
+    // If the height is only 2, then there's no room for the thumb,
+    // so instead we just draw a track with no arrows.
+    let scrollbar = {
+        let tmp = Scrollbar::new(ScrollbarOrientation::VerticalRight).style(args.style);
+
+        if area.height > 2 {
+            tmp.symbols(SYMBOLS)
+        } else {
+            tmp.track_symbol(Some(SYMBOLS.track))
+                .thumb_symbol(SYMBOLS.thumb)
+                .begin_symbol(None)
+                .end_symbol(None)
+        }
+    };
 
     let mut state = ScrollbarState::new(args.content_length)
         .position(args.position)
         .viewport_content_length(args.viewport_length);
 
     f.render_stateful_widget(scrollbar, area, &mut state);
 }
+
+#[cfg(test)]
+mod test {
+    use super::*;
+    use ratatui::{Terminal, backend::TestBackend};
+
+    fn render_test_bar(height: u16, content_length: usize, position: usize) -> Vec<String> {
+        let mut terminal = Terminal::new(TestBackend::new(1, height)).unwrap();
+        terminal
+            .draw(|f| {
+                draw_scroll_bar(
+                    f,
+                    Rect::new(0, 0, 1, height),
+                    ScrollBarArgs {
+                        content_length,
+                        viewport_length: 2,
+                        position,
+                        style: Style::default(),
+                    },
+                );
+            })
+            .unwrap();
+
+        let buf = terminal.backend().buffer().clone();
+        (0..height)
+            .map(|y| buf[(0, y)].symbol().to_string())
+            .collect()
+    }
+
+    /// Make sure that a short scrollbar (height <= 2) is still drawn, just without the head/tail arrows.
+    #[test]
+    fn test_small_height_scroll_still_drawn() {
+        assert_eq!(render_test_bar(1, 3, 0), ["█"]);
+        assert_eq!(render_test_bar(2, 3, 0), ["█", " "]);
+        assert_eq!(render_test_bar(2, 3, 2), [" ", "█"]);
+    }
+
+    #[test]
+    fn test_normal_height_scroll_all_drawn() {
+        assert_eq!(render_test_bar(3, 3, 0), ["▲", "█", "▼"]);
+        assert_eq!(render_test_bar(4, 3, 0), ["▲", "█", " ", "▼"]);
+        assert_eq!(render_test_bar(4, 3, 2), ["▲", " ", "█", "▼"]);
+    }
+
+    #[test]
+    fn test_no_scroll_bar_when_list_fits() {
+        assert_eq!(render_test_bar(4, 2, 0), [" ", " ", " ", " "]);
+        assert_eq!(render_test_bar(2, 1, 0), [" ", " "]);
+    }
+}
```

---

### Incident Patch 3: `4136d204` (2026-09-21)
**Commit Message**: feature: add process swap column for Linux (#2224)

Adds Linux support for process swap tracking + a column in the widget.

**File**: `sample_configs/default_config.toml` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@
 # Processes widget configuration
 #[processes]
 # The columns shown by the process widget. The following columns are supported (the GPU columns are only available if the GPU feature is enabled when built):
-# PID, Name, CPU%, Mem%, R/s, W/s, T.Read, T.Write, User, State, Time, GMem%, GPU%, Nice, Priority
+# PID, Name, CPU%, Mem%, Swap, R/s, W/s, T.Read, T.Write, User, State, Time, GMem%, GPU%, Nice, Priority
 #columns = ["PID", "Name", "CPU%", "Mem%", "Virt", "R/s", "W/s", "T.Read", "T.Write", "User", "State", "GMem%", "GPU%", "Priority"]
 
 # The default sort column when bottom starts. Accepts any of the column names above.
```

**File**: `schema/nightly/bottom.json` (modified, +2/-0)
```diff
@@ -1039,6 +1039,7 @@
         "Read",
         "Rps",
         "State",
+        "Swap",
         "T.Read",
         "T.Write",
         "TRead",
@@ -1072,6 +1073,7 @@
         "read",
         "rps",
         "state",
+        "swap",
         "t.read",
         "t.write",
         "time",
```

**File**: `src/app.rs` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ pub struct AppConfigFields {
     pub use_current_cpu_total: bool,
     pub unnormalized_cpu: bool,
     pub get_process_threads: bool,
+    pub get_process_swap: bool,
     pub use_basic_mode: bool,
     pub default_time_value: u64,
     pub time_interval: u64,
```

**File**: `src/collection.rs` (modified, +6/-0)
```diff
@@ -168,6 +168,7 @@ pub struct DataCollector {
     use_current_cpu_total: bool,
     show_average_cpu: bool,
     get_process_threads: bool,
+    get_process_swap: bool,
 
     last_list_collection_time: Instant,
     should_run_less_routine_tasks: bool,
@@ -226,6 +227,7 @@ impl DataCollector {
             use_current_cpu_total: false,
             unnormalized_cpu: false,
             get_process_threads: false,
+            get_process_swap: false,
             last_collection_time,
             total_rx: 0,
             total_tx: 0,
@@ -300,6 +302,10 @@ impl DataCollector {
         self.get_process_threads = get_process_threads;
     }
 
+    pub fn set_get_process_swap(&mut self, get_process_swap: bool) {
+        self.get_process_swap = get_process_swap;
+    }
+
     pub fn set_include_unmounted_disks(&mut self, include_unmounted_disks: bool) {
         self.include_unmounted_disks = include_unmounted_disks;
     }
```

**File**: `src/collection/processes.rs` (modified, +3/-0)
```diff
@@ -106,6 +106,9 @@ pub struct ProcessHarvest {
     /// Virtual memory.
     pub virtual_mem: Bytes,
 
+    /// Swapped memory.
+    pub swap_bytes: Option<Bytes>,
+
     /// The name of the process.
     pub name: String,
 
```

**File**: `src/collection/processes/linux/mod.rs` (modified, +15/-4)
```diff
@@ -142,6 +142,7 @@ fn read_proc(
         stat,
         io,
         cmdline,
+        swap_bytes,
     } = process;
 
     let ReadProcArgs {
@@ -152,6 +153,7 @@ fn read_proc(
         time_difference_in_secs,
         system_uptime,
         get_process_threads: _,
+        get_process_swap: _,
     } = args;
 
     let process_state_char = stat.state;
@@ -272,6 +274,7 @@ fn read_proc(
             mem_usage_percent,
             mem_usage,
             virtual_mem,
+            swap_bytes,
             name,
             command,
             read_per_sec,
@@ -349,6 +352,7 @@ pub(crate) struct ReadProcArgs {
     pub time_difference_in_secs: u64,
     pub system_uptime: u64,
     pub get_process_threads: bool,
+    pub get_process_swap: bool,
 }
 
 pub(crate) fn linux_process_data(
@@ -364,6 +368,8 @@ pub(crate) fn linux_process_data(
         unnormalized_cpu: collector.unnormalized_cpu,
         get_process_threads: collector.get_process_threads,
     };
+    let get_swap = collector.get_process_swap;
+
     let prev_process_details = &mut collector.prev_process_details;
     let user_table = &mut collector.user_table;
 
@@ -420,6 +426,7 @@ pub(crate) fn linux_process_data(
         time_difference_in_secs,
         system_uptime: sysinfo::System::uptime(),
         get_process_threads: get_threads,
+        get_process_swap: get_swap,
     };
 
     // TODO: Maybe pre-allocate these buffers in the future w/ routine cleanup.
@@ -428,9 +435,12 @@ pub(crate) fn linux_process_data(
 
     let mut process_vector: Vec<ProcessHarvest> = pids
         .filter_map(|pid_path| {
-            if let Ok((process, threads)) =
-                Process::from_path(pid_path, &mut buffer, args.get_process_threads)
-            {
+            if let Ok((process, threads)) = Process::from_path(
+                pid_path,
+                &mut buffer,
+                args.get_process_threads,
+                args.get_process_swap,
+            ) {
                 let pid = process.pid;
                 let prev_proc_details = prev_process_details.entry(pid).or_default();
 
@@ -474,7 +484,8 @@ pub(crate) fn linux_process_data(
     // Get thread data.
     for (pid, tid_paths) in process_threads_to_check {
         for tid_path in tid_paths {
-            if let Ok((process, _)) = Process::from_path(tid_path, &mut buffer, false) {
+            // VmSwap is process-wide, so don't collect it for individual threads.
+            if let Ok((process, _)) = Process::from_path(tid_path, &mut buffer, false, false) {
                 let tid = process.pid;
                 let prev_proc_details = prev_process_details.entry(tid).or_default();
 
```

**File**: `src/collection/processes/linux/process.rs` (modified, +80/-1)
```diff
@@ -246,6 +246,33 @@ impl Io {
     }
 }
 
+/// Helper that reads the `VmSwap` line from `/proc/<PID>/status`.
+///
+/// NB: `buffer` must be empty.
+///
+/// See the [`proc_pid_status(5)`](https://man7.org/linux/man-pages/man5/proc_pid_status.5.html)
+/// documentation for details about this file and field.
+fn get_swap_bytes(f: File, buffer: &mut String) -> anyhow::Result<u64> {
+    let mut reader = BufReader::new(f);
+
+    while reader.read_line(buffer)? > 0 {
+        let mut parts = buffer.split_whitespace();
+
+        if parts.next() == Some("VmSwap:") {
+            let swap_kib: u64 = parts
+                .next()
+                .ok_or_else(|| anyhow!("VmSwap value missing"))?
+                .parse()?;
+
+            return Ok(swap_kib.saturating_mul(1024));
+        }
+
+        buffer.clear();
+    }
+
+    Err(anyhow!("VmSwap field not found"))
+}
+
 /// A wrapper around a Linux process operations in `/proc/<PID>`.
 ///
 /// Core documentation based on [proc's manpages](https://man7.org/linux/man-pages/man5/proc.5.html).
@@ -255,6 +282,7 @@ pub(crate) struct Process {
     pub stat: Stat,
     pub io: Option<Io>,
     pub cmdline: Option<String>,
+    pub swap_bytes: Option<u64>,
 }
 
 #[inline]
@@ -277,7 +305,7 @@ impl Process {
     /// buffer.
     #[inline]
     pub(crate) fn from_path(
-        pid_path: PathBuf, buffer: &mut String, get_threads: bool,
+        pid_path: PathBuf, buffer: &mut String, get_threads: bool, get_swap: bool,
     ) -> anyhow::Result<(Process, Vec<PathBuf>)> {
         buffer.clear();
 
@@ -333,6 +361,16 @@ impl Process {
 
         reset(&mut root, buffer);
 
+        let swap_bytes = if get_swap && !stat.is_kernel_thread {
+            let bytes = open_at(&mut root, "status", &pid_dir)
+                .and_then(|file| get_swap_bytes(file, buffer))
+                .ok();
+            reset(&mut root, buffer);
+            bytes
+        } else {
+            None
+        };
+
         let threads = threads(&mut root, pid, get_threads);
 
         Ok((
@@ -342,6 +380,7 @@ impl Process {
                 stat,
                 io,
                 cmdline,
+                swap_bytes,
             },
             threads,
         ))
@@ -426,6 +465,14 @@ mod tests {
         Stat::from_file(file, &mut String::new())
     }
 
+    fn swap_file(status: &str) -> anyhow::Result<u64> {
+        let mut file = tempfile::tempfile()?;
+        file.write_all(status.as_bytes())?;
+        file.rewind()?;
+
+        get_swap_bytes(file, &mut String::new())
+    }
+
     #[test]
     fn parse_short_comm() {
         let stat = stat_from_name("kworker/u16:2").unwrap();
@@ -463,4 +510,36 @@ mod tests {
         assert!(stat_file("1 (blah)").is_err(), "too short");
         assert!(stat_file("1 )(").is_err(), "wrong order");
     }
+
+    #[test]
+    fn parse_swap_bytes() {
+        let status = "Name:\ttest\nVmSwap:\t4096 kB\n";
+
+        let swap_bytes = swap_file(status).unwrap();
+
+        assert_eq!(swap_bytes, 4_194_304);
+    }
+
+    #[test]
+    fn parse_zero_swap_bytes() {
+        let status = "Name:\ttest\nVmSwap:\t0 kB\n";
+
+        let swap_bytes = swap_file(status).unwrap();
+
+        assert_eq!(swap_bytes, 0);
+    }
+
+    #[test]
+    fn missing_vm_swap_is_an_error() {
+        let status = "Name:\ttest\nVmSize:\t4096 kB\n";
+
+        assert!(swap_file(status).is_err());
+    }
+
+    #[test]
+    fn invalid_vm_swap_is_an_error() {
+        let status = "Name:\ttest\nVmSwap:\tinvalid kB\n";
+
+        assert!(swap_file(status).is_err());
+    }
 }
```

**File**: `src/collection/processes/unix/process_ext.rs` (modified, +1/-0)
```diff
@@ -146,6 +146,7 @@ pub(crate) trait UnixProcessExt {
                 },
                 mem_usage: process_val.memory(),
                 virtual_mem: process_val.virtual_memory(),
+                swap_bytes: None,
                 cpu_usage_percent: process_cpu_usage,
                 read_per_sec: disk_usage.read_bytes,
                 write_per_sec: disk_usage.written_bytes,
```

---

### Incident Patch 4: `d7b56f6a` (2026-09-16)
**Commit Message**: feature: support binary prefix option for disk table I/O (#2251)

This is a follow-up to
https://github.com/ClementTsang/bottom/pull/2236#issuecomment-5689665534 so the binary prefix configuration also affects the disk I/O display. Note this does not touch the graph at the moment, just the table.

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -30,7 +30,8 @@ That said, these are more guidelines rather than hard rules, though the project
 
 - [#2239](https://github.com/ClementTsang/bottom/pull/2239): Initial Intel GPU support for Linux to get process GPU usage.
 - [#2245](https://github.com/ClementTsang/bottom/pull/2245): Support solid bars using block and square characters via `styles.widgets.bar_type`.
-- [#2236](https://github.com/ClementTsang/bottom/pull/2236): Add configurable binary disk capacity units for usage.
+- [#2236](https://github.com/ClementTsang/bottom/pull/2236): Add configurable binary disk capacity units for disk widget usage.
+- [#2251](https://github.com/ClementTsang/bottom/pull/2251): Add configurable binary disk capacity units for disk widget I/O.
 
 ### Other
 
```

**File**: `docs/content/configuration/command-line-options.md` (modified, +12/-12)
```diff
@@ -27,9 +27,9 @@ see information on these options by running `btm -h`, or run `btm --help` to dis
 
 ## Disk Options
 
-| Option                     | Behaviour                                                       |
-| -------------------------- | --------------------------------------------------------------- |
-| `--disk_use_binary_prefix` | Displays used, free, and total disk space with binary prefixes. |
+| Option                     | Behaviour                                                                                                |
+| -------------------------- | -------------------------------------------------------------------------------------------------------- |
+| `--disk_use_binary_prefix` | Displays the disk widget with binary prefixes (e.g. GiB, MiB) instead of decimal prefixes (e.g. GB, MB). |
 
 ## Process Options
 
@@ -77,15 +77,15 @@ see information on these options by running `btm -h`, or run `btm --help` to dis
 
 ## Network Options
 
-| Option                        | Behaviour                                                      |
-| ----------------------------- | -------------------------------------------------------------- |
-| `--network_legend <POSITION>` | Where to place the legend for the network chart widget.        |
-| `--network_use_bytes`         | Displays the network widget using bytes.                       |
-| `--network_use_binary_prefix` | Displays the network widget with binary prefixes.              |
-| `--network_use_log`           | Displays the network widget with a log scale.                  |
-| `--show_packets`              | Displays packet rate and average packet size info.             |
-| `--use_old_network_legend`    | Uses a separate network legend.                                |
-| `--network_start_zeroed`      | Show total network usage from app startup rather than on boot. |
+| Option                        | Behaviour                                                                                              |
+| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
+| `--network_legend <POSITION>` | Where to place the legend for the network chart widget.                                                |
+| `--network_use_bytes`         | Displays the network widget using bytes.                                                               |
+| `--network_use_binary_prefix` | Displays the network widget binary prefixes (e.g. GiB, MiB) instead of decimal prefixes (e.g. GB, MB). |
+| `--network_use_log`           | Displays the network widget with a log scale.                                                          |
+| `--show_packets`              | Displays packet rate and average packet size info.                                                     |
+| `--use_old_network_legend`    | Uses a separate network legend.                                                                        |
+| `--network_start_zeroed`      | Show total network usage from app startup rather than on boot.                                         |
 
 ## Battery Options
 
```

**File**: `docs/content/configuration/config-file/disk-table.md` (modified, +3/-3)
```diff
@@ -30,10 +30,10 @@ You can also set the sort order by changing `disk.sort_order` with `"Ascending"`
 sort_order = "Ascending"
 ```
 
-## Disk Space Units
+## Using Binary Prefixes
 
-Disk space uses decimal prefixes (KB, MB, GB, TB) by default. To display the Used, Free, and Total columns
-with binary prefixes (KiB, MiB, GiB, TiB), enable `use_binary_prefix`:
+Disk space uses decimal prefixes (e.g. KB, MB, GB, TB) by default. To display using binary prefixes instead
+(e.g. KiB, MiB, GiB, TiB), enable `use_binary_prefix`:
 
 ```toml
 [disk]
```

**File**: `sample_configs/default_config.toml` (modified, +1/-10)
```diff
@@ -155,7 +155,6 @@
 # Where to place the legend for the network widget. One of "none", "top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right".
 #network_legend = "top-right"
 
-
 # Processes widget configuration
 #[processes]
 # The columns shown by the process widget. The following columns are supported (the GPU columns are only available if the GPU feature is enabled when built):
@@ -209,7 +208,6 @@
 # Show process CPU% usage without averaging over the number of CPU cores.
 #unnormalized_cpu = false
 
-
 # CPU widget configuration
 #[cpu]
 # One of "all" (default), "average"/"avg"
@@ -218,11 +216,10 @@
 # Whether to show a decimal place for CPU usage values.
 #show_decimal = false
 
-
 # Disk widget configuration
 #[disk]
 
-# Whether to display used, free, and total disk space with binary prefixes (e.g. GiB instead of GB).
+# Whether to display disk widget data with binary prefixes (e.g. GiB instead of GB).
 #use_binary_prefix = false
 
 # The columns shown by the process widget. The following columns are supported:
@@ -277,7 +274,6 @@
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # Disk I/O graph widget configuration
 #[disk_io_graph]
 
@@ -316,7 +312,6 @@
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # Temperature widget configuration
 #[temperature]
 
@@ -347,7 +342,6 @@
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # Temperature graph widget configuration
 #[temperature_graph]
 
@@ -375,7 +369,6 @@
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # Memory widget configuration
 #[memory_graph]
 
@@ -391,7 +384,6 @@
 # Use short GPU names (e.g. "GPU" or "GPU0", "GPU1") instead of full GPU names. Only available if the GPU feature is enabled when built.
 #short_gpu_names = false
 
-
 # Network widget configuration
 #[network_graph]
 
@@ -418,7 +410,6 @@
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # These are all the components that support custom theming.  Note that colour support
 # will depend on terminal support.
 #[styles] # Uncomment if you want to use custom styling
```

**File**: `schema/nightly/bottom.json` (modified, +1/-1)
```diff
@@ -301,7 +301,7 @@
           "$ref": "#/$defs/SortOrder"
         },
         "use_binary_prefix": {
-          "description": "Displays used, free, and total disk space with binary prefixes (e.g. GiB).\nDefaults to decimal prefixes (e.g. GB).",
+          "description": "Use binary prefixes (e.g. GiB, MiB) instead of decimal prefixes (e.g. GB, MB).\n\nDefaults to decimal prefixes.",
           "type": [
             "boolean",
             "null"
```

**File**: `src/constants.rs` (modified, +1/-10)
```diff
@@ -404,7 +404,6 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Where to place the legend for the network widget. One of "none", "top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right".
 #network_legend = "top-right"
 
-
 # Processes widget configuration
 #[processes]
 # The columns shown by the process widget. The following columns are supported (the GPU columns are only available if the GPU feature is enabled when built):
@@ -458,7 +457,6 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Show process CPU% usage without averaging over the number of CPU cores.
 #unnormalized_cpu = false
 
-
 # CPU widget configuration
 #[cpu]
 # One of "all" (default), "average"/"avg"
@@ -467,11 +465,10 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Whether to show a decimal place for CPU usage values.
 #show_decimal = false
 
-
 # Disk widget configuration
 #[disk]
 
-# Whether to display used, free, and total disk space with binary prefixes (e.g. GiB instead of GB).
+# Whether to display disk widget data with binary prefixes (e.g. GiB instead of GB).
 #use_binary_prefix = false
 
 # The columns shown by the process widget. The following columns are supported:
@@ -526,7 +523,6 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # Disk I/O graph widget configuration
 #[disk_io_graph]
 
@@ -565,7 +561,6 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # Temperature widget configuration
 #[temperature]
 
@@ -596,7 +591,6 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # Temperature graph widget configuration
 #[temperature_graph]
 
@@ -624,7 +618,6 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # Memory widget configuration
 #[memory_graph]
 
@@ -640,7 +633,6 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Use short GPU names (e.g. "GPU" or "GPU0", "GPU1") instead of full GPU names. Only available if the GPU feature is enabled when built.
 #short_gpu_names = false
 
-
 # Network widget configuration
 #[network_graph]
 
@@ -667,7 +659,6 @@ pub(crate) const CONFIG_TEXT: &str = r#"# This is a default config file for bott
 # Whether to require matching the whole word. Defaults to false.
 #whole_word = false
 
-
 # These are all the components that support custom theming.  Note that colour support
 # will depend on terminal support.
 #[styles] # Uncomment if you want to use custom styling
```

**File**: `src/options/args.rs` (modified, +3/-5)
```diff
@@ -562,9 +562,8 @@ pub struct DiskArgs {
     #[arg(
         long,
         action = ArgAction::SetTrue,
-        help = "Displays disk space with binary prefixes.",
-        long_help = "Displays used, free, and total disk space with binary prefixes (e.g. KiB, MiB, GiB) \
-                    rather than decimal prefixes (e.g. KB, MB, GB). Defaults to decimal prefixes.",
+        help = "Displays the disk widget with binary prefixes.",
+        long_help = "Displays the disk widget with binary prefixes (e.g. GiB, MiB) instead of decimal prefixes (e.g. GB, MB).",
         alias = "disk-use-binary-prefix"
     )]
     pub disk_use_binary_prefix: bool,
@@ -598,8 +597,7 @@ pub struct NetworkArgs {
         long,
         action = ArgAction::SetTrue,
         help = "Displays the network widget with binary prefixes.",
-        long_help = "Displays the network widget with binary prefixes (e.g. kibibits, mebibits) rather than a decimal \
-                    prefixes (e.g. kilobits, megabits). Defaults to decimal prefixes.",
+        long_help = "Displays the network widget binary prefixes (e.g. GiB, MiB) instead of decimal prefixes (e.g. GB, MB).",
         alias = "network-use-binary-prefix"
     )]
     pub network_use_binary_prefix: bool,
```

**File**: `src/options/config/disk.rs` (modified, +3/-2)
```diff
@@ -8,8 +8,9 @@ use crate::{canvas::components::data_table::SortOrder, options::DiskWidgetColumn
 #[cfg_attr(feature = "generate_schema", derive(schemars::JsonSchema))]
 #[cfg_attr(test, serde(deny_unknown_fields), derive(PartialEq, Eq))]
 pub(crate) struct DiskConfig {
-    /// Displays used, free, and total disk space with binary prefixes (e.g. GiB).
-    /// Defaults to decimal prefixes (e.g. GB).
+    /// Use binary prefixes (e.g. GiB, MiB) instead of decimal prefixes (e.g. GB, MB).
+    ///
+    /// Defaults to decimal prefixes.
     pub(crate) use_binary_prefix: Option<bool>,
 
     /// A filter over the disk names.
```

---

### Incident Patch 5: `05acca2e` (2026-09-10)
**Commit Message**: ci: pin debian build image version (#2244)

Pin the image to the versions built in https://github.com/ClementTsang/cargo-deb-arm/commit/b611b6b2fa802446cfebdc38671fe46c3f0766d3 for now (bump to bookworm).

**File**: `.github/workflows/build_releases.yml` (modified, +3/-3)
```diff
@@ -430,19 +430,19 @@ jobs:
               target: "aarch64-unknown-linux-musl",
               cross: true,
               dpkg: arm64,
-              container: "ghcr.io/clementtsang/cargo-deb-aarch64-unknown-linux-gnu",
+              container: "ghcr.io/clementtsang/cargo-deb-aarch64-unknown-linux-gnu@sha256:d36a9c470790bf2ef86eb7a68cd6ecca3c3934ccd0be7299cba76678b40a48aa",
             }
           - {
               target: "armv7-unknown-linux-gnueabihf",
               cross: true,
               dpkg: armhf,
-              container: "ghcr.io/clementtsang/cargo-deb-armv7-unknown-linux-gnueabihf",
+              container: "ghcr.io/clementtsang/cargo-deb-armv7-unknown-linux-gnueabihf@sha256:44ee95e9a2248287815c57affa673b0f50cf34a3126c59ae83205f483c450d02",
             }
           - {
               target: "armv7-unknown-linux-musleabihf",
               cross: true,
               dpkg: armhf,
-              container: "ghcr.io/clementtsang/cargo-deb-armv7-unknown-linux-gnueabihf",
+              container: "ghcr.io/clementtsang/cargo-deb-armv7-unknown-linux-gnueabihf@sha256:44ee95e9a2248287815c57affa673b0f50cf34a3126c59ae83205f483c450d02",
             }
     steps:
       - name: Checkout repository
```

---

### Incident Patch 6: `6323bef6` (2026-09-06)
**Commit Message**: packaging: use `WixUI_Advanced` for MSI installer UI (#2237)

**File**: `wix/main.wxs` (modified, +18/-18)
```diff
@@ -32,9 +32,9 @@
     <!--
       Scope='perUserOrMachine' makes this a dual-purpose package: it can install
       per-machine (elevated, into Program Files) or per-user (non-elevated, into
-      %LocalAppData%). winget's user scope drives the per-user path silently
-      via MSIINSTALLPERUSER=1. See the SetProperty for APPLICATIONFOLDER below,
-      which redirects the install directory for the per-user case.
+      %LocalAppData%).
+      
+      Note that winget's user scope drives the per-user path silently via MSIINSTALLPERUSER=1
     -->
     <Package
         Name='bottom'
@@ -169,19 +169,6 @@
             </Directory>
         </StandardDirectory>
 
-        <!--
-          Redirect the install directory to a user-writable location for per-user
-          installs (ALLUSERS is empty when installing per-user). Must run before
-          CostFinalize so the new path is used for costing and file layout, and it
-          is sequenced in both the UI and execute sequences so it also applies to
-          silent installs (e.g. winget user-scope installs).
-        -->
-        <SetProperty Id='APPLICATIONFOLDER'
-            Value='[LocalAppDataFolder]Programs\bottom'
-            Before='CostFinalize'
-            Sequence='both'
-            Condition='NOT ALLUSERS'/>
-
         <Feature
             Id='Binaries'
             Title='Application'
@@ -229,8 +216,21 @@
         <!--<Property Id='ARPPRODUCTICON' Value='ProductICO' />-->
 
         <Property Id='ARPHELPLINK' Value='https://bottom.pages.dev/stable'/>
-
-        <ui:WixUI Id='WixUI_FeatureTree'/>
+        <Property Id='ApplicationFolderName' Value='bottom'/>
+        <Property Id='WixAppFolder' Value='WixPerMachineFolder'/>
+  
+        <CustomAction Id='OverridePerMachineFolder'
+            Property='WixPerMachineFolder'
+            Value='[ProgramFiles64Folder][ApplicationFolderName]'
+            Execute='immediate'/>
+        <InstallUISequence>
+            <Custom Action='OverridePerMachineFolder' After='WixSetDefaultPerMachineFolder'/>
+        </InstallUISequence>
+        <InstallExecuteSequence>
+            <Custom Action='OverridePerMachineFolder' After='WixSetDefaultPerMachineFolder'/>
+        </InstallExecuteSequence>
+
+        <ui:WixUI Id='WixUI_Advanced'/>
         <!--
           Disabling the EULA dialog in the installer is a two step process:
 
```

---

### Incident Patch 7: `f9e17037` (2026-09-03)
**Commit Message**: Improve linux nvidia gpu caching (#2230)

Changes it from a 10s full cache to a 60s conditional cache; we still check the power state now even when using the cached list.

**File**: `src/collection.rs` (modified, +3/-1)
```diff
@@ -192,8 +192,10 @@ pub struct DataCollector {
     gpu_pids: Option<Vec<IntHashMap<Pid, (u64, u32)>>>,
     #[cfg(feature = "gpu")]
     gpus_total_mem: Option<u64>,
+
     #[cfg(all(target_os = "linux", feature = "gpu", feature = "nvidia"))]
-    nvidia_gpu_list_cache: Option<(Vec<String>, Instant)>,
+    /// A vector of GPU names and their corresponding paths, alongside the last update time.
+    nvidia_gpu_list_cache: Option<(Vec<(String, std::path::PathBuf)>, Instant)>,
 
     #[cfg(feature = "zfs")]
     free_arc_mem: bool,
```

**File**: `src/collection/nvidia.rs` (modified, +25/-11)
```diff
@@ -77,7 +77,7 @@ fn is_gpu_class(class_code: &str) -> bool {
 /// - <https://us.download.nvidia.com/XFree86/Linux-x86_64/525.89.02/README/dynamicpowermanagement.html>
 /// - <https://www.kernel.org/doc/Documentation/ABI/testing/sysfs-devices-power_state>
 #[cfg(target_os = "linux")]
-fn get_active_pci_bus_ids() -> Vec<String> {
+fn get_active_pci_bus_ids() -> Vec<(String, std::path::PathBuf)> {
     use std::fs;
 
     use crate::collection::linux::utils::is_device_awake;
@@ -86,7 +86,7 @@ fn get_active_pci_bus_ids() -> Vec<String> {
         return Vec::new();
     };
 
-    let mut result: Vec<String> = entries
+    let mut result: Vec<(String, std::path::PathBuf)> = entries
         .flatten()
         .filter_map(|entry| {
             let path = entry.path();
@@ -128,7 +128,7 @@ fn get_active_pci_bus_ids() -> Vec<String> {
                     .file_name()
                     .into_string()
                     .ok()
-                    .map(|name| concat_string::concat_string!("0000", name))
+                    .map(|name| (concat_string::concat_string!("0000", name), path))
             } else {
                 None
             }
@@ -155,28 +155,42 @@ pub fn get_nvidia_gpu_data(collector: &mut DataCollector) -> Option<GpusData> {
             target_os = "linux" => {
                 use itertools::Either;
 
-                // Refresh every ~10 seconds.
-                // TODO: IS it possible that our caching keeps stuff awake...? Hm.
+                // We cache for a minute, but still check whether the list of devices is sleeping. This way,
+                // solves the problem of waking sleeping devices, but also means we don't check as much AND we
+                // still support hotplugged devices (in theory).
                 if let Some((cached_list, cached_time)) = &collector.nvidia_gpu_list_cache
-                    && cached_time.elapsed().as_secs() < 10
+                    && cached_time.elapsed().as_secs() < 60
                 {
                     let devices = Either::Left(
                         cached_list
                             .iter()
-                            .filter_map(|id| nvml.device_by_pci_bus_id(id.as_str()).ok()),
+                            .filter_map(|(id, device)| {
+                                use crate::collection::linux::utils::is_device_awake;
+
+                                if is_device_awake(device) {
+                                    nvml.device_by_pci_bus_id(id.as_str()).ok()
+                                } else {
+                                    None
+                                }
+                            }),
                     );
                     (devices, cached_list.len())
                 } else {
                     let pci_bus_ids = get_active_pci_bus_ids();
                     let num_gpus = pci_bus_ids.len();
+
                     collector.nvidia_gpu_list_cache =
-                        Some((pci_bus_ids.clone(), std::time::Instant::now()));
+                        Some((pci_bus_ids, std::time::Instant::now()));
 
                     let devices = Either::Right(
-                        pci_bus_ids
-                            .into_iter()
-                            .filter_map(|id| nvml.device_by_pci_bus_id(id).ok()),
+                        collector.nvidia_gpu_list_cache
+                            .as_ref()
+                            .expect("we just inserted the cache entry")
+                            .0
+                            .iter()
+                            .filter_map(|(id, _path)| nvml.device_by_pci_bus_id(id.as_str()).ok())
                     );
+
                     (devices, num_gpus)
                 }
             }
```

---

### Incident Patch 8: `30fb02c1` (2026-09-02)
**Commit Message**: refactor: move Linux DRM-related collection code into its own file (#2228)

Doing this as refactoring work before I start working on supporting Intel GPUs, which are expected to share the same collection code. This should have no functional change.

**File**: `src/collection.rs` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@ pub mod amd;
 #[cfg(target_os = "linux")]
 mod linux {
     pub mod cgroups;
+    #[cfg(feature = "gpu")]
+    pub mod drm;
     pub mod utils;
 }
 
```

**File**: `src/collection/amd.rs` (modified, +25/-217)
```diff
@@ -2,18 +2,21 @@ mod amd_gpu_marketing;
 
 use std::{
     cell::RefCell,
-    fs::{self, read_to_string},
+    fs::read_to_string,
     num::NonZeroU64,
     path::{Path, PathBuf},
-    time::{Duration, Instant},
+    time::Instant,
 };
 
 use rustc_hash::{FxHashMap as HashMap, FxHashSet as HashSet};
 
-use super::linux::utils::is_device_awake;
 use crate::{
     app::layout_manager::UsedWidgets,
-    collection::{memory::MemData, processes::Pid},
+    collection::{
+        linux::drm::{collect_drm_fdinfo, diff_usage, enumerate_drm_devices, get_drm_render_nodes},
+        memory::MemData,
+        processes::Pid,
+    },
     utils::int_hash::{IntHashMap, IntHashSet},
 };
 
@@ -48,43 +51,6 @@ thread_local! {
     static LAST_CLEAN_COUNTER: RefCell<u32> = const { RefCell::new(0) };
 }
 
-fn get_amd_devs() -> Option<Vec<PathBuf>> {
-    let mut devices = Vec::new();
-
-    // read all PCI devices controlled by the AMDGPU module
-    let Ok(paths) = fs::read_dir("/sys/module/amdgpu/drivers/pci:amdgpu") else {
-        return None;
-    };
-
-    for path in paths {
-        let Ok(path) = path else { continue };
-
-        // test if it has a valid vendor path
-        let device_path = path.path();
-        if !device_path.is_dir() {
-            continue;
-        }
-
-        // Skip if asleep to avoid wakeups.
-        if !is_device_awake(&device_path) {
-            continue;
-        }
-
-        // This will exist for GPUs but not others, this is how we find their
-        // kernel name.
-        let test_path = device_path.join("drm");
-        if test_path.as_path().exists() {
-            devices.push(device_path);
-        }
-    }
-
-    if devices.is_empty() {
-        None
-    } else {
-        Some(devices)
-    }
-}
-
 pub fn get_amd_name(device_path: &Path) -> Option<String> {
     // get revision and device ids from sysfs
     let rev_path = device_path.join("revision");
@@ -152,186 +118,28 @@ fn get_amd_vram(device_path: &Path) -> Option<AmdGpuMemory> {
     })
 }
 
-// from amdgpu_top: https://github.com/Umio-Yasuno/amdgpu_top/blob/c961cf6625c4b6d63fda7f03348323048563c584/crates/libamdgpu_top/src/stat/fdinfo/proc_info.rs#L114
-fn diff_usage(pre: u64, cur: u64, interval: &Duration) -> u64 {
-    use std::ops::Mul;
-
-    let diff_ns = if pre == 0 || cur < pre {
-        return 0;
-    } else {
-        cur.saturating_sub(pre) as u128
-    };
-
-    diff_ns
-        .mul(100)
-        .checked_div(interval.as_nanos())
-        .unwrap_or(0) as u64
-}
-
-// from amdgpu_top: https://github.com/Umio-Yasuno/amdgpu_top/blob/c961cf6625c4b6d63fda7f03348323048563c584/crates/libamdgpu_top/src/stat/fdinfo/proc_info.rs#L13-L27
-fn get_amdgpu_pid_fds(pid: Pid, device_path: Vec<PathBuf>) -> Option<Vec<u32>> {
-    let Ok(fd_list) = fs::read_dir(format!("/proc/{pid}/fd/")) else {
-        return None;
-    };
-
-    let valid_fds: Vec<u32> = fd_list
-        .filter_map(|fd_link| {
-            let dir_entry = fd_link.map(|fd_link| fd_link.path()).ok()?;
-            let link = fs::read_link(&dir_entry).ok()?;
-
-            // e.g. "/dev/dri/renderD128" or "/dev/dri/card0"
-            if device_path.iter().any(|path| link.starts_with(path)) {
-                dir_entry.file_name()?.to_str()?.parse::<u32>().ok()
-            } else {
-                None
-            }
-        })
-        .collect();
-
-    if valid_fds.is_empty() {
-        None
-    } else {
-        Some(valid_fds)
-    }
-}
-
-fn get_amdgpu_drm(device_path: &Path) -> Option<Vec<PathBuf>> {
-    let mut drm_devices = Vec::new();
-    let drm_root = device_path.join("drm");
-
-    let Ok(drm_paths) = fs::read_dir(drm_root) else {
-        return None;
-    };
-
-    for drm_dir in drm_paths {
-        let Ok(drm_dir) = drm_dir else {
-            continue;
-        };
-
-        // attempt to get the device renderer name
-        let drm_name = drm_dir.file_name();
-        let Some(drm_name) = drm_name.to_str() else {
-            continue;
-        };
-
-        // construct driver device path if valid
-        if !drm_name.starts_with("card") && !drm_name.starts_with("render") {
-            continue;
-        }
-
-        drm_devices.push(PathBuf::from(format!("/dev/dri/{drm_name}")));
-    }
-
-    if drm_devices.is_empty() {
-        None
-    } else {
-        Some(drm_devices)
-    }
-}
-
 fn get_amd_fdinfo(device_path: &Path) -> Option<IntHashMap<Pid, AmdGpuProc>> {
-    let mut fdinfo = IntHashMap::default();
-
-    let drm_paths = get_amdgpu_drm(device_path)?;
-
-    let Ok(proc_dir) = fs::read_dir("/proc") else {
-        return None;
-    };
-
-    let pids: Vec<Pid> = proc_dir
-        .filter_map(|dir_entry| {
-            // check if pid is valid
-            let dir_entry = dir_entry.ok()?;
-            let metadata = dir_entry.metadata().ok()?;
-
-            if !metadata.is_dir() {
-                return None;
-            }
-
-            let pid = dir_entry.file_name().to_str()?.parse::<Pid>().ok()?;
-
-    
```

**File**: `src/collection/linux/drm.rs` (added, +243/-0)
```diff
@@ -0,0 +1,243 @@
+//! Shared helpers for collecting GPU data from the Linux DRM subsystem. Primarily used for AMD (`amdgpu`)
+//! and Intel (`i915`/`xe`) GPU collectors to gather info via sysfs and read info under `/proc/<pid>/fdinfo/`.
+//!
+//! See <https://docs.kernel.org/gpu/drm-usage-stats.html> for more info.
+
+use std::{
+    fs::{self, read_to_string},
+    ops::Mul,
+    path::{Path, PathBuf},
+    time::Duration,
+};
+
+use concat_string::concat_string;
+use rustc_hash::FxHashSet as HashSet;
+
+use crate::{
+    collection::{linux::utils::is_device_awake, processes::Pid},
+    utils::int_hash::IntHashMap,
+};
+
+/// Enumerate the PCI device directories bound to a given DRM driver module (e.g. `amdgpu`,
+/// `i915`, `xe`).
+///
+/// Reads `/sys/module/<driver>/drivers/pci:<driver>`, keeping only entries that are GPUs (i.e. have
+/// a `drm/` subdirectory) and that are currently awake, so we don't wake a sleeping device.
+pub(crate) fn enumerate_drm_devices(driver: &str) -> Option<Vec<PathBuf>> {
+    let mut devices = Vec::new();
+
+    // read all PCI devices controlled by the given driver module
+    let Ok(paths) = fs::read_dir(concat_string!(
+        "/sys/module/",
+        driver,
+        "/drivers/pci:",
+        driver
+    )) else {
+        return None;
+    };
+
+    for path in paths {
+        let Ok(path) = path else { continue };
+
+        let device_path = path.path();
+        if !device_path.is_dir() {
+            continue;
+        }
+
+        // Skip if asleep to avoid wakeups.
+        if !is_device_awake(&device_path) {
+            continue;
+        }
+
+        // This will exist for GPUs but not others, this is how we find their kernel name.
+        let test_path = device_path.join("drm");
+        if test_path.as_path().exists() {
+            devices.push(device_path);
+        }
+    }
+
+    if devices.is_empty() {
+        None
+    } else {
+        Some(devices)
+    }
+}
+
+/// Return the DRM device nodes (e.g. `/dev/dri/renderD128`, `/dev/dri/card0`) for a PCI device, by
+/// reading its `drm/` subdirectory.
+pub(crate) fn get_drm_render_nodes(device_path: &Path) -> Option<Vec<PathBuf>> {
+    let mut drm_devices = Vec::new();
+    let drm_root = device_path.join("drm");
+
+    let Ok(drm_paths) = fs::read_dir(drm_root) else {
+        return None;
+    };
+
+    for drm_dir in drm_paths {
+        let Ok(drm_dir) = drm_dir else {
+            continue;
+        };
+
+        // attempt to get the device renderer name
+        let drm_name = drm_dir.file_name();
+        let Some(drm_name) = drm_name.to_str() else {
+            continue;
+        };
+
+        // construct driver device path if valid
+        if !drm_name.starts_with("card") && !drm_name.starts_with("render") {
+            continue;
+        }
+
+        drm_devices.push(PathBuf::from(concat_string!("/dev/dri/", drm_name)));
+    }
+
+    if drm_devices.is_empty() {
+        None
+    } else {
+        Some(drm_devices)
+    }
+}
+
+/// from amdgpu_top: <https://github.com/Umio-Yasuno/amdgpu_top/blob/c961cf6625c4b6d63fda7f03348323048563c584/crates/libamdgpu_top/src/stat/fdinfo/proc_info.rs#L13-L27>
+fn get_pid_fds(pid: Pid, device_paths: &[PathBuf]) -> Option<Vec<u32>> {
+    let Ok(fd_list) = fs::read_dir(format!("/proc/{pid}/fd/")) else {
+        return None;
+    };
+
+    let valid_fds: Vec<u32> = fd_list
+        .filter_map(|fd_link| {
+            let dir_entry = fd_link.map(|fd_link| fd_link.path()).ok()?;
+            let link = fs::read_link(&dir_entry).ok()?;
+
+            // e.g. "/dev/dri/renderD128" or "/dev/dri/card0"
+            if device_paths.iter().any(|path| link.starts_with(path)) {
+                dir_entry.file_name()?.to_str()?.parse::<u32>().ok()
+            } else {
+                None
+            }
+        })
+        .collect();
+
+    if valid_fds.is_empty() {
+        None
+    } else {
+        Some(valid_fds)
+    }
+}
+
+// from amdgpu_top: https://github.com/Umio-Yasuno/amdgpu_top/blob/c961cf6625c4b6d63fda7f03348323048563c584/crates/libamdgpu_top/src/stat/fdinfo/proc_info.rs#L114
+pub(crate) fn diff_usage(pre: u64, cur: u64, interval: &Duration) -> u64 {
+    let diff_ns = if pre == 0 || cur < pre {
+        return 0;
+    } else {
+        cur.saturating_sub(pre) as u128
+    };
+
+    diff_ns
+        .mul(100)
+        .checked_div(interval.as_nanos())
+        .unwrap_or(0) as u64
+}
+
+/// Scan every process for open fds pointing at the given DRM device nodes, parse each fd's
+/// `fdinfo`, and accumulate per-process usage keyed by pid.
+///
+/// - `T` is the accumulator type (e.g. a struct holding a bunch of counters).
+/// - `F` is a function that takes an accumulator and a keyword/value pair from the fdinfo,
+///   and updates the accumulator with that info.
+pub(crate) fn collect_drm_fdinfo<T, F>(
+    render_nodes: &[PathBuf], accumulate: F,
+) -> Option<IntHashMap<Pid, T>>
+where
+    T: Default + PartialEq,
+    F: Fn(&mut T, (&str, 
```

**File**: `src/collection/nvidia.rs` (modified, +1/-0)
```diff
@@ -156,6 +156,7 @@ pub fn get_nvidia_gpu_data(collector: &mut DataCollector) -> Option<GpusData> {
                 use itertools::Either;
 
                 // Refresh every ~10 seconds.
+                // TODO: IS it possible that our caching keeps stuff awake...? Hm.
                 if let Some((cached_list, cached_time)) = &collector.nvidia_gpu_list_cache
                     && cached_time.elapsed().as_secs() < 10
                 {
```

---

### Incident Patch 9: `175c12ed` (2026-08-31)
**Commit Message**: bug: don't check sleeping NVIDIA GPU/devices to avoid waking them on Linux (#2225)

This PR makes it so that we should hopefully avoid waking up NVIDIA GPUs while gathering info (on Linux only). It mostly follows how we were doing it for AMD devices, which required a bit of refactoring to get it to work with the NVML library I was using.

Note that, as mentioned above, it does not change behaviour for Windows (or other OSes that work with NVIDIA GPUs) at the moment, as I need to use some fairly OS-specific logic to get it to work on each platform from the looks of it.

Unfortunately, I no longer have any Nvidia-based machines to test with, let alone laptops with Optimus... so this may be hard to verify whether it works on my end.

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@ That said, these are more guidelines rather than hard rules, though the project
 
 ---
 
+## 0.15.0 - Unreleased
+
+### Bug Fixes
+
+- [#2225](https://github.com/ClementTsang/bottom/pull/2225): Fix waking up NVIDIA GPUs when getting stats on Linux.
+
 ## 0.14.9 - 2026-08-27
 
 ### Bug Fixes
```

**File**: `src/collection.rs` (modified, +6/-5)
```diff
@@ -190,6 +190,9 @@ pub struct DataCollector {
     gpu_pids: Option<Vec<IntHashMap<Pid, (u64, u32)>>>,
     #[cfg(feature = "gpu")]
     gpus_total_mem: Option<u64>,
+    #[cfg(all(target_os = "linux", feature = "gpu", feature = "nvidia"))]
+    nvidia_gpu_list_cache: Option<(Vec<String>, Instant)>,
+
     #[cfg(feature = "zfs")]
     free_arc_mem: bool,
 
@@ -238,6 +241,8 @@ impl DataCollector {
             gpu_pids: None,
             #[cfg(feature = "gpu")]
             gpus_total_mem: None,
+            #[cfg(all(target_os = "linux", feature = "gpu", feature = "nvidia"))]
+            nvidia_gpu_list_cache: None,
             #[cfg(feature = "zfs")]
             free_arc_mem: false,
             last_list_collection_time: last_collection_time,
@@ -422,11 +427,7 @@ impl DataCollector {
             let mut local_gpu_total_mem: u64 = 0;
 
             #[cfg(feature = "nvidia")]
-            if let Some(data) = nvidia::get_nvidia_vecs(
-                &self.filters.temp_filter,
-                &self.filters.temp_graph_filter,
-                &self.widgets_to_harvest,
-            ) {
+            if let Some(data) = nvidia::get_nvidia_gpu_data(self) {
                 if let Some(mut temp) = data.temperature {
                     if let Some(sensors) = &mut self.data.temperature_sensors {
                         sensors.append(&mut temp);
```

**File**: `src/collection/linux/utils.rs` (modified, +2/-3)
```diff
@@ -2,10 +2,9 @@ use std::{fs, path::Path};
 
 /// Whether the temperature should *actually* be read during enumeration.
 /// Will return false if the state is not D0/unknown, or if it does not support
-/// `device/power_state`.
+/// `device/power_state` (e.g. the path does not exist).
 ///
-/// `path` is a path to the device itself (e.g.
-/// `/sys/class/hwmon/hwmon1/device`).
+/// `path` is a path to the device itself (e.g. `/sys/class/hwmon/hwmon1/device`).
 #[inline]
 pub fn is_device_awake(device: &Path) -> bool {
     // Whether the temperature should *actually* be read during enumeration.
```

**File**: `src/collection/nvidia.rs` (modified, +249/-130)
```diff
@@ -5,8 +5,8 @@ use nvml_wrapper::{
 };
 
 use crate::{
-    app::{filter::Filter, layout_manager::UsedWidgets},
-    collection::{memory::MemData, processes::Pid, temperature::TempSensorData},
+    app::filter::Filter,
+    collection::{DataCollector, memory::MemData, processes::Pid, temperature::TempSensorData},
     utils::int_hash::IntHashMap,
 };
 
@@ -42,142 +42,261 @@ fn init_nvml() -> Result<Nvml, NvmlError> {
     }
 }
 
+/// Returns whether the vendor ID passed in is NVIDIA's vendor ID.
+///
+/// See <https://raw.githubusercontent.com/torvalds/linux/master/include/linux/pci_ids.h> for details
+/// (search for `PCI_VENDOR_ID_NVIDIA`).
+#[cfg(target_os = "linux")]
+#[inline]
+fn is_nvidia_vendor(vendor_id: &str) -> bool {
+    const NVIDIA_VENDOR: &str = "0x10de";
+    vendor_id == NVIDIA_VENDOR
+}
+
+/// Returns whether the PCI code is a GPU.
+///
+/// See <https://raw.githubusercontent.com/torvalds/linux/master/include/linux/pci_ids.h> for details
+/// (search for `PCI_BASE_CLASS_DISPLAY`).
+#[cfg(target_os = "linux")]
+#[inline]
+fn is_gpu_class(class_code: &str) -> bool {
+    const PCI_BASE_CLASS_DISPLAY: &str = "0x03";
+    class_code.starts_with(PCI_BASE_CLASS_DISPLAY)
+}
+
+/// Get a list of PCI bus IDs for Linux. This will handle whether the device is awake or not.
+/// We do this separately to avoid the possibility of NVML waking up the device at all;
+/// this is particularly useful for things like laptops with hybrid graphics (e.g. NVIDIA Optimus).
+///
+/// Note this is somewhat expensive, so it may be worth caching this result.
+///
+/// ---
+///
+/// For more information, see:
+/// - <https://us.download.nvidia.com/XFree86/Linux-x86_64/525.89.02/README/dynamicpowermanagement.html>
+/// - <https://www.kernel.org/doc/Documentation/ABI/testing/sysfs-devices-power_state>
+#[cfg(target_os = "linux")]
+fn get_active_pci_bus_ids() -> Vec<String> {
+    use crate::collection::linux::utils::is_device_awake;
+    use std::fs;
+
+    let Ok(entries) = fs::read_dir("/sys/bus/pci/devices") else {
+        return Vec::new();
+    };
+
+    let mut result: Vec<String> = entries
+        .flatten()
+        .filter_map(|entry| {
+            let path = entry.path();
+
+            let is_nvidia = fs::read_to_string(path.join("vendor"))
+                .is_ok_and(|vendor| is_nvidia_vendor(vendor.trim()));
+            if !is_nvidia {
+                return None;
+            }
+
+            let is_gpu = fs::read_to_string(path.join("class"))
+                .is_ok_and(|class| is_gpu_class(class.trim()));
+            if !is_gpu {
+                return None;
+            }
+
+            let is_awake = is_device_awake(&path);
+
+            // This returns values in the "shape" of "0000:01:00.0" (domain:bus:device.function).
+            //
+            // Just as an FYI:
+            // The "0th" function is the GPU itself - from the NVIDIA power management docs
+            // (https://us.download.nvidia.com/XFree86/Linux-x86_64/525.89.02/README/dynamicpowermanagement.html):
+            // > The NVIDIA GPU may have one, two or four PCI functions:
+            // > - Function 0: VGA controller / 3D controller
+            // > - Function 1: Audio device
+            // > - Function 2: USB xHCI Host controller
+            // > - Function 3: USB Type-C UCSI controller
+            //
+            // We also know the "shape" of the path from aforementioned docs (ignore what it's trying to do):
+            // > For pre-Ampere notebooks, runtime D3 power management can be enabled for each PCI function using the following command.
+            // > echo auto > /sys/bus/pci/devices/<Domain>:<Bus>:<Device>.<Function>/power/control
+            // > For example:
+            // > echo auto > /sys/bus/pci/devices/0000:01:00.0/power/control
+            if is_awake {
+                // Note that NVML expects an eight-digit bus ID at the front, so we prepend the current device name
+                // with `0000`.
+                entry
+                    .file_name()
+                    .into_string()
+                    .ok()
+                    .map(|name| concat_string::concat_string!("0000", name))
+            } else {
+                None
+            }
+        })
+        .collect();
+
+    result.sort_unstable();
+    result
+}
+
 /// Returns the GPU data from NVIDIA cards.
 #[inline]
-pub fn get_nvidia_vecs(
-    filter: &Option<Filter>, graph_filter: &Option<Filter>, widgets_to_harvest: &UsedWidgets,
-) -> Option<GpusData> {
-    if let Ok(nvml) = NVML_DATA.get_or_init(init_nvml) {
-        if let Ok(num_gpu) = nvml.device_count() {
-            let mut temp_vec = Vec::with_capacity(num_gpu as usize);
-            let mut mem_vec = Vec::with_capacity(num_gpu as usize);
-            let mut proc_vec = Vec::with_capacity(num_gpu as usize);
-            let mut total_mem = 0;
-
-            for i in 0..num_gpu {
-                if let Ok(device) = nvml.device_by_index(i) {
-             
```

---

### Incident Patch 10: `9a0cd530` (2026-08-27)
**Commit Message**: ci: fix bug around Rust version pinning in BSD test script (#2222)

Test actually didn't run and I didn't realize 🤦; CI didn't check if the scripts dir was updated. I've fixed both the script and the skip check.

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ jobs:
         uses: ClementTsang/skip-duplicate-actions@41b0a75f656d455934ffa6a46b779d8d996ac47c
         with:
           skip_after_successful_duplicate: "true"
-          paths: '[".cargo/**", ".github/actions/**", ".github/ci/**", ".github/workflows/ci.yml", "sample_configs/**", "src/**", "tests/**", "build.rs", "Cargo.lock", "Cargo.toml", "clippy.toml", "rustfmt.toml", "Cross.toml"]'
+          paths: '[".cargo/**", ".github/actions/**", ".github/ci/**", ".github/workflows/ci.yml", "sample_configs/**", "scripts/ci/**", "src/**", "tests/**", "build.rs", "Cargo.lock", "Cargo.toml", "clippy.toml", "rustfmt.toml", "Cross.toml"]'
           do_not_skip: '["workflow_dispatch", "push"]'
 
   # Runs rustfmt + tests + clippy on the main supported platforms.
```

**File**: `scripts/ci/bsd_tests.sh` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ set -eu
 
 BSD_TARGET="${1:-}"
 SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" > /dev/null && pwd)
-RUST_VERSION=$(cat "$SCRIPT_DIR/.github/ci/rust_version.txt")
+RUST_VERSION=$(cat "$SCRIPT_DIR/../../.github/ci/rust_version.txt")
 
 if [ -z "$BSD_TARGET" ]; then
     echo "Error: BSD target must be specified."
```

---

### Incident Patch 11: `8850188f` (2026-08-27)
**Commit Message**: ci: fix bsd test script not respecting pinned Rust version (#2221)

I had made it so it only used stable, which was generally right but not always (e.g. I downgrade Rust version like right now).

Note this had no effect on actually building the binaries as those use cross.

**File**: `scripts/ci/bsd_tests.sh` (modified, +4/-2)
```diff
@@ -5,6 +5,8 @@
 set -eu
 
 BSD_TARGET="${1:-}"
+SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" > /dev/null && pwd)
+RUST_VERSION=$(cat "$SCRIPT_DIR/.github/ci/rust_version.txt")
 
 if [ -z "$BSD_TARGET" ]; then
     echo "Error: BSD target must be specified."
@@ -14,14 +16,14 @@ fi
 if [ "$BSD_TARGET" = "x86_64-unknown-freebsd" ]; then
     pkg install -y curl bash
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs --output rustup.sh
-    sh rustup.sh --default-toolchain stable -y
+    sh rustup.sh --default-toolchain "$RUST_VERSION" -y
 
     . "$HOME/.cargo/env"
     cargo test --no-fail-fast --locked --features generate_schema -- --nocapture --quiet
 elif [ "$BSD_TARGET" = "x86_64-unknown-netbsd" ]; then
     /usr/sbin/pkg_add -u curl bash mozilla-rootcerts-openssl
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs --output rustup.sh
-    sh rustup.sh --default-toolchain stable -y
+    sh rustup.sh --default-toolchain "$RUST_VERSION" -y
 
     . "$HOME/.cargo/env"
     # TODO: Support default features eventually?
```

---

### Incident Patch 12: `eb81d709` (2026-08-26)
**Commit Message**: ci: revert to using Rust 1.97.1 (#2214)

**File**: `.github/ci/rust_version.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.98.0
+1.97.1
```

---

### Incident Patch 13: `4be359f9` (2026-08-25)
**Commit Message**: bug: handle Linux cmdline that don't have null byte separators (#2210)

**File**: `src/collection/processes/linux/mod.rs` (modified, +23/-18)
```diff
@@ -9,7 +9,6 @@ use std::{
 };
 
 use concat_string::concat_string;
-use itertools::Itertools;
 use process::*;
 use rustc_hash::{FxHashMap as HashMap, FxHashSet as HashSet};
 use sysinfo::ProcessStatus;
@@ -304,24 +303,23 @@ fn read_proc(
 ///
 /// Also note that cmdline is (for us) separated by \0.
 fn binary_name_from_cmdline(cmdline: &str) -> String {
-    let mut start = 0;
-    let mut end = cmdline.len();
-
-    for (i, c) in cmdline.chars().enumerate() {
-        if c == '/' {
-            start = i + 1;
-        } else if c == '\0' || c == ':' {
-            end = i;
-            break;
-        }
-    }
-
-    // Bit of a hack to handle cases like "firefox -blah"
-    let partial = cmdline.chars().skip(start).take(end - start).join("");
-    partial
+    // Normally `/proc/<pid>/cmdline` separates arguments with NUL bytes. Some
+    // processes rewrite it using spaces, though, so stop at the first option in
+    // that case. In particular, do this before looking for the final slash;
+    // otherwise a path in a later argument can be mistaken for the executable.
+    let argv0 = cmdline.split_once('\0').map_or(cmdline, |(argv0, _)| argv0);
+    let executable = argv0
         .split_once(" -")
-        .map(|(name, _)| name.to_string())
-        .unwrap_or_else(|| partial.to_string())
+        .map_or(argv0, |(executable, _)| executable);
+    let executable = executable
+        .split_once(':')
+        .map_or(executable, |(executable, _)| executable);
+
+    executable
+        .rsplit('/')
+        .next()
+        .unwrap_or(executable)
+        .to_string()
 }
 
 pub(crate) struct PrevProc<'a> {
@@ -567,6 +565,13 @@ mod tests {
             binary_name_from_cmdline("firefox -contentproc -isForBrowser -prefsHandle 0"),
             "firefox"
         );
+        assert_eq!(
+            binary_name_from_cmdline(
+                "/nix/store/discord/opt/Discord/.Discord-wrapped --type=renderer \
+                 --openh264-library-path=/home/user/libopenh264-2.5.1-linux64.7.so"
+            ),
+            ".Discord-wrapped"
+        );
         assert_eq!(binary_name_from_cmdline("こんにちは\0"), "こんにちは");
         assert_eq!(
             binary_name_from_cmdline("こんにちは -こんばんは"),
```

---

### Incident Patch 14: `e7ec5633` (2026-08-24)
**Commit Message**: docs: fix typo in the '--help' flag (#2207)

**File**: `src/options/args.rs` (modified, +1/-1)
```diff
@@ -685,7 +685,7 @@ pub struct StyleArgs {
 #[derive(Args, Clone, Debug)]
 #[command(next_help_heading = "Other Options", rename_all = "snake_case")]
 pub struct OtherArgs {
-    #[arg(short = 'h', long, action = ArgAction::Help, help = "Prints help info (for more details use '--help'.")]
+    #[arg(short = 'h', long, action = ArgAction::Help, help = "Prints help info (for more details use '--help').")]
     help: (),
 
     #[arg(short = 'V', long, action = ArgAction::Version, help = "Prints version information.")]
```

---

### Incident Patch 15: `5c27710b` (2026-08-18)
**Commit Message**: ci: run zizmor again to remove action-gh-release and pin almalinux image (#2203)

Run zizmor again. Replaces action-gh-release with just `gh release` and pins the image version for almalinux. Also a driveby fix for docs regarding permissions.

**File**: `.github/ci/release_notes.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+<!-- Write summary here -->
+
+---
+
+## Bug Fixes
+
+## Features
+
+## Changes
+
+## Other
+
+## Internal Changes
+
+## New Contributors
+
+---
```

**File**: `.github/workflows/build_releases.yml` (modified, +1/-1)
```diff
@@ -548,7 +548,7 @@ jobs:
   build-rpm:
     name: "Build .rpm software packages"
     runs-on: ubuntu-24.04
-    container: ghcr.io/clementtsang/almalinux-8
+    container: ghcr.io/clementtsang/almalinux-8:sha-00d3dee
     timeout-minutes: 12
     strategy:
       fail-fast: false
```

**File**: `.github/workflows/deployment.yml` (modified, +5/-31)
```diff
@@ -129,34 +129,8 @@ jobs:
           echo "Generated $(ls ./release | wc -l) files:"
           du -h -d 0 ./release/*
 
-      - name: Create release and add release files
-        uses: softprops/action-gh-release@c062e08bd532815e2082a85e87e3ef29c3e6d191 # 2.0.8
-        with:
-          token: ${{ secrets.GITHUB_TOKEN }}
-          prerelease: false
-          tag_name: ${{ env.RELEASE_VERSION }}
-          draft: true
-          fail_on_unmatched_files: true
-          name: ${{ env.RELEASE_VERSION }} Release
-          body: |
-            <!-- Write summary here -->
-
-            ---
-
-            ## Bug Fixes
-              
-            ## Features
-              
-            ## Changes
-
-            ## Other
-
-            ## Internal Changes
-
-            ## New Contributors
-
-            ---
-
-            **Full Changelog:**
-          files: |
-            ./release/*
+      - name: Create release with files
+        run: |
+          gh release create "${RELEASE_VERSION}" ./release/* --title "${RELEASE_VERSION} Release" --notes-file ./.github/ci/release_notes.md --draft --generate-notes --fail-on-no-commits
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.github/workflows/docs.yml` (modified, +3/-2)
```diff
@@ -1,4 +1,4 @@
-# Workflow to deploy nightly mkdocs documentation.
+# Workflow to deploy mkdocs documentation.
 
 name: docs
 
@@ -39,7 +39,8 @@ jobs:
         uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
         with:
           fetch-depth: 0
-          persist-credentials: false
+          # This is required due to mike needing to push.
+          persist-credentials: true
 
       - uses: actions/setup-python@a309ff8b426b58ec0e2a45f0f869d46889d02405 # v6.2.0
         with:
```

**File**: `.github/workflows/nightly.yml` (modified, +5/-11)
```diff
@@ -135,18 +135,12 @@ jobs:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
 
       # As a workaround to immutable releases, we create it as a draft first, then manually publish it after.
-      - name: Add all release files and create nightly release if not mock
-        uses: softprops/action-gh-release@c062e08bd532815e2082a85e87e3ef29c3e6d191 # 2.0.8
+      - name: Create nightly release with files if not mock
         if: github.event.inputs.isMock != 'true'
-        with:
-          token: ${{ secrets.GITHUB_TOKEN }}
-          prerelease: true
-          tag_name: ${{ env.TAG_NAME }}
-          draft: true
-          fail_on_unmatched_files: true
-          name: ${{ env.RELEASE_NAME }}
-          files: |
-            ./release/*
+        run: |
+          gh release create "${TAG_NAME}" ./release/* --title "${RELEASE_NAME}" --draft --prerelease
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
 
       - name: Publish the draft release
         if: github.event.inputs.isMock != 'true'
```

#### Recent Merged Pull Requests:
- **PR #2275** (2026-10-03): ci: use Rust 1.99 (@ClementTsang)
- **PR #2274** (2026-10-01): docs: update contribution doc (@ClementTsang)
- **PR #2273** (closed): fix(windows): enable SeDebugPrivilege before OpenProcess so elevated kills of service processes work (@Mathjk)
- **PR #2272** (2026-09-30): deps: bump starship-battery to 0.12.0 (@ClementTsang)
- **PR #2271** (closed): fix(windows): enable SeDebugPrivilege so kill works on service/task processes (@Mathjk)
- **PR #2270** (2026-09-29): other: allow clippy lint for regex creation in loops (@ClementTsang)
- **PR #2269** (2026-09-29): docs: update changelog (@ClementTsang)
- **PR #2268** (2026-09-29): other: update PR and issue templates (@ClementTsang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
