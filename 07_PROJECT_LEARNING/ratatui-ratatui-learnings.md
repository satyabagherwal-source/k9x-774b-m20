# Forensic Learning Record (Deep Inspection): ratatui/ratatui

> **Canonical Artifact**: `07_PROJECT_LEARNING/ratatui-ratatui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ratatui/ratatui](https://github.com/ratatui/ratatui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:08:19.272Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ratatui/ratatui`
- **Description**: A Rust crate for cooking up terminal user interfaces (TUIs) 👨‍🍳🐀 https://ratatui.rs
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 22868 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/concepts/state/src/bin/component-trait.rs`
```
//! # Custom Component Trait Pattern
//!
//! This example demonstrates using a custom trait instead of the standard `Widget` trait for
//! handling mutable state during rendering. This pattern is useful when you want to implement
//! consistent behavior across multiple widget types without implementing the `Widget` trait for
//! each one.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - You're building a widget framework or library with custom behavior
//! - You want a consistent API across multiple widget types
//! - You need more control over the render method signature
//! - You're prototyping widget behavior before standardizing on `Widget` or `StatefulWidget`
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Flexible - you can define custom method signatures
//! - Consistent - enforces the same behavior across widget types
//! - Simple - no need to understand `StatefulWidget` complexity
//!
//! **Cons:**
//! - Non-standard - users must learn your custom API instead of Ratatui's standard traits
//! - Less discoverable - doesn't integrate with Ratatui's widget ecosystem
//! - Limited reuse - can't be used with existing Ratatui functions expecting `Widget`
//!
//! ## Example Usage
//!
//! The custom `Component` trait allows widgets to mutate their state directly during rendering
//! by taking `&mut self` instead of `self`. This is similar to the mutable widget pattern but
//! with a custom trait interface.

