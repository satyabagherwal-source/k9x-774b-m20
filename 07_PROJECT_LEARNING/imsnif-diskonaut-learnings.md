# Forensic Learning Record (Deep Inspection): imsnif/diskonaut

> **Canonical Artifact**: `07_PROJECT_LEARNING/imsnif-diskonaut-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/imsnif/diskonaut](https://github.com/imsnif/diskonaut))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:28:57.432Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `imsnif/diskonaut`
- **Description**: Terminal disk space navigator 🔭
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3136 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app.rs`
```
use ::std::fs::{self, Metadata};
use ::std::mem::ManuallyDrop;
use ::std::path::PathBuf;
use ::std::sync::mpsc::{Receiver, SyncSender};
use ::tui::backend::Backend;

use crate::messages::{handle_instructions, Instruction};
use crate::state::files::{FileOrFolder, FileTree, Folder};
use crate::state::tiles::Board;
use crate::state::{FileToDelete, UiEffects};
use crate::ui::Display;
use crate::Event;

#[derive(Clone)]
pub enum UiMode {
    Loading,
    Normal,
    ScreenTooSmall,
    DeleteFile(FileToDelete),
    ErrorMessage(String),
    Exiting { app_loaded: bool },
    WarningMessage(FileToDelete),
}

pub struct App<B>
where
    B: Backend,
{
    pub is_running: bool,
    pub loaded: bool,
    pub ui_mode: UiMode,
    board: Board,
    file_tree: ManuallyDrop<FileTree>,
    display: Display<B>,
    event_sender: SyncSender<Event>,
    ui_effects: UiEffects,
    delete_confirmation_disabled: bool,
}

impl<B> App<B>
where
    B: Backend,
{
    pub fn new(
        terminal_backend: B,
        path_in_filesystem: PathBuf,
        event_sender: SyncSender<Event>,
        show_apparent_size: bool,
        disable_delete_confirmation: bool,
    ) -> Self {
        let display = Display::new(terminal_backend);
        let board = Board::new(&Folder::new(&path_in_filesystem));
        let base_folder = Folder::new(&path_in_filesystem);
        let file_tree = ManuallyDrop::new(FileTree::new(
            base_folder,
            path_in_filesystem,
            show_apparent_size,
        ));
        // we use ManuallyDrop here because otherwise the app takes forever to exit
        let ui_effects = UiEffects::new();
        App {
            is_running: true,
            loaded: false,
            board,
            file_tree,
            display,
            ui_mode: UiMode::Loading,
            event_sender,
            ui_effects,
            delete_confirmation_disabled: disable_delete_confirmation,
        }
    }
    pub fn start(&mut self, receiver: Receiver<Instruction>) {
        handle_instructions(self, receiver);
        self.display.clear();
    }
    pub fn render_and_update_board(&mut self) {
        let current_folder = self.file_tree.get_current_folder();
        self.board.change_files(&current_folder);
        self.render();
    }
    pub fn increment_loading_progress_indicator(&mut self) {
        self.ui_effects.increment_loading_progress_indicator();
    }
    pub fn render(&mut self) {
        let full_screen_size = self.display.size();
        if full_screen_size.width < 50 || full_screen_size.height < 15 {
            self.ui_mode = UiMode::ScreenTooSmall;
        }
        self.display.render(
            &mut self.file_tree,
            &mut self.board,
            &self.ui_mode,
            &self.ui_effects,
        );
    }
    pub fn flash_space_freed(&mut self) {
        self.ui_effects.flash_space_freed = true;
    }
    pub fn unflash_space_freed(&mut self) {
        self.ui_effects.flash_space_freed = false;
    }
    pub fn set_path_to_red(&mut self) {
        self.ui_effects.current_path_is_red = true;
    }
    pub fn reset_current_path_color(&mut self) {
        self.ui_effects.current_path_is_red = false;
    }
    pub fn start_ui(&mut self) {
        self.ui_mode = UiMode::Normal;
        self.loaded = true;
        self.render_and_update_board();
    }
    pub fn add_entry_to_base_folder(&mut self, file_metadata: &Metadata, entry_path: PathBuf) {
        self.file_tree.add_entry(file_metadata, &entry_path);
        self.ui_effects.last_read_path = Some(entry_path);
    }
    pub fn reset_ui_mode(&mut self) {
        match self.ui_mode {
            UiMode::Loading | UiMode::Normal => {}
            _ => {
                self.ui_mode = {
                    if self.loaded {
                        UiMode::Normal
                    } else {
                        UiMode::Loading
                    }
                }
            }
        };
    }
    pub fn show_warning_modal(&mut self) {
        if let Some(file_to_delete) = self.get_file_to_delete() {
            self.ui_mode = UiMode::WarningMessage(file_to_delete);
            self.render();
        }
    }
    pub fn prompt_exit(&mut self) {
        self.ui_mode = UiMode::Exiting {
            app_loaded: self.loaded,
        };
        self.render();
    }
    pub fn exit(&mut self) {
        self.is_running = false;
        // here we do a blocking send rather than a try_send
        // because we want to make sure that if the receiver
        // is active, it received this event so that the app
        // would exit cleanly
        let _ = self.event_sender.send(Event::AppExit);
    }
    pub fn handle_enter(&mut self) {
        if !self.board.has_selected_index() {
            self.board.move_to_largest_folder();
        }
        self.enter_selected();
    }
    pub fn move_selected_right(&mut self) {
        self.board.move_selected_right();
        self.render();
    }
    pub fn move_selected_left(&mut self) {
        self.board.move_selected_left();
        self.render();
    }
    pub fn move_selected_down(&mut self) {
        self.board.move_selected_down();
        self.render();
    }
    pub fn move_selected_up(&mut self) {
        self.board.move_selected_up();
        self.render();
    }
    pub fn enter_selected(&mut self) {
        self.board.record_current_index_and_zoom_level();
        if let Some(tile) = &self.board.currently_selected() {
            let selected_name = &tile.name;
            if let Some(file_or_folder) = self.file_tree.item_in_current_folder(&selected_name) {
                match file_or_folder {
                    FileOrFolder::Folder(_) => {
                        self.file_tree.enter_folder(&selected_name);
                        self.board.reset_zoom_index();
                        self.board.reset_selected_index();
                        self.render_and_update_board();
                    }
                    FileOrFolder::File(_) => {} // do not enter if currently_selected is a file
                }
            };
        }
    }
    pub fn go_up(&mut self) {
        let succeeded = self.file_tree.leave_folder();
        if let Some((index, zoom_level)) = self.board.pop_previous_index_and_zoom_level() {
            if let Some(index) = index {
                self.board.set_selected_index(&index);
            }
            self.board.set_zoom_index(zoom_level);
        }
        self.render_and_update_board();
        if !succeeded {
            let _ = self.event_sender.try_send(Event::PathError);
        }
    }
    pub fn get_file_to_delete(&self) -> Option<FileToDelete> {
        let currently_selected = self.board.currently_selected()?;
        let mut path_to_file = self.file_tree.current_folder_names.clone();
        path_to_file.push(currently_selected.name.clone());
        let file_to_delete = FileToDelete {
            path_in_filesystem: self.file_tree.path_in_filesystem.clone(),
            path_to_file,
            file_type: currently_selected.file_type,
            num_descendants: currently_selected.descendants,
            size: currently_selected.size,
        };
        Some(file_to_delete)
    }
    pub fn prompt_file_deletion(&mut self) {
        if let Some(file_to_delete) = self.get_file_to_delete() {
            self.ui_mode = UiMode::DeleteFile(file_to_delete.clone());

            if self.delete_confirmation_disabled {
                // Here we just delete the file.
                // As we have set the UI mode above we will get the deletion in progress message box instead of the prompt.
                self.delete_file(&file_to_delete);
            } else {
                // Here we will render which will display the confirmation prompt
                self.render();
            }
        }
    }
    pub fn normal_mode(&mut self) {
        self.ui_mode = UiMode::Normal;
        self.render_and_update_board();
    }
    pub fn delete_file(&mut self, file_to_delete: &FileToDele
```

