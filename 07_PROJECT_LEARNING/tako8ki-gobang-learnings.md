# Forensic Learning Record (Deep Inspection): TaKO8Ki/gobang

> **Canonical Artifact**: `07_PROJECT_LEARNING/tako8ki-gobang-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TaKO8Ki/gobang](https://github.com/TaKO8Ki/gobang))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:23:59.418Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TaKO8Ki/gobang`
- **Description**: A cross-platform TUI database management tool written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3324 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/components/utils/mod.rs`
```
pub mod scroll_vertical;

```

### Core Architecture Module: `src/components/utils/scroll_vertical.rs`
```
use crate::ui::scrollbar::draw_scrollbar;
use std::cell::Cell;
use tui::{backend::Backend, layout::Rect, Frame};

pub struct VerticalScroll {
    top: Cell<usize>,
    max_top: Cell<usize>,
    inside: bool,
    border: bool,
}

impl VerticalScroll {
    pub const fn new(border: bool, inside: bool) -> Self {
        Self {
            top: Cell::new(0),
            max_top: Cell::new(0),
            border,
            inside,
        }
    }

    pub fn get_top(&self) -> usize {
        self.top.get()
    }

    pub fn reset(&self) {
        self.top.set(0);
    }

    pub fn update(&self, selection: usize, selection_max: usize, visual_height: usize) -> usize {
        let new_top = calc_scroll_top(self.get_top(), visual_height, selection, selection_max);
        self.top.set(new_top);

        if visual_height == 0 {
            self.max_top.set(0);
        } else {
            let new_max = selection_max.saturating_sub(visual_height);
            self.max_top.set(new_max);
        }

        new_top
    }

    pub fn draw<B: Backend>(&self, f: &mut Frame<B>, r: Rect) {
        draw_scrollbar(
            f,
            r,
            self.max_top.get(),
            self.top.get(),
            self.border,
            self.inside,
        );
    }
}

const fn calc_scroll_top(
    current_top: usize,
    height_in_lines: usize,
    selection: usize,
    selection_max: usize,
) -> usize {
    if height_in_lines == 0 {
        return 0;
    }
    if selection_max <= height_in_lines {
        return 0;
    }

    if current_top + height_in_lines <= selection {
        selection.saturating_sub(height_in_lines) + 1
    } else if current_top > selection {
        selection
    } else {
        current_top
    }
}

#[cfg(test)]
mod tests {
    use super::calc_scroll_top;

    #[test]
    fn test_scroll_no_scroll_to_top() {
        assert_eq!(calc_scroll_top(1, 10, 4, 4), 0);
    }

    #[test]
    fn test_scroll_zero_height() {
        assert_eq!(calc_scroll_top(4, 0, 4, 3), 0);
    }
}

```

### Core Architecture Module: `src/ui/stateful_paragraph.rs`
```
#![allow(dead_code)]

use easy_cast::Cast;
use std::iter;
use tui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::Style,
    text::{StyledGrapheme, Text},
    widgets::{Block, StatefulWidget, Widget, Wrap},
};
use unicode_width::UnicodeWidthStr;

use super::reflow::{LineComposer, LineTruncator, WordWrapper};

const fn get_line_offset(line_width: u16, text_area_width: u16, alignment: Alignment) -> u16 {
    match alignment {
        Alignment::Center => (text_area_width / 2).saturating_sub(line_width / 2),
        Alignment::Right => text_area_width.saturating_sub(line_width),
        Alignment::Left => 0,
    }
}

#[derive(Debug, Clone)]
pub struct StatefulParagraph<'a> {
    /// A block to wrap the widget in
    block: Option<Block<'a>>,
    /// Widget style
    style: Style,
    /// How to wrap the text
    wrap: Option<Wrap>,
    /// The text to display
    text: Text<'a>,
    /// Alignment of the text
    alignment: Alignment,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ScrollPos {
    pub x: u16,
    pub y: u16,
}

impl ScrollPos {
    pub const fn new(x: u16, y: u16) -> Self {
        Self { x, y }
    }
}

#[derive(Debug, Copy, Clone, Default)]
pub struct ParagraphState {
    /// Scroll
    scroll: ScrollPos,
    /// after all wrapping this is the amount of lines
    lines: u16,
    /// last visible height
    height: u16,
}

impl ParagraphState {
    pub const fn lines(self) -> u16 {
        self.lines
    }

    pub const fn height(self) -> u16 {
        self.height
    }

    pub const fn scroll(self) -> ScrollPos {
        self.scroll
    }

    pub fn set_scroll(&mut self, scroll: ScrollPos) {
        self.scroll = scroll;
    }
}

impl<'a> StatefulParagraph<'a> {
    pub fn new<T>(text: T) -> Self
    where
        T: Into<Text<'a>>,
    {
        Self {
            block: None,
            style: Style::default(),
            wrap: None,
            text: text.into(),
            alignment: Alignment::Left,
        }
    }

    #[allow(clippy::missing_const_for_fn)]
    pub fn block(mut self, block: Block<'a>) -> Self {
        self.block = Some(block);
        self
    }

    pub const fn style(mut self, style: Style) -> Self {
        self.style = style;
        self
    }

    pub const fn wrap(mut self, wrap: Wrap) -> Self {
        self.wrap = Some(wrap);
        self
    }

    pub const fn alignment(mut self, alignment: Alignment) -> Self {
        self.alignment = alignment;
        self
    }
}

impl<'a> StatefulWidget for StatefulParagraph<'a> {
    type State = ParagraphState;

    fn render(mut self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        buf.set_style(area, self.style);
        let text_area = match self.block.take() {
            Some(b) => {
                let inner_area = b.inner(area);
                b.render(area, buf);
                inner_area
            }
            None => area,
        };

        if text_area.height < 1 {
            return;
        }

        let style = self.style;
        let mut styled = self.text.lines.iter().flat_map(|spans| {
            spans
                .0
                .iter()
                .flat_map(|span| span.styled_graphemes(style))
                // Required given the way composers work but might be refactored out if we change
                // composers to operate on lines instead of a stream of graphemes.
                .chain(iter::once(StyledGrapheme {
                    symbol: "\n",
                    style: self.style,
                }))
        });

        let mut line_composer: Box<dyn LineComposer> = if let Some(Wrap { trim }) = self.wrap {
            Box::new(WordWrapper::new(&mut styled, text_area.width, trim))
        } else {
            let mut line_composer = Box::new(LineTruncator::new(&mut styled, text_area.width));
            if let Alignment::Left = self.alignment {
                line_composer.set_horizontal_offset(state.scroll.x);
            }
            line_composer
        };
        let mut y = 0;
        let mut end_reached = false;
        while let Some((current_line, current_line_width)) = line_composer.next_line() {
            if !end_reached && y >= state.scroll.y {
                let mut x = get_line_offset(current_line_width, text_area.width, self.alignment);
                for StyledGrapheme { symbol, style } in current_line {
                    buf.get_mut(text_area.left() + x, text_area.top() + y - state.scroll.y)
                        .set_symbol(if symbol.is_empty() {
                            // If the symbol is empty, the last char which rendered last time will
                            // leave on the line. It's a quick fix.
                            " "
                        } else {
                            symbol
                        })
                        .set_style(*style);
                    x += Cast::<u16>::cast(symbol.width());
                }
            }
            y += 1;
            if y >= text_area.height + state.scroll.y {
                end_reached = true;
            }
        }

        state.lines = y;
        state.height = area.height;
    }
}

```

### Core Architecture Module: `database-tree/src/databasetree.rs`
```
use crate::{
    databasetreeitems::DatabaseTreeItems, error::Result, item::DatabaseTreeItemKind,
    tree_iter::TreeIterator,
};
use crate::{Database, Table};
use std::{collections::BTreeSet, usize};

