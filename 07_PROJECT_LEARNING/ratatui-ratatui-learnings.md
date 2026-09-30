# Forensic Learning Record (Deep Inspection): ratatui/ratatui

> **Canonical Artifact**: `07_PROJECT_LEARNING/ratatui-ratatui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ratatui/ratatui](https://github.com/ratatui/ratatui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:22:02.539Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ratatui/ratatui`
- **Description**: A Rust crate for cooking up terminal user interfaces (TUIs) 👨‍🍳🐀 https://ratatui.rs
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 22803 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/apps/advanced-widget-impl/src/main.rs`
```
/// A Ratatui example that demonstrates how to implement the `Widget` trait.
///
/// This example demonstrates various ways to implement `Widget` traits in Ratatui on a type, a
/// reference, and a mutable reference. It also shows how to use the `WidgetRef` trait to
/// render boxed widgets.
///
/// This example runs with the Ratatui library code in the branch that you are currently
/// reading. See the [`latest`] branch for the code which works with the most recent Ratatui
/// release.
///
/// [`latest`]: https://github.com/ratatui/ratatui/tree/latest
use std::time::{Duration, Instant};

use color_eyre::Result;
use crossterm::event;
use ratatui::DefaultTerminal;
use ratatui::buffer::Buffer;
use ratatui::layout::{Constraint, Layout, Position, Rect, Size};
use ratatui::style::{Color, Style};
use ratatui::widgets::{Widget, WidgetRef};

fn main() -> Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| App::default().run(terminal))
}

#[derive(Default)]
struct App {
    should_quit: bool,
    timer: Timer,
    boxed_squares: BoxedSquares,
    green_square: RightAlignedSquare,
}

impl App {
    fn run(mut self, terminal: &mut DefaultTerminal) -> Result<()> {
        while !self.should_quit {
            self.render(terminal)?;
            self.handle_events()?;
        }
        Ok(())
    }

    fn render(&mut self, tui: &mut DefaultTerminal) -> Result<()> {
        tui.draw(|frame| frame.render_widget(self, frame.area()))?;
        Ok(())
    }

    fn handle_events(&mut self) -> Result<()> {
        // Handle events at least 50 frames per second (gifs are usually 50fps)
        let timeout = Duration::from_secs_f64(1.0 / 50.0);
        if !event::poll(timeout)? {
            return Ok(());
        }
        if event::read()?.is_key_press() {
            self.should_quit = true;
        }
        Ok(())
    }
}

/// Implement the `Widget` trait on a mutable reference to the `App` type.
///
/// This allows the `App` type to be rendered as a widget. The `App` type owns several other widgets
/// that are rendered as part of the app. The `Widget` trait is implemented on a mutable reference
/// to the `App` type, which allows this to be rendered without consuming the `App` type, and allows
/// the sub-widgets to be mutable.
impl Widget for &mut App {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let constraints = Constraint::from_lengths([1, 1, 2, 1]);
        let [greeting, timer, squares, position] = area.layout(&Layout::vertical(constraints));

        // render an ephemeral greeting widget
        Greeting::new("Ratatui!").render(greeting, buf);

        // render a reference to the timer widget
        self.timer.render(timer, buf);

        // render a boxed widget containing red and blue squares
        self.boxed_squares.render(squares, buf);

        // render a mutable reference to the green square widget
        self.green_square.render(squares, buf);
        // Display the dynamically updated position of the green square
        let square_position = format!("Green square is at {}", self.green_square.last_position);
        square_position.render(position, buf);
    }
}

/// An ephemeral greeting widget.
///
/// This widget is implemented on the type itself, which means that it is consumed when it is
/// rendered. This is useful for widgets that are cheap to create, don't need to be reused, and
/// don't need to store any state between renders. This is the simplest way to implement a widget in
/// Ratatui, but in most cases, it is better to implement the `Widget` trait on a reference to the
/// type, as shown in the other examples below.
///
/// This was the way most widgets were implemented in Ratatui before `Widget` was implemented on
/// references in [PR #903] (merged in Ratatui 0.26.0).
///
/// [PR #903]: https://github.com/ratatui/ratatui/pull/903
struct Greeting {
    name: String,
}

impl Greeting {
    fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }
}

impl Widget for Greeting {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let greeting = format!("Hello, {}!", self.name);
        greeting.render(area, buf);
    }
}

/// A timer widget that displays the elapsed time since the timer was started.
#[derive(Debug)]
struct Timer {
    start: Instant,
}

impl Default for Timer {
    fn default() -> Self {
        Self {
            start: Instant::now(),
        }
    }
}

/// This implements `Widget` on a reference to the type, which means that it can be reused and
/// doesn't need to be consumed when it is rendered. This is useful for widgets that need to store
/// state and be updated over time.
///
/// This approach was probably always available in Ratatui, but it wasn't widely used until `Widget`
/// was implemented on references in [PR #903] (merged in Ratatui 0.26.0). This is because all the
/// built-in widgets previously would consume themselves when rendered.
impl Widget for &Timer {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let elapsed = self.start.elapsed().as_secs_f32();
        let message = format!("Elapsed: {elapsed:.1?}s");
        message.render(area, buf);
    }
}

/// A widget that contains a list of several different widgets.
struct BoxedSquares {
    squares: Vec<Box<dyn WidgetRef>>,
}

impl Default for BoxedSquares {
    fn default() -> Self {
        let red_square: Box<dyn WidgetRef> = Box::new(RedSquare);
        let blue_square: Box<dyn WidgetRef> = Box::new(BlueSquare);
        Self {
            squares: vec![red_square, blue_square],
        }
    }
}

/// A widget that renders a red square.
struct RedSquare;

/// A widget that renders a blue square.
struct BlueSquare;

/// This implements the `Widget` trait on a reference to the type. It contains a list of boxed
/// widgets that implement the `WidgetRef` trait. This is useful for widgets that contain a list of
/// other widgets that can be different types.
impl Widget for &BoxedSquares {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let constraints = vec![Constraint::Length(4); self.squares.len()];
        let areas = area.layout_vec(&Layout::horizontal(constraints));
        for (widget, area) in self.squares.iter().zip(areas) {
            widget.render_ref(area, buf);
        }
    }
}

/// `RedSquare` and `BlueSquare` are widgets that render a red and blue square, respectively. They
/// implement the `WidgetRef` trait instead of the `Widget` trait, which which allows them to be
/// rendered as boxed widgets. It's not possible to use Widget for this as a dynamic reference to a
/// widget cannot generally be moved out of the box.
impl WidgetRef for RedSquare {
    fn render_ref(&self, area: Rect, buf: &mut Buffer) {
        fill(area, buf, "█", Color::Red);
    }
}

impl WidgetRef for BlueSquare {
    fn render_ref(&self, area: Rect, buf: &mut Buffer) {
        fill(area, buf, "█", Color::Blue);
    }
}

/// A widget that renders a green square aligned to the right of the area.
#[derive(Default)]
struct RightAlignedSquare {
    last_position: Position,
}

/// This widget is implemented on a mutable reference to the type, which means that it can store
/// state and update it when it is rendered. This is useful for widgets that need to store the
/// result of some calculation that can only be done when the widget is rendered.
///
/// The x and y coordinates of the square are stored in the widget and updated when the widget is
/// rendered. This allows the square to be aligned to the right of the area. These coordinates could
/// be used to perform hit testing (e.g. checking if a mouse click is inside the square). This app
/// just displays the coordinates as a string.
///
/// This approach was probably always available in Ratatui, but it wasn't widely used either. This
/// is an alternative to implementing the `StatefulWidget` trait, for situations where you want to
/// store the state in the widget itself instead of a separate struct.
impl
```

### Core Architecture Module: `examples/apps/async-github/src/main.rs`
```
//! # [Ratatui] Async example
//!
//! This example demonstrates how to use Ratatui with widgets that fetch data asynchronously. It
//! uses the `octocrab` crate to fetch a list of pull requests from the GitHub API.
//!
//! <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token>
//! <https://github.com/settings/tokens/new> to create a new token (select classic, and no scopes)
//!
//! This example does not cover message passing between threads, it only demonstrates how to manage
//! shared state between the main thread and a background task, which acts mostly as a one-shot
//! fetcher. For more complex scenarios, you may need to use channels or other synchronization
//! primitives.
//!
//! A simple app might have multiple widgets that fetch data from different sources, and each widget
//! would have its own background task to fetch the data. The main thread would then render the
//! widgets with the latest data.
//!
//! The latest version of this example is available in the [examples] folder in the repository.
//!
//! Please note that the examples are designed to be run against the `main` branch of the Github
//! repository. This means that you may not be able to compile with the latest release version on
//! crates.io, or the one that you have installed locally.
//!
//! See the [examples readme] for more information on finding examples that match the version of the
//! library you are using.
//!
//! [Ratatui]: https://github.com/ratatui/ratatui
//! [examples]: https://github.com/ratatui/ratatui/blob/main/examples
//! [examples readme]: https://github.com/ratatui/ratatui/blob/main/examples/README.md
use std::sync::{Arc, RwLock};
use std::time::Duration;

use color_eyre::Result;
use crossterm::event::{Event, EventStream, KeyCode};
use octocrab::Page;
use octocrab::params::Direction;
use octocrab::params::pulls::Sort;
use ratatui::buffer::Buffer;
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Style, Stylize};
use ratatui::text::Line;
use ratatui::widgets::{Block, HighlightSpacing, Row, StatefulWidget, Table, TableState, Widget};
use ratatui::{DefaultTerminal, Frame};
use tokio_stream::StreamExt;

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    let terminal = ratatui::init();
    let app_result = App::default().run(terminal).await;
    ratatui::restore();
    app_result
}

#[derive(Debug, Default)]
struct App {
    should_quit: bool,
    pull_requests: PullRequestListWidget,
}

impl App {
    const FRAMES_PER_SECOND: f32 = 60.0;

    pub async fn run(mut self, mut terminal: DefaultTerminal) -> Result<()> {
        self.pull_requests.run();

        let period = Duration::from_secs_f32(1.0 / Self::FRAMES_PER_SECOND);
        let mut interval = tokio::time::interval(period);
        let mut events = EventStream::new();

        while !self.should_quit {
            tokio::select! {
                _ = interval.tick() => { terminal.draw(|frame| self.render(frame))?; },
                Some(Ok(event)) = events.next() => self.handle_event(&event),
            }
        }
        Ok(())
    }

    fn render(&self, frame: &mut Frame) {
        let layout = Layout::vertical([Constraint::Length(1), Constraint::Fill(1)]);
        let [title_area, body_area] = frame.area().layout(&layout);
        let title = Line::from("Ratatui async example").centered().bold();
        frame.render_widget(title, title_area);
        frame.render_widget(&self.pull_requests, body_area);
    }

    fn handle_event(&mut self, event: &Event) {
        if let Some(key) = event.as_key_press_event() {
            match key.code {
                KeyCode::Char('q') | KeyCode::Esc => self.should_quit = true,
                KeyCode::Char('j') | KeyCode::Down => self.pull_requests.scroll_down(),
                KeyCode::Char('k') | KeyCode::Up => self.pull_requests.scroll_up(),
                _ => {}
            }
        }
    }
}

/// A widget that displays a list of pull requests.
///
/// This is an async widget that fetches the list of pull requests from the GitHub API. It contains
/// an inner `Arc<RwLock<PullRequestListState>>` that holds the state of the widget. Cloning the
/// widget will clone the Arc, so you can pass it around to other threads, and this is used to spawn
/// a background task to fetch the pull requests.
#[derive(Debug, Clone, Default)]
struct PullRequestListWidget {
    state: Arc<RwLock<PullRequestListState>>,
}

#[derive(Debug, Default)]
struct PullRequestListState {
    pull_requests: Vec<PullRequest>,
    loading_state: LoadingState,
    table_state: TableState,
}

#[derive(Debug, Clone)]
struct PullRequest {
    id: String,
    title: String,
    url: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
enum LoadingState {
    #[default]
    Idle,
    Loading,
    Loaded,
    Error(String),
}

impl PullRequestListWidget {
    /// Start fetching the pull requests in the background.
    ///
    /// This method spawns a background task that fetches the pull requests from the GitHub API.
    /// The result of the fetch is then passed to the `on_load` or `on_err` methods.
    fn run(&self) {
        let this = self.clone(); // clone the widget to pass to the background task
        tokio::spawn(this.fetch_pulls());
    }

    async fn fetch_pulls(self) {
        // this runs once, but you could also run this in a loop, using a channel that accepts
        // messages to refresh on demand, or with an interval timer to refresh every N seconds
        self.set_loading_state(LoadingState::Loading);
        match octocrab::instance()
            .pulls("ratatui", "ratatui")
            .list()
            .sort(Sort::Updated)
            .direction(Direction::Descending)
            .send()
            .await
        {
            Ok(page) => self.on_load(&page),
            Err(err) => self.on_err(&err),
        }
    }
    fn on_load(&self, page: &Page<OctoPullRequest>) {
        let prs = page.items.iter().filter_map(PullRequest::from_octo);
        let mut state = self.state.write().unwrap();
        state.loading_state = LoadingState::Loaded;
        state.pull_requests.extend(prs);
        if !state.pull_requests.is_empty() {
            state.table_state.select(Some(0));
        }
    }

    fn on_err(&self, err: &octocrab::Error) {
        self.set_loading_state(LoadingState::Error(err.to_string()));
    }

    fn set_loading_state(&self, state: LoadingState) {
        self.state.write().unwrap().loading_state = state;
    }

    fn scroll_down(&self) {
        self.state.write().unwrap().table_state.scroll_down_by(1);
    }

    fn scroll_up(&self) {
        self.state.write().unwrap().table_state.scroll_up_by(1);
    }
}

type OctoPullRequest = octocrab::models::pulls::PullRequest;

impl PullRequest {
    fn from_octo(pr: &OctoPullRequest) -> Option<Self> {
        Some(Self {
            id: pr.number.to_string(),
            title: pr.title.clone()?,
            url: pr.html_url.as_ref()?.to_string(),
        })
    }
}

impl Widget for &PullRequestListWidget {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let mut state = self.state.write().unwrap();

        // a block with a right aligned title with the loading state on the right
        let loading_state = Line::from(format!("{:?}", state.loading_state)).right_aligned();
        let block = Block::bordered()
            .title("Pull Requests")
            .title(loading_state)
            .title_bottom("j/k to scroll, q to quit");

