# Forensic Learning Record (Deep Inspection): imsnif/diskonaut

> **Canonical Artifact**: `07_PROJECT_LEARNING/imsnif-diskonaut-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/imsnif/diskonaut](https://github.com/imsnif/diskonaut))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:17:56.135Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `imsnif/diskonaut`
- **Description**: Terminal disk space navigator 🔭
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3140 stars

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

### Core Architecture Module: `src/state/tiles/treemap.rs`
```
use ::tui::layout::Rect;

use crate::state::tiles::{FileMetadata, RectFloat, Tile};

const HEIGHT_WIDTH_RATIO: f64 = 2.5;
const MINIMUM_HEIGHT: u16 = 3;
const MINIMUM_WIDTH: u16 = 8;

pub struct TreeMap {
    pub tiles: Vec<Tile>,
    pub unrenderable_tile_coordinates: Option<(u16, u16)>,
    empty_space: RectFloat,
    total_size: f64,
}
impl TreeMap {
    pub fn new(empty_space: &Rect) -> Self {
        let empty_space = RectFloat::new(empty_space);
        TreeMap {
            tiles: vec![],
            unrenderable_tile_coordinates: None,
            total_size: (empty_space.height * empty_space.width) as f64,
            empty_space,
        }
    }
    pub fn populate_tiles<'a>(&'a mut self, children: Vec<&'a FileMetadata>) {
        self.squarify(children, vec![]);
        if let Some((x, y)) = self.unrenderable_tile_coordinates {
            // the unrenderable files area should always be a rectangle
            // so if due to rounding errors some renderable tile is in
            // this area, we'd better remove it
            self.tiles.retain(|tile| tile.x < x || tile.y < y);
        }
    }
    fn layoutrow(&mut self, row: Vec<&FileMetadata>) {
        let row_total = row.iter().fold(0.0, |acc, file_metadata| {
            let size = file_metadata.percentage * self.total_size;
            acc + size
        });
        let should_render_horizontally =
            self.empty_space.width <= self.empty_space.height * HEIGHT_WIDTH_RATIO;
        let mut progress_in_row = if should_render_horizontally {
            self.empty_space.x
        } else {
            self.empty_space.y
        };
        let mut length_of_row_second_side = 0.0;
        for file_metadata in row {
            let size = file_metadata.percentage * self.total_size;
            let tile_length_first_side = if should_render_horizontally {
                (size / row_total) * self.empty_space.width as f64
            } else {
                (size / row_total) * self.empty_space.height as f64
            };

            // we take the highest of length_of_row_second_side and length_candidate so the row will always
            // have the same width, even if it means fudging the calculation a little
            let length_candidate = size / tile_length_first_side;
            let tile_length_second_side = if length_of_row_second_side > length_candidate {
                length_of_row_second_side
            } else {
                length_candidate
            };

            let rect = if should_render_horizontally {
                RectFloat {
                    x: progress_in_row,
                    y: self.empty_space.y,
                    width: tile_length_first_side,
                    height: tile_length_second_side,
                }
            } else {
                RectFloat {
                    x: self.empty_space.x,
                    y: progress_in_row,
                    width: tile_length_second_side,
                    height: tile_length_first_side,
                }
            };
            progress_in_row += tile_length_first_side;

            let tile = Tile::new(&rect, &file_metadata);
            if tile.height < MINIMUM_HEIGHT || tile.width < MINIMUM_WIDTH {
                self.add_unrenderable_tile(&tile);
            } else {
                self.tiles.push(tile)
            }

            if tile_length_second_side > length_of_row_second_side {
                length_of_row_second_side = tile_length_second_side;
            }
        }

        if should_render_horizontally {
            self.empty_space.height -= length_of_row_second_side;
            self.empty_space.y += length_of_row_second_side;
        } else {
            self.empty_space.width -= length_of_row_second_side;
            self.empty_space.x += length_of_row_second_side;
        }
    }
    fn add_unrenderable_tile(&mut self, tile: &Tile) {
        if tile.width == 0 || tile.height == 0 {
            // this is a rounding error, do not add it
            return;
        }
        match self.unrenderable_tile_coordinates {
            Some((x, y)) => {
                let x = if tile.x < x { tile.x } else { x };
                let y = if tile.y < y { tile.y } else { y };
                self.unrenderable_tile_coordinates = Some((x, y));
            }
            None => {
                self.unrenderable_tile_coordinates = Some((tile.x, tile.y));
            }
        }
    }

    fn worst_in_renderable_row(
        &self,
        row: &[&FileMetadata],
        length_of_row: f64,
        min_first_side: f64,
        min_second_side: f64,
    ) -> Option<f64> {
        // None means that at least one item in the row is not renderable, so it should not be
        // considered
        let sum = row.iter().fold(0.0, |accum, file_metadata| {
            let size = file_metadata.percentage * self.total_size;
            accum + size
        });
        let mut worst_aspect_ratio = None;
        for val in row.iter() {
            let size = val.percentage * self.total_size;
            let first_side = (size / sum) * length_of_row;
            let second_side = size / first_side;
            if first_side >= min_first_side && second_side >= min_second_side {
                let val_aspect_ratio = if first_side < second_side {
                    first_side / second_side
                } else {
                    second_side / first_side
                };
                match worst_aspect_ratio {
                    Some(current_worst) => {
                        if val_aspect_ratio < current_worst {
                            worst_aspect_ratio = Some(val_aspect_ratio);
                        }
                    }
                    None => {
                        worst_aspect_ratio = Some(val_aspect_ratio);
                    }
                }
            } else {
                return None;
            }
        }
        worst_aspect_ratio
    }

    fn has_renderable_items(
        &self,
        row: &[&FileMetadata],
        min_first_side: f64,
        min_second_side: f64,
    ) -> bool {
        for val in row.iter() {
            let size = val.percentage * self.total_size;
            if min_first_side * min_second_side <= size {
                return true;
            }
        }
        false
    }

    fn squarify<'a>(
        &'a mut self,
        mut children: Vec<&'a FileMetadata>,
        mut row: Vec<&'a FileMetadata>,
    ) {
        let (length_of_row, min_first_side, min_second_side) =
            if self.empty_space.height * HEIGHT_WIDTH_RATIO < self.empty_space.width {
                (
                    self.empty_space.height * HEIGHT_WIDTH_RATIO,
                    MINIMUM_HEIGHT as f64 * HEIGHT_WIDTH_RATIO,
                    MINIMUM_WIDTH as f64 / HEIGHT_WIDTH_RATIO,
                )
            } else {
                (
                    self.empty_space.width / HEIGHT_WIDTH_RATIO,
                    MINIMUM_WIDTH as f64 / HEIGHT_WIDTH_RATIO,
                    MINIMUM_HEIGHT as f64 * HEIGHT_WIDTH_RATIO,
                )
            };

        if children.is_empty() {
            self.layoutrow(row);
        } else if !self.has_renderable_items(&children, min_first_side, min_second_side) {
            self.layoutrow(row);
            self.layoutrow(children);
        } else {
            let current_row_worst_ratio =
                self.worst_in_renderable_row(&row, length_of_row, min_first_side, min_second_side);
            let row_with_first_child: Vec<&FileMetadata> =
                row.iter().chain(children.iter().take(1)).copied().collect();

            let row_with_child_worst_ratio = self.worst_in_renderable_row(
                &row_with_first_child,
                length_of_row,
                min_first_side,
                min_second_side,
            );

            match (current_row_worst_ratio, row_with_child_worst_ratio) {
                (None, None) => {
                    // we have renderable children somewhere, but not the way
                    // the row is now and not even if we add the next child
                    // let's add the child and keep looking
                    //
                    // worst case we'll run out of renderable children and layout a row
                    // of all of them together (above)
                    let child0 = children.remove(0);
                    row.push(child0);
                    self.squarify(children, row);
                }
                (None, Some(_next_ratio)) => {
                    // the row with the first child is renderable, as opposed to the current row
                    // let's add the child to it and keep looking for the best ratio
                    let child0 = children.remove(0);
                    row.push(child0);
                    self.squarify(children, row);
                }
                (Some(_current_ratio), None) => {
                    // current row is renderable as is and next row will
                    // just make things worse for us, let's render this
                    // row and keep going
                    self.layoutrow(row);
                    self.squarify(children, vec![]);
                }
                (Some(current_ratio), Some(next_ratio)) => {
                    if current_ratio < next_ratio {
                        // adding the next child will all-in-all be an improvement
                        // let's add it to the row and keep looking to see if we
                        // can add more children to it before laying it out
                        let child0 = children.remove(0);
                        row.push(child0);
                        self.squarify(children, row);
                    } else {
                        // this is the best aspect ratio we'll get, adding the next
                        // child will not be an improvement, let's layout this row
                        // and keep going
     
```

### Core Architecture Module: `src/state/ui_effects.rs`
```
use ::std::path::PathBuf;

pub struct UiEffects {
    pub flash_space_freed: bool,
    pub current_path_is_red: bool,
    pub deletion_in_progress: bool,
    pub loading_progress_indicator: u64,
    pub last_read_path: Option<PathBuf>,
}

impl UiEffects {
    pub fn new() -> Self {
        Self {
            flash_space_freed: false,
            current_path_is_red: false,
            deletion_in_progress: false,
            loading_progress_indicator: 0,
            last_read_path: None,
        }
    }
    pub fn increment_loading_progress_indicator(&mut self) {
        // increasing and decreasing this number will increase
        // the scanning text animation speed
        self.loading_progress_indicator += 3;
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
  > This is about 1 TB, definitely not that big. I assume Diskonaut is getting screwed up with a weird Windows FS thing.

- **Issue #50** (2020-07-12): **Tests fail because diskonaut reports incorrect file sizes on filesystems with compression**
  *Symptoms*: On my machine and several CI builders, diskonaut tests fail. The problem is that the `rust-filesize` uses `MetadataExt::blocks` to get the number of file blocks:  https://github.com/Freaky/rust-filesize/blob/e8042c00cebd215ac9f106e8b5a20b0c072fd77d/src/lib.rs#L72  However, this method is not reliable. For example:  ``` $ cat blksize.rs  use std::fs; use std::os::unix::fs::MetadataExt; use std::io;  fn main() -> io::Result<()> {     let meta = fs::metadata("2pow20bytes")?;     let blocks = meta.blocks();     let block_size = meta.blksize();     eprintln!("blocks: {}, block size: {}", blocks, block_size);     Ok(()) } $ rustc blksize.rs $ dd if=/dev/zero of=2pow20bytes bs=1024 count=1024 $ ls -l 2pow20bytes  -rw-r--r-- 1 daniel users 1048576 Jun 25 19:48 2pow20bytes $ ./blksize  blocks: 1, block size: 131072 ```  So, this will be reported as a 512 byte file(!), even though it is 1MiB. The wonders of (ZFS) filesystem compression.  ~~~ $ dd if=/dev/urandom of=2pow20bytes bs=1024 count=1024 $ ./blksize  blocks: 2065, block size: 131072 ~~~
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this @danieldk! @Freaky, I think we briefly touched on this before. Do you think there is a workaround for this?
  > Ah, that makes way more sense.  F2FS here, also failing. Assuming @iblech was on ext4 or similar (re https://github.com/NixOS/nixpkgs/pull/91460#issuecomment-649329148)
  > Did you consider usig `Metadata::len`?  Of course, it depends on the goal, is it diskonaut's goal to report the file sizes or what they use on disk (e.g. after compression)? I would guess the former, though I can see why the latter would be useful.

- **Issue #42** (2020-06-23): **Different results from running the tests locally**
  *Symptoms*: Previously discussed in #40   When I run the tests locally with `cargo test` on the `main` branch, I get very different results each time. Sometimes all the tests pass (which is somewhat rare), sometimes most of them fail.  Terminal screen capture: https://asciinema.org/a/MGtehVJYHt76Pq1DTDQyRxv2J  Raw output captured by `script`: [output.txt](https://github.com/imsnif/diskonaut/files/4813837/output.txt)
  **Post-Mortem & Fix Analysis**:
  > So just to reiterate: this does not happen to me and does not happen in our CI. I have a guess as to what's causing this. @redzic, could you try changing this line: https://github.com/imsnif/diskonaut/blob/main/src/main.rs#L147 to `.parallelism(::jwalk::Parallelism::Serial)` and seeing if it solves the issue for you? This will change the HD scanning from multi-threaded to single threaded. Maybe running lots of tests in parallel is making things go out of whack for this.  If it doesn't, could you try and see if you can get the tests to fail by running just half of them (just comment out half), if so, just one or two tests?  Thanks for the help on this!
  > Wow... changing that line resolves the issue for me. All 37 tests pass now every single time. I wonder why the multi-threaded version works on other machines but not mine.
  > Aha! That's great news. I can't completely explain why this is happening. This was kind of a gut feeling. I'd like to add conditional compilation for this (to make it be serial for tests and the way it is now for not-tests). Would you like to work on this, @redzic or shall I?

- **Issue #26** (2020-06-19): **Feature: Support for Filesystem Compression (e.g. NTFS, BTRFS, ...)**
  *Symptoms*: When running diskonaut on a BTRFS filesystem with compression enabled, it shows the uncompressed space used by folders and files, not the actual disk-space used.  One folder of mine using 69.5G of storage, but if I delete this folder I would not regain 69.5G worth of disk space because that folder is being compressed instead I would only regain 50G of space which represents the actual space used on the disk.  The command [`sudo compsize /path/to/folder`] was able to identify the post-compression space used.  ## Rationale for feature:  If I am using this tool, I am likely trying to free space so that I may allocate a new file.  Suppose I want to download a 4GiB iso image. If I have a 4.5GiB zip archive and a 5GiB text-file, `diskonaut` would make it appear that deleting the text-file would let me download the iso with a GiB to spare. Unfortunately, with compression enabled, the compressible zip archive would still free up 4.5GiB while the highly compressible text-file may only free a 900MiB. At that point I would download the iso, run out of space and then have to reopen `diskonaut` to free ? more GiB (and hope that compression doesn't cause more trouble).  ## Design Questions  * How should the compressed vs uncompressed space be represented in the UI?      The uncompressed usage may still be useful if I plan on copying my files to a location without compression. * On filesystems where it is relatively slow to compute the compressed disk usage, should there
  **Post-Mortem & Fix Analysis**:
  > It appears to be doing the right thing:  https://github.com/imsnif/diskonaut/blob/f19a4f5a1d64349ab2bc28946295caaf3dc3c75e/src/state/files/file_or_folder.rs#L61  And indeed it's correctly reporting the size of compressed files on ZFS.
  > @dbramucci - thank you very much for this very detailed issue!! And thanks @Freaky for weighing in.  My understanding was also that the `blocks * 512` should solve this. So @dbramucci, do you think this is particular to BTRFS? Could there be another reason for this? Or?
  > @imsnif It might be particular to BTRFS or extent based filesystems in general. I'll have to try out NTFS later to test another compression supporting, block based filesystem.  Every accurate disk space utility I've seen for BTRFS so far requires `sudo` to run. Which indicates something special goes on with BTRFS.  Looking at the [manpage for `btrfs-filesystem`](https://btrfs.wiki.kernel.org/index.php/Manpage/btrfs-filesystem) under `du` (e.g. `sudo btrfs filesystem du ~/Downloads`) Shows that `FIEMAP` is used to compute the file sizes. This makes me think (and here, I'm out of my depth) that this has to do with BTRFS being an extent based filesystem and not a block based filesystem. That is, BTRFS doesn't keep a list of all fixed sized blocks used for a file but rather, uses a list of variable length intervals (called extents).  This seems particularly relevant given that `FIEMAP` appears to stand for **FI**le **E**xtent **MAP**. Likewise, it doesn't use fixed sized blocks 

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

### Incident Patch 1: `f330d852` (2020-10-15)
**Commit Message**: feat(ui): only show small files legend when visible (#75)

* feat: only show small files legend when visible

* refactor: add render_small_files_legend function

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__clear_selection_when_moving_off_screen_edges.snap` (modified, +2/-2)
```diff
@@ -50,6 +50,6 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
-                                                                                                                                                                            (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+                                                                                                                                                                                              
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file.snap` (modified, +2/-2)
```diff
@@ -50,6 +50,6 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
-                                                                                                                                                                            (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+                                                                                                                                                                                              
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_no_confirmation.snap` (modified, +1/-1)
```diff
@@ -50,6 +50,6 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
-                                                                                                                                                                            (x = Small files) 
+                                                                                                                                                                                              
  <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_press_n.snap` (modified, +2/-2)
```diff
@@ -50,6 +50,6 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
-                                                                                                                                                                            (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+                                                                                                                                                                                              
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder.snap` (modified, +2/-2)
```diff
@@ -50,6 +50,6 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
-                                                                                                                                                                            (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                            
+                                                                                                                                                                                              
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder_no_confirmation.snap` (modified, +1/-1)
```diff
@@ -50,6 +50,6 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
-                                                                                                                                                                            (x = Small files) 
+                                                                                                                                                                                              
  <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <BACKSPACE> - delete, <+/-/0> - zoom in/out/reset, <q> - quit                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder_small_window.snap` (modified, +1/-1)
```diff
@@ -50,6 +50,6 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                          │
 │                                                          │
 └──────────────────────────────────────────────────────────┘
-                                          (x = Small files) 
+                                                            
  ←↓↑→/<ENTER>/<ESC>: navigate, <BACKSPACE>: del             
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder_small_window_no_confirmation.snap` (modified, +1/-1)
```diff
@@ -50,6 +50,6 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                          │
 │                                                          │
 └──────────────────────────────────────────────────────────┘
-                                          (x = Small files) 
+                                                            
  ←↓↑→/<ENTER>/<ESC>: navigate, <BACKSPACE>: del             
 
```

---

### Incident Patch 2: `f4989056` (2020-09-07)
**Commit Message**: feat(ux): add option to delete with out a confirmation prompt (#71)

* implement disabling delete confirmation option

* add tests for delete confirmation disable option

* fix linting

**File**: `src/app.rs` (modified, +13/-2)
```diff
@@ -34,6 +34,7 @@ where
     display: Display<B>,
     event_sender: SyncSender<Event>,
     ui_effects: UiEffects,
+    delete_confirmation_disabled: bool,
 }
 
 impl<B> App<B>
@@ -45,6 +46,7 @@ where
         path_in_filesystem: PathBuf,
         event_sender: SyncSender<Event>,
         show_apparent_size: bool,
+        disable_delete_confirmation: bool,
     ) -> Self {
         let display = Display::new(terminal_backend);
         let board = Board::new(&Folder::new(&path_in_filesystem));
@@ -65,6 +67,7 @@ where
             ui_mode: UiMode::Loading,
             event_sender,
             ui_effects,
+            delete_confirmation_disabled: disable_delete_confirmation,
         }
     }
     pub fn start(&mut self, receiver: Receiver<Instruction>) {
@@ -213,8 +216,16 @@ where
     }
     pub fn prompt_file_deletion(&mut self) {
         if let Some(file_to_delete) = self.get_file_to_delete() {
-            self.ui_mode = UiMode::DeleteFile(file_to_delete);
-            self.render();
+            self.ui_mode = UiMode::DeleteFile(file_to_delete.clone());
+
+            if self.delete_confirmation_disabled {
+                // Here we just delete the file.
+                // As we have set the UI mode above we will get the deletion in progress message box instead of the prompt.
+                self.delete_file(&file_to_delete);
+            } else {
+                // Here we will render which will display the confirmation prompt
+                self.render();
+            }
         }
     }
     pub fn normal_mode(&mut self) {
```

**File**: `src/main.rs` (modified, +12/-1)
```diff
@@ -52,6 +52,9 @@ pub struct Opt {
     #[structopt(short, long)]
     /// Show file sizes rather than their block usage on disk
     apparent_size: bool,
+    #[structopt(short, long)]
+    /// Don't ask for confirmation before deleting
+    disable_delete_confirmation: bool,
 }
 
 fn main() {
@@ -79,6 +82,7 @@ fn try_main() -> Result<(), failure::Error> {
                 Box::new(keyboard_events),
                 folder,
                 opts.apparent_size,
+                opts.disable_delete_confirmation,
             );
         }
         Err(_) => failure::bail!("Failed to get stdout: are you trying to pipe 'diskonaut'?"),
@@ -91,6 +95,7 @@ pub fn start<B>(
     keyboard_events: Box<dyn Iterator<Item = TermionEvent> + Send>,
     path: PathBuf,
     show_apparent_size: bool,
+    disable_delete_confirmation: bool,
 ) where
     B: Backend + Send + 'static,
 {
@@ -231,7 +236,13 @@ pub fn start<B>(
         );
     }
 
-    let mut app = App::new(terminal_backend, path, event_sender, show_apparent_size);
+    let mut app = App::new(
+        terminal_backend,
+        path,
+        event_sender,
+        show_apparent_size,
+        disable_delete_confirmation,
+    );
     app.start(instruction_receiver);
     running.store(false, Ordering::Release);
     cleanup();
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_no_confirmation-2.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[1]"
+---
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ ████████████████████████████████████████████████████████████file2████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████4.0K (33%)██████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+ █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████                                                                
+                                                                                                                                                                                              
+                                                                                              
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_no_confirmation-3.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[2]"
+---
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                      Deleting                                                                       │                   
+                    │                                                                         
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_no_confirmation-4.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[3]"
+---
+        8.0K (3 files), fre d: 4.0K | /tmp/diskonau _te ts/d l te_file_no_confirmation                                                                                                        
+                                                                                                                              ─                                                               
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                            file3                                                                                             
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                          4.0K (50%)                                                                                          
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                    ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
+                                                                                              
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_no_confirmation-5.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[4]"
+---
+ Total: 8.0K (3 files), freed: 4.0K                                                                                                                                                           
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                              
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_no_confirmation-6.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[5]"
+---
+ Total: 8.0K (3 files), freed: 4.0K                                                                                                                                                           
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                              
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_no_confirmation-7.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[6]"
+---
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                           Are you sure you want to quit?                                                            │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                         
```

---

### Incident Patch 3: `9cff09e2` (2020-09-02)
**Commit Message**: docs(readme): fix some styles

**File**: `README.md` (modified, +3/-1)
```diff
@@ -13,7 +13,9 @@ Once completed, you can navigate through subfolders, getting a visual treemap re
 If you're using linux, you can check out the "releases" of this repository to download the latest prebuilt binary.
 
 ### With cargo (linux/macOS)
-`cargo install diskonaut`
+```
+cargo install diskonaut
+```
 
 ### Fedora/CentOS
 
```

---

### Incident Patch 4: `adbae50d` (2020-07-09)
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

### Incident Patch 5: `bb867087` (2020-07-06)
**Commit Message**: fix: Use u128 for sizes (#52) (#63)

**File**: `src/state/file_to_delete.rs` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ pub struct FileToDelete {
     pub path_to_file: Vec<OsString>,
     pub file_type: FileType,
     pub num_descendants: Option<u64>,
-    pub size: u64,
+    pub size: u128,
 }
 
 impl FileToDelete {
```

**File**: `src/state/files/file_or_folder.rs` (modified, +5/-5)
```diff
@@ -12,7 +12,7 @@ pub enum FileOrFolder {
 }
 
 impl FileOrFolder {
-    pub fn size(&self) -> u64 {
+    pub fn size(&self) -> u128 {
         match self {
             FileOrFolder::Folder(folder) => folder.size,
             FileOrFolder::File(file) => file.size,
@@ -23,14 +23,14 @@ impl FileOrFolder {
 #[derive(Debug, Clone)]
 pub struct File {
     pub name: OsString,
-    pub size: u64,
+    pub size: u128,
 }
 
 #[derive(Debug, Clone)]
 pub struct Folder {
     pub name: OsString,
     pub contents: HashMap<OsString, FileOrFolder>,
-    pub size: u64,
+    pub size: u128,
     pub num_descendants: u64,
 }
 
@@ -61,7 +61,7 @@ impl Folder {
         } else {
             let size = relative_path
                 .size_on_disk_fast(&entry_metadata)
-                .unwrap_or(entry_metadata.len());
+                .unwrap_or(entry_metadata.len()) as u128;
             self.add_file(relative_path, size);
         }
     }
@@ -97,7 +97,7 @@ impl Folder {
                 .insert(name.clone(), FileOrFolder::Folder(Folder::from(name)));
         }
     }
-    pub fn add_file(&mut self, path: PathBuf, size: u64) {
+    pub fn add_file(&mut self, path: PathBuf, size: u128) {
         let path_length = path.components().count();
         if path_length == 0 {
             return;
```

**File**: `src/state/files/file_tree.rs` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@ use crate::state::FileToDelete;
 pub struct FileTree {
     base_folder: Folder,
     pub current_folder_names: Vec<OsString>,
-    pub space_freed: u64,
+    pub space_freed: u128,
     pub failed_to_read: u64,
     pub path_in_filesystem: PathBuf,
 }
@@ -23,7 +23,7 @@ impl FileTree {
             failed_to_read: 0,
         }
     }
-    pub fn get_total_size(&self) -> u64 {
+    pub fn get_total_size(&self) -> u128 {
         self.base_folder.size
     }
     pub fn get_total_descendants(&self) -> u64 {
@@ -42,7 +42,7 @@ impl FileTree {
             unreachable!("couldn't find current folder size")
         }
     }
-    pub fn get_current_folder_size(&self) -> u64 {
+    pub fn get_current_folder_size(&self) -> u128 {
         self.get_current_folder().size
     }
     pub fn get_current_path(&self) -> PathBuf {
```

**File**: `src/state/tiles/files_in_folder.rs` (modified, +2/-2)
```diff
@@ -11,13 +11,13 @@ pub enum FileType {
 #[derive(Debug, Clone)]
 pub struct FileMetadata {
     pub name: OsString,
-    pub size: u64,
+    pub size: u128,
     pub descendants: Option<u64>,
     pub percentage: f64, // 1.0 is 100% (0.5 is 50%, etc.)
     pub file_type: FileType,
 }
 
-fn calculate_percentage(size: u64, total_size: u64, total_files_in_parent: usize) -> f64 {
+fn calculate_percentage(size: u128, total_size: u128, total_files_in_parent: usize) -> f64 {
     if size == 0 && total_size == 0 {
         // if all files in the folder are of size 0, we'll want to display them all as
         // the same size
```

**File**: `src/state/tiles/tile.rs` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ pub struct Tile {
     pub width: u16,
     pub height: u16,
     pub name: OsString,
-    pub size: u64,
+    pub size: u128,
     pub descendants: Option<u64>,
     pub percentage: f64,
     pub file_type: FileType,
```

**File**: `src/ui/display.rs` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ use crate::UiMode;
 
 pub struct FolderInfo<'a> {
     pub path: &'a PathBuf,
-    pub size: u64,
+    pub size: u128,
     pub num_descendants: u64,
 }
 
```

**File**: `src/ui/title/title_line.rs` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@ use nix::unistd::geteuid;
 pub struct TitleLine<'a> {
     base_path_info: FolderInfo<'a>,
     current_path_info: FolderInfo<'a>,
-    space_freed: u64,
+    space_freed: u128,
     show_loading: bool,
     progress_indicator: u64,
     read_errors: Option<u64>,
@@ -26,7 +26,7 @@ impl<'a> TitleLine<'a> {
     pub fn new(
         base_path_info: FolderInfo<'a>,
         current_path_info: FolderInfo<'a>,
-        space_freed: u64,
+        space_freed: u128,
     ) -> Self {
         Self {
             base_path_info,
```

---

### Incident Patch 6: `d317ea45` (2020-07-04)
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

### Incident Patch 7: `356904fa` (2020-07-04)
**Commit Message**: feat(ux): implement a warning modal on deleting a file/folder while s… (#60)

* feat(app) implement a warning modal on deleting a file/folder while scanning

add keypress handler for warning_modal

update apps ui state of warning modal

implement autoclose functionality for warningmodal

* remove auto close functionality from warning modal

* fix(controls): use delete key when loading

Co-authored-by: Aram Drevekenin <[REDACTED_EMAIL]>

**File**: `src/app.rs` (modified, +7/-0)
```diff
@@ -19,6 +19,7 @@ pub enum UiMode {
     DeleteFile(FileToDelete),
     ErrorMessage(String),
     Exiting { app_loaded: bool },
+    WarningMessage(FileToDelete),
 }
 
 pub struct App<B>
@@ -120,6 +121,12 @@ where
             }
         };
     }
+    pub fn show_warning_modal(&mut self) {
+        if let Some(file_to_delete) = self.get_file_to_delete() {
+            self.ui_mode = UiMode::WarningMessage(file_to_delete);
+            self.render();
+        }
+    }
     pub fn prompt_exit(&mut self) {
         self.ui_mode = UiMode::Exiting {
             app_loaded: self.loaded,
```

**File**: `src/input/controls.rs` (modified, +11/-0)
```diff
@@ -52,6 +52,9 @@ pub fn handle_keypress_loading_mode<B: Backend>(evt: Event, app: &mut App<B>) {
         key!(char '\n') => {
             app.handle_enter();
         }
+        key!(Delete) => {
+            app.show_warning_modal();
+        }
         key!(Esc) | key!(Backspace) => {
             app.go_up();
         }
@@ -137,3 +140,11 @@ pub fn handle_keypress_exiting_mode<B: Backend>(evt: Event, app: &mut App<B>) {
         _ => (),
     };
 }
+
+pub fn handle_keypress_warning_message<B: Backend>(evt: Event, app: &mut App<B>) {
+    match evt {
+        _ => {
+            app.reset_ui_mode();
+        }
+    }
+}
```

**File**: `src/messages/instruction.rs` (modified, +4/-0)
```diff
@@ -7,6 +7,7 @@ use ::tui::backend::Backend;
 use crate::input::{
     handle_keypress_delete_file_mode, handle_keypress_error_message, handle_keypress_exiting_mode,
     handle_keypress_loading_mode, handle_keypress_normal_mode, handle_keypress_screen_too_small,
+    handle_keypress_warning_message,
 };
 use crate::{App, UiMode};
 
@@ -85,6 +86,9 @@ where
                     UiMode::Exiting { app_loaded: _ } => {
                         handle_keypress_exiting_mode(evt, app);
                     }
+                    UiMode::WarningMessage(_) => {
+                        handle_keypress_warning_message(evt, app);
+                    }
                 }
                 if !app.is_running {
                     break;
```

**File**: `src/ui/display.rs` (modified, +31/-1)
```diff
@@ -7,7 +7,7 @@ use crate::state::files::FileTree;
 use crate::state::tiles::Board;
 use crate::state::UiEffects;
 use crate::ui::grid::RectangleGrid;
-use crate::ui::modals::{ConfirmBox, ErrorBox, MessageBox};
+use crate::ui::modals::{ConfirmBox, ErrorBox, MessageBox, WarningBox};
 use crate::ui::title::TitleLine;
 use crate::ui::{BottomLine, TermTooSmall};
 use crate::UiMode;
@@ -246,6 +246,36 @@ where
                         );
                         f.render_widget(ConfirmBox::new(), full_screen);
                     }
+                    UiMode::WarningMessage(_) => {
+                        f.render_widget(
+                            TitleLine::new(
+                                base_path_info,
+                                current_path_info,
+                                file_tree.space_freed,
+                            )
+                            .progress_indicator(ui_effects.loading_progress_indicator)
+                            .path_error(ui_effects.current_path_is_red)
+                            .read_errors(file_tree.failed_to_read)
+                            .show_loading(),
+                            chunks[0],
+                        );
+                        f.render_widget(
+                            RectangleGrid::new(
+                                &board.tiles,
+                                board.unrenderable_tile_coordinates,
+                                board.selected_index,
+                            ),
+                            chunks[1],
+                        );
+                        f.render_widget(
+                            BottomLine::new()
+                                .currently_selected(board.currently_selected())
+                                .last_read_path(ui_effects.last_read_path.as_ref())
+                                .hide_delete(),
+                            chunks[2],
+                        );
+                        f.render_widget(WarningBox::new(), full_screen);
+                    }
                 };
             })
             .expect("failed to draw");
```

**File**: `src/ui/modals/mod.rs` (modified, +2/-0)
```diff
@@ -1,7 +1,9 @@
 mod confirm_box;
 mod error_box;
 mod message_box;
+mod warning_box;
 
 pub use confirm_box::*;
 pub use error_box::*;
 pub use message_box::*;
+pub use warning_box::*;
```

**File**: `src/ui/modals/warning_box.rs` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+use tui::buffer::Buffer;
+use tui::layout::Rect;
+use tui::style::{Color, Modifier, Style};
+use tui::widgets::Widget;
+
+use crate::ui::format::truncate_end;
+use crate::ui::grid::draw_filled_rect;
+
+pub struct WarningBox {}
+
+impl<'a> WarningBox {
+    pub fn new() -> Self {
+        Self {}
+    }
+}
+
+impl<'a> Widget for WarningBox {
+    fn render(self, area: Rect, buf: &mut Buffer) {
+        let (width, height) = if area.width > 150 {
+            (150, 10)
+        } else if area.width >= 50 {
+            (area.width / 2, 10)
+        } else {
+            unreachable!("app should not be rendered if window is so small")
+        };
+
+        // position self in the middle of the rect
+        let x = ((area.x + area.width) / 2) - width / 2;
+        let y = ((area.y + area.height) / 2) - height / 2;
+
+        let warning_rect = Rect {
+            x,
+            y,
+            width,
+            height,
+        };
+        let fill_style = Style::default()
+            .bg(Color::Black)
+            .fg(Color::Yellow)
+            .modifier(Modifier::BOLD);
+        let text_max_length = warning_rect.width - 4;
+        let mut warning_text_start_position: u16 = 0;
+
+        let possible_warning_texts = [
+            "Sorry, deletion is only allowed once the scanning has completed",
+            "Deletion is not allowed while scanning",
+            "Can't delete while scanning",
+            "Can't delete now",
+        ];
+        // set default value of the warning_text
+        // to the longest one from possible_warning_texts array
+        let mut warning_text = String::from(possible_warning_texts[0]);
+        for line in possible_warning_texts.iter() {
+            // "+5" here is to make sure confirm message has always some padding
+            if warning_rect.width >= (line.chars().count() as u16) + 5 {
+                // here we truncate the end and not the middle because
+                // when dealing with warning messages, the beginning tends
+                // to be the important part
+                warning_text = truncate_end(line, text_max_length);
+                warning_text_start_position =
+                    ((warning_rect.width - warning_text.len() as u16) as f64 / 2.0).ceil() as u16
+                        + warning_rect.x;
+                break;
+            }
+        }
+
+        let controls_text = ["(Press any key to dismiss)", "(any key to dismiss)"];
+
+        draw_filled_rect(buf, fill_style, &warning_rect);
+        buf.set_string(
+            warning_text_start_position,
+            warning_rect.y + warning_rect.height / 2 - 2,
+            warning_text,
+            fill_style,
+        );
+
+        for line in controls_text.iter() {
+            if text_max_length >= line.chars().count() as u16 {
+                let start_position =
+                    ((warning_rect.width - line.chars().count() as u16) as f64 / 2.0).ceil() as u16
+                        + warning_rect.x;
+                buf.set_string(
+                    start_position,
+                    warning_rect.y + warning_rect.height / 2 + 2,
+                    line,
+                    fill_style,
+                );
+                break;
+            }
+        }
+    }
+}
```

---

### Incident Patch 8: `e5581644` (2020-07-03)
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

---

### Incident Patch 9: `36961c3c` (2020-06-29)
**Commit Message**: feat(ui): add visual indication running as root (#57)

* Add visual indication running as root

* Fixing formatting

Co-authored-by: Chris Tomlinson <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +26/-0)
```diff
@@ -64,6 +64,11 @@ name = "cassowary"
 version = "0.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 
+[[package]]
+name = "cc"
+version = "1.0.55"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+
 [[package]]
 name = "cfg-if"
 version = "0.1.10"
@@ -187,6 +192,7 @@ dependencies = [
  "filesize 0.2.0 (registry+https://github.com/rust-lang/crates.io-index)",
  "insta 0.16.0 (registry+https://github.com/rust-lang/crates.io-index)",
  "jwalk 0.5.1 (registry+https://github.com/rust-lang/crates.io-index)",
+ "nix 0.17.0 (registry+https://github.com/rust-lang/crates.io-index)",
  "signal-hook 0.1.16 (registry+https://github.com/rust-lang/crates.io-index)",
  "structopt 0.3.15 (registry+https://github.com/rust-lang/crates.io-index)",
  "termion 1.5.5 (registry+https://github.com/rust-lang/crates.io-index)",
@@ -329,6 +335,18 @@ dependencies = [
  "adler32 1.1.0 (registry+https://github.com/rust-lang/crates.io-index)",
 ]
 
+[[package]]
+name = "nix"
+version = "0.17.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+dependencies = [
+ "bitflags 1.2.1 (registry+https://github.com/rust-lang/crates.io-index)",
+ "cc 1.0.55 (registry+https://github.com/rust-lang/crates.io-index)",
+ "cfg-if 0.1.10 (registry+https://github.com/rust-lang/crates.io-index)",
+ "libc 0.2.71 (registry+https://github.com/rust-lang/crates.io-index)",
+ "void 1.0.2 (registry+https://github.com/rust-lang/crates.io-index)",
+]
+
 [[package]]
 name = "num_cpus"
 version = "1.13.0"
@@ -629,6 +647,11 @@ name = "version_check"
 version = "0.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 
+[[package]]
+name = "void"
+version = "1.0.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+
 [[package]]
 name = "winapi"
 version = "0.3.8"
@@ -666,6 +689,7 @@ dependencies = [
 "checksum backtrace 0.3.49 (registry+https://github.com/rust-lang/crates.io-index)" = "05100821de9e028f12ae3d189176b41ee198341eb8f369956407fea2f5cc666c"
 "checksum bitflags 1.2.1 (registry+https://github.com/rust-lang/crates.io-index)" = "cf1de2fe8c75bc145a2f577add951f8134889b4795d47466a54a5c846d691693"
 "checksum cassowary 0.3.0 (registry+https://github.com/rust-lang/crates.io-index)" = "df8670b8c7b9dae1793364eafadf7239c40d669904660c5960d74cfd80b46a53"
+"checksum cc 1.0.55 (registry+https://github.com/rust-lang/crates.io-index)" = "b1be3409f94d7bdceeb5f5fac551039d9b3f00e25da7a74fc4d33400a0d96368"
 "checksum cfg-if 0.1.10 (registry+https://github.com/rust-lang/crates.io-index)" = "4785bdd1c96b2a846b2bd7cc02e86b6b3dbf14e7e53446c4f54c92a361040822"
 "checksum clap 2.33.1 (registry+https://github.com/rust-lang/crates.io-index)" = "bdfa80d47f954d53a35a64987ca1422f495b8d6483c0fe9f7117b36c2a792129"
 "checksum clicolors-control 1.0.1 (registry+https://github.com/rust-lang/crates.io-index)" = "90082ee5dcdd64dc4e9e0d37fbf3ee325419e39c0092191e0393df65518f741e"
@@ -696,6 +720,7 @@ dependencies = [
 "checksum maybe-uninit 2.0.0 (registry+https://github.com/rust-lang/crates.io-index)" = "60302e4db3a61da70c0cb7991976248362f30319e88850c487b9b95bbf059e00"
 "checksum memoffset 0.5.4 (registry+https://github.com/rust-lang/crates.io-index)" = "b4fc2c02a7e374099d4ee95a193111f72d2110197fe200272371758f6c3643d8"
 "checksum miniz_oxide 0.3.7 (registry+https://github.com/rust-lang/crates.io-index)" = "791daaae1ed6889560f8c4359194f56648355540573244a5448a83ba1ecc7435"
+"checksum nix 0.17.0 (registry+https://github.com/rust-lang/crates.io-index)" = "50e4785f2c3b7589a0d0c1dd60285e1188adac4006e8abd6dd578e1567027363"
 "checksum num_cpus 1.13.0 (registry+https://github.com/rust-lang/crates.io-index)" = "05499f3756671c15885fee9034446956fff3f243d6077b91e5767df161f766b3"
 "checksum numtoa 0.1.0 (registry+https://github.com/rust-lang/crates.io-index)" = "b8f8bdf33df195859076e54ab11ee78a1b208382d3a26ec40d142ffc1ecc49ef"
 "checksum object 0.20.0 (registry+https://github.com/rust-lang/crates.io-index)" = "1ab52be62400ca80aa00285d25253d7f7c437b7375c4de678f5405d3afe82ca5"
@@ -732,6 +757,7 @@ dependencies = [
 "checksum unicode-xid 0.2.0 (registry+https://github.com/rust-lang/crates.io-index)" = "826e7639553986605ec5979c7dd957c7895e93eabed50ab2ffa7f6128a75097c"
 "checksum vec_map 0.8.2 (registry+https://github.com/rust-lang/crates.io-index)" = "f1bddf1187be692e79c5ffeab891132dfb0f236ed36a43c7ed39f1165ee20191"
 "checksum version_check 0.9.2 (registry+https://github.com/rust-lang/crates.io-index)" = "b5a972e5669d67ba988ce3dc826706fb0a8b01471c088cb0b6110b805cc36aed"
+"checksum void 1.0.2 (registry+https://github.com/rust-lang/crates.io-index)" = "6a02e4885ed3bc0f2de90ea6dd45ebcbb66dacffe03547fadbb0eeae2770887d"
 "checksum winapi 0.3.8 (registry+https://github.com/rust-lang/crates.io-index)" = "8093091eeb260906a183e6ae1abdba2ef5ef2257a21801128899c3fc699229c6"
 "checksum winapi-i686-pc-windows-gnu 0.4.0 (registry+https://github.com/rust-lang/crates.io-index)" = "ac3b87c63620426dd9b991e5ce0329eff545bccbbb34f3be09ff6fb6ab51b7b6"
 "c
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ signal-hook = "0.1.10"
 structopt = "0.3"
 filesize = "0.2.0"
 unicode-width = "0.1.7"
+nix = "0.17.0"
 
 [dev-dependencies]
 insta = "0.16.0"
```

**File**: `src/ui/title/title_line.rs` (modified, +10/-0)
```diff
@@ -8,6 +8,8 @@ use crate::ui::format::DisplaySize;
 use crate::ui::title::{CellSizeOpt, TitleTelescope};
 use crate::ui::FolderInfo;
 
+use nix::unistd::geteuid;
+
 pub struct TitleLine<'a> {
     base_path_info: FolderInfo<'a>,
     current_path_info: FolderInfo<'a>,
@@ -126,6 +128,14 @@ impl<'a> Widget for TitleLine<'a> {
                 CellSizeOpt::new(" (errors)".to_string()).style(default_style.fg(Color::Red)),
             ]);
         }
+        if geteuid().is_root() {
+            title_telescope.append_to_left_side(vec![
+                CellSizeOpt::new(format!(" (CAUTION: running as root)"))
+                    .style(default_style.fg(Color::Red)),
+                CellSizeOpt::new(format!(" (running as root)")).style(default_style.fg(Color::Red)),
+                CellSizeOpt::new(" (root)".to_string()).style(default_style.fg(Color::Red)),
+            ]);
+        }
         title_telescope.append_to_right_side(vec![CellSizeOpt::new(base_path.to_string())]);
         if !current_path.is_empty() {
             title_telescope.append_to_right_side(vec![
```

---

### Incident Patch 10: `96de8231` (2020-06-27)
**Commit Message**: docs(changelog): are you sure you want to quit?

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 
 ## [Unreleased]
 
+### Added
+* Add an "Are you sure you want to quit?" modal (https://github.com/imsnif/diskonaut/pull/44) - [@mhdmhsni](https://github.com/mhdmhsni)
+
 ### Fixed
 * Fix some small_files rendering edge-cases (https://github.com/imsnif/diskonaut/pull/55) - [@imsnif](https://github.com/imsnif)
 
```

---

### Incident Patch 11: `2a3e2b63` (2020-06-27)
**Commit Message**: feat(ui): add an "Are you sure you want to quit?" modal (#44)

* feat(app): show confirm modal before exit

add keyEvent handler function for exiting mode

add Exiting variant to UiMode enum | add prompt_exit method

implement ExitingMode widget rendering

fix mixed UiState issue

* resolved requested changes

* feat(app) add confirm modal before exit

fix panic in modals when terminal-width=50

listen for all possible keys when user tries to exit

exit without confirmation in ScreenTooSmall mode

fix tests to be compatible with ConfirmModal Changes

* docs(readme): add gentoo installation info (#47)

* feat(ux): make enter select largest folder if nothing is selected (#45)

* Make enter select largest folder if nothing is selected

* Rename method

* Renamed and changed method to do what it originally said

* Efficiency improvements

* Added test for the feature

* Run cargo insta review

* Fixed len for assert_eq!

* Fixed asserts at end of test

* Run cargo insta review again

* docs(changelog): enter largest folder

* docs(readme): fix error in how it works

* feat(ui): show quit shortcut ('q') in the legend (#46)

* Add <q> sho

**File**: `src/app.rs` (modified, +7/-0)
```diff
@@ -18,6 +18,7 @@ pub enum UiMode {
     ScreenTooSmall,
     DeleteFile(FileToDelete),
     ErrorMessage(String),
+    Exiting { app_loaded: bool },
 }
 
 pub struct App<B>
@@ -119,6 +120,12 @@ where
             }
         };
     }
+    pub fn prompt_exit(&mut self) {
+        self.ui_mode = UiMode::Exiting {
+            app_loaded: self.loaded,
+        };
+        self.render();
+    }
     pub fn exit(&mut self) {
         self.is_running = false;
         // here we do a blocking send rather than a try_send
```

**File**: `src/input/controls.rs` (modified, +17/-2)
```diff
@@ -35,7 +35,7 @@ macro_rules! key {
 pub fn handle_keypress_loading_mode<B: Backend>(evt: Event, app: &mut App<B>) {
     match evt {
         key!(ctrl 'c') | key!(char 'q') => {
-            app.exit();
+            app.prompt_exit();
         }
         key!(char 'l') | key!(Right) | key!(ctrl 'f') => {
             app.move_selected_right();
@@ -62,7 +62,7 @@ pub fn handle_keypress_loading_mode<B: Backend>(evt: Event, app: &mut App<B>) {
 pub fn handle_keypress_normal_mode<B: Backend>(evt: Event, app: &mut App<B>) {
     match evt {
         key!(ctrl 'c') | key!(char 'q') => {
-            app.exit();
+            app.prompt_exit();
         }
         key!(ctrl 'd') => {
             app.prompt_file_deletion();
@@ -122,3 +122,18 @@ pub fn handle_keypress_screen_too_small<B: Backend>(evt: Event, app: &mut App<B>
         _ => (),
     };
 }
+
+pub fn handle_keypress_exiting_mode<B: Backend>(evt: Event, app: &mut App<B>) {
+    match evt {
+        key!(ctrl 'c') | key!(char 'q') | key!(Esc) | key!(Backspace) | key!(char 'n') => {
+            app.reset_ui_mode();
+            // we have to manually call render here to make sure ui gets updated
+            // because reset_ui_mode does not call it itself
+            app.render();
+        }
+        key!(char 'y') => {
+            app.exit();
+        }
+        _ => (),
+    };
+}
```

**File**: `src/main.rs` (modified, +3/-2)
```diff
@@ -116,8 +116,9 @@ pub fn start<B>(
                 let running = running.clone();
                 move || {
                     for evt in keyboard_events {
-                        if let TermionEvent::Key(Key::Ctrl('c'))
-                        | TermionEvent::Key(Key::Char('q')) = evt
+                        if let TermionEvent::Key(Key::Char('y'))
+                        | TermionEvent::Key(Key::Char('q'))
+                        | TermionEvent::Key(Key::Ctrl('c')) = evt
                         {
                             // not ideal, but works in a pinch
                             let _ = instruction_sender.send(Instruction::Keypress(evt));
```

**File**: `src/messages/instruction.rs` (modified, +5/-2)
```diff
@@ -5,8 +5,8 @@ use ::termion::event::Event as TermionEvent;
 use ::tui::backend::Backend;
 
 use crate::input::{
-    handle_keypress_delete_file_mode, handle_keypress_error_message, handle_keypress_loading_mode,
-    handle_keypress_normal_mode, handle_keypress_screen_too_small,
+    handle_keypress_delete_file_mode, handle_keypress_error_message, handle_keypress_exiting_mode,
+    handle_keypress_loading_mode, handle_keypress_normal_mode, handle_keypress_screen_too_small,
 };
 use crate::{App, UiMode};
 
@@ -82,6 +82,9 @@ where
                     UiMode::ErrorMessage(_) => {
                         handle_keypress_error_message(evt, app);
                     }
+                    UiMode::Exiting { app_loaded: _ } => {
+                        handle_keypress_exiting_mode(evt, app);
+                    }
                 }
                 if !app.is_running {
                     break;
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__cannot_move_into_small_files-5.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[4]"
+---
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                           Are you sure you want to quit?                                                            │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                         
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__clear_selection_when_moving_off_screen_edges-5.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[4]"
+---
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                           Are you sure you want to quit?                                                            │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                         
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file-8.snap` (modified, +11/-11)
```diff
@@ -22,17 +22,17 @@ expression: "&terminal_draw_events_mirror[7]"
                                                                                                                                                                                               
                                                                                                                                                                                               
                                                                                                                                                                                               
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
-                                                                                                                                                                                              
+                    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                           Are you sure you want to quit?                                                            │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                        (y/n)                                                                        │                   
+                    │                                                                                                                                                     │                   
+                    └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘                   
                                                                                                                                      
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_press_n-5.snap` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+---
+source: src/tests/cases/ui.rs
+expression: "&terminal_draw_events_mirror[4]"
+---
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                                                                                                                                                                                              
+                    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐                   
+                    │                                                                                                                                                     │                   
+                    │                                                                                                                                                     │                   
+                    │                                                           Are you sure you want to quit?                                                            │                   
+                    │                                                                                                                                                     │                   
+                    │                                                                         
```

---

### Incident Patch 12: `d6d32c43` (2020-06-26)
**Commit Message**: docs(changelog): update rendering fix

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 
 ## [Unreleased]
 
+### Fixed
+* Fix some small_files rendering edge-cases (https://github.com/imsnif/diskonaut/pull/55) - [@imsnif](https://github.com/imsnif)
+
 ## [0.4.0] - 2020-06-26
 
 ### Added
```

---

### Incident Patch 13: `628a6e3b` (2020-06-26)
**Commit Message**: fix(rendering): prevent corrupted small files rendering (#55)

**File**: `src/state/tiles/treemap.rs` (modified, +4/-0)
```diff
@@ -99,6 +99,10 @@ impl TreeMap {
         }
     }
     fn add_unrenderable_tile(&mut self, tile: &Tile) {
+        if tile.width == 0 || tile.height == 0 {
+            // this is a rounding error, do not add it
+            return;
+        }
         match self.unrenderable_tile_coordinates {
             Some((x, y)) => {
                 let x = if tile.x < x { tile.x } else { x };
```

---

### Incident Patch 14: `120058d8` (2020-06-26)
**Commit Message**: fix(formatting): prevent crashes on files with multibyte characters (#51)

* Fix crash when truncating to middle of a character

* Fix alignment of file names with wide characters

* Respect use ::formatting convention

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -191,6 +191,7 @@ dependencies = [
  "structopt 0.3.15 (registry+https://github.com/rust-lang/crates.io-index)",
  "termion 1.5.5 (registry+https://github.com/rust-lang/crates.io-index)",
  "tui 0.9.5 (registry+https://github.com/rust-lang/crates.io-index)",
+ "unicode-width 0.1.7 (registry+https://github.com/rust-lang/crates.io-index)",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ jwalk = "0.5"
 signal-hook = "0.1.10"
 structopt = "0.3"
 filesize = "0.2.0"
+unicode-width = "0.1.7"
 
 [dev-dependencies]
 insta = "0.16.0"
```

**File**: `src/ui/format/truncate.rs` (modified, +38/-5)
```diff
@@ -1,11 +1,31 @@
+use ::std::iter::FromIterator;
+use ::unicode_width::UnicodeWidthChar;
+
+fn truncate_iter_to_unicode_width<Input, Collect>(iter: Input, width: usize) -> Collect
+where
+    Input: Iterator<Item = char>,
+    Collect: FromIterator<char>,
+{
+    let mut chunk_width = 0;
+    iter.take_while(|ch| {
+        chunk_width += ch.width().unwrap_or(0);
+        chunk_width <= width
+    })
+    .collect()
+}
+
 pub fn truncate_middle(row: &str, max_length: u16) -> String {
     if max_length < 6 {
-        let mut res = String::from(row);
-        res.truncate(max_length as usize);
-        res
+        truncate_iter_to_unicode_width(row.chars(), max_length as usize)
     } else if row.len() as u16 > max_length {
-        let first_slice = &row[0..(max_length as usize / 2) - 2];
-        let second_slice = &row[(row.len() - (max_length / 2) as usize + 2)..row.len()];
+        let split_point = (max_length as usize / 2) - 2;
+        let first_slice = truncate_iter_to_unicode_width::<_, String>(row.chars(), split_point);
+        let second_slice =
+            truncate_iter_to_unicode_width::<_, Vec<_>>(row.chars().rev(), split_point)
+                .into_iter()
+                .rev()
+                .collect::<String>();
+
         if max_length % 2 == 0 {
             format!("{}[...]{}", first_slice, second_slice)
         } else {
@@ -25,3 +45,16 @@ pub fn truncate_end(row: &str, max_len: u16) -> String {
         row.to_string()
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn truncate_middle_char_boundary() {
+        assert_eq!(
+            truncate_middle("굿걸 - 누가 방송국을 털었나 E06.mp4", 44),
+            "굿걸 - 누가 방송국을[...]국을 털었나 E06.mp4",
+        );
+    }
+}
```

**File**: `src/ui/grid/draw_rect.rs` (modified, +3/-2)
```diff
@@ -1,6 +1,7 @@
 use ::tui::buffer::Buffer;
 use ::tui::layout::Rect;
 use ::tui::style::{Color, Modifier, Style};
+use ::unicode_width::UnicodeWidthStr;
 
 use crate::state::tiles::{FileType, Tile};
 use crate::ui::format::{truncate_middle, DisplaySize, DisplaySizeRounded};
@@ -167,11 +168,11 @@ pub fn draw_filled_rect(buf: &mut Buffer, fill_style: Style, rect: &Rect) {
 
 pub fn draw_tile_text_on_grid(buf: &mut Buffer, tile: &Tile, selected: bool) {
     let first_line = tile_first_line(&tile);
-    let first_line_length = first_line.chars().count() as u16;
+    let first_line_length = first_line.width() as u16;
     let first_line_start_position =
         ((tile.width - first_line_length) as f64 / 2.0).ceil() as u16 + tile.x;
     let second_line = tile_second_line(&tile);
-    let second_line_length = second_line.chars().count();
+    let second_line_length = second_line.width();
     let second_line_start_position =
         ((tile.width - second_line_length as u16) as f64 / 2.0).ceil() as u16 + tile.x;
     let (background_style, first_line_style, second_line_style) = tile_style(&tile, selected);
```

---

### Incident Patch 15: `efd85b86` (2020-06-26)
**Commit Message**: feat(ui): show quit shortcut ('q') in the legend (#46)

* Add <q> shortcut in the legend

* Fix typo for description

* Use <arrows> instead of <hjkl> or <arrow keys>

* Apply fmt

* Merge main

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__cannot_move_into_small_files.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                                                          │xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx│
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete                                                                                                     
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__clear_selection_when_moving_off_screen_edges.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete                                                                                                     
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete                                                                                                     
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_file_press_n.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete                                                                                                     
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                             │                                                              │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete                                                                                                     
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__delete_folder_with_multiple_children.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                                                        │                                                   │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete                                                                                                     
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__eleven_files.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │                                                                                                         │                                              │             8.0K (2%)             │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┴───────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete                                                                                                     
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
 
```

**File**: `src/tests/cases/snapshots/diskonaut__tests__cases__ui__empty_folder.snap` (modified, +1/-1)
```diff
@@ -51,5 +51,5 @@ expression: "&terminal_draw_events_mirror[0]"
 │████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████│
 └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                                                                                             (x = Small files) 
- <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete                                                                                                     
+ <arrows> - move around, <ENTER> - enter folder, <ESC> - parent folder, <Ctrl-D> - delete, <q> - quit                                                                                         
 
```

#### Recent Merged Pull Requests:
- **PR #109** (closed): Push pqymwzvkuuvl (@kfkonrad)
- **PR #103** (closed): Adds a CLI flag to skip a folder/directory (@qu0laz)
- **PR #97** (closed): fix(terminal): correctly handles terminal state restoration, panics (@jarjk)
- **PR #88** (closed): Fix Arch Linux installation (@aminvakil)
- **PR #78** (closed): readme: update gentoo overlay (@telans)
- **PR #76** (closed): Add GitHub Actions (GHA) CICD workflow (@rivy)
- **PR #75** (2020-10-15): feat: only show small files legend when visible (@pjsier)
- **PR #74** (2020-09-23): windows version (@pm100)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
