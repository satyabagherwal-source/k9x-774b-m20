# Forensic Learning Record (Deep Inspection): ClementTsang/bottom

> **Canonical Artifact**: `07_PROJECT_LEARNING/clementtsang-bottom-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ClementTsang/bottom](https://github.com/ClementTsang/bottom))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:27:32.468Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClementTsang/bottom`
- **Description**: Yet another cross-platform graphical process/system monitor.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 14074 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/schema/validator.py`
```
#!/bin/python3

# A simple script to validate that a schema is valid for a file.

import argparse
import tomllib
import jsonschema_rs
import re
import traceback


def main():
    parser = argparse.ArgumentParser(
        description="Validates a file against a JSON schema"
    )
    parser.add_argument(
        "-f", "--file", type=str, required=True, help="The file to check."
    )
    parser.add_argument(
        "-s", "--schema", type=str, required=True, help="The schema to use."
    )
    parser.add_argument(
        "--uncomment",
        required=False,
        action="store_true",
        help="Uncomment the settings inside the file.",
    )
    parser.add_argument(
        "--should_fail",
        required=False,
        action="store_true",
        help="Whether the checked file should fail.",
    )
    args = parser.parse_args()

    file = args.file
    schema = args.schema
    should_fail = args.should_fail
    uncomment = args.uncomment

    with open(file, "rb") as f, open(schema) as s:
        try:
            validator = jsonschema_rs.validator_for(s.read())
        except:
            print("Couldn't create validator.")
            exit()

        if uncomment:
            read_file = f.read().decode("utf-8")
            read_file = re.sub(r"^#([a-zA-Z\[])", r"\1", read_file, flags=re.MULTILINE)
            read_file = re.sub(
                r"^#(\s\s+)([a-zA-Z\[])", r"\2", read_file, flags=re.MULTILINE
            )
            print(f"uncommented file: \n{read_file}\n=====\n")

            toml_str = tomllib.loads(read_file)
        else:
            toml_str = tomllib.load(f)

        try:
            validator.validate(toml_str)
            if should_fail:
                print("Fail! Should have errored.")
                exit(1)
            else:
                print("All good!")
        except jsonschema_rs.ValidationError as err:
            print(f"Caught error: `{err}`")
            print(traceback.format_exc())

            if should_fail:
                print("Caught error, good!")
            else:
                print("Fail!")
                exit(1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/schema_gen/src/main.rs`
```
#![expect(
    clippy::unwrap_used,
    reason = "this is just used to generate jsonschema files"
)]

use bottom::{options::config, widgets};
use clap::Parser;
use itertools::Itertools;
use serde_json::Value;
use strum::VariantArray;

#[derive(Parser)]
struct SchemaOptions {
    /// The version of the schema.
    version: Option<String>,
}

macro_rules! generate_column_schemas {
    ($struct_name:literal, $variants:expr, $schema:expr) => {
        match $schema
            .as_object_mut()
            .unwrap()
            .get_mut("$defs")
            .unwrap()
            .get_mut($struct_name)
            .unwrap()
        {
            Value::Object(original) => {
                let enums = original.get_mut("enum").unwrap();
                *enums = $variants
                    .iter()
                    .flat_map(|variant| variant.get_schema_names())
                    .flat_map(|variant| [variant.to_string(), variant.to_lowercase()])
                    .sorted() // Remember that dedup only works if it's sorted...
                    .dedup()
                    .map(|variant| serde_json::Value::String(variant)) // Have to do it after as it doesn't implement partialeq/eq
                    .collect();

                Ok(())
            }
            _ => Err(anyhow::anyhow!("missing proc columns definition")),
        }
    };
}

fn generate_schema(schema_options: SchemaOptions) -> anyhow::Result<()> {
    // TODO: remove newlines in descriptions?

    let mut schema = schemars::schema_for!(config::Config);
    {
        // TODO: Maybe make this case insensitive? See https://stackoverflow.com/a/68639341
        generate_column_schemas!("ProcColumn", widgets::ProcColumn::VARIANTS, schema)?;
        generate_column_schemas!(
            "DiskWidgetColumn",
            widgets::DiskWidgetColumn::VARIANTS,
            schema
        )?;
        generate_column_schemas!(
            "TempWidgetColumn",
            widgets::TempWidgetColumn::VARIANTS,
            schema
        )?;
    }

    let version = schema_options.version.unwrap_or("nightly".to_string());
    let version_with_v = if version == "nightly" {
        "nightly".to_string()
    } else {
        format!("v{version}")
    };

    schema.insert(
        "$id".into(),
        format!(
            "https://github.com/ClementTsang/bottom/blob/main/schema/{version_with_v}/bottom.json"
        )
        .into(),
    );

    schema.insert(
        "description".into(),
        format!("https://bottom.pages.dev/{version}/configuration/config-file/").into(),
    );

    schema.insert(
        "title".into(),
        format!("Schema for bottom's config file ({version_with_v})").into(),
    );

    println!("{}", serde_json::to_string_pretty(&schema).unwrap());

    Ok(())
}

