# Forensic Learning Record (Deep Inspection): transact-rs/sqlx

> **Canonical Artifact**: `07_PROJECT_LEARNING/transact-rs-sqlx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/transact-rs/sqlx](https://github.com/transact-rs/sqlx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:07.540Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `transact-rs/sqlx`
- **Description**: 🧰 The Rust SQL Toolkit. An async, pure Rust SQL crate featuring compile-time checked queries without a DSL. Supports PostgreSQL, MySQL, and SQLite.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 17514 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/sqlite/describe.rs`
```
use criterion::BenchmarkId;
use criterion::Criterion;
use criterion::{criterion_group, criterion_main};

use sqlx::sqlite::{Sqlite, SqliteConnection};
use sqlx::Executor;
use sqlx_test::new;

// Here we have an async function to benchmark
async fn do_describe_trivial(db: &std::cell::RefCell<SqliteConnection>) {
    db.borrow_mut().describe("select 1").await.unwrap();
}

async fn do_describe_recursive(db: &std::cell::RefCell<SqliteConnection>) {
    db.borrow_mut()
        .describe(
            r#"
            WITH RECURSIVE schedule(begin_date) AS MATERIALIZED (
                SELECT datetime('2022-10-01')
                WHERE datetime('2022-10-01') < datetime('2022-11-03')
                UNION ALL
                SELECT datetime(begin_date,'+1 day')
                FROM schedule
                WHERE datetime(begin_date) < datetime(?2)
            )
            SELECT
            begin_date
            FROM schedule
            GROUP BY begin_date
            "#,
        )
        .await
        .unwrap();
}

async fn do_describe_insert(db: &std::cell::RefCell<SqliteConnection>) {
    db.borrow_mut()
        .describe("INSERT INTO tweet (id, text) VALUES (2, 'Hello') RETURNING *")
        .await
        .unwrap();
}

async fn do_describe_insert_fks(db: &std::cell::RefCell<SqliteConnection>) {
    db.borrow_mut()
        .describe("insert into statements (text) values ('a') returning id")
        .await
        .unwrap();
}

async fn init_connection() -> SqliteConnection {
    let mut conn = new::<Sqlite>().await.unwrap();

    conn.execute(
        r#"
        CREATE TEMPORARY TABLE statements (
          id integer not null primary key,
          text text not null
        );

        CREATE TEMPORARY TABLE votes1 (statement_id integer not null references statements(id));
        CREATE TEMPORARY TABLE votes2 (statement_id integer not null references statements(id));
        CREATE TEMPORARY TABLE votes3 (statement_id integer not null references statements(id));
        CREATE TEMPORARY TABLE votes4 (statement_id integer not null references statements(id));
        CREATE TEMPORARY TABLE votes5 (statement_id integer not null references statements(id));
        CREATE TEMPORARY TABLE votes6 (statement_id integer not null references statements(id));
        --CREATE TEMPORARY TABLE votes7 (statement_id integer not null references statements(id));
        --CREATE TEMPORARY TABLE votes8 (statement_id integer not null references statements(id));
        --CREATE TEMPORARY TABLE votes9 (statement_id integer not null references statements(id));
        --CREATE TEMPORARY TABLE votes10 (statement_id integer not null references statements(id));
        --CREATE TEMPORARY TABLE votes11 (statement_id integer not null references statements(id));
    "#,
    )
    .await
    .unwrap();
    conn
}

fn describe_trivial(c: &mut Criterion) {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let db = std::cell::RefCell::new(runtime.block_on(init_connection()));

    c.bench_with_input(
        BenchmarkId::new("select", "trivial"),
        &db,
        move |b, db_ref| {
            // Insert a call to `to_async` to convert the bencher to async mode.
            // The timing loops are the same as with the normal bencher.
            b.to_async(&runtime).iter(|| do_describe_trivial(db_ref));
        },
    );
}

fn describe_recursive(c: &mut Criterion) {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let db = std::cell::RefCell::new(runtime.block_on(init_connection()));

    c.bench_with_input(
        BenchmarkId::new("select", "recursive"),
        &db,
        move |b, db_ref| {
            // Insert a call to `to_async` to convert the bencher to async mode.
            // The timing loops are the same as with the normal bencher.
            b.to_async(&runtime).iter(|| do_describe_recursive(db_ref));
        },
    );
}

fn describe_insert(c: &mut Criterion) {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let db = std::cell::RefCell::new(runtime.block_on(init_connection()));

    c.bench_with_input(
        BenchmarkId::new("insert", "returning"),
        &db,
        move |b, db_ref| {
            // Insert a call to `to_async` to convert the bencher to async mode.
            // The timing loops are the same as with the normal bencher.
            b.to_async(&runtime).iter(|| do_describe_insert(db_ref));
        },
    );
}

fn describe_insert_fks(c: &mut Criterion) {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let db = std::cell::RefCell::new(runtime.block_on(init_connection()));

    c.bench_with_input(BenchmarkId::new("insert", "fks"), &db, move |b, db_ref| {
        // Insert a call to `to_async` to convert the bencher to async mode.
        // The timing loops are the same as with the normal bencher.
        b.to_async(&runtime).iter(|| do_describe_insert_fks(db_ref));
    });
}

criterion_group!(
    benches,
    describe_trivial,
    describe_recursive,
    describe_insert,
    describe_insert_fks
);
criterion_main!(benches);

```

### Core Architecture Module: `examples/mysql/todos/src/main.rs`
```
use clap::{Parser, Subcommand};
use sqlx::mysql::MySqlPool;
use std::env;

#[derive(Parser)]
struct Args {
    #[command(subcommand)]
    cmd: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    Add { description: String },
    Done { id: u64 },
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let pool = MySqlPool::connect(&env::var("DATABASE_URL")?).await?;

    match args.cmd {
        Some(Command::Add { description }) => {
            println!("Adding new todo with description '{description}'");
            let todo_id = add_todo(&pool, description).await?;
            println!("Added new todo with id {todo_id}");
        }
        Some(Command::Done { id }) => {
            println!("Marking todo {id} as done");
            if complete_todo(&pool, id).await? {
                println!("Todo {id} is marked as done");
            } else {
                println!("Invalid id {id}");
            }
        }
        None => {
            println!("Printing list of all todos");
            list_todos(&pool).await?;
        }
    }

    Ok(())
}

async fn add_todo(pool: &MySqlPool, description: String) -> anyhow::Result<u64> {
    // Insert the task, then obtain the ID of this row
    let todo_id = sqlx::query!(
        r#"
INSERT INTO todos ( description )
VALUES ( ? )
        "#,
        description
    )
    .execute(pool)
    .await?
    .last_insert_id();

    Ok(todo_id)
}

async fn complete_todo(pool: &MySqlPool, id: u64) -> anyhow::Result<bool> {
    let rows_affected = sqlx::query!(
        r#"
UPDATE todos
SET done = TRUE
WHERE id = ?
        "#,
        id
    )
    .execute(pool)
    .await?
    .rows_affected();

    Ok(rows_affected > 0)
}

async fn list_todos(pool: &MySqlPool) -> anyhow::Result<()> {
    let recs = sqlx::query!(
        r#"
SELECT id, description, done
FROM todos
ORDER BY id
        "#
    )
    .fetch_all(pool)
    .await?;

    // NOTE: Booleans in MySQL are stored as `TINYINT(1)` / `i8`
    //       0 = false, non-0 = true
    for rec in recs {
        println!(
            "- [{}] {}: {}",
            if rec.done != 0 { "x" } else { " " },
            rec.id,
            &rec.description,
        );
    }

    Ok(())
}

```

### Core Architecture Module: `examples/postgres/chat/src/main.rs`
```
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::text::Line;
use ratatui::{
    backend::{Backend, CrosstermBackend},
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Span, Text},
    widgets::{Block, Borders, List, ListItem, Paragraph},
    Frame, Terminal,
};
use sqlx::postgres::PgListener;
use sqlx::PgPool;
use std::sync::Arc;
use std::{error::Error, io};
use tokio::{sync::Mutex, time::Duration};
use unicode_width::UnicodeWidthStr;

struct ChatApp {
    input: String,
    messages: Arc<Mutex<Vec<String>>>,
    pool: PgPool,
}

impl ChatApp {
    fn new(pool: PgPool) -> Self {
        ChatApp {
            input: String::new(),
            messages: Arc::new(Mutex::new(Vec::new())),
            pool,
        }
    }

    async fn run<B: Backend>(
        mut self,
        terminal: &mut Terminal<B>,
        mut listener: PgListener,
    ) -> Result<(), Box<dyn Error>>
    where
        <B as Backend>::Error: 'static,
    {
        // setup listener task
        let messages = self.messages.clone();
        tokio::spawn(async move {
            while let Ok(msg) = listener.recv().await {
                messages.lock().await.push(msg.payload().to_string());
            }
        });

        loop {
            let messages: Vec<ListItem> = self
                .messages
                .lock()
                .await
                .iter()
                .map(|m| {
                    let content = vec![Line::from(Span::raw(m.to_owned()))];
                    ListItem::new(content)
                })
                .collect();

            terminal.draw(|f| self.ui(f, messages))?;

            if !event::poll(Duration::from_millis(20))? {
                continue;
            }

            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Enter => {
                        notify(&self.pool, &self.input).await?;
                        self.input.clear();
                    }
                    KeyCode::Char(c) => {
                        self.input.push(c);
                    }
                    KeyCode::Backspace => {
                        self.input.pop();
                    }
                    KeyCode::Esc => {
                        return Ok(());
                    }
                    _ => {}
                }
            }
        }
    }

    fn ui(&mut self, frame: &mut Frame, messages: Vec<ListItem>) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .margin(2)
            .constraints(
                [
                    Constraint::Length(1),
                    Constraint::Length(3),
                    Constraint::Min(1),
                ]
                .as_ref(),
            )
            .split(frame.size());

        let text = Text::from(Line::from(vec![
            Span::raw("Press "),
            Span::styled("Enter", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(" to send the message, "),
            Span::styled("Esc", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(" to quit"),
        ]));
        let help_message = Paragraph::new(text);
        frame.render_widget(help_message, chunks[0]);

        let input = Paragraph::new(self.input.as_str())
            .style(Style::default().fg(Color::Yellow))
            .block(Block::default().borders(Borders::ALL).title("Input"));
        frame.render_widget(input, chunks[1]);
        frame.set_cursor(
            // Put cursor past the end of the input text
            chunks[1].x + self.input.width() as u16 + 1,
            // Move one line down, from the border to the input line
            chunks[1].y + 1,
        );

        let messages =
            List::new(messages).block(Block::default().borders(Borders::ALL).title("Messages"));
        frame.render_widget(messages, chunks[2]);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // setup postgres
    let conn_url =
        std::env::var("DATABASE_URL").expect("Env var DATABASE_URL is required for this example.");
    let pool = PgPool::connect(&conn_url).await?;

    let mut listener = PgListener::connect(&conn_url).await?;
    listener.listen("chan0").await?;

    // setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // create app and run it
    let app = ChatApp::new(pool);
    let res = app.run(&mut terminal, listener).await;

    // restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture,
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("{err:?}")
    }

    Ok(())
}

async fn notify(pool: &PgPool, s: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
SELECT pg_notify(chan, payload)
FROM (VALUES ('chan0', $1)) v(chan, payload)
"#,
    )
    .bind(s)
    .execute(pool)
    .await?;

    Ok(())
}

```

