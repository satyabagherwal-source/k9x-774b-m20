# Forensic Learning Record (Deep Inspection): Veirt/weathr

> **Canonical Artifact**: `07_PROJECT_LEARNING/veirt-weathr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Veirt/weathr](https://github.com/Veirt/weathr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:31:27.049Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Veirt/weathr`
- **Description**: a terminal weather app with ascii animation
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 3062 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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

### Incident Patch 1: `e7032c92` (2026-04-27)
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

### Incident Patch 2: `297d72dc` (2026-03-21)
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

### Incident Patch 3: `b37221b1` (2026-03-08)
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

### Incident Patch 4: `56aa86fe` (2026-02-27)
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

### Incident Patch 5: `a97449c3` (2026-02-26)
**Commit Message**: fix(open-meteo): handle float values for integer fields

**File**: `src/weather/open_meteo.rs` (modified, +25/-0)
```diff
@@ -6,6 +6,7 @@ use crate::weather::types::{
 use crate::weather::units::{normalize_precipitation, normalize_temperature, normalize_wind_speed};
 use async_trait::async_trait;
 use serde::Deserialize;
+use serde::de::{self, Deserializer};
 use std::time::Duration;
 
 const OPEN_METEO_BASE_URL: &str = "https://api.open-meteo.com/v1/forecast";
@@ -26,8 +27,10 @@ struct CurrentWeather {
     temperature_2m: f64,
     relative_humidity_2m: f64,
     apparent_temperature: f64,
+    #[serde(deserialize_with = "deserialize_i32_from_number")]
     is_day: i32,
     precipitation: f64,
+    #[serde(deserialize_with = "deserialize_i32_from_number")]
     weather_code: i32,
     cloud_cover: f64,
     surface_pressure: f64,
@@ -37,6 +40,28 @@ struct CurrentWeather {
     visibility: Option<f64>,
 }
 
+fn deserialize_i32_from_number<'de, D>(deserializer: D) -> Result<i32, D::Error>
+where
+    D: Deserializer<'de>,
+{
+    #[derive(Deserialize)]
+    #[serde(untagged)]
+    enum Number {
+        Integer(i32),
+        Float(f64),
+    }
+
+    match Number::deserialize(deserializer)? {
+        Number::Integer(value) => Ok(value),
+        Number::Float(value) => {
+            if !value.is_finite() {
+                return Err(de::Error::custom("expected a finite numeric value"));
+            }
+            Ok(value.round() as i32)
+        }
+    }
+}
+
 impl OpenMeteoProvider {
     pub fn new() -> Self {
         let client = reqwest::Client::builder()
```

---

### Incident Patch 6: `7e3d7cd9` (2026-02-24)
**Commit Message**: fix(stars): filter initial stars and generate only needed

**File**: `src/animation/stars.rs` (modified, +15/-12)
```diff
@@ -41,27 +41,30 @@ impl StarSystem {
         }
     }
 
-    fn create_stars(terminal_width: u16, terminal_height: u16, inital_stars: &[Star]) -> Vec<Star> {
+    fn create_stars(
+        terminal_width: u16,
+        terminal_height: u16,
+        initial_stars: &[Star],
+    ) -> Vec<Star> {
         let mut rng = rand::rng();
-        let count = (terminal_width as usize * terminal_height as usize) / 80; // Density
+        let count = (terminal_width as usize * terminal_height as usize) / 80;
 
-        if count < inital_stars.len() {
-            return inital_stars.to_vec();
-        }
-
-        let mut stars = Vec::with_capacity(count);
-
-        stars.extend(inital_stars.iter().cloned());
+        let mut stars: Vec<Star> = initial_stars
+            .iter()
+            .cloned()
+            .filter(|s| s.x < terminal_width && s.y < terminal_height / 2)
+            .take(count)
+            .collect();
 
-        for _ in 0..count {
+        let needed = count.saturating_sub(stars.len());
+        for _ in 0..needed {
             let mut attempts = 0;
             let max_attempts = 50;
 
             loop {
                 let x = rng.random::<u16>() % terminal_width;
-                let y = rng.random::<u16>() % (terminal_height / 2); // Upper half
+                let y = rng.random::<u16>() % (terminal_height / 2);
 
-                // Check if this position is far enough from existing stars
                 let too_close = stars.iter().any(|star: &Star| {
                     let dx = (star.x as f32 - x as f32).abs();
                     let dy = (star.y as f32 - y as f32).abs();
```