fn main() -> anyhow::Result<()> {
    let schema_options = SchemaOptions::parse();
    generate_schema(schema_options)?;

    Ok(())
}

```

### Core Architecture Module: `scripts/windows/choco/choco_packager.py`
```
# Because choco is a special case and I'm too lazy to make my
# packaging script robust enough, so whatever, hard-code time.

import hashlib
import sys
from string import Template
import os

args = sys.argv
deployment_file_path_64 = args[1]
version = args[2]
nuspec_template = args[3]
ps1_template = args[4]
generated_nuspec = args[5]
generated_ps1 = args[6]
generated_ps1_dir = args[7]

print("Generating Chocolatey package for:")
print("     64-bit: %s" % deployment_file_path_64)
print("     VERSION: %s" % version)
print("     NUSPEC TEMPLATE: %s" % nuspec_template)
print("     PS1 TEMPLATE: %s" % ps1_template)
print("     GENERATED NUSPEC: %s" % generated_nuspec)
print("     GENERATED PS1: %s" % generated_ps1)
print("     GENERATED PS1 DIR: %s" % generated_ps1_dir)

with open(deployment_file_path_64, "rb") as deployment_file_64:
    hash_64 = hashlib.sha1(deployment_file_64.read()).hexdigest()

    print("Generated hash for 64-bit program: %s" % str(hash_64))

    with open(nuspec_template, "r") as template_file:
        template = Template(template_file.read())
        substitute = template.safe_substitute(version=version)
        print("\n================== Generated nuspec file ==================\n")
        print(substitute)
        print("\n============================================================\n")

        with open(generated_nuspec, "w") as generated_file:
            generated_file.write(substitute)

    os.makedirs(generated_ps1_dir)
    with open(ps1_template, "r") as template_file:
        template = Template(template_file.read())
        substitute = template.safe_substitute(version=version, hash_64=hash_64)
        print(
            "\n================== Generated chocolatey-install file ==================\n"
        )
        print(substitute)
        print("\n============================================================\n")

        with open(generated_ps1, "w") as generated_file:
            generated_file.write(substitute)

```

### Core Architecture Module: `src/app.rs`
```
pub mod data;
pub mod filter;
pub mod layout_manager;
pub mod states;

use std::time::Instant;

use data::*;
use filter::*;
use layout_manager::*;
use rustc_hash::FxHashMap as HashMap;
pub use states::*;

use crate::{
    canvas::{
        components::{data_table::SortOrder, time_series::LegendPosition},
        dialogs::process_kill_dialog::ProcessKillDialog,
    },
    components::time_series::TimeseriesState,
    constants,
    options::config::flags::TableGap,
    utils::data_units::DataUnit,
    widgets::{
        DiskWidgetColumn, ProcWidgetColumn, ProcWidgetMode, TempWidgetColumn, TreeCollapsed,
    },
};

#[derive(Debug, Clone, Eq, PartialEq, Default, Copy)]
pub enum AxisScaling {
    #[default]
    Log,
    Linear,
}

/// AppConfigFields is meant to cover basic fields that would normally be set
/// by config files or launch options.
///
/// TODO: Clean this up, we probably don't need to have this duplicated.
#[derive(Debug, Default)]
#[cfg_attr(test, derive(PartialEq, Eq))]
pub struct AppConfigFields {
    pub update_rate: u64,
    pub temperature_type: TemperatureType,
    pub use_dot: bool,
    pub cpu_left_legend: bool,
    pub show_average_cpu: bool, // TODO: Unify this in CPU options
    pub show_cpu_decimal: bool,
    pub use_current_cpu_total: bool,
    pub unnormalized_cpu: bool,
    pub get_process_threads: bool,
    pub get_process_swap: bool,
    pub use_basic_mode: bool,
    pub default_time_value: u64,
    pub time_interval: u64,
    pub hide_time: bool,
    pub autohide_time: bool,
    pub use_old_network_legend: bool,
    pub table_gap: TableGap,
    pub disable_click: bool,
    pub disable_keys: bool,
    pub enable_gpu: bool,
    pub short_gpu_names: bool,
    pub enable_cache_memory: bool,
    pub show_table_scroll_position: bool,
    pub show_table_scroll_bar: bool,
    #[cfg(any(target_os = "linux", target_os = "macos", target_os = "freebsd"))]
    pub is_advanced_kill: bool,
    pub is_read_only: bool,
    #[cfg(target_os = "linux")]
    pub hide_k_threads: bool,
    #[cfg(feature = "zfs")]
    pub free_arc: bool,
    pub memory_legend_position: Option<LegendPosition>,
    // TODO: Remove these, move network details state-side.
    pub network_unit_type: DataUnit,
    pub network_legend_position: Option<LegendPosition>,
    pub network_scale_type: AxisScaling,
    pub network_use_binary_prefix: bool,
    pub network_show_packets: bool,
    pub network_start_zeroed: bool,
    pub retention_ms: u64,
    pub dedicated_average_row: bool,
    pub default_tree_collapse: bool,
    pub default_temp_sort_column: Option<TempWidgetColumn>,
    pub default_temp_sort_order: SortOrder,
    pub default_disk_sort_column: Option<DiskWidgetColumn>,
    pub default_disk_sort_order: SortOrder,
    pub temperature_legend_position: Option<LegendPosition>,
    pub disk_io_legend_position: Option<LegendPosition>,
    pub disk_show_unmounted: bool,
    pub disk_use_binary_prefix: bool,
    pub disk_io_graph_show_unmounted: bool,
}