///
#[derive(Copy, Clone, Debug)]
pub enum MoveSelection {
    Up,
    Down,
    MultipleUp,
    MultipleDown,
    Left,
    Right,
    Top,
    End,
    Enter,
}

#[derive(Debug, Clone, Copy)]
pub struct VisualSelection {
    pub count: usize,
    pub index: usize,
}

/// wraps `DatabaseTreeItems` as a datastore and adds selection functionality
#[derive(Default)]
pub struct DatabaseTree {
    items: DatabaseTreeItems,
    pub selection: Option<usize>,
    visual_selection: Option<VisualSelection>,
}

impl DatabaseTree {
    pub fn new(list: &[crate::Database], collapsed: &BTreeSet<&String>) -> Result<Self> {
        let mut new_self = Self {
            items: DatabaseTreeItems::new(list, collapsed)?,
            selection: if list.is_empty() { None } else { Some(0) },
            visual_selection: None,
        };
        new_self.visual_selection = new_self.calc_visual_selection();

        Ok(new_self)
    }

    pub fn filter(&self, filter_text: String) -> Self {
        let mut new_self = Self {
            items: self.items.filter(filter_text),
            selection: Some(0),
            visual_selection: None,
        };
        new_self.visual_selection = new_self.calc_visual_selection();
        new_self
    }

    pub fn collapse_but_root(&mut self) {
        self.items.collapse(0, true);
        self.items.expand(0, false);
    }