### Core Architecture Module: `src/input/controls.rs`
```
use ::tui::backend::Backend;
use crossterm::event::Event;
use crossterm::event::KeyModifiers;
use crossterm::event::{read, KeyCode, KeyEvent};

use crate::state::FileToDelete;
use crate::App;

#[derive(Clone)]
pub struct TerminalEvents;

impl Iterator for TerminalEvents {
    type Item = Event;
    fn next(&mut self) -> Option<Event> {
        Some(read().unwrap())
    }
}
macro_rules! key {
    (char $x:expr) => {
        Event::Key(KeyEvent {
            code: KeyCode::Char($x),
            modifiers: KeyModifiers::NONE,
        })
    };
    (shift $x:expr) => {
        Event::Key(KeyEvent {
            code: KeyCode::Char($x),
            modifiers: KeyModifiers::SHIFT,
        })
    };
    (ctrl $x:expr) => {
        Event::Key(KeyEvent {
            code: KeyCode::Char($x),
            modifiers: KeyModifiers::CONTROL,
        })
    };
    ($x:ident) => {
        Event::Key(KeyEvent {
            code: KeyCode::$x,
            modifiers: KeyModifiers::NONE,
        })
    };
}

pub fn handle_keypress_loading_mode<B: Backend>(evt: Event, app: &mut App<B>) {
    match evt {
        key!(ctrl 'c') | key!(char 'q') => {
            app.prompt_exit();
        }
        key!(char 'l') | key!(Right) | key!(ctrl 'f') => {
            app.move_selected_right();
        }
        key!(char 'h') | key!(Left) | key!(ctrl 'b') => {
            app.move_selected_left();
        }
        key!(char 'j') | key!(Down) | key!(ctrl 'n') => {
            app.move_selected_down();
        }
        key!(char 'k') | key!(Up) | key!(ctrl 'p') => {
            app.move_selected_up();
        }
        key!(char '+') | key!(shift '+') => {
            app.zoom_in();
        }
        key!(char '-') => {
            app.zoom_out();
        }
        key!(char '0') => {
            app.reset_zoom();
        }
        key!(char '\n') | key!(Enter) => {
            app.handle_enter();
        }
        key!(Backspace) => {
            app.show_warning_modal();
        }
        key!(Esc) => {
            app.go_up();
        }
        _ => (),
    };
}

pub fn handle_keypress_normal_mode<B: Backend>(evt: Event, app: &mut App<B>) {
    match evt {
        key!(ctrl 'c') | key!(char 'q') => {
            app.prompt_exit();
        }
        key!(Backspace) => {
            app.prompt_file_deletion();
        }
        key!(char 'l') | key!(Right) | key!(ctrl 'f') => {
            app.move_selected_right();
        }
        key!(char 'h') | key!(Left) | key!(ctrl 'b') => {
            app.move_selected_left();
        }
        key!(char 'j') | key!(Down) | key!(ctrl 'n') => {
            app.move_selected_down();
        }
        key!(char 'k') | key!(Up) | key!(ctrl 'p') => {
            app.move_selected_up();
        }
        key!(char '+') | key!(shift '+') => {
            app.zoom_in();
        }
        key!(char '-') => {
            app.zoom_out();
        }
        key!(char '0') => {
            app.reset_zoom();
        }
        key!(char '\n') | key!(Enter) => {
            app.handle_enter();
        }
        key!(Esc) => {
            app.go_up();
        }
        _ => (),
    };
}

pub fn handle_keypress_delete_file_mode<B: Backend>(
    evt: Event,
    app: &mut App<B>,
    file_to_delete: FileToDelete,
) {
    match evt {
        key!(ctrl 'c') | key!(char 'q') | key!(Esc) | key!(char 'n') => {
            app.normal_mode();
        }
        key!(char 'y') => {
            app.delete_file(&file_to_delete);
        }
        _ => (),
    };
}

pub fn handle_keypress_error_message<B: Backend>(evt: Event, app: &mut App<B>) {
    match evt {
        key!(ctrl 'c') | key!(char 'q') | key!(Esc) => {
            app.normal_mode();
        }
        _ => (),
    };
}

pub fn handle_keypress_screen_too_small<B: Backend>(evt: Event, app: &mut App<B>) {
    match evt {
        key!(ctrl 'c') | key!(char 'q') => {
            app.exit();
        }
        _ => (),
    };
}

pub fn handle_keypress_exiting_mode<B: Backend>(evt: Event, app: &mut App<B>) {
    match evt {
        key!(ctrl 'c') | key!(char 'q') | key!(Esc) | key!(char 'n') => {
            app.reset_ui_mode();
            // we have to manually call render here to make sure ui gets updated
            // because reset_ui_mode does not call it itself
            app.render();
        }
        key!(char 'y') => {
            app.exit();
        }
        _ => (),
    };
}

pub fn handle_keypress_warning_message<B: Backend>(evt: Event, app: &mut App<B>) {
    match evt {
        _ => {
            app.reset_ui_mode();
        }
    }
}

```