/// For filtering out information
#[derive(Debug, Clone, Default)]
pub struct DataFilters {
    pub disk_filter: Option<Filter>,
    pub mount_filter: Option<Filter>,
    pub temp_filter: Option<Filter>,
    pub temp_graph_filter: Option<Filter>,
    pub disk_io_graph_filter: Option<Filter>,
    pub net_filter: Option<Filter>,
}

pub struct App {
    awaiting_second_char: bool,
    second_char: Option<char>,
    pub data_store: DataStore,
    last_key_press: Instant,
    pub(crate) process_kill_dialog: ProcessKillDialog,
    pub help_dialog_state: AppHelpDialogState,
    pub is_expanded: bool,
    pub is_force_redraw: bool,
    pub is_determining_widget_boundary: bool,
    pub basic_mode_use_percent: bool,
    pub states: AppWidgetStates,
    pub app_config_fields: AppConfigFields,
    pub widget_map: HashMap<u64, BottomWidget>,
    pub current_widget: BottomWidget,
    pub used_widgets: UsedWidgets,
    pub filters: DataFilters,
}

impl App {
    /// Create a new [`App`].
    pub fn new(
        app_config_fields: AppConfigFields, states: AppWidgetStates,
        widget_map: HashMap<u64, BottomWidget>, current_widget: BottomWidget,
        used_widgets: UsedWidgets, filters: DataFilters, is_expanded: bool,
    ) -> Self {
        let mut data_store = DataStore::new(used_widgets);
        data_store.set_filters(filters.clone());

        Self {
            awaiting_second_char: false,
            second_char: None,
            data_store,
            last_key_press: Instant::now(),
            process_kill_dialog: ProcessKillDialog::default(),
            help_dialog_state: AppHelpDialogState::default(),
            is_expanded,
            is_force_redraw: false,
            is_determining_widget_boundary: false,
            basic_mode_use_percent: false,
            states,
            app_config_fields,
            widget_map,
            current_widget,
            used_widgets,
            filters,
        }
    }

    /// Update the data in the [`App`].
    pub fn update_data(&mut self) {
        let data_source = self.data_store.get_data();

        // FIXME: (points_rework_v1) maybe separate PR but would it make more
        // sense to store references of data? Would it also make more
        // sense to move the "data set" step to the draw step, and make
        // it only set if force update is set here?
        for proc in self.states.proc_state.widget_states.values_mut() {
            if proc.force_update_data {
                proc.set_table_data(data_source);
            }
        }

        for temp in self.states.temp_state.widget_states.values_mut() {
            if temp.force_update_data {
                temp.set_table_data(&data_source.temp_data);
            }
        }

        for cpu in self.states.cpu_state.widget_states.values_mut() {
            if cpu.force_update_data {
                cpu.set_legend_data(&data_source.cpu_harvest);
            }
        }

        for disk in self.states.disk_state.widget_states.values_mut() {
            if disk.force_update_data {
                disk.set_table_data(data_source);
            }
        }
    }

    pub fn reset(&mut self) {
        // Reset multi
        self.reset_multi_tap_keys();

        // Reset dialog state
        self.help_dialog_state.is_showing_help = false;
        self.process_kill_dialog.reset();

        // Close all searches and reset it
        self.states
            .proc_state
            .widget_states
            .values_mut()
            .for_each(|state| {
                state.proc_search.search_state.reset();
            });

        self.data_store.reset();

        // Reset zoom.
        // TODO: Make this suck less... should just make it so that calling
        // reset fixes this all (including above too).
        for widget_state in self.states.cpu_state.widget_states.values_mut() {
            widget_state.graph.state_mut().reset_zoom();
        }

        for widget_state in self.states.mem_state.widget_states.values_mut() {
            widget_state.graph.state_mut().reset_zoom();
        }

        for widget_state in self.states.net_state.widget_states.values_mut() {
            widget_state.graph.state_mut().reset_zoom();
        }

        for widget_state in self.states.temp_graph_state.widget_states.values_mut() {
            widget_state.graph.state_mut().reset_zoom();
        }
    }