    /// iterates visible elements starting from `start_index_visual`
    pub fn iterate(&self, start_index_visual: usize, max_amount: usize) -> TreeIterator<'_> {
        let start = self
            .visual_index_to_absolute(start_index_visual)
            .unwrap_or_default();
        TreeIterator::new(self.items.iterate(start, max_amount), self.selection)
    }

    pub const fn visual_selection(&self) -> Option<&VisualSelection> {
        self.visual_selection.as_ref()
    }

    pub fn selected_item(&self) -> Option<&crate::DatabaseTreeItem> {
        self.selection
            .and_then(|index| self.items.tree_items.get(index))
    }

    pub fn selected_table(&self) -> Option<(Database, Table)> {
        self.selection.and_then(|index| {
            let item = &self.items.tree_items[index];
            match item.kind() {
                DatabaseTreeItemKind::Database { .. } => None,
                DatabaseTreeItemKind::Table { table, database } => {
                    Some((database.clone(), table.clone()))
                }
                DatabaseTreeItemKind::Schema { .. } => None,
            }
        })
    }

    pub fn collapse_recursive(&mut self) {
        if let Some(selection) = self.selection {
            self.items.collapse(selection, true);
        }
    }

    pub fn expand_recursive(&mut self) {
        if let Some(selection) = self.selection {
            self.items.expand(selection, true);
        }
    }

    pub fn move_selection(&mut self, dir: MoveSelection) -> bool {
        self.selection.map_or(false, |selection| {
            let new_index = match dir {
                MoveSelection::Up => self.selection_up(selection, 1),
                MoveSelection::Down => self.selection_down(selection, 1),
                MoveSelection::MultipleUp => self.selection_up(selection, 10),
                MoveSelection::MultipleDown => self.selection_down(selection, 10),
                MoveSelection::Left => self.selection_left(selection),
                MoveSelection::Right => self.selection_right(selection),
                MoveSelection::Top => Self::selection_start(selection),
                MoveSelection::End => self.selection_end(selection),
                MoveSelection::Enter => self.expand(selection),
            };

            let changed_index = new_index.map(|i| i != selection).unwrap_or_default();

            if changed_index {
                self.selection = new_index;
                self.visual_selection = self.calc_visual_selection();
            }

            changed_index || new_index.is_some()
        })
    }

    fn visual_index_to_absolute(&self, visual_index: usize) -> Option<usize> {
        self.items
            .iterate(0, self.items.len())
            .enumerate()
            .find_map(
                |(i, (abs, _))| {
                    if i == visual_index {
                        Some(abs)
                    } else {
                        None
                    }
                },
            )
    }

    fn calc_visual_selection(&self) -> Option<VisualSelection> {
        self.selection.map(|selection_absolute| {
            let mut count = 0;
            let mut visual_index = 0;
            for (index, _item) in self.items.iterate(0, self.items.len()) {
                if selection_absolute == index {
                    visual_index = count;
                }

                count += 1;
            }

            VisualSelection {
                index: visual_index,
                count,
            }
        })
    }

    const fn selection_start(current_index: usize) -> Option<usize> {
        if current_index == 0 {
            None
        } else {
            Some(0)
        }
    }

    fn selection_end(&self, current_index: usize) -> Option<usize> {
        let items_max = self.items.len().saturating_sub(1);

        let mut new_index = items_max;

        loop {
            if self.is_visible_index(new_index) {
                break;
            }

            if new_index == 0 {
                break;
            }

            new_index = new_index.saturating_sub(1);
            new_index = std::cmp::min(new_index, items_max);
        }

        if new_index == current_index {
            None
        } else {
            Some(new_index)
        }
    }

    fn selection_up(&self, current_index: usize, lines: usize) -> Option<usize> {
        let mut index = current_index;

        'a: for _ in 0..lines {
            loop {
                if index == 0 {
                    break 'a;
                }

                index = index.saturating_sub(1);

                if self.is_visible_index(index) {
                    break;
                }
            }
        }

        if index == current_index {
            None
        } else {
            Some(index)
        }
    }

    fn selection_down(&self, current_index: usize, lines: usize) -> Option<usize> {
        let mut index = current_index;
        let last_visible_item_index = self
            .items
            .tree_items
            .iter()
            .rposition(|x| x.info().is_visible())?;

        'a: for _ in 0..lines {
            loop {
                if index >= last_visible_item_index {
                    break 'a;
                }

                index = index.saturating_add(1);

                if self.is_visible_index(index) {
                    break;
                }
            }
        }

        if index == current_index {
            None
        } else {
            Some(index)
        }
    }

    fn selection_updown(&self, current_index: usize, up: bool) -> Option<usize> {
        let mut index = current_index;

        loop {
            index = {
                let new_index = if up {
                    index.saturating_sub(1)
                } else {
                    index.saturating_add(1)
                };

                if new_index == index {
                    break;
                }

                if new_index >= self.items.len() {
                    break;
                }

                new_index
            };

            if self.is_visible_index(index) {
                break;
            }
        }

        if index == current_index {
            None
        } else {
            Some(index)
        }
    }

    fn select_parent(&mut self, current_index: usize) -> Option<usize> {
        let indent = self.items.tree_items.get(current_index)?.info().indent();

        let mut index = current_index;

        while let Some(selection) = self.selection_updown(index, true) {
            index = selection;

            if self.items.tree_items[index].info().indent() < indent {
                break;
            }
        }

        if index == current_index {
            None
        } else {
            Some(index)
        }
    }

    fn selection_left(&mut self, current_index: usize) -> Option<usize> {
        let item = &mut self.items.tree_items.get(current_index)?;

        if item.kind().is_database() && !item.kind().is_database_collapsed() {
            self.items.collapse(current_index, false);
            return Some(current_index);
        }

        if item.kind().is_schema() && !item.kind().is_schema_collapsed() {
            self.items.collapse(current_index, false);
            return Some(current_index);
        }

        self.select_parent(current_index)
    }

    fn expand(&mut self, current_selection: usize) -> Option<usize> {
        let item = &mut self.items.tree_items.get(current_selection)?;

        if item.kind().is_database() && item.kind().is_database_collapsed() {
            self.items.expand(current_selection, false);
            return Some(current_selection);
        }

        if item.kind().is_schema() && item.kind().is_schema_collapsed() {
            self.items.expand(current_selection, false);
            return Some(current_selection);
        }

        None
    }

    fn selection_right(&mut self, current_selection: usize) -> Option<usize> {
        let item = &mut self.items.tree_items.get(current_selection)?;

        if item.kind().is_database() {
            if item.kind().is_database_collapsed() {
                self.items.expand(current_selection, false);
                return Some(current_selection);
            }
            return self.selection_updown(current_selection, false);
        }

        if item.kind().is_schema
```

### Core Architecture Module: `database-tree/src/databasetreeitems.rs`
```
use crate::{error::Result, treeitems_iter::TreeItemsIterator};
use crate::{item::DatabaseTreeItemKind, DatabaseTreeItem};
use crate::{Child, Database};
use std::{
    collections::{BTreeSet, HashMap},
    usize,
};

#[derive(Default)]
pub struct DatabaseTreeItems {
    pub tree_items: Vec<DatabaseTreeItem>,
}

impl DatabaseTreeItems {
    ///
    pub fn new(list: &[Database], collapsed: &BTreeSet<&String>) -> Result<Self> {
        Ok(Self {
            tree_items: Self::create_items(list, collapsed)?,
        })
    }

    pub fn filter(&self, filter_text: String) -> Self {
        Self {
            tree_items: self
                .tree_items
                .iter()
                .filter(|item| {
                    item.is_database() || item.kind().is_schema() || item.is_match(&filter_text)
                })
                .map(|item| {
                    let mut item = item.clone();
                    if item.is_database() {
                        item.set_collapsed(false);
                        item
                    } else {
                        let mut item = item;
                        item.show();
                        item
                    }
                })
                .collect::<Vec<DatabaseTreeItem>>(),
        }
    }

    fn create_items(
        list: &[Database],
        collapsed: &BTreeSet<&String>,
    ) -> Result<Vec<DatabaseTreeItem>> {
        let mut items = Vec::with_capacity(list.len());
        let mut items_added: HashMap<String, usize> = HashMap::with_capacity(list.len());

        for e in list {
            {
                Self::push_databases(e, &mut items, &mut items_added, collapsed)?;
            }
            for child in &e.children {
                match child {
                    Child::Table(table) => items.push(DatabaseTreeItem::new_table(e, table)),
                    Child::Schema(schema) => {
                        items.push(DatabaseTreeItem::new_schema(e, schema, true));
                        for table in &schema.tables {
                            items.push(DatabaseTreeItem::new_table(e, table))
                        }
                    }
                }
            }
        }

        Ok(items)
    }

    /// how many individual items are in the list
    pub fn len(&self) -> usize {
        self.tree_items.len()
    }

    /// iterates visible elements
    pub const fn iterate(&self, start: usize, max_amount: usize) -> TreeItemsIterator<'_> {
        TreeItemsIterator::new(self, start, max_amount)
    }

    fn push_databases<'a>(
        database: &'a Database,
        nodes: &mut Vec<DatabaseTreeItem>,
        items_added: &mut HashMap<String, usize>,
        collapsed: &BTreeSet<&String>,
    ) -> Result<()> {
        let c = database.name.clone();
        if !items_added.contains_key(&c) {
            // add node and set count to have no children
            items_added.insert(c.clone(), 0);

            // increase the number of children in the parent node count
            *items_added.entry(database.name.clone()).or_insert(0) += 1;

            let is_collapsed = collapsed.contains(&c);
            nodes.push(DatabaseTreeItem::new_database(database, is_collapsed));
        }

        // increase child count in parent node (the above ancenstor ignores the leaf component)
        *items_added.entry(database.name.clone()).or_insert(0) += 1;

        Ok(())
    }

    pub fn collapse(&mut self, index: usize, recursive: bool) {
        if self.tree_items[index].kind().is_database() {
            self.tree_items[index].collapse_database();

            let name = self.tree_items[index].kind().name();

            for i in index + 1..self.tree_items.len() {
                let item = &mut self.tree_items[i];

                if recursive && item.kind().is_database() {
                    item.collapse_database();
                }

                if let Some(db) = item.kind().database_name() {
                    if db == name {
                        item.hide();
                    }
                } else {
                    return;
                }
            }
        }

        if self.tree_items[index].kind().is_schema() {
            self.tree_items[index].collapse_schema();

            let name = self.tree_items[index].kind().name();

            for i in index + 1..self.tree_items.len() {
                let item = &mut self.tree_items[i];

                if recursive && item.kind().is_schema() {
                    item.collapse_schema();
                }

                if let Some(schema) = item.kind().schema_name() {
                    if schema == name {
                        item.hide();
                    }
                } else {
                    return;
                }
            }
        }
    }

    pub fn expand(&mut self, index: usize, recursive: bool) {
        if self.tree_items[index].kind().is_database() {
            self.tree_items[index].expand_database();

            let tree_item = self.tree_items[index].clone();
            let name = self.tree_items[index].kind().name();
            let kind = tree_item.kind();

            if recursive {
                for i in index + 1..self.tree_items.len() {
                    let item = &mut self.tree_items[i];

                    if let Some(db) = item.kind().database_name() {
                        if *db != name {
                            break;
                        }
                    }

                    if item.kind().is_database() && item.kind().is_database_collapsed() {
                        item.expand_database();
                    }
                }
            }

            self.update_visibility(kind, index + 1);
        }

        if self.tree_items[index].kind().is_schema() {
            self.tree_items[index].expand_schema();

            let tree_item = self.tree_items[index].clone();
            let name = self.tree_items[index].kind().name();
            let kind = tree_item.kind();

            if recursive {
                for i in index + 1..self.tree_items.len() {
                    let item = &mut self.tree_items[i];

                    if let Some(schema) = item.kind().schema_name() {
                        if *schema != name {
                            break;
                        }
                    }

                    if item.kind().is_schema() && item.kind().is_schema_collapsed() {
                        item.expand_schema();
                    }
                }
            }

            self.update_visibility(kind, index + 1);
        }
    }

    fn update_visibility(&mut self, prefix: &DatabaseTreeItemKind, start_idx: usize) {
        let mut inner_collapsed: Option<DatabaseTreeItemKind> = None;

        for i in start_idx..self.tree_items.len() {
            if let Some(ref collapsed_item) = inner_collapsed {
                match collapsed_item {
                    DatabaseTreeItemKind::Database { name, .. } => {
                        if let DatabaseTreeItemKind::Schema { database, .. } =
                            self.tree_items[i].kind().clone()
                        {
                            if database.name == *name {
                                continue;
                            }
                        }
                        if let DatabaseTreeItemKind::Table { database, .. } =
                            self.tree_items[i].kind().clone()
                        {
                            if database.name == *name {
                                continue;
                            }
                        }
                    }
                    DatabaseTreeItemKind::Schema { schema, .. } => {
                        if let DatabaseTreeItemKind::Table { table, .. } =
                            self.tree_items[i].kind().clone()
                        {
                            if matches!(table.schema, Some(table_schema) if schema.name == table_schema)
                            {
                                continue;
                            }
                        }
                    }
                    _ => (),
                }
                inner_collapsed = None;
            }

            let item_kind = self.tree_items[i].kind().clone();

            if matches!(item_kind, DatabaseTreeItemKind::Database{ collapsed, .. } if collapsed)
                || matches!(item_kind, DatabaseTreeItemKind::Schema{ collapsed, .. } if collapsed)
            {
                inner_collapsed = Some(item_kind.clone());
            }

            match prefix {
                DatabaseTreeItemKind::Database { name, .. } => {
                    if let DatabaseTreeItemKind::Schema { database, .. } = item_kind.clone() {
                        if *name == database.name {
                            self.tree_items[i].info_mut().set_visible(true);
                        }
                    }

                    if let DatabaseTreeItemKind::Table { database, .. } = item_kind {
                        if *name == database.name {
                            self.tree_items[i].info_mut().set_visible(true);
                        }
                    }
                }
                DatabaseTreeItemKind::Schema { schema, .. } => {
                    if let DatabaseTreeItemKind::Table { table, .. } = item_kind {
                        if matches!(table.schema, Some(table_schema) if schema.name == table_schema)
                        {
                            self.tree_items[i].info_mut().set_visible(true);
                        }
                    }
                }
                _ => (),
            }
        }
    }
}

