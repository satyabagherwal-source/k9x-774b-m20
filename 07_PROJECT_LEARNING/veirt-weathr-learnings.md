# Forensic Learning Record (Deep Inspection): Veirt/weathr

> **Canonical Artifact**: `07_PROJECT_LEARNING/veirt-weathr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Veirt/weathr](https://github.com/Veirt/weathr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:11.279Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Veirt/weathr`
- **Description**: a terminal weather app with ascii animation
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 3067 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app_state.rs`
```
use crate::config::LocationDisplay;
use crate::weather::{
    WeatherCondition, WeatherConditions, WeatherData, WeatherLocation, WeatherUnits,
    format_precipitation, format_temperature, format_wind_speed,
};
use std::time::Instant;

pub struct AppState {
    pub current_weather: Option<WeatherData>,
    pub is_offline: bool,
    pub weather_conditions: WeatherConditions,
    pub loading_state: LoadingState,
    pub cached_weather_info: String,
    pub weather_info_needs_update: bool,
    pub location: WeatherLocation,
    pub city_name: Option<String>,
    pub location_display: LocationDisplay,
    pub hide_location: bool,
    pub units: WeatherUnits,
}

impl AppState {
    pub fn new(
        location: WeatherLocation,
        city_name: Option<String>,
        location_display: LocationDisplay,
        hide_location: bool,
        units: WeatherUnits,
    ) -> Self {
        Self {
            current_weather: None,
            is_offline: false,
            weather_conditions: WeatherConditions::default(),
            loading_state: LoadingState::new(),
            cached_weather_info: String::new(),
            weather_info_needs_update: true,
            location,
            city_name,
            location_display,
            hide_location,
            units,
        }
    }

    pub fn update_weather(&mut self, weather: WeatherData) {
        self.weather_conditions.is_thunderstorm = weather.condition.is_thunderstorm();
        self.weather_conditions.is_snowing = weather.condition.is_snowing();
        self.weather_conditions.is_raining =
            weather.condition.is_raining() && !self.weather_conditions.is_thunderstorm;
        self.weather_conditions.is_cloudy = weather.condition.is_cloudy();
        self.weather_conditions.is_foggy = weather.condition.is_foggy();
        self.weather_conditions.sun = weather.sun;

        self.current_weather = Some(weather);
        self.is_offline = false;
        self.weather_info_needs_update = true;
    }

    pub fn set_offline_mode(&mut self, offline: bool) {
        self.is_offline = offline;
        self.weather_info_needs_update = true;
    }

    pub fn update_loading_animation(&mut self) {
        if self.loading_state.should_update() {
            self.loading_state.next_frame();
            self.weather_info_needs_update = true;
        }
    }

    pub fn get_condition_text(&self) -> &str {
        if let Some(ref weather) = self.current_weather {
            match weather.condition {
                WeatherCondition::Clear => "Clear",
                WeatherCondition::Cloudy => "Cloudy",
                WeatherCondition::PartlyCloudy => "Partly Cloudy",
                WeatherCondition::Overcast => "Overcast",
                WeatherCondition::Fog => "Fog",
                WeatherCondition::Drizzle => "Drizzle",
                WeatherCondition::FreezingRain => "Freezing Rain",
                WeatherCondition::Rain => "Rain",
                WeatherCondition::Snow => "Snow",
                WeatherCondition::SnowGrains => "Snow Grains",
                WeatherCondition::RainShowers => "Rain Showers",
                WeatherCondition::SnowShowers => "Snow Showers",
                WeatherCondition::Thunderstorm => "Thunderstorm",
                WeatherCondition::ThunderstormHail => "Thunderstorm with Hail",
            }
        } else {
            "Loading"
        }
    }

    pub fn update_cached_info(&mut self) {
        if !self.weather_info_needs_update {
            return;
        }

        let location_str = if self.hide_location {
            String::new()
        } else {
            let (lat_value, lat_dir) = if self.location.latitude >= 0.0 {
                (self.location.latitude, "N")
            } else {
                (-self.location.latitude, "S")
            };
            let (lon_value, lon_dir) = if self.location.longitude >= 0.0 {
                (self.location.longitude, "E")
            } else {
                (-self.location.longitude, "W")
            };
            let coords = format!("{:.2}°{}, {:.2}°{}", lat_value, lat_dir, lon_value, lon_dir);
            let label = match self.location_display {
                LocationDisplay::Coordinates => coords,
                LocationDisplay::City => match &self.city_name {
                    Some(city) => city.clone(),
                    None => coords,
                },
                LocationDisplay::Mixed => match &self.city_name {
                    Some(city) => format!("{} ({})", city, coords),
                    None => coords,
                },
            };
            format!(" | Location: {}", label)
        };

        self.cached_weather_info = if let Some(ref weather) = self.current_weather {
            let (temp, temp_unit) = format_temperature(weather.temperature, self.units.temperature);
            let (wind, wind_unit) = format_wind_speed(weather.wind_speed, self.units.wind_speed);
            let (precip, precip_unit) =
                format_precipitation(weather.precipitation, self.units.precipitation);

            let offline_indicator = if self.is_offline { "OFFLINE | " } else { "" };

            format!(
                "{}Weather: {} | Temp: {:.1}{} | Wind: {:.1}{} | Precip: {:.1}{}{} | Press 'q' to quit",
                offline_indicator,
                self.get_condition_text(),
                temp,
                temp_unit,
                wind,
                wind_unit,
                precip,
                precip_unit,
                location_str
            )
        } else {
            format!("Weather: Loading... {}", self.loading_state.current_char())
        };

        self.weather_info_needs_update = false;
    }

    pub fn should_show_sun(&self) -> bool {
        if !self.weather_conditions.sun.is_day {
            return false;
        }

        if let Some(ref weather) = self.current_weather {
            matches!(
                weather.condition,
                WeatherCondition::Clear | WeatherCondition::PartlyCloudy | WeatherCondition::Cloudy
            )
        } else {
            false
        }
    }

    pub fn should_show_fireflies(&self) -> bool {
        if self.weather_conditions.sun.is_day {
            return false;
        }

        if let Some(ref weather) = self.current_weather {
            let is_warm = weather.temperature > 15.0;
            let is_clear_night = matches!(
                weather.condition,
                WeatherCondition::Clear | WeatherCondition::PartlyCloudy
            );
            is_warm
                && is_clear_night
                && !self.weather_conditions.is_raining
                && !self.weather_conditions.is_thunderstorm
                && !self.weather_conditions.is_snowing
        } else {
            false
        }
    }
}

pub struct LoadingState {
    pub frame: usize,
    pub last_update: Instant,
    pub loading_chars: [char; 4],
}

impl LoadingState {
    pub fn new() -> Self {
        Self {
            frame: 0,
            last_update: Instant::now(),
            loading_chars: ['|', '/', '-', '\\'],
        }
    }

    pub fn should_update(&self) -> bool {
        self.last_update.elapsed() >= std::time::Duration::from_millis(100)
    }

    pub fn next_frame(&mut self) {
        self.frame = (self.frame + 1) % self.loading_chars.len();
        self.last_update = Instant::now();
    }

    pub fn current_char(&self) -> char {
        self.loading_chars[self.frame]
    }
}