---

### Incident Patch 7: `82202a46` (2026-02-23)
**Commit Message**: fix: update reqwest tls configuration

**File**: `Cargo.lock` (modified, +242/-13)
```diff
@@ -90,6 +90,28 @@ version = "1.5.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
 
+[[package]]
+name = "aws-lc-rs"
+version = "1.15.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7b7b6141e96a8c160799cc2d5adecd5cbbe5054cb8c7c4af53da0f83bb7ad256"
+dependencies = [
+ "aws-lc-sys",
+ "zeroize",
+]
+
+[[package]]
+name = "aws-lc-sys"
+version = "0.37.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b092fe214090261288111db7a2b2c2118e5a7f30dc2569f1732c4069a6840549"
+dependencies = [
+ "cc",
+ "cmake",
+ "dunce",
+ "fs_extra",
+]
+
 [[package]]
 name = "base64"
 version = "0.22.1"
@@ -121,6 +143,8 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "47b26a0954ae34af09b50f0de26458fa95369a0d478d8236d3f93082b219bd29"
 dependencies = [
  "find-msvc-tools",
+ "jobserver",
+ "libc",
  "shlex",
 ]
 
@@ -136,6 +160,12 @@ version = "1.0.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
 
+[[package]]
+name = "cfg_aliases"
+version = "0.2.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
+
 [[package]]
 name = "chacha20"
 version = "0.10.0"
@@ -144,7 +174,7 @@ checksum = "6f8d983286843e49675a4b7a2d174efe136dc93a18d69130dd18198a6c167601"
 dependencies = [
  "cfg-if",
  "cpufeatures",
- "rand_core",
+ "rand_core 0.10.0",
 ]
 
 [[package]]
@@ -209,6 +239,15 @@ version = "0.7.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c3e64b0cc0439b12df2fa678eae89a1c56a529fd067a9115f7827f1fffd22b32"
 
+[[package]]
+name = "cmake"
+version = "0.1.57"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "75443c44cd6b379beb8c5b45d85d0773baf31cce901fe7bb252f4eff3008ef7d"
+dependencies = [
+ "cc",
+]
+
 [[package]]
 name = "colorchoice"
 version = "1.0.4"
@@ -359,6 +398,12 @@ dependencies = [
  "litrs",
 ]
 
+[[package]]
+name = "dunce"
+version = "1.0.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "92773504d58c093f6de2459af4af33faa518c13451eb8f2b5698ed3d36e7c813"
+
 [[package]]
 name = "encoding_rs"
 version = "0.8.35"
@@ -411,6 +456,12 @@ dependencies = [
  "percent-encoding",
 ]
 
+[[package]]
+name = "fs_extra"
+version = "1.3.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "42703706b716c37f96a77aea830392ad231f44c9e9a67872fa5548707e11b11c"
+
 [[package]]
 name = "futures-channel"
 version = "0.3.31"
@@ -458,8 +509,24 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ff2abc00be7fca6ebc474524697ae276ad847ad0a6b3faa4bcb027e9a4614ad0"
 dependencies = [
  "cfg-if",
+ "js-sys",
  "libc",
  "wasi",
+ "wasm-bindgen",
+]
+
+[[package]]
+name = "getrandom"
+version = "0.3.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "899def5c37c4fd7b2664648c28120ecec138e4d395b459e5ca34f9cce2dd77fd"
+dependencies = [
+ "cfg-if",
+ "js-sys",
+ "libc",
+ "r-efi",
+ "wasip2",
+ "wasm-bindgen",
 ]
 
 [[package]]
@@ -471,7 +538,7 @@ dependencies = [
  "cfg-if",
  "libc",
  "r-efi",
- "rand_core",
+ "rand_core 0.10.0",
  "wasip2",
  "wasip3",
 ]
@@ -812,6 +879,16 @@ version = "0.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "8eaf4bc02d17cbdd7ff4c7438cafcdf7fb9a4613313ad11b4f8fefe7d3fa0130"
 
+[[package]]
+name = "jobserver"
+version = "0.1.34"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9afb3de4395d6b3e67a780b6de64b51c978ecf11cb9a462c66be7d4ca9039d33"
+dependencies = [
+ "getrandom 0.3.4",
+ "libc",
+]
+
 [[package]]
 name = "js-sys"
 version = "0.3.85"
@@ -877,6 +954,12 @@ version = "0.4.29"
 source = "registry+https://github.com/rust-lang/crates.
```

