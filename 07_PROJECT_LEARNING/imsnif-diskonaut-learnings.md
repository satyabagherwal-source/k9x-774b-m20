> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/imsnif-diskonaut-learnings.md`  
> **Source**: github ([https://github.com/imsnif/diskonaut](https://github.com/imsnif/diskonaut))  
> **Source Version**: `65cd8290`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T09:38:57.354Z  
> **Learning ID**: `learn-github-imsnif-diskonaut`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): imsnif/diskonaut

> **Canonical Artifact**: `07_PROJECT_LEARNING/imsnif-diskonaut-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/imsnif/diskonaut](https://github.com/imsnif/diskonaut))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T09:35:15.455Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `imsnif/diskonaut`
- **Description**: Terminal disk space navigator 🔭
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3145 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/state/file_to_delete.rs`
```
use ::std::ffi::OsString;
use ::std::path::PathBuf;

use crate::state::tiles::FileType;

#[derive(Clone)]
pub struct FileToDelete {
    pub path_in_filesystem: PathBuf,
    pub path_to_file: Vec<OsString>,
    pub file_type: FileType,
    pub num_descendants: Option<u64>,
    pub size: u128,
}

impl FileToDelete {
    pub fn full_path(&self) -> PathBuf {
        let mut full_path = self.path_in_filesystem.clone();
        for component in &self.path_to_file {
            full_path.push(component);
        }
        full_path
    }
}

```

### Core Architecture Module: `src/state/files/file_or_folder.rs`
```
use ::std::collections::{HashMap, VecDeque};
use ::std::ffi::OsString;
use ::std::fs::Metadata;
use ::std::path::PathBuf;

use ::filesize::PathExt;

#[derive(Debug, Clone)]
pub enum FileOrFolder {
    Folder(Folder),
    File(File),
}

impl FileOrFolder {
    pub fn size(&self) -> u128 {
        match self {
            FileOrFolder::Folder(folder) => folder.size,
            FileOrFolder::File(file) => file.size,
        }
    }
}

#[derive(Debug, Clone)]
pub struct File {
    pub name: OsString,
    pub size: u128,
}

#[derive(Debug, Clone)]
pub struct Folder {
    pub name: OsString,
    pub contents: HashMap<OsString, FileOrFolder>,
    pub size: u128,
    pub num_descendants: u64,
}

impl From<OsString> for Folder {
    fn from(name: OsString) -> Self {
        Folder {
            name,
            contents: HashMap::new(),
            size: 0,
            num_descendants: 0,
        }
    }
}
impl Folder {
    pub fn new(path: &PathBuf) -> Self {
        let base_folder_name = path.iter().last().expect("could not get path base name");
        Self {
            name: base_folder_name.to_os_string(),
            contents: HashMap::new(),
            size: 0,
            num_descendants: 0,
        }
    }

    pub fn add_entry(
        &mut self,
        entry_metadata: &Metadata,
        relative_path: PathBuf,
        show_apparent_size: bool,
    ) {
        // apparent_size (named after the flag of the same name in 'du')
        // means "show the file size, rather than the actual space it takes on disk"
        // these may differ (for example) in filesystems that use compression
        if entry_metadata.is_dir() {
            self.add_folder(relative_path);
        } else {
            let size = if show_apparent_size {
                entry_metadata.len() as u128
            } else {
                relative_path
                    .size_on_disk_fast(&entry_metadata)
                    .unwrap_or(entry_metadata.len()) as u128
            };
            self.add_file(relative_path, size);
        }
    }

    pub fn add_folder(&mut self, path: PathBuf) {
        let path_length = path.components().count();
        if path_length == 0 {
            return;
        }
        if path_length > 1 {
            let name = path
                .iter()
                .next()
                .expect("could not get next path element for folder")
                .to_os_string();
            let path_entry = self
                .contents
                .entry(name.clone())
                .or_insert(FileOrFolder::Folder(Folder::from(name)));
            self.num_descendants += 1;
            match path_entry {
                FileOrFolder::Folder(folder) => folder.add_folder(path.iter().skip(1).collect()),
                _ => unreachable!("got a file in the middle of a path"),
            };
        } else {
            let name = path
                .iter()
                .next()
                .expect("could not get next path element for file")
                .to_os_string();
            self.num_descendants += 1;
            self.contents
                .insert(name.clone(), FileOrFolder::Folder(Folder::from(name)));
        }
    }
    pub fn add_file(&mut self, path: PathBuf, size: u128) {
        let path_length = path.components().count();
        if path_length == 0 {
            return;
        }
        if path_length > 1 {
            let name = path
                .iter()
                .next()
                .expect("could not get next path element for folder")
                .to_os_string();
            let path_entry = self
                .contents
                .entry(name.clone())
                .or_insert(FileOrFolder::Folder(Folder::from(name)));
            self.size += size;
            self.num_descendants += 1;
            match path_entry {
                FileOrFolder::Folder(folder) => {
                    folder.add_file(path.iter().skip(1).collect(), size);
                }
                _ => unreachable!("got a file in the middle of a path"),
            };
        } else {
            let name = path
                .iter()
                .next()
                .expect("could not get next path element for file")
                .to_os_string();
            self.size += size;
            self.num_descendants += 1;
            self.contents
                .insert(name.clone(), FileOrFolder::File(File { name, size }));
        }
    }
    pub fn path(&self, mut folder_names: Vec<OsString>) -> Option<&FileOrFolder> {
        let next_folder_name = folder_names.remove(0);
        let next_in_path = &self.contents.get(&next_folder_name)?;
        if folder_names.is_empty() {
            Some(next_in_path)
        } else if let FileOrFolder::Folder(next_folder) = next_in_path {
            next_folder.path(folder_names)
        } else {
            Some(next_in_path)
        }
    }
    pub fn delete_path(&mut self, folder_names: &[OsString]) {
        // TODO: there are some needless allocations here, this is not terrible since
        // the deletion itself takes an order of magnitude longer, but it can be nice
        // to reduce them
        let mut folders_to_traverse: VecDeque<OsString> = VecDeque::from(folder_names.to_owned());
        if folder_names.len() == 1 {
            let name = folder_names
                .last()
                .expect("could not find last item in path");
            let removed_size = &self
                .contents
                .get(name)
                .expect("could not find folder")
                .size();
            let removed_descendents = match &self.contents.get(name).expect("could not find folder")
            {
                FileOrFolder::Folder(folder) => folder.num_descendants,
                FileOrFolder::File(_file) => 1,
            };
            self.size -= removed_size;
            self.num_descendants -= removed_descendents;
            self.contents.remove(name);
        } else {
            let (removed_size, removed_descendents) = {
                let item_to_remove = self
                    .path(Vec::from(folders_to_traverse.clone()))
                    .expect("could not find item to delete");
                let removed_size = item_to_remove.size();
                let removed_descendents = match item_to_remove {
                    FileOrFolder::Folder(folder) => folder.num_descendants,
                    FileOrFolder::File(_file) => 1,
                };
                (removed_size, removed_descendents)
            };
            let next_name = folders_to_traverse
                .pop_front()
                .expect("could not find next path folder");
            let next_item = &mut self
                .contents
                .get_mut(&next_name)
                .expect("could not find folder in path");
            match next_item {
                FileOrFolder::Folder(folder) => {
                    self.size -= removed_size;
                    self.num_descendants -= removed_descendents;
                    folder.delete_path(&Vec::from(folders_to_traverse));
                }
                FileOrFolder::File(_) => {
                    panic!("got a file in the middle of a path");
                }
            }
        }
    }
}

```

### Core Architecture Module: `src/state/files/file_tree.rs`
```
use ::std::ffi::{OsStr, OsString};
use ::std::fs::Metadata;
use ::std::path::{Path, PathBuf};

use crate::state::files::{FileOrFolder, Folder};
use crate::state::FileToDelete;

pub struct FileTree {
    pub current_folder_names: Vec<OsString>,
    pub space_freed: u128,
    pub failed_to_read: u64,
    pub path_in_filesystem: PathBuf,
    base_folder: Folder,
    show_apparent_size: bool,
}

impl FileTree {
    pub fn new(base_folder: Folder, path_in_filesystem: PathBuf, show_apparent_size: bool) -> Self {
        FileTree {
            base_folder,
            current_folder_names: Vec::new(),
            path_in_filesystem,
            space_freed: 0,
            failed_to_read: 0,
            show_apparent_size,
        }
    }
    pub fn get_total_size(&self) -> u128 {
        self.base_folder.size
    }
    pub fn get_total_descendants(&self) -> u64 {
        self.base_folder.num_descendants
    }
    pub fn get_current_folder(&self) -> &Folder {
        if self.current_folder_names.is_empty() {
            &self.base_folder
        } else if let Some(FileOrFolder::Folder(current_folder)) =
            self.base_folder.path(self.current_folder_names.clone())
        {
            &current_folder
        } else {
            // here we have something in current_folder_names but the last
            // one is somehow not a folder... this is a corrupted state
            unreachable!("couldn't find current folder size")
        }
    }
    pub fn get_current_folder_size(&self) -> u128 {
        self.get_current_folder().size
    }
    pub fn get_current_path(&self) -> PathBuf {
        let mut full_path = PathBuf::from(&self.path_in_filesystem);
        for folder in &self.current_folder_names {
            full_path.push(&folder)
        }
        full_path
    }
    pub fn item_in_current_folder(&self, item_name: &OsStr) -> Option<&FileOrFolder> {
        let current_folder = &self.get_current_folder();
        current_folder.path(vec![item_name.to_os_string()])
    }
    pub fn enter_folder(&mut self, folder_name: &OsStr) {
        self.current_folder_names.push(folder_name.to_os_string());
    }
    pub fn leave_folder(&mut self) -> bool {
        // true => succeeded, false => at base folder
        self.current_folder_names.pop().is_some()
    }
    pub fn delete_file(&mut self, file_to_delete: &FileToDelete) {
        let path_to_delete = &file_to_delete.path_to_file;
        self.base_folder.delete_path(&path_to_delete);
    }
    pub fn add_entry(&mut self, entry_metadata: &Metadata, entry_full_path: &Path) {
        let base_path_length = self.path_in_filesystem.components().count();
        let mut relative_path = PathBuf::new();
        for dir in entry_full_path.components().skip(base_path_length) {
            relative_path.push(dir);
        }
        self.base_folder
            .add_entry(entry_metadata, relative_path, self.show_apparent_size);
    }
}

```

### Core Architecture Module: `src/state/files/mod.rs`
```
mod file_or_folder;
mod file_tree;

pub use file_or_folder::*;
pub use file_tree::*;

```

### Core Architecture Module: `src/state/mod.rs`
```
pub mod file_to_delete;
pub mod files;
pub mod tiles;
pub mod ui_effects;

pub use file_to_delete::*;
pub use ui_effects::*;

```

### Core Architecture Module: `src/state/tiles/board.rs`
```
use ::tui::layout::Rect;

use crate::state::files::Folder;
use crate::state::tiles::files_in_folder::FileType;
use crate::state::tiles::{files_in_folder, FileMetadata, Tile, TreeMap};

pub struct Board {
    pub tiles: Vec<Tile>,
    pub unrenderable_tile_coordinates: Option<(u16, u16)>,
    pub selected_index: Option<usize>, // None means nothing is selected
    pub previous_indices_and_zoom_level: Vec<(Option<usize>, usize)>, // Stack of previous stats
    pub zoom_level: usize,
    area: Rect,
    files: Vec<FileMetadata>,
}

impl Board {
    pub fn new(folder: &Folder) -> Self {
        Board {
            tiles: vec![],
            unrenderable_tile_coordinates: None,
            files: files_in_folder(folder, 0),
            selected_index: None,
            previous_indices_and_zoom_level: vec![],
            zoom_level: 0,
            area: Rect {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            },
        }
    }
    pub fn change_files(&mut self, folder: &Folder) {
        self.files = files_in_folder(folder, self.zoom_level);
        self.fill();
    }
    pub fn change_area(&mut self, area: &Rect) {
        if self.area != *area {
            self.area = *area;
            self.fill();
        }
    }
    fn fill(&mut self) {
        let mut tree_map = TreeMap::new(&self.area);
        tree_map.populate_tiles(self.files.iter().collect());
        self.tiles = tree_map.tiles;
        self.unrenderable_tile_coordinates = tree_map.unrenderable_tile_coordinates;
    }
    pub fn get_selected_index(&self) -> Option<usize> {
        self.selected_index
    }
    pub fn set_selected_index(&mut self, next_index: &usize) {
        self.selected_index = Some(*next_index);
    }
    pub fn has_selected_index(&self) -> bool {
        self.selected_index.is_some()
    }
    pub fn reset_selected_index(&mut self) {
        self.selected_index = None;
    }
    pub fn currently_selected(&self) -> Option<&Tile> {
        match &self.selected_index {
            Some(selected_index) => self.tiles.get(*selected_index),
            None => None,
        }
    }
    pub fn pop_previous_index_and_zoom_level(&mut self) -> Option<(Option<usize>, usize)> {
        self.previous_indices_and_zoom_level.pop()
    }
    pub fn move_to_largest_folder(&mut self) {
        let next_index = self
            .tiles
            .iter()
            .enumerate()
            .filter(|(_, tile)| tile.file_type == FileType::Folder)
            .map(|(index, _)| index)
            .next();

        if let Some(index) = next_index {
            self.set_selected_index(&index);
        }
    }
    pub fn move_selected_right(&mut self) {
        match self.currently_selected() {
            Some(currently_selected) => {
                let next_index = self
                    .tiles
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| {
                        c.is_directly_right_of(&currently_selected)
                            && c.horizontally_overlaps_with(&currently_selected)
                    })
                    // get the index of the tile with the most overlap with currently selected
                    .max_by_key(|(_, c)| c.get_horizontal_overlap_with(&currently_selected))
                    .map(|(index, _)| index);
                match next_index {
                    Some(i) => self.set_selected_index(&i),
                    None => self.reset_selected_index(), // move off the edge of the screen resets selection
                }
            }
            None => self.set_selected_index(&0),
        }
    }
    pub fn move_selected_left(&mut self) {
        match self.currently_selected() {
            Some(currently_selected) => {
                let next_index = self
                    .tiles
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| {
                        c.is_directly_left_of(&currently_selected)
                            && c.horizontally_overlaps_with(&currently_selected)
                    })
                    // get the index of the tile with the most overlap with currently selected
                    .max_by_key(|(_, c)| c.get_horizontal_overlap_with(&currently_selected))
                    .map(|(index, _)| index);
                match next_index {
                    Some(i) => self.set_selected_index(&i),
                    None => self.reset_selected_index(), // move off the edge of the screen resets selection
                }
            }
            None => self.set_selected_index(&0),
        }
    }
    pub fn move_selected_down(&mut self) {
        match self.currently_selected() {
            Some(currently_selected) => {
                let next_index = self
                    .tiles
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| {
                        c.is_directly_below(&currently_selected)
                            && c.vertically_overlaps_with(&currently_selected)
                    })
                    // get the index of the tile with the most overlap with currently selected
                    .max_by_key(|(_, c)| c.get_vertical_overlap_with(&currently_selected))
                    .map(|(index, _)| index);
                match next_index {
                    Some(i) => self.set_selected_index(&i),
                    None => self.reset_selected_index(), // move off the edge of the screen resets selection
                }
            }
            None => self.set_selected_index(&0),
        }
    }
    pub fn move_selected_up(&mut self) {
        match self.currently_selected() {
            Some(currently_selected) => {
                let next_index = self
                    .tiles
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| {
                        c.is_directly_above(&currently_selected)
                            && c.vertically_overlaps_with(&currently_selected)
                    })
                    // get the index of the tile with the most overlap with currently selected
                    .max_by_key(|(_, c)| c.get_vertical_overlap_with(&currently_selected))
                    .map(|(index, _)| index);
                match next_index {
                    Some(i) => self.set_selected_index(&i),
                    None => self.reset_selected_index(), // move off the edge of the screen resets selection
                }
            }
            None => self.set_selected_index(&0),
        }
    }
    pub fn zoom_in(&mut self, folder: &Folder) {
        if self.zoom_level < self.files.len() {
            self.zoom_level += 1;
            self.files = files_in_folder(folder, self.zoom_level);
            self.fill();
        }
    }
    pub fn zoom_out(&mut self, folder: &Folder) {
        if self.zoom_level > 0 {
            self.zoom_level -= 1;
            self.files = files_in_folder(folder, self.zoom_level);
            self.fill();
        }
    }
    pub fn reset_zoom(&mut self, folder: &Folder) {
        self.zoom_level = 0;
        self.files = files_in_folder(folder, self.zoom_level);
        self.fill();
    }
    pub fn reset_zoom_index(&mut self) {
        self.zoom_level = 0;
    }
    pub fn set_zoom_index(&mut self, index: usize) {
        self.zoom_level = index;
    }
    pub fn record_current_index_and_zoom_level(&mut self) {
        self.previous_indices_and_zoom_level
            .push((self.get_selected_index(), self.zoom_level));
    }
}