### Core Architecture Module: `src/input/mod.rs`
```
pub mod controls;

pub use controls::*;

```

### Core Architecture Module: `src/main.rs`
```
#[cfg(test)]
mod tests;

mod app;
mod input;
mod messages;
mod os;
mod state;
mod ui;

use ::failure;
use ::jwalk::Parallelism::{RayonDefaultPool, Serial};
use ::jwalk::WalkDir;
use ::std::env;
use ::std::io;
use ::std::path::PathBuf;
use ::std::process;
use ::std::sync::atomic::{AtomicBool, Ordering};
use ::std::sync::mpsc;
use ::std::sync::mpsc::{Receiver, SyncSender};
use ::std::sync::Arc;
use ::std::thread::park_timeout;
use ::std::{thread, time};
use ::structopt::StructOpt;

use ::tui::backend::Backend;
use crossterm::event::KeyModifiers;
use crossterm::event::{Event as BackEvent, KeyCode, KeyEvent};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode};
use tui::backend::CrosstermBackend;

use app::{App, UiMode};
use input::TerminalEvents;
use messages::{handle_events, Event, Instruction};

#[cfg(not(test))]
const SHOULD_SHOW_LOADING_ANIMATION: bool = true;
#[cfg(test)]
const SHOULD_SHOW_LOADING_ANIMATION: bool = false;
#[cfg(not(test))]
const SHOULD_HANDLE_WIN_CHANGE: bool = true;
#[cfg(test)]
const SHOULD_HANDLE_WIN_CHANGE: bool = false;
#[cfg(not(test))]
const SHOULD_SCAN_HD_FILES_IN_MULTIPLE_THREADS: bool = true;
#[cfg(test)]
const SHOULD_SCAN_HD_FILES_IN_MULTIPLE_THREADS: bool = false;

#[derive(StructOpt, Debug)]
#[structopt(name = "diskonaut")]
pub struct Opt {
    #[structopt(name = "folder", parse(from_os_str))]
    /// The folder to scan
    folder: Option<PathBuf>,
    #[structopt(short, long)]
    /// Show file sizes rather than their block usage on disk
    apparent_size: bool,
    #[structopt(short, long)]
    /// Don't ask for confirmation before deleting
    disable_delete_confirmation: bool,
}

fn main() {
    if let Err(err) = try_main() {
        println!("Error: {}", err);
        process::exit(2);
    }
}
fn get_stdout() -> io::Result<io::Stdout> {
    Ok(io::stdout())
}

fn try_main() -> Result<(), failure::Error> {
    let opts = Opt::from_args();

    match get_stdout() {
        Ok(stdout) => {
            enable_raw_mode()?;
            let terminal_backend = CrosstermBackend::new(stdout);
            let terminal_events = TerminalEvents {};
            let folder = match opts.folder {
                Some(folder) => folder,
                None => env::current_dir()?,
            };
            if !folder.as_path().is_dir() {
                failure::bail!("Folder '{}' does not exist", folder.to_string_lossy())
            }
            start(
                terminal_backend,
                Box::new(terminal_events),
                folder,
                opts.apparent_size,
                opts.disable_delete_confirmation,
            );
        }
        Err(_) => failure::bail!("Failed to get stdout: are you trying to pipe 'diskonaut'?"),
    }
    disable_raw_mode()?;
    Ok(())
}

pub fn start<B>(
    terminal_backend: B,
    terminal_events: Box<dyn Iterator<Item = BackEvent> + Send>,
    path: PathBuf,
    show_apparent_size: bool,
    disable_delete_confirmation: bool,
) where
    B: Backend + Send + 'static,
{
    let mut active_threads = vec![];

    let (event_sender, event_receiver): (SyncSender<Event>, Receiver<Event>) =
        mpsc::sync_channel(1);
    let (instruction_sender, instruction_receiver): (
        SyncSender<Instruction>,
        Receiver<Instruction>,
    ) = mpsc::sync_channel(100);

    let running = Arc::new(AtomicBool::new(true));
    let loaded = Arc::new(AtomicBool::new(false));

    active_threads.push(
        thread::Builder::new()
            .name("event_executer".to_string())
            .spawn({
                let instruction_sender = instruction_sender.clone();
                || handle_events(event_receiver, instruction_sender)
            })
            .unwrap(),
    );

    active_threads.push(
        thread::Builder::new()
            .name("stdin_handler".to_string())
            .spawn({
                let instruction_sender = instruction_sender.clone();
                let running = running.clone();
                move || {
                    for evt in terminal_events {
                        if let BackEvent::Resize(_x, _y) = evt {
                            if SHOULD_HANDLE_WIN_CHANGE {
                                let _ = instruction_sender.send(Instruction::ResetUiMode);
                                let _ = instruction_sender.send(Instruction::Render);
                            }
                            continue;
                        }

                        if let BackEvent::Key(KeyEvent {
                            code: KeyCode::Char('y'),
                            modifiers: KeyModifiers::NONE,
                        })
                        | BackEvent::Key(KeyEvent {
                            code: KeyCode::Char('q'),
                            modifiers: KeyModifiers::NONE,
                        })
                        | BackEvent::Key(KeyEvent {
                            code: KeyCode::Char('c'),
                            modifiers: KeyModifiers::CONTROL,
                        }) = evt
                        {
                            // not ideal, but works in a pinch
                            let _ = instruction_sender.send(Instruction::Keypress(evt));
                            park_timeout(time::Duration::from_millis(100));
                            // if we don't wait, the app won't have time to quit
                            if !running.load(Ordering::Acquire) {
                                // sometimes ctrl-c doesn't shut down the app
                                // (eg. dismissing an error message)
                                // in order not to be aware of those particularities
                                // we check "running"
                                break;
                            }
                        } else if instruction_sender.send(Instruction::Keypress(evt)).is_err() {
                            break;
                        }
                    }
                }
            })
            .unwrap(),
    );

    active_threads.push(
        thread::Builder::new()
            .name("hd_scanner".to_string())
            .spawn({
                let path = path.clone();
                let instruction_sender = instruction_sender.clone();
                let loaded = loaded.clone();
                move || {
                    'scanning: for entry in WalkDir::new(&path)
                        .parallelism(if SHOULD_SCAN_HD_FILES_IN_MULTIPLE_THREADS {
                            RayonDefaultPool
                        } else {
                            Serial
                        })
                        .skip_hidden(false)
                        .follow_links(false)
                        .into_iter()
                    {
                        let instruction_sent = match entry {
                            Ok(entry) => match entry.metadata() {
                                Ok(file_metadata) => {
                                    let entry_path = entry.path();
                                    instruction_sender.send(Instruction::AddEntryToBaseFolder((
                                        file_metadata,
                                        entry_path,
                                    )))
                                }
                                Err(_) => {
                                    instruction_sender.send(Instruction::IncrementFailedToRead)
                                }
                            },
                            Err(_) => instruction_sender.send(Instruction::IncrementFailedToRead),
                        };
                        if instruction_sent.is_err() {
                            // if we fail to send an instruction here, this likely means the program has
                            // ended and we need to break this loop as well in order not to hang
                            break 'scanning;
                        };
                    }
                    let _ =
```