        // a table with the list of pull requests
        let rows = state.pull_requests.iter();
        let widths = [
            Constraint::Length(5),
            Constraint::Fill(1),
            Constraint::Max(49),
        ];
        let table = Table::new(rows, widths)
            .block(block)
            .highlight_spacing(HighlightSpacing::Always)
            .highlight_symbol(">>")
    
```

### Core Architecture Module: `examples/apps/calendar-explorer/src/main.rs`
```
//! A Ratatui example that demonstrates how to render calendar with different styles.
//!
//! Marks the holidays and seasons on the calendar.
//!
//! This example runs with the Ratatui library code in the branch that you are currently reading.
//! See the [`latest`] branch for the code which works with the most recent Ratatui release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//! [`BarChart`]: https://docs.rs/ratatui/latest/ratatui/widgets/struct.BarChart.html

use std::fmt;

use color_eyre::Result;
use crossterm::event::{self, KeyCode};
use ratatui::layout::{Constraint, Layout, Margin, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Text};
use ratatui::widgets::calendar::{CalendarEventStore, Monthly};
use ratatui::{DefaultTerminal, Frame};
use time::ext::NumericalDuration;
use time::{Date, Month, OffsetDateTime};

fn main() -> Result<()> {
    color_eyre::install()?;
    ratatui::run(run)
}

/// Run the application.
fn run(terminal: &mut DefaultTerminal) -> Result<()> {
    let mut selected_date = OffsetDateTime::now_local()?.date();
    let mut calendar_style = StyledCalendar::Default;
    loop {
        terminal.draw(|frame| render(frame, calendar_style, selected_date))?;
        if let Some(key) = event::read()?.as_key_press_event() {
            match key.code {
                KeyCode::Char('q') => break Ok(()),
                KeyCode::Char('s') => calendar_style = calendar_style.next(),
                KeyCode::Char('n') | KeyCode::Tab => selected_date = next_month(selected_date),
                KeyCode::Char('p') | KeyCode::BackTab => selected_date = prev_month(selected_date),
                KeyCode::Char('h') | KeyCode::Left => selected_date -= 1.days(),
                KeyCode::Char('j') | KeyCode::Down => selected_date += 1.weeks(),
                KeyCode::Char('k') | KeyCode::Up => selected_date -= 1.weeks(),
                KeyCode::Char('l') | KeyCode::Right => selected_date += 1.days(),
                _ => {}
            }
        }
    }
}

fn next_month(date: Date) -> Date {
    if date.month() == Month::December {
        date.replace_month(Month::January)
            .unwrap()
            .replace_year(date.year() + 1)
            .unwrap()
    } else {
        date.replace_month(date.month().next()).unwrap()
    }
}

fn prev_month(date: Date) -> Date {
    if date.month() == Month::January {
        date.replace_month(Month::December)
            .unwrap()
            .replace_year(date.year() - 1)
            .unwrap()
    } else {
        date.replace_month(date.month().previous()).unwrap()
    }
}

/// Render the UI with a calendar.
fn render(frame: &mut Frame, calendar_style: StyledCalendar, selected_date: Date) {
    let header = Text::from_iter([
        Line::from("Calendar Example".bold()),
        Line::from(
            "<q> Quit | <s> Change Style | <n> Next Month | <p> Previous Month, <hjkl> Move",
        ),
        Line::from(format!(
            "Current date: {selected_date} | Current style: {calendar_style}"
        )),
    ]);

    let [text_area, area] = frame.area().layout(&Layout::vertical([
        Constraint::Length(header.height() as u16),
        Constraint::Fill(1),
    ]));
    frame.render_widget(header.centered(), text_area);
    calendar_style
        .render_year(frame, area, selected_date)
        .unwrap();
}

#[derive(Debug, Clone, Copy)]
enum StyledCalendar {
    Default,
    Surrounding,
    WeekdaysHeader,
    SurroundingAndWeekdaysHeader,
    MonthHeader,
    MonthAndWeekdaysHeader,
}

impl StyledCalendar {
    // Cycle through the different styles.
    const fn next(self) -> Self {
        match self {
            Self::Default => Self::Surrounding,
            Self::Surrounding => Self::WeekdaysHeader,
            Self::WeekdaysHeader => Self::SurroundingAndWeekdaysHeader,
            Self::SurroundingAndWeekdaysHeader => Self::MonthHeader,
            Self::MonthHeader => Self::MonthAndWeekdaysHeader,
            Self::MonthAndWeekdaysHeader => Self::Default,
        }
    }
}

impl fmt::Display for StyledCalendar {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Default => write!(f, "Default"),
            Self::Surrounding => write!(f, "Show Surrounding"),
            Self::WeekdaysHeader => write!(f, "Show Weekdays Header"),
            Self::SurroundingAndWeekdaysHeader => write!(f, "Show Surrounding and Weekdays Header"),
            Self::MonthHeader => write!(f, "Show Month Header"),
            Self::MonthAndWeekdaysHeader => write!(f, "Show Month Header and Weekdays Header"),
        }
    }
}

impl StyledCalendar {
    fn render_year(self, frame: &mut Frame, area: Rect, date: Date) -> Result<()> {
        let events = events(date)?;

        let vertical = Layout::vertical([Constraint::Ratio(1, 3); 3]);
        let horizontal = &Layout::horizontal([Constraint::Ratio(1, 4); 4]);
        let areas = area
            .inner(Margin::new(1, 1))
            .layout_vec(&vertical)
            .into_iter()
            .flat_map(|row| row.layout_vec(horizontal));
        for (i, area) in areas.enumerate() {
            let month = date
                .replace_day(1)
                .unwrap()
                .replace_month(Month::try_from(i as u8 + 1).unwrap())
                .unwrap();
            self.render_month(frame, area, month, &events);
        }
        Ok(())
    }

    fn render_month(self, frame: &mut Frame, area: Rect, date: Date, events: &CalendarEventStore) {
        let calendar = match self {
            Self::Default => Monthly::new(date, events)
                .default_style(Style::new().bold().bg(Color::Rgb(50, 50, 50)))
                .show_month_header(Style::default()),
            Self::Surrounding => Monthly::new(date, events)
                .default_style(Style::new().bold().bg(Color::Rgb(50, 50, 50)))
                .show_month_header(Style::default())
                .show_surrounding(Style::new().dim()),
            Self::WeekdaysHeader => Monthly::new(date, events)
                .default_style(Style::new().bold().bg(Color::Rgb(50, 50, 50)))
                .show_month_header(Style::default())
                .show_weekdays_header(Style::new().bold().green()),
            Self::SurroundingAndWeekdaysHeader => Monthly::new(date, events)
                .default_style(Style::new().bold().bg(Color::Rgb(50, 50, 50)))
                .show_month_header(Style::default())
                .show_surrounding(Style::new().dim())
                .show_weekdays_header(Style::new().bold().green()),
            Self::MonthHeader => Monthly::new(date, events)
                .default_style(Style::new().bold().bg(Color::Rgb(50, 50, 50)))
                .show_month_header(Style::default())
                .show_month_header(Style::new().bold().green()),
            Self::MonthAndWeekdaysHeader => Monthly::new(date, events)
                .default_style(Style::new().bold().bg(Color::Rgb(50, 50, 50)))
                .show_month_header(Style::default())
                .show_weekdays_header(Style::new().bold().dim().light_yellow()),
        };
        frame.render_widget(calendar, area);
    }
}