**File**: `Cargo.toml` (modified, +1/-2)
```diff
@@ -27,8 +27,7 @@ tokio = { version = "1", features = [
     "signal",
     "fs",
 ] }
-reqwest = { version = "0.13", default-features = false, features = ["json", "rustls-no-provider", "http2", "charset", "system-proxy"] }
-rustls = { version = "0.23", default-features = false, features = ["ring", "std", "tls12", "logging"] }
+reqwest = { version = "0.13", features = ["json"] }
 async-trait = "0.1"
 clap = { version = "4.5", features = ["derive"] }
 rand = "0.10"
```

**File**: `src/weather/open_meteo.rs` (modified, +0/-2)
```diff
@@ -39,8 +39,6 @@ struct CurrentWeather {
 
 impl OpenMeteoProvider {
     pub fn new() -> Self {
-        let _ = rustls::crypto::ring::default_provider().install_default();
-
         let client = reqwest::Client::builder()
             .timeout(Duration::from_secs(30))
             .connect_timeout(Duration::from_secs(10))
```

---

### Incident Patch 8: `8425606f` (2026-02-22)
**Commit Message**: fix(config): fallback to home .config for config path

closes #27

**File**: `src/config.rs` (modified, +4/-1)
```diff
@@ -131,7 +131,10 @@ impl Config {
     }
 
     fn get_config_path() -> Result<PathBuf, ConfigError> {
-        let config_dir = dirs::config_dir().ok_or(ConfigError::NoConfigDir)?;
+        let config_dir = dirs::config_dir()
+            .or_else(|| dirs::home_dir().map(|h| h.join(".config")))
+            .ok_or(ConfigError::NoConfigDir)?;
+
         Ok(config_dir.join("weathr").join("config.toml"))
     }
 }
```

---

### Incident Patch 9: `dec9392d` (2026-02-19)
**Commit Message**: fix(hud): dynamic User-Agent, configurable city name language, Nominatim attribution

- Replace hardcoded User-Agent "weathr/1.3.0" with env!("CARGO_PKG_VERSION")
- Add city_name_language config option (default "auto" for native names)
- Conditionally set Accept-Language header only when language is explicit
- Add Nominatim/OpenStreetMap attribution to comply with ODbL

**File**: `src/config.rs` (modified, +59/-0)
```diff
@@ -40,6 +40,12 @@ pub struct Location {
     pub city: Option<String>,
     #[serde(default)]
     pub display: LocationDisplay,
+    #[serde(default = "default_city_name_language")]
+    pub city_name_language: String,
+}
+
+fn default_city_name_language() -> String {
+    "auto".to_string()
 }
 
 fn default_latitude() -> f64 {
@@ -59,6 +65,7 @@ impl Default for Location {
             hide: false,
             city: None,
             display: LocationDisplay::default(),
+            city_name_language: default_city_name_language(),
         }
     }
 }
@@ -231,6 +238,7 @@ longitude = 0.0
                 hide: false,
                 city: None,
                 display: LocationDisplay::default(),
+                city_name_language: "auto".to_string(),
             },
             hide_hud: false,
             units: WeatherUnits::default(),
@@ -251,6 +259,7 @@ longitude = 0.0
                 hide: false,
                 city: None,
                 display: LocationDisplay::default(),
+                city_name_language: "auto".to_string(),
             },
             hide_hud: false,
             units: WeatherUnits::default(),
@@ -271,6 +280,7 @@ longitude = 0.0
                 hide: false,
                 city: None,
                 display: LocationDisplay::default(),
+                city_name_language: "auto".to_string(),
             },
             hide_hud: false,
             units: WeatherUnits::default(),
@@ -291,6 +301,7 @@ longitude = 0.0
                 hide: false,
                 city: None,
                 display: LocationDisplay::default(),
+                city_name_language: "auto".to_string(),
             },
             hide_hud: false,
             units: WeatherUnits::default(),
@@ -311,6 +322,7 @@ longitude = 0.0
                 hide: false,
                 city: None,
                 display: LocationDisplay::default(),
+                city_name_language: "auto".to_string(),
             },
             hide_hud: false,
             units: WeatherUnits::default(),
@@ -440,4 +452,51 @@ longitude = 0.0
         let config: Config = toml::from_str(toml_content).unwrap();
         assert_eq!(config.location.city, None);
     }
+
+    #[test]
+    fn test_city_name_language_default() {
+        let toml_content = r#"
+[location]
+latitude = 0.0
+longitude = 0.0
+"#;
+        let config: Config = toml::from_str(toml_content).unwrap();
+        assert_eq!(config.location.city_name_language, "auto");
+    }
+
+    #[test]
+    fn test_city_name_language_explicit_auto() {
+        let toml_content = r#"
+[location]
+latitude = 0.0
+longitude = 0.0
+city_name_language = "auto"
+"#;
+        let config: Config = toml::from_str(toml_content).unwrap();
+        assert_eq!(config.location.city_name_language, "auto");
+    }
+
+    #[test]
+    fn test_city_name_language_explicit_en() {
+        let toml_content = r#"
+[location]
+latitude = 0.0
+longitude = 0.0
+city_name_language = "en"
+"#;
+        let config: Config = toml::from_str(toml_content).unwrap();
+        assert_eq!(config.location.city_name_language, "en");
+    }
+
+    #[test]
+    fn test_city_name_language_explicit_ru() {
+        let toml_content = r#"
+[location]
+latitude = 0.0
+longitude = 0.0
+city_name_language = "ru"
+"#;
+        let config: Config = toml::from_str(toml_content).unwrap();
+        assert_eq!(config.location.city_name_language, "ru");
+    }
 }
```