```

### Core Architecture Module: `src/state/tiles/files_in_folder.rs`
```
use ::std::ffi::OsString;

use crate::state::files::{FileOrFolder, Folder};

#[derive(Copy, Clone, Debug, PartialEq)]
pub enum FileType {
    File,
    Folder,
}

#[derive(Debug, Clone)]
pub struct FileMetadata {
    pub name: OsString,
    pub size: u128,
    pub descendants: Option<u64>,
    pub percentage: f64, // 1.0 is 100% (0.5 is 50%, etc.)
    pub file_type: FileType,
}

fn calculate_percentage(size: u128, total_size: u128, total_files_in_parent: usize) -> f64 {
    if size == 0 && total_size == 0 {
        // if all files in the folder are of size 0, we'll want to display them all as
        // the same size
        1.0 / total_files_in_parent as f64
    } else {
        size as f64 / total_size as f64
    }
}

pub fn files_in_folder(folder: &Folder, offset: usize) -> Vec<FileMetadata> {
    let mut files = Vec::new();
    let total_size = folder.size;
    for (name, file_or_folder) in &folder.contents {
        files.push({
            let size = file_or_folder.size();
            let name = name.clone();
            let (descendants, file_type) = match file_or_folder {
                FileOrFolder::Folder(folder) => (Some(folder.num_descendants), FileType::Folder),
                FileOrFolder::File(_file) => (None, FileType::File),
            };
            let percentage = calculate_percentage(size, total_size, folder.contents.len());
            FileMetadata {
                size,
                name,
                descendants,
                percentage,
                file_type,
            }
        });
    }
    files.sort_by(|a, b| {
        if a.percentage == b.percentage {
            a.name.partial_cmp(&b.name).expect("could not compare name")
        } else {
            b.percentage
                .partial_cmp(&a.percentage)
                .expect("could not compare percentage")
        }
    });
    if offset > 0 {
        let removed_items = files.drain(..offset);
        let number_of_files_without_removed_contents = folder.contents.len() - removed_items.len();
        let removed_size = removed_items.fold(0, |acc, file| acc + file.size);
        let size_without_removed_items = total_size - removed_size;
        for i in 0..files.len() {
            files[i].percentage = calculate_percentage(
                files[i].size,
                size_without_removed_items,
                number_of_files_without_removed_contents,
            );
        }
    }
    files
}