impl Default for LoadingState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::LocationDisplay;
    use crate::weather::types::{
        CelestialEvents, PrecipitationUnit, TemperatureUnit, WindSpeedUnit,
    };

    fn create_app_state(lat: f64, lon: f64) -> AppState {
        create_app_state_full(lat, lon, None, LocationDisplay::Coordinates)
    }

    fn create_app_state_full(
        lat: f64,
        lon: f64,
        city: Option<String>,
        display: LocationDisplay,
    ) -> AppState {
        let location = WeatherLocation {
            latitude: lat,
            longitude: lon,
            elevation: None,
        };
        let units = WeatherUnits {
            temperature: TemperatureUnit::Celsius,
            wind_speed: WindSpeedUnit::Kmh,
            precipitation: PrecipitationUnit::Mm,
        };
        let mut app = AppState::new(location, city, display, false, units);

        let weather = WeatherData {
            condition: WeatherCondition::Clear,
            temperature: 20.0,
            precipitation: 0.0,
            wind_speed: 10.0,
            wind_direction: 0.0,
            moon_phase: Some(0.5),
            timestamp: "2024-01-01T12:00:00Z".to_string(),
            attribution: "".to_string(),
            sun: CelestialEvents::from_bool(true),
        };
        app.update_weather(weather);

        app
    }

    #[test]
    fn test_new_york_coordinates() {
        // New York: 40.7128°N, 74.0060°W (positive lat, negative lon)
        let mut app = create_app_state(40.7128, -74.0060);
        app.update_cached_info();

        println!("NYC: {}", app.cached_weather_info);
        assert!(app.cached_weather_info.contains("40.71°N"));
        assert!(app.cached_weather_info.contains("74.01°W"));
    }

    #[test]
    fn test_sydney_coordinates() {
        // Sydney: 33.8688°S, 151.2093°E (negative lat, positive lon)
        let mut app = create_app_state(-33.8688, 151.2093);
        app.update_cached_info();

        println!("Sydney: {}", app.cached_weather_info);
        assert!(app.cached_weather_info.contains("33.87°S"));
        assert!(app.cached_weather_info.contains("151.21°E"));
    }

    #[test]
    fn test_london_coordinates() {
        // London: 51.5074°N, 0.1278°W (positive lat, negative lon near 0)
        let mut app = create_app_state(51.5074, -0.1278);
        app.update_cached_info();

        println!("London: {}", app.cac
```

### Core Architecture Module: `src/render/capabilities.rs`
```
use crossterm::style::Color;
use std::env;
use std::io::IsTerminal;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorSupport {
    None,
    Basic,
    Ansi256,
    TrueColor,
}

#[derive(Debug, Clone)]
pub struct TerminalCapabilities {
    pub color_support: ColorSupport,
    #[allow(dead_code)]
    pub is_tty: bool,
}

impl TerminalCapabilities {
    pub fn detect() -> Self {
        let is_tty = std::io::stdout().is_terminal();

        if env::var("NO_COLOR").is_ok() {
            return Self {
                color_support: ColorSupport::None,
                is_tty,
            };
        }

        if env::var("TERM").is_ok_and(|term| term == "dumb") {
            return Self {
                color_support: ColorSupport::None,
                is_tty,
            };
        }

        if !is_tty {
            return Self {
                color_support: ColorSupport::None,
                is_tty,
            };
        }

        let color_support = if let Ok(colorterm) = env::var("COLORTERM") {
            if colorterm == "truecolor" || colorterm == "24bit" {
                ColorSupport::TrueColor
            } else {
                check_term_for_256()
            }
        } else {
            check_term_for_256()
        };

        Self {
            color_support,
            is_tty,
        }
    }

    pub fn adjust_color(&self, color: Color) -> Color {
        if self.color_support == ColorSupport::None {
            return Color::Reset;
        }

        match self.color_support {
            ColorSupport::None => Color::Reset,
            ColorSupport::Basic => match color {
                Color::Rgb { .. } => Color::White,
                _ => color,
            },
            ColorSupport::Ansi256 => color,
            ColorSupport::TrueColor => color,
        }
    }
}

fn check_term_for_256() -> ColorSupport {
    if env::var("TERM").is_ok_and(|term| term.contains("256color")) {
        return ColorSupport::Ansi256;
    }
    ColorSupport::Basic
}

#[cfg(test)]
mod tests {
    use super::*;
    use crossterm::style::Color;

    #[test]
    fn test_adjust_color_none() {
        let caps = TerminalCapabilities {
            color_support: ColorSupport::None,
            is_tty: true,
        };
        assert_eq!(caps.adjust_color(Color::Red), Color::Reset);
        assert_eq!(
            caps.adjust_color(Color::Rgb { r: 255, g: 0, b: 0 }),
            Color::Reset
        );
    }

    #[test]
    fn test_adjust_color_basic() {
        let caps = TerminalCapabilities {
            color_support: ColorSupport::Basic,
            is_tty: true,
        };
        assert_eq!(caps.adjust_color(Color::Red), Color::Red);
        assert_eq!(
            caps.adjust_color(Color::Rgb { r: 255, g: 0, b: 0 }),
            Color::White
        );
    }

    #[test]
    fn test_adjust_color_ansi256() {
        let caps = TerminalCapabilities {
            color_support: ColorSupport::Ansi256,
            is_tty: true,
        };
        assert_eq!(caps.adjust_color(Color::Red), Color::Red);
        let rgb = Color::Rgb { r: 255, g: 0, b: 0 };
        assert_eq!(caps.adjust_color(rgb), rgb);
    }

    #[test]
    fn test_adjust_color_truecolor() {
        let caps = TerminalCapabilities {
            color_support: ColorSupport::TrueColor,
            is_tty: true,
        };
        assert_eq!(caps.adjust_color(Color::Red), Color::Red);
        let rgb = Color::Rgb { r: 255, g: 0, b: 0 };
        assert_eq!(caps.adjust_color(rgb), rgb);
    }
}

```

### Core Architecture Module: `src/render/mod.rs`
```
mod capabilities;

use crate::error::TerminalError;
use capabilities::TerminalCapabilities;
use crossterm::{
    cursor, execute, queue,
    style::{Color, Print, ResetColor, SetForegroundColor},
    terminal::{self, Clear, ClearType, EnterAlternateScreen, LeaveAlternateScreen},
};
use std::io::{self, BufWriter, IsTerminal, Stdout, Write};

const MIN_TERMINAL_WIDTH: u16 = 70;
const MIN_TERMINAL_HEIGHT: u16 = 20;

const MAX_TERMINAL_WIDTH: u16 = 1000;
const MAX_TERMINAL_HEIGHT: u16 = 500;

fn clamp_terminal_size(width: u16, height: u16) -> (u16, u16) {
    (
        width.min(MAX_TERMINAL_WIDTH),
        height.min(MAX_TERMINAL_HEIGHT),
    )
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct Cell {
    character: char,
    color: Color,
}

impl Default for Cell {
    fn default() -> Self {
        Self {
            character: ' ',
            color: Color::Reset,
        }
    }
}

pub struct TerminalRenderer {
    stdout: BufWriter<Stdout>,
    width: u16,
    height: u16,
    buffer: Vec<Cell>,
    last_buffer: Vec<Cell>,
    capabilities: TerminalCapabilities,
}

impl TerminalRenderer {
    pub fn new() -> Result<Self, TerminalError> {
        if !io::stdout().is_terminal() {
            return Err(TerminalError::NotATty);
        }

        let (width, height) = terminal::size().map_err(TerminalError::SizeError)?;

        if width < MIN_TERMINAL_WIDTH || height < MIN_TERMINAL_HEIGHT {
            return Err(TerminalError::TooSmall {
                width,
                height,
                min_width: MIN_TERMINAL_WIDTH,
                min_height: MIN_TERMINAL_HEIGHT,
            });
        }

        let (width, height) = clamp_terminal_size(width, height);

        let stdout = BufWriter::new(io::stdout());
        let buffer_size = (width as usize) * (height as usize);
        let capabilities = TerminalCapabilities::detect();

        Ok(Self {
            stdout,
            width,
            height,
            buffer: vec![Cell::default(); buffer_size],
            last_buffer: vec![Cell::default(); buffer_size],
            capabilities,
        })
    }

    pub fn init(&mut self) -> Result<(), TerminalError> {
        terminal::enable_raw_mode().map_err(TerminalError::RawModeError)?;
        execute!(self.stdout, EnterAlternateScreen, cursor::Hide)
            .map_err(TerminalError::InitError)?;
        Ok(())
    }

    pub fn cleanup(&mut self) -> io::Result<()> {
        execute!(self.stdout, LeaveAlternateScreen, cursor::Show, ResetColor)?;
        terminal::disable_raw_mode()?;
        Ok(())
    }

    pub fn manual_resize(&mut self, width: u16, height: u16) -> io::Result<()> {
        let (width, height) = clamp_terminal_size(width, height);
        if width != self.width || height != self.height {
            self.width = width;
            self.height = height;
            let buffer_size = (width as usize) * (height as usize);
            self.buffer = vec![Cell::default(); buffer_size];
            self.last_buffer = vec![Cell::default(); buffer_size];
            execute!(self.stdout, Clear(ClearType::All))?;
        }
        Ok(())
    }

    pub fn get_size(&self) -> (u16, u16) {
        (self.width, self.height)
    }

    pub fn clear(&mut self) -> io::Result<()> {
        self.buffer.fill(Cell::default());
        Ok(())
    }

    pub fn render_centered_colored(
        &mut self,
        lines: &[String],
        start_row: u16,
        color: Color,
    ) -> io::Result<()> {
        let max_width = lines.iter().map(|l| l.len()).max().unwrap_or(0);
        let start_col = if self.width as usize > max_width {
            (self.width as usize - max_width) / 2
        } else {
            0
        };
        let adjusted_color = self.capabilities.adjust_color(color);

        for (idx, line) in lines.iter().enumerate() {
            let row = start_row + idx as u16;
            if row < self.height {
                for (char_idx, ch) in line.chars().enumerate() {
                    let col = start_col as u16 + char_idx as u16;
                    if col < self.width {
                        let buffer_idx = (row as usize) * (self.width as usize) + (col as usize);
                        if buffer_idx < self.buffer.len() {
                            self.buffer[buffer_idx] = Cell {
                                character: ch,
                                color: adjusted_color,
                            };
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub fn render_line_colored(
        &mut self,
        x: u16,
        y: u16,
        text: &str,
        color: Color,
    ) -> io::Result<()> {
        if y >= self.height {
            return Ok(());
        }
        let adjusted_color = self.capabilities.adjust_color(color);

        for (idx, ch) in text.chars().enumerate() {
            let col = x + idx as u16;
            if col < self.width {
                let buffer_idx = (y as usize) * (self.width as usize) + (col as usize);
                if buffer_idx < self.buffer.len() {
                    self.buffer[buffer_idx] = Cell {
                        character: ch,
                        color: adjusted_color,
                    };
                }
            }
        }
        Ok(())
    }

    pub fn render_char(&mut self, x: u16, y: u16, ch: char, color: Color) -> io::Result<()> {
        if x < self.width && y < self.height {
            let buffer_idx = (y as usize) * (self.width as usize) + (x as usize);
            if buffer_idx < self.buffer.len() {
                self.buffer[buffer_idx] = Cell {
                    character: ch,
                    color: self.capabilities.adjust_color(color),
                };
            }
        }
        Ok(())
    }

    pub fn flash_screen(&mut self) -> io::Result<()> {
        let flash_color = self.capabilities.adjust_color(Color::White);
        for cell in &mut self.buffer {
            cell.color = flash_color;
        }
        Ok(())
    }

    pub fn flush(&mut self) -> io::Result<()> {
        let mut current_color = Color::Reset;
        let mut last_pos: Option<(u16, u16)> = None;

        for y in 0..self.height {
            for x in 0..self.width {
                let idx = (y as usize) * (self.width as usize) + (x as usize);

                if idx >= self.buffer.len() || idx >= self.last_buffer.len() {
                    continue;
                }

                let cell = self.buffer[idx];
                let last_cell = self.last_buffer[idx];

                if cell != last_cell {
                    let expected_pos = last_pos.map(|(lx, ly)| (lx + 1, ly));
                    if expected_pos != Some((x, y)) {
                        queue!(self.stdout, cursor::MoveTo(x, y))?;
                    }

                    if cell.color != current_color {
                        queue!(self.stdout, SetForegroundColor(cell.color))?;
                        current_color = cell.color;
                    }

                    queue!(self.stdout, Print(cell.character))?;
                    last_pos = Some((x, y));
                }
            }
        }

        if current_color != Color::Reset {
            queue!(self.stdout, ResetColor)?;
        }

        self.stdout.flush()?;
        self.last_buffer.copy_from_slice(&self.buffer);
        Ok(())
    }
}

impl Drop for TerminalRenderer {
    fn drop(&mut self) {
        let _ = self.cleanup();
    }
}

```

### Core Architecture Module: `src/animation/airplanes.rs`
```
use crate::animation::{AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize};
use crate::render::TerminalRenderer;
use crossterm::style::Color;

use rand::{Rng, RngExt};
use std::io;

#[derive(Clone)]
struct Airplane {
    x: f32,
    y: f32,
    speed: f32,
}

pub struct AirplaneSystem {
    planes: Vec<Airplane>,
    terminal_width: u16,
    terminal_height: u16,
    spawn_cooldown: u16,
}

impl AirplaneSystem {
    pub fn new(terminal_width: u16, terminal_height: u16) -> Self {
        Self {
            planes: Vec::with_capacity(2),
            terminal_width,
            terminal_height,
            spawn_cooldown: 0,
        }
    }

    pub fn update(
        &mut self,
        terminal_width: u16,
        terminal_height: u16,
        rng: &mut (impl Rng + ?Sized),
    ) {
        self.terminal_width = terminal_width;
        self.terminal_height = terminal_height;

        for plane in &mut self.planes {
            plane.x += plane.speed;
        }

        self.planes.retain(|p| p.x < terminal_width as f32);

        self.spawn_cooldown = self.spawn_cooldown.saturating_sub(1);
        if self.spawn_cooldown == 0 && rng.random::<f32>() < 0.001 {
            self.spawn_plane(rng);
            self.spawn_cooldown = 600 + (rng.random::<u16>() % 300);
        }
    }

    fn spawn_plane(&mut self, rng: &mut (impl Rng + ?Sized)) {
        let spawn_band = (self.terminal_height / 4).max(1);
        let y = (rng.random::<u16>() % spawn_band) as f32;
        let speed = 0.3 + (rng.random::<f32>() * 0.2);

        self.planes.push(Airplane { x: 0.0, y, speed });
    }

    pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
        const AIRPLANE_ART: &str = include_str!("assets/airplane.txt");

        for plane in &self.planes {
            let x = plane.x as u16;
            let y = plane.y as u16;

            for (line_offset, line) in AIRPLANE_ART.lines().enumerate() {
                let render_y = y + line_offset as u16;
                if render_y >= self.terminal_height {
                    break;
                }

                for (char_offset, ch) in line.chars().enumerate() {
                    let render_x = x + char_offset as u16;
                    if render_x >= self.terminal_width {
                        break;
                    }

                    if ch != ' ' {
                        let color = match ch {
                            '"' => Color::Cyan,

                            '\\' => Color::Blue,

                            '_' => Color::DarkGrey,

                            '~' => Color::Grey,

                            _ => Color::White,
                        };
                        renderer.render_char(render_x, render_y, ch, color)?;
                    }
                }
            }
        }
        Ok(())
    }
}

impl AnimationSystem for AirplaneSystem {
    fn id(&self) -> &'static str {
        "airplanes"
    }

    fn layer(&self) -> RenderLayer {
        RenderLayer::Background
    }

    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
        !ctx.conditions.is_raining
            && !ctx.conditions.is_thunderstorm
            && !ctx.conditions.is_snowing
            && !ctx.conditions.is_foggy
    }

    fn on_resize(&mut self, size: TerminalSize) {
        self.terminal_width = size.width;
        self.terminal_height = size.height;
        self.planes
            .retain(|p| p.x < size.width as f32 && p.y < size.height as f32);
    }

    fn update(&mut self, ctx: &FrameContext<'_>, rng: &mut dyn Rng, _commands: &mut FrameCommands) {
        self.update(ctx.size.width, ctx.size.height, rng);
    }

    fn render(
        &mut self,
        renderer: &mut TerminalRenderer,
        _ctx: &FrameContext<'_>,
    ) -> io::Result<()> {
        AirplaneSystem::render(self, renderer)
    }
}

```

### Core Architecture Module: `src/animation/birds.rs`
```
use crate::animation::{AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize};
use crate::render::TerminalRenderer;
use crossterm::style::Color;

use rand::{Rng, RngExt};
use std::io;

struct Bird {
    x: f32,
    y: f32,
    speed: f32,
    character: char,
    flap_state: bool, // true = wings up, false = wings down/flat
    flap_timer: u8,
}

pub struct BirdSystem {
    birds: Vec<Bird>,
    terminal_width: u16,
    terminal_height: u16,
}

impl BirdSystem {
    pub fn new(terminal_width: u16, terminal_height: u16) -> Self {
        Self {
            birds: Vec::with_capacity(3),
            terminal_width,
            terminal_height,
        }
    }

    pub fn update(
        &mut self,
        terminal_width: u16,
        terminal_height: u16,
        rng: &mut (impl Rng + ?Sized),
    ) {
        self.terminal_width = terminal_width;
        self.terminal_height = terminal_height;

        for bird in &mut self.birds {
            bird.x += bird.speed;
            bird.flap_timer += 1;
            if bird.flap_timer > 5 {
                bird.flap_state = !bird.flap_state;
                bird.flap_timer = 0;
            }
            bird.character = if bird.flap_state { 'v' } else { '-' };
        }

        self.birds.retain(|b| b.x < terminal_width as f32);
        if self.birds.len() < 3 && rng.random::<f32>() < 0.01 {
            let spawn_band = (terminal_height / 3).max(1);
            let y = (rng.random::<u16>() % spawn_band) as f32;
            let speed = 0.2 + (rng.random::<f32>() * 0.2);
            self.birds.push(Bird {
                x: 0.0,
                y,
                speed,
                character: 'v',
                flap_state: true,
                flap_timer: 0,
            });
        }
    }

    pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
        for bird in &self.birds {
            let x = bird.x as u16;
            let y = bird.y as u16;
            if x < self.terminal_width && y < self.terminal_height {
                renderer.render_char(x, y, bird.character, Color::Yellow)?;
            }
        }
        Ok(())
    }
}

impl AnimationSystem for BirdSystem {
    fn id(&self) -> &'static str {
        "birds"
    }

    fn layer(&self) -> RenderLayer {
        RenderLayer::Background
    }

    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
        ctx.conditions.sun.is_day
            && !ctx.conditions.is_raining
            && !ctx.conditions.is_thunderstorm
            && !ctx.conditions.is_snowing
    }

    fn on_resize(&mut self, size: TerminalSize) {
        self.terminal_width = size.width;
        self.terminal_height = size.height;
        self.birds
            .retain(|b| b.x < size.width as f32 && b.y < size.height as f32);
    }

    fn update(&mut self, ctx: &FrameContext<'_>, rng: &mut dyn Rng, _commands: &mut FrameCommands) {
        self.update(ctx.size.width, ctx.size.height, rng);
    }

    fn render(
        &mut self,
        renderer: &mut TerminalRenderer,
        _ctx: &FrameContext<'_>,
    ) -> io::Result<()> {
        BirdSystem::render(self, renderer)
    }
}

```

### Core Architecture Module: `src/animation/chimney.rs`
```
use crate::animation::{AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize};
use crate::render::TerminalRenderer;
use crossterm::style::Color;

use rand::{Rng, RngExt};
use std::io;

const MAX_PARTICLES: usize = 200;
const MIN_PARTICLE_MAX_AGE: u32 = 70;
const PARTICLE_MAX_AGE_VARIANCE: u32 = 30;
const PARTICLE_VERTICAL_SPEED: f32 = 0.1;
const PARTICLE_DRIFT_SCALE: f32 = 0.08;
const PARTICLE_SPAWN_JITTER_X: f32 = 1.6;
const DEFAULT_SPAWN_RATE: u32 = 12;

struct SmokeParticle {
    x: f32,
    y: f32,
    age: u32,
    max_age: u32,
    drift: f32,
}

impl SmokeParticle {
    fn new(chimney_x: u16, chimney_y: u16, rng: &mut (impl Rng + ?Sized)) -> Self {
        let drift = (rng.random::<f32>() - 0.5) * PARTICLE_DRIFT_SCALE;
        let max_age = MIN_PARTICLE_MAX_AGE + (rng.random::<u32>() % PARTICLE_MAX_AGE_VARIANCE);

        Self {
            x: chimney_x as f32 + (rng.random::<f32>() - 0.5) * PARTICLE_SPAWN_JITTER_X,
            y: chimney_y as f32,
            age: 0,
            max_age,
            drift,
        }
    }

    fn update(&mut self) {
        self.age += 1;
        self.y -= PARTICLE_VERTICAL_SPEED;
        self.x += self.drift;
    }

    fn is_alive(&self) -> bool {
        self.age < self.max_age
    }

    fn get_color(&self) -> Color {
        let life_ratio = self.age as f32 / self.max_age as f32;
        if life_ratio < 0.3 {
            Color::White
        } else if life_ratio < 0.6 {
            Color::Grey
        } else {
            Color::DarkGrey
        }
    }
}

pub struct ChimneySmoke {
    particles: Vec<SmokeParticle>,
    spawn_counter: u32,
    spawn_rate: u32,
}

impl ChimneySmoke {
    pub fn new() -> Self {
        Self {
            particles: Vec::with_capacity(MAX_PARTICLES),
            spawn_counter: 0,
            spawn_rate: DEFAULT_SPAWN_RATE,
        }
    }

    pub fn update(&mut self, chimney_x: u16, chimney_y: u16, rng: &mut (impl Rng + ?Sized)) {
        for particle in &mut self.particles {
            particle.update();
        }

        self.particles.retain(|p| p.is_alive() && p.y >= 0.0);

        self.spawn_counter += 1;
        if self.spawn_counter >= self.spawn_rate && self.particles.len() < MAX_PARTICLES {
            self.spawn_counter = 0;
            self.particles
                .push(SmokeParticle::new(chimney_x, chimney_y, rng));
        }
    }

    pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
        for particle in &self.particles {
            let x = particle.x as i16;
            let y = particle.y as i16;

            if x >= 0 && y >= 0 {
                let display_char = match particle.age {
                    0..=6 => 'o',
                    7..=14 => '.',
                    15..=25 => '~',
                    _ => '·',
                };

                renderer.render_char(x as u16, y as u16, display_char, particle.get_color())?;
            }
        }
        Ok(())
    }
}

impl Default for ChimneySmoke {
    fn default() -> Self {
        Self::new()
    }
}

impl AnimationSystem for ChimneySmoke {
    fn id(&self) -> &'static str {
        "chimney_smoke"
    }

    fn layer(&self) -> RenderLayer {
        RenderLayer::PostScene
    }

    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
        !ctx.conditions.is_raining && !ctx.conditions.is_thunderstorm && ctx.chimney.is_some()
    }

    fn on_resize(&mut self, _size: TerminalSize) {}

    fn update(&mut self, ctx: &FrameContext<'_>, rng: &mut dyn Rng, _commands: &mut FrameCommands) {
        let Some(chimney) = ctx.chimney else {
            return;
        };

        self.update(chimney.x, chimney.y, rng);
    }

    fn render(
        &mut self,
        renderer: &mut TerminalRenderer,
        ctx: &FrameContext<'_>,
    ) -> io::Result<()> {
        if ctx.chimney.is_none() {
            return Ok(());
        }

        ChimneySmoke::render(self, renderer)
    }
}