### Core Architecture Module: `src/messages/event.rs`
```
use ::std::thread::park_timeout;
use ::std::time;

use crate::messages::Instruction;

pub enum Event {
    PathError,
    FileDeleted,
    AppExit,
}

use std::sync::mpsc::{Receiver, SyncSender};

pub fn handle_events(event_receiver: Receiver<Event>, instruction_sender: SyncSender<Instruction>) {
    loop {
        let event = event_receiver
            .recv()
            .expect("failed to receive event on channel");
        match event {
            Event::PathError => {
                let _ = instruction_sender.send(Instruction::SetPathToRed);
                let _ = instruction_sender.send(Instruction::Render);
                park_timeout(time::Duration::from_millis(250));
                let _ = instruction_sender.send(Instruction::ResetCurrentPathColor);
                let _ = instruction_sender.send(Instruction::Render);
            }
            Event::FileDeleted => {
                let _ = instruction_sender.send(Instruction::FlashSpaceFreed);
                let _ = instruction_sender.send(Instruction::Render);
                park_timeout(time::Duration::from_millis(250));
                let _ = instruction_sender.send(Instruction::UnflashSpaceFreed);
                let _ = instruction_sender.send(Instruction::Render);
            }
            Event::AppExit => {
                break;
            }
        }
    }
}

```