/// Makes a list of dates for the current year.
fn events(selected_date: Date) -> Result<CalendarEventStore> {
    const SELECTED: Style = Style::new()
        .fg(Color::White)
        .bg(Color::Red)
        .add_modifier(Modifier::BOLD);
    const HOLIDAY: Style = Style::new()
        .fg(Color::Red)
        .add_modifier(Modifier::UNDERLINED);
    const SEASON: Style = Style::new()
        .fg(Color::Green)
        .bg(Color::Black)
        .add_modifier(Modifier::UNDERLINED);

    let mut list = CalendarEventStore::today(
        Style::default()
            .add_modifier(Modifier::BOLD)
            .bg(Color::Blue),
    );
    let y = selected_date.year();

    // new year's
    list.add(Date::from_calendar_date(y, Month::January, 1)?, HOLIDAY);
   
```

### Core Architecture Module: `examples/apps/canvas/src/main.rs`
```
/// A Ratatui example that demonstrates how to draw on a canvas.
///
/// This example demonstrates how to draw various shapes such as rectangles, circles, and lines
/// on a canvas. It also demonstrates how to draw a map.
///
/// This example runs with the Ratatui library code in the branch that you are currently
/// reading. See the [`latest`] branch for the code which works with the most recent Ratatui
/// release.
///
/// [`latest`]: https://github.com/ratatui/ratatui/tree/latest
use std::{
    io::stdout,
    time::{Duration, Instant},
};

use color_eyre::Result;
use crossterm::ExecutableCommand;
use crossterm::event::{
    self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEvent, MouseEventKind,
};
use itertools::Itertools;
use ratatui::layout::{Constraint, Layout, Position, Rect};
use ratatui::style::{Color, Stylize};
use ratatui::symbols::Marker;
use ratatui::text::Text;
use ratatui::widgets::canvas::{Canvas, Circle, Map, MapResolution, Points, Rectangle};
use ratatui::widgets::{Block, Widget};
use ratatui::{DefaultTerminal, Frame};

fn main() -> Result<()> {
    color_eyre::install()?;
    stdout().execute(EnableMouseCapture)?;
    let terminal = ratatui::init();
    let app_result = App::new().run(terminal);
    ratatui::restore();
    stdout().execute(DisableMouseCapture)?;
    app_result
}

struct App {
    exit: bool,
    x: f64,
    y: f64,
    ball: Circle,
    playground: Rect,
    vx: f64,
    vy: f64,
    marker: Marker,
    points: Vec<Position>,
    is_drawing: bool,
}

impl App {
    const fn new() -> Self {
        Self {
            exit: false,
            x: 0.0,
            y: 0.0,
            ball: Circle {
                x: 20.0,
                y: 40.0,
                radius: 10.0,
                color: Color::Yellow,
            },
            playground: Rect::new(10, 10, 200, 100),
            vx: 1.0,
            vy: 1.0,
            marker: Marker::Dot,
            points: vec![],
            is_drawing: false,
        }
    }

    pub fn run(mut self, mut terminal: DefaultTerminal) -> Result<()> {
        let tick_rate = Duration::from_millis(16);
        let mut last_tick = Instant::now();
        while !self.exit {
            terminal.draw(|frame| self.render(frame))?;
            let timeout = tick_rate.saturating_sub(last_tick.elapsed());
            if !event::poll(timeout)? {
                self.on_tick();
                last_tick = Instant::now();
                continue;
            }
            match event::read()? {
                Event::Key(key) => self.handle_key_event(key),
                Event::Mouse(event) => self.handle_mouse_event(event),
                _ => (),
            }
        }
        Ok(())
    }

    fn handle_key_event(&mut self, key: KeyEvent) {
        if !key.is_press() {
            return;
        }
        match key.code {
            KeyCode::Char('q') | KeyCode::Esc => self.exit = true,
            KeyCode::Char('j') | KeyCode::Down => self.y += 1.0,
            KeyCode::Char('k') | KeyCode::Up => self.y -= 1.0,
            KeyCode::Char('l') | KeyCode::Right => self.x += 1.0,
            KeyCode::Char('h') | KeyCode::Left => self.x -= 1.0,
            KeyCode::Enter => self.cycle_marker(),
            _ => {}
        }
    }

    fn handle_mouse_event(&mut self, event: event::MouseEvent) {
        match event.kind {
            MouseEventKind::Down(_) => self.is_drawing = true,
            MouseEventKind::Up(_) => self.is_drawing = false,
            MouseEventKind::Drag(_) => {
                self.points.push(Position::new(event.column, event.row));
            }
            _ => {}
        }
    }

    const fn cycle_marker(&mut self) {
        self.marker = match self.marker {
            Marker::Dot => Marker::Braille,
            Marker::Braille => Marker::Block,
            Marker::Block => Marker::HalfBlock,
            Marker::HalfBlock => Marker::Quadrant,
            Marker::Quadrant => Marker::Sextant,
            Marker::Sextant => Marker::Octant,
            Marker::Octant => Marker::Custom('×'),
            Marker::Custom('×') => Marker::Bar,
            Marker::Bar => Marker::Dot,
            _ => unreachable!(),
        };
    }

    fn on_tick(&mut self) {
        // bounce the ball by flipping the velocity vector
        let ball = &self.ball;
        let playground = self.playground;
        if ball.x - ball.radius < f64::from(playground.left())
            || ball.x + ball.radius > f64::from(playground.right())
        {
            self.vx = -self.vx;
        }
        if ball.y - ball.radius < f64::from(playground.top())
            || ball.y + ball.radius > f64::from(playground.bottom())
        {
            self.vy = -self.vy;
        }
        self.ball.x += self.vx;
        self.ball.y += self.vy;
    }

    fn render(&self, frame: &mut Frame) {
        let header = Text::from_iter([
            "Canvas Example".bold(),
            "<q> Quit | <enter> Change Marker | <hjkl> Move".into(),
        ]);

        let vertical = Layout::vertical([
            Constraint::Length(header.height() as u16),
            Constraint::Fill(1),
            Constraint::Fill(1),
        ]);
        let [text_area, up, down] = frame.area().layout(&vertical);
        frame.render_widget(header.centered(), text_area);

        let horizontal = Layout::horizontal([Constraint::Fill(1); 2]);
        let [draw, pong] = up.layout(&horizontal);
        let [map, boxes] = down.layout(&horizontal);

        frame.render_widget(self.map_canvas(), map);
        frame.render_widget(self.draw_canvas(draw), draw);
        frame.render_widget(self.pong_canvas(), pong);
        frame.render_widget(self.boxes_canvas(boxes), boxes);
    }

    fn map_canvas(&self) -> impl Widget + '_ {
        Canvas::default()
            .block(Block::bordered().title("World"))
            .marker(self.marker)
            .paint(|ctx| {
                ctx.draw(&Map {
                    color: Color::Green,
                    resolution: MapResolution::High,
                });
                ctx.print(self.x, -self.y, "You are here".yellow());
            })
            .x_bounds([-180.0, 180.0])
            .y_bounds([-90.0, 90.0])
    }

    fn draw_canvas(&self, area: Rect) -> impl Widget + '_ {
        Canvas::default()
            .block(Block::bordered().title("Draw here"))
            .marker(self.marker)
            .x_bounds([0.0, f64::from(area.width)])
            .y_bounds([0.0, f64::from(area.height)])
            .paint(move |ctx| {
                let points = self
                    .points
                    .iter()
                    .map(|p| {
                        (
                            f64::from(p.x) - f64::from(area.left()),
                            f64::from(area.bottom()) - f64::from(p.y),
                        )
                    })
                    .collect_vec();
                ctx.draw(&Points {
                    coords: &points,
                    color: Color::White,
                });
            })
    }

    fn pong_canvas(&self) -> impl Widget + '_ {
        Canvas::default()
            .block(Block::bordered().title("Pong"))
            .marker(self.marker)
            .paint(|ctx| {
                ctx.draw(&self.ball);
            })
            .x_bounds([10.0, 210.0])
            .y_bounds([10.0, 110.0])
    }

    fn boxes_canvas(&self, area: Rect) -> impl Widget {
        let left = 0.0;
        let right = f64::from(area.width);
        let bottom = 0.0;
        let top = f64::from(area.height).mul_add(2.0, -4.0);
        Canvas::default()
            .block(Block::bordered().title("Rects"))
            .marker(self.marker)
            .x_bounds([left, right])
            .y_bounds([bottom, top])
            .paint(|ctx| {
                for i in 0..=11 {
                    ctx.draw(&Rectangle {
                        x: f64::from(i * i + 3 * i) / 2.0 + 2.0,
                        y: 2.0,
           
```

### Core Architecture Module: `examples/apps/chart/src/main.rs`
```
/// A Ratatui example that demonstrates how to handle charts.
///
/// This example demonstrates how to draw various types of charts such as line, bar, and
/// scatter charts.
///
/// This example runs with the Ratatui library code in the branch that you are currently
/// reading. See the [`latest`] branch for the code which works with the most recent Ratatui
/// release.
///
/// [`latest`]: https://github.com/ratatui/ratatui/tree/latest
use std::time::{Duration, Instant};

use color_eyre::Result;
use crossterm::event::{self, KeyCode};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::symbols::{self, Marker};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Axis, Block, Chart, Dataset, GraphType, LegendPosition};
use ratatui::{DefaultTerminal, Frame};

fn main() -> Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| App::new().run(terminal))
}

struct App {
    signal1: SinSignal,
    data1: Vec<(f64, f64)>,
    signal2: SinSignal,
    data2: Vec<(f64, f64)>,
    window: [f64; 2],
}

#[derive(Clone)]
struct SinSignal {
    x: f64,
    interval: f64,
    period: f64,
    scale: f64,
}

impl SinSignal {
    const fn new(interval: f64, period: f64, scale: f64) -> Self {
        Self {
            x: 0.0,
            interval,
            period,
            scale,
        }
    }
}

impl Iterator for SinSignal {
    type Item = (f64, f64);
    fn next(&mut self) -> Option<Self::Item> {
        let point = (self.x, (self.x * 1.0 / self.period).sin() * self.scale);
        self.x += self.interval;
        Some(point)
    }
}

impl App {
    fn new() -> Self {
        let mut signal1 = SinSignal::new(0.2, 3.0, 18.0);
        let mut signal2 = SinSignal::new(0.1, 2.0, 10.0);
        let data1 = signal1.by_ref().take(200).collect::<Vec<(f64, f64)>>();
        let data2 = signal2.by_ref().take(200).collect::<Vec<(f64, f64)>>();
        Self {
            signal1,
            data1,
            signal2,
            data2,
            window: [0.0, 20.0],
        }
    }

    fn run(mut self, terminal: &mut DefaultTerminal) -> Result<()> {
        let tick_rate = Duration::from_millis(250);
        let mut last_tick = Instant::now();
        loop {
            terminal.draw(|frame| self.render(frame))?;

            let timeout = tick_rate.saturating_sub(last_tick.elapsed());
            if !event::poll(timeout)? {
                self.on_tick();
                last_tick = Instant::now();
                continue;
            }
            if event::read()?
                .as_key_press_event()
                .is_some_and(|key| key.code == KeyCode::Char('q'))
            {
                return Ok(());
            }
        }
    }

    fn on_tick(&mut self) {
        self.data1.drain(0..5);
        self.data1.extend(self.signal1.by_ref().take(5));

        self.data2.drain(0..10);
        self.data2.extend(self.signal2.by_ref().take(10));

        self.window[0] += 1.0;
        self.window[1] += 1.0;
    }

    fn render(&self, frame: &mut Frame) {
        let vertical = Layout::vertical([Constraint::Fill(1); 2]);
        let [top, bottom] = frame.area().layout(&vertical);
        let horizontal = Layout::horizontal([Constraint::Fill(1), Constraint::Length(29)]);
        let [animated_chart, bar_chart] = top.layout(&horizontal);
        let [line_chart, scatter] = bottom.layout(&Layout::horizontal([Constraint::Fill(1); 2]));

        self.render_animated_chart(frame, animated_chart);
        render_barchart(frame, bar_chart);
        render_line_chart(frame, line_chart);
        render_scatter(frame, scatter);
    }

    fn render_animated_chart(&self, frame: &mut Frame, area: Rect) {
        let x_labels = vec![
            Span::styled(
                format!("{}", self.window[0]),
                Style::default().add_modifier(Modifier::BOLD),
            ),
            Span::raw(format!("{}", f64::midpoint(self.window[0], self.window[1]))),
            Span::styled(
                format!("{}", self.window[1]),
                Style::default().add_modifier(Modifier::BOLD),
            ),
        ];
        let datasets = vec![
            Dataset::default()
                .name("data2")
                .marker(symbols::Marker::Dot)
                .style(Style::default().fg(Color::Cyan))
                .data(&self.data1),
            Dataset::default()
                .name("data3")
                .marker(symbols::Marker::Braille)
                .style(Style::default().fg(Color::Yellow))
                .data(&self.data2),
        ];

        let chart = Chart::new(datasets)
            .block(Block::bordered())
            .x_axis(
                Axis::default()
                    .title("X Axis")
                    .style(Style::default().fg(Color::Gray))
                    .labels(x_labels)
                    .bounds(self.window),
            )
            .y_axis(
                Axis::default()
                    .title("Y Axis")
                    .style(Style::default().fg(Color::Gray))
                    .labels(["-20".bold(), "0".into(), "20".bold()])
                    .bounds([-20.0, 20.0]),
            );

        frame.render_widget(chart, area);
    }
}

fn render_barchart(frame: &mut Frame, bar_chart: Rect) {
    let dataset = Dataset::default()
        .marker(symbols::Marker::HalfBlock)
        .style(Style::new().fg(Color::Blue))
        .graph_type(GraphType::Bar)
        // a bell curve
        .data(&[
            (0., 0.4),
            (10., 2.9),
            (20., 13.5),
            (30., 41.1),
            (40., 80.1),
            (50., 100.0),
            (60., 80.1),
            (70., 41.1),
            (80., 13.5),
            (90., 2.9),
            (100., 0.4),
        ]);

    let chart = Chart::new(vec![dataset])
        .block(Block::bordered().title_top(Line::from("Bar chart").cyan().bold().centered()))
        .x_axis(
            Axis::default()
                .style(Style::default().gray())
                .bounds([0.0, 100.0])
                .labels(["0".bold(), "50".into(), "100.0".bold()]),
        )
        .y_axis(
            Axis::default()
                .style(Style::default().gray())
                .bounds([0.0, 100.0])
                .labels(["0".bold(), "50".into(), "100.0".bold()]),
        )
        .hidden_legend_constraints((Constraint::Ratio(1, 2), Constraint::Ratio(1, 2)));

    frame.render_widget(chart, bar_chart);
}

fn render_line_chart(frame: &mut Frame, area: Rect) {
    let datasets = vec![
        Dataset::default()
            .name("Line from only 2 points".italic())
            .marker(symbols::Marker::Braille)
            .style(Style::default().fg(Color::Yellow))
            .graph_type(GraphType::Line)
            .data(&[(1., 1.), (4., 4.)]),
    ];

    let chart = Chart::new(datasets)
        .block(Block::bordered().title(Line::from("Line chart").cyan().bold().centered()))
        .x_axis(
            Axis::default()
                .title("X Axis")
                .style(Style::default().gray())
                .bounds([0.0, 5.0])
                .labels(["0".bold(), "2.5".into(), "5.0".bold()]),
        )
        .y_axis(
            Axis::default()
                .title("Y Axis")
                .style(Style::default().gray())
                .bounds([0.0, 5.0])
                .labels(["0".bold(), "2.5".into(), "5.0".bold()]),
        )
        .legend_position(Some(LegendPosition::TopLeft))
        .hidden_legend_constraints((Constraint::Ratio(1, 2), Constraint::Ratio(1, 2)));

    frame.render_widget(chart, area);
}

fn render_scatter(frame: &mut Frame, area: Rect) {
    let datasets = vec![
        Dataset::default()
            .name("Heavy")
            .marker(Marker::Dot)
            .graph_type(GraphType::Scatter)
            .style(Style::new().yellow())
            .data(&HEAVY_PAYLOAD_DATA),
        Dataset::default()
            .name("Medium".underlined())
```

### Core Architecture Module: `examples/apps/color-explorer/src/main.rs`
```
//! A Ratatui example that demonstrates how to handle colors.
//!
//! This example shows all the colors supported by Ratatui. It will render a grid of foreground
//! and background colors with their names and indexes.
//!
//! This example runs with the Ratatui library code in the branch that you are currently reading.
//! See the [`latest`] branch for the code which works with the most recent Ratatui release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest

use color_eyre::Result;
use crossterm::event;
use itertools::Itertools;
use ratatui::Frame;
use ratatui::layout::{Alignment, Constraint, Layout, Rect};
use ratatui::style::{Color, Style, Stylize};
use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};

fn main() -> Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        loop {
            terminal.draw(render)?;
            if event::read()?.is_key_press() {
                return Ok(());
            }
        }
    })
}

fn render(frame: &mut Frame) {
    let [named, indexed_colors, indexed_greys] = Layout::vertical([
        Constraint::Length(30),
        Constraint::Length(17),
        Constraint::Length(2),
    ])
    .areas(frame.area());

    render_named_colors(frame, named);
    render_indexed_colors(frame, indexed_colors);
    render_indexed_grayscale(frame, indexed_greys);
}

const NAMED_COLORS: [Color; 16] = [
    Color::Black,
    Color::Red,
    Color::Green,
    Color::Yellow,
    Color::Blue,
    Color::Magenta,
    Color::Cyan,
    Color::Gray,
    Color::DarkGray,
    Color::LightRed,
    Color::LightGreen,
    Color::LightYellow,
    Color::LightBlue,
    Color::LightMagenta,
    Color::LightCyan,
    Color::White,
];

fn render_named_colors(frame: &mut Frame, area: Rect) {
    let layout = Layout::vertical([Constraint::Length(3); 10]).split(area);

    render_fg_named_colors(frame, Color::Reset, layout[0]);
    render_fg_named_colors(frame, Color::Black, layout[1]);
    render_fg_named_colors(frame, Color::DarkGray, layout[2]);
    render_fg_named_colors(frame, Color::Gray, layout[3]);
    render_fg_named_colors(frame, Color::White, layout[4]);

    render_bg_named_colors(frame, Color::Reset, layout[5]);
    render_bg_named_colors(frame, Color::Black, layout[6]);
    render_bg_named_colors(frame, Color::DarkGray, layout[7]);
    render_bg_named_colors(frame, Color::Gray, layout[8]);
    render_bg_named_colors(frame, Color::White, layout[9]);
}

fn render_fg_named_colors(frame: &mut Frame, bg: Color, area: Rect) {
    let block = title_block(format!("Foreground colors on {bg} background"));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let vertical = Layout::vertical([Constraint::Length(1); 2]);
    let horizontal = Layout::horizontal([Constraint::Ratio(1, 8); 8]);
    let areas = inner
        .layout_vec(&vertical)
        .into_iter()
        .flat_map(|area| area.layout_vec(&horizontal));
    for (fg, area) in NAMED_COLORS.into_iter().zip(areas) {
        let color_name = fg.to_string();
        let paragraph = Paragraph::new(color_name).fg(fg).bg(bg);
        frame.render_widget(paragraph, area);
    }
}

fn render_bg_named_colors(frame: &mut Frame, fg: Color, area: Rect) {
    let block = title_block(format!("Background colors with {fg} foreground"));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let vertical = Layout::vertical([Constraint::Length(1); 2]);
    let horizontal = Layout::horizontal([Constraint::Ratio(1, 8); 8]);
    let areas = inner
        .layout_vec(&vertical)
        .into_iter()
        .flat_map(|area| area.layout_vec(&horizontal));
    for (bg, area) in NAMED_COLORS.into_iter().zip(areas) {
        let color_name = bg.to_string();
        let paragraph = Paragraph::new(color_name).fg(fg).bg(bg);
        frame.render_widget(paragraph, area);
    }
}

fn render_indexed_colors(frame: &mut Frame, area: Rect) {
    let block = title_block("Indexed colors".into());
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let layout = Layout::vertical([
        Constraint::Length(1), // 0 - 15
        Constraint::Length(1), // blank
        Constraint::Min(6),    // 16 - 123
        Constraint::Length(1), // blank
        Constraint::Min(6),    // 124 - 231
        Constraint::Length(1), // blank
    ])
    .split(inner);

    //    0   1   2   3   4   5    6   7   8   9  10  11   12  13  14  15
    let color_layout = Layout::horizontal([Constraint::Length(5); 16]).split(layout[0]);
    for i in 0..16 {
        let color = Color::Indexed(i);
        let color_index = format!("{i:0>2}");
        let bg = if i < 1 { Color::DarkGray } else { Color::Black };
        let paragraph = Paragraph::new(Line::from(vec![
            color_index.fg(color).bg(bg),
            "██".bg(color).fg(color),
        ]));
        frame.render_widget(paragraph, color_layout[i as usize]);
    }

    //   16  17  18  19  20  21   52  53  54  55  56  57   88  89  90  91  92  93
    //   22  23  24  25  26  27   58  59  60  61  62  63   94  95  96  97  98  99
    //   28  29  30  31  32  33   64  65  66  67  68  69  100 101 102 103 104 105
    //   34  35  36  37  38  39   70  71  72  73  74  75  106 107 108 109 110 111
    //   40  41  42  43  44  45   76  77  78  79  80  81  112 113 114 115 116 117
    //   46  47  48  49  50  51   82  83  84  85  86  87  118 119 120 121 122 123
    //
    //  124 125 126 127 128 129  160 161 162 163 164 165  196 197 198 199 200 201
    //  130 131 132 133 134 135  166 167 168 169 170 171  202 203 204 205 206 207
    //  136 137 138 139 140 141  172 173 174 175 176 177  208 209 210 211 212 213
    //  142 143 144 145 146 147  178 179 180 181 182 183  214 215 216 217 218 219
    //  148 149 150 151 152 153  184 185 186 187 188 189  220 221 222 223 224 225
    //  154 155 156 157 158 159  190 191 192 193 194 195  226 227 228 229 230 231

    // the above looks complex but it's so the colors are grouped into blocks that display nicely
    let index_layout = [layout[2], layout[4]]
        .iter()
        // two rows of 3 columns
        .flat_map(|area| {
            Layout::horizontal([Constraint::Length(27); 3])
                .split(*area)
                .to_vec()
        })
        // each with 6 rows
        .flat_map(|area| {
            Layout::vertical([Constraint::Length(1); 6])
                .split(area)
                .to_vec()
        })
        // each with 6 columns
        .flat_map(|area| {
            Layout::horizontal([Constraint::Min(4); 6])
                .split(area)
                .to_vec()
        })
        .collect_vec();

    for i in 16..=231 {
        let color = Color::Indexed(i);
        let color_index = format!("{i:0>3}");
        let paragraph = Paragraph::new(Line::from(vec![
            color_index.fg(color).bg(Color::Reset),
            ".".bg(color).fg(color),
            // There's a bug in VHS that seems to bleed backgrounds into the next
            // character. This is a workaround to make the bug less obvious.
            "███".reversed(),
        ]));
        frame.render_widget(paragraph, index_layout[i as usize - 16]);
    }
}

fn title_block(title: String) -> Block<'static> {
    Block::new()
        .borders(Borders::TOP)
        .title_alignment(Alignment::Center)
        .border_style(Style::new().dark_gray())
        .title_style(Style::reset())
        .title(title)
}