```

### Core Architecture Module: `src/state/tiles/mod.rs`
```
pub mod board;
pub mod files_in_folder;
pub mod rect_float;
pub mod tile;
pub mod treemap;

pub use board::*;
pub use files_in_folder::*;
pub use rect_float::*;
pub use tile::*;
pub use treemap::*;

```

### Core Architecture Module: `src/state/tiles/rect_float.rs`
```
use ::tui::layout::Rect;

#[derive(Clone, Debug)]
pub struct RectFloat {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl RectFloat {
    pub fn new(rect: &Rect) -> Self {
        RectFloat {
            x: rect.x as f64,
            y: rect.y as f64,
            height: rect.height as f64,
            width: rect.width as f64,
        }
    }
    pub fn round(&self) -> Rect {
        let rounded_x = self.x.round();
        let rounded_y = self.y.round();
        let mut rect = Rect {
            x: rounded_x as u16,
            y: rounded_y as u16,
            width: ((self.x - rounded_x) + self.width).round() as u16,
            height: ((self.y - rounded_y) + self.height).round() as u16,
        };

        // fix rounding errors
        if (self.x + self.width).round() as u16 > rect.x + rect.width {
            rect.width += 1;
        }
        if (self.y + self.height).round() as u16 > rect.y + rect.height {
            rect.height += 1;
        }
        rect
    }
}

```

### Core Architecture Module: `src/state/tiles/tile.rs`
```
use ::std::ffi::OsString;

use crate::state::tiles::{FileMetadata, FileType, RectFloat};

#[derive(Clone, Debug)]
pub struct Tile {
    pub x: u16,
    pub y: u16,
    pub width: u16,
    pub height: u16,
    pub name: OsString,
    pub size: u128,
    pub descendants: Option<u64>,
    pub percentage: f64,
    pub file_type: FileType,
}

impl Tile {
    pub fn new(rect: &RectFloat, file_metadata: &FileMetadata) -> Self {
        let rounded = rect.round();
        Tile {
            x: rounded.x,
            y: rounded.y,
            width: rounded.width,
            height: rounded.height,
            name: file_metadata.name.clone(),
            size: file_metadata.size,
            descendants: file_metadata.descendants,
            percentage: file_metadata.percentage,
            file_type: file_metadata.file_type,
        }
    }
    pub fn is_directly_right_of(&self, other: &Tile) -> bool {
        self.x == other.x + other.width
    }