### Core Architecture Module: `src/messages/instruction.rs`
```
use ::std::fs::Metadata;
use ::std::path::PathBuf;
use ::std::sync::mpsc::Receiver;

use ::tui::backend::Backend;
use crossterm::event::Event as BackEvent;

use crate::input::{
    handle_keypress_delete_file_mode, handle_keypress_error_message, handle_keypress_exiting_mode,
    handle_keypress_loading_mode, handle_keypress_normal_mode, handle_keypress_screen_too_small,
    handle_keypress_warning_message,
};
use crate::{App, UiMode};

pub enum Instruction {
    SetPathToRed,
    ResetCurrentPathColor,
    FlashSpaceFreed,
    UnflashSpaceFreed,
    AddEntryToBaseFolder((Metadata, PathBuf)),
    StartUi,
    ToggleScanningVisualIndicator,
    RenderAndUpdateBoard,
    Render,
    ResetUiMode,
    Keypress(BackEvent),
    IncrementFailedToRead,
}

pub fn handle_instructions<B>(app: &mut App<B>, receiver: Receiver<Instruction>)
where
    B: Backend,
{
    loop {
        let instruction = receiver
            .recv()
            .expect("failed to receive instruction on channel");
        match instruction {
            Instruction::SetPathToRed => {
                app.set_path_to_red();
            }
            Instruction::ResetCurrentPathColor => {
                app.reset_current_path_color();
            }
            Instruction::FlashSpaceFreed => {
                app.flash_space_freed();
            }
            Instruction::UnflashSpaceFreed => {
                app.unflash_space_freed();
            }
            Instruction::AddEntryToBaseFolder((file_metadata, entry)) => {
                app.add_entry_to_base_folder(&file_metadata, entry);
            }
            Instruction::StartUi => {
                app.start_ui();
            }
            Instruction::ToggleScanningVisualIndicator => {
                app.increment_loading_progress_indicator();
            }
            Instruction::RenderAndUpdateBoard => {
                app.render_and_update_board();
            }
            Instruction::Render => {
                app.render();
            }
            Instruction::ResetUiMode => {
                app.reset_ui_mode();
            }
            Instruction::Keypress(evt) => {
                match &app.ui_mode {
                    UiMode::Loading => {
                        handle_keypress_loading_mode(evt, app);
                    }
                    UiMode::Normal => {
                        handle_keypress_normal_mode(evt, app);
                    }
                    UiMode::ScreenTooSmall => {
                        handle_keypress_screen_too_small(evt, app);
                    }
                    UiMode::DeleteFile(file_to_delete) => {
                        let file_to_delete = file_to_delete.clone();
                        handle_keypress_delete_file_mode(evt, app, file_to_delete);
                    }
                    UiMode::ErrorMessage(_) => {
                        handle_keypress_error_message(evt, app);
                    }
                    UiMode::Exiting { app_loaded: _ } => {
                        handle_keypress_exiting_mode(evt, app);
                    }
                    UiMode::WarningMessage(_) => {
                        handle_keypress_warning_message(evt, app);
                    }
                }
                if !app.is_running {
                    break;
                }
            }
            Instruction::IncrementFailedToRead => {
                app.increment_failed_to_read();
            }
        }
    }
}

```