    pub fn should_get_widget_bounds(&self) -> bool {
        self.is_force_redraw || self.is_determining_widget_boundary
    }

    pub fn on_esc(&mut self) {
        self.reset_multi_tap_keys();

        if self.process_kill_dialog.is_open() {
            self.process_kill_dialog.on_esc();
            self.is_force_redraw = true;
        } else if self.help_dialog_state.is_showing_help {
            if self.help_dialog_state.is_searching() {
                self.help_dialog_state.close_search();
                self.is_force_redraw = true;
            } else {
                self.help_dialog_state.is_showing_help 
```

### Core Architecture Module: `src/app/data/mod.rs`
```
//! How we manage data internally.

mod time_series;
pub use time_series::{TimeSeriesData, Values};

mod process;
pub use process::ProcessData;

mod store;
pub use store::*;

mod temperature;
pub use temperature::*;

```

### Core Architecture Module: `src/app/data/process.rs`
```
use std::{collections::BTreeMap, vec::Vec};

use crate::{
    collection::processes::{Pid, ProcessHarvest},
    utils::int_hash::IntHashMap,
};

#[derive(Clone, Debug, Default)]
pub struct ProcessData {
    /// A PID to process data map.
    pub process_harvest: BTreeMap<Pid, ProcessHarvest>,

    /// A mapping between a process PID to any children process PIDs.
    pub process_parent_mapping: IntHashMap<Pid, Vec<Pid>>,

    /// PIDs corresponding to processes that have no parents.
    pub orphan_pids: Vec<Pid>,
}

impl ProcessData {
    pub(super) fn ingest(&mut self, list_of_processes: Vec<ProcessHarvest>) {
        self.process_parent_mapping.clear();

        // Reverse as otherwise the pid mappings are in the wrong order.
        list_of_processes.iter().rev().for_each(|process_harvest| {
            if let Some(parent_pid) = process_harvest.parent_pid {
                if let Some(entry) = self.process_parent_mapping.get_mut(&parent_pid) {
                    entry.push(process_harvest.pid);
                } else {
                    self.process_parent_mapping
                        .insert(parent_pid, vec![process_harvest.pid]);
                }
            }
        });

        self.process_parent_mapping.shrink_to_fit();

        let process_pid_map = list_of_processes
            .into_iter()
            .map(|process| (process.pid, process))
            .collect();
        self.process_harvest = process_pid_map;

        // We collect all processes that either:
        // - Do not have a parent PID (that is, they are orphan processes)
        // - Have a parent PID but we don't have the parent (we promote them as
        //   orphans)
        self.orphan_pids = self
            .process_harvest
            .iter()
            .filter_map(|(pid, process_harvest)| match process_harvest.parent_pid {
                Some(parent_pid) if self.process_harvest.contains_key(&parent_pid) => None,
                _ => Some(*pid),
            })
            .collect();
    }
}

```

### Core Architecture Module: `src/app/data/store.rs`
```
use std::{
    borrow::Borrow,
    hash::{Hash, Hasher},
    time::{Duration, Instant},
    vec::Vec,
};

use rustc_hash::FxHashMap;

use super::{ProcessData, TimeSeriesData};
#[cfg(feature = "battery")]
use crate::collection::batteries;
use crate::{
    app::{AppConfigFields, DataFilters, filter::Filter, layout_manager::UsedWidgets},
    collection::{
        Data,
        cpu::{CpuHarvest, LoadAvgHarvest},
        disks::{DiskHarvest, IoHarvest},
        memory::MemData,
        network::NetworkHarvest,
    },
    utils::data_units::DataUnit,
    widgets::{DiskWidgetData, TempWidgetData},
};

/// Because otherwise you can't do lookups for something like `(String, String)`
/// as a key.
trait PairKey {
    fn pair(&self) -> (&str, &str);
}

impl PairKey for (String, String) {
    fn pair(&self) -> (&str, &str) {
        (&self.0, &self.1)
    }
}

impl PairKey for (&str, &str) {
    fn pair(&self) -> (&str, &str) {
        *self
    }
}

impl<'a> Borrow<dyn PairKey + 'a> for (String, String) {
    fn borrow(&self) -> &(dyn PairKey + 'a) {
        self
    }
}

impl Hash for dyn PairKey + '_ {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.pair().hash(state)
    }
}

impl PartialEq for dyn PairKey + '_ {
    fn eq(&self, other: &Self) -> bool {
        self.pair() == other.pair()
    }
}

impl Eq for dyn PairKey + '_ {}

#[derive(Debug, Clone)]
pub struct TotalNetworkData {
    total_rx: u64,
    total_tx: u64,
}

/// A collection of data. This is where we dump data into.
///
/// TODO: Maybe reduce visibility of internal data, make it only accessible
/// through DataStore?
#[derive(Debug, Clone)]
pub struct InnerData {
    // FIXME: (points_rework_v1) we could be able to remove this with some more refactoring.
    last_update_time: Instant,