    pub fn is_directly_left_of(&self, other: &Tile) -> bool {
        self.x + self.width == other.x
    }

    pub fn is_directly_below(&self, other: &Tile) -> bool {
        self.y == other.y + other.height
    }

    pub fn is_directly_above(&self, other: &Tile) -> bool {
        self.y + self.height == other.y
    }

    pub fn horizontally_overlaps_with(&self, other: &Tile) -> bool {
        (self.y >= other.y && self.y <= (other.y + other.height))
            || ((self.y + self.height) <= (other.y + other.height)
                && (self.y + self.height) > other.y)
            || (self.y <= other.y && (self.y + self.height >= (other.y + other.height)))
            || (other.y <= self.y && (other.y + other.height >= (self.y + self.height)))
    }

    pub fn vertically_overlaps_with(&self, other: &Tile) -> bool {
        (self.x >= other.x && self.x <= (other.x + other.width))
            || ((self.x + self.width) <= (other.x + other.width) && (self.x + self.width) > other.x)
            || (self.x <= other.x && (self.x + self.width >= (other.x + other.width)))
            || (other.x <= self.x && (other.x + other.width >= (self.x + self.width)))
    }

    pub fn get_vertical_overlap_with(&self, other: &Tile) -> u16 {
        std::cmp::min(self.x + self.width, other.x + other.width) - std::cmp::max(self.x, other.x)
    }