### Core Architecture Module: `src/messages/mod.rs`
```
mod event;
mod instruction;

pub use event::*;
pub use instruction::*;

```

### Core Architecture Module: `src/os/mod.rs`
```
#[cfg(target_os = "windows")]
pub(crate) mod windows;

#[cfg(not(target_os = "windows"))]
pub(crate) mod unix;

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

### Incident Patch 1: `9cff09e2` (2020-09-02)
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

---

### Incident Patch 3: `bb867087` (2020-07-06)
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

---

### Incident Patch 4: `d6d32c43` (2020-06-26)
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

### Incident Patch 5: `628a6e3b` (2020-06-26)
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

### Incident Patch 6: `120058d8` (2020-06-26)
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

### Incident Patch 7: `c0fe520d` (2020-06-25)
**Commit Message**: docs(readme): fix error in how it works

**File**: `README.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 
 ## How does it work?
 
-Given a path on your hard-drive (which could also be the root path, eg. `/`). `diskonaut` scans it and maps it to memory so that you could explore its contents (even while still scanning!).
+Given a path on your hard-drive (which could also be the root path, eg. `/`). `diskonaut` scans it and indexes its metadata to memory so that you could explore its contents (even while still scanning!).
 
 Once completed, you can navigate through subfolders, getting a visual treemap representation of what's taking up your disk space. You can even delete files or folders and `diskonaut` will track how much space you've freed up in this session.
 
```

---

### Incident Patch 8: `e94f9b94` (2020-06-23)
**Commit Message**: fix(tests): turn off parallelism when in test mode (#43)

* Added conditional compilation to turn off/on parallelism

* style(name): clarify constant name

Co-authored-by: Aram Drevekenin <aram@poor.dev>

**File**: `src/main.rs` (modified, +10/-2)
```diff
@@ -8,7 +8,7 @@ mod state;
 mod ui;
 
 use ::failure;
-use ::jwalk::Parallelism::RayonDefaultPool;
+use ::jwalk::Parallelism::{RayonDefaultPool, Serial};
 use ::jwalk::WalkDir;
 use ::std::env;
 use ::std::io;
@@ -38,6 +38,10 @@ const SHOULD_SHOW_LOADING_ANIMATION: bool = false;
 const SHOULD_HANDLE_WIN_CHANGE: bool = true;
 #[cfg(test)]
 const SHOULD_HANDLE_WIN_CHANGE: bool = false;
+#[cfg(not(test))]
+const SHOULD_SCAN_HD_FILES_IN_MULTIPLE_THREADS: bool = true;
+#[cfg(test)]
+const SHOULD_SCAN_HD_FILES_IN_MULTIPLE_THREADS: bool = false;
 
 #[derive(StructOpt, Debug)]
 #[structopt(name = "diskonaut")]