### Core Architecture Module: `examples/postgres/files/src/main.rs`
```
use sqlx::{query_file, query_file_as, FromRow, PgPool};
use std::fmt::{Display, Formatter};

#[derive(FromRow)]
struct PostWithAuthorQuery {
    pub post_id: i64,
    pub title: String,
    pub body: String,
    pub author_id: i64,
    pub author_username: String,
}

impl Display for PostWithAuthorQuery {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            r#"
            post_id: {},
            title: {},
            body: {},
            author_id: {},
            author_username: {}
        "#,
            self.post_id, self.title, self.body, self.author_id, self.author_username
        )
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    let pool = PgPool::connect(&dotenvy::var("DATABASE_URL")?).await?;

    // we can use a traditional wrapper around the `query!()` macro using files
    query_file!("queries/insert_seed_data.sql")
        .execute(&pool)
        .await?;

    // we can also use `query_file_as!()` similarly to `query_as!()` to map our database models
    let posts_with_authors = query_file_as!(PostWithAuthorQuery, "queries/list_all_posts.sql")
        .fetch_all(&pool)
        .await?;

    for post_with_author in posts_with_authors {
        println!("{post_with_author}");
    }

    Ok(())
}

```

### Core Architecture Module: `examples/postgres/json/src/main.rs`
```
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::postgres::PgPool;
use sqlx::types::Json;
use std::io::{self, Read};
use std::num::NonZeroU8;

#[derive(Parser)]
struct Args {
    #[clap(subcommand)]
    cmd: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    Add,
}

#[derive(Deserialize, Serialize)]
struct Person {
    name: String,
    age: NonZeroU8,
    #[serde(flatten)]
    extra: Map<String, Value>,
}

struct Row {
    id: i64,
    person: Json<Person>,
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let pool = PgPool::connect(&dotenvy::var("DATABASE_URL")?).await?;

    match args.cmd {
        Some(Command::Add) => {
            let mut json = String::new();
            io::stdin().read_to_string(&mut json)?;

            let person: Person = serde_json::from_str(&json)?;
            println!(
                "Adding new person: {}",
                &serde_json::to_string_pretty(&person)?
            );

            let person_id = add_person(&pool, person).await?;
            println!("Added new person with ID {person_id}");
        }
        None => {
            println!("Printing all people");
            list_people(&pool).await?;
        }
    }

    Ok(())
}

async fn add_person(pool: &PgPool, person: Person) -> anyhow::Result<i64> {
    let rec = sqlx::query!(
        r#"
INSERT INTO people ( person )
VALUES ( $1 )
RETURNING id
        "#,
        Json(person) as _
    )
    .fetch_one(pool)
    .await?;

    Ok(rec.id)
}

async fn list_people(pool: &PgPool) -> anyhow::Result<()> {
    let rows = sqlx::query_as!(
        Row,
        r#"
SELECT id, person as "person: Json<Person>"
FROM people
ORDER BY id
        "#
    )
    .fetch_all(pool)
    .await?;

    for row in rows {
        println!(
            "{}: {}",
            row.id,
            &serde_json::to_string_pretty(&row.person)?
        );
    }

    Ok(())
}

```

### Core Architecture Module: `examples/postgres/listen/src/main.rs`
```
use futures_util::TryStreamExt;
use sqlx::postgres::PgListener;
use sqlx::{Executor, PgPool};
use std::pin::pin;
use std::sync::atomic::{AtomicI64, Ordering};
use std::time::Duration;

/// How long to sit in the listen loop before exiting.
///
/// This ensures the example eventually exits, which is required for automated testing.
const LISTEN_DURATION: Duration = Duration::from_secs(5);

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Building PG pool.");
    let conn_str =
        std::env::var("DATABASE_URL").expect("Env var DATABASE_URL is required for this example.");
    let pool = sqlx::PgPool::connect(&conn_str).await?;

    let mut listener = PgListener::connect_with(&pool).await?;

    let notify_pool = pool.clone();
    let _t = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(2));

        while !notify_pool.is_closed() {
            interval.tick().await;
            notify(&notify_pool).await;
        }
    });

    println!("Starting LISTEN loop.");

    listener.listen_all(vec!["chan0", "chan1", "chan2"]).await?;

    let mut counter = 0usize;
    loop {
        let notification = listener.recv().await?;
        println!("[from recv]: {notification:?}");

        counter += 1;
        if counter >= 3 {
            break;
        }
    }

    // Prove that we are buffering messages by waiting for 6 seconds
    listener.execute("SELECT pg_sleep(6)").await?;

    let mut stream = listener.into_stream();

    // `Sleep` must be pinned
    let mut timeout = pin!(tokio::time::sleep(LISTEN_DURATION));

    loop {
        tokio::select! {
            res = stream.try_next() => {
                if let Some(notification) = res? {
                    println!("[from stream]: {notification:?}");
                } else {
                    break;
                }
            },
            _ = timeout.as_mut() => {
                // Don't run forever
                break;
            }
        }
    }

    // The stream is holding one connection. It needs to be dropped to allow the connection to
    // return to the pool, otherwise `pool.close()` would never return.
    drop(stream);

    pool.close().await;

    Ok(())
}

async fn notify(pool: &PgPool) {
    static COUNTER: AtomicI64 = AtomicI64::new(0);

    // There's two ways you can invoke `NOTIFY`:
    //
    // 1: `NOTIFY <channel>, '<payload>'` which cannot take bind parameters and
    // <channel> is an identifier which is lowercased unless double-quoted
    //
    // 2: `SELECT pg_notify('<channel>', '<payload>')` which can take bind parameters
    // and <channel> preserves its case
    //
    // We recommend #2 for consistency and usability.

    // language=PostgreSQL
    let res = sqlx::query(
        r#"
-- this emits '{ "payload": N }' as the actual payload
select pg_notify(chan, json_build_object('payload', payload)::text)
from (
         values ('chan0', $1),
                ('chan1', $2),
                ('chan2', $3)
     ) notifies(chan, payload)
    "#,
    )
    .bind(COUNTER.fetch_add(1, Ordering::SeqCst))
    .bind(COUNTER.fetch_add(1, Ordering::SeqCst))
    .bind(COUNTER.fetch_add(1, Ordering::SeqCst))
    .execute(pool)
    .await;

    println!("[from notify]: {res:?}");
}

```

### Core Architecture Module: `examples/postgres/mockable-todos/src/main.rs`
```
use async_trait::async_trait;
use clap::{Parser, Subcommand};
use sqlx::postgres::PgPool;
use std::{env, io::Write, sync::Arc};

#[derive(Parser)]
struct Args {
    #[command(subcommand)]
    cmd: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    Add { description: String },
    Done { id: i64 },
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let args = Args::parse();
    let pool = PgPool::connect(&env::var("DATABASE_URL")?).await?;
    let todo_repo = PostgresTodoRepo::new(pool);
    let mut writer = std::io::stdout();

    handle_command(args, todo_repo, &mut writer).await
}

async fn handle_command(
    args: Args,
    todo_repo: impl TodoRepo,
    writer: &mut impl Write,
) -> anyhow::Result<()> {
    match args.cmd {
        Some(Command::Add { description }) => {
            writeln!(
                writer,
                "Adding new todo with description '{}'",
                &description
            )?;
            let todo_id = todo_repo.add_todo(description).await?;
            writeln!(writer, "Added new todo with id {todo_id}")?;
        }
        Some(Command::Done { id }) => {
            writeln!(writer, "Marking todo {id} as done")?;
            if todo_repo.complete_todo(id).await? {
                writeln!(writer, "Todo {id} is marked as done")?;
            } else {
                writeln!(writer, "Invalid id {id}")?;
            }
        }
        None => {
            writeln!(writer, "Printing list of all todos")?;
            todo_repo.list_todos().await?;
        }
    }

    Ok(())
}

#[mockall::automock]
#[async_trait]
pub trait TodoRepo {
    async fn add_todo(&self, description: String) -> anyhow::Result<i64>;
    async fn complete_todo(&self, id: i64) -> anyhow::Result<bool>;
    async fn list_todos(&self) -> anyhow::Result<()>;
}

struct PostgresTodoRepo {
    pg_pool: Arc<PgPool>,
}

impl PostgresTodoRepo {
    fn new(pg_pool: PgPool) -> Self {
        Self {
            pg_pool: Arc::new(pg_pool),
        }
    }
}

#[async_trait]
impl TodoRepo for PostgresTodoRepo {
    async fn add_todo(&self, description: String) -> anyhow::Result<i64> {
        let rec = sqlx::query!(
            r#"
INSERT INTO todos ( description )
VALUES ( $1 )
RETURNING id
        "#,
            description
        )
        .fetch_one(&*self.pg_pool)
        .await?;

        Ok(rec.id)
    }

    async fn complete_todo(&self, id: i64) -> anyhow::Result<bool> {
        let rows_affected = sqlx::query!(
            r#"
UPDATE todos
SET done = TRUE
WHERE id = $1
        "#,
            id
        )
        .execute(&*self.pg_pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    async fn list_todos(&self) -> anyhow::Result<()> {
        let recs = sqlx::query!(
            r#"
SELECT id, description, done
FROM todos
ORDER BY id
        "#
        )
        .fetch_all(&*self.pg_pool)
        .await?;

        for rec in recs {
            println!(
                "- [{}] {}: {}",
                if rec.done { "x" } else { " " },
                rec.id,
                &rec.description,
            );
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;

    #[async_std::test]
    async fn test_mocked_add() {
        let description = String::from("My todo");
        let args = Args {
            cmd: Some(Command::Add {
                description: description.clone(),
            }),
        };

        let mut todo_repo = MockTodoRepo::new();
        todo_repo
            .expect_add_todo()
            .times(1)
            .with(eq(description))
            .returning(|_| Ok(1));

        let mut writer = Vec::new();

        handle_command(args, todo_repo, &mut writer).await.unwrap();

        assert_eq!(
            String::from_utf8_lossy(&writer),
            "Adding new todo with description \'My todo\'\nAdded new todo with id 1\n"
        );
    }
}

```