```

### Core Architecture Module: `src/animation/clouds.rs`
```
use crate::animation::{
    AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize, Wind,
};
use crate::render::TerminalRenderer;
use crossterm::style::Color;

use rand::{Rng, RngExt};
use std::io;
use std::sync::OnceLock;

const CLOUD_SHAPE_SRCS: [&str; 4] = [
    include_str!("assets/cloud_0.txt"),
    include_str!("assets/cloud_1.txt"),
    include_str!("assets/cloud_2.txt"),
    include_str!("assets/cloud_3.txt"),
];

static CLOUD_SHAPES: OnceLock<Vec<Vec<String>>> = OnceLock::new();

fn cloud_shapes() -> &'static Vec<Vec<String>> {
    CLOUD_SHAPES.get_or_init(|| {
        CLOUD_SHAPE_SRCS
            .iter()
            .map(|src| src.lines().map(|l| l.to_string()).collect())
            .collect()
    })
}

struct Cloud {
    x: f32,
    y: f32,
    speed: f32,
    wind_x: f32,
    shape: Vec<String>,
    color: Color,
}

pub struct CloudSystem {
    clouds: Vec<Cloud>,
    terminal_width: u16,
    terminal_height: u16,
    base_wind_x: f32,
}

impl CloudSystem {
    pub fn set_cloud_color(&mut self, is_clear: bool) {
        let color = if is_clear {
            Color::White
        } else {
            Color::DarkGrey
        };

        for cloud in &mut self.clouds {
            cloud.color = color;
        }
    }

    pub fn set_wind(&mut self, speed_kmh: f32, direction_deg: f32) {
        let direction_rad = direction_deg.to_radians();
        self.base_wind_x = (speed_kmh / 50.0) * (-direction_rad.sin());
        let mut rng = rand::rng();
        for cloud in &mut self.clouds {
            cloud.wind_x = self.base_wind_x * (0.8 + rng.random::<f32>() * 0.4);
        }
    }
}

impl CloudSystem {
    pub fn new(terminal_width: u16, terminal_height: u16) -> Self {
        let mut rng = rand::rng();
        let base_wind_x = 0.15;

        // Add few initial clouds
        let count = std::cmp::max(1, terminal_width / 30) as usize;
        let segment = terminal_width as f32 / count as f32;

        let mut clouds = Vec::with_capacity(count);

        for i in 0..count {
            let x_min = (i as f32 * segment) as u16;
            let x_max = ((i as f32 + 1.0) * segment) as u16;
            let x = rng.random_range(x_min..=x_max) as f32;
            clouds.push(Self::create_random_cloud(
                x,
                terminal_height,
                Color::White,
                base_wind_x,
                &mut rng,
            ));
        }

        Self {
            clouds,
            terminal_width,
            terminal_height,
            base_wind_x,
        }
    }

    fn create_random_cloud(
        x: f32,
        height: u16,
        color: Color,
        base_wind_x: f32,
        rng: &mut (impl Rng + ?Sized),
    ) -> Cloud {
        let shapes = cloud_shapes();

        let shape_idx = rng.random_range(0..shapes.len());
        let shape = shapes[shape_idx].clone();

        let y_range = (height / 3).max(1);
        let y = rng.random_range(0..y_range) as f32;
        let speed = 0.02 + (rng.random::<f32>() * 0.03);
        let wind_x = base_wind_x * (0.8 + rng.random::<f32>() * 0.4);

        Cloud {
            x,
            y,
            speed,
            wind_x,
            shape,
            color,
        }
    }

    pub fn update(
        &mut self,
        terminal_width: u16,
        terminal_height: u16,
        is_clear: bool,
        cloud_color: Color,
        rng: &mut (impl Rng + ?Sized),
    ) {
        self.terminal_width = terminal_width;
        self.terminal_height = terminal_height;

        for cloud in &mut self.clouds {
            cloud.x += cloud.speed + cloud.wind_x;
        }

        let width_f = terminal_width as f32;
        self.clouds.retain(|cloud| {
            let cloud_width = cloud.shape.iter().map(|line| line.len()).max().unwrap_or(0) as f32;
            let drift_x = cloud.speed + cloud.wind_x;

            if drift_x >= 0.0 {
                cloud.x < width_f
            } else {
                cloud.x + cloud_width > 0.0
            }
        });

        let max_clouds = if is_clear {
            (terminal_width / 30) as usize
        } else {
            (terminal_width / 20) as usize
        };

        let spawn_chance = if is_clear { 0.002 } else { 0.005 };

        if self.clouds.len() < max_clouds && rng.random::<f32>() < spawn_chance {
            let mut cloud =
                Self::create_random_cloud(0.0, terminal_height, cloud_color, self.base_wind_x, rng);
            let cloud_width = cloud.shape.iter().map(|line| line.len()).max().unwrap_or(0) as f32;

            let drift_x = cloud.speed + cloud.wind_x;
            let spawn_from_left = drift_x >= 0.0;
            let min_gap = (terminal_width as f32 / 8.0).max(15.0);
            let too_close = if spawn_from_left {
                self.clouds.iter().any(|c| c.x < min_gap)
            } else {
                self.clouds.iter().any(|c| c.x > (width_f - min_gap))
            };

            if !too_close {
                cloud.x = if spawn_from_left {
                    -cloud_width
                } else {
                    width_f
                };
                self.clouds.push(cloud);
            }
        }
    }

    pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
        for cloud in &self.clouds {
            for (i, line) in cloud.shape.iter().enumerate() {
                let y = cloud.y as i16 + i as i16;
                let x = cloud.x as i16;

                if y < 0 || y >= self.terminal_height as i16 {
                    continue;
                }

                let clip = ((-x).max(0)) as usize;
                let visible = &line[clip.min(line.len())..];

                if !visible.is_empty() {
                    renderer.render_line_colored(
                        x.max(0) as u16,
                        y as u16,
                        visible,
                        cloud.color,
                    )?;
                }
            }
        }
        Ok(())
    }
}

impl AnimationSystem for CloudSystem {
    fn id(&self) -> &'static str {
        "clouds"
    }

    fn layer(&self) -> RenderLayer {
        RenderLayer::Background
    }

    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
        let is_clear = ctx
            .state
            .current_weather
            .as_ref()
            .is_some_and(|w| matches!(w.condition, crate::weather::WeatherCondition::Clear));

        ctx.conditions.is_cloudy || is_clear
    }

    fn on_resize(&mut self, size: TerminalSize) {
        self.terminal_width = size.width;
        self.terminal_height = size.height;
    }

    fn on_wind(&mut self, wind: Wind) {
        self.set_wind(wind.speed_kmh, wind.direction_deg);
    }

    fn update(&mut self, ctx: &FrameContext<'_>, rng: &mut dyn Rng, _commands: &mut FrameCommands) {
        let (is_clear, cloud_color) = if let Some(weather) = &ctx.state.current_weather {
            match weather.condition {
                crate::weather::WeatherCondition::Clear => (true, Color::White),
                crate::weather::WeatherCondition::PartlyCloudy => (false, Color::Grey),
                _ => (false, Color::DarkGrey),
            }
        } else {
            (false, Color::DarkGrey)
        };

        self.set_cloud_color(is_clear);
        self.update(ctx.size.width, ctx.size.height, is_clear, cloud_color, rng);
    }

    fn render(
        &mut self,
        renderer: &mut TerminalRenderer,
        _ctx: &FrameContext<'_>,
    ) -> io::Result<()> {
        CloudSystem::render(self, renderer)
    }
}

```

### Core Architecture Module: `src/animation/fireflies.rs`
```
use crate::animation::{AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize};
use crate::render::TerminalRenderer;
use crossterm::style::Color;

use rand::{Rng, RngExt};
use std::io;

struct Firefly {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    glow_phase: f32,
    glow_speed: f32,
    brightness: u8,
}

impl Firefly {
    fn new(terminal_width: u16, horizon_y: u16, rng: &mut (impl Rng + ?Sized)) -> Self {
        let x = rng.random::<f32>() * terminal_width as f32;
        let min_y = (horizon_y.saturating_sub(8)) as f32;
        let max_y = (horizon_y.saturating_sub(1)) as f32;
        let y = min_y + (rng.random::<f32>() * (max_y - min_y));

        let vx = (rng.random::<f32>() - 0.5) * 0.3;
        let vy = (rng.random::<f32>() - 0.5) * 0.2;

        let glow_speed = 0.1 + (rng.random::<f32>() * 0.15);
        let glow_phase = rng.random::<f32>() * std::f32::consts::PI * 2.0;

        Self {
            x,
            y,
            vx,
            vy,
            glow_phase,
            glow_speed,
            brightness: 0,
        }
    }

    fn update(&mut self, terminal_width: u16, horizon_y: u16, rng: &mut (impl Rng + ?Sized)) {
        self.x += self.vx;
        self.y += self.vy;

        if rng.random::<f32>() < 0.02 {
            self.vx = (rng.random::<f32>() - 0.5) * 0.3;
            self.vy = (rng.random::<f32>() - 0.5) * 0.2;
        }

        // Wrap horizontally
        if self.x < 0.0 {
            self.x = terminal_width as f32;
        } else if self.x > terminal_width as f32 {
            self.x = 0.0;
        }

        let min_y = (horizon_y.saturating_sub(8)) as f32;
        let max_y = (horizon_y.saturating_sub(1)) as f32;
        if self.y < min_y {
            self.y = min_y;
            self.vy = self.vy.abs(); // Bounce down
        } else if self.y > max_y {
            self.y = max_y;
            self.vy = -self.vy.abs(); // Bounce up
        }

        self.glow_phase += self.glow_speed;
        if self.glow_phase > std::f32::consts::PI * 2.0 {
            self.glow_phase -= std::f32::consts::PI * 2.0;
        }

        let glow_value = (self.glow_phase.sin() + 1.0) / 2.0;
        self.brightness = (glow_value * 255.0) as u8;
    }

    fn get_character(&self) -> char {
        if self.brightness > 200 {
            '*'
        } else if self.brightness > 128 {
            '.'
        } else if self.brightness > 64 {
            '·'
        } else {
            ' '
        }
    }

    fn get_color(&self) -> Color {
        if self.brightness > 200 {
            Color::Yellow
        } else if self.brightness > 128 {
            Color::Rgb {
                r: 200,
                g: 255,
                b: 100,
            }
        } else if self.brightness > 64 {
            Color::Rgb {
                r: 150,
                g: 200,
                b: 80,
            }
        } else {
            Color::DarkGrey
        }
    }