```

### Core Architecture Module: `database-tree/src/error.rs`
```
use std::num::TryFromIntError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("TryFromInt error:{0}")]
    IntConversion(#[from] TryFromIntError),
}

pub type Result<T> = std::result::Result<T, Error>;

```

### Core Architecture Module: `database-tree/src/item.rs`
```
use crate::{Database, Schema, Table};

#[derive(Debug, Clone)]
pub struct TreeItemInfo {
    indent: u8,
    visible: bool,
}

impl TreeItemInfo {
    pub const fn new(indent: u8, visible: bool) -> Self {
        Self { indent, visible }
    }

    pub const fn is_visible(&self) -> bool {
        self.visible
    }

    pub const fn indent(&self) -> u8 {
        self.indent
    }

    pub fn unindent(&mut self) {
        self.indent = self.indent.saturating_sub(1);
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
    }
}

/// `DatabaseTreeItem` can be of two kinds
#[derive(PartialEq, Debug, Clone)]
pub enum DatabaseTreeItemKind {
    Database {
        name: String,
        collapsed: bool,
    },
    Table {
        database: Database,
        table: Table,
    },
    Schema {
        database: Database,
        schema: Schema,
        collapsed: bool,
    },
}

impl DatabaseTreeItemKind {
    pub const fn is_database(&self) -> bool {
        matches!(self, Self::Database { .. })
    }

    pub const fn is_table(&self) -> bool {
        matches!(self, Self::Table { .. })
    }

    pub const fn is_schema(&self) -> bool {
        matches!(self, Self::Schema { .. })
    }

    pub const fn is_database_collapsed(&self) -> bool {
        match self {
            Self::Database { collapsed, .. } => *collapsed,
            Self::Table { .. } => false,
            Self::Schema { .. } => false,
        }
    }

    pub const fn is_schema_collapsed(&self) -> bool {
        match self {
            Self::Database { .. } => false,
            Self::Table { .. } => false,
            Self::Schema { collapsed, .. } => *collapsed,
        }
    }

    pub fn name(&self) -> String {
        match self {
            Self::Database { name, .. } => name.to_string(),
            Self::Table { table, .. } => table.name.clone(),
            Self::Schema { schema, .. } => schema.name.clone(),
        }
    }

    pub fn database_name(&self) -> Option<String> {
        match self {
            Self::Database { .. } => None,
            Self::Table { database, .. } => Some(database.name.clone()),
            Self::Schema { database, .. } => Some(database.name.clone()),
        }
    }

    pub fn schema_name(&self) -> Option<String> {
        match self {
            Self::Database { .. } => None,
            Self::Table { table, .. } => table.schema.clone(),
            Self::Schema { .. } => None,
        }
    }
}

/// `DatabaseTreeItem` can be of two kinds: see `DatabaseTreeItem` but shares an info
#[derive(Debug, Clone)]
pub struct DatabaseTreeItem {
    info: TreeItemInfo,
    kind: DatabaseTreeItemKind,
}

impl DatabaseTreeItem {
    pub fn new_table(database: &Database, table: &Table) -> Self {
        Self {
            info: TreeItemInfo::new(if table.schema.is_some() { 2 } else { 1 }, false),
            kind: DatabaseTreeItemKind::Table {
                database: database.clone(),
                table: table.clone(),
            },
        }
    }

    pub fn new_schema(database: &Database, schema: &Schema, _collapsed: bool) -> Self {
        Self {
            info: TreeItemInfo::new(1, false),
            kind: DatabaseTreeItemKind::Schema {
                database: database.clone(),
                schema: schema.clone(),
                collapsed: true,
            },
        }
    }

    pub fn new_database(database: &Database, _collapsed: bool) -> Self {
        Self {
            info: TreeItemInfo::new(0, true),
            kind: DatabaseTreeItemKind::Database {
                name: database.name.to_string(),
                collapsed: true,
            },
        }
    }

    pub fn set_collapsed(&mut self, collapsed: bool) {
        if let DatabaseTreeItemKind::Database { name, .. } = self.kind() {
            self.kind = DatabaseTreeItemKind::Database {
                name: name.to_string(),
                collapsed,
            }
        }
    }

    pub const fn info(&self) -> &TreeItemInfo {
        &self.info
    }

    pub fn info_mut(&mut self) -> &mut TreeItemInfo {
        &mut self.info
    }

    pub const fn kind(&self) -> &DatabaseTreeItemKind {
        &self.kind
    }

    pub fn collapse_database(&mut self) {
        if let DatabaseTreeItemKind::Database { name, .. } = &self.kind {
            self.kind = DatabaseTreeItemKind::Database {
                name: name.to_string(),
                collapsed: true,
            }
        }
    }

    pub fn expand_database(&mut self) {
        if let DatabaseTreeItemKind::Database { name, .. } = &self.kind {
            self.kind = DatabaseTreeItemKind::Database {
                name: name.to_string(),
                collapsed: false,
            };
        }
    }

    pub fn collapse_schema(&mut self) {
        if let DatabaseTreeItemKind::Schema {
            schema, database, ..
        } = &self.kind
        {
            self.kind = DatabaseTreeItemKind::Schema {
                database: database.clone(),
                schema: schema.clone(),
                collapsed: true,
            }
        }
    }

    pub fn expand_schema(&mut self) {
        if let DatabaseTreeItemKind::Schema {
            schema, database, ..
        } = &self.kind
        {
            self.kind = DatabaseTreeItemKind::Schema {
                database: database.clone(),
                schema: schema.clone(),
                collapsed: false,
            };
        }
    }

    pub fn show(&mut self) {
        self.info.visible = true;
    }

    pub fn hide(&mut self) {
        self.info.visible = false;
    }

    pub fn is_match(&self, filter_text: &str) -> bool {
        match self.kind.clone() {
            DatabaseTreeItemKind::Database { name, .. } => name.contains(filter_text),
            DatabaseTreeItemKind::Table { table, .. } => table.name.contains(filter_text),
            DatabaseTreeItemKind::Schema { schema, .. } => schema.name.contains(filter_text),
        }
    }

    pub fn is_database(&self) -> bool {
        self.kind.is_database()
    }
}

impl Eq for DatabaseTreeItem {}

impl PartialEq for DatabaseTreeItem {
    fn eq(&self, other: &Self) -> bool {
        if self.kind.is_database() && other.kind().is_database() {
            return self.kind.name().eq(&other.kind.name());
        }
        if !self.kind.is_database() && !other.kind.is_database() {
            return self.kind.name().eq(&other.kind.name());
        }
        false
    }
}

impl PartialOrd for DatabaseTreeItem {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.kind.name().partial_cmp(&other.kind.name())
    }
}

impl Ord for DatabaseTreeItem {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.kind.name().cmp(&other.kind.name())
    }
}

```

### Core Architecture Module: `database-tree/src/lib.rs`
```
mod databasetree;
mod databasetreeitems;
mod error;
mod item;
mod tree_iter;
mod treeitems_iter;

pub use crate::{
    databasetree::DatabaseTree,
    databasetree::MoveSelection,
    item::{DatabaseTreeItem, TreeItemInfo},
};

#[derive(Clone, PartialEq, Debug)]
pub struct Database {
    pub name: String,
    pub children: Vec<Child>,
}

#[derive(Clone, PartialEq, Debug)]
pub enum Child {
    Table(Table),
    Schema(Schema),
}

impl From<Table> for Child {
    fn from(t: Table) -> Self {
        Child::Table(t)
    }
}

impl From<Schema> for Child {
    fn from(s: Schema) -> Self {
        Child::Schema(s)
    }
}

impl Database {
    pub fn new(database: String, children: Vec<Child>) -> Self {
        Self {
            name: database,
            children,
        }
    }
}