@@ -144,7 +148,11 @@ pub fn start<B>(
                 let loaded = loaded.clone();
                 move || {
                     'scanning: for entry in WalkDir::new(&path)
-                        .parallelism(RayonDefaultPool)
+                        .parallelism(if SHOULD_SCAN_HD_FILES_IN_MULTIPLE_THREADS {
+                            RayonDefaultPool
+                        } else {
+                            Serial
+                        })
                         .skip_hidden(false)
                         .follow_links(false)
                         .into_iter()
```

---

### Incident Patch 9: `e050626f` (2020-06-21)
**Commit Message**: fix(performance): scan hd in parallel (#38)

* fix(performance): scan hd in parallel

* fix(performance): scan hd in parallel

* chore(deps): drop unneeded cargo-insta dependency (#35)

Signed-off-by: Igor Raits <i.gnatenko.brain@gmail.com>

* fix(performance): scan hd in parallel

* style(format): removed unused import

Co-authored-by: Igor Raits <i.gnatenko.brain@gmail.com>

**File**: `Cargo.lock` (modified, +142/-27)
```diff
@@ -36,6 +36,11 @@ dependencies = [
  "winapi 0.3.8 (registry+https://github.com/rust-lang/crates.io-index)",
 ]
 
+[[package]]
+name = "autocfg"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+
 [[package]]
 name = "backtrace"
 version = "0.3.49"
@@ -103,6 +108,72 @@ dependencies = [
  "winapi 0.3.8 (registry+https://github.com/rust-lang/crates.io-index)",
 ]
 
+[[package]]
+name = "crossbeam"
+version = "0.7.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+dependencies = [
+ "cfg-if 0.1.10 (registry+https://github.com/rust-lang/crates.io-index)",
+ "crossbeam-channel 0.4.2 (registry+https://github.com/rust-lang/crates.io-index)",
+ "crossbeam-deque 0.7.3 (registry+https://github.com/rust-lang/crates.io-index)",
+ "crossbeam-epoch 0.8.2 (registry+https://github.com/rust-lang/crates.io-index)",
+ "crossbeam-queue 0.2.3 (registry+https://github.com/rust-lang/crates.io-index)",
+ "crossbeam-utils 0.7.2 (registry+https://github.com/rust-lang/crates.io-index)",
+]
+
+[[package]]
+name = "crossbeam-channel"
+version = "0.4.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+dependencies = [
+ "crossbeam-utils 0.7.2 (registry+https://github.com/rust-lang/crates.io-index)",
+ "maybe-uninit 2.0.0 (registry+https://github.com/rust-lang/crates.io-index)",
+]
+
+[[package]]
+name = "crossbeam-deque"
+version = "0.7.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+dependencies = [
+ "crossbeam-epoch 0.8.2 (registry+https://github.com/rust-lang/crates.io-index)",
+ "crossbeam-utils 0.7.2 (registry+https://github.com/rust-lang/crates.io-index)",
+ "maybe-uninit 2.0.0 (registry+https://github.com/rust-lang/crates.io-index)",
+]
+
+[[package]]
+name = "crossbeam-epoch"
+version = "0.8.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+dependencies = [
+ "autocfg 1.0.0 (registry+https://github.com/rust-lang/crates.io-index)",
+ "cfg-if 0.1.10 (registry+https://github.com/rust-lang/crates.io-index)",
+ "crossbeam-utils 0.7.2 (registry+https://github.com/rust-lang/crates.io-index)",
+ "lazy_static 1.4.0 (registry+https://github.com/rust-lang/crates.io-index)",
+ "maybe-uninit 2.0.0 (registry+https://github.com/rust-lang/crates.io-index)",
+ "memoffset 0.5.4 (registry+https://github.com/rust-lang/crates.io-index)",
+ "scopeguard 1.1.0 (registry+https://github.com/rust-lang/crates.io-index)",
+]
+
+[[package]]
+name = "crossbeam-queue"
+version = "0.2.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+dependencies = [
+ "cfg-if 0.1.10 (registry+https://github.com/rust-lang/crates.io-index)",
+ "crossbeam-utils 0.7.2 (registry+https://github.com/rust-lang/crates.io-index)",
+ "maybe-uninit 2.0.0 (registry+https://github.com/rust-lang/crates.io-index)",
+]
+
+[[package]]
+name = "crossbeam-utils"
+version = "0.7.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+dependencies = [
+ "autocfg 1.0.0 (registry+https://github.com/rust-lang/crates.io-index)",
+ "cfg-if 0.1.10 (registry+https://github.com/rust-lang/crates.io-index)",
+ "lazy_static 1.4.0 (registry+https://github.com/rust-lang/crates.io-index)",
+]
+
 [[package]]
 name = "difference"
 version = "2.0.0"
@@ -115,11 +186,11 @@ dependencies = [
  "failure 0.1.8 (registry+https://github.com/rust-lang/crates.io-index)",
  "filesize 0.2.0 (registry+https://github.com/rust-lang/crates.io-index)",
  "insta 0.16.0 (registry+https://github.com/rust-lang/crates.io-index)",
+ "jwalk 0.5.1 (registry+https://github.com/rust-lang/crates.io-index)",
  "signal-hook 0.1.16 (registry+https://github.com/rust-lang/crates.io-index)",
  "structopt 0.3.15 (registry+https://github.com/rust-lang/crates.io-index)",
  "termion 1.5.5 (registry+https://github.com/rust-lang/crates.io-index)",
  "tui 0.9.5 (registry+https://github.com/rust-lang/crates.io-index)",
- "walkdir 2.3.1 (registry+https://github.com/rust-lang/crates.io-index)",
 ]
 
 [[package]]