    pub(crate) time_series_data: TimeSeriesData,
    pub(crate) network_harvest: NetworkHarvest,
    pub(crate) ram_harvest: Option<MemData>,
    pub(crate) swap_harvest: Option<MemData>,
    #[cfg(not(target_os = "windows"))]
    pub(crate) cache_harvest: Option<MemData>,
    #[cfg(feature = "zfs")]
    pub(crate) arc_harvest: Option<MemData>,
    #[cfg(feature = "gpu")]
    pub(crate) gpu_harvest: Vec<(String, MemData)>,
    pub(crate) cpu_harvest: CpuHarvest,
    pub(crate) load_avg_harvest: LoadAvgHarvest,
    pub(crate) process_data: ProcessData,
    /// TODO: (points_rework_v1) Might be a better way to do this without having
    /// to store here?
    prev_io: FxHashMap<(String, String), (u64, u64)>,
    pub(crate) disk_harvest: Vec<DiskWidgetData>,
    pub(crate) temp_data: Vec<TempWidgetData>,
    #[cfg(feature = "battery")]
    pub(crate) battery_harvest: Vec<batteries::BatteryData>,

    /// Used if we are zeroing out the network data.
    starting_total_network: Option<TotalNetworkData>,
}

impl Default for InnerData {
    fn default() -> Self {
        InnerData {
            last_update_time: Instant::now(),
            time_series_data: TimeSeriesData::default(),
            network_harvest: NetworkHarvest::default(),
            ram_harvest: None,
            #[cfg(not(target_os = "windows"))]
            cache_harvest: None,
            swap_harvest: None,
            cpu_harvest: CpuHarvest::default(),
            load_avg_harvest: LoadAvgHarvest::default(),
            process_data: Default::default(),
            prev_io: FxHashMap::default(),
            disk_harvest: Vec::default(),
            temp_data: Vec::default(),
            #[cfg(feature = "battery")]
            battery_harvest: Vec::default(),
            #[cfg(feature = "zfs")]
            arc_harvest: None,
            #[cfg(feature = "gpu")]
            gpu_harvest: Vec::default(),
            starting_total_network: None,
        }
    }
}

impl InnerData {
    #[allow(
        clippy::boxed_local,
        reason = "This avoids warnings on certain platforms (e.g. 32-bit)."
    )]
    fn eat_data(
        &mut self, mut data: Box<Data>, settings: &AppConfigFields, used_widgets: &UsedWidgets,
        filters: &DataFilters,
    ) {
        let harvested_time = data.collection_time;

        // We must adjust all the network values to their selected type
        // (defaults to bits).
        if matches!(settings.network_unit_type, DataUnit::Byte)
            && let Some(network) = &mut data.network
        {
            network.rx /= 8;
            network.tx /= 8;
        }

        if !settings.use_basic_mode {
            self.time_series_data
                .add(&data, used_widgets, settings, filters);
        }

        if let Some(mut network) = data.network {
            if settings.network_start_zeroed {
                let TotalNetworkData {
                    total_rx: starting_total_rx,
                    total_tx: starting_total_tx,
                } = self.starting_total_network.get_or_insert(TotalNetworkData {
                    total_rx: network.total_rx,
                    total_tx: network.total_tx,
                });

                network.total_rx = network.total_rx.saturating_sub(*starting_total_rx);
                network.total_tx = network.total_tx.saturating_sub(*starting_total_tx);
            }
            self.network_harvest = network;
        }

        self.ram_harvest = data.memory;
        self.swap_harvest = data.swap;

        #[cfg(not(target_os = "windows"))]
        {
            self.cache_harvest = data.cache;
        }

        #[cfg(feature = "zfs")]
        {
            self.arc_harvest = data.arc;
        }

        #[cfg(feature = "gpu")]
        if let Some(gpu) = data.gpu {
            self.gpu_harvest = gpu;
        }

        if let Some(cpu) = data.cpu {
            self.cpu_harvest = cpu;
        }

        if let Some(load_avg) = data.load_avg {
            self.load_avg_harvest = load_avg;
        }

        self.temp_data = data
            .temperature_sensors
            .map(|sensors| {
                sensors
                    .into_iter()
                    .filter(|temp| Filter::optional_should_keep(&filters.temp_filter, &temp.name))
                    .map(|temp| TempWidgetData {
                        sensor: temp.name,
                        temperature: temp
                            .temperature
                            .map(|c| settings.temperature_type.convert_temp_unit(c)),
                    })
                    .collect()
            })
            .unwrap_or_default();

        if let Some(disks) = data.disks
            && let Some(io) = data.io
        {
            self.eat_disks(disks, io, harvested_time, settings.disk_use_binary_prefix);

            if used_widgets.use_disk_io_graph {
                self.time_series_data.update_disk_io(
                    &self.disk_harvest,
                    &filters.disk_io_graph_filter,
                    settings.disk_io_graph_show_unmounted,
                );
            }
        }

        if let Some(list_of_processes) = data.list_of_processes {
            self.process_data.ingest(list_of_processes);
        }

        #[cfg(feature = "battery")]
        {
            if let Some(list_of_batteries) = data.list_of_batteries {
                self.battery_harvest = list_of_batteries;
            }
        }

        // And we're done eating. Update time and push the new entry!
        self.last_update_time = harvested_time;
    }

    fn eat_disks(
        &mut self, disks: Vec<DiskHarvest>, io: IoHarvest, harvested_time: Instant,
        use_binary_prefix: bool,
    ) {
        let time_since_last_harvest = harvested_time
            .duration_since(self.last_update_time)
            .as_secs_f64();

        self.disk_harvest.clear();

        for disk in disks {
            let Some(checked_name) = ({
                #[cfg(target_os = "windows")]
                {
                    match &disk.volume_name {
                        Some(volume_name) => Some(volume_name.as_str()),
                        None => disk.name.split('/').next_back(),
                    }
   
```

### Core Architecture Module: `src/app/data/temperature.rs`
```
//! Code around temperature data.

use std::{fmt::Display, str::FromStr};

#[derive(Clone, Debug, Copy, PartialEq, Eq, Default)]
pub enum TemperatureType {
    #[default]
    Celsius,
    Kelvin,
    Fahrenheit,
}

impl FromStr for TemperatureType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "fahrenheit" | "f" => Ok(TemperatureType::Fahrenheit),
            "kelvin" | "k" => Ok(TemperatureType::Kelvin),
            "celsius" | "c" => Ok(TemperatureType::Celsius),
            _ => Err(format!(
                "'{s}' is an invalid temperature type, use one of: [kelvin, k, celsius, c, fahrenheit, f]."
            )),
        }
    }
}

impl TemperatureType {
    /// Return the unit string.
    pub fn unit(&self) -> &'static str {
        match self {
            TemperatureType::Celsius => "°C",
            TemperatureType::Kelvin => "K",
            TemperatureType::Fahrenheit => "°F",
        }
    }

    /// Given a temperature in Celsius, convert it if necessary for a different
    /// unit.
    pub fn convert_temp_unit(&self, celsius: f32) -> TypedTemperature {
        match self {
            TemperatureType::Celsius => TypedTemperature::Celsius(celsius.ceil() as u32),
            TemperatureType::Kelvin => TypedTemperature::Kelvin((celsius + 273.15).ceil() as u32),
            TemperatureType::Fahrenheit => {
                TypedTemperature::Fahrenheit(((celsius * (9.0 / 5.0)) + 32.0).ceil() as u32)
            }
        }
    }

    /// Given a temperature in Celsius, convert it if necessary for a different
    /// unit as a bare float.
    pub fn convert_temp_unit_float(&self, celsius: f32) -> f32 {
        match self {
            TemperatureType::Celsius => celsius,
            TemperatureType::Kelvin => celsius + 273.15,
            TemperatureType::Fahrenheit => celsius * (9.0 / 5.0) + 32.0,
        }
    }
}

/// A temperature and its type.
#[derive(Debug, PartialEq, Clone, Eq, PartialOrd, Ord)]
pub enum TypedTemperature {
    Celsius(u32),
    Kelvin(u32),
    Fahrenheit(u32),
}

impl Display for TypedTemperature {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TypedTemperature::Celsius(val) => write!(f, "{val}°C"),
            TypedTemperature::Kelvin(val) => write!(f, "{val}K"),
            TypedTemperature::Fahrenheit(val) => write!(f, "{val}°F"),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn temp_conversions() {
        const TEMP: f32 = 100.0;

        assert_eq!(
            TemperatureType::Celsius.convert_temp_unit(TEMP),
            TypedTemperature::Celsius(TEMP as u32),
        );

        assert_eq!(
            TemperatureType::Kelvin.convert_temp_unit(TEMP),
            TypedTemperature::Kelvin(373.15_f32.ceil() as u32)
        );

        assert_eq!(
            TemperatureType::Fahrenheit.convert_temp_unit(TEMP),
            TypedTemperature::Fahrenheit(212)
        );
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

### Incident Patch 1: `fdc29871` (2026-09-22)
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

### Incident Patch 2: `d7b56f6a` (2026-09-16)
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

---

### Incident Patch 3: `175c12ed` (2026-08-31)
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
+       
```

---

### Incident Patch 4: `9a0cd530` (2026-08-27)
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

### Incident Patch 5: `8850188f` (2026-08-27)
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

### Incident Patch 6: `eb81d709` (2026-08-26)
**Commit Message**: ci: revert to using Rust 1.97.1 (#2214)

**File**: `.github/ci/rust_version.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.98.0
+1.97.1
```

---

### Incident Patch 7: `4be359f9` (2026-08-25)
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

### Incident Patch 8: `e7ec5633` (2026-08-24)
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

### Incident Patch 9: `a10eadd2` (2026-08-13)
**Commit Message**: bug: fix cgroups v1 swap collection around sentinel max value (#2195)

Problem was that with cgroups v1, if the swap had an unlimited value set, it would be done by just setting a huge integer, which would break things.

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -20,11 +20,12 @@ That said, these are more guidelines rather than hard rules, though the project
 
 ---
 
-## 0.14.8/0.15.0 - Unreleased
+## 0.14.8 - 2026-08-13
 
 ### Bug Fixes
 
 - [2191](https://github.com/ClementTsang/bottom/pull/2191): Fix close logic when pressing enter in sort menu.
+- [2195](https://github.com/ClementTsang/bottom/pull/2195): Fix cgroups v1 swap collection around sentinel max value.
 
 ## 0.14.7 - 2026-07-27
 
```

**File**: `src/collection.rs` (modified, +5/-1)
```diff
@@ -381,7 +381,11 @@ impl DataCollector {
         self.refresh_sysinfo_data();
 
         #[cfg(target_os = "linux")]
-        self.cgroup_memory_data.refresh();
+        {
+            let total_memory = self.sys.system.total_memory();
+            let total_swap = self.sys.system.total_swap();
+            self.cgroup_memory_data.refresh(total_memory, total_swap);
+        }
 
         #[cfg(target_os = "linux")]
         self.cgroup_cpu_data.refresh();
```

**File**: `src/collection/linux/cgroups.rs` (modified, +24/-8)
```diff
@@ -44,19 +44,32 @@ pub(crate) struct CgroupMemCollector {
     pub swap: Option<CgroupMemData>,
 }
 
+/// Computes the cgroup v1 swap limit. Calculated by getting memsw and subtracting the memory limits.
+#[inline]
+fn cgroup_v1_swap_limit(
+    memsw_limit: u64, mem_limit: Option<u64>, total_memory: u64, total_swap: u64,
+) -> u64 {
+    let effective_memsw_limit = memsw_limit.min(total_memory + total_swap);
+    let effective_mem_limit = mem_limit.map_or(0, |mem_limit| mem_limit.min(total_memory));
+
+    effective_memsw_limit.saturating_sub(effective_mem_limit)
+}
+
 impl CgroupMemCollector {
     /// Refresh the cgroup memory data.
     ///
     /// Based on [docker's CLI](https://github.com/docker/cli/blob/master/cli/command/container/stats_helpers.go#L254).
-    pub(crate) fn refresh(&mut self) {
-        if !self.try_update_memory_cgroup_v1() && !self.try_update_memory_cgroup_v2() {
+    pub(crate) fn refresh(&mut self, total_memory: u64, total_swap: u64) {
+        if !self.try_update_memory_cgroup_v1(total_memory, total_swap)
+            && !self.try_update_memory_cgroup_v2()
+        {
             self.ram = None;
             self.swap = None;
         }
     }
 
     /// Try and update the memory using cgroup v1 semantics. If successful, returns `true`.
-    fn try_update_memory_cgroup_v1(&mut self) -> bool {
+    fn try_update_memory_cgroup_v1(&mut self, total_memory: u64, total_swap: u64) -> bool {
         if let Some(mem_usage) = read_u64("/sys/fs/cgroup/memory/memory.usage_in_bytes") {
             // --- Memory ---
             let inactive =
@@ -66,8 +79,8 @@ impl CgroupMemCollector {
                 _ => mem_usage,
             };
 
-            // Technically if it's like, some insanely high value (https://unix.stackexchange.com/a/421182)
-            // then it's "unlimited" but we can just make it so we take the max of the main and this anyway.
+            // Technically if it's some insanely high value (https://unix.stackexchange.com/a/421182),
+            // then it's "unlimited", but we can just make it so we take the max of the main and this anyway.
             let mem_limit_raw = read_u64("/sys/fs/cgroup/memory/memory.limit_in_bytes");
             let mem_limit = mem_limit_raw.map(CgroupMemLimit::Bytes);
 
@@ -78,12 +91,15 @@ impl CgroupMemCollector {
 
             // --- Swap ---
             // Since swap is dependent on the normal memory usage, we couple it together.
-            if let Some(memsw) = read_u64("/sys/fs/cgroup/memory/memory.memsw.usage_in_bytes") {
-                let used_bytes = memsw.saturating_sub(mem_usage);
+            if let Some(memsw_usage) = read_u64("/sys/fs/cgroup/memory/memory.memsw.usage_in_bytes")
+            {
+                let used_bytes = memsw_usage.saturating_sub(mem_usage);
 
                 // Same idea for here.
                 let swap_limit = read_u64("/sys/fs/cgroup/memory/memory.memsw.limit_in_bytes")
-                    .map(|memsw_limit| memsw_limit.saturating_sub(mem_limit_raw.unwrap_or(0)))
+                    .map(|memsw_limit| {
+                        cgroup_v1_swap_limit(memsw_limit, mem_limit_raw, total_memory, total_swap)
+                    })
                     .map(CgroupMemLimit::Bytes);
 
                 self.swap = Some(CgroupMemData {
```

---

### Incident Patch 10: `ded4585c` (2026-08-13)
**Commit Message**: bug: fix schema links + link generation (#2194)

Fixes the version link generation + current links that were missing the `v`.

**File**: `schema/v0.12.0/bottom.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "$id": "https://github.com/ClementTsang/bottom/blob/main/schema/0.12.0/bottom.json",
+  "$id": "https://github.com/ClementTsang/bottom/blob/main/schema/v0.12.0/bottom.json",
   "$schema": "https://json-schema.org/draft/2020-12/schema",
   "title": "Schema for bottom's config file (v0.12.0)",
   "description": "https://bottom.pages.dev/0.12.0/configuration/config-file/",
```

**File**: `schema/v0.13.0/bottom.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "$id": "https://github.com/ClementTsang/bottom/blob/main/schema/0.13.0/bottom.json",
+  "$id": "https://github.com/ClementTsang/bottom/blob/main/schema/v0.13.0/bottom.json",
   "$schema": "https://json-schema.org/draft/2020-12/schema",
   "title": "Schema for bottom's config file (v0.13.0)",
   "description": "https://bottom.pages.dev/0.13.0/configuration/config-file/",
```

**File**: `schema/v0.14.0/bottom.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "$id": "https://github.com/ClementTsang/bottom/blob/main/schema/0.14.0/bottom.json",
+  "$id": "https://github.com/ClementTsang/bottom/blob/main/schema/v0.14.0/bottom.json",
   "$schema": "https://json-schema.org/draft/2020-12/schema",
   "title": "Schema for bottom's config file (v0.14.0)",
   "description": "https://bottom.pages.dev/0.14.0/configuration/config-file/",
```

**File**: `schema/v0.14.7/bottom.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
-  "$id": "https://github.com/ClementTsang/bottom/blob/main/schema/0.14.7/bottom.json",
+  "$id": "https://github.com/ClementTsang/bottom/blob/main/schema/v0.14.7/bottom.json",
   "$schema": "https://json-schema.org/draft/2020-12/schema",
   "title": "Schema for bottom's config file (v0.14.7)",
   "description": "https://bottom.pages.dev/0.14.7/configuration/config-file/",
```

**File**: `scripts/schema_gen/src/main.rs` (modified, +12/-17)
```diff
@@ -61,33 +61,28 @@ fn generate_schema(schema_options: SchemaOptions) -> anyhow::Result<()> {
     }
 
     let version = schema_options.version.unwrap_or("nightly".to_string());
+    let version_with_v = if version == "nightly" {
+        "nightly".to_string()
+    } else {
+        format!("v{version}")
+    };
+
     schema.insert(
         "$id".into(),
-        format!("https://github.com/ClementTsang/bottom/blob/main/schema/{version}/bottom.json")
-            .into(),
+        format!(
+            "https://github.com/ClementTsang/bottom/blob/main/schema/{version_with_v}/bottom.json"
+        )
+        .into(),
     );
 
     schema.insert(
         "description".into(),
-        format!(
-            "https://bottom.pages.dev/{}/configuration/config-file/",
-            if version == "nightly" {
-                "nightly"
-            } else {
-                version.as_str()
-            }
-        )
-        .into(),
+        format!("https://bottom.pages.dev/{version}/configuration/config-file/").into(),
     );
 
-    let description_version = if version == "nightly" {
-        "nightly".to_string()
-    } else {
-        format!("v{version}")
-    };
     schema.insert(
         "title".into(),
-        format!("Schema for bottom's config file ({description_version})").into(),
+        format!("Schema for bottom's config file ({version_with_v})").into(),
     );
 
     println!("{}", serde_json::to_string_pretty(&schema).unwrap());
```

#### Recent Merged Pull Requests:
- **PR #2273** (closed): fix(windows): enable SeDebugPrivilege before OpenProcess so elevated kills of service processes work (@Mathjk)
- **PR #2272** (2026-09-30): deps: bump starship-battery to 0.12.0 (@ClementTsang)
- **PR #2271** (closed): fix(windows): enable SeDebugPrivilege so kill works on service/task processes (@Mathjk)
- **PR #2270** (2026-09-29): other: allow clippy lint for regex creation in loops (@ClementTsang)
- **PR #2269** (2026-09-29): docs: update changelog (@ClementTsang)
- **PR #2268** (2026-09-29): other: update PR and issue templates (@ClementTsang)
- **PR #2267** (closed): feature: add right-click to open process kill dialog (@HerreraCarlos81)
- **PR #2266** (2026-09-28): change: show decimal places for disk usage info (@ClementTsang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