#[derive(Clone, PartialEq, Debug)]
pub struct Schema {
    pub name: String,
    pub tables: Vec<Table>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Table {
    pub name: String,
    pub create_time: Option<chrono::DateTime<chrono::Utc>>,
    pub update_time: Option<chrono::DateTime<chrono::Utc>>,
    pub engine: Option<String>,
    pub schema: Option<String>,
}

```

### Core Architecture Module: `database-tree/src/tree_iter.rs`
```
use crate::{item::DatabaseTreeItem, treeitems_iter::TreeItemsIterator};

pub struct TreeIterator<'a> {
    item_iter: TreeItemsIterator<'a>,
    selection: Option<usize>,
}

impl<'a> TreeIterator<'a> {
    pub const fn new(item_iter: TreeItemsIterator<'a>, selection: Option<usize>) -> Self {
        Self {
            item_iter,
            selection,
        }
    }
}

impl<'a> Iterator for TreeIterator<'a> {
    type Item = (&'a DatabaseTreeItem, bool);

    fn next(&mut self) -> Option<Self::Item> {
        self.item_iter
            .next()
            .map(|(index, item)| (item, self.selection.map(|i| i == index).unwrap_or_default()))
    }
}

```

### Core Architecture Module: `database-tree/src/treeitems_iter.rs`
```
use crate::{databasetreeitems::DatabaseTreeItems, item::DatabaseTreeItem};

pub struct TreeItemsIterator<'a> {
    tree: &'a DatabaseTreeItems,
    index: usize,
    increments: Option<usize>,
    max_amount: usize,
}

impl<'a> TreeItemsIterator<'a> {
    pub const fn new(tree: &'a DatabaseTreeItems, start: usize, max_amount: usize) -> Self {
        TreeItemsIterator {
            max_amount,
            increments: None,
            index: start,
            tree,
        }
    }
}

impl<'a> Iterator for TreeItemsIterator<'a> {
    type Item = (usize, &'a DatabaseTreeItem);

    fn next(&mut self) -> Option<Self::Item> {
        if self.increments.unwrap_or_default() < self.max_amount {
            let items = &self.tree.tree_items;

            let mut init = self.increments.is_none();

            if let Some(i) = self.increments.as_mut() {
                *i += 1;
            } else {
                self.increments = Some(0);
            };

            loop {
                if !init {
                    self.index += 1;
                }
                init = false;

                if self.index >= self.tree.len() {
                    break;
                }

                let elem = &items[self.index];

                if elem.info().is_visible() {
                    return Some((self.index, &items[self.index]));
                }
            }
        }

        None
    }
}

```

### Core Architecture Module: `src/app.rs`
```
use crate::clipboard::copy_to_clipboard;
use crate::components::{
    CommandInfo, Component as _, DrawableComponent as _, EventState, StatefulDrawableComponent,
};
use crate::database::{MySqlPool, Pool, PostgresPool, SqlitePool, RECORDS_LIMIT_PER_PAGE};
use crate::event::Key;
use crate::{
    components::tab::Tab,
    components::{
        command, ConnectionsComponent, DatabasesComponent, ErrorComponent, HelpComponent,
        PropertiesComponent, RecordTableComponent, SqlEditorComponent, TabComponent,
    },
    config::Config,
};
use tui::{
    backend::Backend,
    layout::{Constraint, Direction, Layout, Rect},
    Frame,
};

pub enum Focus {
    DabataseList,
    Table,
    ConnectionList,
}
pub struct App {
    record_table: RecordTableComponent,
    properties: PropertiesComponent,
    sql_editor: SqlEditorComponent,
    focus: Focus,
    tab: TabComponent,
    help: HelpComponent,
    databases: DatabasesComponent,
    connections: ConnectionsComponent,
    pool: Option<Box<dyn Pool>>,
    left_main_chunk_percentage: u16,
    pub config: Config,
    pub error: ErrorComponent,
}

impl App {
    pub fn new(config: Config) -> App {
        Self {
            config: config.clone(),
            connections: ConnectionsComponent::new(config.key_config.clone(), config.conn),
            record_table: RecordTableComponent::new(config.key_config.clone()),
            properties: PropertiesComponent::new(config.key_config.clone()),
            sql_editor: SqlEditorComponent::new(config.key_config.clone()),
            tab: TabComponent::new(config.key_config.clone()),
            help: HelpComponent::new(config.key_config.clone()),
            databases: DatabasesComponent::new(config.key_config.clone()),
            error: ErrorComponent::new(config.key_config),
            focus: Focus::ConnectionList,
            pool: None,
            left_main_chunk_percentage: 15,
        }
    }

    pub fn draw<B: Backend>(&mut self, f: &mut Frame<'_, B>) -> anyhow::Result<()> {
        if let Focus::ConnectionList = self.focus {
            self.connections.draw(
                f,
                Layout::default()
                    .constraints([Constraint::Percentage(100)])
                    .split(f.size())[0],
                false,
            )?;
            self.error.draw(f, Rect::default(), false)?;
            self.help.draw(f, Rect::default(), false)?;
            return Ok(());
        }

        let main_chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Percentage(self.left_main_chunk_percentage),
                Constraint::Percentage((100_u16).saturating_sub(self.left_main_chunk_percentage)),
            ])
            .split(f.size());

        self.databases
            .draw(f, main_chunks[0], matches!(self.focus, Focus::DabataseList))?;