@@ -212,6 +283,15
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ edition = "2018"
 tui = "0.9"
 termion = "1.5"
 failure = "0.1"
-walkdir = "2"
+jwalk = "0.5"
 signal-hook = "0.1.10"
 structopt = "0.3"
 filesize = "0.2.0"
```

**File**: `src/app.rs` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 use ::std::fs::{self, Metadata};
 use ::std::mem::ManuallyDrop;
-use ::std::path::{Path, PathBuf};
+use ::std::path::PathBuf;
 use ::std::sync::mpsc::{Receiver, SyncSender};
 use ::tui::backend::Backend;
 
@@ -101,9 +101,9 @@ where
         self.loaded = true;
         self.render_and_update_board();
     }
-    pub fn add_entry_to_base_folder(&mut self, file_metadata: &Metadata, entry_path: &Path) {
-        self.file_tree.add_entry(file_metadata, entry_path);
-        self.ui_effects.last_read_path = Some(PathBuf::from(entry_path));
+    pub fn add_entry_to_base_folder(&mut self, file_metadata: &Metadata, entry_path: PathBuf) {
+        self.file_tree.add_entry(file_metadata, &entry_path);
+        self.ui_effects.last_read_path = Some(entry_path);
     }
     pub fn reset_ui_mode(&mut self) {
         match self.ui_mode {
```

**File**: `src/main.rs` (modified, +15/-5)
```diff
@@ -8,6 +8,8 @@ mod state;
 mod ui;
 
 use ::failure;
+use ::jwalk::Parallelism::RayonDefaultPool;
+use ::jwalk::WalkDir;
 use ::std::env;
 use ::std::io;
 use ::std::path::PathBuf;
@@ -23,7 +25,6 @@ use ::termion::event::{Event as TermionEvent, Key};
 use ::termion::raw::IntoRawMode;
 use ::tui::backend::Backend;
 use ::tui::backend::TermionBackend;
-use ::walkdir::WalkDir;
 
 use app::{App, UiMode};
 use input::{sigwinch, KeyboardEvents};
@@ -142,12 +143,21 @@ pub fn start<B>(
                 let instruction_sender = instruction_sender.clone();
                 let loaded = loaded.clone();
                 move || {
-                    'scanning: for entry in WalkDir::new(&path).into_iter() {
+                    'scanning: for entry in WalkDir::new(&path)
+                        .parallelism(RayonDefaultPool)
+                        .skip_hidden(false)
+                        .follow_links(false)
+                        .into_iter()
+                    {
                         let instruction_sent = match entry {
                             Ok(entry) => match entry.metadata() {
-                                Ok(file_metadata) => instruction_sender.send(
-                                    Instruction::AddEntryToBaseFolder((file_metadata, entry)),
-                                ),
+                                Ok(file_metadata) => {
+                                    let entry_path = entry.path();
+                                    instruction_sender.send(Instruction::AddEntryToBaseFolder((
+                                        file_metadata,
+                                        entry_path,
+                                    )))
+                                }
                                 Err(_) => {
                                     instruction_sender.send(Instruction::IncrementFailedToRead)
                                 }
```

**File**: `src/messages/instruction.rs` (modified, +3/-4)
```diff
@@ -1,8 +1,8 @@
 use ::std::fs::Metadata;
+use ::std::path::PathBuf;
 use ::std::sync::mpsc::Receiver;
 use ::termion::event::Event as TermionEvent;
 use ::tui::backend::Backend;
-use ::walkdir::DirEntry;
 
 use crate::input::{
     handle_keypress_delete_file_mode, handle_keypress_error_message, handle_keypress_loading_mode,
@@ -15,7 +15,7 @@ pub enum Instruction {
     ResetCurrentPathColor,
     FlashSpaceFreed,
     UnflashSpaceFreed,
-    AddEntryToBaseFolder((Metadata, DirEntry)),
+    AddEntryToBaseFolder((Metadata, PathBuf)),
     StartUi,
     ToggleScanningVisualIndicator,
     RenderAndUpdateBoard,
@@ -47,8 +47,7 @@ where
                 app.unflash_space_freed();
             }
             Instruction::AddEntryToBaseFolder((file_metadata, entry)) => {
-                let entry_path = entry.path();
-                app.add_entry_to_base_folder(&file_metadata, &entry_path);
+                app.add_entry_to_base_folder(&file_metadata, entry);
             }
             Instruction::StartUi => {
                 app.start_ui();
```

---

### Incident Patch 10: `027c4a2b` (2020-06-18)
**Commit Message**: docs(changelog): update fix

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
 
 ## [Unreleased]
 
+### Fixed
+* Refactor movement methods (https://github.com/imsnif/diskonaut/pull/31) - [@phimuemue](https://github.com/phimuemue)
+
 ## [0.2.0] - 2020-06-18
 
 ### Fixed
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