fn render_indexed_grayscale(frame: &mut Frame, area: Rect) {
    let layout = Layout::vertical([
        Constraint::Length(1), // 232 - 243
        Constraint::Length(1), // 244 - 255
    ])
    .split(area)
    .iter()
    .flat_map(|area| {
        Layout::horizontal([Constraint::Length(6); 12])
            .split(*area)
            .to_vec()
    })
    .collect_vec();

    for i in 232..=255 {
        let color = Color::Indexed(i);
        let color_index = format!("{i:0>3}");
        // make the dark colors easier to read
     
```

### Core Architecture Module: `examples/apps/colors-rgb/src/main.rs`
```
//! A Ratatui example that shows the full range of RGB colors that can be displayed in the terminal.
//!
//! Requires a terminal that supports 24-bit color (true color) and unicode.
//!
//! This example also demonstrates how implementing the Widget trait on a mutable reference
//! allows the widget to update its state while it is being rendered. This allows the fps
//! widget to update the fps calculation and the colors widget to update a cached version of
//! the colors to render instead of recalculating them every frame.
//!
//! This is an alternative to using the `StatefulWidget` trait and a separate state struct. It
//! is useful when the state is only used by the widget and doesn't need to be shared with
//! other widgets.
//!
//! This example runs with the Ratatui library code in the branch that you are currently reading.
//! See the [`latest`] branch for the code which works with the most recent Ratatui release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest

use std::time::{Duration, Instant};

use color_eyre::Result;
use crossterm::event;
use palette::convert::FromColorUnclamped;
use palette::{Okhsv, Srgb};
use ratatui::DefaultTerminal;
use ratatui::buffer::Buffer;
use ratatui::layout::{Constraint, Layout, Position, Rect};
use ratatui::style::Color;
use ratatui::text::Text;
use ratatui::widgets::Widget;

fn main() -> Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| App::default().run(terminal))
}

#[derive(Debug, Default)]
struct App {
    /// The current state of the app (running or quit)
    state: AppState,

    /// A widget that displays the current frames per second
    fps_widget: FpsWidget,

    /// A widget that displays the full range of RGB colors that can be displayed in the terminal.
    colors_widget: ColorsWidget,
}

#[derive(Debug, Default, PartialEq, Eq)]
enum AppState {
    /// The app is running
    #[default]
    Running,

    /// The user has requested the app to quit
    Quit,
}

/// A widget that displays the current frames per second
#[derive(Debug)]
struct FpsWidget {
    /// The number of elapsed frames that have passed - used to calculate the fps
    frame_count: usize,

    /// The last instant that the fps was calculated
    last_instant: Instant,

    /// The current frames per second
    fps: Option<f32>,
}

/// A widget that displays the full range of RGB colors that can be displayed in the terminal.
///
/// This widget is animated and will change colors over time.
#[derive(Debug, Default)]
struct ColorsWidget {
    /// The colors to render - should be double the height of the area as we render two rows of
    /// pixels for each row of the widget using the half block character. This is computed any time
    /// the size of the widget changes.
    colors: Vec<Vec<Color>>,

    /// the number of elapsed frames that have passed - used to animate the colors by shifting the
    /// x index by the frame number
    frame_count: usize,
}

impl App {
    /// Run the app
    ///
    /// This is the main event loop for the app.
    pub fn run(mut self, terminal: &mut DefaultTerminal) -> Result<()> {
        while self.is_running() {
            terminal.draw(|frame| frame.render_widget(&mut self, frame.area()))?;
            self.handle_events()?;
        }
        Ok(())
    }

    const fn is_running(&self) -> bool {
        matches!(self.state, AppState::Running)
    }

    /// Handle any events that have occurred since the last time the app was rendered.
    fn handle_events(&mut self) -> Result<()> {
        // Ensure that the app only blocks for a period that allows the app to render at
        // approximately 60 FPS (this doesn't account for the time to render the frame, and will
        // also update the app immediately any time an event occurs)
        let timeout = Duration::from_secs_f32(1.0 / 60.0);
        if !event::poll(timeout)? {
            return Ok(());
        }
        if event::read()?.is_key_press() {
            self.state = AppState::Quit;
        }
        Ok(())
    }
}

/// Implement the Widget trait for &mut App so that it can be rendered
///
/// This is implemented on a mutable reference so that the app can update its state while it is
/// being rendered. This allows the fps widget to update the fps calculation and the colors widget
/// to update the colors to render.
impl Widget for &mut App {
    fn render(self, area: Rect, buf: &mut Buffer) {
        use Constraint::{Length, Min};
        let [top, colors] = area.layout(&Layout::vertical([Length(1), Min(0)]));
        let [title, fps] = top.layout(&Layout::horizontal([Min(0), Length(8)]));
        Text::from("colors_rgb example. Press q to quit")
            .centered()
            .render(title, buf);
        self.fps_widget.render(fps, buf);
        self.colors_widget.render(colors, buf);
    }
}

/// Default impl for `FpsWidget`
///
/// Manual impl is required because we need to initialize the `last_instant` field to the current
/// instant.
impl Default for FpsWidget {
    fn default() -> Self {
        Self {
            frame_count: 0,
            last_instant: Instant::now(),
            fps: None,
        }
    }
}

/// Widget impl for `FpsWidget`
///
/// This is implemented on a mutable reference so that we can update the frame count and fps
/// calculation while rendering.
impl Widget for &mut FpsWidget {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.calculate_fps();
        if let Some(fps) = self.fps {
            let text = format!("{fps:.1} fps");
            Text::from(text).render(area, buf);
        }
    }
}

impl FpsWidget {
    /// Update the fps calculation.
    ///
    /// This updates the fps once a second, but only if the widget has rendered at least 2 frames
    /// since the last calculation. This avoids noise in the fps calculation when rendering on slow
    /// machines that can't render at least 2 frames per second.
    #[expect(clippy::cast_precision_loss)]
    fn calculate_fps(&mut self) {
        self.frame_count += 1;
        let elapsed = self.last_instant.elapsed();
        if elapsed > Duration::from_secs(1) && self.frame_count > 2 {
            self.fps = Some(self.frame_count as f32 / elapsed.as_secs_f32());
            self.frame_count = 0;
            self.last_instant = Instant::now();
        }
    }
}

/// Widget impl for `ColorsWidget`
///
/// This is implemented on a mutable reference so that we can update the frame count and store a
/// cached version of the colors to render instead of recalculating them every frame.
impl Widget for &mut ColorsWidget {
    /// Render the widget
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.setup_colors(area);
        let colors = &self.colors;
        for (xi, x) in (area.left()..area.right()).enumerate() {
            // animate the colors by shifting the x index by the frame number
            let xi = (xi + self.frame_count) % (area.width as usize);
            for (yi, y) in (area.top()..area.bottom()).enumerate() {
                // render a half block character for each row of pixels with the foreground color
                // set to the color of the pixel and the background color set to the color of the
                // pixel below it
                let fg = colors[yi * 2][xi];
                let bg = colors[yi * 2 + 1][xi];
                buf[Position::new(x, y)].set_char('▀').set_fg(fg).set_bg(bg);
            }
        }
        self.frame_count += 1;
    }
}

impl ColorsWidget {
    /// Setup the colors to render.
    ///
    /// This is called once per frame to setup the colors to render. It caches the colors so that
    /// they don't need to be recalculated every frame.
    #[expect(clippy::cast_precision_loss)]
    fn setup_colors(&mut self, size: Rect) {
        let Rect { width, height, .. } = size;
        // double the height because each screen row has two rows of half block pixels
        let height = height as usize * 2;
        let width = width as 
```

### Core Architecture Module: `examples/apps/constraint-explorer/src/main.rs`
```
use std::cmp::Ordering;

/// A Ratatui example that demonstrates how different layout constraints and flex modes work.
///
/// It compares how each flex mode distributes space and supports swapping constraints, adding
/// and removing blocks, and changing the spacing between blocks.
///
/// This example runs with the Ratatui library code in the branch that you are currently
/// reading. See the [`latest`] branch for the code which works with the most recent Ratatui
/// release.
///
/// [`latest`]: https://github.com/ratatui/ratatui/tree/latest
use color_eyre::Result;
use crossterm::event::{self, KeyCode};
use itertools::Itertools;
use ratatui::DefaultTerminal;
use ratatui::buffer::Buffer;
use ratatui::layout::Constraint::{self, Fill, Length, Max, Min, Percentage, Ratio};
use ratatui::layout::{Flex, Layout, Rect};
use ratatui::style::palette::tailwind::{BLUE, SKY, SLATE, STONE};
use ratatui::style::{Color, Style, Stylize};
use ratatui::symbols::{self, line};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Paragraph, Widget, Wrap};
use strum::{Display, EnumIter, FromRepr};

fn main() -> Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| App::default().run(terminal))
}

#[derive(Default)]
struct App {
    mode: AppMode,
    spacing: i16,
    constraints: Vec<Constraint>,
    selected_index: usize,
    value: u16,
}

#[derive(Debug, Default, PartialEq, Eq)]
enum AppMode {
    #[default]
    Running,
    Quit,
}

/// A variant of [`Constraint`] that can be rendered as a tab.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, EnumIter, FromRepr, Display)]
enum ConstraintName {
    #[default]
    Length,
    Percentage,
    Ratio,
    Min,
    Max,
    Fill,
}

/// A widget that renders a [`Constraint`] as a block. E.g.:
/// ```plain
/// ┌──────────────┐
/// │  Length(16)  │
/// │     16px     │
/// └──────────────┘
/// ```
struct ConstraintBlock {
    constraint: Constraint,
    legend: bool,
    selected: bool,
}

/// A widget that renders a spacer with a label indicating the width of the spacer. E.g.:
///
/// ```plain
/// ┌      ┐
///   8 px
/// └      ┘
/// ```
struct SpacerBlock;

// App behaviour
impl App {
    fn run(mut self, terminal: &mut DefaultTerminal) -> Result<()> {
        self.insert_test_defaults();

        while self.is_running() {
            terminal.draw(|frame| frame.render_widget(&self, frame.area()))?;
            self.handle_events()?;
        }
        Ok(())
    }

    // TODO remove these - these are just for testing
    fn insert_test_defaults(&mut self) {
        self.constraints = vec![
            Constraint::Length(20),
            Constraint::Length(20),
            Constraint::Length(20),
        ];
        self.value = 20;
    }

    fn is_running(&self) -> bool {
        self.mode == AppMode::Running
    }

    fn handle_events(&mut self) -> Result<()> {
        if let Some(key) = event::read()?.as_key_press_event() {
            match key.code {
                KeyCode::Char('q') | KeyCode::Esc => self.exit(),
                KeyCode::Char('1') => self.swap_constraint(ConstraintName::Min),
                KeyCode::Char('2') => self.swap_constraint(ConstraintName::Max),
                KeyCode::Char('3') => self.swap_constraint(ConstraintName::Length),
                KeyCode::Char('4') => self.swap_constraint(ConstraintName::Percentage),
                KeyCode::Char('5') => self.swap_constraint(ConstraintName::Ratio),
                KeyCode::Char('6') => self.swap_constraint(ConstraintName::Fill),
                KeyCode::Char('+') => self.increment_spacing(),
                KeyCode::Char('-') => self.decrement_spacing(),
                KeyCode::Char('x') => self.delete_block(),
                KeyCode::Char('a') => self.insert_block(),
                KeyCode::Char('k') | KeyCode::Up => self.increment_value(),
                KeyCode::Char('j') | KeyCode::Down => self.decrement_value(),
                KeyCode::Char('h') | KeyCode::Left => self.prev_block(),
                KeyCode::Char('l') | KeyCode::Right => self.next_block(),
                _ => {}
            }
        }
        Ok(())
    }

    fn increment_value(&mut self) {
        let Some(constraint) = self.constraints.get_mut(self.selected_index) else {
            return;
        };
        match constraint {
            Constraint::Length(v)
            | Constraint::Min(v)
            | Constraint::Max(v)
            | Constraint::Fill(v)
            | Constraint::Percentage(v) => *v = v.saturating_add(1),
            Constraint::Ratio(_n, d) => *d = d.saturating_add(1),
        }
    }

    fn decrement_value(&mut self) {
        let Some(constraint) = self.constraints.get_mut(self.selected_index) else {
            return;
        };
        match constraint {
            Constraint::Length(v)
            | Constraint::Min(v)
            | Constraint::Max(v)
            | Constraint::Fill(v)
            | Constraint::Percentage(v) => *v = v.saturating_sub(1),
            Constraint::Ratio(_n, d) => *d = d.saturating_sub(1),
        }
    }

    /// select the next block with wrap around
    const fn next_block(&mut self) {
        if self.constraints.is_empty() {
            return;
        }
        let len = self.constraints.len();
        self.selected_index = (self.selected_index + 1) % len;
    }

    /// select the previous block with wrap around
    const fn prev_block(&mut self) {
        if self.constraints.is_empty() {
            return;
        }
        let len = self.constraints.len();
        self.selected_index = (self.selected_index + self.constraints.len() - 1) % len;
    }

    /// delete the selected block
    fn delete_block(&mut self) {
        if self.constraints.is_empty() {
            return;
        }
        self.constraints.remove(self.selected_index);
        self.selected_index = self.selected_index.saturating_sub(1);
    }

    /// insert a block after the selected block
    fn insert_block(&mut self) {
        let index = self
            .selected_index
            .saturating_add(1)
            .min(self.constraints.len());
        let constraint = Constraint::Length(self.value);
        self.constraints.insert(index, constraint);
        self.selected_index = index;
    }

    const fn increment_spacing(&mut self) {
        self.spacing = self.spacing.saturating_add(1);
    }

    const fn decrement_spacing(&mut self) {
        self.spacing = self.spacing.saturating_sub(1);
    }

    const fn exit(&mut self) {
        self.mode = AppMode::Quit;
    }