### Core Architecture Module: `examples/postgres/multi-database/accounts/src/lib.rs`
```
use argon2::{password_hash, Argon2, PasswordHasher, PasswordVerifier};
use password_hash::phc::PasswordHash;
use rand::distr::{Alphanumeric, SampleString};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use tokio::sync::Semaphore;

#[derive(sqlx::Type, Copy, Clone, Debug, serde::Deserialize, serde::Serialize)]
#[sqlx(transparent)]
pub struct AccountId(pub Uuid);

#[derive(sqlx::Type, Clone, Debug, serde::Deserialize, serde::Serialize)]
#[sqlx(transparent)]
pub struct SessionToken(pub String);

pub struct Session {
    pub account_id: AccountId,
    pub session_token: SessionToken,
}

#[derive(Clone)]
pub struct AccountsManager {
    /// To prevent confusion, each crate manages its own database connection pool.
    pool: PgPool,

    /// Controls how many blocking tasks are allowed to run concurrently for Argon2 hashing.
    ///
    /// ### Motivation
    /// Tokio blocking tasks are generally not designed for CPU-bound work.
    ///
    /// If no threads are idle, Tokio will automatically spawn new ones to handle
    /// new blocking tasks up to a very high limit--512 by default.
    ///
    /// This is because blocking tasks are expected to spend their time *blocked*, e.g. on
    /// blocking I/O, and thus not consume CPU resources or require a lot of context switching.
    ///
    /// This strategy is not the most efficient way to use threads for CPU-bound work, which
    /// should schedule work to a fixed number of threads to minimize context switching
    /// and memory usage (each new thread needs significant space allocated for its stack).
    ///
    /// We can work around this by using a purpose-designed thread-pool, like Rayon,
    /// but we still have the problem that those APIs usually are not designed to support `async`,
    /// so we end up needing blocking tasks anyway, or implementing our own work queue using
    /// channels. Rayon also does not shut down idle worker threads.
    ///
    /// `block_in_place` is not a silver bullet, either, as it simply uses `spawn_blocking`
    /// internally to take over from the current thread while it is executing blocking work.
    /// This also prevents futures from being polled concurrently in the current task.
    ///
    /// We can lower the limit for blocking threads when creating the runtime, but this risks
    /// starving other blocking tasks that are being created by the application or the Tokio
    /// runtime itself
    /// (which are used for `tokio::fs`, stdio, resolving of hostnames by `ToSocketAddrs`, etc.).
    ///
    /// Instead, we can just use a Semaphore to limit how many blocking tasks are spawned at once,
    /// emulating the behavior of a thread pool like Rayon without needing any additional crates.
    hashing_semaphore: Arc<Semaphore>,
}

#[derive(Debug, thiserror::Error)]
pub enum CreateAccountError {
    #[error("error creating account: email in-use")]
    EmailInUse,
    #[error("error creating account")]
    General(
        #[source]
        #[from]
        GeneralError,
    ),
}

#[derive(Debug, thiserror::Error)]
pub enum CreateSessionError {
    #[error("unknown email")]
    UnknownEmail,
    #[error("invalid password")]
    InvalidPassword,
    #[error("authentication error")]
    General(
        #[source]
        #[from]
        GeneralError,
    ),
}

#[derive(Debug, thiserror::Error)]
pub enum GeneralError {
    #[error("database error")]
    Sqlx(
        #[source]
        #[from]
        sqlx::Error,
    ),
    #[error("error hashing password")]
    PasswordHash(
        #[source]
        #[from]
        password_hash::Error,
    ),
    #[error("task panicked")]
    Task(
        #[source]
        #[from]
        tokio::task::JoinError,
    ),
}

impl AccountsManager {
    pub async fn setup(
        opts: PgConnectOptions,
        max_hashing_threads: usize,
    ) -> Result<Self, GeneralError> {
        // This should be configurable by the caller, but for simplicity, it's not.
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect_with(opts)
            .await?;

        sqlx::migrate!()
            .run(&pool)
            .await
            .map_err(sqlx::Error::from)?;

        Ok(AccountsManager {
            pool,
            hashing_semaphore: Semaphore::new(max_hashing_threads).into(),
        })
    }

    async fn hash_password(&self, password: String) -> Result<PasswordHash, GeneralError> {
        let guard = self
            .hashing_semaphore
            .clone()
            .acquire_owned()
            .await
            .expect("BUG: this semaphore should not be closed");

        // We transfer ownership to the blocking task and back to ensure Tokio doesn't spawn
        // excess threads.
        let (_guard, res) = tokio::task::spawn_blocking(move || {
            (guard, Argon2::default().hash_password(password.as_bytes()))
        })
        .await?;

        Ok(res?)
    }

    async fn verify_password(
        &self,
        password: String,
        hash: PasswordHash,
    ) -> Result<(), CreateSessionError> {
        let guard = self
            .hashing_semaphore
            .clone()
            .acquire_owned()
            .await
            .expect("BUG: this semaphore should not be closed");

        let (_guard, res) = tokio::task::spawn_blocking(move || {
            (
                guard,
                Argon2::default().verify_password(password.as_bytes(), &hash),
            )
        })
        .await
        .map_err(GeneralError::from)?;

        if let Err(password_hash::Error::PasswordInvalid) = res {
            return Err(CreateSessionError::InvalidPassword);
        }

        res.map_err(GeneralError::from)?;

        Ok(())
    }

    pub async fn create(
        &self,
        email: &str,
        password: String,
    ) -> Result<AccountId, CreateAccountError> {
        // Hash password whether the account exists or not to make it harder
        // to tell the difference in the timing.
        let hash = self.hash_password(password).await?;

        // Thanks to `sqlx.toml`, `account_id` maps to `AccountId`
        sqlx::query_scalar!(
            // language=PostgreSQL
            "insert into account(email, password_hash) \
             values ($1, $2) \
             returning account_id",
            email,
            // However, since arguments don't link back to the target column,
            // SQLx doesn't know that `PasswordHash` would be a valid argument here.
            hash.to_string(),
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if e.as_database_error().and_then(|dbe| dbe.constraint())
                == Some("account_account_id_key")
            {
                CreateAccountError::EmailInUse
            } else {
                GeneralError::from(e).into()
            }
        })
    }

    pub async fn create_session(
        &self,
        email: &str,
        password: String,
    ) -> Result<Session, CreateSessionError> {
        let mut txn = self.pool.begin().await.map_err(GeneralError::from)?;

        // To save a round-trip to the database, we'll speculatively insert the session token
        // at the same time as we're looking up the password hash.
        //
        // This does nothing until the transaction is actually committed.
        let session_token = SessionToken::generate();

        // Thanks to `sqlx.toml`:
        // * `account_id` maps to `AccountId`
        // * `password_hash` maps to `Text<PasswordHash>`
        // * `session_token` maps to `SessionToken`
        let maybe_account = sqlx::query!(
            // language=PostgreSQL
            "with account as (
                select account_id, password_hash \
                from account \
                where email = $1
            ), session as (
                insert into session(session_token, account_id)
                select $2, account_id
             
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4387** (2026-08-20): **Some of the published crates fro version 0.9.0 are missing the content of the license files**
  *Symptoms*: ### I have found these related issues/pull requests  #3237 is closed and was originally resolved by #3293.  But https://github.com/transact-rs/sqlx/pull/3293#issuecomment-2181227547 did not appear to consider that symlink support on windows required special permission and need to be configured properly.  https://github.com/transact-rs/sqlx/pull/3293#issuecomment-2181237393 it has come up.  ### Description  It looks like the release might have been published from windows and ran into https://github.com/rust-lang/cargo/issues/5664  The following crates contain `../LICENSE-APACHE` in the `LICENSE-APACHE` file  instead of the license content.  - [sqlx-core](https://docs.rs/crate/sqlx-core/0.9.0/source/LICENSE-APACHE) - [sqlx-macros](https://docs.rs/crate/sqlx-macros/0.9.0/source/LICENSE-APACHE) - [sqlx-macros-core](https://docs.rs/crate/sqlx-macros-core/0.9.0/source/LICENSE-APACHE) - [sqlx-mysql](https://docs.rs/crate/sqlx-mysql/0.9.0/source/LICENSE-APACHE) - [sqlx-postgres](https://docs.rs/crate/sqlx-postgres/0.9.0/source/LICENSE-APACHE) - [sqlx-sqlite](https://docs.rs/crate/sqlx-sqlite/0.9.0/source/LICENSE-APACHE)  This applies accordingly to the LICENSE-MIT file.  ### Reproduction steps  See links under description  ### SQLx version  0.9.0  ### Enabled SQLx features  packaging  ### Database server and version  irrelevant  ### Operating system  irrelevant  ### Rust version  irrelevant
  **Post-Mortem & Fix Analysis**:
  > I knew using symlinks was a bad idea. I'd feel vindicated but I'm tired of dealing with problems with packaging systems that I'm not involved in.  Enabling symlinks on Windows is still too much of a pain and it's clearly too easy to forget. I don't know why Git for Windows doesn't just create copies instead (I mainly use it from inside RustRover, so it might actually be a bug in their implementation, I don't know).  I'd accept a PR to just replace the symlinks with copies of the files.

- **Issue #4383** (2026-09-02): **[sqlx-cli] ux bug with sqlx prepare**
  *Symptoms*: ### I have found these related issues/pull requests  I've do some search in issues by `sqlx prepare failed CARGO` and just `sqlx prepare` and didn't find any relations with existing prepare command in just `sqlx` and always proposing error with redirecting to `cargo sqlx` invocation  ### Description  **Title**: `sqlx prepare` listed in help but fails with unclear error  **Description**: `prepare` subcommand is listed in `sqlx --help`, but running it directly fails: ``` $ sqlx prepare error: failed to get value of CARGO; prepare subcommand may only be invoked as cargo sqlx prepare ```   This is confusing because: 1. The command is advertised in help output 2. The error message is unclear — it mentions internal `CARGO` variable instead of telling the user what to do  **Suggested fixes** (any one of): - Remove `prepare` from `sqlx --help` if it only works via `cargo sqlx` - Improve error message: suggest using `cargo sqlx prepare` explicitly - Make `sqlx prepare` work standalone by locating `Cargo.toml` automatically  **Workaround**: Use `cargo sqlx prepare` instead of `sqlx prepare`.  ### Reproduction steps  ``` $ sqlx prepare error: failed to get value of CARGO; prepare subcommand may only be invoked as cargo sqlx prepare ```  ### SQLx version  0.9.0  ### Enabled SQLx features  "postgres", "runtime-tokio", "tls-native-tls"   ### Database server and version  Postgres  ### Operating system  Ubuntu 24.04.4 LTS  ### Rust version  1.94.1

- **Issue #4381** (2026-09-09): **Cannot revert.**
  *Symptoms*: ### I have found these related issues/pull requests  #3439  ### Description  In PostgreSQL, when using `options[search_path]=data,public`, revert is not possible.  ### Reproduction steps  ``` PS E:\tmp> Get-ComputerInfo | Select-Object WindowsVersion, WindowsBuildLabEx  WindowsVersion WindowsBuildLabEx -------------- ----------------- 2009           26100.1.amd64fre.ge_release.240331-1435 PS E:\tmp> cat .env DATABASE_URL="postgres://rust:123456@192.168.31.200/rust?options[search_path]=data,public" PS E:\tmp> sqlx migrate add -r init Creating migrations\20260815075646_init.up.sql Creating migrations\20260815075646_init.down.sql PS E:\tmp> cat migrations\20260815075646_init.up.sql -- Add up migration script here CREATE SCHEMA IF NOT EXISTS data; PS E:\tmp> cat migrations\20260815075646_init.down.sql -- Add down migration script here DROP SCHEMA IF EXISTS data CASCADE; PS E:\tmp> sqlx migrate run Applied 20260815075646/migrate init (39.7574ms) PS E:\tmp> sqlx migrate revert No migrations available to revert PS E:\tmp> cat .\.env DATABASE_URL="postgres://rust:123456@192.168.31.200/rust?options[search_path]=public" PS E:\tmp> sqlx migrate revert Applied 20260815075646/revert init (32.6879ms) PS E:\tmp ```  ### SQLx version  sqlx-cli 0.9.0  ### Enabled SQLx features  default  ### Database server and version  PostgreSQL 18.4 (Debian 18.4-1.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit  ### Operating system  docker.io/library/postgres:18  ### Rus
  **Post-Mortem & Fix Analysis**:
  > Not a bug. Please read and understand how setting `search_path` affects unqualified table references like `_sqlx_migrations`: https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH  With 0.9.0, it's now possible to override the path of the migrations table and also automatically create schemas: https://github.com/transact-rs/sqlx/tree/main/examples/postgres/multi-tenant

- **Issue #4373** (2026-09-14): **`SQLite: query!()` segfaults rustc when a column has no declared type**
  *Symptoms*: ### I have found these related issues/pull requests  - **#4088**:  *(Fix) Handle nullability of SQLite rowid alias columns*. This PR introduced the crash. It started requesting the declared-type out-param from `sqlite3_table_column_metadata()` and dereferencing it unconditionally. - **#4323** / **#4322**: another regression from #4088 (`INTEGER PRIMARY KEY` in `RETURNING` going back to `Option`). Different symptom. - **#1979** and **#3546**: both report `unsupported type NULL of column #N`. That's the error you *should* get for a column with no declared type. Right now you get a SIGSEGV before the error can be produced.  ### Description  `StatementHandle::column_nullable` asks `sqlite3_table_column_metadata()` for a column's declared type and then calls `CStr::from_ptr()` on the result without checking for null:  ```rust let datatype = CStr::from_ptr(datatype); ```  SQLite sets that out-param to **NULL** when the column was declared with no type at all, which is legal:  ```sql CREATE TABLE users (device_id PRIMARY KEY, name TEXT); ```  So describing that table dereferences a null pointer and the process dies with SIGSEGV. Because the `query!()` family describes a live database during macro expansion, the process that dies is `rustc` itself:  ``` error: rustc interrupted by SIGSEGV, printing backtrace   2  core::ffi::c_str::CStr::from_ptr   3  sqlx_sqlite::statement::handle::StatementHandle::column_nullable   4  sqlx_sqlite::connection::describe::describe   5  sqlx_sqlite::des