**File**: `src/geolocation.rs` (modified, +11/-8)
```diff
@@ -115,7 +115,7 @@ struct NominatimResponse {
 /// Best-effort reverse geocode: returns a city/town/village name for the given
 /// coordinates, or `None` if the lookup fails or the location doesn't map to a
 /// meaningful settlement (e.g. open sea, administrative-only regions).
-pub async fn reverse_geocode(latitude: f64, longitude: f64) -> Option<String> {
+pub async fn reverse_geocode(latitude: f64, longitude: f64, language: &str) -> Option<String> {
     let client = reqwest::Client::builder()
         .timeout(Duration::from_secs(5))
         .connect_timeout(Duration::from_secs(3))
@@ -127,13 +127,16 @@ pub async fn reverse_geocode(latitude: f64, longitude: f64) -> Option<String> {
         NOMINATIM_URL, latitude, longitude
     );
 
-    let resp = client
-        .get(&url)
-        .header("User-Agent", "weathr/1.3.0")
-        .header("Accept-Language", "en")
-        .send()
-        .await
-        .ok()?;
+    let mut req = client.get(&url).header(
+        "User-Agent",
+        format!("weathr/{}", env!("CARGO_PKG_VERSION")),
+    );
+
+    if language != "auto" {
+        req = req.header("Accept-Language", language);
+    }
+
+    let resp = req.send().await.ok()?;
 
     let data: NominatimResponse = resp.json().await.ok()?;
 
```

**File**: `src/main.rs` (modified, +12/-4)
```diff
@@ -24,7 +24,9 @@ use std::{io, panic};
 const LONG_VERSION: &str = concat!(
     env!("CARGO_PKG_VERSION"),
     "\n\nWeather data provided by Open-Meteo.com (https://open-meteo.com/)\n",
-    "Data licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)"
+    "Data licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)\n\n",
+    "Geocoding powered by Nominatim/OpenStreetMap (https://nominatim.openstreetmap.org/)\n",
+    "Data \u{00a9} OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright)"
 );
 
 fn info(silent: bool, msg: &str) {
@@ -36,7 +38,9 @@ fn info(silent: bool, msg: &str) {
 const ABOUT: &str = concat!(
     "Terminal-based ASCII weather application\n\n",
     "Weather data provided by Open-Meteo.com (https://open-meteo.com/)\n",
-    "Data licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)"
+    "Data licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)\n\n",
+    "Geocoding powered by Nominatim/OpenStreetMap (https://nominatim.openstreetmap.org/)\n",
+    "Data \u{00a9} OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright)"
 );
 
 #[derive(Parser)]
@@ -229,8 +233,12 @@ async fn main() -> io::Result<()> {
         )
     {
         info(config.silent, "Resolving city name...");
-        if let Some(city) =
-            geolocation::reverse_geocode(config.location.latitude, config.location.longitude).await
+        if let Some(city) = geolocation::reverse_geocode(
+            config.location.latitude,
+            config.location.longitude,
+            &config.location.city_name_language,
+        )
+        .await
         {
             info(config.silent, &format!("City resolved: {}", city));
             config.location.city = Some(city);
```