    fn is_visible(&self) -> bool {
        self.brightness > 64
    }
}

pub struct FireflySystem {
    fireflies: Vec<Firefly>,
    terminal_width: u16,
    terminal_height: u16,
}

impl FireflySystem {
    pub fn new(terminal_width: u16, terminal_height: u16) -> Self {
        let fireflies_capacity = std::cmp::max(3, terminal_width / 15) as usize;

        Self {
            fireflies: Vec::with_capacity(fireflies_capacity),
            terminal_width,
            terminal_height,
        }
    }

    pub fn update(
        &mut self,
        terminal_width: u16,
        terminal_height: u16,
        horizon_y: u16,
        rng: &mut (impl Rng + ?Sized),
    ) {
        self.terminal_width = terminal_width;
        self.terminal_height = terminal_height;

        for firefly in &mut self.fireflies {
            firefly.update(terminal_width, horizon_y, rng);
        }

        let target_count = std::cmp::max(3, terminal_width / 15) as usize;
        if self.fireflies.len() < target_count && rng.random::<f32>() < 0.01 {
            self.fireflies
                .push(Firefly::new(terminal_width, horizon_y, rng));
        }
    }

    pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
        for firefly in &self.fireflies {
            if firefly.is_visible() {
                let x = firefly.x as i16;
                let y = firefly.y as i16;

                if x >= 0
                    && y >= 0
                    && x < self.terminal_width as i16
                    && y < self.terminal_height as i16
                {
                    renderer.render_char(
                        x as u16,
                        y as u16,
                        firefly.get_character(),
                        firefly.get_color(),
                    )?;
                }
            }
        }
        Ok(())
    }
}

impl AnimationSystem for FireflySystem {
    fn id(&self) -> &'static str {
        "fireflies"
    }

    fn layer(&self) -> RenderLayer {
        RenderLayer::Background
    }

    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
        ctx.state.should_show_fireflies()
    }

    fn on_resize(&mut self, size: TerminalSize) {
        self.terminal_width = size.width;
        self.terminal_height = size.height;

        let target_count = std::cmp::max(3, size.width / 15) as usize;
        if self.fireflies.len() > target_count {
            self.fireflies.truncate(target_count);
        }
    }

    fn update(&mut self, ctx: &FrameContext<'_>, rng: &mut dyn Rng, _commands: &mut FrameCommands) {
        self.update(ctx.size.width, ctx.size.height, ctx.horizon_y, rng);
    }

    fn render(
        &mut self,
        renderer: &mut TerminalRenderer,
        _ctx: &FrameContext<'_>,
    ) -> io::Result<()> {
        FireflySystem::render(self, renderer)
    }
}

```

### Core Architecture Module: `src/animation/fog.rs`
```
use crate::animation::{AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize};
use crate::render::TerminalRenderer;
use crate::weather::types::FogIntensity;
use crossterm::style::Color;

use rand::{Rng, RngExt};
use std::collections::VecDeque;
use std::io;

struct FogWisp {
    x: f32,
    y: f32,
    speed_x: f32,
    character: char,
    color: Color,
    lifetime: u32,
    max_lifetime: u32,
}

impl FogWisp {
    fn new(terminal_width: u16, terminal_height: u16, rng: &mut (impl Rng + ?Sized)) -> Self {
        let ground_level = terminal_height.saturating_sub(7);
        let fog_zone_top = ground_level.saturating_sub(15);

        let x = rng.random::<f32>() * terminal_width as f32;
        let y = fog_zone_top as f32 + (rng.random::<f32>() * 15.0);

        let chars = ['.', ',', '-', '~'];
        let char_idx = (rng.random::<u32>() as usize) % chars.len();

        let colors = [
            Color::Grey,
            Color::DarkGrey,
            Color::Rgb {
                r: 120,
                g: 120,
                b: 120,
            },
        ];
        let color_idx = (rng.random::<u32>() as usize) % colors.len();

        Self {
            x,
            y,
            speed_x: (rng.random::<f32>() - 0.5) * 0.15,
            character: chars[char_idx],
            color: colors[color_idx],
            lifetime: 0,
            max_lifetime: 100 + (rng.random::<u32>() % 200),
        }
    }

    fn update(&mut self) {
        self.x += self.speed_x;
        self.lifetime += 1;
    }

    fn is_alive(&self, terminal_width: u16) -> bool {
        self.lifetime < self.max_lifetime
            && self.x >= -5.0
            && self.x < (terminal_width as f32 + 5.0)
    }
}

pub struct FogSystem {
    wisps: VecDeque<FogWisp>,
    terminal_width: u16,
    terminal_height: u16,
    intensity: FogIntensity,
    spawn_timer: u32,
}

impl AnimationSystem for FogSystem {
    fn id(&self) -> &'static str {
        "fog"
    }

    fn layer(&self) -> RenderLayer {
        RenderLayer::Foreground
    }

    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
        ctx.conditions.is_foggy
    }

    fn on_resize(&mut self, size: TerminalSize) {
        self.terminal_width = size.width;
        self.terminal_height = size.height;
        self.wisps
            .retain(|w| w.is_alive(size.width) && w.y >= 0.0 && w.y < size.height as f32);
    }

    fn on_fog_intensity(&mut self, intensity: FogIntensity) {
        self.set_intensity(intensity);
    }

    fn update(&mut self, ctx: &FrameContext<'_>, rng: &mut dyn Rng, _commands: &mut FrameCommands) {
        self.update(ctx.size.width, ctx.size.height, rng);
    }

    fn render(
        &mut self,
        renderer: &mut TerminalRenderer,
        _ctx: &FrameContext<'_>,
    ) -> io::Result<()> {
        FogSystem::render(self, renderer)
    }
}

impl FogSystem {
    pub fn new(terminal_width: u16, terminal_height: u16, intensity: FogIntensity) -> Self {
        let wisps_capacity = match intensity {
            FogIntensity::Light => (terminal_width as f32 * 0.3) as usize,
            FogIntensity::Medium => (terminal_width as f32 * 0.6) as usize,
            FogIntensity::Heavy => terminal_width as usize,
        };

        Self {
            wisps: VecDeque::with_capacity(wisps_capacity),
            terminal_width,
            terminal_height,
            intensity,
            spawn_timer: 0,
        }
    }

    pub fn set_intensity(&mut self, intensity: FogIntensity) {
        self.intensity = intensity;
    }

    pub fn update(
        &mut self,
        terminal_width: u16,
        terminal_height: u16,
        rng: &mut (impl Rng + ?Sized),
    ) {
        self.terminal_width = terminal_width;
        self.terminal_height = terminal_height;

        for wisp in &mut self.wisps {
            wisp.update();
        }

        self.wisps.retain(|w| w.is_alive(terminal_width));

        let (target_multiplier, spawn_delay) = match self.intensity {
            FogIntensity::Light => (0.3, 4),
            FogIntensity::Medium => (0.6, 2),
            FogIntensity::Heavy => (1.0, 1),
        };
        let target_count = (terminal_width as f32 * target_multiplier) as usize;

        self.spawn_timer += 1;
        if self.spawn_timer >= spawn_delay && self.wisps.len() < target_count {
            self.spawn_timer = 0;
            for _ in 0..2 {
                if self.wisps.len() < target_count {
                    self.wisps
                        .push_back(FogWisp::new(terminal_width, terminal_height, rng));
                }
            }
        }
    }

    pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
        for wisp in &self.wisps {
            let x = wisp.x as i16;
            let y = wisp.y as i16;

            if x >= 0 && x < self.terminal_width as i16 && y >= 0 && y < self.terminal_height as i16
            {
                renderer.render_char(x as u16, y as u16, wisp.character, wisp.color)?;
            }
        }
        Ok(())
    }
}

```

### Core Architecture Module: `src/animation/leaves.rs`
```
use crate::animation::{AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize};
use crate::render::TerminalRenderer;
use crossterm::style::Color;

use rand::{Rng, RngExt};
use std::io;

struct Leaf {
    x: f32,
    y: f32,
    fall_speed: f32,
    sway_speed: f32,
    sway_phase: f32,
    sway_amplitude: f32,
    rotation: u8,
    color: Color,
    character: char,
}

impl Leaf {
    fn new(
        terminal_width: u16,
        terminal_height: u16,
        spawn_at_top: bool,
        rng: &mut (impl Rng + ?Sized),
    ) -> Self {
        let x = rng.random::<f32>() * terminal_width as f32;
        let y = if spawn_at_top {
            -(rng.random::<f32>() * 5.0)
        } else {
            rng.random::<f32>() * terminal_height as f32
        };

        let fall_speed = 0.15 + (rng.random::<f32>() * 0.2);
        let sway_speed = 0.05 + (rng.random::<f32>() * 0.1);
        let sway_phase = rng.random::<f32>() * std::f32::consts::PI * 2.0;
        let sway_amplitude = 0.5 + (rng.random::<f32>() * 1.5);

        let colors = [
            Color::Rgb {
                r: 255,
                g: 165,
                b: 0,
            }, // Orange
            Color::Rgb {
                r: 218,
                g: 165,
                b: 32,
            }, // Golden
            Color::Rgb {
                r: 184,
                g: 134,
                b: 11,
            }, // Dark golden
            Color::Rgb {
                r: 205,
                g: 92,
                b: 92,
            }, // Indian red
            Color::Rgb {
                r: 160,
                g: 82,
                b: 45,
            }, // Sienna brown
            Color::Rgb {
                r: 139,
                g: 69,
                b: 19,
            }, // Saddle brown
        ];
        let color = colors[(rng.random::<u32>() % colors.len() as u32) as usize];

        let chars = ['*', '+', ',', '.', '~'];
        let character = chars[(rng.random::<u32>() % chars.len() as u32) as usize];

        Self {
            x,
            y,
            fall_speed,
            sway_speed,
            sway_phase,
            sway_amplitude,
            rotation: 0,
            color,
            character,
        }
    }

    fn update(&mut self) {
        self.y += self.fall_speed;

        self.sway_phase += self.sway_speed;
        if self.sway_phase > std::f32::consts::PI * 2.0 {
            self.sway_phase -= std::f32::consts::PI * 2.0;
        }

        let sway_offset = self.sway_phase.sin() * self.sway_amplitude;
        self.x += sway_offset * 0.1;

        self.rotation = ((self.sway_phase * 2.0).sin() * 4.0) as u8;
    }

    fn is_offscreen(&self, terminal_height: u16) -> bool {
        self.y > terminal_height as f32
    }

    fn get_character(&self) -> char {
        match self.rotation % 4 {
            0 => self.character,
            1 => {
                if self.character == '*' {
                    '+'
                } else {
                    self.character
                }
            }
            2 => {
                if self.character == '+' {
                    '*'
                } else {
                    self.character
                }
            }
            _ => self.character,
        }
    }
}

pub struct FallingLeaves {
    leaves: Vec<Leaf>,
    spawn_counter: u32,
    spawn_rate: u32,
    terminal_width: u16,
    terminal_height: u16,
}

impl FallingLeaves {
    pub fn new(terminal_width: u16, terminal_height: u16) -> Self {
        let mut rng = rand::rng();
        let initial_count = std::cmp::max(5, terminal_width / 10);

        let max_capacity = std::cmp::max(10, terminal_width / 8) as usize;
        let mut leaves = Vec::with_capacity(max_capacity);

        for _ in 0..initial_count {
            leaves.push(Leaf::new(terminal_width, terminal_height, false, &mut rng));
        }

        Self {
            leaves,
            spawn_counter: 0,
            spawn_rate: 15,
            terminal_width,
            terminal_height,
        }
    }

    pub fn update(
        &mut self,
        terminal_width: u16,
        terminal_height: u16,
        rng: &mut (impl Rng + ?Sized),
    ) {
        self.terminal_width = terminal_width;
        self.terminal_height = terminal_height;

        for leaf in &mut self.leaves {
            leaf.update();
        }

        self.leaves.retain(|l| !l.is_offscreen(terminal_height));

        self.spawn_counter += 1;
        if self.spawn_counter >= self.spawn_rate {
            self.spawn_counter = 0;
            if rng.random::<f32>() < 0.7 {
                self.leaves
                    .push(Leaf::new(terminal_width, terminal_height, true, rng));
            }
        }

        let max_leaves = std::cmp::max(10, terminal_width / 8) as usize;
        if self.leaves.len() > max_leaves {
            self.leaves.truncate(max_leaves);
        }
    }

    pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
        for leaf in &self.leaves {
            let x = leaf.x as i16;
            let y = leaf.y as i16;

            if x >= 0 && y >= 0 && x < self.terminal_width as i16 && y < self.terminal_height as i16
            {
                renderer.render_char(x as u16, y as u16, leaf.get_character(), leaf.color)?;
            }
        }
        Ok(())
    }
}

impl AnimationSystem for FallingLeaves {
    fn id(&self) -> &'static str {
        "leaves"
    }

    fn layer(&self) -> RenderLayer {
        RenderLayer::Foreground
    }

    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
        ctx.show_leaves
            && !ctx.conditions.is_raining
            && !ctx.conditions.is_thunderstorm
            && !ctx.conditions.is_snowing
    }

    fn on_resize(&mut self, size: TerminalSize) {
        self.terminal_width = size.width;
        self.terminal_height = size.height;
        self.leaves
            .retain(|l| l.y < size.height as f32 && l.x > -10.0 && l.x < size.width as f32 + 10.0);
    }

    fn update(&mut self, ctx: &FrameContext<'_>, rng: &mut dyn Rng, _commands: &mut FrameCommands) {
        self.update(ctx.size.width, ctx.size.height, rng);
    }

    fn render(
        &mut self,
        renderer: &mut TerminalRenderer,
        _ctx: &FrameContext<'_>,
    ) -> io::Result<()> {
        FallingLeaves::render(self, renderer)
    }
}