use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the custom component trait pattern for mutable state management.
///
/// Creates a counter widget using a custom `Component` trait and runs the application loop,
/// updating the counter on each render cycle until the user exits.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let mut counter = Counter::default();
        loop {
            terminal.draw(|frame| counter.render(frame, frame.area()))?;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// A custom trait for components that can render themselves while mutating their state.
///
/// This trait provides an alternative to the standard `Widget` trait by allowing components to
/// take `&mut self`, enabling direct state mutation during rendering.
trait Component {
    /// Render the component to the given area of the frame.
    fn render(&mut self, frame: &mut Frame, area: Rect);
}

/// A simple counter component that increments its value each time it's rendered.
///
/// Demonstrates how the custom `Component` trait allows widgets to maintain and mutate
/// their own state during the rendering process.
#[derive(Default)]
struct Counter {
    count: usize,
}

impl Component for Counter {
    fn render(&mut self, frame: &mut Frame, area: Rect) {
        self.count += 1;
        frame.render_widget(format!("Counter: {count}", count = self.count), area);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/immutable-consuming.rs`
```
//! # Consuming Widget Pattern with Immutable State
//!
//! This example demonstrates implementing the `Widget` trait directly on the widget type,
//! causing it to be consumed when rendered. This was the original pattern in Ratatui and
//! is still commonly used, especially for simple widgets that are created fresh each frame.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - You're working with existing code that uses this pattern
//! - Your widgets are simple and created fresh each frame
//! - You want maximum compatibility with older Ratatui code
//! - You don't need to reuse widget instances
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Simple - straightforward implementation
//! - Compatible - works with all Ratatui versions
//! - Familiar - widely used pattern in existing code
//! - No borrowing - no need to manage references
//!
//! **Cons:**
//! - Consuming - widget is destroyed after each render
//! - Inefficient - requires reconstruction for repeated use
//! - Limited reuse - cannot store and reuse widget instances
//!
//! ## Example Usage
//!
//! The widget implements `Widget` directly on the owned type, meaning it's consumed
//! when rendered and must be recreated for subsequent renders.

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::Widget;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the consuming widget pattern for immutable state rendering.
///
/// Creates a new counter widget instance each frame, showing how the consuming
/// pattern works with immutable state that's managed externally.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let mut count = 0;
        loop {
            terminal.draw(|frame| {
                // Widget is created fresh each time and consumed when rendered
                let counter = Counter::new(count);
                frame.render_widget(counter, frame.area());
            })?;
            // State updates happen outside of widget lifecycle
            count += 1;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// A simple counter widget that displays a count value.
///
/// Implements `Widget` directly on the owned type, meaning the widget is consumed
/// when rendered. The count state is managed externally and passed in during construction.
struct Counter {
    count: usize,
}

impl Counter {
    /// Create a new counter widget with the given count.
    fn new(count: usize) -> Self {
        Self { count }
    }
}

impl Widget for Counter {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // Widget is consumed here - self is moved, not borrowed
        format!("Counter: {}", self.count).render(area, buf);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/immutable-function.rs`
```
//! # Function-Based Pattern with Immutable State
//!
//! This example demonstrates using standalone functions for rendering widgets with immutable
//! state. This pattern keeps state management completely separate from widget rendering logic,
//! making it easy to test and reason about.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - You prefer functional programming approaches
//! - Your rendering logic is simple and doesn't need complex widget hierarchies
//! - You want clear separation between state and rendering
//! - You're building simple UIs or prototyping quickly
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Simple - easy to understand and test
//! - Pure functions - no side effects in rendering
//! - Flexible - can easily compose multiple render functions
//! - Clear separation - state management is completely separate from rendering
//!
//! **Cons:**
//! - Limited - doesn't integrate with Ratatui's widget ecosystem
//! - Verbose - requires passing state explicitly to every function
//! - No reuse - can't be used with existing Ratatui widget infrastructure
//!
//! ## Example Usage
//!
//! The function takes immutable references to both the frame and state, ensuring that
//! rendering is a pure operation that doesn't modify state.

use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the function-based pattern for immutable state rendering.
///
/// Creates a counter state and renders it using a pure function, incrementing the counter
/// in the application loop rather than during rendering.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let mut counter_state = Counter::default();
        loop {
            terminal.draw(|frame| render_counter(frame, frame.area(), &counter_state))?;
            // State updates happen outside of rendering
            counter_state.increment();
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// State for the counter.
///
/// This state is managed externally and passed to render functions as an immutable reference.
#[derive(Default)]
struct Counter {
    count: usize,
}

impl Counter {
    /// Increment the counter value.
    fn increment(&mut self) {
        self.count += 1;
    }
}

/// Pure render function that displays the counter state.
///
/// Takes immutable references to ensure rendering has no side effects on state.
/// This function can be easily tested and composed with other render functions.
fn render_counter(frame: &mut Frame, area: Rect, state: &Counter) {
    frame.render_widget(format!("Counter: {}", state.count), area);
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/immutable-shared-ref.rs`
```
//! # Shared Reference Pattern with Immutable State
//!
//! This example demonstrates implementing the `Widget` trait on a shared reference (`&Widget`)
//! with immutable state. This is the recommended pattern for most widgets in modern Ratatui
//! applications, as it allows widgets to be reused without being consumed.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - You want to reuse widgets across multiple renders
//! - Your widget doesn't need to modify its state during rendering
//! - You want the benefits of Ratatui's widget ecosystem
//! - You're building modern, efficient Ratatui applications
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Reusable - widget can be rendered multiple times without reconstruction
//! - Efficient - no cloning or reconstruction needed
//! - Standard - integrates with Ratatui's widget ecosystem
//! - Modern - follows current Ratatui best practices
//!
//! **Cons:**
//! - Immutable - cannot modify widget state during rendering
//! - External state - requires external state management for dynamic behavior
//!
//! ## Example Usage
//!
//! The widget implements `Widget for &Counter`, allowing it to be rendered by reference
//! while keeping its internal data immutable during rendering.

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::Widget;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the shared reference pattern for immutable widget rendering.
///
/// Creates a counter widget that can be rendered multiple times by reference,
/// with state updates happening outside the widget's render method.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let mut counter = Counter::new();
        loop {
            terminal.draw(|frame| {
                // Widget is rendered by reference, can be reused
                frame.render_widget(&counter, frame.area());
            })?;
            // State updates happen outside of rendering
            counter.increment();
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// A counter widget with immutable rendering behavior.
///
/// Implements `Widget` on a shared reference, allowing the widget to be rendered
/// multiple times without being consumed while keeping its data immutable during rendering.
struct Counter {
    count: usize,
}

impl Counter {
    /// Create a new counter.
    fn new() -> Self {
        Self { count: 0 }
    }

    /// Increment the counter value.
    ///
    /// This method modifies the counter's state outside of the rendering process,
    /// maintaining the separation between state updates and rendering.
    fn increment(&mut self) {
        self.count += 1;
    }
}

impl Widget for &Counter {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // Rendering is immutable - no state changes occur here
        format!("Counter: {}", self.count).render(area, buf);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/mutable-function.rs`
```
//! # Render Function Pattern
//!
//! This example demonstrates the simplest approach to handling mutable state - using regular
//! functions that accept mutable state references. This pattern works well for simple applications
//! and prototypes where you don't need the complexity of widget traits.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - Simple applications with minimal state management needs
//! - Prototypes and quick experiments
//! - When you prefer functional programming over object-oriented approaches
//! - Applications where state is naturally managed at the top level
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Extremely simple - no traits to implement or understand
//! - Direct and explicit - state flow is obvious
//! - Flexible - easy to modify without interface constraints
//! - Beginner-friendly - uses basic Rust concepts
//!
//! **Cons:**
//! - State must be passed through function parameters
//! - Harder to organize as application complexity grows
//! - No encapsulation - state management is scattered
//! - Less reusable than widget-based approaches
//! - Can lead to parameter passing through many layers
//!
//! ## Example Usage
//!
//! State is managed at the application level and passed to render functions as needed.
//! This approach works well when state is simple and doesn't need complex organization.

use ratatui::Frame;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the render function pattern for mutable state management.
///
/// Creates a counter using simple functions and runs the application loop,
/// updating the counter on each render cycle until the user exits.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let mut counter = 0;
        loop {
            terminal.draw(|frame| render(frame, &mut counter))?;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// Renders a counter using a simple function-based approach.
///
/// Demonstrates the functional approach to state management where state is managed externally
/// and passed in as a parameter.
fn render(frame: &mut Frame, counter: &mut usize) {
    *counter += 1;
    frame.render_widget(format!("Counter: {counter}"), frame.area());
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/mutable-widget.rs`
```
//! # Mutable Widget Pattern
//!
//! This example demonstrates implementing the `Widget` trait on a mutable reference (`&mut T`)
//! to allow direct state mutation during rendering. This is one of the simplest approaches for
//! widgets that need to maintain their own state.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - You have self-contained widgets with their own state
//! - You prefer an object-oriented approach to widget design
//! - Your widget's state is simple and doesn't need complex sharing
//! - You want to encapsulate state within the widget itself
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Simple and intuitive - state is encapsulated within the widget
//! - Familiar pattern for developers coming from OOP backgrounds
//! - Direct state access without external state management
//! - Works well with Rust's ownership system for simple cases
//!
//! **Cons:**
//! - Can lead to borrowing challenges in complex scenarios
//! - Requires mutable access to the widget, which may not always be available
//! - Less flexible than `StatefulWidget` for shared or complex state patterns
//! - May require careful lifetime management in nested scenarios
//!
//! ## Example Usage
//!
//! The widget implements `Widget` for `&mut Self`, allowing it to mutate its internal state
//! during the render call. Each render increments a counter, demonstrating state mutation.

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::Widget;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the mutable widget pattern for mutable state management.
///
/// Creates a counter widget using `Widget` for `&mut Self` and runs the application loop,
/// updating the counter on each render cycle until the user exits.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let mut counter = Counter::default();
        loop {
            terminal.draw(|frame| frame.render_widget(&mut counter, frame.area()))?;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// A counter widget that maintains its own state and increments on each render.
///
/// Demonstrates the mutable widget pattern by implementing `Widget` for `&mut Self`.
#[derive(Default)]
struct Counter {
    counter: usize,
}

impl Widget for &mut Counter {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.counter += 1;
        format!("Counter: {counter}", counter = self.counter).render(area, buf);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/nested-mutable-widget.rs`
```
//! # Nested Mutable Widget Pattern
//!
//! This example demonstrates nesting widgets that both need mutable access to their state.
//! This pattern is useful when you have a parent-child widget relationship where both widgets
//! need to maintain and mutate their own state during rendering.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - You have hierarchical widget relationships (parent-child)
//! - Each widget needs to maintain its own distinct state
//! - You prefer the mutable widget pattern over StatefulWidget
//! - Widgets have clear ownership of their state
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Clear hierarchical organization
//! - Each widget encapsulates its own state
//! - Intuitive parent-child relationships
//! - State ownership is explicit
//!
//! **Cons:**
//! - Complex borrowing scenarios can arise
//! - Requires careful lifetime management
//! - May lead to borrow checker issues in complex hierarchies
//! - Less flexible than StatefulWidget for state sharing
//!
//! ## Example Usage
//!
//! The parent `App` widget contains a child `Counter` widget. Both implement `Widget` for
//! `&mut Self`, allowing them to mutate their respective states during rendering. The parent
//! delegates rendering to the child while maintaining its own state structure.

use ratatui::DefaultTerminal;
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::Widget;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the nested mutable widget pattern for mutable state management.
///
/// Creates a parent-child widget hierarchy using mutable widgets and runs the application loop,
/// updating the counter on each render cycle until the user exits.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    let app = App::default();
    ratatui::run(|terminal| app.run(terminal))
}

/// The main application widget that contains and manages child widgets.
///
/// Demonstrates the parent widget in a nested mutable widget hierarchy.
#[derive(Default)]
struct App {
    counter: Counter,
}

impl App {
    /// Run the application with the given terminal.
    fn run(mut self, terminal: &mut DefaultTerminal) -> color_eyre::Result<()> {
        loop {
            terminal.draw(|frame| frame.render_widget(&mut self, frame.area()))?;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    }
}

impl Widget for &mut App {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.counter.render(area, buf);
    }
}

/// A counter widget that maintains its own state within a nested hierarchy.
///
/// Can be used standalone or as a child within other widgets, demonstrating
/// how mutable widgets can be composed together.
#[derive(Default)]
struct Counter {
    count: usize,
}

impl Widget for &mut Counter {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.count += 1;
        format!("Counter: {count}", count = self.count).render(area, buf);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/nested-stateful-widget.rs`
```
//! # Nested StatefulWidget Pattern
//!
//! This example demonstrates composing multiple `StatefulWidget`s in a parent-child hierarchy.
//! This pattern is ideal for complex applications where you need clean separation of concerns
//! and want to leverage the benefits of the StatefulWidget pattern at multiple levels.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - Complex applications with hierarchical state management needs
//! - When you want clean separation between widgets and their state
//! - Building composable widget systems
//! - Applications that need testable, reusable widget components
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Excellent separation of concerns
//! - Highly composable and reusable widgets
//! - Easy to test individual widgets and their state
//! - Scales well with application complexity
//! - Follows idiomatic Ratatui patterns
//!
//! **Cons:**
//! - More boilerplate code than simpler patterns
//! - Requires understanding of nested state management
//! - State structures can become complex
//! - May be overkill for simple applications
//!
//! ## Example Usage
//!
//! The parent `App` widget manages application-level state while delegating specific
//! functionality to child widgets like `Counter`. Each widget is responsible for its own
//! state type and rendering logic, making the system highly modular.

use ratatui::DefaultTerminal;
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::{StatefulWidget, Widget};
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the nested StatefulWidget pattern for mutable state management.
///
/// Creates a parent-child widget hierarchy using StatefulWidgets and runs the application loop,
/// updating the counter on each render cycle until the user exits.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(App::run)
}

/// The main application widget using the StatefulWidget pattern.
///
/// Demonstrates how to compose multiple StatefulWidgets together while coordinating
/// between different child widgets.
struct App;

impl App {
    /// Run the application with the given terminal.
    fn run(terminal: &mut DefaultTerminal) -> color_eyre::Result<()> {
        let mut state = AppState { counter: 0 };

        loop {
            terminal.draw(|frame| frame.render_stateful_widget(App, frame.area(), &mut state))?;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    }
}

/// Application state that contains all the state needed by the app and its child widgets.
///
/// Demonstrates how to organize hierarchical state in the StatefulWidget pattern.
struct AppState {
    counter: usize,
}

impl StatefulWidget for App {
    type State = AppState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        Counter.render(area, buf, &mut state.counter);
    }
}

/// A counter widget that uses StatefulWidget for clean state separation.
///
/// Focuses purely on rendering logic and can be reused with different state instances.
struct Counter;

impl StatefulWidget for Counter {
    type State = usize;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        *state += 1;
        format!("Counter: {state}").render(area, buf);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/refcell.rs`
```
//! # Interior Mutability Pattern (RefCell)
//!
//! This example demonstrates using `Rc<RefCell<T>>` for interior mutability, allowing multiple
//! widgets to share and mutate the same state. This pattern is useful when you need shared
//! mutable state but can't use mutable references due to borrowing constraints.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - Multiple widgets need to access and modify the same state
//! - You can't use mutable references due to borrowing constraints
//! - You need shared ownership of mutable data
//! - Complex widget hierarchies where state needs to be accessed from multiple locations
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Allows shared mutable access to state
//! - Works with immutable widget references
//! - Enables complex state sharing patterns
//! - Can be cloned cheaply (reference counting)
//!
//! **Cons:**
//! - Runtime borrow checking - potential for panics if you violate borrowing rules
//! - Less efficient than compile-time borrow checking
//! - Harder to debug when borrow violations occur
//! - More complex than simpler state management patterns
//! - Can lead to subtle bugs if not used carefully
//!
//! ## Important Safety Notes
//!
//! - Only one mutable borrow can exist at a time
//! - Violating this rule will cause a panic at runtime
//! - Always minimize the scope of borrows to avoid conflicts
//!
//! ## Example Usage
//!
//! The widget wraps its state in `Rc<RefCell<T>>`, allowing the state to be shared and mutated
//! even when the widget itself is used by value (as required by the `Widget` trait).

use std::cell::RefCell;
use std::ops::AddAssign;
use std::rc::Rc;

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::Widget;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the interior mutability pattern for mutable state management.
///
/// Creates a counter widget using `Rc<RefCell<T>>` and runs the application loop,
/// updating the counter on each render cycle until the user exits.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let counter = Counter::default();
        loop {
            terminal.draw(|frame| frame.render_widget(counter.clone(), frame.area()))?;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// A counter widget that uses interior mutability for shared state management.
///
/// Demonstrates how `Rc<RefCell<T>>` enables mutable state access even when the
/// widget itself is used by value.
#[derive(Default, Clone)]
struct Counter {
    count: Rc<RefCell<usize>>,
}

impl Widget for Counter {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.count.borrow_mut().add_assign(1);
        format!("Counter: {count}", count = self.count.borrow()).render(area, buf);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/stateful-widget.rs`
```
//! # StatefulWidget Pattern (Recommended)
//!
//! This example demonstrates the `StatefulWidget` trait, which is the recommended approach for
//! handling mutable state in Ratatui applications. This pattern separates the widget's rendering
//! logic from its state, making it more flexible and reusable.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - Most Ratatui applications (this is the recommended default)
//! - When building reusable widget libraries
//! - When you need clean separation between rendering logic and state
//! - When multiple widgets might share similar state structures
//! - When you want to follow idiomatic Ratatui patterns
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Clean separation of concerns between widget and state
//! - Reusable - the same widget can work with different state instances
//! - Testable - state and rendering logic can be tested independently
//! - Composable - works well with complex application architectures
//! - Idiomatic - follows Ratatui's recommended patterns
//!
//! **Cons:**
//! - Slightly more verbose than direct mutation patterns
//! - Requires understanding of the `StatefulWidget` trait
//! - State must be managed externally
//!
//! ## Example Usage
//!
//! The widget defines its rendering behavior through `StatefulWidget`, while the state is
//! managed separately. This allows the same widget to be used with different state instances
//! and makes testing easier.

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::{StatefulWidget, Widget};
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the StatefulWidget pattern for mutable state management.
///
/// Creates a counter widget using `StatefulWidget` and runs the application loop,
/// updating the counter on each render cycle until the user exits.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let mut counter = 0;
        loop {
            terminal.draw(|frame| {
                frame.render_stateful_widget(CounterWidget, frame.area(), &mut counter)
            })?;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// A counter widget that uses the StatefulWidget pattern for state management.
///
/// Demonstrates the separation of rendering logic from state, making the widget reusable
/// with different state instances and easier to test.
struct CounterWidget;

impl StatefulWidget for CounterWidget {
    type State = usize;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        *state += 1;
        format!("Counter: {state}").render(area, buf);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/bin/widget-with-mutable-ref.rs`
```
//! # Lifetime-Based Mutable References Pattern
//!
//! This example demonstrates storing mutable references directly in widget structs using explicit
//! lifetimes. This is an advanced pattern that provides zero-cost state access but requires
//! careful lifetime management.
//!
//! This example runs with the Ratatui library code in the branch that you are currently
//! reading. See the [`latest`] branch for the code which works with the most recent Ratatui
//! release.
//!
//! [`latest`]: https://github.com/ratatui/ratatui/tree/latest
//!
//! ## When to Use This Pattern
//!
//! - You need maximum performance with zero runtime overhead
//! - You have a good understanding of Rust lifetimes and borrowing
//! - State lifetime is clearly defined and relatively simple
//! - You're building performance-critical applications
//!
//! ## Trade-offs
//!
//! **Pros:**
//! - Zero runtime cost - no reference counting or runtime borrow checking
//! - Compile-time safety - borrow checker ensures memory safety
//! - Direct access to state without indirection
//! - Maximum performance for state access
//!
//! **Cons:**
//! - Complex lifetime management - requires deep Rust knowledge
//! - Easy to create compilation errors that are hard to understand
//! - Inflexible - lifetime constraints can make code harder to refactor
//! - Not suitable for beginners - requires advanced Rust skills
//! - Widget structs become less reusable due to lifetime constraints
//!
//! ## Important Considerations
//!
//! - The widget's lifetime is tied to the state's lifetime
//! - You must ensure the state outlives the widget
//! - Lifetime annotations can become complex in larger applications
//! - Consider simpler patterns unless performance is critical
//!
//! ## Example Usage
//!
//! The widget stores a mutable reference to external state, allowing direct access without
//! runtime overhead. The widget must be recreated for each render call due to the lifetime
//! constraints.

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::Widget;
use ratatui_state_examples::is_exit_key_pressed;

/// Demonstrates the lifetime-based mutable references pattern for mutable state management.
///
/// Creates a counter widget using mutable references with explicit lifetimes and runs the
/// application loop, updating the counter on each render cycle until the user exits.
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    ratatui::run(|terminal| {
        let mut count = 0;
        loop {
            let counter = CounterWidget { count: &mut count };
            terminal.draw(|frame| frame.render_widget(counter, frame.area()))?;
            if is_exit_key_pressed()? {
                break Ok(());
            }
        }
    })
}

/// A counter widget that holds a mutable reference to external state.
///
/// Demonstrates the lifetime-based pattern where the widget directly stores a
/// mutable reference to external state.
struct CounterWidget<'a> {
    count: &'a mut usize,
}

impl Widget for CounterWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        *self.count += 1;
        format!("Counter: {count}", count = self.count).render(area, buf);
    }
}

```

### Core Architecture Module: `examples/concepts/state/src/lib.rs`
```
//! Helper functions for checking if exit keys are pressed
use crossterm::event::{self, KeyCode};

pub fn is_exit_key_pressed() -> std::io::Result<bool> {
    Ok(event::read()?
        .as_key_press_event()
        .is_some_and(|key| matches!(key.code, KeyCode::Esc | KeyCode::Char('q'))))
}

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

- **Issue #2795** (2026-10-05): **build(deps): bump taiki-e/install-action from 2.84.0 to 2.87.20**
  *Symptoms*: Bumps [taiki-e/install-action](https://github.com/taiki-e/install-action) from 2.84.0 to 2.87.20. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/taiki-e/install-action/releases">taiki-e/install-action's releases</a>.</em></p> <blockquote> <h2>2.87.20</h2> <ul> <li> <p>Update <code>uv@latest</code> to 0.12.18.</p> </li> <li> <p>Update <code>cargo-shear@latest</code> to 1.14.0.</p> </li> </ul> <h2>2.87.19</h2> <ul> <li> <p>Update <code>wasmtime@latest</code> to 49.0.0.</p> </li> <li> <p>Update <code>cargo-shear@latest</code> to 1.13.5.</p> </li> <li> <p>Update <code>cargo-nextest@latest</code> to 0.9.146.</p> </li> </ul> <h2>2.87.18</h2> <ul> <li> <p>Update <code>oxfmt@latest</code> to 1.84.0.</p> </li> <li> <p>Update <code>mise@latest</code> to 2026.9.12.</p> </li> <li> <p>Update <code>kache@latest</code> to 0.26.3.</p> </li> <li> <p>Update <code>cargo-tarpaulin@latest</code> to 0.37.4.</p> </li> <li> <p>Update <code>cargo-rdme@latest</code> to 2.2.3.</p> </li> </ul> <h2>2.87.17</h2> <ul> <li> <p>Update <code>uv@latest</code> to 0.12.17.</p> </li> <li> <p>Update <code>release-plz@latest</code> to 0.3.169.</p> </li> <li> <p>Update <code>kingfisher@latest</code> to 2.5.0.</p> </li> <li> <p>Update <code>kache@latest</code> to 0.25.0.</p> </li> <li> <p>Update <code>git-cliff@latest</code> to 2.14.2.</p> </li> <li> <p>Update <code>cargo-tarpaulin@latest</code> to 0.37.3.</p> </li> <li> <p>Update <code>cargo-leptos@latest</code> to 0.3.9.<
  **Post-Mortem & Fix Analysis**:
  > Superseded by #2808.

- **Issue #2793** (2026-09-24): **Docs issue**
  *Symptoms*: #[derive(Debug, Default)] pub struct App {     counter: u8,     exit: bool, }  Hi, something small, in the docs, the counter suggests a u8, I propose switching to a signed counter, since when you hit 0 and go to the negative, it crashes
  **Post-Mortem & Fix Analysis**:
  > Hey, is this in the examples? Or the tutorial?  Feel free to submit a PR :)
  > https://ratatui.rs/tutorials/counter-app/basic-app/  > Normally your application should avoid panicking, but we’re leaving an overflow bug in here so we can show how to handle errors in the next section. A real app might use saturating_sub and saturating_add to avoid panics like this.
  > oh, great, thanks

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

### Incident Patch 1: `7767679c` (2026-09-28)
**Commit Message**: build(deps): bump instability from 0.3.13 to 0.3.14 (#2799)

Bumps [instability](https://github.com/ratatui/instability) from 0.3.13
to 0.3.14.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/ratatui/instability/releases">instability's
releases</a>.</em></p>
<blockquote>
<h2>instability-example-v0.3.14</h2>
<h3>Other</h3>
<ul>
<li>Add #[allow(unused_imports)] lint to unstable reexports (<a
href="https://redirect.github.com/ratatui/instability/pull/21">#21</a>)</li>
</ul>
<h2>instability-v0.3.14</h2>
<h3>Other</h3>
<ul>
<li>Remove unnecessary build script (<a
href="https://redirect.github.com/ratatui/instability/pull/39">#39</a>)</li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/ratatui/instability/blob/main/CHANGELOG.md">instability's
changelog</a>.</em></p>
<blockquote>
<h2><a
href="https://github.com/ratatui/instability/compare/instability-v0.3.13...instability-v0.3.14">0.3.14</a>
- 2026-09-22</h2>
<h3>Other</h3>
<ul>
<li>Remove unnecessary build script (<a
href="https://redirect.github.com/ratatui/instability/pull/39">#39</a>)</li>
</ul>
</blockquote>
</details>
<d

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1776,9 +1776,9 @@ dependencies = [
 
 [[package]]
 name = "instability"
-version = "0.3.13"
+version = "0.3.14"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2bf84e73fa6f27f299dec58e13223cf70db80da872eb921d4f6138342a0eabc8"
+checksum = "4c3b5acc1e2fd9375041a388da33d1eb8aed5f7a8c0dd3543e3ea2805adfbe20"
 dependencies = [
  "darling",
  "indoc",
```

---

### Incident Patch 2: `007450f1` (2026-09-28)
**Commit Message**: build(deps): bump lru from 0.18.4 to 0.18.5 (#2797)

Bumps [lru](https://github.com/jeromefroe/lru-rs) from 0.18.4 to 0.18.5.
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/jeromefroe/lru-rs/blob/master/CHANGELOG.md">lru's
changelog</a>.</em></p>
<blockquote>
<h2><a
href="https://github.com/jeromefroe/lru-rs/tree/0.18.5">v0.18.5</a> -
2026-09-22</h2>
<ul>
<li>Specify desired hashbrown features to reduce dependencies.</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/jeromefroe/lru-rs/commit/f1e972197053a6814e77b77afacb51f03fc03170"><code>f1e9721</code></a>
Merge pull request <a
href="https://redirect.github.com/jeromefroe/lru-rs/issues/248">#248</a>
from jeromefroe/jerome/prepare-0-18-5-release</li>
<li><a
href="https://github.com/jeromefroe/lru-rs/commit/4592b1c733ea1c9c8ae4dfab943637b74d49851d"><code>4592b1c</code></a>
Prepare 0.18.5 release</li>
<li><a
href="https://github.com/jeromefroe/lru-rs/commit/c5efdfd592db9171898f23a45989459a19b7d2b7"><code>c5efdfd</code></a>
Merge pull request <a
href="https://redirect.github.com/jeromefroe/lru-rs/issues/247">#247</a>
from brunowonka/hash

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1965,9 +1965,9 @@ checksum = "13dc2df351e3202783a1fe0d44375f7295ffb4049267b0f3018346dc122a1d94"
 
 [[package]]
 name = "lru"
-version = "0.18.4"
+version = "0.18.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ff9840bcc50b71349309900da0ce7279aa336ae71d73250b07998932c7d97c25"
+checksum = "ef9ac18847474e638e3702b76c65d4eb93428471a74778ef0f1be711717f89b5"
 dependencies = [
  "hashbrown 0.17.1",
 ]
```

---

### Incident Patch 3: `92ff3a2f` (2026-09-28)
**Commit Message**: build(deps): bump crate-ci/typos from 1.50.2 to 1.50.3 (#2798)

Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.50.2 to
1.50.3.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/crate-ci/typos/releases">crate-ci/typos's
releases</a>.</em></p>
<blockquote>
<h2>v1.50.3</h2>
<h2>[1.50.3] - 2026-09-25</h2>
<h3>Fixes</h3>
<ul>
<li>Don'y panicwhen case-converting non-ASCII corrections</li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/crate-ci/typos/blob/main/CHANGELOG.md">crate-ci/typos's
changelog</a>.</em></p>
<blockquote>
<h1>Change Log</h1>
<p>All notable changes to this project will be documented in this
file.</p>
<p>The format is based on <a href="https://keepachangelog.com/">Keep a
Changelog</a>
and this project adheres to <a href="https://semver.org/">Semantic
Versioning</a>.</p>
<!-- raw HTML omitted -->
<h2>[Unreleased] - ReleaseDate</h2>
<h2>[1.50.3] - 2026-09-25</h2>
<h3>Fixes</h3>
<ul>
<li>Don'y panicwhen case-converting non-ASCII corrections</li>
</ul>
<h2>[1.50.2] - 2026-09-15</h2>
<h3>Fixes</h3>
<ul>
<li>Don't panic when files being examined a

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           persist-credentials: false
-      - uses: crate-ci/typos@512fc24f32f44ab01972217aaaf3dc86ec234d53 # v1.50.2
+      - uses: crate-ci/typos@00f422f3b19c57bc6338715ebfe3316d38768461 # v1.50.3
 
   # Check for any disallowed dependencies in the codebase due to license / security issues.
   # See <https://github.com/EmbarkStudios/cargo-deny>
```

---

### Incident Patch 4: `a4ad07c0` (2026-09-28)
**Commit Message**: build(deps): bump release-plz/action from 0.5.138 to 0.5.139 (#2796)

Bumps [release-plz/action](https://github.com/release-plz/action) from
0.5.138 to 0.5.139.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/release-plz/action/releases">release-plz/action's
releases</a>.</em></p>
<blockquote>
<h2>v0.5.139</h2>
<h2>What's Changed</h2>
<ul>
<li>chore(deps): update dependency taiki-e/install-action to v2.87.14 by
<a href="https://github.com/renovate"><code>@​renovate</code></a>[bot]
in <a
href="https://redirect.github.com/release-plz/action/pull/536">release-plz/action#536</a></li>
<li>chore(deps): update dependency taiki-e/install-action to v2.87.15 by
<a href="https://github.com/renovate"><code>@​renovate</code></a>[bot]
in <a
href="https://redirect.github.com/release-plz/action/pull/537">release-plz/action#537</a></li>
<li>chore(deps): update dependency taiki-e/install-action to v2.87.16 by
<a href="https://github.com/renovate"><code>@​renovate</code></a>[bot]
in <a
href="https://redirect.github.com/release-plz/action/pull/538">release-plz/action#538</a></li>
<li>Update to 0.3.169 by <a
href="https://github.com/marcoieni"><code>@​marcoien

**File**: `.github/workflows/release-plz.yml` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ jobs:
       - uses: rust-lang/crates-io-auth-action@c6f97d42243bad5fab37ca0427f495c86d5b1a18 # v1
         id: auth
       - name: Run release-plz
-        uses: release-plz/action@d6c56271d640b6c1b61d1e00593641c400a9f4bd # v0.5
+        uses: release-plz/action@b8d6b54b02889ff2ae2bb82e8b57c3a8fc1683a5 # v0.5
         with:
           command: release
         env:
@@ -63,7 +63,7 @@ jobs:
         with:
           toolchain: stable
       - name: Run release-plz
-        uses: release-plz/action@d6c56271d640b6c1b61d1e00593641c400a9f4bd # v0.5
+        uses: release-plz/action@b8d6b54b02889ff2ae2bb82e8b57c3a8fc1683a5 # v0.5
         with:
           command: release-pr
         env:
```

---

### Incident Patch 5: `c40a8ef9` (2026-09-28)
**Commit Message**: build(deps): bump thiserror from 2.0.20 to 2.0.21 (#2800)

Bumps [thiserror](https://github.com/dtolnay/thiserror) from 2.0.20 to
2.0.21.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/dtolnay/thiserror/releases">thiserror's
releases</a>.</em></p>
<blockquote>
<h2>2.0.21</h2>
<ul>
<li>Fix parsing of generic unit variants in display expressions (<a
href="https://redirect.github.com/dtolnay/thiserror/issues/459">#459</a>)</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/dtolnay/thiserror/commit/b1827ee06f81a7d7f954e676771e19a97f9f8e3b"><code>b1827ee</code></a>
Release 2.0.21</li>
<li><a
href="https://github.com/dtolnay/thiserror/commit/58037b575a2a5543d0d54a49360554325b49f55a"><code>58037b5</code></a>
Merge pull request <a
href="https://redirect.github.com/dtolnay/thiserror/issues/459">#459</a>
from dtolnay/turbofish</li>
<li><a
href="https://github.com/dtolnay/thiserror/commit/f82a0cf8f06c71263c2caa26e759f337d2778153"><code>f82a0cf</code></a>
Keep track of nested turbofish depth</li>
<li><a
href="https://github.com/dtolnay/thiserror/commit/72ea49262d6412ccbc08f1696dda8626409e657d

**File**: `Cargo.lock` (modified, +11/-11)
```diff
@@ -325,7 +325,7 @@ dependencies = [
  "semver",
  "serde",
  "serde_json",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -1869,7 +1869,7 @@ dependencies = [
  "hashbrown 0.16.1",
  "portable-atomic",
  "portable-atomic-util",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -2419,7 +2419,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1db05f56d34358a8b1066f67cbb203ee3e7ed2ba674a6263a1d5ec6db2204323"
 dependencies = [
  "memchr",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "ucd-trie",
 ]
 
@@ -2876,7 +2876,7 @@ dependencies = [
  "serde",
  "serde_json",
  "strum",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "unicode-segmentation",
  "unicode-truncate",
  "unicode-width",
@@ -3478,7 +3478,7 @@ checksum = "297f631f50729c8c99b84667867963997ec0b50f32b2a7dbcab828ef0541e8bb"
 dependencies = [
  "num-bigint",
  "num-traits",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "time",
 ]
 
@@ -3783,11 +3783,11 @@ dependencies = [
 
 [[package]]
 name = "thiserror"
-version = "2.0.20"
+version = "2.0.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ec86235f5fcc2a73650310756d2ac5b138a5780bbbdfae3eeccec992c435ba4f"
+checksum = "09e52cb86a36cede5cb101bf8908837b3e4c6e5e59fe7fd85c23fb56200d189e"
 dependencies = [
- "thiserror-impl 2.0.20",
+ "thiserror-impl 2.0.21",
 ]
 
 [[package]]
@@ -3803,9 +3803,9 @@ dependencies = [
 
 [[package]]
 name = "thiserror-impl"
-version = "2.0.20"
+version = "2.0.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bc04cd3e1236dd4a98afca4569f2deb3f120e5422a4023be2cb683f8486292af"
+checksum = "fe5197923287db20a58125f0bc85c062f7f2c892de97b18c356f9efb14b28524"
 dependencies = [
  "proc-macro2",
  "quote",
@@ -4072,7 +4072,7 @@ checksum = "050686193eb999b4bb3bc2acfa891a13da00f79734704c4b8b4ef1a10b368a3c"
 dependencies = [
  "crossbeam-channel",
  "symlink",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "time",
  "tracing-subscriber",
 ]
```

---

### Incident Patch 6: `fd51259f` (2026-09-28)
**Commit Message**: build(deps): bump rand from 0.10.2 to 0.10.3 (#2801)

Bumps [rand](https://github.com/rust-random/rand) from 0.10.2 to 0.10.3.
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/rust-random/rand/blob/master/CHANGELOG.md">rand's
changelog</a>.</em></p>
<blockquote>
<h2>[0.10.3] — 2026-09-20</h2>
<h3>Fixes</h3>
<ul>
<li>Fix <code>WeightedIndex</code> panic when the sum of float weights
is infinite; return <code>Error::Overflow</code> instead (<a
href="https://redirect.github.com/rust-random/rand/issues/1808">#1808</a>)</li>
<li>Fix spurious <code>Error::NonFinite</code> from
<code>Uniform::new_inclusive</code> on large finite float ranges such as
<code>0.0..=f64::MAX</code> (<a
href="https://redirect.github.com/rust-random/rand/issues/1821">#1821</a>)</li>
<li>Fix possible panic due to sampling a deserialized
<code>Uniform&lt;char&gt;</code> (<a
href="https://redirect.github.com/rust-random/rand/issues/1831">#1831</a>)</li>
</ul>
<h3>Changes</h3>
<ul>
<li>Report exact remaining lengths from
<code>WeightedIndex::weights()</code> and reduce overhead when reading
weights (<a
href="https://redirect.github.com/rust-random/rand/issues/1838">#1838</a>)</l

**File**: `Cargo.lock` (modified, +9/-9)
```diff
@@ -875,7 +875,7 @@ version = "0.0.0"
 dependencies = [
  "clap",
  "crossterm 0.29.0",
- "rand 0.10.2",
+ "rand 0.10.3",
  "ratatui",
  "termion",
  "termwiz",
@@ -890,7 +890,7 @@ dependencies = [
  "indoc",
  "itertools 0.15.0",
  "palette",
- "rand 0.10.2",
+ "rand 0.10.3",
  "rand_chacha 0.10.0",
  "ratatui",
  "strum",
@@ -1759,7 +1759,7 @@ version = "0.0.0"
 dependencies = [
  "color-eyre",
  "crossterm 0.29.0",
- "rand 0.10.2",
+ "rand 0.10.3",
  "ratatui",
 ]
 
@@ -2064,7 +2064,7 @@ dependencies = [
  "color-eyre",
  "crossterm 0.29.0",
  "line_drawing",
- "rand 0.10.2",
+ "rand 0.10.3",
  "ratatui",
 ]
 
@@ -2767,9 +2767,9 @@ dependencies = [
 
 [[package]]
 name = "rand"
-version = "0.10.2"
+version = "0.10.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c7f5fa3a058cd35567ef9bfa5e75732bee0f9e4c55fa90477bef2dfcdbc4be80"
+checksum = "65c9fb96cbc91e3478eaae79a69fcd3f1ae4ad052e471fe6732fff548984b4af"
 dependencies = [
  "chacha20",
  "getrandom 0.4.1",
@@ -2842,7 +2842,7 @@ dependencies = [
  "instability",
  "palette",
  "pretty_assertions",
- "rand 0.10.2",
+ "rand 0.10.3",
  "ratatui-core",
  "ratatui-crossterm",
  "ratatui-macros",
@@ -4295,7 +4295,7 @@ dependencies = [
  "color-eyre",
  "colorgrad",
  "crossterm 0.29.0",
- "rand 0.10.2",
+ "rand 0.10.3",
  "ratatui",
 ]
 
@@ -4458,7 +4458,7 @@ version = "0.0.0"
 dependencies = [
  "color-eyre",
  "crossterm 0.29.0",
- "rand 0.10.2",
+ "rand 0.10.3",
  "ratatui",
 ]
 
```

---

### Incident Patch 7: `54b68743` (2026-09-25)
**Commit Message**: build(deps): bump clap from 4.6.6 to 4.6.7 (#2787)

Bumps [clap](https://github.com/clap-rs/clap) from 4.6.6 to 4.6.7.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/clap-rs/clap/releases">clap's
releases</a>.</em></p>
<blockquote>
<h2>v4.6.7</h2>
<h2>[4.6.7] - 2026-09-14</h2>
<h3>Features</h3>
<ul>
<li><em>(derive)</em> Add <code>#[command(defer = &lt;bool&gt;)]</code>
attribute to opt-in to lazy initialisation of subcommands</li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/clap-rs/clap/blob/main/CHANGELOG.md">clap's
changelog</a>.</em></p>
<blockquote>
<h2>[4.6.7] - 2026-09-14</h2>
<h3>Features</h3>
<ul>
<li><em>(derive)</em> Add <code>#[command(defer = &lt;bool&gt;)]</code>
attribute to opt-in to lazy initialisation of subcommands</li>
</ul>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/clap-rs/clap/commit/d3e59a9ab214910b9dad02921b7ef42c6400de9b"><code>d3e59a9</code></a>
chore: Release</li>
<li><a
href="https://github.com/clap-rs/clap/commit/d997f878c484e02b2935d32a7b67afe990e91227"><code>d997f87</code></a>
do

**File**: `Cargo.lock` (modified, +8/-8)
```diff
@@ -428,9 +428,9 @@ dependencies = [
 
 [[package]]
 name = "clap"
-version = "4.6.6"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "473c7e07f409a8d772161724aa8db6a765a2532a70f9667eeb7b49d3d02fbdca"
+checksum = "aa8876b300ab35ba921adea3dfd70157a46249b33f95c9084ae5709785478946"
 dependencies = [
  "clap_builder",
  "clap_derive",
@@ -448,9 +448,9 @@ dependencies = [
 
 [[package]]
 name = "clap_builder"
-version = "4.6.6"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7b48fea5a88e9ae728a2dcbedbfc0e730f7d60da42e1cb049a83c9fb8b789889"
+checksum = "ec0797fb7aeb1406c84efac526901f7ec3ead2124f946b494e72879d4b54704d"
 dependencies = [
  "anstream",
  "anstyle",
@@ -460,9 +460,9 @@ dependencies = [
 
 [[package]]
 name = "clap_derive"
-version = "4.6.4"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d012d2b9d65aca7f18f4d9878a045bc17899bba951561ba5ec3c2ba1eed9a061"
+checksum = "f9c751b79415d4e559e3d1fcf128e09e720eb673a06d26cf6f392d37d75b66e0"
 dependencies = [
  "heck",
  "proc-macro2",
@@ -1070,7 +1070,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "778e2ac28f6c47af28e4907f13ffd1e1ddbd400980a9abd7c8df189bf578a5ad"
 dependencies = [
  "libc",
- "windows-sys 0.60.2",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
@@ -3152,7 +3152,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.9.4",
- "windows-sys 0.60.2",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
```

---

### Incident Patch 8: `21324fe8` (2026-09-23)
**Commit Message**: build(deps): bump release-plz/action from 0.5.136 to 0.5.138 (#2789)

Bumps [release-plz/action](https://github.com/release-plz/action) from
0.5.136 to 0.5.138.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/release-plz/action/releases">release-plz/action's
releases</a>.</em></p>
<blockquote>
<h2>v0.5.138</h2>
<h2>What's Changed</h2>
<ul>
<li>chore(deps): lock file maintenance by <a
href="https://github.com/renovate"><code>@​renovate</code></a>[bot] in
<a
href="https://redirect.github.com/release-plz/action/pull/532">release-plz/action#532</a></li>
<li>chore(deps): update dependency taiki-e/install-action to v2.87.13 by
<a href="https://github.com/renovate"><code>@​renovate</code></a>[bot]
in <a
href="https://redirect.github.com/release-plz/action/pull/534">release-plz/action#534</a></li>
<li>Update to 0.3.168 by <a
href="https://github.com/marcoieni"><code>@​marcoieni</code></a> in <a
href="https://redirect.github.com/release-plz/action/pull/535">release-plz/action#535</a></li>
</ul>
<p><strong>Full Changelog</strong>: <a
href="https://github.com/release-plz/action/compare/v0.5.137...v0.5.138">https://github.com/release-plz/action/compar

**File**: `.github/workflows/release-plz.yml` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ jobs:
       - uses: rust-lang/crates-io-auth-action@c6f97d42243bad5fab37ca0427f495c86d5b1a18 # v1
         id: auth
       - name: Run release-plz
-        uses: release-plz/action@a80d79efe0a195618acb02a4089d55fe74d2505f # v0.5
+        uses: release-plz/action@d6c56271d640b6c1b61d1e00593641c400a9f4bd # v0.5
         with:
           command: release
         env:
@@ -63,7 +63,7 @@ jobs:
         with:
           toolchain: stable
       - name: Run release-plz
-        uses: release-plz/action@a80d79efe0a195618acb02a4089d55fe74d2505f # v0.5
+        uses: release-plz/action@d6c56271d640b6c1b61d1e00593641c400a9f4bd # v0.5
         with:
           command: release-pr
         env:
```

---

### Incident Patch 9: `7023d4f2` (2026-09-20)
**Commit Message**: fix(example): handle calendar exit keys (#2639)

<!-- Please read CONTRIBUTING.md before submitting any pull request. -->

---------

Co-authored-by: Josh McKinney <[REDACTED_EMAIL]>

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

### Incident Patch 10: `de5e3025` (2026-09-20)
**Commit Message**: build(deps): bump unicode-truncate from 2.0.1 to 3.0.0 (#2732)

Bumps [unicode-truncate](https://github.com/Aetf/unicode-truncate) from
2.0.1 to 3.0.0.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/Aetf/unicode-truncate/releases">unicode-truncate's
releases</a>.</em></p>
<blockquote>
<h2>v3.0.0</h2>
<h3>Fixed</h3>
<ul>
<li><em>(deps)</em> update all non-major dependencies</li>
</ul>
<h3>Other</h3>
<ul>
<li>publish to crates.io via trusted publishing</li>
<li>[<strong>breaking</strong>] bump MSRV to 1.85</li>
<li><em>(deps)</em> update actions/checkout action to v7</li>
<li><em>(deps)</em> update actions/create-github-app-token action to
v3</li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/Aetf/unicode-truncate/blob/master/CHANGELOG.md">unicode-truncate's
changelog</a>.</em></p>
<blockquote>
<h2><a
href="https://github.com/Aetf/unicode-truncate/compare/v2.0.1...v3.0.0">3.0.0</a>
- 2026-08-20</h2>
<h3>Fixed</h3>
<ul>
<li><em>(deps)</em> update all non-major dependencies</li>
</ul>
<h3>Other</h3>
<ul>
<li>publish to crates.io via trusted publishing</li>
<li>[<strong>br

**File**: `Cargo.lock` (modified, +5/-14)
```diff
@@ -1812,15 +1812,6 @@ dependencies = [
  "either",
 ]
 
-[[package]]
-name = "itertools"
-version = "0.14.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2b192c782037fadd9cfa75548310488aabdbf3d2da73885b31bd0abd03351285"
-dependencies = [
- "either",
-]
-
 [[package]]
 name = "itertools"
 version = "0.15.0"
@@ -3148,7 +3139,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.4.15",
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -4203,11 +4194,11 @@ checksum = "c6f5d3c3b1bf09027a88a6bc961fc00497d651009560b5463668dc81b0fa87a8"
 
 [[package]]
 name = "unicode-truncate"
-version = "2.0.1"
+version = "3.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "16b380a1238663e5f8a691f9039c73e1cdae598a30e9855f541d29b08b53e9a5"
+checksum = "f5dde200aa133f5b6d9cc616878815ffaa45ad9529ef4a2f04d86bab91d63984"
 dependencies = [
- "itertools 0.14.0",
+ "itertools 0.15.0",
  "unicode-segmentation",
  "unicode-width",
 ]
@@ -4597,7 +4588,7 @@ version = "0.1.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "cf221c93e13a30d793f7645a0e7762c55d169dbb0a49671918a2319d289b10bb"
 dependencies = [
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ tracing-appender = "0.2"
 tracing-subscriber = "0.3.10"
 trybuild = "1.0.19"
 unicode-segmentation = "1.9"
-unicode-truncate = { version = "2", default-features = false }
+unicode-truncate = { version = "3", default-features = false }
 # See <https://github.com/ratatui/ratatui/issues/1271> for information about why we pin unicode-width
 unicode-width = ">=0.2.0"
 
```

---

### Incident Patch 11: `3f38adb2` (2026-09-20)
**Commit Message**: build(deps): bump crate-ci/typos from 1.47.2 to 1.48.0 (#2633)

Bumps [crate-ci/typos](https://github.com/crate-ci/typos) from 1.47.2 to
1.48.0.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/crate-ci/typos/releases">crate-ci/typos's
releases</a>.</em></p>
<blockquote>
<h2>v1.48.0</h2>
<h2>[1.48.0] - 2026-06-30</h2>
<h3>Features</h3>
<ul>
<li>Updated the dictionary with the <a
href="https://redirect.github.com/crate-ci/typos/issues/1562">June
2026</a> changes</li>
</ul>
</blockquote>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a
href="https://github.com/crate-ci/typos/blob/master/CHANGELOG.md">crate-ci/typos's
changelog</a>.</em></p>
<blockquote>
<h1>Change Log</h1>
<p>All notable changes to this project will be documented in this
file.</p>
<p>The format is based on <a href="https://keepachangelog.com/">Keep a
Changelog</a>
and this project adheres to <a href="https://semver.org/">Semantic
Versioning</a>.</p>
<!-- raw HTML omitted -->
<h2>[Unreleased] - ReleaseDate</h2>
<h2>[1.48.0] - 2026-06-30</h2>
<h3>Features</h3>
<ul>
<li>Updated the dictionary with the <a
href="https://redirect.github.com/crate-ci/typos/is

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           persist-credentials: false
-      - uses: crate-ci/typos@d43b6c087ac471e2ea7b8af622ff15f05c0c365b # master
+      - uses: crate-ci/typos@512fc24f32f44ab01972217aaaf3dc86ec234d53 # v1.50.2
 
   # Check for any disallowed dependencies in the codebase due to license / security issues.
   # See <https://github.com/EmbarkStudios/cargo-deny>
```

---

### Incident Patch 12: `8eab17be` (2026-09-19)
**Commit Message**: docs: fix RELEASE.md references to nonexistent cd.yml (#2782)

Fixes #2781

Co-authored-by: hikmetba-bit <[REDACTED_EMAIL]>
Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

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

### Incident Patch 13: `ad2e79e6` (2026-09-18)
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

### Incident Patch 14: `f6f086db` (2026-09-15)
**Commit Message**: build(deps): bump bitflags from 2.13.1 to 2.13.2 (#2779)

Bumps [bitflags](https://github.com/bitflags/bitflags) from 2.13.1 to
2.13.2.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/bitflags/bitflags/releases">bitflags's
releases</a>.</em></p>
<blockquote>
<h2>2.13.2</h2>
<h2>What's Changed</h2>
<ul>
<li>Flags: adjust order of elements in manual implementation example by
<a
href="https://github.com/DanielEScherzer"><code>@​DanielEScherzer</code></a>
in <a
href="https://redirect.github.com/bitflags/bitflags/pull/494">bitflags/bitflags#494</a></li>
<li>Re-pull const declarations outside of nested const by <a
href="https://github.com/KodrAus"><code>@​KodrAus</code></a> in <a
href="https://redirect.github.com/bitflags/bitflags/pull/496">bitflags/bitflags#496</a></li>
<li>Prepare for 2.13.2 release by <a
href="https://github.com/KodrAus"><code>@​KodrAus</code></a> in <a
href="https://redirect.github.com/bitflags/bitflags/pull/497">bitflags/bitflags#497</a></li>
</ul>
<p><strong>Full Changelog</strong>: <a
href="https://github.com/bitflags/bitflags/compare/2.13.1...2.13.2">https://github.com/bitflags/bitflags/compare/2.13.1...2.13.2</a></p>
</

**File**: `Cargo.lock` (modified, +18/-18)
```diff
@@ -236,9 +236,9 @@ checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
 
 [[package]]
 name = "bitflags"
-version = "2.13.1"
+version = "2.13.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b588b76d00fde79687d7646a9b5bdf3cc0f655e0bbd080335a95d7e96f3587da"
+checksum = "3ded4057c258ba199e2d26386d3af3780957ecaee6c4ef4041c6b4b8b97c0b06"
 dependencies = [
  "serde_core",
 ]
@@ -704,7 +704,7 @@ version = "0.28.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "829d955a0bb380ef178a640b91779e3987da38c9aea133b20614cfed8cdea9c6"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "crossterm_winapi",
  "mio",
  "parking_lot",
@@ -721,7 +721,7 @@ version = "0.29.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d8b9f2e4c67f833b660cdb0a3523065869fb35570177239812ed4c905aeff87b"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "crossterm_winapi",
  "derive_more",
  "document-features",
@@ -1920,7 +1920,7 @@ version = "0.3.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "e752191d037c44ad111a8caa762921926658402f01cc1253f7bef2020ece4f5e"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -2083,7 +2083,7 @@ version = "0.29.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "71e2746dc3a24dd78b3cfcb7be93368c6de9963d30f43a6a73998a9cf4b17b46"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "cfg-if",
  "cfg_aliases",
  "libc",
@@ -2870,7 +2870,7 @@ name = "ratatui-core"
 version = "0.1.2"
 dependencies = [
  "anstyle",
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "compact_str",
  "critical-section",
  "document-features",
@@ -2958,7 +2958,7 @@ dependencies = [
 name = "ratatui-widgets"
 version = "0.3.2"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "color-eyre",
  "crossterm 0.29.0",
  "document-features",
@@ -3004,7 +3004,7 @@ version = "0.5.17"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5407465600fb0548f1442edf71dd20683c6ed326200ace4b1ef0763521bb3b77"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -3144,7 +3144,7 @@ version = "0.38.44"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "fdb5bc1ae2baa591800df16c9ca78619bf65c0488b41b96ccec5d11220d8c154"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "errno",
  "libc",
  "linux-raw-sys 0.4.15",
@@ -3157,7 +3157,7 @@ version = "1.0.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "11181fbabf243db407ef8df94a6ce0b2f9a733bd8be4ad02b4eda9602296cac8"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "errno",
  "libc",
  "linux-raw-sys 0.9.4",
@@ -3285,7 +3285,7 @@ version = "3.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "80fb1d92c5028aa318b4b8bd7302a5bfcf48be96a37fc6fc790f806b0004ee0c"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "core-foundation",
  "core-foundation-sys",
  "libc",
@@ -3699,7 +3699,7 @@ version = "0.4.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "881a7f20ade48167027822c52a0aeca879afa3174b15c71997827826bce669f9"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "parking_lot",
  "rustix 1.0.8",
  "signal-hook",
@@ -3746,7 +3746,7 @@ checksum = "4676b37242ccbd1aabf56edb093a4827dc49086c0ffd764a5705899e0f35f8f7"
 dependencies = [
  "anyhow",
  "base64",
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "fancy-regex",
  "filedescriptor",
  "finl_unicode",
@@ -4024,7 +4024,7 @@ version = "0.6.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "adc82fd73de2a9722ac5da747f12383d2bfdb93591ee6c58486e0097890f05f2"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "bytes",
  "futures-util",
  "http",
@@ -4455,7 +4455,7 @@ version = "0.244.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "47b807c72e1bac69382b3a6fb3dbe8ea4c0ed87ff5629b8685ae6b9a611028fe"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "hashbrown 0.15.5",
  "indexmap",
  "semver",
@@ -4871,7 +4871,7 @@ version = "0.39.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "6f42320e61fe2cfd34354ecb597f86f413484a798ba44a8ca1165c58d42da6c1"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -4912,7 +4912,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9d66ea20e9553b30172b5e831994e35fbde2d165325bec84fc43dbf6f4eb9cb2"
 dependencies = [
  "anyhow",
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "indexmap",
  "log",
  "serde",
```

---

### Incident Patch 15: `4c61b184` (2026-09-15)
**Commit Message**: build(deps): bump release-plz/action from 0.5.132 to 0.5.136 (#2775)

Bumps [release-plz/action](https://github.com/release-plz/action) from
0.5.132 to 0.5.136.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/release-plz/action/releases">release-plz/action's
releases</a>.</em></p>
<blockquote>
<h2>v0.5.136</h2>
<h2>What's Changed</h2>
<ul>
<li>Update to 0.3.165 by <a
href="https://github.com/marcoieni"><code>@​marcoieni</code></a> in <a
href="https://redirect.github.com/release-plz/action/pull/525">release-plz/action#525</a></li>
</ul>
<p><strong>Full Changelog</strong>: <a
href="https://github.com/release-plz/action/compare/v0.5.135...v0.5.136">https://github.com/release-plz/action/compare/v0.5.135...v0.5.136</a></p>
<h2>v0.5.135</h2>
<h2>What's Changed</h2>
<ul>
<li>chore(deps): update dependency taiki-e/install-action to v2.87.9 by
<a href="https://github.com/renovate"><code>@​renovate</code></a>[bot]
in <a
href="https://redirect.github.com/release-plz/action/pull/524">release-plz/action#524</a></li>
<li>Update to 0.3.164 by <a
href="https://github.com/marcoieni"><code>@​marcoieni</code></a> in <a
href="https://redirect.github.com/relea

**File**: `.github/workflows/release-plz.yml` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ jobs:
       - uses: rust-lang/crates-io-auth-action@c6f97d42243bad5fab37ca0427f495c86d5b1a18 # v1
         id: auth
       - name: Run release-plz
-        uses: release-plz/action@b5543c19b03be9bd48852d20ca89f478b7723260 # v0.5
+        uses: release-plz/action@a80d79efe0a195618acb02a4089d55fe74d2505f # v0.5
         with:
           command: release
         env:
@@ -63,7 +63,7 @@ jobs:
         with:
           toolchain: stable
       - name: Run release-plz
-        uses: release-plz/action@b5543c19b03be9bd48852d20ca89f478b7723260 # v0.5
+        uses: release-plz/action@a80d79efe0a195618acb02a4089d55fe74d2505f # v0.5
         with:
           command: release-pr
         env:
```

#### Recent Merged Pull Requests:
- **PR #2801** (2026-09-28): build(deps): bump rand from 0.10.2 to 0.10.3 (@dependabot[bot])
- **PR #2800** (2026-09-28): build(deps): bump thiserror from 2.0.20 to 2.0.21 (@dependabot[bot])
- **PR #2799** (2026-09-28): build(deps): bump instability from 0.3.13 to 0.3.14 (@dependabot[bot])
- **PR #2798** (2026-09-28): build(deps): bump crate-ci/typos from 1.50.2 to 1.50.3 (@dependabot[bot])
- **PR #2797** (2026-09-28): build(deps): bump lru from 0.18.4 to 0.18.5 (@dependabot[bot])
- **PR #2796** (2026-09-28): build(deps): bump release-plz/action from 0.5.138 to 0.5.139 (@dependabot[bot])
- **PR #2795** (closed): build(deps): bump taiki-e/install-action from 2.84.0 to 2.87.20 (@dependabot[bot])
- **PR #2789** (2026-09-23): build(deps): bump release-plz/action from 0.5.136 to 0.5.138 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