**File**: `tests/config_integration_test.rs` (modified, +41/-0)
```diff
@@ -180,3 +180,44 @@ fn test_config_integration_display_defaults_to_coordinates() {
 
     fs::remove_file(test_config_path).ok();
 }
+
+#[test]
+fn test_config_integration_city_name_language() {
+    let temp_dir = std::env::temp_dir();
+    let test_config_path = temp_dir.join("weathr_city_name_lang.toml");
+
+    let mut file = fs::File::create(&test_config_path).unwrap();
+    writeln!(file, "[location]").unwrap();
+    writeln!(file, "latitude = 55.7558").unwrap();
+    writeln!(file, "longitude = 37.6173").unwrap();
+    writeln!(file, r#"display = "city""#).unwrap();
+    writeln!(file, r#"city_name_language = "ru""#).unwrap();
+    drop(file);
+
+    let config = Config::load_from_path(&test_config_path)
+        .expect("Should load config with city_name_language");
+
+    assert_eq!(config.location.city_name_language, "ru");
+    assert_eq!(config.location.display, LocationDisplay::City);
+
+    fs::remove_file(test_config_path).ok();
+}
+
+#[test]
+fn test_config_integration_city_name_language_defaults_to_auto() {
+    let temp_dir = std::env::temp_dir();
+    let test_config_path = temp_dir.join("weathr_city_name_lang_default.toml");
+
+    let mut file = fs::File::create(&test_config_path).unwrap();
+    writeln!(file, "[location]").unwrap();
+    writeln!(file, "latitude = 52.52").unwrap();
+    writeln!(file, "longitude = 13.41").unwrap();
+    drop(file);
+
+    let config = Config::load_from_path(&test_config_path)
+        .expect("Should default city_name_language to auto");
+
+    assert_eq!(config.location.city_name_language, "auto");
+
+    fs::remove_file(test_config_path).ok();
+}
```

---

### Incident Patch 10: `81c5d69f` (2026-02-20)
**Commit Message**: fix: simplify cache and config path resolution; ignore config.toml in the same directory

**File**: `src/cache.rs` (modified, +1/-6)
```diff
@@ -21,12 +21,7 @@ struct WeatherCache {
 }
 
 fn get_cache_dir() -> Option<PathBuf> {
-    let cache_dir = if let Ok(xdg_cache) = std::env::var("XDG_CACHE_HOME") {
-        PathBuf::from(xdg_cache)
-    } else {
-        dirs::home_dir()?.join(".cache")
-    };
-    Some(cache_dir.join("weathr"))
+    Some(dirs::cache_dir()?.join("weathr"))
 }
 
 fn current_timestamp() -> u64 {
```

**File**: `src/config.rs` (modified, +1/-17)
```diff
@@ -50,17 +50,6 @@ impl Default for Location {
 
 impl Config {
     pub fn load() -> Result<Self, ConfigError> {
-        // try local config.toml
-        if let Ok(cwd) = std::env::current_dir() {
-            let local_config = cwd.join("config.toml");
-            if local_config.exists() {
-                let config = Self::load_from_path(&local_config)?;
-                config.validate()?;
-                return Ok(config);
-            }
-        }
-
-        // try XDG config
         let config_path = Self::get_config_path()?;
 
         if !config_path.exists() {
@@ -97,12 +86,7 @@ impl Config {
     }
 
     fn get_config_path() -> Result<PathBuf, ConfigError> {
-        let config_dir = if let Ok(xdg_config) = std::env::var("XDG_CONFIG_HOME") {
-            PathBuf::from(xdg_config)
-        } else {
-            dirs::config_dir().ok_or(ConfigError::NoConfigDir)?
-        };
-
+        let config_dir = dirs::config_dir().ok_or(ConfigError::NoConfigDir)?;
         Ok(config_dir.join("weathr").join("config.toml"))
     }
 }
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