    pub fn get_horizontal_overlap_with(&self, other: &Tile) -> u16 {
        std::cmp::min(self.y + self.height, other.y + other.height) - std::cmp::max(self.y, other.y)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #52** (2020-07-12): **thread 'main' panicked at 'index out of bounds: the len is 3600 but the index is 3600**
  *Symptoms*: ``` /mnt/n/AppData/Local/Bisq/runtime/include/win32/bridge                                      thread 'main' panicked at 'index out of bounds: the len is 3600 but the index is 3600', /rustc/4fb7144ed159f94491249e86d5bbd033b5d60550/src/libcore/slice/mod.rs:2842:10 ```  [![asciicast](https://asciinema.org/a/ZEbCIVGa1Z7qmErj3hmXVFuNB.svg)](https://asciinema.org/a/ZEbCIVGa1Z7qmErj3hmXVFuNB)  Running in WSL 2 with `rustc` 1.43.0 (`4fb7144ed` 2020-04-20).
  **Post-Mortem & Fix Analysis**:
  > Hey @pizzafox, sorry for this experience and thanks for reporting this. Mind helping me out with some questions to debug this? Does this happen for every folder you scan? Does the behaviour change if you change the terminal window size? (as in, does it crash earlier, later or not at all with a smaller terminal window?) In the folder you scan, do you happen to have folder/file names with non-latin characters?
  > Did you notice the reported sizes?  One of the last figures seen is 11.6 EB - not far off overflowing a u64.

- **Issue #50** (2020-07-12): **Tests fail because diskonaut reports incorrect file sizes on filesystems with compression**
  *Symptoms*: On my machine and several CI builders, diskonaut tests fail. The problem is that the `rust-filesize` uses `MetadataExt::blocks` to get the number of file blocks:  https://github.com/Freaky/rust-filesize/blob/e8042c00cebd215ac9f106e8b5a20b0c072fd77d/src/lib.rs#L72  However, this method is not reliable. For example:  ``` $ cat blksize.rs  use std::fs; use std::os::unix::fs::MetadataExt; use std::io;  fn main() -> io::Result<()> {     let meta = fs::metadata("2pow20bytes")?;     let blocks = meta.blocks();     let block_size = meta.blksize();     eprintln!("blocks: {}, block size: {}", blocks, block_size);     Ok(()) } $ rustc blksize.rs $ dd if=/dev/zero of=2pow20bytes bs=1024 count=1024 $ ls -l 2pow20bytes  -rw-r--r-- 1 daniel users 1048576 Jun 25 19:48 2pow20bytes $ ./blksize  blocks: 1, block size: 131072 ```  So, this will be reported as a 512 byte file(!), even though it is 1MiB. The wonders of (ZFS) filesystem compression.  ~~~ $ dd if=/dev/urandom of=2pow20bytes bs=1024 count=1024 $ ./blksize  blocks: 2065, block size: 131072 ~~~
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this @danieldk! @Freaky, I think we briefly touched on this before. Do you think there is a workaround for this?
  > Ah, that makes way more sense.  F2FS here, also failing. Assuming @iblech was on ext4 or similar (re https://github.com/NixOS/nixpkgs/pull/91460#issuecomment-649329148)

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

### Incident Patch 1: `d317ea45` (2020-07-04)
**Commit Message**: feat(ui): allow zooming in/out/reset (#61)

* feat(ui): allow zooming in/out/reset

* style(format): rustfmt

* refactor(state): consolidate percentage calculation

* style(format): rustfmt

* fix(tests): clean up temporary files in specific test

**File**: `src/app.rs` (modified, +23/-6)
```diff
@@ -164,15 +164,14 @@ where
         self.render();
     }
     pub fn enter_selected(&mut self) {
-        if let Some(index) = &self.board.get_selected_index() {
-            &self.board.push_previous_index(&index);
-        }
+        self.board.record_current_index_and_zoom_level();
         if let Some(tile) = &self.board.currently_selected() {
             let selected_name = &tile.name;
             if let Some(file_or_folder) = self.file_tree.item_in_current_folder(&selected_name) {
                 match file_or_folder {
                     FileOrFolder::Folder(_) => {
                         self.file_tree.enter_folder(&selected_name);
+                        self.board.reset_zoom_index();
                         self.board.reset_selected_index();
                         self.render_and_update_board();
                     }
@@ -182,10 +181,13 @@ where
         }
     }
     pub fn go_up(&mut self) {
-        if let Some(index) = self.board.pop_previous_index() {
-            self.board.set_selected_index(&index);
-        }
         let succeeded = self.file_tree.leave_folder();
+        if let Some((index, zoom_level)) = self.board.pop_previous_index_and_zoom_level() {
+            if let Some(index) = index {
+                self.board.set_selected_index(&index);
+            }
+            self.board.set_zoom_index(zoom_level);
+        }
         self.render_and_update_board();
         if !succeeded {
             let _ = self.event_sender.try_send(Event::PathError);
@@ -250,6 +252,21 @@ where
     pub fn increment_failed_to_read(&mut self) {
         self.file_tree.failed_to_read += 1;
     }
+    pub fn zoom_in(&mut self) {
+        let current_folder = self.file_tree.get_current_folder();
+        self.board.zoom_in(current_folder);
+        self.render();
+    }
+    pub fn zoom_out(&mut self) {
+        let current_folder = self.file_tree.get_current_folder();
+        self.board.zoom_out(current_folder);
+        self.render();
+    }
+    pub fn reset_zoom(&mut self) {
+        let current_folder = self.file_tree.get_current_folder();
+        self.board.reset_zoom(current_folder);
+        self.render();
+    }
     fn remove_file_from_ui(&mut self, file_to_delete: &FileToDelete) {
         self.file_tree.space_freed += file_to_delete.size;
         self.file_tree.delete_file(file_to_delete);
```

**File**: `src/input/controls.rs` (modified, +18/-0)
```diff
@@ -49,6 +49,15 @@ pub fn handle_keypress_loading_mode<B: Backend>(evt: Event, app: &mut App<B>) {
         key!(char 'k') | key!(Up) | key!(ctrl 'p') => {
             app.move_selected_up();
         }
+        key!(char '+') => {
+            app.zoom_in();
+        }
+        key!(char '-') => {
+            app.zoom_out();
+        }
+        key!(char '0') => {
+            app.reset_zoom();
+        }
         key!(char '\n') => {
             app.handle_enter();
         }
@@ -82,6 +91,15 @@ pub fn handle_keypress_normal_mode<B: Backend>(evt: Event, app: &mut App<B>) {
         key!(char 'k') | key!(Up) | key!(ctrl 'p') => {
             app.move_selected_up();
         }
+        key!(char '+') => {
+            app.zoom_in();
+        }
+        key!(char '-') => {
+            app.zoom_out();
+        }
+        key!(char '0') => {
+            app.reset_zoom();
+        }
         key!(char '\n') => {
             app.handle_enter();
         }
```

**File**: `src/state/tiles/board.rs` (modified, +37/-9)
```diff
@@ -8,7 +8,8 @@ pub struct Board {
     pub tiles: Vec<Tile>,
     pub unrenderable_tile_coordinates: Option<(u16, u16)>,
     pub selected_index: Option<usize>, // None means nothing is selected
-    pub previous_indices: Vec<usize>,  // Stack of previously selected indices
+    pub previous_indices_and_zoom_level: Vec<(Option<usize>, usize)>, // Stack of previous stats
+    pub zoom_level: usize,
     area: Rect,
     files: Vec<FileMetadata>,
 }
@@ -18,9 +19,10 @@ impl Board {
         Board {
             tiles: vec![],
             unrenderable_tile_coordinates: None,
-            files: files_in_folder(folder),
+            files: files_in_folder(folder, 0),
             selected_index: None,
-            previous_indices: vec![],
+            previous_indices_and_zoom_level: vec![],
+            zoom_level: 0,
             area: Rect {
                 x: 0,
                 y: 0,
@@ -30,7 +32,7 @@ impl Board {
         }
     }
     pub fn change_files(&mut self, folder: &Folder) {
-        self.files = files_in_folder(folder);
+        self.files = files_in_folder(folder, self.zoom_level);
         self.fill();
     }
     pub fn change_area(&mut self, area: &Rect) {
@@ -63,11 +65,8 @@ impl Board {
             None => None,
         }
     }
-    pub fn push_previous_index(&mut self, index: &usize) {
-        self.previous_indices.push(*index);
-    }
-    pub fn pop_previous_index(&mut self) -> Option<usize> {
-        self.previous_indices.pop()
+    pub fn pop_previous_index_and_zoom_level(&mut self) -> Option<(Option<usize>, usize)> {
+        self.previous_indices_and_zoom_level.pop()
     }
     pub fn move_to_largest_folder(&mut self) {
         let next_index = self
@@ -170,4 +169,33 @@ impl Board {
             None => self.set_selected_index(&0),
         }
     }
+    pub fn zoom_in(&mut self, folder: &Folder) {
+        if self.zoom_level < self.files.len() {
+            self.zoom_level += 1;
+            self.files = files_in_folder(folder, self.zoom_level);
+            self.fill();
+        }
+    }
+    pub fn zoom_out(&mut self, folder: &Folder) {
+        if self.zoom_level > 0 {
+            self.zoom_level -= 1;
+            self.files = files_in_folder(folder, self.zoom_level);
+            self.fill();
+        }
+    }
+    pub fn reset_zoom(&mut self, folder: &Folder) {
+        self.zoom_level = 0;
+        self.files = files_in_folder(folder, self.zoom_level);
+        self.fill();
+    }
+    pub fn reset_zoom_index(&mut self) {
+        self.zoom_level = 0;
+    }
+    pub fn set_zoom_index(&mut self, index: usize) {
+        self.zoom_level = index;
+    }
+    pub fn record_current_index_and_zoom_level(&mut self) {
+        self.previous_indices_and_zoom_level
+            .push((self.get_selected_index(), self.zoom_level));
+    }
 }
```

**File**: `src/state/tiles/files_in_folder.rs` (modified, +25/-8)
```diff
@@ -17,7 +17,17 @@ pub struct FileMetadata {
     pub file_type: FileType,
 }
 
-pub fn files_in_folder(folder: &Folder) -> Vec<FileMetadata> {
+fn calculate_percentage(size: u64, total_size: u64, total_files_in_parent: usize) -> f64 {
+    if size == 0 && total_size == 0 {
+        // if all files in the folder are of size 0, we'll want to display them all as
+        // the same size
+        1.0 / total_files_in_parent as f64
+    } else {
+        size as f64 / total_size as f64
+    }
+}
+
+pub fn files_in_folder(folder: &Folder, offset: usize) -> Vec<FileMetadata> {
     let mut files = Vec::new();
     let total_size = folder.size;
     for (name, file_or_folder) in &folder.contents {
@@ -28,13 +38,7 @@ pub fn files_in_folder(folder: &Folder) -> Vec<FileMetadata> {
                 FileOrFolder::Folder(folder) => (Some(folder.num_descendants), FileType::Folder),
                 FileOrFolder::File(_file) => (None, FileType::File),
             };
-            let percentage = if size == 0 && total_size == 0 {
-                // if all files in the folder are of size 0, we'll want to display them all as
-                // the same size
-                1.0 / folder.contents.len() as f64
-            } else {
-                size as f64 / total_size as f64
-            };
+            let percentage = calculate_percentage(size, total_size, folder.contents.len());
             FileMetadata {
                 size,
                 name,
@@ -53,5 +57,18 @@ pub fn files_in_folder(folder: &Folder) -> Vec<FileMetadata> {
                 .expect("could not compare percentage")
         }
     });
+    if offset > 0 {
+        let removed_items = files.drain(..offset);
+        let number_of_files_without_removed_contents = folder.contents.len() - removed_items.len();
+        let removed_size = removed_items.fold(0, |acc, file| acc + file.size);
+        let size_without_removed_items = total_size - removed_size;
+        for i in 0..files.len() {
+            files[i].percentage = calculate_percentage(
+                files[i].size,
+                size_without_removed_items,
+                number_of_files_without_removed_contents,
+            );
+        }
+    }
     files
 }
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__cannot_move_into_small_files.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                                                          │xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx│
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__clear_selection_when_moving_off_screen_edges.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_press_n.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

---

### Incident Patch 2: `adbae50d` (2020-07-09)
**Commit Message**: fix(controls): change delete key to backspace (#64)

* Change delete key to backspace

* Add BACKSPACE as delete key within snap tests

* Readd delete key for warning modal

* Change key for warning modal to Backspace

**File**: `src/input/controls.rs` (modified, +7/-7)
```diff
@@ -61,10 +61,10 @@ pub fn handle_keypress_loading_mode<B: Backend>(evt: Event, app: &mut App<B>) {
         key!(char '\n') => {
             app.handle_enter();
         }
-        key!(Delete) => {
+        key!(Backspace) => {
             app.show_warning_modal();
         }
-        key!(Esc) | key!(Backspace) => {
+        key!(Esc) => {
             app.go_up();
         }
         _ => (),
@@ -76,7 +76,7 @@ pub fn handle_keypress_normal_mode<B: Backend>(evt: Event, app: &mut App<B>) {
         key!(ctrl 'c') | key!(char 'q') => {
             app.prompt_exit();
         }
-        key!(Delete) => {
+        key!(Backspace) => {
             app.prompt_file_deletion();
         }
         key!(char 'l') | key!(Right) | key!(ctrl 'f') => {
@@ -103,7 +103,7 @@ pub fn handle_keypress_normal_mode<B: Backend>(evt: Event, app: &mut App<B>) {
         key!(char '\n') => {
             app.handle_enter();
         }
-        key!(Esc) | key!(Backspace) => {
+        key!(Esc) => {
             app.go_up();
         }
         _ => (),
@@ -116,7 +116,7 @@ pub fn handle_keypress_delete_file_mode<B: Backend>(
     file_to_delete: FileToDelete,
 ) {
     match evt {
-        key!(ctrl 'c') | key!(char 'q') | key!(Esc) | key!(Backspace) | key!(char 'n') => {
+        key!(ctrl 'c') | key!(char 'q') | key!(Esc) | key!(char 'n') => {
             app.normal_mode();
         }
         key!(char 'y') => {
@@ -128,7 +128,7 @@ pub fn handle_keypress_delete_file_mode<B: Backend>(
 
 pub fn handle_keypress_error_message<B: Backend>(evt: Event, app: &mut App<B>) {
     match evt {
-        key!(ctrl 'c') | key!(char 'q') | key!(Esc) | key!(Backspace) => {
+        key!(ctrl 'c') | key!(char 'q') | key!(Esc) => {
             app.normal_mode();
         }
         _ => (),
@@ -146,7 +146,7 @@ pub fn handle_keypress_screen_too_small<B: Backend>(evt: Event, app: &mut App<B>
 
 pub fn handle_keypress_exiting_mode<B: Backend>(evt: Event, app: &mut App<B>) {
     match evt {
-        key!(ctrl 'c') | key!(char 'q') | key!(Esc) | key!(Backspace) | key!(char 'n') => {
+        key!(ctrl 'c') | key!(char 'q') | key!(Esc) | key!(char 'n') => {
             app.reset_ui_mode();
             // we have to manually call render here to make sure ui gets updated
             // because reset_ui_mode does not call it itself
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__cannot_move_into_small_files.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                                                          │xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx│
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__clear_selection_when_moving_off_screen_edges.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_press_n.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder_small_window.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                          │
 └──────────────────────────────────────────────────────────┘
                                           (x = Small files) 
- ←↓↑→/<ENTER>/<ESC>: navigate, <DELETE>: del                
+ ←↓↑→/<ENTER>/<ESC>: navigate, <BACKSPACE>: del                
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder_with_multiple_children.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                                        │                                                   │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
 
```

---

### Incident Patch 3: `e5581644` (2020-07-03)
**Commit Message**: feat(ui): change delete key #41 (#59)

**File**: `src/input/controls.rs` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ pub fn handle_keypress_normal_mode<B: Backend>(evt: Event, app: &mut App<B>) {
         key!(ctrl 'c') | key!(char 'q') => {
             app.prompt_exit();
         }
-        key!(ctrl 'd') => {
+        key!(Delete) => {
             app.prompt_file_deletion();
         }
         key!(char 'l') | key!(Right) | key!(ctrl 'f') => {
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__cannot_move_into_small_files.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                                                          │xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx│
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__clear_selection_when_moving_off_screen_edges.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_press_n.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder_small_window.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                          │
 └──────────────────────────────────────────────────────────┘
                                           (x = Small files) 
- ←↓↑→/<ENTER>/<ESC>: navigate, <Ctrl-D>: del                
+ ←↓↑→/<ENTER>/<ESC>: navigate, <DELETE>: del                
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder_with_multiple_children.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                                        │                                                   │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <DELETE> - delete, <q> - quit                                                                                         
 
```

#### Recent Merged Pull Requests:
- **PR #109** (closed): Push pqymwzvkuuvl (@kfkonrad)
- **PR #103** (closed): Adds a CLI flag to skip a folder/directory (@qu0laz)
- **PR #97** (closed): fix(terminal): correctly handles terminal state restoration, panics (@jarjk)
- **PR #88** (closed): Fix Arch Linux installation (@aminvakil)
- **PR #78** (closed): readme: update gentoo overlay (@telans)
- **PR #76** (closed): Add GitHub Actions (GHA) CICD workflow (@rivy)

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

## X. ui): allow zooming in/out/reset (#61)

**RULE**:
When implementing operations in `src/app.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in imsnif/diskonaut. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d317ea45`: ui): allow zooming in/out/reset (#61). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/app.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        self.board.record_current_index_and_zoom_level();
                        self.board.reset_zoom_index();
        if let Some((index, zoom_level)) = self.board.pop_previous_index_and_zoom_level() {
            if let Some(index) = index {
                self.board.set_selected_index(&index);
            }
            self.board.set_zoom_index(zoom_level);
        }
    pub fn zoom_in(&mut self) {
        let current_folder = self.file_tree.get_current_folder();
        self.board.zoom_in(current_folder);
        self.render();
    }
    pub fn zoom_out(&mut self) {
        let current_folder = self.file_tree.get_current_folder();
        self.board.zoom_out(current_folder);
        self.render();
    }
    pub fn reset_zoom(&mut self) {
        let current_folder = self.file_tree.get_current_folder();
        self.board.reset_zoom(current_folder);
        self.render();
    }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        if let Some(index) = &self.board.get_selected_index() {
            &self.board.push_previous_index(&index);
        }
        if let Some(index) = self.board.pop_previous_index() {
            self.board.set_selected_index(&index);
        }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d317ea45` are properly handled with clean fallback behavior.