- **Issue #4364** (2026-08-07): **Using sqlx turns tokio runtime singlethreaded**
  *Symptoms*: ### I have found these related issues/pull requests  I have checked for a while, but I can't find any issue discussing this.  ### Description  I run some CPU intensive code in asynchronous context. I know it's not ideal, but it shouldn't be an issue, since tokio is multithreaded, and hogging one worker for a few minutes is acceptable.   However, occasionally results are pushed to postgres. However, it seems that after the first sqlx runs, all other tasks can't run on other worker threads anymore and get a time slice when the next database query is causing the runtime to yield.  Closing the pool "unlocks" the other workers again.  I'm not sure, if this is intended, a bug or a necessary restriction. However, I'd at least love to know, why and how that is happening, as I don't want to accidentally turn all my servers single-threaded.   Thank you for your help!  ### Reproduction steps  This is an example code to demonstrate the issue.  ```rust use std::time::Duration;  use sqlx::PgPool;  const DB_URL: &str = "postgres://devuser:devpassword@localhost:5432/devdb";  async fn db_then_compute(pool: PgPool) {     let num: (i32,) = sqlx::query_as("SELECT 1").fetch_one(&pool).await.unwrap();     println!(         "The num was returned: {}, but now, the CPU block will kill multithreading",         num.0     );     println!("Start compute...");     // This would "fix" the issue:     // pool.close().await;     loop {} }  /// This doesn't cause the issue async fn http_then_compute() {     le
  **Post-Mortem & Fix Analysis**:
  > I just tested the same example with an SqlitePool, the issue doesn't appear there. So this seems to be related to Postgres.  I also tested this with a Postgres Connection instead of a pool, here the issue occurs again. However, while closing the postgres Pool seems to free other workers again, closing the postgres connection, doesn't fix it.
  > I just replicated this with deadpool-postgres, so this doesn't seem to be an SQLX issue after all. I'm closing the issue again and investigate further.

- **Issue #4362** (2026-09-10): **`migrate!` silently ignores `*.sql` files with no prefix**
  *Symptoms*: ### I have found these related issues/pull requests  I was unable to find any related issues  ### Description  If a migration file has a non-numeric prefix (e.g., `a_schema.sql`), SQLx produces an error. However, if there is no prefix at all (e.g., `schema.sql`), no error is produced, and `migrate!` silently ignores the file. I believe this should either: produce an error (or warning) message like above, for any `*.sql` file that doesn't follow the required format; or, begin supporting no-prefix migrations.   ### Reproduction steps  1. Write a function to create the SQLite database and run migrations, e.g. ```rs let connect_options = SqliteConnectOptions::new()     .filename("foo.db")     .create_if_missing(true);  let pool = SqlitePoolOptions::new()     .connect_with(connect_options)     .await?;  dbg!(sqlx::migrate!("./migrations/")).run(&pool).await?; ``` 2. Create a no-prefix sql file, e.g. `./migrations/schema.sql`. Make it create any sort of table or whatever 3. Run 4. The database file, `foo.db`, will be created and initialized, but it will not contain the new table defined in `schema.sql`. The evaluation of `migrate!` as shown by `dbg!` will have an empty `migrations` field. Additionally, running something like `.tables` in `sqlite3` will only show the `_sqlx_migrations` table. In other words, the `schema.sql` file was ignored, silently.  ### SQLx version  0.9.0  ### Enabled SQLx features  runtime-tokio, sqlite  ### Database server and version  SQLite  ### Operating s

- **Issue #4335** (2026-08-17): **Missing TCP_NODELAY on TCP sockets**
  *Symptoms*: ### I have found these related issues/pull requests  https://github.com/transact-rs/sqlx/pull/3055  ### Description  Hi, after upgrade to sqlx 0.9.0 I've noticed that some queries started executing ~41-43ms when running locally (with sqlx 0.8.2 they used to be ~2ms).  Here's a reproduction example: https://gist.github.com/dmitryvk/c7c5ff1578ae1525d9197bce1ca597a7 (the real code is much more complicated).  40ms delay is caused by Nagle's algorithm, and sqlx previously used to disable it (https://github.com/transact-rs/sqlx/pull/3055), but it was removed recently (https://github.com/transact-rs/sqlx/pull/4022).  ### Reproduction steps  Compile and run code from https://gist.github.com/dmitryvk/c7c5ff1578ae1525d9197bce1ca597a7 against a local MariaDB/MySQL instance.  ### SQLx version  0.9.0  ### Enabled SQLx features  "mysql", "runtime-tokio", "tls-rustls"  ### Database server and version  MariaDB 11.8.5  ### Operating system  Ubuntu 26.04  ### Rust version  rustc 1.97.0 (2d8144b78 2026-07-07)