        let right_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(3), Constraint::Length(5)].as_ref())
            .split(main_chunks[1]);

        self.tab.draw(f, right_chunks[0], false)?;

        match self.tab.selected_tab {
            Tab::Records => {
                self.record_table
                    .draw(f, right_chunks[1], matches!(self.focus, Focus::Table))?
            }
            Tab::Sql => {
                self.sql_editor
                    .draw(f, right_chunks[1], matches!(self.focus, Focus::Table))?;
            }
            Tab::Properties => {
                self.properties
                    .draw(f, right_chunks[1], matches!(self.focus, Focus::Table))?;
            }
        }
        self.error.draw(f, Rect::default(), false)?;
        self.help.draw(f, Rect::default(), false)?;
        Ok(())
    }

    fn update_commands(&mut self) {
        self.help.set_cmds(self.commands());
    }

    fn commands(&self) -> Vec<CommandInfo> {
        let mut res = vec![
            CommandInfo::new(command::exit_pop_up(&self.config.key_config)),
            CommandInfo::new(command::filter(&self.config.key_config)),
            CommandInfo::new(command::help(&self.config.key_config)),
            CommandInfo::new(command::toggle_tabs(&self.config.key_config)),
            CommandInfo::new(command::scroll(&self.config.key_config)),
            CommandInfo::new(command::scroll_to_top_bottom(&self.config.key_config)),
            CommandInfo::new(command::scroll_up_down_multiple_lines(
                &self.config.key_config,
            )),
            CommandInfo::new(command::move_focus(&self.config.key_config)),
            CommandInfo::new(command::extend_or_shorten_widget_width(
                &self.config.key_config,
            )),
        ];

        self.databases.commands(&mut res);
        self.record_table.commands(&mut res);
        self.properties.commands(&mut res);

        res
    }

    async fn update_databases(&mut self) -> anyhow::Result<()> {
        if let Some(conn) = self.connections.selected_connection() {
            if let Some(pool) = self.pool.as_ref() {
                pool.close().await;
            }
            self.pool = if conn.is_mysql() {
                Some(Box::new(
                    MySqlPool::new(conn.database_url()?.as_str()).await?,
                ))
            } else if conn.is_postgres() {
                Some(Box::new(
                    PostgresPool::new(conn.database_url()?.as_str()).await?,
                ))
            } else {
                Some(Box::new(
                    SqlitePool::new(conn.database_url()?.as_str()).await?,
                ))
            };
            self.databases
                .update(conn, self.pool.as_ref().unwrap())
                .await?;
            self.focus = Focus::DabataseList;
            self.record_table.reset();
            self.tab.reset();
        }
        Ok(())
    }

    async fn update_record_table(&mut self) -> anyhow::Result<()> {
        if let Some((database, table)) = self.databases.tree().selected_table() {
            let (headers, records) = self
                .pool
                .as_ref()
                .unwrap()
                .get_records(
                    &database,
                    &table,
                    0,
                    if self.record_table.filter.input_str().is_empty() {
                        None
                    } else {
                        Some(self.record_table.filter.input_str())
                    },
                )
                .await?;
            self.record_table
                .update(records, headers, database.clone(), table.clone());
        }
        Ok(())
    }

    pub async fn event(&mut self, key: Key) -> anyhow::Result<EventState> {
        self.update_commands();

        if self.components_event(key).await?.is_consumed() {
            return Ok(EventState::Consumed);
        };

        if self.move_focus(key)?.is_consumed() {
            return Ok(EventState::Consumed);
        };
        Ok(EventState::NotConsumed)
    }

    async fn components_event(&mut self, key: Key) -> anyhow::Result<EventState> {
        if self.error.event(key)?.is_consumed() {
            return Ok(EventState::Consumed);
        }

        if !matches!(self.focus, Focus::ConnectionList) && self.help.event(key)?.is_consumed() {
            return Ok(EventState::Consumed);
        }

        match self.focus {
            Focus::ConnectionList => {
                if self.connections.event(key)?.is_consumed() {
                    return Ok(EventState::Consumed);
                }

                if key == self.config.key_config.enter {
                    self.update_databases().await?;
                    return Ok(EventState::Consumed);
                }
            }
            Focus::DabataseList => {
                if self.databases.event(key)?.is_consumed() {
                    return Ok(EventState::Consumed);
                }

                if key == self.config.key_config.enter && self.databases.tree_focused() {
                    if let Some((database, table)) = self.databases.tree().selected_table() {
                        self.record_table.reset();
                        let (headers, records) = self
                            .pool
                            .as_ref()
                            .unwrap()
                            .get_records(&database, &table, 0, None)
                            .await?;
                        self.record_table
                            .update(records, headers, database.clone(), table.clone());
                        self.properties
                            .update(database.clone(), table.clone(), self.pool.as_ref().unwrap())
                            .await?;
                        self.focus = Focus::Table;
                    }
                    return Ok(EventState::Consumed);
                }
            }
            Focus::Table => {
                match self.tab.selected_tab {
                    Tab::Records => {
                        if self.record_table.event(key)?.is_consumed() {
                            return Ok(EventState::Consumed);
                        };

                        if key == self.config.key_config.copy {
                            if let Some(text) = self.record_table.table.selected_cells() {
                                copy_to_clipboard(text.as_str())?
                            }
                        }

                        if key == self.config.key_config.enter && self.record_table.filter_focused()
                        {
                            self.record_table.focus = crate::components::record_table::Focus::Table;
                            self.update_record_table().await?;
                        }

                        if self.record_table.table.eod {
                            return Ok(EventState::Consumed);
                        }

                        if let Some(index) = self.
```

### Core Architecture Module: `src/cli.rs`
```
use crate::config::CliConfig;
use structopt::StructOpt;

/// A cross-platform TUI database management tool written in Rust
#[derive(StructOpt, Debug)]
#[structopt(name = "gobang")]
pub struct Cli {
    #[structopt(flatten)]
    pub config: CliConfig,
}

pub fn parse() -> Cli {
    Cli::from_args()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #100** (2021-09-14): **Question: Error returned when using filter with PostgreSQL**
  *Symptoms*: When using Gobang with PostgreSQL, I encounter the error ``` error returned from database: LIMIT #, # syntax is not supported ``` The screenshot below described my error.  My table `sec_modules` contain the column `id`. And I type the filter expression `id = 23`, when press "Enter", I got the error.  Screenshot of the error: ![image](https://user-images.githubusercontent.com/24519631/133263473-91693f2f-98e4-438c-befe-d627583638ea.png)  I'm using Gobang installed from "gobang-0.1.0-alpha.3-x86_64-pc-windows-msvc.zip", Windows 10, and PostgreSQL 13.2.  Is there any syntax error with my filter expression? Thanks. 
  **Post-Mortem & Fix Analysis**:
  > Thank you for opening the issue! This is a bug. I'm going to fix it as soon as possible.
  > I've just fixed the bug in https://github.com/TaKO8Ki/gobang/pull/101. I'm going to release v0.1.0-alpha.4 later.
  > I've just released [v0.1.0-alpha.4](https://github.com/TaKO8Ki/gobang/releases/tag/v0.1.0-alpha.4). I would be grateful if you could open issues If gobang still has bugs!

- **Issue #78** (2021-09-08): **Add number type to postgres**
  *Symptoms*: 

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

### Incident Patch 1: `de0d57c9` (2021-12-11)
**Commit Message**: Fix JSON conversion of the table name which is also a keyword (#133)

Similarly to escape the table name in the SELECT command query, here we
escape the table name with apostrophes.
In fact, `to_json()` raised a "Syntax error" for table that uses a keyword as
its name.

**File**: `src/database/postgres.rs` (modified, +2/-2)
```diff
@@ -482,7 +482,7 @@ impl PostgresPool {
     ) -> anyhow::Result<Vec<serde_json::Value>> {
         let query = if let Some(filter) = filter {
             format!(
-                r#"SELECT to_json({table}.*) FROM "{database}"."{table_schema}"."{table}" WHERE {filter} LIMIT {limit} OFFSET {page}"#,
+                r#"SELECT to_json("{table}".*) FROM "{database}"."{table_schema}"."{table}" WHERE {filter} LIMIT {limit} OFFSET {page}"#,
                 database = database.name,
                 table = table.name,
                 filter = filter,
@@ -492,7 +492,7 @@ impl PostgresPool {
             )
         } else {
             format!(
-                r#"SELECT to_json({table}.*) FROM "{database}"."{table_schema}"."{table}" LIMIT {limit} OFFSET {page}"#,
+                r#"SELECT to_json("{table}".*) FROM "{database}"."{table_schema}"."{table}" LIMIT {limit} OFFSET {page}"#,
                 database = database.name,
                 table = table.name,
                 table_schema = table.schema.clone().unwrap_or_else(|| "public".to_string()),
```

---

### Incident Patch 2: `9e537350` (2021-11-01)
**Commit Message**: fix typo (#130)

* fixed typo

* add a target to ignore

* Revert "add a target to ignore"

This reverts commit c33fee37

**File**: `src/event/key.rs` (modified, +2/-2)
```diff
@@ -69,7 +69,7 @@ pub enum Key {
     Char(char),
     Ctrl(char),
     Alt(char),
-    Unkown,
+    Unknown,
 }
 
 impl Key {
@@ -207,7 +207,7 @@ impl From<event::KeyEvent> for Key {
                 ..
             } => Key::Char(c),
 
-            _ => Key::Unkown,
+            _ => Key::Unknown,
         }
     }
 }
```

---

### Incident Patch 3: `4fc75b3a` (2021-09-15)
**Commit Message**: increase database connection timeout (#109)

**File**: `src/database/mysql.rs` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ impl MySqlPool {
     pub async fn new(database_url: &str) -> anyhow::Result<Self> {
         Ok(Self {
             pool: MySqlPoolOptions::new()
-                .connect_timeout(Duration::from_millis(500))
+                .connect_timeout(Duration::from_secs(5))
                 .connect(database_url)
                 .await?,
         })
```

**File**: `src/database/postgres.rs` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ impl PostgresPool {
     pub async fn new(database_url: &str) -> anyhow::Result<Self> {
         Ok(Self {
             pool: PgPoolOptions::new()
-                .connect_timeout(Duration::from_millis(500))
+                .connect_timeout(Duration::from_secs(5))
                 .connect(database_url)
                 .await?,
         })
```

**File**: `src/database/sqlite.rs` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ impl SqlitePool {
     pub async fn new(database_url: &str) -> anyhow::Result<Self> {
         Ok(Self {
             pool: SqlitePoolOptions::new()
-                .connect_timeout(Duration::from_millis(500))
+                .connect_timeout(Duration::from_secs(5))
                 .connect(database_url)
                 .await?,
         })
```

---

### Incident Patch 4: `283e835c` (2021-09-14)
**Commit Message**: fix job name (#103)

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -146,4 +146,4 @@ jobs:
           cargo workspaces publish \
             --yes --force '*' --exact \
             --no-git-commit --allow-dirty --skip-published \
-            custom ${{ needs.create-release.outputs.gobang_version }}
+            custom ${{ needs.release.outputs.gobang_version }}
```

---

### Incident Patch 5: `ef8194b4` (2021-09-14)
**Commit Message**: Fix SQL syntax error in PostgreSQL `get_record` (#101)

* fix SQL syntax error

* v0.1.0-alpha.4

* revert database-tree version

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -503,7 +503,7 @@ dependencies = [
 
 [[package]]
 name = "gobang"
-version = "0.1.0-alpha.3"
+version = "0.1.0-alpha.4"
 dependencies = [
  "anyhow",
  "async-trait",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "gobang"
-version = "0.1.0-alpha.3"
+version = "0.1.0-alpha.4"
 authors = ["Takayuki Maeda <takoyaki0316@gmail.com>"]
 edition = "2018"
 license = "MIT"
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ $ brew install tako8ki/tap/gobang
 If you already have a Rust environment set up, you can use the `cargo install` command:
 
 ```
-$ cargo install --version 0.1.0-alpha.3 gobang
+$ cargo install --version 0.1.0-alpha.4 gobang
 ```
 
 ### Using a release binary (Linux/macOS/Windows)
```

**File**: `src/database/postgres.rs` (modified, +4/-4)
```diff
@@ -207,7 +207,7 @@ impl Pool for PostgresPool {
     ) -> anyhow::Result<(Vec<String>, Vec<Vec<String>>)> {
         let query = if let Some(filter) = filter.as_ref() {
             format!(
-                r#"SELECT * FROM "{database}""{table_schema}"."{table}" WHERE {filter} LIMIT {page}, {limit}"#,
+                r#"SELECT * FROM "{database}"."{table_schema}"."{table}" WHERE {filter} LIMIT {limit} OFFSET {page}"#,
                 database = database.name,
                 table = table.name,
                 filter = filter,
@@ -217,7 +217,7 @@ impl Pool for PostgresPool {
             )
         } else {
             format!(
-                r#"SELECT * FROM "{database}"."{table_schema}"."{table}" limit {limit} offset {page}"#,
+                r#"SELECT * FROM "{database}"."{table_schema}"."{table}" LIMIT {limit} OFFSET {page}"#,
                 database = database.name,
                 table = table.name,
                 table_schema = table.schema.clone().unwrap_or_else(|| "public".to_string()),
@@ -441,7 +441,7 @@ impl PostgresPool {
     ) -> anyhow::Result<Vec<serde_json::Value>> {
         let query = if let Some(filter) = filter {
             format!(
-                r#"SELECT to_json({table}.*) FROM "{database}""{table_schema}"."{table}" WHERE {filter} LIMIT {page}, {limit}"#,
+                r#"SELECT to_json({table}.*) FROM "{database}"."{table_schema}"."{table}" WHERE {filter} LIMIT {limit} OFFSET {page}"#,
                 database = database.name,
                 table = table.name,
                 filter = filter,
@@ -451,7 +451,7 @@ impl PostgresPool {
             )
         } else {
             format!(
-                r#"SELECT to_json({table}.*) FROM "{database}"."{table_schema}"."{table}" limit {limit} offset {page}"#,
+                r#"SELECT to_json({table}.*) FROM "{database}"."{table_schema}"."{table}" LIMIT {limit} OFFSET {page}"#,
                 database = database.name,
                 table = table.name,
                 table_schema = table.schema.clone().unwrap_or_else(|| "public".to_string()),
```

---

### Incident Patch 6: `61c9298d` (2021-09-11)
**Commit Message**: Merge pull request #93 from utam0k/improvement/get_or_null

improve  the `row.try_get()`

**File**: `src/database/mod.rs` (modified, +7/-0)
```diff
@@ -49,3 +49,10 @@ pub trait TableRow: std::marker::Send {
     fn fields(&self) -> Vec<String>;
     fn columns(&self) -> Vec<String>;
 }
+
+#[macro_export]
+macro_rules! get_or_null {
+    ($value:expr) => {
+        $value.map_or("NULL".to_string(), |v| v.to_string())
+    };
+}
```

**File**: `src/database/mysql.rs` (modified, +46/-60)
```diff
@@ -1,3 +1,5 @@
+use crate::get_or_null;
+
 use super::{Pool, TableRow, RECORDS_LIMIT_PER_PAGE};
 use async_trait::async_trait;
 use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
@@ -353,85 +355,69 @@ impl Pool for MySqlPool {
 
 fn convert_column_value_to_string(row: &MySqlRow, column: &MySqlColumn) -> anyhow::Result<String> {
     let column_name = column.name();
+
     if let Ok(value) = row.try_get(column_name) {
         let value: Option<String> = value;
-        return Ok(value.unwrap_or_else(|| "NULL".to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(value.unwrap_or_else(|| "NULL".to_string()))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<&str> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i8> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i16> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i32> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i64> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<f32> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<f64> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<u8> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<u16> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<u32> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<u64> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<rust_decimal::Decimal> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<NaiveDate> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<NaiveTime> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<NaiveDateTime> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<chrono::DateTime<chrono::Utc>> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Opt
```

**File**: `src/database/postgres.rs` (modified, +38/-49)
```diff
@@ -1,3 +1,5 @@
+use crate::get_or_null;
+
 use super::{Pool, TableRow, RECORDS_LIMIT_PER_PAGE};
 use async_trait::async_trait;
 use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
@@ -467,75 +469,62 @@ fn convert_column_value_to_string(row: &PgRow, column: &PgColumn) -> anyhow::Res
     let column_name = column.name();
     if let Ok(value) = row.try_get(column_name) {
         let value: Option<i16> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i32> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i64> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<rust_decimal::Decimal> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<&[u8]> = value;
-        return Ok(value.map_or("NULL".to_string(), |values| {
+        Ok(value.map_or("NULL".to_string(), |values| {
             format!(
                 "\\x{}",
                 values
                     .iter()
                     .map(|v| format!("{:02x}", v))
                     .collect::<String>()
             )
-        }));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        }))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<NaiveDate> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: String = value;
-        return Ok(value);
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(value)
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<chrono::DateTime<chrono::Utc>> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<chrono::DateTime<chrono::Local>> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<NaiveDateTime> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<NaiveDate> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<NaiveTime> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<serde_json::Value> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get::<Option<bool>, _>(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get::<Option<bool>, _>(column_name) {
         let value: Option<bool> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<Vec<String>> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.join(",")));
+        Ok(value.map_or("NULL".to_string(), |v| v.join(",")))
+    } else {
+        anyhow::bail!(
+            "column type not implemented: `{}` {}",
+            column_name,
+            column.type_info().clone().name()
+        )
     }
-    Err(anyhow::anyhow!(
-        "column type not implemented: `{}` {}",
-        column_name,
-        column.type_info().clone().name()
-    ))
 }
```

**File**: `src/database/sqlite.rs` (modified, +29/-36)
```diff
@@ -1,3 +1,5 @@
+use crate::get_or_null;
+
 use super::{Pool, TableRow, RECORDS_LIMIT_PER_PAGE};
 use async_trait::async_trait;
 use chrono::NaiveDateTime;
@@ -347,51 +349,42 @@ fn convert_column_value_to_string(
     let column_name = column.name();
     if let Ok(value) = row.try_get(column_name) {
         let value: Option<String> = value;
-        return Ok(value.unwrap_or_else(|| "NULL".to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(value.unwrap_or_else(|| "NULL".to_string()))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<&str> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i16> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i32> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<i64> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<f32> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<f64> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<chrono::DateTime<chrono::Utc>> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<chrono::DateTime<chrono::Local>> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<NaiveDateTime> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
-    }
-    if let Ok(value) = row.try_get(column_name) {
+        Ok(get_or_null!(value))
+    } else if let Ok(value) = row.try_get(column_name) {
         let value: Option<bool> = value;
-        return Ok(value.map_or("NULL".to_string(), |v| v.to_string()));
+        Ok(get_or_null!(value))
+    } else {
+        anyhow::bail!(
+            "column type not implemented: `{}` {}",
+            column_name,
+            column.type_info().clone().name()
+        )
     }
-    Err(anyhow::anyhow!(
-        "column type not implemented: `{}` {}",
-        column_name,
-        column.type_info().clone().name()
-    ))
 }
```

---

### Incident Patch 7: `ecf6fb0b` (2021-09-11)
**Commit Message**: Fix usage (#91)

* update gobang.gif

* compress GIF

* add `gobang -h`

* update gobang.gif

**File**: `README.md` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ $ gobang
 ```
 
 ```
+$ gobang -h
 USAGE:
     gobang [OPTIONS]
 
```

---

### Incident Patch 8: `34f7fd37` (2021-09-06)
**Commit Message**: fix logo



---

### Incident Patch 9: `7cc4bb7e` (2021-09-06)
**Commit Message**: fix table status

**File**: `src/components/table_status.rs` (modified, +8/-8)
```diff
@@ -45,20 +45,20 @@ impl TableStatusComponent {
 impl DrawableComponent for TableStatusComponent {
     fn draw<B: Backend>(&mut self, f: &mut Frame<B>, area: Rect, focused: bool) -> Result<()> {
         let status = Paragraph::new(Spans::from(vec![
-            Span::from("rows: "),
             Span::from(format!(
-                "{}, ",
+                "rows: {}, ",
                 self.row_count.map_or("-".to_string(), |c| c.to_string())
             )),
-            Span::from("columns: "),
             Span::from(format!(
-                "{}, ",
+                "columns: {}, ",
                 self.column_count.map_or("-".to_string(), |c| c.to_string())
             )),
-            Span::from("engine: "),
-            Span::from(self.table.as_ref().map_or("-".to_string(), |c| {
-                c.engine.as_ref().map_or("-".to_string(), |e| e.to_string())
-            })),
+            Span::from(format!(
+                "engine: {}",
+                self.table.as_ref().map_or("-".to_string(), |c| {
+                    c.engine.as_ref().map_or("-".to_string(), |e| e.to_string())
+                })
+            )),
         ]))
         .block(Block::default().borders(Borders::TOP).style(if focused {
             Style::default()
```

---

### Incident Patch 10: `4a3d32cf` (2021-09-05)
**Commit Message**: fix clippy warnings

**File**: `src/app.rs` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ use crate::{
     components::tab::Tab,
     components::{
         command, ConnectionsComponent, DatabasesComponent, ErrorComponent, HelpComponent,
-        RecordTableComponent, TabComponent, TableComponent, TableStatusComponent,
+        RecordTableComponent, TabComponent, TableComponent,
     },
     config::Config,
 };
```

**File**: `src/components/record_table.rs` (modified, +0/-4)
```diff
@@ -49,10 +49,6 @@ impl RecordTableComponent {
         self.filter.reset();
     }
 
-    pub fn len(&self) -> usize {
-        self.table.rows.len()
-    }
-
     pub fn filter_focused(&self) -> bool {
         matches!(self.focus, Focus::Filter)
     }
```

**File**: `src/components/table.rs` (modified, +1/-1)
```diff
@@ -505,7 +505,7 @@ impl DrawableComponent for TableComponent {
             } else {
                 Some(self.headers.len())
             },
-            self.table.as_ref().map_or(None, |t| Some(t.1.clone())),
+            self.table.as_ref().map(|t| t.1.clone()),
         )
         .draw(f, chunks[1], focused)?;
 
```

**File**: `src/components/utils/scroll_vertical.rs` (modified, +15/-0)
```diff
@@ -74,3 +74,18 @@ const fn calc_scroll_top(
         current_top
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::calc_scroll_top;
+
+    #[test]
+    fn test_scroll_no_scroll_to_top() {
+        assert_eq!(calc_scroll_top(1, 10, 4, 4), 0);
+    }
+
+    #[test]
+    fn test_scroll_zero_height() {
+        assert_eq!(calc_scroll_top(4, 0, 4, 3), 0);
+    }
+}
```

**File**: `src/config.rs` (modified, +6/-6)
```diff
@@ -159,15 +159,15 @@ impl Connection {
                 let user = self
                     .user
                     .as_ref()
-                    .ok_or(anyhow::anyhow!("user is not set"))?;
+                    .ok_or_else(|| anyhow::anyhow!("user is not set"))?;
                 let host = self
                     .host
                     .as_ref()
-                    .ok_or(anyhow::anyhow!("host is not set"))?;
+                    .ok_or_else(|| anyhow::anyhow!("host is not set"))?;
                 let port = self
                     .port
                     .as_ref()
-                    .ok_or(anyhow::anyhow!("port is not set"))?;
+                    .ok_or_else(|| anyhow::anyhow!("port is not set"))?;
 
                 match self.database.as_ref() {
                     Some(database) => Ok(format!(
@@ -189,15 +189,15 @@ impl Connection {
                 let user = self
                     .user
                     .as_ref()
-                    .ok_or(anyhow::anyhow!("user is not set"))?;
+                    .ok_or_else(|| anyhow::anyhow!("user is not set"))?;
                 let host = self
                     .host
                     .as_ref()
-                    .ok_or(anyhow::anyhow!("host is not set"))?;
+                    .ok_or_else(|| anyhow::anyhow!("host is not set"))?;
                 let port = self
                     .port
                     .as_ref()
-                    .ok_or(anyhow::anyhow!("port is not set"))?;
+                    .ok_or_else(|| anyhow::anyhow!("port is not set"))?;
 
                 match self.database.as_ref() {
                     Some(database) => Ok(format!(
```

---

### Incident Patch 11: `e37fd222` (2021-09-02)
**Commit Message**: replace gitui with gobang (#53)

**File**: `README.md` (modified, +3/-3)
```diff
@@ -46,9 +46,9 @@ $ cargo install --version 0.1.0-alpha.1 gobang
 
 The location of the file depends on your OS:
 
-- macOS: `$HOME/.config/gitui/config.toml`
-- Linux: `$HOME/.config/gitui/config.toml`
-- Windows: `%APPDATA%/gitui/config.toml`
+- macOS: `$HOME/.config/gobang/config.toml`
+- Linux: `$HOME/.config/gobang/config.toml`
+- Windows: `%APPDATA%/gobang/config.toml`
 
 The following is a sample config.toml file:
 
```

#### Recent Merged Pull Requests:
- **PR #188** (closed): URL Encode user and password for connection string (@emerson-argueta)
- **PR #171** (closed): chore: optimized release profile (@Valentin271)
- **PR #170** (closed): Adds a total row count in the footer (@Valentin271)
- **PR #165** (2023-01-25): Document `name` config field (@znd4)
- **PR #161** (2022-09-28): docs: add info about gobang AUR package (@codingCoffee)
- **PR #144** (2022-06-24): Adding help and README for exit pop up key (@kyoto7250)
- **PR #139** (2022-03-03): Add the way to install gobang on NixOS (@TaKO8Ki)
- **PR #133** (2021-12-11): Fix JSON conversion of the table name which is also a keyword for PostgreSQL (@boozec)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