```

### Core Architecture Module: `src/animation/mod.rs`
```
pub mod airplanes;
pub mod birds;
pub mod chimney;
pub mod clouds;
pub mod fireflies;
pub mod fog;
pub mod leaves;
pub mod moon;
pub mod raindrops;
pub mod snow;
pub mod stars;
pub mod sunny;
pub mod system;
pub mod thunderstorm;

pub use system::{
    AnimationSystem, ChimneyPosition, FrameCommands, FrameContext, RenderLayer, TerminalSize, Wind,
};

use crate::render::TerminalRenderer;
use crossterm::style::Color;
use std::io;

pub trait Animation {
    fn get_frame(&self, frame_number: usize) -> &[String];
    fn frame_count(&self) -> usize;

    fn get_color(&self) -> Color {
        Color::Reset
    }
}

pub struct AnimationController {
    current_frame: usize,
}

impl AnimationController {
    pub fn new() -> Self {
        Self { current_frame: 0 }
    }

    pub fn next_frame<A: Animation>(&mut self, animation: &A) -> usize {
        self.current_frame = (self.current_frame + 1) % animation.frame_count();
        self.current_frame
    }

    pub fn render_frame<A: Animation>(
        &self,
        renderer: &mut TerminalRenderer,
        animation: &A,
        y_offset: u16,
    ) -> io::Result<()> {
        let frame = animation.get_frame(self.current_frame);
        let color = animation.get_color();
        renderer.render_centered_colored(frame, y_offset, color)
    }

    #[allow(dead_code)]
    pub fn reset(&mut self) {
        self.current_frame = 0;
    }
}

impl Default for AnimationController {
    fn default() -> Self {
        Self::new()
    }
}

```

### Core Architecture Module: `src/animation/moon.rs`
```
use crate::animation::{AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize};
use crate::render::TerminalRenderer;
use crossterm::style::Color;
use rand::Rng;

use std::io;

const MOON_PHASES: [&str; 8] = [
    include_str!("assets/moon/phase_0.txt"),
    include_str!("assets/moon/phase_1.txt"),
    include_str!("assets/moon/phase_2.txt"),
    include_str!("assets/moon/phase_3.txt"),
    include_str!("assets/moon/phase_4.txt"),
    include_str!("assets/moon/phase_5.txt"),
    include_str!("assets/moon/phase_6.txt"),
    include_str!("assets/moon/phase_7.txt"),
];

pub struct MoonSystem {
    phase: f64, // 0.0 = New, 0.25 = First Quarter, 0.5 = Full, 0.75 = Last Quarter
    x: u16,
    y: u16,
}

impl MoonSystem {
    pub fn new(terminal_width: u16, terminal_height: u16, phase: Option<f64>) -> Self {
        Self {
            phase: phase.unwrap_or(0.5),
            x: (terminal_width / 4) + 10,
            y: (terminal_height / 4) + 2,
        }
    }

    pub fn set_phase(&mut self, phase: f64) {
        self.phase = phase;
    }

    pub fn update(&mut self, terminal_width: u16, terminal_height: u16) {
        self.x = (terminal_width / 4 * 3).min(terminal_width.saturating_sub(15));
        self.y = (terminal_height / 4).max(2);
    }

    pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
        let step = (self.phase * 8.0).round() as usize % 8;
        let art = MOON_PHASES[step];

        for (i, line) in art.lines().enumerate() {
            let y = self.y + i as u16;
            for (j, ch) in line.chars().enumerate() {
                if ch == ' ' {
                    continue; // Transparent (Sky)
                }

                let x = self.x + j as u16;

                if ch == '~' {
                    // Opaque Moon Body (hides stars) - Render as space but overwrite what's there
                    renderer.render_char(x, y, ' ', Color::White)?;
                } else {
                    // Texture/Outline
                    renderer.render_char(x, y, ch, Color::White)?;
                }
            }
        }
        Ok(())
    }
}