    fn swap_constraint(&mut self, name: ConstraintName) {
        if self.constraints.is_empty() {
            return;
        }
        let constraint = match name {
            ConstraintName::Length => Length(self.value),
            ConstraintName::Percentage => Percentage(self.value),
            ConstraintName::Min => Min(self.value),
            ConstraintName::Max => Max(self.value),
            ConstraintName::Fill => Fill(self.value),
            ConstraintName::Ratio => Ratio(1, u32::from(self.value) / 4), // for balance
        };
        self.constraints[self.selected_index] = constraint;
    }
}

impl From<Constraint> for ConstraintName {
    fn from(constraint: Constraint) -> Self {
        match constraint {
            Length(_) => Self::Length,
            Percentage(_) => Self::Percentage,
            Ratio(_, _) => Self::Ratio,
            Min(_) => Self::Min,
            Max(_) => Self::Max,
            Fill(_) => Self::Fill,
        }
    }
}

impl Widget for &App {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let [
            header_area,
            instructions_area,
            swap_legend_area,
            _,
            blocks_area,
        ] = area.layout(&Layout::vertical([
            Length(2), // header
            Length(2), // instructions
            Length(1), // swap key legend
            Length(1), // gap
            Fill(1),   // blocks
        ]));

        App:
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2801** (2026-09-28): **build(deps): bump rand from 0.10.2 to 0.10.3**
  *Symptoms*: Bumps [rand](https://github.com/rust-random/rand) from 0.10.2 to 0.10.3. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/rust-random/rand/blob/master/CHANGELOG.md">rand's changelog</a>.</em></p> <blockquote> <h2>[0.10.3] — 2026-09-20</h2> <h3>Fixes</h3> <ul> <li>Fix <code>WeightedIndex</code> panic when the sum of float weights is infinite; return <code>Error::Overflow</code> instead (<a href="https://redirect.github.com/rust-random/rand/issues/1808">#1808</a>)</li> <li>Fix spurious <code>Error::NonFinite</code> from <code>Uniform::new_inclusive</code> on large finite float ranges such as <code>0.0..=f64::MAX</code> (<a href="https://redirect.github.com/rust-random/rand/issues/1821">#1821</a>)</li> <li>Fix possible panic due to sampling a deserialized <code>Uniform&lt;char&gt;</code> (<a href="https://redirect.github.com/rust-random/rand/issues/1831">#1831</a>)</li> </ul> <h3>Changes</h3> <ul> <li>Report exact remaining lengths from <code>WeightedIndex::weights()</code> and reduce overhead when reading weights (<a href="https://redirect.github.com/rust-random/rand/issues/1838">#1838</a>)</li> </ul> <p><a href="https://redirect.github.com/rust-random/rand/issues/1808">#1808</a>: <a href="https://redirect.github.com/rust-random/rand/pull/1808">rust-random/rand#1808</a> <a href="https://redirect.github.com/rust-random/rand/issues/1821">#1821</a>: <a href="https://redirect.github.com/rust-random/rand/pull/1821">rust-random/rand#1821</a> <a h

- **Issue #2800** (2026-09-28): **build(deps): bump thiserror from 2.0.20 to 2.0.21**
  *Symptoms*: Bumps [thiserror](https://github.com/dtolnay/thiserror) from 2.0.20 to 2.0.21. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/dtolnay/thiserror/releases">thiserror's releases</a>.</em></p> <blockquote> <h2>2.0.21</h2> <ul> <li>Fix parsing of generic unit variants in display expressions (<a href="https://redirect.github.com/dtolnay/thiserror/issues/459">#459</a>)</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/dtolnay/thiserror/commit/b1827ee06f81a7d7f954e676771e19a97f9f8e3b"><code>b1827ee</code></a> Release 2.0.21</li> <li><a href="https://github.com/dtolnay/thiserror/commit/58037b575a2a5543d0d54a49360554325b49f55a"><code>58037b5</code></a> Merge pull request <a href="https://redirect.github.com/dtolnay/thiserror/issues/459">#459</a> from dtolnay/turbofish</li> <li><a href="https://github.com/dtolnay/thiserror/commit/f82a0cf8f06c71263c2caa26e759f337d2778153"><code>f82a0cf</code></a> Keep track of nested turbofish depth</li> <li><a href="https://github.com/dtolnay/thiserror/commit/72ea49262d6412ccbc08f1696dda8626409e657d"><code>72ea492</code></a> Raise required compiler to Rust 1.77</li> <li><a href="https://github.com/dtolnay/thiserror/commit/72eea0d4ddb17ff9fa873aa74469de850021b22e"><code>72eea0d</code></a> Resolve io_other_error clippy lint in tests</li> <li><a href="https://github.com/dtolnay/thiserror/commit/07f09a2ec934df58508ce4fa5e7fbf27cca552c2"><code>07f09a2</cod

- **Issue #2799** (2026-09-28): **build(deps): bump instability from 0.3.13 to 0.3.14**
  *Symptoms*: Bumps [instability](https://github.com/ratatui/instability) from 0.3.13 to 0.3.14. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/ratatui/instability/releases">instability's releases</a>.</em></p> <blockquote> <h2>instability-example-v0.3.14</h2> <h3>Other</h3> <ul> <li>Add #[allow(unused_imports)] lint to unstable reexports (<a href="https://redirect.github.com/ratatui/instability/pull/21">#21</a>)</li> </ul> <h2>instability-v0.3.14</h2> <h3>Other</h3> <ul> <li>Remove unnecessary build script (<a href="https://redirect.github.com/ratatui/instability/pull/39">#39</a>)</li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/ratatui/instability/blob/main/CHANGELOG.md">instability's changelog</a>.</em></p> <blockquote> <h2><a href="https://github.com/ratatui/instability/compare/instability-v0.3.13...instability-v0.3.14">0.3.14</a> - 2026-09-22</h2> <h3>Other</h3> <ul> <li>Remove unnecessary build script (<a href="https://redirect.github.com/ratatui/instability/pull/39">#39</a>)</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/ratatui/instability/commit/20792849479a9cee6eea53b031f0230cdf64eee1"><code>2079284</code></a> chore: release v0.3.14 (<a href="https://redirect.github.com/ratatui/instability/issues/40">#40</a>)</li> <li><a href="https://github.com/ratatui/instability/commit/850dde21492030a1eabc425d95555e

- **Issue #2798** (2026-09-28): **build(deps): bump crate-ci/typos from 1.50.2 to 1.50.3**
  *Symptoms*: Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.50.2 to 1.50.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/crate-ci/typos/releases">crate-ci/typos's releases</a>.</em></p> <blockquote> <h2>v1.50.3</h2> <h2>[1.50.3] - 2026-09-25</h2> <h3>Fixes</h3> <ul> <li>Don'y panicwhen case-converting non-ASCII corrections</li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/crate-ci/typos/blob/main/CHANGELOG.md">crate-ci/typos's changelog</a>.</em></p> <blockquote> <h1>Change Log</h1> <p>All notable changes to this project will be documented in this file.</p> <p>The format is based on <a href="https://keepachangelog.com/">Keep a Changelog</a> and this project adheres to <a href="https://semver.org/">Semantic Versioning</a>.</p> <!-- raw HTML omitted --> <h2>[Unreleased] - ReleaseDate</h2> <h2>[1.50.3] - 2026-09-25</h2> <h3>Fixes</h3> <ul> <li>Don'y panicwhen case-converting non-ASCII corrections</li> </ul> <h2>[1.50.2] - 2026-09-15</h2> <h3>Fixes</h3> <ul> <li>Don't panic when files being examined are removed</li> </ul> <h2>[1.50.1] - 2026-09-01</h2> <h3>Fixes</h3> <ul> <li>Don't correct <code>asend</code> in Python code</li> </ul> <h2>[1.50.0] - 2026-08-28</h2> <h3>Features</h3> <ul> <li>Updated the dictionary with the <a href="https://redirect.github.com/crate-ci/typos/issues/1587">August 2026</a> changes</li> </ul> <h2>[1.49.1] - 2026-08-27</h2> <h3>Fix

- **Issue #2797** (2026-09-28): **build(deps): bump lru from 0.18.4 to 0.18.5**
  *Symptoms*: Bumps [lru](https://github.com/jeromefroe/lru-rs) from 0.18.4 to 0.18.5. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/jeromefroe/lru-rs/blob/master/CHANGELOG.md">lru's changelog</a>.</em></p> <blockquote> <h2><a href="https://github.com/jeromefroe/lru-rs/tree/0.18.5">v0.18.5</a> - 2026-09-22</h2> <ul> <li>Specify desired hashbrown features to reduce dependencies.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/jeromefroe/lru-rs/commit/f1e972197053a6814e77b77afacb51f03fc03170"><code>f1e9721</code></a> Merge pull request <a href="https://redirect.github.com/jeromefroe/lru-rs/issues/248">#248</a> from jeromefroe/jerome/prepare-0-18-5-release</li> <li><a href="https://github.com/jeromefroe/lru-rs/commit/4592b1c733ea1c9c8ae4dfab943637b74d49851d"><code>4592b1c</code></a> Prepare 0.18.5 release</li> <li><a href="https://github.com/jeromefroe/lru-rs/commit/c5efdfd592db9171898f23a45989459a19b7d2b7"><code>c5efdfd</code></a> Merge pull request <a href="https://redirect.github.com/jeromefroe/lru-rs/issues/247">#247</a> from brunowonka/hashbrown-deps</li> <li><a href="https://github.com/jeromefroe/lru-rs/commit/02bd23f5c870062472bd9d7d821c854b324a1547"><code>02bd23f</code></a> Specify desired hashbrown features</li> <li>See full diff in <a href="https://github.com/jeromefroe/lru-rs/compare/0.18.4...0.18.5">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score

- **Issue #2796** (2026-09-28): **build(deps): bump release-plz/action from 0.5.138 to 0.5.139**
  *Symptoms*: Bumps [release-plz/action](https://github.com/release-plz/action) from 0.5.138 to 0.5.139. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/release-plz/action/releases">release-plz/action's releases</a>.</em></p> <blockquote> <h2>v0.5.139</h2> <h2>What's Changed</h2> <ul> <li>chore(deps): update dependency taiki-e/install-action to v2.87.14 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/release-plz/action/pull/536">release-plz/action#536</a></li> <li>chore(deps): update dependency taiki-e/install-action to v2.87.15 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/release-plz/action/pull/537">release-plz/action#537</a></li> <li>chore(deps): update dependency taiki-e/install-action to v2.87.16 by <a href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in <a href="https://redirect.github.com/release-plz/action/pull/538">release-plz/action#538</a></li> <li>Update to 0.3.169 by <a href="https://github.com/marcoieni"><code>@​marcoieni</code></a> in <a href="https://redirect.github.com/release-plz/action/pull/540">release-plz/action#540</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/release-plz/action/compare/v0.5.138...v0.5.139">https://github.com/release-plz/action/compare/v0.5.138...v0.5.139</a></p> </blockquote> </details> <details> <summary>Commits</summary> <u

- **Issue #2793** (2026-09-24): **Docs issue**
  *Symptoms*: #[derive(Debug, Default)] pub struct App {     counter: u8,     exit: bool, }  Hi, something small, in the docs, the counter suggests a u8, I propose switching to a signed counter, since when you hit 0 and go to the negative, it crashes
  **Post-Mortem & Fix Analysis**:
  > Hey, is this in the examples? Or the tutorial?  Feel free to submit a PR :)
  > https://ratatui.rs/tutorials/counter-app/basic-app/  > Normally your application should avoid panicking, but we’re leaving an overflow bug in here so we can show how to handle errors in the next section. A real app might use saturating_sub and saturating_add to avoid panics like this.
  > oh, great, thanks

- **Issue #2792** (2026-09-23): **swap color-eyre for eyre as dependancy**
  *Symptoms*: ## Problem  <!-- A clear and concise description of what the problem is. Ex. I'm always frustrated when [...] --> Apologies if this is the wrong section to file this under.  I noticed that color-eyre has been archived, and now lives in the eyre monorepo as stated [here](https://github.com/eyre-rs/color-eyre#color-eyre)   Would it not be better to swap it out for eyre and replace where needed?  ## Solution Swap out color-eyre for eyre, maintaining api compatibility. Happy to open a PR if this is something that's needed.  <!-- A clear and concise description of what you want to happen. Things to consider: - backward compatibility - ease of use of the API (https://rust-lang.github.io/api-guidelines/) - consistency with the rest of the crate -->  ## Alternatives  <!-- A clear and concise description of any alternative solutions or features you've considered. -->  ## Are you willing to contribute an implementation? <!-- If you would like to work on this, check one of the boxes below. Maintainers can help refine the scope and discuss approach. -->  - [x] I am willing to open a PR implementing this. - [ ] I can try to implement it, but I will need guidance. - [ ] I am not able to implement this right now.  ## Additional context  <!-- Add any other context or screenshots about the feature request here. --> 
  **Post-Mortem & Fix Analysis**:
  > To the best of my knowledge, the color-eyre crate is still in play and not deprecated, it's just the repo that moved (poly-repo to mono-repo). So I think there's nothing to change here. Do you have some difference of understanding on this?  If there's links to the old repo https://github.com/eyre-rs/color-eyre, then they should be fixed (PR welcome on this).
  >  You're right, I misread the archived repo as the crate being deprecated. It's just moved into the eyre monorepo, and color-eyre adds the colored report/panic hook that plain eyre doesn't have, so there's nothing to swap. I also checked for links to the old repo and didn't find any. Closing, thanks!

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

### Incident Patch 1: `7023d4f2` (2026-09-20)
**Commit Message**: fix(example): handle calendar exit keys (#2639)

<!-- Please read CONTRIBUTING.md before submitting any pull request. -->

---------

Co-authored-by: Josh McKinney <joshka@users.noreply.github.com>

**File**: `ratatui-widgets/examples/calendar.rs` (modified, +7/-4)
```diff
@@ -15,7 +15,7 @@
 //! [examples readme]: https://github.com/ratatui/ratatui/blob/main/examples/README.md
 
 use color_eyre::Result;
-use crossterm::event;
+use crossterm::event::{self, KeyCode};
 use ratatui::Frame;
 use ratatui::layout::{Constraint, Layout, Rect};
 use ratatui::style::{Color, Modifier, Style, Stylize};
@@ -29,8 +29,11 @@ fn main() -> Result<()> {
     ratatui::run(|terminal| {
         loop {
             terminal.draw(render)?;
-            if event::read()?.is_key_press() {
-                break Ok(());
+            if let Some(key) = event::read()?.as_key_press_event() {
+                match key.code {
+                    KeyCode::Char('q') | KeyCode::Esc => break Ok(()),
+                    _ => {}
+                }
             }
         }
     })
@@ -45,7 +48,7 @@ fn render(frame: &mut Frame) {
 
     let title = Line::from_iter([
         Span::from("Calendar Widget").bold(),
-        Span::from(" (Press 'q' to quit)"),
+        Span::from(" (Press 'q' or Esc to quit)"),
     ]);
     frame.render_widget(title.centered(), top);
 
```

---

### Incident Patch 2: `8eab17be` (2026-09-19)
**Commit Message**: docs: fix RELEASE.md references to nonexistent cd.yml (#2782)

Fixes #2781

Co-authored-by: hikmetba-bit <hikmetba-bit@users.noreply.github.com>
Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>

**File**: `RELEASE.md` (modified, +13/-27)
```diff
@@ -7,8 +7,10 @@ Our release strategy is:
 >
 > Versioning scheme being `0.x.y`, where `x` is the major version and `y` is the minor version.
 
-[crates.io](https://crates.io/crates/ratatui) releases are automated via [GitHub
-actions](.github/workflows/cd.yml) and triggered by pushing a tag.
+[crates.io](https://crates.io/crates/ratatui) releases are automated by
+[release-plz](https://release-plz.dev/), configured in
+[release-plz.toml](./release-plz.toml) and run by the
+[Release-plz](https://github.com/ratatui/ratatui/actions/workflows/release-plz.yml) workflow.
 
 1. Record a new demo gif if necessary. The preferred tool for this is
 [vhs](https://github.com/charmbracelet/vhs) (installation instructions in README).
@@ -23,29 +25,13 @@ actions](.github/workflows/cd.yml) and triggered by pushing a tag.
    append `?raw=true` to redirect to the actual image url. Then update the link in the main README.
    Avoid adding the gif to the git repo as binary files tend to bloat repositories.
 
-1. Bump the version in [Cargo.toml](Cargo.toml).
-1. Ensure [CHANGELOG.md](CHANGELOG.md) is updated. [git-cliff](https://github.com/orhun/git-cliff)
-   can be used for generating the entries.
 1. Ensure that any breaking changes are documented in [BREAKING-CHANGES.md](./BREAKING-CHANGES.md)
-1. Commit and push the changes.
-1. Create a new tag: `git tag -a v[0.x.y]`
-1. Push the tag: `git push --tags`
-1. Wait for [Continuous Deployment](https://github.com/ratatui/ratatui/actions) workflow to
-   finish.
-
-## Alpha Releases
-
-Alpha releases are automatically released every Saturday via [cd.yml](./.github/workflows/cd.yml)
-and can be manually created when necessary by triggering the [Continuous
-Deployment](https://github.com/ratatui/ratatui/actions/workflows/cd.yml) workflow.
-
-We automatically release an alpha release with a patch level bump + alpha.num weekly (and when we
-need to manually). E.g. the last release was 0.22.0, and the most recent alpha release is
-0.22.1-alpha.1.
-
-These releases will have whatever happened to be in main at the time of release, so they're useful
-for apps that need to get releases from crates.io, but may contain more bugs and be generally less
-tested than normal releases.
-
-See [#147](https://github.com/ratatui/ratatui/issues/147) and
-[#359](https://github.com/ratatui/ratatui/pull/359) for more info on the alpha release process.
+1. Commit and push the changes to `main`.
+1. On every push to `main`, release-plz opens (or updates) a release PR that bumps the version in
+   [Cargo.toml](Cargo.toml) and updates [CHANGELOG.md](CHANGELOG.md) (generated via
+   [git-cliff](https://github.com/orhun/git-cliff), configured in [cliff.toml](./cliff.toml)).
+1. Merging that release PR into `main` triggers the release job: it tags the release (e.g.
+   `ratatui-v0.30.2`), publishes to [crates.io](https://crates.io/crates/ratatui), and creates a
+   GitHub Release. Watch the [Release-plz
+   workflow](https://github.com/ratatui/ratatui/actions/workflows/release-plz.yml) run to
+   completion.
```

---

### Incident Patch 3: `ad2e79e6` (2026-09-18)
**Commit Message**: fix(rect): empty Rect never intersects (#2766)

Ensure rectangles with zero width or height never intersect other rectangles, keeping intersects consistent with intersection and `is_empty`.

**File**: `ratatui-core/src/layout/rect.rs` (modified, +28/-1)
```diff
@@ -333,8 +333,13 @@ impl Rect {
     }
 
     /// Returns true if the two `Rect`s intersect.
+    ///
+    /// An empty `Rect` covers no cells, so it never intersects, not even with itself. This matches
+    /// [`Rect::intersection`], which returns an empty `Rect` for the same pair.
     pub const fn intersects(self, other: Self) -> bool {
-        self.x < other.right()
+        !self.is_empty()
+            && !other.is_empty()
+            && self.x < other.right()
             && self.right() > other.x
             && self.y < other.bottom()
             && self.bottom() > other.y
@@ -845,6 +850,28 @@ mod tests {
         assert!(!Rect::new(1, 2, 3, 4).intersects(Rect::new(5, 6, 7, 8)));
     }
 
+    /// An empty `Rect` covers no cells, so it cannot intersect anything.
+    #[rstest]
+    #[case::empty_inside(Rect::new(0, 0, 10, 10), Rect::new(5, 5, 0, 0))]
+    #[case::zero_height(Rect::new(0, 0, 1, 2), Rect::new(0, 1, 1, 0))]
+    #[case::zero_width(Rect::new(0, 0, 2, 1), Rect::new(1, 0, 0, 1))]
+    #[case::both_empty(Rect::new(3, 3, 0, 0), Rect::new(3, 3, 0, 0))]
+    fn intersects_empty(#[case] rect0: Rect, #[case] rect1: Rect) {
+        assert!(!rect0.intersects(rect1));
+        assert!(!rect1.intersects(rect0));
+        assert!(rect0.intersection(rect1).is_empty());
+    }
+
+    /// A one cell `Rect` is not empty, so it still intersects.
+    #[rstest]
+    #[case::single_cell_inside(Rect::new(0, 0, 10, 10), Rect::new(5, 5, 1, 1))]
+    #[case::single_cell_overlap(Rect::new(1, 2, 1, 1), Rect::new(1, 2, 1, 1))]
+    fn intersects_single_cell(#[case] rect0: Rect, #[case] rect1: Rect) {
+        assert!(rect0.intersects(rect1));
+        assert!(rect1.intersects(rect0));
+        assert!(!rect0.intersection(rect1).is_empty());
+    }
+
     #[rstest]
     #[case::corner(Rect::new(0, 0, 10, 10), Rect::new(10, 10, 20, 20))]
     #[case::edge(Rect::new(0, 0, 10, 10), Rect::new(10, 0, 20, 10))]
```

---

### Incident Patch 4: `e02e2a62` (2026-09-13)
**Commit Message**: fix(examples): use fallback colors in the gauge example without truecolor (#2756)

<!-- Please read CONTRIBUTING.md before submitting any pull request. -->

Part of #1972, taking the `gauge` example off @ffex's list.

## The problem

`examples/apps/gauge` sets its colors as consts from the tailwind
palette, which resolve to 24-bit RGB:

```rust
const GAUGE1_COLOR: Color = tailwind::RED.c800;
```

On terminals without truecolor support, notably Apple Terminal.app
before build 465, those render badly.

## The change

Resolve the colors once at startup through a `Theme`, choosing 4-bit or
indexed equivalents when truecolor is unavailable. This is the same
shape merged for the `flex` example in #2211, including the
`is_true_color_supported()` check, so the two examples stay consistent.

## Verification

Forced the detection both ways and printed the resolved palette:

```
TERM_PROGRAM=iTerm.app
  true_color_supported=true
  gauge1=Rgb(153, 27, 27)  gauge2=Rgb(22, 101, 52)  gauge3=Rgb(30, 64, 175)
  gauge4=Rgb(154, 52, 18)  label=Rgb(226, 232, 240)

TERM_PROGRAM=Apple_Terminal TERM_PROGRAM_VERSION=464
  true_color_supported=false
  gauge1=Red  gauge2=Green  gauge3=Blue  gauge4=Indexed(2

**File**: `examples/apps/gauge/src/main.rs` (modified, +69/-13)
```diff
@@ -5,6 +5,7 @@
 /// release.
 ///
 /// [`latest`]: https://github.com/ratatui/ratatui/tree/latest
+use std::sync::LazyLock;
 use std::time::Duration;
 
 use color_eyre::Result;
@@ -17,11 +18,10 @@ use ratatui::style::{Color, Style, Stylize};
 use ratatui::text::{Line, Span};
 use ratatui::widgets::{Block, Borders, Gauge, Padding, Paragraph, Widget};
 
-const GAUGE1_COLOR: Color = tailwind::RED.c800;
-const GAUGE2_COLOR: Color = tailwind::GREEN.c800;
-const GAUGE3_COLOR: Color = tailwind::BLUE.c800;
-const GAUGE4_COLOR: Color = tailwind::ORANGE.c800;
-const CUSTOM_LABEL_COLOR: Color = tailwind::SLATE.c200;
+// Colors are resolved once at startup. On terminals that don't support 24-bit color
+// (e.g. Apple Terminal.app before build 465) the truecolor tailwind palette looks bad,
+// so we fall back to 4-bit/indexed colors. See issue #1972.
+static THEME: LazyLock<Theme> = LazyLock::new(Theme::new);
 
 #[derive(Debug, Default, Clone, Copy)]
 struct App {
@@ -122,14 +122,14 @@ fn render_header(area: Rect, buf: &mut Buffer) {
     Paragraph::new("Ratatui Gauge Example")
         .bold()
         .alignment(Alignment::Center)
-        .fg(CUSTOM_LABEL_COLOR)
+        .fg(THEME.custom_label)
         .render(area, buf);
 }
 
 fn render_footer(area: Rect, buf: &mut Buffer) {
     Paragraph::new("Press ENTER to start")
         .alignment(Alignment::Center)
-        .fg(CUSTOM_LABEL_COLOR)
+        .fg(THEME.custom_label)
         .bold()
         .render(area, buf);
 }
@@ -139,7 +139,7 @@ impl App {
         let title = title_block("Gauge with percentage");
         Gauge::default()
             .block(title)
-            .gauge_style(GAUGE1_COLOR)
+            .gauge_style(THEME.gauge1)
             .percent(self.progress1)
             .render(area, buf);
     }
@@ -148,11 +148,11 @@ impl App {
         let title = title_block("Gauge with ratio and custom label");
         let label = Span::styled(
             format!("{:.1}/100", self.progress2),
-            Style::new().italic().bold().fg(CUSTOM_LABEL_COLOR),
+            Style::new().italic().bold().fg(THEME.custom_label),
         );
         Gauge::default()
             .block(title)
-            .gauge_style(GAUGE2_COLOR)
+            .gauge_style(THEME.gauge2)
             .ratio(self.progress2 / 100.0)
             .label(label)
             .render(area, buf);
@@ -163,7 +163,7 @@ impl App {
         let label = format!("{:.1}%", self.progress3);
         Gauge::default()
             .block(title)
-            .gauge_style(GAUGE3_COLOR)
+            .gauge_style(THEME.gauge3)
             .ratio(self.progress3 / 100.0)
             .label(label)
             .render(area, buf);
@@ -174,7 +174,7 @@ impl App {
         let label = format!("{:.1}%", self.progress3);
         Gauge::default()
             .block(title)
-            .gauge_style(GAUGE4_COLOR)
+            .gauge_style(THEME.gauge4)
             .ratio(self.progress4 / 100.0)
             .label(label)
             .use_unicode(true)
@@ -188,5 +188,61 @@ fn title_block(title: &str) -> Block<'_> {
         .borders(Borders::NONE)
         .padding(Padding::vertical(1))
         .title(title)
-        .fg(CUSTOM_LABEL_COLOR)
+        .fg(THEME.custom_label)
+}
+
+#[derive(Debug, Clone, Copy, Eq, PartialEq)]
+struct Theme {
+    gauge1: Color,
+    gauge2: Color,
+    gauge3: Color,
+    gauge4: Color,
+    custom_label: Color,
+}
+
+impl Theme {
+    fn new() -> Self {
+        use tailwind::{BLUE, GREEN, ORANGE, RED, SLATE};
+
+        let is_true_color = Self::is_true_color_supported();
+        let color = |true_color, ansi_color| {
+            if is_true_color {
+                true_color
+            } else {
+                ansi_color
+            }
+        };
+
+        // The fallbacks are 4-bit/indexed colors chosen to read reasonably on
+        // pre-truecolor terminals. Tune these on a real pre-Tahoe Terminal.app.
+        Self {
+            gauge1: color(RED.c800, Color::Red),
+            ga
```

---

### Incident Patch 5: `a1a90d9d` (2026-09-04)
**Commit Message**: fix(fill): reject empty symbols (#2736)

Empty symbols create zero-width cells that can disrupt terminal
rendering.
Reject them in `Fill::new` and `Fill::symbol` with a clear panic
message,
while keeping `Fill::default()` safe to render as a no-op.

fixes #2730

**File**: `ratatui-widgets/src/fill.rs` (modified, +36/-3)
```diff
@@ -59,10 +59,16 @@ impl<'a> Fill<'a> {
     /// The style defaults to [`Style::default`]; use the [`Stylize`] shorthands or
     /// [`Fill::style`] to customize it.
     ///
+    /// # Panics
+    ///
+    /// Panics if `symbol` is empty.
+    ///
     /// [`Stylize`]: ratatui_core::style::Stylize
     pub fn new<S: Into<Cow<'a, str>>>(symbol: S) -> Self {
+        let symbol = symbol.into();
+        assert!(!symbol.is_empty(), "Fill symbol must not be empty");
         Self {
-            symbol: symbol.into(),
+            symbol,
             style: Style::default(),
         }
     }
@@ -82,10 +88,16 @@ impl<'a> Fill<'a> {
 
     /// Set the symbol painted into each cell.
     ///
+    /// # Panics
+    ///
+    /// Panics if `symbol` is empty.
+    ///
     /// This is a fluent setter method which must be chained or used as it consumes self
     #[must_use = "method moves the value of self and returns the modified value"]
     pub fn symbol<S: Into<Cow<'a, str>>>(mut self, symbol: S) -> Self {
-        self.symbol = symbol.into();
+        let symbol = symbol.into();
+        assert!(!symbol.is_empty(), "Fill symbol must not be empty");
+        self.symbol = symbol;
         self
     }
 }
@@ -99,7 +111,7 @@ impl Widget for Fill<'_> {
 impl Widget for &Fill<'_> {
     fn render(self, area: Rect, buf: &mut Buffer) {
         let area = area.intersection(*buf.area());
-        if area.is_empty() {
+        if area.is_empty() || self.symbol.is_empty() {
             return;
         }
         for position in area.positions() {
@@ -209,4 +221,25 @@ mod tests {
             .render(Rect::new(0, 0, 2, 1), &mut buffer);
         assert_eq!(buffer, Buffer::with_lines(["bb"]));
     }
+
+    #[test]
+    #[should_panic(expected = "Fill symbol must not be empty")]
+    fn new_panics_on_empty_symbol() {
+        Fill::new("");
+    }
+
+    #[test]
+    #[should_panic(expected = "Fill symbol must not be empty")]
+    fn symbol_panics_on_empty_symbol() {
+        let _ = Fill::new("x").symbol("");
+    }
+
+    #[test]
+    fn default_is_noop() {
+        let mut buffer = Buffer::with_lines(["xxxxx"]);
+        Fill::default()
+            .red()
+            .render(Rect::new(1, 0, 3, 1), &mut buffer);
+        assert_eq!(buffer, Buffer::with_lines(["xxxxx"]));
+    }
 }
```

---

### Incident Patch 6: `b45e20c1` (2026-09-04)
**Commit Message**: fix(terminal)!: don't clear the whole screen when an inline viewport shrinks horizontally (#2670)

`Terminal::resize` clears the entire screen when the terminal shrinks
horizontally. For inline viewports, this also clears rows written by
`insert_before`, even though the viewport does not own those rows and cannot
repaint them. On terminals that move erased content into scrollback, this can
also produce duplicated copies of the live viewport during repeated resizes.

Horizontal shrinking now results in:

- Fullscreen: one full clear
- Inline: a clear from the viewport origin downward
- Fixed: one full clear

BREAKING CHANGE: Inline viewports no longer clear rows above their origin when
shrinking horizontally. Applications that relied on `Terminal::resize` to
clear the entire terminal must now do so explicitly.

Fixes #2666

---------

Co-authored-by: easyinplay <4202001+easyinplay@users.noreply.github.com>
Co-authored-by: Orhun Parmaksız <orhunparmaksiz@gmail.com>

**File**: `ratatui-core/src/terminal/resize.rs` (modified, +80/-11)
```diff
@@ -6,8 +6,8 @@ use crate::terminal::{Terminal, Viewport};
 impl<B: Backend> Terminal<B> {
     /// Updates the Terminal so that internal buffers match the requested area.
     ///
-    /// This updates the buffer size used for rendering and triggers a full clear so the next
-    /// [`Terminal::draw`] / [`Terminal::try_draw`] paints into a consistent area.
+    /// This updates the buffer size used for rendering and clears the affected viewport so the
+    /// next [`Terminal::draw`] / [`Terminal::try_draw`] paints into a consistent area.
     ///
     /// When the viewport is [`Viewport::Inline`], the `area` argument is treated as the new
     /// terminal size and the viewport origin is recomputed relative to the current cursor position.
@@ -38,12 +38,25 @@ impl<B: Backend> Terminal<B> {
             Viewport::Fixed(_) | Viewport::Fullscreen => (area, None),
         };
 
-        // clear screen on horizontal shrink to avoid line wrapping issues
+        // Clear the screen on horizontal shrink to avoid line wrapping issues.
+        //
+        // Inline viewports are excluded: an inline viewport only owns the rows
+        // from its origin down. The rows above it were written by
+        // `insert_before`, which keeps no copy of them, so the application can
+        // never repaint them. A full-screen erase either destroys that output
+        // or, on terminals that move erased content into scrollback (Windows
+        // Terminal, conhost), pushes a copy of the viewport into scrollback on
+        // every resize event. The `clear_viewport` call below already erases
+        // from the recomputed origin to the bottom of the screen, which covers
+        // every row the inline viewport can legitimately own.
         if next_area.width < self.viewport_area.width {
-            next_area.y = 0;
-            // `clear_viewport` below already clears everything for `Fullscreen`.
-            if !matches!(self.viewport, Viewport::Fullscreen) {
-                self.backend.clear_region(ClearType::All)?;
+            match self.viewport {
+                Viewport::Inline(_) => {}
+                Viewport::Fullscreen => next_area.y = 0,
+                Viewport::Fixed(_) => {
+                    next_area.y = 0;
+                    self.backend.clear_region(ClearType::All)?;
+                }
             }
         }
 
@@ -94,6 +107,7 @@ mod tests {
     use crate::backend::{Backend, ClearType, TestBackend, WindowSize};
     use crate::buffer::Buffer;
     use crate::layout::{Position, Rect, Size};
+    use crate::style::Style;
     use crate::terminal::{Terminal, TerminalOptions, Viewport};
 
     #[derive(Debug, Default)]
@@ -183,7 +197,7 @@ mod tests {
     #[case::fullscreen(Viewport::Fullscreen, &[ClearType::All])]
     #[case::inline(
         Viewport::Inline(5),
-        &[ClearType::All, ClearType::AfterCursor]
+        &[ClearType::AfterCursor]
     )]
     #[case::fixed(
         Viewport::Fixed(Rect::new(0, 0, 80, 24)),
@@ -412,11 +426,66 @@ mod tests {
         );
     }
 
+    // An inline viewport does not own the rows above its origin: they were
+    // written by `insert_before`, which keeps no copy of them, so the
+    // application cannot repaint them. A horizontal shrink must not erase them.
+    #[test]
+    fn resize_inline_horizontal_shrink_keeps_rows_above_the_viewport() {
+        let mut backend = TestBackend::new(6, 4);
+        backend
+            .set_cursor_position(Position { x: 0, y: 0 })
+            .unwrap();
+        let mut terminal = Terminal::with_options(
+            backend,
+            TerminalOptions {
+                viewport: Viewport::Inline(1),
+            },
+        )
+        .unwrap();
+
+        for text in ["one", "two"] {
+            terminal
+                .insert_before(1, |buf| {
+                    buf.set_string(0, 0, text, Style::default());
+                })
+                .unwrap();
+        }
+        terminal
+            .draw(|frame| {
```

---

### Incident Patch 7: `67019321` (2026-09-03)
**Commit Message**: fix(core): prevent rendering artifacts around VS16 graphemes (#2686)

Terminals do not always agree with Ratatui about the width of grapheme
clusters containing VS16. As a result, incremental updates can overwrite the
emoji, leave characters from the previous frame behind, or shift later text
on the row.

Handle these clusters conservatively:

- update their reserved trailing cells before repainting the leading cell;,
- repaint the cluster after those updates so it cannot be cleared again,
- stop predicting the cursor position after writing the cluster, forcing the
  next update to move to its exact coordinates.

This ordering works whether the terminal advances by one or two columns:

    update trailing cells -> repaint VS16 cluster -> move before next update

Add regression coverage for both terminal-width behaviors, including the
scrolling case where wrapped ASCII rows previously left characters between
emoji.


---------

Co-authored-by: Orhun Parmaksız <orhunparmaksiz@gmail.com>

**File**: `ratatui-core/src/buffer/diff.rs` (modified, +257/-29)
```diff
@@ -17,10 +17,7 @@ pub struct BufferDiff<'prev, 'next> {
     area: Rect,
     /// Current position in the flat cell array.
     pos: usize,
-    /// Tracks trailing cells that must be yielded around a wide character update.
-    ///
-    /// Set before repainting a wide glyph after a visible style change, after replacing a wide
-    /// glyph with narrower content, or when a VS16 emoji needs its trailing column checked.
+    /// Tracks trailing cells and a leading cell that may be deferred until after they are cleared.
     trailing: Option<TrailingState>,
 }
 
@@ -33,11 +30,10 @@ struct TrailingState {
     /// wide character's style was visible on blank cells, so the terminal may show stale style
     /// there and every trailing cell must be refreshed.
     ///
-    /// When `false` (VS16 path), only cells whose symbol changed are emitted, because the emoji
-    /// visually covers its trailing column and style differences there are invisible.
+    /// When `false`, only cells whose symbol changed are emitted.
     force: bool,
-    /// A cell to yield once the trailing range is exhausted.
-    deferred: Option<usize>,
+    /// Leading cell to repaint after its trailing cells have been processed.
+    deferred_leading_cell: Option<usize>,
 }
 
 /// Modifiers that are visually apparent on a blank (space) cell.
@@ -99,7 +95,7 @@ impl<'next> Iterator for BufferDiff<'_, 'next> {
             next_index,
             end,
             force,
-            deferred,
+            deferred_leading_cell,
         }) = &mut self.trailing
         {
             while *next_index < *end {
@@ -118,12 +114,11 @@ impl<'next> Iterator for BufferDiff<'_, 'next> {
                 }
             }
 
-            // Done with trailing cells; resume past the wide character, repainting its leading
-            // cell first when the trailing cells were a pre-clear.
+            // Resume after the wide glyph, repainting its deferred leading cell first.
             self.pos = *end;
-            let deferred = deferred.take();
+            let deferred_leading_cell = deferred_leading_cell.take();
             self.trailing = None;
-            if let Some(i) = deferred {
+            if let Some(i) = deferred_leading_cell {
                 let (x, y) = self.pos_of(i);
                 return Some((x, y, &self.next[i]));
             }
@@ -149,12 +144,6 @@ impl<'next> Iterator for BufferDiff<'_, 'next> {
                     }
                 }
                 CellDiffOption::None | CellDiffOption::AlwaysUpdate => {
-                    // If the current cell is multi-width, ensure the trailing cells are
-                    // explicitly cleared when they previously contained non-blank content.
-                    // Some terminals do not reliably clear the trailing cell(s) when printing
-                    // a wide grapheme, which can result in visual artifacts (e.g., leftover
-                    // characters). Emitting an explicit update for the trailing cells avoids
-                    // this.
                     let cell_width = current.cell_width() as usize;
                     if matches!(current.diff_option, CellDiffOption::None) && current == previous {
                         // Equal cells still need to account for multi-width skip.
@@ -177,38 +166,38 @@ impl<'next> Iterator for BufferDiff<'_, 'next> {
                             next_index: i + 1,
                             end: (i + cell_width).min(len),
                             force: true,
-                            deferred: Some(i),
+                            deferred_leading_cell: Some(i),
                         });
                         return self.next();
                     }
 
-                    // Work around terminals that fail to clear the trailing cell of certain
-                    // emoji presentation sequences (those containing VS16 / U+FE0F).
-                    // Only emit explicit clears for such sequences to avoid bloating diff
```

**File**: `ratatui-crossterm/src/lib.rs` (modified, +7/-3)
```diff
@@ -246,7 +246,10 @@ where
             if !matches!(last, Some((p, w)) if p.x.checked_add(w) == Some(x) && y == p.y) {
                 queue!(self.writer, MoveTo(x, y))?;
             }
-            last = Some((Position { x, y }, cell.cell_width()));
+            let width = cell.cell_width();
+            // A VS16 cluster's terminal cursor advance is not reliably predictable.
+            let uncertain_width = width > 1 && cell.symbol().chars().any(|c| c == '\u{FE0F}');
+            last = (!uncertain_width).then_some((Position { x, y }, width));
             if cell.modifier != modifier {
                 let diff = ModifierDiff {
                     from: modifier,
@@ -879,11 +882,12 @@ mod tests {
         let updates: Vec<_> = prev.diff(&next).into_iter().collect();
         assert_eq!(
             updates.iter().map(|(x, _, _)| *x).collect::<Vec<_>>(),
-            [0, 1, 2, 3]
+            [1, 0, 2, 3]
         );
         let output = draw_to_string(&updates);
         assert!(output.contains(&MoveTo(1, 0).to_string()));
-        assert!(!output.contains(&MoveTo(2, 0).to_string()));
+        assert!(output.contains(&MoveTo(0, 0).to_string()));
+        assert!(output.contains(&MoveTo(2, 0).to_string()));
         assert!(!output.contains(&MoveTo(3, 0).to_string()));
     }
 
```

**File**: `ratatui-termina/src/lib.rs` (modified, +18/-1)
```diff
@@ -155,7 +155,10 @@ where
                 let command = Csi::Cursor(cursor_position(Position { x, y })?);
                 write!(string, "{command}").unwrap();
             }
-            last = Some((Position { x, y }, cell.cell_width()));
+            let width = cell.cell_width();
+            // A VS16 cluster's terminal cursor advance is not reliably predictable.
+            let uncertain_width = width > 1 && cell.symbol().chars().any(|c| c == '\u{FE0F}');
+            last = (!uncertain_width).then_some((Position { x, y }, width));
 
             let mut attributes = SgrAttributes::default();
             if cell.fg != fg {
@@ -799,6 +802,20 @@ mod tests {
         assert!(!output.contains(&cursor.to_string()));
     }
 
+    #[test]
+    fn moves_cursor_after_uncertain_width_symbol() {
+        let mut backend = backend();
+        let wide = Cell::new("\u{2764}\u{FE0F}"); // ❤️
+        let next = Cell::new("a");
+        let content = [(0, 0, &wide), (2, 0, &next)];
+
+        backend.draw(content.into_iter()).unwrap();
+
+        let output = backend.terminal.output();
+        let cursor = Csi::Cursor(cursor_position(Position::new(2, 0)).unwrap());
+        assert!(output.contains(&cursor.to_string()));
+    }
+
     #[test]
     fn moves_cursor_when_previous_width_overflows() {
         let mut backend = backend();
```

**File**: `ratatui-termion/src/lib.rs` (modified, +12/-1)
```diff
@@ -237,7 +237,10 @@ where
             if !matches!(last, Some((p, w)) if p.x.checked_add(w) == Some(x) && y == p.y) {
                 write!(string, "{}", termion::cursor::Goto(x + 1, y + 1)).unwrap();
             }
-            last = Some((Position { x, y }, cell.cell_width()));
+            let width = cell.cell_width();
+            // A VS16 cluster's terminal cursor advance is not reliably predictable.
+            let uncertain_width = width > 1 && cell.symbol().chars().any(|c| c == '\u{FE0F}');
+            last = (!uncertain_width).then_some((Position { x, y }, width));
             if cell.modifier != modifier {
                 write!(
                     string,
@@ -622,6 +625,14 @@ mod tests {
         assert!(!output.contains(&termion::cursor::Goto(3, 1).to_string()));
     }
 
+    #[test]
+    fn draw_moves_cursor_after_uncertain_width_symbol() {
+        let wide = Cell::new("\u{2764}\u{FE0F}"); // ❤️
+        let next = Cell::new("a");
+        let output = draw_to_string(&[(0, 0, &wide), (2, 0, &next)]);
+        assert!(output.contains(&termion::cursor::Goto(3, 1).to_string()));
+    }
+
     #[test]
     fn draw_moves_cursor_when_previous_width_overflows() {
         let mut forced = Cell::new("a");
```

---

### Incident Patch 8: `7babd829` (2026-09-03)
**Commit Message**: fix(buffer): clear trailing cells before wide glyph repaint (#2743)

A wide glyph occupies multiple terminal cells, but its style is stored only
on the leading buffer cell. When only that style changed, the trailing
terminal cell could retain its previous background or modifiers.

    before:  [ wide glyph ][ stale style ]

Writing the trailing cell after the glyph could overwrite part of it.
Instead, clear the trailing cell first and defer repainting the glyph:

    update:  [ clear trailing cell ] -> [ repaint wide glyph ]

Fixes #2652


---------

Co-authored-by: Orhun Parmaksız <orhunparmaksiz@gmail.com>
Co-authored-by: Orhun Parmaksız <orhun@archlinux.org>

**File**: `ratatui-core/src/buffer/diff.rs` (modified, +95/-9)
```diff
@@ -17,14 +17,14 @@ pub struct BufferDiff<'prev, 'next> {
     area: Rect,
     /// Current position in the flat cell array.
     pos: usize,
-    /// Tracks trailing cells that must be yielded after a wide character is processed.
+    /// Tracks trailing cells that must be yielded around a wide character update.
     ///
-    /// Set when a wide char was replaced by narrower content (force=true) or when a VS16 emoji
-    /// needs its trailing column checked (force=false).
+    /// Set before repainting a wide glyph after a visible style change, after replacing a wide
+    /// glyph with narrower content, or when a VS16 emoji needs its trailing column checked.
     trailing: Option<TrailingState>,
 }
 
-/// Tracks pending trailing-cell yields when a wide character is followed by narrower content.
+/// Tracks pending trailing-cell yields for a wide character update.
 #[derive(Debug)]
 struct TrailingState {
     next_index: usize,
@@ -36,6 +36,8 @@ struct TrailingState {
     /// When `false` (VS16 path), only cells whose symbol changed are emitted, because the emoji
     /// visually covers its trailing column and style differences there are invisible.
     force: bool,
+    /// A cell to yield once the trailing range is exhausted.
+    deferred: Option<usize>,
 }
 
 /// Modifiers that are visually apparent on a blank (space) cell.
@@ -97,6 +99,7 @@ impl<'next> Iterator for BufferDiff<'_, 'next> {
             next_index,
             end,
             force,
+            deferred,
         }) = &mut self.trailing
         {
             while *next_index < *end {
@@ -115,9 +118,15 @@ impl<'next> Iterator for BufferDiff<'_, 'next> {
                 }
             }
 
-            // Done with trailing cells; resume main loop past the wide character.
+            // Done with trailing cells; resume past the wide character, repainting its leading
+            // cell first when the trailing cells were a pre-clear.
             self.pos = *end;
+            let deferred = deferred.take();
             self.trailing = None;
+            if let Some(i) = deferred {
+                let (x, y) = self.pos_of(i);
+                return Some((x, y, &self.next[i]));
+            }
         }
         while self.pos < len {
             let i = self.pos;
@@ -154,6 +163,24 @@ impl<'next> Iterator for BufferDiff<'_, 'next> {
                     }
 
                     let previous_width = previous.cell_width() as usize;
+                    let previous_style_is_visible_on_blank = previous.bg != Color::Reset
+                        || previous.modifier.intersects(VISIBLE_ON_BLANK);
+
+                    // Clear stale styles from an unchanged wide glyph's trailing cells before
+                    // repainting it.
+                    if cell_width > 1
+                        && current.symbol() == previous.symbol()
+                        && current.style() != previous.style()
+                        && previous_style_is_visible_on_blank
+                    {
+                        self.trailing = Some(TrailingState {
+                            next_index: i + 1,
+                            end: (i + cell_width).min(len),
+                            force: true,
+                            deferred: Some(i),
+                        });
+                        return self.next();
+                    }
 
                     // Work around terminals that fail to clear the trailing cell of certain
                     // emoji presentation sequences (those containing VS16 / U+FE0F).
@@ -168,13 +195,11 @@ impl<'next> Iterator for BufferDiff<'_, 'next> {
                             next_index: i + 1,
                             end: trailing_end,
                             force: false,
+                            deferred: None,
                         });
                     } else if cell_width > 1 {
                         self.pos += cell_width.saturating_sub(1);
-                    } else if previous_width 
```

**File**: `ratatui-crossterm/src/lib.rs` (modified, +37/-0)
```diff
@@ -887,6 +887,43 @@ mod tests {
         assert!(!output.contains(&MoveTo(3, 0).to_string()));
     }
 
+    #[test]
+    fn draw_clears_trailing_cell_before_repainting_styled_wide_glyph() {
+        let area = Rect::new(0, 0, 3, 1);
+        let mut prev = Buffer::empty(area);
+        prev.set_string(
+            0,
+            0,
+            "한",
+            Style::new()
+                .fg(Color::Red)
+                .add_modifier(Modifier::UNDERLINED),
+        );
+
+        let mut next = Buffer::empty(area);
+        next.set_string(0, 0, "한", Style::default());
+
+        let updates: Vec<_> = prev.diff(&next).into_iter().collect();
+        assert_eq!(
+            updates
+                .iter()
+                .map(|(x, y, cell)| (*x, *y, cell.symbol()))
+                .collect::<Vec<_>>(),
+            [(1, 0, " "), (0, 0, "한")]
+        );
+
+        let output = draw_to_string(&updates);
+        let clear = output.find(&MoveTo(1, 0).to_string()).unwrap();
+        let repaint = output.find(&MoveTo(0, 0).to_string()).unwrap();
+        let cleared_cell = output.find(' ').unwrap();
+        let repainted_glyph = output.find('한').unwrap();
+
+        assert!(
+            clear < cleared_cell && cleared_cell < repaint && repaint < repainted_glyph,
+            "trailing cell must be cleared before repainting the glyph: {output:?}"
+        );
+    }
+
     #[test]
     fn draw_skips_cursor_move_after_wide_symbol_when_contiguous() {
         // The cell right after a wide glyph's trailing column is where the cursor already is.
```

---

### Incident Patch 9: `7c6b8259` (2026-08-27)
**Commit Message**: docs: fix broken links to examples (#2737)

**File**: `ratatui-core/src/backend.rs` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@
 //! [Termion]: https://crates.io/crates/termion
 //! [Termina]: https://crates.io/crates/termina
 //! [Termwiz]: https://crates.io/crates/termwiz
-//! [Examples]: https://github.com/ratatui/ratatui/tree/main/ratatui/examples/README.md
+//! [Examples]: https://github.com/ratatui/ratatui/tree/main/examples/README.md
 //! [Backend Comparison]: https://ratatui.rs/concepts/backends/comparison/
 //! [Ratatui Website]: https://ratatui.rs
 
```

**File**: `ratatui-crossterm/src/lib.rs` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ use ratatui_core::style::{Color, Modifier, Style};
 /// [`Terminal`]: https://docs.rs/ratatui/latest/ratatui/struct.Terminal.html
 /// [`backend`]: ratatui_core::backend
 /// [Crossterm]: https://crates.io/crates/crossterm
-/// [Examples]: https://github.com/ratatui/ratatui/tree/main/ratatui/examples/README.md
+/// [Examples]: https://github.com/ratatui/ratatui/tree/main/examples/README.md
 #[derive(Debug, Default, Clone, Eq, PartialEq, Hash)]
 pub struct CrosstermBackend<W: Write> {
     /// The writer used to send commands to the terminal.
```

**File**: `ratatui-termwiz/src/lib.rs` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ use termwiz::terminal::{ScreenSize, SystemTerminal, Terminal};
 /// [`Terminal`]: https://docs.rs/ratatui/latest/ratatui/struct.Terminal.html
 /// [`BufferedTerminal`]: termwiz::terminal::buffered::BufferedTerminal
 /// [Termwiz]: https://crates.io/crates/termwiz
-/// [Examples]: https://github.com/ratatui/ratatui/tree/main/ratatui/examples/README.md
+/// [Examples]: https://github.com/ratatui/ratatui/tree/main/examples/README.md
 pub struct TermwizBackend {
     buffered_terminal: BufferedTerminal<SystemTerminal>,
 }
```

**File**: `ratatui/src/lib.rs` (modified, +1/-1)
```diff
@@ -405,7 +405,7 @@
 //! [Styling Text]: https://ratatui.rs/recipes/render/style-text/
 //! [Styling Recipes]: https://ratatui.rs/recipes/render/
 //! [templates]: https://github.com/ratatui/templates/
-//! [Examples]: https://github.com/ratatui/ratatui/tree/main/ratatui/examples/README.md
+//! [Examples]: https://github.com/ratatui/ratatui/tree/main/examples/README.md
 //! [Report a bug]: https://github.com/ratatui/ratatui/issues/new?labels=bug&projects=&template=bug_report.md
 //! [Request a Feature]: https://github.com/ratatui/ratatui/issues/new?labels=enhancement&projects=&template=feature_request.md
 //! [Create a Pull Request]: https://github.com/ratatui/ratatui/compare
```

---

### Incident Patch 10: `a1b0b9ca` (2026-08-24)
**Commit Message**: fix(backend): avoid overflow when tracking cursor position (#2735)

follow up to #2721

Use checked arithmetic when tracking the expected terminal cursor
position, preventing u16 overflow for cells with large widths.

**File**: `ratatui-crossterm/src/lib.rs` (modified, +10/-1)
```diff
@@ -243,7 +243,7 @@ where
         for (x, y, cell) in content {
             // Move the cursor unless it already sits at (x, y), i.e. this cell directly follows
             // the previous one on the same row, accounting for the width of what was printed.
-            if !matches!(last, Some((p, w)) if x == p.x + w && y == p.y) {
+            if !matches!(last, Some((p, w)) if p.x.checked_add(w) == Some(x) && y == p.y) {
                 queue!(self.writer, MoveTo(x, y))?;
             }
             last = Some((Position { x, y }, cell.cell_width()));
@@ -857,6 +857,15 @@ mod tests {
         assert!(output.contains(&MoveTo(1, 0).to_string()));
     }
 
+    #[test]
+    fn draw_moves_cursor_when_previous_width_overflows() {
+        let mut forced = Cell::new("a");
+        forced.set_diff_option(CellDiffOption::ForcedWidth(NonZeroU16::MAX));
+        let next = Cell::new("b");
+        let output = draw_to_string(&[(1, 0, &forced), (0, 0, &next)]);
+        assert!(output.contains(&MoveTo(0, 0).to_string()));
+    }
+
     #[test]
     fn draw_moves_cursor_after_wide_symbol_from_buffer_diff() {
         // End-to-end version of the report in #2651: the diff emits the trailing cell of a
```

**File**: `ratatui-termina/src/lib.rs` (modified, +18/-2)
```diff
@@ -151,7 +151,7 @@ where
         for (x, y, cell) in content {
             // Move the cursor unless it already sits at (x, y), i.e. this cell directly follows
             // the previous one on the same row, accounting for the width of what was printed.
-            if !matches!(last, Some((p, w)) if x == p.x + w && y == p.y) {
+            if !matches!(last, Some((p, w)) if p.x.checked_add(w) == Some(x) && y == p.y) {
                 let command = Csi::Cursor(cursor_position(Position { x, y })?);
                 write!(string, "{command}").unwrap();
             }
@@ -525,9 +525,10 @@ where
 
 #[cfg(test)]
 mod tests {
+    use std::num::NonZeroU16;
     use std::time::Duration;
 
-    use ratatui_core::buffer::Cell;
+    use ratatui_core::buffer::{Cell, CellDiffOption};
     use termina::EventReader;
     use termina::escape::csi::Csi;
 
@@ -798,6 +799,21 @@ mod tests {
         assert!(!output.contains(&cursor.to_string()));
     }
 
+    #[test]
+    fn moves_cursor_when_previous_width_overflows() {
+        let mut backend = backend();
+        let mut forced = Cell::new("a");
+        forced.set_diff_option(CellDiffOption::ForcedWidth(NonZeroU16::MAX));
+        let next = Cell::new("b");
+        let content = [(1, 0, &forced), (0, 0, &next)];
+
+        backend.draw(content.into_iter()).unwrap();
+
+        let output = backend.terminal.output();
+        let cursor = Csi::Cursor(cursor_position(Position::new(0, 0)).unwrap());
+        assert!(output.contains(&cursor.to_string()));
+    }
+
     #[test]
     fn converts_ratatui_colors_to_termina_colors() {
         assert_eq!(Color::Reset.into_termina(), ColorSpec::Reset);
```

**File**: `ratatui-termion/src/lib.rs` (modified, +14/-1)
```diff
@@ -234,7 +234,7 @@ where
         for (x, y, cell) in content {
             // Move the cursor unless it already sits at (x, y), i.e. this cell directly follows
             // the previous one on the same row, accounting for the width of what was printed.
-            if !matches!(last, Some((p, w)) if x == p.x + w && y == p.y) {
+            if !matches!(last, Some((p, w)) if p.x.checked_add(w) == Some(x) && y == p.y) {
                 write!(string, "{}", termion::cursor::Goto(x + 1, y + 1)).unwrap();
             }
             last = Some((Position { x, y }, cell.cell_width()));
@@ -577,6 +577,10 @@ impl fmt::Display for ResetRegion {
 
 #[cfg(test)]
 mod tests {
+    use std::num::NonZeroU16;
+
+    use ratatui_core::buffer::CellDiffOption;
+
     use super::*;
 
     /// Renders `content` and returns the emitted bytes as a lossy string.
@@ -618,6 +622,15 @@ mod tests {
         assert!(!output.contains(&termion::cursor::Goto(3, 1).to_string()));
     }
 
+    #[test]
+    fn draw_moves_cursor_when_previous_width_overflows() {
+        let mut forced = Cell::new("a");
+        forced.set_diff_option(CellDiffOption::ForcedWidth(NonZeroU16::MAX));
+        let next = Cell::new("b");
+        let output = draw_to_string(&[(1, 0, &forced), (0, 0, &next)]);
+        assert!(output.contains(&termion::cursor::Goto(1, 1).to_string()));
+    }
+
     #[test]
     fn save_and_restore_cursor_position_write_escape_sequences() {
         let mut backend = TermionBackend::new(Vec::new());
```

#### Recent Merged Pull Requests:
- **PR #2801** (2026-09-28): build(deps): bump rand from 0.10.2 to 0.10.3 (@dependabot[bot])
- **PR #2800** (2026-09-28): build(deps): bump thiserror from 2.0.20 to 2.0.21 (@dependabot[bot])
- **PR #2799** (2026-09-28): build(deps): bump instability from 0.3.13 to 0.3.14 (@dependabot[bot])
- **PR #2798** (2026-09-28): build(deps): bump crate-ci/typos from 1.50.2 to 1.50.3 (@dependabot[bot])
- **PR #2797** (2026-09-28): build(deps): bump lru from 0.18.4 to 0.18.5 (@dependabot[bot])
- **PR #2796** (2026-09-28): build(deps): bump release-plz/action from 0.5.138 to 0.5.139 (@dependabot[bot])
- **PR #2789** (2026-09-23): build(deps): bump release-plz/action from 0.5.136 to 0.5.138 (@dependabot[bot])
- **PR #2788** (closed): build(deps): bump taiki-e/install-action from 2.84.0 to 2.87.15 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