- **Issue #4328** (2026-08-17): **PgConnectOptions::statement_cache_capacity(0) causes PG connection backends (in db server) to leak memory**
  *Symptoms*: ### I have found these related issues/pull requests  #3850 somehow related since it fixes individual non-persistent query memory leak but it does not affect the behaviour set by this global connect options setup.  ### Description  Hello!  We've been using PgConnectOptions::statement_cache_capacity(0) to "globally" disable statement caching. Recently we found that our Postgresql connections started accumulate (or "leak") memory at the db server side over time for long lived connections. Debugging revealed that this memory usage was caused by connection adding prepared statement for every query.   I investigated that the root cause is that Postgres executor [assigns statement id based on the query persistence](https://github.com/transact-rs/sqlx/blob/v0.9.0/sqlx-postgres/src/connection/executor.rs#L31-L37) so that persistent queries always get statement id whereas non-persistent ones do not (previously also non-persistent statements got id but that was fixed by #3850) . Statement with assigned ids are not cleared by pg protocol, hence they start accumulating to memory.     However, it seems that the prepared statement cache LRU eviction is disabled [if statement cache capacity is set to 0](https://github.com/transact-rs/sqlx/blob/v0.9.0/sqlx-postgres/src/connection/executor.rs#L184-L194). This asymmetry now causes that setting cache size to 0 causes persistent (the default case) statements to get a statement id but not be evicted from the backend.  I'm not 100% sure if this a b
  **Post-Mortem & Fix Analysis**:
  > Yeah, `if persistent` should probably be `if persistent && conn.inner.cache_statement.is_enabled()` here: https://github.com/transact-rs/sqlx/blob/4893f831684c26a4a6dbeae01e7fb9a7120a4d5c/sqlx-postgres/src/connection/executor.rs#L31

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

### Incident Patch 1: `1be995b7` (2026-09-14)
**Commit Message**: fix(sqlite): don't dereference a NULL declared type in column_nullable (#4374)

* fix(sqlite): don't dereference a NULL declared type in column_nullable

sqlite3_table_column_metadata() leaves its declared-type out-param NULL for a
column declared without a type, e.g. `CREATE TABLE foo (bar PRIMARY KEY)`.
column_nullable() passed that pointer straight to CStr::from_ptr(), so
describing such a column segfaulted the process, and rustc itself, since the
query!() macros describe a live database at expansion time.

A column with no declared type is not declared INTEGER and so cannot be a rowid
alias; treat it as a normal column and fall through to the NOT NULL flag.