impl AnimationSystem for MoonSystem {
    fn id(&self) -> &'static str {
        "moon"
    }

    fn layer(&self) -> RenderLayer {
        RenderLayer::Background
    }

    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
        !ctx.conditions.sun.is_day
    }

    fn on_resize(&mut self, size: TerminalSize) {
        self.update(size.width, size.height);
    }

    fn on_moon_phase(&mut self, phase: f64) {
        self.set_phase(phase);
    }

    fn update(
        &mut self,
        ctx: &FrameContext<'_>,
        _rng: &mut dyn Rng,
        _commands: &mut FrameCommands,
    ) {
        self.update(ctx.size.width, ctx.size.height);
    }

    fn render(
        &mut self,
        renderer: &mut TerminalRenderer,
        _ctx: &FrameContext<'_>,
    ) -> io::Result<()> {
        MoonSystem::render(self, renderer)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #66** (2026-08-12): **build(deps): bump quinn-proto from 0.11.14 to 0.11.16**
  *Symptoms*: Bumps [quinn-proto](https://github.com/quinn-rs/quinn) from 0.11.14 to 0.11.16. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/quinn-rs/quinn/releases">quinn-proto's releases</a>.</em></p> <blockquote> <h2>quinn-proto-0.11.16</h2> <h2>What's Changed</h2> <ul> <li>0.11.x: upgrade dependencies by <a href="https://github.com/djc"><code>@​djc</code></a> in <a href="https://redirect.github.com/quinn-rs/quinn/pull/2707">quinn-rs/quinn#2707</a></li> </ul> <h2>quinn-proto 0.11.15, quinn 0.11.11</h2> <p>This release fixes a remote memory exhaustion issue in the quinn-proto <code>Assembler</code>. See <a href="https://github.com/quinn-rs/quinn/security/advisories/GHSA-4w2j-m93h-cj5j">https://github.com/quinn-rs/quinn/security/advisories/GHSA-4w2j-m93h-cj5j</a> for more details and <a href="https://redirect.github.com/quinn-rs/quinn/issues/2694">#2694</a> for the fix.</p> <p>Two sponsoring organizations participated in coordinated disclosure. If this is relevant to your organization, please contact us to keep support Quinn maintenance.</p> <h2>What's Changed</h2> <ul> <li>Prepare 0.11.x branch for release by <a href="https://github.com/djc"><code>@​djc</code></a> in <a href="https://redirect.github.com/quinn-rs/quinn/pull/2645">quinn-rs/quinn#2645</a></li> <li>Backport of <a href="https://redirect.github.com/quinn-rs/quinn/issues/2495">#2495</a> to 0.11.x by <a href="https://github.com/stablebits"><code>@​stablebits</code></a> in <a href="http

- **Issue #63** (2026-06-23): **feat: display current time as ASCII art in the sky**
  *Symptoms*: Add an ASCII-art clock rendered in the sky region of the scene, showing the current local time. Defaults to 24-hour HH:MM; the new --12hour flag switches to 12-hour format with AM/PM drawn as plain text at the top-right of the digits.  Implemented as a Foreground-layer AnimationSystem registered last, so the clock stays on top of weather effects while staying confined to the sky band above the house (it is skipped entirely when the terminal is too short to fit it without overlapping the house).

- **Issue #62** (2026-06-18): **Offline mode.**
  *Symptoms*: Hi, 14.06.26 it started working offline, showing random weather and temperature every time it restarts. I understand it's accessing customer-api-eu03.open-meteo.com. It seems it's unavailable. Version 1.4.0  OFFLINE | Weather: Rain | Temp: 20.3°C | Wind: 52.5km/h | Precip: 2.8mm
  **Post-Mortem & Fix Analysis**:
  > I can confirm this unfortunately. It seems like the problem is in Internet blocking in Russia (should work fine with VPN though). I would suggest to add checking if open-meteo.com API is available and if not then using information from some other weather API.
  > Thanks. I'll put the address in warp for now.

- **Issue #57** (2026-05-06): **Added Winget to the "Packaging Status" section.**
  *Symptoms*: As simple as that, hopefully.  If you have any questions, feel free to ask.

- **Issue #56** (2026-04-30): **build(deps): bump rand from 0.10.0 to 0.10.1**
  *Symptoms*: Bumps [rand](https://github.com/rust-random/rand) from 0.10.0 to 0.10.1. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/rust-random/rand/blob/master/CHANGELOG.md">rand's changelog</a>.</em></p> <blockquote> <h2>[0.10.1] — 2026-02-11</h2> <p>This release includes a fix for a soundness bug; see <a href="https://redirect.github.com/rust-random/rand/issues/1763">#1763</a>.</p> <h3>Changes</h3> <ul> <li>Document panic behavior of <code>make_rng</code> and add <code>#[track_caller]</code> (<a href="https://redirect.github.com/rust-random/rand/issues/1761">#1761</a>)</li> <li>Deprecate feature <code>log</code> (<a href="https://redirect.github.com/rust-random/rand/issues/1763">#1763</a>)</li> </ul> <p><a href="https://redirect.github.com/rust-random/rand/issues/1761">#1761</a>: <a href="https://redirect.github.com/rust-random/rand/pull/1761">rust-random/rand#1761</a> <a href="https://redirect.github.com/rust-random/rand/issues/1763">#1763</a>: <a href="https://redirect.github.com/rust-random/rand/pull/1763">rust-random/rand#1763</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/rust-random/rand/commit/27ff4cb7ced3122a1f677fc248c1a07e59ddc8cd"><code>27ff4cb</code></a> Prepare v0.10.1: deprecate feature <code>log</code> (<a href="https://redirect.github.com/rust-random/rand/issues/1763">#1763</a>)</li> <li><a href="https://github.com/rust-random/rand/commit/98d06386dc4e1d1c89a91f4e483d5719

- **Issue #55** (2026-04-30): **build(deps): bump rustls-webpki from 0.103.10 to 0.103.13**
  *Symptoms*: Bumps [rustls-webpki](https://github.com/rustls/webpki) from 0.103.10 to 0.103.13. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/rustls/webpki/releases">rustls-webpki's releases</a>.</em></p> <blockquote> <h2>0.103.13</h2> <ul> <li><strong>Fix reachable panic in parsing a CRL</strong>. This was reported to us as <a href="https://github.com/rustls/webpki/security/advisories/GHSA-82j2-j2ch-gfr8">GHSA-82j2-j2ch-gfr8</a>. Users who don't use CRLs are not affected.</li> <li>For name constraints on URI names, we incorrectly processed excluded subtrees in a way which inverted the desired meaning. See <a href="https://redirect.github.com/rustls/webpki/pull/471">rustls/webpki#471</a>. This was a case missing in the fix for <a href="https://github.com/advisories/GHSA-965h-392x-2mh5">https://github.com/advisories/GHSA-965h-392x-2mh5</a>.</li> </ul> <h2>What's Changed</h2> <ul> <li>Actually fail closed for URI matching against excluded subtrees by <a href="https://github.com/djc"><code>@​djc</code></a> in <a href="https://redirect.github.com/rustls/webpki/pull/473">rustls/webpki#473</a></li> <li>Prepare 0.103.13 by <a href="https://github.com/ctz"><code>@​ctz</code></a> in <a href="https://redirect.github.com/rustls/webpki/pull/474">rustls/webpki#474</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/rustls/webpki/compare/v/0.103.12...v/0.103.13">https://github.com/rustls/webpki/compare/v/0.103.12...v/0.103.13</a></

- **Issue #54** (2026-04-27): **Update package reference syntax in hm-module.nix**
  *Symptoms*: Fix default package reference for home-manager module to match updated nix syntax.  This PR is targeting the following evaluation warning: `trace: evaluation warning: 'system' has been renamed to/replaced by 'stdenv.hostPlatform.system'`  Change from: ``` nix default = self.packages.${pkgs.system}.default; ``` To: ``` nix default = self.packages.${pkgs.stdenv.hostPlatform.system}.default; ```
  **Post-Mortem & Fix Analysis**:
  > Thank you

- **Issue #52** (2026-03-25): **📈 Would a GROWTH.md help weathr reach more terminal enthusiasts?**
  *Symptoms*: Hi @Veirt! 👋  Just saw weathr trending — ASCII weather animations in the terminal is such a fun concept!  **Current stats:** - ⭐ 2,626 stars - 📈 GitHub Trending - 🎨 Created just last month but already popular!  I've helped several CLI tools grow from 3k to 15k+ stars and think weathr has viral potential.  **I'd like to contribute a GROWTH.md covering:** - Reddit strategy: r/unixporn, r/commandline, r/rust - HackerNews timing + template - Twitter/X developer community - Terminal screensaver comparison (vs. cbonsai, pipes.sh, cmatrix) - Dotfiles community integration - YouTube terminal customization channels  **Would this be useful?** Happy to prepare a detailed PR if interested.  ---  **Resources:** - [Open Source Marketing Playbook](https://github.com/Gingiris/opensource-growth) - [Product Hunt Launch Guide](https://github.com/Gingiris/launch-playbook)
  **Post-Mortem & Fix Analysis**:
  > Thank you, But I don’t think GROWTH.md, as you described it, belongs in the repo. If you don't mind, you can comment it here instead and I'll use it as reference rather than opening a PR. I'm not sure if that would achieve what you want, though.  I'd also pass on the comparison with cbonsai, pipes.sh, and cmatrix. They're all pretty distinct.
  > Understood — happy to share it as a comment instead. Here is a growth strategy tailored specifically to weathr:  ---  ## Growth Strategy for weathr  **Target audience**: Terminal power users, developers who live in the CLI, and Linux/macOS enthusiasts who prefer lightweight tools.  **Top organic channels to focus on:**  1. **Hacker News "Show HN"** — A well-framed Show HN post emphasising the minimal footprint and TUI design tends to perform well. Lead with what makes weathr different from `wttr.in` or other CLI weather tools.  2. **r/commandline and r/unixporn** — These communities actively share terminal tools. A screenshot or short demo GIF of weathr in a clean terminal setup gets organic upvotes and stars.  3. **Awesome lists** — Submit to `awesome-cli-apps`, `awesome-tui`, and `awesome-rust` (if applicable) — these drive steady long-tail discovery.  4. **README improvements** — Adding a GIF demo at the top of the README is the single highest-ROI change for star conversion. Visitor

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

### Incident Patch 1: `7d403a0c` (2026-08-12)
**Commit Message**: build(deps): bump quinn-proto from 0.11.14 to 0.11.16 (#66)

Bumps [quinn-proto](https://github.com/quinn-rs/quinn) from 0.11.14 to 0.11.16.
- [Release notes](https://github.com/quinn-rs/quinn/releases)
- [Commits](https://github.com/quinn-rs/quinn/compare/quinn-proto-0.11.14...quinn-proto-0.11.16)

---
updated-dependencies:
- dependency-name: quinn-proto
  dependency-version: 0.11.16
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +18/-66)
```diff
@@ -174,7 +174,7 @@ checksum = "6f8d983286843e49675a4b7a2d174efe136dc93a18d69130dd18198a6c167601"
 dependencies = [
  "cfg-if",
  "cpufeatures",
- "rand_core 0.10.0",
+ "rand_core",
 ]
 
 [[package]]
@@ -532,11 +532,9 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "899def5c37c4fd7b2664648c28120ecec138e4d395b459e5ca34f9cce2dd77fd"
 dependencies = [
  "cfg-if",
- "js-sys",
  "libc",
  "r-efi 5.3.0",
  "wasip2",
- "wasm-bindgen",
 ]
 
 [[package]]
@@ -546,11 +544,13 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0de51e6874e94e7bf76d726fc5d13ba782deca734ff60d5bb2fb2607c7406555"
 dependencies = [
  "cfg-if",
+ "js-sys",
  "libc",
  "r-efi 6.0.0",
- "rand_core 0.10.0",
+ "rand_core",
  "wasip2",
  "wasip3",
+ "wasm-bindgen",
 ]
 
 [[package]]
@@ -1076,15 +1076,6 @@ dependencies = [
  "zerovec",
 ]
 
-[[package]]
-name = "ppv-lite86"
-version = "0.2.21"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "85eae3c4ed2f50dcfe72643da4befc30deadb458a9b590d720cde2f2b1e97da9"
-dependencies = [
- "zerocopy",
-]
-
 [[package]]
 name = "prettyplease"
 version = "0.2.37"
@@ -1126,15 +1117,16 @@ dependencies = [
 
 [[package]]
 name = "quinn-proto"
-version = "0.11.14"
+version = "0.11.16"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "434b42fec591c96ef50e21e886936e66d3cc3f737104fdb9b737c40ffb94c098"
+checksum = "2f4bfc015262b9df63c8845072ce59068853ff5872180c2ce2f13038b970e560"
 dependencies = [
  "aws-lc-rs",
  "bytes",
- "getrandom 0.3.4",
+ "getrandom 0.4.2",
  "lru-slab",
- "rand 0.9.2",
+ "rand",
+ "rand_pcg",
  "ring",
  "rustc-hash",
  "rustls",
@@ -1181,16 +1173,6 @@ version = "6.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "f8dcc9c7d52a811697d2151c701e0d08956f92b0e24136cf4cf27b57a6a0d9bf"
 
-[[package]]
-name = "rand"
-version = "0.9.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6db2770f06117d490610c7488547d543617b21bfa07796d7a12f6f1bd53850d1"
-dependencies = [
- "rand_chacha",
- "rand_core 0.9.5",
-]
-
 [[package]]
 name = "rand"
 version = "0.10.1"
@@ -1199,34 +1181,24 @@ checksum = "d2e8e8bcc7961af1fdac401278c6a831614941f6164ee3bf4ce61b7edb162207"
 dependencies = [
  "chacha20",
  "getrandom 0.4.2",
- "rand_core 0.10.0",
+ "rand_core",
 ]
 
 [[package]]
-name = "rand_chacha"
-version = "0.9.0"
+name = "rand_core"
+version = "0.10.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d3022b5f1df60f26e1ffddd6c66e8aa15de382ae63b3a0c1bfc0e4d3e3f325cb"
-dependencies = [
- "ppv-lite86",
- "rand_core 0.9.5",
-]
+checksum = "0c8d0fd677905edcbeedbf2edb6494d676f0e98d54d5cf9bda0b061cb8fb8aba"
 
 [[package]]
-name = "rand_core"
-version = "0.9.5"
+name = "rand_pcg"
+version = "0.10.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "76afc826de14238e6e8c374ddcc1fa19e374fd8dd986b0d2af0d02377261d83c"
+checksum = "caa0f4137e1c0a72f4c651489402276c8e8e1cf081f3b0ba156d2cbeef09e86a"
 dependencies = [
- "getrandom 0.3.4",
+ "rand_core",
 ]
 
-[[package]]
-name = "rand_core"
-version = "0.10.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0c8d0fd677905edcbeedbf2edb6494d676f0e98d54d5cf9bda0b061cb8fb8aba"
-
 [[package]]
 name = "redox_syscall"
 version = "0.5.18"
@@ -2069,7 +2041,7 @@ dependencies = [
  "clap_mangen",
  "crossterm",
  "dirs",
- "rand 0.10.1",
+ "rand",
  "reqwest",
  "serde",
  "serde_json",
@@ -2565,26 +2537,6 @@ dependencies = [
  "synstructure",
 ]
 
-[[package]]
-name = "zerocopy"
-version = "0.8.47"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "efbb2a062be311f2ba113ce66f697a4dc589f85e78a4aea276200804cea0ed87"
-dependencies = [
- "zerocopy-derive",
-]
-
-[[package]]
-name = "zerocopy-derive"
-version = "0.8.47"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0e8bc7269b54418e7aeeef514aa68f8690b8c0489a06b0136e5f57c4c5ccab89"
-dependencies = [
- "proc-macro2",
- "quote",
- "syn",
-]
-
 [[package]]
 name = "zerofrom"
 version = "0.1.6"
```

---

### Incident Patch 2: `01a83852` (2026-04-30)
**Commit Message**: build(deps): bump rand from 0.10.0 to 0.10.1 (#56)

Bumps [rand](https://github.com/rust-random/rand) from 0.10.0 to 0.10.1.
- [Release notes](https://github.com/rust-random/rand/releases)
- [Changelog](https://github.com/rust-random/rand/blob/master/CHANGELOG.md)
- [Commits](https://github.com/rust-random/rand/compare/0.10.0...0.10.1)

---
updated-dependencies:
- dependency-name: rand
  dependency-version: 0.10.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +3/-3)
```diff
@@ -1193,9 +1193,9 @@ dependencies = [
 
 [[package]]
 name = "rand"
-version = "0.10.0"
+version = "0.10.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bc266eb313df6c5c09c1c7b1fbe2510961e5bcd3add930c1e31f7ed9da0feff8"
+checksum = "d2e8e8bcc7961af1fdac401278c6a831614941f6164ee3bf4ce61b7edb162207"
 dependencies = [
  "chacha20",
  "getrandom 0.4.2",
@@ -2069,7 +2069,7 @@ dependencies = [
  "clap_mangen",
  "crossterm",
  "dirs",
- "rand 0.10.0",
+ "rand 0.10.1",
  "reqwest",
  "serde",
  "serde_json",
```

---

### Incident Patch 3: `eed10cb4` (2026-04-30)
**Commit Message**: build(deps): bump rustls-webpki from 0.103.10 to 0.103.13 (#55)

Bumps [rustls-webpki](https://github.com/rustls/webpki) from 0.103.10 to 0.103.13.
- [Release notes](https://github.com/rustls/webpki/releases)
- [Commits](https://github.com/rustls/webpki/compare/v/0.103.10...v/0.103.13)

---
updated-dependencies:
- dependency-name: rustls-webpki
  dependency-version: 0.103.13
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1400,9 +1400,9 @@ checksum = "f87165f0995f63a9fbeea62b64d10b4d9d8e78ec6d7d51fb2125fda7bb36788f"
 
 [[package]]
 name = "rustls-webpki"
-version = "0.103.10"
+version = "0.103.13"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "df33b2b81ac578cabaf06b89b0631153a3f416b0a886e8a7a1707fb51abbd1ef"
+checksum = "61c429a8649f110dddef65e2a5ad240f747e85f7758a6bccc7e5777bd33f756e"
 dependencies = [
  "aws-lc-rs",
  "ring",
```

---

### Incident Patch 4: `e7032c92` (2026-04-27)
**Commit Message**: fix(nix): fix package reference in hm-module.nix (#54)

Fix default package reference for host platform

**File**: `nix/hm-module.nix` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
 
         package = lib.mkOption {
           type = lib.types.package;
-          default = self.packages.${pkgs.system}.default;
+          default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
           description = "The weathr package to install.";
         };
 
```

---

### Incident Patch 5: `36666b10` (2026-03-31)
**Commit Message**: ci: install linux packaging toolchains

**File**: `.github/workflows/release-dry-run.yml` (modified, +6/-0)
```diff
@@ -110,6 +110,12 @@ jobs:
         with:
           go-version: stable
 
+      - name: Install Linux packaging toolchains
+        shell: bash
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y musl-tools pkg-config
+
       - name: Install nfpm
         shell: bash
         run: |
```

**File**: `.github/workflows/release.yml` (modified, +6/-0)
```diff
@@ -128,6 +128,12 @@ jobs:
         with:
           go-version: stable
 
+      - name: Install Linux packaging toolchains
+        shell: bash
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y musl-tools pkg-config
+
       - name: Install nfpm
         shell: bash
         run: |
```

---

### Incident Patch 6: `9abb54ca` (2026-03-30)
**Commit Message**: build: set default-run binary to weathr

**File**: `Cargo.toml` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 [package]
 name = "weathr"
+default-run = "weathr"
 version = "1.4.0"
 edition = "2024"
 rust-version = "1.85.0"
```

---

### Incident Patch 7: `398ca056` (2026-03-30)
**Commit Message**: feat(ci): add linux package generation (deb, rpm, apk)

**File**: `.github/workflows/release-dry-run.yml` (modified, +60/-0)
```diff
@@ -88,3 +88,63 @@ jobs:
           max_glibc="$(readelf --version-info target/${{ matrix.target }}/release/${{ matrix.artifact_name }} | grep -o 'GLIBC_[0-9.]*' | sort -V | tail -1)"
           echo "max required glibc: $max_glibc"
           [ "$(printf '%s\n' "$max_glibc" "GLIBC_2.17" | sort -V | tail -1)" = "GLIBC_2.17" ]
+
+  package-linux-dry-run:
+    name: Package Linux Dry Run
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v6
+
+      - uses: dtolnay/rust-toolchain@stable
+        with:
+          toolchain: stable
+          targets: |
+            x86_64-unknown-linux-gnu
+            x86_64-unknown-linux-musl
+
+      - uses: Swatinem/rust-cache@v2
+        with:
+          key: packages-dry-run-x86_64-unknown-linux-gnu
+
+      - uses: actions/setup-go@v6
+        with:
+          go-version: stable
+
+      - name: Install nfpm
+        shell: bash
+        run: |
+          go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
+          echo "$(go env GOPATH)/bin" >> "$GITHUB_PATH"
+
+      - name: Build package inputs
+        shell: bash
+        run: |
+          cargo build --locked --release --target x86_64-unknown-linux-gnu --bin weathr
+          cargo build --locked --release --target x86_64-unknown-linux-musl --bin weathr
+          cargo build --locked --release --bin generate-manpage
+
+      - name: Build .deb, .rpm, and .apk
+        shell: bash
+        run: |
+          VERSION="$(cargo metadata --no-deps --format-version 1 | python -c 'import json,sys; print(json.load(sys.stdin)["packages"][0]["version"])')"
+          ./scripts/package-linux.sh \
+            "$VERSION" \
+            amd64 \
+            target/x86_64-unknown-linux-gnu/release/weathr \
+            dist/packages \
+            deb,rpm
+          ./scripts/package-linux.sh \
+            "$VERSION" \
+            x86_64 \
+            target/x86_64-unknown-linux-musl/release/weathr \
+            dist/packages \
+            apk
+
+      - name: Upload package artifacts
+        uses: actions/upload-artifact@v4
+        with:
+          name: linux-packages-dry-run
+          path: |
+            dist/packages/*.deb
+            dist/packages/*.rpm
+            dist/packages/*.apk
```

**File**: `.github/workflows/release.yml` (modified, +63/-0)
```diff
@@ -106,6 +106,69 @@ jobs:
         with:
           files: ${{ matrix.asset_name }}
 
+  package-linux:
+    name: Package Linux
+    runs-on: ubuntu-latest
+    if: startsWith(github.ref, 'refs/tags/')
+    steps:
+      - uses: actions/checkout@v6
+
+      - uses: dtolnay/rust-toolchain@stable
+        with:
+          toolchain: stable
+          targets: |
+            x86_64-unknown-linux-gnu
+            x86_64-unknown-linux-musl
+
+      - uses: Swatinem/rust-cache@v2
+        with:
+          key: packages-x86_64-unknown-linux-gnu
+
+      - uses: actions/setup-go@v6
+        with:
+          go-version: stable
+
+      - name: Install nfpm
+        shell: bash
+        run: |
+          go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
+          echo "$(go env GOPATH)/bin" >> "$GITHUB_PATH"
+
+      - name: Build package inputs
+        shell: bash
+        run: |
+          cargo build --locked --release --target x86_64-unknown-linux-gnu --bin weathr
+          cargo build --locked --release --target x86_64-unknown-linux-musl --bin weathr
+          cargo build --locked --release --bin generate-manpage
+
+      - name: Build .deb and .rpm
+        shell: bash
+        run: |
+          ./scripts/package-linux.sh \
+            "${GITHUB_REF_NAME#v}" \
+            amd64 \
+            target/x86_64-unknown-linux-gnu/release/weathr \
+            dist/packages \
+            deb,rpm
+
+      - name: Build .apk
+        shell: bash
+        run: |
+          ./scripts/package-linux.sh \
+            "${GITHUB_REF_NAME#v}" \
+            x86_64 \
+            target/x86_64-unknown-linux-musl/release/weathr \
+            dist/packages \
+            apk
+
+      - name: Upload Release Assets
+        uses: softprops/action-gh-release@v2
+        with:
+          files: |
+            dist/packages/*.deb
+            dist/packages/*.rpm
+            dist/packages/*.apk
+
   publish-crate:
     name: Publish to crates.io
     runs-on: ubuntu-latest
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
 /target
 /result
+dist
```

**File**: `scripts/package-linux.sh` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+#!/bin/sh
+set -eu
+
+if [ "$#" -ne 5 ]; then
+    echo "usage: $0 <version> <arch> <binary-path> <output-dir> <packagers>" >&2
+    exit 1
+fi
+
+VERSION="$1"
+ARCH="$2"
+BINARY_PATH="$3"
+OUTPUT_DIR="$4"
+PACKAGERS="$5"
+PACKAGE_ROOT="target/package-root"
+MANPAGE_DIR="$PACKAGE_ROOT/usr/share/man/man1"
+BINARY_DIR="$PACKAGE_ROOT/usr/bin"
+DOC_DIR="$PACKAGE_ROOT/usr/share/doc/weathr"
+NFPMSPEC="target/nfpm.yaml"
+
+rm -rf "$PACKAGE_ROOT"
+mkdir -p "$BINARY_DIR" "$MANPAGE_DIR" "$DOC_DIR" "$OUTPUT_DIR"
+
+install -m755 "$BINARY_PATH" "$BINARY_DIR/weathr"
+cargo run --locked --release --bin generate-manpage -- "$MANPAGE_DIR/weathr.1"
+gzip -9f "$MANPAGE_DIR/weathr.1"
+install -m644 README.md "$DOC_DIR/README.md"
+install -m644 LICENSE "$DOC_DIR/LICENSE"
+
+cat > "$NFPMSPEC" <<EOF
+name: weathr
+arch: ${ARCH}
+platform: linux
+version: ${VERSION}
+release: 1
+section: utils
+priority: optional
+maintainer: Dony Mulya <veirt@duck.com>
+description: |
+  Terminal-based ASCII weather application with animated scenes driven by real-time weather data.
+homepage: https://github.com/veirt/weathr
+license: GPL-3.0-or-later
+contents:
+  - src: ${PACKAGE_ROOT}/usr/bin/weathr
+    dst: /usr/bin/weathr
+  - src: ${PACKAGE_ROOT}/usr/share/man/man1/weathr.1.gz
+    dst: /usr/share/man/man1/weathr.1.gz
+  - src: README.md
+    dst: /usr/share/doc/weathr/README.md
+  - src: LICENSE
+    dst: /usr/share/doc/weathr/LICENSE
+rpm:
+  group: Applications/Utilities
+EOF
+
+OLD_IFS="$IFS"
+IFS=,
+set -- $PACKAGERS
+IFS="$OLD_IFS"
+
+for packager in "$@"; do
+    nfpm package --config "$NFPMSPEC" --target "$OUTPUT_DIR" --packager "$packager"
+done
```

---

### Incident Patch 8: `297d72dc` (2026-03-21)
**Commit Message**: docs: fix readme [skip ci]

**File**: `README.md` (modified, +2/-3)
```diff
@@ -94,16 +94,15 @@ Mount your config if you want to use your existing settings:
 
 ```bash
 docker run --rm -it \
-  -v "$HOME/.config/weathr:/root/.config/weathr:ro" \
+  -v "$HOME/.config/weathr:/.config/weathr:ro" \
   weathr
 ```
 
-````
 ### Homebrew (macOS)
 
 ```bash
 brew install Veirt/veirt/weathr
-````
+```
 
 ### MacPorts (macOS)
 
```

---

### Incident Patch 9: `86ad9977` (2026-03-21)
**Commit Message**: build: add docker support

**File**: `.dockerignore` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+.git
+.github
+/target
+/result
+docs
+flake.lock
+flake.nix
+nix
+tests
```

**File**: `.github/workflows/docker-publish.yml` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+name: Docker Publish
+
+on:
+  push:
+    branches:
+      - main
+    tags:
+      - "v*"
+  workflow_dispatch:
+
+permissions:
+  contents: read
+  packages: write
+
+env:
+  REGISTRY: ghcr.io
+  IMAGE_NAME: ${{ github.repository }}
+
+jobs:
+  publish:
+    name: Build and Publish Docker Image
+    runs-on: ubuntu-latest
+
+    steps:
+      - uses: actions/checkout@v6
+
+      - name: Set up QEMU
+        uses: docker/setup-qemu-action@v3
+
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@v3
+
+      - name: Extract Docker metadata
+        id: meta
+        uses: docker/metadata-action@v5
+        with:
+          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
+          tags: |
+            type=ref,event=branch
+            type=ref,event=pr
+            type=sha
+            type=semver,pattern={{version}}
+            type=semver,pattern={{major}}.{{minor}}
+            type=raw,value=latest,enable={{is_default_branch}}
+          labels: |
+            org.opencontainers.image.title=weathr
+            org.opencontainers.image.description=Terminal-based ASCII weather application
+
+      - name: Log in to GHCR
+        uses: docker/login-action@v3
+        with:
+          registry: ${{ env.REGISTRY }}
+          username: ${{ github.actor }}
+          password: ${{ secrets.GITHUB_TOKEN }}
+
+      - name: Build and push image
+        uses: docker/build-push-action@v6
+        with:
+          context: .
+          pull: true
+          push: true
+          tags: ${{ steps.meta.outputs.tags }}
+          labels: ${{ steps.meta.outputs.labels }}
+          cache-from: type=gha
+          cache-to: type=gha,mode=max
+          provenance: true
+          sbom: true
```

**File**: `Dockerfile` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+# syntax=docker/dockerfile:1
+
+ARG RUST_VERSION=1.94
+ARG DEBIAN_RELEASE=trixie
+
+FROM rust:${RUST_VERSION}-${DEBIAN_RELEASE} AS builder
+WORKDIR /app
+
+COPY Cargo.toml Cargo.lock ./
+RUN mkdir src && printf 'fn main() {}\n' > src/main.rs
+RUN --mount=type=cache,target=/usr/local/cargo/registry \
+    --mount=type=cache,target=/usr/local/cargo/git/db \
+    --mount=type=cache,target=/app/target \
+    cargo build --locked --release && rm -rf src
+
+COPY src ./src
+RUN --mount=type=cache,target=/usr/local/cargo/registry \
+    --mount=type=cache,target=/usr/local/cargo/git/db \
+    --mount=type=cache,target=/app/target \
+    cargo build --locked --release
+
+RUN --mount=type=cache,target=/usr/local/cargo/registry \
+    --mount=type=cache,target=/usr/local/cargo/git/db \
+    --mount=type=cache,target=/app/target \
+    mkdir -p /out \
+    && cp target/release/weathr /out/weathr \
+    && cp --parents /lib64/ld-linux-x86-64.so.2 /out \
+    && ldd target/release/weathr | awk '/=> \/|^\// { print $(NF-1) }' | sort -u | xargs -r -I '{}' cp --parents '{}' /out
+
+FROM debian:${DEBIAN_RELEASE}-slim AS runtime-assets
+
+RUN apt-get update \
+    && apt-get install --yes --no-install-recommends ca-certificates tzdata \
+    && rm -rf /var/lib/apt/lists/*
+
+FROM scratch
+
+LABEL org.opencontainers.image.source="https://github.com/Veirt/weathr"
+LABEL org.opencontainers.image.description="Terminal-based ASCII weather application"
+
+ENV HOME=/
+
+COPY --from=builder /out/ /
+COPY --from=runtime-assets /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
+COPY --from=runtime-assets /usr/share/zoneinfo /usr/share/zoneinfo
+COPY --from=runtime-assets /etc/localtime /etc/localtime
+
+WORKDIR /
+ENTRYPOINT ["/weathr"]
```

**File**: `README.md` (modified, +38/-1)
```diff
@@ -62,11 +62,48 @@ cd weathr
 cargo install --path .
 ```
 
+### Docker
+
+Run the published image from GHCR:
+
+```bash
+docker run --rm -it ghcr.io/veirt/weathr:latest
+```
+
+Mount your config if you want to use your existing settings:
+
+```bash
+docker run --rm -it \
+  -v "$HOME/.config/weathr:/.config/weathr:ro" \
+  ghcr.io/veirt/weathr:latest
+```
+
+Build the image locally:
+
+```bash
+docker build -t weathr .
+```
+
+Run it interactively so the TUI can access your terminal:
+
+```bash
+docker run --rm -it weathr
+```
+
+Mount your config if you want to use your existing settings:
+
+```bash
+docker run --rm -it \
+  -v "$HOME/.config/weathr:/root/.config/weathr:ro" \
+  weathr
+```
+
+````
 ### Homebrew (macOS)
 
 ```bash
 brew install Veirt/veirt/weathr
-```
+````
 
 ### MacPorts (macOS)
 
```

---

### Incident Patch 10: `d4e2dd4a` (2026-03-18)
**Commit Message**: refactor: modularize scene/theme rendering, externalize ASCII assets (#42)

* refactor(animation): unify animation systems with a trait for better maintainability

* feat(theme): add theming system and scene registry

* refactor(assets): extract ascii art to dedicated files

* fix(decorations): skip mailbox if tree x is too small

* refactor(app): optimize scene size update calls

* feat(app): improve theme validation and sun logic

* refactor(app): remove side effects from theme resolution

**File**: `src/animation/airplanes.rs` (modified, +50/-14)
```diff
@@ -1,6 +1,8 @@
+use crate::animation::{AnimationSystem, FrameCommands, FrameContext, RenderLayer, TerminalSize};
 use crate::render::TerminalRenderer;
 use crossterm::style::Color;
-use rand::prelude::*;
+
+use rand::{Rng, RngExt};
 use std::io;
 
 #[derive(Clone)]
@@ -27,7 +29,12 @@ impl AirplaneSystem {
         }
     }
 
-    pub fn update(&mut self, terminal_width: u16, terminal_height: u16, rng: &mut impl Rng) {
+    pub fn update(
+        &mut self,
+        terminal_width: u16,
+        terminal_height: u16,
+        rng: &mut (impl Rng + ?Sized),
+    ) {
         self.terminal_width = terminal_width;
         self.terminal_height = terminal_height;
 
@@ -44,29 +51,22 @@ impl AirplaneSystem {
         }
     }
 
-    fn spawn_plane(&mut self, rng: &mut impl Rng) {
-        let y = (rng.random::<u16>() % (self.terminal_height / 4)) as f32;
+    fn spawn_plane(&mut self, rng: &mut (impl Rng + ?Sized)) {
+        let spawn_band = (self.terminal_height / 4).max(1);
+        let y = (rng.random::<u16>() % spawn_band) as f32;
         let speed = 0.3 + (rng.random::<f32>() * 0.2);
 
         self.planes.push(Airplane { x: 0.0, y, speed });
     }
 
     pub fn render(&self, renderer: &mut TerminalRenderer) -> io::Result<()> {
-        let airplane_art = [
-            "           _",
-            "         -=\\`\\",
-            "     |\\ ____\\_\\__",
-            "   -=\\c`\"\"\"\"\"\"\" \"`)",
-            "      `~~~~~/ /~~`",
-            "        -==/ /",
-            "          '-'",
-        ];
+        const AIRPLANE_ART: &str = include_str!("assets/airplane.txt");
 
         for plane in &self.planes {
             let x = plane.x as u16;
             let y = plane.y as u16;
 
-            for (line_offset, line) in airplane_art.iter().enumerate() {
+            for (line_offset, line) in AIRPLANE_ART.lines().enumerate() {
                 let render_y = y + line_offset as u16;
                 if render_y >= self.terminal_height {
                     break;
@@ -98,3 +98,39 @@ impl AirplaneSystem {
         Ok(())
     }
 }
+
+impl AnimationSystem for AirplaneSystem {
+    fn id(&self) -> &'static str {
+        "airplanes"
+    }
+
+    fn layer(&self) -> RenderLayer {
+        RenderLayer::Background
+    }
+
+    fn is_active(&self, ctx: &FrameContext<'_>) -> bool {
+        !ctx.conditions.is_raining
+            && !ctx.conditions.is_thunderstorm
+            && !ctx.conditions.is_snowing
+            && !ctx.conditions.is_foggy
+    }
+
+    fn on_resize(&mut self, size: TerminalSize) {
+        self.terminal_width = size.width;
+        self.terminal_height = size.height;
+        self.planes
+            .retain(|p| p.x < size.width as f32 && p.y < size.height as f32);
+    }
+
+    fn update(&mut self, ctx: &FrameContext<'_>, rng: &mut dyn Rng, _commands: &mut FrameCommands) {
+        self.update(ctx.size.width, ctx.size.height, rng);
+    }
+
+    fn render(
+        &mut self,
+        renderer: &mut TerminalRenderer,
+        _ctx: &FrameContext<'_>,
+    ) -> io::Result<()> {
+        AirplaneSystem::render(self, renderer)
+    }
+}
```

**File**: `src/animation/assets/airplane.txt` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+           _
+         -=\`\
+     |\ ____\_\__
+   -=\c`""""""" "`)
+      `~~~~~/ /~~`
+        -==/ /
+          '-'
\ No newline at end of file
```

**File**: `src/animation/assets/cloud_0.txt` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+   .--.   
+ .-(    ). 
+(___.__)_)
\ No newline at end of file
```

**File**: `src/animation/assets/cloud_1.txt` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+      _  _   
+    ( `   )_ 
+   (    )    `)
+    \_  (___  )
\ No newline at end of file
```

**File**: `src/animation/assets/cloud_2.txt` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+     .--.    
+  .-(    ).  
+ (___.__)__) 
\ No newline at end of file
```

**File**: `src/animation/assets/cloud_3.txt` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+   _  _   
+  ( `   )_ 
+ (    )   `)
+  `--'     
\ No newline at end of file
```

**File**: `src/animation/assets/moon/phase_0.txt` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+                 
+                 
+                 
+                 
+                 
+                 
\ No newline at end of file
```

**File**: `src/animation/assets/moon/phase_1.txt` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+             .    
+            . `.  
+               :  
+               :  
+            . .'  
+             `    
\ No newline at end of file
```

---

### Incident Patch 11: `cf1e0b20` (2026-03-16)
**Commit Message**: build(deps): bump quinn-proto from 0.11.13 to 0.11.14 (#51)

Bumps [quinn-proto](https://github.com/quinn-rs/quinn) from 0.11.13 to 0.11.14.
- [Release notes](https://github.com/quinn-rs/quinn/releases)
- [Commits](https://github.com/quinn-rs/quinn/compare/quinn-proto-0.11.13...quinn-proto-0.11.14)

---
updated-dependencies:
- dependency-name: quinn-proto
  dependency-version: 0.11.14
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +5/-5)
```diff
@@ -1118,9 +1118,9 @@ dependencies = [
 
 [[package]]
 name = "quinn-proto"
-version = "0.11.13"
+version = "0.11.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f1906b49b0c3bc04b5fe5d86a77925ae6524a19b816ae38ce1e426255f1d8a31"
+checksum = "434b42fec591c96ef50e21e886936e66d3cc3f737104fdb9b737c40ffb94c098"
 dependencies = [
  "aws-lc-rs",
  "bytes",
@@ -1149,7 +1149,7 @@ dependencies = [
  "once_cell",
  "socket2",
  "tracing",
- "windows-sys 0.52.0",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -1369,7 +1369,7 @@ dependencies = [
  "security-framework",
  "security-framework-sys",
  "webpki-root-certs",
- "windows-sys 0.52.0",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -2108,7 +2108,7 @@ version = "0.1.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c2a7b1c03c876122aa43f3020e6c3c3ee5c05081c9a00739faf7503aeba10d22"
 dependencies = [
- "windows-sys 0.52.0",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
```

---

### Incident Patch 12: `b37221b1` (2026-03-08)
**Commit Message**: fix(aad): time parsing for Daylight time (#44)

**File**: `src/weather/provider/supplementary/aad.rs` (modified, +1/-1)
```diff
@@ -190,7 +190,7 @@ struct SunData {
 
 impl SunData {
     fn get_time(&self) -> String {
-        self.time.clone().replace("  ST", "") // Unsure what ST stands for, but its not needed
+        self.time.clone().replace("  ST", "").replace("  DT", "") // Figured out what ST and DT mean (Standard Time & Daylight Time)
     }
 
     fn to_chrono_time(&self) -> Result<NaiveTime, WeatherError> {
```

---

### Incident Patch 13: `af1e90e6` (2026-03-06)
**Commit Message**: feat(install): add quick install script [skip ci]

**File**: `README.md` (modified, +8/-0)
```diff
@@ -38,6 +38,14 @@ Features real-time weather from Open-Meteo with animated rain, snow, thunderstor
 
 ## Installation
 
+### Quick Install (macOS, Linux, FreeBSD)
+
+Download and install the latest binary with one command:
+
+```sh
+curl -fsSL https://raw.githubusercontent.com/Veirt/weathr/main/install.sh | sh
+```
+
 ### Via Cargo
 
 ```bash
```

**File**: `install.sh` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+#!/bin/sh
+set -eu
+
+REPO="Veirt/weathr"
+
+require_commands() {
+    for cmd in curl mktemp sed grep uname head; do
+        command -v "$cmd" >/dev/null 2>&1 || {
+            echo "Error: required command '$cmd' not found" >&2
+            exit 1
+        }
+    done
+}
+
+detect_os() {
+    os="$(uname -s)"
+
+    case "$os" in
+        Linux*)   echo "linux" ;;
+        Darwin*)  echo "macos" ;;
+        FreeBSD*) echo "freebsd" ;;
+        *)
+            echo "Error: unsupported OS: $os" >&2
+            exit 1
+            ;;
+    esac
+}
+
+detect_arch() {
+    arch="$(uname -m)"
+
+    case "$arch" in
+        x86_64|amd64) echo "amd64" ;;
+        aarch64|arm64) echo "arm64" ;;
+        *)
+            echo "Error: unsupported architecture: $arch" >&2
+            exit 1
+            ;;
+    esac
+}
+
+detect_libc() {
+    os="$1"
+
+    if [ "$os" != "linux" ]; then
+        echo ""
+        return 0
+    fi
+
+    if command -v ldd >/dev/null 2>&1 && ldd /bin/sh 2>&1 | grep -q musl; then
+        echo "-musl"
+    else
+        echo ""
+    fi
+}
+
+get_latest_tag() {
+    curl -fsSL -I -o /dev/null -w '%{url_effective}' \
+        "https://github.com/${REPO}/releases/latest" \
+        | sed 's#.*/##'
+}
+
+build_binary_name() {
+    os="$1"
+    arch="$2"
+    libc="$3"
+
+    if [ -z "$libc" ]; then
+        echo "weathr-${os}-${arch}"
+    else
+        echo "weathr-${os}${libc}-${arch}"
+    fi
+}
+
+download_binary() {
+    url="$1"
+    output="$2"
+
+    if ! curl -fSL --retry 3 --retry-delay 1 "$url" -o "$output"; then
+        echo "Error: failed to download binary" >&2
+        exit 1
+    fi
+
+    if [ ! -s "$output" ]; then
+        echo "Error: download incomplete or empty" >&2
+        exit 1
+    fi
+}
+
+install_binary() {
+    src="$1"
+
+    install_dir="$HOME/.local/bin"
+    if [ "$(id -u)" -eq 0 ]; then
+        install_dir="/usr/local/bin"
+    fi
+
+    mkdir -p "$install_dir"
+    mv "$src" "$install_dir/weathr"
+
+    echo "✓ weathr installed to $install_dir/weathr"
+
+    case ":$PATH:" in
+        *":$install_dir:"*|*":$install_dir/:"*) ;;
+        *)
+            echo ""
+            echo "Note: $install_dir is not in your PATH"
+            echo "Add this to your shell config:"
+            echo "export PATH=\"\$PATH:$install_dir\""
+            ;;
+    esac
+}
+
+main() {
+    echo "Installing weathr..."
+
+    require_commands
+
+    OS="$(detect_os)"
+    ARCH="$(detect_arch)"
+    LIBC="$(detect_libc "$OS")"
+
+    if [ "$OS" = "freebsd" ] && [ "$ARCH" != "amd64" ]; then
+        echo "Error: FreeBSD is only supported on x86_64" >&2
+        exit 1
+    fi
+
+    BINARY_NAME="$(build_binary_name "$OS" "$ARCH" "$LIBC")"
+    LATEST_TAG="$(get_latest_tag)"
+
+    if [ -z "$LATEST_TAG" ] || [ "$LATEST_TAG" = "null" ]; then
+        echo "Error: could not determine latest release" >&2
+        exit 1
+    fi
+
+    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${BINARY_NAME}"
+
+    if [ -z "$LIBC" ]; then
+        echo "Detected platform: $OS $ARCH"
+    else
+        echo "Detected platform: $OS $ARCH $LIBC"
+    fi
+    echo "Latest release: $LATEST_TAG"
+    echo "Downloading ${BINARY_NAME}..."
+
+    TMP_DIR="$(mktemp -d)"
+    trap 'rm -rf -- "$TMP_DIR"' EXIT
+
+    download_binary "$DOWNLOAD_URL" "$TMP_DIR/weathr"
+
+    chmod +x "$TMP_DIR/weathr"
+
+    install_binary "$TMP_DIR/weathr"
+}
+
+main "$@"
```

---

### Incident Patch 14: `56aa86fe` (2026-02-27)
**Commit Message**: fix(client): raise error http response status is not ok (#38)

**File**: `src/geolocation.rs` (modified, +8/-3)
```diff
@@ -66,9 +66,14 @@ async fn fetch_location() -> Result<GeoLocation, GeolocationError> {
         .build()
         .map_err(|e| GeolocationError::Unreachable(NetworkError::ClientCreation(e)))?;
 
-    let response = client.get(IPINFO_URL).send().await.map_err(|e| {
-        GeolocationError::Unreachable(NetworkError::from_reqwest(e, IPINFO_URL, 10))
-    })?;
+    let response = client
+        .get(IPINFO_URL)
+        .send()
+        .await
+        .and_then(|resp| resp.error_for_status())
+        .map_err(|e| {
+            GeolocationError::Unreachable(NetworkError::from_reqwest(e, IPINFO_URL, 10))
+        })?;
 
     let ip_info: IpInfoResponse = response.json().await.map_err(|e| {
         GeolocationError::Unreachable(NetworkError::from_reqwest(e, IPINFO_URL, 10))
```

**File**: `src/weather/open_meteo.rs` (modified, +1/-0)
```diff
@@ -135,6 +135,7 @@ impl WeatherProvider for OpenMeteoProvider {
             .get(&url)
             .send()
             .await
+            .and_then(|resp| resp.error_for_status())
             .map_err(|e| WeatherError::Network(NetworkError::from_reqwest(e, &url, 30)))?;
 
         let data: OpenMeteoResponse = response
```

---

### Incident Patch 15: `9322b280` (2026-02-26)
**Commit Message**: build(release): use cross for linux builds and check glibc

fix #35

**File**: `.github/workflows/release-dry-run.yml` (modified, +9/-1)
```diff
@@ -15,7 +15,7 @@ jobs:
             target: x86_64-unknown-linux-gnu
             artifact_name: weathr
             asset_name: weathr-linux-amd64
-            use_cross: false
+            use_cross: true
           - os: ubuntu-latest
             target: aarch64-unknown-linux-gnu
             artifact_name: weathr
@@ -80,3 +80,11 @@ jobs:
       - name: Build (with cargo)
         if: matrix.use_cross != true
         run: cargo build --release --target ${{ matrix.target }}
+
+      - name: ABI Check (glibc floor)
+        if: matrix.target == 'x86_64-unknown-linux-gnu'
+        shell: bash
+        run: |
+          max_glibc="$(readelf --version-info target/${{ matrix.target }}/release/${{ matrix.artifact_name }} | grep -o 'GLIBC_[0-9.]*' | sort -V | tail -1)"
+          echo "max required glibc: $max_glibc"
+          [ "$(printf '%s\n' "$max_glibc" "GLIBC_2.17" | sort -V | tail -1)" = "GLIBC_2.17" ]
```

**File**: `.github/workflows/release.yml` (modified, +9/-1)
```diff
@@ -20,7 +20,7 @@ jobs:
             target: x86_64-unknown-linux-gnu
             artifact_name: weathr
             asset_name: weathr-linux-amd64
-            use_cross: false
+            use_cross: true
           - os: ubuntu-latest
             target: aarch64-unknown-linux-gnu
             artifact_name: weathr
@@ -86,6 +86,14 @@ jobs:
         if: matrix.use_cross != true
         run: cargo build --release --target ${{ matrix.target }}
 
+      - name: ABI Check (glibc floor)
+        if: matrix.target == 'x86_64-unknown-linux-gnu'
+        shell: bash
+        run: |
+          max_glibc="$(readelf --version-info target/${{ matrix.target }}/release/${{ matrix.artifact_name }} | grep -o 'GLIBC_[0-9.]*' | sort -V | tail -1)"
+          echo "max required glibc: $max_glibc"
+          [ "$(printf '%s\n' "$max_glibc" "GLIBC_2.17" | sort -V | tail -1)" = "GLIBC_2.17" ]
+
       - name: Prepare Asset
         shell: bash
         run: |
```

**File**: `Cross.toml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+[target.x86_64-unknown-linux-gnu]
+image = "ghcr.io/cross-rs/x86_64-unknown-linux-gnu@sha256:3985c9ccdc5388e888858b17947701959c6a10b84bd078398305621335ceacdb"
+
+[target.x86_64-unknown-linux-gnu.zig]
+enable = true
+version = "2.17"
+
+[target.aarch64-unknown-linux-gnu]
+image = "ghcr.io/cross-rs/aarch64-unknown-linux-gnu@sha256:2619e5d69735cf047b0b27466f2d8e8b2ce33f3ef8276d840ad9417f8b5c740e"
+
+[target.aarch64-unknown-linux-gnu.zig]
+enable = true
+version = "2.17"
```

#### Recent Merged Pull Requests:
- **PR #66** (2026-08-12): build(deps): bump quinn-proto from 0.11.14 to 0.11.16 (@dependabot[bot])
- **PR #63** (closed): feat: display current time as ASCII art in the sky (@peixuanthomas)
- **PR #57** (2026-05-06): Added Winget to the "Packaging Status" section. (@DandelionSprout)
- **PR #56** (2026-04-30): build(deps): bump rand from 0.10.0 to 0.10.1 (@dependabot[bot])
- **PR #55** (2026-04-30): build(deps): bump rustls-webpki from 0.103.10 to 0.103.13 (@dependabot[bot])
- **PR #54** (2026-04-27): Update package reference syntax in hm-module.nix (@MaySeikatsu)
- **PR #51** (2026-03-16): build(deps): bump quinn-proto from 0.11.13 to 0.11.14 (@dependabot[bot])
- **PR #44** (2026-03-08): Fix(aad): time parsing for Daylight time (@marcohoovy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