Regression introduced in 69ee0df (#4088), released in 0.9.0.

* fix(sqlite): only check the declared type for primary key columns

---------

Co-authored-by: Scott Driggers <scott@msd3.io>

**File**: `sqlx-sqlite/src/statement/handle.rs` (modified, +15/-13)
```diff
@@ -263,19 +263,21 @@ impl StatementHandle {
                 return Err(SqliteError::new(self.db_handle()).into());
             }
 
-            let datatype = CStr::from_ptr(datatype);
-
-            Ok(
-                if primary_key != 0
-                    && datatype
-                        .to_bytes()
-                        .eq_ignore_ascii_case("integer".as_bytes())
-                {
-                    None
-                } else {
-                    Some(not_null == 0)
-                },
-            )
+            // `sqlite3_table_column_metadata()` sets the declared type to NULL for a column
+            // declared without one, e.g. `CREATE TABLE foo (bar PRIMARY KEY)`. Such a column
+            // has no type name to compare against, and is by definition not declared
+            // `INTEGER`, so it cannot be a rowid alias.
+            let is_rowid_alias = primary_key != 0
+                && !datatype.is_null()
+                && CStr::from_ptr(datatype)
+                    .to_bytes()
+                    .eq_ignore_ascii_case("integer".as_bytes());
+
+            Ok(if is_rowid_alias {
+                None
+            } else {
+                Some(not_null == 0)
+            })
         }
     }
 
```

**File**: `tests/sqlite/describe.rs` (modified, +34/-1)
```diff
@@ -2,7 +2,7 @@ use sqlx::error::DatabaseError;
 use sqlx::sqlite::{SqliteConnectOptions, SqliteError};
 use sqlx::TypeInfo;
 use sqlx::{sqlite::Sqlite, Column, Executor};
-use sqlx::{ConnectOptions, SqlSafeStr};
+use sqlx::{ConnectOptions, Connection, SqlSafeStr, SqliteConnection};
 use sqlx_test::new;
 use std::env;
 
@@ -1095,3 +1095,36 @@ async fn it_describes_analytical_function() -> anyhow::Result<()> {
 
     Ok(())
 }
+
+// A column declared with no type at all, e.g. `CREATE TABLE foo (bar PRIMARY KEY)`, is
+// legal SQLite. `sqlite3_table_column_metadata()` reports a NULL declared type for such a
+// column, which `column_nullable()` used to dereference unconditionally, segfaulting the
+// process, and thus rustc itself when the `query!()` macros describe a live database.
+#[sqlx_macros::test]
+async fn it_describes_columns_with_no_declared_type() -> anyhow::Result<()> {
+    let mut conn = SqliteConnection::connect(":memory:").await?;
+
+    conn.execute(
+        r#"
+        CREATE TABLE untyped (
+            id PRIMARY KEY,
+            typeless,
+            typed TEXT NOT NULL
+        );
+        "#
+        .into_sql_str(),
+    )
+    .await?;
+
+    let d = conn
+        .describe("SELECT id, typeless, typed FROM untyped".into_sql_str())
+        .await?;
+
+    // A `PRIMARY KEY` with no declared type is not an `INTEGER PRIMARY KEY`, so it is not a
+    // rowid alias and SQLite does permit NULLs in it.
+    assert_eq!(d.nullable(0), Some(true));
+    assert_eq!(d.nullable(1), Some(true));
+    assert_eq!(d.nullable(2), Some(false));
+
+    Ok(())
+}
```

---

### Incident Patch 2: `727c7789` (2026-09-10)
**Commit Message**: fix(postgres): return UnexpectedEof when server closes connection at SSLRequest (#4395) (#4406)

When a remote peer accepts the TCP socket and immediately closes it
without responding to the 8-byte SSLRequest message, socket.read()
returns 0 (EOF). Because the read byte count was discarded, the unwritten
initial [0u8] buffer was matched against, reporting a fabricated
Protocol("unexpected response from SSLRequest: 0x00") error.

Check the returned read length and return an io::ErrorKind::UnexpectedEof
error when 0 bytes are read, correctly identifying connection closure
during the SSLRequest handshake, while preserving Protocol error reporting
if the server actually transmits a wire 0x00 byte.

Co-authored-by: zfaustk <4340287+zfaustk@users.noreply.github.com>

**File**: `sqlx-postgres/src/connection/tls.rs` (modified, +136/-1)
```diff
@@ -1,3 +1,5 @@
+use std::io;
+
 use crate::error::Error;
 use crate::net::tls::{self, TlsConfig};
 use crate::net::{Socket, SocketIntoBox, WithSocket};
@@ -88,7 +90,10 @@ async fn request_upgrade(
 
     let mut response = [0u8];
 
-    socket.read(&mut &mut response[..]).await?;
+    let n = socket.read(&mut &mut response[..]).await?;
+    if n == 0 {
+        return Err(io::Error::from(io::ErrorKind::UnexpectedEof).into());
+    }
 
     match response[0] {
         b'S' => {
@@ -107,3 +112,133 @@ async fn request_upgrade(
         )),
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use sqlx_core::io::ReadBuf;
+    use std::io;
+    use std::pin::pin;
+    use std::task::{Context, Poll, Waker};
+
+    struct MockSocket {
+        read_byte: Option<u8>,
+    }
+
+    impl Socket for MockSocket {
+        fn try_read(&mut self, buf: &mut dyn ReadBuf) -> io::Result<usize> {
+            match self.read_byte {
+                Some(b) => {
+                    buf.put_slice(&[b]);
+                    Ok(1)
+                }
+                None => Ok(0), // EOF
+            }
+        }
+
+        fn try_write(&mut self, buf: &[u8]) -> io::Result<usize> {
+            Ok(buf.len())
+        }
+
+        fn poll_read_ready(&mut self, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
+            Poll::Ready(Ok(()))
+        }
+
+        fn poll_write_ready(&mut self, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
+            Poll::Ready(Ok(()))
+        }
+
+        fn poll_shutdown(&mut self, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
+            Poll::Ready(Ok(()))
+        }
+    }
+
+    /// Polls a future that is guaranteed to complete immediately on its first poll.
+    ///
+    /// This safe test runner uses `Waker::noop()` and `std::pin::pin!` without needing
+    /// a full runtime or unsafe waker implementations.
+    fn poll_immediate<F: std::future::Future>(fut: F) -> F::Output {
+        let mut fut = pin!(fut);
+        let mut cx = Context::from_waker(Waker::noop());
+        match fut.as_mut().poll(&mut cx) {
+            Poll::Ready(val) => val,
+            Poll::Pending => panic!("test future was pending unexpectedly"),
+        }
+    }
+
+    #[test]
+    fn test_request_upgrade_eof() {
+        poll_immediate(async {
+            let mut socket = MockSocket { read_byte: None };
+            let options = PgConnectOptions::new();
+            let err = request_upgrade(&mut socket, &options).await.unwrap_err();
+
+            match err {
+                Error::Io(io_err) => {
+                    assert_eq!(io_err.kind(), io::ErrorKind::UnexpectedEof);
+                }
+                other => panic!("expected Error::Io(UnexpectedEof), but got: {:?}", other),
+            }
+        });
+    }
+
+    #[test]
+    fn test_request_upgrade_wire_null_byte() {
+        poll_immediate(async {
+            let mut socket = MockSocket {
+                read_byte: Some(0x00),
+            };
+            let options = PgConnectOptions::new();
+            let err = request_upgrade(&mut socket, &options).await.unwrap_err();
+
+            match err {
+                Error::Protocol(msg) => {
+                    assert!(msg.contains("unexpected response from SSLRequest: 0x00"));
+                }
+                other => panic!("expected Error::Protocol, but got: {:?}", other),
+            }
+        });
+    }
+
+    #[test]
+    fn test_request_upgrade_supported() {
+        poll_immediate(async {
+            let mut socket = MockSocket {
+                read_byte: Some(b'S'),
+            };
+            let options = PgConnectOptions::new();
+            let res = request_upgrade(&mut socket, &options).await.unwrap();
+            assert!(res);
+        });
+    }
+
+    #[test]
+    fn test_request_upgrade_unsupported() {
+        poll_immediate(async {
+            let mut socket = MockSocket {
+                read_byte: Some(b'N'),
+            };
+            let options =
```

---

### Incident Patch 3: `5d3787ef` (2026-09-10)
**Commit Message**: fix(pool): prevent num_idle underflow that wedges maintenance in a CPU spin (#4289)

* fix(pool): prevent num_idle underflow that wedges maintenance in a CPU spin

Fixes #3645 - A rare 100% CPU and a hang on shutdown.

I made this fix w/ the assistance of an LLM, but I was looking quite
carefully to make sure the code changes make sense.

I opted to repro via a stress test - which shows the underflow if you
run the test without the fix.

Leaving an LLM generated description down below in case you find it
helpful.

---------------------------------------------------------------------

`PoolInner::release` made a returned connection acquirable (push to the
idle queue + release its semaphore permit) *before* incrementing
`num_idle`. A concurrent `pop_idle` (via `try_acquire`) could pop that
connection and run its `num_idle.fetch_sub(1)` in the window before the
increment landed; if `num_idle` was 0 at that moment the `usize` wrapped
to `usize::MAX`.

The background maintenance task builds its sweep range from
`for _ in 0..pool.num_idle()`, and once the idle queue drains the loop
body is fully synchronous (`try_acquire`/`release` never `.await`). So a
single bad read of `usize::MAX` ma

**File**: `sqlx-core/src/pool/inner.rs` (modified, +199/-5)
```diff
@@ -194,7 +194,14 @@ impl<DB: Database> PoolInner<DB> {
         permit: AsyncSemaphoreReleaser<'a>,
     ) -> Result<Floating<DB, Idle<DB>>, AsyncSemaphoreReleaser<'a>> {
         if let Some(idle) = self.idle_conns.pop() {
-            self.num_idle.fetch_sub(1, Ordering::AcqRel);
+            // Saturating: never underflow even if a concurrent `release` hasn't yet published
+            // its increment. An underflow would wrap `num_idle` to `usize::MAX` and wedge the
+            // maintenance task in a non-yielding spin (see `release` for the full invariant).
+            let _ = self
+                .num_idle
+                .fetch_update(Ordering::AcqRel, Ordering::Acquire, |n| {
+                    Some(n.saturating_sub(1))
+                });
             Ok(Floating::from_idle(idle, (*self).clone(), permit))
         } else {
             Err(permit)
@@ -206,15 +213,21 @@ impl<DB: Database> PoolInner<DB> {
 
         let Floating { inner: idle, guard } = floating.into_idle();
 
+        // Bump the idle counter *before* the connection becomes acquirable, so a concurrent
+        // `pop_idle` can never observe a popped connection without a matching increment.
+        // (Otherwise `num_idle.fetch_sub` can underflow a `usize` to `usize::MAX`, which makes
+        // the maintenance task's `for _ in 0..num_idle()` loop spin ~forever, pegging a CPU.)
+        // Over-counting transiently (incremented, not yet pushed) is harmless: `pop_idle`
+        // simply finds an empty queue and returns the permit without decrementing.
+        self.num_idle.fetch_add(1, Ordering::AcqRel);
+
         if self.idle_conns.push(idle).is_err() {
             panic!("BUG: connection queue overflow in release()");
         }
 
         // NOTE: we need to make sure we drop the permit *after* we push to the idle queue
         // don't decrease the size
         guard.release_permit();
-
-        self.num_idle.fetch_add(1, Ordering::AcqRel);
     }
 
     /// Try to atomically increment the pool size for a new connection.
@@ -544,8 +557,13 @@ fn spawn_maintenance_tasks<DB: Database>(pool: &Arc<PoolInner<DB>>) {
                     // Go over all idle connections, check for idleness and lifetime,
                     // and if we have fewer than min_connections after reaping a connection,
                     // open a new one immediately. Note that other connections may be popped from
-                    // the queue in the meantime - that's fine, there is no harm in checking more
-                    for _ in 0..pool.num_idle() {
+                    // the queue in the meantime - that's fine, there is no harm in checking more.
+                    //
+                    // Cap the iteration count at `max_connections` so that even a corrupt
+                    // `num_idle` (e.g. an underflow to `usize::MAX`) can never make this
+                    // synchronous, non-yielding loop spin unboundedly and starve the runtime.
+                    let checks = cmp::min(pool.num_idle(), pool.options.max_connections as usize);
+                    for _ in 0..checks {
                         if let Some(conn) = pool.try_acquire() {
                             if is_beyond_idle_timeout(&conn, &pool.options)
                                 || is_beyond_max_lifetime(&conn, &pool.options)
@@ -621,3 +639,179 @@ impl<DB: Database> Drop for DecrementSizeGuard<DB> {
         }
     }
 }
+
+// Uses the in-crate `Any` database with a stub backend so we can drive `PoolInner` internals
+// directly. (We can't use a real driver here: the only `Database` impls outside this crate
+// would be a different `sqlx-core` instance via the dev-dependency cycle.)
+#[cfg(all(test, feature = "any"))]
+mod underflow_tests {
+    use super::*;
+    use crate::any::{
+        Any, AnyArguments, AnyConnectOptions, AnyConnection, AnyConnectionBackend, AnyQueryResult,
+        AnyRow, AnyStatement, AnyTypeInfo,
+    };
+    use crate::pool::Pool;
+    use crate:
```

---

### Incident Patch 4: `f1e94ec3` (2026-09-09)
**Commit Message**: fix(postgres): roll back a transaction cancelled during BEGIN (#4394)

`PgTransactionManager::begin` raises `transaction_depth` only after the BEGIN
round trip returns, but `start_rollback` -- which both its own `Rollback`
drop guard and `Transaction`'s drop guard call -- is a no-op while that depth
is zero. A future cancelled during the await therefore queues nothing, and the
session is left inside a transaction.

`Floating::return_to_pool` then validates the connection with `ping()`, which
for Postgres is a bare `wait_until_ready`: it drains the `ReadyForQuery` but
never inspects its transaction-status byte, so the connection is judged healthy
and handed to the next borrower. Their statements run inside the stale
transaction and hold its locks, and the first error turns the session into
`idle in transaction (aborted)`, after which every unrelated query on that
connection fails with 25P02 until `max_lifetime` recycles it.

Claim the depth before the round trip and unwind it if the BEGIN did not take,
so the drop guards have something to act on. The queued ROLLBACK is written to
the same buffer as the BEGIN and so is always flushed after it.

Closes #4393. Refs #2054, #2819, #3980.

**File**: `sqlx-postgres/src/transaction.rs` (modified, +8/-1)
```diff
@@ -27,11 +27,18 @@ impl TransactionManager for PgTransactionManager {
 
         let rollback = Rollback::new(conn);
         rollback.conn.queue_simple_query(statement.as_str())?;
+        // Claim the depth before the round trip, not after. `start_rollback` -- which both
+        // this guard and `Transaction`'s own drop guard call -- is a no-op while the depth is
+        // zero, so a future cancelled during the await below would otherwise leave the server
+        // in a transaction with nothing queued to end it. `Pool` then hands that connection
+        // to the next borrower, whose statements silently run inside it. Unwound just below
+        // if the BEGIN did not take.
+        rollback.conn.inner.transaction_depth += 1;
         rollback.conn.wait_until_ready().await?;
         if !rollback.conn.in_transaction() {
+            rollback.conn.inner.transaction_depth -= 1;
             return Err(Error::BeginFailed);
         }
-        rollback.conn.inner.transaction_depth += 1;
         rollback.defuse();
 
         Ok(())
```

**File**: `tests/postgres/postgres.rs` (modified, +51/-0)
```diff
@@ -2244,3 +2244,54 @@ async fn it_can_recover_from_copy_in_invalid_params() -> anyhow::Result<()> {
     )
     .await
 }
+
+// Regression: a future cancelled while `BEGIN`'s round trip is in flight used to leave the
+// session inside a transaction. `start_rollback` is a no-op while `transaction_depth` is
+// zero, and the depth was raised only after the await, so neither drop guard queued a
+// `ROLLBACK` -- and `return_to_pool` validates with a bare `wait_until_ready` that never
+// looks at the `ReadyForQuery` transaction-status byte, so the connection was handed to the
+// next borrower with the transaction still open.
+#[sqlx_macros::test]
+async fn it_rolls_back_a_transaction_cancelled_during_begin() -> anyhow::Result<()> {
+    let pool = PgPoolOptions::new()
+        .max_connections(1)
+        .min_connections(0)
+        .connect(&dotenvy::var("DATABASE_URL")?)
+        .await?;
+
+    let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
+        .fetch_one(&pool)
+        .await?;
+
+    // A plain `BEGIN` answers too quickly to cancel reliably; the sleep widens the same
+    // round trip so the cancellation lands inside it.
+    let cancelled = sqlx_core::rt::timeout(
+        Duration::from_millis(300),
+        pool.begin_with(AssertSqlSafe("BEGIN; SELECT pg_sleep(2);".to_string())),
+    )
+    .await;
+    assert!(cancelled.is_err(), "the begin should not have completed");
+
+    // Outlast the sleep: the queued `ROLLBACK` is only flushed once the abandoned statement
+    // has answered and the connection is on its way back to the pool.
+    sqlx_core::rt::sleep(Duration::from_millis(3500)).await;
+
+    let mut conn = new::<Postgres>().await?;
+    let state: Option<String> =
+        sqlx::query_scalar("SELECT state FROM pg_stat_activity WHERE pid = $1")
+            .bind(pid)
+            .fetch_optional(&mut conn)
+            .await?;
+
+    assert_eq!(
+        state.as_deref(),
+        Some("idle"),
+        "connection was returned to the pool still inside a transaction"
+    );
+
+    // and the pooled connection is still usable
+    let one: i32 = sqlx::query_scalar("SELECT 1").fetch_one(&pool).await?;
+    assert_eq!(one, 1);
+
+    Ok(())
+}
```

---

### Incident Patch 5: `4fc0fb82` (2026-08-19)
**Commit Message**: fix(sqlite): correct sub-second decoding of pre-epoch REAL datetimes (#4340)

Datetimes stored as a REAL Julian day number (e.g. via SQLite's
julianday()) were decoded by splitting the UNIX timestamp with
trunc()/fract().abs(). timestamp_opt() always adds the nanoseconds
forward in time, so for values before 1970 this pushed the result up to
~2 seconds off and could move it onto the wrong side of the epoch
(e.g. 1969-12-31 23:59:59.5 decoded as 1970-01-01 00:00:00.5).

Round seconds toward negative infinity with floor() and take the
sub-second remainder relative to that, so nanos is always a valid
forward offset. Post-epoch values are unaffected. Adds unit tests for
the pre- and post-epoch paths.

**File**: `sqlx-sqlite/src/types/chrono.rs` (modified, +64/-4)
```diff
@@ -176,10 +176,16 @@ fn decode_datetime_from_float(value: f64) -> Option<DateTime<FixedOffset>> {
     // We checked above if the value is infinite or NaN which could otherwise cause problems
     #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
     {
-        let seconds = timestamp.trunc() as i64;
-        let nanos = (timestamp.fract() * 1E9).abs() as u32;
-
-        Utc.fix().timestamp_opt(seconds, nanos).single()
+        // Split into whole seconds and a non-negative sub-second remainder.
+        // `timestamp_opt` always adds `nanos` *forward* in time, so we must round
+        // `seconds` toward negative infinity (not toward zero) and take the
+        // fraction relative to that. Using `trunc()`/`fract().abs()` here would
+        // push pre-epoch timestamps up to ~2 seconds off (and onto the wrong side
+        // of the epoch), since the fractional part is negative below zero.
+        let seconds = timestamp.floor();
+        let nanos = ((timestamp - seconds) * 1E9) as u32;
+
+        Utc.fix().timestamp_opt(seconds as i64, nanos).single()
     }
 }
 
@@ -218,3 +224,57 @@ impl<'r> Decode<'r, Sqlite> for NaiveTime {
         Err(format!("invalid time: {value}").into())
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::decode_datetime_from_float;
+    use chrono::{Offset, TimeZone, Utc};
+
+    // SQLite may store a datetime as a REAL holding a Julian day number, e.g. the
+    // result of `julianday(...)`. This mirrors that conversion so a test can feed
+    // `decode_datetime_from_float` the value for a known instant.
+    fn julian_day(unix_seconds: f64) -> f64 {
+        2_440_587.5 + unix_seconds / 86_400.0
+    }
+
+    // Assert that the Julian day for `unix_seconds + subsec_nanos` decodes back to
+    // that same instant. The tolerance only absorbs f64 round-off in the
+    // round-trip (tens of microseconds), well below the errors under test.
+    #[track_caller]
+    fn assert_decodes_near(unix_seconds: i64, subsec_nanos: u32) {
+        let input = julian_day(unix_seconds as f64 + f64::from(subsec_nanos) / 1e9);
+        let decoded = decode_datetime_from_float(input).expect("valid Julian day should decode");
+        let expected = Utc
+            .fix()
+            .timestamp_opt(unix_seconds, subsec_nanos)
+            .single()
+            .unwrap();
+
+        let diff_us = (decoded - expected)
+            .num_microseconds()
+            .expect("difference fits in microseconds")
+            .abs();
+        assert!(
+            diff_us < 1_000,
+            "decoded {decoded} differs from expected {expected} by {diff_us} us",
+        );
+    }
+
+    // A Julian day landing before the UNIX epoch must keep its sub-second part in
+    // the correct direction. Before the fix these decoded up to ~2 seconds off,
+    // and could even cross to the wrong side of the epoch.
+    #[test]
+    fn decodes_pre_epoch_float_datetime() {
+        // 1969-12-31 23:59:59.500 UTC
+        assert_decodes_near(-1, 500_000_000);
+        // 1969-12-31 23:59:58.750 UTC
+        assert_decodes_near(-2, 750_000_000);
+    }
+
+    // Post-epoch values were already correct; guard against a regression.
+    #[test]
+    fn decodes_post_epoch_float_datetime() {
+        // 1970-01-01 00:00:01.500 UTC
+        assert_decodes_near(1, 500_000_000);
+    }
+}
```

---

### Incident Patch 6: `80f44db8` (2026-08-19)
**Commit Message**: Fix Any type/close handling, MySQL time signs, SQLite plans, and macro docs (#4359)

**File**: `sqlx-core/src/any/arguments.rs` (modified, +2/-2)
```diff
@@ -67,8 +67,8 @@ impl AnyArguments {
                 AnyValueKind::Null(AnyTypeInfoKind::SmallInt) => out.add(Option::<i16>::None),
                 AnyValueKind::Null(AnyTypeInfoKind::Integer) => out.add(Option::<i32>::None),
                 AnyValueKind::Null(AnyTypeInfoKind::BigInt) => out.add(Option::<i64>::None),
-                AnyValueKind::Null(AnyTypeInfoKind::Real) => out.add(Option::<f64>::None),
-                AnyValueKind::Null(AnyTypeInfoKind::Double) => out.add(Option::<f32>::None),
+                AnyValueKind::Null(AnyTypeInfoKind::Real) => out.add(Option::<f32>::None),
+                AnyValueKind::Null(AnyTypeInfoKind::Double) => out.add(Option::<f64>::None),
                 AnyValueKind::Null(AnyTypeInfoKind::Text) => out.add(Option::<String>::None),
                 AnyValueKind::Null(AnyTypeInfoKind::Blob) => out.add(Option::<Vec<u8>>::None),
                 AnyValueKind::Bool(b) => out.add(b),
```

**File**: `sqlx-core/src/any/connection/mod.rs` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ impl Connection for AnyConnection {
     }
 
     fn close_hard(self) -> impl Future<Output = Result<(), Error>> + Send + 'static {
-        self.backend.close()
+        self.backend.close_hard()
     }
 
     fn ping(&mut self) -> impl Future<Output = Result<(), Error>> + Send + '_ {
```

**File**: `sqlx-macros-core/src/query/metadata.rs` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ fn load_env(
     }))
 }
 
-/// Returns `true` if `val` is `"true"`,
+/// Returns `true` if `val` is `"true"` (case-insensitive) or `"1"`.
 fn is_truthy_bool(val: &str) -> bool {
     val.eq_ignore_ascii_case("true") || val == "1"
 }
```

**File**: `sqlx-mysql/src/types/mysql_time.rs` (modified, +8/-1)
```diff
@@ -213,7 +213,7 @@ impl MySqlTime {
 
     /// Returns `true` if `self` is negative, `false` if positive or zero.
     pub fn is_negative(&self) -> bool {
-        self.sign.is_positive()
+        self.sign.is_negative()
     }
 
     /// Returns `true` if this interval is a valid time-of-day.
@@ -691,6 +691,13 @@ mod tests {
         assert_eq!(format!("{negative:.9}"), "-123:45:56.890011000");
     }
 
+    #[test]
+    fn test_is_negative() {
+        assert!(!MySqlTime::ZERO.is_negative());
+        assert!(!MySqlTime::MAX.is_negative());
+        assert!(MySqlTime::MIN.is_negative());
+    }
+
     #[test]
     fn test_parse_microseconds() {
         assert_eq!(parse_microseconds("010").unwrap(), 10_000);
```

**File**: `sqlx-sqlite/src/logger.rs` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ impl<R: Debug, S: Debug + DebugDiff, P: Debug> core::fmt::Display for QueryPlanL
         let max_branch_id: i64 = [
             self.branch_operations.last_index().unwrap_or(0),
             self.branch_results.last_index().unwrap_or(0),
-            self.branch_results.last_index().unwrap_or(0),
+            self.branch_origins.last_index().unwrap_or(0),
         ]
         .into_iter()
         .max()
```

---

### Incident Patch 7: `ebc408a4` (2026-08-19)
**Commit Message**: bugfix: streamline and fix AnyQueryResult::last_insert_id() for SQLite (#4205)

* fix: make MySqlQueryResult -> AnyQueryResult conversion more consistent & robust

- replaced custom map_result function with From<T> implementation

* fix: unify PgQueryResult -> AnyQueryResult conversion code path

- replaced custom map_result function with From<T> implementation

* fix: make SqliteQueryResult -> AnyQueryResult conversion respect last_insert_rowid

- replaced custom map_result function with From<T> implementation
- fixed bug causing AnyQueryResult.last_insert_id to always be None for Sqlite backend

* test(sqlite): add any_sets_last_insert_id

- added test
- updated required-features

* test(mysql): add any_sets_last_insert_id

- added test
- updated required-features

* test(postgres): add any_sets_last_insert_id

- added test
- updated required-features

* fix(tests): use different syntax to address compiler errors

* fix(test/postgres): slightly change bind syntax as required for this backend

**File**: `Cargo.toml` (modified, +11/-1)
```diff
@@ -313,7 +313,7 @@ required-features = ["sqlite"]
 [[test]]
 name = "sqlite-any"
 path = "tests/sqlite/any.rs"
-required-features = ["sqlite"]
+required-features = ["sqlite", "any"]
 
 [[test]]
 name = "sqlite-types"
@@ -415,6 +415,11 @@ name = "mysql-rustsec"
 path = "tests/mysql/rustsec.rs"
 required-features = ["mysql"]
 
+[[test]]
+name = "mysql-any"
+path = "tests/mysql/any.rs"
+required-features = ["mysql", "any"]
+
 #
 # PostgreSQL
 #
@@ -468,3 +473,8 @@ required-features = ["postgres"]
 name = "postgres-rustsec"
 path = "tests/postgres/rustsec.rs"
 required-features = ["postgres", "macros", "migrate"]
+
+[[test]]
+name = "postgres-any"
+path = "tests/postgres/any.rs"
+required-features = ["postgres", "any"]
```

**File**: `sqlx-mysql/src/any.rs` (modified, +8/-7)
```diff
@@ -96,7 +96,7 @@ impl AnyConnectionBackend for MySqlConnection {
                 .try_flatten_stream()
                 .map(|res| {
                     Ok(match res? {
-                        Either::Left(result) => Either::Left(map_result(result)),
+                        Either::Left(result) => Either::Left(result.into()),
                         Either::Right(row) => Either::Right(AnyRow::try_from(&row)?),
                     })
                 }),
@@ -210,11 +210,12 @@ impl<'a> TryFrom<&'a AnyConnectOptions> for MySqlConnectOptions {
     }
 }
 
-fn map_result(result: MySqlQueryResult) -> AnyQueryResult {
-    AnyQueryResult {
-        rows_affected: result.rows_affected,
-        // Don't expect this to be a problem
-        #[allow(clippy::cast_possible_wrap)]
-        last_insert_id: Some(result.last_insert_id as i64),
+/// This conversion attempts to save last_insert_id by converting to i64.
+impl From<MySqlQueryResult> for AnyQueryResult {
+    fn from(done: MySqlQueryResult) -> Self {
+        AnyQueryResult {
+            rows_affected: done.rows_affected(),
+            last_insert_id: done.last_insert_id().try_into().ok(),
+        }
     }
 }
```

**File**: `sqlx-mysql/src/query_result.rs` (modified, +0/-10)
```diff
@@ -24,13 +24,3 @@ impl Extend<MySqlQueryResult> for MySqlQueryResult {
         }
     }
 }
-#[cfg(feature = "any")]
-/// This conversion attempts to save last_insert_id by converting to i64.
-impl From<MySqlQueryResult> for sqlx_core::any::AnyQueryResult {
-    fn from(done: MySqlQueryResult) -> Self {
-        sqlx_core::any::AnyQueryResult {
-            rows_affected: done.rows_affected(),
-            last_insert_id: done.last_insert_id().try_into().ok(),
-        }
-    }
-}
```

**File**: `sqlx-postgres/src/any.rs` (modified, +7/-5)
```diff
@@ -97,7 +97,7 @@ impl AnyConnectionBackend for PgConnection {
                 .try_flatten_stream()
                 .map(
                     move |res: sqlx_core::Result<Either<PgQueryResult, PgRow>>| match res? {
-                        Either::Left(result) => Ok(Either::Left(map_result(result))),
+                        Either::Left(result) => Ok(Either::Left(result.into())),
                         Either::Right(row) => Ok(Either::Right(AnyRow::try_from(&row)?)),
                     },
                 ),
@@ -246,9 +246,11 @@ impl<'a> TryFrom<&'a AnyConnectOptions> for PgConnectOptions {
     }
 }
 
-fn map_result(res: PgQueryResult) -> AnyQueryResult {
-    AnyQueryResult {
-        rows_affected: res.rows_affected(),
-        last_insert_id: None,
+impl From<PgQueryResult> for AnyQueryResult {
+    fn from(done: PgQueryResult) -> Self {
+        AnyQueryResult {
+            rows_affected: done.rows_affected(),
+            last_insert_id: None,
+        }
     }
 }
```

**File**: `sqlx-postgres/src/query_result.rs` (modified, +0/-10)
```diff
@@ -18,13 +18,3 @@ impl Extend<PgQueryResult> for PgQueryResult {
         }
     }
 }
-
-#[cfg(feature = "any")]
-impl From<PgQueryResult> for sqlx_core::any::AnyQueryResult {
-    fn from(done: PgQueryResult) -> Self {
-        sqlx_core::any::AnyQueryResult {
-            rows_affected: done.rows_affected,
-            last_insert_id: None,
-        }
-    }
-}
```

---

### Incident Patch 8: `56fbf870` (2026-08-17)
**Commit Message**: Fix PostgreSQL memory leak when statement cache is disabled (#4337)

* fix(postgres): check if statement caching is enabled before assigning an id

* test(postgres): add regression test for #4328

**File**: `sqlx-postgres/src/connection/executor.rs` (modified, +3/-1)
```diff
@@ -28,7 +28,9 @@ async fn prepare(
     persistent: bool,
     resolve_column_origin: bool,
 ) -> Result<(StatementId, Arc<PgStatementMetadata>), Error> {
-    let id = if persistent {
+    // if cache is disabled, persistent statements get an id but are never evicted
+    // which causes a memory leak
+    let id = if persistent && conn.inner.cache_statement.is_enabled() {
         let id = conn.inner.next_statement_id;
         conn.inner.next_statement_id = id.next();
         id
```

**File**: `tests/postgres/postgres.rs` (modified, +26/-0)
```diff
@@ -845,6 +845,32 @@ async fn it_closes_statements_when_not_persistent_issue_3850() -> anyhow::Result
     Ok(())
 }
 
+#[sqlx_macros::test]
+async fn it_closes_statements_when_caching_is_disabled_issue_4328() -> anyhow::Result<()> {
+    sqlx_test::setup_if_needed();
+
+    let mut options: PgConnectOptions = env::var("DATABASE_URL")?.parse().unwrap();
+
+    options = options.statement_cache_capacity(0);
+
+    let mut conn = PgConnection::connect_with(&options).await?;
+
+    let _row = sqlx::query("SELECT $1 AS val")
+        .bind(Oid(1))
+        .fetch_one(&mut conn)
+        .await?;
+
+    let row = sqlx::query("SELECT count(*) AS num_prepared_statements FROM pg_prepared_statements")
+        .persistent(false)
+        .fetch_one(&mut conn)
+        .await?;
+
+    let n: i64 = row.get("num_prepared_statements");
+    assert_eq!(0, n, "no prepared statements should be open");
+
+    Ok(())
+}
+
 #[sqlx_macros::test]
 async fn it_sets_application_name() -> anyhow::Result<()> {
     sqlx_test::setup_if_needed();
```

---

### Incident Patch 9: `4893f831` (2026-06-30)
**Commit Message**: fix(sqlite): migrate datetime format builders off time 0.3.48-depreca… (#4317)

* fix(sqlite): migrate datetime format builders off time 0.3.48-deprecated API

* ci: re-trigger checks

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -186,7 +186,7 @@ ipnet = "2.3.0"
 ipnetwork = "0.21.1"
 mac_address = "1.1.5"
 rust_decimal = { version = "1.36.0", default-features = false, features = ["std"] }
-time = { version = "0.3.47", features = ["formatting", "parsing", "macros"] }
+time = { version = "0.3.48", features = ["formatting", "parsing", "macros"] }
 uuid = "1.12.1"
 
 # Common utility crates
```

**File**: `examples/postgres/axum-social-with-tests/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ rand = "0.10.1"
 regex = "1.6.0"
 serde = "1.0.219"
 serde_with = { version = "3.18.0", features = ["time_0_3"] }
-time = "0.3.47"
+time = "0.3.48"
 uuid = { version = "1.12.1", features = ["serde"] }
 validator = { version = "0.20.0", features = ["derive"] }
 
```

**File**: `examples/postgres/multi-database/accounts/Cargo.toml` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ uuid = { version = "1.12.1", features = ["serde"] }
 thiserror = "2.0.18"
 rand = "0.10.1"
 
-time = { version = "0.3.47", features = ["serde"] }
+time = { version = "0.3.48", features = ["serde"] }
 
 serde = { version = "1.0.219", features = ["derive"] }
 
```

**File**: `examples/postgres/multi-database/payments/Cargo.toml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ sqlx = { workspace = true, features = ["postgres", "time", "uuid", "rust_decimal
 
 rust_decimal = "1.36.0"
 
-time = "0.3.47"
+time = "0.3.48"
 uuid = "1.12.1"
 
 [dependencies.accounts]
```

**File**: `examples/postgres/multi-tenant/accounts/Cargo.toml` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ uuid = { version = "1.12.1", features = ["serde"] }
 thiserror = "2.0.18"
 rand = "0.10.1"
 
-time = { version = "0.3.47", features = ["serde"] }
+time = { version = "0.3.48", features = ["serde"] }
 
 serde = { version = "1.0.219", features = ["derive"] }
 
```

---

### Incident Patch 10: `f8afe99d` (2026-06-10)
**Commit Message**: fix: whoami regression to anonymous user (#4303)

**File**: `.github/workflows/sqlx.yml` (modified, +16/-0)
```diff
@@ -301,6 +301,22 @@ jobs:
           SQLX_OFFLINE_DIR: .sqlx
           RUSTFLAGS: -D warnings --cfg postgres="${{ matrix.postgres }}"
 
+      # Run tests again with implied linux user
+      - run: |
+          SKIP_ARGS=()
+          for test in $PG_ISOLATED_TESTS; do
+            SKIP_ARGS+=(--skip "$test")
+          done
+          cargo test \
+            --no-default-features \
+            --features any,postgres,macros,migrate,_unstable-all-types,runtime-${{ matrix.runtime }},tls-${{ matrix.tls }} \
+            -- \
+            "${SKIP_ARGS[@]}"
+        env:
+          DATABASE_URL: postgres:///sqlx?password=runner-password
+          SQLX_OFFLINE_DIR: .sqlx
+          RUSTFLAGS: -D warnings --cfg postgres="${{ matrix.postgres }}"
+
       # Run the `test-attr` test again to cover cleanup.
       - run: >
           cargo test
```

**File**: `sqlx-postgres/Cargo.toml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ num-bigint = { version = "0.4.3", optional = true }
 smallvec = { version = "1.13.1" }
 stringprep = "0.1.2"
 tracing = { version = "0.1.37", features = ["log"] }
-whoami = { version = "2.0.2", default-features = false }
+whoami = { version = "2.0.2", features = ["std"], default-features = false }
 
 dotenvy.workspace = true
 thiserror.workspace = true
```

**File**: `tests/postgres/setup.sql` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
+-- Create extra user to be used on runner
+CREATE USER runner WITH SUPERUSER PASSWORD 'runner-password';
+
 -- https://www.postgresql.org/docs/current/ltree.html
 CREATE EXTENSION IF NOT EXISTS ltree;
 
```

#### Recent Merged Pull Requests:
- **PR #4412** (closed): Drop prepared-statement-cache in postgres upon invalid cached plan (@nipunn1313)
- **PR #4406** (2026-09-10): fix(postgres): return UnexpectedEof when server closes connection at SSLRequest (@zfaustk)
- **PR #4402** (2026-09-09): sqlx-sqlite: relax libsqlite3-sys constraint to allow 0.38.x (@dtolnay)
- **PR #4398** (2026-09-02): docs: clarify `Pool::size` and `Pool::num_idle` (@valentynkit)
- **PR #4397** (closed): postgres: fail when the search path no longer resolves to the migrations table (@AbhinavMir)
- **PR #4394** (2026-09-09): fix(postgres): roll back a transaction cancelled during BEGIN (@rubenfiszel)
- **PR #4392** (2026-09-02): Improve sqlx prepare invocation error (@mameikagou)
- **PR #4390** (closed): docs: update runtime feature documentation (@WaterWhisperer)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
